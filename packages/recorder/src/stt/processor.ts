/**
 * STT job processor - converts audio recordings to timestamped text.
 * Handles large files by splitting into chunks for Whisper API's 25MB limit.
 *
 * Runs two engines per recording:
 * - Whisper (OpenAI) — primary, drives stt_status
 * - Qwen3 ASR (OpenRouter) — secondary, best-effort, enabled when
 *   OPENROUTER_API_KEY is set
 */

import { access, stat, mkdir } from 'fs/promises';
import { join } from 'path';
import type { STTJob, Config } from '../types.js';
import {
  WhisperClient,
  dedupConsecutiveLines,
  collapseInlineRepetition,
} from './whisper.js';
import { splitAudioFile, cleanupChunks } from './chunker.js';
import { R2Client } from '../storage/r2Client.js';
import { WorkersAPIClient } from '../api/client.js';
import { withRetry } from '../scheduler/executor.js';
import { logger } from '../lib/logger.js';

const MAX_SINGLE_FILE_MB = 10; // Files larger than this get chunked

/**
 * Transcribe an audio file with the given client, chunking when too large.
 * Returns cleaned, timestamped text (repetition-suppressed).
 */
async function transcribeAudio(
  client: WhisperClient,
  audioPath: string,
  job: STTJob,
  config: Config,
  prompt: string,
  engine: string
): Promise<string> {
  const fileStats = await stat(audioPath);
  const fileSizeMB = fileStats.size / (1024 * 1024);

  let lines: string[];

  if (fileSizeMB <= MAX_SINGLE_FILE_MB) {
    // Small file: single API call
    logger.info('Processing small file directly', {
      recordingId: job.recording_id,
      engine,
      sizeMB: fileSizeMB.toFixed(1),
    });
    lines = await withRetry(
      () => client.convertToTimestampedText(audioPath, job.recorded_at, prompt),
      `${engine} STT conversion`,
      2
    );
  } else {
    // Large file: split into chunks and process each
    logger.info('Processing large file with chunking', {
      recordingId: job.recording_id,
      engine,
      sizeMB: fileSizeMB.toFixed(1),
    });

    const chunkDir = join(
      config.dataDir,
      'stt-chunks',
      `${job.recording_id}-${engine}`
    );
    const chunks = await splitAudioFile(audioPath, chunkDir);

    try {
      const allLines: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.info(`Processing chunk ${i + 1}/${chunks.length}`, {
          recordingId: job.recording_id,
          engine,
          startOffsetSecs: chunk.startOffsetSecs,
        });

        const chunkLines = await withRetry(
          () => client.transcribeChunk(chunk.path, job.recorded_at, chunk.startOffsetSecs, prompt),
          `${engine} chunk ${i + 1}/${chunks.length}`,
          2
        );
        allLines.push(...chunkLines);
      }

      lines = allLines;
    } finally {
      await cleanupChunks(chunks);
    }
  }

  // Suppress hallucinations: repeated tokens within a line, then repeated lines
  const collapsedLines = lines.map((line) => collapseInlineRepetition(line));
  const dedupedLines = dedupConsecutiveLines(collapsedLines);
  const collapsedRuns = lines.length - dedupedLines.length;
  if (collapsedRuns > 0) {
    logger.info('Collapsed hallucination runs', {
      recordingId: job.recording_id,
      engine,
      originalLines: lines.length,
      dedupedLines: dedupedLines.length,
    });
  }

  return dedupedLines.join('\n');
}

/**
 * Process an STT job: convert audio to timestamped text, upload to R2, update DB.
 */
export async function processSTTJob(
  job: STTJob,
  config: Config,
  localAudioPath: string
): Promise<void> {
  const whisper = new WhisperClient(config);
  const r2 = new R2Client(config);
  const api = new WorkersAPIClient(config);

  const sttFilename = job.audio_file_path.split('/').pop()!.replace('.mp3', '.txt');
  const sttKey = R2Client.getUserSTTKey(job.user_id, sttFilename);

  try {
    // Update status to processing
    await api.updateSTTStatus(job.recording_id, 'processing');

    // Check if local file exists; if not, download from R2
    let audioPath = localAudioPath;
    try {
      await access(audioPath);
    } catch {
      logger.info('Local audio not found, downloading from R2', {
        r2Key: job.audio_file_path,
      });
      const tempDir = join(config.dataDir, 'stt-temp');
      await mkdir(tempDir, { recursive: true });
      audioPath = join(tempDir, `${job.recording_id}.mp3`);
      await withRetry(
        () => r2.downloadFile(job.audio_file_path, audioPath),
        'R2 download for STT'
      );
    }

    // Bias Whisper away from generic ad/silence hallucinations toward this program's context.
    const prompt = `이것은 한국어 라디오 방송 "${job.program_name}" 녹음입니다.`;

    const text = await transcribeAudio(whisper, audioPath, job, config, prompt, 'whisper');

    if (!text) {
      throw new Error('Whisper returned empty transcription');
    }

    // Upload text to R2
    await withRetry(
      () => r2.uploadText(text, sttKey),
      'R2 STT text upload'
    );

    // Update DB status to completed
    await withRetry(
      () => api.updateSTTStatus(job.recording_id, 'completed', sttKey),
      'DB STT status update'
    );

    logger.info('STT job completed', {
      recordingId: job.recording_id,
      sttKey,
      textLength: text.length,
    });

    // Secondary engine (Qwen3 via OpenRouter) — best-effort, never fails the job
    if (config.openrouterApiKey) {
      await processQwen3(job, config, audioPath, prompt, sttFilename, r2, api);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('STT job failed', {
      recordingId: job.recording_id,
      error: message,
    });

    // Best-effort: update DB to failed status
    try {
      await api.updateSTTStatus(job.recording_id, 'failed', undefined, message);
    } catch (updateError) {
      logger.error('Failed to update STT failure status', { updateError });
    }

    throw error;
  }
}

/**
 * Run the secondary Qwen3 STT and store its result alongside the whisper one.
 * Failures are logged only — the whisper result already completed the job.
 */
async function processQwen3(
  job: STTJob,
  config: Config,
  audioPath: string,
  prompt: string,
  sttFilename: string,
  r2: R2Client,
  api: WorkersAPIClient
): Promise<void> {
  try {
    const qwen3 = WhisperClient.forQwen3(config);
    const text = await transcribeAudio(qwen3, audioPath, job, config, prompt, 'qwen3');

    if (!text) {
      throw new Error('Qwen3 returned empty transcription');
    }

    const qwen3Key = R2Client.getUserSTTKey(
      job.user_id,
      sttFilename.replace(/\.txt$/, '.qwen3.txt')
    );

    await withRetry(
      () => r2.uploadText(text, qwen3Key),
      'R2 Qwen3 STT text upload'
    );

    await withRetry(
      () => api.updateQwen3TextPath(job.recording_id, qwen3Key),
      'DB Qwen3 STT path update'
    );

    logger.info('Qwen3 STT completed', {
      recordingId: job.recording_id,
      qwen3Key,
      textLength: text.length,
    });
  } catch (error) {
    logger.error('Qwen3 STT failed (whisper result preserved)', {
      recordingId: job.recording_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

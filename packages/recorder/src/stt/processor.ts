/**
 * STT job processor - converts audio recordings to timestamped text.
 * Handles large files by splitting into chunks for Whisper API's 25MB limit.
 */

import { access, stat, mkdir } from 'fs/promises';
import { join } from 'path';
import type { STTJob, Config } from '../types.js';
import { WhisperClient } from './whisper.js';
import { splitAudioFile, cleanupChunks } from './chunker.js';
import { R2Client } from '../storage/r2Client.js';
import { WorkersAPIClient } from '../api/client.js';
import { withRetry } from '../scheduler/executor.js';
import { logger } from '../lib/logger.js';

const MAX_SINGLE_FILE_MB = 20; // Files larger than this get chunked

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

    // Check file size to decide processing strategy
    const fileStats = await stat(audioPath);
    const fileSizeMB = fileStats.size / (1024 * 1024);

    let text: string;

    if (fileSizeMB <= MAX_SINGLE_FILE_MB) {
      // Small file: single Whisper API call
      logger.info('Processing small file directly', {
        recordingId: job.recording_id,
        sizeMB: fileSizeMB.toFixed(1),
      });
      text = await withRetry(
        () => whisper.convertToTimestampedText(audioPath, job.recorded_at),
        'Whisper STT conversion',
        2
      );
    } else {
      // Large file: split into chunks and process each
      logger.info('Processing large file with chunking', {
        recordingId: job.recording_id,
        sizeMB: fileSizeMB.toFixed(1),
      });

      const chunkDir = join(config.dataDir, 'stt-chunks', String(job.recording_id));
      const chunks = await splitAudioFile(audioPath, chunkDir);

      try {
        const allLines: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          logger.info(`Processing chunk ${i + 1}/${chunks.length}`, {
            recordingId: job.recording_id,
            startOffsetSecs: chunk.startOffsetSecs,
          });

          const lines = await withRetry(
            () => whisper.transcribeChunk(chunk.path, job.recorded_at, chunk.startOffsetSecs),
            `Whisper chunk ${i + 1}/${chunks.length}`,
            2
          );
          allLines.push(...lines);
        }

        text = allLines.join('\n');
      } finally {
        await cleanupChunks(chunks);
      }
    }

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

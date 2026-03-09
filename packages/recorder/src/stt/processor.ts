/**
 * STT job processor - converts audio recordings to timestamped text
 */

import { access } from 'fs/promises';
import { join } from 'path';
import type { STTJob, Config } from '../types.js';
import { WhisperClient } from './whisper.js';
import { R2Client } from '../storage/r2Client.js';
import { WorkersAPIClient } from '../api/client.js';
import { withRetry } from '../scheduler/executor.js';
import { logger } from '../lib/logger.js';

/**
 * Process an STT job: convert audio to timestamped text, upload to R2, update DB.
 *
 * @param job - STT job with recording info
 * @param config - Application config
 * @param localAudioPath - Path to local audio file (may already exist after recording)
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
      const { mkdir } = await import('fs/promises');
      await mkdir(tempDir, { recursive: true });
      audioPath = join(tempDir, `${job.recording_id}.mp3`);
      await withRetry(
        () => r2.downloadFile(job.audio_file_path, audioPath),
        'R2 download for STT'
      );
    }

    // Convert audio to timestamped text
    logger.info('Starting STT conversion', { recordingId: job.recording_id });
    const text = await withRetry(
      () => whisper.convertToTimestampedText(audioPath, job.recorded_at),
      'Whisper STT conversion',
      2 // fewer retries for Whisper API (expensive)
    );

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

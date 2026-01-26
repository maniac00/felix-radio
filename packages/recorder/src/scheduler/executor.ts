/**
 * Recording executor - handles individual recording jobs
 *
 * Priority: Recording data preservation over real-time DB updates
 * - Start recording immediately (don't wait for DB)
 * - Retry all API operations with exponential backoff
 * - Never fail recording due to DB issues
 */

import { mkdir, unlink } from 'fs/promises';
import { stat } from 'fs/promises';
import { join } from 'path';
import type { Schedule, Config, RecordingMetadata } from '../types.js';
import { WorkersAPIClient } from '../api/client.js';
import { R2Client } from '../storage/r2Client.js';
import { recordStream, generateFilename } from '../recorder/ffmpeg.js';
import { logger } from '../lib/logger.js';

const TEMP_DIR = '/tmp/felix-recordings';
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn(`${operationName} failed, retrying in ${delay}ms...`, {
          attempt,
          maxRetries,
          error: lastError.message,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Try an operation but don't throw on failure
 */
async function tryOperation<T>(
  fn: () => Promise<T>,
  operationName: string,
  defaultValue: T
): Promise<T> {
  try {
    return await withRetry(fn, operationName);
  } catch (error) {
    logger.error(`${operationName} failed after all retries`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return defaultValue;
  }
}

/**
 * Execute a recording job
 *
 * Flow (recording-first approach):
 * 1. Start ffmpeg recording IMMEDIATELY (critical path)
 * 2. Try to create DB entry (non-blocking, with retries)
 * 3. Wait for recording to complete
 * 4. Upload to R2 (with retries)
 * 5. Update/Create DB entry (with retries)
 */
export async function executeRecording(
  schedule: Schedule,
  config: Config
): Promise<void> {
  const apiClient = new WorkersAPIClient(config);
  const r2Client = new R2Client(config);

  logger.info('Executing recording', {
    scheduleId: schedule.id,
    program: schedule.program_name,
    duration: schedule.duration_mins,
  });

  // Ensure temp directory exists
  await mkdir(TEMP_DIR, { recursive: true });

  // Generate filename and paths
  const now = new Date();
  const filename = generateFilename(schedule.program_name, now);
  const outputPath = join(TEMP_DIR, filename);
  const r2Key = R2Client.getUserRecordingKey(schedule.user_id, filename);

  // Prepare recording metadata
  const metadata: RecordingMetadata = {
    user_id: schedule.user_id,
    schedule_id: schedule.id,
    station_id: schedule.station_id,
    program_name: schedule.program_name,
    recorded_at: now.toISOString(),
    duration_secs: schedule.duration_mins * 60,
    file_size_bytes: 0,
    audio_file_path: r2Key,
    status: 'recording',
  };

  let recordingId: number | null = null;

  // 1. START RECORDING IMMEDIATELY (this is the critical path)
  logger.info('Starting recording immediately', { filename });
  const recordingPromise = recordStream({
    streamUrl: schedule.stream_url,
    durationSecs: schedule.duration_mins * 60,
    outputPath,
  });

  // 2. Try to create DB entry in parallel (non-blocking)
  // Even if this fails, the recording continues
  const dbCreatePromise = tryOperation(
    () => apiClient.createRecording(metadata),
    'DB recording creation',
    null as number | null
  ).then(id => {
    recordingId = id;
    if (id) {
      logger.info('DB recording entry created', { recordingId: id });
    } else {
      logger.warn('DB recording entry creation failed, will create after recording');
    }
    return id;
  });

  try {
    // 3. Wait for recording to complete (this is the main wait)
    await recordingPromise;

    // Get file size
    const fileStats = await stat(outputPath);
    logger.info('Recording completed', { filename, size: fileStats.size });

    // 4. Upload to R2 (with retries - this is critical for data preservation)
    await withRetry(
      () => r2Client.uploadFile(outputPath, r2Key),
      'R2 upload'
    );
    logger.info('File uploaded to R2', { r2Key, size: fileStats.size });

    // Wait for DB create to finish (if still pending)
    await dbCreatePromise;

    // 5. Update or create DB entry
    if (recordingId) {
      // DB entry exists, update status
      await tryOperation(
        () => apiClient.updateRecordingStatus(recordingId!, 'completed', undefined, fileStats.size),
        'DB status update',
        undefined
      );
    } else {
      // DB entry doesn't exist, create it with completed status
      metadata.status = 'completed';
      metadata.file_size_bytes = fileStats.size;

      const newId = await tryOperation(
        () => apiClient.createRecording(metadata),
        'DB recording creation (post-upload)',
        null as number | null
      );

      if (newId) {
        recordingId = newId;
        logger.info('DB recording entry created after upload', { recordingId: newId });
      } else {
        // Even DB creation failed, but file is safely in R2
        logger.error('Failed to create DB entry, but file is saved in R2', {
          r2Key,
          fileSize: fileStats.size,
          metadata,
        });
      }
    }

    logger.info('Recording job completed successfully', {
      recordingId,
      filename,
      r2Key,
    });

  } catch (error) {
    logger.error('Recording job failed', {
      scheduleId: schedule.id,
      error,
    });

    // Try to update DB status to failed (if we have a recording ID)
    if (recordingId) {
      await tryOperation(
        () => apiClient.updateRecordingStatus(
          recordingId!,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        ),
        'DB failure status update',
        undefined
      );
    }

    throw error;
  } finally {
    // Clean up temp file
    try {
      await unlink(outputPath);
      logger.debug('Temp file deleted', { outputPath });
    } catch (error) {
      logger.warn('Failed to delete temp file', { outputPath, error });
    }
  }
}

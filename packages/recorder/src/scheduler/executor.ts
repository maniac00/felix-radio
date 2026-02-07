/**
 * Recording executor - handles individual recording jobs
 *
 * Priority: Recording data preservation over real-time DB updates
 * - Start recording immediately (don't wait for DB)
 * - Retry all API operations with exponential backoff
 * - Never fail recording due to DB issues
 * - Local files preserved until db_synced + retention period
 *
 * State machine per journal entry:
 * scheduled -> recording -> recorded -> uploading -> uploaded -> db_synced
 */

import { mkdir, stat, access } from 'fs/promises';
import { join } from 'path';
import type { Schedule, Config, RecordingMetadata } from '../types.js';
import { WorkersAPIClient } from '../api/client.js';
import { R2Client } from '../storage/r2Client.js';
import { recordStream, generateFilename } from '../recorder/ffmpeg.js';
import { logger } from '../lib/logger.js';
import type { Journal } from '../journal/journal.js';
import type { JournalEntry } from '../journal/types.js';

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
 * Get the audio directory under dataDir
 */
function getAudioDir(dataDir: string): string {
  return join(dataDir, 'audio');
}

/**
 * Execute a new recording job: creates journal entry then processes it
 */
export async function executeRecording(
  schedule: Schedule,
  config: Config,
  journal: Journal
): Promise<void> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `${schedule.id}_${dateStr}`;

  // Check if already processing (dedup)
  if (journal.hasEntry(schedule.id, dateStr)) {
    logger.debug('Schedule already in journal, skipping', { key });
    return;
  }

  const audioDir = getAudioDir(config.dataDir);
  await mkdir(audioDir, { recursive: true });

  const filename = generateFilename(schedule.program_name, now);
  const localPath = join(audioDir, filename);
  const r2Key = R2Client.getUserRecordingKey(schedule.user_id, filename);

  const entry: JournalEntry = {
    key,
    scheduleId: schedule.id,
    date: dateStr,
    status: 'scheduled',
    localPath,
    r2Key,
    recordingId: null,
    schedule: {
      userId: schedule.user_id,
      stationId: schedule.station_id,
      programName: schedule.program_name,
      durationMins: schedule.duration_mins,
      streamUrl: schedule.stream_url,
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    retryCount: 0,
  };

  await journal.addEntry(entry);

  logger.info('Executing recording', {
    key,
    program: schedule.program_name,
    duration: schedule.duration_mins,
  });

  await processEntry(entry, config, journal);
}

/**
 * Process a journal entry from its current state.
 * This is the core state machine - can resume from any intermediate state.
 */
export async function processEntry(
  entry: JournalEntry,
  config: Config,
  journal: Journal
): Promise<void> {
  const apiClient = new WorkersAPIClient(config);
  const r2Client = new R2Client(config);

  try {
    // Phase: scheduled -> recording
    if (entry.status === 'scheduled') {
      await journal.updateEntry(entry.key, { status: 'recording' });
      entry.status = 'recording';

      // Start recording immediately
      logger.info('Starting recording', { key: entry.key, localPath: entry.localPath });

      const recordingPromise = recordStream({
        streamUrl: entry.schedule.streamUrl,
        durationSecs: entry.schedule.durationMins * 60,
        outputPath: entry.localPath,
      });

      // Try to create DB entry in parallel (non-blocking)
      const metadata: RecordingMetadata = {
        user_id: entry.schedule.userId,
        schedule_id: entry.scheduleId,
        station_id: entry.schedule.stationId,
        program_name: entry.schedule.programName,
        recorded_at: entry.createdAt,
        duration_secs: entry.schedule.durationMins * 60,
        file_size_bytes: 0,
        audio_file_path: entry.r2Key,
        status: 'recording',
      };

      const dbPromise = tryOperation(
        () => apiClient.createRecording(metadata),
        'DB recording creation',
        null as number | null
      ).then(async id => {
        if (id) {
          entry.recordingId = id;
          await journal.updateEntry(entry.key, { recordingId: id });
          logger.info('DB recording entry created', { key: entry.key, recordingId: id });
        }
        return id;
      });

      // Wait for recording to complete
      await recordingPromise;
      await dbPromise; // Wait for DB attempt too

      await journal.updateEntry(entry.key, { status: 'recorded' });
      entry.status = 'recorded';

      logger.info('Recording completed', { key: entry.key });
    }

    // Phase: recorded -> uploading -> uploaded
    if (entry.status === 'recorded' || entry.status === 'uploading') {
      // Verify local file exists
      await access(entry.localPath);
      const fileStats = await stat(entry.localPath);

      await journal.updateEntry(entry.key, { status: 'uploading' });
      entry.status = 'uploading';

      logger.info('Uploading to R2', { key: entry.key, size: fileStats.size });

      await withRetry(
        () => r2Client.uploadFile(entry.localPath, entry.r2Key),
        'R2 upload'
      );

      await journal.updateEntry(entry.key, { status: 'uploaded' });
      entry.status = 'uploaded';

      logger.info('Uploaded to R2', { key: entry.key, r2Key: entry.r2Key });
    }

    // Phase: uploaded -> db_synced
    if (entry.status === 'uploaded') {
      const fileStats = await stat(entry.localPath);

      if (entry.recordingId) {
        // Update existing DB entry
        await withRetry(
          () => apiClient.updateRecordingStatus(
            entry.recordingId!,
            'completed',
            undefined,
            fileStats.size
          ),
          'DB status update'
        );
      } else {
        // Create DB entry with completed status
        const metadata: RecordingMetadata = {
          user_id: entry.schedule.userId,
          schedule_id: entry.scheduleId,
          station_id: entry.schedule.stationId,
          program_name: entry.schedule.programName,
          recorded_at: entry.createdAt,
          duration_secs: entry.schedule.durationMins * 60,
          file_size_bytes: fileStats.size,
          audio_file_path: entry.r2Key,
          status: 'completed',
        };

        const newId = await withRetry(
          () => apiClient.createRecording(metadata),
          'DB recording creation (post-upload)'
        );
        entry.recordingId = newId;
        await journal.updateEntry(entry.key, { recordingId: newId });
      }

      await journal.updateEntry(entry.key, { status: 'db_synced' });
      entry.status = 'db_synced';

      logger.info('Recording job fully completed', {
        key: entry.key,
        recordingId: entry.recordingId,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Recording job failed', { key: entry.key, status: entry.status, error: message });

    await journal.updateEntry(entry.key, {
      status: 'failed',
      errorMessage: message,
      retryCount: entry.retryCount + 1,
    });

    // Try to update DB status to failed
    if (entry.recordingId) {
      await tryOperation(
        () => apiClient.updateRecordingStatus(entry.recordingId!, 'failed', message),
        'DB failure status update',
        undefined
      );
    }

    throw error;
  }
}

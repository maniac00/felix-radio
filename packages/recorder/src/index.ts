/**
 * Felix Radio Recorder Server
 * Polls for scheduled recordings and executes them using ffmpeg
 *
 * On startup:
 * 1. Load journal from disk
 * 2. Recover incomplete entries (resume from last known state)
 * 3. Start schedule poller
 * 4. Start file cleaner
 */

import { access } from 'fs/promises';
import { loadConfig, validateConfig } from './config.js';
import { SchedulePoller } from './scheduler/poller.js';
import { processEntry } from './scheduler/executor.js';
import { Journal } from './journal/journal.js';
import { FileCleaner } from './journal/cleaner.js';
import { logger } from './lib/logger.js';
import type { JournalEntry } from './journal/types.js';
import type { Config } from './types.js';

// Load and validate configuration
logger.info('Loading configuration...');
const config = loadConfig();

try {
  validateConfig(config);
  logger.info('Configuration validated successfully');
} catch (error) {
  logger.error('Configuration validation failed', { error });
  process.exit(1);
}

// Log configuration (redact secrets)
logger.info('Configuration loaded', {
  workersApiUrlPrimary: config.workersApiUrlPrimary || '(none)',
  workersApiUrlFallback: config.workersApiUrlFallback,
  r2Endpoint: config.r2Endpoint,
  r2BucketName: config.r2BucketName,
  timezone: config.timezone,
  logLevel: config.logLevel,
  dataDir: config.dataDir,
  retentionDays: config.retentionDays,
  scheduleWindowMins: config.scheduleWindowMins,
});

// Initialize journal
const journal = new Journal(config.dataDir);

async function recoverIncomplete(config: Config, journal: Journal): Promise<void> {
  const incomplete = journal.getIncomplete();
  if (incomplete.length === 0) {
    logger.info('No incomplete entries to recover');
    return;
  }

  logger.info(`Found ${incomplete.length} incomplete entry(ies) to recover`);

  for (const entry of incomplete) {
    try {
      await recoverEntry(entry, config, journal);
    } catch (error) {
      logger.error('Recovery failed for entry', {
        key: entry.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function recoverEntry(
  entry: JournalEntry,
  config: Config,
  journal: Journal
): Promise<void> {
  logger.info('Recovering entry', { key: entry.key, status: entry.status });

  switch (entry.status) {
    case 'scheduled': {
      // Schedule time has passed, mark as failed
      logger.warn('Scheduled entry missed (process was down), marking failed', { key: entry.key });
      await journal.updateEntry(entry.key, {
        status: 'failed',
        errorMessage: 'Missed: process was not running at scheduled time',
      });
      break;
    }

    case 'recording': {
      // Check if local file exists (recording may have completed before crash)
      const hasFile = await fileExists(entry.localPath);
      if (hasFile) {
        logger.info('Recording file found, resuming from recorded state', { key: entry.key });
        await journal.updateEntry(entry.key, { status: 'recorded' });
        entry.status = 'recorded';
        await processEntry(entry, config, journal);
      } else {
        logger.warn('Recording interrupted (no file), marking failed', { key: entry.key });
        await journal.updateEntry(entry.key, {
          status: 'failed',
          errorMessage: 'Recording interrupted: process crashed during recording',
        });
      }
      break;
    }

    case 'recorded':
    case 'uploading': {
      // Resume upload from where we left off
      const hasFile = await fileExists(entry.localPath);
      if (hasFile) {
        logger.info('Resuming upload', { key: entry.key });
        entry.status = 'recorded'; // Reset to recorded to retry upload
        await journal.updateEntry(entry.key, { status: 'recorded' });
        await processEntry(entry, config, journal);
      } else {
        logger.warn('Local file missing, marking failed', { key: entry.key });
        await journal.updateEntry(entry.key, {
          status: 'failed',
          errorMessage: 'Local file missing during recovery',
        });
      }
      break;
    }

    case 'uploaded': {
      // Just need DB sync
      logger.info('Resuming DB sync', { key: entry.key });
      await processEntry(entry, config, journal);
      break;
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Main startup
async function main(): Promise<void> {
  // Load journal
  await journal.load();

  // Recover incomplete entries
  await recoverIncomplete(config, journal);

  // Initialize schedule poller
  const poller = new SchedulePoller(config, journal);

  // Initialize file cleaner
  const cleaner = new FileCleaner(journal, config.retentionDays);

  // Graceful shutdown handler
  function shutdown(signal: string): void {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    poller.stop();
    cleaner.stop();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start services
  logger.info('Starting Felix Radio Recorder...');
  poller.start();
  cleaner.start();
  logger.info('Felix Radio Recorder is running');
}

main().catch(error => {
  logger.error('Fatal startup error', { error });
  process.exit(1);
});

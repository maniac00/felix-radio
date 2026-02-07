/**
 * File cleaner - removes local audio files after retention period
 *
 * Only cleans files that are in 'db_synced' state and older than retentionDays.
 * Runs on an interval (default: every hour).
 */

import { unlink, access } from 'fs/promises';
import { logger } from '../lib/logger.js';
import type { Journal } from './journal.js';

const CLEAN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export class FileCleaner {
  private journal: Journal;
  private retentionDays: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(journal: Journal, retentionDays: number) {
    this.journal = journal;
    this.retentionDays = retentionDays;
  }

  start(): void {
    logger.info('Starting file cleaner', { retentionDays: this.retentionDays });
    this.timer = setInterval(() => this.clean(), CLEAN_INTERVAL_MS);
    // Run once at startup after a short delay
    setTimeout(() => this.clean(), 10_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('File cleaner stopped');
    }
  }

  private async clean(): Promise<void> {
    try {
      const now = Date.now();
      const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;
      const entries = this.journal.getEntriesByStatus('db_synced');

      let cleaned = 0;
      for (const entry of entries) {
        const entryAge = now - new Date(entry.updatedAt).getTime();
        if (entryAge < retentionMs) continue;

        // Try to delete local file
        try {
          await access(entry.localPath);
          await unlink(entry.localPath);
          logger.debug('Cleaned local file', { key: entry.key, path: entry.localPath });
        } catch {
          // File already gone, that's fine
        }

        // Remove journal entry
        await this.journal.removeEntry(entry.key);
        cleaned++;
      }

      if (cleaned > 0) {
        logger.info('File cleaner completed', { cleaned, remaining: entries.length - cleaned });
      }
    } catch (error) {
      logger.error('File cleaner error', { error });
    }
  }
}

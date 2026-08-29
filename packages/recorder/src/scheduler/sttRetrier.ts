/**
 * STT retrier - reprocesses recordings whose STT failed.
 *
 * OpenRouter inference outages can last minutes to hours, so failed STT jobs
 * (journal entries reverted to db_synced) are retried on an interval with
 * exponential backoff: 5min -> 10 -> 20 -> 40 -> 60 (capped), up to
 * config.sttRetryMax attempts. Entries are dropped naturally when the
 * FileCleaner removes them after the retention period.
 */

import type { Config } from '../types.js';
import { runSTTPhase } from './executor.js';
import { logger } from '../lib/logger.js';
import type { Journal } from '../journal/journal.js';
import type { JournalEntry } from '../journal/types.js';

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BASE_BACKOFF_MINS = 5;
const MAX_BACKOFF_MINS = 60;

export class STTRetrier {
  private config: Config;
  private journal: Journal;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config: Config, journal: Journal) {
    this.config = config;
    this.journal = journal;
  }

  start(): void {
    logger.info('Starting STT retrier', {
      scanIntervalMins: SCAN_INTERVAL_MS / 60_000,
      maxAttempts: this.config.sttRetryMax,
    });
    this.timer = setInterval(() => this.scan(), SCAN_INTERVAL_MS);
    // Run once shortly after startup to pick up entries left from a crash
    setTimeout(() => this.scan(), 30_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('STT retrier stopped');
    }
  }

  /** Backoff delay before attempt N+1, given N failed attempts */
  private backoffMins(attempts: number): number {
    return Math.min(BASE_BACKOFF_MINS * Math.pow(2, attempts - 1), MAX_BACKOFF_MINS);
  }

  private isDue(entry: JournalEntry, now: number): boolean {
    if (!entry.recordingId) return false;

    const attempts = entry.sttAttempts ?? 0;
    if (attempts >= this.config.sttRetryMax) return false;

    // Never attempted (e.g. crash between db_synced and STT start): due now
    if (!entry.sttLastAttemptAt) return true;

    const elapsed = now - new Date(entry.sttLastAttemptAt).getTime();
    return elapsed >= this.backoffMins(Math.max(attempts, 1)) * 60_000;
  }

  private async scan(): Promise<void> {
    if (this.running) return; // Previous scan (an STT call) still in progress
    this.running = true;

    try {
      const now = Date.now();
      const candidates = this.journal
        .getEntriesByStatus('db_synced')
        .filter((entry) => this.isDue(entry, now));

      if (candidates.length === 0) return;

      logger.info('STT retrier found pending entries', {
        count: candidates.length,
      });

      for (const entry of candidates) {
        const attempts = entry.sttAttempts ?? 0;
        logger.info('Retrying STT', {
          key: entry.key,
          attempt: attempts + 1,
          maxAttempts: this.config.sttRetryMax,
        });

        try {
          const ok = await runSTTPhase(entry, this.config, this.journal);
          if (!ok && (entry.sttAttempts ?? 0) >= this.config.sttRetryMax) {
            logger.error('STT retries exhausted, giving up', {
              key: entry.key,
              attempts: entry.sttAttempts,
            });
          }
        } catch (error) {
          logger.error('STT retry error', {
            key: entry.key,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      logger.error('STT retrier scan error', { error });
    } finally {
      this.running = false;
    }
  }
}

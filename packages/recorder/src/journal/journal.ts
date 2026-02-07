/**
 * JSON file-based journal for tracking recording state
 *
 * Uses atomic writes (write to .tmp then rename) to prevent corruption.
 * Each entry tracks a single recording through its lifecycle:
 * scheduled -> recording -> recorded -> uploading -> uploaded -> db_synced
 */

import { readFile, writeFile, rename, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { logger } from '../lib/logger.js';
import type { JournalData, JournalEntry, JournalStatus } from './types.js';

export class Journal {
  private filePath: string;
  private data: JournalData = { version: 1, entries: {} };
  private writePromise: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'journal.json');
  }

  /**
   * Load journal from disk. Creates empty journal if file doesn't exist.
   */
  async load(): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      const raw = await readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(raw) as JournalData;
      logger.info('Journal loaded', { entries: Object.keys(this.data.entries).length });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.data = { version: 1, entries: {} };
        logger.info('Journal file not found, starting fresh');
        await this.flush();
      } else {
        logger.error('Failed to load journal, starting fresh', { error: error.message });
        this.data = { version: 1, entries: {} };
        await this.flush();
      }
    }
  }

  /**
   * Generate unique key for a schedule+date combo
   */
  static makeKey(scheduleId: number, date: string): string {
    return `${scheduleId}_${date}`;
  }

  /**
   * Check if an entry exists for this schedule+date
   */
  hasEntry(scheduleId: number, date: string): boolean {
    const key = Journal.makeKey(scheduleId, date);
    return key in this.data.entries;
  }

  /**
   * Get entry by key
   */
  getEntry(key: string): JournalEntry | undefined {
    return this.data.entries[key];
  }

  /**
   * Add a new entry
   */
  async addEntry(entry: JournalEntry): Promise<void> {
    this.data.entries[entry.key] = entry;
    await this.flush();
    logger.debug('Journal entry added', { key: entry.key, status: entry.status });
  }

  /**
   * Update entry status and optional fields
   */
  async updateEntry(
    key: string,
    updates: Partial<Pick<JournalEntry, 'status' | 'recordingId' | 'errorMessage' | 'retryCount' | 'localPath'>>
  ): Promise<void> {
    const entry = this.data.entries[key];
    if (!entry) {
      logger.warn('Attempted to update non-existent journal entry', { key });
      return;
    }
    Object.assign(entry, updates, { updatedAt: new Date().toISOString() });
    await this.flush();
    logger.debug('Journal entry updated', { key, updates });
  }

  /**
   * Remove an entry (used by cleaner)
   */
  async removeEntry(key: string): Promise<void> {
    delete this.data.entries[key];
    await this.flush();
  }

  /**
   * Get all entries with a given status
   */
  getEntriesByStatus(status: JournalStatus): JournalEntry[] {
    return Object.values(this.data.entries).filter(e => e.status === status);
  }

  /**
   * Get all incomplete entries (not db_synced and not failed)
   */
  getIncomplete(): JournalEntry[] {
    return Object.values(this.data.entries).filter(
      e => e.status !== 'db_synced' && e.status !== 'failed'
    );
  }

  /**
   * Get all entries (for cleaner inspection)
   */
  getAllEntries(): JournalEntry[] {
    return Object.values(this.data.entries);
  }

  /**
   * Atomically write journal to disk.
   * Serializes writes to prevent concurrent file corruption.
   */
  private async flush(): Promise<void> {
    this.writePromise = this.writePromise.then(async () => {
      const tmpPath = this.filePath + '.tmp';
      try {
        const json = JSON.stringify(this.data, null, 2);
        await writeFile(tmpPath, json, 'utf-8');
        await rename(tmpPath, this.filePath);
      } catch (error) {
        logger.error('Failed to flush journal', { error });
      }
    });
    await this.writePromise;
  }
}

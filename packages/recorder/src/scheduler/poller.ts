/**
 * Schedule poller - checks for pending recordings every minute
 *
 * Uses a time window (default 5 min) to catch schedules that might have been
 * missed due to API failures. Journal-based dedup prevents double recordings.
 */

import cron from 'node-cron';
import type { Config } from '../types.js';
import { WorkersAPIClient } from '../api/client.js';
import { executeRecording } from './executor.js';
import { logger } from '../lib/logger.js';
import type { Journal } from '../journal/journal.js';

export class SchedulePoller {
  private apiClient: WorkersAPIClient;
  private config: Config;
  private journal: Journal;
  private task: cron.ScheduledTask | null = null;

  constructor(config: Config, journal: Journal) {
    this.config = config;
    this.journal = journal;
    this.apiClient = new WorkersAPIClient(config);
  }

  /**
   * Start polling for pending schedules every minute
   */
  start(): void {
    logger.info('Starting schedule poller (every 1 minute)', {
      windowMins: this.config.scheduleWindowMins,
    });

    // Run every minute at the start of the minute
    this.task = cron.schedule('* * * * *', async () => {
      await this.poll();
    });

    logger.info('Schedule poller started');
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      logger.info('Schedule poller stopped');
    }
  }

  /**
   * Poll for pending schedules and execute recordings
   */
  private async poll(): Promise<void> {
    try {
      const now = new Date();
      const currentDay = now.getDay(); // 0-6, Sunday=0

      // Calculate time window: from (now - windowMins) to now
      const timeTo = this.formatTime(now);
      const windowStart = new Date(now.getTime() - this.config.scheduleWindowMins * 60 * 1000);
      const timeFrom = this.formatTime(windowStart);

      logger.debug('Polling for pending schedules', { timeFrom, timeTo, currentDay });

      const schedules = await this.apiClient.fetchPendingSchedules(
        timeFrom,
        timeTo,
        currentDay
      );

      if (schedules.length === 0) {
        logger.debug('No pending schedules');
        return;
      }

      // Filter out schedules already tracked in journal (dedup)
      const dateStr = now.toISOString().slice(0, 10);
      const newSchedules = schedules.filter(s => !this.journal.hasEntry(s.id, dateStr));

      if (newSchedules.length === 0) {
        logger.debug('All schedules already in journal', {
          total: schedules.length,
        });
        return;
      }

      logger.info(`Found ${newSchedules.length} new schedule(s) to record`, {
        total: schedules.length,
        filtered: schedules.length - newSchedules.length,
      });

      // Execute all new recordings in parallel
      const promises = newSchedules.map((schedule) =>
        executeRecording(schedule, this.config, this.journal).catch((error) => {
          logger.error('Recording execution failed', {
            scheduleId: schedule.id,
            error,
          });
        })
      );

      await Promise.all(promises);
    } catch (error) {
      logger.error('Poll failed', { error });
    }
  }

  /**
   * Format time as HH:mm
   */
  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

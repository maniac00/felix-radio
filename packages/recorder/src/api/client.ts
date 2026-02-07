/**
 * Cloudflare Workers API client
 */

import type { Config } from '../types.js';
import type { Schedule, RecordingMetadata } from '../types.js';
import { logger } from '../lib/logger.js';

export class WorkersAPIClient {
  private primaryUrl: string;
  private fallbackUrl: string;
  private apiKey: string;
  private currentUrl: string;

  constructor(config: Config) {
    this.primaryUrl = config.workersApiUrlPrimary;
    this.fallbackUrl = config.workersApiUrlFallback;
    this.apiKey = config.internalApiKey;
    this.currentUrl = this.fallbackUrl; // Default to fallback
  }

  /**
   * Check if API is healthy
   */
  private async isHealthy(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      logger.debug(`Health check failed for ${url}`, { error });
      return false;
    }
  }

  /**
   * Select the best available API URL
   */
  private async selectApiUrl(): Promise<string> {
    // Try primary first if configured
    if (this.primaryUrl) {
      const primaryHealthy = await this.isHealthy(this.primaryUrl);
      if (primaryHealthy) {
        if (this.currentUrl !== this.primaryUrl) {
          logger.info(`Switched to primary API: ${this.primaryUrl}`);
          this.currentUrl = this.primaryUrl;
        }
        return this.primaryUrl;
      }
    }

    // Fall back to production
    if (this.currentUrl !== this.fallbackUrl) {
      logger.info(`Switched to fallback API: ${this.fallbackUrl}`);
      this.currentUrl = this.fallbackUrl;
    }
    return this.fallbackUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Select best API URL before each request
    const baseUrl = await this.selectApiUrl();
    const url = `${baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${response.status} ${error}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      logger.error('API request failed', { url, error });
      throw error;
    }
  }

  /**
   * Fetch pending schedules for a time range
   */
  async fetchPendingSchedules(
    timeFrom: string,
    timeTo: string,
    currentDay: number
  ): Promise<Schedule[]> {
    logger.debug('Fetching pending schedules', { timeFrom, timeTo, currentDay });

    const response = await this.request<{
      schedules: Schedule[];
      count: number;
    }>(`/api/internal/schedules/pending?time_from=${timeFrom}&time_to=${timeTo}&day=${currentDay}`);

    logger.info(`Found ${response.count} pending schedules`);
    return response.schedules;
  }

  /**
   * Create a new recording entry
   */
  async createRecording(metadata: RecordingMetadata): Promise<number> {
    logger.debug('Creating recording', { metadata });

    const response = await this.request<{
      message: string;
      recording_id: number;
    }>('/api/internal/recordings', {
      method: 'POST',
      body: JSON.stringify(metadata),
    });

    logger.info(`Recording created with ID: ${response.recording_id}`);
    return response.recording_id;
  }

  /**
   * Update recording status
   */
  async updateRecordingStatus(
    recordingId: number,
    status: 'pending' | 'recording' | 'completed' | 'failed',
    errorMessage?: string,
    fileSizeBytes?: number
  ): Promise<void> {
    logger.debug('Updating recording status', {
      recordingId,
      status,
      errorMessage,
      fileSizeBytes,
    });

    const payload: any = {
      status,
      error_message: errorMessage,
    };

    if (fileSizeBytes !== undefined) {
      payload.file_size_bytes = fileSizeBytes;
    }

    await this.request(`/api/internal/recordings/${recordingId}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    logger.info(`Recording ${recordingId} status updated to ${status}`);
  }

  /**
   * Update STT status
   */
  async updateSTTStatus(
    recordingId: number,
    sttStatus: 'none' | 'processing' | 'completed' | 'failed',
    sttTextPath?: string,
    errorMessage?: string
  ): Promise<void> {
    logger.debug('Updating STT status', {
      recordingId,
      sttStatus,
      sttTextPath,
    });

    await this.request(`/api/internal/recordings/${recordingId}/stt`, {
      method: 'PUT',
      body: JSON.stringify({
        stt_status: sttStatus,
        stt_text_path: sttTextPath,
        error_message: errorMessage,
      }),
    });

    logger.info(`Recording ${recordingId} STT status updated to ${sttStatus}`);
  }
}

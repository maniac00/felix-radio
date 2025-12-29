/**
 * Cloudflare Workers API client
 */

import type { Config } from '../types.js';
import type { Schedule, RecordingMetadata } from '../types.js';
import { logger } from '../lib/logger.js';

export class WorkersAPIClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: Config) {
    this.baseUrl = config.workersApiUrl;
    this.apiKey = config.internalApiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

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
   * Fetch pending schedules for current time
   */
  async fetchPendingSchedules(
    currentTime: string,
    currentDay: number
  ): Promise<Schedule[]> {
    logger.debug('Fetching pending schedules', { currentTime, currentDay });

    const response = await this.request<{
      schedules: Schedule[];
      count: number;
    }>(`/api/internal/schedules/pending?time=${currentTime}&day=${currentDay}`);

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
    errorMessage?: string
  ): Promise<void> {
    logger.debug('Updating recording status', {
      recordingId,
      status,
      errorMessage,
    });

    await this.request(`/api/internal/recordings/${recordingId}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        error_message: errorMessage,
      }),
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

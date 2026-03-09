/**
 * OpenAI Whisper API client for speech-to-text conversion
 */

import OpenAI, { APIError } from 'openai';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import type { Config } from '../types.js';
import { logger } from '../lib/logger.js';

/**
 * Convert OpenAI API errors to user-friendly messages
 */
function toUserError(error: unknown): Error {
  if (error instanceof APIError) {
    if (error.code === 'insufficient_quota' || error.status === 429) {
      return new Error('AI 서비스 오류. 관리자 문의');
    }
    if (error.code === 'invalid_api_key' || error.status === 401) {
      return new Error('AI 서비스 오류. 관리자 문의');
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9

/**
 * Format a UTC timestamp + offset into KST (HH:mm:ss) string
 */
function formatKSTTime(recordedAtISO: string, offsetSecs: number): string {
  const baseTime = new Date(recordedAtISO).getTime();
  const actualTime = new Date(baseTime + offsetSecs * 1000 + KST_OFFSET_MS);
  const h = String(actualTime.getUTCHours()).padStart(2, '0');
  const m = String(actualTime.getUTCMinutes()).padStart(2, '0');
  const s = String(actualTime.getUTCSeconds()).padStart(2, '0');
  return `(${h}:${m}:${s})`;
}

export class WhisperClient {
  private client: OpenAI;

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  /**
   * Validate audio file size (Whisper 25MB limit)
   */
  private async validateFileSize(audioFilePath: string): Promise<void> {
    const fileStats = await stat(audioFilePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);

    if (fileSizeMB > 25) {
      throw new Error(
        `File size ${fileSizeMB.toFixed(2)}MB exceeds Whisper API limit of 25MB`
      );
    }

    logger.debug('Audio file stats', {
      size: fileStats.size,
      sizeMB: fileSizeMB.toFixed(2),
    });
  }

  /**
   * Convert audio file to plain text using Whisper API
   */
  async convertToText(audioFilePath: string): Promise<string> {
    logger.info('Converting audio to text with Whisper', { audioFilePath });

    try {
      await this.validateFileSize(audioFilePath);

      const fileStream = createReadStream(audioFilePath);

      const transcription = await this.client.audio.transcriptions.create({
        file: fileStream as any,
        model: 'whisper-1',
        language: 'ko',
        response_format: 'text',
      });

      logger.info('Transcription completed', {
        textLength: transcription.length,
      });

      return transcription;
    } catch (error) {
      logger.error('Whisper API failed', { audioFilePath, error });
      throw toUserError(error);
    }
  }

  /**
   * Convert audio file to timestamped text using Whisper API verbose_json.
   * Each segment is prefixed with actual clock time in KST (24h format).
   * Example output: "(14:38:45) 오늘의 뉴스는..."
   *
   * @param audioFilePath - Path to local audio file
   * @param recordedAt - ISO 8601 UTC timestamp of when recording started
   */
  async convertToTimestampedText(
    audioFilePath: string,
    recordedAt: string
  ): Promise<string> {
    logger.info('Converting audio to timestamped text with Whisper', {
      audioFilePath,
      recordedAt,
    });

    try {
      await this.validateFileSize(audioFilePath);

      const fileStream = createReadStream(audioFilePath);

      const transcription = await this.client.audio.transcriptions.create({
        file: fileStream as any,
        model: 'whisper-1',
        language: 'ko',
        response_format: 'verbose_json',
      });

      const segments = transcription.segments ?? [];

      if (segments.length === 0) {
        logger.warn('No segments returned from Whisper API');
        return '';
      }

      const lines = segments.map((segment) => {
        const timestamp = formatKSTTime(recordedAt, segment.start);
        const text = segment.text.trim();
        return `${timestamp} ${text}`;
      });

      const result = lines.join('\n');

      logger.info('Timestamped transcription completed', {
        segments: segments.length,
        textLength: result.length,
      });

      return result;
    } catch (error) {
      logger.error('Whisper API failed', { audioFilePath, error });
      throw toUserError(error);
    }
  }
}

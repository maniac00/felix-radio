/**
 * OpenAI Whisper API client for speech-to-text conversion
 */

import OpenAI, { APIError } from 'openai';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import type { Config } from '../types.js';
import { logger } from '../lib/logger.js';

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

export class WhisperClient {
  private client: OpenAI;
  private model: string;

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
    this.model = config.transcriptionModel;
  }

  /**
   * Validate audio file size (Whisper 25MB limit)
   */
  private async validateFileSize(audioFilePath: string): Promise<number> {
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

    return fileStats.size;
  }

  /**
   * Convert audio file to plain text using Whisper API
   */
  async convertToText(audioFilePath: string): Promise<string> {
    logger.info('Converting audio to text', { audioFilePath, model: this.model });

    try {
      await this.validateFileSize(audioFilePath);

      const fileStream = createReadStream(audioFilePath);

      const transcription = await this.client.audio.transcriptions.create({
        file: fileStream as any,
        model: this.model,
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
   * Convert a single audio file (must be ≤25MB) to timestamped text.
   * For files >25MB, use transcribeChunk() with audio splitting.
   */
  async convertToTimestampedText(
    audioFilePath: string,
    recordedAt: string
  ): Promise<string> {
    logger.info('Converting audio to timestamped text', {
      audioFilePath,
      recordedAt,
      model: this.model,
    });

    try {
      await this.validateFileSize(audioFilePath);
      const lines = await this.transcribeChunk(audioFilePath, recordedAt, 0);
      const result = lines.join('\n');

      logger.info('Timestamped transcription completed', {
        lines: lines.length,
        textLength: result.length,
      });

      return result;
    } catch (error) {
      logger.error('Whisper API failed', { audioFilePath, error });
      throw toUserError(error);
    }
  }

  /**
   * Transcribe a single audio chunk and return formatted lines.
   * Each line: "(HH:mm:ss) text"
   *
   * @param audioFilePath - Path to audio chunk (must be ≤25MB)
   * @param recordedAt - ISO 8601 UTC timestamp of original recording start
   * @param chunkStartOffsetSecs - Offset in seconds from recording start to chunk start
   */
  async transcribeChunk(
    audioFilePath: string,
    recordedAt: string,
    chunkStartOffsetSecs: number
  ): Promise<string[]> {
    logger.info('Transcribing chunk', {
      audioFilePath,
      chunkStartOffsetSecs,
      model: this.model,
    });

    const fileStream = createReadStream(audioFilePath);

    const transcription = await this.client.audio.transcriptions.create({
      file: fileStream as any,
      model: this.model,
      language: 'ko',
      response_format: 'verbose_json',
    });

    const segments = transcription.segments ?? [];

    if (segments.length === 0) {
      logger.warn('No segments returned from API');
      return [];
    }

    const lines = segments.map((segment) => {
      const adjustedOffset = chunkStartOffsetSecs + segment.start;
      const timestamp = formatKSTTime(recordedAt, adjustedOffset);
      const text = segment.text.trim();
      return `${timestamp} ${text}`;
    });

    logger.info('Chunk transcription completed', {
      segments: segments.length,
      chunkStartOffsetSecs,
    });

    return lines;
  }
}

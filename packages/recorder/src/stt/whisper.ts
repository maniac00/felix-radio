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
 * Strip leading "(HH:mm:ss) " from a line, returning only the spoken text.
 */
function stripTimestamp(line: string): string {
  return line.replace(/^\(\d{2}:\d{2}:\d{2}\)\s*/, '');
}

/**
 * Collapse runs of consecutive identical lines (Whisper self-loop hallucination
 * during silence/ad/music). Keeps the first occurrence and inserts a marker.
 */
export function dedupConsecutiveLines(lines: string[], threshold = 3): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const cur = stripTimestamp(lines[i]);
    let j = i + 1;
    while (j < lines.length && stripTimestamp(lines[j]) === cur) j++;
    const runLen = j - i;
    if (runLen >= threshold) {
      out.push(lines[i]);
      out.push(`(이전 줄 ${runLen}회 반복 — Whisper hallucination 의심으로 생략)`);
    } else {
      for (let k = i; k < j; k++) out.push(lines[k]);
    }
    i = j;
  }
  return out;
}

/**
 * Collapse a token repeated many times consecutively WITHIN a single line
 * (e.g. "Oh, oh, oh, oh, ..." during music). Keeps the first few occurrences
 * and appends a marker. Tokens are compared ignoring case and trailing
 * punctuation so "Oh," matches "oh".
 */
export function collapseInlineRepetition(line: string, threshold = 5): string {
  const tokens = line.split(/\s+/);
  if (tokens.length < threshold) return line;

  const normalize = (t: string) => t.toLowerCase().replace(/[,.!?~…]+$/, '');
  const out: string[] = [];
  let i = 0;
  let collapsed = false;

  while (i < tokens.length) {
    const cur = normalize(tokens[i]);
    let j = i + 1;
    while (j < tokens.length && cur !== '' && normalize(tokens[j]) === cur) j++;
    const runLen = j - i;
    if (runLen >= threshold) {
      out.push(...tokens.slice(i, i + 3));
      out.push(`…(같은 말 ${runLen}회 반복 생략)`);
      collapsed = true;
    } else {
      out.push(...tokens.slice(i, j));
    }
    i = j;
  }

  return collapsed ? out.join(' ') : line;
}

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

export interface TranscriptionClientOverrides {
  apiKey: string;
  baseURL: string;
  model: string;
}

export class WhisperClient {
  private client: OpenAI;
  private model: string;

  constructor(config: Config, overrides?: TranscriptionClientOverrides) {
    this.client = new OpenAI({
      apiKey: overrides?.apiKey ?? config.openaiApiKey,
      ...(overrides?.baseURL ? { baseURL: overrides.baseURL } : {}),
      timeout: 10 * 60 * 1000, // 10 minutes per request
      maxRetries: 0, // We handle retries ourselves via withRetry()
    });
    this.model = overrides?.model ?? config.transcriptionModel;
  }

  /**
   * Secondary STT engine via OpenRouter (Qwen3 ASR). The transcriptions
   * endpoint is OpenAI-compatible, so the same client code works.
   */
  static forQwen3(config: Config): WhisperClient {
    return new WhisperClient(config, {
      apiKey: config.openrouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      model: config.qwen3Model,
    });
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
   * Convert a single audio file (must be ≤25MB) to timestamped lines.
   * For files >25MB, use transcribeChunk() with audio splitting.
   */
  async convertToTimestampedText(
    audioFilePath: string,
    recordedAt: string,
    prompt?: string
  ): Promise<string[]> {
    logger.info('Converting audio to timestamped text', {
      audioFilePath,
      recordedAt,
      model: this.model,
    });

    try {
      await this.validateFileSize(audioFilePath);
      const lines = await this.transcribeChunk(audioFilePath, recordedAt, 0, prompt);

      logger.info('Timestamped transcription completed', {
        lines: lines.length,
      });

      return lines;
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
    chunkStartOffsetSecs: number,
    prompt?: string
  ): Promise<string[]> {
    logger.info('Transcribing chunk', {
      audioFilePath,
      chunkStartOffsetSecs,
      model: this.model,
    });

    try {
      const fileStream = createReadStream(audioFilePath);

      // temperature > 0 reduces self-loop hallucination during silence/ad gaps;
      // prompt biases the decoder away from repeating earlier sentences.
      const transcription = await this.client.audio.transcriptions.create({
        file: fileStream as any,
        model: this.model,
        language: 'ko',
        response_format: 'verbose_json',
        temperature: 0.2,
        ...(prompt ? { prompt } : {}),
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
    } catch (error) {
      logger.error('Whisper chunk transcription failed', {
        audioFilePath,
        chunkStartOffsetSecs,
        error,
      });
      throw toUserError(error);
    }
  }
}

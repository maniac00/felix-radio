'use client';

import { useMemo } from 'react';

interface STTTranscriptProps {
  text: string;
  recordedAt: string;
  onSeek: (offsetSecs: number) => void;
}

interface TranscriptLine {
  timestamp: string;
  offsetSecs: number;
  text: string;
}

const LINE_REGEX = /^\((\d{2}):(\d{2}):(\d{2})\)\s(.+)$/;

/**
 * Calculate offset in seconds from recording start to a KST timestamp.
 */
function kstTimestampToOffset(
  recordedAtISO: string,
  hours: number,
  mins: number,
  secs: number
): number {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const recordedMs = new Date(recordedAtISO).getTime() + KST_OFFSET_MS;
  const recordedDate = new Date(recordedMs);

  // Build timestamp for the same day in KST
  const timestampMs = Date.UTC(
    recordedDate.getUTCFullYear(),
    recordedDate.getUTCMonth(),
    recordedDate.getUTCDate(),
    hours,
    mins,
    secs
  );

  const baseMs = Date.UTC(
    recordedDate.getUTCFullYear(),
    recordedDate.getUTCMonth(),
    recordedDate.getUTCDate(),
    recordedDate.getUTCHours(),
    recordedDate.getUTCMinutes(),
    recordedDate.getUTCSeconds()
  );

  return Math.max(0, (timestampMs - baseMs) / 1000);
}

function parseTranscript(text: string, recordedAt: string): TranscriptLine[] {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const match = line.match(LINE_REGEX);
      if (!match) {
        return { timestamp: '', offsetSecs: 0, text: line };
      }
      const [, h, m, s, content] = match;
      const hours = parseInt(h, 10);
      const mins = parseInt(m, 10);
      const secs = parseInt(s, 10);
      return {
        timestamp: `(${h}:${m}:${s})`,
        offsetSecs: kstTimestampToOffset(recordedAt, hours, mins, secs),
        text: content,
      };
    });
}

export function STTTranscript({ text, recordedAt, onSeek }: STTTranscriptProps) {
  const lines = useMemo(() => parseTranscript(text, recordedAt), [text, recordedAt]);

  return (
    <div className="max-h-[500px] overflow-y-auto border rounded-md p-4 bg-gray-50 font-mono text-sm leading-relaxed space-y-2">
      {lines.map((line, i) =>
        line.timestamp ? (
          <div key={i}>
            <button
              onClick={() => onSeek(line.offsetSecs)}
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-mono"
              title={`${line.timestamp}로 이동`}
            >
              {line.timestamp}
            </button>
            <span> {line.text}</span>
          </div>
        ) : (
          <div key={i}>{line.text}</div>
        )
      )}
    </div>
  );
}

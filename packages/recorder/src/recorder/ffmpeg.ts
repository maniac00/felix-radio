/**
 * ffmpeg wrapper for HLS stream recording
 *
 * Resilience model (added after the 2026-10-28 incident where the TBN stream
 * restarted mid-recording, ffmpeg silently hit EOF after 42 minutes and exited
 * with code 0 leaving a 40-minute file):
 *
 * - A recording is a wall-clock window: [startedAt, startedAt + durationSecs].
 * - ffmpeg is launched for the remaining window. If it ends early for any
 *   reason (EOF, error, stall), it is relaunched until the window closes.
 * - A stall watchdog kills ffmpeg when its output time stops advancing for
 *   `stallTimeoutSecs` (ffmpeg has no built-in detection for a live playlist
 *   that stops producing segments; it waits ~9 minutes then exits 0).
 * - `-rw_timeout` bounds blocking HTTP reads inside the HLS demuxer.
 * - Each launch writes its own part file; parts are concatenated at the end.
 * - The result reports the real captured duration so callers can flag the
 *   recording as partial instead of trusting exit code 0.
 */

import { spawn } from 'child_process';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../lib/logger.js';

export interface RecordingOptions {
  streamUrl: string;
  /** Total requested length of the recording window */
  durationSecs: number;
  outputPath: string;
  /** Wall-clock start of the window (defaults to now). Used to resume after a crash. */
  startedAt?: Date;
  /** Kill ffmpeg when output time has not advanced for this long */
  stallTimeoutSecs?: number;
}

export interface RecordingResult {
  outputPath: string;
  expectedDurationSecs: number;
  actualDurationSecs: number;
  missingSecs: number;
  /** True when more than PARTIAL_THRESHOLD_SECS of audio is missing */
  partial: boolean;
  /** Number of ffmpeg launches */
  attempts: number;
  /** Number of launches killed by the stall watchdog */
  stalls: number;
  /** Human readable notes about each early termination */
  interruptions: string[];
}

interface AttemptOutcome {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stalled: boolean;
  lastOutTimeSecs: number;
  stderrTail: string[];
}

const DEFAULT_STALL_TIMEOUT_SECS = 45;
/** Do not launch ffmpeg when less than this remains in the window */
const MIN_REMAINING_SECS = 10;
/** Missing more than this many seconds marks the recording as partial */
const PARTIAL_THRESHOLD_SECS = 60;
const RETRY_DELAY_MIN_MS = 2_000;
const RETRY_DELAY_MAX_MS = 30_000;
/** HTTP read timeout handed to ffmpeg (microseconds) */
const RW_TIMEOUT_US = 30_000_000;
const STDERR_TAIL_LINES = 60;
const WATCHDOG_INTERVAL_MS = 5_000;
const SECOND_SIGNAL_DELAY_MS = 500;
const SIGKILL_GRACE_MS = 5_000;
/** Treat an attempt as having filled its -t budget when within this many seconds of it */
const TARGET_SLACK_SECS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function kstClock(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    hour12: false,
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Lines that are pure noise at -loglevel verbose and never help diagnosis */
function isNoiseLine(line: string): boolean {
  return (
    line.includes("Skip ('#EXT") ||
    line.includes('Statistics:') ||
    line.trim().length === 0
  );
}

/**
 * Run one ffmpeg process for up to `durationSecs`, writing to `outputPath`.
 * Resolves (never rejects) with the outcome; a non-zero exit is reported, not thrown.
 */
function runFfmpegAttempt(
  streamUrl: string,
  durationSecs: number,
  outputPath: string,
  stallTimeoutSecs: number
): Promise<AttemptOutcome> {
  const args = [
    '-hide_banner',
    '-loglevel', 'verbose',
    '-nostats',
    '-rw_timeout', RW_TIMEOUT_US.toString(),
    '-i', streamUrl,
    '-t', durationSecs.toString(),
    '-codec:a', 'libmp3lame',
    '-q:a', '4',
    '-ac', '2',
    '-ar', '44100',
    '-progress', 'pipe:1',
    '-flush_packets', '1', // keep the part file current in case we have to SIGKILL
    '-y',
    outputPath,
  ];

  logger.debug('ffmpeg command', { args: args.join(' ') });

  return new Promise(resolve => {
    const ffmpeg = spawn('ffmpeg', args);

    const stderrTail: string[] = [];
    let stderrBuffer = '';
    let stdoutBuffer = '';
    let lastOutTimeSecs = 0;
    let lastAdvanceAt = Date.now();
    let stalled = false;
    let killTimer: NodeJS.Timeout | null = null;

    const pushStderr = (line: string): void => {
      if (isNoiseLine(line)) return;
      stderrTail.push(line);
      if (stderrTail.length > STDERR_TAIL_LINES) stderrTail.shift();
    };

    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() ?? '';
      lines.forEach(pushStderr);
    });

    ffmpeg.stdout.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const match = /^out_time_us=(\d+)/.exec(line);
        if (!match) continue;
        const secs = Number(match[1]) / 1_000_000;
        if (secs > lastOutTimeSecs) {
          lastOutTimeSecs = secs;
          lastAdvanceAt = Date.now();
        }
      }
    });

    const watchdog = setInterval(() => {
      const idleMs = Date.now() - lastAdvanceAt;
      if (idleMs < stallTimeoutSecs * 1000) return;
      if (stalled) return;
      stalled = true;
      logger.warn('ffmpeg stalled, killing process', {
        idleSecs: Math.round(idleMs / 1000),
        lastOutTimeSecs: Math.round(lastOutTimeSecs),
        outputPath,
      });
      // ffmpeg only aborts blocking I/O (e.g. the HLS reload wait loop) on the
      // second signal; the first merely requests a graceful stop.
      ffmpeg.kill('SIGTERM');
      setTimeout(() => {
        if (ffmpeg.exitCode === null && ffmpeg.signalCode === null) ffmpeg.kill('SIGTERM');
      }, SECOND_SIGNAL_DELAY_MS);
      killTimer = setTimeout(() => {
        if (ffmpeg.exitCode === null && ffmpeg.signalCode === null) {
          logger.warn('ffmpeg did not exit after SIGTERM, sending SIGKILL');
          ffmpeg.kill('SIGKILL');
        }
      }, SIGKILL_GRACE_MS);
    }, WATCHDOG_INTERVAL_MS);

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      clearInterval(watchdog);
      if (killTimer) clearTimeout(killTimer);
      if (stderrBuffer.length > 0) pushStderr(stderrBuffer);
      resolve({ exitCode, signal, stalled, lastOutTimeSecs, stderrTail });
    };

    ffmpeg.on('error', error => {
      logger.error('ffmpeg process error', { error: error.message });
      pushStderr(`spawn error: ${error.message}`);
      finish(null, null);
    });

    ffmpeg.on('close', (code, signal) => finish(code, signal));
  });
}

/**
 * Duration of an audio file in seconds via ffprobe. Returns 0 if the file is
 * missing, empty or unreadable.
 */
export async function probeDuration(filePath: string): Promise<number> {
  try {
    const info = await stat(filePath);
    if (info.size === 0) return 0;
  } catch {
    return 0;
  }

  return new Promise(resolve => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath,
    ]);
    let out = '';
    ffprobe.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    ffprobe.on('error', () => resolve(0));
    ffprobe.on('close', () => {
      const value = parseFloat(out.trim());
      resolve(Number.isFinite(value) && value > 0 ? value : 0);
    });
  });
}

function partsDirFor(outputPath: string): string {
  return `${outputPath}.parts`;
}

async function listExistingParts(partsDir: string): Promise<string[]> {
  try {
    const names = await readdir(partsDir);
    return names
      .filter(n => /^part-\d{3}\.mp3$/.test(n))
      .sort()
      .map(n => join(partsDir, n));
  } catch {
    return [];
  }
}

/**
 * Concatenate MP3 parts into `outputPath` (stream copy) and remove the parts dir.
 */
async function finalizeParts(parts: string[], partsDir: string, outputPath: string): Promise<void> {
  if (parts.length === 1) {
    await rename(parts[0], outputPath);
  } else {
    const listPath = join(partsDir, 'concat.txt');
    const listBody = parts
      .map(p => `file '${p.replace(/'/g, "'\\''")}'`)
      .join('\n');
    await writeFile(listPath, listBody + '\n', 'utf8');

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-hide_banner', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0',
        '-i', listPath,
        '-c', 'copy',
        '-y', outputPath,
      ]);
      let stderr = '';
      ffmpeg.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      ffmpeg.on('error', reject);
      ffmpeg.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg concat exited with code ${code}: ${stderr.trim()}`));
      });
    });
  }

  await rm(partsDir, { recursive: true, force: true });
}

/**
 * Record an HLS stream to MP3 for a wall-clock window, restarting ffmpeg as
 * needed. Throws only when no audio at all could be captured.
 */
export async function recordStream(options: RecordingOptions): Promise<RecordingResult> {
  const { streamUrl, durationSecs, outputPath } = options;
  const stallTimeoutSecs = options.stallTimeoutSecs ?? DEFAULT_STALL_TIMEOUT_SECS;
  const startedAt = options.startedAt ?? new Date();
  const deadlineMs = startedAt.getTime() + durationSecs * 1000;

  const partsDir = partsDirFor(outputPath);
  await mkdir(partsDir, { recursive: true });
  const parts = await listExistingParts(partsDir);

  logger.info('Starting ffmpeg recording', {
    streamUrl,
    durationSecs,
    outputPath,
    startedAt: startedAt.toISOString(),
    stallTimeoutSecs,
    resumedParts: parts.length,
  });

  let attempts = 0;
  let stalls = 0;
  const interruptions: string[] = [];
  let retryDelayMs = RETRY_DELAY_MIN_MS;

  while (true) {
    const remainingSecs = Math.floor((deadlineMs - Date.now()) / 1000);
    if (remainingSecs < MIN_REMAINING_SECS) break;

    attempts++;
    const partPath = join(partsDir, `part-${String(parts.length + 1).padStart(3, '0')}.mp3`);
    const attemptStartedAt = Date.now();

    logger.info('Launching ffmpeg', { attempt: attempts, remainingSecs, partPath });

    const outcome = await runFfmpegAttempt(streamUrl, remainingSecs, partPath, stallTimeoutSecs);
    const partDurationSecs = await probeDuration(partPath);

    if (partDurationSecs > 0) {
      parts.push(partPath);
    } else {
      await rm(partPath, { force: true });
    }

    // ffmpeg starts a live HLS stream a few segments behind the live edge, so it
    // can fill its -t budget before the wall-clock deadline. That is a complete
    // recording, not an early exit, and relaunching would duplicate audio.
    const filledBudget =
      outcome.exitCode === 0 && outcome.lastOutTimeSecs >= remainingSecs - TARGET_SLACK_SECS;
    const nowRemainingSecs = (deadlineMs - Date.now()) / 1000;
    if (filledBudget || nowRemainingSecs < MIN_REMAINING_SECS) {
      logger.info('ffmpeg reached end of recording window', {
        attempt: attempts,
        exitCode: outcome.exitCode,
        partDurationSecs: Math.round(partDurationSecs),
        filledBudget,
      });
      break;
    }

    // Ended early: record why, back off, relaunch
    if (outcome.stalled) stalls++;
    const reason = outcome.stalled
      ? `${stallTimeoutSecs}초간 데이터 없음`
      : outcome.signal
        ? `signal ${outcome.signal}`
        : `ffmpeg exit ${outcome.exitCode}`;
    const note = `${kstClock(new Date())} ${reason} (${Math.round(partDurationSecs)}초 녹음 후)`;
    interruptions.push(note);

    logger.warn('ffmpeg ended before the recording window closed, restarting', {
      attempt: attempts,
      reason,
      partDurationSecs: Math.round(partDurationSecs),
      remainingSecs: Math.round(nowRemainingSecs),
      stderrTail: outcome.stderrTail,
    });

    // A launch that ran a while before dying resets the backoff
    if (Date.now() - attemptStartedAt > 60_000) retryDelayMs = RETRY_DELAY_MIN_MS;
    await sleep(Math.min(retryDelayMs, nowRemainingSecs * 1000));
    retryDelayMs = Math.min(retryDelayMs * 2, RETRY_DELAY_MAX_MS);
  }

  if (parts.length === 0) {
    await rm(partsDir, { recursive: true, force: true });
    throw new Error(
      `No audio captured after ${attempts} ffmpeg attempt(s): ${interruptions.join('; ') || 'window already closed'}`
    );
  }

  await finalizeParts(parts, partsDir, outputPath);

  const actualDurationSecs = Math.round(await probeDuration(outputPath));
  const missingSecs = Math.max(0, durationSecs - actualDurationSecs);
  const partial = missingSecs > PARTIAL_THRESHOLD_SECS;

  const result: RecordingResult = {
    outputPath,
    expectedDurationSecs: durationSecs,
    actualDurationSecs,
    missingSecs,
    partial,
    attempts,
    stalls,
    interruptions,
  };

  if (partial) {
    logger.warn('Recording completed with missing audio', result);
  } else {
    logger.info('Recording completed successfully', result);
  }

  return result;
}

/**
 * Generate filename based on program name and timestamp
 * Format: {program}_{YYYYMMDD-HHMM}.mp3
 * Uses Korea Standard Time (KST, UTC+9)
 */
export function generateFilename(
  programName: string,
  timestamp: Date
): string {
  // Convert to KST (UTC+9)
  const kstOffset = 9 * 60; // 9 hours in minutes
  const utcTime = timestamp.getTime() + (timestamp.getTimezoneOffset() * 60000);
  const kstTime = new Date(utcTime + (kstOffset * 60000));

  const year = kstTime.getFullYear();
  const month = String(kstTime.getMonth() + 1).padStart(2, '0');
  const day = String(kstTime.getDate()).padStart(2, '0');
  const hour = String(kstTime.getHours()).padStart(2, '0');
  const minute = String(kstTime.getMinutes()).padStart(2, '0');

  const dateStr = `${year}${month}${day}-${hour}${minute}`;
  const safeProgramName = programName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');

  return `${safeProgramName}_${dateStr}.mp3`;
}

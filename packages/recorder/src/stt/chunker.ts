/**
 * Audio file chunking for Whisper API's 25MB file size limit.
 * Uses ffmpeg to split large MP3 files into smaller chunks.
 */

import { spawn } from 'child_process';
import { stat, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { logger } from '../lib/logger.js';

export interface ChunkInfo {
  path: string;
  startOffsetSecs: number;
}

const MAX_CHUNK_SIZE_MB = 20; // Stay safely under 25MB limit

/**
 * Get audio duration in seconds using ffprobe
 */
export async function getAudioDurationSecs(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);

    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { logger.debug('ffprobe stderr', { data: data.toString() }); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }
      const duration = parseFloat(output.trim());
      if (isNaN(duration)) {
        reject(new Error(`Failed to parse duration: ${output}`));
        return;
      }
      resolve(duration);
    });
  });
}

/**
 * Split an audio file into chunks that fit within the Whisper API size limit.
 * Uses -codec:a copy for fast splitting without re-encoding.
 */
export async function splitAudioFile(
  audioPath: string,
  tempDir: string
): Promise<ChunkInfo[]> {
  const fileStats = await stat(audioPath);
  const fileSizeMB = fileStats.size / (1024 * 1024);

  if (fileSizeMB <= MAX_CHUNK_SIZE_MB) {
    return [{ path: audioPath, startOffsetSecs: 0 }];
  }

  const totalDuration = await getAudioDurationSecs(audioPath);
  const numChunks = Math.ceil(fileSizeMB / MAX_CHUNK_SIZE_MB);
  const chunkDurationSecs = Math.floor(totalDuration / numChunks);

  logger.info('Splitting audio file', {
    fileSizeMB: fileSizeMB.toFixed(1),
    totalDuration: totalDuration.toFixed(0),
    numChunks,
    chunkDurationSecs,
  });

  await mkdir(tempDir, { recursive: true });

  const chunks: ChunkInfo[] = [];

  for (let i = 0; i < numChunks; i++) {
    const startSecs = i * chunkDurationSecs;
    // Last chunk gets the remainder
    const duration = i === numChunks - 1
      ? totalDuration - startSecs
      : chunkDurationSecs;

    const chunkPath = join(tempDir, `chunk_${i}.mp3`);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-i', audioPath,
        '-ss', startSecs.toString(),
        '-t', duration.toString(),
        '-codec:a', 'copy',
        '-y',
        chunkPath,
      ]);

      proc.stderr.on('data', () => {}); // suppress ffmpeg output
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg chunk split exited with code ${code}`));
        } else {
          resolve();
        }
      });
    });

    chunks.push({ path: chunkPath, startOffsetSecs: startSecs });

    const chunkStats = await stat(chunkPath);
    logger.debug('Chunk created', {
      index: i,
      startSecs,
      duration: duration.toFixed(0),
      sizeMB: (chunkStats.size / (1024 * 1024)).toFixed(1),
    });
  }

  return chunks;
}

/**
 * Remove temporary chunk files
 */
export async function cleanupChunks(chunks: ChunkInfo[]): Promise<void> {
  for (const chunk of chunks) {
    try {
      await unlink(chunk.path);
    } catch {
      // Ignore cleanup errors
    }
  }
}

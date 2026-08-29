/**
 * Recording endpoints
 */

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { clerkAuth } from '../middleware/auth';
import {
  getRecordings,
  getRecordingById,
  deleteRecording,
} from '../db/queries';
import { downloadFile, deleteFile as deleteR2File } from '../storage/r2';

const recordings = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply Clerk authentication to all routes
recordings.use('/*', clerkAuth);

/**
 * GET /api/recordings
 * List all recordings for authenticated user with pagination
 */
recordings.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  // Pagination parameters
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  // Validate pagination
  if (limit < 1 || limit > 100) {
    return c.json({ error: 'limit must be between 1 and 100' }, 400);
  }
  if (offset < 0) {
    return c.json({ error: 'offset must be >= 0' }, 400);
  }

  try {
    const results = await getRecordings(db, userId, limit, offset);

    return c.json({
      recordings: results,
      limit,
      offset,
      count: results.length,
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return c.json(
      { error: 'Failed to fetch recordings' },
      500
    );
  }
});

/**
 * GET /api/recordings/:id
 * Get a specific recording by ID
 */
recordings.get('/:id', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const recordingId = parseInt(c.req.param('id'), 10);

  if (isNaN(recordingId)) {
    return c.json({ error: 'Invalid recording ID' }, 400);
  }

  try {
    const recording = await getRecordingById(db, recordingId, userId);

    if (!recording) {
      return c.json({ error: 'Recording not found' }, 404);
    }

    return c.json({ recording });
  } catch (error) {
    console.error('Error fetching recording:', error);
    return c.json(
      { error: 'Failed to fetch recording' },
      500
    );
  }
});

/**
 * GET /api/recordings/:id/download
 * Generate a download URL for the recording file
 */
recordings.get('/:id/download', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const r2 = c.env.R2;
  const recordingId = parseInt(c.req.param('id'), 10);

  if (isNaN(recordingId)) {
    return c.json({ error: 'Invalid recording ID' }, 400);
  }

  try {
    const recording = await getRecordingById(db, recordingId, userId);

    if (!recording) {
      return c.json({ error: 'Recording not found' }, 404);
    }

    if (recording.status !== 'completed') {
      return c.json({ error: 'Recording is not completed' }, 400);
    }

    // Debug: Log the file path we're looking for
    console.log('Looking for R2 file:', recording.audio_file_path);

    // Get the file from R2
    const file = await downloadFile(r2, recording.audio_file_path);

    // Debug: Log R2 result
    console.log('R2 get result:', file ? 'found' : 'not found');

    if (!file) {
      return c.json({ error: 'Recording file not found in storage' }, 404);
    }

    // Convert recorded_at to KST format for filename
    const recordedDate = new Date(recording.recorded_at);
    // Convert to KST (UTC+9)
    const kstOffset = 9 * 60; // 9 hours in minutes
    const utcTime = recordedDate.getTime();
    const kstTime = new Date(utcTime + (kstOffset * 60 * 1000));

    const year = kstTime.getUTCFullYear();
    const month = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstTime.getUTCDate()).padStart(2, '0');
    const hour = String(kstTime.getUTCHours()).padStart(2, '0');
    const minute = String(kstTime.getUTCMinutes()).padStart(2, '0');
    const dateStr = `${year}${month}${day}-${hour}${minute}`;
    const filename = `${recording.program_name}_${dateStr}.mp3`;

    // Return the file directly as a download
    return new Response(file.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': recording.file_size_bytes.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading recording:', error);
    return c.json(
      { error: 'Failed to download recording' },
      500
    );
  }
});

/**
 * GET /api/recordings/:id/stt
 * Get STT result for a recording
 */
recordings.get('/:id/stt', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const r2 = c.env.R2;
  const recordingId = parseInt(c.req.param('id'), 10);

  if (isNaN(recordingId)) {
    return c.json({ error: 'Invalid recording ID' }, 400);
  }

  try {
    const recording = await getRecordingById(db, recordingId, userId);

    if (!recording) {
      return c.json({ error: 'Recording not found' }, 404);
    }

    if (recording.stt_status !== 'completed') {
      return c.json({
        stt_status: recording.stt_status,
        message: recording.stt_status === 'processing'
          ? 'STT conversion is in progress'
          : recording.stt_status === 'failed'
          ? 'STT conversion failed'
          : 'STT conversion not started',
      });
    }

    if (!recording.stt_text_path) {
      return c.json({ error: 'STT text path not found' }, 404);
    }

    // Get the text file from R2
    const textFile = await downloadFile(r2, recording.stt_text_path);

    if (!textFile) {
      return c.json({ error: 'STT text file not found in storage' }, 404);
    }

    const text = await textFile.text();

    return c.json({
      stt_status: 'completed',
      text,
      text_path: recording.stt_text_path,
    });
  } catch (error) {
    console.error('Error fetching STT result:', error);
    return c.json(
      { error: 'Failed to fetch STT result' },
      500
    );
  }
});

/**
 * POST /api/recordings/:id/stt
 * Trigger STT conversion for a recording
 */
recordings.post('/:id/stt', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const recordingId = parseInt(c.req.param('id'), 10);

  if (isNaN(recordingId)) {
    return c.json({ error: 'Invalid recording ID' }, 400);
  }

  try {
    const recording = await getRecordingById(db, recordingId, userId);

    if (!recording) {
      return c.json({ error: 'Recording not found' }, 404);
    }

    if (recording.status !== 'completed') {
      return c.json({ error: 'Recording is not completed' }, 400);
    }

    if (recording.stt_status === 'processing') {
      return c.json({ error: 'STT conversion is already in progress' }, 400);
    }

    if (recording.stt_status === 'completed') {
      return c.json({ error: 'STT conversion is already completed' }, 400);
    }

    // Update STT status to processing
    await db
      .prepare('UPDATE recordings SET stt_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind('processing', recordingId)
      .run();

    // TODO: Call Vultr recorder server to start STT job
    // This will be implemented when the recorder server is ready
    // For now, just return success

    return c.json({
      message: 'STT conversion started',
      stt_status: 'processing',
    });
  } catch (error) {
    console.error('Error triggering STT:', error);
    return c.json(
      { error: 'Failed to trigger STT conversion' },
      500
    );
  }
});

/**
 * DELETE /api/recordings/:id
 * Delete a recording and its files
 */
recordings.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const r2 = c.env.R2;
  const recordingId = parseInt(c.req.param('id'), 10);

  if (isNaN(recordingId)) {
    return c.json({ error: 'Invalid recording ID' }, 400);
  }

  try {
    const recording = await getRecordingById(db, recordingId, userId);

    if (!recording) {
      return c.json({ error: 'Recording not found' }, 404);
    }

    // Delete audio file from R2
    try {
      await deleteR2File(r2, recording.audio_file_path);
    } catch (error) {
      console.error('Error deleting audio file from R2:', error);
      // Continue even if R2 delete fails
    }

    // Delete STT text file if exists
    if (recording.stt_text_path) {
      try {
        await deleteR2File(r2, recording.stt_text_path);
      } catch (error) {
        console.error('Error deleting STT file from R2:', error);
        // Continue even if R2 delete fails
      }
    }

    // Delete recording from database
    const deleted = await deleteRecording(db, recordingId, userId);

    if (!deleted) {
      return c.json({ error: 'Failed to delete recording from database' }, 500);
    }

    return c.json({
      message: 'Recording deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting recording:', error);
    return c.json(
      { error: 'Failed to delete recording' },
      500
    );
  }
});

export default recordings;

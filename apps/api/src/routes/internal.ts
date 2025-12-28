/**
 * Internal API endpoints for Vultr recording server
 */

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { apiKeyAuth } from '../middleware/apiKey';

const internal = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply API key authentication to all routes
internal.use('/*', apiKeyAuth);

/**
 * GET /api/internal/schedules/pending
 * Get pending schedules for current time
 */
internal.get('/schedules/pending', async (c) => {
  const db = c.env.DB;

  // Get current time from query params (sent by recorder server)
  const currentTime = c.req.query('time'); // Format: HH:mm
  const currentDay = c.req.query('day'); // Day of week (0-6, Sunday=0)

  if (!currentTime || !currentDay) {
    return c.json({ error: 'time and day query parameters are required' }, 400);
  }

  const dayNum = parseInt(currentDay, 10);
  if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
    return c.json({ error: 'day must be between 0 and 6' }, 400);
  }

  try {
    // Query schedules that:
    // 1. Are active
    // 2. Match the current time (start_time)
    // 3. Include the current day in days_of_week array
    const { results } = await db
      .prepare(`
        SELECT s.*, rs.stream_url, rs.name as station_name, u.email
        FROM schedules s
        JOIN radio_stations rs ON s.station_id = rs.id
        JOIN users u ON s.user_id = u.id
        WHERE s.is_active = 1
          AND s.start_time = ?
          AND rs.is_active = 1
      `)
      .bind(currentTime)
      .all();

    // Filter by day of week (days_of_week is JSON array string)
    const filteredSchedules = results.filter((schedule: any) => {
      try {
        const days = JSON.parse(schedule.days_of_week);
        return Array.isArray(days) && days.includes(dayNum);
      } catch {
        return false;
      }
    });

    return c.json({
      schedules: filteredSchedules,
      count: filteredSchedules.length,
      current_time: currentTime,
      current_day: dayNum,
    });
  } catch (error) {
    console.error('Error fetching pending schedules:', error);
    return c.json(
      { error: 'Failed to fetch pending schedules' },
      500
    );
  }
});

/**
 * POST /api/internal/recordings
 * Create a new recording entry (called by recorder server when recording starts)
 */
internal.post('/recordings', async (c) => {
  const db = c.env.DB;

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const {
    user_id,
    schedule_id,
    station_id,
    program_name,
    recorded_at,
    duration_secs,
    file_size_bytes,
    audio_file_path,
    status,
    error_message,
  } = body;

  // Validation
  if (!user_id || typeof user_id !== 'string') {
    return c.json({ error: 'user_id is required and must be a string' }, 400);
  }
  if (station_id === undefined || typeof station_id !== 'number') {
    return c.json({ error: 'station_id is required and must be a number' }, 400);
  }
  if (!program_name || typeof program_name !== 'string') {
    return c.json({ error: 'program_name is required and must be a string' }, 400);
  }
  if (!recorded_at || typeof recorded_at !== 'string') {
    return c.json({ error: 'recorded_at is required and must be a string' }, 400);
  }
  if (duration_secs === undefined || typeof duration_secs !== 'number') {
    return c.json({ error: 'duration_secs is required and must be a number' }, 400);
  }
  if (file_size_bytes === undefined || typeof file_size_bytes !== 'number') {
    return c.json({ error: 'file_size_bytes is required and must be a number' }, 400);
  }
  if (!audio_file_path || typeof audio_file_path !== 'string') {
    return c.json({ error: 'audio_file_path is required and must be a string' }, 400);
  }
  if (!status || !['pending', 'recording', 'completed', 'failed'].includes(status)) {
    return c.json({ error: 'status must be one of: pending, recording, completed, failed' }, 400);
  }

  try {
    const result = await db
      .prepare(`
        INSERT INTO recordings (
          user_id, schedule_id, station_id, program_name, recorded_at,
          duration_secs, file_size_bytes, audio_file_path, status, error_message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        user_id,
        schedule_id || null,
        station_id,
        program_name,
        recorded_at,
        duration_secs,
        file_size_bytes,
        audio_file_path,
        status,
        error_message || null
      )
      .run();

    const recordingId = result.meta.last_row_id;

    return c.json(
      {
        message: 'Recording created successfully',
        recording_id: recordingId,
      },
      201
    );
  } catch (error) {
    console.error('Error creating recording:', error);
    return c.json(
      { error: 'Failed to create recording' },
      500
    );
  }
});

/**
 * PUT /api/internal/recordings/:id/status
 * Update recording status (called by recorder server)
 */
internal.put('/recordings/:id/status', async (c) => {
  const db = c.env.DB;
  const recordingId = parseInt(c.req.param('id'), 10);

  if (isNaN(recordingId)) {
    return c.json({ error: 'Invalid recording ID' }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { status, error_message } = body;

  if (!status || !['pending', 'recording', 'completed', 'failed'].includes(status)) {
    return c.json({ error: 'status must be one of: pending, recording, completed, failed' }, 400);
  }

  try {
    const result = await db
      .prepare(`
        UPDATE recordings
        SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(status, error_message || null, recordingId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Recording not found' }, 404);
    }

    return c.json({
      message: 'Recording status updated successfully',
    });
  } catch (error) {
    console.error('Error updating recording status:', error);
    return c.json(
      { error: 'Failed to update recording status' },
      500
    );
  }
});

/**
 * PUT /api/internal/recordings/:id/stt
 * Update STT status and text path (called by recorder server)
 */
internal.put('/recordings/:id/stt', async (c) => {
  const db = c.env.DB;
  const recordingId = parseInt(c.req.param('id'), 10);

  if (isNaN(recordingId)) {
    return c.json({ error: 'Invalid recording ID' }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { stt_status, stt_text_path, error_message } = body;

  if (!stt_status || !['none', 'processing', 'completed', 'failed'].includes(stt_status)) {
    return c.json({ error: 'stt_status must be one of: none, processing, completed, failed' }, 400);
  }

  try {
    const result = await db
      .prepare(`
        UPDATE recordings
        SET stt_status = ?, stt_text_path = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(stt_status, stt_text_path || null, error_message || null, recordingId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Recording not found' }, 404);
    }

    return c.json({
      message: 'STT status updated successfully',
    });
  } catch (error) {
    console.error('Error updating STT status:', error);
    return c.json(
      { error: 'Failed to update STT status' },
      500
    );
  }
});

export default internal;

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

  // Support both exact time and time range queries
  const currentTime = c.req.query('time'); // Format: HH:mm (legacy)
  const timeFrom = c.req.query('time_from'); // Format: HH:mm (range start)
  const timeTo = c.req.query('time_to'); // Format: HH:mm (range end)
  const currentDay = c.req.query('day'); // Day of week (0-6, Sunday=0)

  if ((!currentTime && (!timeFrom || !timeTo)) || !currentDay) {
    return c.json({ error: 'day and either time or time_from/time_to query parameters are required' }, 400);
  }

  const dayNum = parseInt(currentDay, 10);
  if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
    return c.json({ error: 'day must be between 0 and 6' }, 400);
  }

  try {
    let results;
    if (timeFrom && timeTo) {
      // Range query: match schedules within time window
      const resp = await db
        .prepare(`
          SELECT s.*, rs.stream_url, rs.name as station_name, u.email
          FROM schedules s
          JOIN radio_stations rs ON s.station_id = rs.id
          JOIN users u ON s.user_id = u.id
          WHERE s.is_active = 1
            AND s.start_time >= ?
            AND s.start_time <= ?
            AND rs.is_active = 1
        `)
        .bind(timeFrom, timeTo)
        .all();
      results = resp.results;
    } else {
      // Exact time query (backwards compatible)
      const resp = await db
        .prepare(`
          SELECT s.*, rs.stream_url, rs.name as station_name, u.email
          FROM schedules s
          JOIN radio_stations rs ON s.station_id = rs.id
          JOIN users u ON s.user_id = u.id
          WHERE s.is_active = 1
            AND s.start_time = ?
            AND rs.is_active = 1
        `)
        .bind(currentTime!)
        .all();
      results = resp.results;
    }

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
      current_time: currentTime || `${timeFrom}-${timeTo}`,
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

  const { status, file_size_bytes, error_message } = body;

  if (!status || !['pending', 'recording', 'completed', 'failed'].includes(status)) {
    return c.json({ error: 'status must be one of: pending, recording, completed, failed' }, 400);
  }

  try {
    // Build dynamic update query to include file_size_bytes if provided
    const updates: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status];

    if (file_size_bytes !== undefined && typeof file_size_bytes === 'number') {
      updates.push('file_size_bytes = ?');
      params.push(file_size_bytes);
    }

    if (error_message !== undefined) {
      updates.push('error_message = ?');
      params.push(error_message);
    } else {
      updates.push('error_message = ?');
      params.push(null);
    }

    params.push(recordingId);

    const result = await db
      .prepare(`
        UPDATE recordings
        SET ${updates.join(', ')}
        WHERE id = ?
      `)
      .bind(...params)
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

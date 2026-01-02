/**
 * Schedule CRUD endpoints
 */

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { clerkAuth } from '../middleware/auth';
import {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  upsertUser,
} from '../db/queries';

const schedules = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply Clerk authentication to all routes
schedules.use('/*', clerkAuth);

/**
 * GET /api/schedules
 * List all schedules for authenticated user
 */
schedules.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  try {
    const results = await getSchedules(db, userId);

    // Transform results to include station object
    const schedules = results.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      station_id: row.station_id,
      program_name: row.program_name,
      days_of_week: row.days_of_week,
      start_time: row.start_time,
      duration_mins: row.duration_mins,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      station: row.station_name ? {
        id: row.station_id,
        name: row.station_name,
        stream_url: row.station_stream_url,
        is_active: row.station_is_active,
      } : undefined,
    }));

    return c.json({
      schedules,
      total: schedules.length,
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return c.json(
      { error: 'Failed to fetch schedules' },
      500
    );
  }
});

/**
 * GET /api/schedules/:id
 * Get a specific schedule by ID
 */
schedules.get('/:id', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const scheduleId = parseInt(c.req.param('id'), 10);

  if (isNaN(scheduleId)) {
    return c.json({ error: 'Invalid schedule ID' }, 400);
  }

  try {
    const schedule = await getScheduleById(db, scheduleId, userId);

    if (!schedule) {
      return c.json({ error: 'Schedule not found' }, 404);
    }

    return c.json({ schedule });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return c.json(
      { error: 'Failed to fetch schedule' },
      500
    );
  }
});

/**
 * POST /api/schedules
 * Create a new schedule
 */
schedules.post('/', async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const db = c.env.DB;

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { station_id, program_name, days_of_week, start_time, duration_mins, is_active } = body;

  // Validation
  if (!station_id || typeof station_id !== 'number') {
    return c.json({ error: 'station_id is required and must be a number' }, 400);
  }
  if (!program_name || typeof program_name !== 'string') {
    return c.json({ error: 'program_name is required and must be a string' }, 400);
  }
  if (!days_of_week || typeof days_of_week !== 'string') {
    return c.json({ error: 'days_of_week is required and must be a JSON array string' }, 400);
  }
  if (!start_time || typeof start_time !== 'string') {
    return c.json({ error: 'start_time is required and must be a string (HH:mm format)' }, 400);
  }
  if (!duration_mins || typeof duration_mins !== 'number') {
    return c.json({ error: 'duration_mins is required and must be a number' }, 400);
  }
  if (duration_mins < 1 || duration_mins > 300) {
    return c.json({ error: 'duration_mins must be between 1 and 300' }, 400);
  }

  // Validate days_of_week is valid JSON array
  try {
    const days = JSON.parse(days_of_week);
    if (!Array.isArray(days)) {
      return c.json({ error: 'days_of_week must be a JSON array' }, 400);
    }
  } catch {
    return c.json({ error: 'days_of_week must be valid JSON' }, 400);
  }

  // Validate time format (HH:mm)
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(start_time)) {
    return c.json({ error: 'start_time must be in HH:mm format' }, 400);
  }

  try {
    // Ensure user exists in database
    await upsertUser(db, userId, userEmail);

    const scheduleId = await createSchedule(db, userId, {
      station_id,
      program_name,
      days_of_week,
      start_time,
      duration_mins,
      is_active: is_active ?? true,
    });

    const row: any = await getScheduleById(db, scheduleId, userId);

    // Transform result to include station object
    const schedule = {
      id: row.id,
      user_id: row.user_id,
      station_id: row.station_id,
      program_name: row.program_name,
      days_of_week: row.days_of_week,
      start_time: row.start_time,
      duration_mins: row.duration_mins,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      station: row.station_name ? {
        id: row.station_id,
        name: row.station_name,
        stream_url: row.station_stream_url,
        is_active: row.station_is_active,
      } : undefined,
    };

    return c.json(
      {
        message: 'Schedule created successfully',
        schedule,
      },
      201
    );
  } catch (error) {
    console.error('Error creating schedule:', error);
    return c.json(
      {
        error: 'Failed to create schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error)
      },
      500
    );
  }
});

/**
 * PUT /api/schedules/:id
 * Update an existing schedule
 */
schedules.put('/:id', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const scheduleId = parseInt(c.req.param('id'), 10);

  if (isNaN(scheduleId)) {
    return c.json({ error: 'Invalid schedule ID' }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { station_id, program_name, days_of_week, start_time, duration_mins, is_active } = body;

  // Validate types if provided
  if (station_id !== undefined && typeof station_id !== 'number') {
    return c.json({ error: 'station_id must be a number' }, 400);
  }
  if (program_name !== undefined && typeof program_name !== 'string') {
    return c.json({ error: 'program_name must be a string' }, 400);
  }
  if (days_of_week !== undefined && typeof days_of_week !== 'string') {
    return c.json({ error: 'days_of_week must be a JSON array string' }, 400);
  }
  if (start_time !== undefined && typeof start_time !== 'string') {
    return c.json({ error: 'start_time must be a string (HH:mm format)' }, 400);
  }
  if (duration_mins !== undefined && typeof duration_mins !== 'number') {
    return c.json({ error: 'duration_mins must be a number' }, 400);
  }
  if (duration_mins !== undefined && (duration_mins < 1 || duration_mins > 300)) {
    return c.json({ error: 'duration_mins must be between 1 and 300' }, 400);
  }

  // Validate days_of_week if provided
  if (days_of_week !== undefined) {
    try {
      const days = JSON.parse(days_of_week);
      if (!Array.isArray(days)) {
        return c.json({ error: 'days_of_week must be a JSON array' }, 400);
      }
    } catch {
      return c.json({ error: 'days_of_week must be valid JSON' }, 400);
    }
  }

  // Validate time format if provided
  if (start_time !== undefined) {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start_time)) {
      return c.json({ error: 'start_time must be in HH:mm format' }, 400);
    }
  }

  try {
    const updated = await updateSchedule(db, scheduleId, userId, {
      station_id,
      program_name,
      days_of_week,
      start_time,
      duration_mins,
      is_active,
    });

    if (!updated) {
      return c.json({ error: 'Schedule not found or no changes made' }, 404);
    }

    const row: any = await getScheduleById(db, scheduleId, userId);

    // Transform result to include station object
    const schedule = {
      id: row.id,
      user_id: row.user_id,
      station_id: row.station_id,
      program_name: row.program_name,
      days_of_week: row.days_of_week,
      start_time: row.start_time,
      duration_mins: row.duration_mins,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      station: row.station_name ? {
        id: row.station_id,
        name: row.station_name,
        stream_url: row.station_stream_url,
        is_active: row.station_is_active,
      } : undefined,
    };

    return c.json({
      message: 'Schedule updated successfully',
      schedule,
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    return c.json(
      { error: 'Failed to update schedule' },
      500
    );
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
schedules.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const scheduleId = parseInt(c.req.param('id'), 10);

  if (isNaN(scheduleId)) {
    return c.json({ error: 'Invalid schedule ID' }, 400);
  }

  try {
    const deleted = await deleteSchedule(db, scheduleId, userId);

    if (!deleted) {
      return c.json({ error: 'Schedule not found' }, 404);
    }

    return c.json({
      message: 'Schedule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return c.json(
      { error: 'Failed to delete schedule' },
      500
    );
  }
});

export default schedules;

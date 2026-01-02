/**
 * Database query functions for D1
 */

import type { Schedule, Recording, RadioStation, User } from '../types';

/**
 * Schedule Queries
 */

export async function getSchedules(
  db: D1Database,
  userId: string
): Promise<Schedule[]> {
  const { results } = await db
    .prepare(`
      SELECT
        s.*,
        rs.id as station_id,
        rs.name as station_name,
        rs.stream_url as station_stream_url,
        rs.is_active as station_is_active
      FROM schedules s
      LEFT JOIN radio_stations rs ON s.station_id = rs.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `)
    .bind(userId)
    .all();

  return results as unknown as Schedule[];
}

export async function getScheduleById(
  db: D1Database,
  scheduleId: number,
  userId: string
): Promise<Schedule | null> {
  const result = await db
    .prepare(`
      SELECT
        s.*,
        rs.id as station_id,
        rs.name as station_name,
        rs.stream_url as station_stream_url,
        rs.is_active as station_is_active
      FROM schedules s
      LEFT JOIN radio_stations rs ON s.station_id = rs.id
      WHERE s.id = ? AND s.user_id = ?
    `)
    .bind(scheduleId, userId)
    .first();

  return result as Schedule | null;
}

export async function createSchedule(
  db: D1Database,
  userId: string,
  data: {
    station_id: number;
    program_name: string;
    days_of_week: string;
    start_time: string;
    duration_mins: number;
    is_active?: boolean;
  }
): Promise<number> {
  const result = await db
    .prepare(`
      INSERT INTO schedules (user_id, station_id, program_name, days_of_week, start_time, duration_mins, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      userId,
      data.station_id,
      data.program_name,
      data.days_of_week,
      data.start_time,
      data.duration_mins,
      data.is_active ?? true
    )
    .run();

  return result.meta.last_row_id;
}

export async function updateSchedule(
  db: D1Database,
  scheduleId: number,
  userId: string,
  data: {
    station_id?: number;
    program_name?: string;
    days_of_week?: string;
    start_time?: string;
    duration_mins?: number;
    is_active?: boolean;
  }
): Promise<boolean> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.station_id !== undefined) {
    fields.push('station_id = ?');
    values.push(data.station_id);
  }
  if (data.program_name !== undefined) {
    fields.push('program_name = ?');
    values.push(data.program_name);
  }
  if (data.days_of_week !== undefined) {
    fields.push('days_of_week = ?');
    values.push(data.days_of_week);
  }
  if (data.start_time !== undefined) {
    fields.push('start_time = ?');
    values.push(data.start_time);
  }
  if (data.duration_mins !== undefined) {
    fields.push('duration_mins = ?');
    values.push(data.duration_mins);
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(data.is_active);
  }

  if (fields.length === 0) {
    return false;
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(scheduleId, userId);

  const result = await db
    .prepare(`
      UPDATE schedules
      SET ${fields.join(', ')}
      WHERE id = ? AND user_id = ?
    `)
    .bind(...values)
    .run();

  return result.meta.changes > 0;
}

export async function deleteSchedule(
  db: D1Database,
  scheduleId: number,
  userId: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM schedules WHERE id = ? AND user_id = ?')
    .bind(scheduleId, userId)
    .run();

  return result.meta.changes > 0;
}

/**
 * Recording Queries
 */

export async function getRecordings(
  db: D1Database,
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Recording[]> {
  const { results } = await db
    .prepare(`
      SELECT
        r.*,
        rs.id as station_id_join,
        rs.name as station_name,
        rs.stream_url as station_stream_url,
        rs.is_active as station_is_active,
        rs.created_at as station_created_at,
        rs.updated_at as station_updated_at
      FROM recordings r
      LEFT JOIN radio_stations rs ON r.station_id = rs.id
      WHERE r.user_id = ?
      ORDER BY r.recorded_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(userId, limit, offset)
    .all();

  // Transform flat results to include nested station object
  return results.map((row: any) => {
    const recording: any = { ...row };

    // Create station object if station data exists
    if (row.station_name) {
      recording.station = {
        id: row.station_id,
        name: row.station_name,
        stream_url: row.station_stream_url,
        is_active: row.station_is_active === 1,
        created_at: row.station_created_at,
        updated_at: row.station_updated_at,
      };
    }

    // Remove flat station fields
    delete recording.station_id_join;
    delete recording.station_name;
    delete recording.station_stream_url;
    delete recording.station_is_active;
    delete recording.station_created_at;
    delete recording.station_updated_at;

    return recording;
  }) as Recording[];
}

export async function getRecordingById(
  db: D1Database,
  recordingId: number,
  userId: string
): Promise<Recording | null> {
  const result = await db
    .prepare(`
      SELECT
        r.*,
        rs.id as station_id_join,
        rs.name as station_name,
        rs.stream_url as station_stream_url,
        rs.is_active as station_is_active,
        rs.created_at as station_created_at,
        rs.updated_at as station_updated_at
      FROM recordings r
      LEFT JOIN radio_stations rs ON r.station_id = rs.id
      WHERE r.id = ? AND r.user_id = ?
    `)
    .bind(recordingId, userId)
    .first();

  if (!result) {
    return null;
  }

  const row: any = result;
  const recording: any = { ...row };

  // Create station object if station data exists
  if (row.station_name) {
    recording.station = {
      id: row.station_id,
      name: row.station_name,
      stream_url: row.station_stream_url,
      is_active: row.station_is_active === 1,
      created_at: row.station_created_at,
      updated_at: row.station_updated_at,
    };
  }

  // Remove flat station fields
  delete recording.station_id_join;
  delete recording.station_name;
  delete recording.station_stream_url;
  delete recording.station_is_active;
  delete recording.station_created_at;
  delete recording.station_updated_at;

  return recording as Recording;
}

export async function deleteRecording(
  db: D1Database,
  recordingId: number,
  userId: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM recordings WHERE id = ? AND user_id = ?')
    .bind(recordingId, userId)
    .run();

  return result.meta.changes > 0;
}

/**
 * Radio Station Queries
 */

export async function getActiveStations(
  db: D1Database
): Promise<RadioStation[]> {
  const { results } = await db
    .prepare('SELECT * FROM radio_stations WHERE is_active = 1 ORDER BY name')
    .all();

  return results as unknown as RadioStation[];
}

export async function getStationById(
  db: D1Database,
  stationId: number
): Promise<RadioStation | null> {
  const result = await db
    .prepare('SELECT * FROM radio_stations WHERE id = ?')
    .bind(stationId)
    .first();

  return result as RadioStation | null;
}

/**
 * User Queries
 */

export async function getUserById(
  db: D1Database,
  userId: string
): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first();

  return result as User | null;
}

export async function createUser(
  db: D1Database,
  userId: string,
  email: string
): Promise<void> {
  await db
    .prepare('INSERT INTO users (id, email) VALUES (?, ?)')
    .bind(userId, email)
    .run();
}

export async function upsertUser(
  db: D1Database,
  userId: string,
  email: string
): Promise<void> {
  // Email is required - this should come from Google OAuth via Clerk
  if (!email) {
    throw new Error('Email is required for user creation');
  }

  // First, check if this email exists with a different user ID
  const existingUser = await db
    .prepare('SELECT id, email FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (existingUser && existingUser.id !== userId) {
    // Same email but different user ID - update the user ID
    // This can happen if the user's Clerk account was recreated
    console.log(`[upsertUser] Updating user ID from ${existingUser.id} to ${userId} for email ${email}`);
    await db
      .prepare('UPDATE users SET id = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
      .bind(userId, email)
      .run();
  } else {
    // Normal insert or update
    await db
      .prepare(`
        INSERT INTO users (id, email)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(userId, email)
      .run();
  }
}

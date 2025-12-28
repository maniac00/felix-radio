/**
 * Dashboard statistics endpoints
 */

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { clerkAuth } from '../middleware/auth';

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply Clerk authentication to all routes
dashboard.use('/*', clerkAuth);

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for authenticated user
 */
dashboard.get('/stats', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  try {
    // Get total recordings count
    const totalRecordings = await db
      .prepare('SELECT COUNT(*) as count FROM recordings WHERE user_id = ?')
      .bind(userId)
      .first();

    // Get active schedules count
    const activeSchedules = await db
      .prepare('SELECT COUNT(*) as count FROM schedules WHERE user_id = ? AND is_active = 1')
      .bind(userId)
      .first();

    // Get total storage used (sum of file sizes)
    const storageUsed = await db
      .prepare('SELECT SUM(file_size_bytes) as total FROM recordings WHERE user_id = ? AND status = ?')
      .bind(userId, 'completed')
      .first();

    // Get recent recordings (last 5)
    const { results: recentRecordings } = await db
      .prepare(`
        SELECT id, program_name, recorded_at, status, stt_status
        FROM recordings
        WHERE user_id = ?
        ORDER BY recorded_at DESC
        LIMIT 5
      `)
      .bind(userId)
      .all();

    // Get next scheduled recording (closest future time)
    const { results: upcomingSchedules } = await db
      .prepare(`
        SELECT id, program_name, start_time, duration_mins, days_of_week
        FROM schedules
        WHERE user_id = ? AND is_active = 1
        ORDER BY start_time ASC
        LIMIT 1
      `)
      .bind(userId)
      .all();

    return c.json({
      total_recordings: (totalRecordings as any)?.count || 0,
      active_schedules: (activeSchedules as any)?.count || 0,
      storage_used_bytes: (storageUsed as any)?.total || 0,
      recent_recordings: recentRecordings,
      next_schedule: upcomingSchedules[0] || null,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return c.json(
      { error: 'Failed to fetch dashboard statistics' },
      500
    );
  }
});

export default dashboard;

/**
 * Radio station endpoints
 */

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { clerkAuth } from '../middleware/auth';
import { getActiveStations, getStationById } from '../db/queries';

const stations = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply Clerk authentication to all routes
stations.use('/*', clerkAuth);

/**
 * GET /api/stations
 * List all active radio stations
 */
stations.get('/', async (c) => {
  const db = c.env.DB;

  try {
    const results = await getActiveStations(db);

    return c.json({
      stations: results,
      total: results.length,
    });
  } catch (error) {
    console.error('Error fetching stations:', error);
    return c.json(
      { error: 'Failed to fetch stations' },
      500
    );
  }
});

/**
 * GET /api/stations/:id
 * Get a specific station by ID
 */
stations.get('/:id', async (c) => {
  const db = c.env.DB;
  const stationId = parseInt(c.req.param('id'), 10);

  if (isNaN(stationId)) {
    return c.json({ error: 'Invalid station ID' }, 400);
  }

  try {
    const station = await getStationById(db, stationId);

    if (!station) {
      return c.json({ error: 'Station not found' }, 404);
    }

    return c.json({ station });
  } catch (error) {
    console.error('Error fetching station:', error);
    return c.json(
      { error: 'Failed to fetch station' },
      500
    );
  }
});

export default stations;

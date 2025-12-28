import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  // DB: D1Database; // Will be uncommented in Task 12.0
  // R2: R2Bucket; // Will be uncommented in Task 13.0
  CLERK_SECRET_KEY: string;
  INTERNAL_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:8787'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'felix-radio-api',
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Felix Radio API',
    version: '0.1.0',
    description: 'Radio recording and STT transcription service API',
    endpoints: {
      health: '/health',
      api: {
        schedules: '/api/schedules',
        recordings: '/api/recordings',
        stations: '/api/stations',
        dashboard: '/api/dashboard',
        internal: '/api/internal',
      },
    },
  });
});

// API routes (will be implemented in later tasks)
app.get('/api/schedules', (c) => {
  return c.json({ message: 'Schedules endpoint - to be implemented in Task 15.0' });
});

app.get('/api/recordings', (c) => {
  return c.json({ message: 'Recordings endpoint - to be implemented in Task 16.0' });
});

app.get('/api/stations', (c) => {
  return c.json({ message: 'Stations endpoint - to be implemented in Task 18.0' });
});

app.get('/api/dashboard/stats', (c) => {
  return c.json({ message: 'Dashboard endpoint - to be implemented in Task 18.0' });
});

app.get('/api/internal/schedules/pending', (c) => {
  return c.json({ message: 'Internal API endpoint - to be implemented in Task 18.0' });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;

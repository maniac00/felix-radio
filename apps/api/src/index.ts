import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings, Variables } from './types';
import { clerkAuth } from './middleware/auth';
import schedules from './routes/schedules';
import recordings from './routes/recordings';
import stations from './routes/stations';
import dashboard from './routes/dashboard';
import internal from './routes/internal';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS middleware
app.use('/*', cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8787',
    'https://felix-radio-web-i3da.vercel.app',
    'https://felix-radio.vercel.app',
  ],
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

// Test endpoint for Clerk authentication
app.get('/api/auth/me', clerkAuth, (c) => {
  const userId = c.get('userId');
  return c.json({
    message: 'Authenticated successfully',
    userId,
  });
});

// API routes
app.route('/api/schedules', schedules);
app.route('/api/recordings', recordings);
app.route('/api/stations', stations);
app.route('/api/dashboard', dashboard);
app.route('/api/internal', internal);

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

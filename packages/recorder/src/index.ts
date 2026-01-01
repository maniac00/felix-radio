/**
 * Felix Radio Recorder Server
 * Polls for scheduled recordings and executes them using ffmpeg
 */

import { loadConfig, validateConfig } from './config.js';
import { SchedulePoller } from './scheduler/poller.js';
import { logger } from './lib/logger.js';

// Load and validate configuration
logger.info('Loading configuration...');
const config = loadConfig();

try {
  validateConfig(config);
  logger.info('Configuration validated successfully');
} catch (error) {
  logger.error('Configuration validation failed', { error });
  process.exit(1);
}

// Log configuration (redact secrets)
logger.info('Configuration loaded', {
  workersApiUrlPrimary: config.workersApiUrlPrimary || '(none)',
  workersApiUrlFallback: config.workersApiUrlFallback,
  r2Endpoint: config.r2Endpoint,
  r2BucketName: config.r2BucketName,
  timezone: config.timezone,
  logLevel: config.logLevel,
});

// Initialize schedule poller
const poller = new SchedulePoller(config);

// Graceful shutdown handler
function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  poller.stop();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the poller
logger.info('Starting Felix Radio Recorder...');
poller.start();
logger.info('Felix Radio Recorder is running');

/**
 * Configuration loader with validation
 */

import type { Config } from './types.js';

function getEnv(key: string, required: boolean = true): string {
  const value = process.env[key];

  if (!value && required) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value || '';
}

export function loadConfig(): Config {
  return {
    workersApiUrlPrimary: getEnv('WORKERS_API_URL_PRIMARY', false) || '',
    workersApiUrlFallback: getEnv('WORKERS_API_URL_FALLBACK'),
    internalApiKey: getEnv('INTERNAL_API_KEY'),
    openaiApiKey: getEnv('OPENAI_API_KEY'),
    r2AccountId: getEnv('R2_ACCOUNT_ID'),
    r2AccessKeyId: getEnv('R2_ACCESS_KEY_ID'),
    r2SecretAccessKey: getEnv('R2_SECRET_ACCESS_KEY'),
    r2BucketName: getEnv('R2_BUCKET_NAME'),
    r2Endpoint: getEnv('R2_ENDPOINT'),
    timezone: getEnv('TZ', false) || 'Asia/Seoul',
    logLevel: getEnv('LOG_LEVEL', false) || 'info',
  };
}

export function validateConfig(config: Config): void {
  const errors: string[] = [];

  // Fallback URL is required
  if (!config.workersApiUrlFallback.startsWith('http')) {
    errors.push('WORKERS_API_URL_FALLBACK must be a valid HTTP URL');
  }

  // Primary URL is optional, but if provided must be valid
  if (config.workersApiUrlPrimary && !config.workersApiUrlPrimary.startsWith('http')) {
    errors.push('WORKERS_API_URL_PRIMARY must be a valid HTTP URL');
  }

  if (config.internalApiKey.length < 10) {
    errors.push('INTERNAL_API_KEY must be at least 10 characters');
  }

  if (!config.openaiApiKey.startsWith('sk-')) {
    errors.push('OPENAI_API_KEY must start with "sk-"');
  }

  if (!config.r2Endpoint.startsWith('https://')) {
    errors.push('R2_ENDPOINT must be a valid HTTPS URL');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

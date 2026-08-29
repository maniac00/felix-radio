/**
 * Shared TypeScript types for Felix Radio API
 */

/**
 * Environment bindings for Cloudflare Workers
 */
export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
  INTERNAL_API_KEY: string;
};

/**
 * Hono context variables
 */
export type Variables = {
  userId: string;
  userEmail: string;
};

/**
 * Schedule data from database
 */
export interface Schedule {
  id: number;
  user_id: string;
  station_id: number;
  program_name: string;
  days_of_week: string; // JSON array string
  start_time: string;
  duration_mins: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Recording data from database
 */
export interface Recording {
  id: number;
  user_id: string;
  schedule_id: number | null;
  station_id: number;
  program_name: string;
  recorded_at: string;
  duration_secs: number;
  file_size_bytes: number;
  audio_file_path: string;
  status: 'pending' | 'recording' | 'completed' | 'failed';
  stt_status: 'none' | 'processing' | 'completed' | 'failed';
  stt_text_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Radio station data from database
 */
export interface RadioStation {
  id: number;
  name: string;
  stream_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User data from database
 */
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

/**
 * Type definitions for Felix Radio Recorder
 */

export interface Schedule {
  id: number;
  user_id: string;
  station_id: number;
  program_name: string;
  days_of_week: string; // JSON array
  start_time: string; // HH:mm
  duration_mins: number;
  is_active: boolean;
  stream_url: string; // Joined from radio_stations
  station_name: string; // Joined from radio_stations
  email: string; // Joined from users
}

export interface RecordingMetadata {
  user_id: string;
  schedule_id: number;
  station_id: number;
  program_name: string;
  recorded_at: string; // ISO 8601
  duration_secs: number;
  file_size_bytes: number;
  audio_file_path: string;
  status: 'pending' | 'recording' | 'completed' | 'failed';
  error_message?: string;
}

export interface RecordingJob {
  schedule: Schedule;
  outputPath: string;
  r2Key: string;
}

export interface STTJob {
  recording_id: number;
  audio_file_path: string;
  user_id: string;
  program_name: string;
}

export interface Config {
  workersApiUrlPrimary: string; // Local tunnel (optional, preferred)
  workersApiUrlFallback: string; // Production (required, always available)
  internalApiKey: string;
  openaiApiKey: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2Endpoint: string;
  timezone: string;
  logLevel: string;
}

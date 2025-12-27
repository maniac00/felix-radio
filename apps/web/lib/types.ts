// Database Models

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface RadioStation {
  id: number;
  name: string;
  stream_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  user_id: string;
  station_id: number;
  program_name: string;
  days_of_week: string; // JSON array: "[0,1,2,3,4,5,6]"
  start_time: string; // "HH:MM" format
  duration_mins: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  station?: RadioStation;
}

export type RecordingStatus = 'pending' | 'recording' | 'completed' | 'failed';
export type STTStatus = 'none' | 'pending' | 'processing' | 'completed' | 'failed';

export interface Recording {
  id: number;
  user_id: string;
  schedule_id: number;
  station_id: number;
  program_name: string;
  recorded_at: string;
  duration_secs: number;
  file_size_bytes: number;
  audio_file_path: string; // R2 path
  status: RecordingStatus;
  stt_status: STTStatus;
  stt_text_path: string | null; // R2 path
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  schedule?: Schedule;
  station?: RadioStation;
}

// API Request/Response Types

export interface ScheduleListResponse {
  schedules: Schedule[];
  total: number;
  page: number;
  limit: number;
}

export interface ScheduleCreateRequest {
  station_id: number;
  program_name: string;
  days_of_week: number[]; // [0,1,2,3,4,5,6] where 0=Sunday
  start_time: string; // "HH:MM"
  duration_mins: number;
}

export interface ScheduleUpdateRequest {
  program_name?: string;
  days_of_week?: number[];
  start_time?: string;
  duration_mins?: number;
  is_active?: boolean;
}

export interface RecordingListResponse {
  recordings: Recording[];
  total: number;
  page: number;
  limit: number;
}

export interface RecordingDetailResponse {
  recording: Recording;
  download_url?: string;
  stt_text?: string;
}

export interface StationListResponse {
  stations: RadioStation[];
}

export interface STTConvertRequest {
  recording_id: number;
}

export interface STTConvertResponse {
  status: STTStatus;
  message: string;
}

// UI-specific types

export interface DayOfWeek {
  value: number;
  label: string;
  short: string;
}

export const DAYS_OF_WEEK: DayOfWeek[] = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export interface DashboardStats {
  total_recordings: number;
  active_schedules: number;
  storage_used_gb: number;
  recent_activity_count: number;
}

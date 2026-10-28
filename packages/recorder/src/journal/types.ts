/**
 * Journal entry types for tracking recording lifecycle
 */

export type JournalStatus =
  | 'scheduled'
  | 'recording'
  | 'recorded'
  | 'uploading'
  | 'uploaded'
  | 'db_synced'
  | 'stt_processing'
  | 'stt_completed'
  | 'failed';

export interface JournalEntry {
  /** Unique key: {schedule_id}_{YYYY-MM-DD} */
  key: string;
  scheduleId: number;
  date: string; // YYYY-MM-DD
  status: JournalStatus;
  /** Local audio file path */
  localPath: string;
  /** R2 object key */
  r2Key: string;
  /** DB recording ID (set after DB creation) */
  recordingId: number | null;
  /** Schedule snapshot for recovery */
  schedule: {
    userId: string;
    stationId: number;
    programName: string;
    durationMins: number;
    streamUrl: string;
  };
  /** Timestamps */
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  /** Error info for failed entries */
  errorMessage?: string;
  /** Retry count for current phase */
  retryCount: number;
  /** Seconds of audio actually captured (set when recording finishes) */
  actualDurationSecs?: number;
  /** Number of ffmpeg launches used for this recording */
  recordingAttempts?: number;
  /** Set when audio is missing (stream interruptions); stored as DB error_message */
  recordingNote?: string;
  /** Number of failed STT attempts (drives retry backoff) */
  sttAttempts?: number;
  /** ISO 8601 timestamp of the last STT attempt */
  sttLastAttemptAt?: string;
}

export interface JournalData {
  version: 1;
  entries: Record<string, JournalEntry>;
}

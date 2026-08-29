import {
  Schedule,
  Recording,
  RadioStation,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  DashboardStats,
} from './types';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

class ApiClient {
  private baseUrl: string;
  private getToken: (() => Promise<string | null>) | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the token getter function from Clerk's useAuth hook
   * This should be called from a Client Component
   */
  setTokenGetter(getToken: () => Promise<string | null>) {
    this.getToken = getToken;
  }

  /**
   * Get authentication token from Clerk
   */
  private async getAuthToken(): Promise<string | null> {
    if (!this.getToken) {
      console.warn('Token getter not set. Call apiClient.setTokenGetter() first.');
      return null;
    }

    try {
      const token = await this.getToken();
      console.log('[API Client] Token obtained:', token ? 'YES (length: ' + token.length + ')' : 'NO');
      return token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // ==================== Schedule Methods ====================

  /**
   * Get all schedules for the current user
   */
  async getSchedules(): Promise<Schedule[]> {
    const response = await this.fetch<{ schedules: Schedule[]; total: number }>('/api/schedules');
    return response.schedules;
  }

  /**
   * Create a new schedule
   */
  async createSchedule(data: ScheduleCreateRequest): Promise<Schedule> {
    // Convert days_of_week array to JSON string for API
    const apiData = {
      ...data,
      days_of_week: JSON.stringify(data.days_of_week),
    };

    const response = await this.fetch<{ message: string; schedule: Schedule }>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(apiData),
    });
    return response.schedule;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(
    id: number,
    data: ScheduleUpdateRequest
  ): Promise<Schedule> {
    // Convert days_of_week array to JSON string if present
    const apiData = data.days_of_week
      ? { ...data, days_of_week: JSON.stringify(data.days_of_week) }
      : data;

    const response = await this.fetch<{ message: string; schedule: Schedule }>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(apiData),
    });
    return response.schedule;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: number): Promise<void> {
    await this.fetch<void>(`/api/schedules/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Toggle schedule active status
   */
  async toggleScheduleActive(id: number, currentState: boolean): Promise<Schedule> {
    const response = await this.fetch<{ message: string; schedule: Schedule }>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: !currentState }),
    });

    return response.schedule;
  }

  // ==================== Recording Methods ====================

  /**
   * Get all recordings with optional filters
   */
  async getRecordings(filters?: {
    status?: string;
    stt_status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Recording[]> {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await this.fetch<{ recordings: Recording[]; limit: number; offset: number; count: number }>(`/api/recordings?${params.toString()}`);
    return response.recordings;
  }

  /**
   * Get a single recording by ID
   */
  async getRecording(id: number): Promise<Recording> {
    const response = await this.fetch<{ recording: Recording }>(`/api/recordings/${id}`);
    return response.recording;
  }

  /**
   * Delete a recording
   */
  async deleteRecording(id: number): Promise<void> {
    await this.fetch<void>(`/api/recordings/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get download URL for a recording
   */
  async getRecordingDownloadUrl(id: number): Promise<string> {
    // Get auth token
    const token = await this.getAuthToken();

    // Return download URL with token in query param
    // The endpoint returns the file directly, so we construct the URL with auth
    return `${this.baseUrl}/api/recordings/${id}/download?token=${encodeURIComponent(token || '')}`;
  }

  // ==================== STT Methods ====================

  /**
   * Trigger STT conversion for a recording
   */
  async triggerSTT(recordingId: number): Promise<void> {
    await this.fetch<void>(`/api/recordings/${recordingId}/stt`, {
      method: 'POST',
    });
  }

  /**
   * Get STT result for a recording
   */
  async getSTTResult(recordingId: number): Promise<string> {
    const response = await this.fetch<{ stt_status: string; text?: string; message?: string }>(
      `/api/recordings/${recordingId}/stt`
    );

    if (response.stt_status !== 'completed' || !response.text) {
      throw new Error(response.message || 'STT not completed');
    }

    return response.text;
  }

  // ==================== Station Methods ====================

  /**
   * Get all available radio stations
   */
  async getStations(): Promise<RadioStation[]> {
    const response = await this.fetch<{ stations: RadioStation[]; total: number }>('/api/stations');
    return response.stations;
  }

  // ==================== Dashboard Methods ====================

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.fetch<{
      total_recordings: number;
      active_schedules: number;
      storage_used_bytes: number;
      recent_recordings: Recording[];
      next_schedule: Schedule | null;
    }>('/api/dashboard/stats');

    // Transform API response to match frontend types
    return {
      total_recordings: response.total_recordings,
      active_schedules: response.active_schedules,
      storage_used_gb: response.storage_used_bytes / (1024 * 1024 * 1024),
      recent_activity_count: response.recent_recordings.length,
    };
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };

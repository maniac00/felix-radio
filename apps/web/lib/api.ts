import {
  Schedule,
  Recording,
  RadioStation,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  DashboardStats,
} from './types';
import {
  mockSchedules,
  mockRecordings,
  mockStations,
  mockDashboardStats,
  mockSTTText,
} from './mock-data';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

// Check if we're using mock mode
// Mock mode is enabled when NEXT_PUBLIC_USE_MOCK_API is explicitly set to 'true'
const USE_MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

class ApiClient {
  private baseUrl: string;
  private useMock: boolean;
  private getToken: (() => Promise<string | null>) | null = null;

  constructor(baseUrl: string = API_BASE_URL, useMock: boolean = USE_MOCK_MODE) {
    this.baseUrl = baseUrl;
    this.useMock = useMock;
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
    if (this.useMock) return null;

    if (!this.getToken) {
      console.warn('Token getter not set. Call apiClient.setTokenGetter() first.');
      return null;
    }

    try {
      return await this.getToken();
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
    if (this.useMock) {
      throw new Error('Mock mode enabled - use specific mock methods');
    }

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
    if (this.useMock) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      return [...mockSchedules];
    }

    const response = await this.fetch<{ schedules: Schedule[]; total: number }>('/api/schedules');
    return response.schedules;
  }

  /**
   * Create a new schedule
   */
  async createSchedule(data: ScheduleCreateRequest): Promise<Schedule> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newSchedule: Schedule = {
        id: Math.max(...mockSchedules.map((s) => s.id), 0) + 1,
        user_id: 'mock-user-id',
        station_id: data.station_id,
        station: mockStations.find((s) => s.id === data.station_id),
        program_name: data.program_name,
        days_of_week: data.days_of_week,
        start_time: data.start_time,
        duration_mins: data.duration_mins,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSchedules.push(newSchedule);
      return newSchedule;
    }

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
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const index = mockSchedules.findIndex((s) => s.id === id);
      if (index === -1) {
        throw new Error('Schedule not found');
      }

      mockSchedules[index] = {
        ...mockSchedules[index],
        ...data,
        updated_at: new Date().toISOString(),
      };

      return mockSchedules[index];
    }

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
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const index = mockSchedules.findIndex((s) => s.id === id);
      if (index === -1) {
        throw new Error('Schedule not found');
      }

      mockSchedules.splice(index, 1);
      return;
    }

    await this.fetch<void>(`/api/schedules/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Toggle schedule active status
   */
  async toggleScheduleActive(id: number): Promise<Schedule> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const index = mockSchedules.findIndex((s) => s.id === id);
      if (index === -1) {
        throw new Error('Schedule not found');
      }

      mockSchedules[index] = {
        ...mockSchedules[index],
        is_active: !mockSchedules[index].is_active,
        updated_at: new Date().toISOString(),
      };

      return mockSchedules[index];
    }

    return this.fetch<Schedule>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: undefined }), // Toggle on server
    });
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
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 300));

      let filtered = [...mockRecordings];

      if (filters?.status && filters.status !== 'all') {
        filtered = filtered.filter((r) => r.status === filters.status);
      }

      if (filters?.stt_status && filters.stt_status !== 'all') {
        filtered = filtered.filter((r) => r.stt_status === filters.stt_status);
      }

      if (filters?.search) {
        const query = filters.search.toLowerCase();
        filtered = filtered.filter((r) =>
          r.program_name.toLowerCase().includes(query)
        );
      }

      return filtered;
    }

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
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const recording = mockRecordings.find((r) => r.id === id);
      if (!recording) {
        throw new Error('Recording not found');
      }

      return recording;
    }

    const response = await this.fetch<{ recording: Recording }>(`/api/recordings/${id}`);
    return response.recording;
  }

  /**
   * Delete a recording
   */
  async deleteRecording(id: number): Promise<void> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const index = mockRecordings.findIndex((r) => r.id === id);
      if (index === -1) {
        throw new Error('Recording not found');
      }

      mockRecordings.splice(index, 1);
      return;
    }

    await this.fetch<void>(`/api/recordings/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get download URL for a recording
   */
  async getRecordingDownloadUrl(id: number): Promise<string> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return '/mock-audio.mp3'; // Return mock audio file
    }

    // Download endpoint returns the file directly, not JSON
    return `${this.baseUrl}/api/recordings/${id}/download`;
  }

  // ==================== STT Methods ====================

  /**
   * Trigger STT conversion for a recording
   */
  async triggerSTT(recordingId: number): Promise<void> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const index = mockRecordings.findIndex((r) => r.id === recordingId);
      if (index === -1) {
        throw new Error('Recording not found');
      }

      // Simulate STT processing
      mockRecordings[index] = {
        ...mockRecordings[index],
        stt_status: 'processing',
      };

      // Simulate completion after delay
      setTimeout(() => {
        mockRecordings[index] = {
          ...mockRecordings[index],
          stt_status: 'completed',
          stt_text_file_path: `users/mock-user/recordings/stt_${recordingId}.txt`,
        };
      }, 3000);

      return;
    }

    await this.fetch<void>(`/api/recordings/${recordingId}/stt`, {
      method: 'POST',
    });
  }

  /**
   * Get STT result for a recording
   */
  async getSTTResult(recordingId: number): Promise<string> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const recording = mockRecordings.find((r) => r.id === recordingId);
      if (!recording) {
        throw new Error('Recording not found');
      }

      if (recording.stt_status !== 'completed') {
        throw new Error('STT not completed');
      }

      return mockSTTText;
    }

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
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return [...mockStations];
    }

    const response = await this.fetch<{ stations: RadioStation[]; total: number }>('/api/stations');
    return response.stations;
  }

  // ==================== Dashboard Methods ====================

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { ...mockDashboardStats };
    }

    return this.fetch<DashboardStats>('/api/dashboard/stats');
  }

  /**
   * Check if API client is in mock mode
   */
  isMockMode(): boolean {
    return this.useMock;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };

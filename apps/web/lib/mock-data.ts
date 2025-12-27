import type {
  RadioStation,
  Schedule,
  Recording,
  DashboardStats,
} from './types';

// Mock Radio Stations
export const mockStations: RadioStation[] = [
  {
    id: 1,
    name: 'TBN 제주',
    stream_url: 'http://radio2.tbn.or.kr:1935/jeju/myStream/playlist.m3u8',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Mock Schedules
export const mockSchedules: Schedule[] = [
  {
    id: 1,
    user_id: 'user_mock123',
    station_id: 1,
    program_name: '아침 뉴스',
    days_of_week: '[1,2,3,4,5]', // Mon-Fri
    start_time: '07:00',
    duration_mins: 30,
    is_active: true,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
    station: mockStations[0],
  },
  {
    id: 2,
    user_id: 'user_mock123',
    station_id: 1,
    program_name: '저녁 토크쇼',
    days_of_week: '[1,3,5]', // Mon, Wed, Fri
    start_time: '19:00',
    duration_mins: 60,
    is_active: true,
    created_at: '2024-12-05T00:00:00Z',
    updated_at: '2024-12-05T00:00:00Z',
    station: mockStations[0],
  },
  {
    id: 3,
    user_id: 'user_mock123',
    station_id: 1,
    program_name: '주말 음악 프로그램',
    days_of_week: '[0,6]', // Sun, Sat
    start_time: '14:00',
    duration_mins: 120,
    is_active: false,
    created_at: '2024-11-20T00:00:00Z',
    updated_at: '2024-12-15T00:00:00Z',
    station: mockStations[0],
  },
];

// Mock Recordings
export const mockRecordings: Recording[] = [
  {
    id: 1,
    user_id: 'user_mock123',
    schedule_id: 1,
    station_id: 1,
    program_name: '아침 뉴스',
    recorded_at: '2024-12-27T07:00:00Z',
    duration_secs: 1800, // 30 mins
    file_size_bytes: 25600000, // ~25 MB
    audio_file_path: 'users/user_mock123/recordings/아침뉴스_20241227-0700.mp3',
    status: 'completed',
    stt_status: 'completed',
    stt_text_path: 'users/user_mock123/recordings/아침뉴스_20241227-0700.txt',
    error_message: null,
    created_at: '2024-12-27T07:00:00Z',
    updated_at: '2024-12-27T07:35:00Z',
    schedule: mockSchedules[0],
    station: mockStations[0],
  },
  {
    id: 2,
    user_id: 'user_mock123',
    schedule_id: 1,
    station_id: 1,
    program_name: '아침 뉴스',
    recorded_at: '2024-12-26T07:00:00Z',
    duration_secs: 1800,
    file_size_bytes: 25800000,
    audio_file_path: 'users/user_mock123/recordings/아침뉴스_20241226-0700.mp3',
    status: 'completed',
    stt_status: 'none',
    stt_text_path: null,
    error_message: null,
    created_at: '2024-12-26T07:00:00Z',
    updated_at: '2024-12-26T07:30:00Z',
    schedule: mockSchedules[0],
    station: mockStations[0],
  },
  {
    id: 3,
    user_id: 'user_mock123',
    schedule_id: 2,
    station_id: 1,
    program_name: '저녁 토크쇼',
    recorded_at: '2024-12-25T19:00:00Z',
    duration_secs: 3600, // 60 mins
    file_size_bytes: 51200000, // ~51 MB
    audio_file_path: 'users/user_mock123/recordings/저녁토크쇼_20241225-1900.mp3',
    status: 'completed',
    stt_status: 'processing',
    stt_text_path: null,
    error_message: null,
    created_at: '2024-12-25T19:00:00Z',
    updated_at: '2024-12-25T20:05:00Z',
    schedule: mockSchedules[1],
    station: mockStations[0],
  },
  {
    id: 4,
    user_id: 'user_mock123',
    schedule_id: 2,
    station_id: 1,
    program_name: '저녁 토크쇼',
    recorded_at: '2024-12-23T19:00:00Z',
    duration_secs: 3600,
    file_size_bytes: 50900000,
    audio_file_path: 'users/user_mock123/recordings/저녁토크쇼_20241223-1900.mp3',
    status: 'completed',
    stt_status: 'completed',
    stt_text_path: 'users/user_mock123/recordings/저녁토크쇼_20241223-1900.txt',
    error_message: null,
    created_at: '2024-12-23T19:00:00Z',
    updated_at: '2024-12-23T20:15:00Z',
    schedule: mockSchedules[1],
    station: mockStations[0],
  },
  {
    id: 5,
    user_id: 'user_mock123',
    schedule_id: 1,
    station_id: 1,
    program_name: '아침 뉴스',
    recorded_at: '2024-12-25T07:00:00Z',
    duration_secs: 1800,
    file_size_bytes: 25500000,
    audio_file_path: 'users/user_mock123/recordings/아침뉴스_20241225-0700.mp3',
    status: 'completed',
    stt_status: 'failed',
    stt_text_path: null,
    error_message: 'Whisper API rate limit exceeded',
    created_at: '2024-12-25T07:00:00Z',
    updated_at: '2024-12-25T07:35:00Z',
    schedule: mockSchedules[0],
    station: mockStations[0],
  },
  {
    id: 6,
    user_id: 'user_mock123',
    schedule_id: 1,
    station_id: 1,
    program_name: '아침 뉴스',
    recorded_at: '2024-12-24T07:00:00Z',
    duration_secs: 1800,
    file_size_bytes: 25700000,
    audio_file_path: 'users/user_mock123/recordings/아침뉴스_20241224-0700.mp3',
    status: 'completed',
    stt_status: 'completed',
    stt_text_path: 'users/user_mock123/recordings/아침뉴스_20241224-0700.txt',
    error_message: null,
    created_at: '2024-12-24T07:00:00Z',
    updated_at: '2024-12-24T07:40:00Z',
    schedule: mockSchedules[0],
    station: mockStations[0],
  },
  {
    id: 7,
    user_id: 'user_mock123',
    schedule_id: 2,
    station_id: 1,
    program_name: '저녁 토크쇼',
    recorded_at: '2024-12-20T19:00:00Z',
    duration_secs: 3600,
    file_size_bytes: 51000000,
    audio_file_path: 'users/user_mock123/recordings/저녁토크쇼_20241220-1900.mp3',
    status: 'completed',
    stt_status: 'none',
    stt_text_path: null,
    error_message: null,
    created_at: '2024-12-20T19:00:00Z',
    updated_at: '2024-12-20T20:00:00Z',
    schedule: mockSchedules[1],
    station: mockStations[0],
  },
  {
    id: 8,
    user_id: 'user_mock123',
    schedule_id: 1,
    station_id: 1,
    program_name: '아침 뉴스',
    recorded_at: '2024-12-20T07:00:00Z',
    duration_secs: 1200, // Partial recording (20 mins)
    file_size_bytes: 17000000,
    audio_file_path: 'users/user_mock123/recordings/아침뉴스_20241220-0700.mp3',
    status: 'failed',
    stt_status: 'none',
    stt_text_path: null,
    error_message: 'Stream connection lost',
    created_at: '2024-12-20T07:00:00Z',
    updated_at: '2024-12-20T07:20:00Z',
    schedule: mockSchedules[0],
    station: mockStations[0],
  },
  {
    id: 9,
    user_id: 'user_mock123',
    schedule_id: 1,
    station_id: 1,
    program_name: '아침 뉴스',
    recorded_at: '2024-12-19T07:00:00Z',
    duration_secs: 1800,
    file_size_bytes: 25600000,
    audio_file_path: 'users/user_mock123/recordings/아침뉴스_20241219-0700.mp3',
    status: 'completed',
    stt_status: 'completed',
    stt_text_path: 'users/user_mock123/recordings/아침뉴스_20241219-0700.txt',
    error_message: null,
    created_at: '2024-12-19T07:00:00Z',
    updated_at: '2024-12-19T07:35:00Z',
    schedule: mockSchedules[0],
    station: mockStations[0],
  },
  {
    id: 10,
    user_id: 'user_mock123',
    schedule_id: 2,
    station_id: 1,
    program_name: '저녁 토크쇼',
    recorded_at: '2024-12-18T19:00:00Z',
    duration_secs: 3600,
    file_size_bytes: 51100000,
    audio_file_path: 'users/user_mock123/recordings/저녁토크쇼_20241218-1900.mp3',
    status: 'completed',
    stt_status: 'completed',
    stt_text_path: 'users/user_mock123/recordings/저녁토크쇼_20241218-1900.txt',
    error_message: null,
    created_at: '2024-12-18T19:00:00Z',
    updated_at: '2024-12-18T20:10:00Z',
    schedule: mockSchedules[1],
    station: mockStations[0],
  },
];

// Mock Dashboard Stats
export const mockDashboardStats: DashboardStats = {
  total_recordings: 10,
  active_schedules: 2,
  storage_used_gb: 0.35, // ~350 MB
  recent_activity_count: 5,
};

// Mock STT Text
export const mockSTTText = `안녕하십니까. TBN 제주 아침 뉴스입니다.

오늘의 주요 뉴스를 전해드리겠습니다.

첫 번째 뉴스입니다. 제주도는 오늘 청정 에너지 정책 발표를 통해 2030년까지 탄소 중립 목표를 달성하겠다고 밝혔습니다. 이번 정책에는 풍력 발전 확대와 전기차 보급 지원이 포함되어 있습니다.

두 번째 뉴스입니다. 제주 관광객 수가 전년 대비 20% 증가하며 역대 최고치를 기록했습니다. 특히 외국인 관광객의 증가가 두드러졌으며, 이는 한류 콘텐츠의 영향으로 분석됩니다.

세 번째 뉴스입니다. 제주 해녀 문화가 유네스코 인류무형문화유산으로 등재된 지 5년을 맞이했습니다. 이를 기념하여 제주시에서는 특별 전시회를 개최할 예정입니다.

날씨 소식입니다. 오늘 제주는 맑은 날씨가 이어지겠으며, 기온은 평년보다 2도 높은 15도로 예상됩니다. 미세먼지 농도는 보통 수준입니다.

지금까지 TBN 제주 아침 뉴스였습니다. 감사합니다.`;

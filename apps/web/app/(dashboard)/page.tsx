'use client';

import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/shared/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio, Calendar, HardDrive, Activity, Clock, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { DashboardStats, Recording, Schedule } from '@/lib/types';
import { formatRelativeTime, formatFileSize, formatDaysOfWeek, parseDaysOfWeek } from '@/lib/utils';
import { toast } from 'sonner';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRecordings, setRecentRecordings] = useState<Recording[]>([]);
  const [activeSchedules, setActiveSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [statsData, recordingsData, schedulesData] = await Promise.all([
        apiClient.getDashboardStats(),
        apiClient.getRecordings(),
        apiClient.getSchedules(),
      ]);

      setStats(statsData);
      setRecentRecordings(recordingsData.slice(0, 5));
      setActiveSchedules(schedulesData.filter(s => s.is_active));
    } catch (error) {
      toast.error('대시보드 데이터를 불러오는데 실패했습니다');
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate next scheduled recording
  const getNextSchedule = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

    for (const schedule of activeSchedules) {
      const days = parseDaysOfWeek(schedule.days_of_week);
      if (days.includes(currentDay) && schedule.start_time > currentTime) {
        return schedule;
      }
    }
    return activeSchedules[0]; // Fallback to first active schedule
  };

  const nextSchedule = getNextSchedule();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-orange" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">대시보드 데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">라디오 녹음 및 STT 현황을 확인하세요</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="전체 녹음"
          value={stats.total_recordings}
          icon={Radio}
          description="누적 녹음 파일"
        />
        <StatsCard
          title="활성 스케줄"
          value={stats.active_schedules}
          icon={Calendar}
          description="현재 활성화된 스케줄"
        />
        <StatsCard
          title="저장 공간"
          value={`${stats.storage_used_gb.toFixed(2)} GB`}
          icon={HardDrive}
          description="사용 중인 저장 공간"
        />
        <StatsCard
          title="최근 활동"
          value={stats.recent_activity_count}
          icon={Activity}
          description="지난 7일간 녹음"
        />
      </div>

      {/* Next Scheduled Recording */}
      {nextSchedule && (
        <Card className="border-orange/20 bg-orange/5">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-orange" />
              <span>다음 예정 녹음</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-lg text-gray-900">
                  {nextSchedule.program_name}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {formatDaysOfWeek(parseDaysOfWeek(nextSchedule.days_of_week))} • {nextSchedule.start_time} • {nextSchedule.duration_mins}분
                </p>
              </div>
              <Badge variant="outline" className="border-orange text-orange">
                {nextSchedule.station?.name}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Recordings */}
      <Card>
        <CardHeader>
          <CardTitle>최근 녹음</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRecordings.map((recording) => (
              <div
                key={recording.id}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{recording.program_name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatRelativeTime(recording.recorded_at)} • {formatFileSize(recording.file_size_bytes)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={recording.status === 'completed' ? 'default' : 'secondary'}
                  >
                    {recording.status === 'completed' ? '완료' : recording.status === 'failed' ? '실패' : '진행중'}
                  </Badge>
                  {recording.stt_status === 'completed' && (
                    <Badge variant="outline" className="border-green-500 text-green-700">
                      STT 완료
                    </Badge>
                  )}
                  {recording.stt_status === 'processing' && (
                    <Badge variant="outline" className="border-blue-500 text-blue-700">
                      STT 처리중
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Schedules */}
      <Card>
        <CardHeader>
          <CardTitle>활성 스케줄</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeSchedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{schedule.program_name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDaysOfWeek(parseDaysOfWeek(schedule.days_of_week))} • {schedule.start_time} • {schedule.duration_mins}분
                  </p>
                </div>
                <Badge variant="outline">{schedule.station?.name}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

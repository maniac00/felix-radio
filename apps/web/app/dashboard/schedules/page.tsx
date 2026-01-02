'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScheduleForm } from '@/components/schedules/schedule-form';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Schedule, RadioStation, ScheduleCreateRequest } from '@/lib/types';
import { formatDaysOfWeek, parseDaysOfWeek, formatDurationMinutes } from '@/lib/utils';
import { toast } from 'sonner';

export const runtime = 'edge';

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | undefined>();

  // Load schedules and stations on mount
  useEffect(() => {
    loadSchedules();
    loadStations();
  }, []);

  const loadSchedules = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getSchedules();
      setSchedules(data);
    } catch (error) {
      toast.error('스케줄을 불러오는데 실패했습니다');
      console.error('Failed to load schedules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStations = async () => {
    try {
      const data = await apiClient.getStations();
      setStations(data);
    } catch (error) {
      console.error('Failed to load stations:', error);
    }
  };

  const handleCreate = async (data: ScheduleCreateRequest) => {
    try {
      const newSchedule = await apiClient.createSchedule(data);
      setSchedules([...schedules, newSchedule]);
      setIsDialogOpen(false);
      toast.success('스케줄이 생성되었습니다');
    } catch (error) {
      toast.error('스케줄 생성에 실패했습니다');
      console.error('Failed to create schedule:', error);
    }
  };

  const handleUpdate = async (data: ScheduleCreateRequest) => {
    if (!editingSchedule) return;

    try {
      const updated = await apiClient.updateSchedule(editingSchedule.id, data);
      setSchedules(schedules.map((s) => (s.id === updated.id ? updated : s)));
      setIsDialogOpen(false);
      setEditingSchedule(undefined);
      toast.success('스케줄이 수정되었습니다');
    } catch (error) {
      toast.error('스케줄 수정에 실패했습니다');
      console.error('Failed to update schedule:', error);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const schedule = schedules.find((s) => s.id === id);
      if (!schedule) return;

      const updated = await apiClient.toggleScheduleActive(id, schedule.is_active);
      setSchedules(schedules.map((s) => (s.id === updated.id ? updated : s)));
      toast.success('스케줄 상태가 변경되었습니다');
    } catch (error) {
      toast.error('상태 변경에 실패했습니다');
      console.error('Failed to toggle schedule:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말로 이 스케줄을 삭제하시겠습니까?')) return;

    try {
      await apiClient.deleteSchedule(id);
      setSchedules(schedules.filter((s) => s.id !== id));
      toast.success('스케줄이 삭제되었습니다');
    } catch (error) {
      toast.error('스케줄 삭제에 실패했습니다');
      console.error('Failed to delete schedule:', error);
    }
  };

  const openCreateDialog = () => {
    setEditingSchedule(undefined);
    setIsDialogOpen(true);
  };

  const openEditDialog = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">스케줄 관리</h1>
          <p className="text-gray-500 mt-1">녹음 스케줄을 생성하고 관리하세요</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              스케줄 생성
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? '스케줄 수정' : '새 스케줄 생성'}
              </DialogTitle>
              <DialogDescription>
                {editingSchedule
                  ? '스케줄 정보를 수정하세요'
                  : '새로운 녹음 스케줄을 생성하세요'}
              </DialogDescription>
            </DialogHeader>
            <ScheduleForm
              schedule={editingSchedule}
              stations={stations}
              onSubmit={editingSchedule ? handleUpdate : handleCreate}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingSchedule(undefined);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle>전체 스케줄 ({schedules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>생성된 스케줄이 없습니다</p>
              <p className="text-sm mt-1">위의 버튼을 클릭하여 새 스케줄을 생성하세요</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>프로그램</TableHead>
                  <TableHead>방송국</TableHead>
                  <TableHead>요일</TableHead>
                  <TableHead>시간</TableHead>
                  <TableHead>길이</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">
                    {schedule.program_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{schedule.station?.name}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatDaysOfWeek(parseDaysOfWeek(schedule.days_of_week))}
                  </TableCell>
                  <TableCell>{schedule.start_time}</TableCell>
                  <TableCell>{formatDurationMinutes(schedule.duration_mins)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={() => handleToggle(schedule.id)}
                      />
                      <span className="text-sm text-gray-600">
                        {schedule.is_active ? '활성' : '비활성'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(schedule)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

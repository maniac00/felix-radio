'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Schedule, RadioStation, DAYS_OF_WEEK } from '@/lib/types';

const scheduleFormSchema = z.object({
  program_name: z.string().min(1, '프로그램 이름을 입력하세요').max(100),
  station_id: z.number({
    message: '방송국을 선택하세요',
  }),
  days_of_week: z.array(z.number()).min(1, '최소 1일을 선택하세요'),
  start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, '올바른 시간 형식을 입력하세요 (HH:MM)'),
  duration_mins: z.number().min(1, '녹음 시간은 최소 1분이어야 합니다').max(240, '녹음 시간은 최대 240분(4시간)입니다'),
});

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

interface ScheduleFormProps {
  schedule?: Schedule;
  stations?: RadioStation[];
  onSubmit: (data: ScheduleFormValues) => void;
  onCancel: () => void;
}

export function ScheduleForm({ schedule, stations = [], onSubmit, onCancel }: ScheduleFormProps) {
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    mode: 'onSubmit', // Only validate on submit, not on change
    defaultValues: schedule
      ? {
          program_name: schedule.program_name,
          station_id: schedule.station_id,
          days_of_week: JSON.parse(schedule.days_of_week),
          start_time: schedule.start_time,
          duration_mins: schedule.duration_mins,
        }
      : {
          program_name: '',
          station_id: undefined,
          days_of_week: [],
          start_time: '',
          duration_mins: 30,
        },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="program_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>프로그램 이름</FormLabel>
              <FormControl>
                <Input placeholder="예: 아침 뉴스" {...field} />
              </FormControl>
              <FormDescription>녹음할 프로그램의 이름을 입력하세요</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="station_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>방송국</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(parseInt(value))}
                defaultValue={field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="방송국을 선택하세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {stations.map((station) => (
                    <SelectItem key={station.id} value={station.id.toString()}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="days_of_week"
          render={() => (
            <FormItem>
              <FormLabel>녹음 요일</FormLabel>
              <div className="grid grid-cols-7 gap-2 mt-2">
                {DAYS_OF_WEEK.map((day) => (
                  <FormField
                    key={day.value}
                    control={form.control}
                    name="days_of_week"
                    render={({ field }) => (
                      <FormItem key={day.value}>
                        <FormControl>
                          <div className="flex flex-col items-center">
                            <Checkbox
                              checked={field.value?.includes(day.value)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, day.value])
                                  : field.onChange(
                                      field.value?.filter((value) => value !== day.value)
                                    );
                              }}
                            />
                            <span className="text-xs mt-1">{day.short}</span>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormDescription>녹음을 진행할 요일을 선택하세요</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="start_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>시작 시간</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
              <FormDescription>녹음 시작 시간을 선택하세요 (Asia/Seoul 기준)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="duration_mins"
          render={({ field }) => (
            <FormItem>
              <FormLabel>녹음 시간 (분)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={240}
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === '' ? undefined : parseInt(value, 10));
                  }}
                />
              </FormControl>
              <FormDescription>녹음할 시간을 분 단위로 입력하세요 (최대 240분)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit">
            {schedule ? '수정' : '생성'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

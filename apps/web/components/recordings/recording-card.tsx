import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Recording } from '@/lib/types';
import { formatDateTime, formatFileSize, formatDuration } from '@/lib/utils';
import { Download, FileText, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface RecordingCardProps {
  recording: Recording;
  onDownload?: (recording: Recording) => void;
}

export function RecordingCard({ recording, onDownload }: RecordingCardProps) {
  const getStatusBadge = () => {
    switch (recording.status) {
      case 'completed':
        return <Badge className="bg-green-500">완료</Badge>;
      case 'recording':
        return <Badge className="bg-blue-500">녹음중</Badge>;
      case 'failed':
        return <Badge variant="destructive">실패</Badge>;
      case 'pending':
        return <Badge variant="secondary">대기중</Badge>;
      default:
        return null;
    }
  };

  const getSTTBadge = () => {
    switch (recording.stt_status) {
      case 'completed':
        return (
          <Badge variant="outline" className="border-green-500 text-green-700">
            <FileText className="w-3 h-3 mr-1" />
            STT 완료
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-700">
            <Clock className="w-3 h-3 mr-1" />
            STT 처리중
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="border-red-500 text-red-700">
            <AlertCircle className="w-3 h-3 mr-1" />
            STT 실패
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link href={`/dashboard/recordings/${recording.id}`}>
              <h3 className="text-lg font-semibold text-gray-900 hover:text-orange transition-colors">
                {recording.program_name}
              </h3>
            </Link>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="outline">{recording.station?.name}</Badge>
              {getStatusBadge()}
              {getSTTBadge()}
            </div>
            <div className="mt-3 text-sm text-gray-600 space-y-1">
              <p className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                {formatDateTime(recording.recorded_at)}
              </p>
              <p>
                길이: {formatDuration(recording.duration_secs)} • 파일 크기: {formatFileSize(recording.file_size_bytes)}
              </p>
              {recording.error_message && (
                <p className="text-red-600 flex items-center mt-2">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {recording.error_message}
                </p>
              )}
            </div>
          </div>
          <div className="ml-4">
            {recording.status === 'completed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload?.(recording)}
              >
                <Download className="w-4 h-4 mr-2" />
                다운로드
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

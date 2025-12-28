'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AudioPlayer } from '@/components/recordings/audio-player';
import {
  ArrowLeft,
  Download,
  FileText,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Recording } from '@/lib/types';
import {
  formatDateTime,
  formatFileSize,
  formatDuration,
} from '@/lib/utils';
import { toast } from 'sonner';

export default function RecordingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recordingId = parseInt(params.id as string);

  const [recording, setRecording] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [sttText, setSTTText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadRecording();
  }, [recordingId]);

  const loadRecording = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getRecording(recordingId);
      setRecording(data);

      // Load STT text if already completed
      if (data.stt_status === 'completed') {
        try {
          const text = await apiClient.getSTTResult(recordingId);
          setSTTText(text);
        } catch (error) {
          console.error('Failed to load STT text:', error);
        }
      }
    } catch (error) {
      toast.error('녹음을 불러오는데 실패했습니다');
      console.error('Failed to load recording:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-orange" />
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">녹음을 찾을 수 없습니다</p>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/recordings')}
          className="mt-4"
        >
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  const handleConvertSTT = async () => {
    try {
      setIsConverting(true);
      toast.info('STT 변환을 시작합니다', {
        description: 'Whisper API가 처리 중입니다',
      });

      await apiClient.triggerSTT(recordingId);

      // Poll for completion (in mock mode, this will complete after 3 seconds)
      setTimeout(async () => {
        try {
          const text = await apiClient.getSTTResult(recordingId);
          setSTTText(text);
          setIsConverting(false);
          toast.success('STT 변환이 완료되었습니다');
        } catch (error) {
          setIsConverting(false);
          toast.error('STT 결과를 불러오는데 실패했습니다');
        }
      }, 3000);
    } catch (error) {
      setIsConverting(false);
      toast.error('STT 변환에 실패했습니다');
      console.error('Failed to trigger STT:', error);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(sttText);
      setCopied(true);
      toast.success('텍스트가 클립보드에 복사되었습니다');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('복사에 실패했습니다');
    }
  };

  const handleDownload = async () => {
    try {
      const url = await apiClient.getRecordingDownloadUrl(recordingId);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${recording.program_name}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('다운로드를 시작합니다');
    } catch (error) {
      toast.error('다운로드에 실패했습니다');
      console.error('Failed to download recording:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/recordings')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            목록으로
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {recording.program_name}
            </h1>
            <p className="text-gray-500 mt-1">
              {formatDateTime(recording.recorded_at)}
            </p>
          </div>
        </div>
        {recording.status === 'completed' && (
          <Button onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            다운로드
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Audio Player */}
          {recording.status === 'completed' && (
            <AudioPlayer
              src="/mock-audio.mp3"
              title={recording.program_name}
            />
          )}

          {/* STT Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  텍스트 변환 (STT)
                </CardTitle>
                {!sttText && recording.status === 'completed' && (
                  <Button
                    onClick={handleConvertSTT}
                    disabled={isConverting}
                  >
                    {isConverting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        변환 중...
                      </>
                    ) : (
                      '텍스트로 변환'
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {sttText ? (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyText}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          복사됨
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          복사
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={sttText}
                    readOnly
                    className="min-h-[400px] font-mono text-sm"
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  {recording.stt_status === 'processing' ? (
                    <div className="flex flex-col items-center space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <p>STT 변환 처리 중입니다...</p>
                    </div>
                  ) : recording.stt_status === 'failed' ? (
                    <p className="text-red-600">STT 변환에 실패했습니다</p>
                  ) : (
                    <p>텍스트 변환 버튼을 클릭하여 STT를 시작하세요</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Metadata */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">상태</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">녹음 상태</p>
                {recording.status === 'completed' && (
                  <Badge className="bg-green-500">완료</Badge>
                )}
                {recording.status === 'failed' && (
                  <Badge variant="destructive">실패</Badge>
                )}
                {recording.status === 'recording' && (
                  <Badge className="bg-blue-500">녹음중</Badge>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">STT 상태</p>
                {recording.stt_status === 'completed' && (
                  <Badge className="bg-green-500">완료</Badge>
                )}
                {recording.stt_status === 'processing' && (
                  <Badge className="bg-blue-500">처리중</Badge>
                )}
                {recording.stt_status === 'failed' && (
                  <Badge variant="destructive">실패</Badge>
                )}
                {recording.stt_status === 'none' && (
                  <Badge variant="secondary">없음</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recording Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">녹음 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">방송국</p>
                <p className="font-medium">{recording.station?.name}</p>
              </div>
              <div>
                <p className="text-gray-600">녹음 시간</p>
                <p className="font-medium">
                  {formatDateTime(recording.recorded_at)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">재생 시간</p>
                <p className="font-medium">
                  {formatDuration(recording.duration_secs)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">파일 크기</p>
                <p className="font-medium">
                  {formatFileSize(recording.file_size_bytes)}
                </p>
              </div>
              {recording.schedule && (
                <div>
                  <p className="text-gray-600">스케줄</p>
                  <p className="font-medium">
                    {recording.schedule.program_name}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Info */}
          {recording.error_message && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-base text-red-900">
                  오류 정보
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-700">
                  {recording.error_message}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

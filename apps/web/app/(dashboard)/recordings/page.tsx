'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RecordingCard } from '@/components/recordings/recording-card';
import { Search, Filter } from 'lucide-react';
import { mockRecordings } from '@/lib/mock-data';
import { Recording, RecordingStatus, STTStatus } from '@/lib/types';
import { toast } from 'sonner';

export default function RecordingsPage() {
  const [recordings] = useState<Recording[]>(mockRecordings);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordingStatus | 'all'>('all');
  const [sttFilter, setSTTFilter] = useState<STTStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter recordings
  const filteredRecordings = useMemo(() => {
    return recordings.filter((recording) => {
      const matchesSearch = recording.program_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || recording.status === statusFilter;
      const matchesSTT =
        sttFilter === 'all' || recording.stt_status === sttFilter;

      return matchesSearch && matchesStatus && matchesSTT;
    });
  }, [recordings, searchQuery, statusFilter, sttFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRecordings.length / itemsPerPage);
  const paginatedRecordings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecordings.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecordings, currentPage]);

  const handleDownload = (recording: Recording) => {
    toast.info(`${recording.program_name} 다운로드를 시작합니다 (모의)`, {
      description: `파일: ${recording.audio_file_path}`,
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSTTFilter('all');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">녹음 목록</h1>
        <p className="text-gray-500 mt-1">
          전체 {filteredRecordings.length}개의 녹음
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="프로그램 이름으로 검색..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as RecordingStatus | 'all');
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="녹음 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 상태</SelectItem>
            <SelectItem value="completed">완료</SelectItem>
            <SelectItem value="recording">녹음중</SelectItem>
            <SelectItem value="failed">실패</SelectItem>
            <SelectItem value="pending">대기중</SelectItem>
          </SelectContent>
        </Select>

        {/* STT Filter */}
        <Select
          value={sttFilter}
          onValueChange={(value) => {
            setSTTFilter(value as STTStatus | 'all');
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="STT 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 STT 상태</SelectItem>
            <SelectItem value="completed">완료</SelectItem>
            <SelectItem value="processing">처리중</SelectItem>
            <SelectItem value="failed">실패</SelectItem>
            <SelectItem value="none">없음</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset Button */}
        <Button variant="outline" onClick={handleResetFilters}>
          <Filter className="w-4 h-4 mr-2" />
          초기화
        </Button>
      </div>

      {/* Recording List */}
      <div className="space-y-4">
        {paginatedRecordings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">검색 결과가 없습니다</p>
          </div>
        ) : (
          paginatedRecordings.map((recording) => (
            <RecordingCard
              key={recording.id}
              recording={recording}
              onDownload={handleDownload}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {filteredRecordings.length}개 중 {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, filteredRecordings.length)}개 표시
          </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              이전
            </Button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                )
                .map((page, index, array) => (
                  <div key={page} className="flex items-center">
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="px-2 text-gray-400">...</span>
                    )}
                    <Button
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  </div>
                ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

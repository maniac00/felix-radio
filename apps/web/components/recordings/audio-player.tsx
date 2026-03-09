'use client';

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

export interface AudioPlayerRef {
  seekTo: (seconds: number) => void;
}

interface AudioPlayerProps {
  src: string;
  title: string;
}

export const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(
  function AudioPlayer({ src, title }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = seconds;
        setCurrentTime(seconds);
        if (!isPlaying) {
          audio.play();
          setIsPlaying(true);
        }
      },
    }));

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const updateTime = () => setCurrentTime(audio.currentTime);
      const updateDuration = () => setDuration(audio.duration);
      const handleEnded = () => setIsPlaying(false);

      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleEnded);
      };
    }, []);

    const togglePlay = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      setIsPlaying(!isPlaying);
    };

    const handleSeek = (value: number[]) => {
      const audio = audioRef.current;
      if (!audio) return;

      audio.currentTime = value[0];
      setCurrentTime(value[0]);
    };

    const handleVolumeChange = (value: number[]) => {
      const audio = audioRef.current;
      if (!audio) return;

      const newVolume = value[0];
      audio.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (isMuted) {
        audio.volume = volume || 0.5;
        setIsMuted(false);
      } else {
        audio.volume = 0;
        setIsMuted(true);
      }
    };

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <audio ref={audioRef} src={src} preload="metadata" />

        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>

          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatDuration(Math.floor(currentTime))}</span>
              <span>{formatDuration(Math.floor(duration))}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="default"
              size="lg"
              onClick={togglePlay}
              className="rounded-full w-12 h-12 p-0"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>

            <div className="flex items-center space-x-2 flex-1 max-w-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="p-2"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

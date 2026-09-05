"use client";

import { useRef, useState, useEffect } from 'react';

interface VideoPlayerProps {
  src: string;       // blob URL of decrypted video
  filename: string;
  viewOnly?: boolean;
}

export default function VideoPlayer({ src, filename, viewOnly = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = parseFloat(e.target.value);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const v = parseFloat(e.target.value);
    video.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement?.parentElement;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      container.requestFullscreen();
      setIsFullscreen(true);
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full w-full" style={{ background: '#000' }}>
      {/* Video area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden cursor-pointer"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={src}
          className="max-w-full max-h-full object-contain"
          playsInline
          onContextMenu={viewOnly ? (e) => e.preventDefault() : undefined}
        />
        {/* Play overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'var(--phantom-glow)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className="px-4 py-3 space-y-2"
        style={{ background: 'var(--phantom-surface)' }}
      >
        {/* Seek bar */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={seek}
          step={0.1}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: 'var(--phantom-glow)', background: 'var(--phantom-border)' }}
          aria-label="Seek"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1 transition-colors hover:opacity-80"
              style={{ color: 'var(--phantom-text)' }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,3 20,12 6,21" />
                </svg>
              )}
            </button>

            {/* Volume */}
            <button
              onClick={toggleMute}
              className="p-1 transition-colors hover:opacity-80"
              style={{ color: 'var(--phantom-muted)' }}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                </svg>
              )}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={changeVolume}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'var(--phantom-glow)', background: 'var(--phantom-border)' }}
              aria-label="Volume"
            />

            {/* Time */}
            <span className="text-xs font-mono" style={{ color: 'var(--phantom-muted)' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs truncate max-w-[12rem]" style={{ color: 'var(--phantom-muted)' }}>
              {filename}
            </span>
            {!viewOnly && (
              <a
                href={src}
                download={filename}
                className="px-3 py-1 rounded text-xs font-medium transition-colors"
                style={{ background: 'var(--phantom-glow)', color: '#fff' }}
              >
                Download
              </a>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-1 transition-colors hover:opacity-80"
              style={{ color: 'var(--phantom-muted)' }}
              aria-label="Fullscreen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,3 21,3 21,9" />
                <polyline points="9,21 3,21 3,15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {viewOnly && (
        <div
          className="text-center py-2 text-xs font-medium"
          style={{ background: 'var(--phantom-danger)', color: '#fff' }}
        >
          🔥 View Only — Downloads disabled. This file will be destroyed after this session.
        </div>
      )}
    </div>
  );
}

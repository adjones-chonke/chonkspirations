'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { GalleryItem } from '@/lib/gdrive';

const GRID_SIZES =
  '(min-width: 1281px) 25vw, (min-width: 901px) 33vw, (min-width: 541px) 50vw, 100vw';

interface GalleryCardProps {
  item: GalleryItem;
  isGlobalPlaying: boolean;
  isGlobalMuted: boolean;
  globalSpeed: number;
  onOpenLightbox: (src: string, title: string) => void;
  priority?: boolean;
}

export default function GalleryCard({
  item,
  isGlobalPlaying,
  isGlobalMuted,
  globalSpeed,
  onOpenLightbox,
  priority = false,
}: GalleryCardProps) {
  const defaultTab = item.video_src ? 'video' : item.static_src ? 'static' : 'params';
  const [activeTab, setActiveTab] = useState<'video' | 'static' | 'params'>(defaultTab);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // A per-card mute choice holds only until the global toggle moves, at which
  // point the card falls back to following it.
  const [muteOverride, setMuteOverride] = useState<{
    global: boolean;
    muted: boolean;
  } | null>(null);
  const videoMuted =
    muteOverride?.global === isGlobalMuted ? muteOverride.muted : isGlobalMuted;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = globalSpeed;
    }
  }, [globalSpeed]);

  useEffect(() => {
    if (videoRef.current && activeTab === 'video') {
      if (isGlobalPlaying && isVisible) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isGlobalPlaying, activeTab, isVisible]);

  // The <video> element only reports "format error", so ask the proxy what
  // actually went wrong before telling the user.
  const explainFailure = () => {
    fetch(item.video_src, { headers: { Range: 'bytes=0-0' } })
      .then((res) => {
        // Drive's throttle surfaces as either 403 or 429 depending on the
        // request shape, so do not try to tell it apart from a sharing problem.
        if (res.status === 429 || res.status === 403) {
          return 'Google Drive is limiting requests. Wait a minute, then tap to retry.';
        }
        if (res.status === 404) return 'This video is missing from Drive.';
        return 'Could not load video. Tap to retry.';
      })
      .catch(() => 'Could not load video. Tap to retry.')
      .then(setLoadError);
  };

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      setLoadError(null);
      videoRef.current.play().catch(explainFailure);
    } else {
      videoRef.current.pause();
    }
  };

  const toggleLocalMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMuteOverride({ global: isGlobalMuted, muted: !videoMuted });
  };

  const getActiveImageSrc = () => {
    if (activeTab === 'params' && item.params_src) return item.params_src;
    return item.static_src || item.params_src;
  };

  return (
    <div className="card" data-id={item.id}>
      <div className="card-header">
        <div className="card-title" title={item.title}>
          <span>{item.title}</span>
        </div>
        <button
          className="icon-btn"
          title="Expand Lightbox"
          onClick={() => {
            const src = getActiveImageSrc();
            if (src) onOpenLightbox(src, item.title);
          }}
        >
          🔍
        </button>
      </div>

      <div className="media-container" ref={containerRef}>
        {activeTab === 'video' ? (
          item.video_src ? (
            <>
              <video
                ref={videoRef}
                src={item.video_src}
                className="media-element"
                preload="none"
                loop
                muted={videoMuted}
                playsInline
                onClick={toggleVideoPlay}
                onPlaying={() => {
                  setHasPlayed(true);
                  setLoadError(null);
                }}
                onError={explainFailure}
                style={{ cursor: 'pointer' }}
              />
              {!hasPlayed && item.static_src && (
                <Image
                  src={item.static_src}
                  alt=""
                  fill
                  sizes={GRID_SIZES}
                  priority={priority}
                  className="poster-overlay"
                  onClick={toggleVideoPlay}
                />
              )}
              {loadError && <div className="media-notice">{loadError}</div>}
              <div className="media-overlay">
                <button
                  className="icon-btn"
                  title="Toggle Mute"
                  onClick={toggleLocalMute}
                >
                  {videoMuted ? '🔇' : '🔊'}
                </button>
              </div>
            </>
          ) : (
            <div className="no-asset">No video available</div>
          )
        ) : activeTab === 'static' ? (
          item.static_src ? (
            <Image
              src={item.static_src}
              className="media-element"
              alt="Static Image"
              fill
              sizes={GRID_SIZES}
              onClick={() => onOpenLightbox(item.static_src, item.title)}
              style={{ cursor: 'zoom-in' }}
            />
          ) : (
            <div className="no-asset">No static image available</div>
          )
        ) : item.params_src ? (
          <Image
            src={item.params_src}
            className="media-element"
            alt="Params PNG"
            fill
            sizes={GRID_SIZES}
            onClick={() => onOpenLightbox(item.params_src, item.title)}
            style={{ cursor: 'zoom-in' }}
          />
        ) : (
          <div className="no-asset">No parameters image available</div>
        )}
      </div>

      <div className="card-tabs">
        <button
          className={`tab-btn video-tab ${activeTab === 'video' ? 'active' : ''}`}
          onClick={() => setActiveTab('video')}
        >
          🎬 Video
        </button>
        <button
          className={`tab-btn ${activeTab === 'static' ? 'active' : ''}`}
          onClick={() => setActiveTab('static')}
        >
          🖼️ Image
        </button>
        <button
          className={`tab-btn ${activeTab === 'params' ? 'active' : ''}`}
          onClick={() => setActiveTab('params')}
        >
          ⚙️ Params
        </button>
      </div>
    </div>
  );
}

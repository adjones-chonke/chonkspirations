'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GalleryItem } from '@/lib/gdrive';

interface GalleryCardProps {
  item: GalleryItem;
  isGlobalPlaying: boolean;
  isGlobalMuted: boolean;
  globalSpeed: number;
  onOpenLightbox: (src: string, title: string) => void;
}

export default function GalleryCard({
  item,
  isGlobalPlaying,
  isGlobalMuted,
  globalSpeed,
  onOpenLightbox,
}: GalleryCardProps) {
  const defaultTab = item.video_src ? 'video' : item.static_src ? 'static' : 'params';
  const [activeTab, setActiveTab] = useState<'video' | 'static' | 'params'>(defaultTab);
  const [videoMuted, setVideoMuted] = useState(isGlobalMuted);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setVideoMuted(isGlobalMuted);
  }, [isGlobalMuted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = globalSpeed;
    }
  }, [globalSpeed]);

  useEffect(() => {
    if (videoRef.current && activeTab === 'video') {
      if (isGlobalPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isGlobalPlaying, activeTab]);

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const toggleLocalMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setVideoMuted(nextMuted);
    }
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

      <div className="media-container">
        {activeTab === 'video' ? (
          item.video_src ? (
            <>
              <video
                ref={videoRef}
                src={item.video_src}
                className="media-element"
                autoPlay
                loop
                muted={videoMuted}
                playsInline
                onClick={toggleVideoPlay}
                style={{ cursor: 'pointer' }}
              />
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
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.static_src}
              className="media-element"
              alt="Static Image"
              onClick={() => onOpenLightbox(item.static_src, item.title)}
              style={{ cursor: 'zoom-in' }}
            />
          ) : (
            <div className="no-asset">No static image available</div>
          )
        ) : item.params_src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.params_src}
            className="media-element"
            alt="Params PNG"
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

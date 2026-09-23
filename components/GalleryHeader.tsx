'use client';

import React from 'react';

interface GalleryHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isGlobalPlaying: boolean;
  onToggleGlobalPlay: () => void;
  isGlobalMuted: boolean;
  onToggleGlobalMute: () => void;
  globalSpeed: number;
  onSpeedChange: (speed: number) => void;
  gridCols: number;
  onColsChange: (cols: number) => void;
  itemCount: number;
  isLive: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function GalleryHeader({
  searchQuery,
  onSearchChange,
  isGlobalPlaying,
  onToggleGlobalPlay,
  isGlobalMuted,
  onToggleGlobalMute,
  globalSpeed,
  onSpeedChange,
  gridCols,
  onColsChange,
  itemCount,
  isLive,
  isLoading,
  onRefresh,
}: GalleryHeaderProps) {
  return (
    <header>
      <div className="brand">
        <h1>Chonk Gallery</h1>
        <span className={`badge ${isLive ? 'badge-live' : ''}`}>
          {isLive ? '🟢 Google Drive Live' : '📁 Google Drive'} ({itemCount})
        </span>
      </div>

      <div className="toolbar">
        <div className="input-group">
          <svg viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search chonk..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <button className="btn" onClick={onToggleGlobalPlay}>
          <span>{isGlobalPlaying ? '⏸' : '▶'}</span> Global Play
        </button>

        <button className="btn" onClick={onToggleGlobalMute}>
          <span>{isGlobalMuted ? '🔇' : '🔊'}</span> Mute All
        </button>

        <button className="btn" onClick={onRefresh} disabled={isLoading}>
          <span>{isLoading ? '⏳' : '🔄'}</span> Sync
        </button>

        <select
          className="select-custom"
          value={globalSpeed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
        >
          <option value={0.5}>0.5x Speed</option>
          <option value={0.75}>0.75x Speed</option>
          <option value={1}>1.0x Speed</option>
          <option value={1.25}>1.25x Speed</option>
          <option value={1.5}>1.5x Speed</option>
          <option value={2}>2.0x Speed</option>
        </select>

        <select
          className="select-custom"
          value={gridCols}
          onChange={(e) => onColsChange(parseInt(e.target.value, 10))}
        >
          <option value={2}>2 Columns</option>
          <option value={3}>3 Columns</option>
          <option value={4}>4 Columns</option>
          <option value={5}>5 Columns</option>
          <option value={6}>6 Columns</option>
        </select>
      </div>
    </header>
  );
}

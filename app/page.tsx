'use client';

import React, { useState, useEffect } from 'react';
import GalleryHeader from '@/components/GalleryHeader';
import GalleryCard from '@/components/GalleryCard';
import LightboxModal from '@/components/LightboxModal';
import { GalleryItem } from '@/lib/gdrive';

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  // Toolbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [isGlobalPlaying, setIsGlobalPlaying] = useState(false);
  const [isGlobalMuted, setIsGlobalMuted] = useState(false);
  const [globalSpeed, setGlobalSpeed] = useState(1.0);
  const [gridCols, setGridCols] = useState(4);

  // Lightbox state
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    src: string;
    title: string;
  }>({
    isOpen: false,
    src: '',
    title: '',
  });

  const loadGallery = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setIsLive(data.isLive || false);
      }
    } catch (err) {
      console.error('Failed to fetch gallery items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const openLightbox = (src: string, title: string) => {
    setLightboxState({ isOpen: true, src, title });
  };

  const closeLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <>
      <GalleryHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isGlobalPlaying={isGlobalPlaying}
        onToggleGlobalPlay={() => setIsGlobalPlaying((prev) => !prev)}
        isGlobalMuted={isGlobalMuted}
        onToggleGlobalMute={() => setIsGlobalMuted((prev) => !prev)}
        globalSpeed={globalSpeed}
        onSpeedChange={setGlobalSpeed}
        gridCols={gridCols}
        onColsChange={setGridCols}
        itemCount={filteredItems.length}
        isLive={isLive}
        isLoading={loading}
        onRefresh={loadGallery}
      />

      <main>
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem',
              color: 'var(--text-muted)',
            }}
          >
            Syncing with Google Drive...
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem',
              color: 'var(--text-muted)',
            }}
          >
            No items found. Drop folders into your Google Drive workspace to get started!
          </div>
        ) : (
          <div
            className="gallery-grid"
            style={{ '--cols': gridCols } as React.CSSProperties}
          >
            {filteredItems.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isGlobalPlaying={isGlobalPlaying}
                isGlobalMuted={isGlobalMuted}
                globalSpeed={globalSpeed}
                onOpenLightbox={openLightbox}
              />
            ))}
          </div>
        )}
      </main>

      <LightboxModal
        isOpen={lightboxState.isOpen}
        src={lightboxState.src}
        title={lightboxState.title}
        onClose={closeLightbox}
      />
    </>
  );
}

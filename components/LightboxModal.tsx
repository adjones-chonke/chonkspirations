'use client';

import React, { useEffect } from 'react';

interface LightboxModalProps {
  isOpen: boolean;
  src: string;
  title: string;
  onClose: () => void;
}

export default function LightboxModal({ isOpen, src, title, onClose }: LightboxModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-header" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.1rem' }}>{title} - Asset Lightbox</h2>
        <button className="btn" onClick={onClose}>
          ✕ Close
        </button>
      </div>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        {src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} className="lightbox-img" alt="Lightbox Asset" />
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>
            No image asset available to preview in lightbox
          </div>
        )}
      </div>
    </div>
  );
}

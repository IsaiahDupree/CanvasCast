'use client';

import { useRef } from 'react';
import { Download, Maximize } from 'lucide-react';
import { clsx } from 'clsx';

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  className?: string;
}

export function VideoPlayer({ videoUrl, title, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFullscreen = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.requestFullscreen();
      } catch (error) {
        console.error('Failed to enter fullscreen:', error);
      }
    }
  };

  // Sanitize title for download filename
  const downloadFilename = `${title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')}.mp4`;

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Video Element */}
      <div className="relative rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          preload="metadata"
          aria-label={`Video player for ${title}`}
          className="w-full aspect-video"
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        {/* Download Button */}
        <a
          href={videoUrl}
          download={downloadFilename}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1"
        >
          <button
            type="button"
            className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition flex items-center justify-center gap-2"
            aria-label="Download video"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </a>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={handleFullscreen}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition flex items-center justify-center gap-2"
          aria-label="Fullscreen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

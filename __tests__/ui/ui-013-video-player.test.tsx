/**
 * VideoPlayer Component Tests - UI-013
 *
 * This test file validates the VideoPlayer Component requirements:
 * 1. Plays MP4 video files
 * 2. Download button for video
 * 3. Fullscreen capability
 *
 * Acceptance Criteria:
 * - Plays MP4
 * - Download button
 * - Fullscreen
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Make React globally available for JSX transform
globalThis.React = React;

// Don't mock lucide-react - use actual icons for real SVG rendering

// Import component after mocks
import { VideoPlayer } from '@/components/video-player';

describe('UI-013: VideoPlayer Component', () => {
  const mockVideoUrl = 'https://example.com/test-video.mp4';
  const mockTitle = 'Test Video';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock HTMLMediaElement methods
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();

    // Mock requestFullscreen
    HTMLVideoElement.prototype.requestFullscreen = vi.fn(() => Promise.resolve());
  });

  describe('Acceptance Criteria: Plays MP4', () => {
    it('should render video element with correct src', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const video = container.querySelector('video');
      expect(video).toBeDefined();
      expect(video?.getAttribute('src')).toBe(mockVideoUrl);
    });

    it('should have video controls enabled', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const video = container.querySelector('video');
      expect(video?.hasAttribute('controls')).toBe(true);
    });

    it('should set video type to mp4', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const source = container.querySelector('source');
      expect(source?.getAttribute('type')).toBe('video/mp4');
    });

    it('should preload video metadata', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const video = container.querySelector('video');
      expect(video?.getAttribute('preload')).toBe('metadata');
    });

    it('should have appropriate video class names', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const video = container.querySelector('video');
      expect(video?.className).toContain('w-full');
    });
  });

  describe('Acceptance Criteria: Download button', () => {
    it('should render download button', () => {
      render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).toBeDefined();
    });

    it('should render download icon', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      // Check for lucide Download icon SVG
      const icon = container.querySelector('svg.lucide-download');
      expect(icon).toBeDefined();
    });

    it('should have download link with correct href', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const downloadLink = container.querySelector('a[download]');
      expect(downloadLink).toBeDefined();
      expect(downloadLink?.getAttribute('href')).toBe(mockVideoUrl);
    });

    it('should set download attribute with title', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const downloadLink = container.querySelector('a[download]');
      expect(downloadLink?.getAttribute('download')).toContain('Test-Video');
    });

    it('should open link in new tab', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const downloadLink = container.querySelector('a[download]');
      expect(downloadLink?.getAttribute('target')).toBe('_blank');
      expect(downloadLink?.getAttribute('rel')).toContain('noopener');
      expect(downloadLink?.getAttribute('rel')).toContain('noreferrer');
    });
  });

  describe('Acceptance Criteria: Fullscreen', () => {
    it('should render fullscreen button', () => {
      render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });
      expect(fullscreenButton).toBeDefined();
    });

    it('should render maximize icon', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      // Check for lucide Maximize icon SVG
      const icon = container.querySelector('svg.lucide-maximize');
      expect(icon).toBeDefined();
    });

    it('should call requestFullscreen when fullscreen button is clicked', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });
      const video = container.querySelector('video');

      fireEvent.click(fullscreenButton);

      expect(video?.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('should handle fullscreen error gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      HTMLVideoElement.prototype.requestFullscreen = vi.fn(() => Promise.reject(new Error('Fullscreen failed')));

      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);
      const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });

      fireEvent.click(fullscreenButton);

      // Component should not crash
      expect(() => fireEvent.click(fullscreenButton)).not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Component Structure', () => {
    it('should render container with proper styling', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const wrapper = container.firstChild;
      expect(wrapper).toBeDefined();
    });

    it('should render video and controls together', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const video = container.querySelector('video');
      const downloadButton = screen.getByRole('button', { name: /download/i });
      const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });

      expect(video).toBeDefined();
      expect(downloadButton).toBeDefined();
      expect(fullscreenButton).toBeDefined();
    });

    it('should render controls in a flex container', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const controlsContainer = container.querySelector('.flex.gap-2');
      expect(controlsContainer).toBeDefined();
    });
  });

  describe('Props Handling', () => {
    it('should handle different video URLs', () => {
      const urls = [
        'https://example.com/video1.mp4',
        'https://cdn.example.com/video2.mp4',
        'https://storage.example.com/path/to/video3.mp4',
      ];

      urls.forEach((url) => {
        const { container, unmount } = render(<VideoPlayer videoUrl={url} title="Test" />);

        const video = container.querySelector('video');
        expect(video?.getAttribute('src')).toBe(url);

        unmount();
      });
    });

    it('should handle different titles', () => {
      const titles = ['My Video', 'Test Project 123', 'Final Export'];

      titles.forEach((title) => {
        const { container, unmount } = render(<VideoPlayer videoUrl={mockVideoUrl} title={title} />);

        const downloadLink = container.querySelector('a[download]');
        expect(downloadLink?.getAttribute('download')).toContain(title.replace(/\s+/g, '-'));

        unmount();
      });
    });

    it('should handle optional className prop', () => {
      const customClass = 'my-custom-class';
      const { container } = render(
        <VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} className={customClass} />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain(customClass);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible video element', () => {
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const video = container.querySelector('video');
      expect(video?.getAttribute('aria-label')).toBeTruthy();
    });

    it('should have accessible download button', () => {
      render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).toBeDefined();
    });

    it('should have accessible fullscreen button', () => {
      render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />);

      const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i });
      expect(fullscreenButton).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty video URL gracefully', () => {
      const { container } = render(<VideoPlayer videoUrl="" title={mockTitle} />);

      const video = container.querySelector('video');
      expect(video).toBeDefined();
    });

    it('should handle special characters in title', () => {
      const specialTitle = 'My Video: Test & Demo #1';
      const { container } = render(<VideoPlayer videoUrl={mockVideoUrl} title={specialTitle} />);

      const downloadLink = container.querySelector('a[download]');
      expect(downloadLink?.getAttribute('download')).toBeDefined();
    });

    it('should not crash without optional props', () => {
      expect(() => render(<VideoPlayer videoUrl={mockVideoUrl} title={mockTitle} />)).not.toThrow();
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker } from '../../src/services/cost-tracker';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker('job-123', 'user-456');
  });

  describe('trackOpenAICompletion', () => {
    it('should calculate cost for GPT-4 completion', () => {
      const cost = tracker.trackOpenAICompletion('gpt-4o', 1000, 500);

      expect(cost).toBeGreaterThan(0);
      expect(tracker.getTotalCost()).toBeGreaterThan(0);
      expect(tracker.getCosts()).toHaveLength(1);
      expect(tracker.getCosts()[0].service).toBe('openai');
      expect(tracker.getCosts()[0].operation).toBe('completion');
    });

    it('should calculate cost for GPT-3.5 completion', () => {
      const cost = tracker.trackOpenAICompletion('gpt-3.5-turbo', 1000, 500);

      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(tracker.trackOpenAICompletion('gpt-4o', 1000, 500));
    });
  });

  describe('trackOpenAITTS', () => {
    it('should calculate cost for TTS generation', () => {
      const characters = 5000;
      const cost = tracker.trackOpenAITTS('tts-1', characters);

      expect(cost).toBeGreaterThan(0);
      expect(tracker.getTotalCost()).toBeGreaterThan(0);
      expect(tracker.getCosts()[0].service).toBe('openai');
      expect(tracker.getCosts()[0].operation).toBe('tts');
    });

    it('should calculate HD TTS cost correctly', () => {
      const characters = 5000;
      const hdCost = tracker.trackOpenAITTS('tts-1-hd', characters);
      const standardCost = tracker.trackOpenAITTS('tts-1', characters);

      expect(hdCost).toBeGreaterThan(standardCost);
    });
  });

  describe('trackOpenAIWhisper', () => {
    it('should calculate cost for Whisper transcription', () => {
      const durationSeconds = 120; // 2 minutes
      const cost = tracker.trackOpenAIWhisper('whisper-1', durationSeconds);

      expect(cost).toBeGreaterThan(0);
      expect(tracker.getCosts()[0].service).toBe('openai');
      expect(tracker.getCosts()[0].operation).toBe('whisper');
    });
  });

  describe('trackGeminiImage', () => {
    it('should calculate cost for Gemini image generation', () => {
      const cost = tracker.trackGeminiImage('imagen-3.0-generate-001', 1);

      expect(cost).toBeGreaterThan(0);
      expect(tracker.getCosts()[0].service).toBe('gemini');
      expect(tracker.getCosts()[0].operation).toBe('image');
    });

    it('should track multiple images', () => {
      const imageCount = 10;
      const cost = tracker.trackGeminiImage('imagen-3.0-generate-001', imageCount);

      expect(cost).toBeGreaterThan(0);
      expect(tracker.getCosts()[0].meta?.imageCount).toBe(imageCount);
    });
  });

  describe('trackStorageUpload', () => {
    it('should calculate cost for storage upload', () => {
      const sizeBytes = 50 * 1024 * 1024; // 50 MB
      const cost = tracker.trackStorageUpload(sizeBytes);

      expect(cost).toBeGreaterThan(0);
      expect(tracker.getCosts()[0].service).toBe('storage');
      expect(tracker.getCosts()[0].operation).toBe('upload');
    });
  });

  describe('getTotalCost', () => {
    it('should sum all tracked costs', () => {
      tracker.trackOpenAICompletion('gpt-4o', 1000, 500);
      tracker.trackOpenAITTS('tts-1', 5000);
      tracker.trackGeminiImage('imagen-3.0-generate-001', 5);

      const total = tracker.getTotalCost();
      expect(total).toBeGreaterThan(0);
      expect(tracker.getCosts()).toHaveLength(3);
    });
  });

  describe('getCostsByService', () => {
    it('should group costs by service', () => {
      tracker.trackOpenAICompletion('gpt-4o', 1000, 500);
      tracker.trackOpenAITTS('tts-1', 5000);
      tracker.trackOpenAIWhisper('whisper-1', 120);
      tracker.trackGeminiImage('imagen-3.0-generate-001', 5);

      const byService = tracker.getCostsByService();

      expect(byService.openai).toBeDefined();
      expect(byService.gemini).toBeDefined();
      expect(byService.openai.length).toBe(3);
      expect(byService.gemini.length).toBe(1);
    });
  });

  describe('getSummary', () => {
    it('should return a cost summary', () => {
      tracker.trackOpenAICompletion('gpt-4o', 1000, 500);
      tracker.trackOpenAITTS('tts-1', 5000);
      tracker.trackGeminiImage('imagen-3.0-generate-001', 5);

      const summary = tracker.getSummary();

      expect(summary.totalCost).toBeGreaterThan(0);
      expect(summary.jobId).toBe('job-123');
      expect(summary.userId).toBe('user-456');
      expect(summary.breakdown).toBeDefined();
      expect(summary.breakdown.openai).toBeGreaterThan(0);
      expect(summary.breakdown.gemini).toBeGreaterThan(0);
    });
  });
});

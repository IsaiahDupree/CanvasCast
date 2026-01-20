/**
 * Cost Tracking Service (ANALYTICS-004)
 *
 * Tracks API costs per job for cost analysis and optimization.
 * Supports OpenAI, Gemini, and Storage services.
 *
 * Usage:
 *   const tracker = new CostTracker(jobId, userId);
 *   tracker.trackOpenAICompletion('gpt-4o', 1000, 500);
 *   const summary = tracker.getSummary();
 *   await tracker.saveToDB();
 */

import { createAdminSupabase } from '../lib/supabase';

const supabase = createAdminSupabase();

// ============================================
// PRICING CONSTANTS (as of Jan 2026)
// ============================================

// OpenAI Pricing (per 1M tokens)
const OPENAI_PRICING = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
} as const;

// OpenAI TTS Pricing (per 1M characters)
const OPENAI_TTS_PRICING = {
  'tts-1': 15.00,      // Standard quality
  'tts-1-hd': 30.00,   // HD quality
} as const;

// OpenAI Whisper Pricing (per minute)
const OPENAI_WHISPER_PRICING = {
  'whisper-1': 0.006,  // $0.006 per minute
} as const;

// Gemini Image Generation Pricing (per image)
const GEMINI_IMAGE_PRICING = {
  'imagen-3.0-generate-001': 0.040,  // $0.04 per image
  'imagen-3.0-fast-generate-001': 0.020,  // $0.02 per image
} as const;

// Storage Pricing (Supabase/S3 approximate)
const STORAGE_PRICING = {
  upload: 0.000005,  // ~$0.005 per GB uploaded
  storage: 0.000021, // ~$0.021 per GB-month stored
  bandwidth: 0.000090, // ~$0.09 per GB transferred
} as const;

// ============================================
// TYPES
// ============================================

export interface ApiCost {
  service: 'openai' | 'gemini' | 'storage';
  operation: string;
  costUsd: number;
  meta?: Record<string, any>;
  timestamp: Date;
}

export interface CostSummary {
  jobId: string;
  userId: string;
  totalCost: number;
  breakdown: {
    openai: number;
    gemini: number;
    storage: number;
  };
  costs: ApiCost[];
  timestamp: Date;
}

// ============================================
// COST TRACKER CLASS
// ============================================

export class CostTracker {
  private jobId: string;
  private userId: string;
  private costs: ApiCost[] = [];

  constructor(jobId: string, userId: string) {
    this.jobId = jobId;
    this.userId = userId;
  }

  /**
   * Track OpenAI completion cost (GPT models)
   */
  trackOpenAICompletion(
    model: keyof typeof OPENAI_PRICING,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = OPENAI_PRICING[model];
    if (!pricing) {
      console.warn(`[CostTracker] Unknown OpenAI model: ${model}`);
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    this.costs.push({
      service: 'openai',
      operation: 'completion',
      costUsd: totalCost,
      meta: {
        model,
        inputTokens,
        outputTokens,
        inputCost,
        outputCost,
      },
      timestamp: new Date(),
    });

    return totalCost;
  }

  /**
   * Track OpenAI TTS cost
   */
  trackOpenAITTS(
    model: keyof typeof OPENAI_TTS_PRICING,
    characters: number
  ): number {
    const pricePerMillion = OPENAI_TTS_PRICING[model];
    if (!pricePerMillion) {
      console.warn(`[CostTracker] Unknown OpenAI TTS model: ${model}`);
      return 0;
    }

    const cost = (characters / 1_000_000) * pricePerMillion;

    this.costs.push({
      service: 'openai',
      operation: 'tts',
      costUsd: cost,
      meta: {
        model,
        characters,
      },
      timestamp: new Date(),
    });

    return cost;
  }

  /**
   * Track OpenAI Whisper cost
   */
  trackOpenAIWhisper(
    model: keyof typeof OPENAI_WHISPER_PRICING,
    durationSeconds: number
  ): number {
    const pricePerMinute = OPENAI_WHISPER_PRICING[model];
    if (!pricePerMinute) {
      console.warn(`[CostTracker] Unknown OpenAI Whisper model: ${model}`);
      return 0;
    }

    const durationMinutes = durationSeconds / 60;
    const cost = durationMinutes * pricePerMinute;

    this.costs.push({
      service: 'openai',
      operation: 'whisper',
      costUsd: cost,
      meta: {
        model,
        durationSeconds,
        durationMinutes,
      },
      timestamp: new Date(),
    });

    return cost;
  }

  /**
   * Track Gemini image generation cost
   */
  trackGeminiImage(
    model: keyof typeof GEMINI_IMAGE_PRICING,
    imageCount: number = 1
  ): number {
    const pricePerImage = GEMINI_IMAGE_PRICING[model];
    if (!pricePerImage) {
      console.warn(`[CostTracker] Unknown Gemini model: ${model}`);
      return 0;
    }

    const cost = imageCount * pricePerImage;

    this.costs.push({
      service: 'gemini',
      operation: 'image',
      costUsd: cost,
      meta: {
        model,
        imageCount,
        pricePerImage,
      },
      timestamp: new Date(),
    });

    return cost;
  }

  /**
   * Track storage upload cost
   */
  trackStorageUpload(sizeBytes: number): number {
    const sizeGB = sizeBytes / (1024 * 1024 * 1024);
    const cost = sizeGB * STORAGE_PRICING.upload;

    this.costs.push({
      service: 'storage',
      operation: 'upload',
      costUsd: cost,
      meta: {
        sizeBytes,
        sizeGB,
      },
      timestamp: new Date(),
    });

    return cost;
  }

  /**
   * Track storage bandwidth cost
   */
  trackStorageBandwidth(sizeBytes: number): number {
    const sizeGB = sizeBytes / (1024 * 1024 * 1024);
    const cost = sizeGB * STORAGE_PRICING.bandwidth;

    this.costs.push({
      service: 'storage',
      operation: 'bandwidth',
      costUsd: cost,
      meta: {
        sizeBytes,
        sizeGB,
      },
      timestamp: new Date(),
    });

    return cost;
  }

  /**
   * Get total cost across all services
   */
  getTotalCost(): number {
    return this.costs.reduce((sum, cost) => sum + cost.costUsd, 0);
  }

  /**
   * Get all tracked costs
   */
  getCosts(): ApiCost[] {
    return [...this.costs];
  }

  /**
   * Get costs grouped by service
   */
  getCostsByService(): Record<string, ApiCost[]> {
    const grouped: Record<string, ApiCost[]> = {
      openai: [],
      gemini: [],
      storage: [],
    };

    for (const cost of this.costs) {
      grouped[cost.service].push(cost);
    }

    return grouped;
  }

  /**
   * Get cost summary
   */
  getSummary(): CostSummary {
    const breakdown = {
      openai: 0,
      gemini: 0,
      storage: 0,
    };

    for (const cost of this.costs) {
      breakdown[cost.service] += cost.costUsd;
    }

    return {
      jobId: this.jobId,
      userId: this.userId,
      totalCost: this.getTotalCost(),
      breakdown,
      costs: this.getCosts(),
      timestamp: new Date(),
    };
  }

  /**
   * Save all tracked costs to database
   */
  async saveToDB(): Promise<void> {
    if (this.costs.length === 0) {
      console.log('[CostTracker] No costs to save');
      return;
    }

    try {
      const rows = this.costs.map((cost) => ({
        job_id: this.jobId,
        user_id: this.userId,
        service: cost.service,
        operation: cost.operation,
        cost_usd: cost.costUsd,
        meta: cost.meta || {},
      }));

      const { error } = await supabase
        .from('job_costs')
        .insert(rows);

      if (error) {
        console.error('[CostTracker] Failed to save costs to DB:', error);
        throw error;
      }

      console.log(`[CostTracker] Saved ${this.costs.length} cost entries for job ${this.jobId}`);
    } catch (err) {
      console.error('[CostTracker] Error saving costs:', err);
      throw err;
    }
  }

  /**
   * Get cost summary from database for a job
   */
  static async getJobCosts(jobId: string): Promise<CostSummary | null> {
    try {
      const { data, error } = await supabase
        .from('job_costs')
        .select('*')
        .eq('job_id', jobId);

      if (error) {
        console.error('[CostTracker] Failed to fetch job costs:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const costs: ApiCost[] = data.map((row) => ({
        service: row.service as 'openai' | 'gemini' | 'storage',
        operation: row.operation,
        costUsd: parseFloat(row.cost_usd),
        meta: row.meta,
        timestamp: new Date(row.created_at),
      }));

      const breakdown = {
        openai: 0,
        gemini: 0,
        storage: 0,
      };

      for (const cost of costs) {
        breakdown[cost.service] += cost.costUsd;
      }

      const totalCost = costs.reduce((sum, cost) => sum + cost.costUsd, 0);

      return {
        jobId,
        userId: data[0].user_id,
        totalCost,
        breakdown,
        costs,
        timestamp: new Date(data[0].created_at),
      };
    } catch (err) {
      console.error('[CostTracker] Error fetching job costs:', err);
      return null;
    }
  }
}

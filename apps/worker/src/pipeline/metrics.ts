import { createClient } from "@supabase/supabase-js";
import type { JobStatus, JobErrorCode } from "@canvascast/shared";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// TYPES
// ============================================

export type StepStatus = "success" | "failed" | "skipped";

export interface StepMetric {
  step: JobStatus;
  status: StepStatus;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  error_code?: JobErrorCode;
  error_message?: string;
}

export interface MetricsData {
  job_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  total_duration_ms?: number;
  steps: StepMetric[];
  retry_attempt?: number;
  failure_category?: string;
}

// ============================================
// PIPELINE METRICS
// ============================================

export class PipelineMetrics {
  private jobId: string;
  private userId: string;
  private startedAt: Date;
  private endedAt?: Date;
  private steps: Map<JobStatus, StepMetric>;
  private currentStep?: JobStatus;
  private retryAttempt: number = 0;

  constructor(jobId: string, userId: string) {
    this.jobId = jobId;
    this.userId = userId;
    this.startedAt = new Date();
    this.steps = new Map();
  }

  /**
   * Mark the start of a pipeline step
   */
  startStep(step: JobStatus): void {
    const metric: StepMetric = {
      step,
      status: "success", // Will be updated on endStep
      started_at: new Date().toISOString(),
    };

    this.steps.set(step, metric);
    this.currentStep = step;
  }

  /**
   * Mark the end of a pipeline step
   */
  endStep(
    step: JobStatus,
    status: StepStatus,
    errorCode?: JobErrorCode,
    errorMessage?: string
  ): void {
    const metric = this.steps.get(step);
    if (!metric) {
      console.warn(`[Metrics] Step ${step} was never started`);
      return;
    }

    const endedAt = new Date();
    const startedAt = new Date(metric.started_at);
    const durationMs = endedAt.getTime() - startedAt.getTime();

    metric.status = status;
    metric.ended_at = endedAt.toISOString();
    metric.duration_ms = durationMs;

    if (status === "failed" && errorCode) {
      metric.error_code = errorCode;
      metric.error_message = errorMessage;
    }

    this.steps.set(step, metric);
    this.currentStep = undefined;
  }

  /**
   * Set the retry attempt number
   */
  setRetryAttempt(attempt: number): void {
    this.retryAttempt = attempt;
  }

  /**
   * Get all metrics data
   */
  getData(): MetricsData {
    const stepsArray = Array.from(this.steps.values());

    // Calculate total duration
    let totalDuration = 0;
    if (this.endedAt) {
      totalDuration = this.endedAt.getTime() - this.startedAt.getTime();
    } else if (stepsArray.length > 0) {
      // Sum up all step durations
      totalDuration = stepsArray.reduce((sum, step) => sum + (step.duration_ms || 0), 0);
    }

    // Determine failure category if any step failed
    const failedStep = stepsArray.find(s => s.status === "failed");
    const failureCategory = failedStep ? this.categorizeFailure(failedStep.error_code) : undefined;

    return {
      job_id: this.jobId,
      user_id: this.userId,
      started_at: this.startedAt.toISOString(),
      ended_at: this.endedAt?.toISOString(),
      total_duration_ms: totalDuration,
      steps: stepsArray,
      retry_attempt: this.retryAttempt || undefined,
      failure_category: failureCategory,
    };
  }

  /**
   * Categorize failure by error code
   */
  private categorizeFailure(errorCode?: JobErrorCode): string {
    if (!errorCode) return "unknown";

    // External API failures
    if (["ERR_TTS", "ERR_WHISPER", "ERR_IMAGE_GEN"].includes(errorCode)) {
      return "external_api";
    }

    // Generation failures
    if (["ERR_SCRIPT_GEN", "ERR_VISUAL_PLAN"].includes(errorCode)) {
      return "generation";
    }

    // Rendering failures
    if (["ERR_TIMELINE", "ERR_RENDER", "ERR_PACKAGING"].includes(errorCode)) {
      return "rendering";
    }

    // System failures
    if (["ERR_INPUT_FETCH", "ERR_CREDITS", "ERR_UNKNOWN"].includes(errorCode)) {
      return "system";
    }

    return "unknown";
  }

  /**
   * Save metrics to database
   */
  async save(): Promise<void> {
    const data = this.getData();

    try {
      const { error } = await supabase.from("pipeline_metrics").insert({
        job_id: data.job_id,
        user_id: data.user_id,
        started_at: data.started_at,
        ended_at: data.ended_at,
        total_duration_ms: data.total_duration_ms,
        steps: data.steps,
        retry_attempt: data.retry_attempt,
        failure_category: data.failure_category,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("[Metrics] Failed to save metrics:", error);
        // Don't throw - metrics failure shouldn't break the job
      } else {
        console.log(`[Metrics] Saved metrics for job ${this.jobId}`);
      }
    } catch (err) {
      console.error("[Metrics] Exception saving metrics:", err);
      // Don't throw - metrics failure shouldn't break the job
    }
  }

  /**
   * Mark the job as complete
   */
  markComplete(): void {
    this.endedAt = new Date();
  }
}

// ============================================
// METRICS AGGREGATION QUERIES
// ============================================

export interface StepStatsResult {
  step: JobStatus;
  total_runs: number;
  success_count: number;
  failed_count: number;
  success_rate: number;
  avg_duration_ms: number;
  median_duration_ms: number;
  p95_duration_ms: number;
}

export interface FailureReasonResult {
  error_code: string;
  count: number;
  percentage: number;
  failure_category: string;
}

/**
 * Get success rates and duration stats for each pipeline step
 */
export async function getStepStats(
  startDate?: Date,
  endDate?: Date
): Promise<StepStatsResult[]> {
  try {
    let query = supabase.from("pipeline_metrics").select("*");

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }
    if (endDate) {
      query = query.lte("created_at", endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    // Aggregate step statistics
    const stepMap = new Map<JobStatus, {
      durations: number[];
      successes: number;
      failures: number;
    }>();

    data?.forEach((metric: any) => {
      const steps = metric.steps as StepMetric[];
      steps.forEach((step) => {
        if (!stepMap.has(step.step)) {
          stepMap.set(step.step, { durations: [], successes: 0, failures: 0 });
        }

        const stats = stepMap.get(step.step)!;
        if (step.duration_ms) stats.durations.push(step.duration_ms);
        if (step.status === "success") stats.successes++;
        if (step.status === "failed") stats.failures++;
      });
    });

    // Calculate statistics
    const results: StepStatsResult[] = [];
    for (const [step, stats] of stepMap.entries()) {
      const totalRuns = stats.successes + stats.failures;
      const successRate = totalRuns > 0 ? (stats.successes / totalRuns) * 100 : 0;

      // Calculate duration stats
      const sortedDurations = stats.durations.sort((a, b) => a - b);
      const avgDuration = sortedDurations.length > 0
        ? sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length
        : 0;
      const medianDuration = sortedDurations.length > 0
        ? sortedDurations[Math.floor(sortedDurations.length / 2)]
        : 0;
      const p95Duration = sortedDurations.length > 0
        ? sortedDurations[Math.floor(sortedDurations.length * 0.95)]
        : 0;

      results.push({
        step,
        total_runs: totalRuns,
        success_count: stats.successes,
        failed_count: stats.failures,
        success_rate: Math.round(successRate * 100) / 100,
        avg_duration_ms: Math.round(avgDuration),
        median_duration_ms: Math.round(medianDuration),
        p95_duration_ms: Math.round(p95Duration),
      });
    }

    return results;
  } catch (err) {
    console.error("[Metrics] Failed to get step stats:", err);
    return [];
  }
}

/**
 * Get failure reasons categorized and counted
 */
export async function getFailureReasons(
  startDate?: Date,
  endDate?: Date
): Promise<FailureReasonResult[]> {
  try {
    let query = supabase.from("pipeline_metrics").select("*");

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }
    if (endDate) {
      query = query.lte("created_at", endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    // Count error codes
    const errorMap = new Map<string, {
      count: number;
      category: string;
    }>();

    let totalFailures = 0;

    data?.forEach((metric: any) => {
      const steps = metric.steps as StepMetric[];
      steps.forEach((step) => {
        if (step.status === "failed" && step.error_code) {
          totalFailures++;
          if (!errorMap.has(step.error_code)) {
            const category = metric.failure_category || "unknown";
            errorMap.set(step.error_code, { count: 0, category });
          }
          errorMap.get(step.error_code)!.count++;
        }
      });
    });

    // Calculate percentages
    const results: FailureReasonResult[] = [];
    for (const [errorCode, stats] of errorMap.entries()) {
      const percentage = totalFailures > 0
        ? (stats.count / totalFailures) * 100
        : 0;

      results.push({
        error_code: errorCode,
        count: stats.count,
        percentage: Math.round(percentage * 100) / 100,
        failure_category: stats.category,
      });
    }

    // Sort by count descending
    results.sort((a, b) => b.count - a.count);

    return results;
  } catch (err) {
    console.error("[Metrics] Failed to get failure reasons:", err);
    return [];
  }
}

/**
 * Get overall pipeline health summary
 */
export async function getPipelineHealth(
  startDate?: Date,
  endDate?: Date
): Promise<{
  total_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
  success_rate: number;
  avg_total_duration_ms: number;
  median_total_duration_ms: number;
}> {
  try {
    let query = supabase.from("pipeline_metrics").select("*");

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }
    if (endDate) {
      query = query.lte("created_at", endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    const totalJobs = data?.length || 0;
    let successfulJobs = 0;
    let failedJobs = 0;
    const durations: number[] = [];

    data?.forEach((metric: any) => {
      const hasFailure = (metric.steps as StepMetric[]).some(s => s.status === "failed");
      if (hasFailure) {
        failedJobs++;
      } else {
        successfulJobs++;
      }

      if (metric.total_duration_ms) {
        durations.push(metric.total_duration_ms);
      }
    });

    const sortedDurations = durations.sort((a, b) => a - b);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    const medianDuration = durations.length > 0
      ? sortedDurations[Math.floor(sortedDurations.length / 2)]
      : 0;

    return {
      total_jobs: totalJobs,
      successful_jobs: successfulJobs,
      failed_jobs: failedJobs,
      success_rate: totalJobs > 0 ? Math.round((successfulJobs / totalJobs) * 10000) / 100 : 0,
      avg_total_duration_ms: Math.round(avgDuration),
      median_total_duration_ms: Math.round(medianDuration),
    };
  } catch (err) {
    console.error("[Metrics] Failed to get pipeline health:", err);
    return {
      total_jobs: 0,
      successful_jobs: 0,
      failed_jobs: 0,
      success_rate: 0,
      avg_total_duration_ms: 0,
      median_total_duration_ms: 0,
    };
  }
}

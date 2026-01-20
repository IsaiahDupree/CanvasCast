import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/v1/metrics/pipeline-health
 * Get overall pipeline health metrics
 */
router.get("/pipeline-health", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const { data, error } = await supabase.rpc("get_pipeline_health", {
      p_start_date: startDate ? new Date(startDate as string).toISOString() : null,
      p_end_date: endDate ? new Date(endDate as string).toISOString() : null,
    });

    if (error) {
      console.error("[Metrics API] Error fetching pipeline health:", error);
      return res.status(500).json({ error: "Failed to fetch pipeline health" });
    }

    return res.json(data?.[0] || {
      total_jobs: 0,
      successful_jobs: 0,
      failed_jobs: 0,
      success_rate: 0,
      avg_total_duration_ms: 0,
      median_total_duration_ms: 0,
    });
  } catch (err) {
    console.error("[Metrics API] Exception in pipeline-health:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/metrics/step-statistics
 * Get success rates and durations for each pipeline step
 */
router.get("/step-statistics", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const { data, error } = await supabase.rpc("get_step_statistics", {
      p_start_date: startDate ? new Date(startDate as string).toISOString() : null,
      p_end_date: endDate ? new Date(endDate as string).toISOString() : null,
    });

    if (error) {
      console.error("[Metrics API] Error fetching step statistics:", error);
      return res.status(500).json({ error: "Failed to fetch step statistics" });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("[Metrics API] Exception in step-statistics:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/metrics/failure-reasons
 * Get categorized failure reasons with counts
 */
router.get("/failure-reasons", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const { data, error } = await supabase.rpc("get_failure_reasons", {
      p_start_date: startDate ? new Date(startDate as string).toISOString() : null,
      p_end_date: endDate ? new Date(endDate as string).toISOString() : null,
    });

    if (error) {
      console.error("[Metrics API] Error fetching failure reasons:", error);
      return res.status(500).json({ error: "Failed to fetch failure reasons" });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("[Metrics API] Exception in failure-reasons:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/metrics/dashboard
 * Get comprehensive metrics for admin dashboard
 */
router.get("/dashboard", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Fetch all metrics in parallel
    const [healthResult, statsResult, failuresResult] = await Promise.all([
      supabase.rpc("get_pipeline_health", {
        p_start_date: startDate ? new Date(startDate as string).toISOString() : null,
        p_end_date: endDate ? new Date(endDate as string).toISOString() : null,
      }),
      supabase.rpc("get_step_statistics", {
        p_start_date: startDate ? new Date(startDate as string).toISOString() : null,
        p_end_date: endDate ? new Date(endDate as string).toISOString() : null,
      }),
      supabase.rpc("get_failure_reasons", {
        p_start_date: startDate ? new Date(startDate as string).toISOString() : null,
        p_end_date: endDate ? new Date(endDate as string).toISOString() : null,
      }),
    ]);

    if (healthResult.error || statsResult.error || failuresResult.error) {
      console.error("[Metrics API] Error fetching dashboard data:", {
        health: healthResult.error,
        stats: statsResult.error,
        failures: failuresResult.error,
      });
      return res.status(500).json({ error: "Failed to fetch dashboard data" });
    }

    return res.json({
      health: healthResult.data?.[0] || {
        total_jobs: 0,
        successful_jobs: 0,
        failed_jobs: 0,
        success_rate: 0,
        avg_total_duration_ms: 0,
        median_total_duration_ms: 0,
      },
      steps: statsResult.data || [],
      failures: failuresResult.data || [],
    });
  } catch (err) {
    console.error("[Metrics API] Exception in dashboard:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

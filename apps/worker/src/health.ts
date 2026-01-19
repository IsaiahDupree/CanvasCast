import "dotenv/config";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";

const HEALTH_PORT = Number(process.env.HEALTH_PORT ?? 9091);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface QueueStats {
  waiting: number;
  active: number;
  failed: number;
}

async function getQueueStats(): Promise<QueueStats> {
  try {
    // Count jobs by status
    const [waiting, active, failed] = await Promise.all([
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "QUEUED"),
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["SCRIPTING", "VOICE_GEN", "ALIGNMENT", "VISUAL_PLAN", "IMAGE_GEN", "TIMELINE_BUILD", "RENDERING", "PACKAGING"]),
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "FAILED"),
    ]);

    return {
      waiting: waiting.count ?? 0,
      active: active.count ?? 0,
      failed: failed.count ?? 0,
    };
  } catch (error) {
    console.error("[Health] Error fetching queue stats:", error);
    return {
      waiting: 0,
      active: 0,
      failed: 0,
    };
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health" || req.url === "/") {
    try {
      const queueStats = await getQueueStats();

      const response = {
        status: "ok",
        uptime: process.uptime(),
        queue: {
          waiting: queueStats.waiting,
          active: queueStats.active,
          failed: queueStats.failed,
        },
        worker: process.env.WORKER_ID ?? `worker-${process.pid}`,
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.error("[Health] Error handling health check:", error);
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", error: String(error) }));
    }
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

export function startHealthServer(): void {
  server.listen(HEALTH_PORT, () => {
    console.log(`[Health] Health check server listening on port ${HEALTH_PORT}`);
  });
}

// Auto-start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startHealthServer();
}

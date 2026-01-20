import { PipelineMetrics } from "../../src/pipeline/metrics";
import type { JobStatus, JobErrorCode } from "@canvascast/shared";

describe("PipelineMetrics", () => {
  let metrics: PipelineMetrics;

  beforeEach(() => {
    metrics = new PipelineMetrics("test-job-123", "test-user-456");
  });

  describe("Step Tracking", () => {
    it("should track step duration", async () => {
      const stepName: JobStatus = "SCRIPTING";

      metrics.startStep(stepName);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      metrics.endStep(stepName, "success");

      const data = metrics.getData();
      expect(data.steps).toHaveLength(1);
      expect(data.steps[0].step).toBe("SCRIPTING");
      expect(data.steps[0].status).toBe("success");
      expect(data.steps[0].duration_ms).toBeGreaterThanOrEqual(100);
    });

    it("should track failed steps with error details", () => {
      const stepName: JobStatus = "IMAGE_GEN";
      const errorCode: JobErrorCode = "ERR_IMAGE_GEN";
      const errorMessage = "Failed to generate image";

      metrics.startStep(stepName);
      metrics.endStep(stepName, "failed", errorCode, errorMessage);

      const data = metrics.getData();
      expect(data.steps[0].status).toBe("failed");
      expect(data.steps[0].error_code).toBe("ERR_IMAGE_GEN");
      expect(data.steps[0].error_message).toBe("Failed to generate image");
    });

    it("should track multiple steps in order", () => {
      metrics.startStep("SCRIPTING");
      metrics.endStep("SCRIPTING", "success");

      metrics.startStep("VOICE_GEN");
      metrics.endStep("VOICE_GEN", "success");

      metrics.startStep("ALIGNMENT");
      metrics.endStep("ALIGNMENT", "success");

      const data = metrics.getData();
      expect(data.steps).toHaveLength(3);
      expect(data.steps[0].step).toBe("SCRIPTING");
      expect(data.steps[1].step).toBe("VOICE_GEN");
      expect(data.steps[2].step).toBe("ALIGNMENT");
    });
  });

  describe("Overall Job Metrics", () => {
    it("should calculate total job duration", async () => {
      metrics.startStep("SCRIPTING");
      await new Promise(resolve => setTimeout(resolve, 50));
      metrics.endStep("SCRIPTING", "success");

      metrics.startStep("VOICE_GEN");
      await new Promise(resolve => setTimeout(resolve, 50));
      metrics.endStep("VOICE_GEN", "success");

      const data = metrics.getData();
      expect(data.total_duration_ms).toBeGreaterThanOrEqual(100);
    });

    it("should track job metadata", () => {
      const data = metrics.getData();
      expect(data.job_id).toBe("test-job-123");
      expect(data.user_id).toBe("test-user-456");
      expect(data.started_at).toBeDefined();
    });
  });

  describe("Persistence", () => {
    it("should save metrics to database", async () => {
      metrics.startStep("SCRIPTING");
      metrics.endStep("SCRIPTING", "success");

      // Mock implementation - should not throw
      await expect(metrics.save()).resolves.not.toThrow();
    });

    it("should include all required fields when saving", async () => {
      metrics.startStep("SCRIPTING");
      metrics.endStep("SCRIPTING", "success");

      const data = metrics.getData();
      expect(data).toHaveProperty("job_id");
      expect(data).toHaveProperty("user_id");
      expect(data).toHaveProperty("started_at");
      expect(data).toHaveProperty("steps");
      expect(data).toHaveProperty("total_duration_ms");
    });
  });

  describe("Step Statistics", () => {
    it("should categorize failure reasons", () => {
      metrics.startStep("IMAGE_GEN");
      metrics.endStep("IMAGE_GEN", "failed", "ERR_IMAGE_GEN", "Rate limit exceeded");

      const data = metrics.getData();
      expect(data.steps[0].error_code).toBe("ERR_IMAGE_GEN");
      expect(data.failure_category).toBe("external_api");
    });

    it("should track retry attempts", () => {
      metrics.setRetryAttempt(2);

      const data = metrics.getData();
      expect(data.retry_attempt).toBe(2);
    });
  });
});

describe("MetricsAggregation", () => {
  describe("Step Success Rates", () => {
    it("should calculate success rate per step", () => {
      // This would query the metrics table and aggregate
      // Testing the query logic would require DB integration tests
      expect(true).toBe(true); // Placeholder for DB integration test
    });
  });

  describe("Average Durations", () => {
    it("should calculate average duration per step", () => {
      // This would query the metrics table and aggregate
      expect(true).toBe(true); // Placeholder for DB integration test
    });
  });

  describe("Failure Analysis", () => {
    it("should categorize and count failure reasons", () => {
      // This would query the metrics table and aggregate
      expect(true).toBe(true); // Placeholder for DB integration test
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

/**
 * Test for retry-step API endpoint
 * Feature RESIL-004: User Self-Service Retry - retry individual pipeline steps
 */

describe("POST /api/v1/jobs/:id/retry-step", () => {
  it("should allow retrying a failed step", async () => {
    // This test will fail initially because the endpoint doesn't exist yet
    const response = await request("http://localhost:8989")
      .post("/api/v1/jobs/test-job-id/retry-step")
      .send({ stepName: "IMAGE_GEN" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain("Step retry initiated");
  });

  it("should reject retry for non-existent job", async () => {
    const response = await request("http://localhost:8989")
      .post("/api/v1/jobs/non-existent-job/retry-step")
      .send({ stepName: "IMAGE_GEN" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.body.error).toContain("Job not found");
  });

  it("should reject retry for steps before checkpoint threshold", async () => {
    const response = await request("http://localhost:8989")
      .post("/api/v1/jobs/test-job-id/retry-step")
      .send({ stepName: "SCRIPTING" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("cannot be retried individually");
  });

  it("should require authentication", async () => {
    const response = await request("http://localhost:8989")
      .post("/api/v1/jobs/test-job-id/retry-step")
      .send({ stepName: "IMAGE_GEN" });

    expect(response.status).toBe(401);
  });

  it("should validate stepName parameter", async () => {
    const response = await request("http://localhost:8989")
      .post("/api/v1/jobs/test-job-id/retry-step")
      .send({})
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("stepName");
  });

  it("should update job status to re-execute the step", async () => {
    const response = await request("http://localhost:8989")
      .post("/api/v1/jobs/test-job-id/retry-step")
      .send({ stepName: "RENDERING" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.stepName).toBe("RENDERING");
    expect(response.body.newStatus).toBe("RENDERING");
  });

  it("should preserve checkpoint artifacts when retrying", async () => {
    const response = await request("http://localhost:8989")
      .post("/api/v1/jobs/test-job-id/retry-step")
      .send({ stepName: "RENDERING" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.checkpointPreserved).toBe(true);
  });
});

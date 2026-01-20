/**
 * RESIL-002: Credit Refund Policy - Integration Test
 *
 * Tests that the pipeline runner correctly applies refund logic when jobs fail
 */

import { describe, it, expect } from "vitest";
import { shouldRefundCredits, calculateRefundAmount } from "../../src/services/refund";
import type { JobStatus } from "@canvascast/shared";

describe("Refund Integration", () => {
  describe("Pipeline stages and refund eligibility", () => {
    it("QUEUED stage (0%) should be eligible for refund", () => {
      expect(shouldRefundCredits("QUEUED" as JobStatus, 0)).toBe(true);
    });

    it("SCRIPTING stage (5-15%) should be eligible for refund", () => {
      expect(shouldRefundCredits("SCRIPTING" as JobStatus, 5)).toBe(true);
      expect(shouldRefundCredits("SCRIPTING" as JobStatus, 15)).toBe(true);
    });

    it("VOICE_GEN stage (25%) should be eligible for refund", () => {
      expect(shouldRefundCredits("VOICE_GEN" as JobStatus, 25)).toBe(true);
    });

    it("ALIGNMENT stage (40%) should NOT be eligible for refund", () => {
      expect(shouldRefundCredits("ALIGNMENT" as JobStatus, 40)).toBe(false);
    });

    it("VISUAL_PLAN stage (50%) should NOT be eligible for refund", () => {
      expect(shouldRefundCredits("VISUAL_PLAN" as JobStatus, 50)).toBe(false);
    });

    it("IMAGE_GEN stage (55%) should NOT be eligible for refund", () => {
      expect(shouldRefundCredits("IMAGE_GEN" as JobStatus, 55)).toBe(false);
    });

    it("TIMELINE_BUILD stage (75%) should NOT be eligible for refund", () => {
      expect(shouldRefundCredits("TIMELINE_BUILD" as JobStatus, 75)).toBe(false);
    });

    it("RENDERING stage (80%) should NOT be eligible for refund", () => {
      expect(shouldRefundCredits("RENDERING" as JobStatus, 80)).toBe(false);
    });

    it("PACKAGING stage (95%) should NOT be eligible for refund", () => {
      expect(shouldRefundCredits("PACKAGING" as JobStatus, 95)).toBe(false);
    });
  });

  describe("Refund amount calculation", () => {
    it("should calculate full refund for early failure", () => {
      const amount = calculateRefundAmount(5, "SCRIPTING" as JobStatus, 15);
      expect(amount).toBe(5);
    });

    it("should calculate zero refund for late failure", () => {
      const amount = calculateRefundAmount(5, "RENDERING" as JobStatus, 80);
      expect(amount).toBe(0);
    });

    it("should handle edge case at exact threshold", () => {
      const amount = calculateRefundAmount(5, "SCRIPTING" as JobStatus, 30);
      expect(amount).toBe(0); // At threshold, no refund
    });

    it("should handle edge case just below threshold", () => {
      const amount = calculateRefundAmount(5, "SCRIPTING" as JobStatus, 29);
      expect(amount).toBe(5); // Below threshold, full refund
    });
  });
});

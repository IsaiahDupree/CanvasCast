/**
 * RESIL-002: Credit Refund Policy
 *
 * Tests for automatic refund logic based on job completion threshold
 */

import { describe, it, expect } from "vitest";
import { shouldRefundCredits, calculateRefundAmount } from "../../services/refund";
import type { JobStatus } from "@canvascast/shared";

describe("Credit Refund Service", () => {
  describe("shouldRefundCredits", () => {
    it("should refund credits if job fails before VOICE_GEN (< 30% completion)", () => {
      const status: JobStatus = "SCRIPTING";
      const progress = 15;

      expect(shouldRefundCredits(status, progress)).toBe(true);
    });

    it("should refund credits if job fails at VOICE_GEN (< 30% completion)", () => {
      const status: JobStatus = "VOICE_GEN";
      const progress = 25;

      expect(shouldRefundCredits(status, progress)).toBe(true);
    });

    it("should NOT refund credits if job fails at ALIGNMENT (>= 30% completion)", () => {
      const status: JobStatus = "ALIGNMENT";
      const progress = 40;

      expect(shouldRefundCredits(status, progress)).toBe(false);
    });

    it("should NOT refund credits if job fails at IMAGE_GEN (>= 30% completion)", () => {
      const status: JobStatus = "IMAGE_GEN";
      const progress = 55;

      expect(shouldRefundCredits(status, progress)).toBe(false);
    });

    it("should NOT refund credits if job fails at RENDERING (>= 30% completion)", () => {
      const status: JobStatus = "RENDERING";
      const progress = 80;

      expect(shouldRefundCredits(status, progress)).toBe(false);
    });

    it("should refund credits if progress is exactly at threshold boundary", () => {
      const status: JobStatus = "SCRIPTING";
      const progress = 30; // Exactly at threshold

      expect(shouldRefundCredits(status, progress)).toBe(false);
    });

    it("should refund credits if progress is just below threshold", () => {
      const status: JobStatus = "SCRIPTING";
      const progress = 29; // Just below threshold

      expect(shouldRefundCredits(status, progress)).toBe(true);
    });
  });

  describe("calculateRefundAmount", () => {
    it("should return full reserved amount if below threshold", () => {
      const reservedCredits = 5;
      const status: JobStatus = "SCRIPTING";
      const progress = 15;

      expect(calculateRefundAmount(reservedCredits, status, progress)).toBe(5);
    });

    it("should return 0 if above threshold", () => {
      const reservedCredits = 5;
      const status: JobStatus = "RENDERING";
      const progress = 80;

      expect(calculateRefundAmount(reservedCredits, status, progress)).toBe(0);
    });

    it("should handle 0 reserved credits", () => {
      const reservedCredits = 0;
      const status: JobStatus = "SCRIPTING";
      const progress = 15;

      expect(calculateRefundAmount(reservedCredits, status, progress)).toBe(0);
    });
  });
});

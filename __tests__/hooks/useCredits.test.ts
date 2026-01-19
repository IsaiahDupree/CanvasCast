/**
 * useCredits Hook Tests
 * Feature: UI-015 - useCredits Hook
 *
 * Tests the useCredits hook which:
 * - Fetches credit balance via RPC call to get_credit_balance
 * - Handles loading state during initial fetch
 * - Handles error state if fetch fails
 * - Returns balance of 0 for unauthenticated users
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCredits } from "@/hooks/useCredits";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock the Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";

const mockCreateClient = vi.mocked(createClient);

describe("useCredits Hook - UI-015", () => {
  let mockSupabase: {
    auth: {
      getUser: ReturnType<typeof vi.fn>;
    };
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      rpc: vi.fn(),
    };

    mockCreateClient.mockReturnValue(mockSupabase as unknown as SupabaseClient);
  });

  describe("Initial Loading State", () => {
    it("should start with loading=true and balance=0", () => {
      // Setup mock that doesn't resolve immediately
      mockSupabase.auth.getUser.mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useCredits());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBeUndefined();
    });
  });

  describe("Unauthenticated User", () => {
    it("should return balance=0 for unauthenticated user", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { result } = renderHook(() => useCredits());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBeUndefined();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("Authenticated User - Successful Fetch", () => {
    it("should fetch and return credit balance for authenticated user", async () => {
      const mockUserId = "user-123";
      const mockBalance = 50;

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: mockBalance,
        error: null,
      });

      const { result } = renderHook(() => useCredits());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.balance).toBe(mockBalance);
      expect(result.current.error).toBeUndefined();

      // Verify RPC was called with correct parameter name
      expect(mockSupabase.rpc).toHaveBeenCalledWith("get_credit_balance", {
        p_user_id: mockUserId,
      });
    });

    it("should return 0 if RPC returns null", async () => {
      const mockUserId = "user-123";

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const { result } = renderHook(() => useCredits());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBeUndefined();
    });

    it("should handle different balance values correctly", async () => {
      const mockUserId = "user-456";
      const testCases = [0, 10, 100, 999];

      for (const balance of testCases) {
        vi.clearAllMocks();

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        });

        mockSupabase.rpc.mockResolvedValue({
          data: balance,
          error: null,
        });

        const { result } = renderHook(() => useCredits());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.balance).toBe(balance);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle RPC errors gracefully", async () => {
      const mockUserId = "user-123";
      const mockError = new Error("Database connection failed");

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      const { result } = renderHook(() => useCredits());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBe("Database connection failed");
    });

    it("should handle auth.getUser errors", async () => {
      const mockError = new Error("Auth service unavailable");

      mockSupabase.auth.getUser.mockRejectedValue(mockError);

      const { result } = renderHook(() => useCredits());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBe("Auth service unavailable");
    });

    it("should handle generic errors", async () => {
      const mockUserId = "user-123";

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabase.rpc.mockRejectedValue("Unknown error");

      const { result } = renderHook(() => useCredits());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBe("Failed to fetch credits");
    });
  });

  describe("Return Value Structure", () => {
    it("should return object with correct properties", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: 50,
        error: null,
      });

      const { result } = renderHook(() => useCredits());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty("balance");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");

      expect(typeof result.current.balance).toBe("number");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("Console Error Logging", () => {
    it("should log errors to console", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockUserId = "user-123";
      const mockError = new Error("RPC failed");

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      renderHook(() => useCredits());

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to fetch credit balance:",
          mockError
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Acceptance Criteria", () => {
    it("AC1: Fetches balance via RPC", async () => {
      const mockUserId = "test-user-id";

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: 42,
        error: null,
      });

      renderHook(() => useCredits());

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith("get_credit_balance", {
          p_user_id: mockUserId,
        });
      });
    });

    it("AC2: Handles loading state", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: 10,
        error: null,
      });

      const { result } = renderHook(() => useCredits());

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // After fetch completes
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});

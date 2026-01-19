import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "../apps/web/src/hooks/useAuth";
import type { User, Session } from "@supabase/supabase-js";

// Mock Supabase client
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("../apps/web/src/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null user and loading true initially", () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("should return user when session exists", async () => {
    const mockUser: User = {
      id: "test-user-id",
      email: "test@example.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    };

    const mockSession: Session = {
      access_token: "mock-token",
      refresh_token: "mock-refresh",
      expires_in: 3600,
      expires_at: Date.now() + 3600,
      token_type: "bearer",
      user: mockUser,
    };

    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it("should update user when auth state changes", async () => {
    const mockUser: User = {
      id: "test-user-id",
      email: "test@example.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    };

    const mockSession: Session = {
      access_token: "mock-token",
      refresh_token: "mock-refresh",
      expires_in: 3600,
      expires_at: Date.now() + 3600,
      token_type: "bearer",
      user: mockUser,
    };

    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    let authStateChangeCallback: ((event: string, session: Session | null) => void) | null = null;

    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateChangeCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();

    // Simulate auth state change
    if (authStateChangeCallback) {
      authStateChangeCallback("SIGNED_IN", mockSession);
    }

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });
  });

  it("should handle sign out", async () => {
    const mockUser: User = {
      id: "test-user-id",
      email: "test@example.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    };

    const mockSession: Session = {
      access_token: "mock-token",
      refresh_token: "mock-refresh",
      expires_in: 3600,
      expires_at: Date.now() + 3600,
      token_type: "bearer",
      user: mockUser,
    };

    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    let authStateChangeCallback: ((event: string, session: Session | null) => void) | null = null;

    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateChangeCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    // Simulate sign out
    if (authStateChangeCallback) {
      authStateChangeCallback("SIGNED_OUT", null);
    }

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });
  });

  it("should cleanup subscription on unmount", async () => {
    const mockUnsubscribe = vi.fn();

    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } }
    });

    const { unmount } = renderHook(() => useAuth());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

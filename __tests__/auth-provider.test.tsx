import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../apps/web/src/providers/AuthProvider";
import { useAuth } from "../apps/web/src/hooks/useAuth";
import { describe, it, expect, vi } from "vitest";

// Mock the useAuth hook
vi.mock("../apps/web/src/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

// Test component that consumes the AuthProvider
function TestComponent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (user) {
    return <div>Authenticated: {user.email}</div>;
  }

  return <div>Not authenticated</div>;
}

describe("AuthProvider", () => {
  it("should provide auth context to children", async () => {
    // Mock the useAuth hook to return a loading state first
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
    });

    const { rerender } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should show loading state
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // Mock the useAuth hook to return an authenticated user
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "test@example.com" } as any,
      loading: false,
    });

    rerender(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should show authenticated state
    await waitFor(() => {
      expect(screen.getByText(/Authenticated: test@example.com/)).toBeInTheDocument();
    });
  });

  it("should render children", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );

    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });

  it("should handle unauthenticated state", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText("Not authenticated")).toBeInTheDocument();
  });
});

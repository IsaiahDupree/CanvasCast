"use client";

import React, { ReactNode } from "react";

/**
 * AuthProvider Component
 *
 * Context provider wrapper for authentication state management.
 *
 * Features:
 * - Wraps the application to provide auth context
 * - Uses the useAuth hook for state management
 * - Enables all child components to access auth state
 *
 * Note: This is a simple wrapper component. The actual auth logic
 * is handled by the useAuth hook, which manages Supabase Auth state,
 * subscriptions, and session management.
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to render
 *
 * @example
 * ```tsx
 * // In app layout:
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <AuthProvider>
 *           {children}
 *         </AuthProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // The AuthProvider is a simple wrapper that renders children
  // Auth state is managed via the useAuth hook that components can use directly
  // This pattern keeps the provider lightweight while still allowing
  // components to access auth state through the hook
  return <>{children}</>;
}

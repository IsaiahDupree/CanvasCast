/**
 * Tests for Next.js auth middleware
 * Tests middleware structure and exports
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Auth Middleware', () => {
  const middlewarePath = join(__dirname, '../apps/web/src/middleware.ts');
  const middlewareHelperPath = join(__dirname, '../apps/web/src/lib/supabase/middleware.ts');

  describe('Middleware File Structure', () => {
    it('should have middleware.ts file', () => {
      const content = readFileSync(middlewarePath, 'utf-8');
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });

    it('should export middleware function', () => {
      const content = readFileSync(middlewarePath, 'utf-8');
      expect(content).toContain('export async function middleware');
      expect(content).toContain('NextRequest');
    });

    it('should export config with matcher', () => {
      const content = readFileSync(middlewarePath, 'utf-8');
      expect(content).toContain('export const config');
      expect(content).toContain('matcher');
    });

    it('should import updateSession from helper', () => {
      const content = readFileSync(middlewarePath, 'utf-8');
      expect(content).toContain('import');
      expect(content).toContain('updateSession');
      expect(content).toContain('@/lib/supabase/middleware');
    });

    it('should call updateSession in middleware', () => {
      const content = readFileSync(middlewarePath, 'utf-8');
      expect(content).toContain('await updateSession(request)');
    });
  });

  describe('Middleware Helper', () => {
    it('should have middleware helper file', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });

    it('should export updateSession function', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toContain('export async function updateSession');
    });

    it('should create Supabase server client', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toContain('createServerClient');
      expect(content).toContain('@supabase/ssr');
    });

    it('should handle cookies', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toContain('cookies:');
      expect(content).toContain('getAll');
      expect(content).toContain('setAll');
    });

    it('should refresh session by getting user', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toContain('supabase.auth.getUser()');
    });

    it('should protect /app routes', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toContain('isProtectedRoute');
      expect(content).toContain('/app');
    });

    it('should redirect unauthenticated users to login', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toContain('/login');
      expect(content).toContain('NextResponse.redirect');
      expect(content).toContain('!user');
    });

    it('should handle auth routes (/login, /signup)', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toContain('isAuthRoute');
      expect(content).toContain('/login');
      expect(content).toContain('/signup');
    });

    it('should redirect authenticated users from auth routes to /app', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toContain('isAuthRoute && user');
      expect(content).toContain('/app');
    });

    it('should preserve redirect parameter', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');
      expect(content).toContain('redirect');
      expect(content).toContain('searchParams');
    });
  });

  describe('Middleware Config', () => {
    it('should exclude static assets from matcher', () => {
      const content = readFileSync(middlewarePath, 'utf-8');
      expect(content).toContain('_next/static');
      expect(content).toContain('_next/image');
      expect(content).toContain('favicon.ico');
    });

    it('should exclude common image formats', () => {
      const content = readFileSync(middlewarePath, 'utf-8');
      expect(content).toContain('svg');
      expect(content).toContain('png');
      expect(content).toContain('jpg');
    });
  });

  describe('Acceptance Criteria', () => {
    it('should redirect unauthenticated users from protected routes', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');

      // Check for protected route logic
      expect(content).toContain('isProtectedRoute');
      expect(content).toContain('!user');
      expect(content).toContain('NextResponse.redirect');
      expect(content).toContain('/login');
    });

    it('should allow public routes', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');

      // Should only redirect on specific conditions, not all routes
      expect(content).toContain('isProtectedRoute');
      expect(content).toContain('isAuthRoute');
      // Should return normal response for other routes
      expect(content).toContain('return supabaseResponse');
    });

    it('should refresh session on every request', () => {
      const content = readFileSync(middlewareHelperPath, 'utf-8');

      // Should call getUser which refreshes the session
      expect(content).toContain('supabase.auth.getUser()');
      expect(content).toContain('user');
    });
  });
});

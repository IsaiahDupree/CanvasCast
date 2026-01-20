/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Supabase SSR
const mockGetUser = jest.fn();
const mockCreateServerClient = jest.fn(() => ({
  auth: {
    getUser: mockGetUser,
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
  })),
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

describe('Admin Route Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('Unauthenticated users', () => {
    it('should redirect unauthenticated users to login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const { updateSession } = await import('@/lib/supabase/middleware');
      const request = new NextRequest(new URL('http://localhost:3000/admin'));

      const response = await updateSession(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('/login');
    });
  });

  describe('Authenticated non-admin users', () => {
    it('should redirect non-admin users to /app', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
      };

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      // Mock the profile query to return is_admin = false
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { is_admin: false },
              error: null,
            })),
          })),
        })),
      }));

      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: mockGetUser,
        },
        from: mockFrom,
      });

      const { updateSession } = await import('@/lib/supabase/middleware');
      const request = new NextRequest(new URL('http://localhost:3000/admin'));

      const response = await updateSession(request);

      // Should redirect non-admin users away from admin routes
      expect(response.status).toBe(307); // Redirect
      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      expect(location).not.toContain('/admin');
    });
  });

  describe('Admin users', () => {
    it('should allow admin users to access admin routes', async () => {
      const mockAdminUser = {
        id: 'admin-123',
        email: 'admin@example.com',
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockAdminUser },
        error: null
      });

      // Mock the profile query to return is_admin = true
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { is_admin: true },
              error: null,
            })),
          })),
        })),
      }));

      mockCreateServerClient.mockReturnValue({
        auth: {
          getUser: mockGetUser,
        },
        from: mockFrom,
      });

      const { updateSession } = await import('@/lib/supabase/middleware');
      const request = new NextRequest(new URL('http://localhost:3000/admin'));

      const response = await updateSession(request);

      // Should allow access (not redirect)
      expect(response.status).not.toBe(307);
    });
  });

  describe('Admin route patterns', () => {
    it('should protect all routes under /admin/*', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const { updateSession } = await import('@/lib/supabase/middleware');

      const routes = [
        '/admin',
        '/admin/jobs',
        '/admin/jobs/123',
        '/admin/users',
        '/admin/queues',
        '/admin/costs',
      ];

      for (const route of routes) {
        const request = new NextRequest(new URL(`http://localhost:3000${route}`));
        const response = await updateSession(request);

        expect(response.status).toBe(307); // Should redirect
        expect(response.headers.get('location')).toContain('/login');
      }
    });
  });
});

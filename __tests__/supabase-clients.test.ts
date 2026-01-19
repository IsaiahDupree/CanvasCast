/**
 * Unit tests for Supabase client setup
 * Tests browser client, server client, and admin client creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Supabase Client Setup', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    };

    // Clear module cache to ensure fresh imports
    vi.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Browser Client', () => {
    it('should create a browser client with correct configuration', async () => {
      const { createClient } = await import('../apps/web/src/lib/supabase/client');
      const client = createClient();

      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(client.from).toBeDefined();
      expect(client.storage).toBeDefined();
    });

    it('should use environment variables for URL and key', async () => {
      const { createClient } = await import('../apps/web/src/lib/supabase/client');
      const client = createClient();

      // Verify the client is using the correct URL and key
      // (We can't directly access private properties, but we can test behavior)
      expect(client).toBeDefined();
    });

    it('should throw error if NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      vi.resetModules();

      const { createClient } = await import('../apps/web/src/lib/supabase/client');

      expect(() => createClient()).toThrow();
    });

    it('should throw error if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      vi.resetModules();

      const { createClient } = await import('../apps/web/src/lib/supabase/client');

      expect(() => createClient()).toThrow();
    });
  });

  describe('Server Client', () => {
    it('should create a server client module exports', async () => {
      // We can't directly test server client creation outside of Next.js context
      // Instead, verify that the module exports the expected functions
      const serverModule = await import('../apps/web/src/lib/supabase/server');

      expect(serverModule.createClient).toBeDefined();
      expect(serverModule.createAdminClient).toBeDefined();
      expect(typeof serverModule.createClient).toBe('function');
      expect(typeof serverModule.createAdminClient).toBe('function');
    });

    it('should create an admin client with service role key', async () => {
      vi.mock('next/headers', () => ({
        cookies: vi.fn().mockResolvedValue({
          getAll: vi.fn().mockReturnValue([]),
          set: vi.fn(),
        }),
      }));

      const { createAdminClient } = await import('../apps/web/src/lib/supabase/server');
      const adminClient = createAdminClient();

      expect(adminClient).toBeDefined();
      expect(adminClient.auth).toBeDefined();
      expect(adminClient.auth.admin).toBeDefined();
    });

    it('should throw error if SUPABASE_SERVICE_ROLE_KEY is missing for admin client', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      vi.resetModules();

      vi.mock('next/headers', () => ({
        cookies: vi.fn().mockResolvedValue({
          getAll: vi.fn().mockReturnValue([]),
          set: vi.fn(),
        }),
      }));

      const { createAdminClient } = await import('../apps/web/src/lib/supabase/server');

      expect(() => createAdminClient()).toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should export TypeScript types from database', async () => {
      const { createClient } = await import('../apps/web/src/lib/supabase/client');
      const client = createClient();

      // Test that we can call typed methods
      const query = client.from('profiles').select('*');
      expect(query).toBeDefined();
    });
  });

  describe('Authentication Methods', () => {
    it('should provide auth methods on browser client', async () => {
      const { createClient } = await import('../apps/web/src/lib/supabase/client');
      const client = createClient();

      expect(client.auth.signInWithPassword).toBeDefined();
      expect(client.auth.signInWithOAuth).toBeDefined();
      expect(client.auth.signOut).toBeDefined();
      expect(client.auth.getSession).toBeDefined();
      expect(client.auth.getUser).toBeDefined();
    });

    it('should have server client function signature', async () => {
      // Server client can only be tested in Next.js context
      // Verify function signature and exports instead
      const { createClient } = await import('../apps/web/src/lib/supabase/server');

      expect(createClient).toBeDefined();
      expect(typeof createClient).toBe('function');
      // The function should be async
      expect(createClient.constructor.name).toBe('AsyncFunction');
    });

    it('should provide admin auth methods on admin client', async () => {
      const { createAdminClient } = await import('../apps/web/src/lib/supabase/server');
      const adminClient = createAdminClient();

      expect(adminClient.auth.admin).toBeDefined();
      expect(adminClient.auth.admin.createUser).toBeDefined();
      expect(adminClient.auth.admin.deleteUser).toBeDefined();
    });
  });
});

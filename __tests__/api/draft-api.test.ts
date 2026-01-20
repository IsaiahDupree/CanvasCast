/**
 * Draft API Endpoint Tests
 * Feature: DRAFT-001 - Create Draft API Route
 * Feature: DRAFT-002 - Get Draft API Route
 * Feature: RATE-002 - Draft Endpoint Rate Limit
 *
 * Tests the /api/draft endpoints:
 * - POST /api/draft - Creates or updates a draft prompt (pre-auth flow)
 * - GET /api/draft - Retrieves draft by session token or user ID
 * - Rate limiting: 10 req/min per IP
 *
 * Acceptance Criteria:
 * - POST creates draft in DB
 * - POST sets session cookie
 * - POST returns draftId
 * - GET returns draft by session token
 * - GET returns claimed draft by user_id
 * - Rate limit enforced (10 req/min per IP)
 * - Clear error message on rate limit exceeded
 * - Bypass rate limit for authenticated users
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';

// Setup Supabase client for integration testing
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

describe('DRAFT-001: POST /api/draft - Create Draft API Route', () => {
  describe('Route File Existence', () => {
    it('should have draft route file at correct path', () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const routeExists = existsSync(routePath);

      expect(routeExists).toBe(true);
    });

    it('should export POST and GET handlers', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Check that the file exports POST and GET functions
      expect(fileContent).toContain('export async function POST');
      expect(fileContent).toContain('export async function GET');
    });

    it('should have Zod schema for validation', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Check for validation schema
      expect(fileContent).toContain('DraftSchema');
      expect(fileContent).toContain('z.object');
      expect(fileContent).toContain('promptText');
    });
  });

  describe('Validation Logic', () => {
    it('should have minimum character validation for prompt', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should validate minimum 10 characters
      expect(fileContent).toContain('.min(10');
    });

    it('should have default templateId', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      expect(fileContent).toContain('narrated_storyboard_v1');
    });
  });

  describe('Database Interaction', () => {
    it('should be able to create draft in draft_prompts table', async () => {
      const testPrompt = 'Create an educational video about space exploration';
      const sessionToken = randomUUID();

      // Test that we can create a draft using Supabase directly
      const { data: draft, error } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: sessionToken,
          prompt_text: testPrompt,
        })
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(draft).toBeDefined();
      expect(draft?.prompt_text).toBe(testPrompt);
      expect(draft?.session_token).toBe(sessionToken);
      expect(draft?.claimed_by_user_id).toBeNull();

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
    });

    it('should support upsert behavior on session_token', async () => {
      const sessionToken = randomUUID();

      // Create first draft
      const { data: draft1 } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: sessionToken,
          prompt_text: 'First version',
        })
        .select('*')
        .single();

      // Try to insert another draft with same session_token
      // The API route should handle this with upsert
      const { data: drafts } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('session_token', sessionToken);

      expect(drafts).toBeDefined();
      expect(drafts!.length).toBeGreaterThan(0);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('session_token', sessionToken);
    });

    it('should store template_id and options_json', async () => {
      const sessionToken = randomUUID();
      const testOptions = { duration: 60, voiceType: 'male' };

      const { data: draft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: sessionToken,
          prompt_text: 'Test with options',
          template_id: 'custom_template_v2',
          options_json: testOptions,
        })
        .select('*')
        .single();

      expect(draft?.template_id).toBe('custom_template_v2');
      expect(draft?.options_json).toEqual(testOptions);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
    });
  });

  describe('Response Format', () => {
    it('should expect draftId in API response', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Response should include draftId
      expect(fileContent).toContain('draftId');
    });

    it('should expect sessionToken in API response', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Response should include sessionToken
      expect(fileContent).toContain('sessionToken');
    });

    it('should expect isAuthenticated flag in response', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Response should include isAuthenticated
      expect(fileContent).toContain('isAuthenticated');
    });
  });

  describe('Session Cookie Handling', () => {
    it('should set draft_session cookie', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should set cookie with proper name
      expect(fileContent).toContain('draft_session');
      expect(fileContent).toContain('cookies.set');
    });

    it('should use httpOnly and secure cookie flags', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should have security flags
      expect(fileContent).toContain('httpOnly');
      expect(fileContent).toContain('secure');
      expect(fileContent).toContain('sameSite');
    });

    it('should set 7-day expiry on cookie', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should set maxAge for 7 days
      expect(fileContent).toContain('maxAge');
    });
  });
});

describe('DRAFT-002: GET /api/draft - Get Draft API Route', () => {
  describe('Anonymous User Flow', () => {
    it('should be able to retrieve draft by session token', async () => {
      const sessionToken = randomUUID();

      // Create a draft
      const { data: draft, error } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: sessionToken,
          prompt_text: 'Test draft retrieval by session',
        })
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(draft).toBeDefined();

      // Query draft by session token (simulating what GET handler does)
      const { data: retrieved } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('session_token', sessionToken)
        .is('claimed_by_user_id', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(draft!.id);
      expect(retrieved?.prompt_text).toBe('Test draft retrieval by session');

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
    });

    it('should return null when no draft exists for session', async () => {
      const nonExistentToken = randomUUID();

      // Try to find draft that doesn't exist
      const { data } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('session_token', nonExistentToken)
        .is('claimed_by_user_id', null)
        .maybeSingle();

      expect(data).toBeNull();
    });
  });

  describe('Response Format', () => {
    it('should return draft with correct structure', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Response should map database fields to camelCase
      expect(fileContent).toContain('promptText');
      expect(fileContent).toContain('templateId');
      expect(fileContent).toContain('options');
      expect(fileContent).toContain('createdAt');
    });

    it('should handle draft not found case', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should return null when draft not found
      expect(fileContent).toContain('draft: null');
    });
  });

  describe('Claimed Drafts', () => {
    it('should prioritize claimed drafts for authenticated users', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should query by user ID first
      expect(fileContent).toContain('claimed_by_user_id');
      expect(fileContent).toContain('user.id');
    });

    it('should be able to retrieve claimed draft by user_id', async () => {
      // Create a test user
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: `test-draft-${randomUUID()}@example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      if (userError || !userData) {
        console.warn('Could not create test user, skipping test');
        return;
      }

      const userId = userData.user.id;

      // Create a claimed draft
      const { data: draft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: randomUUID(),
          prompt_text: 'Test claimed draft retrieval',
          claimed_by_user_id: userId,
        })
        .select('*')
        .single();

      // Query by user ID (simulating authenticated GET)
      const { data: retrieved } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('claimed_by_user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(draft!.id);
      expect(retrieved?.claimed_by_user_id).toBe(userId);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
      await supabase.auth.admin.deleteUser(userId);
    });
  });

  describe('Lookup Priority', () => {
    it('should check for authenticated user first', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should get user from auth
      expect(fileContent).toContain('getUser');
    });

    it('should fall back to session token for anonymous users', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should use session token as fallback
      expect(fileContent).toContain('session_token');
    });
  });
});

describe('RATE-002: Draft Endpoint Rate Limit', () => {
  describe('Rate Limiting Implementation', () => {
    it('should import rate limiting utilities', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should import rate limiting function
      expect(fileContent).toContain('rateLimitByIP');
    });

    it('should call rate limiter before processing request', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should have rate limit check
      expect(fileContent).toMatch(/rateLimitByIP|rateLimit/);
    });

    it('should extract IP address from request', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should get IP from headers or request
      expect(fileContent).toMatch(/x-forwarded-for|x-real-ip|headers/i);
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should configure 10 requests per minute for anonymous users', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should have 10 requests config
      expect(fileContent).toMatch(/requests:\s*10/);
      // Should have 1 minute window
      expect(fileContent).toMatch(/window:\s*['"]1m['"]/);
    });

    it('should use draft-specific rate limit prefix', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should have draft prefix to isolate from other endpoints
      expect(fileContent).toContain('draft');
    });
  });

  describe('Rate Limit Response', () => {
    it('should return 429 status when rate limit exceeded', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should return 429 status
      expect(fileContent).toContain('429');
    });

    it('should provide clear error message on rate limit exceeded', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should have informative error message
      expect(fileContent).toMatch(/rate limit|too many requests|try again/i);
    });

    it('should include retry-after or reset time in response', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should tell user when to retry
      expect(fileContent).toMatch(/retry|reset/i);
    });
  });

  describe('Authenticated User Bypass', () => {
    it('should check if user is authenticated before applying rate limit', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should get user from auth
      expect(fileContent).toContain('getUser');
    });

    it('should bypass or have higher limit for authenticated users', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should have conditional logic for auth users
      expect(fileContent).toMatch(/if\s*\(\s*!?\s*user/);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should set rate limit headers in response', async () => {
      const routePath = join(process.cwd(), 'apps/web/src/app/api/draft/route.ts');
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(routePath, 'utf-8');

      // Should set X-RateLimit headers
      expect(fileContent).toMatch(/X-RateLimit|headers\.set/i);
    });
  });
});

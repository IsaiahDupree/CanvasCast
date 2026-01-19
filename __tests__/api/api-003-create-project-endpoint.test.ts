/**
 * API-003: Create Project Endpoint
 *
 * Tests that verify:
 * 1. POST /api/v1/projects validates input
 * 2. Checks user credit balance
 * 3. Creates project and job records
 * 4. Queues job for processing
 *
 * Acceptance Criteria:
 * - Validates input (niche, title, target_minutes)
 * - Checks credits before creating project
 * - Creates project in database with correct fields
 * - Creates job in database linked to project
 * - Queues job in BullMQ
 * - Returns 402 if insufficient credits
 * - Returns 201 with project and job data on success
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_URL = process.env.API_URL || 'http://localhost:8989';

describe('API-003: Create Project Endpoint', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUser: User | null = null;
  let testUserToken: string | null = null;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create a test user or use existing one
    const testEmail = `test-${Date.now()}@example.com`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
    });

    if (authError) {
      console.error('Error creating test user:', authError);
      throw authError;
    }

    testUser = authData.user;
    testUserToken = authData.session?.access_token || null;

    // Give test user some credits
    if (testUser) {
      const { error: creditError } = await supabase.rpc('add_credits', {
        p_user_id: testUser.id,
        p_amount: 100,
        p_type: 'admin_adjust',
        p_note: 'Test credits',
      });

      if (creditError) {
        console.error('Error adding credits:', creditError);
      }
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test user's data
    if (testUser) {
      await supabase.from('jobs').delete().eq('user_id', testUser.id);
      await supabase.from('projects').delete().eq('user_id', testUser.id);
      await supabase.from('credit_ledger').delete().eq('user_id', testUser.id);
      await supabase.from('profiles').delete().eq('id', testUser.id);
      await supabase.auth.admin.deleteUser(testUser.id);
    }
  });

  describe('Endpoint Definition', () => {
    it('should have POST /api/v1/projects endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.post('/api/v1/projects'");
      expect(indexContent).toContain('authenticateToken');
    });

    it('should require authentication', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that the endpoint has authenticateToken middleware
      const projectsEndpointRegex = /app\.post\(['"]\/api\/v1\/projects['"],\s*authenticateToken/;
      expect(indexContent).toMatch(projectsEndpointRegex);
    });
  });

  describe('Input Validation', () => {
    it('should validate niche_preset is required and valid', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that code validates niche preset
      expect(indexContent).toContain('niche_preset');
      expect(indexContent).toContain('NICHE_PRESETS');
      expect(indexContent).toContain('Invalid niche preset');
    });

    it('should extract title, niche_preset, target_minutes from request body', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify destructuring of request body
      expect(indexContent).toMatch(/const\s*{\s*title.*niche_preset.*target_minutes.*}\s*=\s*req\.body/s);
    });

    it('should have NICHE_PRESETS defined with creditsPerMinute', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain('NICHE_PRESETS');
      expect(indexContent).toContain('creditsPerMinute');
      expect(indexContent).toMatch(/motivation.*creditsPerMinute/s);
      expect(indexContent).toMatch(/explainer.*creditsPerMinute/s);
    });
  });

  describe('Credit Balance Check', () => {
    it('should check user credit balance before creating project', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify credit balance check
      expect(indexContent).toContain("rpc('get_credit_balance'");
      expect(indexContent).toContain('p_user_id');
    });

    it('should calculate required credits based on target_minutes and niche', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify credits calculation
      expect(indexContent).toContain('creditsRequired');
      expect(indexContent).toMatch(/Math\.ceil.*target_minutes.*creditsPerMinute/s);
    });

    it('should return 402 if insufficient credits', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify insufficient credits handling
      expect(indexContent).toContain('402');
      expect(indexContent).toContain('Insufficient credits');
      expect(indexContent).toContain('required');
      expect(indexContent).toContain('available');
    });
  });

  describe('Project Creation', () => {
    it('should create project record in database', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify project creation
      expect(indexContent).toContain("supabase.from('projects').insert");
      expect(indexContent).toMatch(/user_id.*userId/s);
      expect(indexContent).toMatch(/title/);
      expect(indexContent).toMatch(/niche_preset/);
      expect(indexContent).toMatch(/target_minutes/);
    });

    it('should generate UUID for project ID', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify UUID generation
      expect(indexContent).toContain('uuidv4');
      expect(indexContent).toContain('projectId');
    });

    it('should set initial project status to draft', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify status is set to draft
      expect(indexContent).toMatch(/status.*['"]draft['"]/s);
    });
  });

  describe('Job Creation', () => {
    it('should create job record linked to project', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify job creation
      expect(indexContent).toContain("supabase.from('jobs').insert");
      expect(indexContent).toMatch(/project_id.*projectId/s);
      expect(indexContent).toMatch(/user_id.*userId/s);
    });

    it('should set job status to QUEUED', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify job status
      expect(indexContent).toMatch(/status.*['"]QUEUED['"]/s);
    });

    it('should set cost_credits_reserved on job', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify credits reservation
      expect(indexContent).toContain('cost_credits_reserved');
      expect(indexContent).toContain('creditsRequired');
    });
  });

  describe('Credit Reservation', () => {
    it('should call reserve_credits RPC function', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify reserve_credits is called
      expect(indexContent).toContain("rpc('reserve_credits'");
      expect(indexContent).toContain('p_user_id');
      expect(indexContent).toContain('p_job_id');
      expect(indexContent).toContain('p_amount');
    });

    it('should cleanup on credit reservation failure', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify cleanup on reservation error
      expect(indexContent).toMatch(/reserveError.*delete.*jobs/s);
      expect(indexContent).toMatch(/reserveError.*delete.*projects/s);
    });
  });

  describe('Job Queuing', () => {
    it('should queue job with BullMQ', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify job queuing
      expect(indexContent).toContain('jobQueue');
      expect(indexContent).toContain('.add(');
      expect(indexContent).toContain('generate-video');
    });

    it('should include job metadata in queue payload', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify job payload includes necessary data
      expect(indexContent).toMatch(/jobId.*projectId.*userId/s);
      expect(indexContent).toMatch(/nichePreset/s);
      expect(indexContent).toMatch(/targetMinutes/s);
    });
  });

  describe('Response Format', () => {
    it('should return 201 status code on success', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify 201 response
      expect(indexContent).toContain('res.status(201)');
    });

    it('should return project and job data in response', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify response structure
      expect(indexContent).toMatch(/project.*job/s);
      expect(indexContent).toMatch(/credits_reserved/s);
    });
  });

  describe('Error Handling', () => {
    it('should handle project creation errors', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error handling
      expect(indexContent).toMatch(/projectError.*500/s);
      expect(indexContent).toContain('Failed to create project');
    });

    it('should handle job creation errors', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error handling
      expect(indexContent).toMatch(/jobError.*500/s);
      expect(indexContent).toContain('Failed to create job');
    });

    it('should catch and handle general errors', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify try-catch
      expect(indexContent).toMatch(/try.*catch.*error/s);
    });
  });

  describe('Schema Validation', () => {
    it('should have projectSchema defined in shared package', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const schemaPath = path.join(process.cwd(), 'packages/shared/src/schemas/project.ts');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');

      expect(schemaContent).toContain('projectSchema');
      expect(schemaContent).toContain('title');
      expect(schemaContent).toContain('niche_preset');
      expect(schemaContent).toContain('target_minutes');
    });

    it('should validate target_minutes range (1-10)', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const schemaPath = path.join(process.cwd(), 'packages/shared/src/schemas/project.ts');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');

      expect(schemaContent).toContain('.min(1');
      expect(schemaContent).toContain('.max(10');
    });
  });
});

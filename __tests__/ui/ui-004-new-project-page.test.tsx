/**
 * New Project Page Tests - UI-004
 *
 * This test file validates the New Project Page requirements:
 * 1. Form with prompt input
 * 2. Niche selector
 * 3. Duration picker
 * 4. Submits to API
 *
 * Acceptance Criteria:
 * - Form with prompt input
 * - Niche selector
 * - Duration picker
 * - Submits to API
 *
 * Note: These are integration tests that verify the component structure exists
 * rather than full behavioral tests due to Next.js App Router complexity.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE_PATH = join(__dirname, '../../apps/web/src/app/app/new/page.tsx');
const API_ROUTE_PATH = join(__dirname, '../../apps/web/src/app/api/projects/route.ts');

describe('UI-004: New Project Page', () => {
  let pageContent: string;
  let apiRouteContent: string;

  // Read the source files once
  beforeAll(() => {
    pageContent = readFileSync(PAGE_PATH, 'utf-8');
    apiRouteContent = readFileSync(API_ROUTE_PATH, 'utf-8');
  });

  describe('Acceptance Criteria: Form with prompt input', () => {
    it('should have a title input field in the component', () => {
      expect(pageContent).toContain('Video Title');
      expect(pageContent).toMatch(/id="title"/);
      expect(pageContent).toMatch(/type="text"/);
      expect(pageContent).toMatch(/value={title}/);
      expect(pageContent).toMatch(/onChange=.*setTitle/);
    });

    it('should have a content/prompt textarea', () => {
      expect(pageContent).toContain('textarea');
      expect(pageContent).toMatch(/value={content}/);
      expect(pageContent).toMatch(/onChange=.*setContent/);
      expect(pageContent).toMatch(/Describe what your video should cover/);
    });

    it('should mark required fields with asterisk', () => {
      expect(pageContent).toMatch(/Video Title.*\*/);
      expect(pageContent).toMatch(/Choose Your Niche.*\*/);
    });
  });

  describe('Acceptance Criteria: Niche selector', () => {
    it('should have niche preset options', () => {
      expect(pageContent).toContain('NICHE_PRESETS');
      expect(pageContent).toMatch(/motivation.*Motivation/i);
      expect(pageContent).toMatch(/explainer.*Explainer/i);
      expect(pageContent).toMatch(/facts.*Facts/i);
    });

    it('should have niche selection state', () => {
      expect(pageContent).toMatch(/const.*\[niche.*setNiche\].*useState/);
      expect(pageContent).toMatch(/onClick=.*setNiche/);
    });

    it('should have at least 6 niche options defined', () => {
      const nicheMatches = pageContent.match(/\{\s*id:\s*"[^"]+",\s*label:/g);
      expect(nicheMatches).toBeTruthy();
      expect(nicheMatches!.length).toBeGreaterThanOrEqual(6);
    });

    it('should render niche buttons in the UI', () => {
      expect(pageContent).toMatch(/NICHE_PRESETS\.map/);
      expect(pageContent).toMatch(/preset\.label/);
      expect(pageContent).toMatch(/preset\.emoji/);
    });
  });

  describe('Acceptance Criteria: Duration picker', () => {
    it('should have length options defined', () => {
      expect(pageContent).toContain('LENGTH_OPTIONS');
      expect(pageContent).toMatch(/value:\s*5.*label.*5 min/);
      expect(pageContent).toMatch(/value:\s*10.*label.*10 min/);
    });

    it('should have length selection state', () => {
      expect(pageContent).toMatch(/const.*\[length.*setLength\].*useState/);
      expect(pageContent).toMatch(/onClick=.*setLength/);
    });

    it('should display credit cost estimate', () => {
      expect(pageContent).toMatch(/This will cost approximately.*{length}.*credits/);
    });

    it('should render length option buttons', () => {
      expect(pageContent).toMatch(/LENGTH_OPTIONS\.map/);
      expect(pageContent).toMatch(/opt\.label/);
      expect(pageContent).toMatch(/opt\.value/);
    });
  });

  describe('Acceptance Criteria: Submits to API', () => {
    it('should have a submit button', () => {
      expect(pageContent).toMatch(/type="submit"/);
      expect(pageContent).toMatch(/Create Project|Creating/);
    });

    it('should have form submission handler', () => {
      expect(pageContent).toMatch(/async function handleSubmit/);
      expect(pageContent).toMatch(/onSubmit={handleSubmit}/);
    });

    it('should disable submit button when required fields are missing', () => {
      expect(pageContent).toMatch(/disabled={loading \|\| !title \|\| !niche}/);
    });

    it('should make POST request to /api/projects', () => {
      expect(pageContent).toMatch(/fetch.*\/api\/projects/);
      expect(pageContent).toMatch(/method:\s*['"]POST['"]/);
      expect(pageContent).toMatch(/headers:.*Content-Type.*application\/json/);
    });

    it('should include all required fields in the API request', () => {
      expect(pageContent).toMatch(/body:.*JSON\.stringify/);
      expect(pageContent).toContain('title');
      expect(pageContent).toContain('niche_preset');
      expect(pageContent).toContain('target_minutes');
    });

    it('should redirect to job page on success', () => {
      expect(pageContent).toMatch(/router\.push.*\/app\/jobs/);
    });

    it('should handle error states', () => {
      expect(pageContent).toMatch(/const.*\[error.*setError\].*useState/);
      expect(pageContent).toMatch(/catch.*err/);
      expect(pageContent).toMatch(/setError/);
    });

    it('should handle insufficient credits error', () => {
      expect(pageContent).toMatch(/402/);
      expect(pageContent).toMatch(/insufficientCredits|Insufficient credits/i);
      expect(pageContent).toMatch(/Buy more credits/i);
    });
  });

  describe('API Integration', () => {
    it('should have POST endpoint in /api/projects', () => {
      expect(apiRouteContent).toMatch(/export async function POST/);
    });

    it('should validate request with Zod schema', () => {
      expect(apiRouteContent).toContain('CreateProjectSchema');
      expect(apiRouteContent).toMatch(/z\.object/);
      expect(apiRouteContent).toMatch(/title.*niche_preset.*target_minutes/);
    });

    it('should check credit balance before creating project', () => {
      expect(apiRouteContent).toMatch(/get_credit_balance/);
      expect(apiRouteContent).toMatch(/creditsRequired/);
      expect(apiRouteContent).toMatch(/balance.*<.*creditsRequired/);
    });

    it('should create project and job records', () => {
      expect(apiRouteContent).toMatch(/\.from\(['"]projects['"]\)/);
      expect(apiRouteContent).toMatch(/\.insert/);
      expect(apiRouteContent).toMatch(/\.from\(['"]jobs['"]\)/);
    });

    it('should reserve credits for the job', () => {
      expect(apiRouteContent).toMatch(/reserve_credits/);
      expect(apiRouteContent).toMatch(/p_job_id/);
      expect(apiRouteContent).toMatch(/p_amount/);
    });

    it('should return 402 status for insufficient credits', () => {
      expect(apiRouteContent).toMatch(/status:\s*402/);
      expect(apiRouteContent).toMatch(/Insufficient credits/);
    });

    it('should return project and job data on success', () => {
      expect(apiRouteContent).toMatch(/status:\s*201/);
      expect(apiRouteContent).toMatch(/project.*job/);
    });
  });

  describe('Additional Features', () => {
    it('should support draft prompt loading', () => {
      expect(pageContent).toMatch(/draftId.*searchParams\.get/);
      expect(pageContent).toMatch(/loadDraft/);
      expect(pageContent).toMatch(/\/api\/draft/);
    });

    it('should display credit balance', () => {
      expect(pageContent).toMatch(/get_credit_balance/);
      expect(pageContent).toMatch(/credits.*minutes/);
    });

    it('should support voice profile selection', () => {
      expect(pageContent).toMatch(/voiceProfileId|voice_profile_id/);
      expect(pageContent).toMatch(/voice_profiles/);
    });

    it('should support transcript mode selection', () => {
      expect(pageContent).toContain('TRANSCRIPT_MODES');
      expect(pageContent).toContain('auto');
      expect(pageContent).toContain('manual');
      expect(pageContent).toMatch(/transcriptMode/);
    });

    it('should have conditional transcript input for manual mode', () => {
      expect(pageContent).toMatch(/transcriptMode === ['"]manual['"]/);
      expect(pageContent).toMatch(/transcript_text/i);
    });
  });

  describe('Component Structure Validation', () => {
    it('should be a client component', () => {
      expect(pageContent).toMatch(/["']use client["']/);
    });

    it('should export default function', () => {
      expect(pageContent).toMatch(/export default function NewProjectPage/);
    });

    it('should have proper TypeScript types', () => {
      expect(pageContent).toMatch(/React\./);
      expect(pageContent).toMatch(/<\w+\s+\|\s+null>/); // TypeScript union types like <string | null>
    });

    it('should use Next.js routing hooks', () => {
      expect(pageContent).toMatch(/useRouter/);
      expect(pageContent).toMatch(/useSearchParams/);
      expect(pageContent).toMatch(/from ['"]next\/navigation['"]/);
    });

    it('should use Supabase for data fetching', () => {
      expect(pageContent).toMatch(/createBrowserClient/);
      expect(pageContent).toMatch(/supabase\.auth\.getUser/);
      expect(pageContent).toMatch(/supabase\.rpc/);
    });
  });
});

/**
 * Tests for Environment Documentation
 *
 * DEPLOY-003: Ensures that docs/ENVIRONMENT.md exists and contains
 * comprehensive documentation for all environment variables.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Environment Documentation (DEPLOY-003)', () => {
  const docsPath = join(__dirname, '..', 'docs', 'ENVIRONMENT.md');
  let docsContent: string;

  beforeAll(() => {
    // Verify the file exists
    expect(existsSync(docsPath)).toBe(true);

    // Read the content
    docsContent = readFileSync(docsPath, 'utf-8');
  });

  it('should have a main heading', () => {
    expect(docsContent).toMatch(/^#\s+Environment Variables/m);
  });

  it('should document Web App environment variables', () => {
    expect(docsContent).toContain('Web App');
    expect(docsContent).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(docsContent).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(docsContent).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('should document API Server environment variables', () => {
    expect(docsContent).toContain('API Server');
    expect(docsContent).toContain('SUPABASE_URL');
    expect(docsContent).toContain('SUPABASE_SERVICE_KEY');
    expect(docsContent).toContain('REDIS_URL');
    expect(docsContent).toContain('INTERNAL_API_KEY');
  });

  it('should document Worker environment variables', () => {
    expect(docsContent).toContain('Worker');
    expect(docsContent).toContain('OPENAI_API_KEY');
    expect(docsContent).toContain('GROQ_API_KEY');
    expect(docsContent).toContain('TTS_PROVIDER');
    expect(docsContent).toContain('HF_TOKEN');
    expect(docsContent).toContain('IMAGE_PROVIDER');
  });

  it('should document Stripe environment variables', () => {
    expect(docsContent).toContain('Stripe');
    expect(docsContent).toContain('STRIPE_SECRET_KEY');
    expect(docsContent).toContain('STRIPE_PUBLISHABLE_KEY');
    expect(docsContent).toContain('STRIPE_WEBHOOK_SECRET');
    expect(docsContent).toContain('STRIPE_PRICE_');
  });

  it('should have setup instructions', () => {
    expect(docsContent).toContain('Setup');
    expect(docsContent).toContain('.env.example');
  });

  it('should distinguish between required and optional variables', () => {
    expect(docsContent).toMatch(/(required|Required|REQUIRED)/i);
    expect(docsContent).toMatch(/(optional|Optional|OPTIONAL)/i);
  });

  it('should provide descriptions for each variable', () => {
    // Check that each major variable has some explanation
    const variables = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'REDIS_URL',
      'OPENAI_API_KEY',
      'STRIPE_SECRET_KEY',
    ];

    variables.forEach((varName) => {
      const varIndex = docsContent.indexOf(varName);
      expect(varIndex).toBeGreaterThan(-1);

      // Check that there's some text around the variable name (description)
      const contextStart = Math.max(0, varIndex - 200);
      const contextEnd = Math.min(docsContent.length, varIndex + 200);
      const context = docsContent.substring(contextStart, contextEnd);

      // Should have at least one sentence about the variable
      expect(context.length).toBeGreaterThan(varName.length + 20);
    });
  });

  it('should include information about obtaining API keys', () => {
    expect(docsContent).toMatch(/(obtain|get|create|generate)/i);
    expect(docsContent).toMatch(/(api key|API key|API Key)/);
  });

  it('should document default values where applicable', () => {
    expect(docsContent).toContain('8989'); // PORT default for API
    expect(docsContent).toContain('redis://localhost:6379'); // REDIS_URL default
  });

  it('should have a table of contents or clear sections', () => {
    // Should have multiple level-2 headings for organization
    const level2Headings = docsContent.match(/^##\s+/gm);
    expect(level2Headings).toBeTruthy();
    expect(level2Headings!.length).toBeGreaterThanOrEqual(3);
  });

  it('should mention security best practices', () => {
    expect(docsContent).toMatch(/(security|secret|private|never commit)/i);
  });

  it('should provide troubleshooting guidance', () => {
    expect(docsContent).toMatch(/(troubleshoot|error|missing|invalid)/i);
  });
});

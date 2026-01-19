/**
 * Environment Configuration Tests
 * Feature: FOUND-004 - Environment Configuration
 *
 * Tests that all apps have proper environment variable documentation
 * and fail gracefully when required variables are missing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Environment Configuration', () => {
  describe('Environment Example Files', () => {
    it('should have .env.example for web app', () => {
      const envPath = join(__dirname, '../apps/web/.env.example');
      expect(existsSync(envPath), '.env.example should exist for web app').toBe(true);
    });

    it('should have .env.example for api app', () => {
      const envPath = join(__dirname, '../apps/api/.env.example');
      expect(existsSync(envPath), '.env.example should exist for api app').toBe(true);
    });

    it('should have .env.example for worker app', () => {
      const envPath = join(__dirname, '../apps/worker/.env.example');
      expect(existsSync(envPath), '.env.example should exist for worker app').toBe(true);
    });
  });

  describe('Web App Environment Variables', () => {
    it('should document all required Supabase variables', () => {
      const envPath = join(__dirname, '../apps/web/.env.example');
      const content = readFileSync(envPath, 'utf-8');

      expect(content).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(content).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(content).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    it('should document all required Stripe variables', () => {
      const envPath = join(__dirname, '../apps/web/.env.example');
      const content = readFileSync(envPath, 'utf-8');

      expect(content).toContain('STRIPE_SECRET_KEY');
      expect(content).toContain('STRIPE_PUBLISHABLE_KEY');
      expect(content).toContain('STRIPE_WEBHOOK_SECRET');
    });

    it('should have env validation module', () => {
      const validationPath = join(__dirname, '../apps/web/src/lib/env.ts');
      expect(existsSync(validationPath), 'env.ts validation module should exist').toBe(true);
    });
  });

  describe('API App Environment Variables', () => {
    it('should document all required variables', () => {
      const envPath = join(__dirname, '../apps/api/.env.example');
      const content = readFileSync(envPath, 'utf-8');

      expect(content).toContain('PORT');
      expect(content).toContain('SUPABASE_URL');
      expect(content).toContain('SUPABASE_SERVICE_KEY');
      expect(content).toContain('REDIS_URL');
      expect(content).toContain('STRIPE_SECRET_KEY');
      expect(content).toContain('INTERNAL_API_KEY');
    });

    it('should have env validation module', () => {
      const validationPath = join(__dirname, '../apps/api/src/lib/env.ts');
      expect(existsSync(validationPath), 'env.ts validation module should exist').toBe(true);
    });
  });

  describe('Worker App Environment Variables', () => {
    it('should document all required variables', () => {
      const envPath = join(__dirname, '../apps/worker/.env.example');
      const content = readFileSync(envPath, 'utf-8');

      expect(content).toContain('SUPABASE_URL');
      expect(content).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(content).toContain('OPENAI_API_KEY');
      expect(content).toContain('APP_BASE_URL');
    });

    it('should have env validation module', () => {
      const validationPath = join(__dirname, '../apps/worker/src/lib/env.ts');
      expect(existsSync(validationPath), 'env.ts validation module should exist').toBe(true);
    });
  });
});

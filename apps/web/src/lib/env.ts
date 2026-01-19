/**
 * Web App Environment Variable Validation
 *
 * This module validates that all required environment variables are present
 * and provides helpful error messages when they're missing.
 */

type EnvVar = {
  name: string;
  required: boolean;
  description: string;
};

const requiredEnvVars: EnvVar[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous/public key',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (keep secret)',
  },
];

const optionalEnvVars: EnvVar[] = [
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    description: 'Stripe secret key (required for payments)',
  },
  {
    name: 'STRIPE_PUBLISHABLE_KEY',
    required: false,
    description: 'Stripe publishable key',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    description: 'Stripe webhook secret',
  },
  {
    name: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key (required for email)',
  },
  {
    name: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key',
  },
];

/**
 * Validates environment variables and throws helpful error if missing
 */
export function validateEnv(): void {
  const missing: EnvVar[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar.name]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    const errorMessage = [
      '❌ Missing required environment variables:',
      '',
      ...missing.map(
        (v) => `  - ${v.name}: ${v.description}`
      ),
      '',
      '📝 To fix this:',
      '  1. Copy apps/web/.env.example to apps/web/.env.local',
      '  2. Fill in the required values',
      '  3. Restart the development server',
      '',
    ].join('\n');

    throw new Error(errorMessage);
  }
}

/**
 * Get an environment variable with a fallback
 */
export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (!value && fallback === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || fallback || '';
}

/**
 * Check if optional features are enabled based on env vars
 */
export const featureFlags = {
  hasStripe: !!process.env.STRIPE_SECRET_KEY,
  hasEmail: !!process.env.RESEND_API_KEY,
  hasOpenAI: !!process.env.OPENAI_API_KEY,
};

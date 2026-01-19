/**
 * Worker Environment Variable Validation
 *
 * This module validates that all required environment variables are present
 * and provides helpful error messages when they're missing.
 */

type EnvVar = {
  name: string;
  required: boolean;
  description: string;
  default?: string;
};

const requiredEnvVars: EnvVar[] = [
  {
    name: 'SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key',
  },
  {
    name: 'OPENAI_API_KEY',
    required: true,
    description: 'OpenAI API key for GPT, TTS, and image generation',
  },
  {
    name: 'APP_BASE_URL',
    required: true,
    description: 'Base URL of the web app for notifications',
  },
];

const optionalEnvVars: EnvVar[] = [
  {
    name: 'WORKER_ID',
    required: false,
    description: 'Unique worker identifier',
  },
  {
    name: 'POLL_INTERVAL_MS',
    required: false,
    description: 'Job polling interval in milliseconds',
    default: '800',
  },
  {
    name: 'MAX_ACTIVE_PER_USER',
    required: false,
    description: 'Maximum active jobs per user',
    default: '1',
  },
  {
    name: 'GROQ_API_KEY',
    required: false,
    description: 'Groq API key for transcription',
  },
  {
    name: 'TTS_PROVIDER',
    required: false,
    description: 'TTS provider (indextts, openai, or mock)',
    default: 'indextts',
  },
  {
    name: 'HF_TOKEN',
    required: false,
    description: 'Hugging Face token for IndexTTS-2',
  },
  {
    name: 'IMAGE_PROVIDER',
    required: false,
    description: 'Image generation provider',
    default: 'openai',
  },
  {
    name: 'REMOTION_CONCURRENCY',
    required: false,
    description: 'Remotion rendering concurrency',
    default: '2',
  },
  {
    name: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key for email notifications',
  },
];

/**
 * Validates environment variables and throws helpful error if missing
 */
export function validateEnv(): void {
  const missing: EnvVar[] = [];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    if (!value && !envVar.default) {
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
      '  1. Copy apps/worker/.env.example to apps/worker/.env',
      '  2. Fill in the required values',
      '  3. Restart the worker',
      '',
    ].join('\n');

    console.error(errorMessage);
    process.exit(1);
  }
}

/**
 * Get an environment variable with a fallback
 */
export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];

  // Check if there's a default defined
  const envVar = [...requiredEnvVars, ...optionalEnvVars].find(v => v.name === key);
  if (envVar?.default && !value) {
    return envVar.default;
  }

  if (!value && fallback === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || fallback || '';
}

/**
 * Get numeric environment variable
 */
export function getEnvNumber(key: string, fallback?: number): number {
  const value = getEnv(key, fallback?.toString());
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return num;
}

/**
 * Check if optional features are enabled based on env vars
 */
export const featureFlags = {
  hasGroq: !!process.env.GROQ_API_KEY,
  hasHuggingFace: !!process.env.HF_TOKEN,
  ttsProvider: process.env.TTS_PROVIDER || 'indextts',
  imageProvider: process.env.IMAGE_PROVIDER || 'openai',
};

# Environment Variables

This document provides comprehensive documentation for all environment variables used across the CanvasCast platform. Each service (Web App, API Server, Worker) has its own set of required and optional environment variables.

---

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Web App Environment Variables](#web-app-environment-variables)
3. [API Server Environment Variables](#api-server-environment-variables)
4. [Worker Environment Variables](#worker-environment-variables)
5. [Shared Variables](#shared-variables)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Quick Setup

Each app has an `.env.example` file that you can copy to get started:

```bash
# Web App
cp apps/web/.env.example apps/web/.env.local

# API Server
cp apps/api/.env.example apps/api/.env

# Worker
cp apps/worker/.env.example apps/worker/.env
```

After copying, fill in the required values and restart the respective services.

---

## Web App Environment Variables

**Location:** `apps/web/.env.local`

### Required Variables

| Variable | Description | Example | How to Obtain |
|----------|-------------|---------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) | `https://xxx.supabase.co` | From Supabase dashboard or `supabase status` for local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJ...` | From Supabase dashboard under Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, keep secret) | `eyJ...` | From Supabase dashboard under Settings > API |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `PORT` | Web app server port | `3838` | - |
| `APP_BASE_URL` | Base URL of the application | `http://localhost:3838` | Used for callbacks and email links |
| `INTERNAL_NOTIFY_SECRET` | Secret for internal notification webhooks | - | Should match the worker's `INTERNAL_NOTIFY_SECRET` |
| `STRIPE_SECRET_KEY` | Stripe secret key | - | Required for payment processing. Get from [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | - | Required for client-side Stripe integration |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_xxxxx` | From Stripe webhook configuration |
| `STRIPE_PRICE_PACK_25` | Stripe Price ID for 25-credit pack | `price_xxxxx` | Create products in Stripe Dashboard |
| `STRIPE_PRICE_PACK_80` | Stripe Price ID for 80-credit pack | `price_xxxxx` | Create products in Stripe Dashboard |
| `STRIPE_PRICE_PACK_250` | Stripe Price ID for 250-credit pack | `price_xxxxx` | Create products in Stripe Dashboard |
| `STRIPE_PRICE_PACK_500` | Stripe Price ID for 500-credit pack | `price_xxxxx` | Create products in Stripe Dashboard |
| `STRIPE_PRICE_STARTER` | Stripe Price ID for Starter subscription | `price_xxxxx` | Create subscription in Stripe Dashboard |
| `STRIPE_PRICE_PRO` | Stripe Price ID for Pro subscription | `price_xxxxx` | Create subscription in Stripe Dashboard |
| `STRIPE_PRICE_CREATOR_PLUS` | Stripe Price ID for Creator Plus subscription | `price_xxxxx` | Create subscription in Stripe Dashboard |
| `RESEND_API_KEY` | Resend API key for email notifications | `re_...` | Get from [Resend Dashboard](https://resend.com/api-keys) |
| `RESEND_FROM` | Email sender address | `"CanvasCast <hello@canvascast.com>"` | Must be a verified domain in Resend |
| `OPENAI_API_KEY` | OpenAI API key (if needed client-side) | `sk-...` | Get from [OpenAI Dashboard](https://platform.openai.com/api-keys) |

---

## API Server Environment Variables

**Location:** `apps/api/.env`

### Required Variables

| Variable | Description | Example | How to Obtain |
|----------|-------------|---------|---------------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` | From Supabase dashboard or `supabase status` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` | From Supabase dashboard under Settings > API |
| `REDIS_URL` | Redis connection URL for BullMQ | `redis://localhost:6379` | Local Redis or cloud provider URL |
| `INTERNAL_API_KEY` | Secret key for worker-to-API authentication | `your-internal-key` | Generate a random secret (e.g., `openssl rand -hex 32`) |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `PORT` | API server port | `8989` | - |
| `NODE_ENV` | Node environment | `development` | Set to `production` in production |
| `STRIPE_SECRET_KEY` | Stripe secret key | - | Required for payment endpoints |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | - | Required for webhook verification |
| `REGISTRY_URL` | Service registry URL (optional) | - | For service discovery in distributed setups |

---

## Worker Environment Variables

**Location:** `apps/worker/.env`

### Required Variables

| Variable | Description | Example | How to Obtain |
|----------|-------------|---------|---------------|
| `SUPABASE_URL` | Supabase project URL | `http://127.0.0.1:54321` | From Supabase dashboard or `supabase status` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` | From Supabase dashboard |
| `OPENAI_API_KEY` | OpenAI API key for GPT, TTS, and image generation | `sk-...` | Get from [OpenAI Dashboard](https://platform.openai.com/api-keys) |
| `APP_BASE_URL` | Base URL of the web app | `http://localhost:3838` | Used for generating links in notifications |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `WORKER_ID` | Unique identifier for this worker instance | `worker-1` | Useful for multi-worker setups |
| `POLL_INTERVAL_MS` | Job polling interval in milliseconds | `800` | How often to check for new jobs |
| `MAX_ACTIVE_PER_USER` | Maximum concurrent jobs per user | `1` | Prevents resource exhaustion |
| `GROQ_API_KEY` | Groq API key for fast transcription (FREE tier available) | `gsk_...` | Get from [Groq Console](https://console.groq.com/) |
| `OPENAI_MODEL` | OpenAI model for script generation | `gpt-4o-mini` | Options: `gpt-4o-mini`, `gpt-4`, `gpt-3.5-turbo` |
| `OPENAI_TTS_VOICE` | OpenAI TTS voice | `onyx` | Options: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` |
| `TTS_PROVIDER` | TTS provider to use | `indextts` | Options: `indextts` (voice cloning), `openai`, `mock` (testing) |
| `HF_TOKEN` | Hugging Face API token for IndexTTS-2 voice cloning | `hf_...` | Get from [Hugging Face Settings](https://huggingface.co/settings/tokens) |
| `HF_INDEXTTS_SPACE` | Hugging Face Space for IndexTTS | `Heartsync/IndexTTS-2` | Usually doesn't need to be changed |
| `IMAGE_PROVIDER` | Image generation provider | `openai` | Options: `openai` (DALL-E), or future providers |
| `DALLE_SIZE` | DALL-E image size | `1024x1024` | Options: `1024x1024`, `1792x1024`, `1024x1792` |
| `DALLE_QUALITY` | DALL-E image quality | `standard` | Options: `standard`, `hd` |
| `REMOTION_CONCURRENCY` | Number of parallel rendering processes | `2` | Higher values use more CPU/memory |
| `INTERNAL_NOTIFY_SECRET` | Secret for sending notifications to web app | - | Should match web app's secret |
| `RESEND_API_KEY` | Resend API key for email notifications | `re_...` | Optional if emails are disabled |

---

## Shared Variables

These variables appear across multiple services and should be kept in sync:

| Variable | Used In | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | All services | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Web, API, Worker | Server-side Supabase authentication |
| `INTERNAL_NOTIFY_SECRET` / `INTERNAL_API_KEY` | Web, Worker, API | Internal service authentication |
| `APP_BASE_URL` | Web, Worker | Base URL for the web application |

---

## Security Best Practices

### Never Commit Secrets

All `.env` and `.env.local` files are excluded from version control via `.gitignore`. Never commit these files or any files containing secrets.

### Use Different Keys for Environments

Use separate API keys and secrets for:
- Local development
- Staging
- Production

### Rotate Secrets Regularly

Periodically rotate sensitive credentials, especially:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `INTERNAL_API_KEY`
- `OPENAI_API_KEY`

### Limit Service Role Key Usage

The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security (RLS). Only use it in server-side code, never in client-side code.

### Validate Webhooks

Always verify webhook signatures:
- Stripe webhooks use `STRIPE_WEBHOOK_SECRET`
- Internal webhooks use `INTERNAL_NOTIFY_SECRET`

### Environment Variable Validation

Each service validates required environment variables on startup. If a required variable is missing, the service will fail to start with a helpful error message.

---

## Troubleshooting

### Missing Required Variables

**Error:** `Missing required environment variable: SUPABASE_URL`

**Solution:**
1. Check that you've copied the `.env.example` file to the correct location
2. Ensure all required variables are filled in
3. Restart the service after updating environment variables

### Invalid API Keys

**Error:** `401 Unauthorized` or `Invalid API key`

**Solution:**
1. Verify the API key is correct and hasn't expired
2. Check that you're using the right key for the environment (test vs. production)
3. Ensure there are no extra spaces or quotes around the key value

### Supabase Connection Issues

**Error:** `Failed to connect to Supabase`

**Solution:**
1. For local development, ensure Supabase is running: `pnpm supabase start`
2. Verify the URL format is correct (should start with `http://` or `https://`)
3. Check that the anon key and service role key match the URL's project

### Stripe Webhook Verification Failed

**Error:** `Webhook signature verification failed`

**Solution:**
1. Ensure `STRIPE_WEBHOOK_SECRET` matches the secret from your Stripe webhook configuration
2. Check that the webhook endpoint URL in Stripe dashboard is correct
3. Verify the webhook is not being modified by proxies or load balancers

### Redis Connection Failed

**Error:** `Could not connect to Redis`

**Solution:**
1. Ensure Redis is running: `redis-cli ping` should return `PONG`
2. Check the `REDIS_URL` format: `redis://hostname:port`
3. For cloud Redis, verify firewall rules allow connections

### OpenAI Rate Limits

**Error:** `Rate limit exceeded`

**Solution:**
1. Check your OpenAI usage and limits in the [OpenAI Dashboard](https://platform.openai.com/usage)
2. Consider upgrading your OpenAI plan
3. Implement request throttling in the worker

### TTS Provider Issues

**Error:** `TTS generation failed`

**Solution:**
1. If using `indextts`, ensure `HF_TOKEN` is valid
2. Check Hugging Face Spaces status
3. Fallback to `openai` provider if needed: set `TTS_PROVIDER=openai`
4. Use `mock` provider for testing without actual TTS: `TTS_PROVIDER=mock`

### Environment File Not Loaded

**Error:** Variables are undefined at runtime

**Solution:**
1. Web App: Ensure the file is named `.env.local` (not `.env`)
2. API/Worker: Ensure the file is named `.env`
3. Restart the service after creating/modifying the file
4. Check file permissions (should be readable)

---

## Getting API Keys

### Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to Settings > API
3. Copy the URL, anon key, and service role key

For local development:
```bash
pnpm supabase start
pnpm supabase status  # Shows local URLs and keys
```

### OpenAI
1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Go to API Keys section
3. Create a new secret key
4. Add credits to your account for usage

### Stripe
1. Create account at [stripe.com](https://stripe.com)
2. Go to Developers > API keys
3. Use test keys for development
4. Create products and copy price IDs

### Groq (Optional, for faster transcription)
1. Sign up at [console.groq.com](https://console.groq.com)
2. Generate an API key
3. Free tier available with generous limits

### Hugging Face (Optional, for voice cloning)
1. Create account at [huggingface.co](https://huggingface.co)
2. Go to Settings > Access Tokens
3. Create a new token with read access

### Resend (Optional, for emails)
1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain
3. Create an API key

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [BullMQ Documentation](https://docs.bullmq.io/)

---

For service-specific environment variable validation code, see:
- `apps/web/src/lib/env.ts`
- `apps/api/src/lib/env.ts`
- `apps/worker/src/lib/env.ts`

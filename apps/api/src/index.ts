import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { config } from 'dotenv';
import os from 'os';

config();

const app: express.Application = express();
const PORT = process.env.PORT || 8989;

// Service identification
const SERVICE_NAME = 'canvascast-api';
const RUN_ID = `${SERVICE_NAME}-${uuidv4().slice(0, 8)}`;
const INSTANCE_ID = `${os.hostname()}:${PORT}`;
const startTimestamp = Date.now();

// Niche presets for video generation
const NICHE_PRESETS = {
  motivation: { name: 'Motivation', creditsPerMinute: 1 },
  explainer: { name: 'Explainer', creditsPerMinute: 1 },
  facts: { name: 'Facts & Trivia', creditsPerMinute: 1 },
  documentary: { name: 'Documentary', creditsPerMinute: 1.5 },
  finance: { name: 'Finance', creditsPerMinute: 1 },
  tech: { name: 'Tech', creditsPerMinute: 1 },
  history: { name: 'History', creditsPerMinute: 1.5 },
  science: { name: 'Science', creditsPerMinute: 1 },
};

// Redis connection
let redisConnected = false;
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  lazyConnect: true,
  enableOfflineQueue: false,
});

redis.on('connect', () => {
  console.log('[REDIS] ✅ Connected');
  redisConnected = true;
});

redis.on('error', (err: Error) => {
  console.error('[REDIS] ❌ Connection error:', err.message);
  redisConnected = false;
});

redis.on('close', () => {
  console.log('[REDIS] 🔌 Connection closed');
  redisConnected = false;
});

redis.connect().catch((err: Error) => {
  console.error('[REDIS] ❌ Initial connection failed:', err.message);
});

// Job queue - use URL string to avoid ioredis version conflicts
const jobQueue = new Queue('video-generation', {
  connection: {
    host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
    port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
console.log('[QUEUE] ✅ Job queue initialized');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// File upload config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for voice samples
});

// Auth middleware
interface AuthenticatedRequest extends express.Request {
  user?: { id: string; email?: string };
}

async function authenticateToken(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token validation failed' });
  }
}

// Health endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, uptime: Date.now() - startTimestamp });
});

app.get('/ready', async (req, res) => {
  const checks = {
    redis: redisConnected,
    supabase: false,
  };

  try {
    const { error } = await supabase.from('projects').select('id').limit(1);
    checks.supabase = !error;
  } catch {}

  const allReady = Object.values(checks).every(Boolean);
  res.status(allReady ? 200 : 503).json({ ready: allReady, checks });
});

// ═══════════════════════════════════════════════════════════════════
// PROJECT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

// Create project and queue video generation job
app.post('/api/v1/projects', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, niche_preset, target_minutes, content, voice_profile_id } = req.body;
    const userId = req.user!.id;

    // Validate niche
    if (!niche_preset || !NICHE_PRESETS[niche_preset as keyof typeof NICHE_PRESETS]) {
      return res.status(400).json({ error: 'Invalid niche preset' });
    }

    const preset = NICHE_PRESETS[niche_preset as keyof typeof NICHE_PRESETS];
    const creditsRequired = Math.ceil((target_minutes || 10) * preset.creditsPerMinute);

    // Check user credit balance
    const { data: balanceData, error: balanceError } = await supabase
      .rpc('get_credit_balance', { p_user_id: userId });

    if (balanceError) {
      console.error('[API] Error checking balance:', balanceError);
      return res.status(500).json({ error: 'Failed to check credit balance' });
    }

    const balance = balanceData || 0;
    if (balance < creditsRequired) {
      return res.status(402).json({
        error: 'Insufficient credits',
        required: creditsRequired,
        available: balance,
      });
    }

    // Create project
    const projectId = uuidv4();
    const { error: projectError } = await supabase.from('projects').insert({
      id: projectId,
      user_id: userId,
      title: title || 'Untitled Project',
      niche_preset,
      target_minutes: target_minutes || 10,
      status: 'draft',
    });

    if (projectError) {
      console.error('[API] Error creating project:', projectError);
      return res.status(500).json({ error: 'Failed to create project' });
    }

    // Create job
    const jobId = uuidv4();
    const { error: jobError } = await supabase.from('jobs').insert({
      id: jobId,
      project_id: projectId,
      user_id: userId,
      status: 'QUEUED',
      cost_credits_reserved: creditsRequired,
    });

    if (jobError) {
      console.error('[API] Error creating job:', jobError);
      return res.status(500).json({ error: 'Failed to create job' });
    }

    // Reserve credits
    const { error: reserveError } = await supabase.rpc('reserve_credits', {
      p_user_id: userId,
      p_job_id: jobId,
      p_amount: creditsRequired,
    });

    if (reserveError) {
      console.error('[API] Error reserving credits:', reserveError);
      // Cleanup
      await supabase.from('jobs').delete().eq('id', jobId);
      await supabase.from('projects').delete().eq('id', projectId);
      return res.status(402).json({ error: 'Failed to reserve credits', details: reserveError.message });
    }

    // Queue job for processing (if Redis available)
    if (jobQueue) {
      await jobQueue.add('generate-video', {
        jobId,
        projectId,
        userId,
        title,
        nichePreset: niche_preset,
        targetMinutes: target_minutes || 10,
        content,
        voiceProfileId: voice_profile_id,
      }, { jobId });
      console.log(`[API] ✅ Queued video generation job ${jobId}`);
    }

    res.status(201).json({
      project: { id: projectId, title, niche_preset, target_minutes, status: 'draft' },
      job: { id: jobId, status: 'QUEUED', credits_reserved: creditsRequired },
    });
  } catch (error) {
    console.error('[API] Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get user's projects
app.get('/api/v1/projects', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*, jobs(*)')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    res.json({ projects: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
app.get('/api/v1/projects/:projectId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*, jobs(*), assets(*)')
      .eq('id', req.params.projectId)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// VOICE PROFILE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

// Upload voice samples
app.post('/api/v1/voice-profiles', authenticateToken, upload.array('samples', 5), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No voice samples provided' });
    }

    const profileId = uuidv4();

    // Upload samples to Supabase Storage
    const uploadPromises = files.map(async (file, index) => {
      const path = `${userId}/${profileId}/sample_${index}.${file.mimetype.split('/')[1] || 'mp3'}`;
      const { error } = await supabase.storage
        .from('voice-samples')
        .upload(path, file.buffer, { contentType: file.mimetype });
      if (error) throw error;
      return path;
    });

    const samplePaths = await Promise.all(uploadPromises);

    // Create voice profile
    const { error: profileError } = await supabase.from('voice_profiles').insert({
      id: profileId,
      user_id: userId,
      name: name || 'My Voice',
      status: 'pending',
      samples_path: samplePaths.join(','),
    });

    if (profileError) {
      return res.status(500).json({ error: 'Failed to create voice profile' });
    }

    res.status(201).json({
      voice_profile: { id: profileId, name, status: 'pending' },
      message: 'Voice samples uploaded. Processing will begin shortly.',
    });
  } catch (error) {
    console.error('[API] Error uploading voice samples:', error);
    res.status(500).json({ error: 'Failed to upload voice samples' });
  }
});

// Get user's voice profiles
app.get('/api/v1/voice-profiles', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch voice profiles' });
    }

    res.json({ voice_profiles: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch voice profiles' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// CREDITS & STRIPE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

// Get credit balance
app.get('/api/v1/credits/balance', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_credit_balance', { p_user_id: req.user!.id });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch balance' });
    }

    res.json({ balance: data || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Get credit history
app.get('/api/v1/credits/history', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('credit_ledger')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    res.json({ transactions: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Create Stripe checkout session for credit purchase
app.post('/api/v1/credits/purchase', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { credits, price_id } = req.body;
    const userId = req.user!.id;

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || req.user?.email,
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price: price_id,
        quantity: 1,
      }],
      metadata: {
        user_id: userId,
        credits: credits.toString(),
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/credits?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/credits?canceled=true`,
    });

    res.json({ checkout_url: session.url });
  } catch (error) {
    console.error('[API] Stripe error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook handler
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits || '0', 10);

      if (userId && credits > 0) {
        await supabase.rpc('add_credits', {
          p_user_id: userId,
          p_amount: credits,
          p_type: 'purchase',
          p_note: `Purchased ${credits} credits via Stripe`,
        });
        console.log(`[API] 💰 Added ${credits} credits to user ${userId}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[API] Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// JOB STATUS ENDPOINTS (for worker callbacks)
// ═══════════════════════════════════════════════════════════════════

app.post('/api/internal/jobs/:jobId/complete', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, error_message, output_assets } = req.body;

    // Validate internal API key
    const internalKey = req.headers['x-internal-key'];
    if (internalKey !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (status === 'READY') {
      // Finalize credits
      await supabase.rpc('finalize_credits', {
        p_user_id: job.user_id,
        p_job_id: jobId,
        p_final_cost: job.cost_credits_reserved,
      });

      await supabase.from('jobs').update({
        status: 'READY',
        finished_at: new Date().toISOString(),
        cost_credits_final: job.cost_credits_reserved,
      }).eq('id', jobId);

      await supabase.from('projects').update({ status: 'ready' }).eq('id', job.project_id);

      res.json({ message: 'Job completed', job_id: jobId });
    } else if (status === 'FAILED') {
      // Refund credits
      await supabase.rpc('release_reserved_credits', {
        p_user_id: job.user_id,
        p_job_id: jobId,
      });

      await supabase.from('jobs').update({
        status: 'FAILED',
        error_message,
        finished_at: new Date().toISOString(),
      }).eq('id', jobId);

      await supabase.from('projects').update({ status: 'failed' }).eq('id', job.project_id);

      res.json({ message: 'Job failed, credits refunded', job_id: jobId });
    } else {
      // Progress update
      await supabase.from('jobs').update({ status }).eq('id', jobId);
      res.json({ message: 'Status updated', job_id: jobId, status });
    }
  } catch (error) {
    console.error('[API] Error completing job:', error);
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// Get niche presets
app.get('/api/v1/niches', (req, res) => {
  res.json({
    niches: Object.entries(NICHE_PRESETS).map(([id, preset]) => ({
      id,
      name: preset.name,
      credits_per_minute: preset.creditsPerMinute,
    })),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer(port: number): Promise<void> {
  app.listen(port, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║        CanvasCast API Server               ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║  Port:     ${port}                            ║`);
    console.log(`║  ENV:      ${(process.env.NODE_ENV || 'development').padEnd(28)}║`);
    console.log(`║  Redis:    ${(redisConnected ? '✅ Connected' : '❌ Disconnected').padEnd(28)}║`);
    console.log(`║  Queue:    ${(jobQueue ? '✅ Ready' : '❌ Unavailable').padEnd(28)}║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
  });
}

process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received');
  process.exit(0);
});

startServer(Number(PORT));

export default app;

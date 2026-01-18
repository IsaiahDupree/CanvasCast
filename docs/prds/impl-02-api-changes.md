# Implementation PRD: API Changes & New Endpoints

**Type:** Implementation Guide  
**Priority:** P0  
**Status:** Ready for Implementation  

---

## 1. Overview

This document details the specific API changes needed to transform BlankLogo's API into CanvasCast's API, including what to keep, modify, and add.

---

## 2. Endpoint Mapping

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ENDPOINT TRANSFORMATION                             │
│                                                                         │
│  BlankLogo                          CanvasCast                          │
│  ────────────────────────────────────────────────────────────────────── │
│  POST /api/v1/logos          →      POST /api/v1/projects               │
│  GET  /api/v1/logos/:id      →      GET  /api/v1/projects/:id           │
│  GET  /api/v1/logos/:id/status →    GET  /api/v1/jobs/:jobId/status     │
│  POST /api/webhooks/stripe   →      POST /api/webhooks/stripe (KEEP)    │
│  GET  /health                →      GET  /health (KEEP)                 │
│                                                                         │
│  NEW ENDPOINTS:                                                         │
│  POST /api/v1/projects                                                  │
│  GET  /api/v1/projects                                                  │
│  GET  /api/v1/projects/:id                                              │
│  GET  /api/v1/jobs/:id/status                                           │
│  GET  /api/v1/jobs/:id/assets                                           │
│  POST /api/v1/voice-profiles                                            │
│  GET  /api/v1/credits/balance                                           │
│  POST /api/internal/jobs/:id/complete                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. KEEP AS-IS

### File: `apps/api/src/index.ts` - Server Setup

```typescript
// KEEP: These lines unchanged
import express from 'express';
import cors from 'cors';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL!);

// KEEP: Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// KEEP: Server listen
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
```

### File: `apps/api/src/middleware/auth.ts`

```typescript
// KEEP ENTIRE FILE - Auth middleware unchanged
import { createClient } from '@supabase/supabase-js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  
  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.user = user;
  next();
}
```

### File: `apps/api/src/lib/stripe.ts`

```typescript
// KEEP ENTIRE FILE - Stripe client unchanged
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
```

---

## 4. MODIFY: Queue Setup

### FROM (BlankLogo):
```typescript
const logoQueue = new Queue('logo-jobs', { connection: redis });
```

### TO (CanvasCast):
```typescript
const videoQueue = new Queue('video-jobs', { connection: redis });
```

---

## 5. REPLACE: Project Creation Endpoint

### FROM (BlankLogo): `POST /api/v1/logos`
```typescript
// DELETE THIS ENTIRE ENDPOINT
app.post('/api/v1/logos', authenticateToken, async (req, res) => {
  const { name, style, colors } = req.body;
  // ... logo-specific logic
});
```

### TO (CanvasCast): `POST /api/v1/projects`
```typescript
// ADD THIS NEW ENDPOINT
import { CreateProjectSchema } from '@canvascast/shared/schemas';

app.post('/api/v1/projects', authenticateToken, async (req, res) => {
  try {
    // 1. Validate request
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten() 
      });
    }
    
    const { title, promptText, nichePreset, targetMinutes, voiceProfileId } = parsed.data;
    const userId = req.user.id;
    
    // 2. Calculate and check credits
    const estimatedCredits = calculateCredits(targetMinutes, nichePreset);
    const { data: balance } = await supabase.rpc('get_credit_balance', { 
      p_user_id: userId 
    });
    
    if (balance < estimatedCredits) {
      return res.status(402).json({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        details: { required: estimatedCredits, available: balance }
      });
    }
    
    // 3. Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        title,
        prompt_text: promptText,
        niche_preset: nichePreset,
        target_minutes: targetMinutes,
        voice_profile_id: voiceProfileId,
      })
      .select()
      .single();
    
    if (projectError) throw projectError;
    
    // 4. Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        project_id: project.id,
        user_id: userId,
        status: 'PENDING',
        cost_credits_reserved: estimatedCredits,
      })
      .select()
      .single();
    
    if (jobError) throw jobError;
    
    // 5. Reserve credits
    await supabase.rpc('reserve_credits', {
      p_user_id: userId,
      p_job_id: job.id,
      p_amount: estimatedCredits,
    });
    
    // 6. Queue job
    await videoQueue.add('process', {
      jobId: job.id,
      projectId: project.id,
      userId,
      title,
      nichePreset,
      targetMinutes,
      content: promptText,
      voiceProfileId,
    });
    
    // 7. Update job status
    await supabase
      .from('jobs')
      .update({ status: 'QUEUED' })
      .eq('id', job.id);
    
    res.status(201).json({
      projectId: project.id,
      jobId: job.id,
    });
    
  } catch (error) {
    console.error('Project creation failed:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

function calculateCredits(targetMinutes: number, niche: string): number {
  const multiplier = ['history', 'documentary'].includes(niche) ? 1.5 : 1;
  return Math.ceil(targetMinutes * multiplier);
}
```

---

## 6. ADD: List Projects Endpoint

```typescript
// NEW ENDPOINT
app.get('/api/v1/projects', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        *,
        jobs (
          id,
          status,
          progress,
          created_at,
          finished_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    
    if (error) throw error;
    
    res.json({ projects });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});
```

---

## 7. ADD: Get Project Detail

```typescript
// NEW ENDPOINT
app.get('/api/v1/projects/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        *,
        jobs (
          id,
          status,
          progress,
          status_message,
          output_url,
          manifest_json,
          created_at,
          started_at,
          finished_at
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ project });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});
```

---

## 8. ADD: Job Status Endpoint

```typescript
// NEW ENDPOINT
app.get('/api/v1/jobs/:id/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Get job with steps
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get job steps
    const { data: steps, error: stepsError } = await supabase
      .from('job_steps')
      .select('*')
      .eq('job_id', id)
      .order('step_order', { ascending: true });
    
    res.json({
      job,
      steps: steps || [],
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});
```

---

## 9. ADD: Job Assets Endpoint

```typescript
// NEW ENDPOINT
app.get('/api/v1/jobs/:id/assets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Verify job ownership
    const { data: job } = await supabase
      .from('jobs')
      .select('id, status, manifest_json')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.status !== 'READY') {
      return res.status(400).json({ error: 'Job not ready' });
    }
    
    // Get assets
    const { data: assets } = await supabase
      .from('assets')
      .select('*')
      .eq('job_id', id);
    
    res.json({
      manifest: job.manifest_json,
      assets: assets || [],
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});
```

---

## 10. ADD: Credit Balance Endpoint

```typescript
// NEW ENDPOINT
app.get('/api/v1/credits/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get total balance
    const { data: balance } = await supabase.rpc('get_credit_balance', {
      p_user_id: userId,
    });
    
    // Get reserved credits
    const { data: reserved } = await supabase
      .from('credit_ledger')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'reserve');
    
    const reservedTotal = reserved?.reduce((sum, r) => sum + Math.abs(r.amount), 0) || 0;
    
    res.json({
      balance: balance || 0,
      reserved: reservedTotal,
      available: (balance || 0) - reservedTotal,
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});
```

---

## 11. ADD: Voice Profile Upload

```typescript
// NEW ENDPOINT
import multer from 'multer';
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

app.post('/api/v1/voice-profiles', 
  authenticateToken, 
  upload.single('audio'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { name } = req.body;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: 'Audio file required' });
      }
      
      // Upload to Supabase Storage
      const filename = `${userId}/${Date.now()}_${file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from('voice-samples')
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
        });
      
      if (uploadError) throw uploadError;
      
      // Create voice profile record
      const { data: profile, error: profileError } = await supabase
        .from('voice_profiles')
        .insert({
          user_id: userId,
          name,
          audio_path: filename,
        })
        .select()
        .single();
      
      if (profileError) throw profileError;
      
      res.status(201).json({ profile });
      
    } catch (error) {
      res.status(500).json({ error: 'Failed to upload voice profile' });
    }
  }
);
```

---

## 12. ADD: Internal Job Completion Endpoint

```typescript
// NEW ENDPOINT - Called by worker
app.post('/api/internal/jobs/:id/complete', async (req, res) => {
  try {
    // Verify internal token
    const token = req.headers['x-internal-token'];
    if (token !== process.env.INTERNAL_API_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id } = req.params;
    const { status, outputUrl, manifest, finalCredits, error } = req.body;
    
    // Update job
    await supabase
      .from('jobs')
      .update({
        status,
        output_url: outputUrl,
        manifest_json: manifest,
        cost_credits_final: finalCredits,
        error_code: error?.code,
        error_message: error?.message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    // Finalize credits if successful
    if (status === 'READY') {
      await supabase.rpc('finalize_job_credits', {
        p_job_id: id,
        p_final_cost: finalCredits,
      });
    } else if (status === 'FAILED') {
      await supabase.rpc('release_job_credits', {
        p_job_id: id,
      });
    }
    
    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete job' });
  }
});
```

---

## 13. MODIFY: Stripe Webhook

### KEEP Structure, UPDATE Products

```typescript
// MODIFY: Update product handling for CanvasCast
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }), 
  async (req, res) => {
    const sig = req.headers['stripe-signature']!;
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // MODIFY: CanvasCast credit packages
        const CREDIT_PACKAGES: Record<string, number> = {
          'price_starter_10': 10,
          'price_creator_50': 50,
          'price_pro_120': 120,
        };
        
        const priceId = session.line_items?.data[0]?.price?.id;
        const credits = CREDIT_PACKAGES[priceId!] || 0;
        const userId = session.metadata?.user_id;
        
        if (userId && credits > 0) {
          await supabase.rpc('add_credits', {
            p_user_id: userId,
            p_amount: credits,
            p_type: 'purchase',
            p_note: `Purchased ${credits} credits`,
            p_stripe_payment_id: session.payment_intent as string,
          });
        }
        break;
      }
      
      // Keep other webhook handlers...
    }
    
    res.json({ received: true });
  }
);
```

---

## 14. Complete Modified File

### `apps/api/src/index.ts` - Final Structure

```typescript
import express from 'express';
import cors from 'cors';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken } from './middleware/auth';
import { CreateProjectSchema } from '@canvascast/shared/schemas';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

// Redis & Queue
const redis = new Redis(process.env.REDIS_URL!);
const videoQueue = new Queue('video-jobs', { connection: redis });

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Multer
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Projects
app.post('/api/v1/projects', authenticateToken, ...);       // CREATE
app.get('/api/v1/projects', authenticateToken, ...);        // LIST
app.get('/api/v1/projects/:id', authenticateToken, ...);    // GET

// Jobs
app.get('/api/v1/jobs/:id/status', authenticateToken, ...); // STATUS
app.get('/api/v1/jobs/:id/assets', authenticateToken, ...); // ASSETS

// Credits
app.get('/api/v1/credits/balance', authenticateToken, ...); // BALANCE

// Voice
app.post('/api/v1/voice-profiles', authenticateToken, upload.single('audio'), ...);

// Internal
app.post('/api/internal/jobs/:id/complete', ...);           // WORKER CALLBACK

// Webhooks (raw body)
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), ...);

// Body parser for other routes
app.use(express.json());

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API on port ${PORT}`));
```

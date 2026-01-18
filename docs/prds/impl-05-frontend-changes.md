# Implementation PRD: Frontend Changes

**Type:** Implementation Guide  
**Priority:** P0  
**Status:** Ready for Implementation  

---

## 1. Overview

This document details the frontend changes needed to transform BlankLogo's Next.js app into CanvasCast, specifying what to keep, modify, and add.

---

## 2. Change Summary

```
KEEP                      MODIFY                     ADD NEW
────────────────────────────────────────────────────────────────────
next.config.js            layout.tsx (branding)      /api/draft/
tailwind.config.js        page.tsx (landing)         /app/new/
middleware.ts             /app/ layout               /app/jobs/[id]/
/lib/supabase/            /auth/ pages               /app/credits/
/components/ui/           Dashboard page             PromptInput
/hooks/use-toast.ts                                  JobStepper
                                                     ProjectCard
                                                     CreditBalance
```

---

## 3. KEEP: Core Configuration

### Files to copy unchanged:
```
apps/web/
├── next.config.js           ← KEEP
├── postcss.config.js        ← KEEP
├── tailwind.config.js       ← KEEP (may add colors)
├── tsconfig.json            ← KEEP
├── .env.example             ← KEEP (add new vars)
└── src/
    ├── middleware.ts        ← KEEP (auth middleware)
    └── lib/
        └── supabase/
            ├── client.ts    ← KEEP
            ├── server.ts    ← KEEP
            └── middleware.ts ← KEEP
```

---

## 4. KEEP: UI Components (shadcn/ui)

### Copy entire directory:
```
apps/web/src/components/ui/
├── button.tsx              ← KEEP
├── input.tsx               ← KEEP
├── textarea.tsx            ← KEEP
├── card.tsx                ← KEEP
├── dialog.tsx              ← KEEP
├── dropdown-menu.tsx       ← KEEP
├── progress.tsx            ← KEEP
├── skeleton.tsx            ← KEEP
├── toast.tsx               ← KEEP
├── toaster.tsx             ← KEEP
└── ... (all shadcn components)
```

---

## 5. MODIFY: Root Layout

### File: `apps/web/src/app/layout.tsx`

**FROM (BlankLogo):**
```tsx
export const metadata: Metadata = {
  title: 'BlankLogo - AI Logo Animation',
  description: 'Create animated logos with AI',
};
```

**TO (CanvasCast):**
```tsx
export const metadata: Metadata = {
  title: 'CanvasCast - AI Video Generation',
  description: 'Turn your ideas into engaging videos with AI',
  keywords: ['AI video', 'video generation', 'content creation'],
  openGraph: {
    title: 'CanvasCast',
    description: 'AI-powered video generation',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Toaster />
        {children}
      </body>
    </html>
  );
}
```

---

## 6. REPLACE: Landing Page

### File: `apps/web/src/app/page.tsx`

**DELETE BlankLogo landing and REPLACE with:**

```tsx
// NEW: CanvasCast landing page
import { PromptInput } from '@/components/prompt-input';
import { FeatureGrid } from '@/components/feature-grid';
import { HowItWorks } from '@/components/how-it-works';
import { PricingPreview } from '@/components/pricing-preview';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 px-4 text-center bg-gradient-to-b from-purple-50 to-white">
          <h1 className="text-5xl font-bold mb-6">
            Turn Ideas into <span className="text-purple-600">Videos</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Describe your video idea and let AI create engaging content in minutes.
            No editing skills required.
          </p>
          
          {/* Main CTA: Prompt Input */}
          <div className="max-w-2xl mx-auto">
            <PromptInput />
          </div>
        </section>
        
        {/* Features */}
        <section className="py-16 px-4">
          <FeatureGrid />
        </section>
        
        {/* How It Works */}
        <section className="py-16 px-4 bg-gray-50">
          <HowItWorks />
        </section>
        
        {/* Pricing Preview */}
        <section className="py-16 px-4">
          <PricingPreview />
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
```

---

## 7. ADD: Draft API Route

### File: `apps/web/src/app/api/draft/route.ts`

```tsx
// NEW FILE
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const DraftSchema = z.object({
  promptText: z.string().min(1).max(10000),
  templateId: z.string().optional(),
  options: z.object({
    nichePreset: z.string().optional(),
    targetMinutes: z.number().optional(),
  }).optional(),
});

// POST: Create or update draft
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = DraftSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get or create session token
    const cookieStore = cookies();
    let sessionToken = cookieStore.get('draft_session')?.value;
    
    if (!sessionToken) {
      sessionToken = uuidv4();
    }
    
    // Upsert draft
    const { data: draft, error } = await supabase
      .from('draft_prompts')
      .upsert({
        session_token: sessionToken,
        user_id: user?.id || null,
        prompt_text: parsed.data.promptText,
        template_id: parsed.data.templateId,
        options: parsed.data.options || {},
        updated_at: new Date().toISOString(),
      }, {
        onConflict: user ? 'user_id' : 'session_token',
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Set cookie for unauthenticated users
    const response = NextResponse.json({
      draftId: draft.id,
      sessionToken,
      isAuthenticated: !!user,
    });
    
    if (!user) {
      response.cookies.set('draft_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
    
    return response;
    
  } catch (error) {
    console.error('Draft save error:', error);
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    );
  }
}

// GET: Retrieve draft
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('draft_session')?.value;
    
    let draft = null;
    
    if (user) {
      const { data } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      draft = data;
    } else if (sessionToken) {
      const { data } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('session_token', sessionToken)
        .is('user_id', null)
        .single();
      draft = data;
    }
    
    return NextResponse.json({ draft });
    
  } catch (error) {
    return NextResponse.json({ draft: null });
  }
}
```

---

## 8. ADD: Prompt Input Component

### File: `apps/web/src/components/prompt-input.tsx`

```tsx
// NEW FILE
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';

export function PromptInput() {
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  
  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setSaving(true);
    
    try {
      // Save draft
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptText: prompt }),
      });
      
      const { draftId, isAuthenticated } = await res.json();
      
      if (isAuthenticated) {
        // Go directly to create page
        router.push(`/app/new?draft=${draftId}`);
      } else {
        // Go to signup with draft
        router.push(`/signup?draft=${draftId}`);
      }
      
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your video idea... (e.g., 'Create a motivational video about overcoming challenges')"
        className="min-h-32 text-lg"
        disabled={saving}
      />
      
      <Button 
        onClick={handleSubmit}
        disabled={!prompt.trim() || saving}
        size="lg"
        className="w-full sm:w-auto"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Create Video
          </>
        )}
      </Button>
      
      <p className="text-sm text-gray-500">
        Free trial includes 1 video. No credit card required.
      </p>
    </div>
  );
}
```

---

## 9. ADD: Dashboard Page

### File: `apps/web/src/app/app/page.tsx`

```tsx
// REPLACE BlankLogo dashboard with:
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProjectCard } from '@/components/project-card';
import { NewProjectCard } from '@/components/new-project-card';
import { CreditBalance } from '@/components/credit-balance';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // Fetch projects with latest job
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      jobs (
        id,
        status,
        progress,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Projects</h1>
        <CreditBalance />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <NewProjectCard />
        
        {projects?.map((project) => (
          <ProjectCard 
            key={project.id} 
            project={project}
            latestJob={project.jobs?.[0]}
          />
        ))}
      </div>
      
      {!projects?.length && (
        <div className="text-center py-12 text-gray-500">
          <p>No projects yet. Create your first video!</p>
        </div>
      )}
    </div>
  );
}
```

---

## 10. ADD: Job Progress Page

### File: `apps/web/src/app/app/jobs/[id]/page.tsx`

```tsx
// NEW FILE
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { JobStepper } from '@/components/job-stepper';
import { DownloadSection } from '@/components/download-section';
import { JobHeader } from '@/components/job-header';

interface Props {
  params: { id: string };
}

export default async function JobPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // Fetch job with project
  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      *,
      project:projects (
        id,
        title,
        niche_preset
      ),
      steps:job_steps (
        id,
        step_name,
        step_order,
        state,
        progress_pct,
        started_at,
        finished_at
      )
    `)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  
  if (error || !job) {
    notFound();
  }
  
  return (
    <div className="container py-8 max-w-4xl">
      <JobHeader job={job} project={job.project} />
      
      <div className="mt-8">
        <JobStepper 
          jobId={job.id}
          status={job.status}
          progress={job.progress}
          steps={job.steps}
        />
      </div>
      
      {job.status === 'READY' && (
        <div className="mt-8">
          <DownloadSection 
            jobId={job.id}
            manifest={job.manifest_json}
          />
        </div>
      )}
      
      {job.status === 'FAILED' && (
        <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800">Generation Failed</h3>
          <p className="text-red-600 mt-1">
            {job.error_message || 'An unexpected error occurred.'}
          </p>
          <p className="text-sm text-red-500 mt-2">
            Error code: {job.error_code || 'UNKNOWN'}
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 11. ADD: Job Stepper Component

### File: `apps/web/src/components/job-stepper.tsx`

```tsx
// NEW FILE
'use client';

import { useEffect, useState } from 'react';
import { 
  FileText, 
  Mic, 
  Waveform, 
  Image, 
  Film, 
  Package,
  CheckCircle,
  Loader2,
  Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'SCRIPTING', label: 'Writing Script', icon: FileText },
  { key: 'VOICE_GEN', label: 'Generating Voice', icon: Mic },
  { key: 'ALIGNMENT', label: 'Syncing Audio', icon: Waveform },
  { key: 'IMAGE_GEN', label: 'Creating Images', icon: Image },
  { key: 'RENDERING', label: 'Rendering Video', icon: Film },
  { key: 'PACKAGING', label: 'Packaging', icon: Package },
];

interface Props {
  jobId: string;
  status: string;
  progress: number;
  steps: Array<{
    step_name: string;
    state: string;
    progress_pct: number;
  }>;
}

export function JobStepper({ jobId, status: initialStatus, progress: initialProgress, steps: initialSteps }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [steps, setSteps] = useState(initialSteps);
  
  // Poll for updates
  useEffect(() => {
    if (['READY', 'FAILED'].includes(status)) return;
    
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/jobs/${jobId}/status`);
        const data = await res.json();
        
        setStatus(data.job.status);
        setProgress(data.job.progress);
        setSteps(data.steps);
        
      } catch (e) {
        console.error('Poll error:', e);
      }
    };
    
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId, status]);
  
  const getStepStatus = (stepKey: string) => {
    const step = steps.find(s => s.step_name === stepKey);
    if (!step) return 'pending';
    return step.state;
  };
  
  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-purple-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Steps */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {STEPS.map((step) => {
          const stepStatus = getStepStatus(step.key);
          const Icon = step.icon;
          
          return (
            <div 
              key={step.key}
              className={cn(
                "flex flex-col items-center p-4 rounded-lg border-2 transition-colors",
                stepStatus === 'succeeded' && "border-green-500 bg-green-50",
                stepStatus === 'started' && "border-purple-500 bg-purple-50",
                stepStatus === 'failed' && "border-red-500 bg-red-50",
                stepStatus === 'pending' && "border-gray-200 bg-gray-50"
              )}
            >
              <div className="relative">
                <Icon className={cn(
                  "w-8 h-8",
                  stepStatus === 'succeeded' && "text-green-600",
                  stepStatus === 'started' && "text-purple-600",
                  stepStatus === 'failed' && "text-red-600",
                  stepStatus === 'pending' && "text-gray-400"
                )} />
                
                {stepStatus === 'started' && (
                  <Loader2 className="w-4 h-4 absolute -top-1 -right-1 text-purple-600 animate-spin" />
                )}
                {stepStatus === 'succeeded' && (
                  <CheckCircle className="w-4 h-4 absolute -top-1 -right-1 text-green-600" />
                )}
              </div>
              
              <span className={cn(
                "mt-2 text-sm font-medium text-center",
                stepStatus === 'pending' && "text-gray-500"
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 12. ADD: Create Project Page

### File: `apps/web/src/app/app/new/page.tsx`

```tsx
// NEW FILE
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NicheSelector } from '@/components/niche-selector';
import { createClient } from '@/lib/supabase/client';

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');
  
  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [nichePreset, setNichePreset] = useState('motivation');
  const [targetMinutes, setTargetMinutes] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Load draft if provided
  useEffect(() => {
    if (draftId) {
      loadDraft();
    }
  }, [draftId]);
  
  const loadDraft = async () => {
    const res = await fetch('/api/draft');
    const { draft } = await res.json();
    
    if (draft) {
      setPromptText(draft.prompt_text);
      if (draft.options?.nichePreset) {
        setNichePreset(draft.options.nichePreset);
      }
      if (draft.options?.targetMinutes) {
        setTargetMinutes(draft.options.targetMinutes);
      }
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          title: title || `Video: ${promptText.slice(0, 50)}...`,
          promptText,
          nichePreset,
          targetMinutes,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create project');
      }
      
      // Redirect to job page
      router.push(`/app/jobs/${data.jobId}`);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Create New Video</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Title (optional)
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Awesome Video"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Video Description *
          </label>
          <Textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Describe what your video should be about..."
            className="min-h-32"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Video Style
          </label>
          <NicheSelector
            value={nichePreset}
            onChange={setNichePreset}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Target Length: {targetMinutes} minute{targetMinutes > 1 ? 's' : ''}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={targetMinutes}
            onChange={(e) => setTargetMinutes(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-500">
            <span>1 min</span>
            <span>10 min</span>
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}
        
        <Button type="submit" disabled={loading || !promptText} className="w-full">
          {loading ? 'Creating...' : 'Create Video'}
        </Button>
      </form>
    </div>
  );
}
```

---

## 13. MODIFY: Auth Callback

### File: `apps/web/src/app/auth/callback/route.ts`

**ADD draft claim logic:**

```tsx
// MODIFY: Add draft claiming after successful auth
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app';
  
  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // NEW: Claim any pending draft
      const cookieStore = cookies();
      const sessionToken = cookieStore.get('draft_session')?.value;
      
      if (sessionToken) {
        await supabase.rpc('claim_draft_prompt', {
          p_session_token: sessionToken,
          p_user_id: data.user.id,
        });
        
        // Clear the draft session cookie
        cookieStore.delete('draft_session');
      }
      
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  
  return NextResponse.redirect(`${origin}/auth/error`);
}
```

---

## 14. File Summary

### Files to KEEP (copy unchanged):
- `next.config.js`, `tailwind.config.js`, `postcss.config.js`
- `src/middleware.ts`
- `src/lib/supabase/*`
- `src/components/ui/*`
- `src/hooks/use-toast.ts`

### Files to MODIFY:
- `src/app/layout.tsx` - Update metadata
- `src/app/page.tsx` - Replace landing page
- `src/app/app/layout.tsx` - Update navigation
- `src/app/app/page.tsx` - Replace dashboard
- `src/app/auth/callback/route.ts` - Add draft claim

### Files to ADD:
- `src/app/api/draft/route.ts`
- `src/app/app/new/page.tsx`
- `src/app/app/jobs/[id]/page.tsx`
- `src/app/app/credits/page.tsx`
- `src/components/prompt-input.tsx`
- `src/components/job-stepper.tsx`
- `src/components/project-card.tsx`
- `src/components/new-project-card.tsx`
- `src/components/credit-balance.tsx`
- `src/components/niche-selector.tsx`
- `src/components/download-section.tsx`

### Files to DELETE:
- Any logo-specific components
- Logo editor pages
- BlankLogo-specific UI

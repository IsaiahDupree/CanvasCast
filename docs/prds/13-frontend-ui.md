# PRD: Frontend UI System

**Subsystem:** Frontend  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Frontend UI System is a Next.js 14 application using the App Router, React Server Components, and TailwindCSS. It provides the user-facing interface for video creation, job monitoring, and account management.

### Business Goal
Deliver a fast, intuitive, and visually appealing interface that converts visitors into users and users into paying customers.

---

## 2. User Stories

### US-1: Responsive Design
**As a** user  
**I want** the app to work on any device  
**So that** I can create videos anywhere

### US-2: Real-time Progress
**As a** user  
**I want** to see my video progress in real-time  
**So that** I know how much longer to wait

### US-3: Intuitive Navigation
**As a** user  
**I want** clear navigation  
**So that** I can find features easily

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS APP                                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        App Router                                │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │   (marketing)   │  │   /app/*        │  │   /api/*        │  │   │
│  │  │   Landing       │  │   Dashboard     │  │   API Routes    │  │   │
│  │  │   Pricing       │  │   Projects      │  │   Draft         │  │   │
│  │  │   Auth          │  │   Jobs          │  │   Webhooks      │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Components                                  │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │  UI    │ │ Layout │ │ Forms  │ │ Charts │ │ Media  │        │   │
│  │  │shadcn  │ │ Nav    │ │ Input  │ │Progress│ │ Video  │        │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       Hooks & Libs                               │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                    │   │
│  │  │useAuth │ │useJob  │ │Supabase│ │ Utils  │                    │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Route Structure

### Public Routes (Marketing)
```
/                   # Landing page with prompt input
/pricing            # Pricing plans
/login              # Login page
/signup             # Signup page
/auth/callback      # OAuth callback handler
```

### Protected Routes (App)
```
/app                # Dashboard (project list)
/app/new            # Create new project
/app/projects/[id]  # Project detail
/app/jobs/[id]      # Job progress & download
/app/credits        # Credit balance & purchase
/app/settings       # User settings
```

### API Routes
```
/api/draft          # Draft prompt CRUD
/api/webhooks/stripe # Stripe webhooks
```

---

## 5. Key Pages

### Landing Page (`/`)
```tsx
export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 text-center">
        <h1>Turn Ideas into Videos</h1>
        <p>AI-powered video generation in minutes</p>
        <PromptInput />
      </section>
      
      {/* Features */}
      <FeatureGrid />
      
      {/* How It Works */}
      <HowItWorks />
      
      {/* Pricing Preview */}
      <PricingPreview />
      
      {/* CTA */}
      <CallToAction />
    </main>
  );
}
```

### Dashboard (`/app`)
```tsx
export default async function Dashboard() {
  const projects = await getProjects();
  
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <h1>Your Projects</h1>
        <CreditBalance />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <NewProjectCard />
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
```

### Job Progress (`/app/jobs/[id]`)
```tsx
export default function JobPage({ params }) {
  return (
    <div className="container py-8">
      <JobHeader jobId={params.id} />
      
      {/* Step Progress */}
      <JobStepper jobId={params.id} />
      
      {/* Current Step Detail */}
      <CurrentStepDetail jobId={params.id} />
      
      {/* Download Section (when ready) */}
      <Suspense fallback={<Skeleton />}>
        <DownloadSection jobId={params.id} />
      </Suspense>
    </div>
  );
}
```

---

## 6. Core Components

### PromptInput
Landing page prompt capture with draft saving.

```tsx
'use client';

export function PromptInput() {
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  
  const handleSubmit = async () => {
    setSaving(true);
    
    // Save draft
    const { draftId } = await saveDraft(prompt);
    
    // Redirect to signup/create
    router.push(`/signup?draft=${draftId}`);
  };
  
  return (
    <div className="max-w-2xl mx-auto">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your video idea..."
        className="min-h-32"
      />
      <Button onClick={handleSubmit} disabled={!prompt || saving}>
        {saving ? 'Saving...' : 'Create Video'}
      </Button>
    </div>
  );
}
```

### JobStepper
Real-time job progress visualization.

```tsx
'use client';

const STEPS = [
  { key: 'SCRIPTING', label: 'Writing Script', icon: FileText },
  { key: 'VOICE_GEN', label: 'Generating Voice', icon: Mic },
  { key: 'ALIGNMENT', label: 'Syncing Audio', icon: Waveform },
  { key: 'IMAGE_GEN', label: 'Creating Images', icon: Image },
  { key: 'RENDERING', label: 'Rendering Video', icon: Film },
  { key: 'PACKAGING', label: 'Packaging', icon: Package },
];

export function JobStepper({ jobId }: { jobId: string }) {
  const { job, isLoading } = useJobStatus(jobId);
  
  const currentStepIndex = STEPS.findIndex(s => s.key === job?.status);
  
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, index) => (
        <StepItem
          key={step.key}
          step={step}
          status={
            index < currentStepIndex ? 'complete' :
            index === currentStepIndex ? 'current' : 'pending'
          }
          progress={index === currentStepIndex ? job?.progress : undefined}
        />
      ))}
    </div>
  );
}
```

### CreditBalance
User credit display with purchase link.

```tsx
'use client';

export function CreditBalance() {
  const { balance, isLoading } = useCredits();
  
  return (
    <div className="flex items-center gap-2">
      <Coins className="w-5 h-5 text-yellow-500" />
      <span className="font-semibold">
        {isLoading ? '...' : balance} credits
      </span>
      <Link href="/app/credits">
        <Button variant="outline" size="sm">Buy More</Button>
      </Link>
    </div>
  );
}
```

---

## 7. Custom Hooks

### useJobStatus
Poll for job status updates.

```tsx
export function useJobStatus(jobId: string) {
  const [job, setJob] = useState<Job | null>(null);
  
  useEffect(() => {
    const poll = async () => {
      const res = await fetch(`/api/jobs/${jobId}/status`);
      const data = await res.json();
      setJob(data);
      
      // Stop polling if complete or failed
      if (['READY', 'FAILED'].includes(data.status)) {
        return;
      }
    };
    
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId]);
  
  return { job, isLoading: !job };
}
```

### useCredits
Fetch and cache credit balance.

```tsx
export function useCredits() {
  const supabase = createClient();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.rpc('get_credit_balance');
      setBalance(data || 0);
      setIsLoading(false);
    };
    fetch();
  }, []);
  
  return { balance, isLoading };
}
```

### useAuth
Authentication state management.

```tsx
export function useAuth() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  return { user, loading };
}
```

---

## 8. Styling System

### TailwindCSS Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
        },
        accent: '#00d4ff',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};
```

### Component Library (shadcn/ui)
```bash
# Pre-installed components
- Button
- Input
- Textarea
- Card
- Dialog
- Dropdown
- Progress
- Skeleton
- Toast
```

---

## 9. State Management

### Server State
- **React Server Components** for initial data
- **Supabase client** for real-time subscriptions
- **Polling** for job status updates

### Client State
- **useState/useReducer** for local UI state
- **Context** for auth state
- **URL state** for filters/pagination

```tsx
// No global state library needed
// RSC + Supabase handles most data fetching

// Auth context example
export const AuthContext = createContext<AuthState>(null);

export function AuthProvider({ children }) {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 10. Performance

### Optimizations
- **React Server Components**: Reduce client JS
- **Image optimization**: Next.js Image component
- **Code splitting**: Dynamic imports for heavy components
- **Suspense boundaries**: Progressive loading

```tsx
// Dynamic import for heavy component
const VideoPlayer = dynamic(() => import('./VideoPlayer'), {
  loading: () => <Skeleton className="aspect-video" />,
});

// Suspense for data loading
<Suspense fallback={<ProjectsSkeleton />}>
  <ProjectList />
</Suspense>
```

### Core Web Vitals Targets
| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |

---

## 11. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Database** | Frontend → DB | Supabase client | Data queries |
| **Auth** | Frontend ↔ Auth | Supabase Auth | User sessions |
| **Draft** | Frontend → Draft | API route | Save prompts |
| **API** | Frontend → API | fetch/REST | Job creation |
| **Storage** | Frontend → Storage | Supabase Storage | Asset downloads |

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND SUBSYSTEM                          │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │    Pages     │────►│  Components  │────►│    Hooks     │    │
│  │  (RSC/Client)│     │  (UI logic)  │     │  (data)      │    │
│  └──────────────┘     └──────────────┘     └──────┬───────┘    │
│                                                    │            │
│                              ┌─────────────────────┼───────────┐│
│                              ▼                     ▼           ▼│
│                       ┌───────────┐         ┌───────────┐      │
│                       │  Supabase │         │  Express  │      │
│                       │  Client   │         │    API    │      │
│                       └─────┬─────┘         └─────┬─────┘      │
└─────────────────────────────┼─────────────────────┼─────────────┘
                              │                     │
                              ▼                     ▼
                       ┌───────────┐         ┌───────────┐
                       │  Database │         │  Worker   │
                       │  + Auth   │         │  (jobs)   │
                       └───────────┘         └───────────┘
```

---

## 12. Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/` | App router pages |
| `apps/web/src/components/` | React components |
| `apps/web/src/hooks/` | Custom hooks |
| `apps/web/src/lib/` | Utilities |
| `apps/web/src/middleware.ts` | Auth middleware |
| `apps/web/tailwind.config.js` | Tailwind config |

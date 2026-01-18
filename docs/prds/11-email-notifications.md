# PRD: Email Notifications

**Subsystem:** Notifications  
**Version:** 1.0  
**Status:** Planned  
**Owner:** Isaiah  

---

## 1. Overview

The Email Notifications subsystem sends transactional emails to users at key moments: job completion, job failure, low credit warnings, and subscription events. Uses Resend or SendGrid for delivery with templated HTML emails.

### Business Goal
Keep users informed about their video generation status, drive engagement, and reduce support requests.

---

## 2. User Stories

### US-1: Job Completion Email
**As a** user  
**I want to** receive an email when my video is ready  
**So that** I don't have to keep checking the dashboard

### US-2: Job Failure Email
**As a** user  
**I want to** be notified if my video fails  
**So that** I can take action quickly

### US-3: Low Credit Warning
**As a** user  
**I want to** know when my credits are running low  
**So that** I can purchase more before I run out

### US-4: Notification Preferences
**As a** user  
**I want to** control which emails I receive  
**So that** I'm not overwhelmed with messages

---

## 3. Email Types

| Type | Trigger | Priority |
|------|---------|----------|
| `job_complete` | Job status → READY | High |
| `job_failed` | Job status → FAILED | High |
| `low_credits` | Balance < 5 credits | Medium |
| `credits_depleted` | Balance = 0 | High |
| `subscription_renewed` | Invoice paid | Low |
| `subscription_expiring` | 3 days before renewal | Medium |
| `welcome` | New signup | High |

---

## 4. Email Templates

### Job Complete
```html
Subject: Your video "{{title}}" is ready! 🎉

<h1>Your Video is Ready</h1>
<p>Hi {{name}},</p>
<p>Great news! Your video <strong>"{{title}}"</strong> has finished rendering.</p>

<div class="stats">
  <p><strong>Duration:</strong> {{duration}}</p>
  <p><strong>Credits used:</strong> {{credits}}</p>
</div>

<a href="{{downloadUrl}}" class="button">Download Your Video</a>

<p>Or view it in your <a href="{{dashboardUrl}}">dashboard</a>.</p>
```

### Job Failed
```html
Subject: Video generation failed - action required

<h1>Video Generation Failed</h1>
<p>Hi {{name}},</p>
<p>Unfortunately, your video <strong>"{{title}}"</strong> encountered an error.</p>

<div class="error-box">
  <p><strong>Error:</strong> {{errorMessage}}</p>
  <p><strong>Step:</strong> {{failedStep}}</p>
</div>

<p>Don't worry - your credits have been refunded.</p>

<a href="{{retryUrl}}" class="button">Try Again</a>

<p>If this keeps happening, <a href="{{supportUrl}}">contact support</a>.</p>
```

### Low Credits
```html
Subject: Low credit balance - {{balance}} credits remaining

<h1>Running Low on Credits</h1>
<p>Hi {{name}},</p>
<p>You have <strong>{{balance}} credits</strong> remaining, enough for approximately {{estimatedVideos}} more videos.</p>

<a href="{{purchaseUrl}}" class="button">Buy More Credits</a>

<p>Or upgrade to a subscription for monthly credits.</p>
```

### Welcome
```html
Subject: Welcome to CanvasCast! 🚀

<h1>Welcome to CanvasCast</h1>
<p>Hi {{name}},</p>
<p>Thanks for signing up! You have <strong>{{trialCredits}} free credits</strong> to get started.</p>

<div class="getting-started">
  <h2>What's Next?</h2>
  <ol>
    <li>Enter your video idea</li>
    <li>Pick a style and voice</li>
    <li>Download your video in minutes</li>
  </ol>
</div>

<a href="{{createUrl}}" class="button">Create Your First Video</a>
```

---

## 5. Technical Implementation

### Email Service (Resend)
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  const html = await renderTemplate(payload.template, payload.data);
  
  await resend.emails.send({
    from: 'CanvasCast <noreply@canvascast.ai>',
    to: payload.to,
    subject: payload.subject,
    html,
    tags: [
      { name: 'template', value: payload.template },
    ],
  });
}
```

### Template Rendering
```typescript
import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

async function renderTemplate(
  templateName: string,
  data: Record<string, any>
): Promise<string> {
  let template = templateCache.get(templateName);
  
  if (!template) {
    const templatePath = join(__dirname, 'templates', `${templateName}.hbs`);
    const templateSource = readFileSync(templatePath, 'utf-8');
    template = Handlebars.compile(templateSource);
    templateCache.set(templateName, template);
  }
  
  // Wrap in base layout
  const content = template(data);
  return renderLayout(content, data);
}

function renderLayout(content: string, data: Record<string, any>): string {
  const layoutTemplate = templateCache.get('layout') || loadLayout();
  return layoutTemplate({ ...data, content });
}
```

### Base Layout
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .button { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #7c3aed; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px;
      font-weight: 600;
    }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="{{logoUrl}}" alt="CanvasCast" width="150">
    </div>
    
    <div class="content">
      {{{content}}}
    </div>
    
    <div class="footer">
      <p>© {{year}} CanvasCast. All rights reserved.</p>
      <p><a href="{{unsubscribeUrl}}">Manage email preferences</a></p>
    </div>
  </div>
</body>
</html>
```

---

## 6. Notification Triggers

### Job Complete Notification
```typescript
// Called from pipeline runner on success
async function notifyJobComplete(job: Job, ctx: PipelineContext): Promise<void> {
  const user = await getUser(job.user_id);
  
  if (!user.notification_prefs?.job_complete) return;
  
  await sendEmail({
    to: user.email,
    subject: `Your video "${ctx.project.title}" is ready! 🎉`,
    template: 'job-complete',
    data: {
      name: user.display_name || 'there',
      title: ctx.project.title,
      duration: formatDuration(ctx.artifacts.narrationDurationMs),
      credits: job.cost_credits_final,
      downloadUrl: `${FRONTEND_URL}/app/jobs/${job.id}`,
      dashboardUrl: `${FRONTEND_URL}/app`,
    },
  });
  
  // Log notification
  await logNotification(job.user_id, 'job_complete', job.id);
}
```

### Job Failed Notification
```typescript
async function notifyJobFailed(
  job: Job, 
  errorCode: string, 
  errorMessage: string
): Promise<void> {
  const user = await getUser(job.user_id);
  
  if (!user.notification_prefs?.job_failed) return;
  
  await sendEmail({
    to: user.email,
    subject: `Video generation failed - action required`,
    template: 'job-failed',
    data: {
      name: user.display_name || 'there',
      title: job.title || 'Untitled',
      errorMessage: getHumanReadableError(errorCode),
      failedStep: job.failed_step,
      retryUrl: `${FRONTEND_URL}/app/new?retry=${job.project_id}`,
      supportUrl: `${FRONTEND_URL}/support`,
    },
  });
}
```

### Low Credit Warning
```typescript
// Called after credit deduction
async function checkLowCreditWarning(userId: string): Promise<void> {
  const balance = await getCreditBalance(userId);
  const user = await getUser(userId);
  
  if (balance <= 5 && balance > 0) {
    // Check if we already sent this warning recently
    const recentWarning = await getRecentNotification(userId, 'low_credits', '24h');
    if (recentWarning) return;
    
    await sendEmail({
      to: user.email,
      subject: `Low credit balance - ${balance} credits remaining`,
      template: 'low-credits',
      data: {
        name: user.display_name || 'there',
        balance,
        estimatedVideos: Math.floor(balance),
        purchaseUrl: `${FRONTEND_URL}/app/credits`,
      },
    });
  }
}
```

---

## 7. Notification Preferences

### User Settings Schema
```typescript
interface NotificationPrefs {
  job_complete: boolean;     // Default: true
  job_failed: boolean;       // Default: true
  low_credits: boolean;      // Default: true
  marketing: boolean;        // Default: false
  weekly_digest: boolean;    // Default: false
}
```

### Preferences API
```
GET /api/v1/notifications/preferences

Response:
{
  "job_complete": true,
  "job_failed": true,
  "low_credits": true,
  "marketing": false,
  "weekly_digest": false
}
```

```
PATCH /api/v1/notifications/preferences

Request:
{
  "marketing": true
}

Response:
{
  "updated": true
}
```

### Unsubscribe Flow
1. Email contains unique unsubscribe token
2. Link: `/unsubscribe?token=xxx&type=all|marketing|digest`
3. One-click unsubscribe (no login required)
4. Update preferences in database

---

## 8. Email Queue

### Queue Configuration
```typescript
const emailQueue = new Queue('emails', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
  },
});

// Add to queue instead of sending directly
async function queueEmail(payload: EmailPayload): Promise<void> {
  await emailQueue.add('send', payload, {
    priority: getEmailPriority(payload.template),
  });
}

function getEmailPriority(template: string): number {
  const priorities: Record<string, number> = {
    'job-failed': 1,    // Highest
    'job-complete': 2,
    'low-credits': 3,
    'welcome': 4,
    'marketing': 10,    // Lowest
  };
  return priorities[template] || 5;
}
```

### Worker
```typescript
const emailWorker = new Worker('emails', async (job) => {
  const { to, subject, template, data } = job.data;
  
  try {
    await sendEmail({ to, subject, template, data });
    console.log(`[EMAIL] Sent ${template} to ${to}`);
  } catch (error) {
    console.error(`[EMAIL] Failed: ${error.message}`);
    throw error; // Retry
  }
}, {
  connection: redis,
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 60000, // 100 emails/minute
  },
});
```

---

## 9. Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| Invalid email | Bad address | Log and skip |
| Rate limited | Too many sends | Backoff and retry |
| Template error | Missing data | Log error, send fallback |
| Delivery failed | Bounce | Mark email invalid |

### Bounce Handling
```typescript
// Webhook from Resend/SendGrid
app.post('/api/webhooks/email', async (req, res) => {
  const event = req.body;
  
  if (event.type === 'email.bounced') {
    await supabase
      .from('profiles')
      .update({ email_valid: false })
      .eq('email', event.data.email);
    
    console.log(`[EMAIL] Marked ${event.data.email} as invalid`);
  }
  
  res.json({ received: true });
});
```

---

## 10. Analytics

### Tracking
- Open rate (pixel tracking)
- Click rate (link tracking)
- Unsubscribe rate
- Bounce rate
- Delivery rate

### Metrics Table
```sql
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  template TEXT NOT NULL,
  event_type TEXT NOT NULL, -- sent, delivered, opened, clicked, bounced
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 11. Configuration

```typescript
const EMAIL_CONFIG = {
  provider: 'resend',
  from: {
    name: 'CanvasCast',
    email: 'noreply@canvascast.ai',
  },
  replyTo: 'support@canvascast.ai',
  
  // Rate limits
  maxPerMinute: 100,
  maxPerHour: 1000,
  
  // Retry
  maxAttempts: 3,
  backoffMs: 5000,
  
  // Templates
  templatesDir: './src/templates',
  
  // Tracking
  trackOpens: true,
  trackClicks: true,
};
```

---

## 12. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/notify.ts` | Notification trigger functions |
| `apps/worker/src/userNotify.ts` | User notification wrapper |
| `apps/worker/src/templates/` | Email templates |
| `apps/api/src/index.ts` | Preferences endpoints |
| `apps/web/src/app/app/settings/notifications/` | Settings UI |

---

## 13. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Auth** | Auth → Email | Queue | Welcome email |
| **Pipeline** | Pipeline → Email | Queue | Job complete/failed |
| **Billing** | Billing → Email | Queue | Payment receipts |
| **Database** | Email ↔ DB | Supabase client | User prefs, logs |
| **Resend** | Email → External | HTTP API | Send emails |
| **Frontend** | Frontend ↔ Email | REST API | Manage preferences |

### Inbound Interfaces

```typescript
// From Auth (new user)
await emailQueue.add('send', {
  to: newUser.email,
  template: 'welcome',
  data: { name: newUser.name, trialCredits: 10 }
});

// From Pipeline (job complete)
await notifyJobComplete(job, ctx);
// Internally calls:
await emailQueue.add('send', {
  to: user.email,
  template: 'job-complete',
  data: { title, downloadUrl, duration, credits }
});

// From Pipeline (job failed)
await notifyJobFailed(job, errorCode, errorMessage);

// From Billing (low credits)
await checkLowCreditWarning(userId);

// From Frontend: Update preferences
PATCH /api/v1/notifications/preferences
Body: { job_complete: false }
```

### Outbound Interfaces

```typescript
// To Resend: Send email
await resend.emails.send({
  from: 'CanvasCast <noreply@canvascast.ai>',
  to: user.email,
  subject: subject,
  html: renderedTemplate
});

// To Database: Log notification
INSERT INTO notification_logs (user_id, type, status, sent_at)
VALUES ($1, $2, 'sent', NOW());

// To Database: Check preferences
SELECT notification_prefs FROM profiles WHERE id = $1;

// To Frontend: Preferences response
Response: { job_complete: true, job_failed: true, marketing: false }
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       EMAIL SUBSYSTEM                            │
│                                                                 │
│  TRIGGERS                          PROCESSING                   │
│  ┌──────────┐                                                  │
│  │   Auth   │──► welcome                                       │
│  │ (signup) │    email          ┌────────────────────┐        │
│  └──────────┘         ──────────►                    │        │
│                                  │   BullMQ Queue    │        │
│  ┌──────────┐                    │   'emails'        │        │
│  │ Pipeline │──► job_complete    │                    │        │
│  │(complete)│    email    ──────►│  ┌────────────┐   │        │
│  └──────────┘                    │  │ Priority   │   │        │
│                                  │  │ Sorting    │   │        │
│  ┌──────────┐                    │  └────────────┘   │        │
│  │ Pipeline │──► job_failed      │                    │        │
│  │ (failed) │    email    ──────►│                    │        │
│  └──────────┘                    └─────────┬──────────┘        │
│                                            │                    │
│  ┌──────────┐                              ▼                    │
│  │ Billing  │──► receipt     ┌────────────────────────┐        │
│  │(payment) │    email       │    Email Worker        │        │
│  └──────────┘         ──────►│                        │        │
│                              │  1. Check prefs        │        │
│                              │  2. Render template    │        │
│                              │  3. Send via Resend    │        │
│                              │  4. Log result         │        │
│                              └───────────┬────────────┘        │
│                                          │                      │
│                                          ▼                      │
│                              ┌────────────────────────┐        │
│                              │       Resend API       │        │
│                              │   (Email delivery)     │        │
│                              └────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Notification Priority

```
┌────────────────────────────────────────────────────────────┐
│                  EMAIL PRIORITY QUEUE                       │
│                                                            │
│  Priority 1: job_failed     ──► Immediate (user action)   │
│  Priority 2: job_complete   ──► High (user waiting)       │
│  Priority 3: low_credits    ──► Medium (time-sensitive)   │
│  Priority 4: welcome        ──► Normal                     │
│  Priority 10: marketing     ──► Low (batched)             │
│                                                            │
│  Rate limit: 100/minute, 1000/hour                        │
└────────────────────────────────────────────────────────────┘
```

### User Preference Check

All notifications respect user preferences:

```typescript
async function shouldSendNotification(
  userId: string, 
  type: NotificationType
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_prefs')
    .eq('id', userId)
    .single();
  
  // Default to true for transactional emails
  return profile?.notification_prefs?.[type] ?? true;
}
```

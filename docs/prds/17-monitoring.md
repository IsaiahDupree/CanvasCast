# PRD: Monitoring & Observability

**Subsystem:** Monitoring  
**Version:** 1.0  
**Status:** Planned  
**Owner:** Isaiah  

---

## 1. Overview

The Monitoring & Observability subsystem provides visibility into system health, performance, and errors. It includes structured logging, metrics collection, error tracking, and alerting across all services.

### Business Goal
Detect and diagnose issues quickly to minimize downtime and improve user experience.

---

## 2. User Stories

### US-1: Error Detection
**As an** operator  
**I want** immediate error alerts  
**So that** I can fix issues before users complain

### US-2: Performance Visibility
**As an** operator  
**I want** performance metrics  
**So that** I can identify bottlenecks

### US-3: Debug Capability
**As a** developer  
**I want** detailed logs  
**So that** I can debug issues quickly

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MONITORING ARCHITECTURE                              │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │   Frontend  │  │     API     │  │   Worker    │                     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                     │
│         │                │                │                             │
│         └────────────────┼────────────────┘                             │
│                          │                                              │
│                          ▼                                              │
│                  ┌───────────────┐                                      │
│                  │   Collector   │                                      │
│                  │  (OpenTelem)  │                                      │
│                  └───────┬───────┘                                      │
│                          │                                              │
│          ┌───────────────┼───────────────┐                             │
│          ▼               ▼               ▼                             │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐                       │
│   │   Logs    │   │  Metrics  │   │  Traces   │                       │
│   │ (Railway) │   │(Prometheus)│  │ (Jaeger)  │                       │
│   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘                       │
│         │               │               │                              │
│         └───────────────┼───────────────┘                              │
│                         ▼                                              │
│                 ┌───────────────┐                                      │
│                 │   Dashboard   │                                      │
│                 │   (Grafana)   │                                      │
│                 └───────────────┘                                      │
│                         │                                              │
│                         ▼                                              │
│                 ┌───────────────┐                                      │
│                 │    Alerts     │                                      │
│                 │ (PagerDuty)   │                                      │
│                 └───────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Structured Logging

### Log Format
```typescript
interface LogEntry {
  timestamp: string;      // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service: string;        // web, api, worker
  traceId?: string;       // Request correlation
  spanId?: string;        // Operation correlation
  userId?: string;        // If authenticated
  jobId?: string;         // If job-related
  metadata?: Record<string, unknown>;
}
```

### Logger Implementation
```typescript
// packages/shared/src/lib/logger.ts

import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: process.env.SERVICE_NAME,
    env: process.env.NODE_ENV,
  },
});

export function createLogger(context: LogContext) {
  return logger.child(context);
}

// Usage
const log = createLogger({ jobId: 'xxx', userId: 'yyy' });
log.info('Starting pipeline');
log.error({ err: error }, 'Pipeline failed');
```

### Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| `debug` | Development details | Variable values |
| `info` | Normal operations | Job started, completed |
| `warn` | Recoverable issues | Retry attempt |
| `error` | Failures | Pipeline error |

---

## 5. Metrics Collection

### Core Metrics

#### API Metrics
```typescript
// Request duration histogram
const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Request counter
const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

// Active connections
const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Active HTTP connections',
});
```

#### Worker Metrics
```typescript
// Job duration histogram
const jobDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'Job processing duration',
  labelNames: ['status', 'niche'],
  buckets: [60, 120, 300, 600, 900],
});

// Step duration
const stepDuration = new Histogram({
  name: 'pipeline_step_duration_seconds',
  help: 'Pipeline step duration',
  labelNames: ['step', 'status'],
  buckets: [5, 15, 30, 60, 120, 300],
});

// Queue depth
const queueDepth = new Gauge({
  name: 'job_queue_depth',
  help: 'Jobs waiting in queue',
});

// Jobs by status
const jobsByStatus = new Gauge({
  name: 'jobs_by_status',
  help: 'Jobs grouped by status',
  labelNames: ['status'],
});
```

#### Business Metrics
```typescript
// Credits used
const creditsUsed = new Counter({
  name: 'credits_used_total',
  help: 'Total credits consumed',
});

// Revenue
const revenue = new Counter({
  name: 'revenue_usd_total',
  help: 'Total revenue in USD',
  labelNames: ['type'], // purchase, subscription
});

// Signups
const signups = new Counter({
  name: 'signups_total',
  help: 'Total user signups',
  labelNames: ['method'], // email, google
});
```

### Metrics Endpoint
```typescript
// apps/api/src/metrics.ts
import { register } from 'prom-client';

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## 6. Distributed Tracing

### Trace Context
```typescript
interface TraceContext {
  traceId: string;   // Spans entire request
  spanId: string;    // Individual operation
  parentSpanId?: string;
}

// Generate trace context
function createTrace(): TraceContext {
  return {
    traceId: crypto.randomUUID(),
    spanId: crypto.randomBytes(8).toString('hex'),
  };
}

// Create child span
function createSpan(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: crypto.randomBytes(8).toString('hex'),
    parentSpanId: parent.spanId,
  };
}
```

### Request Tracing Middleware
```typescript
// apps/api/src/middleware/tracing.ts

function tracingMiddleware(req, res, next) {
  // Extract or create trace
  const traceId = req.headers['x-trace-id'] || createTrace().traceId;
  const spanId = crypto.randomBytes(8).toString('hex');
  
  req.trace = { traceId, spanId };
  res.setHeader('x-trace-id', traceId);
  
  // Log request start
  logger.info({
    traceId,
    spanId,
    method: req.method,
    path: req.path,
  }, 'Request started');
  
  // Log request end
  res.on('finish', () => {
    logger.info({
      traceId,
      spanId,
      status: res.statusCode,
      duration: Date.now() - req.startTime,
    }, 'Request completed');
  });
  
  next();
}
```

### Pipeline Tracing
```typescript
// apps/worker/src/pipeline/runner.ts

async function runPipeline(job: Job): Promise<void> {
  const trace = { traceId: job.id, spanId: 'pipeline' };
  
  for (const step of STEPS) {
    const stepSpan = createSpan(trace);
    
    logger.info({ ...stepSpan, step: step.name }, 'Step started');
    
    const startTime = Date.now();
    
    try {
      await step.execute(ctx);
      
      stepDuration.observe(
        { step: step.name, status: 'success' },
        (Date.now() - startTime) / 1000
      );
      
    } catch (error) {
      stepDuration.observe(
        { step: step.name, status: 'error' },
        (Date.now() - startTime) / 1000
      );
      
      logger.error({ ...stepSpan, error }, 'Step failed');
      throw error;
    }
  }
}
```

---

## 7. Error Tracking

### Error Capture
```typescript
// Sentry integration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Capture errors with context
function captureError(error: Error, context?: ErrorContext) {
  Sentry.withScope((scope) => {
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.jobId) scope.setTag('jobId', context.jobId);
    if (context?.extra) scope.setExtras(context.extra);
    
    Sentry.captureException(error);
  });
}
```

### Error Categorization
```typescript
// Categorize errors for alerting
function categorizeError(error: Error): ErrorCategory {
  if (error.code?.startsWith('AUTH_')) return 'auth';
  if (error.code?.startsWith('PIPELINE_')) return 'pipeline';
  if (error.code?.startsWith('PAYMENT_')) return 'payment';
  if (error.message.includes('timeout')) return 'timeout';
  if (error.message.includes('rate limit')) return 'rate_limit';
  return 'unknown';
}
```

---

## 8. Health Checks

### Health Endpoints
```typescript
// apps/api/src/health.ts

// Liveness: Is the process running?
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness: Can it handle requests?
app.get('/ready', async (req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
  ]);
  
  const healthy = checks.every(c => c.healthy);
  
  res.status(healthy ? 200 : 503).json({
    ready: healthy,
    checks: Object.fromEntries(
      checks.map(c => [c.name, { healthy: c.healthy, latency: c.latency }])
    ),
  });
});

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await supabase.from('profiles').select('id').limit(1);
    return { name: 'database', healthy: true, latency: Date.now() - start };
  } catch {
    return { name: 'database', healthy: false, latency: Date.now() - start };
  }
}
```

### Worker Health
```typescript
// apps/worker/src/health.ts

app.get('/health', async (req, res) => {
  const queueStats = await videoQueue.getJobCounts();
  
  res.json({
    status: 'ok',
    queue: {
      waiting: queueStats.waiting,
      active: queueStats.active,
      failed: queueStats.failed,
    },
    uptime: process.uptime(),
  });
});
```

---

## 9. Alerting

### Alert Rules
```yaml
# alerts.yml
groups:
  - name: canvascast
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          
      # Job queue backup
      - alert: QueueBacklog
        expr: job_queue_depth > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Job queue backlog
          
      # High job failure rate
      - alert: HighJobFailureRate
        expr: rate(jobs_by_status{status="FAILED"}[1h]) > 0.1
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: High job failure rate
          
      # Slow response times
      - alert: SlowResponses
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Slow API responses
```

### Alert Channels
```typescript
// Notification channels
const ALERT_CHANNELS = {
  critical: ['pagerduty', 'slack'],
  warning: ['slack'],
  info: ['slack'],
};

async function sendAlert(alert: Alert): Promise<void> {
  const channels = ALERT_CHANNELS[alert.severity];
  
  for (const channel of channels) {
    switch (channel) {
      case 'pagerduty':
        await pagerduty.createIncident(alert);
        break;
      case 'slack':
        await slack.postMessage({
          channel: '#alerts',
          text: `[${alert.severity}] ${alert.summary}`,
        });
        break;
    }
  }
}
```

---

## 10. Dashboards

### Key Dashboards

#### System Overview
- Request rate & latency
- Error rate
- Active users
- Queue depth

#### Pipeline Performance
- Job completion rate
- Step durations
- Failure distribution
- Cost per job

#### Business Metrics
- Signups/conversions
- Revenue
- Credit usage
- Active subscriptions

### Dashboard Configuration
```json
// grafana/dashboards/overview.json
{
  "title": "CanvasCast Overview",
  "panels": [
    {
      "title": "Request Rate",
      "type": "graph",
      "targets": [{
        "expr": "rate(http_requests_total[5m])"
      }]
    },
    {
      "title": "Error Rate",
      "type": "stat",
      "targets": [{
        "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])"
      }]
    },
    {
      "title": "Job Queue Depth",
      "type": "gauge",
      "targets": [{
        "expr": "job_queue_depth"
      }]
    }
  ]
}
```

---

## 11. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **All Services** | Services → Monitor | SDK/HTTP | Send metrics/logs |
| **Grafana** | Monitor → Grafana | Prometheus | Visualization |
| **PagerDuty** | Monitor → PagerDuty | Webhook | Alerting |
| **Slack** | Monitor → Slack | Webhook | Notifications |

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                   MONITORING SUBSYSTEM                           │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Frontend │  │   API    │  │  Worker  │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
│       │             │             │                             │
│       │  logs       │  metrics    │  traces                     │
│       └─────────────┼─────────────┘                             │
│                     ▼                                           │
│              ┌───────────────┐                                  │
│              │  Collectors   │                                  │
│              │  - Pino       │                                  │
│              │  - Prometheus │                                  │
│              │  - Sentry     │                                  │
│              └───────┬───────┘                                  │
│                      │                                          │
│          ┌───────────┼───────────┐                             │
│          ▼           ▼           ▼                             │
│   ┌───────────┐ ┌─────────┐ ┌─────────┐                       │
│   │   Logs    │ │ Metrics │ │ Errors  │                       │
│   │ (Railway) │ │(Grafana)│ │(Sentry) │                       │
│   └───────────┘ └─────────┘ └─────────┘                       │
│                      │                                          │
│                      ▼                                          │
│              ┌───────────────┐                                  │
│              │    Alerts     │                                  │
│              │  PagerDuty    │                                  │
│              │    Slack      │                                  │
│              └───────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Files

| File | Purpose |
|------|---------|
| `packages/shared/src/lib/logger.ts` | Structured logging |
| `apps/api/src/middleware/tracing.ts` | Request tracing |
| `apps/api/src/metrics.ts` | Metrics endpoint |
| `apps/api/src/health.ts` | Health checks |
| `apps/worker/src/metrics.ts` | Worker metrics |
| `infra/grafana/` | Dashboard configs |
| `infra/alerts.yml` | Alert rules |

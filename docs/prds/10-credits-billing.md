# PRD: Credits & Billing (Stripe)

**Subsystem:** Billing  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Credits & Billing subsystem manages user credits, Stripe payment integration, and subscription handling. Users pay with credits (1 credit ≈ 1 minute of video), can purchase credit packs, or subscribe for monthly allowances.

### Business Goal
Monetize video generation fairly based on output duration while providing flexible payment options.

---

## 2. User Stories

### US-1: Trial Credits
**As a** new user  
**I want** free credits on signup  
**So that** I can try the product before paying

### US-2: Credit Purchase
**As a** user  
**I want to** buy credit packs  
**So that** I can generate more videos

### US-3: Credit Balance
**As a** user  
**I want to** see my credit balance  
**So that** I know how many videos I can create

### US-4: Subscription
**As a** power user  
**I want** a monthly subscription with credits  
**So that** I get better value for frequent use

---

## 3. Credit Model

### Credit Costs
| Output | Cost |
|--------|------|
| 1 minute of video | 1 credit |
| Minimum job | 1 credit |
| Premium niche (history, documentary) | 1.5x multiplier |

### Credit Packs (One-Time)
| Pack | Credits | Price | Per Credit |
|------|---------|-------|------------|
| Starter | 10 | $9 | $0.90 |
| Creator | 50 | $39 | $0.78 |
| Pro | 150 | $99 | $0.66 |

### Subscriptions (Monthly)
| Plan | Credits/Month | Price | Rollover |
|------|---------------|-------|----------|
| Hobbyist | 30 | $19/mo | No |
| Creator | 100 | $49/mo | 50 max |
| Business | 300 | $129/mo | 150 max |

---

## 4. Data Model

### Table: `credit_ledger`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → auth.users |
| `type` | TEXT | purchase/usage/refund/grant/expire |
| `amount` | INT | Positive = add, negative = deduct |
| `balance_after` | INT | Running balance |
| `note` | TEXT | Description |
| `job_id` | UUID | FK → jobs (if usage) |
| `stripe_payment_id` | TEXT | Stripe reference |
| `created_at` | TIMESTAMPTZ | Transaction time |

### Table: `subscriptions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → auth.users |
| `stripe_subscription_id` | TEXT | Stripe sub ID |
| `stripe_customer_id` | TEXT | Stripe customer |
| `plan` | TEXT | hobbyist/creator/business |
| `status` | TEXT | active/canceled/past_due |
| `credits_per_month` | INT | Monthly allowance |
| `current_period_start` | TIMESTAMPTZ | Billing period start |
| `current_period_end` | TIMESTAMPTZ | Billing period end |
| `cancel_at_period_end` | BOOLEAN | Pending cancellation |
| `created_at` | TIMESTAMPTZ | Creation time |

### RPC Functions

```sql
-- Get current credit balance
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(SUM(amount), 0)::INT
  FROM credit_ledger
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- Reserve credits for a job
CREATE OR REPLACE FUNCTION reserve_credits(
  p_user_id UUID,
  p_job_id UUID,
  p_amount INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_balance INT;
BEGIN
  SELECT get_credit_balance(p_user_id) INTO v_balance;
  
  IF v_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  INSERT INTO credit_ledger (user_id, type, amount, job_id, note)
  VALUES (p_user_id, 'reserve', -p_amount, p_job_id, 'Reserved for job');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Finalize credits after job completion
CREATE OR REPLACE FUNCTION finalize_job_credits(
  p_user_id UUID,
  p_job_id UUID,
  p_final_cost INT
) RETURNS VOID AS $$
DECLARE
  v_reserved INT;
BEGIN
  -- Get reserved amount
  SELECT ABS(amount) INTO v_reserved
  FROM credit_ledger
  WHERE job_id = p_job_id AND type = 'reserve';
  
  -- If final cost is less, refund difference
  IF p_final_cost < v_reserved THEN
    INSERT INTO credit_ledger (user_id, type, amount, job_id, note)
    VALUES (p_user_id, 'refund', v_reserved - p_final_cost, p_job_id, 
            'Partial refund - actual cost less than reserved');
  END IF;
  
  -- Mark reserved as used
  UPDATE credit_ledger
  SET type = 'usage', note = 'Video generation completed'
  WHERE job_id = p_job_id AND type = 'reserve';
END;
$$ LANGUAGE plpgsql;

-- Release credits on job failure
CREATE OR REPLACE FUNCTION release_job_credits(p_job_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE credit_ledger
  SET type = 'refund', note = 'Job failed - credits refunded'
  WHERE job_id = p_job_id AND type = 'reserve';
END;
$$ LANGUAGE plpgsql;
```

---

## 5. API Endpoints

### Get Credit Balance
```
GET /api/v1/credits/balance
```

Response:
```json
{
  "balance": 45,
  "reserved": 10,
  "available": 35
}
```

### Get Credit History
```
GET /api/v1/credits/history?limit=50
```

Response:
```json
{
  "transactions": [
    {
      "id": "...",
      "type": "purchase",
      "amount": 50,
      "note": "Purchased Creator pack",
      "createdAt": "2026-01-17T..."
    },
    {
      "id": "...",
      "type": "usage",
      "amount": -5,
      "note": "Video generation - 5 min",
      "jobId": "...",
      "createdAt": "2026-01-16T..."
    }
  ]
}
```

### Purchase Credits (Checkout)
```
POST /api/v1/credits/purchase
```

Request:
```json
{
  "credits": 50,
  "price_id": "price_creator_pack"
}
```

Response:
```json
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

### Create Subscription
```
POST /api/v1/subscriptions
```

Request:
```json
{
  "plan": "creator",
  "price_id": "price_creator_monthly"
}
```

Response:
```json
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

### Cancel Subscription
```
POST /api/v1/subscriptions/cancel
```

Response:
```json
{
  "message": "Subscription will cancel at period end",
  "cancel_at": "2026-02-17T..."
}
```

---

## 6. Stripe Integration

### Stripe Products Setup
```typescript
const STRIPE_PRODUCTS = {
  // One-time credit packs
  credit_packs: {
    starter: {
      priceId: 'price_starter_10',
      credits: 10,
      amount: 900, // $9
    },
    creator: {
      priceId: 'price_creator_50',
      credits: 50,
      amount: 3900, // $39
    },
    pro: {
      priceId: 'price_pro_150',
      credits: 150,
      amount: 9900, // $99
    },
  },
  
  // Subscriptions
  subscriptions: {
    hobbyist: {
      priceId: 'price_hobbyist_monthly',
      credits: 30,
      amount: 1900, // $19/mo
    },
    creator: {
      priceId: 'price_creator_monthly',
      credits: 100,
      amount: 4900, // $49/mo
    },
    business: {
      priceId: 'price_business_monthly',
      credits: 300,
      amount: 12900, // $129/mo
    },
  },
};
```

### Checkout Session Creation
```typescript
async function createCheckoutSession(
  userId: string,
  priceId: string,
  credits: number,
  mode: 'payment' | 'subscription'
): Promise<string> {
  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(userId);
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode,
    payment_method_types: ['card'],
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    metadata: {
      user_id: userId,
      credits: credits.toString(),
    },
    success_url: `${FRONTEND_URL}/app/credits?success=true`,
    cancel_url: `${FRONTEND_URL}/app/credits?canceled=true`,
  });
  
  return session.url!;
}
```

### Webhook Handler
```typescript
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), 
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const event = stripe.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;
      
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
    }
    
    res.json({ received: true });
  }
);

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const credits = parseInt(session.metadata?.credits || '0');
  
  if (userId && credits > 0) {
    await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_amount: credits,
      p_type: 'purchase',
      p_note: `Purchased ${credits} credits via Stripe`,
      p_stripe_payment_id: session.payment_intent as string,
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Monthly subscription renewal
  const subscription = await stripe.subscriptions.retrieve(
    invoice.subscription as string
  );
  
  const userId = subscription.metadata?.user_id;
  const plan = subscription.metadata?.plan;
  const credits = STRIPE_PRODUCTS.subscriptions[plan]?.credits || 0;
  
  if (userId && credits > 0) {
    await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_amount: credits,
      p_type: 'subscription',
      p_note: `Monthly ${plan} subscription - ${credits} credits`,
    });
  }
}
```

---

## 7. Credit Flow

### Job Creation
```
1. User submits video request
2. Calculate estimated credits (target_minutes × niche_multiplier)
3. Check balance >= estimated
4. Reserve credits (deduct from available)
5. Create job and queue for processing
6. If queue fails, release reservation
```

### Job Completion
```
1. Calculate final credits (actual_duration × niche_multiplier)
2. If final < reserved: refund difference
3. Mark reserved credits as used
4. Update job.cost_credits_final
```

### Job Failure
```
1. Detect failure at any pipeline step
2. Release all reserved credits (add back)
3. Update job status to FAILED
4. Log refund transaction
```

---

## 8. Pricing Page UI

### Component Structure
```tsx
export function PricingPage() {
  return (
    <div>
      {/* Toggle: One-time vs Subscription */}
      <PricingToggle />
      
      {/* Credit Packs */}
      <section>
        <h2>Credit Packs</h2>
        <div className="grid grid-cols-3 gap-6">
          {Object.entries(CREDIT_PACKS).map(([id, pack]) => (
            <PricingCard
              key={id}
              title={pack.name}
              price={formatPrice(pack.amount)}
              credits={pack.credits}
              perCredit={formatPrice(pack.amount / pack.credits)}
              onSelect={() => handlePurchase(pack.priceId, pack.credits)}
            />
          ))}
        </div>
      </section>
      
      {/* Subscriptions */}
      <section>
        <h2>Monthly Plans</h2>
        <div className="grid grid-cols-3 gap-6">
          {Object.entries(SUBSCRIPTIONS).map(([id, plan]) => (
            <PricingCard
              key={id}
              title={plan.name}
              price={formatPrice(plan.amount)}
              period="/month"
              credits={plan.credits}
              features={plan.features}
              onSelect={() => handleSubscribe(plan.priceId)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## 9. Security

### Webhook Verification
- Verify Stripe signature on all webhooks
- Reject unsigned requests
- Log all webhook events

### Idempotency
- Use Stripe payment_intent ID as idempotency key
- Prevent duplicate credit additions
- Check for existing ledger entry before insert

### Rate Limiting
- Max 10 purchase attempts per hour
- Block suspicious patterns

---

## 10. Metrics

| Metric | Description |
|--------|-------------|
| `credits_purchased` | Credits bought |
| `credits_used` | Credits consumed |
| `credits_refunded` | Credits returned |
| `revenue_total` | Stripe revenue |
| `subscription_mrr` | Monthly recurring |
| `churn_rate` | Subscription cancellations |

---

## 11. Files

| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | Billing endpoints |
| `apps/web/src/app/pricing/page.tsx` | Pricing UI |
| `apps/web/src/app/app/credits/page.tsx` | Credit dashboard |
| `apps/web/src/app/api/stripe/` | Stripe API routes |
| `supabase/migrations/*_credits.sql` | Credit schema |

---

## 12. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Auth** | Auth → Billing | DB trigger | Grant trial credits |
| **Pipeline** | Pipeline → Billing | Supabase RPC | Reserve/finalize credits |
| **Stripe** | Stripe → Billing | Webhook | Payment events |
| **Email** | Billing → Email | Queue | Payment confirmations |
| **Frontend** | Frontend ↔ Billing | REST API | Balance, purchase |
| **Database** | Billing ↔ DB | Supabase client | Credit ledger |

### Inbound Interfaces

```typescript
// From Auth (new user trigger)
CREATE TRIGGER grant_trial_credits
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION grant_trial_credits();

// From Pipeline: Reserve credits for job
await supabase.rpc('reserve_credits', {
  p_user_id: userId,
  p_job_id: jobId,
  p_amount: estimatedCredits
});

// From Stripe: Payment webhook
POST /api/webhooks/stripe
Event: checkout.session.completed
Payload: { metadata: { user_id, credits } }

// From Frontend: Get balance
GET /api/v1/credits/balance
```

### Outbound Interfaces

```typescript
// To Database: Credit ledger operations
INSERT INTO credit_ledger (user_id, type, amount, note)
VALUES ($1, $2, $3, $4);

// To Stripe: Create checkout session
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'payment',
  line_items: [{ price: priceId, quantity: 1 }]
});

// To Email: Purchase confirmation
await emailQueue.add('send', {
  to: user.email,
  template: 'purchase-confirmation',
  data: { credits, amount }
});

// To Frontend: Balance response
Response: { balance: 45, reserved: 10, available: 35 }
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      BILLING SUBSYSTEM                           │
│                                                                 │
│        INBOUND                              OUTBOUND            │
│  ┌──────────────┐                     ┌──────────────┐          │
│  │    Auth      │──► Trial credits    │   Stripe     │◄── Create│
│  │  (signup)    │                     │  Checkout    │    session│
│  └──────────────┘                     └──────────────┘          │
│                                                                 │
│  ┌──────────────┐     ┌────────────┐                           │
│  │   Pipeline   │──►  │  Credit    │                           │
│  │ (job start)  │     │  Ledger    │                           │
│  └──────────────┘     │  (Postgres)│                           │
│                       └────────────┘                           │
│  ┌──────────────┐           ▲                                  │
│  │   Stripe     │──► Add credits                               │
│  │  (webhook)   │    on payment                                │
│  └──────────────┘                                              │
│                                                                │
│  ┌──────────────┐     ┌────────────┐    ┌──────────────┐      │
│  │  Frontend    │◄───►│  REST API  │───►│    Email     │      │
│  │  (balance,   │     │  /credits  │    │ (receipts)   │      │
│  │   purchase)  │     └────────────┘    └──────────────┘      │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Credit Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                    CREDIT LIFECYCLE                           │
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │ ACQUIRE │───►│ RESERVE │───►│ CONSUME │───►│ REFUND? │   │
│  │         │    │         │    │         │    │         │   │
│  │ Trial   │    │ Job     │    │ Job     │    │ Job     │   │
│  │ Purchase│    │ Created │    │ Complete│    │ Failed  │   │
│  │ Subscr. │    │         │    │         │    │         │   │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│                                                              │
│  Ledger:        Ledger:        Ledger:        Ledger:       │
│  +10 purchase   -5 reserve     reserve→usage  reserve→refund│
└──────────────────────────────────────────────────────────────┘
```

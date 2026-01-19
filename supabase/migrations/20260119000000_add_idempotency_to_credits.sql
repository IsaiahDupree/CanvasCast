-- Add idempotency_key column to credit_ledger for preventing duplicate webhook processing
-- This ensures that if Stripe sends the same webhook multiple times, credits are only added once

alter table public.credit_ledger
add column if not exists idempotency_key text;

-- Create unique index on idempotency_key (allowing nulls for legacy records)
create unique index if not exists credit_ledger_idempotency_key_idx
on public.credit_ledger(idempotency_key)
where idempotency_key is not null;

-- Update add_credits function to support idempotency
drop function if exists public.add_credits(uuid,int,public.ledger_type,text);

create or replace function public.add_credits(
  p_user_id uuid,
  p_amount int,
  p_type public.ledger_type,
  p_note text default null,
  p_idempotency_key text default null
)
returns void
language plpgsql
security definer
as $$
begin
  -- If idempotency_key is provided, check if it already exists
  if p_idempotency_key is not null then
    -- Try to insert, but do nothing if idempotency_key already exists
    insert into public.credit_ledger(user_id, type, amount, note, idempotency_key)
    values (p_user_id, p_type, p_amount, p_note, p_idempotency_key)
    on conflict (idempotency_key) do nothing;
  else
    -- No idempotency_key, insert normally
    insert into public.credit_ledger(user_id, type, amount, note, idempotency_key)
    values (p_user_id, p_type, p_amount, p_note, null);
  end if;
end;
$$;

-- Update permissions
revoke all on function public.add_credits(uuid,int,public.ledger_type,text,text) from public;
grant execute on function public.add_credits(uuid,int,public.ledger_type,text,text) to anon, authenticated;

-- Add comment
comment on column public.credit_ledger.idempotency_key is 'Unique key to prevent duplicate credit additions from webhooks (e.g., Stripe payment_intent ID)';
comment on function public.add_credits(uuid,int,public.ledger_type,text,text) is 'Add credits to user account with optional idempotency key for webhook deduplication';

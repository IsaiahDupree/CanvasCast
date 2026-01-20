-- ============================================
-- Pipeline Metrics Table
-- ANALYTICS-003: Track success rates, durations, and failure reasons
-- ============================================

create table public.pipeline_metrics (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Timing
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone,
  total_duration_ms bigint,

  -- Step metrics (JSONB array of step data)
  steps jsonb not null default '[]'::jsonb,

  -- Retry tracking
  retry_attempt integer default 0,

  -- Failure categorization
  failure_category text,

  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Indexes for querying
create index idx_pipeline_metrics_job_id on public.pipeline_metrics(job_id);
create index idx_pipeline_metrics_user_id on public.pipeline_metrics(user_id);
create index idx_pipeline_metrics_created_at on public.pipeline_metrics(created_at desc);
create index idx_pipeline_metrics_failure_category on public.pipeline_metrics(failure_category) where failure_category is not null;

-- Index for JSONB step queries (for analyzing specific steps)
create index idx_pipeline_metrics_steps_gin on public.pipeline_metrics using gin(steps);

-- Enable RLS
alter table public.pipeline_metrics enable row level security;

-- RLS Policies
create policy "Users can view their own metrics"
  on public.pipeline_metrics
  for select
  using (auth.uid() = user_id);

create policy "Service role can insert metrics"
  on public.pipeline_metrics
  for insert
  with check (true);

create policy "Service role can update metrics"
  on public.pipeline_metrics
  for update
  using (true);

-- Grant permissions
grant select on public.pipeline_metrics to authenticated;
grant all on public.pipeline_metrics to service_role;

-- ============================================
-- Helper Functions for Metrics Aggregation
-- ============================================

-- Function to get step statistics
create or replace function public.get_step_statistics(
  p_start_date timestamp with time zone default null,
  p_end_date timestamp with time zone default null
)
returns table (
  step text,
  total_runs bigint,
  success_count bigint,
  failed_count bigint,
  success_rate numeric,
  avg_duration_ms numeric,
  median_duration_ms numeric
)
language plpgsql
security definer
as $$
begin
  return query
  with step_data as (
    select
      jsonb_array_elements(steps) as step_obj
    from public.pipeline_metrics
    where
      (p_start_date is null or created_at >= p_start_date)
      and (p_end_date is null or created_at <= p_end_date)
  ),
  step_metrics as (
    select
      step_obj->>'step' as step_name,
      step_obj->>'status' as status,
      (step_obj->>'duration_ms')::bigint as duration
    from step_data
    where step_obj->>'step' is not null
  )
  select
    sm.step_name::text,
    count(*)::bigint as total_runs,
    count(*) filter (where sm.status = 'success')::bigint as success_count,
    count(*) filter (where sm.status = 'failed')::bigint as failed_count,
    round((count(*) filter (where sm.status = 'success')::numeric / count(*)) * 100, 2) as success_rate,
    round(avg(sm.duration))::numeric as avg_duration_ms,
    percentile_cont(0.5) within group (order by sm.duration)::numeric as median_duration_ms
  from step_metrics sm
  where sm.duration is not null
  group by sm.step_name
  order by sm.step_name;
end;
$$;

-- Function to get failure reasons
create or replace function public.get_failure_reasons(
  p_start_date timestamp with time zone default null,
  p_end_date timestamp with time zone default null
)
returns table (
  error_code text,
  failure_category text,
  count bigint,
  percentage numeric
)
language plpgsql
security definer
as $$
begin
  return query
  with step_data as (
    select
      jsonb_array_elements(steps) as step_obj,
      pm.failure_category
    from public.pipeline_metrics pm
    where
      (p_start_date is null or created_at >= p_start_date)
      and (p_end_date is null or created_at <= p_end_date)
  ),
  failed_steps as (
    select
      step_obj->>'error_code' as err_code,
      failure_category
    from step_data
    where step_obj->>'status' = 'failed'
      and step_obj->>'error_code' is not null
  ),
  error_counts as (
    select
      err_code::text,
      failure_category::text,
      count(*)::bigint as err_count
    from failed_steps
    group by err_code, failure_category
  ),
  total_errors as (
    select sum(err_count) as total from error_counts
  )
  select
    ec.err_code,
    ec.failure_category,
    ec.err_count,
    round((ec.err_count::numeric / te.total) * 100, 2) as percentage
  from error_counts ec
  cross join total_errors te
  order by ec.err_count desc;
end;
$$;

-- Function to get pipeline health summary
create or replace function public.get_pipeline_health(
  p_start_date timestamp with time zone default null,
  p_end_date timestamp with time zone default null
)
returns table (
  total_jobs bigint,
  successful_jobs bigint,
  failed_jobs bigint,
  success_rate numeric,
  avg_total_duration_ms numeric,
  median_total_duration_ms numeric
)
language plpgsql
security definer
as $$
begin
  return query
  with metrics_data as (
    select
      pm.id,
      pm.total_duration_ms,
      exists(
        select 1 from jsonb_array_elements(pm.steps) as step
        where step->>'status' = 'failed'
      ) as has_failure
    from public.pipeline_metrics pm
    where
      (p_start_date is null or pm.created_at >= p_start_date)
      and (p_end_date is null or pm.created_at <= p_end_date)
  )
  select
    count(*)::bigint as total_jobs,
    count(*) filter (where not has_failure)::bigint as successful_jobs,
    count(*) filter (where has_failure)::bigint as failed_jobs,
    round((count(*) filter (where not has_failure)::numeric / count(*)) * 100, 2) as success_rate,
    round(avg(total_duration_ms))::numeric as avg_total_duration_ms,
    percentile_cont(0.5) within group (order by total_duration_ms)::numeric as median_total_duration_ms
  from metrics_data
  where total_duration_ms is not null;
end;
$$;

-- Grant execute permissions on functions
grant execute on function public.get_step_statistics to authenticated;
grant execute on function public.get_failure_reasons to authenticated;
grant execute on function public.get_pipeline_health to authenticated;

comment on table public.pipeline_metrics is 'Tracks pipeline execution metrics for success rates, durations, and failure analysis';
comment on function public.get_step_statistics is 'Returns aggregated statistics for each pipeline step';
comment on function public.get_failure_reasons is 'Returns categorized failure reasons with counts and percentages';
comment on function public.get_pipeline_health is 'Returns overall pipeline health metrics';

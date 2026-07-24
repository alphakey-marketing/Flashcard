-- ============================================================================
-- Migration: AI usage quota + tier flag
-- Adds: user_tier (one row per user, is_paid flag), ai_usage (per-user daily
-- counter for AI-costing calls: generate-sentence, extract-vocab, translate,
-- import-url's punctuation-restore step).
--
-- user_tier.is_paid has NO insert/update policy for the authenticated role on
-- purpose — a logged-in user can read their own row but cannot set is_paid
-- themselves. It's flipped manually via the Supabase Dashboard (service role)
-- for now; a future Play Billing/StoreKit webhook is the intended long-term
-- writer, once the mobile in-app-purchase flow is built.
--
-- Applied manually via Supabase Dashboard -> SQL Editor (this project has no
-- supabase CLI / config.toml set up, so migrations are run by hand).
-- ============================================================================

create table if not exists public.user_tier (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_paid boolean not null default false,
  updated_at timestamptz default now()
);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, day)
);

alter table public.user_tier enable row level security;
alter table public.ai_usage enable row level security;

create policy "Users can view their own tier"
  on public.user_tier for select using (auth.uid() = user_id);

create policy "Users can view their own usage"
  on public.ai_usage for select using (auth.uid() = user_id);

create policy "Users can insert their own usage"
  on public.ai_usage for insert with check (auth.uid() = user_id);

create policy "Users can update their own usage"
  on public.ai_usage for update using (auth.uid() = user_id);

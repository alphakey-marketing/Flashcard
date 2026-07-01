-- ============================================================================
-- Migration: Reader + Global Vocab Status
-- Adds: passage_collections, passages, vocab_status
-- Does NOT touch existing decks/cards/reviews/study_sessions tables.
-- Safe to run multiple times (idempotent) and safe on a brand new project.
--
-- Applied manually via Supabase Dashboard -> SQL Editor (this project has no
-- supabase CLI / config.toml set up, so migrations are run by hand).
-- ============================================================================

create extension if not exists "uuid-ossp";

-- 1. passage_collections — folders that group reading passages
create table if not exists public.passage_collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. passages — imported reading material (pasted text / URL / future youtube)
create table if not exists public.passages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid references public.passage_collections(id) on delete set null,
  title text not null,
  source_type text not null check (source_type in ('text', 'url', 'youtube')),
  source_url text,
  raw_text text not null,
  tokens jsonb,
  word_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists passages_user_id_idx on public.passages(user_id);
create index if not exists passages_collection_id_idx on public.passages(collection_id);

-- 3. vocab_status — ONE row per (user, word), independent of decks/cards/reviews.
--    status: 0=unknown, 1-4=learning stages, 5=known, 99=ignored
create table if not exists public.vocab_status (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_form text not null,
  surface text not null,
  reading text,
  status integer not null default 0 check (status in (0,1,2,3,4,5,99)),
  note text,
  source_passage_id uuid references public.passages(id) on delete set null,
  times_seen integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, dictionary_form)
);

create index if not exists vocab_status_user_id_idx on public.vocab_status(user_id);

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.passage_collections enable row level security;
alter table public.passages enable row level security;
alter table public.vocab_status enable row level security;

-- passage_collections
drop policy if exists "Users can view their own passage collections" on public.passage_collections;
create policy "Users can view their own passage collections"
  on public.passage_collections for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own passage collections" on public.passage_collections;
create policy "Users can insert their own passage collections"
  on public.passage_collections for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own passage collections" on public.passage_collections;
create policy "Users can update their own passage collections"
  on public.passage_collections for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own passage collections" on public.passage_collections;
create policy "Users can delete their own passage collections"
  on public.passage_collections for delete using (auth.uid() = user_id);

-- passages
drop policy if exists "Users can view their own passages" on public.passages;
create policy "Users can view their own passages"
  on public.passages for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own passages" on public.passages;
create policy "Users can insert their own passages"
  on public.passages for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own passages" on public.passages;
create policy "Users can update their own passages"
  on public.passages for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own passages" on public.passages;
create policy "Users can delete their own passages"
  on public.passages for delete using (auth.uid() = user_id);

-- vocab_status
drop policy if exists "Users can view their own vocab status" on public.vocab_status;
create policy "Users can view their own vocab status"
  on public.vocab_status for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own vocab status" on public.vocab_status;
create policy "Users can insert their own vocab status"
  on public.vocab_status for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own vocab status" on public.vocab_status;
create policy "Users can update their own vocab status"
  on public.vocab_status for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own vocab status" on public.vocab_status;
create policy "Users can delete their own vocab status"
  on public.vocab_status for delete using (auth.uid() = user_id);

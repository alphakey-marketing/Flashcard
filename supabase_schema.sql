-- Supabase Schema Setup for FlashMind

-- 1. Create a table for Decks (FlashcardSets)
CREATE TABLE IF NOT EXISTS public.decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  jlpt_level TEXT CHECK (jlpt_level IN ('N5', 'N4', 'N3', 'N2', 'N1', NULL)),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create a table for Cards
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  example TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create a table for Spaced Repetition Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY,  -- deterministic: "{user_id}-{card_id}"
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE,

  -- SM-2 Algorithm fields
  interval INTEGER DEFAULT 0,
  repetition INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  next_review_date TIMESTAMPTZ DEFAULT now(),
  last_review_date TIMESTAMPTZ DEFAULT now(),

  -- History/Stats
  total_reviews INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,

  -- Status & per-button counts (needed to correctly restore state on a fresh browser)
  status TEXT NOT NULL DEFAULT 'learning' CHECK (status IN ('learning', 'reviewing', 'mastered')),
  know_it_count INTEGER NOT NULL DEFAULT 0,
  mastered_count INTEGER NOT NULL DEFAULT 0,

  -- When the card was first studied (created_at = first push)
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one review record per card per user
  UNIQUE(user_id, card_id)
);

-- 4. Create a table for Study Sessions (Analytics)
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  cards_studied INTEGER DEFAULT 0,
  cards_mastered INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- Decks Policies
CREATE POLICY "Users can view their own decks"
  ON public.decks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own decks"
  ON public.decks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks"
  ON public.decks FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks"
  ON public.decks FOR DELETE USING (auth.uid() = user_id);

-- Cards Policies
CREATE POLICY "Users can view cards of their decks"
  ON public.cards FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.decks WHERE id = public.cards.deck_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert cards to their decks"
  ON public.cards FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.decks WHERE id = deck_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update cards of their decks"
  ON public.cards FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.decks WHERE id = deck_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete cards of their decks"
  ON public.cards FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.decks WHERE id = deck_id AND user_id = auth.uid())
  );

-- Reviews Policies
CREATE POLICY "Users can view their own reviews"
  ON public.reviews FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reviews"
  ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- Study Sessions Policies
CREATE POLICY "Users can view their own study sessions"
  ON public.study_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own study sessions"
  ON public.study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── Migration: Add SRS fields to cards table ──────────────────────────────────
-- Run this migration in the Supabase SQL editor if upgrading an existing database.
-- These fields mirror the SM-2 review data stored in the reviews table,
-- allowing per-card SRS state to be read directly from the cards table.
--
-- ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS srs_interval INTEGER DEFAULT 0;
-- ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS srs_ease REAL DEFAULT 2.5;
-- ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS srs_due_date TIMESTAMPTZ DEFAULT now();
-- ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS srs_reps INTEGER DEFAULT 0;
-- ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS source TEXT;

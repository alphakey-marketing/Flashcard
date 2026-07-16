-- ============================================================================
-- Migration: Reader video playback + caption timing
-- Adds video_id / caption_cues columns to passages for YouTube-embedded
-- passages with A/B shadowing loops synced to real playback time.
-- Safe to run multiple times (idempotent).
--
-- Applied manually via Supabase Dashboard -> SQL Editor (this project has no
-- supabase CLI / config.toml set up, so migrations are run by hand).
-- ============================================================================

alter table public.passages add column if not exists video_id text;
alter table public.passages add column if not exists caption_cues jsonb;

-- VNG-ZPSxUIT-GameDev CoTrain — explicit Checkpoint milestone (Design Doc section 3/10)
--
-- Home's "Giai đoạn chương trình" widget originally inferred the
-- Checkpoint milestone by regex-matching session_blocks.title (see
-- app/app/page.tsx history). That breaks the moment someone renames a
-- block. This migration makes it an explicit, Owner/Co-owner-editable
-- pointer instead, set from the new Program settings page
-- (/app/settings).
--
-- No RLS changes needed: public.programs already has programs_update
-- (is_owner_or_co) covering every column, including this new one.

alter table public.programs
  add column checkpoint_session_id uuid references public.sessions (id) on delete set null;

comment on column public.programs.checkpoint_session_id is
  'Explicit "Trình bày dự án / Checkpoint" milestone session, set by Owner/Co-owner in /app/settings. Used by lib/schedule/milestones.ts instead of a title-text heuristic.';

-- VNG-ZPSxUIT-GameDev CoTrain — collaborative-edit tracking (Design Doc section 20)
--
-- "For collaborative group editing: Display last editor and edit time.
-- Detect stale updates using updated_at or a version number. Do not
-- silently overwrite a newer saved version." updated_at already exists
-- on every mutable table (auto-maintained by set_updated_at(), see
-- 0001_init.sql) and is enough for the stale-update check on its own.
-- What's missing is WHO last edited a row shared by multiple people —
-- groups (name/image, section 13.1), group_projects (Final Project
-- meta, section 14) and project_submissions (draft milestone
-- submissions before lock, section 14) can all be edited by any
-- student member, not just their creator, so there is no reliable
-- "owner" column to show instead. Mirrors the existing
-- submissions.last_updated_by column (0001_init.sql) already used for
-- Course Assignment submissions.

alter table public.groups
  add column last_updated_by uuid references public.profiles (id);
comment on column public.groups.last_updated_by is
  'Who last saved group identity (name/image) via updateGroupIdentity — section 20 "display last editor".';

alter table public.group_projects
  add column last_updated_by uuid references public.profiles (id);
comment on column public.group_projects.last_updated_by is
  'Who last saved Final Project meta via updateGroupProject — section 20 "display last editor".';

alter table public.project_submissions
  add column last_updated_by uuid references public.profiles (id);
comment on column public.project_submissions.last_updated_by is
  'Who last saved a draft (before lock) via saveProjectSubmission — section 20 "display last editor". submitted_by/submitted_at (already existing) still track the official "Nộp chính thức" step separately.';

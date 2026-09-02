-- VNG-ZPSxUIT-GameDev CoTrain — initial schema (Design Doc section 18)
-- Covers the 25 core tables listed in 18.1, sized for one program but
-- carrying program_id on every program-owned row so a second co-training
-- class can be added later without a redesign (section 1).
--
-- Division of responsibility: this migration + the RLS policies in
-- 0002_rls.sql enforce WHO can read/write WHAT ROW. Workflow rules that
-- doc section 19.2 asks for ("require confirmation for submit/publish/
-- withdraw/archive", "require an audit reason on reopen") are enforced in
-- the server actions that call this database, not in SQL constraints —
-- Postgres can guard shape and ownership, not multi-step confirmation UX.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'archived')),
  starts_on date,
  ends_on date,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.programs is 'A co-training course/season. Section 3.';

-- ---------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  display_name text not null,
  avatar_url text,
  organization text,
  title text,
  theme_preference text not null default 'light'
    check (theme_preference in ('light', 'dark', 'system')),
  notification_preferences jsonb not null default '{}'::jsonb,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Section 5.3 — editable + system-controlled profile fields.';

-- ---------------------------------------------------------------------
-- program_memberships — one role per program per profile (section 18.2)
-- ---------------------------------------------------------------------
create table public.program_memberships (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  invited_email text,
  role text not null check (
    role in ('owner', 'co_owner', 'sponsor', 'trainer', 'mentor_zps', 'mentor_student', 'student')
  ),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'archived')),
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_memberships_identity check (profile_id is not null or invited_email is not null),
  constraint program_memberships_unique_profile unique (program_id, profile_id)
);
comment on table public.program_memberships is 'Section 4/5 — role + status per program. Suspended/archived lose access immediately (RLS reads status).';
create index program_memberships_profile_idx on public.program_memberships (profile_id);
create index program_memberships_program_role_idx on public.program_memberships (program_id, role);

-- ---------------------------------------------------------------------
-- groups (section 3.2, 13)
-- ---------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  name text not null,
  image_url text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index groups_program_idx on public.groups (program_id);

-- ---------------------------------------------------------------------
-- group_members — students in a group (all may edit shared content)
-- ---------------------------------------------------------------------
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_in_project text,
  created_at timestamptz not null default now(),
  constraint group_members_unique unique (group_id, profile_id)
);
create index group_members_profile_idx on public.group_members (profile_id);

-- ---------------------------------------------------------------------
-- mentor_assignments — mentor_zps / mentor_student per group (section 3.2)
-- ---------------------------------------------------------------------
create table public.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mentor_type text not null check (mentor_type in ('mentor_zps', 'mentor_student')),
  created_at timestamptz not null default now(),
  -- at most one active mentor_zps and one active mentor_student per group
  constraint mentor_assignments_unique unique (group_id, mentor_type)
);
create index mentor_assignments_profile_idx on public.mentor_assignments (profile_id);

-- ---------------------------------------------------------------------
-- sessions (section 10)
-- ---------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'ready', 'attendance_open', 'completed', 'cancelled')),
  trainer_profile_ids uuid[] not null default '{}',
  survey_url text,
  internal_notes text,
  post_session_reflection text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_unique_date unique (program_id, session_date)
);
create index sessions_program_date_idx on public.sessions (program_id, session_date);

-- ---------------------------------------------------------------------
-- session_blocks — one class day may hold 1+ learning blocks
-- ---------------------------------------------------------------------
create table public.session_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  materials_url text,
  created_at timestamptz not null default now()
);
create index session_blocks_session_idx on public.session_blocks (session_id);

-- ---------------------------------------------------------------------
-- attendance_sheets + attendance_records (section 11)
-- ---------------------------------------------------------------------
create table public.attendance_sheets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'submitted', 'locked', 'reopened')),
  submitted_by uuid references public.profiles (id),
  submitted_at timestamptz,
  reopened_reason text,
  reopened_by uuid references public.profiles (id),
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sheets_unique unique (session_id, group_id)
);
create index attendance_sheets_group_idx on public.attendance_sheets (group_id);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  attendance_sheet_id uuid not null references public.attendance_sheets (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'not_recorded'
    check (status in ('present', 'excused_absence', 'unexcused_absence', 'not_recorded')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_unique unique (attendance_sheet_id, profile_id)
);
create index attendance_records_profile_idx on public.attendance_records (profile_id);

-- ---------------------------------------------------------------------
-- assignments (Course Assignment) + targets (section 12.1)
-- ---------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  title text not null,
  description text,
  due_at timestamptz,
  submission_mode text not null check (submission_mode in ('individual', 'group')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'in_progress', 'submitted', 'late', 'needs_revision', 'completed', 'archived')),
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignments_program_idx on public.assignments (program_id);
create index assignments_session_idx on public.assignments (session_id);

create table public.assignment_targets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  target_type text not null check (target_type in ('program', 'group', 'profile')),
  group_id uuid references public.groups (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint assignment_targets_shape check (
    (target_type = 'program' and group_id is null and profile_id is null) or
    (target_type = 'group' and group_id is not null and profile_id is null) or
    (target_type = 'profile' and profile_id is not null and group_id is null)
  )
);
create index assignment_targets_assignment_idx on public.assignment_targets (assignment_id);
create index assignment_targets_group_idx on public.assignment_targets (group_id);
create index assignment_targets_profile_idx on public.assignment_targets (profile_id);

-- ---------------------------------------------------------------------
-- submissions + versions + assets (section 12.3, 12.4)
-- ---------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'locked', 'needs_revision', 'completed')),
  locked_at timestamptz,
  last_updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submissions_owner_shape check (
    (group_id is not null and profile_id is null) or (group_id is null and profile_id is not null)
  )
);
create index submissions_assignment_idx on public.submissions (assignment_id);
create index submissions_group_idx on public.submissions (group_id);
create index submissions_profile_idx on public.submissions (profile_id);

create table public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  version_number int not null,
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint submission_versions_unique unique (submission_id, version_number)
);
create index submission_versions_submission_idx on public.submission_versions (submission_id);

create table public.submission_assets (
  id uuid primary key default gen_random_uuid(),
  submission_version_id uuid not null references public.submission_versions (id) on delete cascade,
  asset_type text not null check (
    asset_type in ('file', 'drive_link', 'github_link', 'build_link', 'video_link')
  ),
  url text,
  storage_path text,
  file_name text,
  created_at timestamptz not null default now()
);
create index submission_assets_version_idx on public.submission_assets (submission_version_id);

-- ---------------------------------------------------------------------
-- mentor_tasks + assignees (section 12.2)
-- ---------------------------------------------------------------------
create table public.mentor_tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'submitted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mentor_tasks_group_idx on public.mentor_tasks (group_id);

create table public.mentor_task_assignees (
  id uuid primary key default gen_random_uuid(),
  mentor_task_id uuid not null references public.mentor_tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint mentor_task_assignees_unique unique (mentor_task_id, profile_id)
);

-- ---------------------------------------------------------------------
-- group_projects + members + milestones + checkpoint submissions (section 13.3, 14)
-- ---------------------------------------------------------------------
create table public.group_projects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.groups (id) on delete cascade,
  game_name text,
  concept text,
  image_url text,
  milestone text,
  repository_url text,
  build_url text,
  video_url text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  group_project_id uuid not null references public.group_projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_in_project text,
  created_at timestamptz not null default now(),
  constraint project_members_unique unique (group_project_id, profile_id)
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  group_project_id uuid not null references public.group_projects (id) on delete cascade,
  title text not null,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index project_milestones_project_idx on public.project_milestones (group_project_id);

create table public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  group_project_id uuid not null references public.group_projects (id) on delete cascade,
  milestone_label text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'locked')),
  assets jsonb not null default '[]'::jsonb,
  submitted_by uuid references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_submissions_project_idx on public.project_submissions (group_project_id);

-- ---------------------------------------------------------------------
-- checkpoint_result_packages (section 14.3)
-- ---------------------------------------------------------------------
create table public.checkpoint_result_packages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  version_label text not null,
  excel_file_url text,
  pdf_file_url text,
  drive_url text,
  notes text,
  highlights text,
  groups_meeting_expectations int,
  groups_needing_improvement int,
  pre_expo_actions text,
  status text not null default 'awaiting_submissions' check (
    status in ('awaiting_submissions', 'submissions_closed', 'results_being_consolidated', 'result_uploaded', 'published', 'withdrawn')
  ),
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz,
  published_by uuid references public.profiles (id),
  published_at timestamptz,
  withdrawn_at timestamptz,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checkpoint_result_packages_program_idx on public.checkpoint_result_packages (program_id);

-- ---------------------------------------------------------------------
-- notifications + deliveries (section 16)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (
    type in (
      'attendance_risk', 'missing_attendance_sheet', 'deadline', 'submission',
      'revision', 'checkpoint_published', 'group_change', 'reminder', 'invitation'
    )
  ),
  title text not null,
  body text,
  link_href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_profile_id, read_at);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_deliveries_notification_idx on public.notification_deliveries (notification_id);

-- ---------------------------------------------------------------------
-- audit_logs (section 18.2 — every publish/permission/override/destructive action)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_program_idx on public.audit_logs (program_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at trigger, applied to every mutable table
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'programs', 'profiles', 'program_memberships', 'groups', 'sessions',
    'attendance_sheets', 'attendance_records', 'assignments', 'submissions',
    'mentor_tasks', 'group_projects', 'project_submissions',
    'checkpoint_result_packages', 'notification_deliveries'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end;
$$;

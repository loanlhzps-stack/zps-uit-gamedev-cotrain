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

-- 0014_simplify_session_status.sql — rút gọn sessions.status còn 4
-- giá trị (bỏ "ready"/"cancelled", xem migration để biết lý do).
update public.sessions
set status = 'scheduled'
where status in ('ready', 'cancelled');

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions
  add constraint sessions_status_check check (status in ('draft', 'scheduled', 'attendance_open', 'completed'));

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

-- Rút gọn AssignmentStatus (0013_simplify_assignment_status.sql, mục
-- 12.1) — theo yêu cầu của bạn: chỉ còn 'in_progress' ("Đang làm") →
-- 'completed' ("Hoàn thành"). "Quá hạn" không lưu DB, tự tính từ
-- due_at ở lib/format/assignments.ts. Map dữ liệu cũ trước khi đổi
-- constraint (vô hại trên DB rỗng/mới).
update public.assignments
set status = 'in_progress'
where status in ('draft', 'published', 'submitted', 'late', 'needs_revision');
update public.assignments
set status = 'completed'
where status = 'archived';
alter table public.assignments drop constraint if exists assignments_status_check;
alter table public.assignments
  add constraint assignments_status_check check (status in ('in_progress', 'completed'));
alter table public.assignments alter column status set default 'in_progress';

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

-- 0015_project_progress_builds_checklist.sql — thay hẳn
-- project_milestones ("Milestone" to-do tự do) và project_submissions
-- ("Bài nộp dự án" theo milestone+khoá) bằng: hành trình 8 giai đoạn
-- cố định trên group_projects (dưới), bảng project_builds (build
-- versioned, không ghi đè) và project_checklist_status (checklist 15
-- mục cố định, định nghĩa ở lib/constants/statuses.ts).
alter table public.group_projects
  add column milestone_stage text not null default 'idea'
    check (milestone_stage in (
      'idea', 'prototype', 'core_gameplay', 'content_complete',
      'polish_optimization', 'rehearsal_1217', 'final_build', 'expo_0121'
    )),
  add column milestone_status text not null default 'not_started'
    check (milestone_status in ('not_started', 'in_progress', 'needs_feedback', 'completed')),
  add column milestone_next_goal text,
  add column milestone_deadline date;

create table public.project_builds (
  id uuid primary key default gen_random_uuid(),
  group_project_id uuid not null references public.group_projects (id) on delete cascade,
  version_name text not null,
  platform text,
  build_url text,
  repository_url text,
  install_instructions text,
  known_issues text,
  release_notes text,
  gdd_url text,
  gameplay_demo_url text,
  screenshot_urls text[] not null default '{}',
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_builds_project_idx on public.project_builds (group_project_id, created_at desc);

alter table public.group_projects
  drop column repository_url,
  drop column build_url,
  drop column video_url,
  drop column milestone;

create table public.project_checklist_status (
  id uuid primary key default gen_random_uuid(),
  group_project_id uuid not null references public.group_projects (id) on delete cascade,
  item_key text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'done', 'not_applicable')),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint project_checklist_status_unique unique (group_project_id, item_key)
);
create index project_checklist_status_project_idx on public.project_checklist_status (group_project_id);

create trigger set_updated_at before update on public.project_builds
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_checklist_status
  for each row execute function public.set_updated_at();

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
    'group_projects',
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
-- VNG-ZPSxUIT-GameDev CoTrain — Row Level Security (Design Doc section 19.3)
--
-- Helper functions are SECURITY DEFINER so a policy can look up the
-- caller's membership without recursing into program_memberships' own
-- RLS. They only ever return booleans/ids derived from auth.uid() —
-- they cannot be used to read arbitrary rows, so this does not create a
-- privilege-escalation hole.
--
-- Column-level privacy note (section 4.3): Postgres RLS is row-level,
-- not column-level. attendance_records.note and any future "private
-- notes" columns are readable at the DB layer by everyone this file
-- grants row access to (e.g. a group's own members). Hiding that single
-- column from students/sponsors is enforced in the server actions that
-- query on their behalf (they simply do not select/forward that
-- column) — see lib/supabase/server.ts. Do not read attendance_records
-- directly from a Student/Sponsor-facing client component.

create or replace function public.membership_role(p_program_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.program_memberships
  where program_id = p_program_id
    and profile_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function public.is_owner_or_co(p_program_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.membership_role(p_program_id) in ('owner', 'co_owner');
$$;

create or replace function public.is_owner(p_program_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.membership_role(p_program_id) = 'owner';
$$;

create or replace function public.is_active_member(p_program_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.membership_role(p_program_id) is not null;
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and profile_id = auth.uid()
  );
$$;

create or replace function public.is_group_mentor(p_group_id uuid, p_mentor_type text default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mentor_assignments
    where group_id = p_group_id
      and profile_id = auth.uid()
      and (p_mentor_type is null or mentor_type = p_mentor_type)
  );
$$;

-- Section 3.2 / 11.2 — generalized "Group 8 exception": a mentor_zps may
-- operate attendance for their group whenever that group currently has
-- no mentor_student assigned, not only for a hardcoded "Group 8" id.
create or replace function public.can_operate_attendance(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_group_mentor(p_group_id, 'mentor_student')
    or (
      public.is_group_mentor(p_group_id, 'mentor_zps')
      and not exists (
        select 1 from public.mentor_assignments
        where group_id = p_group_id and mentor_type = 'mentor_student'
      )
    );
$$;

revoke all on function public.membership_role(uuid) from public;
revoke all on function public.is_owner_or_co(uuid) from public;
revoke all on function public.is_owner(uuid) from public;
revoke all on function public.is_active_member(uuid) from public;
revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_mentor(uuid, text) from public;
revoke all on function public.can_operate_attendance(uuid) from public;
grant execute on function public.membership_role(uuid) to authenticated;
grant execute on function public.is_owner_or_co(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_mentor(uuid, text) to authenticated;
grant execute on function public.can_operate_attendance(uuid) to authenticated;

-- Auto-create a stub profile when a new auth user is created, so the
-- first-login flow (section 5.2) can UPDATE it during onboarding
-- instead of needing an INSERT policy for end users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
alter table public.programs enable row level security;
alter table public.profiles enable row level security;
alter table public.program_memberships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.mentor_assignments enable row level security;
alter table public.sessions enable row level security;
alter table public.session_blocks enable row level security;
alter table public.attendance_sheets enable row level security;
alter table public.attendance_records enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_versions enable row level security;
alter table public.submission_assets enable row level security;
alter table public.group_projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_builds enable row level security;
alter table public.project_checklist_status enable row level security;
alter table public.checkpoint_result_packages enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------
create policy programs_select on public.programs for select
  using (public.is_active_member(id));
create policy programs_update on public.programs for update
  using (public.is_owner_or_co(id)) with check (public.is_owner_or_co(id));

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.program_memberships mine
      join public.program_memberships theirs
        on theirs.program_id = mine.program_id and theirs.status = 'active'
      where mine.profile_id = auth.uid() and mine.status = 'active' and theirs.profile_id = profiles.id
    )
  );
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- program_memberships — Owner-only writes (section 4.2, 5.1)
-- ---------------------------------------------------------------------
create policy program_memberships_select on public.program_memberships for select
  using (profile_id = auth.uid() or public.is_owner_or_co(program_id));
create policy program_memberships_insert on public.program_memberships for insert
  with check (public.is_owner(program_id));
create policy program_memberships_update on public.program_memberships for update
  using (public.is_owner(program_id)) with check (public.is_owner(program_id));
create policy program_memberships_delete on public.program_memberships for delete
  using (public.is_owner(program_id));

-- ---------------------------------------------------------------------
-- groups — students in the group may edit name/image (section 13.1)
-- ---------------------------------------------------------------------
create policy groups_select on public.groups for select
  using (public.is_active_member(program_id));
create policy groups_insert on public.groups for insert
  with check (public.is_owner_or_co(program_id));
create policy groups_update on public.groups for update
  using (public.is_owner_or_co(program_id) or public.is_group_member(id))
  with check (public.is_owner_or_co(program_id) or public.is_group_member(id));
create policy groups_delete on public.groups for delete
  using (public.is_owner_or_co(program_id));

-- ---------------------------------------------------------------------
-- group_members / mentor_assignments — system-controlled (Owner/Co-owner only writes)
-- ---------------------------------------------------------------------
create policy group_members_select on public.group_members for select
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_active_member(g.program_id)));
create policy group_members_write on public.group_members for all
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)))
  with check (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)));

create policy mentor_assignments_select on public.mentor_assignments for select
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_active_member(g.program_id)));
create policy mentor_assignments_write on public.mentor_assignments for all
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)))
  with check (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)));

-- ---------------------------------------------------------------------
-- sessions — Trainer may edit only their own teaching details (section 4.2)
-- ---------------------------------------------------------------------
create policy sessions_select on public.sessions for select
  using (public.is_active_member(program_id));
create policy sessions_insert on public.sessions for insert
  with check (public.is_owner_or_co(program_id));
create policy sessions_update on public.sessions for update
  using (
    public.is_owner_or_co(program_id)
    or (public.membership_role(program_id) = 'trainer' and auth.uid() = any (trainer_profile_ids))
  )
  with check (
    public.is_owner_or_co(program_id)
    or (public.membership_role(program_id) = 'trainer' and auth.uid() = any (trainer_profile_ids))
  );
create policy sessions_delete on public.sessions for delete
  using (public.is_owner_or_co(program_id));

create policy session_blocks_select on public.session_blocks for select
  using (exists (select 1 from public.sessions s where s.id = session_id and public.is_active_member(s.program_id)));
create policy session_blocks_write on public.session_blocks for all
  using (exists (
    select 1 from public.sessions s where s.id = session_id
    and (public.is_owner_or_co(s.program_id)
      or (public.membership_role(s.program_id) = 'trainer' and auth.uid() = any (s.trainer_profile_ids)))
  ))
  with check (exists (
    select 1 from public.sessions s where s.id = session_id
    and (public.is_owner_or_co(s.program_id)
      or (public.membership_role(s.program_id) = 'trainer' and auth.uid() = any (s.trainer_profile_ids)))
  ));

-- ---------------------------------------------------------------------
-- attendance_sheets / attendance_records (section 11.2)
-- ---------------------------------------------------------------------
create policy attendance_sheets_select on public.attendance_sheets for select
  using (
    exists (
      select 1 from public.groups g where g.id = group_id and (
        public.is_owner_or_co(g.program_id)
        or public.membership_role(g.program_id) = 'trainer'
        or public.is_group_member(group_id)
        or public.is_group_mentor(group_id)
      )
    )
  );
create policy attendance_sheets_insert on public.attendance_sheets for insert
  with check (
    exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id))
    or public.can_operate_attendance(group_id)
  );
create policy attendance_sheets_update on public.attendance_sheets for update
  using (
    exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id))
    or (public.can_operate_attendance(group_id) and status <> 'locked')
  )
  with check (
    exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id))
    or (public.can_operate_attendance(group_id) and status <> 'locked')
  );
create policy attendance_sheets_delete on public.attendance_sheets for delete
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)));

create policy attendance_records_select on public.attendance_records for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.attendance_sheets sh join public.groups g on g.id = sh.group_id
      where sh.id = attendance_sheet_id and (
        public.is_owner_or_co(g.program_id)
        or public.membership_role(g.program_id) = 'trainer'
        or public.is_group_member(sh.group_id)
        or public.is_group_mentor(sh.group_id)
      )
    )
  );
create policy attendance_records_write on public.attendance_records for all
  using (
    exists (
      select 1 from public.attendance_sheets sh join public.groups g on g.id = sh.group_id
      where sh.id = attendance_sheet_id and (
        public.is_owner_or_co(g.program_id)
        or (public.can_operate_attendance(sh.group_id) and sh.status <> 'locked')
      )
    )
  )
  with check (
    exists (
      select 1 from public.attendance_sheets sh join public.groups g on g.id = sh.group_id
      where sh.id = attendance_sheet_id and (
        public.is_owner_or_co(g.program_id)
        or (public.can_operate_attendance(sh.group_id) and sh.status <> 'locked')
      )
    )
  );

-- ---------------------------------------------------------------------
-- assignments / assignment_targets (section 12.1) — not visible to Sponsor
-- ---------------------------------------------------------------------
create policy assignments_select on public.assignments for select
  using (public.is_active_member(program_id) and public.membership_role(program_id) <> 'sponsor');
create policy assignments_insert on public.assignments for insert
  with check (
    public.is_owner_or_co(program_id)
    or (public.membership_role(program_id) = 'trainer' and created_by = auth.uid())
  );
create policy assignments_update on public.assignments for update
  using (public.is_owner_or_co(program_id) or created_by = auth.uid())
  with check (public.is_owner_or_co(program_id) or created_by = auth.uid());
create policy assignments_delete on public.assignments for delete
  using (public.is_owner_or_co(program_id));

create policy assignment_targets_select on public.assignment_targets for select
  using (exists (
    select 1 from public.assignments a where a.id = assignment_id
    and public.is_active_member(a.program_id) and public.membership_role(a.program_id) <> 'sponsor'
  ));
create policy assignment_targets_write on public.assignment_targets for all
  using (exists (
    select 1 from public.assignments a where a.id = assignment_id
    and (public.is_owner_or_co(a.program_id) or a.created_by = auth.uid())
  ))
  with check (exists (
    select 1 from public.assignments a where a.id = assignment_id
    and (public.is_owner_or_co(a.program_id) or a.created_by = auth.uid())
  ));

-- ---------------------------------------------------------------------
-- submissions / versions / assets (section 12.3)
-- ---------------------------------------------------------------------
create policy submissions_select on public.submissions for select
  using (
    profile_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id))
    or (group_id is not null and public.is_group_mentor(group_id))
    or exists (
      select 1 from public.assignments a where a.id = assignment_id
      and (public.is_owner_or_co(a.program_id) or a.created_by = auth.uid())
    )
  );
create policy submissions_insert on public.submissions for insert
  with check (
    profile_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id))
    or exists (select 1 from public.assignments a where a.id = assignment_id and public.is_owner_or_co(a.program_id))
  );
create policy submissions_update on public.submissions for update
  using (
    (status <> 'locked' and (profile_id = auth.uid() or (group_id is not null and public.is_group_member(group_id))))
    or exists (
      select 1 from public.assignments a where a.id = assignment_id
      and (public.is_owner_or_co(a.program_id) or a.created_by = auth.uid())
    )
  )
  with check (
    (profile_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)))
    or exists (
      select 1 from public.assignments a where a.id = assignment_id
      and (public.is_owner_or_co(a.program_id) or a.created_by = auth.uid())
    )
  );
create policy submissions_delete on public.submissions for delete
  using (exists (select 1 from public.assignments a where a.id = assignment_id and public.is_owner_or_co(a.program_id)));

create policy submission_versions_select on public.submission_versions for select
  using (exists (
    select 1 from public.submissions s where s.id = submission_id and (
      s.profile_id = auth.uid()
      or (s.group_id is not null and public.is_group_member(s.group_id))
      or (s.group_id is not null and public.is_group_mentor(s.group_id))
      or exists (select 1 from public.assignments a where a.id = s.assignment_id and (public.is_owner_or_co(a.program_id) or a.created_by = auth.uid()))
    )
  ));
create policy submission_versions_insert on public.submission_versions for insert
  with check (exists (
    select 1 from public.submissions s where s.id = submission_id and s.status <> 'locked' and (
      s.profile_id = auth.uid() or (s.group_id is not null and public.is_group_member(s.group_id))
      or exists (select 1 from public.assignments a where a.id = s.assignment_id and public.is_owner_or_co(a.program_id))
    )
  ));

create policy submission_assets_select on public.submission_assets for select
  using (exists (
    select 1 from public.submission_versions v join public.submissions s on s.id = v.submission_id
    where v.id = submission_version_id and (
      s.profile_id = auth.uid()
      or (s.group_id is not null and public.is_group_member(s.group_id))
      or (s.group_id is not null and public.is_group_mentor(s.group_id))
      or exists (select 1 from public.assignments a where a.id = s.assignment_id and (public.is_owner_or_co(a.program_id) or a.created_by = auth.uid()))
    )
  ));
create policy submission_assets_write on public.submission_assets for all
  using (exists (
    select 1 from public.submission_versions v join public.submissions s on s.id = v.submission_id
    where v.id = submission_version_id and (
      s.profile_id = auth.uid() or (s.group_id is not null and public.is_group_member(s.group_id))
      or exists (select 1 from public.assignments a where a.id = s.assignment_id and public.is_owner_or_co(a.program_id))
    )
  ))
  with check (exists (
    select 1 from public.submission_versions v join public.submissions s on s.id = v.submission_id
    where v.id = submission_version_id and (
      s.profile_id = auth.uid() or (s.group_id is not null and public.is_group_member(s.group_id))
      or exists (select 1 from public.assignments a where a.id = s.assignment_id and public.is_owner_or_co(a.program_id))
    )
  ));


-- ---------------------------------------------------------------------
-- group_projects / members / progress / builds / checklist (section 13.3, 14)
-- Sponsor + Trainer get read access here (unlike assignments) — matches
-- the "Manage group project" row in the permission matrix (4.2).
-- ---------------------------------------------------------------------
create policy group_projects_select on public.group_projects for select
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_active_member(g.program_id)));
create policy group_projects_insert on public.group_projects for insert
  with check (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)));
create policy group_projects_update on public.group_projects for update
  using (
    exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id))
    or public.is_group_member(group_id) or public.is_group_mentor(group_id)
  )
  with check (
    exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id))
    or public.is_group_member(group_id) or public.is_group_mentor(group_id)
  );
create policy group_projects_delete on public.group_projects for delete
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)));

create policy project_members_select on public.project_members for select
  using (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and public.is_active_member(g.program_id)
  ));
create policy project_members_write on public.project_members for all
  using (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and (
      public.is_owner_or_co(g.program_id) or public.is_group_member(p.group_id) or public.is_group_mentor(p.group_id)
    )
  ))
  with check (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and (
      public.is_owner_or_co(g.program_id) or public.is_group_member(p.group_id) or public.is_group_mentor(p.group_id)
    )
  ));

create policy project_builds_select on public.project_builds for select
  using (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and public.is_active_member(g.program_id)
  ));
create policy project_builds_write on public.project_builds for all
  using (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and (
      public.is_owner_or_co(g.program_id) or public.is_group_member(p.group_id) or public.is_group_mentor(p.group_id)
    )
  ))
  with check (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and (
      public.is_owner_or_co(g.program_id) or public.is_group_member(p.group_id) or public.is_group_mentor(p.group_id)
    )
  ));

create policy project_checklist_status_select on public.project_checklist_status for select
  using (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and public.is_active_member(g.program_id)
  ));
create policy project_checklist_status_write on public.project_checklist_status for all
  using (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and (
      public.is_owner_or_co(g.program_id) or public.is_group_member(p.group_id) or public.is_group_mentor(p.group_id)
    )
  ))
  with check (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and (
      public.is_owner_or_co(g.program_id) or public.is_group_member(p.group_id) or public.is_group_mentor(p.group_id)
    )
  ));

-- ---------------------------------------------------------------------
-- checkpoint_result_packages (section 14.3) — Owner/Co-owner manage;
-- everyone else only sees a package once it is published.
-- ---------------------------------------------------------------------
create policy checkpoint_result_packages_select on public.checkpoint_result_packages for select
  using (public.is_owner_or_co(program_id) or (status = 'published' and public.is_active_member(program_id)));
create policy checkpoint_result_packages_write on public.checkpoint_result_packages for all
  using (public.is_owner_or_co(program_id)) with check (public.is_owner_or_co(program_id));

-- ---------------------------------------------------------------------
-- notifications (section 16) — recipients read/mark-read their own.
-- Sending is scope-checked again in the server action that calls this
-- (Owner: any scope, Trainer: own assignment, Mentor: own group — doc
-- 16.1); RLS here only guarantees sender and recipient share a program.
-- ---------------------------------------------------------------------
create policy notifications_select on public.notifications for select
  using (recipient_profile_id = auth.uid());
create policy notifications_insert on public.notifications for insert
  with check (program_id is null or public.is_active_member(program_id));
create policy notifications_update on public.notifications for update
  using (recipient_profile_id = auth.uid()) with check (recipient_profile_id = auth.uid());

-- notification_deliveries — operational/delivery-status detail, not
-- end-user-facing; email adapter runs server-side with the service-role
-- client (section 16.2), so only Owner/Co-owner can read it here.
create policy notification_deliveries_select on public.notification_deliveries for select
  using (exists (
    select 1 from public.notifications n where n.id = notification_id
    and n.program_id is not null and public.is_owner_or_co(n.program_id)
  ));

-- ---------------------------------------------------------------------
-- audit_logs (section 18.2, 4.2) — Owner/Co-owner read; append-only.
-- ---------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs for select
  using (program_id is not null and public.is_owner_or_co(program_id));
create policy audit_logs_insert on public.audit_logs for insert
  with check (
    actor_profile_id = auth.uid()
    and (program_id is null or public.is_active_member(program_id))
  );
-- VNG-ZPSxUIT-GameDev CoTrain — Phase 3 additions (Design Doc section 5, 25.3)
--
-- 1. profiles.email — Supabase Auth stores email on auth.users, which is
--    not readable through the anon/authenticated Postgres role by
--    default. The People & Access page (Owner/Co-owner) and the "who is
--    this" bits of the UI need to show a member's email, so we mirror it
--    onto public.profiles at signup time (handle_new_auth_user) and keep
--    it in sync if it ever changes. This does not weaken RLS: profiles
--    is still gated by the same profiles_select policy as before.
--
-- 2. profiles.onboarding_completed_at — marks when a user finished the
--    first-login flow (section 5.2: activate -> set password -> complete
--    profile -> confirm notification prefs -> enter Home). NULL means
--    "send them to /onboarding/profile", regardless of how the account
--    was created (invited by Owner, or seeded).

alter table public.profiles
  add column if not exists email text,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.email is
  'Mirrored from auth.users.email for display only (People & Access, etc). Not the source of truth for login.';
comment on column public.profiles.onboarding_completed_at is
  'Set once the section 5.2 first-login flow (profile + notification prefs) is completed. NULL routes to /onboarding/profile.';

-- Backfill for any profile that already exists in this database (no-op
-- on a fresh install, relevant if 0001/0002 already ran once).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ---------------------------------------------------------------------
-- Replace handle_new_auth_user() to also mirror the email.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Keep profiles.email in sync if a user's auth email ever changes.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- ---------------------------------------------------------------------
-- activate_own_membership() — section 5.2 first-login flow.
--
-- program_memberships is Owner-only for writes (see 0002_rls.sql,
-- "program_memberships — Owner-only writes"): a Trainer or Student must
-- not be able to change their own role or status. But completing
-- onboarding *is* meant to flip that one user's own 'invited' row to
-- 'active' ("Activate account" in the section 5.2 diagram) — narrow,
-- single-purpose SECURITY DEFINER RPC, callable by any authenticated
-- user, that can only ever touch the caller's own row and only ever
-- invited -> active (never role, never suspended/archived -> active).
-- ---------------------------------------------------------------------
create or replace function public.activate_own_membership()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.program_memberships
  set status = 'active'
  where profile_id = auth.uid() and status = 'invited';
end;
$$;

revoke all on function public.activate_own_membership() from public;
grant execute on function public.activate_own_membership() to authenticated;

-- ---------------------------------------------------------------------
-- profiles_select — widen for Owner/Co-owner (People & Access, section
-- 6.2/4.2). The original policy (0002_rls.sql) only let a member see
-- colleagues whose OWN membership is already 'active', which hides
-- freshly-invited people (still 'invited') and suspended/archived ones
-- from the People & Access list — exactly the accounts an Owner/
-- Co-owner needs to see and manage there. Regular members are
-- unaffected: they still only see active colleagues.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.program_memberships mine
      join public.program_memberships theirs
        on theirs.program_id = mine.program_id
      where mine.profile_id = auth.uid()
        and mine.status = 'active'
        and theirs.profile_id = profiles.id
        and (theirs.status = 'active' or mine.role in ('owner', 'co_owner'))
    )
  );
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
-- VNG-ZPSxUIT-GameDev CoTrain — drop session start_time/end_time (section 10)
--
-- Lịch học thật cố định vào buổi chiều mỗi ngày (không có buổi sáng/tối
-- xen kẽ) — chương trình chỉ cần theo dõi theo BUỔI (ngày), không cần
-- lưu giờ bắt đầu/kết thúc từng buổi. Loại bỏ để tránh dữ liệu chết và
-- một trường nhập liệu không ai dùng tới.

alter table public.sessions
  drop column start_time,
  drop column end_time;
-- VNG-ZPSxUIT-GameDev CoTrain — Sponsor aggregate attendance (section 4.2/4.3, 9.2)
--
-- Sponsors must see AGGREGATE attendance only, never per-student rows.
-- attendance_records/attendance_sheets RLS intentionally grants sponsors
-- NO row access at all (see 0002_rls.sql) — a raw SELECT policy scoped
-- to "aggregate use only" is not something RLS can express. A SECURITY
-- DEFINER RPC that returns only rounded totals is the safe way to give
-- Sponsor one aggregate number without opening row access — same
-- reasoning as activate_own_membership() in 0003_onboarding.sql.
--
-- Returns all-zero (not an error) for a caller who is not an active
-- member of p_program_id — callers always pass their own programId
-- (lib/attendance/queries.ts), so this is a defense-in-depth guard, not
-- the primary access boundary.

create or replace function public.program_attendance_summary(p_program_id uuid)
returns table(total bigint, present bigint, absent bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where ar.status <> 'not_recorded') as total,
    count(*) filter (where ar.status = 'present') as present,
    count(*) filter (where ar.status in ('excused_absence', 'unexcused_absence')) as absent
  from public.attendance_records ar
  join public.attendance_sheets sh on sh.id = ar.attendance_sheet_id
  join public.groups g on g.id = sh.group_id
  where g.program_id = p_program_id
    and sh.status in ('locked', 'reopened')
    and public.is_active_member(p_program_id);
$$;

revoke all on function public.program_attendance_summary(uuid) from public;
grant execute on function public.program_attendance_summary(uuid) to authenticated;

-- Section 17.1 / 4.3 / 9.2 — group health signals for Sponsor. Same
-- attendance-derived rules as lib/attendance/health.ts, computed in SQL
-- because Sponsor has no RLS row access to attendance_sheets/
-- attendance_records at all — this returns COUNTS ONLY per group
-- (never a student id or name), matching "aggregate ... not private
-- absence reasons" (section 4.3).

create or replace function public.program_group_health_signals(p_program_id uuid)
returns table(
  group_id uuid,
  ineligible_count bigint,
  near_threshold_count bigint,
  consecutive_count bigint,
  missing_sheets_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with ordered as (
    select
      gm.group_id,
      ar.profile_id,
      ar.status,
      lag(ar.status) over (partition by gm.group_id, ar.profile_id order by s.session_date) as prev_status
    from public.group_members gm
    join public.attendance_sheets sh on sh.group_id = gm.group_id and sh.status in ('locked', 'reopened')
    join public.sessions s on s.id = sh.session_id and s.program_id = p_program_id
    join public.attendance_records ar on ar.attendance_sheet_id = sh.id and ar.profile_id = gm.profile_id
    where gm.group_id in (select id from public.groups where program_id = p_program_id)
  ),
  member_absences as (
    select group_id, profile_id,
      count(*) filter (where status in ('excused_absence', 'unexcused_absence')) as absences
    from ordered
    group by group_id, profile_id
  ),
  member_consecutive as (
    select distinct group_id, profile_id
    from ordered
    where status in ('excused_absence', 'unexcused_absence')
      and prev_status in ('excused_absence', 'unexcused_absence')
  )
  select
    g.id as group_id,
    coalesce((select count(*) from member_absences ma where ma.group_id = g.id and ma.absences >= 4), 0) as ineligible_count,
    coalesce((select count(*) from member_absences ma where ma.group_id = g.id and ma.absences = 3), 0) as near_threshold_count,
    coalesce((select count(*) from member_consecutive mc where mc.group_id = g.id), 0) as consecutive_count,
    coalesce((
      select count(*) from public.sessions s2
      where s2.program_id = p_program_id and s2.status = 'completed'
        and not exists (
          select 1 from public.attendance_sheets sh2
          where sh2.session_id = s2.id and sh2.group_id = g.id and sh2.status in ('locked', 'reopened')
        )
    ), 0) as missing_sheets_count
  from public.groups g
  where g.program_id = p_program_id
    and public.is_active_member(p_program_id);
$$;

revoke all on function public.program_group_health_signals(uuid) from public;
grant execute on function public.program_group_health_signals(uuid) to authenticated;

-- Section 17.1 — "Bài tập nhóm đã trễ hạn nộp hơn 1 ngày" signal cho
-- Sponsor (0012_group_health_overdue_assignments.sql) — cùng lý do
-- program_group_health_signals ở trên (assignments_select RLS loại
-- trừ Sponsor), COUNT ONLY theo từng nhóm.
create or replace function public.program_group_overdue_assignments(p_program_id uuid)
returns table(group_id uuid, overdue_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  with overdue_assignments as (
    select a.id
    from public.assignments a
    where a.program_id = p_program_id
      and a.submission_mode = 'group'
      and a.due_at is not null
      and a.due_at < now() - interval '1 day'
  ),
  applicable as (
    -- target=program áp dụng cho MỌI nhóm trong chương trình
    select distinct g.id as group_id, oa.id as assignment_id
    from overdue_assignments oa
    join public.assignment_targets t on t.assignment_id = oa.id and t.target_type = 'program'
    join public.groups g on g.program_id = p_program_id
    union
    -- target=group chỉ áp dụng cho đúng nhóm đó
    select distinct t.group_id, oa.id as assignment_id
    from overdue_assignments oa
    join public.assignment_targets t on t.assignment_id = oa.id and t.target_type = 'group'
    where t.group_id is not null
  ),
  missing_submission as (
    select ap.group_id, ap.assignment_id
    from applicable ap
    where not exists (
      select 1 from public.submissions s
      where s.assignment_id = ap.assignment_id
        and s.group_id = ap.group_id
        and s.status in ('submitted', 'locked', 'completed')
    )
  )
  select g.id as group_id, count(ms.assignment_id) as overdue_count
  from public.groups g
  left join missing_submission ms on ms.group_id = g.id
  where g.program_id = p_program_id
    and public.is_active_member(p_program_id)
  group by g.id;
$$;

revoke all on function public.program_group_overdue_assignments(uuid) from public;
grant execute on function public.program_group_overdue_assignments(uuid) to authenticated;
-- VNG-ZPSxUIT-GameDev CoTrain — Sponsor aggregate assignment completion (section
-- 4.2/4.3, 9.2 "Assignment completion").
--
-- assignments_select RLS (0002_rls.sql) intentionally excludes Sponsor
-- entirely ("not visible to Sponsor") — there is no row-level access to
-- open up. This mirrors the same reasoning as
-- program_attendance_summary()/program_group_health_signals()
-- (0006_attendance_sponsor_rpc.sql): a SECURITY DEFINER RPC that
-- returns only rounded counts at the ASSIGNMENT level (never a
-- submission, a student identity or a group identity) is the safe way
-- to give Sponsor one aggregate number.
--
-- Deliberately assignment-level, not submission-level: "completed" here
-- means assignments.status = 'completed' (the owning Trainer's own
-- review verdict — section 12.1), not "every targeted student/group
-- submitted". Submission-level aggregation would need to account for
-- individual vs group submission_mode and partial completion, which
-- section 9.2 does not specify — this is the simplest reading that
-- still respects "aggregate only, no private detail" (section 4.3).
-- 'draft' assignments are excluded from the denominator (never
-- published, so not yet part of the program's real completion rate).

create or replace function public.program_assignment_completion(p_program_id uuid)
returns table(total bigint, completed bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where status <> 'draft') as total,
    count(*) filter (where status = 'completed') as completed
  from public.assignments
  where program_id = p_program_id
    and public.is_active_member(p_program_id);
$$;

revoke all on function public.program_assignment_completion(uuid) from public;
grant execute on function public.program_assignment_completion(uuid) to authenticated;
-- VNG-ZPSxUIT-GameDev CoTrain — collaborative-edit tracking (Design Doc section 20)
--
-- "For collaborative group editing: Display last editor and edit time.
-- Detect stale updates using updated_at or a version number. Do not
-- silently overwrite a newer saved version." updated_at already exists
-- on every mutable table (auto-maintained by set_updated_at(), see
-- 0001_init.sql) and is enough for the stale-update check on its own.
-- What's missing is WHO last edited a row shared by multiple people —
-- groups (name/image, section 13.1) and group_projects (Final Project
-- meta, section 14) can both be edited by any student member, not
-- just their creator, so there is no reliable "owner" column to show
-- instead. Mirrors the existing submissions.last_updated_by column
-- (0001_init.sql) already used for Course Assignment submissions.
-- (project_submissions also had this column at the time — table since
-- dropped, see 0015_project_progress_builds_checklist.sql.)

alter table public.groups
  add column last_updated_by uuid references public.profiles (id);
comment on column public.groups.last_updated_by is
  'Who last saved group identity (name/image) via updateGroupIdentity — section 20 "display last editor".';

alter table public.group_projects
  add column last_updated_by uuid references public.profiles (id);
comment on column public.group_projects.last_updated_by is
  'Who last saved Final Project meta via updateGroupProject — section 20 "display last editor".';
-- VNG-ZPSxUIT-GameDev CoTrain — avatar upload (Design Doc section 5.3 "Avatar")
--
-- Deferred since Phase 3 (README flagged deviation: "Avatar bỏ qua
-- hoàn toàn ở onboarding ... cho tới khi có upload thật lên Supabase
-- Storage") until every other feature that could also need file
-- upload was built and it was clear avatar is the only one still
-- wanted (Course Assignment/Final Project/Checkpoint evidence all
-- stay link-based by design — see README).
--
-- One public bucket. Avatars are low-sensitivity (a profile photo any
-- program member already sees elsewhere in the UI — Sidebar, Main Bar,
-- MembersTable...) so a public-read bucket avoids needing signed URLs
-- everywhere an <img> tag already expects a plain avatar_url string,
-- same as the plain-URL image fields already used for
-- groups.image_url/group_projects.image_url.
--
-- Write is restricted to each user's own folder
-- (avatars/{auth.uid()}/...) — profiles.avatar_url itself is still
-- only settable by the owning row's RLS (profiles_update, 0002_rls.sql
-- already is_self-scoped), this just adds the matching Storage-level
-- gate so a user can't upload into someone else's folder even though
-- the bucket is publicly readable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB, matches the Server Action's own check (lib/actions/profile.ts)
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

create policy avatars_own_folder_insert on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_own_folder_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_own_folder_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 0016_mentor_parity.sql — Mentor ZPS và Mentor Sinh viên có quyền
-- giống hệt nhau trên nhóm mình phụ trách (theo yêu cầu của bạn). Bỏ
-- 2 giới hạn trước đó chỉ áp cho Mentor ZPS: (1) mở/nộp điểm danh chỉ
-- khi nhóm chưa có Mentor SV ("Group 8 exception" tổng quát hoá), (2)
-- sửa tên/ảnh đại diện nhóm (groups_update trước đó loại Mentor ra).
-- ---------------------------------------------------------------------

create or replace function public.can_operate_attendance(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_group_mentor(p_group_id);
$$;

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update
  using (public.is_owner_or_co(program_id) or public.is_group_member(id) or public.is_group_mentor(id))
  with check (public.is_owner_or_co(program_id) or public.is_group_member(id) or public.is_group_mentor(id));

-- ---------------------------------------------------------------------
-- 0017_trainer_view_scope.sql — Thu hẹp phạm vi Trainer (theo yêu cầu
-- của bạn): bỏ quyền sửa buổi học được gán (Owner/Co-owner giờ quản lý
-- toàn bộ Thời khóa biểu), và bỏ quyền đọc điểm danh (không còn tab
-- Điểm danh). groups/group_members select không đổi — Trainer vẫn cần
-- đọc tên nhóm để gán Bài tập cho bất kỳ nhóm nào trong chương trình.
-- ---------------------------------------------------------------------

drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions for update
  using (public.is_owner_or_co(program_id))
  with check (public.is_owner_or_co(program_id));

drop policy if exists session_blocks_write on public.session_blocks;
create policy session_blocks_write on public.session_blocks for all
  using (exists (
    select 1 from public.sessions s where s.id = session_id and public.is_owner_or_co(s.program_id)
  ))
  with check (exists (
    select 1 from public.sessions s where s.id = session_id and public.is_owner_or_co(s.program_id)
  ));

drop policy if exists attendance_sheets_select on public.attendance_sheets;
create policy attendance_sheets_select on public.attendance_sheets for select
  using (
    exists (
      select 1 from public.groups g where g.id = group_id and (
        public.is_owner_or_co(g.program_id)
        or public.is_group_member(group_id)
        or public.is_group_mentor(group_id)
      )
    )
  );

drop policy if exists attendance_records_select on public.attendance_records;
create policy attendance_records_select on public.attendance_records for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.attendance_sheets sh join public.groups g on g.id = sh.group_id
      where sh.id = attendance_sheet_id and (
        public.is_owner_or_co(g.program_id)
        or public.is_group_member(sh.group_id)
        or public.is_group_mentor(sh.group_id)
      )
    )
  );

-- ---------------------------------------------------------------------
-- 0018_trainer_group_assignments.sql — xem file migration để đọc đầy đủ
-- comment giải thích (chỉ mang tính thông tin/hiển thị, không giới hạn
-- quyền của Trainer).
-- ---------------------------------------------------------------------
create table public.trainer_group_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, profile_id)
);
comment on table public.trainer_group_assignments is 'Thông tin "Trainer nào phụ trách nhóm nào" — chỉ để hiển thị ở Quản lý thành viên, KHÔNG giới hạn quyền gán bài tập của Trainer (Trainer vẫn gán được cho bất kỳ nhóm nào, xem assignments_select/insert).';

create index trainer_group_assignments_profile_idx on public.trainer_group_assignments (profile_id);
create index trainer_group_assignments_group_idx on public.trainer_group_assignments (group_id);

alter table public.trainer_group_assignments enable row level security;

create policy trainer_group_assignments_select on public.trainer_group_assignments for select
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_active_member(g.program_id)));

create policy trainer_group_assignments_write on public.trainer_group_assignments for all
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)))
  with check (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)));

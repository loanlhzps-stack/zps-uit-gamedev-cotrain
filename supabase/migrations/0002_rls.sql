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
alter table public.mentor_tasks enable row level security;
alter table public.mentor_task_assignees enable row level security;
alter table public.group_projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_submissions enable row level security;
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
-- mentor_tasks / assignees (section 12.2) — created/closed by the group's Mentor ZPS
-- ---------------------------------------------------------------------
create policy mentor_tasks_select on public.mentor_tasks for select
  using (
    exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id))
    or public.is_group_member(group_id)
    or public.is_group_mentor(group_id)
  );
create policy mentor_tasks_write on public.mentor_tasks for all
  using (
    exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id))
    or public.is_group_mentor(group_id, 'mentor_zps')
  )
  with check (
    exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id))
    or public.is_group_mentor(group_id, 'mentor_zps')
  );

create policy mentor_task_assignees_select on public.mentor_task_assignees for select
  using (exists (
    select 1 from public.mentor_tasks t where t.id = mentor_task_id and (
      exists (select 1 from public.groups g where g.id = t.group_id and public.is_owner_or_co(g.program_id))
      or public.is_group_member(t.group_id) or public.is_group_mentor(t.group_id)
    )
  ));
create policy mentor_task_assignees_write on public.mentor_task_assignees for all
  using (exists (
    select 1 from public.mentor_tasks t where t.id = mentor_task_id and (
      exists (select 1 from public.groups g where g.id = t.group_id and public.is_owner_or_co(g.program_id))
      or public.is_group_mentor(t.group_id, 'mentor_zps')
    )
  ))
  with check (exists (
    select 1 from public.mentor_tasks t where t.id = mentor_task_id and (
      exists (select 1 from public.groups g where g.id = t.group_id and public.is_owner_or_co(g.program_id))
      or public.is_group_mentor(t.group_id, 'mentor_zps')
    )
  ));

-- ---------------------------------------------------------------------
-- group_projects / members / milestones / project_submissions (section 13.3, 14)
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

create policy project_milestones_select on public.project_milestones for select
  using (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and public.is_active_member(g.program_id)
  ));
create policy project_milestones_write on public.project_milestones for all
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

create policy project_submissions_select on public.project_submissions for select
  using (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and public.is_active_member(g.program_id)
  ));
create policy project_submissions_write on public.project_submissions for all
  using (exists (
    select 1 from public.group_projects p join public.groups g on g.id = p.group_id
    where p.id = group_project_id and (
      public.is_owner_or_co(g.program_id)
      or (status <> 'locked' and (public.is_group_member(p.group_id) or public.is_group_mentor(p.group_id)))
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

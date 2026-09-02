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

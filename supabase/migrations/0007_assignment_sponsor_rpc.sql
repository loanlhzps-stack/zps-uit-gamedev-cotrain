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

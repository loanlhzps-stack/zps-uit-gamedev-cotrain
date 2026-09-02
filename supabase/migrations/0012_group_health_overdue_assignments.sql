-- 0012_group_health_overdue_assignments.sql
--
-- Group health (section 17.1) — brainstorm lại theo yêu cầu của bạn:
-- rút gọn còn 2 mức (On track / Need attention) và thêm tín hiệu mới
-- "Bài tập nhóm đã trễ hạn nộp hơn 1 ngày". Sponsor không có RLS row
-- access tới assignments/assignment_targets/submissions (assignments_
-- select loại trừ sponsor, 0002_rls.sql) nên cần 1 RPC SECURITY
-- DEFINER riêng, cùng cách làm với program_group_health_signals ở
-- 0006_attendance_sponsor_rpc.sql — trả về COUNT ONLY theo từng nhóm,
-- không có tiêu đề/nội dung bài tập, đúng mục 4.3 "aggregate ... not
-- private".
--
-- CHỈ tính Bài tập nhóm thật sự (submission_mode='group', target
-- program hoặc group) — cố ý KHÔNG tính Bài tập cá nhân (target=
-- profile), giống lib/assignments/queries.ts's
-- getOverdueGroupAssignmentCounts (dùng cho Owner/Co-owner/Trainer/
-- Mentor/Student, đọc trực tiếp qua RLS, không cần RPC).

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

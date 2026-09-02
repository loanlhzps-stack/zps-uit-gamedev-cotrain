-- 0015_project_progress_builds_checklist.sql
-- Final Project (mục 13.3/14) — làm lại 3 phần theo yêu cầu của bạn:
-- (1) "Tiến độ dự án": thay cột `milestone` tự do (1 ô nhập text) bằng
--     hành trình cố định 8 giai đoạn + trạng thái + mục tiêu tiếp
--     theo + deadline. (2) "Build và tài liệu": thay 3 cột đơn
--     (repository_url/build_url/video_url, luôn bị GHI ĐÈ) bằng bảng
--     `project_builds` — mỗi build là 1 dòng riêng, không ghi đè.
-- (3) "Checklist": bảng mới `project_checklist_status`, 15 mục cố
--     định (định nghĩa ở code — lib/constants/statuses.ts
--     PROJECT_CHECKLIST_CATEGORIES), mỗi mục 1 trong 4 trạng thái.
--
-- THAY THẾ HẲN 2 tính năng cũ (theo lựa chọn của bạn khi được hỏi):
-- "Milestone" to-do tự do (bảng project_milestones) và "Bài nộp dự
-- án" theo milestone+khoá (bảng project_submissions) — cả 2 bảng bị
-- xoá hẳn. KHÔNG đụng tới tính năng "Kết quả Checkpoint 17/12" của
-- Owner (checkpoint_result_packages, mục 14.2/14.3) — hệ thống hoàn
-- toàn riêng, không tham chiếu tới project_submissions/
-- project_milestones.

-- ---------------------------------------------------------------------
-- (1) Tiến độ dự án — group_projects
-- ---------------------------------------------------------------------
alter table public.group_projects
  add column milestone_stage text,
  add column milestone_status text,
  add column milestone_next_goal text,
  add column milestone_deadline date;

-- Map dữ liệu cũ: mọi group_projects hiện có đều đang ở milestone tự
-- do dạng text — không suy luận được sang giai đoạn cụ thể nào, đặt
-- về "Ý tưởng"/"Chưa bắt đầu" (giai đoạn đầu hành trình) làm mặc định
-- an toàn; Trainer/Mentor/Owner tự cập nhật lại đúng giai đoạn thật
-- sau khi chạy migration.
update public.group_projects
set milestone_stage = 'idea', milestone_status = 'not_started'
where milestone_stage is null;

alter table public.group_projects
  alter column milestone_stage set not null,
  alter column milestone_stage set default 'idea',
  alter column milestone_status set not null,
  alter column milestone_status set default 'not_started',
  add constraint group_projects_milestone_stage_check check (
    milestone_stage in (
      'idea', 'prototype', 'core_gameplay', 'content_complete',
      'polish_optimization', 'rehearsal_1217', 'final_build', 'expo_0121'
    )
  ),
  add constraint group_projects_milestone_status_check check (
    milestone_status in ('not_started', 'in_progress', 'needs_feedback', 'completed')
  );

-- ---------------------------------------------------------------------
-- (2) Build và tài liệu — bảng mới, versioned (mỗi lần thêm là 1 dòng
-- mới, không update đè lên dòng cũ).
-- ---------------------------------------------------------------------
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

-- Di chuyển dữ liệu build/repo/video đơn (1 dòng/nhóm) đang có trước
-- khi bỏ 3 cột đó khỏi group_projects — giữ lại làm bản build "Trước
-- khi có versioning" thay vì mất trắng.
insert into public.project_builds (group_project_id, version_name, build_url, repository_url, gameplay_demo_url, uploaded_by)
select id, 'Trước khi có versioning', build_url, repository_url, video_url, last_updated_by
from public.group_projects
where build_url is not null or repository_url is not null or video_url is not null;

alter table public.group_projects
  drop column repository_url,
  drop column build_url,
  drop column video_url,
  drop column milestone;

create trigger set_updated_at before update on public.project_builds
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- (3) Checklist — bảng mới, sparse: chỉ lưu dòng cho mục đã được cập
-- nhật; mục chưa có dòng hiểu ngầm "not_started" (xem
-- PROJECT_CHECKLIST_CATEGORIES trong lib/constants/statuses.ts — danh
-- sách 15 mục cố định định nghĩa ở code, không lưu DB).
-- ---------------------------------------------------------------------
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

create trigger set_updated_at before update on public.project_checklist_status
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Xoá hẳn 2 bảng/feature cũ bị thay thế.
-- ---------------------------------------------------------------------
drop table if exists public.project_submissions;
drop table if exists public.project_milestones;

-- ---------------------------------------------------------------------
-- RLS — cùng pattern đã dùng cho project_milestones/project_submissions
-- cũ (select: thành viên active của chương trình; write: Owner/Co-owner
-- hoặc chính thành viên/mentor của nhóm đó — không phân biệt "đã khoá"
-- như project_submissions cũ vì build/checklist không còn khái niệm
-- khoá).
-- ---------------------------------------------------------------------
alter table public.project_builds enable row level security;
alter table public.project_checklist_status enable row level security;

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

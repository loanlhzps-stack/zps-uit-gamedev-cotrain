-- 0018_trainer_group_assignments.sql
-- Theo yêu cầu của bạn: form "Mời thành viên mới" cần cho Owner gán
-- "Nhóm phụ trách" cho Trainer ngay lúc mời — nhưng Trainer KHÔNG có khái
-- niệm gắn nhóm nào trong schema từ trước (chỉ gắn theo từng buổi học qua
-- sessions.trainer_profile_ids — xem comment GROUP_ASSIGNABLE_ROLES,
-- lib/constants/roles.ts) và permission matrix Trainer đã chốt trước đó
-- vẫn giữ nguyên "gán bài tập cho bất kỳ nhóm/sinh viên nào trong chương
-- trình, không giới hạn". Đã hỏi và bạn xác nhận: bảng mới này CHỈ mang
-- tính thông tin/hiển thị (ở trang Quản lý thành viên) — KHÔNG giới hạn
-- quyền gì của Trainer, không đụng RLS của assignments/groups.

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

-- Đọc: bất kỳ ai đang là active member của chương trình (giống mức mở của
-- mentor_assignments_select) — đây chỉ là dữ liệu hiển thị, không nhạy cảm.
create policy trainer_group_assignments_select on public.trainer_group_assignments for select
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_active_member(g.program_id)));

-- Ghi: Owner/Co-owner (giống hệt pattern mentor_assignments_write) — app
-- layer (lib/actions/invitations.ts, requireOwner) còn siết chặt hơn,
-- chỉ Owner mới gọi tới được, Co-owner ở RLS chỉ là biên an toàn dự phòng.
create policy trainer_group_assignments_write on public.trainer_group_assignments for all
  using (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)))
  with check (exists (select 1 from public.groups g where g.id = group_id and public.is_owner_or_co(g.program_id)));

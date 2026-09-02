-- 0016_mentor_parity.sql
-- Theo yêu cầu của bạn (chốt permission matrix Mentor ZPS/Mentor Sinh
-- viên): 2 vai trò Mentor có quyền GIỐNG HỆT NHAU trên nhóm mình phụ
-- trách — chỉ khác tên gọi vai trò để nhận diện. Bỏ 2 giới hạn trước
-- đó chỉ áp cho Mentor ZPS:
--
-- (1) Mở/nộp điểm danh — trước đó Mentor ZPS chỉ mở được khi nhóm
--     CHƯA có Mentor SV nào ("Group 8 exception" tổng quát hoá, xem
--     can_operate_attendance gốc ở 0002_rls.sql). Nay Mentor ZPS mở
--     được y hệt Mentor SV cho nhóm mình phụ trách, bất kể nhóm đó có
--     Mentor SV hay không.
-- (2) Sửa tên/ảnh đại diện NHÓM (`groups`, mục 13.1) — trước đó
--     `groups_update` (0002_rls.sql) chỉ cho Owner/Co-owner hoặc học
--     viên trong nhóm (is_group_member) sửa, cố ý loại Mentor theo
--     đúng câu "All student members may update the group image, group
--     name..." của doc. Nay thêm cả 2 loại Mentor của nhóm đó.
--
-- Cả 2 đều chỉ là thay policy/function, không đổi bảng/cột nào —
-- is_group_mentor(p_group_id) (không truyền p_mentor_type) đã có sẵn
-- từ 0002_rls.sql, trả true cho CẢ 2 loại Mentor được gán vào nhóm đó.

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

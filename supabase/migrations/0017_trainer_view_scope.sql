-- 0017_trainer_view_scope.sql
-- Theo yêu cầu của bạn (chốt lại permission matrix Trainer): thu hẹp
-- phạm vi Trainer, bỏ 2 quyền trước đó cấp riêng cho vai trò Trainer:
--
-- (1) Sửa buổi học được gán (`sessions`/`session_blocks`) — trước đó
--     Trainer sửa được ngày/địa điểm/ghi chú/learning block của CHÍNH
--     buổi mình được gán (trainer_profile_ids). Nay Owner/Co-owner
--     quản lý toàn bộ Thời khóa biểu, Trainer chỉ xem, không sửa.
-- (2) Đọc điểm danh (`attendance_sheets`/`attendance_records`) — trước
--     đó Trainer xem được toàn bộ điểm danh chương trình (chế độ chỉ
--     xem, section 11.2). Nay bỏ hẳn — Trainer không còn tab Điểm
--     danh, không cần đọc dữ liệu này nữa (không nhóm/Nhóm dự án nào
--     phụ thuộc quyền đọc này của Trainer).
--
-- Không đổi bảng/cột nào, chỉ thu hẹp 4 policy. `groups`/`group_members`
-- select KHÔNG đổi — Trainer vẫn cần đọc tên nhóm (gán bài tập cho bất
-- kỳ nhóm/sinh viên nào trong chương trình, xem lib/assignments/queries.ts
-- getProgramGroups/getProgramStudents) dù không còn xem Nhóm dự án ở
-- UI (chặn ở tầng UI, giống cách Student/Mentor bị chặn khỏi các trang
-- danh sách trước đó — RLS vẫn cho đọc rộng, chỉ ẩn ở app code).

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

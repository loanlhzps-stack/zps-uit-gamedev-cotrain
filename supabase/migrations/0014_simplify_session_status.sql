-- 0014_simplify_session_status.sql
-- Rút gọn sessions.status từ 6 xuống 4 giá trị (theo yêu cầu của
-- bạn): bỏ "ready" (rà lại code không thấy logic nào phân biệt riêng
-- giá trị này, thuần thang hiển thị) và "cancelled" (bạn xác nhận bỏ
-- hẳn khái niệm buổi bị huỷ ở app — cần huỷ thật thì xoá buổi học,
-- CRUD đã có sẵn ở /app/schedule). "Sắp tới"/"Đang học" không lưu ở
-- cột này — tự tính lúc hiển thị theo ngày, xem
-- getSessionStatusDisplay (lib/format/schedule.ts).
--
-- Map dữ liệu cũ trước khi đổi constraint: cả 2 giá trị bị bỏ đều
-- thuần hiển thị (không gate chức năng nào), map an toàn về
-- "scheduled" làm giá trị trung tính.
update public.sessions
set status = 'scheduled'
where status in ('ready', 'cancelled');

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions
  add constraint sessions_status_check check (status in ('draft', 'scheduled', 'attendance_open', 'completed'));

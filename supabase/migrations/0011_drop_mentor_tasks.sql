-- 0011_drop_mentor_tasks.sql
-- Xoá hẳn tính năng "Nhiệm vụ" (Mentor Task, design doc §12.2) khỏi
-- schema, theo yêu cầu của người dùng ("không cần nữa nên dọn nốt
-- phần code/schema còn lại đi") — toàn bộ code ứng dụng đọc/ghi 2
-- bảng này đã được xoá trước migration này (xem README).
--
-- RLS policies (mentor_tasks_select/write, mentor_task_assignees_
-- select/write từ 0002_rls.sql) và trigger set_updated_at trên
-- mentor_tasks tự động bị xoá cùng bảng, không cần lệnh riêng.
-- Không có bảng nào khác tham chiếu FK tới 2 bảng này.

drop table if exists public.mentor_task_assignees;
drop table if exists public.mentor_tasks;

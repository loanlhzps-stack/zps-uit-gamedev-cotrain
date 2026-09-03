-- 0019_session_mentor_assignments.sql
-- Theo yêu cầu của bạn: các buổi thực hành, ngoài Trainer còn cần gán
-- thêm Mentor phụ trách (Mentor ZPS/Mentor Sinh viên) — không thêm cột
-- phân loại "buổi lý thuyết/thực hành" (bạn chọn dựa vào tên buổi/learning
-- block có sẵn để tự quyết định buổi nào cần gán Mentor), chỉ thêm nơi
-- lưu danh sách Mentor được gán, đúng mẫu trainer_profile_ids.

alter table public.sessions
  add column mentor_profile_ids uuid[] not null default '{}';

comment on column public.sessions.mentor_profile_ids is 'Mentor (ZPS/Sinh viên) phụ trách buổi học — Owner/Co-owner tự chọn gán cho buổi thực hành, không giới hạn theo loại buổi (không có cột phân loại).';

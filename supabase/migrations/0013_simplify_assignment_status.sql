-- 0013_simplify_assignment_status.sql
--
-- Rút gọn AssignmentStatus (mục 12.1) — theo yêu cầu của bạn, brainstorm
-- lại vòng đời Bài tập: trước đó 8 giá trị tự do Trainer gõ tay, nhưng
-- 5/8 (published/submitted/late/needs_revision, cộng draft/archived)
-- không có logic nào trong app thật sự phân biệt hay dùng tới — tiến
-- độ nộp bài chính xác hơn đã có sẵn ở submissions.status (riêng theo
-- từng học viên/nhóm). Nay chỉ còn đúng vòng đời của BÀI TẬP (không
-- phải bài NỘP): 'in_progress' ("Đang làm", ngay khi Trainer/Mentor
-- giao) → 'completed' ("Hoàn thành"). "Quá hạn" KHÔNG lưu DB — tự tính
-- ở AssignmentStatusBadge (lib/format/assignments.ts) từ due_at khi
-- vẫn 'in_progress' mà đã qua hạn.
--
-- Map dữ liệu cũ trước khi đổi constraint (không mất assignment nào,
-- chỉ gộp trạng thái): draft/published/in_progress/submitted/late/
-- needs_revision → 'in_progress' (đều là "đang trong vòng đời, chưa
-- coi là xong"); completed/archived → 'completed' ("coi như xong" —
-- archived vốn chỉ ẩn khỏi 2 chỗ tính toán, không có ý nghĩa riêng để
-- giữ lại tách biệt sau khi rút gọn).

update public.assignments
set status = 'in_progress'
where status in ('draft', 'published', 'submitted', 'late', 'needs_revision');

update public.assignments
set status = 'completed'
where status = 'archived';

alter table public.assignments drop constraint if exists assignments_status_check;
alter table public.assignments
  add constraint assignments_status_check check (status in ('in_progress', 'completed'));
alter table public.assignments alter column status set default 'in_progress';

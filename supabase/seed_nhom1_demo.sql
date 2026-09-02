-- VNG-ZPSxUIT-GameDev CoTrain — demo data cho riêng Nhóm 1 (theo yêu cầu:
-- "demo toàn bộ data giả lập cho nhóm 1 để test giao diện, tính năng").
-- Khác với supabase/seed.sql (cố ý để trống sessions/attendance/assignment vì
-- chưa khai giảng), file này lấp đầy toàn bộ vòng đời tính năng CHỈ cho Nhóm 1
-- để bạn xem giao diện có dữ liệu thật. Không đụng tới Nhóm 2-8.
-- Chạy 1 lần trong Supabase SQL Editor, SAU KHI đã chạy supabase/seed.sql.
-- Chạy lại lần 2 sẽ tạo trùng lặp một số bảng con (không có unique constraint
-- để chặn) — muốn làm lại từ đầu, xoá thủ công theo group_id/assignment_id
-- bên dưới rồi chạy lại toàn bộ file.

begin;

-- 1. Xác nhận lại Mentor ZPS/Mentor Sinh viên cho Nhóm 1 (phòng trường hợp seed.sql chưa chạy tới đoạn này)
insert into public.mentor_assignments (group_id, profile_id, mentor_type) values ('0c2416bd-0527-50d3-86d9-ee94ed42c5e8', 'ea683fc9-a1aa-5ba3-b5ee-1eaa77c00a91', 'mentor_zps') on conflict (group_id, mentor_type) do nothing;
insert into public.mentor_assignments (group_id, profile_id, mentor_type) values ('0c2416bd-0527-50d3-86d9-ee94ed42c5e8', 'f9bf97b0-42f6-5a41-9eb0-fd970040f609', 'mentor_student') on conflict (group_id, mentor_type) do nothing;

-- 2. Thời khóa biểu: 2 buổi đã hoàn thành (có link khảo sát), buổi 3 giữ nguyên
-- 'scheduled' (mặc định từ seed.sql) — không set attendance_open nữa (theo yêu
-- cầu của bạn, bỏ hẳn demo "đang mở điểm danh" từng gắn ở buổi này) — nên buổi 3
-- tự động là buổi 'scheduled' gần nhất chưa diễn ra => tự ra badge "Sắp tới"
-- (getNearestUpcomingSessionId, lib/format/schedule.ts), các buổi 4 trở đi giữ
-- nguyên "Đã lên lịch".
update public.sessions set status = 'completed', survey_url = 'https://forms.gle/demo-khaosat-buoi1-nhom1' where id = 'b28989a3-f30f-53d9-a151-9922048d1efc';
update public.sessions set status = 'completed', survey_url = 'https://forms.gle/demo-khaosat-buoi2-nhom1' where id = 'd776f611-92b2-58d6-8896-fcb838710e09';

-- 3. Điểm danh Nhóm 1 cho 2 buổi đã hoàn thành (buổi 3 không còn ở trạng thái
-- "đang mở điểm danh" nữa nên bỏ luôn attendance_sheets/records dở dang từng
-- gắn ở buổi đó — xem lý do ở mục 2).
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('3609fd5c-afeb-44b3-b58e-8375ef1ba0f3', 'b28989a3-f30f-53d9-a151-9922048d1efc', '0c2416bd-0527-50d3-86d9-ee94ed42c5e8', 'locked', 'ea683fc9-a1aa-5ba3-b5ee-1eaa77c00a91', '2026-09-10 21:30:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('3609fd5c-afeb-44b3-b58e-8375ef1ba0f3', 'd38f91d3-a810-546a-81a2-44cebff78c26', 'present', null),
  ('3609fd5c-afeb-44b3-b58e-8375ef1ba0f3', '03aa76e4-babe-5a98-828f-ca4d53945eb0', 'present', null),
  ('3609fd5c-afeb-44b3-b58e-8375ef1ba0f3', 'ab23e88c-4d8f-5456-8f77-25493a9d2f43', 'excused_absence', 'Xin phép nghỉ ốm, có giấy xin phép'),
  ('3609fd5c-afeb-44b3-b58e-8375ef1ba0f3', 'f2e540cb-6fce-544b-85fb-46d99dbe114e', 'present', null),
  ('3609fd5c-afeb-44b3-b58e-8375ef1ba0f3', 'fbdb8080-08cc-5610-a06f-f98974f19737', 'unexcused_absence', null)
on conflict (attendance_sheet_id, profile_id) do nothing;

insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('5cc88001-8bc6-419a-8b43-a1faf1edddef', 'd776f611-92b2-58d6-8896-fcb838710e09', '0c2416bd-0527-50d3-86d9-ee94ed42c5e8', 'locked', 'ea683fc9-a1aa-5ba3-b5ee-1eaa77c00a91', '2026-09-17 21:15:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('5cc88001-8bc6-419a-8b43-a1faf1edddef', 'd38f91d3-a810-546a-81a2-44cebff78c26', 'present', null),
  ('5cc88001-8bc6-419a-8b43-a1faf1edddef', '03aa76e4-babe-5a98-828f-ca4d53945eb0', 'present', null),
  ('5cc88001-8bc6-419a-8b43-a1faf1edddef', 'ab23e88c-4d8f-5456-8f77-25493a9d2f43', 'present', null),
  ('5cc88001-8bc6-419a-8b43-a1faf1edddef', 'f2e540cb-6fce-544b-85fb-46d99dbe114e', 'present', null),
  ('5cc88001-8bc6-419a-8b43-a1faf1edddef', 'fbdb8080-08cc-5610-a06f-f98974f19737', 'unexcused_absence', null)
on conflict (attendance_sheet_id, profile_id) do nothing;
-- Trần Khải Ngoan (student35, fbdb8080) vắng không phép 2 buổi liên tiếp — cố ý, để demo cảnh báo 'Cần chú ý' (mục 17.1).

-- 4. Bài tập (Course Assignment) — test các mốc trong vòng đời (Đang làm / Hoàn thành / Quá hạn tự tính)

-- 4a. Cá nhân, target riêng từng thành viên, CHƯA NỘP — test luồng nhận + nộp bài lần đầu
insert into public.assignments (id, program_id, session_id, created_by, title, description, due_at, submission_mode, status, is_seed) values
  ('f65564ef-f67d-4d93-842d-04b5ba49c058', '2b0a0131-d1c1-5599-a0b6-e728d35dc523', null, '1d0307c4-69a8-50b6-8528-520a5b1d2c20', 'Cài đặt môi trường Unity + Git', 'Cài Unity Hub, Unity 2022 LTS, Git; tạo tài khoản GitHub; gửi link repo trống để Mentor kiểm tra.', '2026-09-16 23:59:00+07', 'individual', 'in_progress', true);
insert into public.assignment_targets (assignment_id, target_type, profile_id) values
  ('f65564ef-f67d-4d93-842d-04b5ba49c058', 'profile', 'd38f91d3-a810-546a-81a2-44cebff78c26'), ('f65564ef-f67d-4d93-842d-04b5ba49c058', 'profile', '03aa76e4-babe-5a98-828f-ca4d53945eb0'), ('f65564ef-f67d-4d93-842d-04b5ba49c058', 'profile', 'ab23e88c-4d8f-5456-8f77-25493a9d2f43'), ('f65564ef-f67d-4d93-842d-04b5ba49c058', 'profile', 'f2e540cb-6fce-544b-85fb-46d99dbe114e'), ('f65564ef-f67d-4d93-842d-04b5ba49c058', 'profile', 'fbdb8080-08cc-5610-a06f-f98974f19737');

-- 4b. Theo nhóm, ĐÃ NỘP đang chờ review — test luồng review của Trainer/Owner
insert into public.assignments (id, program_id, session_id, created_by, title, description, due_at, submission_mode, status, is_seed) values
  ('5b93e143-3c45-48ff-971c-8868a8122347', '2b0a0131-d1c1-5599-a0b6-e728d35dc523', 'b28989a3-f30f-53d9-a151-9922048d1efc', 'c5238355-6c13-5016-8db9-135fac551325', 'Prototype Gameplay Loop - Vòng 1', 'Làm một bản chơi được (playable) thể hiện core loop chính của game, đóng gói build để test.', '2026-09-24 23:59:00+07', 'group', 'in_progress', true);
insert into public.assignment_targets (assignment_id, target_type, group_id) values ('5b93e143-3c45-48ff-971c-8868a8122347', 'group', '0c2416bd-0527-50d3-86d9-ee94ed42c5e8');
insert into public.submissions (id, assignment_id, group_id, status, locked_at, last_updated_by, created_at, updated_at) values
  ('15f20a65-f904-4d6d-95d5-103f024499d7', '5b93e143-3c45-48ff-971c-8868a8122347', '0c2416bd-0527-50d3-86d9-ee94ed42c5e8', 'locked', '2026-09-20 22:00:00+07', '03aa76e4-babe-5a98-828f-ca4d53945eb0', '2026-09-18 20:00:00+07', '2026-09-20 22:00:00+07');
insert into public.submission_versions (id, submission_id, version_number, note, created_by, created_at) values
  ('0e19aaaf-ccb1-482f-a603-3e566a618a28', '15f20a65-f904-4d6d-95d5-103f024499d7', 1, 'Bản nháp đầu tiên — core loop chạy được nhưng chưa có UI.', '03aa76e4-babe-5a98-828f-ca4d53945eb0', '2026-09-18 20:00:00+07'),
  ('8f831589-d0ee-4239-a95a-59c39032c68e', '15f20a65-f904-4d6d-95d5-103f024499d7', 2, 'Bản nộp chính thức — đã thêm UI cơ bản + fix bug va chạm nhân vật.', '03aa76e4-babe-5a98-828f-ca4d53945eb0', '2026-09-20 22:00:00+07');
insert into public.submission_assets (submission_version_id, asset_type, url) values
  ('8f831589-d0ee-4239-a95a-59c39032c68e', 'build_link', 'https://drive.google.com/demo-build-nhom1-v1'),
  ('8f831589-d0ee-4239-a95a-59c39032c68e', 'github_link', 'https://github.com/vng-zpsxuit-demo/nhom1-fox-runner');

-- 4c. Theo nhóm, CẦN CHỈNH SỬA LẠI — test thông báo revision + luồng nộp lại
insert into public.assignments (id, program_id, session_id, created_by, title, description, due_at, submission_mode, status, is_seed) values
  ('d4b0f11d-1e16-437e-9e80-aa1ac08acedf', '2b0a0131-d1c1-5599-a0b6-e728d35dc523', null, '1d0307c4-69a8-50b6-8528-520a5b1d2c20', 'Thiết kế nhân vật chính (Concept Art)', 'Vẽ concept art nhân vật chính kèm 2 phối màu, mô tả ngắn tính cách nhân vật.', '2026-09-22 23:59:00+07', 'group', 'in_progress', true);
insert into public.assignment_targets (assignment_id, target_type, group_id) values ('d4b0f11d-1e16-437e-9e80-aa1ac08acedf', 'group', '0c2416bd-0527-50d3-86d9-ee94ed42c5e8');
insert into public.submissions (id, assignment_id, group_id, status, last_updated_by, created_at, updated_at) values
  ('a363da0c-ad86-4360-b4ad-ba099956cac6', 'd4b0f11d-1e16-437e-9e80-aa1ac08acedf', '0c2416bd-0527-50d3-86d9-ee94ed42c5e8', 'needs_revision', 'ab23e88c-4d8f-5456-8f77-25493a9d2f43', '2026-09-19 19:00:00+07', '2026-09-21 09:00:00+07');
insert into public.submission_versions (id, submission_id, version_number, note, created_by, created_at) values
  ('c1ec48fb-e62f-4c5d-a709-b230506b2bd6', 'a363da0c-ad86-4360-b4ad-ba099956cac6', 1, 'Bản nộp đầu tiên — 1 concept art, chưa có phối màu.', 'ab23e88c-4d8f-5456-8f77-25493a9d2f43', '2026-09-19 19:00:00+07');
insert into public.submission_assets (submission_version_id, asset_type, url) values
  ('c1ec48fb-e62f-4c5d-a709-b230506b2bd6', 'drive_link', 'https://drive.google.com/demo-conceptart-nhom1');

-- 4d. Toàn chương trình, cá nhân, HOÀN THÀNH (riêng phần của Nguyễn Văn Sỹ, student34/f2e540cb) — test trạng thái cuối vòng đời
insert into public.assignments (id, program_id, session_id, created_by, title, description, due_at, submission_mode, status, is_seed) values
  ('0214992c-9f85-471f-a649-1101e35c4440', '2b0a0131-d1c1-5599-a0b6-e728d35dc523', null, '1d0307c4-69a8-50b6-8528-520a5b1d2c20', 'Khảo sát kỹ năng đầu vào', 'Điền form khảo sát kỹ năng lập trình/thiết kế hiện có trước khi vào chương trình.', '2026-09-12 23:59:00+07', 'individual', 'completed', true);
insert into public.assignment_targets (assignment_id, target_type) values ('0214992c-9f85-471f-a649-1101e35c4440', 'program');
insert into public.submissions (id, assignment_id, profile_id, status, locked_at, last_updated_by, created_at, updated_at) values
  ('9ad1c91f-ed0d-49cb-b3cc-ec8255c95660', '0214992c-9f85-471f-a649-1101e35c4440', 'f2e540cb-6fce-544b-85fb-46d99dbe114e', 'completed', '2026-09-11 10:00:00+07', 'f2e540cb-6fce-544b-85fb-46d99dbe114e', '2026-09-11 09:00:00+07', '2026-09-11 10:00:00+07');
insert into public.submission_versions (id, submission_id, version_number, note, created_by, created_at) values
  ('0397a181-ab94-4beb-b629-0320fb0dfb9e', '9ad1c91f-ed0d-49cb-b3cc-ec8255c95660', 1, 'Đã hoàn thành khảo sát.', 'f2e540cb-6fce-544b-85fb-46d99dbe114e', '2026-09-11 10:00:00+07');

-- 5. Final Project (group_projects) — điền đủ thông tin + vai trò từng thành viên +
-- 2 bản build demo (project_builds, thay project_submissions cũ) + vài mục checklist mẫu
update public.group_projects set
  game_name = 'Cáo Con Vượt Mê Cung',
  concept = 'Platformer 2D — nhân vật chính là một chú cáo con phải vượt qua các mê cung đầy bẫy để tìm đường về nhà, kết hợp giải đố nhẹ và thu thập vật phẩm.',
  milestone_stage = 'prototype',
  milestone_status = 'completed',
  milestone_next_goal = 'Hoàn thiện Vertical Slice và core gameplay loop.',
  milestone_deadline = '2026-10-15',
  updated_at = now()
where group_id = '0c2416bd-0527-50d3-86d9-ee94ed42c5e8';

insert into public.project_members (group_project_id, profile_id, role_in_project)
select id, v.profile_id, v.role_in_project
from public.group_projects, (values
  ('d38f91d3-a810-546a-81a2-44cebff78c26'::uuid, 'Lập trình (Programmer)'),
  ('03aa76e4-babe-5a98-828f-ca4d53945eb0'::uuid, 'Thiết kế Game (Game Designer)'),
  ('ab23e88c-4d8f-5456-8f77-25493a9d2f43'::uuid, 'Hoạ sĩ (Artist)'),
  ('f2e540cb-6fce-544b-85fb-46d99dbe114e'::uuid, 'Âm thanh (Sound)'),
  ('fbdb8080-08cc-5610-a06f-f98974f19737'::uuid, 'Kiểm thử (QA)')
) as v(profile_id, role_in_project)
where group_id = '0c2416bd-0527-50d3-86d9-ee94ed42c5e8'
on conflict (group_project_id, profile_id) do update set role_in_project = excluded.role_in_project;

insert into public.project_builds (id, group_project_id, version_name, platform, build_url, repository_url, gameplay_demo_url, uploaded_by, created_at, updated_at)
select '9d85d843-c953-4141-98ee-54a39333a50d'::uuid, id, 'Prototype vòng 1', 'Windows', 'https://drive.google.com/demo-build-nhom1-v1', 'https://github.com/vng-zpsxuit-demo/nhom1-fox-runner', 'https://youtube.com/demo-video-nhom1', '03aa76e4-babe-5a98-828f-ca4d53945eb0'::uuid, '2026-09-20 22:30:00+07'::timestamptz, '2026-09-20 22:30:00+07'::timestamptz
from public.group_projects where group_id = '0c2416bd-0527-50d3-86d9-ee94ed42c5e8';

insert into public.project_builds (id, group_project_id, version_name, build_url, uploaded_by, created_at, updated_at)
select '70369f7d-a8f5-4846-ae81-9a5a7b983dcc'::uuid, id, 'Vertical Slice', 'https://drive.google.com/demo-vertical-slice-nhom1', 'ab23e88c-4d8f-5456-8f77-25493a9d2f43'::uuid, '2026-10-05 09:00:00+07'::timestamptz, '2026-10-05 09:00:00+07'::timestamptz
from public.group_projects where group_id = '0c2416bd-0527-50d3-86d9-ee94ed42c5e8';

insert into public.project_checklist_status (group_project_id, item_key, status, updated_by)
select id, v.item_key, v.status, '03aa76e4-babe-5a98-828f-ca4d53945eb0'::uuid
from public.group_projects, (values
  ('gameplay_core_loop', 'done'),
  ('gameplay_tutorial', 'in_progress'),
  ('build_installable', 'done'),
  ('build_docs_updated', 'in_progress'),
  ('docs_asset_license', 'not_started'),
  ('expo_rehearsal_ready', 'not_started')
) as v(item_key, status)
where group_id = '0c2416bd-0527-50d3-86d9-ee94ed42c5e8';

-- 6. Thông báo mẫu — để chuông thông báo không trống khi test bằng các tài khoản Nhóm 1
insert into public.notifications (id, program_id, recipient_profile_id, type, title, body, link_href) values
  ('3cac82e4-50b5-480f-9922-2d2546bea58a', '2b0a0131-d1c1-5599-a0b6-e728d35dc523', 'd38f91d3-a810-546a-81a2-44cebff78c26', 'deadline', 'Bài tập sắp đến hạn', 'Cài đặt môi trường Unity + Git', '/app/assignments/f65564ef-f67d-4d93-842d-04b5ba49c058'),
  ('7a431e57-6b29-4252-b46e-9590af3b41d5', '2b0a0131-d1c1-5599-a0b6-e728d35dc523', '1d0307c4-69a8-50b6-8528-520a5b1d2c20', 'submission', 'Có bài nộp mới cần review', 'Prototype Gameplay Loop - Vòng 1', '/app/assignments/5b93e143-3c45-48ff-971c-8868a8122347'),
  ('e43aed0f-d662-4f09-8dbe-389660cd0c0e', '2b0a0131-d1c1-5599-a0b6-e728d35dc523', 'ab23e88c-4d8f-5456-8f77-25493a9d2f43', 'revision', 'Bài nộp cần chỉnh sửa lại', 'Thiết kế nhân vật chính (Concept Art)', '/app/assignments/d4b0f11d-1e16-437e-9e80-aa1ac08acedf'),
  ('922f88ff-b7d6-4f15-813b-3ac0cc61edf5', '2b0a0131-d1c1-5599-a0b6-e728d35dc523', 'ea683fc9-a1aa-5ba3-b5ee-1eaa77c00a91', 'missing_attendance_sheet', 'Buổi học đã kết thúc — đừng quên điểm danh', 'Buổi 01/10/2026 đang chờ điểm danh', '/app/groups/0c2416bd-0527-50d3-86d9-ee94ed42c5e8?tab=attendance');

commit;

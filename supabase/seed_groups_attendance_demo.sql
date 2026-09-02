-- VNG-ZPSxUIT-GameDev CoTrain — demo điểm danh ĐẦY ĐỦ (có mặt) cho Nhóm 3-8,
-- cho 2 buổi đã hoàn thành (giống seed_nhom1_demo.sql làm cho Nhóm 1), để
-- Group Health = On track cho các nhóm này (theo yêu cầu của bạn: chỉ giữ
-- đúng 1 nhóm ở Need attention để demo cảnh báo — chọn giữ nguyên Nhóm 2,
-- KHÔNG đụng tới Nhóm 2 trong file này).
-- Chạy 1 lần trong Supabase SQL Editor, SAU KHI đã chạy supabase/seed.sql
-- và supabase/seed_nhom1_demo.sql (2 buổi này phải đang ở status 'completed',
-- set bởi seed_nhom1_demo.sql — sessions dùng chung cho cả chương trình).
-- Chạy lại lần 2 sẽ tạo trùng lặp (không có unique constraint chặn) — muốn
-- làm lại, xoá thủ công theo attendance_sheet id bên dưới rồi chạy lại.

begin;

-- Nhóm 3
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('fbc1a532-293d-4805-962c-f4eb0537f8bf', 'b28989a3-f30f-53d9-a151-9922048d1efc', '1d8d68b9-421f-5871-a588-49aee2937f0e', 'locked', '3649ca58-d0bb-5b3c-bc97-d02e50e02d17', '2026-09-10 21:30:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('fbc1a532-293d-4805-962c-f4eb0537f8bf', '246ae2fd-78ef-5fc6-a0a2-4eb75705d4b8', 'present', null), ('fbc1a532-293d-4805-962c-f4eb0537f8bf', '58999629-ca72-5a3e-b1f2-b24c4eda95d5', 'present', null), ('fbc1a532-293d-4805-962c-f4eb0537f8bf', 'cadaa199-0385-5cfa-9177-8e4764df43a7', 'present', null), ('fbc1a532-293d-4805-962c-f4eb0537f8bf', 'e16a529e-8353-5bba-b7b0-8f11d9287514', 'present', null), ('fbc1a532-293d-4805-962c-f4eb0537f8bf', 'da65eeee-973c-5e75-a433-1fd102bf8b35', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('6c60a324-48c3-4c95-a497-7172de18bdd1', 'd776f611-92b2-58d6-8896-fcb838710e09', '1d8d68b9-421f-5871-a588-49aee2937f0e', 'locked', '3649ca58-d0bb-5b3c-bc97-d02e50e02d17', '2026-09-17 21:15:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('6c60a324-48c3-4c95-a497-7172de18bdd1', '246ae2fd-78ef-5fc6-a0a2-4eb75705d4b8', 'present', null), ('6c60a324-48c3-4c95-a497-7172de18bdd1', '58999629-ca72-5a3e-b1f2-b24c4eda95d5', 'present', null), ('6c60a324-48c3-4c95-a497-7172de18bdd1', 'cadaa199-0385-5cfa-9177-8e4764df43a7', 'present', null), ('6c60a324-48c3-4c95-a497-7172de18bdd1', 'e16a529e-8353-5bba-b7b0-8f11d9287514', 'present', null), ('6c60a324-48c3-4c95-a497-7172de18bdd1', 'da65eeee-973c-5e75-a433-1fd102bf8b35', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;

-- Nhóm 4
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('6137eda4-e3bf-4bda-9480-2d33863e95b8', 'b28989a3-f30f-53d9-a151-9922048d1efc', '3b5da340-85f8-5370-beaf-26fb13a398f2', 'locked', 'e48b79d8-6bbf-5337-aa69-9ec5790c8199', '2026-09-10 21:30:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('6137eda4-e3bf-4bda-9480-2d33863e95b8', '2144d442-a79f-5ce6-9520-1fda59be9aab', 'present', null), ('6137eda4-e3bf-4bda-9480-2d33863e95b8', '16da2267-509e-54f7-97ee-4ad6705eac4f', 'present', null), ('6137eda4-e3bf-4bda-9480-2d33863e95b8', 'ffc0961a-26c4-5fb2-9e2f-6c183d926212', 'present', null), ('6137eda4-e3bf-4bda-9480-2d33863e95b8', '28d47a73-5250-5754-8e37-db250d3e5235', 'present', null), ('6137eda4-e3bf-4bda-9480-2d33863e95b8', 'f0dac074-4c55-5f9a-bcee-ec90def05218', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('02630f46-9fc4-4452-8696-40ae9b548433', 'd776f611-92b2-58d6-8896-fcb838710e09', '3b5da340-85f8-5370-beaf-26fb13a398f2', 'locked', 'e48b79d8-6bbf-5337-aa69-9ec5790c8199', '2026-09-17 21:15:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('02630f46-9fc4-4452-8696-40ae9b548433', '2144d442-a79f-5ce6-9520-1fda59be9aab', 'present', null), ('02630f46-9fc4-4452-8696-40ae9b548433', '16da2267-509e-54f7-97ee-4ad6705eac4f', 'present', null), ('02630f46-9fc4-4452-8696-40ae9b548433', 'ffc0961a-26c4-5fb2-9e2f-6c183d926212', 'present', null), ('02630f46-9fc4-4452-8696-40ae9b548433', '28d47a73-5250-5754-8e37-db250d3e5235', 'present', null), ('02630f46-9fc4-4452-8696-40ae9b548433', 'f0dac074-4c55-5f9a-bcee-ec90def05218', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;

-- Nhóm 5
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('53dca21b-e90b-430c-8d19-6dfe882a6a31', 'b28989a3-f30f-53d9-a151-9922048d1efc', 'c1bb1a44-295d-5fb3-97cb-86b10f3ddd3f', 'locked', '59c73d36-8022-5db7-ba6f-b5e29b827521', '2026-09-10 21:30:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('53dca21b-e90b-430c-8d19-6dfe882a6a31', 'af9dad4b-a9db-5acf-98d5-2dfd954dce3d', 'present', null), ('53dca21b-e90b-430c-8d19-6dfe882a6a31', '9d5abb65-acc5-51c0-b966-19b7c8424e45', 'present', null), ('53dca21b-e90b-430c-8d19-6dfe882a6a31', 'bc0e547a-7adc-54d6-98ac-d3a7ef446014', 'present', null), ('53dca21b-e90b-430c-8d19-6dfe882a6a31', '5911d0df-908d-573e-90db-c5ba3debbc81', 'present', null), ('53dca21b-e90b-430c-8d19-6dfe882a6a31', 'f1d51e7a-0630-58bf-8655-db6ed7042e9b', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('e243db76-2816-4315-ab38-1d513a4a6f91', 'd776f611-92b2-58d6-8896-fcb838710e09', 'c1bb1a44-295d-5fb3-97cb-86b10f3ddd3f', 'locked', '59c73d36-8022-5db7-ba6f-b5e29b827521', '2026-09-17 21:15:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('e243db76-2816-4315-ab38-1d513a4a6f91', 'af9dad4b-a9db-5acf-98d5-2dfd954dce3d', 'present', null), ('e243db76-2816-4315-ab38-1d513a4a6f91', '9d5abb65-acc5-51c0-b966-19b7c8424e45', 'present', null), ('e243db76-2816-4315-ab38-1d513a4a6f91', 'bc0e547a-7adc-54d6-98ac-d3a7ef446014', 'present', null), ('e243db76-2816-4315-ab38-1d513a4a6f91', '5911d0df-908d-573e-90db-c5ba3debbc81', 'present', null), ('e243db76-2816-4315-ab38-1d513a4a6f91', 'f1d51e7a-0630-58bf-8655-db6ed7042e9b', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;

-- Nhóm 6
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('dd25e506-bb60-4da0-bd65-9e3db197505e', 'b28989a3-f30f-53d9-a151-9922048d1efc', '6072a769-96a3-502a-985f-10bca6464c69', 'locked', '179fdea8-fccc-5868-8f10-550c424a9e2b', '2026-09-10 21:30:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('dd25e506-bb60-4da0-bd65-9e3db197505e', 'fe527cec-6577-50d6-9dc9-937191458d21', 'present', null), ('dd25e506-bb60-4da0-bd65-9e3db197505e', 'fc333782-4963-5f2c-9e35-5105ae11edc1', 'present', null), ('dd25e506-bb60-4da0-bd65-9e3db197505e', 'd4227ffa-a757-5523-a21c-fd6bb9bd6d32', 'present', null), ('dd25e506-bb60-4da0-bd65-9e3db197505e', '080fbc3f-fb3c-543b-bdf7-7e0758ad1b07', 'present', null), ('dd25e506-bb60-4da0-bd65-9e3db197505e', '7c986384-81ee-50a8-a775-3c81c610742d', 'present', null), ('dd25e506-bb60-4da0-bd65-9e3db197505e', '285986db-7b27-5e85-943a-51a52f165202', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('09e5e605-52d4-43c4-8950-e97fc117a878', 'd776f611-92b2-58d6-8896-fcb838710e09', '6072a769-96a3-502a-985f-10bca6464c69', 'locked', '179fdea8-fccc-5868-8f10-550c424a9e2b', '2026-09-17 21:15:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('09e5e605-52d4-43c4-8950-e97fc117a878', 'fe527cec-6577-50d6-9dc9-937191458d21', 'present', null), ('09e5e605-52d4-43c4-8950-e97fc117a878', 'fc333782-4963-5f2c-9e35-5105ae11edc1', 'present', null), ('09e5e605-52d4-43c4-8950-e97fc117a878', 'd4227ffa-a757-5523-a21c-fd6bb9bd6d32', 'present', null), ('09e5e605-52d4-43c4-8950-e97fc117a878', '080fbc3f-fb3c-543b-bdf7-7e0758ad1b07', 'present', null), ('09e5e605-52d4-43c4-8950-e97fc117a878', '7c986384-81ee-50a8-a775-3c81c610742d', 'present', null), ('09e5e605-52d4-43c4-8950-e97fc117a878', '285986db-7b27-5e85-943a-51a52f165202', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;

-- Nhóm 7
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('2cd35ebe-3ac1-4e23-9b64-5fdc617d7c85', 'b28989a3-f30f-53d9-a151-9922048d1efc', '3ac0cfa9-54a9-58b7-87cb-86769ef55bd3', 'locked', '7afc12a2-0266-5b38-9918-9c15b07466ad', '2026-09-10 21:30:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('2cd35ebe-3ac1-4e23-9b64-5fdc617d7c85', 'b317e353-e86e-549f-8e1e-53cff61c22eb', 'present', null), ('2cd35ebe-3ac1-4e23-9b64-5fdc617d7c85', 'bb928cf5-76d1-50d2-8855-05cf2aefe610', 'present', null), ('2cd35ebe-3ac1-4e23-9b64-5fdc617d7c85', 'e2e6e3f8-6f8c-51b9-9a42-498675403934', 'present', null), ('2cd35ebe-3ac1-4e23-9b64-5fdc617d7c85', '15afbed9-64a9-5522-9ec0-97c007f81d46', 'present', null), ('2cd35ebe-3ac1-4e23-9b64-5fdc617d7c85', 'adbe586b-a026-5a80-8721-16d36e51f41b', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('bde1a655-a0b4-4b89-ace7-03a945955b3b', 'd776f611-92b2-58d6-8896-fcb838710e09', '3ac0cfa9-54a9-58b7-87cb-86769ef55bd3', 'locked', '7afc12a2-0266-5b38-9918-9c15b07466ad', '2026-09-17 21:15:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('bde1a655-a0b4-4b89-ace7-03a945955b3b', 'b317e353-e86e-549f-8e1e-53cff61c22eb', 'present', null), ('bde1a655-a0b4-4b89-ace7-03a945955b3b', 'bb928cf5-76d1-50d2-8855-05cf2aefe610', 'present', null), ('bde1a655-a0b4-4b89-ace7-03a945955b3b', 'e2e6e3f8-6f8c-51b9-9a42-498675403934', 'present', null), ('bde1a655-a0b4-4b89-ace7-03a945955b3b', '15afbed9-64a9-5522-9ec0-97c007f81d46', 'present', null), ('bde1a655-a0b4-4b89-ace7-03a945955b3b', 'adbe586b-a026-5a80-8721-16d36e51f41b', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;

-- Nhóm 8
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('d871f389-92d2-4686-a989-aedb3400810e', 'b28989a3-f30f-53d9-a151-9922048d1efc', '2921d23a-5f58-56da-a5a1-7cabee658795', 'locked', '61e15af8-477f-52eb-83aa-e1f33cb5c6a8', '2026-09-10 21:30:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('d871f389-92d2-4686-a989-aedb3400810e', 'a0d4269f-d717-5d33-bdd9-0f1c92bf3abf', 'present', null), ('d871f389-92d2-4686-a989-aedb3400810e', '523862a6-2592-5272-8da5-b7c44c010eae', 'present', null), ('d871f389-92d2-4686-a989-aedb3400810e', '26a24409-ed32-5eb7-a43c-53b491e223ae', 'present', null), ('d871f389-92d2-4686-a989-aedb3400810e', '9bb3ba31-1b2f-53f9-ad12-a8afe4253ee1', 'present', null), ('d871f389-92d2-4686-a989-aedb3400810e', '43c0866d-2e48-5a59-ae0c-e57f128914eb', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;
insert into public.attendance_sheets (id, session_id, group_id, status, submitted_by, submitted_at) values ('305fbc5d-e90f-4f27-ac05-9c6569efbdaa', 'd776f611-92b2-58d6-8896-fcb838710e09', '2921d23a-5f58-56da-a5a1-7cabee658795', 'locked', '61e15af8-477f-52eb-83aa-e1f33cb5c6a8', '2026-09-17 21:15:00+07') on conflict (session_id, group_id) do nothing;
insert into public.attendance_records (attendance_sheet_id, profile_id, status, note) values
  ('305fbc5d-e90f-4f27-ac05-9c6569efbdaa', 'a0d4269f-d717-5d33-bdd9-0f1c92bf3abf', 'present', null), ('305fbc5d-e90f-4f27-ac05-9c6569efbdaa', '523862a6-2592-5272-8da5-b7c44c010eae', 'present', null), ('305fbc5d-e90f-4f27-ac05-9c6569efbdaa', '26a24409-ed32-5eb7-a43c-53b491e223ae', 'present', null), ('305fbc5d-e90f-4f27-ac05-9c6569efbdaa', '9bb3ba31-1b2f-53f9-ad12-a8afe4253ee1', 'present', null), ('305fbc5d-e90f-4f27-ac05-9c6569efbdaa', '43c0866d-2e48-5a59-ae0c-e57f128914eb', 'present', null)
on conflict (attendance_sheet_id, profile_id) do nothing;

commit;

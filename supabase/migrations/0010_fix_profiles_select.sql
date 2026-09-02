-- VNG-ZPSxUIT-GameDev CoTrain — fix profiles_select RLS (mục cảnh báo
-- README: cột "Thành viên" hiện "—" cho tất cả trừ chính mình).
--
-- Nguyên nhân thật (đã xác nhận bằng dữ liệu thật trên Supabase — data
-- program_memberships hoàn toàn đúng, cùng program_id, status='active'
-- cho mọi thành viên Nhóm 1): profiles_select (0002_rls.sql) kiểm tra
-- "người xem VÀ người được xem cùng active trong 1 chương trình" bằng
-- 1 subquery đọc trực tiếp bảng program_memberships:
--
--   exists (
--     select 1 from public.program_memberships mine
--     join public.program_memberships theirs
--       on theirs.program_id = mine.program_id and theirs.status = 'active'
--     where mine.profile_id = auth.uid() and mine.status = 'active'
--       and theirs.profile_id = profiles.id
--   )
--
-- Nhưng program_memberships có RLS riêng (program_memberships_select):
-- "profile_id = auth.uid() or is_owner_or_co(program_id)" — nghĩa là
-- một Student KHÔNG được phép đọc dòng program_memberships của người
-- khác. Khi Postgres chạy subquery ở trên, RLS của program_memberships
-- áp dụng lại NGAY TRONG subquery đó — nên "theirs" (dòng của người
-- khác) luôn rỗng với bất kỳ ai không phải Owner/Co-owner, khiến
-- exists(...) luôn false, và profiles_select chặn nhầm mọi profile
-- khác chính mình. Đây chính là lỗi mà comment đầu file 0002_rls.sql
-- đã cảnh báo ("Helper functions are SECURITY DEFINER so a policy can
-- look up the caller's membership without recursing into
-- program_memberships' own RLS") — mọi helper khác trong file đều theo
-- đúng pattern đó, riêng profiles_select thì lại không, nên dính bug.
--
-- Fix: chuyển phần kiểm tra qua 1 hàm SECURITY DEFINER (is_active_program_peer),
-- giống hệt is_owner_or_co/is_group_member/is_group_mentor — hàm chạy
-- với quyền của người định nghĩa nên không bị RLS của
-- program_memberships chặn khi đọc "theirs".

create or replace function public.is_active_program_peer(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.program_memberships mine
    join public.program_memberships theirs
      on theirs.program_id = mine.program_id and theirs.status = 'active'
    where mine.profile_id = auth.uid()
      and mine.status = 'active'
      and theirs.profile_id = target_profile_id
  );
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or public.is_active_program_peer(id)
  );

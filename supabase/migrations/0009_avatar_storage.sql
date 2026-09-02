-- VNG-ZPSxUIT-GameDev CoTrain — avatar upload (Design Doc section 5.3 "Avatar")
--
-- Deferred since Phase 3 (README flagged deviation: "Avatar bỏ qua
-- hoàn toàn ở onboarding ... cho tới khi có upload thật lên Supabase
-- Storage") until every other feature that could also need file
-- upload was built and it was clear avatar is the only one still
-- wanted (Course Assignment/Final Project/Checkpoint evidence all
-- stay link-based by design — see README).
--
-- One public bucket. Avatars are low-sensitivity (a profile photo any
-- program member already sees elsewhere in the UI — Sidebar, Main Bar,
-- MembersTable...) so a public-read bucket avoids needing signed URLs
-- everywhere an <img> tag already expects a plain avatar_url string,
-- same as the plain-URL image fields already used for
-- groups.image_url/group_projects.image_url.
--
-- Write is restricted to each user's own folder
-- (avatars/{auth.uid()}/...) — profiles.avatar_url itself is still
-- only settable by the owning row's RLS (profiles_update, 0002_rls.sql
-- already is_self-scoped), this just adds the matching Storage-level
-- gate so a user can't upload into someone else's folder even though
-- the bucket is publicly readable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB, matches the Server Action's own check (lib/actions/profile.ts)
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

create policy avatars_own_folder_insert on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_own_folder_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_own_folder_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

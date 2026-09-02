-- VNG-ZPSxUIT-GameDev CoTrain — Phase 3 additions (Design Doc section 5, 25.3)
--
-- 1. profiles.email — Supabase Auth stores email on auth.users, which is
--    not readable through the anon/authenticated Postgres role by
--    default. The People & Access page (Owner/Co-owner) and the "who is
--    this" bits of the UI need to show a member's email, so we mirror it
--    onto public.profiles at signup time (handle_new_auth_user) and keep
--    it in sync if it ever changes. This does not weaken RLS: profiles
--    is still gated by the same profiles_select policy as before.
--
-- 2. profiles.onboarding_completed_at — marks when a user finished the
--    first-login flow (section 5.2: activate -> set password -> complete
--    profile -> confirm notification prefs -> enter Home). NULL means
--    "send them to /onboarding/profile", regardless of how the account
--    was created (invited by Owner, or seeded).

alter table public.profiles
  add column if not exists email text,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.email is
  'Mirrored from auth.users.email for display only (People & Access, etc). Not the source of truth for login.';
comment on column public.profiles.onboarding_completed_at is
  'Set once the section 5.2 first-login flow (profile + notification prefs) is completed. NULL routes to /onboarding/profile.';

-- Backfill for any profile that already exists in this database (no-op
-- on a fresh install, relevant if 0001/0002 already ran once).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ---------------------------------------------------------------------
-- Replace handle_new_auth_user() to also mirror the email.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Keep profiles.email in sync if a user's auth email ever changes.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- ---------------------------------------------------------------------
-- activate_own_membership() — section 5.2 first-login flow.
--
-- program_memberships is Owner-only for writes (see 0002_rls.sql,
-- "program_memberships — Owner-only writes"): a Trainer or Student must
-- not be able to change their own role or status. But completing
-- onboarding *is* meant to flip that one user's own 'invited' row to
-- 'active' ("Activate account" in the section 5.2 diagram) — narrow,
-- single-purpose SECURITY DEFINER RPC, callable by any authenticated
-- user, that can only ever touch the caller's own row and only ever
-- invited -> active (never role, never suspended/archived -> active).
-- ---------------------------------------------------------------------
create or replace function public.activate_own_membership()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.program_memberships
  set status = 'active'
  where profile_id = auth.uid() and status = 'invited';
end;
$$;

revoke all on function public.activate_own_membership() from public;
grant execute on function public.activate_own_membership() to authenticated;

-- ---------------------------------------------------------------------
-- profiles_select — widen for Owner/Co-owner (People & Access, section
-- 6.2/4.2). The original policy (0002_rls.sql) only let a member see
-- colleagues whose OWN membership is already 'active', which hides
-- freshly-invited people (still 'invited') and suspended/archived ones
-- from the People & Access list — exactly the accounts an Owner/
-- Co-owner needs to see and manage there. Regular members are
-- unaffected: they still only see active colleagues.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.program_memberships mine
      join public.program_memberships theirs
        on theirs.program_id = mine.program_id
      where mine.profile_id = auth.uid()
        and mine.status = 'active'
        and theirs.profile_id = profiles.id
        and (theirs.status = 'active' or mine.role in ('owner', 'co_owner'))
    )
  );

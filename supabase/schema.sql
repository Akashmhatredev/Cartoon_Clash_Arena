-- Cartoon Clash: Supabase schema (hardened). Safe to re-run in the SQL editor.
-- Everything is prefixed cc_ so it can share a project with another app.
-- Clients: read profiles/leaderboard, read their own matches, insert their own profile (id, display_name only),
-- update only their own display_name. Only the Worker (service_role) records matches and rank points.

create table if not exists public.cc_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 20),
  rank_points int not null default 1000,
  wins int not null default 0,
  losses int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cc_matches (
  id uuid primary key default gen_random_uuid(),
  p1 uuid references auth.users(id) on delete set null,
  p2 uuid references auth.users(id) on delete set null,
  winner uuid,
  p1_char text,
  p2_char text,
  rounds jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cc_matches_p1_idx on public.cc_matches (p1, created_at desc);
create index if not exists cc_matches_p2_idx on public.cc_matches (p2, created_at desc);
create index if not exists cc_profiles_points_idx on public.cc_profiles (rank_points desc);

alter table public.cc_profiles enable row level security;
alter table public.cc_matches enable row level security;

-- Policies -------------------------------------------------------------------------------------
drop policy if exists cc_profiles_read on public.cc_profiles;
drop policy if exists cc_profiles_insert on public.cc_profiles;
drop policy if exists cc_profiles_update on public.cc_profiles;
drop policy if exists cc_matches_read on public.cc_matches;

create policy cc_profiles_read on public.cc_profiles for select using (true);
create policy cc_profiles_insert on public.cc_profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy cc_profiles_update on public.cc_profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy cc_matches_read on public.cc_matches for select to authenticated
  using ((select auth.uid()) = p1 or (select auth.uid()) = p2);
-- No insert/update/delete policies on cc_matches: only service_role (which bypasses RLS) writes.

-- Column-level grants ---------------------------------------------------------------------------
revoke all on public.cc_profiles from anon, authenticated;
grant select on public.cc_profiles to anon, authenticated;
grant insert (id, display_name) on public.cc_profiles to authenticated;   -- cannot set points/wins on insert
grant update (display_name) on public.cc_profiles to authenticated;       -- cannot edit points/wins later

revoke all on public.cc_matches from anon, authenticated;
grant select on public.cc_matches to authenticated;

-- Leaderboard view (security_invoker: runs with the caller's rights, readable through the public select policy)
drop view if exists public.cc_leaderboard;
create view public.cc_leaderboard with (security_invoker = true) as
  select display_name, rank_points, wins, losses
  from public.cc_profiles
  order by rank_points desc, wins desc, created_at asc
  limit 100;
revoke all on public.cc_leaderboard from anon, authenticated;
grant select on public.cc_leaderboard to anon, authenticated;

-- Match recording (called by the Worker over PostgREST RPC with the service key) ----------------
-- Idempotent per p_match_id: a retried call returns the stored outcome without changing points twice.
create or replace function public.cc_record_match(
  p_match_id uuid,
  p_p1 uuid,
  p_p2 uuid,
  p_winner_side int,            -- 0 = p1 won, 1 = p2 won, null = draw
  p_p1_char text,
  p_p2_char text,
  p_rounds jsonb default '[]'::jsonb,
  p_p1_name text default null,
  p_p2_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k constant numeric := 32;
  r1 int; r2 int;
  e1 numeric;
  s1 numeric;
  d1 int; d2 int;
  v_winner uuid;
  n1 text; n2 text;
begin
  if p_match_id is null or p_p1 is null or p_p2 is null or p_p1 = p_p2 then
    raise exception 'cc_record_match: invalid players';
  end if;
  if p_winner_side is not null and p_winner_side not in (0, 1) then
    raise exception 'cc_record_match: invalid winner side';
  end if;

  -- Create missing profiles defensively (name sanitised to the 3-20 char rule).
  n1 := left(btrim(coalesce(p_p1_name, '')), 20);
  n2 := left(btrim(coalesce(p_p2_name, '')), 20);
  if char_length(n1) < 3 then n1 := 'Player ' || left(p_p1::text, 6); end if;
  if char_length(n2) < 3 then n2 := 'Player ' || left(p_p2::text, 6); end if;
  insert into cc_profiles (id, display_name) values (p_p1, n1) on conflict (id) do nothing;
  insert into cc_profiles (id, display_name) values (p_p2, n2) on conflict (id) do nothing;

  -- Lock both rows in a stable order to avoid deadlocks between concurrent matches.
  perform 1 from cc_profiles where id in (p_p1, p_p2) order by id for update;
  select rank_points into r1 from cc_profiles where id = p_p1;
  select rank_points into r2 from cc_profiles where id = p_p2;

  -- Insert first: a duplicate call (retry) hits the primary key and changes nothing.
  v_winner := case p_winner_side when 0 then p_p1 when 1 then p_p2 else null end;
  insert into cc_matches (id, p1, p2, winner, p1_char, p2_char, rounds)
  values (p_match_id, p_p1, p_p2, v_winner, left(p_p1_char, 32), left(p_p2_char, 32), coalesce(p_rounds, '[]'::jsonb))
  on conflict (id) do nothing;
  if not found then
    return jsonb_build_object('duplicate', true, 'points', jsonb_build_array(r1, r2));
  end if;

  e1 := 1 / (1 + power(10::numeric, (r2 - r1) / 400.0));
  s1 := case p_winner_side when 0 then 1 when 1 then 0 else 0.5 end;
  d1 := round(k * (s1 - e1));
  d2 := -d1;

  update cc_profiles set
    rank_points = greatest(0, rank_points + d1),
    wins = wins + case when p_winner_side = 0 then 1 else 0 end,
    losses = losses + case when p_winner_side = 1 then 1 else 0 end
  where id = p_p1;
  update cc_profiles set
    rank_points = greatest(0, rank_points + d2),
    wins = wins + case when p_winner_side = 1 then 1 else 0 end,
    losses = losses + case when p_winner_side = 0 then 1 else 0 end
  where id = p_p2;

  return jsonb_build_object(
    'points', jsonb_build_array(greatest(0, r1 + d1), greatest(0, r2 + d2)),
    'delta', jsonb_build_array(d1, d2));
end;
$$;

revoke all on function public.cc_record_match(uuid, uuid, uuid, int, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.cc_record_match(uuid, uuid, uuid, int, text, text, jsonb, text, text) to service_role;

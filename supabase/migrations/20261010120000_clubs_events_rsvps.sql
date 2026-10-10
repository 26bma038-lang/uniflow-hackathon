-- UniFlow backend core: clubs, club_members, events, rsvps.
--
-- Access model
--   anon           reads public club details and published events. Nothing else.
--   authenticated  the above, plus their own RSVPs and their own membership rows.
--   club member    additionally reads, writes, and publishes that club's events and
--                  reads RSVP counts (never attendees) through club_rsvp_counts().
--   membership     is only ever written by the service role or SQL editor. No browser
--                  role holds INSERT, UPDATE, or DELETE on club_members.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Public club details. ClubProfile.contact is deliberately not stored here: the app
-- never shows it publicly, so it stays out of a publicly readable table.
create table public.clubs (
  id text primary key
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 80),
  name text not null unique check (btrim(name) <> ''),
  description text not null default '',
  category text not null default '',
  departments text not null default '',
  campus_id text not null default 'demo-campus',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_members (
  club_id text not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index club_members_user_id_idx on public.club_members (user_id);

-- One row per ClubRecord. Ids are text so that both the UUID strings the club workspace
-- generates and the slug ids of the sample items ("campus-open-mic") are valid keys. The
-- pattern is the same one the app accepts in /app/item/:id.
create table public.events (
  id text primary key default gen_random_uuid()::text
    check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  club_id text not null references public.clubs (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'needs_review', 'ready_for_approval', 'published')),
  title text not null default '',
  description text not null default '',
  -- Free text, as typed by the club. campus_category is what students see.
  category text not null default '',
  campus_category text generated always as (
    case lower(btrim(category))
      when 'notice' then 'Notice'
      when 'scholarship' then 'Scholarship'
      when 'deadline' then 'Deadline'
      when 'opportunity' then 'Opportunity'
      else 'Event'
    end
  ) stored,
  start_date date,
  start_time time,
  end_date date,
  end_time time,
  timezone text not null default 'Asia/Kolkata',
  venue text not null default '',
  eligibility text not null default '',
  registration_deadline timestamptz,
  registration_url text not null default ''
    check (registration_url = '' or registration_url ~* '^https?://'),
  source text not null default 'Manual entry'
    check (source in ('Manual entry', 'Sample document', 'Uploaded document')),
  source_name text not null default 'Manual entry',
  department text not null default '',
  review_confirmed boolean not null default false,
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nothing reaches students without a confirmed human review.
  constraint events_published_is_reviewed check (
    status <> 'published'
    or (review_confirmed and reviewed_at is not null and published_at is not null and btrim(title) <> '')
  )
);

create index events_club_id_idx on public.events (club_id);
create index events_published_idx on public.events (published_at desc) where status = 'published';

create table public.rsvps (
  event_id text not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- One RSVP per user per event.
  primary key (event_id, user_id)
);

create index rsvps_user_id_idx on public.rsvps (user_id);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- True when the caller belongs to the club. Runs as the caller, who can only ever see
-- their own membership rows, so it cannot be used to probe anyone else's membership.
create function public.is_club_member(p_club_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_members m
    where m.club_id = p_club_id
      and m.user_id = (select auth.uid())
  );
$$;

-- When registration closes: the registration deadline, or the start of the event when
-- there is none. Null means there is no cutoff. Also selectable as a computed column.
create function public.event_registration_cutoff(e public.events)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(
    e.registration_deadline,
    (e.start_date + coalesce(e.start_time, time '00:00')) at time zone e.timezone
  );
$$;

create function public.clubs_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.events_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Raises on an unknown time zone, so a bad value cannot break the cutoff later.
  perform now() at time zone new.timezone;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    if new.id <> old.id or new.club_id <> old.club_id then
      raise exception 'An event cannot change its id or move to another club.'
        using errcode = '42501';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  -- The publication timestamp is set here, not by the browser. Callers without a user
  -- (seeds, the SQL editor) may supply one to preserve an original date.
  if new.status = 'published' then
    if tg_op = 'UPDATE' and old.status = 'published' then
      new.published_at := old.published_at;
    elsif auth.uid() is not null then
      new.published_at := now();
    else
      new.published_at := coalesce(new.published_at, now());
    end if;
    new.approved_at := coalesce(new.approved_at, new.published_at);
  else
    new.published_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- RSVP rules, enforced for every caller: the event must be published, be an Event, and
-- still be open. Runs as the caller, so an event they may not see reads as not open.
create function public.rsvps_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ev public.events;
  cutoff timestamptz;
begin
  select * into ev from public.events where id = new.event_id;

  if not found or ev.status <> 'published' then
    raise exception 'This event is not open for RSVPs.' using errcode = '23514';
  end if;

  if ev.campus_category <> 'Event' then
    raise exception 'Only events can be joined.' using errcode = '23514';
  end if;

  cutoff := public.event_registration_cutoff(ev);
  if cutoff is not null and now() > cutoff then
    raise exception 'Registration for this event has closed.' using errcode = '23514';
  end if;

  new.joined_at := now();
  return new;
end;
$$;

-- RSVP counts for every event of one club. Returns numbers only: no user ids, no emails.
-- Security definer because members cannot read other people's rsvps rows, so the
-- membership check lives inside the function and every name is schema-qualified.
create function public.club_rsvp_counts(p_club_id text)
returns table (event_id text, rsvp_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.club_members m
    where m.club_id = p_club_id
      and m.user_id = auth.uid()
  ) then
    raise exception 'Only members of this club can read its RSVP counts.'
      using errcode = '42501';
  end if;

  return query
    select e.id, count(r.user_id)
    from public.events e
    left join public.rsvps r on r.event_id = e.id
    where e.club_id = p_club_id
    group by e.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger clubs_before_update
  before update on public.clubs
  for each row execute function public.clubs_before_update();

create trigger events_before_write
  before insert or update on public.events
  for each row execute function public.events_before_write();

create trigger rsvps_before_insert
  before insert on public.rsvps
  for each row execute function public.rsvps_before_insert();

-- ---------------------------------------------------------------------------
-- Privileges. Start from nothing so the result does not depend on project defaults.
-- ---------------------------------------------------------------------------

revoke all on table public.clubs, public.club_members, public.events, public.rsvps
  from public, anon, authenticated;

grant select on table public.clubs to anon, authenticated;
-- The name is the publisher identity students see, so members cannot change it.
grant update (description, category, departments) on table public.clubs to authenticated;

grant select on table public.club_members to authenticated;

grant select on table public.events to anon, authenticated;
grant insert, update, delete on table public.events to authenticated;

grant select, insert, delete on table public.rsvps to authenticated;

revoke all on function public.is_club_member(text) from public, anon, authenticated;
revoke all on function public.event_registration_cutoff(public.events) from public, anon, authenticated;
revoke all on function public.club_rsvp_counts(text) from public, anon, authenticated;
revoke all on function public.clubs_before_update() from public, anon, authenticated;
revoke all on function public.events_before_write() from public, anon, authenticated;
revoke all on function public.rsvps_before_insert() from public, anon, authenticated;

grant execute on function public.is_club_member(text) to authenticated;
grant execute on function public.event_registration_cutoff(public.events) to anon, authenticated;
grant execute on function public.club_rsvp_counts(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;

create policy "Club details are public"
  on public.clubs for select
  to anon, authenticated
  using (true);

create policy "Members edit their club's details"
  on public.clubs for update
  to authenticated
  using (public.is_club_member(id))
  with check (public.is_club_member(id));

-- No insert, update, or delete policy: membership is never written from the browser.
create policy "Users read their own memberships"
  on public.club_members for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Published events are public"
  on public.events for select
  to anon, authenticated
  using (status = 'published');

create policy "Members read their club's events"
  on public.events for select
  to authenticated
  using (public.is_club_member(club_id));

create policy "Members create their club's events"
  on public.events for insert
  to authenticated
  with check (public.is_club_member(club_id));

create policy "Members change their club's events"
  on public.events for update
  to authenticated
  using (public.is_club_member(club_id))
  with check (public.is_club_member(club_id));

create policy "Members delete their club's events"
  on public.events for delete
  to authenticated
  using (public.is_club_member(club_id));

create policy "Users read their own RSVPs"
  on public.rsvps for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users join as themselves"
  on public.rsvps for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users cancel their own RSVPs"
  on public.rsvps for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- The three clubs the app already knows, with the same slugs as demoClubs.
-- ---------------------------------------------------------------------------

insert into public.clubs (id, name, description, category, departments) values
  ('campus-code-collective', 'Campus Code Collective',
   'A student-led group for curious builders and first-time makers.', 'Technology', 'Computer Science, Design'),
  ('student-arts-circle', 'Student Arts Circle', '', '', ''),
  ('creative-circle', 'Creative Circle', '', '', '');

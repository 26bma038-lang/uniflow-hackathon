-- Records imported from public institutional sources (clubs, notices, events), alongside
-- the updates clubs publish themselves.
--
-- What changes
--   clubs   gain a website, the source that establishes them, and the date it was checked.
--   events  may have no club: an imported record names its publisher in publisher_name.
--           They keep the original source link apart from any registration link, a
--           date-only deadline, and the date the source carries.
--   Imported records are written only by the service role or the SQL editor. A browser
--   session can neither create one nor relabel a club's own update as imported, and
--   nobody can RSVP to one: UniFlow does not run those events.
--
-- Nothing existing is rewritten: every new column has a default and no row is updated.

-- ---------------------------------------------------------------------------
-- Clubs
-- ---------------------------------------------------------------------------

alter table public.clubs
  add column website text not null default ''
    check (website = '' or website ~* '^https?://'),
  -- The public page or notice that establishes the club. Empty for the clubs UniFlow ships with.
  add column source_url text not null default ''
    check (source_url = '' or source_url ~* '^https?://'),
  add column source_checked_on date;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

alter table public.events
  alter column club_id drop not null;

alter table public.events
  -- Who published the original, when that is not the club in club_id (a department or
  -- office, for example). Empty for a club's own updates.
  add column publisher_name text not null default '',
  -- The original source. registration_url stays a separate link to sign up or apply.
  add column source_url text not null default ''
    check (source_url = '' or source_url ~* '^https?://'),
  -- A deadline the source gives as a date with no time. registration_deadline is used
  -- only when a time is known, so no cut-off time is ever made up.
  add column deadline_date date,
  -- The date the source document or its listing carries. Null when it shows none.
  add column source_published_on date;

alter table public.events drop constraint if exists events_source_check;
alter table public.events
  add constraint events_source_check
    check (source in ('Manual entry', 'Sample document', 'Uploaded document', 'Imported source'));

alter table public.events
  add constraint events_has_publisher
    check (club_id is not null or btrim(publisher_name) <> ''),
  add constraint events_imported_has_source
    check (source <> 'Imported source' or source_url <> '');

-- ---------------------------------------------------------------------------
-- Functions (replacing the versions from 20261010120000)
-- ---------------------------------------------------------------------------

create or replace function public.events_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Raises on an unknown time zone, so a bad value cannot break the cutoff later.
  perform now() at time zone new.timezone;

  -- Imported records and publisher names come from the service role or the SQL editor
  -- only. A signed-in browser session cannot create one, edit one, or present a club's
  -- own update as imported from someone else.
  if auth.uid() is not null then
    if new.source = 'Imported source' or (tg_op = 'UPDATE' and old.source = 'Imported source') then
      raise exception 'Imported records cannot be created or changed from the app.'
        using errcode = '42501';
    end if;
    new.publisher_name := '';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    if new.id <> old.id or new.club_id is distinct from old.club_id then
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

-- RSVP rules, enforced for every caller: the event must be published by a club through
-- UniFlow, be an Event, and still be open.
create or replace function public.rsvps_before_insert()
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

  if ev.source = 'Imported source' then
    raise exception 'This record was imported from its publisher. UniFlow does not take RSVPs for it.' using errcode = '23514';
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

-- UniFlow personal assignment tracker: one table, private to its owner.
--
-- Access model
--   anon           nothing.
--   authenticated  reads, creates, edits, and deletes their own rows. Nobody else's.
--   There is no shared or club view of assignments, and no function reads across users.
--
-- Matches src/assignments/contracts.ts. The length limits below are the contract's
-- ASSIGNMENT_TITLE_MAX, ASSIGNMENT_COURSE_MAX, and ASSIGNMENT_NOTES_MAX.

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (btrim(title) <> '' and char_length(title) <= 160),
  course text not null default '' check (char_length(course) <= 80),
  notes text not null default '' check (char_length(notes) <= 2000),
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  -- Set by assignments_before_write, never by the browser.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_completed_matches_status check ((status = 'done') = (completed_at is not null))
);

-- The list is always one user's rows, soonest due first.
create index assignments_user_due_idx on public.assignments (user_id, due_at);

-- ---------------------------------------------------------------------------
-- Trigger: ownership, completed_at, and updated_at are decided here
-- ---------------------------------------------------------------------------

create function public.assignments_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- The signed-in user owns the row, whatever was sent. Callers without a user (the
    -- SQL editor, the service role) must name an owner.
    new.user_id := coalesce(auth.uid(), new.user_id);
    new.created_at := now();
    new.completed_at := case when new.status = 'done' then now() end;
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    -- Kept while the row stays done, set when it becomes done, cleared when it is reopened.
    new.completed_at := case
      when new.status <> 'done' then null
      when old.status = 'done' then old.completed_at
      else now()
    end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger assignments_before_write
  before insert or update on public.assignments
  for each row execute function public.assignments_before_write();

-- ---------------------------------------------------------------------------
-- Privileges. Start from nothing so the result does not depend on project defaults.
-- ---------------------------------------------------------------------------

revoke all on table public.assignments from public, anon, authenticated;

grant select, delete on table public.assignments to authenticated;
-- Only the columns a student types. id, user_id, completed_at, and the timestamps are
-- filled in by the database and cannot be sent.
grant insert (title, course, notes, due_at, status) on table public.assignments to authenticated;
grant update (title, course, notes, due_at, status) on table public.assignments to authenticated;

revoke all on function public.assignments_before_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.assignments enable row level security;

create policy "Users read their own assignments"
  on public.assignments for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users create their own assignments"
  on public.assignments for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users change their own assignments"
  on public.assignments for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete their own assignments"
  on public.assignments for delete
  to authenticated
  using (user_id = (select auth.uid()));

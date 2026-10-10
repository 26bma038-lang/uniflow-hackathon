-- Access checks for clubs, club_members, events, and rsvps. Run with `supabase test db`.
-- Everything happens in one transaction that is rolled back.
--
-- Cast: member_a belongs to Campus Code Collective, member_b to Student Arts Circle (so
-- is a nonmember of Campus Code Collective), student belongs to no club, anon has no user.

begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- Start from known rows; seeded sample events would change the counts below.
delete from public.events;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'member_a@nith.ac.in'),
  ('00000000-0000-4000-8000-00000000000b', 'member_b@nith.ac.in'),
  ('00000000-0000-4000-8000-00000000000c', 'student@nith.ac.in');

insert into public.club_members (club_id, user_id) values
  ('campus-code-collective', '00000000-0000-4000-8000-00000000000a'),
  ('student-arts-circle', '00000000-0000-4000-8000-00000000000b');

insert into public.events (id, club_id, status, title, category, start_date, start_time, registration_deadline, review_confirmed, reviewed_at)
values
  -- A UUID id, as the club workspace generates.
  ('a3bb189e-8bf9-4888-9912-ace4e6543002', 'campus-code-collective', 'published', 'Open event', 'Event',
   (now() at time zone 'Asia/Kolkata')::date + 7, '16:00', null, true, now()),
  ('ccc-draft', 'campus-code-collective', 'draft', 'Draft event', 'Event',
   (now() at time zone 'Asia/Kolkata')::date + 7, '16:00', null, false, null),
  ('ccc-deadline-passed', 'campus-code-collective', 'published', 'Deadline passed', 'Event',
   (now() at time zone 'Asia/Kolkata')::date + 7, '16:00', now() - interval '1 hour', true, now()),
  ('ccc-started', 'campus-code-collective', 'published', 'Already started', 'Event',
   (now() at time zone 'Asia/Kolkata')::date - 1, '16:00', null, true, now()),
  ('ccc-opportunity', 'campus-code-collective', 'published', 'Not an event', ' opportunity ',
   (now() at time zone 'Asia/Kolkata')::date + 7, '16:00', null, true, now()),
  -- A slug id, as the sample items use.
  ('sample-open-mic', 'student-arts-circle', 'published', 'Open mic', '',
   (now() at time zone 'Asia/Kolkata')::date + 7, '18:30', null, true, now()),
  ('sac-draft', 'student-arts-circle', 'draft', 'Arts draft', 'Event', null, null, null, false, null);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from pg_class
   where oid in ('public.clubs'::regclass, 'public.club_members'::regclass, 'public.events'::regclass, 'public.rsvps'::regclass)
     and relrowsecurity),
  4::bigint, 'RLS is enabled on all four tables');

select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.club_rsvp_counts(text)'::regprocedure),
  'club_rsvp_counts is security definer with a pinned, empty search_path');

select ok(not has_function_privilege('anon', 'public.club_rsvp_counts(text)', 'execute'), 'anon cannot execute club_rsvp_counts');
select ok(not has_function_privilege('public', 'public.club_rsvp_counts(text)', 'execute'), 'PUBLIC cannot execute club_rsvp_counts');
select ok(not has_table_privilege('authenticated', 'public.club_members', 'insert, update, delete'), 'authenticated holds no write privilege on club_members');
select ok(not has_table_privilege('anon', 'public.club_members', 'select, insert, update, delete'), 'anon holds no privilege on club_members');
select is(
  (select campus_category from public.events where id = 'ccc-opportunity'), 'Opportunity',
  'campus_category normalises the free-text category');
select is(
  (select campus_category from public.events where id = 'sample-open-mic'), 'Event',
  'an uncategorised record is an Event, as in toCampusItem');

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*) from public.events), 5::bigint, 'anon sees the five published events');
select is((select count(*) from public.events where status <> 'published'), 0::bigint, 'anon sees no unpublished event');
select is((select count(*) from public.clubs), 3::bigint, 'anon reads the three clubs');
select throws_ok($$ select * from public.club_members $$, '42501', null, 'anon cannot read memberships');
select throws_ok($$ select * from public.rsvps $$, '42501', null, 'anon cannot read RSVPs');
select throws_ok($$ insert into public.rsvps (event_id) values ('a3bb189e-8bf9-4888-9912-ace4e6543002') $$, '42501', null, 'anon cannot join');
select throws_ok($$ insert into public.events (club_id, title) values ('campus-code-collective', 'x') $$, '42501', null, 'anon cannot create events');
select throws_ok($$ update public.events set title = 'x' $$, '42501', null, 'anon cannot change events');
select throws_ok($$ update public.clubs set description = 'x' $$, '42501', null, 'anon cannot change clubs');
select throws_ok($$ select * from public.club_rsvp_counts('campus-code-collective') $$, '42501', null, 'anon cannot read RSVP counts');

-- ---------------------------------------------------------------------------
-- Student (signed in, member of no club)
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-00000000000c"}';

select is((select count(*) from public.events), 5::bigint, 'student sees only published events');
select lives_ok($$ insert into public.rsvps (event_id) values ('a3bb189e-8bf9-4888-9912-ace4e6543002') $$, 'student joins an open event with a UUID id');
select throws_ok($$ insert into public.rsvps (event_id) values ('a3bb189e-8bf9-4888-9912-ace4e6543002') $$, '23505', null, 'student cannot join the same event twice');
select lives_ok($$ insert into public.rsvps (event_id) values ('sample-open-mic') $$, 'student joins an open event with a slug id');
select throws_ok($$ insert into public.rsvps (event_id) values ('ccc-draft') $$, '23514', null, 'student cannot join an unpublished event');
select throws_ok($$ insert into public.rsvps (event_id) values ('no-such-event') $$, '23514', null, 'a missing event reads the same as an unpublished one');
select throws_ok($$ insert into public.rsvps (event_id) values ('ccc-deadline-passed') $$, '23514', 'Registration for this event has closed.', 'student cannot join after the registration deadline');
select throws_ok($$ insert into public.rsvps (event_id) values ('ccc-started') $$, '23514', 'Registration for this event has closed.', 'student cannot join once an event with no deadline has started');
select throws_ok($$ insert into public.rsvps (event_id) values ('ccc-opportunity') $$, '23514', 'Only events can be joined.', 'student cannot join something that is not an event');
select throws_ok(
  $$ insert into public.rsvps (event_id, user_id) values ('sample-open-mic', '00000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'student cannot join on behalf of someone else');
select throws_ok(
  $$ insert into public.club_members (club_id, user_id) values ('campus-code-collective', '00000000-0000-4000-8000-00000000000c') $$,
  '42501', null, 'student cannot make themselves a club member');
select is((select count(*) from public.club_members), 0::bigint, 'student sees no membership rows');
select throws_ok(
  $$ insert into public.events (club_id, title, status, review_confirmed, reviewed_at) values ('campus-code-collective', 'Fake', 'published', true, now()) $$,
  '42501', null, 'student cannot publish for a club');
select throws_ok($$ select * from public.club_rsvp_counts('campus-code-collective') $$, '42501', null, 'student cannot read RSVP counts');

update public.events set title = 'Hacked' where id = 'a3bb189e-8bf9-4888-9912-ace4e6543002';
select is((select title from public.events where id = 'a3bb189e-8bf9-4888-9912-ace4e6543002'), 'Open event', 'student cannot change an event');
delete from public.events where id = 'a3bb189e-8bf9-4888-9912-ace4e6543002';
select is((select count(*) from public.events where id = 'a3bb189e-8bf9-4888-9912-ace4e6543002'), 1::bigint, 'student cannot delete an event');
update public.clubs set description = 'Hacked' where id = 'campus-code-collective';
select isnt((select description from public.clubs where id = 'campus-code-collective'), 'Hacked', 'student cannot change club details');

-- ---------------------------------------------------------------------------
-- Member of another club (nonmember of Campus Code Collective)
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-00000000000b"}';

select lives_ok($$ insert into public.rsvps (event_id) values ('a3bb189e-8bf9-4888-9912-ace4e6543002') $$, 'a second user joins the same event');
select is((select count(*) from public.rsvps), 1::bigint, 'a user reads only their own RSVPs');
delete from public.rsvps where user_id = '00000000-0000-4000-8000-00000000000c';
select is((select count(*) from public.events where id = 'ccc-draft'), 0::bigint, 'nonmember cannot see another club''s draft');
select is((select count(*) from public.events where id = 'sac-draft'), 1::bigint, 'member sees their own club''s draft');
select throws_ok($$ insert into public.events (club_id, title) values ('campus-code-collective', 'x') $$, '42501', null, 'nonmember cannot create an event for another club');
update public.events set title = 'Hacked' where club_id = 'campus-code-collective';
select is((select count(*) from public.events where title = 'Hacked'), 0::bigint, 'nonmember cannot change another club''s events');
select throws_ok($$ select * from public.club_rsvp_counts('campus-code-collective') $$, '42501', null, 'nonmember cannot read another club''s RSVP counts');
select results_eq(
  $$ select event_id, rsvp_count from public.club_rsvp_counts('student-arts-circle') order by event_id $$,
  $$ values ('sac-draft', 0::bigint), ('sample-open-mic', 1::bigint) $$,
  'member reads counts for their own club');

-- ---------------------------------------------------------------------------
-- Student again: other users could not touch their RSVPs; they can cancel their own
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-00000000000c"}';

select is((select count(*) from public.rsvps), 2::bigint, 'another user''s delete left the student''s RSVPs in place');
delete from public.rsvps where event_id = 'sample-open-mic';
select is((select count(*) from public.rsvps), 1::bigint, 'student cancels their own RSVP');

-- ---------------------------------------------------------------------------
-- Member of Campus Code Collective
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-00000000000a"}';

select ok(public.is_club_member('campus-code-collective'), 'member is recognised as a member');
select ok(not public.is_club_member('student-arts-circle'), 'member is not a member of another club');
select is((select count(*) from public.events where club_id = 'campus-code-collective'), 5::bigint, 'member sees every event of their club, drafts included');
select is((select count(*) from public.rsvps), 0::bigint, 'member cannot read attendee rows');
select results_eq(
  $$ select event_id, rsvp_count from public.club_rsvp_counts('campus-code-collective') order by event_id $$,
  $$ values ('a3bb189e-8bf9-4888-9912-ace4e6543002', 2::bigint), ('ccc-deadline-passed', 0::bigint),
            ('ccc-draft', 0::bigint), ('ccc-opportunity', 0::bigint), ('ccc-started', 0::bigint) $$,
  'member reads counts, and only counts, for their club');
select throws_ok($$ select * from public.club_rsvp_counts('student-arts-circle') $$, '42501', null, 'member cannot read another club''s RSVP counts');

select lives_ok(
  $$ insert into public.events (id, club_id, title, created_by) values ('member-draft', 'campus-code-collective', 'Member draft', '00000000-0000-4000-8000-00000000000c') $$,
  'member creates a draft for their club');
select is(
  (select created_by from public.events where id = 'member-draft'), '00000000-0000-4000-8000-00000000000a'::uuid,
  'created_by is the caller, whatever the browser sends');
select throws_ok($$ update public.events set status = 'published' where id = 'member-draft' $$, '23514', null, 'an unreviewed event cannot be published');
select lives_ok(
  $$ update public.events set status = 'published', review_confirmed = true, reviewed_at = now(), published_at = '2020-01-01' where id = 'member-draft' $$,
  'member publishes a reviewed event');
select is((select published_at from public.events where id = 'member-draft'), now(), 'published_at is set by the database, not the browser');
select throws_ok($$ update public.events set club_id = 'student-arts-circle' where id = 'member-draft' $$, '42501', null, 'an event cannot be moved to another club');
select throws_ok($$ insert into public.events (club_id, title) values ('student-arts-circle', 'x') $$, '42501', null, 'member cannot create an event for another club');
update public.events set title = 'Hacked' where club_id = 'student-arts-circle';
select is((select count(*) from public.events where title = 'Hacked'), 0::bigint, 'member cannot change another club''s events');
select throws_ok(
  $$ insert into public.club_members (club_id, user_id) values ('student-arts-circle', '00000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'member cannot add themselves to another club');
select throws_ok($$ insert into public.events (club_id, title, timezone) values ('campus-code-collective', 'x', 'Mars/Phobos') $$, '22023', null, 'an unknown time zone is rejected');
select throws_ok($$ insert into public.events (club_id, title, registration_url) values ('campus-code-collective', 'x', 'javascript:alert(1)') $$, '23514', null, 'a non-http registration link is rejected');
select lives_ok($$ update public.clubs set description = 'Updated by a member' where id = 'campus-code-collective' $$, 'member edits their club''s details');
select is((select description from public.clubs where id = 'campus-code-collective'), 'Updated by a member', 'the club edit is stored');
select throws_ok($$ update public.clubs set name = 'Official Administration' where id = 'campus-code-collective' $$, '42501', null, 'member cannot rename the club');
update public.clubs set description = 'Hacked' where id = 'student-arts-circle';
select is((select description from public.clubs where id = 'student-arts-circle'), '', 'member cannot edit another club''s details');
select lives_ok($$ delete from public.events where id = 'a3bb189e-8bf9-4888-9912-ace4e6543002' $$, 'member deletes their club''s event');

reset role;
select is(
  (select count(*) from public.rsvps where event_id = 'a3bb189e-8bf9-4888-9912-ace4e6543002'), 0::bigint,
  'deleting an event removes its RSVPs');

select * from finish();

rollback;

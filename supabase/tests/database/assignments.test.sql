-- Access checks for public.assignments. Run with `supabase test db`.
-- Everything happens in one transaction that is rolled back.
--
-- Cast: alice and bob are signed-in students; anon has no user.

begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'alice@nith.ac.in'),
  ('00000000-0000-4000-8000-0000000000b2', 'bob@nith.ac.in');

-- Rows written without a user (as the SQL editor would) must name their owner.
insert into public.assignments (id, user_id, title, course, due_at, status) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'Alice lab report', 'PH-101', now() + interval '3 days', 'todo'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'Alice essay', '', null, 'done'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2', 'Bob problem set', 'MA-201', now() + interval '1 day', 'in_progress');

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select ok((select relrowsecurity from pg_class where oid = 'public.assignments'::regclass), 'RLS is enabled on assignments');
select ok(not has_table_privilege('anon', 'public.assignments', 'select, insert, update, delete'), 'anon holds no privilege on assignments');
select ok(not has_table_privilege('public', 'public.assignments', 'select, insert, update, delete'), 'PUBLIC holds no privilege on assignments');
select ok(has_table_privilege('authenticated', 'public.assignments', 'select'), 'authenticated may select');
select ok(has_table_privilege('authenticated', 'public.assignments', 'delete'), 'authenticated may delete');
select ok(has_column_privilege('authenticated', 'public.assignments', 'title', 'insert'), 'authenticated may insert a title');
select ok(has_column_privilege('authenticated', 'public.assignments', 'status', 'update'), 'authenticated may update status');
select ok(not has_column_privilege('authenticated', 'public.assignments', 'user_id', 'insert'), 'authenticated cannot send user_id on insert');
select ok(not has_column_privilege('authenticated', 'public.assignments', 'user_id', 'update'), 'authenticated cannot update user_id');
select ok(not has_column_privilege('authenticated', 'public.assignments', 'completed_at', 'update'), 'authenticated cannot update completed_at');
select ok(not has_column_privilege('authenticated', 'public.assignments', 'completed_at', 'insert'), 'authenticated cannot send completed_at on insert');
select ok(not has_function_privilege('authenticated', 'public.assignments_before_write()', 'execute'), 'authenticated cannot call the trigger function');
select ok(
  (select proconfig @> array['search_path=""'] and not prosecdef from pg_proc where oid = 'public.assignments_before_write()'::regprocedure),
  'the trigger function is security invoker with a pinned, empty search_path');
select is(
  (select completed_at is not null from public.assignments where id = '10000000-0000-4000-8000-000000000002'), true,
  'a row inserted as done gets completed_at');
select is(
  (select completed_at from public.assignments where id = '10000000-0000-4000-8000-000000000001'), null,
  'a row inserted as todo has no completed_at');

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$ select * from public.assignments $$, '42501', null, 'anon cannot read assignments');
select throws_ok($$ insert into public.assignments (title) values ('x') $$, '42501', null, 'anon cannot create assignments');
select throws_ok($$ update public.assignments set title = 'x' $$, '42501', null, 'anon cannot change assignments');
select throws_ok($$ delete from public.assignments $$, '42501', null, 'anon cannot delete assignments');

-- ---------------------------------------------------------------------------
-- Alice
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000a1"}';

select is((select count(*) from public.assignments), 2::bigint, 'alice sees only her two assignments');
select is((select count(*) from public.assignments where user_id <> '00000000-0000-4000-8000-0000000000a1'), 0::bigint, 'alice sees nobody else''s rows');

select results_eq(
  $$ select title from public.assignments order by due_at asc nulls last, created_at asc $$,
  $$ values ('Alice lab report'), ('Alice essay') $$,
  'soonest due first, no due date last');

select lives_ok(
  $$ insert into public.assignments (title, course, notes, due_at, status) values ('Alice new task', 'CS-102', 'Chapter 4', now() + interval '2 days', 'todo') $$,
  'alice creates an assignment');
select is(
  (select user_id from public.assignments where title = 'Alice new task'), '00000000-0000-4000-8000-0000000000a1'::uuid,
  'the owner is the signed-in user');
select is((select status from public.assignments where title = 'Alice new task'), 'todo', 'status is stored');
select is((select completed_at from public.assignments where title = 'Alice new task'), null, 'a new todo has no completed_at');
select lives_ok($$ insert into public.assignments (title) values ('Defaults only') $$, 'only a title is required');
select is(
  (select row(course, notes, due_at, status)::text from public.assignments where title = 'Defaults only'), '("","",,todo)',
  'course and notes default to empty, due_at to null, status to todo');

select throws_ok(
  $$ insert into public.assignments (title, user_id) values ('For bob', '00000000-0000-4000-8000-0000000000b2') $$,
  '42501', null, 'alice cannot create an assignment for someone else');
select throws_ok(
  $$ insert into public.assignments (title, completed_at) values ('Backdated', '2020-01-01') $$,
  '42501', null, 'alice cannot send completed_at');
select throws_ok($$ insert into public.assignments (title) values ('   ') $$, '23514', null, 'a blank title is rejected');
select throws_ok($$ insert into public.assignments (title) values (repeat('t', 161)) $$, '23514', null, 'a title over 160 characters is rejected');
select lives_ok($$ insert into public.assignments (title) values (repeat('t', 160)) $$, 'a title of exactly 160 characters is accepted');
select throws_ok($$ insert into public.assignments (title, course) values ('x', repeat('c', 81)) $$, '23514', null, 'a course over 80 characters is rejected');
select throws_ok($$ insert into public.assignments (title, notes) values ('x', repeat('n', 2001)) $$, '23514', null, 'notes over 2000 characters are rejected');
select throws_ok($$ insert into public.assignments (title, status) values ('x', 'archived') $$, '23514', null, 'an unknown status is rejected');

-- completed_at follows status.
select lives_ok($$ update public.assignments set status = 'done' where title = 'Alice new task' $$, 'alice marks an assignment done');
select is((select completed_at from public.assignments where title = 'Alice new task'), now(), 'completed_at is set when status becomes done');
select lives_ok($$ update public.assignments set notes = 'Edited after finishing' where title = 'Alice new task' $$, 'alice edits a done assignment');
select isnt((select completed_at from public.assignments where title = 'Alice new task'), null, 'completed_at is kept while the row stays done');
select lives_ok($$ update public.assignments set status = 'in_progress' where title = 'Alice new task' $$, 'alice reopens an assignment');
select is((select completed_at from public.assignments where title = 'Alice new task'), null, 'completed_at is cleared when the row is reopened');
select is((select updated_at from public.assignments where title = 'Alice new task'), now(), 'updated_at is set on every change');
select throws_ok(
  $$ update public.assignments set completed_at = '2020-01-01' where title = 'Alice new task' $$,
  '42501', null, 'alice cannot write completed_at');
select throws_ok(
  $$ update public.assignments set user_id = '00000000-0000-4000-8000-0000000000b2' where title = 'Alice new task' $$,
  '42501', null, 'alice cannot give a row to someone else');
select throws_ok($$ update public.assignments set title = '' where title = 'Alice new task' $$, '23514', null, 'a title cannot be blanked');

-- Bob's rows are out of reach.
update public.assignments set title = 'Hacked' where id = '20000000-0000-4000-8000-000000000001';
delete from public.assignments where id = '20000000-0000-4000-8000-000000000001';

select lives_ok($$ delete from public.assignments where title = 'Defaults only' $$, 'alice deletes her own assignment');
select is((select count(*) from public.assignments where title = 'Defaults only'), 0::bigint, 'the deleted assignment is gone');

-- ---------------------------------------------------------------------------
-- Bob
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000b2"}';

select is((select count(*) from public.assignments), 1::bigint, 'bob sees only his own assignment');
select is(
  (select title from public.assignments where id = '20000000-0000-4000-8000-000000000001'), 'Bob problem set',
  'alice could neither change nor delete bob''s assignment');
select is((select count(*) from public.assignments where title like 'Alice%'), 0::bigint, 'bob cannot read alice''s assignments');

-- ---------------------------------------------------------------------------
-- Cleanup follows the user
-- ---------------------------------------------------------------------------

reset role;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
select is(
  (select count(*) from public.assignments where user_id = '00000000-0000-4000-8000-0000000000a1'), 0::bigint,
  'deleting a user removes their assignments');
select is((select count(*) from public.assignments), 1::bigint, 'other users'' assignments are untouched');

select * from finish();

rollback;

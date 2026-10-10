-- Local seed, run by `supabase db reset`. Not part of the migration.
--
-- The two human-reviewed sample items that belong to a club, under the same slug ids as
-- src/student-app/data.ts, so RSVPs to a sample event have a row to point at.
-- "creative-circle-recruitment" is left out: its sample marks it "Needs review", and
-- unreviewed rows cannot be published.

insert into public.events (
  id, club_id, status, title, description, category,
  start_date, start_time, end_date, end_time, venue, eligibility, registration_url,
  source, source_name, department, review_confirmed, reviewed_at, approved_at, published_at
) values
  (
    'campus-open-mic', 'student-arts-circle', 'published', 'Campus Open Mic',
    'A prototype student arts event for performers and listeners. Bring a short piece, sign up when you arrive, or come along to discover new campus voices.',
    'Event', '2026-10-22', '18:30', '2026-10-22', '20:30', 'Main Auditorium', 'All students',
    'https://example.com/uniflow-demo/open-mic',
    'Sample document', 'Sample document', 'Student Arts Circle', true,
    '2026-10-08T13:00:00+05:30', '2026-10-08T13:00:00+05:30', '2026-10-08T13:00:00+05:30'
  ),
  (
    'build-first-web-app', 'campus-code-collective', 'published', 'Build Your First Web App',
    'A beginner-friendly evening for students to explore an idea, work with mentors, and leave with a small working web project.',
    'Opportunity', '2026-10-18', '16:00', '2026-10-18', '18:00', 'Innovation Lab', 'All interested students',
    'https://example.com/uniflow-demo/build-night',
    'Sample document', 'Sample document', 'Campus Code Collective', true,
    '2026-10-08T08:30:00+05:30', '2026-10-08T08:30:00+05:30', '2026-10-08T08:30:00+05:30'
  )
on conflict (id) do nothing;

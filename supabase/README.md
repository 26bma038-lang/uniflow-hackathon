# UniFlow Supabase backend

Schema, access rules, and tests for the cross-browser publish → discover → join → count flow.
The React app uses Supabase Auth for sign-in and reads `club_members` to decide club workspace
access (`src/auth/`). Drafts, publications, RSVPs, and RSVP counts go through
`src/club/events-api.ts`. Uploaded poster images, club profile text, and saved items are not stored here.

- `migrations/20261010120000_clubs_events_rsvps.sql` — tables, RLS, functions, the three clubs
- `seed.sql` — two sample events for local resets only
- `tests/database/access.test.sql` — pgTAP checks for anonymous, student, member, and nonmember access

## Commands

```sh
supabase start        # needs Docker
supabase db reset     # apply migrations, then seed.sql
supabase test db      # run the access checks
```

Nothing has been applied to a hosted project. `supabase link` then `supabase db push` does that.

## Who can do what

| | anonymous | signed in | member of the club |
|---|---|---|---|
| Read clubs and published events | yes | yes | yes |
| Read the club's drafts | no | no | yes |
| Create, edit, publish, delete the club's events | no | no | yes |
| Join an event, read and cancel own RSVPs | no | yes | yes |
| Read other people's RSVPs | no | no | no |
| Read RSVP counts for the club | no | no | yes, via `club_rsvp_counts(club_id)` |

An RSVP is accepted only when the event is published, its `campus_category` is `Event`, and
`now()` is not past `registration_deadline` (or the event start when there is no deadline).
The free-text `eligibility` field is shown to students but is not machine-checked.

## Adding a club member

Membership cannot be written from the browser. Add it from the SQL editor or with the service
role key, never in frontend code:

```sql
insert into public.club_members (club_id, user_id)
select 'campus-code-collective', id from auth.users where email = 'organizer@nith.ac.in';
```

## Mapping from the app's types

| App | Database |
|---|---|
| `ClubRecord.id`, `CampusItem.id` | `events.id` (text: UUID strings and sample slugs both fit) |
| `status: "published_demo"` | `status = 'published'`; the other three values are unchanged |
| `publisher`, `publisherCampusId` | `clubs.name`, `clubs.campus_id` through `club_id` |
| `startDate`, `startTime`, `endDate`, `endTime`, `timezone` | same names in snake_case (`date`, `time`, `text`) |
| `registrationDeadline` | `registration_deadline` (`timestamptz`; send an offset) |
| `registrationUrl` → `CampusItem.sourceUrl` | `registration_url` (empty or `http(s)://`) |
| `CampusItem.category` | `campus_category` (generated from `category`) |
| `reviewedAt` → `lastVerifiedAt`, `approvedAt`, `publishedAt` | `reviewed_at`, `approved_at`, `published_at` (the last is set by the database) |
| `CampusItem.deadline ?? startDate` | `event_registration_cutoff` computed column |
| `ClubProfile.contact` | not stored; `clubs` is publicly readable |
| `JoinedEvent.email` | `rsvps.user_id` (the signed-in user; no email column) |

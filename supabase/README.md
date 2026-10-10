# UniFlow Supabase backend

Schema, access rules, Edge Functions, and tests. The React app uses Supabase Auth for sign-in
and reads `club_members` to decide club workspace access (`src/auth/`). Drafts, publications,
RSVPs, and RSVP counts go through `src/club/events-api.ts`; a student's own assignments go
through `src/assignments/api.ts`; the two AI features go through `src/ai/api.ts`. Uploaded
poster images, club profile text, and saved items are not stored here.

- `migrations/20261010120000_clubs_events_rsvps.sql` — clubs, members, events, RSVPs, RLS, the three clubs
- `migrations/20261010140000_assignments.sql` — the private per-student assignment tracker
- `functions/extract-poster/` — poster image → event draft fields for a human to review
- `functions/discover/` — a student's question → an answer that cites published records
- `functions/_shared/` — contract types, validation, the model call; `functions/tests/` — their unit tests
- `seed.sql` — two sample events for local resets only
- `tests/database/*.test.sql` — pgTAP checks for access to events, RSVPs, and assignments

## Commands

```sh
supabase start        # needs Docker
supabase db reset     # apply migrations, then seed.sql
supabase test db      # run the pgTAP access checks

# Unit tests for the functions' validation and model-call code. No network, no Docker.
node --test "supabase/functions/tests/*.test.ts"   # Node 22.18+ (runs .ts directly)
deno test supabase/functions/tests/                # or with Deno
```

## Setting up the hosted project

The first migration is already applied to the hosted project. Everything below is new and
has to be run once by the project owner. Replace `<project-ref>` with the project's ref
(the subdomain of `VITE_SUPABASE_URL`).

### 1. Apply the assignments migration

Either paste the whole of `supabase/migrations/20261010140000_assignments.sql` into the
dashboard's SQL Editor and run it, or use the CLI:

```sh
supabase link --project-ref <project-ref>
supabase migration list        # the first migration must show as applied remotely
supabase db push               # applies only 20261010140000_assignments.sql
```

If the first migration was applied by hand in the SQL Editor, `migration list` shows it as
local only and `db push` would try to run it again. Mark it as applied first:

```sh
supabase migration repair --status applied 20261010120000
```

Until this migration is applied, the assignments screen reports "Assignments haven’t been set
up on the server yet."

### 2. Set the function secrets

The model key lives only in the functions' environment. It is never given a `VITE_` name,
never imported in `src/`, and never logged.

```sh
supabase secrets set GEMINI_API_KEY=your-gemini-api-key --project-ref <project-ref>
```

To keep the key out of shell history, put `GEMINI_API_KEY=...` in a file that git ignores
(`.env*` is ignored) and run `supabase secrets set --env-file <that file> --project-ref <project-ref>`.

| Secret | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | yes | — | Gemini API key from Google AI Studio |
| `GEMMA_MODEL` | no | `gemma-4-26b-a4b-it` | Model id; `gemma-4-31b-it` is the other Gemma 4 id the Gemini API serves |
| `GEMMA_THINKING_LEVEL` | no | `minimal` | `minimal` (thinking off, faster) or `high`; empty leaves the model's default |
| `GEMMA_TIMEOUT_MS` | no | `45000` | How long to wait for the model, 1000–120000 |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided to every function by the platform. No
service-role key is used: both functions query the database as the caller.

### 3. Deploy the functions

```sh
supabase functions deploy extract-poster --project-ref <project-ref> --use-api
supabase functions deploy discover --project-ref <project-ref> --use-api
```

`--use-api` bundles on Supabase's side, so Docker is not needed. `config.toml` sets
`verify_jwt = false` for both because each function validates the caller's session itself
(by asking Supabase Auth) and answers in the app's own error shape.

### 4. Check it

Sign in to the app as a club member, open the club workspace, and extract a poster. From a
terminal, a call without a session must be refused:

```sh
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/discover" \
  -H "Content-Type: application/json" -d '{"query":"what is on this week?"}'
# 401 {"error":{"code":"not_signed_in","message":"Sign in to use this."}}
```

## Who can do what

| | anonymous | signed in | member of the club |
|---|---|---|---|
| Read clubs and published events | yes | yes | yes |
| Read the club's drafts | no | no | yes |
| Create, edit, publish, delete the club's events | no | no | yes |
| Join an event, read and cancel own RSVPs | no | yes | yes |
| Read other people's RSVPs | no | no | no |
| Read RSVP counts for the club | no | no | yes, via `club_rsvp_counts(club_id)` |
| Read and write own assignments | no | yes | yes |
| Read anyone else's assignments | no | no | no |
| Ask a question over published records (`discover`) | no | yes | yes |
| Extract event details from a poster (`extract-poster`) | no | no | yes |

An RSVP is accepted only when the event is published, its `campus_category` is `Event`, and
`now()` is not past `registration_deadline` (or the event start when there is no deadline).
The free-text `eligibility` field is shown to students but is not machine-checked.

## Edge Functions

Both take `POST` with a JSON body and the signed-in user's bearer token, answer `OPTIONS`
for CORS, and return either the response shape from `src/ai/contracts.ts` or
`{ "error": { "code": "<AiErrorCode>", "message": "..." } }`.

| Code | HTTP | When |
|---|---|---|
| `not_signed_in` | 401 | no bearer token, or Supabase Auth rejects it |
| `not_a_member` | 403 | `extract-poster`: the caller is not a member of `clubId` |
| `invalid_request` | 400 | body is not the expected JSON, bad `clubId`, empty or over-long query |
| `invalid_image` | 415 | not PNG/JPEG/WebP, damaged base64, or bytes that don't match the declared type |
| `too_large` | 413 | image over 4 MB (`POSTER_MAX_BYTES`) |
| `rate_limited` | 429 | the Gemini API answered 429 |
| `not_configured` | 503 | `GEMINI_API_KEY` missing or rejected, or `GEMMA_MODEL` malformed |
| `model_unavailable` | 502 | the model call failed or timed out |
| `bad_output` | 502 | the model answered, but not in a shape that passed validation |

`functions/_shared/contracts.ts` is the functions' copy of `src/ai/contracts.ts`, because
functions cannot import from `src/`. A type check at the bottom of `src/ai/api.ts` makes
`npx tsc --noEmit -p .` fail if the two drift apart.

### extract-poster

`{ clubId, image: { mimeType, dataBase64 } }` → `{ values, extractedFields, flags, model }`.

1. Validates the session, then the image: type, base64, size, and the file's leading bytes.
2. Calls `is_club_member(clubId)` as the caller, so RLS decides membership.
3. Sends the image to Gemma with a prompt that asks for each date and time twice: the
   model's reading (`value`) and the poster's own wording (`text`).
4. `_shared/poster.ts` checks every field. The poster's wording wins over the model's reading:
   - a field the poster does not state is left out; nothing is filled in;
   - a value in the wrong format is dropped and flagged;
   - "next Friday" and other relative dates are dropped and flagged;
   - a date with no year keeps its day and month, the server (not the model) picks the next
     occurrence, and the field is flagged;
   - `05/06/2026` is read day-first and flagged as ambiguous;
   - a reading that contradicts the wording is dropped and flagged;
   - a time printed without am/pm, every link, a date in the past, an end before its start,
     and anything the model marked uncertain are flagged.
5. Returns the draft fields. Nothing is stored or published. A club member reviews the draft
   in the form, and the database still refuses to publish an unreviewed event.

`category` is kept only when it is one of Technical, Cultural, Sports, Event, Notice,
Scholarship, Deadline, or Opportunity. `timezone` is returned only when the poster prints IST.

### discover

`{ query }` (at most 300 characters) → `{ answer, sources, model }`.

1. Validates the session and the query.
2. Reads up to 60 of the newest events with `status = 'published'`, as the caller. The
   explicit status filter keeps a club member's own drafts out.
3. Sends only those rows and the question to Gemma, which returns an answer and the ids it
   relied on. Registration links are not sent to the model.
4. Drops any id that was not fetched, builds each source from the database row (never from
   model text), removes links the model wrote unless a cited row holds them, and replaces
   the answer with a fixed "nothing published matches" sentence when no valid source is
   left. With no published events at all, the model is not called.

### Model

Checked on 2026-10-10 against Google's documentation:

- [Gemma on the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) lists
  `gemma-4-26b-a4b-it` and `gemma-4-31b-it`, and shows image input, `systemInstruction`, and
  `thinkingConfig.thinkingLevel` (`minimal` / `high`) on `models/<id>:generateContent`.
- The [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4) gives a 256K-token
  context window for both and lists OCR among its capabilities.
- JSON mode (`responseMimeType`) is not documented for Gemma, so it is not used: the prompt
  asks for JSON and the function parses and validates the text.
- Rate limits are not published per model. They are per project and shown in
  [Google AI Studio](https://aistudio.google.com/rate-limit).

Neither function limits how often one user may call it; the only limit is the Gemini API's.

## Assignments

`public.assignments` holds each student's own coursework list. A signed-in user can read,
create, edit, and delete only their own rows; anonymous callers have no access. The browser
can send only `title`, `course`, `notes`, `due_at`, and `status`. A trigger sets the owner
from the session, sets `completed_at` when `status` becomes `done` and clears it when the
row is reopened, and sets `updated_at` on every change.

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
| `Assignment.dueAt`, `completedAt`, `createdAt`, `updatedAt` | `assignments.due_at`, `completed_at`, `created_at`, `updated_at`; `user_id` is not sent to the browser |
| `DiscoverSource.startDate` | `start_date` + `start_time` in the row's `timezone`, as a UTC date-time |
| `DiscoverSource.deadline`, `sourceUrl` | `registration_deadline`, `registration_url` (null when empty) |

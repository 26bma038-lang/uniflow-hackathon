# UniFlow

A campus information hub for students: one place to discover notices, events, scholarships and deadlines, check where each item came from, and act on it.

UniFlow is an independent student project. It is not an official NIT Hamirpur product, and all campus content in the app is illustrative sample data.

> **Status:** this is a working browser prototype. The interface runs end to end, but every piece of data lives in the visitor's own browser. The Supabase backend exists as a tested migration draft that the app does not use yet, and AI extraction is simulated. See [What works today](#what-works-today).

This repository starts from a snapshot of an earlier prototype. Its history was not carried over; the first commit is that snapshot, not work done on the commit date.

## Problem and users

Campus information is scattered across WhatsApp groups, Instagram, college websites, notice boards, PDFs and portals. Students have to find an item, then work out whether it is current and trustworthy.

- **Students**, initially at NIT Hamirpur, especially first-years who do not yet know where things are posted.
- **Club organizers and campus publishers**, who need a quick way to turn a notice or poster into a structured update.

The loop UniFlow is built around: campus notice or poster → AI extraction → human review → publication → personalized student feed.

## What works today

| Area | State |
|---|---|
| Landing page, role selection, guest Explore | Works |
| Student app: Today & Soon, Discover with search and filters, item detail with source details, Saved, Joined, Profile | Works, on sample data plus everything clubs have published (read from Supabase). RSVPs are stored in Supabase; Saved and Profile stay in the browser |
| Club workspace: drafts, create, review, publish, club profile, RSVP counts | Drafts, publications and RSVP counts are stored in Supabase and shared by the club's members. Club profile text and the activity list stay in the browser |
| Student sign-in | Supabase email and password. Accounts are created by the team; there is no sign-up screen. **Tested live** against the hosted project |
| Club sign-in | Same sign-in, then the account's rows in `club_members` decide which club workspaces open. **Tested live**: a member opens the workspace, a non-member is refused |
| Storage | Supabase for events (drafts and publications), RSVPs and membership. `localStorage` for saved items, interests, club profile text and the activity list |
| AI extraction from a poster | Working, **tested live** with `gemma-4-26b-a4b-it`: a club member's poster image goes to the `extract-poster` Edge Function, the fields fill the editable form, and the update goes through human review before it can be published. "Use sample brief" is still simulated |
| AI discovery (`/app/ask`) | Working, **tested live** with 169Pi's `alpie-32b`. Answers come from published records only, cite the records used and link their original sources. Three questions were checked through the Ask page on 2026-10-10: ChEmference 2026 (29 to 31 October, citing the record and the official page), a scholarship with no stated deadline (said so, invented no date), and a question with no matching record (cited nothing). Answers took 8 to 23 seconds |
| Assignments (`/app/assignments`) | Working, **tested live**: create, list, mark done, delete. A private per-student coursework list |
| Supabase database | Connected: Auth, `club_members`, `events`, `rsvps`, `assignments` and `club_rsvp_counts()`. `seed.sql` is not applied, so the sample records are not in the database and cannot be joined |
| Imported campus data | **Live.** 9 NIT Hamirpur clubs and 5 updates imported from official public sources, labelled "Imported from …" with their source links. See [Imported campus data](#imported-campus-data) |
| AI models | Called only from the Edge Functions in `supabase/functions/`. Poster extraction uses Gemma (`gemma-4-26b-a4b-it`, `GEMINI_API_KEY`). Ask uses 169Pi's Alpie (`alpie-32b`, `ALPIE_API_KEY`). There is no model selector and no fallback from one to the other; see `supabase/README.md` |

## Flows

### Student

1. Open the landing page and choose **Get started**, or browse `/explore` without an account.
2. Sign in with the email and password you were given, then pick interests (`/login/student`).
3. **Today & Soon** (`/app/today`) and **Discover** (`/app/discover`) list items, ordered by the chosen interests.
4. Open an item (`/app/item/:id`) to see publisher, source, dates and review status.
5. Save it, or join it if it is an event whose registration is still open. Saved and joined items appear under `/app/saved` and `/app/joined`.

### Club

1. Choose the club role and pick one of the three sample clubs (`/login/club`).
2. Create an update (`/club/create`) manually, from the sample brief, or with an uploaded image as the source document.
3. Check every field on the review screen (`/club/review/:id`) and confirm the human review.
4. Publish. The item appears in the student app and Explore for everyone, in any browser.
5. The overview and published pages show how many students joined each event. Counts only; no attendee details.

## Architecture

**Now**

- React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion.
- Single-page app with hand-rolled routing on `window.location.pathname` in `src/App.tsx`.
- `src/entry/` access pages and Explore, `src/student-app/` student app, `src/club/` club workspace and publishing logic, `src/auth/` Supabase client and session, `src/demo-session.ts` the return-to-item destination.
- Events and RSVPs go through `src/club/events-api.ts`; the rest of the state is in `localStorage` under `uniflow-*` keys.

**Planned, not built**

- A live check of RSVPs and club RSVP counts with real accounts.

## Repository layout

| Path | Contents |
|---|---|
| `src/` | The app: `App.tsx` (landing page and routing), `entry/`, `student-app/`, `club/`, `components/` |
| `src/imports/` | Logo and reference images from the original design import |
| `supabase/` | Migration draft, seed and access tests (not connected to the app) |
| `PRODUCT.md`, `DESIGN.md` | Product brief and design system notes |
| `screenshots/`, `uniflow-phase-1-3-desktop.png` | Screenshots taken while building and checking the UI |
| `scratch_pw/`, `.playwright-mcp/` | Playwright scripts and page snapshots from manual browser checks |
| `.recovery/` | Copies of key files saved before each milestone |
| `.figma/`, `.impeccable/`, `.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md` | Figma Make and AI-assistant tooling configuration |

Images are stored with Git LFS (see `.gitattributes`). Install [Git LFS](https://git-lfs.com) before cloning, or the logo and screenshots arrive as pointer files.

## Local setup

Requires Node.js 22 or newer.

```sh
npm install
npm run dev      # http://localhost:8443
npm run build    # production build in dist/
```

The dev server uses port 8443 and fails if it is taken; set `PORT` to change it. A `pnpm-lock.yaml` is also kept because the Figma Make scripts in `.figma/make/` install with pnpm.

## Environment variables

Copy `.env.example` to `.env.local`. The browser reads the two `VITE_` values; without them the public pages still work and sign-in reports that it is not set up.

| Name | Used by | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | Publishable key (`sb_publishable_…`); safe to ship only because RLS is enabled |
| `SUPABASE_SECRET_KEY` | admin scripts only | Secret key (`sb_secret_…`). Not read by the app. Never prefix with `VITE_`, never ship to the browser |
| `GEMINI_API_KEY` | Edge Function secret only | Poster extraction. Set with `supabase secrets set`, not in `.env.local`. Never prefix with `VITE_` |
| `ALPIE_API_KEY` | Edge Function secret only | Ask. Same rules as above |
| `PORT` | Vite | Optional, defaults to 8443 |

## Database

`supabase/` holds a migration draft for four tables: `clubs`, `club_members`, `events`, `rsvps`. Details, the access table and the field mapping are in [`supabase/README.md`](supabase/README.md).

```sh
supabase start      # needs Docker
supabase db reset   # apply the migration, then seed.sql
supabase test db    # run the access checks
```

- The migration has **not** been applied to a hosted project and has not been run through the Supabase CLI. It was checked in an in-process Postgres (PGlite) with a stand-in for Supabase's `auth` schema, where its 68 access checks pass.
- Applying it to a hosted project is `supabase link` followed by `supabase db push`.

### Assigning club accounts

Club membership cannot be granted from the browser. Once Auth is connected, an organizer signs up, and someone with database access assigns them:

```sql
insert into public.club_members (club_id, user_id)
select 'campus-code-collective', id from auth.users where email = 'organizer@nith.ac.in';
```

The club ids are `campus-code-collective`, `student-arts-circle` and `creative-circle`.

## Imported campus data

Real NIT Hamirpur records come from a research pack whose JSON is checked in as `data/nith-import-pack.json` (extracted from the PDF with only line wrapping repaired). `data/nith-import-decisions.json` records what was checked against the live official pages on 2026-10-10 and the wording that is published. UniFlow is independent of NIT Hamirpur: imported records are copies of public information, the publishers do not post here, and nothing implies endorsement.

**What was imported into the hosted project**

| | Count | Notes |
|---|---|---|
| Clubs | 9 of 9 | SPEC, APP TEAM, Student Discipline Club, SHIELD, E-Cell, EBSB, Music Club, Dance Club, Dramatics Club. No memberships were created; no account can edit them |
| Updates | 5 of 6 | ChEmference 2026 (29–31 Oct), its abstract deadline (10 Oct) and registration deadline (15 Oct), the 2026–27 scholarship guidance, and the Student Discipline Club office-bearer notice |
| Left out | 1 | The campus-recruitment invitation, because it is addressed to recruiters, not students |
| Not imported | 4 | The pack's unresolved candidates (E-Summit 2026, a well-being workshop, Hill'ffair 2026, Shiksha Mahakumbh 2026): no directly verified dates |

**Rules the import follows**

- Dates stay as the source gives them. ChEmference has no start or end time and its deadlines have no cut-off time, so none is stored or shown.
- A deadline the source does not give is shown as "Check source", never "Closing soon". Past dates are shown as past and are not offered on Today.
- The original source link is stored separately from any application link (the scholarship has both).
- Images are null in the pack, so none are shown. No logos or posters were added.
- Four of the five notice PDFs are scanned images. Statements the pack takes from inside them (for example the scholarship notice's submission steps) could not be checked and are not published; the record's title, listing date and link are.
- No student names or roll numbers are stored.
- Imported records cannot be created, edited or joined from the app: the app offers no way to, and the migration adds database rules that refuse all three. Those database refusals were not exercised live.

**Running it**

```sh
node scripts/build-nith-import.mjs                                   # regenerate supabase/imports/nith-import.sql
supabase db query --linked -f supabase/imports/nith-import.sql        # or paste the file into the SQL editor
```

It needs the `20261010180000_imported_records.sql` migration, and it only inserts or updates rows with the pack's own ids. Run twice against the hosted project, the counts stayed at 12 clubs and 6 events.

**Checked live on 2026-10-10**, through the site against the hosted project: all 9 clubs appear in the directory after a refresh; ChEmference shows 29 Oct 2026 to 31 Oct 2026, a 15 Oct 2026 registration deadline with no time, and its official source link; the scholarship is not marked closing soon; the imported event cannot be joined; and Ask answered "When is ChEmference 2026?" with the dates and a citation to the record and its official page. How imported records render at phone width, and in a viewer's time zone far from India, was checked with mocked server responses only.

## Human review and source provenance

- A record moves through `draft` → `needs_review` → `ready_for_approval` → published. Editing any field sends it back to review.
- Publishing requires a ticked review checklist and a recorded review time. The migration enforces the same rule in the database.
- Each item keeps its publisher, source document name, document date, publication time and last-verified time, and shows them on the detail page.
- Missing fields stay empty rather than being guessed.
- Sample items are labelled as illustrative, and browser-published items as local demo publications.

## Demo steps

Needs two accounts created in the Supabase project, one of them added to `club_members` (see `supabase/README.md`). The two halves can run in different browsers.

1. `npm run dev`, open `http://localhost:8443`, choose **Get started**.
2. Sign in with the club account and open the workspace.
3. Create an update with **Use sample brief**. Change the category to `Event` if you want students to be able to join it; the sample is an `Opportunity`.
4. Save, open the review screen, confirm the human review, and publish.
5. Sign out, sign in with the student account, and pick interests.
6. Find the published item in Today & Soon or Discover, open it, check the source details, then save and join it.
7. Sign back in as the club and open the published page to see the RSVP count.

## Known limitations

- Ask is slow: Alpie took 8 to 23 seconds per answer in the live checks. The page shows "Searching published records." while it waits. If Alpie fails or times out (60 seconds), Ask shows the error; it does not fall back to another model.

- Imported records are a snapshot from 2026-10-10. Nothing re-checks the sources, so a date changed by the publisher will not update here.
- AI discovery cites a record's start date only; a multi-day range appears in the answer text and on the record page.

- No real authentication, and no organizer permission check.
- Data is per browser. Clearing site data removes everything.
- Uploaded source images are not stored; they must be reattached after a refresh.
- RSVPs and club RSVP counts have been checked with mocked server responses only. Extraction, human review, publishing to `public.events`, and discovery were each run live once, on one generated poster and one question; nothing broader has been measured.
- Discovery answers can show times as raw UTC timestamps.
- The Edge Functions have no per-user rate limit, and extraction flags are kept only for the browser session.
- All campus content is sample data for 18–25 October 2026. Some filters use those fixed dates.
- The Supabase migration is untested against a real Supabase stack and unused by the app. Sign-in method (and whether anonymous sign-in is allowed) is undecided.
- The club contact field is not part of the database draft.
- The production bundle is a single chunk of about 575 kB; there is no code splitting.
- No automated frontend tests.

## Team

Four members. These are current responsibilities, not a record of finished work.

| Member | Responsibility |
|---|---|
| Sahil | Technical coordination; Supabase backend, Auth, database integration; GitHub setup |
| _Name to be added_ | React frontend and UI |
| _Name to be added_ | Campus data research and verification, testing, documentation, demo presentation |
| _Name to be added_ | Campus data research and verification, testing, documentation, demo presentation |

_Individual contributions to be added by the team._

Parts of the code and this documentation were written with AI coding assistants.

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
| Student app: Today & Soon, Discover with search and filters, item detail with source details, Saved, Joined, Profile | Works, on sample data plus anything published in the same browser |
| Club workspace: drafts, create, review, publish, club profile, RSVP counts | Works, stored in the same browser only |
| Student sign-in | **Demo only.** The email is format-checked for `@nith.ac.in`; nothing verifies it belongs to the visitor |
| Club sign-in | **Demo only.** Anyone can pick any of the three sample clubs |
| Storage | **Demo only.** `localStorage`; nothing is shared between browsers or devices |
| AI extraction from a poster | **Simulated.** The review screen shows preset sample values; no model is called |
| Supabase database | **Not connected.** A migration and access tests are in `supabase/`, checked locally, not applied to any project |
| Gemma via the Gemini API | **Not implemented.** No API call exists in the code |

## Flows

### Student

1. Open the landing page and choose **Get started**, or browse `/explore` without an account.
2. Enter a `@nith.ac.in` address and pick interests (`/login/student`).
3. **Today & Soon** (`/app/today`) and **Discover** (`/app/discover`) list items, ordered by the chosen interests.
4. Open an item (`/app/item/:id`) to see publisher, source, dates and review status.
5. Save it, or join it if it is an event whose registration is still open. Saved and joined items appear under `/app/saved` and `/app/joined`.

### Club

1. Choose the club role and pick one of the three sample clubs (`/login/club`).
2. Create an update (`/club/create`) manually, from the sample brief, or with an uploaded image as the source document.
3. Check every field on the review screen (`/club/review/:id`) and confirm the human review.
4. Publish. The item appears in the student app and Explore in the same browser.
5. The overview and published pages show how many students joined each event. Counts only; no attendee details.

## Architecture

**Now**

- React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion.
- Single-page app with hand-rolled routing on `window.location.pathname` in `src/App.tsx`.
- `src/entry/` access pages and Explore, `src/student-app/` student app, `src/club/` club workspace and publishing logic, `src/demo-session.ts` the demo session.
- All state is in `localStorage` under `uniflow-*` keys.

**Planned, not built**

- **Supabase** for Auth and Postgres. Published events, club membership and RSVPs move from `localStorage` to the tables in `supabase/migrations/`. Row level security decides who can read and write.
- **Gemma through the Gemini API** for extracting fields from an uploaded notice or poster. The call must run server-side so the API key never reaches the browser, and its output always goes through human review before publication.

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

Copy `.env.example` to `.env.local`. **The app does not read any of these yet**; they are the names the planned integration will use.

| Name | Used by | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Public anon key; safe to ship only because RLS is enabled |
| `SUPABASE_SERVICE_ROLE_KEY` | admin scripts only | Never prefix with `VITE_`, never ship to the browser |
| `GEMINI_API_KEY` | server-side extraction only | Never prefix with `VITE_` |
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

## Human review and source provenance

- A record moves through `draft` → `needs_review` → `ready_for_approval` → published. Editing any field sends it back to review.
- Publishing requires a ticked review checklist and a recorded review time. The migration enforces the same rule in the database.
- Each item keeps its publisher, source document name, document date, publication time and last-verified time, and shows them on the detail page.
- Missing fields stay empty rather than being guessed.
- Sample items are labelled as illustrative, and browser-published items as local demo publications.

## Demo steps

Use one browser throughout; data does not travel between browsers yet.

1. `npm run dev`, open `http://localhost:8443`, choose **Get started**.
2. Enter as a club and open the workspace.
3. Create an update with **Use sample brief**. Change the category to `Event` if you want students to be able to join it; the sample is an `Opportunity`.
4. Save, open the review screen, confirm the human review, and publish.
5. Use **Switch demo role**, enter as a student with a `@nith.ac.in` address, and pick interests.
6. Find the published item in Today & Soon or Discover, open it, check the source details, then save and join it.
7. Switch back to the club and open the published page to see the RSVP count.

## Known limitations

- No real authentication, and no organizer permission check.
- Data is per browser. Clearing site data removes everything.
- Uploaded source images are not stored; they must be reattached after a refresh.
- Extraction is simulated and returns preset values regardless of the image.
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

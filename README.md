# Karaoke Competition

A web app for running the karaoke competition (Solo & Duet), built with Next.js, Supabase and Vercel.

| Page | Who | Login |
| --- | --- | --- |
| `/` Dashboard | Everyone, built for a TV: live leaderboards, "now on stage" spotlight, voting QR, winners podium | No |
| `/vote` Audience vote | Audience during the final | No (one vote per device per category) |
| `/judge` Scoring | Judges | Yes |
| `/admin` Organiser panel | Organiser | Yes |

## How the competition works in the app

1. **Registration** – the organiser adds performers (a duet is one entry with both names), their songs and running order, and creates judge accounts.
2. **1st Round** – the organiser sets the stage to *1st Round*. Each judge scores every performer on the official sheet:

   | Criteria | Points |
   | --- | --- |
   | Vocal Quality – pitch, tone and clarity | 30 |
   | Rhythm & Timing – staying in sync with the music | 20 |
   | Stage Presence – confidence and audience engagement | 20 |
   | Song Interpretation – emotion and expression | 15 |
   | Overall Performance – entertainment value and impact | 15 |
   | **Total** | **100** |

   A performer's round score is the average of the judges' totals. Ties are broken by average vocal quality.
3. **Finalists** – on *Results*, click **Advance top 3** for each category (the count can be changed in Settings; a tie at the cut-off includes everyone tied). Finalists can also be added/removed by hand.
4. **Final Round** – set the stage to *Final Round* (this locks 1st round scores) and enter each finalist's final song, which must be different from their 1st round song. Judges score finalists with the same sheet; open **audience voting** and show the QR code from *Live control*.
   - **Final score = judges' average × 70% + audience points (30).**
   - The finalist with the most votes in a category gets the full 30 audience points; the others get points in proportion to the leader's votes (e.g. half the leader's votes = 15 points).
   - The 70/30 split can be changed in Settings.
5. Close voting, then set the stage to *Completed*. Vote counts appear on the public dashboard once voting is closed. Download a CSV of the results from *Results*.

**Audience voting without login.** Each device gets an anonymous, HttpOnly cookie, and the database allows one vote per cookie per category. Someone who clears their cookies or uses a second phone could vote again. For stricter voting, turn on **Require staff ID to vote** in Settings: each staff ID can then vote only once per category.

**Hide scores.** Turn off *Show scores on public dashboard* to keep results secret until the announcement. The organiser can still see everything.

## TV dashboard

Open `/` in the TV's browser and press **F** (or the Fullscreen button). The cursor and button hide after a few seconds, and the screen is kept awake. The page refreshes every few seconds and changes with the stage:

- **Registration** – "Starting soon" with the line-up.
- **1st Round / Final** – live leaderboards with animated scores and reordering, the final cut line, and a banner when a category gets a new leader.
  - To show a *Now on stage* spotlight, use **Live control → On stage** (or **Next performer ▶**) in the admin panel.
  - The spotlight fills in a dot as each judge submits, and reveals the judges' score once all of them have scored.
- **Final with voting open** – a large QR code and a live count of votes cast.
- **Completed** – winners' podiums with confetti.

## Security

- All rules are enforced in Postgres (`supabase/migrations`), not only in the UI:
  - criteria maximums and one score per judge, performer and round
  - judges can only score the live round, and only finalists in the final
  - judges can only see their own scores
  - final song must differ from the 1st round song
  - one vote per voter per category
- Only aggregates are public, through the `leaderboard()` function. Individual judges' scores and the vote table are never exposed to anonymous users.
- Votes and judge-account creation go through server actions using the service-role key, which never reaches the browser.
- Accounts not created by the organiser, such as public sign-ups, are inactive and have no access.
- Organiser actions are written to `audit_log`.

## Setup

### 1. Supabase

1. Create a Supabase project.
2. Run the files in `supabase/migrations` in order, either in the SQL editor or with `supabase db push`.
3. Under **Authentication → Sign In / Providers**, turn off *Allow new users to sign up*. Judges are created from the admin panel.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3. Create the organiser account

```bash
npm install
npm run create-admin -- organiser@example.com 'a-strong-password' "Najwa Ali"
```

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000, sign in at `/login`, then add performers and judges in `/admin`.

### 5. Deploy to Vercel

Import the repository in Vercel (framework preset: Next.js), add the three environment variables above, and deploy. Then add the Vercel domain to Supabase under **Authentication → URL Configuration → Site URL**.

## Scripts

- `npm run dev` – local dev server
- `npm run build` – production build
- `npm run lint` / `npm run typecheck`
- `npm run create-admin -- <email> <password> "<name>"` – create or promote an organiser

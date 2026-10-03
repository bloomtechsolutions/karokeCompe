# Karaoke Competition

A web app for running the karaoke competition (Solo & Duet), built with Next.js, Supabase and Vercel.

| Page | Who | Login |
| --- | --- | --- |
| `/` Dashboard | Everyone, built for a TV: live leaderboards, "now on stage" spotlight, voting QR, winners podium | No |
| `/vote` Audience vote | Audience during both rounds | No (staff ID; one vote per staff ID and IP per category, per round) |
| `/judge` Scoring | Judges | Yes |
| `/host` Host (MC) cue cards | Host: who's on stage, who's next, what to say, call the next act | Yes (Host account, or organiser) |
| `/admin` Organiser panel | Organiser | Yes |
| `/checkin` Venue check-in | Check-in desk: enters the staff IDs of people at the venue | Yes (Check-in account, or organiser) |

## How the competition works in the app

1. **Registration** – the organiser adds performers (a duet is one entry with both names), their songs and running order, and creates judge accounts.
2. **1st Round** – the organiser sets the stage to *1st Round*. Each judge scores every performer on the official sheet:

   | Criteria | Score |
   | --- | --- |
   | Vocal Quality – pitch, tone and clarity | 0–5 |
   | Rhythm & Timing – staying in sync with the music | 0–5 |
   | Stage Presence – confidence and audience engagement | 0–5 |
   | Song Interpretation – emotion and expression | 0–5 |
   | Overall Performance – entertainment value and impact | 0–5 |
   | **Sheet total** | **25** |

   The judges' average sheet total is converted to **judges' points out of 70** (e.g. an average of 20/25 = 56 points).
   **1st round score = judges' points (70) + audience points (30)**, the same formula as the final. Audience voting opens in each category as soon as its first performer is called to the stage. Performers join the ballot as they go on. Voting stays open until the organiser closes it in *Live control*. Each person gets one vote per category in this round. Ties are broken by average vocal quality.
3. **Finalists** – on *Results* click **Advance top 5** for Solo and **Advance top 3** for Duet. You can change these counts in Settings. A tie at the cut-off includes everyone tied, and finalists can also be added or removed by hand. Then click **🏆 Announce finalists on TV**: the TV shows a *1st Round Results – Going to the Final* screen, and 1st round voting closes. Click **Hide from TV** to go back to the boards.
   - Judges can review and change any of their scores (*Your scores* on the judge page) until the 1st round ends, i.e. when the organiser moves to the Final.
4. **Final Round** – set the stage to *Final Round* (this locks 1st round scores) and enter each finalist's final song, which must be different from their 1st round song. Judges score finalists with the same sheet; open **audience voting** and show the QR code from *Live control*.
   - **Final score = judges' points (70) + audience points (30).**
   - The finalist with the most votes in a category gets the full 30 audience points; the others get points in proportion to the leader's votes (e.g. half the leader's votes = 15 points).
   - The 70/30 split can be changed in Settings.
5. Close voting, then set the stage to *Completed*. Each finalist's vote count updates live on the TV (hidden if "Show scores" is off). Download a CSV of the results from *Results*.

**Audience voting (no login).**
- **Staff ID:** voters enter their staff ID. In the **1st round** each person picks up to **5 solo** and **3 duet** performers (the same as the number of finalists; each pick is one vote for that performer). They can add picks as performers go on stage. In the **final** it's one pick per category.
- **Venue check-in:** only staff IDs entered on the `/checkin` page can vote. In *Admin → Judges*, create an account with the role *Check-in desk*. That person types in (or pastes) the staff IDs of people at the venue, and can see who has voted (not who they voted for). This can be turned off in Settings (*Only checked-in staff can vote*).
- **IP address:** each vote is logged with the voter's IP, and a second vote from the same IP in a category is blocked. Phones on the same Wi-Fi share one public IP, so turn this off in Settings if the audience votes over the venue Wi-Fi.
- **Device:** a second vote from the same browser is also blocked.
- **Changing a vote:** voters can swap **one** of their picks **once** per category per round, from the same phone, while voting is still open. The change and the original choice both appear in *Admin → Votes*.
- **Logging:** every vote and every blocked attempt is listed in *Admin → Votes*.
- **When voting opens:** starting the 1st Round arms voting. Each category opens when its first performer is called to the stage, and closes when the organiser clicks **Close voting** or moves to the Final. The final has a separate vote. Moving to the Final Round arms voting again. Each category then opens by itself once all its finalists have been scored and left the stage. **Next performer** on the last finalist clears the stage.

**Hide scores.** Turn off *Show scores on public dashboard* to keep results secret until the announcement. The organiser can still see everything.

**Host (MC).** In *Admin → Judges*, use **Add judge or host** and pick *Host (MC)*. The host's `/host` page shows ready-to-read scripts for each moment (opening, introducing the next act, after each song, finalists, voting, winners) and a **Call to the stage** button that sets *Now on stage* for the TV and judges.

## TV dashboard

Open `/` in the TV's browser and press **F** (or the Fullscreen button). The cursor and button hide after a few seconds, and the screen is kept awake. The page refreshes every few seconds and changes with the stage:

- **Registration** – "Starting soon" with the line-up.
- **1st Round / Final** – live leaderboards with animated scores and reordering, the final cut line, and a banner when a category gets a new leader.
  - To show a *Now on stage* spotlight, use **Live control → On stage** (or **Next performer ▶**) in the admin panel.
  - The spotlight fills in a dot as each judge submits, and reveals the judges' score once all of them have scored.
- **Final** – only the category being performed or voted on is shown (both at the start and end). With voting open: a large QR code, the total votes cast, and each finalist's live vote count.
- **Completed** – the Solo champion and Duet champion, each with their photo, and confetti.

## Choosing the champions

1. After the last finalist, **close voting**. Each judge's page then shows the final standings (judges' points + audience votes) and they **pick a champion** in each category.
2. In *Admin → Results → Champions* you see each judge's pick, **confirm the champion** of each category (the judges' most-picked finalist is preselected) and **upload their photo** (resized in the browser; duets can have one photo per singer).
3. Move the stage to **Completed**: the TV reveals both champions with their photos. Champions stay hidden from the public until then.

## Security

- All rules are enforced in Postgres (`supabase/migrations`), not only in the UI:
  - criteria maximums and one score per judge, performer and round
  - judges can only score the live round, and only finalists in the final
  - judges can only see their own scores
  - final song must differ from the 1st round song
  - one vote per staff ID, IP address and device per category, only after all the category's finalists have performed
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

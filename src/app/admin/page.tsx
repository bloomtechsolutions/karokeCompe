import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Header, NavLink } from "@/components/Header";
import { FinalBoard } from "@/components/tv/Boards";
import { StageBadge } from "@/components/StageBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { getLeaderboard, getSettings } from "@/lib/data";
import { getVoteLink } from "@/lib/qr";
import { fmt, rankRound1 } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  STAGE_LABEL,
  type Contestant,
  type Profile,
  type Score,
  type Stage,
} from "@/lib/types";
import { logout } from "../login/actions";
import {
  advanceTop,
  clearData,
  createJudge,
  deleteContestant,
  nextOnStage,
  resetJudgePassword,
  saveContestant,
  setJudgeActive,
  setOnStage,
  setStage,
  setVoting,
  toggleFinalist,
  updateSettings,
} from "./actions";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "control", label: "Live control" },
  { id: "results", label: "Results" },
  { id: "contestants", label: "Performers" },
  { id: "judges", label: "Judges" },
  { id: "settings", label: "Settings" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; msg?: string; err?: string }>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "control";

  const supabase = await createClient();
  const [settings, rows, contestantsRes, profilesRes, scoresRes, voteTotalRes] = await Promise.all([
    getSettings(),
    getLeaderboard(),
    supabase.from("contestants").select("*"),
    supabase.from("profiles").select("id, full_name, role, active").order("created_at"),
    supabase.from("scores").select("*"),
    supabase.rpc("vote_total"),
  ]);
  const contestants = ((contestantsRes.data ?? []) as Contestant[]).sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      (a.performance_order ?? 999) - (b.performance_order ?? 999) ||
      a.name.localeCompare(b.name),
  );
  const profiles = (profilesRes.data ?? []) as Profile[];
  const judges = profiles.filter((p) => p.role === "judge");
  const activeJudges = judges.filter((j) => j.active);
  const scores = (scoresRes.data ?? []) as Score[];
  const voteTotal = (voteTotalRes.data as number | null) ?? 0;
  const judgeWeight = Number(settings.judge_weight);

  return (
    <>
      <Header
        eventName={settings.event_name}
        right={
          <>
            <NavLink href="/">Dashboard</NavLink>
            <form action={logout}>
              <button className="rounded-lg px-3 py-2 text-muted hover:bg-panel-2 hover:text-ink">Sign out</button>
            </form>
          </>
        }
      />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Organiser</h1>
            <p className="text-sm text-muted">Signed in as {me.full_name}</p>
          </div>
          <StageBadge stage={settings.stage} />
        </div>

        {sp.msg && <p className="rounded-lg bg-emerald-900/40 px-4 py-2.5 text-sm text-emerald-200">{sp.msg}</p>}
        {sp.err && <p className="rounded-lg bg-red-900/40 px-4 py-2.5 text-sm text-red-200">{sp.err}</p>}

        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/admin?tab=${t.id}`}
              className={`rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
                tab === t.id ? "bg-accent font-semibold text-white" : "text-muted hover:bg-panel-2"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === "control" && (
          <ControlTab
            stage={settings.stage}
            votingOpen={settings.voting_open}
            voteTotal={voteTotal}
            nowPerforming={settings.now_performing}
            contestants={contestants}
            judges={activeJudges}
            scores={scores}
          />
        )}

        {tab === "results" && (
          <div className="space-y-6">
            <AutoRefresh seconds={10} />
            <div className="flex justify-end">
              <a href="/admin/export" className="btn-ghost text-sm">
                Download results (CSV)
              </a>
            </div>
            <h2 className="text-lg font-bold">1st Round</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {CATEGORIES.map((category) => {
                const ranked = rankRound1(rows, category);
                return (
                  <section key={category} className="card">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="font-bold">{CATEGORY_LABEL[category]}</h3>
                      <form action={advanceTop}>
                        <input type="hidden" name="category" value={category} />
                        <SubmitButton className="btn-primary text-sm" pendingText="Selecting…">
                          Advance top {settings.finalists_per_category}
                        </SubmitButton>
                      </form>
                    </div>
                    <ol className="divide-y divide-line/60">
                      {ranked.map((r) => (
                        <li key={r.contestant_id} className="flex items-center gap-3 py-2">
                          <span className="w-6 text-center text-sm font-bold text-muted">{r.rank}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{r.name}</div>
                            <div className="text-xs text-muted">
                              {fmt(r.r1_avg, 2)} avg · vocal {fmt(r.r1_vocal_avg, 1)} · {r.r1_judges}/
                              {activeJudges.length} judges
                            </div>
                          </div>
                          <form action={toggleFinalist}>
                            <input type="hidden" name="id" value={r.contestant_id} />
                            <input type="hidden" name="value" value={String(!r.is_finalist)} />
                            <button
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                r.is_finalist ? "bg-accent text-white" : "border border-line text-muted"
                              }`}
                            >
                              {r.is_finalist ? "Finalist ✓" : "Make finalist"}
                            </button>
                          </form>
                        </li>
                      ))}
                    </ol>
                  </section>
                );
              })}
            </div>
            <h2 className="text-lg font-bold">Final Round</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {CATEGORIES.map((c) => (
                <FinalBoard
                  key={c}
                  category={c}
                  rows={rows}
                  judgeCount={activeJudges.length}
                  judgeWeight={judgeWeight}
                  showScores
                  votingOpen={false}
                  nowPerforming={settings.now_performing}
                />
              ))}
            </div>
            <p className="text-xs text-muted">
              Final score = judges&apos; average × {judgeWeight}% + audience points. The finalist with the most
              votes in a category gets the full {100 - judgeWeight} audience points; others get points in
              proportion to the leader&apos;s votes. Ties are broken by vocal quality.
            </p>
          </div>
        )}

        {tab === "contestants" && <ContestantsTab contestants={contestants} />}

        {tab === "judges" && <JudgesTab judges={judges} scores={scores} contestants={contestants} />}

        {tab === "settings" && (
          <div className="grid gap-4 md:grid-cols-2">
            <form action={updateSettings} className="card space-y-4">
              <h2 className="text-lg font-bold">Competition settings</h2>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Event name</span>
                <input name="event_name" defaultValue={settings.event_name} className="field" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Finalists per category</span>
                  <input
                    name="finalists_per_category"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={settings.finalists_per_category}
                    className="field"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Final: judges weight %</span>
                  <input
                    name="judge_weight"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={judgeWeight}
                    className="field"
                  />
                </label>
              </div>
              <label className="flex items-start gap-3">
                <input type="checkbox" name="show_scores" defaultChecked={settings.show_scores} className="mt-1 h-5 w-5" />
                <span>
                  <span className="block text-sm font-medium">Show scores on public dashboard</span>
                  <span className="block text-xs text-muted">Turn off to keep results secret until the announcement.</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="require_voter_id"
                  defaultChecked={settings.require_voter_id}
                  className="mt-1 h-5 w-5"
                />
                <span>
                  <span className="block text-sm font-medium">Require staff ID to vote</span>
                  <span className="block text-xs text-muted">
                    Stronger one-person-one-vote: each staff ID can vote once per category, on top of the
                    one-vote-per-device check.
                  </span>
                </span>
              </label>
              <SubmitButton>Save settings</SubmitButton>
            </form>

            <form action={clearData} className="card space-y-4 border-red-900/70">
              <h2 className="text-lg font-bold text-red-200">Danger zone</h2>
              <p className="text-sm text-muted">
                Clear data after a rehearsal. This permanently deletes the selected records.
              </p>
              <select name="what" className="field" defaultValue="votes">
                <option value="votes">Audience votes</option>
                <option value="scores">Judge scores</option>
                <option value="all">Scores and votes</option>
              </select>
              <input name="confirm" placeholder="Type RESET to confirm" className="field" autoComplete="off" />
              <SubmitButton className="btn border border-red-700 text-red-200 hover:bg-red-950">Clear data</SubmitButton>
            </form>
          </div>
        )}
      </main>
    </>
  );
}

async function ControlTab({
  stage,
  votingOpen,
  voteTotal,
  nowPerforming,
  contestants,
  judges,
  scores,
}: {
  stage: Stage;
  votingOpen: boolean;
  voteTotal: number;
  nowPerforming: string | null;
  contestants: Contestant[];
  judges: Profile[];
  scores: Score[];
}) {
  const { url: voteUrl, svg: qr } = await getVoteLink();

  const round = stage === "final" ? "final" : "round1";
  const inRound = contestants.filter((c) => round === "round1" || c.is_finalist);
  const queue = [...inRound].sort(
    (a, b) =>
      ((round === "final" ? a.final_order : a.performance_order) ?? 999) -
        ((round === "final" ? b.final_order : b.performance_order) ?? 999) || a.name.localeCompare(b.name),
  );
  const onStageNow = contestants.find((c) => c.id === nowPerforming) ?? null;
  const onStageScored = scores.filter(
    (s) => s.round === round && s.contestant_id === nowPerforming && judges.some((j) => j.id === s.judge_id),
  ).length;
  const expected = inRound.length * judges.length;
  const submitted = scores.filter(
    (s) => s.round === round && inRound.some((c) => c.id === s.contestant_id) && judges.some((j) => j.id === s.judge_id),
  ).length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AutoRefresh seconds={10} />
      {(stage === "round1" || stage === "final") && (
        <section className="card space-y-3 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">On stage</h2>
              <p className="text-sm text-muted">Shown as a spotlight on the TV dashboard and highlighted for judges.</p>
            </div>
            <div className="flex gap-2">
              <form action={nextOnStage}>
                <SubmitButton className="btn-primary" pendingText="…">
                  {onStageNow ? "Next performer ▶" : "Start with first ▶"}
                </SubmitButton>
              </form>
              {onStageNow && (
                <form action={setOnStage}>
                  <input type="hidden" name="id" value="" />
                  <SubmitButton className="btn-ghost" pendingText="…">
                    Clear
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-bg/50 px-4 py-3">
            {onStageNow ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎤</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-bold">{onStageNow.name}</div>
                  <div className="truncate text-sm text-muted">
                    {CATEGORY_LABEL[onStageNow.category]} ·{" "}
                    {(round === "final" ? onStageNow.song_final : onStageNow.song_round1) ?? "Song TBA"}
                  </div>
                </div>
                <div
                  className={`shrink-0 text-right text-sm font-semibold tabular-nums ${
                    onStageScored >= judges.length ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {onStageScored}/{judges.length} judges
                  <div className="text-xs font-normal text-muted">
                    {onStageScored >= judges.length ? "All scored" : "Still scoring"}
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted">Nobody on stage.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {queue.map((c) => (
              <form key={c.id} action={setOnStage}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    c.id === nowPerforming ? "bg-accent font-semibold text-white" : "border border-line text-muted hover:bg-panel-2"
                  }`}
                >
                  {(round === "final" ? c.final_order : c.performance_order) ?? "–"}. {c.name}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Stage</h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(STAGE_LABEL) as Stage[]).map((s) => (
            <form key={s} action={setStage}>
              <input type="hidden" name="stage" value={s} />
              <button
                className={`btn w-full text-sm ${s === stage ? "bg-accent text-white" : "border border-line hover:bg-panel-2"}`}
                disabled={s === stage}
              >
                {STAGE_LABEL[s]}
              </button>
            </form>
          ))}
        </div>
        <p className="text-xs text-muted">
          Judges can only score the round that is currently live. Moving to the Final locks 1st-round scores.
        </p>
        {(stage === "round1" || stage === "final") && (
          <div className="rounded-lg bg-bg/50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Scores submitted ({STAGE_LABEL[stage]})</span>
              <span className="font-semibold tabular-nums">
                {submitted}/{expected}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full bg-accent-2"
                style={{ width: `${expected ? Math.round((submitted / expected) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Audience voting</h2>
          <span className={`text-sm font-semibold ${votingOpen ? "text-emerald-300" : "text-muted"}`}>
            {votingOpen ? "Open" : "Closed"} · {voteTotal} votes
          </span>
        </div>
        <form action={setVoting}>
          <input type="hidden" name="open" value={String(!votingOpen)} />
          <SubmitButton className={votingOpen ? "btn-ghost w-full" : "btn-primary w-full"} disabled={stage !== "final"}>
            {votingOpen ? "Close voting" : "Open voting"}
          </SubmitButton>
        </form>
        {stage !== "final" && <p className="text-xs text-muted">Voting can be opened during the Final Round.</p>}
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 text-bg sm:flex-row">
          <div className="h-[180px] w-[180px] shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="text-center text-sm sm:text-left">
            <div className="font-bold">Scan to vote</div>
            <div className="break-all">{voteUrl}</div>
            <div className="mt-1 text-xs text-zinc-600">Show this on the screen during the final.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContestantFields({ c }: { c?: Contestant }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Name (for duets, both names)</span>
          <input name="name" required defaultValue={c?.name} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Category</span>
          <select name="category" defaultValue={c?.category ?? "solo"} className="field">
            <option value="solo">Solo</option>
            <option value="duet">Duet</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Department</span>
          <input name="department" defaultValue={c?.department ?? ""} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">1st round song</span>
          <input name="song_round1" defaultValue={c?.song_round1 ?? ""} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Final round song</span>
          <input name="song_final" defaultValue={c?.song_final ?? ""} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">1st round order</span>
          <input name="performance_order" type="number" min={1} defaultValue={c?.performance_order ?? ""} className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Final order</span>
          <input name="final_order" type="number" min={1} defaultValue={c?.final_order ?? ""} className="field" />
        </label>
      </div>
    </>
  );
}

function ContestantsTab({ contestants }: { contestants: Contestant[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <form action={saveContestant} className="card h-fit space-y-4">
        <h2 className="text-lg font-bold">Add performer</h2>
        <ContestantFields />
        <SubmitButton className="btn-primary w-full">Add performer</SubmitButton>
      </form>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">
          Performers <span className="text-sm font-normal text-muted">({contestants.length})</span>
        </h2>
        {contestants.length === 0 && <p className="card text-sm text-muted">No performers yet.</p>}
        {contestants.map((c) => (
          <details key={c.id} className="card group">
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel-2 text-xs font-bold">
                {c.performance_order ?? "–"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {c.name}
                  {c.is_finalist && <span className="ml-2 text-xs text-accent-2">Finalist</span>}
                </div>
                <div className="truncate text-xs text-muted">
                  {CATEGORY_LABEL[c.category]} · {c.song_round1 ?? "no song"}
                  {c.song_final ? ` → ${c.song_final}` : ""}
                </div>
              </div>
              <span className="text-xs text-muted group-open:hidden">Edit</span>
            </summary>
            <form action={saveContestant} className="mt-4 space-y-3 border-t border-line/60 pt-4">
              <ContestantFields c={c} />
              <SubmitButton className="btn-primary w-full">Save changes</SubmitButton>
            </form>
            <form action={deleteContestant} className="mt-2">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="name" value={c.name} />
              <SubmitButton className="btn w-full text-sm text-red-300 hover:bg-red-950" pendingText="Removing…">
                Remove performer (deletes their scores)
              </SubmitButton>
            </form>
          </details>
        ))}
      </section>
    </div>
  );
}

function JudgesTab({
  judges,
  scores,
  contestants,
}: {
  judges: Profile[];
  scores: Score[];
  contestants: Contestant[];
}) {
  const byKey = new Map(scores.map((s) => [`${s.judge_id}|${s.contestant_id}|${s.round}`, s.total]));
  const rounds = [
    { round: "round1" as const, label: "1st Round", list: contestants },
    { round: "final" as const, label: "Final", list: contestants.filter((c) => c.is_finalist) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <form action={createJudge} className="card h-fit space-y-4">
          <h2 className="text-lg font-bold">Add judge</h2>
          <input name="full_name" required placeholder="Full name" className="field" />
          <input name="email" type="email" required placeholder="Email (used to sign in)" className="field" />
          <input name="password" type="text" required minLength={8} placeholder="Temporary password (8+ chars)" className="field" autoComplete="off" />
          <SubmitButton className="btn-primary w-full">Create judge account</SubmitButton>
        </form>
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Judges</h2>
          {judges.length === 0 && <p className="card text-sm text-muted">No judges yet.</p>}
          {judges.map((j) => (
            <details key={j.id} className="card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="font-semibold">{j.full_name}</span>
                <span className={`text-xs ${j.active ? "text-emerald-300" : "text-muted"}`}>
                  {j.active ? "Active" : "Inactive"}
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-2 border-t border-line/60 pt-3 sm:flex-row">
                <form action={resetJudgePassword} className="flex flex-1 gap-2">
                  <input type="hidden" name="id" value={j.id} />
                  <input name="password" minLength={8} required placeholder="New password" className="field" autoComplete="off" />
                  <SubmitButton className="btn-ghost text-sm">Set</SubmitButton>
                </form>
                <form action={setJudgeActive}>
                  <input type="hidden" name="id" value={j.id} />
                  <input type="hidden" name="active" value={String(!j.active)} />
                  <SubmitButton className="btn-ghost w-full text-sm">{j.active ? "Deactivate" : "Activate"}</SubmitButton>
                </form>
              </div>
            </details>
          ))}
        </section>
      </div>

      {rounds.map(({ round, label, list }) =>
        list.length === 0 || judges.length === 0 ? null : (
          <section key={round} className="card overflow-x-auto">
            <h2 className="mb-3 text-lg font-bold">Score sheet · {label}</h2>
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Performer</th>
                  {judges.map((j) => (
                    <th key={j.id} className="px-2 py-2 text-right font-medium">
                      {j.full_name.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{c.name}</span>{" "}
                      <span className="text-xs text-muted">{CATEGORY_LABEL[c.category]}</span>
                    </td>
                    {judges.map((j) => {
                      const t = byKey.get(`${j.id}|${c.id}|${round}`);
                      return (
                        <td key={j.id} className={`px-2 py-2 text-right tabular-nums ${t == null ? "text-muted" : ""}`}>
                          {t ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ),
      )}
    </div>
  );
}

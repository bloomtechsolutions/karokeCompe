import { AutoRefresh } from "@/components/AutoRefresh";
import { Header, NavLink } from "@/components/Header";
import { StageBadge } from "@/components/StageBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { requireHost } from "@/lib/auth";
import { getLeaderboard, getSettings } from "@/lib/data";
import { fmt, rankFinal, rankRound1, toJudgePoints } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABEL, finalistsFor, type Category, type LeaderboardRow } from "@/lib/types";
import { nextInLine, round1Candidates, stageVoting } from "@/lib/voting";
import { logout } from "../login/actions";
import { callToStage, clearStage } from "./actions";

export const dynamic = "force-dynamic";

/** A cue card with a line for the host to read out. */
function Script({ children, label = "Say" }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-2xl border-l-4 border-gold bg-gold/10 px-4 py-3">
      <div className="text-[11px] font-bold tracking-[0.25em] text-gold uppercase">🎙 {label}</div>
      <p className="mt-1 text-lg leading-snug sm:text-xl">{children}</p>
    </div>
  );
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "live" | "next" }) {
  return (
    <section
      className={`card space-y-4 ${tone === "live" ? "border-accent-2 ring-2 ring-accent-2/40" : tone === "next" ? "border-gold/60" : ""}`}
    >
      <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

const who = (r: LeaderboardRow) => (r.category === "duet" ? "our next duet" : "our next singer");

export default async function HostPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const me = await requireHost();
  const { err } = await searchParams;
  const supabase = await createClient();
  const [settings, rows, judgeCountRes, voteTotalRes] = await Promise.all([
    getSettings(),
    getLeaderboard(),
    supabase.rpc("judge_count"),
    supabase.rpc("vote_total"),
  ]);
  const judgeCount = (judgeCountRes.data as number | null) ?? 0;
  const voteTotal = (voteTotalRes.data as number | null) ?? 0;
  const judgeWeight = Number(settings.judge_weight);
  const { stage } = settings;
  const live = stage === "round1" || stage === "final";
  const isFinal = stage === "final";

  const songOf = (r: LeaderboardRow) => (isFinal ? r.song_final : r.song_round1);
  const orderOf = (r: LeaderboardRow) => (isFinal ? r.final_order : r.performance_order) ?? 999;
  const judgedCount = (r: LeaderboardRow) => (isFinal ? r.final_judges : r.r1_judges);
  const queue = rows
    .filter((r) => !isFinal || r.is_finalist)
    .sort((a, b) => orderOf(a) - orderOf(b) || a.name.localeCompare(b.name));
  const current = rows.find((r) => r.contestant_id === settings.now_performing) ?? null;
  const upcoming = nextInLine(
    queue,
    (r) => r.contestant_id,
    settings.now_performing ?? settings.last_on_stage,
    (r) => judgedCount(r) > 0,
  );
  const next = upcoming[0] ?? null;
  const onDeck = upcoming.slice(1, 3);
  const done = queue.filter((r) => judgedCount(r) > 0).length;
  const count = (c: Category) => rows.filter((r) => r.category === c).length;

  return (
    <>
      <Header
        eventName={settings.event_name}
        right={
          <>
            {me.role === "admin" && <NavLink href="/admin">Organiser</NavLink>}
            <NavLink href="/">TV</NavLink>
            <form action={logout}>
              <button className="rounded-lg px-3 py-2 text-muted hover:bg-panel-2 hover:text-ink">Sign out</button>
            </form>
          </>
        }
      />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <AutoRefresh seconds={4} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Host</h1>
            <p className="text-sm text-muted">
              {live ? `${done} of ${queue.length} performances done` : "Your running script for the night"}
            </p>
          </div>
          <StageBadge stage={stage} />
        </div>
        {err && <p className="rounded-lg bg-red-900/40 px-4 py-2.5 text-sm text-red-200">{err}</p>}

        {/* ---------------- Before the show ---------------- */}
        {stage === "setup" && (
          <Section title="Opening">
            <Script label="Welcome">
              Good evening everyone, and welcome to the <strong>{settings.event_name}</strong>! Tonight{" "}
              <strong>{count("solo")}</strong> solo singers and <strong>{count("duet")}</strong> duets will take the
              stage.
            </Script>
            <Script label="How it works">
              Our judges score every performance from 0 to 5 on vocal quality, rhythm and timing, stage presence, song
              interpretation and overall performance. That&apos;s worth {judgeWeight} points, and{" "}
              <strong>your vote</strong> is worth the other {100 - judgeWeight} points in both rounds. Scan the QR code on the screen once the performances
              start. The top {settings.finalists_solo} solo singers and top {settings.finalists_duet} duets go through to the final.
            </Script>
            <p className="text-sm text-muted">
              The first performer appears here as soon as the organiser starts the 1st round.
            </p>
          </Section>
        )}

        {/* ---------------- On stage ---------------- */}
        {live && (
          <Section title={current ? "🎤 On stage now" : "Stage is empty"} tone={current ? "live" : undefined}>
            {current ? (
              <>
                <div>
                  <div className="text-sm tracking-widest text-muted uppercase">
                    {CATEGORY_LABEL[current.category]}
                    {current.department ? ` · ${current.department}` : ""}
                  </div>
                  <div className="text-3xl leading-tight font-extrabold">{current.name}</div>
                  {songOf(current) && <div className="text-lg text-muted">♪ {songOf(current)}</div>}
                </div>
                <div className="flex items-center justify-between rounded-xl bg-bg/50 px-4 py-3">
                  <span className="text-sm text-muted">Judges scored</span>
                  <span
                    className={`text-lg font-bold tabular-nums ${judgedCount(current) >= judgeCount ? "text-emerald-300" : "text-amber-300"}`}
                  >
                    {judgedCount(current)}/{judgeCount}
                    {judgedCount(current) >= judgeCount ? " ✓" : ""}
                  </span>
                </div>
                <Script label="After the song">
                  What a performance! Give it up for <strong>{current.name}</strong>! Judges, please enter your scores.
                </Script>
                {judgedCount(current) >= judgeCount && (isFinal ? current.final_avg : current.r1_avg) != null && (
                  <p className="text-sm text-muted">
                    Judges&apos; score:{" "}
                    <strong className="text-gold">
                      {fmt(toJudgePoints(Number(isFinal ? current.final_avg : current.r1_avg), judgeWeight), 1)}
                    </strong>
                    /{judgeWeight}
                  </p>
                )}
                <form action={clearStage}>
                  <SubmitButton className="btn-ghost w-full" pendingText="…">
                    Clear stage (performance finished)
                  </SubmitButton>
                </form>
              </>
            ) : (
              <p className="text-muted">Nobody is on stage. Call the next performer below.</p>
            )}
          </Section>
        )}

        {/* ---------------- Up next ---------------- */}
        {live && next && (
          <Section title="Up next" tone="next">
            <div>
              <div className="text-sm tracking-widest text-muted uppercase">
                {CATEGORY_LABEL[next.category]} · #{orderOf(next) === 999 ? "–" : orderOf(next)}
                {next.department ? ` · ${next.department}` : ""}
              </div>
              <div className="text-3xl leading-tight font-extrabold">{next.name}</div>
              {songOf(next) && <div className="text-lg text-muted">♪ {songOf(next)}</div>}
            </div>
            <Script label="Introduce">
              Ladies and gentlemen, {who(next)}
              {next.department ? (
                <>
                  , from <strong>{next.department}</strong>
                </>
              ) : null}
              , please give a big welcome to <strong>{next.name}</strong>
              {songOf(next) ? (
                <>
                  , singing <strong>“{songOf(next)}”</strong>
                </>
              ) : null}
              !
            </Script>
            <form action={callToStage}>
              <input type="hidden" name="id" value={next.contestant_id} />
              <SubmitButton className="btn-primary w-full py-4 text-lg" pendingText="Calling…">
                🎤 Call {next.name.split(" ")[0]} to the stage
              </SubmitButton>
            </form>
            {onDeck.length > 0 && (
              <div className="rounded-xl bg-bg/40 px-4 py-3">
                <div className="text-[11px] font-bold tracking-[0.25em] text-muted uppercase">On deck, get ready</div>
                <ul className="mt-1 space-y-1">
                  {onDeck.map((r) => (
                    <li key={r.contestant_id} className="flex justify-between gap-3">
                      <span className="font-semibold">{r.name}</span>
                      <span className="shrink-0 text-sm text-muted">{CATEGORY_LABEL[r.category]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* ---------------- End of round 1: finalists ---------------- */}
        {stage === "round1" && !next && !current && queue.length > 0 && (
          <Section title="Round 1 complete: announce the finalists">
            {CATEGORIES.map((c) => {
              const marked = rows.filter((r) => r.category === c && r.is_finalist);
              const top = marked.length
                ? marked
                : rankRound1(rows, c, judgeWeight).filter(
                    (r) => r.rank <= finalistsFor(settings, c) && r.r1_judges > 0,
                  );
              if (top.length === 0) return null;
              return (
                <div key={c} className="space-y-2">
                  <Script label={`${CATEGORY_LABEL[c]} finalists`}>
                    The moment you&apos;ve been waiting for… the {CATEGORY_LABEL[c].toLowerCase()} finalists are:{" "}
                    <strong>{top.map((r) => r.name).join(", ")}</strong>! Congratulations!
                  </Script>
                  {!marked.length && (
                    <p className="text-xs text-amber-300">
                      Based on current judges&apos; scores and votes. The organiser still needs to close voting and
                      confirm the finalists.
                    </p>
                  )}
                </div>
              );
            })}
            <Script label="Break">
              We&apos;ll take a short break while our finalists get ready. Don&apos;t go anywhere: in the final,{" "}
              <strong>you</strong> get to vote again!
            </Script>
          </Section>
        )}

        {/* ---------------- Audience voting (both rounds) ---------------- */}
        {live && (
          <Section title={`Audience voting · ${voteTotal} votes`}>
            {CATEGORIES.map((c) => {
              const v = stageVoting(stage, rows, c, settings.now_performing);
              if (v.total === 0) return null;
              const tally = isFinal
                ? rankFinal(rows, c, judgeWeight).map((r) => ({ id: r.contestant_id, name: r.name, votes: r.votes }))
                : round1Candidates(rows, c, settings.now_performing)
                    .map((r) => ({ id: r.contestant_id, name: r.name, votes: r.r1_votes }))
                    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
              const status = !settings.voting_open
                ? "Closed"
                : v.ready
                  ? "Voting open"
                  : isFinal
                    ? `Opens after all perform · ${v.performed}/${v.total}`
                    : "Opens with the first performer";
              return (
                <div key={c} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{CATEGORY_LABEL[c]}</span>
                    <span
                      className={`text-sm font-semibold ${!settings.voting_open ? "text-muted" : v.ready ? "text-emerald-300" : "text-amber-300"}`}
                    >
                      {status}
                    </span>
                  </div>
                  {settings.voting_open && v.ready && (
                    <Script label="Voting open">
                      {isFinal ? (
                        <>
                          {CATEGORY_LABEL[c]} voting is now open! Scan the QR code on the screen, enter your staff ID and
                          pick your favourite finalist.
                        </>
                      ) : (
                        <>
                          {CATEGORY_LABEL[c]} voting is open! Scan the QR code on the screen and enter your staff ID.
                          Singers join the list as they perform, so you can vote now or wait for your favourite.
                        </>
                      )}{" "}
                      One vote per person in each category (you can change it once), and your vote counts for{" "}
                      {100 - judgeWeight}%!
                    </Script>
                  )}
                  {tally.length > 0 && (
                    <ul className="divide-y divide-line/60 rounded-xl bg-bg/40 px-4">
                      {tally.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0 truncate">{r.name}</span>
                          <span className="shrink-0 text-sm text-gold tabular-nums">🗳 {r.votes ?? 0}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </Section>
        )}

        {/* ---------------- Winners ---------------- */}
        {stage === "completed" && (
          <Section title="Announce the winners">
            <p className="text-sm text-muted">Read each category from third place up to the winner.</p>
            {CATEGORIES.map((c) => {
              const top = rankFinal(rows, c, judgeWeight).filter((r) => r.finalScore != null).slice(0, 3);
              if (top.length === 0) return null;
              const [first, second, third] = top;
              return (
                <div key={c} className="space-y-2">
                  <div className="font-bold">{CATEGORY_LABEL[c]}</div>
                  {third && (
                    <Script label="3rd place">
                      In third place, with <strong>{fmt(third.finalScore, 1)}</strong> points… <strong>{third.name}</strong>!
                    </Script>
                  )}
                  {second && (
                    <Script label="2nd place">
                      In second place, with <strong>{fmt(second.finalScore, 1)}</strong> points… <strong>{second.name}</strong>!
                    </Script>
                  )}
                  {first && (
                    <Script label="Winner">
                      And the winner of the {CATEGORY_LABEL[c].toLowerCase()} category, with{" "}
                      <strong>{fmt(first.finalScore, 1)}</strong> points, is… <strong>{first.name}</strong>!
                    </Script>
                  )}
                </div>
              );
            })}
            <Script label="Closing">
              Congratulations to all our winners, and a huge thank you to every performer, our judges and all of you
              for your support tonight. Good night!
            </Script>
          </Section>
        )}

        {/* ---------------- Running order ---------------- */}
        {live && queue.length > 0 && (
          <details className="card" open={!next}>
            <summary className="cursor-pointer list-none text-xs font-bold tracking-[0.3em] text-muted uppercase">
              Running order · {queue.length} ▾
            </summary>
            <ol className="mt-3 divide-y divide-line/60">
              {queue.map((r) => {
                const isCurrent = r.contestant_id === settings.now_performing;
                const performed = judgedCount(r) > 0 && !isCurrent;
                return (
                  <li key={r.contestant_id} className="flex items-center gap-3 py-2">
                    <span className="w-7 text-center text-sm font-bold text-muted tabular-nums">
                      {orderOf(r) === 999 ? "–" : orderOf(r)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-semibold ${performed ? "text-muted line-through decoration-1" : ""}`}>
                        {r.name}
                      </div>
                      <div className="truncate text-xs text-muted">
                        {CATEGORY_LABEL[r.category]}
                        {songOf(r) ? ` · ♪ ${songOf(r)}` : ""}
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-bold text-accent-2">ON STAGE</span>
                    ) : performed ? (
                      <span className="text-xs text-emerald-300">Done ✓</span>
                    ) : (
                      <form action={callToStage}>
                        <input type="hidden" name="id" value={r.contestant_id} />
                        <button className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-panel-2">
                          Call
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        )}
      </main>
    </>
  );
}

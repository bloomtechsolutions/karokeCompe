import { AutoRefresh } from "@/components/AutoRefresh";
import { Header, NavLink } from "@/components/Header";
import { StageBadge } from "@/components/StageBadge";
import { requireJudge } from "@/lib/auth";
import { getLeaderboard, getSettings } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, type Contestant, type Score } from "@/lib/types";
import { logout } from "../login/actions";
import { ScoreCard } from "./ScoreCard";

export const dynamic = "force-dynamic";

export default async function JudgePage() {
  const judge = await requireJudge();
  const settings = await getSettings();
  const scoring = settings.stage === "round1" || settings.stage === "final";
  const round = settings.stage === "final" ? "final" : "round1";

  const supabase = await createClient();
  const [{ data: contestantData }, { data: scoreData }, board] = await Promise.all([
    supabase.from("contestants").select("*"),
    supabase.from("scores").select("*").eq("judge_id", judge.id).eq("round", round),
    getLeaderboard(),
  ]);

  const orderOf = (c: Contestant) =>
    (round === "final" ? c.final_order : c.performance_order) ?? Number.MAX_SAFE_INTEGER;
  const queue = ((contestantData ?? []) as Contestant[])
    .filter((c) => round === "round1" || c.is_finalist)
    .sort((a, b) => orderOf(a) - orderOf(b) || a.name.localeCompare(b.name));
  const myScores = new Map(((scoreData ?? []) as Score[]).map((s) => [s.contestant_id, s]));
  // A performer has performed once any judge has scored them this round.
  const anyScores = new Map(
    board.map((r) => [r.contestant_id, round === "final" ? r.final_judges : r.r1_judges]),
  );

  const current = queue.find((c) => c.id === settings.now_performing) ?? null;
  const currentIdx = current ? queue.indexOf(current) : -1;
  const performed = (c: Contestant) => c !== current && (anyScores.get(c.id) ?? 0) > 0;
  // Up next: not yet performed, starting after whoever is on stage.
  const upNext = [...queue.slice(currentIdx + 1), ...queue.slice(0, Math.max(currentIdx, 0))].filter(
    (c) => c !== current && !performed(c),
  );
  const missed = queue.filter((c) => performed(c) && !myScores.has(c.id));
  const done = queue.filter((c) => myScores.has(c.id)).length;

  const songOf = (c: Contestant) => (round === "final" ? c.song_final : c.song_round1);
  const orderLabel = (c: Contestant) => (round === "final" ? c.final_order : c.performance_order);

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
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <AutoRefresh seconds={scoring ? 5 : 15} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Hi {judge.full_name || "Judge"}</h1>
            <p className="text-sm text-muted">
              {scoring
                ? `You've scored ${done} of ${queue.length} performers`
                : "Scoring opens when the organiser starts a round."}
            </p>
          </div>
          <StageBadge stage={settings.stage} />
        </div>

        {!scoring ? (
          <div className="card text-center text-sm text-muted">
            {settings.stage === "completed"
              ? "The competition is complete. Thank you for judging!"
              : "Waiting for the competition to start…"}
          </div>
        ) : queue.length === 0 ? (
          <p className="card text-center text-sm text-muted">No performers in this round yet.</p>
        ) : (
          <>
            {current ? (
              <ScoreCard
                key={`${current.id}-${round}`}
                contestant={current}
                round={round}
                song={songOf(current)}
                order={orderLabel(current)}
                existing={myScores.get(current.id) ?? null}
                onStage
              />
            ) : (
              <div className="card py-8 text-center">
                <div className="text-3xl">🎤</div>
                <p className="mt-2 font-semibold">
                  {upNext.length > 0 ? "Waiting for the next performer…" : "All performers are done for this round."}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {upNext.length > 0
                    ? "Their score card will appear here when the organiser calls them on stage."
                    : "Thank you! Wait for the organiser to start the next round."}
                </p>
              </div>
            )}

            {missed.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-bold tracking-wide text-amber-300 uppercase">
                  ⚠ You haven&apos;t scored {missed.length === 1 ? "this performer" : "these performers"}
                </h2>
                {missed.map((c) => (
                  <ScoreCard
                    key={`${c.id}-${round}`}
                    contestant={c}
                    round={round}
                    song={songOf(c)}
                    order={orderLabel(c)}
                    existing={null}
                    missed
                  />
                ))}
              </section>
            )}

            {upNext.length > 0 && (
              <section className="card">
                <h2 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">
                  Up next · {upNext.length}
                </h2>
                <ol className="divide-y divide-line/60">
                  {upNext.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          i === 0 ? "bg-accent text-white" : "bg-panel-2 text-muted"
                        }`}
                      >
                        {orderLabel(c) ?? "–"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold">{c.name}</span>
                          {i === 0 && (
                            <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-2 uppercase">
                              Next
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {CATEGORY_LABEL[c.category]} · {songOf(c) ?? "Song TBA"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

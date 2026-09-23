import { AutoRefresh } from "@/components/AutoRefresh";
import { Header, NavLink } from "@/components/Header";
import { StageBadge } from "@/components/StageBadge";
import { requireJudge } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Contestant, Score } from "@/lib/types";
import { logout } from "../login/actions";
import { ScoreCard } from "./ScoreCard";

export const dynamic = "force-dynamic";

export default async function JudgePage() {
  const judge = await requireJudge();
  const settings = await getSettings();
  const scoring = settings.stage === "round1" || settings.stage === "final";
  const round = settings.stage === "final" ? "final" : "round1";

  const supabase = await createClient();
  const [{ data: contestantData }, { data: scoreData }] = await Promise.all([
    supabase.from("contestants").select("*"),
    supabase.from("scores").select("*").eq("judge_id", judge.id).eq("round", round),
  ]);

  const orderOf = (c: Contestant) =>
    (round === "final" ? c.final_order : c.performance_order) ?? Number.MAX_SAFE_INTEGER;
  const contestants = ((contestantData ?? []) as Contestant[])
    .filter((c) => round === "round1" || c.is_finalist)
    .sort((a, b) => orderOf(a) - orderOf(b) || a.name.localeCompare(b.name));
  const scores = new Map(((scoreData ?? []) as Score[]).map((s) => [s.contestant_id, s]));
  const done = contestants.filter((c) => scores.has(c.id)).length;

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
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Hi {judge.full_name || "Judge"}</h1>
            <p className="text-sm text-muted">
              {scoring
                ? `${done} of ${contestants.length} performers scored`
                : "Scoring opens when the organiser starts a round."}
            </p>
          </div>
          <StageBadge stage={settings.stage} />
        </div>

        {scoring && <AutoRefresh seconds={10} />}
        {scoring ? (
          contestants.length === 0 ? (
            <p className="card text-center text-sm text-muted">No performers in this round yet.</p>
          ) : (
            contestants.map((c) => (
              <ScoreCard
                key={`${c.id}-${round}`}
                contestant={c}
                song={round === "final" ? c.song_final : c.song_round1}
                order={round === "final" ? c.final_order : c.performance_order}
                existing={scores.get(c.id) ?? null}
                onStage={c.id === settings.now_performing}
              />
            ))
          )
        ) : (
          <>
            <AutoRefresh seconds={15} />
            <div className="card text-center text-sm text-muted">
              {settings.stage === "completed"
                ? "The competition is complete. Thank you for judging!"
                : "Waiting for the competition to start…"}
            </div>
          </>
        )}
      </main>
    </>
  );
}

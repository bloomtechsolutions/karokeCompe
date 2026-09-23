import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Header, NavLink } from "@/components/Header";
import { FinalBoard, Round1Board } from "@/components/Leaderboards";
import { StageBadge } from "@/components/StageBadge";
import { getLeaderboard, getSettings } from "@/lib/data";
import { CRITERIA, rankFinal, rankRound1 } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

const RULES = [
  "1st round and final round songs must be different.",
  "Solo and duet performers can bring 3 supporters each for the 1st round.",
  "The 3 best performances from the solo and duet categories advance to the final round.",
  "All participants are welcome to come and support the final round performers.",
  "Final round performers can bring 3 supporters each.",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const [settings, rows, judgeCountRes, voteTotalRes] = await Promise.all([
    getSettings(),
    getLeaderboard(),
    supabase.rpc("judge_count"),
    supabase.rpc("vote_total"),
  ]);
  const judgeCount = (judgeCountRes.data as number | null) ?? 0;
  const voteTotal = (voteTotalRes.data as number | null) ?? 0;
  const inFinal = settings.stage === "final" || settings.stage === "completed";
  const judgeWeight = Number(settings.judge_weight);

  return (
    <>
      <AutoRefresh seconds={10} />
      <Header
        eventName={settings.event_name}
        right={
          <>
            {settings.voting_open && <NavLink href="/vote">Vote</NavLink>}
            <NavLink href="/login">Judges</NavLink>
          </>
        }
      />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-10">
        <section className="text-center">
          <p className="text-sm font-medium tracking-[0.3em] text-muted uppercase">Duet | Single</p>
          <h1 className="mt-1 text-4xl leading-none font-extrabold tracking-tight uppercase sm:text-6xl">
            Karaoke
          </h1>
          <p className="font-script -mt-1 text-5xl text-accent-2 sm:text-7xl">Competition</p>
          <div className="mt-4 flex justify-center">
            <StageBadge stage={settings.stage} />
          </div>
          {!settings.show_scores && (
            <p className="mt-3 text-sm text-muted">Scores are hidden until the results are announced.</p>
          )}
        </section>

        {settings.stage === "final" && settings.voting_open && (
          <section className="card flex flex-col items-center gap-3 border-accent/60 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h2 className="text-lg font-bold">Audience voting is open!</h2>
              <p className="text-sm text-muted">
                Your vote counts for {100 - judgeWeight}% of the final score · {voteTotal} votes cast
              </p>
            </div>
            <Link href="/vote" className="btn-primary w-full sm:w-auto">
              Vote now
            </Link>
          </section>
        )}

        {inFinal && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Final Round</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {CATEGORIES.map((c) => (
                <FinalBoard
                  key={c}
                  category={c}
                  rows={rankFinal(rows, c, judgeWeight)}
                  judgeCount={judgeCount}
                  judgeWeight={judgeWeight}
                  showScores={settings.show_scores}
                  votingOpen={settings.voting_open}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-xl font-bold">1st Round</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {CATEGORIES.map((c) => (
              <Round1Board
                key={c}
                category={c}
                rows={rankRound1(rows, c)}
                judgeCount={judgeCount}
                finalistsPerCategory={settings.finalists_per_category}
                showScores={settings.show_scores}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="card">
            <h2 className="mb-3 text-lg font-bold">Rules</h2>
            <ul className="space-y-2 text-sm text-muted">
              {RULES.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-accent-2">♪</span>
                  {r}
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2 className="mb-3 text-lg font-bold">Judging Criteria</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line/60">
                {CRITERIA.map((c) => (
                  <tr key={c.key}>
                    <td className="py-2">
                      <div className="font-medium">{c.label}</div>
                      <div className="text-xs text-muted">{c.hint}</div>
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">{c.max}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-bold">Total</td>
                  <td className="py-2 text-right font-bold">100</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">
              Final round: judges&apos; score counts {judgeWeight}%, audience vote {100 - judgeWeight}%.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}

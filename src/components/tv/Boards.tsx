"use client";

import { fmt, rankFinal, rankRound1, type FinalResult, type Round1Result } from "@/lib/scoring";
import { CATEGORY_LABEL, type Category, type LeaderboardRow } from "@/lib/types";
import { categoryVoting } from "@/lib/voting";
import { AnimatedNumber } from "./AnimatedNumber";
import { AutoScroll } from "./AutoScroll";
import { useFlash, useFlip } from "./hooks";

// While someone is on stage the spotlight takes most of the screen and the
// leaderboards shrink to fit beside it.
const COMPACT_ZOOM = 0.72;

const MEDAL = ["bg-gold text-bg", "bg-zinc-200 text-bg", "bg-amber-700 text-white"];

function RankBadge({ rank, show }: { rank: number | null; show: boolean }) {
  const medal = show && rank != null && rank <= 3 ? MEDAL[rank - 1] : "bg-panel-2 text-muted";
  return (
    <span
      className={`inline-flex h-[2.4rem] w-[2.4rem] shrink-0 items-center justify-center rounded-full text-[1.1rem] font-extrabold ${medal}`}
    >
      {rank ?? "–"}
    </span>
  );
}

/** Live audience vote count for a finalist; pulses when it goes up. */
function VoteCount({ votes }: { votes: number }) {
  const flash = useFlash(votes, 1200);
  return (
    <span
      className={`inline-flex items-center gap-[0.3rem] rounded-full border border-gold/50 bg-gold/15 px-[0.6rem] py-[0.1rem] text-[1rem] font-bold text-gold tabular-nums transition-transform ${
        flash ? "scale-125" : ""
      }`}
    >
      🗳 <AnimatedNumber value={votes} decimals={0} />
    </span>
  );
}

export function JudgeDots({ done, total, size = "0.55rem" }: { done: number; total: number; size?: string }) {
  return (
    <span className="inline-flex gap-[0.25rem]" aria-label={`${done} of ${total} judges scored`}>
      {Array.from({ length: Math.max(total, done) }, (_, i) => (
        <span
          key={i}
          style={{ width: size, height: size }}
          className={`rounded-full transition-colors duration-700 ${i < done ? "bg-accent-2" : "bg-line"}`}
        />
      ))}
    </span>
  );
}

function BoardShell({
  title,
  subtitle,
  compact = false,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-3xl border border-line/70 bg-panel/70 p-[1.2rem] backdrop-blur-sm">
      <div className="mb-[0.8rem] flex items-baseline justify-between gap-3">
        <h2
          className={`leading-none font-extrabold tracking-wide uppercase ${compact ? "text-[1.3rem]" : "text-[1.7rem]"}`}
        >
          {title}
        </h2>
        <span className={`text-right text-muted ${compact ? "text-[0.7rem]" : "text-[0.85rem]"}`}>{subtitle}</span>
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 1st round
// ---------------------------------------------------------------------------

function Round1Row({
  r,
  judgeCount,
  showScores,
  onStage,
  displayRank,
}: {
  r: Round1Result;
  judgeCount: number;
  showScores: boolean;
  onStage: boolean;
  displayRank: number | null;
}) {
  const score = r.r1_avg == null ? null : Number(r.r1_avg);
  const flash = useFlash(`${r.r1_judges}|${score}`);
  return (
    <div
      className={`flex items-center gap-[0.8rem] rounded-2xl px-[0.6rem] py-[0.55rem] ${flash ? "row-flash" : ""} ${
        onStage ? "bg-accent/15 ring-2 ring-accent-2" : ""
      }`}
    >
      <RankBadge rank={displayRank} show={showScores && score != null} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[1.25rem] leading-tight font-bold">{r.name}</span>
          {onStage && <span className="shrink-0 text-[1rem]">🎤</span>}
          {r.is_finalist && (
            <span className="shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-[0.65rem] font-bold tracking-wider text-gold uppercase">
              Finalist
            </span>
          )}
        </div>
        <div className="mt-[0.2rem] flex items-center gap-[0.6rem]">
          <span className="truncate text-[0.85rem] text-muted">♪ {r.song_round1 ?? "Song TBA"}</span>
        </div>
        {showScores && (
          <div className="mt-[0.35rem] h-[0.4rem] overflow-hidden rounded-full bg-bg/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-1000 ease-out"
              style={{ width: `${score ?? 0}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-[0.3rem]">
        <span className="text-[1.9rem] leading-none font-extrabold">
          {showScores && score != null ? <AnimatedNumber value={score} /> : r.r1_judges > 0 ? "✓" : "—"}
        </span>
        <JudgeDots done={r.r1_judges} total={judgeCount} />
      </div>
    </div>
  );
}

export function Round1Board({
  category,
  rows,
  judgeCount,
  showScores,
  finalists,
  nowPerforming,
  compact = false,
}: {
  category: Category;
  rows: LeaderboardRow[];
  judgeCount: number;
  showScores: boolean;
  finalists: number;
  nowPerforming: string | null;
  compact?: boolean;
}) {
  // With scores hidden, list in running order so the order leaks nothing.
  const ranked = showScores
    ? rankRound1(rows, category)
    : rankRound1(
        [...rows].sort((a, b) => (a.performance_order ?? 999) - (b.performance_order ?? 999)),
        category,
      );
  const flipRef = useFlip(ranked.map((r) => r.contestant_id));
  const scoredCount = ranked.filter((r) => r.r1_judges > 0).length;
  const cutAfter = showScores && scoredCount > finalists ? finalists : -1;

  return (
    <BoardShell
      title={CATEGORY_LABEL[category]}
      subtitle={showScores ? `Top ${finalists} go to the final` : "Scores revealed later"}
      compact={compact}
    >
      {ranked.length === 0 ? (
        <p className="py-[2rem] text-center text-[1.1rem] text-muted">Performers coming soon…</p>
      ) : (
        <AutoScroll className="relative -mx-[0.3rem] min-h-0 flex-1 px-[0.3rem]">
          <div className="space-y-[0.3rem] py-[0.2rem]" style={compact ? { zoom: COMPACT_ZOOM } : undefined}>
            {ranked.map((r, i) => (
              <div key={r.contestant_id} ref={flipRef(r.contestant_id)}>
                <Round1Row
                  r={r}
                  judgeCount={judgeCount}
                  showScores={showScores}
                  onStage={r.contestant_id === nowPerforming}
                  displayRank={showScores ? (r.r1_judges > 0 ? r.rank : null) : (r.performance_order ?? null)}
                />
                {i === cutAfter - 1 && (
                  <div className="my-[0.4rem] flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.25em] text-gold uppercase">
                    <span className="h-px flex-1 border-t border-dashed border-gold/60" />
                    Final cut
                    <span className="h-px flex-1 border-t border-dashed border-gold/60" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </AutoScroll>
      )}
    </BoardShell>
  );
}

// ---------------------------------------------------------------------------
// Final round
// ---------------------------------------------------------------------------

function FinalRow({
  r,
  judgeCount,
  judgeWeight,
  showScores,
  votingOpen,
  votingReady,
  onStage,
  displayRank,
}: {
  r: FinalResult;
  judgeCount: number;
  judgeWeight: number;
  showScores: boolean;
  votingOpen: boolean;
  votingReady: boolean;
  onStage: boolean;
  displayRank: number | null;
}) {
  const flash = useFlash(`${r.final_judges}|${r.finalScore}`);
  const audienceWeight = 100 - judgeWeight;
  return (
    <div
      className={`rounded-2xl px-[0.7rem] py-[0.7rem] ${flash ? "row-flash" : ""} ${
        onStage ? "bg-accent/15 ring-2 ring-accent-2" : ""
      }`}
    >
      <div className="flex items-center gap-[0.8rem]">
        <RankBadge rank={displayRank} show={showScores && r.finalScore != null} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[1.4rem] leading-tight font-bold">{r.name}</span>
            {onStage && <span className="shrink-0 text-[1.1rem]">🎤</span>}
          </div>
          <span className="block truncate text-[0.85rem] text-muted">♪ {r.song_final ?? "Song TBA"}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[0.3rem]">
          <span className="text-[2.2rem] leading-none font-extrabold">
            {showScores && r.finalScore != null ? <AnimatedNumber value={r.finalScore} /> : "—"}
          </span>
          <div className="flex items-center gap-[0.6rem]">
            {r.votes != null && (votingReady || !votingOpen) && <VoteCount votes={r.votes} />}
            <JudgeDots done={r.final_judges} total={judgeCount} />
          </div>
        </div>
      </div>
      {showScores && (
        <>
          <div className="mt-[0.5rem] flex h-[0.7rem] overflow-hidden rounded-full bg-bg/70">
            <div
              className="h-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-1000 ease-out"
              style={{ width: `${r.judgePoints ?? 0}%` }}
            />
            {r.votes == null || (votingOpen && !votingReady) ? (
              <div className="shimmer h-full" style={{ width: `${audienceWeight}%` }} />
            ) : (
              <div
                className="h-full bg-gold transition-[width] duration-1000 ease-out"
                style={{ width: `${r.audiencePoints ?? 0}%` }}
              />
            )}
          </div>
          <div className="mt-[0.3rem] flex justify-between text-[0.75rem] text-muted tabular-nums">
            <span>
              <span className="text-accent-2">■</span> Judges {fmt(r.judgePoints, 1)}/{judgeWeight}
            </span>
            <span>
              <span className="text-gold">■</span> Audience{" "}
              {votingOpen && !votingReady
                ? "after all perform"
                : r.votes == null
                  ? "voting now…"
                  : `${fmt(r.audiencePoints, 1)}/${audienceWeight} · ${r.votes} ${r.votes === 1 ? "vote" : "votes"}`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function FinalBoard({
  category,
  rows,
  judgeCount,
  judgeWeight,
  showScores,
  votingOpen,
  nowPerforming,
  compact = false,
}: {
  category: Category;
  rows: LeaderboardRow[];
  judgeCount: number;
  judgeWeight: number;
  showScores: boolean;
  votingOpen: boolean;
  nowPerforming: string | null;
  compact?: boolean;
}) {
  const voting = categoryVoting(rows, category, nowPerforming);
  const ranked = showScores
    ? rankFinal(rows, category, judgeWeight)
    : rankFinal(
        [...rows].sort((a, b) => (a.final_order ?? 999) - (b.final_order ?? 999)),
        category,
        judgeWeight,
      );
  const flipRef = useFlip(ranked.map((r) => r.contestant_id));

  return (
    <BoardShell
      title={`${CATEGORY_LABEL[category]} Final`}
      compact={compact}
      subtitle={
        votingOpen ? (
          voting.ready ? (
            <span className="font-semibold text-gold">🗳 Audience voting open</span>
          ) : (
            `${voting.performed}/${voting.total} performed · voting opens after`
          )
        ) : (
          `Judges ${judgeWeight}% · Audience ${100 - judgeWeight}%`
        )
      }
    >
      {ranked.length === 0 ? (
        <p className="py-[2rem] text-center text-[1.1rem] text-muted">Finalists to be announced…</p>
      ) : (
        <AutoScroll className="-mx-[0.3rem] min-h-0 flex-1 px-[0.3rem]">
          <div className="space-y-[0.4rem] py-[0.2rem]" style={compact ? { zoom: COMPACT_ZOOM } : undefined}>
            {ranked.map((r) => (
              <div key={r.contestant_id} ref={flipRef(r.contestant_id)}>
                <FinalRow
                  r={r}
                  judgeCount={judgeCount}
                  judgeWeight={judgeWeight}
                  showScores={showScores}
                  votingOpen={votingOpen}
                  votingReady={voting.ready}
                  onStage={r.contestant_id === nowPerforming}
                  displayRank={showScores ? (r.finalScore != null ? r.rank : null) : (r.final_order ?? null)}
                />
              </div>
            ))}
          </div>
        </AutoScroll>
      )}
    </BoardShell>
  );
}

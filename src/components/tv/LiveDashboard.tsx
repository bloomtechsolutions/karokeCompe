"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rankFinal, rankRound1 } from "@/lib/scoring";
import { CATEGORIES, CATEGORY_LABEL, STAGE_LABEL, type Category, type LeaderboardRow, type Stage } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { FinalBoard, JudgeDots, Round1Board } from "./Boards";
import { categoryVoting } from "@/lib/voting";
import { useFlash } from "./hooks";
import { TvChrome } from "./TvChrome";

export type DashboardProps = {
  eventName: string;
  stage: Stage;
  showScores: boolean;
  votingOpen: boolean;
  finalistsPerCategory: number;
  judgeWeight: number;
  nowPerforming: string | null;
  rows: LeaderboardRow[];
  judgeCount: number;
  voteTotal: number;
  vote: { url: string; svg: string } | null;
};

export function LiveDashboard(props: DashboardProps) {
  const { stage, rows, showScores, nowPerforming } = props;
  const live = stage === "round1" || stage === "final";
  const onStage = live ? (rows.find((r) => r.contestant_id === nowPerforming) ?? null) : null;
  const openCategories = CATEGORIES.filter((c) => categoryVoting(rows, c, nowPerforming).ready);
  const showVote = stage === "final" && props.votingOpen && props.vote != null && openCategories.length > 0;
  const hasSide = onStage != null || showVote;

  return (
    <div className="tv-root relative flex min-h-dvh flex-col overflow-hidden lg:h-dvh">
      <Backdrop />
      <TopBar {...props} />
      {live && showScores && <LeaderBanner stage={stage} rows={rows} judgeWeight={props.judgeWeight} />}

      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-[1.5rem] pb-[1.5rem]">
        {stage === "setup" && <SetupView rows={rows} />}

        {live && (
          <div
            className={`grid min-h-0 flex-1 grid-cols-1 gap-[1.2rem] ${
              hasSide
                ? "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)_minmax(0,1.25fr)]"
                : "lg:grid-cols-2"
            }`}
          >
            {hasSide && (
              <div className="flex min-h-0 flex-col gap-[1.2rem]">
                {onStage && <Spotlight row={onStage} {...props} />}
                {showVote && <VotePanel {...props} compact={onStage != null} openCategories={openCategories} />}
              </div>
            )}
            {CATEGORIES.map((c) =>
              stage === "round1" ? (
                <Round1Board
                  key={c}
                  category={c}
                  rows={rows}
                  judgeCount={props.judgeCount}
                  showScores={showScores}
                  finalists={props.finalistsPerCategory}
                  nowPerforming={nowPerforming}
                />
              ) : (
                <FinalBoard
                  key={c}
                  category={c}
                  rows={rows}
                  judgeCount={props.judgeCount}
                  judgeWeight={props.judgeWeight}
                  showScores={showScores}
                  votingOpen={props.votingOpen}
                  nowPerforming={nowPerforming}
                />
              ),
            )}
          </div>
        )}

        {stage === "completed" &&
          (showScores ? (
            <Winners rows={rows} judgeWeight={props.judgeWeight} />
          ) : (
            <Hero title="Results coming soon" subtitle="Stay tuned for the winners!" />
          ))}
      </main>
      <TvChrome />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Backdrop() {
  const notes = ["♪", "♫", "♩", "♬"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="beam" style={{ left: "5%" }} />
      <div className="beam" style={{ left: "60%", animationDelay: "-7s", animationDuration: "18s" }} />
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="float-note"
          style={{
            left: `${(i * 37 + 7) % 100}%`,
            fontSize: `${1.2 + ((i * 13) % 5) * 0.5}rem`,
            animationDuration: `${16 + ((i * 7) % 12)}s`,
            animationDelay: `${-((i * 5) % 20)}s`,
          }}
        >
          {notes[i % notes.length]}
        </span>
      ))}
    </div>
  );
}

function TopBar({ eventName, stage, votingOpen, voteTotal }: DashboardProps) {
  const [first, ...rest] = eventName.split(" ");
  const live = stage === "round1" || stage === "final";
  const votePulse = useFlash(voteTotal, 1200);
  return (
    <header className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[1.5rem] py-[1rem]">
      <div className="flex items-baseline gap-[0.6rem] leading-none">
        <span className="text-[2rem] font-extrabold tracking-wide uppercase">{first}</span>
        {rest.length > 0 && <span className="font-script text-[2.6rem] text-accent-2">{rest.join(" ")}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-[0.8rem]">
        {stage === "final" && votingOpen && voteTotal > 0 && (
          <span
            className={`hidden items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-[1rem] py-[0.4rem] text-[1rem] font-semibold text-gold transition-transform sm:inline-flex ${
              votePulse ? "scale-110" : ""
            }`}
          >
            🗳 <AnimatedNumber value={voteTotal} decimals={0} /> votes
          </span>
        )}
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/80 px-[1rem] py-[0.4rem] text-[1rem] font-bold tracking-wider uppercase">
          {live && <span className="h-[0.6rem] w-[0.6rem] animate-pulse rounded-full bg-red-500" />}
          {live ? `Live · ${STAGE_LABEL[stage]}` : STAGE_LABEL[stage]}
        </span>
        <Link href="/login" className="text-[0.8rem] text-muted/50 hover:text-ink">
          Judges
        </Link>
      </div>
    </header>
  );
}

function Spotlight({
  row,
  stage,
  judgeCount,
  showScores,
}: DashboardProps & { row: LeaderboardRow }) {
  const isFinal = stage === "final";
  const done = isFinal ? row.final_judges : row.r1_judges;
  const avg = isFinal ? row.final_avg : row.r1_avg;
  const song = isFinal ? row.song_final : row.song_round1;
  const allIn = judgeCount > 0 && done >= judgeCount;

  return (
    <section
      key={row.contestant_id}
      className="glow-pulse pop-in relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-accent/70 bg-gradient-to-b from-accent/25 to-panel/80 p-[1.4rem] text-center lg:flex-1"
    >
      <div className="text-[0.95rem] font-bold tracking-[0.35em] text-accent-2 uppercase">🎤 Now on stage</div>
      <div className="mt-[0.6rem] text-[0.8rem] tracking-widest text-muted uppercase">
        {CATEGORY_LABEL[row.category]}
        {row.department ? ` · ${row.department}` : ""}
      </div>
      <h2 className="mt-[0.4rem] text-[3rem] leading-[1.05] font-extrabold break-words">{row.name}</h2>
      <p className="mt-[0.6rem] text-[1.3rem] text-muted">♪ {song ?? "Song TBA"}</p>

      <div className="mt-[1.4rem] flex flex-col items-center gap-[0.6rem]">
        {allIn && showScores && avg != null ? (
          <div className="pop-in">
            <div className="text-[0.85rem] tracking-[0.3em] text-muted uppercase">Judges&apos; score</div>
            <div className="text-[4.5rem] leading-none font-extrabold text-gold">
              <AnimatedNumber value={Number(avg)} duration={1800} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[1.1rem] text-muted">
            {allIn ? "All judges have scored" : "Judges are scoring"}
            {!allIn && (
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="bounce-dot" style={{ animationDelay: `${i * 0.15}s` }}>
                    •
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
        <JudgeDots done={done} total={judgeCount} size="1rem" />
        <span className="text-[0.85rem] text-muted tabular-nums">
          {done}/{judgeCount} judges
        </span>
      </div>
    </section>
  );
}

function VotePanel({
  vote,
  voteTotal,
  judgeWeight,
  compact,
  openCategories,
}: DashboardProps & { compact: boolean; openCategories: Category[] }) {
  const pulse = useFlash(voteTotal, 1200);
  if (!vote) return null;
  return (
    <section
      className={`flex items-center gap-[1.2rem] rounded-3xl border-2 border-gold/60 bg-panel/80 p-[1.2rem] ${
        compact ? "flex-row" : "flex-col justify-center text-center lg:flex-1"
      }`}
    >
      <div
        className={`shrink-0 rounded-2xl bg-white p-[0.5rem] ${compact ? "w-[8rem] lg:w-[10.5rem]" : "w-[15rem]"}`}
        dangerouslySetInnerHTML={{ __html: vote.svg }}
      />
      <div className={compact ? "min-w-0" : ""}>
        <div className="text-[1.6rem] leading-tight font-extrabold">Scan to vote!</div>
        <div className="text-[0.95rem] font-semibold text-gold">
          {openCategories.map((c) => CATEGORY_LABEL[c]).join(" & ")} voting is open
        </div>
        <div className="mt-[0.3rem] text-[0.9rem] text-muted">
          Your vote counts for {100 - judgeWeight}% of the final score
        </div>
        <div className={`mt-[0.6rem] text-[2.4rem] leading-none font-extrabold text-gold transition-transform ${pulse ? "scale-110" : ""}`}>
          <AnimatedNumber value={voteTotal} decimals={0} />
          <span className="ml-2 text-[1rem] font-semibold text-muted">votes cast</span>
        </div>
        {!compact && <div className="mt-[0.5rem] text-[0.8rem] break-all text-muted/70">{vote.url}</div>}
      </div>
    </section>
  );
}

/** Flashes a banner when a category gets a new leader. */
function LeaderBanner({ stage, rows, judgeWeight }: { stage: Stage; rows: LeaderboardRow[]; judgeWeight: number }) {
  const leaders: Record<Category, string | null> = { solo: null, duet: null };
  const names = new Map(rows.map((r) => [r.contestant_id, r.name]));
  for (const c of CATEGORIES) {
    if (stage === "round1") {
      const top = rankRound1(rows, c)[0];
      leaders[c] = top && top.r1_judges > 0 ? top.contestant_id : null;
    } else {
      const top = rankFinal(rows, c, judgeWeight)[0];
      leaders[c] = top && top.finalScore != null ? top.contestant_id : null;
    }
  }
  const signature = `${stage}|${leaders.solo}|${leaders.duet}`;
  const prev = useRef<{ sig: string; leaders: typeof leaders } | null>(null);
  const [banner, setBanner] = useState<{ id: number; text: string; category: Category } | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = { sig: signature, leaders };
    const stageChanged = before != null && before.sig.split("|")[0] !== stage;
    if (!before || before.sig === signature || stageChanged) return;
    for (const c of CATEGORIES) {
      const now = leaders[c];
      if (now && now !== before.leaders[c]) {
        setBanner({ id: Date.now(), text: names.get(now) ?? "", category: c });
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const bannerId = banner?.id;
  useEffect(() => {
    if (bannerId == null) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [bannerId]);

  if (!banner) return null;
  return (
    <div
      key={banner.id}
      className="banner-in fixed top-[1.2rem] left-1/2 z-40 rounded-full border-2 border-gold bg-bg/90 px-[2rem] py-[0.8rem] text-center shadow-2xl backdrop-blur"
    >
      <span className="text-[1rem] font-bold tracking-[0.25em] text-gold uppercase">
        👑 New {CATEGORY_LABEL[banner.category]} leader
      </span>
      <div className="text-[2rem] leading-tight font-extrabold">{banner.text}</div>
    </div>
  );
}

function Hero({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-[3rem] text-center">
      <p className="text-[1.2rem] font-semibold tracking-[0.5em] text-muted uppercase">Duet | Single</p>
      <h1 className="mt-[0.5rem] text-[6rem] leading-none font-extrabold tracking-tight uppercase">Karaoke</h1>
      <p className="font-script -mt-[0.5rem] text-[6.5rem] leading-none text-accent-2">Competition</p>
      <p className="mt-[2rem] text-[2.2rem] font-bold">{title}</p>
      {subtitle && <p className="mt-[0.4rem] text-[1.2rem] text-muted">{subtitle}</p>}
      {children}
    </div>
  );
}

function SetupView({ rows }: { rows: LeaderboardRow[] }) {
  const byCat = (c: Category) =>
    rows
      .filter((r) => r.category === c)
      .sort((a, b) => (a.performance_order ?? 999) - (b.performance_order ?? 999));
  return (
    <Hero title="Starting soon" subtitle="Think you've got the voice? Prove it on stage!">
      {rows.length > 0 && (
        <div className="mt-[2.5rem] grid w-full max-w-[70rem] gap-[1.2rem] md:grid-cols-2">
          {CATEGORIES.map((c) => (
            <div key={c} className="rounded-3xl border border-line/70 bg-panel/60 p-[1.2rem] text-left">
              <div className="mb-[0.6rem] text-[1.2rem] font-extrabold uppercase">
                {CATEGORY_LABEL[c]} <span className="text-muted">· {byCat(c).length}</span>
              </div>
              <div className="flex flex-wrap gap-[0.5rem]">
                {byCat(c).map((r, i) => (
                  <span
                    key={r.contestant_id}
                    className="pop-in rounded-full bg-panel-2 px-[0.9rem] py-[0.35rem] text-[1rem]"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Hero>
  );
}

// ---------------------------------------------------------------------------
// Winners
// ---------------------------------------------------------------------------

function Confetti() {
  const colors = ["#e0356f", "#f472a0", "#f2c46d", "#ffffff", "#a855f7"];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {Array.from({ length: 60 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${(i * 53 + 11) % 100}%`,
            background: colors[i % colors.length],
            animationDuration: `${5 + ((i * 7) % 6)}s`,
            animationDelay: `${-((i * 3) % 10)}s`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

function Podium({ category, rows, judgeWeight }: { category: Category; rows: LeaderboardRow[]; judgeWeight: number }) {
  const top = rankFinal(rows, category, judgeWeight).filter((r) => r.finalScore != null).slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ["h-[9rem]", "h-[13rem]", "h-[6.5rem]"];
  const places = [2, 1, 3];
  const colors = ["from-zinc-300 to-zinc-500", "from-gold to-amber-600", "from-amber-600 to-amber-800"];

  return (
    <section className="flex min-h-0 flex-col rounded-3xl border border-line/70 bg-panel/60 p-[1.4rem]">
      <h2 className="text-center text-[2rem] font-extrabold tracking-wide uppercase">{CATEGORY_LABEL[category]}</h2>
      {top.length === 0 ? (
        <p className="py-[3rem] text-center text-muted">No final results.</p>
      ) : (
        <div className="mt-auto grid grid-cols-3 items-end gap-[1rem] pt-[1.5rem]">
          {order.map((r, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              {r && (
                <div className="pop-in mb-[0.6rem]" style={{ animationDelay: `${600 + (2 - i) * 300}ms` }}>
                  {places[i] === 1 && <div className="text-[3rem] leading-none">👑</div>}
                  <div className={`font-extrabold ${places[i] === 1 ? "text-[1.8rem]" : "text-[1.3rem]"}`}>{r.name}</div>
                  <div className="text-[1.1rem] font-bold text-gold tabular-nums">
                    <AnimatedNumber value={r.finalScore ?? 0} duration={2000} />
                  </div>
                </div>
              )}
              <div
                className={`podium-rise flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-[0.6rem] text-[2.6rem] font-extrabold text-bg ${heights[i]} ${colors[i]}`}
                style={{ animationDelay: `${(2 - i) * 200}ms` }}
              >
                {r ? places[i] : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Winners({ rows, judgeWeight }: { rows: LeaderboardRow[]; judgeWeight: number }) {
  return (
    <>
      <Confetti />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="pop-in text-center">
          <div className="font-script text-[4.5rem] leading-none text-accent-2">Congratulations</div>
          <div className="text-[1.2rem] tracking-[0.4em] text-muted uppercase">to our winners</div>
        </div>
        <div className="mt-[1.5rem] grid min-h-0 flex-1 gap-[1.5rem] lg:grid-cols-2">
          {CATEGORIES.map((c) => (
            <Podium key={c} category={c} rows={rows} judgeWeight={judgeWeight} />
          ))}
        </div>
      </div>
    </>
  );
}

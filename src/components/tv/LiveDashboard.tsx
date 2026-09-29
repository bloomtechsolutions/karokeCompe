"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rankFinal, rankRound1 } from "@/lib/scoring";
import { CATEGORIES, CATEGORY_LABEL, STAGE_LABEL, type Category, type LeaderboardRow, type Stage } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { FinalBoard, JudgeDots, Round1Board } from "./Boards";
import { activeFinalCategories, nextInLine, stageVoting } from "@/lib/voting";
import { useFlash } from "./hooks";
import { IdleHero, IdleStage, LogoOrb, type NextUp } from "./IdleStage";
import { TvChrome } from "./TvChrome";

export type DashboardProps = {
  eventName: string;
  stage: Stage;
  showScores: boolean;
  votingOpen: boolean;
  finalistsPerCategory: number;
  judgeWeight: number;
  nowPerforming: string | null;
  lastOnStage: string | null;
  rows: LeaderboardRow[];
  judgeCount: number;
  voteTotal: number;
  vote: { url: string; svg: string } | null;
};

export function LiveDashboard(props: DashboardProps) {
  const { stage, rows, showScores, nowPerforming } = props;
  const live = stage === "round1" || stage === "final";
  const onStage = live ? (rows.find((r) => r.contestant_id === nowPerforming) ?? null) : null;
  const openCategories = CATEGORIES.filter((c) => stageVoting(stage, rows, c, nowPerforming).ready);
  const showVote = live && props.votingOpen && props.vote != null && openCategories.length > 0;
  // Between round 1 acts the QR sits inside the logo banner, so the boards keep the full width.
  const voteInBanner = showVote && stage === "round1" && !onStage;
  const hasSide = onStage != null || (showVote && !voteInBanner);
  // The logo show replaces the header (it already names the event and stage).
  const idle = stage === "setup" || (live && !hasSide);
  // In the final, show only the category being performed or voted on.
  const boardCategories = stage === "final" ? activeFinalCategories(rows, nowPerforming) : CATEGORIES;
  // Running order for the current round: who's performed and who's next.
  const isFinal = stage === "final";
  const orderOf = (r: LeaderboardRow) => (isFinal ? r.final_order : r.performance_order) ?? 999;
  const queue = rows
    .filter((r) => !isFinal || r.is_finalist)
    .sort((a, b) => orderOf(a) - orderOf(b) || a.name.localeCompare(b.name));
  const judged = (r: LeaderboardRow) => (isFinal ? r.final_judges : r.r1_judges) > 0;
  const next =
    nextInLine(queue, (r) => r.contestant_id, nowPerforming ?? props.lastOnStage, judged)[0] ?? null;
  const nextUp: NextUp = next
    ? { name: next.name, category: next.category, song: isFinal ? next.song_final : next.song_round1 }
    : null;
  const progress = live ? { done: queue.filter(judged).length, total: queue.length } : null;

  return (
    <div className="tv-root relative flex min-h-dvh flex-col overflow-hidden lg:h-dvh">
      <Backdrop />
      {!idle && <TopBar {...props} />}
      {live && showScores && <LeaderBanner stage={stage} rows={rows} judgeWeight={props.judgeWeight} />}

      <main className={`relative z-10 flex min-h-0 flex-1 flex-col px-[1.5rem] pb-[1.5rem] ${idle ? "pt-[1.5rem]" : ""}`}>
        {stage === "setup" && <SetupView rows={rows} />}

        {live && (
          <div
            className={`grid min-h-0 flex-1 grid-cols-1 gap-[1.2rem] transition-[grid-template-columns] duration-700 ${
              onStage
                ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)]"
                : hasSide
                  ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"
                  : ""
            }`}
          >
            {hasSide && (
              <div className="flex min-h-0 flex-col gap-[1.2rem]">
                {onStage && <Spotlight row={onStage} {...props} tight={showVote} />}
                {showVote && !voteInBanner && (
                  <VotePanel {...props} compact={onStage != null} openCategories={openCategories} />
                )}
              </div>
            )}
            <div className="flex min-h-0 flex-col gap-[1.2rem]">
              {!hasSide && (
                <IdleStage
                  eyebrow={`${STAGE_LABEL[stage]} · Live`}
                  nextUp={nextUp}
                  progress={progress}
                  vote={
                    voteInBanner && props.vote ? (
                      <BannerVote svg={props.vote.svg} voteTotal={props.voteTotal} openCategories={openCategories} />
                    ) : undefined
                  }
                />
              )}
              {boardCategories.map((c) =>
                stage === "round1" ? (
                  <Round1Board
                    key={c}
                    category={c}
                    rows={rows}
                    judgeCount={props.judgeCount}
                    showScores={showScores}
                    finalists={props.finalistsPerCategory}
                    nowPerforming={nowPerforming}
                    judgeWeight={props.judgeWeight}
                    compact={onStage != null}
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
                    compact={onStage != null}
                  />
                ),
              )}
            </div>
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

function TopBar({ stage, votingOpen, voteTotal }: DashboardProps) {
  const live = stage === "round1" || stage === "final";
  const votePulse = useFlash(voteTotal, 1200);
  return (
    <header className="relative z-10 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 px-[1.5rem] py-[0.8rem]">
      <div className="flex flex-wrap items-center gap-[0.8rem]">
        {live && votingOpen && voteTotal > 0 && (
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
  tight,
}: DashboardProps & { row: LeaderboardRow; tight: boolean }) {
  const isFinal = stage === "final";
  const done = isFinal ? row.final_judges : row.r1_judges;
  const avg = isFinal ? row.final_avg : row.r1_avg;
  const song = isFinal ? row.song_final : row.song_round1;
  const allIn = judgeCount > 0 && done >= judgeCount;
  // Long names (typically duets) and a shared column (voting QR below) get smaller type.
  const long = row.name.length > 20;
  const nameSize = tight
    ? long ? "lg:text-[2.8rem]" : "lg:text-[3.8rem]"
    : long ? "lg:text-[4rem]" : "lg:text-[5.2rem]";

  return (
    <section
      key={row.contestant_id}
      className="glow-pulse pop-in relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-accent/70 bg-gradient-to-b from-accent/25 to-panel/80 p-[1.4rem] text-center lg:flex-1"
    >
      <div className="text-[1.4rem] font-bold tracking-[0.35em] text-accent-2 uppercase">🎤 Now on stage</div>
      <div className="mt-[0.8rem] text-[1.1rem] tracking-widest text-muted uppercase">
        {CATEGORY_LABEL[row.category]}
        {row.department ? ` · ${row.department}` : ""}
      </div>
      <h2 className={`mt-[0.6rem] text-[2.4rem] leading-[1.05] font-extrabold text-balance break-words ${nameSize}`}>{row.name}</h2>
      <p className={`mt-[0.8rem] text-[1.3rem] text-muted ${tight ? "lg:text-[1.6rem]" : "lg:text-[2.1rem]"}`}>♪ {song ?? "Song TBA"}</p>

      <div className={`${tight ? "mt-[1rem]" : "mt-[2rem]"} flex flex-col items-center gap-[0.8rem]`}>
        {allIn && showScores && avg != null ? (
          <div className="pop-in">
            <div className="text-[1.1rem] tracking-[0.3em] text-muted uppercase">Judges&apos; score</div>
            <div className={`text-[4.5rem] leading-none font-extrabold text-gold ${tight ? "lg:text-[5rem]" : "lg:text-[7.5rem]"}`}>
              <AnimatedNumber value={Number(avg)} duration={1800} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[1.1rem] text-muted lg:text-[1.6rem]">
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
        <JudgeDots done={done} total={judgeCount} size="1.5rem" />
        <span className="text-[1.1rem] text-muted tabular-nums">
          {done}/{judgeCount} judges
        </span>
      </div>
    </section>
  );
}

function VotePanel({
  stage,
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
        className={`shrink-0 rounded-2xl bg-white p-[0.6rem] ${
          compact ? "w-[9rem] lg:w-[14rem]" : "w-[92%] max-w-[min(36rem,50dvh)]"
        }`}
        dangerouslySetInnerHTML={{ __html: vote.svg }}
      />
      <div className={compact ? "min-w-0 flex-1" : ""}>
        <div className={`flex items-center gap-[1rem] ${compact ? "" : "justify-center"}`}>
          <LogoOrb size={compact ? "3.6rem" : "6rem"} minimal />
          <div className={`leading-tight font-extrabold lg:whitespace-nowrap ${compact ? "text-[1.7rem]" : "text-[3.2rem]"}`}>
            Scan to vote!
          </div>
        </div>
        <div className={`font-semibold text-gold ${compact ? "text-[1.15rem]" : "text-[1.5rem]"}`}>
          {openCategories.map((c) => CATEGORY_LABEL[c]).join(" & ")} voting is open
        </div>
        {!compact && (
          <div className="mt-[0.3rem] text-[1.15rem] text-muted">
            Your vote counts for {100 - judgeWeight}% of the {stage === "final" ? "final" : "1st round"} score
          </div>
        )}
        <div
          className={`mt-[0.6rem] leading-none font-extrabold whitespace-nowrap text-gold transition-transform ${
            compact ? "text-[2.8rem]" : "text-[4.2rem]"
          } ${pulse ? "scale-110" : ""}`}
        >
          <AnimatedNumber value={voteTotal} decimals={0} />
          <span className={`ml-2 font-semibold text-muted ${compact ? "text-[1.1rem]" : "text-[1.4rem]"}`}>votes cast</span>
        </div>
      </div>
    </section>
  );
}

/** Voting QR and live count, sized to sit at the right of the logo banner. */
function BannerVote({ svg, voteTotal, openCategories }: { svg: string; voteTotal: number; openCategories: Category[] }) {
  const pulse = useFlash(voteTotal, 1200);
  return (
    <div className="flex max-w-full shrink-0 flex-wrap items-center gap-[1.2rem] rounded-2xl border-2 border-gold/60 bg-bg/70 p-[0.8rem] backdrop-blur lg:flex-nowrap">
      <div
        className="w-[clamp(8rem,22dvh,13rem)] shrink-0 rounded-xl bg-white p-[0.4rem]"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="text-left">
        <div className="text-[2rem] leading-tight font-extrabold whitespace-nowrap">Scan to vote!</div>
        <div className="text-[1.05rem] font-semibold text-gold">
          {openCategories.map((c) => CATEGORY_LABEL[c]).join(" & ")} voting open
        </div>
        <div
          className={`mt-[0.4rem] text-[2.6rem] leading-none font-extrabold text-gold tabular-nums transition-transform ${
            pulse ? "scale-110" : ""
          }`}
        >
          <AnimatedNumber value={voteTotal} decimals={0} />
          <span className="ml-2 text-[1rem] font-semibold text-muted">votes</span>
        </div>
      </div>
    </div>
  );
}

/** Flashes a banner when a category gets a new leader. */
function LeaderBanner({ stage, rows, judgeWeight }: { stage: Stage; rows: LeaderboardRow[]; judgeWeight: number }) {
  const leaders: Record<Category, string | null> = { solo: null, duet: null };
  const names = new Map(rows.map((r) => [r.contestant_id, r.name]));
  for (const c of CATEGORIES) {
    if (stage === "round1") {
      const top = rankRound1(rows, c, judgeWeight)[0];
      leaders[c] = top && top.score != null ? top.contestant_id : null;
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
    <IdleHero
      lineup={
        rows.length > 0 && (
          <div className="grid gap-[0.8rem]">
            {CATEGORIES.map((c) => (
              <div
                key={c}
                className="flex items-center gap-[1rem] rounded-2xl border border-line/70 bg-panel/70 px-[1.2rem] py-[0.8rem] backdrop-blur"
              >
                <div className="w-[7rem] shrink-0 text-[1.2rem] font-extrabold uppercase">
                  {CATEGORY_LABEL[c]} <span className="text-muted">· {byCat(c).length}</span>
                </div>
                <div className="flex flex-wrap gap-[0.5rem]">
                  {byCat(c).map((r, i) => (
                    <span
                      key={r.contestant_id}
                      className="pop-in rounded-full bg-panel-2 px-[0.9rem] py-[0.3rem] text-[1rem]"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      }
    >
      <p className="mt-[clamp(0.3rem,1.2dvh,0.8rem)] text-[clamp(1.4rem,3.6dvh,2rem)] font-bold">Starting soon</p>
      <p className="mt-[0.2rem] text-[1.2rem] text-muted">Think you&apos;ve got the voice? Prove it on stage!</p>
    </IdleHero>
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

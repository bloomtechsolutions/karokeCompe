import type { Category, LeaderboardRow } from "./types";

/** Judging criteria: each scored 0–5, so a judge's sheet totals 25. */
export const CRITERIA = [
  { key: "vocal", label: "Vocal Quality", hint: "Pitch, tone and clarity", max: 5 },
  { key: "rhythm", label: "Rhythm & Timing", hint: "Staying in sync with the music", max: 5 },
  { key: "stage_presence", label: "Stage Presence", hint: "Confidence and audience engagement", max: 5 },
  { key: "interpretation", label: "Song Interpretation", hint: "Emotion and expression", max: 5 },
  { key: "overall", label: "Overall Performance", hint: "Entertainment value and impact", max: 5 },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];

/** Highest possible total on one judge's sheet (25). */
export const MAX_TOTAL: number = CRITERIA.reduce((s, c) => s + c.max, 0);

/** A judges' sheet total (or average) converted to judges' points out of `judgeWeight` (70). */
export function toJudgePoints(total: number, judgeWeight: number) {
  return round2((total / MAX_TOTAL) * judgeWeight);
}

export type Round1Result = LeaderboardRow & {
  rank: number;
  judgePoints: number | null;
  audiencePoints: number | null;
  /** Judges' points plus audience points, out of 100. */
  score: number | null;
};

export type FinalResult = LeaderboardRow & {
  rank: number;
  judgePoints: number | null;
  audiencePoints: number | null;
  finalScore: number | null;
};

function rankBy<T extends LeaderboardRow>(
  rows: T[],
  score: (r: T) => number | null,
  tiebreak: (r: T) => number | null,
): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => {
    const d = (score(b) ?? -1) - (score(a) ?? -1);
    if (d !== 0) return d;
    return (tiebreak(b) ?? -1) - (tiebreak(a) ?? -1);
  });
  let lastKey = "";
  let lastRank = 0;
  return sorted.map((r, i) => {
    const key = `${score(r)}|${tiebreak(r)}`;
    const rank = key === lastKey ? lastRank : i + 1;
    lastKey = key;
    lastRank = rank;
    return { ...r, rank };
  });
}

/**
 * Judges' average (out of MAX_TOTAL) scaled to `judgeWeight` points, plus audience
 * votes scaled to the remaining points. The performer with the most votes in
 * the category gets the full audience points; others are proportional to
 * that leader.
 */
function weigh(
  avg: number | null,
  judged: boolean,
  votes: number | null,
  maxVotes: number,
  votesKnown: boolean,
  judgeWeight: number,
) {
  const judgePoints = judged && avg != null ? toJudgePoints(Number(avg), judgeWeight) : null;
  const audiencePoints = votesKnown
    ? round2(maxVotes > 0 ? ((votes ?? 0) / maxVotes) * (100 - judgeWeight) : 0)
    : null;
  const total = judgePoints == null ? null : round2(judgePoints + (audiencePoints ?? 0));
  return { judgePoints, audiencePoints, total };
}

/** 1st round: judges × judgeWeight% + audience votes. Tie-break: vocal quality. */
export function rankRound1(rows: LeaderboardRow[], category: Category, judgeWeight = 70): Round1Result[] {
  const inCategory = rows.filter((r) => r.category === category);
  const votesKnown = inCategory.every((r) => r.r1_votes != null);
  const maxVotes = Math.max(0, ...inCategory.map((r) => r.r1_votes ?? 0));
  const withScores = inCategory.map((r) => {
    const w = weigh(r.r1_avg, r.r1_judges > 0, r.r1_votes, maxVotes, votesKnown, judgeWeight);
    return { ...r, judgePoints: w.judgePoints, audiencePoints: w.audiencePoints, score: w.total };
  });
  return rankBy(
    withScores,
    (r) => r.score,
    (r) => (r.r1_vocal_avg == null ? null : Number(r.r1_vocal_avg)),
  );
}

/** Final round: finalists only, same judges/audience split. */
export function rankFinal(
  rows: LeaderboardRow[],
  category: Category,
  judgeWeight = 70,
): FinalResult[] {
  const finalists = rows.filter((r) => r.category === category && r.is_finalist);
  const votesKnown = finalists.every((r) => r.votes != null);
  const maxVotes = Math.max(0, ...finalists.map((r) => r.votes ?? 0));

  const withScores = finalists.map((r) => {
    const w = weigh(r.final_avg, r.final_judges > 0, r.votes, maxVotes, votesKnown, judgeWeight);
    return { ...r, judgePoints: w.judgePoints, audiencePoints: w.audiencePoints, finalScore: w.total };
  });

  return rankBy(
    withScores,
    (r) => r.finalScore,
    (r) => (r.final_vocal_avg == null ? null : Number(r.final_vocal_avg)),
  );
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function fmt(n: number | null | undefined, digits = 2) {
  if (n == null) return "—";
  return Number(n).toFixed(digits).replace(/\.?0+$/, "");
}

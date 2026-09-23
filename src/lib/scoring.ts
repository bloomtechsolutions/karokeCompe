import type { Category, LeaderboardRow } from "./types";

/** Judging criteria from the official sheet (total 100). */
export const CRITERIA = [
  { key: "vocal", label: "Vocal Quality", hint: "Pitch, tone and clarity", max: 30 },
  { key: "rhythm", label: "Rhythm & Timing", hint: "Staying in sync with the music", max: 20 },
  { key: "stage_presence", label: "Stage Presence", hint: "Confidence and audience engagement", max: 20 },
  { key: "interpretation", label: "Song Interpretation", hint: "Emotion and expression", max: 15 },
  { key: "overall", label: "Overall Performance", hint: "Entertainment value and impact", max: 15 },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];

export type Round1Result = LeaderboardRow & { rank: number };

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

/** 1st round: average judge total out of 100. Tie-break: vocal quality. */
export function rankRound1(rows: LeaderboardRow[], category: Category): Round1Result[] {
  return rankBy(
    rows.filter((r) => r.category === category),
    (r) => (r.r1_judges > 0 ? Number(r.r1_avg) : null),
    (r) => (r.r1_vocal_avg == null ? null : Number(r.r1_vocal_avg)),
  );
}

/**
 * Final round: judges' average (out of 100) scaled to `judgeWeight` points,
 * plus audience votes scaled to the remaining points. The finalist with the
 * most votes in the category gets the full audience points; others are
 * proportional to that leader.
 */
export function rankFinal(
  rows: LeaderboardRow[],
  category: Category,
  judgeWeight = 70,
): FinalResult[] {
  const audienceWeight = 100 - judgeWeight;
  const finalists = rows.filter((r) => r.category === category && r.is_finalist);
  const votesKnown = finalists.every((r) => r.votes != null);
  const maxVotes = Math.max(0, ...finalists.map((r) => r.votes ?? 0));

  const withScores = finalists.map((r) => {
    const judgePoints =
      r.final_judges > 0 && r.final_avg != null
        ? round2((Number(r.final_avg) / 100) * judgeWeight)
        : null;
    const audiencePoints = votesKnown
      ? round2(maxVotes > 0 ? ((r.votes ?? 0) / maxVotes) * audienceWeight : 0)
      : null;
    const finalScore =
      judgePoints == null ? null : round2(judgePoints + (audiencePoints ?? 0));
    return { ...r, judgePoints, audiencePoints, finalScore };
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

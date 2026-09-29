import type { Category, LeaderboardRow, Stage } from "./types";

export type CategoryVoting = { total: number; performed: number; ready: boolean };

/**
 * A category's audience voting opens once every finalist in it has performed:
 * scored by at least one judge in the final and no longer on stage.
 * Mirrors public.category_voting_ready() in the database.
 */
export function categoryVoting(
  rows: LeaderboardRow[],
  category: Category,
  nowPerforming: string | null,
): CategoryVoting {
  const finalists = rows.filter((r) => r.category === category && r.is_finalist);
  const performed = finalists.filter(
    (r) => r.final_judges > 0 && r.contestant_id !== nowPerforming,
  ).length;
  return { total: finalists.length, performed, ready: finalists.length > 0 && performed === finalists.length };
}

/** 1st round ballot for a category: performers who have started, in running order. */
export function round1Candidates(rows: LeaderboardRow[], category: Category, nowPerforming: string | null) {
  return rows
    .filter((r) => r.category === category && (r.r1_started || r.contestant_id === nowPerforming))
    .sort((a, b) => (a.performance_order ?? 999) - (b.performance_order ?? 999) || a.name.localeCompare(b.name));
}

/**
 * 1st round: a category's voting opens as soon as its first performer is
 * called to the stage. Mirrors public.cast_vote() in the database.
 */
export function round1Voting(
  rows: LeaderboardRow[],
  category: Category,
  nowPerforming: string | null,
): CategoryVoting {
  const total = rows.filter((r) => r.category === category).length;
  const performed = round1Candidates(rows, category, nowPerforming).length;
  return { total, performed, ready: performed > 0 };
}

/** Voting status for a category in the current round. */
export function stageVoting(
  stage: Stage,
  rows: LeaderboardRow[],
  category: Category,
  nowPerforming: string | null,
): CategoryVoting {
  if (stage === "round1") return round1Voting(rows, category, nowPerforming);
  if (stage === "final") return categoryVoting(rows, category, nowPerforming);
  return { total: 0, performed: 0, ready: false };
}

/**
 * Which final categories the TV should show right now: the category on stage;
 * otherwise one that is part-way through; otherwise the one whose voting is
 * open while the other hasn't started. Both at the start and at the end.
 */
export function activeFinalCategories(rows: LeaderboardRow[], nowPerforming: string | null): Category[] {
  const all: Category[] = ["solo", "duet"];
  const onStage = rows.find((r) => r.contestant_id === nowPerforming && r.is_finalist);
  if (onStage) return [onStage.category];
  const status = all.map((c) => ({ c, ...categoryVoting(rows, c, nowPerforming) }));
  const partway = status.filter((s) => s.performed > 0 && !s.ready);
  if (partway.length > 0) return partway.map((s) => s.c);
  const ready = status.filter((s) => s.ready);
  if (ready.length === 1) return [ready[0].c];
  const withFinalists = all.filter((c) => rows.some((r) => r.category === c && r.is_finalist));
  return withFinalists.length > 0 ? withFinalists : all;
}

/**
 * Who is up next: the performers after whoever is on stage (or was last
 * called), in running order, skipping anyone who has already performed.
 * Earlier performers who were skipped come last.
 */
export function nextInLine<T>(
  queue: T[],
  idOf: (item: T) => string,
  anchorId: string | null,
  performed: (item: T) => boolean,
): T[] {
  const idx = anchorId ? queue.findIndex((c) => idOf(c) === anchorId) : -1;
  return [...queue.slice(idx + 1), ...queue.slice(0, Math.max(idx, 0))].filter(
    (c) => idOf(c) !== anchorId && !performed(c),
  );
}

import type { Category, LeaderboardRow } from "./types";

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

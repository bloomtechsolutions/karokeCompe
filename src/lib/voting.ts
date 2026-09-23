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

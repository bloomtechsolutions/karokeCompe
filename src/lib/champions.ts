import { rankFinal, type FinalResult } from "./scoring";
import type { Category, LeaderboardRow } from "./types";

/** A row of public.final_standings() (judges and organisers only). */
export type StandingRow = {
  contestant_id: string;
  category: Category;
  name: string;
  final_avg: number | null;
  final_vocal_avg: number | null;
  final_judges: number;
  votes: number;
};

/** The confirmed champion of a category, shown on the TV once the competition is completed. */
export type Champion = { category: Category; contestant_id: string | null; photo_url: string | null };

/** Final standings for one category: judges' points + audience points, ranked. */
export function rankStandings(rows: StandingRow[], category: Category, judgeWeight: number): FinalResult[] {
  const asBoard = rows.map((r) => ({ ...r, is_finalist: true }) as unknown as LeaderboardRow);
  return rankFinal(asBoard, category, judgeWeight);
}

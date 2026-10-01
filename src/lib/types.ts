export type Category = "solo" | "duet";
export type Stage = "setup" | "round1" | "final" | "completed";
export type Round = "round1" | "final";
export type Role = "judge" | "admin" | "host" | "checkin";

export type Settings = {
  id: number;
  event_name: string;
  stage: Stage;
  voting_open: boolean;
  require_voter_id: boolean;
  block_repeat_ip: boolean;
  /** Only staff IDs entered at the venue check-in desk can vote. */
  require_checkin: boolean;
  show_scores: boolean;
  /** Legacy single count; use finalists_solo / finalists_duet. */
  finalists_per_category: number;
  finalists_solo: number;
  finalists_duet: number;
  /** Show the 1st round results (finalists) on the TV. */
  announce_r1: boolean;
  judge_weight: number;
  now_performing: string | null;
  /** Last performer called to the stage this round (kept after the stage is cleared). */
  last_on_stage: string | null;
};

export type Contestant = {
  id: string;
  name: string;
  category: Category;
  department: string | null;
  song_round1: string | null;
  song_final: string | null;
  performance_order: number | null;
  final_order: number | null;
  is_finalist: boolean;
};

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
};

export type Score = {
  id: string;
  judge_id: string;
  contestant_id: string;
  round: Round;
  vocal: number;
  rhythm: number;
  stage_presence: number;
  interpretation: number;
  overall: number;
  total: number;
  comments: string | null;
};

export type LeaderboardRow = {
  contestant_id: string;
  name: string;
  category: Category;
  department: string | null;
  song_round1: string | null;
  song_final: string | null;
  performance_order: number | null;
  final_order: number | null;
  is_finalist: boolean;
  r1_avg: number | null;
  r1_vocal_avg: number | null;
  r1_judges: number;
  final_avg: number | null;
  final_vocal_avg: number | null;
  final_judges: number;
  /** Final round audience votes (null when hidden). */
  votes: number | null;
  /** 1st round audience votes (null when hidden). */
  r1_votes: number | null;
  /** Called to the stage (or scored) in the 1st round, so on the round 1 ballot. */
  r1_started: boolean;
};

export const CATEGORIES: Category[] = ["solo", "duet"];
export const CATEGORY_LABEL: Record<Category, string> = { solo: "Solo", duet: "Duet" };
export const STAGE_LABEL: Record<Stage, string> = {
  setup: "Registration",
  round1: "1st Round",
  final: "Final Round",
  completed: "Completed",
};

/** How many performers in a category go through to the final (top 5 solo, top 3 duet by default). */
export function finalistsFor(
  settings: Pick<Settings, "finalists_solo" | "finalists_duet">,
  category: Category,
): number {
  return category === "solo" ? settings.finalists_solo : settings.finalists_duet;
}

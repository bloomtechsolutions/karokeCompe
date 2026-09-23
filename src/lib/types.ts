export type Category = "solo" | "duet";
export type Stage = "setup" | "round1" | "final" | "completed";
export type Round = "round1" | "final";
export type Role = "judge" | "admin";

export type Settings = {
  id: number;
  event_name: string;
  stage: Stage;
  voting_open: boolean;
  require_voter_id: boolean;
  block_repeat_ip: boolean;
  show_scores: boolean;
  finalists_per_category: number;
  judge_weight: number;
  now_performing: string | null;
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
  votes: number | null;
};

export const CATEGORIES: Category[] = ["solo", "duet"];
export const CATEGORY_LABEL: Record<Category, string> = { solo: "Solo", duet: "Duet" };
export const STAGE_LABEL: Record<Stage, string> = {
  setup: "Registration",
  round1: "1st Round",
  final: "Final Round",
  completed: "Completed",
};

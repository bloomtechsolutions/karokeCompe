import { createClient } from "@/lib/supabase/server";
import type { LeaderboardRow, Profile, Settings } from "@/lib/types";

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error(`Could not load settings: ${error?.message}`);
  return data as Settings;
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard");
  if (error) throw new Error(`Could not load leaderboard: ${error.message}`);
  return (data ?? []) as LeaderboardRow[];
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

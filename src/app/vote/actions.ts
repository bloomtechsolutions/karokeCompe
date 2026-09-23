"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureVoterToken } from "@/lib/voter";

export type VoteState = { ok?: boolean; error?: string };

const MESSAGES: Record<string, string> = {
  closed: "Voting is closed.",
  invalid: "Please choose a finalist.",
  already_voted: "You have already voted in this category from this device.",
  voter_id_used: "This staff ID has already been used to vote in this category.",
  voter_id_required: "Please enter your staff ID to vote.",
};

export async function castVote(_prev: VoteState, formData: FormData): Promise<VoteState> {
  const contestantId = String(formData.get("contestant_id") ?? "");
  const voterRef = String(formData.get("voter_ref") ?? "").trim().slice(0, 50);
  if (!contestantId) return { error: MESSAGES.invalid };

  const token = await ensureVoterToken();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("cast_vote", {
    p_contestant: contestantId,
    p_voter_token: token,
    p_voter_ref: voterRef || null,
  });
  if (error) return { error: "Could not record your vote. Please try again." };
  if (data !== "ok") return { error: MESSAGES[String(data)] ?? "Could not record your vote." };

  revalidatePath("/vote");
  revalidatePath("/");
  return { ok: true };
}

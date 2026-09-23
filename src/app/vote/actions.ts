"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureVoterToken } from "@/lib/voter";

export type VoteState = { ok?: boolean; error?: string };

const MESSAGES: Record<string, string> = {
  closed: "Voting is closed.",
  invalid: "Please choose a finalist.",
  not_ready: "Voting for this category opens after all its finalists have performed.",
  voter_id_required: "Please enter your staff ID to vote.",
  already_voted: "You have already voted in this category from this device.",
  voter_id_used: "This staff ID has already voted in this category.",
  ip_used: "A vote in this category has already been casted by you. Thankyou",
};

/** Client IP as seen by Vercel's edge (which overwrites any client-supplied value). */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return h.get("x-real-ip")?.trim() || forwarded || null;
}

export async function castVote(_prev: VoteState, formData: FormData): Promise<VoteState> {
  const contestantId = String(formData.get("contestant_id") ?? "");
  const voterRef = String(formData.get("voter_ref") ?? "").trim().slice(0, 30);
  if (!contestantId) return { error: MESSAGES.invalid };
  if (voterRef && !/^[A-Za-z0-9._-]+$/.test(voterRef)) {
    return { error: "Staff ID can only contain letters, numbers, dots and dashes." };
  }

  const [token, ip] = await Promise.all([ensureVoterToken(), clientIp()]);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("cast_vote", {
    p_contestant: contestantId,
    p_voter_token: token,
    p_voter_ref: voterRef || null,
    p_voter_ip: ip,
  });
  if (error) return { error: "Could not record your vote. Please try again." };
  if (data !== "ok") return { error: MESSAGES[String(data)] ?? "Could not record your vote." };

  revalidatePath("/vote");
  revalidatePath("/");
  return { ok: true };
}

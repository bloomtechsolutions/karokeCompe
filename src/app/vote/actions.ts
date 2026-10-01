"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureVoterToken, readVoterToken } from "@/lib/voter";

export type VoteState = { ok?: boolean; error?: string };

const MESSAGES: Record<string, string> = {
  closed: "Voting is closed.",
  invalid: "Please choose a performer.",
  not_ready: "Voting for this performer is not open yet.",
  voter_id_required: "Please enter your staff ID to vote.",
  already_voted: "You have already voted in this category from this device.",
  voter_id_used: "This staff ID has already voted in this category.",
  ip_used: "A vote in this category has already been casted by you. Thankyou",
  not_checked_in: "Your staff ID isn't on the venue list. Please check in at the registration desk, then try again.",
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

const CHANGE_MESSAGES: Record<string, string> = {
  closed: "Voting is closed, so votes can no longer be changed.",
  invalid: "Please choose a performer.",
  not_ready: "Voting for this performer is not open yet.",
  no_vote: "We couldn't find your vote from this device. Votes can only be changed on the phone you voted with.",
  same: "That's already your vote. Pick someone else to change it.",
  change_used: "You have already changed your vote once in this category.",
};

/** Change an existing vote (once per category per round, same device only). */
export async function changeVote(_prev: VoteState, formData: FormData): Promise<VoteState> {
  const contestantId = String(formData.get("contestant_id") ?? "");
  if (!contestantId) return { error: CHANGE_MESSAGES.invalid };
  const [token, ip] = await Promise.all([readVoterToken(), clientIp()]);
  if (!token) return { error: CHANGE_MESSAGES.no_vote };

  const { data, error } = await createAdminClient().rpc("change_vote", {
    p_contestant: contestantId,
    p_voter_token: token,
    p_voter_ip: ip,
  });
  if (error) return { error: "Could not change your vote. Please try again." };
  if (data !== "ok") return { error: CHANGE_MESSAGES[String(data)] ?? "Could not change your vote." };

  revalidatePath("/vote");
  revalidatePath("/");
  return { ok: true };
}

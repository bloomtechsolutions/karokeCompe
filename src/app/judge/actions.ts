"use server";

import { revalidatePath } from "next/cache";
import { requireJudge } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { CRITERIA, type CriterionKey } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";

export type SaveScoreState = { ok?: boolean; error?: string; total?: number; savedAt?: number };

export async function saveScore(_prev: SaveScoreState, formData: FormData): Promise<SaveScoreState> {
  const judge = await requireJudge();
  const settings = await getSettings();
  if (settings.stage !== "round1" && settings.stage !== "final") {
    return { error: "Scoring is closed right now." };
  }
  const round = settings.stage;

  const contestantId = String(formData.get("contestant_id") ?? "");
  if (!contestantId) return { error: "Missing performer." };

  const values = {} as Record<CriterionKey, number>;
  for (const c of CRITERIA) {
    const raw = formData.get(c.key);
    const n = Number(raw);
    if (raw === null || raw === "" || !Number.isInteger(n) || n < 0 || n > c.max) {
      return { error: `${c.label} must be a whole number from 0 to ${c.max}.` };
    }
    values[c.key] = n;
  }
  const comments = String(formData.get("comments") ?? "").trim().slice(0, 500) || null;

  const supabase = await createClient();
  const { error } = await supabase.from("scores").upsert(
    { judge_id: judge.id, contestant_id: contestantId, round, ...values, comments },
    { onConflict: "judge_id,contestant_id,round" },
  );
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "This performer can't be scored in the current round."
          : `Could not save: ${error.message}`,
    };
  }

  revalidatePath("/judge");
  revalidatePath("/");
  const total = CRITERIA.reduce((sum, c) => sum + values[c.key], 0);
  return { ok: true, total, savedAt: Date.now() };
}

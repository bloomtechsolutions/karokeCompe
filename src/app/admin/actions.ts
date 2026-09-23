"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getLeaderboard, getSettings } from "@/lib/data";
import { rankRound1 } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Category, type Stage } from "@/lib/types";

const STAGES: Stage[] = ["setup", "round1", "final", "completed"];

function done(message: string, tab?: string): never {
  revalidatePath("/", "layout");
  const qs = new URLSearchParams({ msg: message });
  if (tab) qs.set("tab", tab);
  redirect(`/admin?${qs}`);
}

function fail(message: string, tab?: string): never {
  const qs = new URLSearchParams({ err: message });
  if (tab) qs.set("tab", tab);
  redirect(`/admin?${qs}`);
}

async function audit(action: string, entity: string, entityId: string | null, details?: object) {
  const supabase = await createClient();
  await supabase.rpc("log_action", {
    p_action: action,
    p_entity: entity,
    p_entity_id: entityId,
    p_details: details ?? null,
  });
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || null;
const optInt = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

// ---------------------------------------------------------------------------
// Competition settings
// ---------------------------------------------------------------------------

export async function setStage(formData: FormData) {
  await requireAdmin();
  const stage = str(formData, "stage") as Stage;
  if (!STAGES.includes(stage)) fail("Invalid stage.");
  const before = await getSettings();
  const supabase = await createClient();
  const patch: { stage: Stage; voting_open?: boolean } = { stage };
  if (stage !== "final") patch.voting_open = false;
  const { error } = await supabase.from("settings").update(patch).eq("id", 1);
  if (error) fail(error.message);
  await audit("stage_change", "settings", "1", { from: before.stage, to: stage });
  done(`Stage set to ${stage}.`);
}

export async function setVoting(formData: FormData) {
  await requireAdmin();
  const open = str(formData, "open") === "true";
  const settings = await getSettings();
  if (open && settings.stage !== "final") fail("Move to the Final Round before opening voting.");
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ voting_open: open }).eq("id", 1);
  if (error) fail(error.message);
  await audit(open ? "voting_open" : "voting_close", "settings", "1");
  done(open ? "Audience voting opened." : "Audience voting closed.");
}

export async function updateSettings(formData: FormData) {
  await requireAdmin();
  const finalists = optInt(formData, "finalists_per_category");
  const judgeWeight = Number(str(formData, "judge_weight"));
  if (!finalists || finalists < 1 || finalists > 20) fail("Finalists per category must be 1–20.", "settings");
  if (!Number.isFinite(judgeWeight) || judgeWeight < 0 || judgeWeight > 100)
    fail("Judge weight must be 0–100.", "settings");

  const patch = {
    event_name: str(formData, "event_name") || "Karaoke Competition",
    show_scores: formData.get("show_scores") === "on",
    require_voter_id: formData.get("require_voter_id") === "on",
    finalists_per_category: finalists,
    judge_weight: judgeWeight,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(patch).eq("id", 1);
  if (error) fail(error.message, "settings");
  await audit("settings_update", "settings", "1", patch);
  done("Settings saved.", "settings");
}

// ---------------------------------------------------------------------------
// Contestants
// ---------------------------------------------------------------------------

export async function saveContestant(formData: FormData) {
  await requireAdmin();
  const id = optStr(formData, "id");
  const category = str(formData, "category") as Category;
  const name = str(formData, "name");
  if (!name) fail("Name is required.", "contestants");
  if (!CATEGORIES.includes(category)) fail("Choose solo or duet.", "contestants");

  const row = {
    name,
    category,
    department: optStr(formData, "department"),
    song_round1: optStr(formData, "song_round1"),
    song_final: optStr(formData, "song_final"),
    performance_order: optInt(formData, "performance_order"),
    final_order: optInt(formData, "final_order"),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("contestants").update(row).eq("id", id)
    : await supabase.from("contestants").insert(row);
  if (error) {
    fail(
      error.message.includes("final_song_differs")
        ? "The final round song must be different from the 1st round song."
        : error.message,
      "contestants",
    );
  }
  await audit(id ? "contestant_update" : "contestant_create", "contestant", id, row);
  done(id ? `Updated ${name}.` : `Added ${name}.`, "contestants");
}

export async function deleteContestant(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const supabase = await createClient();
  const { error } = await supabase.from("contestants").delete().eq("id", id);
  if (error) fail(error.message, "contestants");
  await audit("contestant_delete", "contestant", id, { name: str(formData, "name") });
  done("Performer removed.", "contestants");
}

// ---------------------------------------------------------------------------
// Finalists
// ---------------------------------------------------------------------------

export async function toggleFinalist(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const value = str(formData, "value") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("contestants").update({ is_finalist: value }).eq("id", id);
  if (error) fail(error.message, "results");
  await audit(value ? "finalist_add" : "finalist_remove", "contestant", id);
  done(value ? "Marked as finalist." : "Removed from finalists.", "results");
}

export async function advanceTop(formData: FormData) {
  await requireAdmin();
  const category = str(formData, "category") as Category;
  if (!CATEGORIES.includes(category)) fail("Invalid category.", "results");
  const settings = await getSettings();
  const ranked = rankRound1(await getLeaderboard(), category).filter((r) => r.r1_judges > 0);
  // Ties at the cut-off are all included.
  const top = ranked.filter((r) => r.rank <= settings.finalists_per_category);
  if (top.length === 0) fail("No round 1 scores yet in this category.", "results");

  const supabase = await createClient();
  const reset = await supabase.from("contestants").update({ is_finalist: false }).eq("category", category);
  if (reset.error) fail(reset.error.message, "results");
  const { error } = await supabase
    .from("contestants")
    .update({ is_finalist: true })
    .in("id", top.map((r) => r.contestant_id));
  if (error) fail(error.message, "results");
  await audit("finalists_advance", "category", category, { ids: top.map((r) => r.contestant_id) });
  const tieNote = top.length > settings.finalists_per_category ? " (includes a tie at the cut-off)" : "";
  done(`${top.length} ${category} finalists selected${tieNote}.`, "results");
}

// ---------------------------------------------------------------------------
// Judges
// ---------------------------------------------------------------------------

export async function createJudge(formData: FormData) {
  await requireAdmin();
  const fullName = str(formData, "full_name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  if (!fullName || !email) fail("Name and email are required.", "judges");
  if (password.length < 8) fail("Password must be at least 8 characters.", "judges");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "judge" },
  });
  if (error || !data.user) fail(error?.message ?? "Could not create judge.", "judges");
  // Trigger creates the profile; make sure name/role are set.
  await admin.from("profiles").upsert({ id: data.user.id, full_name: fullName, role: "judge", active: true });
  await audit("judge_create", "profile", data.user.id, { email });
  done(`Judge ${fullName} created.`, "judges");
}

export async function setJudgeActive(formData: FormData) {
  const me = await requireAdmin();
  const id = str(formData, "id");
  if (id === me.id) fail("You can't deactivate yourself.", "judges");
  const active = str(formData, "active") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) fail(error.message, "judges");
  await audit(active ? "judge_activate" : "judge_deactivate", "profile", id);
  done(active ? "Judge activated." : "Judge deactivated.", "judges");
}

export async function resetJudgePassword(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const password = str(formData, "password");
  if (password.length < 8) fail("Password must be at least 8 characters.", "judges");
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
  if (error) fail(error.message, "judges");
  await audit("judge_password_reset", "profile", id);
  done("Password updated.", "judges");
}

// ---------------------------------------------------------------------------
// Danger zone: clear scores / votes (e.g. after a rehearsal)
// ---------------------------------------------------------------------------

export async function clearData(formData: FormData) {
  await requireAdmin();
  if (str(formData, "confirm") !== "RESET") fail("Type RESET to confirm.", "settings");
  const what = str(formData, "what");
  const admin = createAdminClient();
  if (what === "votes" || what === "all") {
    const { error } = await admin.from("audience_votes").delete().not("id", "is", null);
    if (error) fail(error.message, "settings");
  }
  if (what === "scores" || what === "all") {
    const { error } = await admin.from("scores").delete().not("id", "is", null);
    if (error) fail(error.message, "settings");
  }
  await audit("clear_data", "competition", null, { what });
  done(`Cleared ${what === "all" ? "scores and votes" : what}.`, "settings");
}

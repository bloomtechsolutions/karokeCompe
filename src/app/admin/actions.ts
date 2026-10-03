"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getLeaderboard, getSettings } from "@/lib/data";
import { rankRound1 } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABEL, finalistsFor, type Category, type Stage } from "@/lib/types";

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
  // Starting a round arms audience voting. In round 1 each category opens as
  // soon as its first performer is on stage; in the final, once all its
  // finalists have performed. It stays open until the organiser closes it.
  const patch: {
    stage: Stage;
    voting_open: boolean;
    now_performing: null;
    announce_r1: false;
    show_scores?: true;
  } = {
    stage,
    announce_r1: false,
    // Completing the competition is the reveal: the TV needs scores to show the winners.
    ...(stage === "completed" ? { show_scores: true as const } : {}),
    voting_open: stage === "round1" || stage === "final",
    now_performing: null,
  };
  const { error } = await supabase.from("settings").update(patch).eq("id", 1);
  if (error) fail(error.message);
  await audit("stage_change", "settings", "1", { from: before.stage, to: stage });
  done(`Stage set to ${stage}.`);
}

export async function setVoting(formData: FormData) {
  await requireAdmin();
  const open = str(formData, "open") === "true";
  const settings = await getSettings();
  if (open && settings.stage !== "round1" && settings.stage !== "final")
    fail("Start the 1st Round or Final Round before opening voting.");
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ voting_open: open }).eq("id", 1);
  if (error) fail(error.message);
  await audit(open ? "voting_open" : "voting_close", "settings", "1");
  done(open ? "Audience voting opened." : "Audience voting closed.");
}

/** Show or hide the 1st round results (the finalists) on the TV. */
export async function setAnnounce(formData: FormData) {
  await requireAdmin();
  const on = str(formData, "on") === "true";
  const settings = await getSettings();
  if (on && settings.stage !== "round1") fail("Round 1 results can be shown during the 1st Round.", "results");
  if (on) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("contestants")
      .select("id", { count: "exact", head: true })
      .eq("is_finalist", true);
    if (!count) fail("Select the finalists first (Advance top or Make finalist).", "results");
  }
  const supabase = await createClient();
  // Clear the stage so the TV switches to the results, and stop round 1
  // voting so the announced finalists can't be overtaken.
  const patch = on ? { announce_r1: true, now_performing: null, voting_open: false } : { announce_r1: false };
  const { error } = await supabase.from("settings").update(patch).eq("id", 1);
  if (error) fail(error.message, "results");
  await audit(on ? "announce_r1" : "hide_r1", "settings", "1");
  done(on ? "Round 1 results are on the TV." : "Round 1 results hidden from the TV.", "results");
}

export async function updateSettings(formData: FormData) {
  await requireAdmin();
  const finalistsSolo = optInt(formData, "finalists_solo");
  const finalistsDuet = optInt(formData, "finalists_duet");
  const judgeWeight = Number(str(formData, "judge_weight"));
  for (const n of [finalistsSolo, finalistsDuet]) {
    if (!n || n < 1 || n > 20) fail("Finalists per category must be 1–20.", "settings");
  }
  if (!Number.isFinite(judgeWeight) || judgeWeight < 0 || judgeWeight > 100)
    fail("Judge weight must be 0–100.", "settings");

  const patch = {
    event_name: str(formData, "event_name") || "Karaoke Competition",
    show_scores: formData.get("show_scores") === "on",
    require_voter_id: formData.get("require_voter_id") === "on",
    block_repeat_ip: formData.get("block_repeat_ip") === "on",
    require_checkin: formData.get("require_checkin") === "on",
    finalists_solo: finalistsSolo,
    finalists_duet: finalistsDuet,
    judge_weight: judgeWeight,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(patch).eq("id", 1);
  if (error) fail(error.message, "settings");
  await audit("settings_update", "settings", "1", patch);
  done("Settings saved.", "settings");
}

// ---------------------------------------------------------------------------
// On stage (TV spotlight)
// ---------------------------------------------------------------------------

export async function setOnStage(formData: FormData) {
  await requireAdmin();
  const id = optStr(formData, "id");
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ now_performing: id }).eq("id", 1);
  if (error) fail(error.message);
  done(id ? "Performer is on stage." : "Stage cleared.");
}

export async function nextOnStage() {
  await requireAdmin();
  const settings = await getSettings();
  if (settings.stage !== "round1" && settings.stage !== "final") fail("Start a round first.");
  const isFinal = settings.stage === "final";
  const supabase = await createClient();
  const { data, error } = await supabase.from("contestants").select("id, name, performance_order, final_order, is_finalist");
  if (error) fail(error.message);
  type Row = { id: string; name: string; performance_order: number | null; final_order: number | null; is_finalist: boolean };
  const order = (c: Row) => (isFinal ? c.final_order : c.performance_order) ?? 999;
  const queue = ((data ?? []) as Row[])
    .filter((c) => !isFinal || c.is_finalist)
    .sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  if (queue.length === 0) fail("No performers in this round.");
  const anchor = settings.now_performing ?? settings.last_on_stage;
  const idx = queue.findIndex((c) => c.id === anchor);
  const next = queue[idx + 1] ?? null;
  const { error: upErr } = await supabase
    .from("settings")
    .update({ now_performing: next?.id ?? null })
    .eq("id", 1);
  if (upErr) fail(upErr.message);
  done(next ? `${next.name} is on stage.` : "All performers done. Stage cleared.");
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
  const ranked = rankRound1(await getLeaderboard(), category, Number(settings.judge_weight)).filter(
    (r) => r.r1_judges > 0,
  );
  // Ties at the cut-off are all included.
  const count = finalistsFor(settings, category);
  const top = ranked.filter((r) => r.rank <= count);
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
  const tieNote = top.length > count ? " (includes a tie at the cut-off)" : "";
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
  const picked = str(formData, "role");
  const role = picked === "host" || picked === "checkin" ? picked : "judge";
  const label = role === "host" ? "Host" : role === "checkin" ? "Check-in account" : "Judge";
  if (!fullName || !email) fail("Name and email are required.", "judges");
  if (password.length < 8) fail("Password must be at least 8 characters.", "judges");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role },
  });
  if (error || !data.user) fail(error?.message ?? `Could not create ${label.toLowerCase()}.`, "judges");
  // Trigger creates the profile; make sure name/role are set.
  await admin.from("profiles").upsert({ id: data.user.id, full_name: fullName, role, active: true });
  await audit(`${role}_create`, "profile", data.user.id, { email });
  done(`${label} ${fullName} created.`, "judges");
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
    const attempts = await admin.from("vote_attempts").delete().not("id", "is", null);
    if (attempts.error) fail(attempts.error.message, "settings");
  }
  if (what === "scores" || what === "all") {
    const { error } = await admin.from("scores").delete().not("id", "is", null);
    if (error) fail(error.message, "settings");
    // Nobody has performed any more: reset the round 1 ballot and running order.
    const called = await admin.from("contestants").update({ r1_called_at: null }).not("id", "is", null);
    if (called.error) fail(called.error.message, "settings");
    const stage = await admin.from("settings").update({ now_performing: null, last_on_stage: null }).eq("id", 1);
    if (stage.error) fail(stage.error.message, "settings");
  }
  if (what === "staff") {
    const { error } = await admin.from("venue_staff").delete().not("staff_id", "is", null);
    if (error) fail(error.message, "settings");
  }
  await audit("clear_data", "competition", null, { what });
  const label = what === "all" ? "scores and votes" : what === "staff" ? "the checked-in staff list" : what;
  done(`Cleared ${label}.`, "settings");
}

// ---------------------------------------------------------------------------
// Champions (chosen by the judges, confirmed by the organiser, with a photo)
// ---------------------------------------------------------------------------

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Uploads a champion photo to the public "winners" bucket; null when no file was chosen. */
async function uploadPhoto(
  admin: ReturnType<typeof createAdminClient>,
  category: Category,
  photo: FormDataEntryValue | null,
): Promise<string | null> {
  if (!(photo instanceof File) || photo.size === 0) return null;
  const ext = PHOTO_TYPES[photo.type];
  if (!ext) fail("The photo must be a JPEG, PNG or WebP image.", "results");
  if (photo.size > 8 * 1024 * 1024) fail("The photo is too large (max 8 MB).", "results");
  const path = `${category}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from("winners").upload(path, photo, { contentType: photo.type, upsert: false });
  if (error) fail(`Could not upload the photo: ${error.message}`, "results");
  return admin.storage.from("winners").getPublicUrl(path).data.publicUrl;
}

export async function saveChampion(formData: FormData) {
  const me = await requireAdmin();
  const category = str(formData, "category") as Category;
  if (!CATEGORIES.includes(category)) fail("Invalid category.", "results");
  const contestantId = str(formData, "contestant_id");
  if (!contestantId) fail("Choose the champion.", "results");

  const admin = createAdminClient();
  const { data: finalist } = await admin
    .from("contestants")
    .select("id, name")
    .eq("id", contestantId)
    .eq("category", category)
    .eq("is_finalist", true)
    .maybeSingle();
  if (!finalist) fail("The champion must be a finalist in this category.", "results");

  const { data: existing } = await admin
    .from("champions")
    .select("contestant_id, photo_url, photo_url_2")
    .eq("category", category)
    .maybeSingle();
  // Keep existing photos only if the champion hasn't changed.
  const same = existing?.contestant_id === contestantId;
  const photoUrl = (await uploadPhoto(admin, category, formData.get("photo"))) ?? (same ? existing?.photo_url : null) ?? null;
  // Duets can have a second photo (one per singer).
  const photoUrl2 =
    category === "duet"
      ? ((await uploadPhoto(admin, category, formData.get("photo_2"))) ?? (same ? existing?.photo_url_2 : null) ?? null)
      : null;

  const { error } = await admin.from("champions").upsert({
    category,
    contestant_id: contestantId,
    photo_url: photoUrl,
    photo_url_2: photoUrl2,
    decided_by: me.id,
    decided_at: new Date().toISOString(),
  });
  if (error) fail(error.message, "results");
  await audit("champion_confirm", "category", category, { contestant_id: contestantId, photos: [photoUrl, photoUrl2].filter(Boolean).length });
  done(`${CATEGORY_LABEL[category]} champion confirmed: ${finalist.name}.`, "results");
}

export async function clearChampion(formData: FormData) {
  await requireAdmin();
  const category = str(formData, "category") as Category;
  if (!CATEGORIES.includes(category)) fail("Invalid category.", "results");
  const { error } = await createAdminClient().from("champions").delete().eq("category", category);
  if (error) fail(error.message, "results");
  await audit("champion_clear", "category", category);
  done(`${CATEGORY_LABEL[category]} champion cleared.`, "results");
}

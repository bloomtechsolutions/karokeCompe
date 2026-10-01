"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCheckin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const STAFF_ID = /^[A-Z0-9._-]{1,30}$/;

function back(params: Record<string, string>): never {
  revalidatePath("/checkin");
  redirect(`/checkin?${new URLSearchParams(params)}`);
}

/** Staff IDs are stored the same way the vote page reads them: trimmed and upper-case. */
function normalise(raw: string) {
  return raw.trim().toUpperCase();
}

export async function addStaff(formData: FormData) {
  const me = await requireCheckin();
  const staffId = normalise(String(formData.get("staff_id") ?? ""));
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || null;
  if (!STAFF_ID.test(staffId)) back({ err: "Staff ID can only contain letters, numbers, dots and dashes." });

  const supabase = await createClient();
  const { error } = await supabase.from("venue_staff").insert({ staff_id: staffId, name, added_by: me.id });
  if (error?.code === "23505") back({ err: `${staffId} is already checked in.`, last: staffId });
  if (error) back({ err: `Could not check in: ${error.message}` });
  back({ msg: `${staffId}${name ? ` (${name})` : ""} checked in. They can vote now.`, last: staffId });
}

/** Paste a list of staff IDs (one per line, or separated by commas or spaces). */
export async function addStaffBulk(formData: FormData) {
  const me = await requireCheckin();
  const ids = [
    ...new Set(
      String(formData.get("staff_ids") ?? "")
        .split(/[\s,;]+/)
        .map(normalise)
        .filter(Boolean),
    ),
  ];
  if (ids.length === 0) back({ err: "Paste at least one staff ID." });
  const invalid = ids.filter((id) => !STAFF_ID.test(id));
  if (invalid.length > 0) back({ err: `Not valid staff IDs: ${invalid.slice(0, 10).join(", ")}` });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_staff")
    .upsert(
      ids.map((staff_id) => ({ staff_id, added_by: me.id })),
      { onConflict: "staff_id", ignoreDuplicates: true },
    )
    .select("staff_id");
  if (error) back({ err: `Could not check in: ${error.message}` });
  const added = data?.length ?? 0;
  const skipped = ids.length - added;
  back({ msg: `${added} staff checked in${skipped ? `, ${skipped} were already on the list` : ""}.` });
}

export async function removeStaff(formData: FormData) {
  await requireCheckin();
  const staffId = normalise(String(formData.get("staff_id") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.from("venue_staff").delete().eq("staff_id", staffId);
  if (error) back({ err: `Could not remove: ${error.message}` });
  back({ msg: `${staffId} removed. They can no longer vote (votes already cast still count).` });
}

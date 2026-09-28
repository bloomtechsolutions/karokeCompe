"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHost } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

async function setOnStage(id: string | null) {
  await requireHost();
  const settings = await getSettings();
  if (settings.stage !== "round1" && settings.stage !== "final") {
    redirect("/host?err=" + encodeURIComponent("No round is running right now."));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("host_set_on_stage", { p_contestant: id });
  if (error) redirect("/host?err=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/host");
}

/** Put a specific performer on stage (the id comes from the card the host tapped). */
export async function callToStage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/host");
  await setOnStage(id);
}

export async function clearStage() {
  await setOnStage(null);
}

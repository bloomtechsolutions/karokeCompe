import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import type { Profile } from "@/lib/types";

export async function requireJudge(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role !== "judge") redirect("/admin");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role !== "admin") redirect("/judge");
  return profile;
}

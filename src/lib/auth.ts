import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import type { Profile, Role } from "@/lib/types";

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "host") return "/host";
  if (role === "checkin") return "/checkin";
  return "/judge";
}

export async function requireJudge(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role !== "judge") redirect(homeFor(profile.role));
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role !== "admin") redirect(homeFor(profile.role));
  return profile;
}

/** Host page: hosts and organisers. */
export async function requireHost(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role !== "host" && profile.role !== "admin") redirect(homeFor(profile.role));
  return profile;
}

/** Venue check-in desk: check-in accounts and organisers. */
export async function requireCheckin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role !== "checkin" && profile.role !== "admin") redirect(homeFor(profile.role));
  return profile;
}

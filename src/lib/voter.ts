import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const VOTER_COOKIE = "kc_voter";

export async function readVoterToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(VOTER_COOKIE)?.value ?? null;
}

/** Returns the device's voter token, creating it (server actions only). */
export async function ensureVoterToken(): Promise<string> {
  const existing = await readVoterToken();
  if (existing) return existing;
  const token = randomBytes(24).toString("hex");
  const store = await cookies();
  store.set(VOTER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return token;
}

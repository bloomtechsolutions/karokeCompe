// Creates (or promotes) an organiser/admin account.
// Usage: node --env-file=.env.local scripts/create-admin.mjs <email> <password> "<Full Name>"
import { createClient } from "@supabase/supabase-js";

const [email, password, fullName = "Organiser"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs <email> <password> "<Full Name>"');
  process.exit(1);
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

let userId;
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
  app_metadata: { role: "admin" },
});
if (error) {
  // Already exists: find and promote.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw error;
  userId = existing.id;
  await supabase.auth.admin.updateUserById(userId, { password });
} else {
  userId = data.user.id;
}

const { error: upsertErr } = await supabase
  .from("profiles")
  .upsert({ id: userId, full_name: fullName, role: "admin", active: true });
if (upsertErr) throw upsertErr;

console.log(`Admin ready: ${email}`);

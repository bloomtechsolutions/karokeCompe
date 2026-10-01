import { Header, NavLink } from "@/components/Header";
import { SubmitButton } from "@/components/SubmitButton";
import { requireCheckin } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import { addStaff, addStaffBulk, removeStaff } from "./actions";

export const dynamic = "force-dynamic";

type Staff = { staff_id: string; name: string | null; created_at: string };

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; q?: string; last?: string }>;
}) {
  const me = await requireCheckin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toUpperCase();
  const supabase = await createClient();
  const [settings, staffRes, votesRes] = await Promise.all([
    getSettings(),
    supabase.from("venue_staff").select("staff_id, name, created_at").order("created_at", { ascending: false }),
    // Only which staff IDs have voted (not who they voted for).
    createAdminClient().from("audience_votes").select("voter_ref, round"),
  ]);
  const staff = (staffRes.data ?? []) as Staff[];
  const round = settings.stage === "final" ? "final" : "round1";
  const voted = new Set(
    ((votesRes.data ?? []) as { voter_ref: string | null; round: string }[])
      .filter((v) => v.round === round && v.voter_ref)
      .map((v) => v.voter_ref!.toUpperCase()),
  );
  const shown = q
    ? staff.filter((s) => s.staff_id.includes(q) || (s.name ?? "").toUpperCase().includes(q))
    : staff.slice(0, 200);
  const votedCount = staff.filter((s) => voted.has(s.staff_id)).length;
  const time = (t: string) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Header
        eventName={settings.event_name}
        right={
          <>
            {me.role === "admin" && <NavLink href="/admin">Organiser</NavLink>}
            <form action={logout}>
              <button className="rounded-lg px-3 py-2 text-muted hover:bg-panel-2 hover:text-ink">Sign out</button>
            </form>
          </>
        }
      />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Venue check-in</h1>
            <p className="text-sm text-muted">Only staff IDs entered here can vote.</p>
          </div>
          <div className="flex gap-2 text-center">
            <div className="rounded-xl bg-panel-2 px-4 py-2">
              <div className="text-2xl font-extrabold tabular-nums">{staff.length}</div>
              <div className="text-[11px] tracking-wider text-muted uppercase">Checked in</div>
            </div>
            <div className="rounded-xl bg-panel-2 px-4 py-2">
              <div className="text-2xl font-extrabold text-gold tabular-nums">{votedCount}</div>
              <div className="text-[11px] tracking-wider text-muted uppercase">
                Voted · {round === "final" ? "Final" : "Round 1"}
              </div>
            </div>
          </div>
        </div>

        {!settings.require_checkin && (
          <p className="rounded-lg bg-amber-900/40 px-4 py-2.5 text-sm text-amber-100">
            Check-in is currently <strong>not required</strong> to vote. The organiser can turn it on in Settings.
          </p>
        )}
        {sp.msg && <p className="rounded-lg bg-emerald-900/40 px-4 py-2.5 text-sm text-emerald-200">{sp.msg}</p>}
        {sp.err && <p className="rounded-lg bg-red-900/40 px-4 py-2.5 text-sm text-red-200">{sp.err}</p>}

        <form action={addStaff} className="card space-y-3">
          <h2 className="font-bold">Check in a staff member</h2>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              name="staff_id"
              required
              maxLength={30}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Staff ID"
              className="field text-lg font-semibold uppercase"
            />
            <input name="name" maxLength={80} autoComplete="off" placeholder="Name (optional)" className="field" />
            <SubmitButton className="btn-primary px-6" pendingText="Adding…">
              Check in
            </SubmitButton>
          </div>
        </form>

        <details className="card">
          <summary className="cursor-pointer font-bold">Add many at once</summary>
          <form action={addStaffBulk} className="mt-3 space-y-3">
            <textarea
              name="staff_ids"
              rows={5}
              placeholder={"Paste staff IDs, one per line\n(or separated by commas or spaces)"}
              className="field font-mono text-sm"
            />
            <SubmitButton className="btn-ghost w-full" pendingText="Adding…">
              Check in all
            </SubmitButton>
          </form>
        </details>

        <section className="card space-y-3">
          <form className="flex gap-2" action="/checkin">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search staff ID or name"
              autoComplete="off"
              className="field"
            />
            <button className="btn-ghost">Search</button>
          </form>
          {shown.length === 0 ? (
            <p className="text-sm text-muted">{q ? "No match." : "Nobody checked in yet."}</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {shown.map((s) => (
                <li
                  key={s.staff_id}
                  className={`flex items-center gap-3 py-2 ${s.staff_id === sp.last ? "rounded-lg bg-accent/10 px-2" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-semibold">{s.staff_id}</div>
                    <div className="truncate text-xs text-muted">
                      {s.name ? `${s.name} · ` : ""}
                      {time(s.created_at)}
                    </div>
                  </div>
                  {voted.has(s.staff_id) && (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">Voted</span>
                  )}
                  <form action={removeStaff}>
                    <input type="hidden" name="staff_id" value={s.staff_id} />
                    <SubmitButton className="rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-950" pendingText="…">
                      Remove
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {!q && staff.length > shown.length && (
            <p className="text-xs text-muted">Showing the latest {shown.length}. Search to find others.</p>
          )}
        </section>
      </main>
    </>
  );
}

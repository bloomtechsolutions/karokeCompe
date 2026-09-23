import { Header, NavLink } from "@/components/Header";
import { getSettings } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABEL, type Contestant } from "@/lib/types";
import { readVoterToken } from "@/lib/voter";
import { VoteForm } from "./VoteForm";

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const settings = await getSettings();
  const open = settings.stage === "final" && settings.voting_open;

  let finalists: Contestant[] = [];
  const votedFor = new Map<string, string>();
  if (open) {
    const supabase = await createClient();
    const { data } = await supabase.from("contestants").select("*").eq("is_finalist", true);
    finalists = ((data ?? []) as Contestant[]).sort(
      (a, b) => (a.final_order ?? 999) - (b.final_order ?? 999) || a.name.localeCompare(b.name),
    );
    const token = await readVoterToken();
    if (token) {
      const { data: status } = await createAdminClient().rpc("voter_status", { p_voter_token: token });
      for (const row of (status ?? []) as { category: string; contestant_id: string }[]) {
        votedFor.set(row.category, row.contestant_id);
      }
    }
  }

  return (
    <>
      <Header eventName={settings.event_name} right={<NavLink href="/">Dashboard</NavLink>} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold uppercase">Audience Vote</h1>
          <p className="text-sm text-muted">
            Pick your favourite finalist. Audience votes count for {100 - Number(settings.judge_weight)}% of
            the final score.
          </p>
        </div>

        {!open ? (
          <div className="card text-center text-muted">
            Voting is not open right now. It opens during the final round.
          </div>
        ) : (
          CATEGORIES.map((category) => {
            const list = finalists.filter((f) => f.category === category);
            if (list.length === 0) return null;
            const voted = votedFor.get(category);
            return (
              <section key={category} className="card">
                <h2 className="mb-3 text-lg font-bold">{CATEGORY_LABEL[category]}</h2>
                {voted ? (
                  <p className="rounded-lg bg-emerald-900/40 p-4 text-center text-emerald-200">
                    You voted for <strong>{list.find((f) => f.id === voted)?.name ?? "a finalist"}</strong>. Thank you!
                  </p>
                ) : (
                  <VoteForm
                    category={category}
                    requireVoterId={settings.require_voter_id}
                    finalists={list.map((f) => ({ id: f.id, name: f.name, song: f.song_final }))}
                  />
                )}
              </section>
            );
          })
        )}
      </main>
    </>
  );
}

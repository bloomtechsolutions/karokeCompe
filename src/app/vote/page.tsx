import { AutoRefresh } from "@/components/AutoRefresh";
import { Header, NavLink } from "@/components/Header";
import { getLeaderboard, getSettings } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIES } from "@/lib/types";
import { categoryVoting } from "@/lib/voting";
import { readVoterToken } from "@/lib/voter";
import { VoteBooth, type BoothCategory } from "./VoteForm";

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const settings = await getSettings();
  const open = settings.stage === "final" && settings.voting_open;

  let categories: BoothCategory[] = [];
  if (open) {
    const rows = await getLeaderboard();
    const votedFor = new Map<string, string>();
    const token = await readVoterToken();
    if (token) {
      const { data: status } = await createAdminClient().rpc("voter_status", { p_voter_token: token });
      for (const row of (status ?? []) as { category: string; contestant_id: string }[]) {
        votedFor.set(row.category, row.contestant_id);
      }
    }
    categories = CATEGORIES.map((category) => {
      const finalists = rows
        .filter((r) => r.category === category && r.is_finalist)
        .sort((a, b) => (a.final_order ?? 999) - (b.final_order ?? 999) || a.name.localeCompare(b.name))
        .map((r) => ({ id: r.contestant_id, name: r.name, song: r.song_final }));
      const status = categoryVoting(rows, category, settings.now_performing);
      return {
        category,
        finalists,
        votedFor: votedFor.get(category) ?? null,
        ready: status.ready,
        performed: status.performed,
      };
    }).filter((c) => c.finalists.length > 0);
  }

  return (
    <>
      <Header eventName={settings.event_name} right={<NavLink href="/">Dashboard</NavLink>} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {open && <AutoRefresh seconds={8} />}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold uppercase">Audience Vote</h1>
          <p className="text-sm text-muted">
            Pick your favourite finalist. Audience votes count for {100 - Number(settings.judge_weight)}% of the
            final score.
          </p>
        </div>

        {!open || categories.length === 0 ? (
          <div className="card text-center text-muted">
            Voting is not open right now. It opens during the final round, once the finalists have performed.
          </div>
        ) : (
          <VoteBooth categories={categories} requireVoterId={settings.require_voter_id} />
        )}
      </main>
    </>
  );
}

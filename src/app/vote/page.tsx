import { AutoRefresh } from "@/components/AutoRefresh";
import { Header, NavLink } from "@/components/Header";
import { getLeaderboard, getSettings } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIES } from "@/lib/types";
import { categoryVoting, round1Candidates, round1Voting } from "@/lib/voting";
import { readVoterToken } from "@/lib/voter";
import { VoteBooth, type BoothCategory } from "./VoteForm";

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const settings = await getSettings();
  const round = settings.stage === "round1" || settings.stage === "final" ? settings.stage : null;
  const open = round != null && settings.voting_open;
  const isFinal = round === "final";

  let categories: BoothCategory[] = [];
  if (open) {
    const rows = await getLeaderboard();
    const votedFor = new Map<string, string>();
    const changed = new Set<string>();
    const token = await readVoterToken();
    if (token) {
      const { data: status } = await createAdminClient().rpc("voter_status", { p_voter_token: token });
      type Row = { round: string; category: string; contestant_id: string; changed: boolean };
      for (const row of (status ?? []) as Row[]) {
        if (row.round !== round) continue;
        votedFor.set(row.category, row.contestant_id);
        if (row.changed) changed.add(row.category);
      }
    }
    categories = CATEGORIES.map((category) => {
      if (isFinal) {
        const finalists = rows
          .filter((r) => r.category === category && r.is_finalist)
          .sort((a, b) => (a.final_order ?? 999) - (b.final_order ?? 999) || a.name.localeCompare(b.name))
          .map((r) => ({ id: r.contestant_id, name: r.name, song: r.song_final }));
        const status = categoryVoting(rows, category, settings.now_performing);
        return {
          category,
          finalists,
          votedFor: votedFor.get(category) ?? null,
          changed: changed.has(category),
          ...status,
        };
      }
      const status = round1Voting(rows, category, settings.now_performing);
      const finalists = round1Candidates(rows, category, settings.now_performing).map((r) => ({
        id: r.contestant_id,
        name: r.name,
        song: r.song_round1,
      }));
      return {
        category,
        finalists,
        votedFor: votedFor.get(category) ?? null,
        changed: changed.has(category),
        ...status,
      };
    }).filter((c) => c.total > 0);
  }

  return (
    <>
      <Header eventName={settings.event_name} right={<NavLink href="/">Dashboard</NavLink>} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {open && <AutoRefresh seconds={8} />}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold uppercase">Audience Vote · {isFinal ? "Final" : "1st Round"}</h1>
          <p className="text-sm text-muted">
            Pick your favourite {isFinal ? "finalist" : "performer"}. Audience votes count for{" "}
            {100 - Number(settings.judge_weight)}% of the {isFinal ? "final" : "1st round"} score.
          </p>
        </div>

        {!open || categories.length === 0 ? (
          <div className="card text-center text-muted">
            Voting is not open right now. Please check back when the performances start.
          </div>
        ) : (
          <VoteBooth categories={categories} requireVoterId={settings.require_voter_id} round={round} />
        )}
      </main>
    </>
  );
}

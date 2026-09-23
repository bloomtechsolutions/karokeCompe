import { AutoRefresh } from "@/components/AutoRefresh";
import { LiveDashboard } from "@/components/tv/LiveDashboard";
import { getLeaderboard, getSettings } from "@/lib/data";
import { getVoteLink } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [settings, rows, judgeCountRes, voteTotalRes] = await Promise.all([
    getSettings(),
    getLeaderboard(),
    supabase.rpc("judge_count"),
    supabase.rpc("vote_total"),
  ]);
  const votingLive = settings.stage === "final" && settings.voting_open;

  return (
    <>
      <AutoRefresh seconds={4} />
      <LiveDashboard
        eventName={settings.event_name}
        stage={settings.stage}
        showScores={settings.show_scores}
        votingOpen={settings.voting_open}
        finalistsPerCategory={settings.finalists_per_category}
        judgeWeight={Number(settings.judge_weight)}
        nowPerforming={settings.now_performing}
        rows={rows}
        judgeCount={(judgeCountRes.data as number | null) ?? 0}
        voteTotal={(voteTotalRes.data as number | null) ?? 0}
        vote={votingLive ? await getVoteLink() : null}
      />
    </>
  );
}

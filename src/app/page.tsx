import { AutoRefresh } from "@/components/AutoRefresh";
import { LiveDashboard } from "@/components/tv/LiveDashboard";
import { getLeaderboard, getSettings } from "@/lib/data";
import { getVoteLink } from "@/lib/qr";
import type { Champion } from "@/lib/champions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [settings, rows, judgeCountRes, voteTotalRes, champsRes] = await Promise.all([
    getSettings(),
    getLeaderboard(),
    supabase.rpc("judge_count"),
    supabase.rpc("vote_total"),
    // Readable by the public only once the competition is completed.
    supabase.from("champions").select("category, contestant_id, photo_url, photo_url_2"),
  ]);
  const votingLive = (settings.stage === "round1" || settings.stage === "final") && settings.voting_open;

  return (
    <>
      <AutoRefresh seconds={4} />
      <LiveDashboard
        eventName={settings.event_name}
        stage={settings.stage}
        showScores={settings.show_scores}
        votingOpen={settings.voting_open}
        finalists={{ solo: settings.finalists_solo, duet: settings.finalists_duet }}
        announceR1={settings.announce_r1}
        judgeWeight={Number(settings.judge_weight)}
        nowPerforming={settings.now_performing}
        lastOnStage={settings.last_on_stage}
        rows={rows}
        judgeCount={(judgeCountRes.data as number | null) ?? 0}
        voteTotal={(voteTotalRes.data as number | null) ?? 0}
        vote={votingLive ? await getVoteLink() : null}
        champions={(champsRes.data ?? []) as Champion[]}
      />
    </>
  );
}

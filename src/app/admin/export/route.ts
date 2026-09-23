import { NextResponse } from "next/server";
import { getCurrentProfile, getLeaderboard, getSettings } from "@/lib/data";
import { rankFinal, rankRound1 } from "@/lib/scoring";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile?.active || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [settings, rows] = await Promise.all([getSettings(), getLeaderboard()]);
  const judgeWeight = Number(settings.judge_weight);

  const lines: unknown[][] = [
    ["Round", "Category", "Rank", "Name", "Department", "Song", "Judges scored", "Judge avg (/100)",
     `Judge points (/${judgeWeight})`, "Votes", `Audience points (/${100 - judgeWeight})`, "Final score", "Finalist"],
  ];
  for (const c of CATEGORIES) {
    for (const r of rankRound1(rows, c)) {
      lines.push(["1st Round", c, r.rank, r.name, r.department, r.song_round1, r.r1_judges, r.r1_avg,
        "", "", "", r.r1_avg, r.is_finalist ? "Yes" : "No"]);
    }
  }
  for (const c of CATEGORIES) {
    for (const r of rankFinal(rows, c, judgeWeight)) {
      lines.push(["Final", c, r.rank, r.name, r.department, r.song_final, r.final_judges, r.final_avg,
        r.judgePoints, r.votes, r.audiencePoints, r.finalScore, "Yes"]);
    }
  }
  const body = lines.map((l) => l.map(csvCell).join(",")).join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="karaoke-results.csv"`,
    },
  });
}

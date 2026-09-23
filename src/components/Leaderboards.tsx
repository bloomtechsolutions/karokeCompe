import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { fmt, type FinalResult, type Round1Result } from "@/lib/scoring";

function Rank({ rank, highlight }: { rank: number; highlight?: boolean }) {
  const medal = rank === 1 ? "bg-gold text-bg" : rank === 2 ? "bg-zinc-300 text-bg" : rank === 3 ? "bg-amber-700 text-white" : "bg-panel-2 text-muted";
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${highlight ? medal : "bg-panel-2 text-muted"}`}
    >
      {rank}
    </span>
  );
}

export function Round1Board({
  category,
  rows,
  judgeCount,
  finalistsPerCategory,
  showScores,
}: {
  category: Category;
  rows: Round1Result[];
  judgeCount: number;
  finalistsPerCategory: number;
  showScores: boolean;
}) {
  return (
    <section className="card">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-lg font-bold">{CATEGORY_LABEL[category]}</h3>
        <span className="text-xs text-muted">Top {finalistsPerCategory} advance</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No performers yet.</p>
      ) : (
        <ol className="divide-y divide-line/60">
          {rows.map((r) => {
            const scored = r.r1_judges > 0;
            return (
              <li key={r.contestant_id} className="flex items-center gap-3 py-2.5">
                <Rank rank={r.rank} highlight={scored && showScores && r.rank <= 3} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{r.name}</span>
                    {r.is_finalist && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-2 uppercase">
                        Finalist
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {r.song_round1 ?? "Song TBA"}
                    {r.department ? ` · ${r.department}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums">
                    {showScores ? fmt(r.r1_avg, 1) : scored ? "✓" : "—"}
                  </div>
                  <div className="text-[11px] text-muted tabular-nums">
                    {r.r1_judges}/{judgeCount} judges
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function FinalBoard({
  category,
  rows,
  judgeCount,
  judgeWeight,
  showScores,
  votingOpen,
}: {
  category: Category;
  rows: FinalResult[];
  judgeCount: number;
  judgeWeight: number;
  showScores: boolean;
  votingOpen: boolean;
}) {
  return (
    <section className="card">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-lg font-bold">{CATEGORY_LABEL[category]} Final</h3>
        <span className="text-xs text-muted">
          Judges {judgeWeight}% · Audience {100 - judgeWeight}%
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Finalists not announced yet.</p>
      ) : (
        <ol className="divide-y divide-line/60">
          {rows.map((r) => (
            <li key={r.contestant_id} className="flex items-center gap-3 py-3">
              <Rank rank={r.rank} highlight={showScores && r.finalScore != null} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.name}</div>
                <div className="truncate text-xs text-muted">{r.song_final ?? "Song TBA"}</div>
                <div className="mt-1 flex gap-3 text-[11px] text-muted tabular-nums">
                  <span>
                    Judges {showScores ? fmt(r.judgePoints, 1) : "—"}/{judgeWeight}
                  </span>
                  <span>
                    Audience{" "}
                    {votingOpen ? "voting…" : `${fmt(r.audiencePoints, 1)}/${100 - judgeWeight}`}
                    {r.votes != null && !votingOpen ? ` (${r.votes} votes)` : ""}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold tabular-nums">
                  {showScores ? fmt(r.finalScore, 1) : "—"}
                </div>
                <div className="text-[11px] text-muted tabular-nums">
                  {r.final_judges}/{judgeCount} judges
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

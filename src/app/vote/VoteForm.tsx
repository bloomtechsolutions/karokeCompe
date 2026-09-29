"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { castVote, changeVote, type VoteState } from "./actions";

type Finalist = { id: string; name: string; song: string | null };

export type BoothCategory = {
  category: Category;
  finalists: Finalist[];
  votedFor: string | null;
  /** The one allowed change has been used. */
  changed: boolean;
  ready: boolean;
  performed: number;
  total: number;
};

const STAFF_KEY = "karaoke-staff-id";

/** Voting for all categories, sharing one staff ID field. */
export function VoteBooth({
  categories,
  requireVoterId,
  round,
}: {
  categories: BoothCategory[];
  requireVoterId: boolean;
  round: "round1" | "final";
}) {
  const who = round === "final" ? "finalist" : "performer";
  const [staffId, setStaffId] = useState("");

  useEffect(() => {
    try {
      setStaffId(localStorage.getItem(STAFF_KEY) ?? "");
    } catch {
      // Storage unavailable; the field just starts empty.
    }
  }, []);

  const anyOpen = categories.some((c) => c.ready && !c.votedFor);

  return (
    <div className="space-y-4">
      {requireVoterId && anyOpen && (
        <label className="card block space-y-1.5">
          <span className="text-sm font-semibold">Your staff ID</span>
          <input
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              try {
                localStorage.setItem(STAFF_KEY, e.target.value);
              } catch {}
            }}
            placeholder="e.g. 12345"
            autoComplete="off"
            maxLength={30}
            className="field text-lg"
          />
          <span className="block text-xs text-muted">One vote per staff ID in each category.</span>
        </label>
      )}
      {categories.map((c) => (
        <section key={c.category} className="card">
          <h2 className="mb-3 text-lg font-bold">{CATEGORY_LABEL[c.category]}</h2>
          {c.votedFor ? (
            <VotedCard key={`${c.votedFor}|${c.changed}`} c={c} who={who} />
          ) : !c.ready ? (
            <div className="rounded-lg bg-bg/50 p-4 text-center">
              <div className="font-semibold">
                {round === "final"
                  ? "Voting opens after all finalists have performed"
                  : "Voting opens when the first performer takes the stage"}
              </div>
              <div className="mt-1 text-sm text-muted tabular-nums">
                {c.performed} of {c.total} performed
              </div>
            </div>
          ) : (
            <>
              {round === "round1" && c.performed < c.total && (
                <p className="mb-3 text-xs text-muted">
                  {c.performed} of {c.total} have performed so far. Others appear here as they take the stage. You have
                  one vote in this category, so you can wait for your favourite.
                </p>
              )}
              <VoteForm category={c.category} finalists={c.finalists} who={who} staffId={requireVoterId ? staffId : ""} />
            </>
          )}
        </section>
      ))}
    </div>
  );
}

/** Shows the current vote, with the option to change it once. */
function VotedCard({ c, who }: { c: BoothCategory; who: string }) {
  const [editing, setEditing] = useState(false);
  const name = c.finalists.find((f) => f.id === c.votedFor)?.name ?? `a ${who}`;

  if (editing) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-amber-900/30 p-3 text-sm text-amber-100">
          You can change your vote <strong>only once</strong>. After this it&apos;s final.
        </p>
        <VoteForm
          mode="change"
          category={c.category}
          finalists={c.finalists}
          who={who}
          staffId=""
          initial={c.votedFor ?? ""}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-emerald-900/40 p-4 text-center text-emerald-200">
        You {c.changed ? "changed your vote to" : "voted for"} <strong>{name}</strong>. Thank you!
      </p>
      {c.changed ? (
        <p className="text-center text-xs text-muted">You&apos;ve used your one change, so this vote is final.</p>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:bg-panel-2"
        >
          Change my vote (1 change allowed)
        </button>
      )}
    </div>
  );
}

function VoteForm({
  mode = "cast",
  category,
  finalists,
  who,
  staffId,
  initial = "",
  onCancel,
}: {
  mode?: "cast" | "change";
  category: Category;
  finalists: Finalist[];
  who: string;
  staffId: string;
  initial?: string;
  onCancel?: () => void;
}) {
  const [state, action] = useActionState<VoteState, FormData>(mode === "change" ? changeVote : castVote, {});
  const [choice, setChoice] = useState<string>(initial);
  const label = CATEGORY_LABEL[category].toLowerCase();

  if (state.ok) {
    return (
      <p className="rounded-lg bg-emerald-900/40 p-4 text-center text-emerald-200">
        {mode === "change" ? `Your ${label} vote has been changed.` : `Thanks! Your ${label} vote has been counted.`}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="voter_ref" value={staffId} />
      <fieldset className="space-y-2">
        <legend className="sr-only">Choose your favourite {CATEGORY_LABEL[category]} {who}</legend>
        {finalists.map((f) => (
          <label
            key={f.id}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
              choice === f.id ? "border-accent-2 bg-accent/15" : "border-line hover:bg-panel-2"
            }`}
          >
            <input
              type="radio"
              name="contestant_id"
              value={f.id}
              checked={choice === f.id}
              onChange={() => setChoice(f.id)}
              className="h-5 w-5 accent-[var(--color-accent)]"
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{f.name}</span>
              {f.song && <span className="block truncate text-xs text-muted">{f.song}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
      {mode === "change" ? (
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost flex-1">
            Keep my vote
          </button>
          <SubmitButton className="btn-primary flex-1" disabled={!choice || choice === initial} pendingText="Changing…">
            Change vote
          </SubmitButton>
        </div>
      ) : (
        <>
          <SubmitButton className="btn-primary w-full" disabled={!choice} pendingText="Submitting…">
            Submit {label} vote
          </SubmitButton>
          <p className="text-center text-xs text-muted">You can change your vote once afterwards.</p>
        </>
      )}
    </form>
  );
}

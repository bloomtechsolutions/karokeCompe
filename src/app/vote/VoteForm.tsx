"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { castVote, type VoteState } from "./actions";

type Finalist = { id: string; name: string; song: string | null };

export type BoothCategory = {
  category: Category;
  finalists: Finalist[];
  votedFor: string | null;
  ready: boolean;
  performed: number;
};

const STAFF_KEY = "karaoke-staff-id";

/** Voting for all categories, sharing one staff ID field. */
export function VoteBooth({ categories, requireVoterId }: { categories: BoothCategory[]; requireVoterId: boolean }) {
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
            <p className="rounded-lg bg-emerald-900/40 p-4 text-center text-emerald-200">
              You voted for <strong>{c.finalists.find((f) => f.id === c.votedFor)?.name ?? "a finalist"}</strong>. Thank
              you!
            </p>
          ) : !c.ready ? (
            <div className="rounded-lg bg-bg/50 p-4 text-center">
              <div className="font-semibold">Voting opens after all finalists have performed</div>
              <div className="mt-1 text-sm text-muted tabular-nums">
                {c.performed} of {c.finalists.length} performed
              </div>
            </div>
          ) : (
            <VoteForm category={c.category} finalists={c.finalists} staffId={requireVoterId ? staffId : ""} />
          )}
        </section>
      ))}
    </div>
  );
}

function VoteForm({ category, finalists, staffId }: { category: Category; finalists: Finalist[]; staffId: string }) {
  const [state, action] = useActionState<VoteState, FormData>(castVote, {});
  const [choice, setChoice] = useState<string>("");

  if (state.ok) {
    return (
      <p className="rounded-lg bg-emerald-900/40 p-4 text-center text-emerald-200">
        Thanks! Your {CATEGORY_LABEL[category].toLowerCase()} vote has been counted.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="voter_ref" value={staffId} />
      <fieldset className="space-y-2">
        <legend className="sr-only">Choose your favourite {CATEGORY_LABEL[category]} finalist</legend>
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
      <SubmitButton className="btn-primary w-full" disabled={!choice} pendingText="Submitting…">
        Submit {CATEGORY_LABEL[category].toLowerCase()} vote
      </SubmitButton>
      <p className="text-center text-xs text-muted">Votes can&apos;t be changed.</p>
    </form>
  );
}

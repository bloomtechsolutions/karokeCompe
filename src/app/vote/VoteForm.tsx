"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { castVote, type VoteState } from "./actions";

type Finalist = { id: string; name: string; song: string | null };

export function VoteForm({
  category,
  finalists,
  requireVoterId,
}: {
  category: Category;
  finalists: Finalist[];
  requireVoterId: boolean;
}) {
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
      {requireVoterId && (
        <input
          name="voter_ref"
          required
          placeholder="Your staff ID"
          autoComplete="off"
          className="field"
          maxLength={50}
        />
      )}
      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" disabled={!choice} pendingText="Submitting…">
        Submit {CATEGORY_LABEL[category].toLowerCase()} vote
      </SubmitButton>
      <p className="text-center text-xs text-muted">One vote per person per category. Votes can&apos;t be changed.</p>
    </form>
  );
}

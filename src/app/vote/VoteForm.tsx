"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { castVote, changeVote, type VoteState } from "./actions";

type Finalist = { id: string; name: string; song: string | null };

export type BoothCategory = {
  category: Category;
  /** Who can be voted for right now. */
  finalists: Finalist[];
  /** How many picks a voter has in this category (5 solo / 3 duet in round 1, 1 in the final). */
  limit: number;
  /** This device's picks so far. */
  picks: string[];
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
  const [staffId, setStaffId] = useState("");

  useEffect(() => {
    try {
      setStaffId(localStorage.getItem(STAFF_KEY) ?? "");
    } catch {
      // Storage unavailable; the field just starts empty.
    }
  }, []);

  const anyOpen = categories.some((c) => c.ready && c.picks.length < c.limit);

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
          <span className="block text-xs text-muted">Use the same staff ID for all your votes.</span>
        </label>
      )}
      {categories.map((c) => (
        <CategoryCard key={c.category} c={c} round={round} staffId={requireVoterId ? staffId : ""} />
      ))}
    </div>
  );
}

function CategoryCard({ c, round, staffId }: { c: BoothCategory; round: "round1" | "final"; staffId: string }) {
  const [changing, setChanging] = useState(false);
  const who = round === "final" ? "finalist" : "performer";
  const nameOf = (id: string) => c.finalists.find((f) => f.id === id)?.name ?? `a ${who}`;
  const left = Math.max(0, c.limit - c.picks.length);
  const available = c.finalists.filter((f) => !c.picks.includes(f.id));
  // Remount forms when the server's view of this voter changes.
  const version = `${c.picks.join(",")}|${c.changed}`;

  return (
    <section className="card space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{CATEGORY_LABEL[c.category]}</h2>
        {c.limit > 1 && (
          <span className="text-sm text-muted tabular-nums">
            {c.picks.length} of {c.limit} votes used
          </span>
        )}
      </div>

      {c.picks.length > 0 && (
        <div className="rounded-lg bg-emerald-900/40 p-3 text-emerald-200">
          <div className="text-sm">
            {c.limit === 1 ? (c.changed ? "You changed your vote to" : "You voted for") : "Your votes:"}
          </div>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {c.picks.map((id) => (
              <li key={id} className="rounded-full bg-emerald-950/60 px-3 py-1 text-sm font-semibold">
                ✓ {nameOf(id)}
              </li>
            ))}
          </ul>
          {left === 0 && <div className="mt-2 text-xs text-emerald-300/80">Thank you!</div>}
        </div>
      )}

      {changing ? (
        <ChangeForm key={version} c={c} who={who} nameOf={nameOf} onCancel={() => setChanging(false)} />
      ) : (
        <>
          {!c.ready && c.picks.length === 0 ? (
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
          ) : left > 0 && c.ready ? (
            <>
              {round === "round1" && (
                <p className="text-xs text-muted">
                  Pick up to {left} {left === 1 ? "more performer" : "performers"}.
                  {c.performed < c.total &&
                    ` ${c.performed} of ${c.total} have performed so far; others appear here as they take the stage, so you can vote now and add more later.`}
                </p>
              )}
              {available.length > 0 ? (
                <PickForm key={version} c={c} available={available} left={left} who={who} staffId={staffId} />
              ) : (
                <p className="text-sm text-muted">You&apos;ve voted for everyone who has performed so far.</p>
              )}
            </>
          ) : null}

          {c.picks.length > 0 &&
            (c.changed ? (
              <p className="text-center text-xs text-muted">You&apos;ve used your one change in this category.</p>
            ) : (
              available.length > 0 && (
                <button
                  type="button"
                  onClick={() => setChanging(true)}
                  className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:bg-panel-2"
                >
                  {c.limit === 1 ? "Change my vote" : "Swap one of my votes"} (1 change allowed)
                </button>
              )
            ))}
        </>
      )}
    </section>
  );
}

function Choice({
  f,
  checked,
  type,
  name,
  disabled,
  onChange,
}: {
  f: Finalist;
  checked: boolean;
  type: "radio" | "checkbox";
  name: string;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 transition ${
        checked ? "border-accent-2 bg-accent/15" : "border-line hover:bg-panel-2"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <input
        type={type}
        name={name}
        value={f.id}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="h-5 w-5 accent-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{f.name}</span>
        {f.song && <span className="block truncate text-xs text-muted">{f.song}</span>}
      </span>
    </label>
  );
}

/** New picks: checkboxes up to the votes left (a single choice when only one is allowed). */
function PickForm({
  c,
  available,
  left,
  who,
  staffId,
}: {
  c: BoothCategory;
  available: Finalist[];
  left: number;
  who: string;
  staffId: string;
}) {
  const [state, action] = useActionState<VoteState, FormData>(castVote, {});
  const [chosen, setChosen] = useState<string[]>([]);
  const single = c.limit === 1;
  const label = CATEGORY_LABEL[c.category].toLowerCase();

  const toggle = (id: string) =>
    setChosen((cur) =>
      single ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < left ? [...cur, id] : cur,
    );

  if (state.ok) {
    return (
      <p className="rounded-lg bg-emerald-900/40 p-4 text-center text-emerald-200">
        Thanks! Your {label} {state.added === 1 ? "vote has" : "votes have"} been counted.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="voter_ref" value={staffId} />
      <fieldset className="space-y-2">
        <legend className="sr-only">
          Choose your favourite {CATEGORY_LABEL[c.category]} {single ? who : `${who}s`}
        </legend>
        {available.map((f) => (
          <Choice
            key={f.id}
            f={f}
            name="contestant_id"
            type={single ? "radio" : "checkbox"}
            checked={chosen.includes(f.id)}
            disabled={!single && !chosen.includes(f.id) && chosen.length >= left}
            onChange={() => toggle(f.id)}
          />
        ))}
      </fieldset>
      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" disabled={chosen.length === 0} pendingText="Submitting…">
        {single
          ? `Submit ${label} vote`
          : chosen.length === 0
            ? `Choose up to ${left}`
            : `Submit ${chosen.length} ${label} ${chosen.length === 1 ? "vote" : "votes"}`}
      </SubmitButton>
      <p className="text-center text-xs text-muted">
        Votes can&apos;t be removed, but you can swap one of them once.
      </p>
    </form>
  );
}

/** Swap one existing pick for someone else (once per category). */
function ChangeForm({
  c,
  who,
  nameOf,
  onCancel,
}: {
  c: BoothCategory;
  who: string;
  nameOf: (id: string) => string;
  onCancel: () => void;
}) {
  const [state, action] = useActionState<VoteState, FormData>(changeVote, {});
  const [from, setFrom] = useState(c.picks.length === 1 ? c.picks[0] : "");
  const [to, setTo] = useState("");
  const label = CATEGORY_LABEL[c.category].toLowerCase();
  const options = c.finalists.filter((f) => !c.picks.includes(f.id));

  if (state.ok) {
    return (
      <p className="rounded-lg bg-emerald-900/40 p-4 text-center text-emerald-200">
        Your {label} vote has been changed.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <p className="rounded-lg bg-amber-900/30 p-3 text-sm text-amber-100">
        You can change <strong>one</strong> vote in this category, <strong>only once</strong>. After this it&apos;s
        final.
      </p>
      <input type="hidden" name="from_id" value={from} />
      {c.picks.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">1. Which vote do you want to move?</legend>
          {c.picks.map((id) => (
            <Choice
              key={id}
              f={{ id, name: nameOf(id), song: null }}
              name="from_choice"
              type="radio"
              checked={from === id}
              onChange={() => setFrom(id)}
            />
          ))}
        </fieldset>
      )}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">
          {c.picks.length > 1 ? "2. " : ""}Give it to which {who}?
        </legend>
        {options.map((f) => (
          <Choice key={f.id} f={f} name="contestant_id" type="radio" checked={to === f.id} onChange={() => setTo(f.id)} />
        ))}
      </fieldset>
      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">
          Keep my votes
        </button>
        <SubmitButton className="btn-primary flex-1" disabled={!from || !to} pendingText="Changing…">
          Change vote
        </SubmitButton>
      </div>
    </form>
  );
}

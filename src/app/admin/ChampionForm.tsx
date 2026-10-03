"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { saveChampion } from "./actions";

type Option = { id: string; label: string; name: string };

/** Shrinks a photo to at most `max` px on the long side as a JPEG, so uploads stay small. */
async function resize(file: File, max = 1600): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
  return blob ? new File([blob], "champion.jpg", { type: "image/jpeg" }) : file;
}

function PhotoInput({
  name,
  label,
  current,
  onBusy,
}: {
  name: string;
  label: string;
  current: string | null;
  onBusy: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState<string | null>(current);
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg/60 ring-1 ring-line">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted">No photo</span>
        )}
      </div>
      <label className="block min-w-0 flex-1 space-y-1.5">
        <span className="block truncate text-sm font-medium">{label}</span>
        <input
          name={name}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-panel-2 file:px-3 file:py-2 file:text-ink"
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            onBusy(true);
            const small = await resize(file);
            const dt = new DataTransfer();
            dt.items.add(small);
            input.files = dt.files;
            setPreview(URL.createObjectURL(small));
            onBusy(false);
          }}
        />
      </label>
    </div>
  );
}

export function ChampionForm({
  category,
  options,
  defaultId,
  currentPhotos,
}: {
  category: string;
  options: Option[];
  defaultId: string;
  /** Photos already saved for the default champion. */
  currentPhotos: [string | null, string | null];
}) {
  const [busy, setBusy] = useState(0);
  const [selected, setSelected] = useState(defaultId);
  const onBusy = (b: boolean) => setBusy((n) => Math.max(0, n + (b ? 1 : -1)));
  const isDuet = category === "duet";
  // Label each duet photo with the singer's name ("A & B").
  const singers = (options.find((o) => o.id === selected)?.name ?? "").split(/\s*&\s*/);
  const keep = selected === defaultId;

  return (
    <form action={saveChampion} className="space-y-3">
      <input type="hidden" name="category" value={category} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Champion</span>
        <select
          name="contestant_id"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
          className="field"
        >
          <option value="" disabled>
            Choose…
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div key={selected} className="space-y-2">
        <PhotoInput
          name="photo"
          label={isDuet ? `Photo 1${singers[0] ? ` · ${singers[0]}` : ""}` : "Photo for the winners screen"}
          current={keep ? currentPhotos[0] : null}
          onBusy={onBusy}
        />
        {isDuet && (
          <PhotoInput
            name="photo_2"
            label={`Photo 2${singers[1] ? ` · ${singers[1]}` : ""}`}
            current={keep ? currentPhotos[1] : null}
            onBusy={onBusy}
          />
        )}
        <p className="text-xs text-muted">
          {isDuet ? "Upload one photo per singer, or one photo of the pair in Photo 1. " : ""}
          Leave a photo empty to keep the current one.
        </p>
      </div>
      <SubmitButton className="btn-primary w-full" disabled={busy > 0} pendingText="Saving…">
        {busy > 0 ? "Preparing photo…" : "Confirm champion"}
      </SubmitButton>
    </form>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { saveChampion } from "./actions";

type Option = { id: string; label: string };

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

export function ChampionForm({
  category,
  options,
  defaultId,
  currentPhoto,
}: {
  category: string;
  options: Option[];
  defaultId: string;
  currentPhoto: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentPhoto);
  const [busy, setBusy] = useState(false);

  return (
    <form action={saveChampion} className="space-y-3">
      <input type="hidden" name="category" value={category} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Champion</span>
        <select name="contestant_id" defaultValue={defaultId} required className="field">
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
      <div className="flex items-center gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg/60 ring-1 ring-line">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-muted">No photo</span>
          )}
        </div>
        <label className="block min-w-0 flex-1 space-y-1.5">
          <span className="text-sm font-medium">Photo for the winners screen</span>
          <input
            ref={fileRef}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-panel-2 file:px-3 file:py-2 file:text-ink"
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              setBusy(true);
              const small = await resize(file);
              const dt = new DataTransfer();
              dt.items.add(small);
              input.files = dt.files;
              setPreview(URL.createObjectURL(small));
              setBusy(false);
            }}
          />
          <span className="block text-xs text-muted">Leave empty to keep the current photo.</span>
        </label>
      </div>
      <SubmitButton className="btn-primary w-full" disabled={busy} pendingText="Saving…">
        {busy ? "Preparing photo…" : "Confirm champion"}
      </SubmitButton>
    </form>
  );
}

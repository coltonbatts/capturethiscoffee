"use client";

import { ImagePlus, LinkIcon, Trash2, Upload } from "lucide-react";
import { useId, useState } from "react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import { uploadPersonPhoto } from "@/lib/person-photo-upload";

export function PersonPhotoField({
  value,
  personName,
  onChange,
  disabled = false,
}: {
  value: string;
  personName: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;

    setUploading(true);
    setError("");
    try {
      onChange(await uploadPersonPhoto(file, personName));
      setShowUrl(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload that image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3 rounded-lg border border-zinc-500 bg-white p-2.5">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-black">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase/local photos are dynamic.
            <img
              src={value}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ImagePlus size={22} className="text-zinc-500" aria-hidden="true" />
          )}
        </div>

        <div className="grid min-w-0 flex-1 gap-1">
          <p className="text-xs font-black uppercase tracking-normal text-zinc-600">
            Photo
          </p>
          <div className="flex gap-2">
            <label
              htmlFor={inputId}
              className={`${secondaryButtonClass} flex-1 cursor-pointer`}
            >
              <Upload size={16} aria-hidden="true" />
              {uploading ? "Uploading…" : "Upload"}
            </label>
            <button
              type="button"
              onClick={() => setShowUrl((current) => !current)}
              className={`${secondaryButtonClass} flex-1`}
              aria-expanded={showUrl}
            >
              <LinkIcon size={16} aria-hidden="true" />
              URL
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-700 bg-white text-red-700 transition hover:bg-red-50 active:translate-y-px"
                aria-label="Remove photo"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void onFileChange(event)}
        disabled={disabled || uploading}
      />

      {showUrl ? (
        <input
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste image URL"
          aria-label="Photo URL"
        />
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

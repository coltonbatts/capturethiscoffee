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
      <div className="grid gap-3 rounded-lg border border-zinc-500 bg-white p-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
        <div className="grid size-24 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-black">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase/local photos are dynamic.
            <img
              src={value}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ImagePlus size={30} className="text-zinc-500" aria-hidden="true" />
          )}
        </div>

        <div className="grid min-w-0 gap-2">
          <div>
            <p className="text-sm font-bold text-black">Person photo</p>
            <p className="mt-0.5 text-sm leading-5 text-zinc-600">
              Upload a face photo for roster cards and label selection.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label
              htmlFor={inputId}
              className={`${secondaryButtonClass} min-h-12 cursor-pointer`}
            >
              <Upload size={18} aria-hidden="true" />
              {uploading ? "Uploading..." : "Upload"}
            </label>
            <button
              type="button"
              onClick={() => setShowUrl((current) => !current)}
              className={`${secondaryButtonClass} min-h-12`}
            >
              <LinkIcon size={18} aria-hidden="true" />
              URL
            </button>
          </div>
          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-700 bg-white px-3 text-sm font-bold text-red-700 hover:bg-red-50"
            >
              <Trash2 size={17} aria-hidden="true" />
              Remove photo
            </button>
          ) : null}
        </div>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
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

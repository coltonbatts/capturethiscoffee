"use client";

import { normalizeSupabaseWriteError, requireFreshAppSession } from "./auth";
import { getSupabaseBrowserClient } from "./supabase";

const personPhotoBucket = "person-photos";
const maxPhotoBytes = 8 * 1024 * 1024;

export async function uploadPersonPhoto(
  file: File,
  personName: string,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  if (file.size > maxPhotoBytes) {
    throw new Error("Choose an image under 8 MB.");
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return fileToDataUrl(file);

  await requireFreshAppSession(supabase);

  const extension = extensionForFile(file);
  const slug = slugify(personName || "person");
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${slug}.${extension}`;

  const { error } = await supabase.storage
    .from(personPhotoBucket)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    if (error.message.toLowerCase().includes("bucket not found")) {
      throw new Error(
        "Person photo storage is not ready. Run the Supabase storage migration, then try again.",
      );
    }
    if (
      error.message.toLowerCase().includes("mime type") ||
      error.message.toLowerCase().includes("invalid file type")
    ) {
      throw new Error(
        "That image type is not supported. Use JPEG, PNG, WebP, GIF, or HEIC from your camera roll.",
      );
    }
    throw normalizeSupabaseWriteError(error.message);
  }

  const { data } = supabase.storage.from(personPhotoBucket).getPublicUrl(path);
  return data.publicUrl;
}

function extensionForFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "person"
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

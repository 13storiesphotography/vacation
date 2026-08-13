import { createClient } from "@/lib/supabase/client";

export const SPOT_IMAGES_BUCKET = "spot-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function extensionForMime(mime: string, fileName: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  if (mime.includes("heif")) return "heif";
  return "jpg";
}

export async function uploadSpotImage(params: {
  vacationId: string;
  file: File;
}): Promise<{ url: string } | { error: string }> {
  const { vacationId, file } = params;
  if (!vacationId) return { error: "Urlaub fehlt." };
  if (!file || file.size <= 0) return { error: "Keine Datei gewählt." };
  if (file.size > MAX_BYTES) {
    return { error: "Bild ist zu groß (max. 5 MB)." };
  }
  const mime = (file.type || "image/jpeg").toLowerCase();
  if (!ALLOWED_TYPES.has(mime) && !mime.startsWith("image/")) {
    return { error: "Bitte ein Foto (JPEG, PNG oder WebP) wählen." };
  }

  const ext = extensionForMime(mime, file.name || "photo.jpg");
  const objectPath = `${vacationId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();

  const { error } = await supabase.storage.from(SPOT_IMAGES_BUCKET).upload(objectPath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: mime.startsWith("image/") ? mime : "image/jpeg",
  });

  if (error) {
    return { error: error.message || "Upload fehlgeschlagen." };
  }

  const { data } = supabase.storage.from(SPOT_IMAGES_BUCKET).getPublicUrl(objectPath);
  if (!data?.publicUrl) {
    return { error: "Bild-URL konnte nicht erzeugt werden." };
  }

  return { url: data.publicUrl };
}

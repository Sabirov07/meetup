/**
 * Shared facts about document image uploads.
 *
 * Imported by both the browser (to reject a file before it is sent, and to
 * build the `accept` attribute) and the upload route (which re-checks
 * everything, because a client-side limit is a courtesy, not a control).
 */

/** 5 MB. Big enough for a full-window screenshot, small enough for a row in Postgres. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * SVG is deliberately absent: it is a document format that can carry script,
 * and it would be served from this origin.
 */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
] as const;

export const IMAGE_ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

export const UPLOAD_ENDPOINT = "/api/attachments";

export type UploadedAttachment = {
  id: string;
  url: string;
  filename: string;
  byteSize: number;
  width: number | null;
  height: number | null;
};

export function attachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}

export function isAcceptedImage(mimeType: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Why a file was rejected, phrased for the person who dropped it. */
export function rejectionReason(file: { type: string; size: number; name: string }): string | null {
  if (!isAcceptedImage(file.type)) {
    return `${file.name || "That file"} is not an image Meetup can embed. PNG, JPEG, GIF, WebP and AVIF work.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name || "That image"} is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_IMAGE_BYTES)}.`;
  }
  return null;
}

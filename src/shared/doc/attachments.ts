/**
 * Shared facts about document attachments.
 *
 * Imported by both the browser (to reject a file before it is sent, and to
 * build the `accept` attribute) and the upload route (which re-checks
 * everything, because a client-side limit is a courtesy, not a control).
 *
 * Two kinds travel this path. An **image** is embedded in the document and
 * shown inline. A **file** — a translations JSON, a CSV export, a signed PDF —
 * is carried alongside it as a download, because the work it belongs to is the
 * task, not a chat thread someone has to scroll back through.
 */

import type { Translate } from "../i18n";

/** 5 MB. Big enough for a full-window screenshot, small enough for a row in Postgres. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 15 MB. A translations bundle or an export, not a video or a disk image. */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

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

/**
 * Carried files, keyed by extension rather than by the browser's `file.type`:
 * a `.json` arrives as `application/json` in Chrome, as `text/plain` in some
 * Safari builds and as an empty string from a few Linux file pickers, so the
 * name is the only field worth trusting. The value is what the download route
 * will serve it back as — never the type the client claimed, which is what
 * stops an upload asking to be re-served as markup.
 *
 * Nothing executable is here: no `.html`, `.js`, `.svg`, `.exe`.
 */
const FILE_TYPES: Record<string, string> = {
  // Structured data — translations, exports, configuration.
  ".json": "application/json",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".xml": "application/xml",
  ".yml": "text/yaml",
  ".yaml": "text/yaml",
  // Translation bundles, as the tools that produce them name them.
  ".po": "text/x-gettext-translation",
  ".pot": "text/x-gettext-translation",
  ".xliff": "application/xliff+xml",
  ".xlf": "application/xliff+xml",
  ".strings": "text/plain",
  ".properties": "text/plain",
  ".resx": "application/xml",
  // Plain documents.
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".log": "text/plain",
  ".srt": "text/plain",
  ".vtt": "text/vtt",
  // Office and print.
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Several of the above, sent together.
  ".zip": "application/zip",
};

export const ACCEPTED_FILE_EXTENSIONS = Object.keys(FILE_TYPES);

export const IMAGE_ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

export const FILE_ACCEPT_ATTRIBUTE = ACCEPTED_FILE_EXTENSIONS.join(",");

/** Everything the picker will offer, for the one input that takes both. */
export const ATTACHMENT_ACCEPT_ATTRIBUTE = [
  IMAGE_ACCEPT_ATTRIBUTE,
  FILE_ACCEPT_ATTRIBUTE,
].join(",");

export const UPLOAD_ENDPOINT = "/api/attachments";

/** Embedded in the document, or carried next to it. */
export type AttachmentKind = "image" | "file";

export type UploadedAttachment = {
  id: string;
  kind: AttachmentKind;
  url: string;
  filename: string;
  byteSize: number;
  width: number | null;
  height: number | null;
};

export function attachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}

/** True for a link the document renderer should show as a download, not a link. */
export function isAttachmentHref(href: string): boolean {
  return href.startsWith(`${UPLOAD_ENDPOINT}/`);
}

export function isAcceptedImage(mimeType: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

/** `report.FINAL.json` → `.json`; no extension gives an empty string. */
export function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

export function isAcceptedFile(filename: string): boolean {
  return extensionOf(filename) in FILE_TYPES;
}

/** What a carried file is served back as. The client's claim is never used. */
export function fileMimeType(filename: string): string {
  return FILE_TYPES[extensionOf(filename)] ?? "application/octet-stream";
}

/** Which of the two paths a dropped file takes, or null if it takes neither. */
export function attachmentKind(file: { type: string; name: string }): AttachmentKind | null {
  if (isAcceptedImage(file.type)) return "image";
  if (isAcceptedFile(file.name)) return "file";
  return null;
}

export function maxBytesFor(kind: AttachmentKind): number {
  return kind === "image" ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The Markdown an upload becomes: an image embeds, a file links. */
export function attachmentMarkdown(upload: UploadedAttachment): string {
  const label = upload.filename.replace(/[[\]]/g, "");
  return upload.kind === "image" ? `![${label}](${upload.url})` : `[${label}](${upload.url})`;
}

/** Why a file was rejected, phrased for the person who dropped it. */
export function rejectionReason(
  file: { type: string; size: number; name: string },
  t: Translate,
): string | null {
  const kind = attachmentKind(file);
  if (!kind) {
    return t("errors.upload.unsupported", {
      name: file.name || t("errors.upload.thatFile"),
    });
  }

  const limit = maxBytesFor(kind);
  if (file.size > limit) {
    return t("errors.upload.tooLarge", {
      name: file.name || t("errors.upload.thatFile"),
      size: formatBytes(file.size),
      limit: formatBytes(limit),
    });
  }
  return null;
}

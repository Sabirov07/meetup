import { getSessionContext } from "@/backend/auth/guards";
import { db } from "@/backend/db";

/**
 * Serves an attachment — an embedded image, or a file someone attached to the
 * work (a translations JSON, a CSV, a PDF).
 *
 * This route is the whole reason the bytes live in Postgres instead of under
 * `public/`: a file in `public/` is readable by anyone who has the URL, and
 * what people attach to a task — a screenshot, a price list, a contract — is
 * usually exactly what should not be. Here the row is fetched with the
 * caller's workspace id, so a member of another workspace gets a 404 even with
 * the exact attachment id.
 *
 * The id is content-addressed in practice — a row's bytes are never rewritten —
 * so the response can be cached hard, privately, and revalidated by ETag.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSessionContext();
  if (!session) {
    return new Response("Sign in to view this attachment.", { status: 401 });
  }

  const etag = `"${id}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const row = await db.attachment.findFirst({
    where: { id, workspaceId: session.workspace.id },
    select: { data: true, mimeType: true, filename: true, byteSize: true },
  });
  if (!row) {
    return new Response("That attachment is not available.", { status: 404 });
  }

  // An image is shown where it sits in the document, so it is served inline.
  // Anything else is handed to the person as a file: a browser that renders an
  // attachment in place is one redirect away from being a file host.
  const inline = row.mimeType.startsWith("image/");
  // The quoted name is the latin-1 fallback; `filename*` is what a current
  // browser reads, so a file called «переводы.json» downloads under its name.
  const disposition =
    `${inline ? "inline" : "attachment"}; filename="${asciiFilename(row.filename)}"; ` +
    `filename*=UTF-8''${encodeURIComponent(row.filename)}`;

  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(row.byteSize),
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: etag,
      // The bytes are returned exactly as uploaded; this stops a browser from
      // deciding the file is really something else and running it.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Header values are latin-1, so anything else is replaced rather than dropped. */
function asciiFilename(name: string): string {
  const cleaned = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return cleaned || "attachment";
}

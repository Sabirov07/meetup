import { getSessionContext } from "@/lib/auth/guards";
import { db } from "@/lib/db";

/**
 * Serves an embedded image.
 *
 * This route is the whole reason the bytes live in Postgres instead of under
 * `public/`: a file in `public/` is readable by anyone who has the URL, and an
 * image pasted into a task is often a screenshot of something that should not
 * be. Here the row is fetched with the caller's workspace id, so a member of
 * another workspace gets a 404 even with the exact attachment id.
 *
 * The id is content-addressed in practice — a row's bytes are never rewritten —
 * so the response can be cached hard, privately, and revalidated by ETag.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSessionContext();
  if (!session) {
    return new Response("Sign in to view this image.", { status: 401 });
  }

  const etag = `"${id}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const row = await db.taskAttachment.findFirst({
    where: { id, workspaceId: session.workspace.id },
    select: { data: true, mimeType: true, filename: true, byteSize: true },
  });
  if (!row) {
    return new Response("That image is not available.", { status: 404 });
  }

  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(row.byteSize),
      "Content-Disposition": `inline; filename="${asciiFilename(row.filename)}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: etag,
      // The bytes are returned exactly as uploaded; this stops a browser from
      // deciding an image is really something else and running it.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Header values are latin-1, so anything else is replaced rather than dropped. */
function asciiFilename(name: string): string {
  const cleaned = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return cleaned || "image";
}

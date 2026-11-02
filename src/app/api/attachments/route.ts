import { NextResponse } from "next/server";
import { getSessionContext } from "@/backend/auth/guards";
import { db } from "@/backend/db";
import {
  attachmentUrl,
  formatBytes,
  isAcceptedImage,
  MAX_IMAGE_BYTES,
  type UploadedAttachment,
} from "@/shared/doc/attachments";
import { readImageSize } from "@/backend/images/dimensions";

/**
 * Receives an image pasted, dropped or picked inside a document — a task's, or
 * a knowledge page's.
 *
 * A Route Handler rather than a Server Function because Server Functions cap
 * their request body at 1 MB by default, and a screenshot routinely exceeds
 * that. Raising that cap globally would also raise it for every other action
 * in the app, which is the wrong trade for one upload path.
 *
 * Every check the browser makes is repeated here — a client-side limit only
 * saves the user a wasted round-trip, it does not constrain a caller.
 */
export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "That upload could not be read." }, { status: 400 });
  }

  const taskId = form.get("taskId");
  const docId = form.get("docId");
  const file = form.get("file");

  // Exactly one owner, matching the constraint the table itself carries.
  const owner =
    typeof taskId === "string" && taskId
      ? ({ kind: "task", id: taskId } as const)
      : typeof docId === "string" && docId
        ? ({ kind: "knowledge", id: docId } as const)
        : null;

  if (!owner || (taskId && docId)) {
    return NextResponse.json(
      { error: "An image has to belong to exactly one document." },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image was attached." }, { status: 400 });
  }

  // Workspace isolation: the document has to be one this session can already
  // see, which is also what stops an upload landing in another workspace.
  const exists =
    owner.kind === "task"
      ? await db.task.findFirst({
          where: { id: owner.id, workspaceId: session.workspace.id },
          select: { id: true },
        })
      : await db.knowledgeDoc.findFirst({
          where: { id: owner.id, workspaceId: session.workspace.id },
          select: { id: true },
        });

  if (!exists) {
    return NextResponse.json(
      { error: "That document no longer exists in this workspace." },
      { status: 404 },
    );
  }

  if (!isAcceptedImage(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, GIF, WebP and AVIF images can be embedded." },
      { status: 415 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // `file.size` is claimed by the client, so the measured length is what counts.
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "That image is empty." }, { status: 400 });
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Images have to be ${formatBytes(MAX_IMAGE_BYTES)} or smaller.` },
      { status: 413 },
    );
  }

  const size = readImageSize(bytes);
  const filename = safeFilename(file.name);

  const row = await db.attachment.create({
    data: {
      workspaceId: session.workspace.id,
      taskId: owner.kind === "task" ? owner.id : null,
      knowledgeDocId: owner.kind === "knowledge" ? owner.id : null,
      uploadedByMemberId: session.member.id,
      filename,
      mimeType: file.type.toLowerCase(),
      byteSize: bytes.byteLength,
      width: size?.width ?? null,
      height: size?.height ?? null,
      data: bytes,
    },
    select: { id: true, filename: true, byteSize: true, width: true, height: true },
  });

  const payload: UploadedAttachment = {
    id: row.id,
    url: attachmentUrl(row.id),
    filename: row.filename,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
  };
  return NextResponse.json(payload, { status: 201 });
}

/**
 * A pasted screenshot arrives as `image.png`; a dropped file brings whatever
 * name it had. Either way only the basename is kept, and it is only ever used
 * as alt text and as a download name.
 */
function safeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop()?.trim() ?? "";
  if (!base) return "image";
  return base.slice(0, 120);
}

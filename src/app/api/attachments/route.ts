import { NextResponse } from "next/server";
import { message } from "@/backend/i18n/message";
import { getSessionContext } from "@/backend/auth/guards";
import { db } from "@/backend/db";
import {
  attachmentKind,
  attachmentUrl,
  fileMimeType,
  formatBytes,
  maxBytesFor,
  type UploadedAttachment,
} from "@/shared/doc/attachments";
import { readImageSize } from "@/backend/images/dimensions";

/**
 * Receives a file pasted, dropped or picked inside a document — a task's, or a
 * knowledge page's.
 *
 * Two kinds land here. An image is embedded in the body; anything else on the
 * allow-list (a translations JSON, a CSV, a PDF) is stored the same way and
 * linked as a download, so the file lives with the work instead of in whatever
 * chat it was sent through.
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
    return NextResponse.json({ error: await message("errors.sessionExpired") }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: await message("errors.upload.unreadable") }, { status: 400 });
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
      { error: await message("errors.upload.oneDocument") },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: await message("errors.upload.noFile") }, { status: 400 });
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
      { error: await message("errors.upload.docGone") },
      { status: 404 },
    );
  }

  const filename = safeFilename(file.name);
  const kind = attachmentKind({ type: file.type, name: filename });
  if (!kind) {
    return NextResponse.json(
      { error: await message("errors.upload.wrongType") },
      { status: 415 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // `file.size` is claimed by the client, so the measured length is what counts.
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: await message("errors.upload.empty") }, { status: 400 });
  }
  const limit = maxBytesFor(kind);
  if (bytes.byteLength > limit) {
    return NextResponse.json(
      {
        error: await message("errors.upload.overLimit", {
          size: formatBytes(bytes.byteLength),
          limit: formatBytes(limit),
        }),
      },
      { status: 413 },
    );
  }

  // An image's type is the one the browser detected and we accepted; a carried
  // file's comes from its extension, so a caller cannot choose what the
  // download route will later serve it as.
  const mimeType = kind === "image" ? file.type.toLowerCase() : fileMimeType(filename);
  const size = kind === "image" ? readImageSize(bytes) : null;

  const row = await db.attachment.create({
    data: {
      workspaceId: session.workspace.id,
      taskId: owner.kind === "task" ? owner.id : null,
      knowledgeDocId: owner.kind === "knowledge" ? owner.id : null,
      uploadedByMemberId: session.member.id,
      filename,
      mimeType,
      byteSize: bytes.byteLength,
      width: size?.width ?? null,
      height: size?.height ?? null,
      data: bytes,
    },
    select: { id: true, filename: true, byteSize: true, width: true, height: true },
  });

  const payload: UploadedAttachment = {
    id: row.id,
    kind,
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
 * as alt text, as a link label and as a download name.
 */
function safeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop()?.trim() ?? "";
  if (!base) return "image";
  return base.slice(0, 120);
}

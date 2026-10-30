-- Images embedded in a task's document body.
--
-- The bytes are stored in Postgres, not on disk or in a public bucket, so that
-- reading an image requires the same workspace membership as reading the task
-- it belongs to. `workspaceId` is denormalised onto the row so the serving
-- route can authorise with a single indexed lookup instead of a join.
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedByMemberId" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_attachments_taskId_createdAt_idx" ON "task_attachments"("taskId", "createdAt");
CREATE INDEX "task_attachments_workspaceId_idx" ON "task_attachments"("workspaceId");

ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploadedByMemberId_fkey"
    FOREIGN KEY ("uploadedByMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security mirrors the other tables: Prisma connects as the owner
-- role and bypasses these policies, but they keep the table out of reach of
-- Supabase's public PostgREST endpoint.
ALTER TABLE "task_attachments" ENABLE ROW LEVEL SECURITY;

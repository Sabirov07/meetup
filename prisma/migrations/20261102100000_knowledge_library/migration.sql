-- The knowledge library: workspace-level pages for information that outlives
-- any single task. The body is the same Markdown document format tasks use.
CREATE TABLE "knowledge_docs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdByMemberId" TEXT,
    "updatedByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_docs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_docs_workspaceId_updatedAt_idx" ON "knowledge_docs"("workspaceId", "updatedAt");
CREATE INDEX "knowledge_docs_workspaceId_isPinned_idx" ON "knowledge_docs"("workspaceId", "isPinned");

ALTER TABLE "knowledge_docs" ADD CONSTRAINT "knowledge_docs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_docs" ADD CONSTRAINT "knowledge_docs_createdByMemberId_fkey"
    FOREIGN KEY ("createdByMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "knowledge_docs" ADD CONSTRAINT "knowledge_docs_updatedByMemberId_fkey"
    FOREIGN KEY ("updatedByMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_docs" ENABLE ROW LEVEL SECURITY;

-- An embedded image is no longer necessarily a task's, so the table loses the
-- "task_" prefix and gains a second possible owner. Renaming keeps the rows
-- and the indexes; the table is new enough that nothing else refers to it.
ALTER TABLE "task_attachments" RENAME TO "attachments";
ALTER INDEX "task_attachments_pkey" RENAME TO "attachments_pkey";
ALTER INDEX "task_attachments_taskId_createdAt_idx" RENAME TO "attachments_taskId_createdAt_idx";
ALTER INDEX "task_attachments_workspaceId_idx" RENAME TO "attachments_workspaceId_idx";
ALTER TABLE "attachments" RENAME CONSTRAINT "task_attachments_workspaceId_fkey" TO "attachments_workspaceId_fkey";
ALTER TABLE "attachments" RENAME CONSTRAINT "task_attachments_taskId_fkey" TO "attachments_taskId_fkey";
ALTER TABLE "attachments" RENAME CONSTRAINT "task_attachments_uploadedByMemberId_fkey" TO "attachments_uploadedByMemberId_fkey";

ALTER TABLE "attachments" ALTER COLUMN "taskId" DROP NOT NULL;
ALTER TABLE "attachments" ADD COLUMN "knowledgeDocId" TEXT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_knowledgeDocId_fkey"
    FOREIGN KEY ("knowledgeDocId") REFERENCES "knowledge_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "attachments_knowledgeDocId_createdAt_idx" ON "attachments"("knowledgeDocId", "createdAt");

-- Exactly one owner. Without this, a row could be orphaned (both null, so no
-- cascade ever reaches it) or claimed twice.
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_one_owner"
    CHECK (num_nonnulls("taskId", "knowledgeDocId") = 1);

-- Activity entries can point at a knowledge page, the same way they point at
-- a task or a meeting.
ALTER TABLE "activity_events" ADD COLUMN "knowledgeDocId" TEXT;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_knowledgeDocId_fkey"
    FOREIGN KEY ("knowledgeDocId") REFERENCES "knowledge_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Postgres 12+ allows this inside a transaction as long as the new values are
-- not used in the same one; they are first written at runtime.
ALTER TYPE "ActivityType" ADD VALUE 'KNOWLEDGE_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'KNOWLEDGE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'KNOWLEDGE_DELETED';

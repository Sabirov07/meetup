-- Flowcharts: a process drawn as boxes and arrows, kept at the workspace
-- level like a knowledge page. The diagram is one JSON document — nodes and
-- edges are always read and written together, so there is nothing to gain
-- from splitting them into rows.
CREATE TABLE "flowcharts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "document" JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    "createdByMemberId" TEXT,
    "updatedByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flowcharts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flowcharts_workspaceId_updatedAt_idx" ON "flowcharts"("workspaceId", "updatedAt");

ALTER TABLE "flowcharts" ADD CONSTRAINT "flowcharts_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flowcharts" ADD CONSTRAINT "flowcharts_createdByMemberId_fkey"
    FOREIGN KEY ("createdByMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flowcharts" ADD CONSTRAINT "flowcharts_updatedByMemberId_fkey"
    FOREIGN KEY ("updatedByMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "flowcharts" ENABLE ROW LEVEL SECURITY;

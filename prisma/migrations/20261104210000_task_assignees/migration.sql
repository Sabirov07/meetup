-- A task can carry more than one person: the owner stays on tasks.ownerMemberId,
-- everyone else on the task lives here.
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_assignees_taskId_memberId_key" ON "task_assignees"("taskId", "memberId");
CREATE INDEX "task_assignees_memberId_idx" ON "task_assignees"("memberId");

ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "workspace_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A step can be handed to someone other than the task's owner.
ALTER TABLE "subtasks" ADD COLUMN "assigneeMemberId" TEXT;

CREATE INDEX "subtasks_assigneeMemberId_idx" ON "subtasks"("assigneeMemberId");

-- SET NULL: a member leaving the workspace unassigns their steps, it does
-- not delete them.
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assigneeMemberId_fkey"
    FOREIGN KEY ("assigneeMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

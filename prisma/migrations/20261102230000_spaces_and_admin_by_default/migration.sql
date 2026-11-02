-- Sections of a workspace ("Front end", "Design", "Back end"), and everyone
-- who joins arriving able to run the place.
--
-- Two changes, one migration, because they answer the same complaint: a
-- workspace with one undifferentiated board and one person allowed to change
-- anything is not a workspace a team can actually work in.

-- ---------------------------------------------------------------------------
-- Spaces
-- ---------------------------------------------------------------------------

CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorToken" TEXT NOT NULL DEFAULT 'violet',
    "description" TEXT,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- Two spaces with the same name in one sidebar are indistinguishable; across
-- workspaces the names repeat freely.
CREATE UNIQUE INDEX "spaces_workspaceId_name_key" ON "spaces"("workspaceId", "name");
CREATE INDEX "spaces_workspaceId_position_idx" ON "spaces"("workspaceId", "position");

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_createdByMemberId_fkey"
    FOREIGN KEY ("createdByMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "spaces" ENABLE ROW LEVEL SECURITY;

-- Nullable, and SET NULL rather than CASCADE: deleting a section must not
-- delete the work that was filed under it. Those tasks reappear under
-- "No section", which is also where every task that exists today starts.
ALTER TABLE "tasks" ADD COLUMN "spaceId" TEXT;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "tasks_spaceId_status_idx" ON "tasks"("spaceId", "status");

-- Postgres 12+ allows this inside a transaction as long as the new values are
-- not used in the same one; they are first written at runtime.
ALTER TYPE "ActivityType" ADD VALUE 'SPACE_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'SPACE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'SPACE_DELETED';

-- ---------------------------------------------------------------------------
-- Everyone can manage the workspace
-- ---------------------------------------------------------------------------

-- The product is used by small teams who all run their own workspace. Joining
-- one and then having to ask the person who sent the link for permission to
-- rename a section is friction with nothing behind it, so ADMINISTRATOR is now
-- what a membership is by default.
--
-- MEMBER is kept rather than dropped: a workspace that genuinely wants a
-- do-the-work-only role can still demote someone from the Team page, and the
-- last-administrator guard needs a second role to be meaningful.
ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DEFAULT 'ADMINISTRATOR';
ALTER TABLE "workspace_invites" ALTER COLUMN "role" SET DEFAULT 'ADMINISTRATOR';

-- Everyone already here is promoted. Anyone deliberately demoted after this
-- runs stays demoted; this is a one-time correction of a default, not a policy
-- that re-applies.
UPDATE "workspace_members" SET "role" = 'ADMINISTRATOR' WHERE "role" = 'MEMBER';

-- Pending links were created under the old default and have not been used yet,
-- so the person they are waiting for should arrive with the same rights as
-- everyone else.
UPDATE "workspace_invites" SET "role" = 'ADMINISTRATOR'
 WHERE "role" = 'MEMBER' AND "status" = 'PENDING';

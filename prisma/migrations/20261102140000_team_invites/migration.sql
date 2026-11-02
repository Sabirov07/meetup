-- Teams: a workspace can now be joined, not only created.
--
-- Until now the only way into a workspace was to be seeded into it, so every
-- account was alone in its own. An invite is a link an administrator hands out;
-- accepting one creates the membership that everything else in the schema
-- already hangs off.

CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- Member lifecycle events, so the activity feed can account for who joined,
-- who was promoted and who left.
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_INVITED';
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_ROLE_CHANGED';
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_REMOVED';
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_LEFT';

CREATE TABLE "workspace_invites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "jobTitle" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByMemberId" TEXT,
    "acceptedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

-- The token is the lookup key for every /join/<token> request.
CREATE UNIQUE INDEX "workspace_invites_token_key" ON "workspace_invites"("token");
CREATE INDEX "workspace_invites_workspaceId_status_idx" ON "workspace_invites"("workspaceId", "status");
CREATE INDEX "workspace_invites_email_idx" ON "workspace_invites"("email");

ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invitedByMemberId_fkey"
    FOREIGN KEY ("invitedByMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Matches every other table: the application enforces isolation through
-- requireSession(), and RLS keeps Supabase's public PostgREST endpoint shut.
ALTER TABLE "workspace_invites" ENABLE ROW LEVEL SECURITY;

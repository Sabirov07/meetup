-- A main workspace, distinct from the last one open.
--
-- `lastWorkspaceId` is overwritten by every switch, so it could never answer
-- "which workspace is this person's real one". When it was null — cleared by
-- leaving a workspace, or never written — the session fell back to the OLDEST
-- membership, which for anyone who signed up before joining their team is the
-- empty personal workspace sign-up created for them. They landed in the wrong
-- place through no choice of their own.
--
-- `primaryWorkspaceId` is set deliberately and survives moving around, so it
-- can carry that answer.

ALTER TABLE "user_preferences" ADD COLUMN "primaryWorkspaceId" TEXT;

-- Seed it from where everyone already is: the workspace you have open is a
-- better guess at your main one than the accident of creation order. Anyone
-- for whom that is wrong can now say so, which was the point.
UPDATE "user_preferences" SET "primaryWorkspaceId" = "lastWorkspaceId"
 WHERE "lastWorkspaceId" IS NOT NULL;

-- Custom task statuses. The fixed enum becomes a per-workspace table so a
-- workspace can add stages of its own and put them in the order its work
-- flows. The four historical values stay as built-in rows with the same keys,
-- so no task changes meaning.
CREATE TABLE "task_statuses" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "tone" TEXT NOT NULL DEFAULT 'neutral',
    "position" INTEGER NOT NULL,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_statuses_workspaceId_key_key" ON "task_statuses"("workspaceId", "key");
CREATE INDEX "task_statuses_workspaceId_position_idx" ON "task_statuses"("workspaceId", "position");

ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_statuses" ENABLE ROW LEVEL SECURITY;

-- Every existing workspace gets the four built-ins in their historical order.
INSERT INTO "task_statuses" ("id", "workspaceId", "key", "tone", "position", "builtin")
SELECT 'ts_' || md5(w."id" || s.key), w."id", s.key, s.tone, s.position, true
FROM "workspaces" w
CROSS JOIN (VALUES
    ('TODO', 'neutral', 100),
    ('IN_PROGRESS', 'accent', 200),
    ('BLOCKED', 'warning', 300),
    ('COMPLETED', 'success', 400)
) AS s(key, tone, position);

-- The column itself: enum -> text, same values.
ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'TODO';

DROP TYPE "TaskStatus";

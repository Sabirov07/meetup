-- A task gets a checklist: the steps someone works down while doing it.
--
-- A separate table rather than a self-reference on `tasks`, because a step is
-- not a commitment — see the note on `Subtask` in schema.prisma for why every
-- board, filter and statistic in the app is better off never seeing one.

CREATE TABLE "subtasks" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    -- Sparse, so a step can be dropped between two others without
    -- renumbering the ones around it.
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- Every read is "the steps on this task, in order", which is exactly this.
CREATE INDEX "subtasks_taskId_position_idx" ON "subtasks"("taskId", "position");

-- CASCADE: a step has no meaning without the task it is a step of.
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subtasks" ENABLE ROW LEVEL SECURITY;

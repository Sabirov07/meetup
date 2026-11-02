-- Task notes become a discussion: people talk to each other on a task, call
-- each other in by name, and call the assistant in with `@ai`.
--
-- The existing `task_comments` rows are the thread's history, so this extends
-- that table rather than adding a second one. Every column added is nullable
-- or defaulted: the notes already written stay exactly as they are, and read
-- back as plain messages from their author with nobody mentioned.

CREATE TYPE "CommentKind" AS ENUM ('MESSAGE', 'AI_ANSWER');

ALTER TABLE "task_comments" ADD COLUMN "kind" "CommentKind" NOT NULL DEFAULT 'MESSAGE';

-- Who was called into the conversation, resolved at the moment the message was
-- posted. A snapshot rather than a join: renaming someone, or their leaving the
-- workspace, must not rewrite who was asked.
ALTER TABLE "task_comments" ADD COLUMN "mentionedMemberIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "task_comments" ADD COLUMN "mentionsAi" BOOLEAN NOT NULL DEFAULT false;

-- An assistant message points at the message it answers. CASCADE, because an
-- answer to a deleted question is an orphan nobody can read in context.
ALTER TABLE "task_comments" ADD COLUMN "answersId" TEXT;
CREATE UNIQUE INDEX "task_comments_answersId_key" ON "task_comments"("answersId");
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_answersId_fkey"
    FOREIGN KEY ("answersId") REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The structured part of an assistant answer — recommendations, risks, open
-- questions and the interface sketch. Nothing queries inside it; it is read
-- back only to re-render the one message it belongs to.
ALTER TABLE "task_comments" ADD COLUMN "advice" JSONB;
ALTER TABLE "task_comments" ADD COLUMN "model" TEXT;

-- A message can be edited after it is posted. The time of the last edit is
-- kept so the thread can say "edited" next to it; null means never, so the
-- messages already written read back unchanged.
ALTER TABLE "task_comments" ADD COLUMN "editedAt" TIMESTAMP(3);

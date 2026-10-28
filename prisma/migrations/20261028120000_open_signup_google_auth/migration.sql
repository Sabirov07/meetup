-- Open sign-up: email + password, or Google.
--
-- A Google-only account never has a password, so `passwordHash` has to be
-- nullable. Existing rows all have one, so dropping NOT NULL is safe and
-- needs no backfill.
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Google's `sub` claim: stable per Google account, unlike the email address.
ALTER TABLE "users" ADD COLUMN "googleSub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");

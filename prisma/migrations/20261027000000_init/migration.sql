-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('ADMINISTRATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('DEVELOPMENT', 'AI_AUTOMATION', 'INFRASTRUCTURE', 'RESEARCH', 'BUSINESS_OPS', 'FINANCE', 'COMMUNICATION', 'ADMINISTRATION', 'PLANNING', 'REVIEW_APPROVAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('CONFIRMED', 'INFERRED', 'RECOMMENDED');

-- CreateEnum
CREATE TYPE "MeetingSource" AS ENUM ('MANUAL', 'GOOGLE_MEET');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'READY_TO_JOIN', 'IN_PROGRESS', 'AWAITING_TRANSCRIPT', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('NOT_REQUESTED', 'AWAITING', 'FETCHING', 'READY', 'UNAVAILABLE', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('TASK_CREATED', 'TASK_UPDATED', 'TASK_STATUS_CHANGED', 'TASK_OWNER_CHANGED', 'TASK_PRIORITY_CHANGED', 'TASK_DUE_DATE_CHANGED', 'TASK_COMPLETED', 'TASK_REOPENED', 'TASK_DELETED', 'TASK_COMMENTED', 'MEETING_CREATED', 'MEETING_UPDATED', 'TRANSCRIPT_READY', 'TRANSCRIPT_FAILED', 'ANALYSIS_COMPLETED', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'MEMBER_JOINED');

-- CreateEnum
CREATE TYPE "RecommendationKind" AS ENUM ('UNBLOCK_DEPENDENCY', 'REQUEST_ACCESS', 'CLARIFY_DEADLINE', 'HIGH_IMPACT_BLOCKER', 'POSSIBLE_DUPLICATE', 'STALE_TASK', 'OVERDUE_CLUSTER', 'AWAITING_OTHER_PERSON');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TaskSortMode" AS ENUM ('SMART', 'PRIORITY', 'DUE_DATE', 'STATUS', 'CREATED_AT', 'UPDATED_AT', 'ALPHABETICAL', 'MANUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accentToken" TEXT NOT NULL DEFAULT 'violet',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultSort" "TaskSortMode" NOT NULL DEFAULT 'SMART',
    "sidebarCollapsed" BOOLEAN NOT NULL DEFAULT false,
    "lastWorkspaceId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" "MeetingSource" NOT NULL DEFAULT 'MANUAL',
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "meetUrl" TEXT,
    "notes" TEXT,
    "googleSpaceId" TEXT,
    "googleConferenceId" TEXT,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_participants" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "speakerLabel" TEXT,

    CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "content" TEXT,
    "entries" JSONB,
    "source" "MeetingSource" NOT NULL DEFAULT 'MANUAL',
    "googleTranscriptName" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_analyses" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "decisions" JSONB,
    "openQuestions" JSONB,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "failureReason" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_proposals" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "analysisId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "suggestedOwnerMemberId" TEXT,
    "ownerEvidence" "EvidenceLevel" NOT NULL DEFAULT 'INFERRED',
    "ownerRationale" TEXT,
    "isExplicitCommitment" BOOLEAN NOT NULL DEFAULT false,
    "suggestedPriority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "priorityEvidence" "EvidenceLevel" NOT NULL DEFAULT 'RECOMMENDED',
    "priorityRationale" TEXT,
    "suggestedDueDate" TEXT,
    "dueDateEvidence" "EvidenceLevel" NOT NULL DEFAULT 'RECOMMENDED',
    "category" "TaskCategory" NOT NULL DEFAULT 'GENERAL',
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transcriptExcerpt" TEXT,
    "blockers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dependsOnTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByMemberId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdTaskId" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerMemberId" TEXT,
    "creatorMemberId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" "TaskCategory" NOT NULL DEFAULT 'GENERAL',
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueDate" TIMESTAMP(3),
    "estimateMinutes" INTEGER,
    "aiSuggestedPriority" "TaskPriority",
    "aiPriorityRationale" TEXT,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "confirmedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "sourceMeetingId" TEXT,
    "sourceExcerpt" TEXT,
    "manualOrder" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorMemberId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorMemberId" TEXT,
    "type" "ActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "taskId" TEXT,
    "meetingId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "RecommendationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "relatedTaskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidence" "EvidenceLevel" NOT NULL DEFAULT 'RECOMMENDED',
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "isDeterministic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "google_accounts_userId_key" ON "google_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "meetings_workspaceId_status_idx" ON "meetings"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "meetings_workspaceId_scheduledAt_idx" ON "meetings"("workspaceId", "scheduledAt");

-- CreateIndex
CREATE INDEX "meeting_participants_meetingId_idx" ON "meeting_participants"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_meetingId_key" ON "transcripts"("meetingId");

-- CreateIndex
CREATE INDEX "transcripts_status_nextRetryAt_idx" ON "transcripts"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_analyses_meetingId_key" ON "meeting_analyses"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "task_proposals_createdTaskId_key" ON "task_proposals"("createdTaskId");

-- CreateIndex
CREATE INDEX "task_proposals_meetingId_status_idx" ON "task_proposals"("meetingId", "status");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_status_idx" ON "tasks"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_ownerMemberId_status_idx" ON "tasks"("workspaceId", "ownerMemberId", "status");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_dueDate_idx" ON "tasks"("workspaceId", "dueDate");

-- CreateIndex
CREATE INDEX "task_dependencies_dependsOnTaskId_idx" ON "task_dependencies"("dependsOnTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_taskId_dependsOnTaskId_key" ON "task_dependencies"("taskId", "dependsOnTaskId");

-- CreateIndex
CREATE INDEX "task_comments_taskId_createdAt_idx" ON "task_comments"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_events_workspaceId_createdAt_idx" ON "activity_events"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "recommendations_workspaceId_status_idx" ON "recommendations"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_analyses" ADD CONSTRAINT "meeting_analyses_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_proposals" ADD CONSTRAINT "task_proposals_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_proposals" ADD CONSTRAINT "task_proposals_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "meeting_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_proposals" ADD CONSTRAINT "task_proposals_suggestedOwnerMemberId_fkey" FOREIGN KEY ("suggestedOwnerMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_proposals" ADD CONSTRAINT "task_proposals_reviewedByMemberId_fkey" FOREIGN KEY ("reviewedByMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_proposals" ADD CONSTRAINT "task_proposals_createdTaskId_fkey" FOREIGN KEY ("createdTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creatorMemberId_fkey" FOREIGN KEY ("creatorMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceMeetingId_fkey" FOREIGN KEY ("sourceMeetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actorMemberId_fkey" FOREIGN KEY ("actorMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

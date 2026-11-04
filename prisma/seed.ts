/**
 * Seeds a two-person workspace with realistic working data.
 *
 * Honesty rules this file follows:
 *  - The seeded transcript is `source: MANUAL`. Nothing here pretends to have
 *    been retrieved from Google Meet.
 *  - The seeded analysis and its task proposals carry `isSample: true`, and the
 *    UI labels them as sample data wherever they appear.
 *  - Tasks are ordinary rows. Nothing is marked `isAiGenerated` unless it
 *    genuinely came from the proposal flow.
 *
 * Re-running is safe: it upserts the two people and the workspace, then
 * replaces the workspace's demo content.
 */

import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/backend/auth/password";

loadEnv({ path: ".env.local", quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set in .env.local");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Rename these two people in Settings once the app is running; they are only
// defaults so the workspace is not empty on first run.
const EMPLOYER = {
  email: process.env.SEED_EMPLOYER_EMAIL ?? "maya@meetup.local",
  name: process.env.SEED_EMPLOYER_NAME ?? "Maya Chen",
  jobTitle: "Founder",
  accentToken: "amber",
};

const EMPLOYEE = {
  email: process.env.SEED_EMPLOYEE_EMAIL ?? "alex@meetup.local",
  name: process.env.SEED_EMPLOYEE_NAME ?? "Alex Morgan",
  jobTitle: "Engineer",
  accentToken: "violet",
};

const PASSWORD = process.env.SEED_PASSWORD ?? "meetup-demo-2026";

const NOW = new Date();
/** Days from today at noon UTC. */
function day(offset: number): Date {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}
/** Hours from now. */
function hour(offset: number): Date {
  return new Date(NOW.getTime() + offset * 3600_000);
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  const employer = await db.user.upsert({
    where: { email: EMPLOYER.email },
    update: { name: EMPLOYER.name, accentToken: EMPLOYER.accentToken },
    create: {
      email: EMPLOYER.email,
      name: EMPLOYER.name,
      accentToken: EMPLOYER.accentToken,
      passwordHash,
    },
  });

  const employee = await db.user.upsert({
    where: { email: EMPLOYEE.email },
    update: { name: EMPLOYEE.name, accentToken: EMPLOYEE.accentToken },
    create: {
      email: EMPLOYEE.email,
      name: EMPLOYEE.name,
      accentToken: EMPLOYEE.accentToken,
      passwordHash,
    },
  });

  const workspace = await db.workspace.upsert({
    where: { slug: "studio" },
    update: {},
    create: { name: "Northwind Studio", slug: "studio" },
  });

  const employerMember = await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: employer.id } },
    update: { role: "ADMINISTRATOR", jobTitle: EMPLOYER.jobTitle },
    create: {
      workspaceId: workspace.id,
      userId: employer.id,
      role: "ADMINISTRATOR",
      jobTitle: EMPLOYER.jobTitle,
    },
  });

  const employeeMember = await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: employee.id } },
    update: { role: "ADMINISTRATOR", jobTitle: EMPLOYEE.jobTitle },
    create: {
      workspaceId: workspace.id,
      userId: employee.id,
      role: "ADMINISTRATOR",
      jobTitle: EMPLOYEE.jobTitle,
    },
  });

  for (const userId of [employer.id, employee.id]) {
    await db.userPreference.upsert({
      where: { userId },
      update: { lastWorkspaceId: workspace.id, primaryWorkspaceId: workspace.id },
      create: {
        userId,
        lastWorkspaceId: workspace.id,
        primaryWorkspaceId: workspace.id,
        defaultSort: "SMART",
      },
    });
  }

  // Clear previous demo content for this workspace (cascades handle children).
  await db.activityEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await db.recommendation.deleteMany({ where: { workspaceId: workspace.id } });
  await db.task.deleteMany({ where: { workspaceId: workspace.id } });
  await db.meeting.deleteMany({ where: { workspaceId: workspace.id } });

  // -------------------------------------------------------------------------
  // Meetings
  // -------------------------------------------------------------------------

  const pastMeeting = await db.meeting.create({
    data: {
      workspaceId: workspace.id,
      title: "Weekly build review",
      source: "MANUAL",
      status: "REVIEW_REQUIRED",
      scheduledAt: day(-2),
      startedAt: day(-2),
      endedAt: new Date(day(-2).getTime() + 42 * 60_000),
      createdByMemberId: employerMember.id,
      notes: "Covered the auth work, the billing blocker and next week's priorities.",
      participants: {
        create: [
          { memberId: employerMember.id, displayName: EMPLOYER.name, email: EMPLOYER.email, speakerLabel: EMPLOYER.name },
          { memberId: employeeMember.id, displayName: EMPLOYEE.name, email: EMPLOYEE.email, speakerLabel: EMPLOYEE.name },
        ],
      },
    },
  });

  const upcomingMeeting = await db.meeting.create({
    data: {
      workspaceId: workspace.id,
      title: "Sprint planning",
      source: "MANUAL",
      status: "SCHEDULED",
      scheduledAt: hour(26),
      createdByMemberId: employerMember.id,
      participants: {
        create: [
          { memberId: employerMember.id, displayName: EMPLOYER.name, email: EMPLOYER.email },
          { memberId: employeeMember.id, displayName: EMPLOYEE.name, email: EMPLOYEE.email },
        ],
      },
    },
  });

  // A hand-written transcript, stored as MANUAL. Not a Google retrieval.
  const transcriptText = [
    `${EMPLOYER.name}: Where did the authentication work land?`,
    `${EMPLOYEE.name}: Sessions and the login screen are done. I still need to wire the password reset email, but that needs the transactional email account.`,
    `${EMPLOYER.name}: Right — I'll get the business email set up on the domain tomorrow so you're unblocked.`,
    `${EMPLOYEE.name}: Perfect. Once that's in I can finish reset in about half a day.`,
    `${EMPLOYER.name}: What about billing?`,
    `${EMPLOYEE.name}: Blocked. The Stripe account needs to be created by whoever owns the company bank details, so that one's yours.`,
    `${EMPLOYER.name}: Understood, I'll do that this week. Can you also look into which transcription API we should use? I don't want to commit to a vendor blind.`,
    `${EMPLOYEE.name}: I'll research the options and write up a comparison.`,
    `${EMPLOYER.name}: One more thing — the dashboard is slow on first load. Can that be looked at before we show anyone?`,
    `${EMPLOYEE.name}: Yes. I'd call that high priority, it's the first thing people see. I'll aim for Friday.`,
    `${EMPLOYER.name}: And we need to decide whether we're launching with the mobile layout or holding it back.`,
    `${EMPLOYEE.name}: Let's decide together once the performance work is done.`,
  ].join("\n");

  await db.transcript.create({
    data: {
      meetingId: pastMeeting.id,
      status: "READY",
      source: "MANUAL",
      content: transcriptText,
      fetchedAt: day(-2),
    },
  });

  const analysis = await db.meetingAnalysis.create({
    data: {
      meetingId: pastMeeting.id,
      status: "COMPLETED",
      isSample: true,
      summary:
        "Authentication is effectively done apart from password reset, which is waiting on a transactional email account. Billing is blocked on a Stripe account that only the company owner can create. Dashboard load time was raised as a pre-demo concern and agreed as high priority. Two things were left open: which transcription vendor to use, and whether the mobile layout ships at launch.",
      decisions: [
        {
          text: "Dashboard first-load performance is high priority and should be addressed before any external demo.",
          evidence: "CONFIRMED",
          excerpt: "I'd call that high priority, it's the first thing people see.",
        },
        {
          text: "Password reset is deferred until a transactional email account exists.",
          evidence: "CONFIRMED",
          excerpt: "I still need to wire the password reset email, but that needs the transactional email account.",
        },
        {
          text: "The mobile layout launch decision is deferred until performance work is finished.",
          evidence: "CONFIRMED",
          excerpt: "Let's decide together once the performance work is done.",
        },
      ],
      openQuestions: [
        {
          text: "Which transcription vendor should be used? A comparison was requested but no criteria or budget were given.",
          excerpt: "I don't want to commit to a vendor blind.",
        },
        {
          text: "Does the mobile layout ship at launch?",
          excerpt: "we need to decide whether we're launching with the mobile layout or holding it back",
        },
      ],
    },
  });

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  const seedSpaces = [
    { name: "Product", colorToken: "violet", description: "The thing customers use" },
    { name: "Engineering", colorToken: "blue", description: "Code, infrastructure and the pipeline" },
    { name: "Operations", colorToken: "amber", description: "Money, access and everything administrative" },
  ] as const;

  const spaceIds = new Map<string, string>();
  for (const [index, space] of seedSpaces.entries()) {
    const row = await db.space.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: space.name } },
      update: { colorToken: space.colorToken, description: space.description },
      create: {
        workspaceId: workspace.id,
        name: space.name,
        colorToken: space.colorToken,
        description: space.description,
        position: (index + 1) * 100,
        createdByMemberId: employerMember.id,
      },
      select: { id: true },
    });
    spaceIds.set(space.name, row.id);
  }

  /**
   * Which section a seeded task is filed under, derived from its category so
   * the two stay consistent without a `space` key on every entry. GENERAL and
   * COMMUNICATION are deliberately left unfiled — a demo workspace where
   * every single task is neatly sorted is not one anybody recognises.
   */
  const spaceForCategory: Partial<Record<SeedTask["category"], string>> = {
    DEVELOPMENT: "Product",
    AI_AUTOMATION: "Product",
    RESEARCH: "Product",
    INFRASTRUCTURE: "Engineering",
    REVIEW_APPROVAL: "Engineering",
    PLANNING: "Engineering",
    FINANCE: "Operations",
    ADMINISTRATION: "Operations",
    BUSINESS_OPS: "Operations",
  };

  // Tasks
  // -------------------------------------------------------------------------

  type SeedTask = {
    key: string;
    title: string;
    description: string;
    owner: string | null;
    /** Member ids working on it beside the owner. */
    also?: string[];
    status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
    priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
    category:
      | "DEVELOPMENT" | "AI_AUTOMATION" | "INFRASTRUCTURE" | "RESEARCH"
      | "BUSINESS_OPS" | "FINANCE" | "COMMUNICATION" | "ADMINISTRATION"
      | "PLANNING" | "REVIEW_APPROVAL" | "GENERAL";
    due: number | null;
    labels?: string[];
    fromMeeting?: boolean;
    excerpt?: string;
    aiPriority?: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
    aiRationale?: string;
    needsReview?: boolean;
    completedDaysAgo?: number;
    updatedDaysAgo?: number;
    estimate?: number;
  };

  const seedTasks: SeedTask[] = [
    // --- the engineer's work -----------------------------------------------
    {
      key: "perf",
      title: "Cut dashboard first-load time",
      description:
        "First paint is over two seconds on a cold load. Profile the initial query waterfall and the client bundle, then fix the worst offender first.",
      owner: employeeMember.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      category: "DEVELOPMENT",
      due: 2,
      labels: ["performance", "pre-demo"],
      fromMeeting: true,
      excerpt: "I'd call that high priority, it's the first thing people see.",
      estimate: 480,
    },
    {
      key: "reset",
      title: "Wire password reset email",
      description:
        "Reset flow is built but cannot send. Needs a transactional email account on the company domain before it can be finished.",
      owner: employeeMember.id,
      status: "BLOCKED",
      priority: "HIGH",
      category: "DEVELOPMENT",
      due: 1,
      labels: ["auth"],
      fromMeeting: true,
      excerpt: "I still need to wire the password reset email, but that needs the transactional email account.",
      estimate: 240,
    },
    {
      key: "billing",
      title: "Build subscription billing",
      description: "Checkout, webhooks and the plan-change path. Cannot start without API keys.",
      owner: employeeMember.id,
      status: "BLOCKED",
      priority: "MEDIUM",
      category: "DEVELOPMENT",
      due: 9,
      labels: ["billing"],
      fromMeeting: true,
      excerpt: "Blocked. The Stripe account needs to be created by whoever owns the company bank details.",
    },
    {
      key: "research",
      title: "Compare transcription APIs",
      description:
        "Write up accuracy, price per hour, latency and data-retention terms for the three plausible vendors, with a recommendation.",
      owner: employeeMember.id,
      status: "TODO",
      priority: "MEDIUM",
      category: "RESEARCH",
      due: 4,
      labels: ["vendor-choice"],
      fromMeeting: true,
      excerpt: "Can you also look into which transcription API we should use?",
      needsReview: true,
      estimate: 180,
    },
    {
      key: "overdue-bug",
      title: "Fix duplicate rows after a failed save",
      description:
        "A failed optimistic update leaves a duplicate row on screen until reload. Rollback path is not firing.",
      owner: employeeMember.id,
      status: "TODO",
      priority: "MEDIUM",
      category: "DEVELOPMENT",
      due: -3,
      labels: ["bug"],
      aiPriority: "HIGH",
      aiRationale: "Three days overdue and it corrupts what the user sees, which tends to get reported as data loss.",
    },
    {
      key: "docs",
      title: "Write the deployment runbook",
      description: "Environment variables, migration order, and what to check after a deploy.",
      owner: employeeMember.id,
      status: "TODO",
      priority: "LOW",
      category: "ADMINISTRATION",
      due: 12,
    },
    {
      key: "ci",
      title: "Add typecheck and lint to CI",
      description: "Both currently run only locally, so broken types reach the shared branch.",
      owner: employeeMember.id,
      status: "TODO",
      priority: "LOW",
      category: "INFRASTRUCTURE",
      due: null,
      labels: ["ci"],
    },
    {
      key: "auth-done",
      title: "Ship session-based sign-in",
      description: "Server sessions, hashed passwords, protected routes.",
      owner: employeeMember.id,
      status: "COMPLETED",
      priority: "HIGH",
      category: "DEVELOPMENT",
      due: -4,
      completedDaysAgo: 3,
      labels: ["auth"],
    },
    {
      key: "schema-done",
      title: "Design the task and meeting schema",
      description: "Workspaces, members, tasks, dependencies, transcripts and AI proposals.",
      owner: employeeMember.id,
      also: [employerMember.id],
      status: "COMPLETED",
      priority: "HIGH",
      category: "DEVELOPMENT",
      due: -6,
      completedDaysAgo: 5,
    },

    // --- the employer's work -----------------------------------------------
    {
      key: "email",
      title: "Set up the business email account",
      description:
        "Transactional email on the company domain, with the sending domain verified. Password reset is waiting on this.",
      owner: employerMember.id,
      status: "TODO",
      priority: "URGENT",
      category: "ADMINISTRATION",
      due: 0,
      labels: ["unblocks-eng"],
      fromMeeting: true,
      excerpt: "I'll get the business email set up on the domain tomorrow so you're unblocked.",
    },
    {
      key: "stripe",
      title: "Create the Stripe account",
      description:
        "Needs company bank details and the business identity check, so it can only be done by the owner.",
      owner: employerMember.id,
      status: "TODO",
      priority: "HIGH",
      category: "FINANCE",
      due: 3,
      labels: ["unblocks-eng"],
      fromMeeting: true,
      excerpt: "The Stripe account needs to be created by whoever owns the company bank details, so that one's yours.",
    },
    {
      key: "vendor-decision",
      title: "Decide the transcription vendor",
      description: "Pick a vendor once the comparison is in, and confirm the monthly budget.",
      owner: employerMember.id,
      status: "TODO",
      priority: "MEDIUM",
      category: "REVIEW_APPROVAL",
      due: 6,
      fromMeeting: true,
      excerpt: "I don't want to commit to a vendor blind.",
    },
    {
      key: "mobile-call",
      title: "Decide whether mobile ships at launch",
      description: "Deferred in the build review until the performance work is finished.",
      owner: null,
      status: "TODO",
      priority: "MEDIUM",
      category: "PLANNING",
      due: 7,
      fromMeeting: true,
      excerpt: "Let's decide together once the performance work is done.",
      needsReview: true,
    },
    {
      key: "designer",
      title: "Reply to the contract designer",
      description: "They have been waiting four days on scope and rate.",
      owner: employerMember.id,
      status: "TODO",
      priority: "MEDIUM",
      category: "COMMUNICATION",
      due: -1,
    },
    {
      key: "subs",
      title: "Renew the analytics subscription",
      description: "Lapses at the end of the month; data collection stops if it is missed.",
      owner: employerMember.id,
      status: "TODO",
      priority: "LOW",
      category: "FINANCE",
      due: 10,
    },
    {
      key: "access",
      title: "Grant repository and cloud access",
      description: "Add the engineer to the GitHub org and the cloud project.",
      owner: employerMember.id,
      status: "COMPLETED",
      priority: "URGENT",
      category: "ADMINISTRATION",
      due: -7,
      completedDaysAgo: 6,
    },
    {
      key: "roadmap",
      title: "Approve the Q4 roadmap",
      description: "Sequencing for the next two months, so work can be planned against it.",
      owner: employerMember.id,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      category: "PLANNING",
      due: 5,
      updatedDaysAgo: 9,
    },
  ];

  const taskIds = new Map<string, string>();

  for (const t of seedTasks) {
    const created = await db.task.create({
      data: {
        workspaceId: workspace.id,
        spaceId: spaceIds.get(spaceForCategory[t.category] ?? "") ?? null,
        title: t.title,
        description: t.description,
        ownerMemberId: t.owner,
        assignees: { create: (t.also ?? []).map((memberId) => ({ memberId })) },
        creatorMemberId: t.fromMeeting ? employerMember.id : employeeMember.id,
        status: t.status,
        priority: t.priority,
        category: t.category,
        labels: t.labels ?? [],
        dueDate: t.due === null ? null : day(t.due),
        estimateMinutes: t.estimate ?? null,
        aiSuggestedPriority: t.aiPriority ?? null,
        aiPriorityRationale: t.aiRationale ?? null,
        isAiGenerated: Boolean(t.fromMeeting),
        confirmedByHuman: !t.needsReview,
        needsReview: Boolean(t.needsReview),
        sourceMeetingId: t.fromMeeting ? pastMeeting.id : null,
        sourceExcerpt: t.excerpt ?? null,
        completedAt: t.completedDaysAgo !== undefined ? day(-t.completedDaysAgo) : null,
        createdAt: day(-8),
        ...(t.updatedDaysAgo !== undefined ? { updatedAt: day(-t.updatedDaysAgo) } : {}),
      },
      select: { id: true },
    });
    taskIds.set(t.key, created.id);
  }

  // Dependencies: blocked → blocker.
  const edges: [string, string][] = [
    ["reset", "email"],
    ["billing", "stripe"],
    ["vendor-decision", "research"],
    ["mobile-call", "perf"],
  ];
  for (const [blocked, blocker] of edges) {
    await db.taskDependency.create({
      data: { taskId: taskIds.get(blocked)!, dependsOnTaskId: taskIds.get(blocker)! },
    });
  }

  await db.taskComment.createMany({
    data: [
      {
        taskId: taskIds.get("perf")!,
        authorMemberId: employeeMember.id,
        body: "Traced it to the dashboard query running three sequential round-trips. Collapsing them into one should get most of the win.",
        createdAt: day(-1),
      },
      {
        taskId: taskIds.get("email")!,
        authorMemberId: employeeMember.id,
        body: "Once this exists I need the SMTP credentials in the server environment, not pasted anywhere.",
        createdAt: day(-1),
      },
    ],
  });

  // -------------------------------------------------------------------------
  // Proposals still awaiting review (sample data, clearly flagged)
  // -------------------------------------------------------------------------

  await db.taskProposal.createMany({
    data: [
      {
        meetingId: pastMeeting.id,
        analysisId: analysis.id,
        isSample: true,
        title: "Write up the transcription vendor comparison",
        description:
          "Accuracy, cost per hour, latency and data-retention terms for three vendors, ending in a recommendation.",
        suggestedOwnerMemberId: employeeMember.id,
        ownerEvidence: "CONFIRMED",
        ownerRationale: `${EMPLOYEE.name} accepted the request directly: “I'll research the options and write up a comparison.”`,
        isExplicitCommitment: true,
        suggestedPriority: "MEDIUM",
        priorityEvidence: "RECOMMENDED",
        priorityRationale:
          "No deadline was given, and the vendor decision is not blocking current work.",
        suggestedDueDate: day(4).toISOString().slice(0, 10),
        dueDateEvidence: "RECOMMENDED",
        category: "RESEARCH",
        labels: ["vendor-choice"],
        transcriptExcerpt: "I'll research the options and write up a comparison.",
        status: "PENDING",
      },
      {
        meetingId: pastMeeting.id,
        analysisId: analysis.id,
        isSample: true,
        title: "Confirm the monthly transcription budget",
        description: "A vendor cannot be chosen without a spend ceiling.",
        suggestedOwnerMemberId: employerMember.id,
        ownerEvidence: "INFERRED",
        ownerRationale:
          "Budget was never discussed explicitly. Assigned to the owner because spending decisions sat with them throughout the conversation.",
        isExplicitCommitment: false,
        suggestedPriority: "MEDIUM",
        priorityEvidence: "RECOMMENDED",
        priorityRationale: "Needed before the vendor decision, which has no hard date yet.",
        suggestedDueDate: null,
        dueDateEvidence: "RECOMMENDED",
        category: "FINANCE",
        labels: [],
        transcriptExcerpt: "I don't want to commit to a vendor blind.",
        status: "PENDING",
        needsReview: true,
      },
      {
        meetingId: pastMeeting.id,
        analysisId: analysis.id,
        isSample: true,
        title: "Decide whether the mobile layout ships at launch",
        description:
          "Explicitly deferred until the dashboard performance work is finished.",
        suggestedOwnerMemberId: null,
        ownerEvidence: "RECOMMENDED",
        ownerRationale:
          "Both people said “let's decide together”, so no single owner can be read from the conversation. Needs a human to assign.",
        isExplicitCommitment: false,
        suggestedPriority: "MEDIUM",
        priorityEvidence: "INFERRED",
        priorityRationale: "Gates a launch decision, but was deliberately postponed.",
        suggestedDueDate: day(7).toISOString().slice(0, 10),
        dueDateEvidence: "RECOMMENDED",
        category: "PLANNING",
        labels: ["launch"],
        transcriptExcerpt: "Let's decide together once the performance work is done.",
        blockers: ["Waiting on the dashboard performance work to finish."],
        dependsOnTitles: ["Cut dashboard first-load time"],
        status: "PENDING",
        needsReview: true,
      },
    ],
  });

  // -------------------------------------------------------------------------
  // Activity
  // -------------------------------------------------------------------------

  await db.activityEvent.createMany({
    data: [
      {
        workspaceId: workspace.id,
        actorMemberId: employerMember.id,
        type: "MEETING_CREATED",
        summary: `scheduled “Weekly build review”`,
        meetingId: pastMeeting.id,
        createdAt: day(-3),
      },
      {
        workspaceId: workspace.id,
        actorMemberId: employerMember.id,
        type: "ANALYSIS_COMPLETED",
        summary: `analysed “Weekly build review” — 3 tasks proposed`,
        meetingId: pastMeeting.id,
        createdAt: day(-2),
      },
      {
        workspaceId: workspace.id,
        actorMemberId: employeeMember.id,
        type: "TASK_COMPLETED",
        summary: `completed “Design the task and meeting schema”`,
        taskId: taskIds.get("schema-done")!,
        createdAt: day(-5),
      },
      {
        workspaceId: workspace.id,
        actorMemberId: employerMember.id,
        type: "TASK_COMPLETED",
        summary: `completed “Grant repository and cloud access”`,
        taskId: taskIds.get("access")!,
        createdAt: day(-6),
      },
      {
        workspaceId: workspace.id,
        actorMemberId: employeeMember.id,
        type: "TASK_COMPLETED",
        summary: `completed “Ship session-based sign-in”`,
        taskId: taskIds.get("auth-done")!,
        createdAt: day(-3),
      },
      {
        workspaceId: workspace.id,
        actorMemberId: employeeMember.id,
        type: "TASK_STATUS_CHANGED",
        summary: `moved “Wire password reset email” to Waiting / Blocked`,
        taskId: taskIds.get("reset")!,
        metadata: { field: "status", from: "IN_PROGRESS", to: "BLOCKED" },
        createdAt: day(-2),
      },
      {
        workspaceId: workspace.id,
        actorMemberId: employeeMember.id,
        type: "TASK_COMMENTED",
        summary: `commented on “Cut dashboard first-load time”`,
        taskId: taskIds.get("perf")!,
        createdAt: day(-1),
      },
      {
        workspaceId: workspace.id,
        actorMemberId: employerMember.id,
        type: "MEETING_CREATED",
        summary: `scheduled “Sprint planning”`,
        meetingId: upcomingMeeting.id,
        createdAt: day(-1),
      },
    ],
  });

  const counts = {
    members: 2,
    tasks: await db.task.count({ where: { workspaceId: workspace.id } }),
    meetings: await db.meeting.count({ where: { workspaceId: workspace.id } }),
    proposals: await db.taskProposal.count({ where: { meeting: { workspaceId: workspace.id } } }),
    activity: await db.activityEvent.count({ where: { workspaceId: workspace.id } }),
  };

  console.log(`Seeded "${workspace.name}"`);
  console.log(
    `  ${counts.members} members · ${counts.tasks} tasks · ${counts.meetings} meetings · ${counts.proposals} proposals · ${counts.activity} activity entries`,
  );
  console.log(`  sign in as ${EMPLOYEE.email} or ${EMPLOYER.email}`);
  console.log(`  password: the SEED_PASSWORD value in .env.local`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

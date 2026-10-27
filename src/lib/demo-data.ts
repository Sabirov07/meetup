import { Meeting, Proposal, Task } from "@/lib/types";

export const people = {
  me: { name: "Alex Morgan", initials: "AM", tone: "bg-indigo-600" },
  employer: { name: "Maya Chen", initials: "MC", tone: "bg-amber-500" },
};

const base = { creator: "Alex Morgan", createdAt: "2026-10-20", updatedAt: "2026-10-26" };

export const demoTasks: Task[] = [
  { ...base, id: "t1", title: "Prepare launch messaging", description: "Draft positioning and the first customer announcement.", owner: "me", priority: "urgent", status: "in_progress", dueDate: "2026-10-27", project: "Q4 Launch", sourceMeeting: "Weekly strategy sync" },
  { ...base, id: "t2", title: "Review onboarding friction", description: "Summarize top drop-off points from the latest sessions.", owner: "me", priority: "high", status: "todo", dueDate: "2026-10-28", project: "Product" },
  { ...base, id: "t3", title: "Confirm customer interview schedule", description: "Coordinate five discovery calls with the research cohort.", owner: "me", priority: "high", status: "blocked", dueDate: "2026-10-24", project: "Research", notes: "Waiting on participant confirmation." },
  { ...base, id: "t4", title: "Update executive brief", description: "Add retention notes and revised risks.", owner: "me", priority: "medium", status: "todo", dueDate: "2026-10-30", project: "Operations" },
  { ...base, id: "t5", title: "Triage design feedback", description: "Consolidate input from the prototype review.", owner: "me", priority: "medium", status: "in_progress", dueDate: "2026-10-29", project: "Product" },
  { ...base, id: "t6", title: "Share weekly progress update", description: "Post a concise progress update for the team.", owner: "me", priority: "low", status: "completed", dueDate: "2026-10-23", project: "Operations" },
  { ...base, id: "t7", title: "Document support handoff", description: "Turn the recurring support workflow into a clear playbook.", owner: "me", priority: "medium", status: "todo", dueDate: "2026-11-02", project: "Customer Success" },
  { ...base, id: "t8", title: "Audit analytics events", description: "Validate product analytics events for the new onboarding flow.", owner: "me", priority: "low", status: "todo", dueDate: "2026-11-04", project: "Product" },
  { ...base, id: "t9", title: "Approve Q4 budget", description: "Review allocation options and confirm the final spend plan.", owner: "employer", priority: "urgent", status: "todo", dueDate: "2026-10-27", project: "Operations" },
  { ...base, id: "t10", title: "Unblock agency contract", description: "Send revised scope and legal terms to the partner agency.", owner: "employer", priority: "high", status: "blocked", dueDate: "2026-10-25", project: "Q4 Launch", notes: "Legal approval is pending." },
  { ...base, id: "t11", title: "Review hiring pipeline", description: "Assess current candidates for the product design opening.", owner: "employer", priority: "high", status: "in_progress", dueDate: "2026-10-31", project: "People" },
  { ...base, id: "t12", title: "Set partner priorities", description: "Confirm which channel partners need outreach this week.", owner: "employer", priority: "medium", status: "todo", dueDate: "2026-11-01", project: "Growth" },
  { ...base, id: "t13", title: "Sign off on roadmap", description: "Review final sequencing before team-wide circulation.", owner: "employer", priority: "medium", status: "in_progress", dueDate: "2026-10-29", project: "Product" },
  { ...base, id: "t14", title: "Respond to renewal risk", description: "Meet with the account team and decide next step.", owner: "employer", priority: "urgent", status: "todo", dueDate: "2026-10-24", project: "Customer Success" },
  { ...base, id: "t15", title: "Plan all-hands agenda", description: "Outline the November all-hands and assign speakers.", owner: "employer", priority: "low", status: "completed", dueDate: "2026-10-22", project: "People" },
  { ...base, id: "t16", title: "Evaluate vendor proposal", description: "Compare vendor terms against the implementation plan.", owner: "employer", priority: "low", status: "todo", dueDate: "2026-11-05", project: "Operations" },
];

export const demoMeetings: Meeting[] = [
  { id: "m1", title: "Weekly strategy sync", date: "Tomorrow, 10:00 AM", duration: "45 min", participants: ["AM", "MC"], status: "upcoming", relatedTasks: 4 },
  { id: "m2", title: "Q4 launch planning", date: "Thu, Oct 29 · 2:30 PM", duration: "60 min", participants: ["AM", "MC", "JL"], status: "upcoming", relatedTasks: 6 },
  { id: "m3", title: "Product review", date: "Oct 23 · 11:00 AM", duration: "45 min", participants: ["AM", "MC"], status: "complete", relatedTasks: 3 },
];

export const demoProposals: Proposal[] = [
  { id: "p1", meeting: "Product review", summary: "Discussion focused on reducing friction in the new onboarding experience.", title: "Map the onboarding drop-off points", assignee: "me", priority: "high", dueDate: "2026-10-28", excerpt: "Alex, can you pull together the main places where people hesitate or leave?", status: "pending", selected: true },
  { id: "p2", meeting: "Product review", summary: "Discussion focused on reducing friction in the new onboarding experience.", title: "Confirm budget for usability sessions", assignee: "employer", priority: "medium", dueDate: "2026-10-30", excerpt: "Maya will check whether we can add another round of customer testing.", status: "pending", selected: true },
  { id: "p3", meeting: "Product review", summary: "Discussion focused on reducing friction in the new onboarding experience.", title: "Share prototype feedback with design", assignee: "me", priority: "medium", dueDate: "2026-10-29", excerpt: "Let’s make sure the design team sees the patterns before Thursday.", status: "pending" },
];

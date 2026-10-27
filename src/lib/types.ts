export type TaskStatus = "todo" | "in_progress" | "blocked" | "completed";
export type Priority = "urgent" | "high" | "medium" | "low";
export type Owner = "me" | "employer" | "unassigned";

export type Task = {
  id: string;
  title: string;
  description: string;
  owner: Owner;
  creator: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  project: string;
  sourceMeeting?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
};

export type Meeting = {
  id: string;
  title: string;
  date: string;
  duration: string;
  participants: string[];
  status: "upcoming" | "complete";
  relatedTasks: number;
  meetUrl?: string;
};

export type Proposal = {
  id: string;
  meeting: string;
  summary: string;
  title: string;
  assignee: Owner;
  priority: Priority;
  dueDate: string;
  excerpt: string;
  selected?: boolean;
  status: "pending" | "approved" | "rejected";
};

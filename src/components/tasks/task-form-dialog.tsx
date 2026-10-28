"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createTask, updateTask } from "@/lib/actions/tasks";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type MemberSummary,
  type TaskView,
} from "@/lib/domain/types";
import { categoryMeta, priorityMeta, statusMeta } from "@/lib/domain/labels";
import { toDateInputValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui/field";

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the task a title of at least 3 characters."),
  description: z.string().trim().optional(),
  ownerMemberId: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  category: z.enum(TASK_CATEGORIES),
  dueDate: z.string(),
  labels: z.string(),
  estimateHours: z.string(),
});

type FormValues = z.infer<typeof schema>;

const UNASSIGNED = "__unassigned__";

export function TaskFormDialog({
  open,
  onOpenChange,
  members,
  task,
  defaultOwnerId,
  defaultStatus,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberSummary[];
  /** Present means edit; absent means create. */
  task?: TaskView | null;
  defaultOwnerId?: string | null;
  defaultStatus?: TaskView["status"];
  onSaved?: (task: TaskView) => void;
}) {
  const editing = Boolean(task);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      ownerMemberId: UNASSIGNED,
      status: "TODO",
      priority: "MEDIUM",
      category: "GENERAL",
      dueDate: "",
      labels: "",
      estimateHours: "",
    },
  });

  // Re-seed whenever the dialog opens, so a reused instance never shows the
  // previous task's values.
  useEffect(() => {
    if (!open) return;
    form.reset({
      title: task?.title ?? "",
      description: task?.description ?? "",
      ownerMemberId: task?.owner?.id ?? defaultOwnerId ?? UNASSIGNED,
      status: task?.status ?? defaultStatus ?? "TODO",
      priority: task?.priority ?? "MEDIUM",
      category: task?.category ?? "GENERAL",
      dueDate: toDateInputValue(task?.dueDate),
      labels: task?.labels.join(", ") ?? "",
      estimateHours:
        task?.estimateMinutes != null
          ? String(Math.round((task.estimateMinutes / 60) * 10) / 10)
          : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  async function onSubmit(values: FormValues) {
    const labels = values.labels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 10);

    const hours = Number.parseFloat(values.estimateHours);
    const estimateMinutes =
      Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null;

    const payload = {
      title: values.title,
      description: values.description?.trim()
        ? values.description.trim()
        : null,
      ownerMemberId:
        values.ownerMemberId === UNASSIGNED ? null : values.ownerMemberId,
      status: values.status,
      priority: values.priority,
      category: values.category,
      labels,
      dueDate: values.dueDate || null,
      estimateMinutes,
    };

    const result = task
      ? await updateTask({ id: task.id, ...payload })
      : await createTask(payload);

    if (!result.ok) {
      toast.error(
        editing ? "Could not save the task" : "Could not create the task",
        {
          description: result.error,
        },
      );
      return;
    }

    toast.success(editing ? "Task saved" : "Task created", {
      description: result.data.title,
    });

    // `onSaved` updates the board instantly when this dialog is rendered inside
    // a task store. The header's global "New task" button is not — it lives in
    // the shell, above any provider — so the router refresh is what makes the
    // new task appear there.
    onSaved?.(result.data);
    if (!onSaved) router.refresh();

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-col"
        >
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Changes are recorded in the activity feed."
                : "Tasks you create here are confirmed commitments, not suggestions."}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <Field
              label="Title"
              htmlFor="task-title"
              error={form.formState.errors.title?.message}
            >
              <Input
                id="task-title"
                autoFocus
                placeholder="What needs to happen?"
                {...form.register("title")}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="task-description"
              hint="Optional"
            >
              <Textarea
                id="task-description"
                placeholder="Context, acceptance criteria, links…"
                {...form.register("description")}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner">
                <Controller
                  control={form.control}
                  name="ownerMemberId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Status">
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusMeta[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Priority">
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {priorityMeta[p].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Category">
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {categoryMeta[c].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Due date" htmlFor="task-due" hint="Optional">
                <Input
                  id="task-due"
                  type="date"
                  {...form.register("dueDate")}
                />
              </Field>

              <Field
                label="Estimate"
                htmlFor="task-estimate"
                hint="Hours, optional"
              >
                <Input
                  id="task-estimate"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 4"
                  {...form.register("estimateHours")}
                />
              </Field>
            </div>

            <Field label="Labels" htmlFor="task-labels" hint="Comma separated">
              <Input
                id="task-labels"
                placeholder="auth, pre-demo"
                {...form.register("labels")}
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={form.formState.isSubmitting}
              loadingLabel="Saving…"
            >
              {editing ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

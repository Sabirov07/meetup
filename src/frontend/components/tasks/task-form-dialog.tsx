"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createTask, updateTask } from "@/backend/actions/tasks";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type MemberSummary,
  type SpaceSummary,
  type TaskView,
} from "@/shared/domain/types";
import type { TranslationKey } from "@/shared/i18n";
import { useT } from "@/frontend/i18n";
import { toDateInputValue } from "@/frontend/i18n/format";
import { Button } from "@/frontend/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { CreateModeSwitch } from "./create-mode-switch";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/frontend/components/ui/field";

/**
 * Validation messages are translation keys, resolved where they are rendered.
 * The schema is built once at module scope, long before anyone has picked a
 * language, so it cannot hold finished sentences.
 */
const schema = z.object({
  title: z.string().trim().min(3, "form.field.titleTooShort"),
  description: z.string().trim().optional(),
  ownerMemberId: z.string(),
  spaceId: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  category: z.enum(TASK_CATEGORIES),
  dueDate: z.string(),
  labels: z.string(),
  estimateHours: z.string(),
});

type FormValues = z.infer<typeof schema>;

const UNASSIGNED = "__unassigned__";
/**
 * Radix's Select treats "" as "nothing chosen" and will not render a item
 * with an empty value, so "no section" needs a sentinel of its own.
 */
const NO_SECTION = "__no_section__";

export function TaskFormDialog({
  open,
  onOpenChange,
  members,
  spaces = [],
  task,
  defaultOwnerId,
  defaultSpaceId,
  defaultStatus,
  defaultPriority,
  onSaved,
  onDescribeTasks,
  quiet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberSummary[];
  /** The workspace's sections. Empty hides the picker rather than showing one choice. */
  spaces?: SpaceSummary[];
  /** Present means edit; absent means create. */
  task?: TaskView | null;
  defaultOwnerId?: string | null;
  /** Pre-selected section, e.g. when creating from a section's own board. */
  defaultSpaceId?: string | null;
  defaultStatus?: TaskView["status"];
  defaultPriority?: TaskView["priority"];
  onSaved?: (task: TaskView) => void;
  /**
   * Hands over to the "describe the work" dialog. Offered only when creating:
   * someone editing one task does not want a batch of new ones.
   */
  onDescribeTasks?: () => void;
  /** This dialog took over from the describe-the-work dialog a frame ago. */
  quiet?: boolean;
}) {
  const editing = Boolean(task);
  const showSwitch = !editing && Boolean(onDescribeTasks);
  const router = useRouter();
  const t = useT();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      ownerMemberId: UNASSIGNED,
      spaceId: NO_SECTION,
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
      spaceId: task?.space?.id ?? defaultSpaceId ?? NO_SECTION,
      status: task?.status ?? defaultStatus ?? "TODO",
      priority: task?.priority ?? defaultPriority ?? "MEDIUM",
      category: task?.category ?? "GENERAL",
      dueDate: toDateInputValue(task?.dueDate),
      labels: task?.labels.join(", ") ?? "",
      estimateHours:
        task?.estimateMinutes != null
          ? String(Math.round((task.estimateMinutes / 60) * 10) / 10)
          : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id, defaultSpaceId]);

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
      spaceId: values.spaceId === NO_SECTION ? null : values.spaceId,
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
      toast.error(t(editing ? "form.saveFailed" : "form.createFailed"), {
        description: result.error,
      });
      return;
    }

    toast.success(t(editing ? "form.saved" : "form.created"), {
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
      {/* The two ways of creating work share a size while both are on offer,
          so switching between them moves nothing but the fields themselves. */}
      <DialogContent
        className={showSwitch ? "h-[min(90vh,43.5rem)] max-w-2xl" : "max-w-xl"}
        quiet={quiet}
      >
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-col"
        >
          {/* Centred over the title; see the same header in the intake dialog. */}
          <DialogHeader className={showSwitch ? "pr-5" : undefined}>
            {showSwitch && (
              <CreateModeSwitch
                value="FORM"
                onChange={(mode) => {
                  if (mode === "FORM") return;
                  onOpenChange(false);
                  onDescribeTasks?.();
                }}
                className="mx-auto mb-4 w-fit"
              />
            )}
            <DialogTitle>{t(editing ? "form.title.edit" : "form.title.create")}</DialogTitle>
            <DialogDescription>
              {t(editing ? "form.description.edit" : "form.description.create")}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <Field
              label={t("form.field.title")}
              htmlFor="task-title"
              error={
                form.formState.errors.title?.message
                  ? t(form.formState.errors.title.message as TranslationKey)
                  : undefined
              }
            >
              <Input
                id="task-title"
                autoFocus
                placeholder={t("form.field.titlePlaceholder")}
                {...form.register("title")}
              />
            </Field>

            <Field
              label={t("form.field.description")}
              htmlFor="task-description"
              hint={t("form.field.descriptionHint")}
            >
              <Textarea
                id="task-description"
                placeholder={t("form.field.descriptionPlaceholder")}
                {...form.register("description")}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("tasks.facet.assignee")}>
                <Controller
                  control={form.control}
                  name="ownerMemberId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>{t("common.unassigned")}</SelectItem>
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

              {spaces.length > 0 && (
                <Field label={t("spaces.field")} hint={t("spaces.fieldHint")}>
                  <Controller
                    control={form.control}
                    name="spaceId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_SECTION}>{t("spaces.unfiled")}</SelectItem>
                          {spaces.map((space) => (
                            <SelectItem key={space.id} value={space.id}>
                              {space.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              )}

              <Field label={t("tasks.facet.status")}>
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
                            {t(`status.${s}.label`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label={t("tasks.facet.priority")}>
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
                            {t(`priority.${p}.label`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label={t("tasks.facet.category")}>
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
                            {t(`category.${c}.label`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                label={t("form.field.dueDate")}
                htmlFor="task-due"
                hint={t("common.optional")}
              >
                <Input
                  id="task-due"
                  type="date"
                  {...form.register("dueDate")}
                />
              </Field>

              <Field
                label={t("form.field.estimate")}
                htmlFor="task-estimate"
                hint={t("form.field.estimateHint")}
              >
                <Input
                  id="task-estimate"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder={t("form.field.estimatePlaceholder")}
                  {...form.register("estimateHours")}
                />
              </Field>
            </div>

            <Field
              label={t("form.field.labels")}
              htmlFor="task-labels"
              hint={t("form.field.labelsHint")}
            >
              <Input
                id="task-labels"
                placeholder={t("form.field.labelsPlaceholder")}
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
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={form.formState.isSubmitting}
              loadingLabel={t("common.saving")}
            >
              {t(editing ? "form.submit.edit" : "form.submit.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

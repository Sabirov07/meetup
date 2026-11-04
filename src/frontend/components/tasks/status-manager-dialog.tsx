"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Settings2, Trash2 } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  createStatus,
  deleteStatus,
  reorderStatuses,
  updateStatus,
} from "@/backend/actions/statuses";
import {
  MAX_CUSTOM_STATUSES,
  STATUS_LABEL_MAX,
  STATUS_TONES,
  toneClass,
  type StatusTone,
} from "@/shared/domain/statuses";
import type { TaskStatusDef } from "@/shared/domain/types";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Dot } from "@/frontend/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/frontend/components/ui/dialog";
import { Tooltip } from "@/frontend/components/ui/feedback";
import { Input } from "@/frontend/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/frontend/components/ui/menu";
import { presentStatus } from "./status-meta";
import { useTasks } from "./task-store";

/**
 * One place to shape the workspace's flow: the order its statuses appear in,
 * and which custom ones exist.
 *
 * Every edit saves as it happens — a drop, a keystroke in a name, a colour
 * pick — so there is no Save button to forget. Each change is applied to the
 * store first and the server's answer replaces it, or the last good list is
 * restored and the error shown.
 */

export function StatusManagerButton({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          <Settings2 className="h-3.5 w-3.5" />
          {t("tasks.statuses.manage")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tasks.statuses.title")}</DialogTitle>
          <DialogDescription>{t("tasks.statuses.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 px-3 py-3">
          <StatusManager />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function StatusManager() {
  const { statuses, setStatuses } = useTasks();
  const t = useT();
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const customCount = statuses.filter((s) => !s.builtin).length;
  const full = customCount >= MAX_CUSTOM_STATUSES;

  /** Runs one write, keeping the list the server hands back. */
  function commit(
    optimistic: TaskStatusDef[] | null,
    write: () => Promise<{ ok: true; data: TaskStatusDef[] } | { ok: false; error: string }>,
    onDone?: () => void,
  ) {
    const snapshot = statuses;
    if (optimistic) setStatuses(optimistic);
    startTransition(async () => {
      const result = await write();
      if (result.ok) {
        setStatuses(result.data);
        onDone?.();
      } else {
        setStatuses(snapshot);
        toast.error(t("tasks.statuses.saveFailed"), { description: result.error });
      }
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = statuses.findIndex((s) => s.id === active.id);
    const to = statuses.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    const next = arrayMove(statuses, from, to);
    commit(next, () => reorderStatuses(next.map((s) => s.id)));
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={statuses.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {statuses.map((status) => (
              <StatusRow
                key={status.id}
                status={status}
                disabled={pending}
                onRename={(label) =>
                  commit(
                    statuses.map((s) => (s.id === status.id ? { ...s, label } : s)),
                    () => updateStatus({ id: status.id, label }),
                  )
                }
                onTone={(tone) =>
                  commit(
                    statuses.map((s) => (s.id === status.id ? { ...s, tone } : s)),
                    () => updateStatus({ id: status.id, tone }),
                  )
                }
                onRemove={() =>
                  commit(
                    statuses.filter((s) => s.id !== status.id),
                    () => deleteStatus(status.id),
                    () => toast.success(t("tasks.statuses.removed")),
                  )
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <AddStatusRow
        disabled={pending || full}
        onAdd={(label, tone) =>
          commit(null, () => createStatus({ label, tone }), () =>
            toast.success(t("tasks.statuses.added")),
          )
        }
      />
      <p className="px-1 text-2xs text-text-faint">
        {t("tasks.statuses.limit", { max: MAX_CUSTOM_STATUSES })}
      </p>
    </>
  );
}

function StatusRow({
  status,
  disabled,
  onRename,
  onTone,
  onRemove,
}: {
  status: TaskStatusDef;
  disabled: boolean;
  onRename: (label: string) => void;
  onTone: (tone: StatusTone) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const presented = presentStatus(status, t);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: status.id });
  const [draft, setDraft] = useState<string | null>(null);

  function commitName() {
    if (draft === null) return;
    const label = draft.trim();
    setDraft(null);
    if (label && label !== status.label) onRename(label);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-line bg-raised/40 px-1.5 py-1",
        isDragging && "z-10 border-line-accent bg-overlay shadow-popover",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("tasks.statuses.dragHandle", { name: presented.label })}
        className="cursor-grab touch-none rounded p-1 text-text-faint hover:bg-hover hover:text-text active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <TonePicker name={presented.label} value={status.tone} onChange={onTone} disabled={disabled} />

      {status.builtin ? (
        <span className="min-w-0 flex-1 truncate px-1 text-[13px] text-text">
          {presented.label}
        </span>
      ) : (
        <input
          value={draft ?? status.label}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setDraft(status.label)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(null);
              event.currentTarget.blur();
            }
          }}
          maxLength={STATUS_LABEL_MAX}
          disabled={disabled}
          aria-label={t("tasks.statuses.rename", { name: presented.label })}
          className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[13px] text-text outline-none transition-colors hover:border-line focus:border-line-strong focus:bg-canvas"
        />
      )}

      {status.builtin ? (
        <span className="shrink-0 px-1 text-2xs text-text-faint">{t("tasks.statuses.builtin")}</span>
      ) : (
        <Tooltip content={t("tasks.statuses.removeHint")}>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={t("tasks.statuses.remove", { name: presented.label })}
            className="shrink-0 rounded-md p-1 text-text-faint transition-colors hover:bg-danger/12 hover:text-danger disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      )}
    </li>
  );
}

function TonePicker({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: string;
  onChange: (tone: StatusTone) => void;
  disabled: boolean;
}) {
  const t = useT();

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("tasks.statuses.color", { name })}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-hover disabled:opacity-50"
        >
          <Dot tone={toneClass(value)} className="h-2.5 w-2.5" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-[9rem]">
        {STATUS_TONES.map((tone) => (
          <MenuItem key={tone} onSelect={() => onChange(tone)}>
            <Dot tone={toneClass(tone)} className="h-2.5 w-2.5" />
            {t(`tasks.statuses.tone.${tone}`)}
            {tone === value && <span className="ml-auto text-text-faint">·</span>}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function AddStatusRow({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (label: string, tone: StatusTone) => void;
}) {
  const t = useT();
  const [label, setLabel] = useState("");
  const [tone, setTone] = useState<StatusTone>("info");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || disabled) return;
    onAdd(trimmed, tone);
    setLabel("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 rounded-lg border border-dashed border-line px-1.5 py-1">
      <span className="w-[1.625rem]" />
      <TonePicker name={t("tasks.statuses.addLabel")} value={tone} onChange={setTone} disabled={disabled} />
      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={t("tasks.statuses.addPlaceholder")}
        aria-label={t("tasks.statuses.addLabel")}
        maxLength={STATUS_LABEL_MAX}
        disabled={disabled}
        className="h-7 flex-1 border-transparent bg-transparent px-1 hover:border-line focus:border-line-strong focus:bg-canvas"
      />
      <Button type="submit" variant="secondary" size="xs" disabled={disabled || !label.trim()}>
        <Plus className="h-3 w-3" />
        {t("tasks.statuses.add")}
      </Button>
    </form>
  );
}

"use client";

import { ArrowDownUp, Filter, Search, Sparkles, X } from "lucide-react";
import { useMemo } from "react";
import {
  SORT_MODES,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type SortMode,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
} from "@/shared/domain/types";
import { categoryMeta, priorityMeta, sortModeMeta, statusMeta } from "@/shared/domain/labels";
import { applyFilters, countActiveFilters, type DueWindow } from "@/shared/domain/filters";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge, Count } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Checkbox, Separator, Switch, Tooltip } from "@/frontend/components/ui/feedback";
import { Input, Label } from "@/frontend/components/ui/field";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/frontend/components/ui/menu";
import { useTasks } from "./task-store";

const dueWindows: { value: DueWindow; label: string }[] = [
  { value: "ANY", label: "Any time" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "TODAY", label: "Due today" },
  { value: "THIS_WEEK", label: "Next 7 days" },
  { value: "NO_DATE", label: "No deadline" },
];

export function TaskToolbar({
  meetings = [],
  /** Hide the owner facet on pages already scoped to one person. */
  showOwnerFilter = true,
  className,
}: {
  meetings?: { id: string; title: string }[];
  showOwnerFilter?: boolean;
  className?: string;
}) {
  const { tasks, members, filters, setFilters, resetFilters, sort, setSort, now } = useTasks();

  const activeCount = countActiveFilters(filters);
  const filtered = useMemo(() => applyFilters(tasks, filters, now), [tasks, filters, now]);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Search */}
      <div className="relative min-w-0 flex-1 sm:max-w-[18rem]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
        <Input
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="pl-8 pr-7"
        />
        {filters.search && (
          <button
            onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-faint hover:text-text"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Filters */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant={activeCount > 0 ? "secondary" : "outline"} size="md">
            <Filter className="h-3.5 w-3.5" />
            Filter
            {activeCount > 0 && <Count className="tone-accent bg-[var(--tone-bg)] text-[var(--tone-fg)]">{activeCount}</Count>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[18rem] p-0">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[13px] font-medium text-text">Filters</span>
            {activeCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-2xs text-accent-bright hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-[22rem] space-y-3 overflow-y-auto p-3">
            {showOwnerFilter && (
              <FacetGroup label="Owner">
                {members.map((member) => (
                  <FacetRow
                    key={member.id}
                    checked={filters.owners.includes(member.id)}
                    onChange={() =>
                      setFilters((prev) => ({ ...prev, owners: toggle(prev.owners, member.id) }))
                    }
                  >
                    <Avatar member={member} size="xs" />
                    {member.name}
                  </FacetRow>
                ))}
                <FacetRow
                  checked={filters.owners.includes("UNASSIGNED")}
                  onChange={() =>
                    setFilters((prev) => ({ ...prev, owners: toggle(prev.owners, "UNASSIGNED") }))
                  }
                >
                  Unassigned
                </FacetRow>
              </FacetGroup>
            )}

            <FacetGroup label="Status">
              {TASK_STATUSES.map((status) => (
                <FacetRow
                  key={status}
                  checked={filters.statuses.includes(status)}
                  onChange={() =>
                    setFilters((prev) => ({
                      ...prev,
                      statuses: toggle(prev.statuses, status) as TaskStatus[],
                    }))
                  }
                >
                  {statusMeta[status].label}
                </FacetRow>
              ))}
            </FacetGroup>

            <FacetGroup label="Priority">
              {TASK_PRIORITIES.map((priority) => (
                <FacetRow
                  key={priority}
                  checked={filters.priorities.includes(priority)}
                  onChange={() =>
                    setFilters((prev) => ({
                      ...prev,
                      priorities: toggle(prev.priorities, priority) as TaskPriority[],
                    }))
                  }
                >
                  <Badge tone={priorityMeta[priority].tone}>{priorityMeta[priority].label}</Badge>
                </FacetRow>
              ))}
            </FacetGroup>

            <FacetGroup label="Deadline">
              <div className="flex flex-wrap gap-1">
                {dueWindows.map((window) => (
                  <button
                    key={window.value}
                    onClick={() => setFilters((prev) => ({ ...prev, dueWindow: window.value }))}
                    className={cn(
                      "rounded-md px-1.5 py-1 text-2xs transition-colors",
                      filters.dueWindow === window.value
                        ? "bg-accent-solid text-white"
                        : "bg-raised text-text-muted hover:text-text",
                    )}
                  >
                    {window.label}
                  </button>
                ))}
              </div>
            </FacetGroup>

            <FacetGroup label="Category">
              <div className="flex flex-wrap gap-1">
                {TASK_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        categories: toggle(prev.categories, category) as TaskCategory[],
                      }))
                    }
                    className={cn(
                      "rounded-md px-1.5 py-1 text-2xs transition-colors",
                      filters.categories.includes(category)
                        ? "bg-accent-solid text-white"
                        : "bg-raised text-text-muted hover:text-text",
                    )}
                  >
                    {categoryMeta[category].label}
                  </button>
                ))}
              </div>
            </FacetGroup>

            {meetings.length > 0 && (
              <FacetGroup label="From meeting">
                <select
                  value={filters.meetingId ?? ""}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, meetingId: event.target.value || null }))
                  }
                  className="h-7 w-full rounded-md border border-line-strong bg-canvas px-1.5 text-xs text-text"
                >
                  <option value="">Any source</option>
                  {meetings.map((meeting) => (
                    <option key={meeting.id} value={meeting.id}>
                      {meeting.title}
                    </option>
                  ))}
                </select>
              </FacetGroup>
            )}

            <Separator />

            <ToggleRow
              label="Needs review only"
              hint="Where the owner or deadline was unclear"
              checked={filters.needsReviewOnly}
              onChange={(value) => setFilters((prev) => ({ ...prev, needsReviewOnly: value }))}
            />
            <ToggleRow
              label="Waiting on someone"
              hint="Blocked, or waiting on an unfinished task"
              checked={filters.waitingOnSomeoneOnly}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, waitingOnSomeoneOnly: value }))
              }
            />
            <ToggleRow
              label="Show completed"
              checked={filters.includeCompleted}
              onChange={(value) => setFilters((prev) => ({ ...prev, includeCompleted: value }))}
            />
          </div>

          <div className="border-t border-line px-3 py-2 text-2xs text-text-muted">
            Showing <span className="font-medium text-text">{filtered.length}</span> of{" "}
            {tasks.length} tasks
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <Menu>
        <MenuTrigger asChild>
          <Button variant="outline" size="md">
            {sort === "SMART" ? (
              <Sparkles className="h-3.5 w-3.5 text-accent-bright" />
            ) : (
              <ArrowDownUp className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{sortModeMeta[sort].label}</span>
          </Button>
        </MenuTrigger>
        <MenuContent className="w-[15rem]">
          <MenuLabel>Order by</MenuLabel>
          <MenuRadioGroup value={sort} onValueChange={(value) => setSort(value as SortMode)}>
            {SORT_MODES.map((mode) => (
              <MenuRadioItem key={mode} value={mode} className="flex-col items-start gap-0 py-1.5">
                <span>{sortModeMeta[mode].label}</span>
                <span className="text-2xs text-text-faint">{sortModeMeta[mode].description}</span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          {sort !== "SMART" && (
            <>
              <MenuSeparator />
              <button
                onClick={() => setSort("SMART")}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-accent-bright hover:bg-hover"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Back to smart priority
              </button>
            </>
          )}
        </MenuContent>
      </Menu>

      {sort === "MANUAL" && (
        <Tooltip content="Drag tasks to reorder. Nothing will re-sort them.">
          <span>
            <Badge tone="tone-info">Manual order</Badge>
          </span>
        </Tooltip>
      )}

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}

function FacetRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs text-text-secondary hover:bg-hover hover:text-text">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label className="cursor-pointer">{label}</Label>
        {hint && <p className="text-2xs text-text-faint">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

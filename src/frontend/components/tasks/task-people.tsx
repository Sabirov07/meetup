"use client";

import { Users } from "lucide-react";
import type { MemberSummary, TaskView } from "@/shared/domain/types";
import { peopleOn } from "@/shared/domain/filters";
import { useT } from "@/frontend/i18n";
import { Avatar, AvatarStack } from "@/frontend/components/ui/avatar";
import {
  MenuCheckboxItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "@/frontend/components/ui/menu";

/**
 * Who is on a task, drawn and edited the same way everywhere.
 *
 * A task has one owner and any number of people beside them. The owner is
 * what the board panels and the team counts key on; the others are the people
 * who genuinely did the work together and deserve their face on the row.
 */

export const UNASSIGNED = "UNASSIGNED";

/** The owner's avatar, or the whole group stacked when there is more than one. */
export function TaskPeople({
  task,
  size = "md",
}: {
  task: Pick<TaskView, "owner" | "assignees">;
  size?: "xs" | "sm" | "md";
}) {
  const people = peopleOn(task);
  if (people.length <= 1) return <Avatar member={task.owner} size={size} />;
  return <AvatarStack members={people} size={size} max={3} />;
}

/** "{title} is assigned to Vadym, Shukhrat" — for the cell's accessible name. */
export function usePeopleLabel() {
  const t = useT();
  return (task: Pick<TaskView, "title" | "owner" | "assignees">) => {
    const people = peopleOn(task);
    if (people.length === 0) return t("tasks.table.assignTo", { title: task.title });
    if (people.length === 1) {
      return t("tasks.table.assignedTo", { title: task.title, name: people[0].name });
    }
    return t("tasks.table.assignedToMany", {
      title: task.title,
      names: people.map((m) => m.name).join(", "),
    });
  };
}

/**
 * The owner radio group followed by one checkbox per other member. Dropped
 * inside any `MenuContent`; the host decides where the change goes.
 *
 * Ticking a checkbox keeps the menu open, so a second person is one more
 * click rather than a second trip through the menu.
 */
export function PeopleMenuItems({
  members,
  ownerId,
  assigneeIds,
  onOwnerChange,
  onAssigneesChange,
}: {
  members: MemberSummary[];
  ownerId: string | null;
  assigneeIds: string[];
  onOwnerChange: (memberId: string | null) => void;
  onAssigneesChange: (memberIds: string[]) => void;
}) {
  const t = useT();
  const others = members.filter((m) => m.id !== ownerId);

  return (
    <>
      <MenuLabel>{t("tasks.facet.assignee")}</MenuLabel>
      <MenuRadioGroup
        value={ownerId ?? UNASSIGNED}
        onValueChange={(value) => onOwnerChange(value === UNASSIGNED ? null : value)}
      >
        {members.map((member) => (
          <MenuRadioItem key={member.id} value={member.id}>
            <Avatar member={member} size="xs" />
            {member.name}
          </MenuRadioItem>
        ))}
        <MenuRadioItem value={UNASSIGNED}>
          <Avatar member={null} size="xs" />
          {t("common.unassigned")}
        </MenuRadioItem>
      </MenuRadioGroup>

      {others.length > 0 && (
        <>
          <MenuSeparator />
          <MenuLabel className="flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            {t("tasks.facet.alsoOn")}
          </MenuLabel>
          {others.map((member) => {
            const on = assigneeIds.includes(member.id);
            return (
              <MenuCheckboxItem
                key={member.id}
                checked={on}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(next) =>
                  onAssigneesChange(
                    next
                      ? [...assigneeIds, member.id]
                      : assigneeIds.filter((id) => id !== member.id),
                  )
                }
              >
                <Avatar member={member} size="xs" />
                {member.name}
              </MenuCheckboxItem>
            );
          })}
        </>
      )}
    </>
  );
}

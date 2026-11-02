"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Ellipsis, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { NO_SPACE, type SpaceSummary } from "@/shared/domain/types";
import { useI18n } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Count } from "@/frontend/components/ui/badge";
import { Tooltip } from "@/frontend/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/frontend/components/ui/menu";
import { DeleteSpaceDialog, SpaceDialog } from "./space-dialog";
import { spaceDot } from "./space-color";

/**
 * The sections of the workspace, in the sidebar.
 *
 * This is the one piece of navigation the workspace writes itself, so it
 * behaves differently from the fixed items above it: the list can be empty,
 * it grows from a "+" in its own heading, and each row carries the menu that
 * renames or deletes it. Everything else in the sidebar is a constant.
 *
 * "No section" is only shown when something is actually in it. A workspace
 * that files everything would otherwise carry a permanent empty row
 * explaining a state it never reaches.
 */
export function SpaceNav({
  spaces,
  unfiledCount,
  collapsed,
  onNavigate,
}: {
  spaces: SpaceSummary[];
  /** Open tasks with no section, which is what makes that row worth drawing. */
  unfiledCount: number;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SpaceSummary | null>(null);
  const [deleting, setDeleting] = useState<SpaceSummary | null>(null);

  function isActive(href: string): boolean {
    return pathname === href;
  }

  // Collapsed, the "+" has nowhere sensible to live and the names are gone;
  // a single folder icon pointing at the sections list is the honest
  // reduction.
  if (collapsed) {
    return (
      <div className="mt-4">
        <div className="mx-2 mb-2 h-px bg-line" />
        <ul className="space-y-0.5">
          {spaces.map((space) => (
            <li key={space.id}>
              <Tooltip
                content={
                  space.openTasks > 0 ? `${space.name} · ${space.openTasks}` : space.name
                }
                side="right"
                delay={120}
              >
                <Link
                  href={`/spaces/${space.id}`}
                  onClick={onNavigate}
                  aria-label={space.name}
                  aria-current={isActive(`/spaces/${space.id}`) ? "page" : undefined}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-md transition-colors",
                    isActive(`/spaces/${space.id}`)
                      ? "bg-raised"
                      : "hover:bg-hover",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", spaceDot(space.colorToken))} />
                </Link>
              </Tooltip>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-1 px-2 pb-1.5">
        <p className="eyebrow">{t("nav.section.spaces")}</p>
        <Tooltip content={t("spaces.addShort")} side="right">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setCreating(true)}
            aria-label={t("spaces.addShort")}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>

      {spaces.length === 0 ? (
        <button
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-2xs leading-4 text-text-faint transition-colors hover:bg-hover hover:text-text-muted"
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{t("spaces.empty")}</span>
        </button>
      ) : (
        <ul className="space-y-0.5">
          {spaces.map((space) => {
            const href = `/spaces/${space.id}`;
            const active = isActive(href);

            return (
              <li key={space.id} className="group/space relative">
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-7 items-center gap-2 rounded-md pl-2 pr-7 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-raised text-text"
                      : "text-text-secondary hover:bg-hover hover:text-text",
                  )}
                >
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", spaceDot(space.colorToken))}
                  />
                  <span className="min-w-0 flex-1 truncate">{space.name}</span>
                  {space.openTasks > 0 && (
                    // Hidden while the row is hovered, where the menu button
                    // takes the same corner.
                    <Count className="group-hover/space:invisible">{space.openTasks}</Count>
                  )}
                </Link>

                <Menu>
                  <MenuTrigger asChild>
                    <button
                      aria-label={t("spaces.manage", { name: space.name })}
                      className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-text-faint opacity-0 transition-opacity hover:bg-hover hover:text-text focus-visible:opacity-100 group-hover/space:opacity-100 data-[state=open]:opacity-100"
                    >
                      <Ellipsis className="h-3.5 w-3.5" />
                    </button>
                  </MenuTrigger>
                  <MenuContent align="start" className="w-48">
                    <MenuItem onSelect={() => setEditing(space)}>
                      <Pencil className="h-3.5 w-3.5" />
                      {t("spaces.rename")}
                    </MenuItem>
                    <MenuItem onSelect={() => setDeleting(space)} destructive>
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("spaces.delete")}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </li>
            );
          })}

          {unfiledCount > 0 && (
            <li>
              <Link
                href={`/spaces/${NO_SPACE}`}
                onClick={onNavigate}
                aria-current={isActive(`/spaces/${NO_SPACE}`) ? "page" : undefined}
                className={cn(
                  "flex h-7 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors",
                  isActive(`/spaces/${NO_SPACE}`)
                    ? "bg-raised text-text"
                    : "text-text-faint hover:bg-hover hover:text-text",
                )}
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{t("spaces.unfiled")}</span>
                <Count>{unfiledCount}</Count>
              </Link>
            </li>
          )}
        </ul>
      )}

      <SpaceDialog open={creating} onOpenChange={setCreating} />
      <SpaceDialog
        open={editing !== null}
        onOpenChange={(value) => !value && setEditing(null)}
        space={editing}
      />
      <DeleteSpaceDialog
        open={deleting !== null}
        onOpenChange={(value) => !value && setDeleting(null)}
        space={deleting}
      />
    </div>
  );
}

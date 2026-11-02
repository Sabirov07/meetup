"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { createWorkspace, switchWorkspace } from "@/backend/actions/team";
import type { WorkspaceOption } from "@/shared/domain/types";
import { useT } from "@/frontend/i18n";
import { Logo } from "@/frontend/components/brand";
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
import { Field, Input } from "@/frontend/components/ui/field";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/frontend/components/ui/menu";

/**
 * The workspace button at the top of the sidebar.
 *
 * It only became worth building once a person could belong to more than one
 * workspace: before invites, the menu listed the single workspace they had and
 * a note explaining there was nothing to switch to. Now it is the way between
 * a company and a side project, and the way to start a new one.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeName,
}: {
  workspaces: WorkspaceOption[];
  activeName: string;
}) {
  const t = useT();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [switching, startSwitch] = useTransition();

  function pick(workspace: WorkspaceOption) {
    if (workspace.isActive) return;
    startSwitch(async () => {
      const result = await switchWorkspace(workspace.id);
      if (result.ok) {
        toast.success(t("team.switcher.switched", { name: workspace.name }));
        // Every page in the shell is scoped to the active workspace, so the
        // whole tree has to come back from the server, not from the cache.
        router.replace("/");
        router.refresh();
      } else {
        toast.error(t("team.switcher.switchFailed"), { description: result.error });
      }
    });
  }

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            disabled={switching}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-hover disabled:opacity-60"
          >
            <Logo />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold tracking-[-0.015em] text-text">
                {activeName}
              </span>
            </span>
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="w-64">
          <MenuLabel>{t("team.switcher.heading")}</MenuLabel>
          {workspaces.map((workspace) => (
            <MenuItem
              key={workspace.id}
              className="gap-2"
              onSelect={() => pick(workspace)}
            >
              <Logo size={18} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{workspace.name}</span>
                <span className="block truncate text-2xs text-text-faint">
                  {t("team.members.count", { count: workspace.memberCount })}
                </span>
              </span>
              {workspace.isActive && (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent-bright" />
              )}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem asChild>
            <Link href="/team">
              <Users className="h-3.5 w-3.5" />
              {t("team.switcher.manage")}
            </Link>
          </MenuItem>
          <MenuItem onSelect={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t("team.switcher.create")}
          </MenuItem>
        </MenuContent>
      </Menu>

      {creating && <CreateWorkspaceDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await createWorkspace(name);
      if (result.ok) {
        toast.success(t("team.switcher.created"));
        onClose();
        router.replace("/team");
        router.refresh();
      } else {
        toast.error(t("team.switcher.createFailed"), { description: result.error });
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("team.switcher.createTitle")}</DialogTitle>
          <DialogDescription>{t("team.switcher.createBody")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label={t("team.switcher.createName")} htmlFor="new-workspace-name">
            <Input
              id="new-workspace-name"
              autoFocus
              value={name}
              placeholder={t("team.switcher.createNamePlaceholder")}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim().length >= 2) submit();
              }}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={name.trim().length < 2}
            onClick={submit}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("team.switcher.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

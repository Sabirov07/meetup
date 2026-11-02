"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { setSidebarCollapsed } from "@/backend/actions/preferences";
import type {
  MemberSummary,
  SpaceSummary,
  WorkspaceOption,
  WorkspaceSummary,
} from "@/shared/domain/types";
import { cn } from "@/frontend/lib/utils";
import { Dialog, DialogTitle } from "@/frontend/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { StartMeetingDialog, type GoogleState } from "@/frontend/components/meetings/start-meeting-dialog";
import { TaskFormDialog } from "@/frontend/components/tasks/task-form-dialog";
import { TaskIntakeDialog } from "@/frontend/components/tasks/task-intake-dialog";
import { useI18n } from "@/frontend/i18n";
import { CommandPalette } from "./command-palette";
import { CreateActionsProvider } from "./create-actions";
import { Header, type HeaderAlert } from "./header";
import { Sidebar, type NavCounts } from "./sidebar";

/**
 * The shell owns everything that is global: navigation, the command palette,
 * and the create dialogs reachable from any page.
 *
 * Pages render inside it as children and stay free of chrome concerns.
 */
export function AppShell({
  workspace,
  workspaces,
  spaces,
  unfiledCount,
  member,
  counterpart,
  counts,
  alerts,
  google,
  aiConfigured,
  initialCollapsed,
  children,
}: {
  workspace: WorkspaceSummary;
  /** Every workspace this person belongs to, for the sidebar switcher. */
  workspaces: WorkspaceOption[];
  /** The sections of the active workspace, in sidebar order. */
  spaces: SpaceSummary[];
  /** Open tasks filed under no section. */
  unfiledCount: number;
  member: MemberSummary;
  counterpart: MemberSummary | null;
  counts: NavCounts;
  alerts: HeaderAlert[];
  google: GoogleState;
  /** Whether a model key is present, so intake can explain itself when not. */
  aiConfigured: boolean;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  /**
   * The create dialog that just opened took over from the other one, rather
   * than being opened from a button.
   *
   * The two ways of creating work are one decision with two faces, so moving
   * between them should feel like a tab. Both state changes happen in the same
   * event, so React swaps the panels in a single commit and nothing ever
   * blinks away. What was left was the arrival — a fresh scrim fading in and a
   * panel scaling up from nothing, which is what read as a load. This turns
   * that into a cross-fade in place.
   */
  const [handover, setHandover] = useState(false);

  const openTaskForm = useCallback((fromSwitch = false) => {
    setHandover(fromSwitch);
    setIntakeOpen(false);
    setTaskOpen(true);
  }, []);

  const openIntake = useCallback((fromSwitch = false) => {
    setHandover(fromSwitch);
    setTaskOpen(false);
    setIntakeOpen(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      // Fire and forget: the preference is a convenience, not a correctness
      // concern, so a failed write should not interrupt anything.
      void setSidebarCollapsed(next);
      return next;
    });
  }, []);

  // Global shortcuts. Ignored while typing, so they never eat real input.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "c") {
        event.preventDefault();
        openTaskForm();
      } else if (event.key === "C") {
        event.preventDefault();
        openIntake();
      } else if (event.key === "m") {
        event.preventDefault();
        setMeetingOpen(true);
      } else if (event.key === "[") {
        event.preventDefault();
        toggleCollapsed();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed, openTaskForm, openIntake]);

  // Stable, so a page's create form does not re-render on every shell state
  // change just because it holds this. It is reached only from that form's own
  // mode switch, so the arrival is always a handover.
  const createActions = useMemo(
    () => ({ describeTasks: () => openIntake(true) }),
    [openIntake],
  );

  const sidebar = (
    <Sidebar
      workspace={workspace}
      workspaces={workspaces}
      spaces={spaces}
      unfiledCount={unfiledCount}
      member={member}
      counterpart={counterpart}
      counts={counts}
      collapsed={collapsed}
      onToggle={toggleCollapsed}
      onNewTask={() => openTaskForm()}
    />
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-line transition-[width] duration-150 lg:block",
          collapsed ? "w-[3.25rem]" : "w-[13.5rem]",
        )}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade-in lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-[15rem] border-r border-line-strong shadow-modal focus:outline-none data-[state=open]:animate-slide-in-right lg:hidden"
          >
            <DialogTitle className="sr-only">{t("sidebar.openNavigation")}</DialogTitle>
            <Sidebar
              workspace={workspace}
              workspaces={workspaces}
              spaces={spaces}
              unfiledCount={unfiledCount}
              member={member}
              counterpart={counterpart}
              counts={counts}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
              onNewTask={() => openTaskForm()}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </Dialog>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          workspace={workspace}
          counterpart={counterpart}
          pendingReview={counts.pendingReview}
          alerts={alerts}
          onOpenSidebar={() => setMobileOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onStartMeeting={() => setMeetingOpen(true)}
          onNewTask={() => openTaskForm()}
        />
        <main className="min-w-0 flex-1">
          <CreateActionsProvider value={createActions}>{children}</CreateActionsProvider>
        </main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <StartMeetingDialog
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        members={workspace.members}
        currentMemberId={member.id}
        google={google}
      />

      <TaskFormDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        members={workspace.members}
        spaces={spaces}
        defaultOwnerId={member.id}
        onDescribeTasks={() => openIntake(true)}
        quiet={handover}
      />

      <TaskIntakeDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        members={workspace.members}
        currentMemberId={member.id}
        aiConfigured={aiConfigured}
        onSwitchToForm={() => openTaskForm(true)}
        quiet={handover}
      />
    </div>
  );
}

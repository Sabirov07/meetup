"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/frontend/lib/utils";
import { Button } from "./button";

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  side = "top",
  align = "center",
  delay = 350,
  children,
}: {
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delay?: number;
  children: ReactNode;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className="z-50 max-w-[16rem] rounded-md border border-line-strong bg-overlay px-2 py-1 text-2xs leading-4 text-text-secondary shadow-popover data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function Progress({
  value,
  tone = "bg-accent",
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  tone?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root
      value={clamped}
      aria-label={ariaLabel}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-raised", className)}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full transition-transform duration-500", tone)}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

/** Multi-segment bar for status distribution. */
export function SegmentBar({
  segments,
  className,
}: {
  segments: { value: number; tone: string; label: string }[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <div className={cn("h-1 w-full rounded-full bg-raised", className)} />;
  }
  return (
    <div className={cn("flex h-1 w-full overflow-hidden rounded-full bg-raised", className)}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.value}`}
            className={s.tone}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Switch / Checkbox / Separator
// ---------------------------------------------------------------------------

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors data-[state=checked]:bg-accent-solid data-[state=unchecked]:bg-raised",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[15px] data-[state=unchecked]:translate-x-[2px]" />
    </SwitchPrimitive.Root>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-line-strong transition-colors hover:border-accent data-[state=checked]:border-accent-solid data-[state=checked]:bg-accent-solid data-[state=indeterminate]:border-accent-solid data-[state=indeterminate]:bg-accent-solid",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Separator({
  className,
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      className={cn(
        "shrink-0 bg-line data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-md bg-raised", className)} />;
}

/** Matches the real task row's geometry so loading does not shift layout. */
export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
      <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-4 w-14 shrink-0" />
      <Skeleton className="h-4 w-10 shrink-0" />
      <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
    </div>
  );
}

export function PanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-6 w-20" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <TaskRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="mt-2.5 h-6 w-10" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-raised">
          <Icon className="h-4 w-4 text-text-faint" />
        </div>
      )}
      <p className="text-[13px] font-medium text-text">{title}</p>
      {description && (
        <p className="mt-1 max-w-[26rem] text-xs leading-5 text-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <div className="tone-danger mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tone-bg)]">
        <AlertTriangle className="h-4 w-4 text-[var(--tone-fg)]" />
      </div>
      <p className="text-[13px] font-medium text-text">{title}</p>
      {description && (
        <p className="mt-1 max-w-[26rem] text-xs leading-5 text-text-muted">{description}</p>
      )}
      {onRetry && (
        <Button size="sm" variant="secondary" className="mt-4" onClick={onRetry}>
          <RotateCcw className="h-3 w-3" />
          Try again
        </Button>
      )}
    </div>
  );
}

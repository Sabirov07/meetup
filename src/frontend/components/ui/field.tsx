"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/frontend/lib/utils";

const controlBase =
  "w-full rounded-md border border-line-strong bg-canvas text-text transition-colors placeholder:text-text-faint hover:border-text-faint/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-50";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("block text-xs font-medium text-text-secondary", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-8 px-2.5 text-[13px]", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlBase, "min-h-[72px] resize-y px-2.5 py-2 text-[13px] leading-6", className)}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-2xs text-danger">
      {children}
    </p>
  );
}

/** Label + control + error, with consistent spacing. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label?: ReactNode;
  htmlFor?: string;
  error?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={htmlFor}>{label}</Label>
          {hint && <span className="text-2xs text-text-faint">{hint}</span>}
        </div>
      )}
      {children}
      <FieldError>{error}</FieldError>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  size = "md",
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "sm" | "md" }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        controlBase,
        "flex items-center justify-between gap-2 text-left",
        size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-[13px]",
        "data-[placeholder]:text-text-faint",
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-faint" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className={cn(
          "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line-strong bg-overlay p-1 shadow-popover",
          "data-[state=open]:animate-scale-in",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-7 text-[13px] text-text-secondary outline-none",
        "data-[highlighted]:bg-hover data-[highlighted]:text-text",
        "data-[state=checked]:text-text",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2">
        <Check className="h-3.5 w-3.5 text-accent-bright" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("eyebrow px-2 py-1.5", className)} {...props} />;
}

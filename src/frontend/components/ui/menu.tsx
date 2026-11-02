"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/frontend/lib/utils";

export const Menu = DropdownMenuPrimitive.Root;
export const MenuTrigger = DropdownMenuPrimitive.Trigger;
export const MenuGroup = DropdownMenuPrimitive.Group;

const surface =
  "z-50 min-w-[11rem] overflow-hidden rounded-lg border border-line-strong bg-overlay p-1 shadow-popover data-[state=open]:animate-slide-down";

export function MenuContent({
  className,
  sideOffset = 6,
  align = "end",
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(surface, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

const itemBase =
  "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-text-secondary outline-none transition-colors data-[highlighted]:bg-hover data-[highlighted]:text-text data-[disabled]:pointer-events-none data-[disabled]:opacity-40";

export function MenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        itemBase,
        destructive && "text-danger data-[highlighted]:bg-danger/12 data-[highlighted]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(itemBase, "pr-7", className)}
      {...props}
    >
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="absolute right-2">
        <Check className="h-3.5 w-3.5 text-accent-bright" />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function MenuRadioGroup(
  props: ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>,
) {
  return <DropdownMenuPrimitive.RadioGroup {...props} />;
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem className={cn(itemBase, "pr-7", className)} {...props}>
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="absolute right-2">
        <Check className="h-3.5 w-3.5 text-accent-bright" />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function MenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return <DropdownMenuPrimitive.Label className={cn("eyebrow px-2 py-1.5", className)} {...props} />;
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-line", className)}
      {...props}
    />
  );
}

export function MenuShortcut({ children }: { children: string }) {
  return <span className="ml-auto pl-3 text-2xs tracking-wide text-text-faint">{children}</span>;
}

// ---------------------------------------------------------------------------
// Popover — used for the filter panel, where the content is not a menu.
// ---------------------------------------------------------------------------

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  sideOffset = 6,
  align = "end",
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 w-72 rounded-lg border border-line-strong bg-overlay p-3 shadow-popover focus:outline-none data-[state=open]:animate-slide-down",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

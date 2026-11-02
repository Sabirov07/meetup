"use client";

import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import type { MemberSummary } from "@/shared/domain/types";

/**
 * Identity colours are assigned per person from a fixed set, so the same
 * person is always the same colour everywhere in the product. The values live
 * in `globals.css` as `--color-id-*`, which is what lets a chip be a dark fill
 * with pale initials in the dark theme and the reverse in the light one without
 * this file knowing either palette.
 */
const accents: Record<string, string> = {
  violet: "bg-id-violet text-id-violet-fg",
  amber: "bg-id-amber text-id-amber-fg",
  teal: "bg-id-teal text-id-teal-fg",
  blue: "bg-id-blue text-id-blue-fg",
  rose: "bg-id-rose text-id-rose-fg",
  slate: "bg-id-slate text-id-slate-fg",
};

const sizes = {
  xs: "h-4 w-4 text-[8px]",
  sm: "h-5 w-5 text-[9px]",
  md: "h-6 w-6 text-[10px]",
  lg: "h-8 w-8 text-[11px]",
  xl: "h-10 w-10 text-[13px]",
};

export function Avatar({
  member,
  size = "md",
  className,
  showRing,
}: {
  member: Pick<MemberSummary, "name" | "initials" | "accentToken"> | null;
  size?: keyof typeof sizes;
  className?: string;
  showRing?: boolean;
}) {
  const label = useT()("common.unassigned");

  if (!member) {
    return (
      <span
        title={label}
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-text-faint",
          sizes[size],
          className,
        )}
      >
        ?
      </span>
    );
  }

  return (
    <span
      title={member.name}
      aria-label={member.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight",
        accents[member.accentToken] ?? accents.slate,
        sizes[size],
        showRing && "ring-2 ring-surface",
        className,
      )}
    >
      {member.initials}
    </span>
  );
}

/** Overlapping avatars for participant lists. */
export function AvatarStack({
  members,
  max = 3,
  size = "sm",
}: {
  members: Pick<MemberSummary, "name" | "initials" | "accentToken">[];
  max?: number;
  size?: keyof typeof sizes;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;

  return (
    <span className="flex items-center">
      {shown.map((member, i) => (
        <Avatar
          key={`${member.name}-${i}`}
          member={member}
          size={size}
          showRing
          className={i > 0 ? "-ml-1.5" : undefined}
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "-ml-1.5 inline-flex shrink-0 items-center justify-center rounded-full bg-raised font-semibold text-text-muted ring-2 ring-surface",
            sizes[size],
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

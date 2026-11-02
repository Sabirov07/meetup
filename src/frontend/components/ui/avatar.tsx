import { cn } from "@/frontend/lib/utils";
import type { MemberSummary } from "@/shared/domain/types";

/**
 * Identity colours are assigned per person from a fixed set, so the same
 * person is always the same colour everywhere in the product.
 */
const accents: Record<string, string> = {
  violet: "bg-[#4a3fa8] text-[#d6d0ff]",
  amber: "bg-[#5c4214] text-[#f5d9a0]",
  teal: "bg-[#13453a] text-[#8fe3c6]",
  blue: "bg-[#1c3a63] text-[#aed2ff]",
  rose: "bg-[#542029] text-[#ffc2ca]",
  slate: "bg-[#2f343d] text-[#c3c8d2]",
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
  if (!member) {
    return (
      <span
        title="Unassigned"
        aria-label="Unassigned"
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

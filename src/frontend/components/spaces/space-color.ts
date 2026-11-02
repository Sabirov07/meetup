/**
 * Section colours reuse the identity palette rather than introducing a second
 * one: six values the product already ships, already contrast-checked in both
 * themes, and already familiar from avatars.
 *
 * The `-fg` half of each pair is the saturated one — pale on the dark theme,
 * deep on the light one — which is what a dot needs. The `-bg` half is the
 * wash behind it.
 */
const dots: Record<string, string> = {
  violet: "bg-id-violet-fg",
  amber: "bg-id-amber-fg",
  teal: "bg-id-teal-fg",
  blue: "bg-id-blue-fg",
  rose: "bg-id-rose-fg",
  slate: "bg-id-slate-fg",
};

const washes: Record<string, string> = {
  violet: "bg-id-violet text-id-violet-fg",
  amber: "bg-id-amber text-id-amber-fg",
  teal: "bg-id-teal text-id-teal-fg",
  blue: "bg-id-blue text-id-blue-fg",
  rose: "bg-id-rose text-id-rose-fg",
  slate: "bg-id-slate text-id-slate-fg",
};

/** Solid dot for a section, keyed by its colour token. */
export function spaceDot(token: string | null | undefined): string {
  return dots[token ?? ""] ?? dots.slate!;
}

/** Tinted chip for a section — pale fill, readable text. */
export function spaceWash(token: string | null | undefined): string {
  return washes[token ?? ""] ?? washes.slate!;
}

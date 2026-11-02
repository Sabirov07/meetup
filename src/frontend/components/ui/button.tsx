import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/frontend/lib/utils";

const button = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,opacity] duration-100 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        // Solid accent uses the deeper token so white text clears AA.
        primary:
          "bg-accent-solid text-white hover:bg-accent-solid-hover active:bg-accent-solid",
        secondary:
          "border border-line-strong bg-raised text-text hover:border-line-accent hover:bg-hover",
        outline:
          "border border-line bg-transparent text-text-secondary hover:border-line-strong hover:bg-hover hover:text-text",
        ghost: "text-text-secondary hover:bg-hover hover:text-text",
        subtle: "bg-raised text-text-secondary hover:bg-hover hover:text-text",
        danger: "bg-danger/12 text-danger hover:bg-danger/20",
        link: "text-accent-bright underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-6 gap-1 px-1.5 text-2xs",
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-[13px]",
        lg: "h-9 px-3.5 text-sm",
        icon: "h-8 w-8",
        "icon-sm": "h-7 w-7",
        "icon-xs": "h-6 w-6",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /** Renders the child element instead of a <button> (for links). */
  asChild?: boolean;
  loading?: boolean;
  /** Shown while `loading`, replacing children. */
  loadingLabel?: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  loading,
  loadingLabel,
  children,
  disabled,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot className={cn(button({ variant, size }), className)} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { button as buttonVariants };

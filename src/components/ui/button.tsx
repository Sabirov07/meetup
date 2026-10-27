import { cva, type VariantProps } from "class-variance-authority";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const styles = cva("inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50", {
  variants: { variant: { default: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700", secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50", ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900", danger: "bg-rose-600 text-white hover:bg-rose-700" }, size: { default: "h-10 px-4", sm: "h-8 px-3 text-xs", icon: "h-9 w-9" } },
  defaultVariants: { variant: "default", size: "default" },
});

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof styles> {}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => <button ref={ref} className={cn(styles({ variant, size }), className)} {...props} />);
Button.displayName = "Button";

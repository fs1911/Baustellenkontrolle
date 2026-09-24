import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost" | "outline";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong border border-brand-strong",
  secondary: "bg-chrome text-white hover:bg-black border border-black",
  danger: "bg-negative text-white hover:bg-red-800 border border-red-900",
  success: "bg-positive text-white hover:bg-green-800 border border-green-900",
  ghost: "bg-transparent text-ink hover:bg-slate-200 border border-transparent",
  outline: "bg-surface text-ink hover:bg-slate-100 border-2 border-line-strong",
};
const sizes: Record<Size, string> = {
  sm: "min-h-10 px-3 text-sm gap-1.5",
  md: "min-h-12 px-4 text-base gap-2",
  lg: "min-h-14 px-5 text-lg gap-2",
  xl: "min-h-16 px-6 text-xl gap-3",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-semibold transition-colors select-none",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: LinkProps & { variant?: Variant; size?: Size; className?: string; children: React.ReactNode; "aria-label"?: string; prefetch?: boolean }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}

const variants = {
  primary:
    "bg-accent text-[#06110C] hover:bg-accent-dim disabled:bg-accent/40",
  secondary:
    "bg-surfaceRaised text-foreground border border-border hover:border-accent/50",
  ghost: "text-muted hover:text-foreground hover:bg-surfaceRaised",
  danger: "bg-danger/90 text-white hover:bg-danger",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium",
          "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
          variants[variant],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

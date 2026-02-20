"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "text";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-cheiz-primary hover:bg-cheiz-dark text-white font-semibold rounded-full w-full py-4 active:scale-[0.98] transition-all disabled:opacity-50",
  secondary:
    "border border-cheiz-border bg-white text-cheiz-text hover:border-cheiz-primary hover:text-cheiz-primary font-medium rounded-full py-3 px-5 active:scale-[0.98] transition-all disabled:opacity-50",
  text:
    "text-cheiz-sub hover:text-cheiz-primary text-sm font-medium transition-colors disabled:opacity-50",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading, children, className = "", disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${variantStyles[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>로딩 중...</span>
        </span>
      ) : (
        children
      )}
    </button>
  ),
);

Button.displayName = "Button";
export default Button;

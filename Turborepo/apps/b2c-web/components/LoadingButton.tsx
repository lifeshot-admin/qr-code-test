"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: ReactNode;
  spinnerSize?: number;
}

export default function LoadingButton({
  loading = false,
  children,
  className = "",
  disabled,
  spinnerSize = 18,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      className={`relative transition-all duration-150 active:scale-[0.97] ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            className="animate-spin"
            width={spinnerSize}
            height={spinnerSize}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </span>
      )}
      <span className={loading ? "opacity-0" : "opacity-100"}>{children}</span>
    </button>
  );
}

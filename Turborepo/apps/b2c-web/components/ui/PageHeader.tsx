"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

interface PageHeaderProps {
  title?: string;
  breadcrumb?: { home?: string; current: string };
  backHref?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  breadcrumb,
  backHref,
  onBack,
  rightSlot,
  className = "",
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
    router.back();
  };

  if (breadcrumb) {
    return (
      <header className={`bg-white border-b border-cheiz-border ${className}`}>
        <div className="max-w-sm mx-auto px-5 py-2.5 flex items-center gap-2 text-sm">
          <button onClick={handleBack} className="text-cheiz-sub hover:text-cheiz-primary transition-colors">
            {breadcrumb.home || "홈"}
          </button>
          <span className="text-cheiz-border">|</span>
          <span className="font-medium text-cheiz-text">{breadcrumb.current}</span>
          {rightSlot && <div className="ml-auto">{rightSlot}</div>}
        </div>
      </header>
    );
  }

  return (
    <header className={`sticky top-0 z-40 bg-white border-b border-cheiz-border ${className}`}>
      <div className="max-w-sm mx-auto px-5 h-14 flex items-center gap-3">
        <button onClick={handleBack} className="p-1 -ml-1 text-cheiz-text">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {title && (
          <h1 className="font-bold text-base text-cheiz-text flex-1 truncate">{title}</h1>
        )}
        {rightSlot && <div className="ml-auto">{rightSlot}</div>}
      </div>
    </header>
  );
}

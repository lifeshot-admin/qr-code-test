"use client";

import { type ReactNode } from "react";

interface InfoRowProps {
  icon?: ReactNode;
  label?: string;
  value: ReactNode;
  className?: string;
}

export default function InfoRow({
  icon,
  label,
  value,
  className = "",
}: InfoRowProps) {
  return (
    <div className={`flex items-center gap-2.5 text-sm ${className}`}>
      {icon && (
        <span className="w-6 flex-shrink-0 flex items-center justify-center text-cheiz-primary">
          {icon}
        </span>
      )}
      {label && <span className="text-cheiz-sub flex-shrink-0">{label}</span>}
      <span className="font-medium text-cheiz-text">{value}</span>
    </div>
  );
}

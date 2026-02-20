"use client";

import { type ReactNode } from "react";

interface CardProps {
  imageUrl?: string;
  imageAlt?: string;
  badge?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function Card({
  imageUrl,
  imageAlt = "",
  badge,
  children,
  onClick,
  className = "",
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-cheiz-border ${
        onClick ? "cursor-pointer active:scale-[0.98] transition-transform" : ""
      } ${className}`}
    >
      {imageUrl && (
        <div className="relative w-full aspect-[4/3] bg-cheiz-surface">
          <img
            src={imageUrl}
            alt={imageAlt}
            className="w-full h-full object-cover"
          />
          {badge && (
            <div className="absolute top-3 right-3">{badge}</div>
          )}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

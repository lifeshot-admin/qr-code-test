"use client";

import { type ReactNode } from "react";

type BadgeVariant = "dday" | "status" | "tag";
type StatusColor = "success" | "primary" | "red" | "gray";

interface BadgeProps {
  variant?: BadgeVariant;
  color?: StatusColor;
  children: ReactNode;
  className?: string;
}

const statusColors: Record<StatusColor, string> = {
  success: "bg-cheiz-success/10 text-cheiz-success",
  primary: "bg-cheiz-primary/10 text-cheiz-primary",
  red: "bg-red-100 text-red-600",
  gray: "bg-gray-100 text-cheiz-sub",
};

export default function Badge({
  variant = "tag",
  color = "primary",
  children,
  className = "",
}: BadgeProps) {
  let base = "";

  switch (variant) {
    case "dday":
      base = "bg-cheiz-primary text-white rounded-lg px-3 py-1 text-sm font-bold";
      break;
    case "status":
      base = `${statusColors[color]} rounded-full px-3 py-1 text-xs font-bold`;
      break;
    case "tag":
      base = "bg-cheiz-surface text-cheiz-sub rounded-full px-3 py-1 text-xs";
      break;
  }

  return (
    <span className={`inline-flex items-center whitespace-nowrap ${base} ${className}`}>
      {children}
    </span>
  );
}

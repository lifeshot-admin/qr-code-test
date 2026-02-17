"use client";

import { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: string;
}

export default function Skeleton({
  width,
  height,
  rounded = "rounded-lg",
  className = "",
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 ${rounded} ${className}`}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          rounded="rounded"
          className={i === lines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm ${className}`}>
      <Skeleton height={180} rounded="rounded-none" className="w-full" />
      <div className="p-4 space-y-3">
        <Skeleton height={16} className="w-3/4" rounded="rounded" />
        <Skeleton height={12} className="w-1/2" rounded="rounded" />
        <div className="flex justify-between items-center pt-1">
          <Skeleton height={14} className="w-1/3" rounded="rounded" />
          <Skeleton height={28} className="w-20" rounded="rounded-lg" />
        </div>
      </div>
    </div>
  );
}

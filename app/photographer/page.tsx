"use client";

import { Suspense } from "react";
import { PhotographerApp } from "@/components/PhotographerApp";

export default function PhotographerPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-[#00D9FF] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PhotographerApp />
    </Suspense>
  );
}

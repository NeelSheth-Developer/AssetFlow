"use client";

import { cn } from "@/lib/utils";

const statusClasses: Record<string, string> = {
  AVAILABLE:
    "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  ALLOCATED:
    "bg-blue-100/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  RESERVED:
    "bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  UNDER_MAINTENANCE:
    "bg-orange-100/80 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  LOST: "bg-rose-100/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  RETIRED:
    "bg-gray-100/80 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  DISPOSED:
    "bg-gray-50/80 text-gray-500 dark:bg-gray-900 dark:text-gray-500",
};

export function getStatusBadgeClasses(status: string): string {
  return statusClasses[status] || "bg-muted text-muted-foreground";
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        getStatusBadgeClasses(status),
        className
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

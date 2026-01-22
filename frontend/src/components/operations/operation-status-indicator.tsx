"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";

export type OperationStatus = "ready" | "warning" | "error" | "loading" | "unknown";

type OperationStatusIndicatorProps = {
  status: OperationStatus;
  className?: string;
  size?: "sm" | "md";
};

const statusConfig: Record<
  OperationStatus,
  { icon: typeof CheckCircle2; colorClass: string; label: string }
> = {
  ready: {
    icon: CheckCircle2,
    colorClass: "text-green-500",
    label: "Ready",
  },
  warning: {
    icon: AlertCircle,
    colorClass: "text-yellow-500",
    label: "Missing properties",
  },
  error: {
    icon: XCircle,
    colorClass: "text-red-500",
    label: "Not available",
  },
  loading: {
    icon: Loader2,
    colorClass: "text-muted-foreground",
    label: "Checking...",
  },
  unknown: {
    icon: AlertCircle,
    colorClass: "text-muted-foreground",
    label: "Unknown",
  },
};

export function OperationStatusIndicator({
  status,
  className,
  size = "md",
}: OperationStatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Icon
      className={cn(
        sizeClass,
        config.colorClass,
        status === "loading" && "animate-spin",
        className
      )}
      aria-label={config.label}
    />
  );
}

/**
 * Simple dot indicator for compact displays.
 */
export function OperationStatusDot({
  status,
  className,
}: {
  status: OperationStatus;
  className?: string;
}) {
  const colorClass = {
    ready: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
    loading: "bg-muted-foreground animate-pulse",
    unknown: "bg-muted-foreground",
  }[status];

  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", colorClass, className)}
      aria-label={statusConfig[status].label}
    />
  );
}

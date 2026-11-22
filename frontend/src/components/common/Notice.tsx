import type { ReactNode } from "react"
import { TriangleAlert, Info } from "lucide-react"

import { cn } from "@/lib/utils"

interface NoticeProps {
  /** "warning" is amber, never red: red and green are reserved for the tone verdict. */
  variant?: "warning" | "info"
  title?: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}

export function Notice({ variant = "warning", title, children, action, className }: NoticeProps) {
  const Icon = variant === "warning" ? TriangleAlert : Info
  return (
    <div
      role={variant === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        variant === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-border bg-muted/50 text-foreground",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", variant === "warning" ? "text-amber-600" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={variant === "warning" ? "text-amber-900" : "text-muted-foreground"}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

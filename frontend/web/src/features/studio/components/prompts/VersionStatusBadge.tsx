"use client"

import React from "react"
import { Badge } from "@/components/ui/Badge"
import type { VersionStatus } from "../../types"

const STATUS_MAP: Record<VersionStatus, { label: string; variant: "default" | "outline" | "success" | "warning" | "danger" }> = {
  draft: { label: "Draft", variant: "outline" },
  in_review: { label: "In Review", variant: "warning" },
  shadow: { label: "Shadow", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  production: { label: "Production", variant: "success" },
  rolled_back: { label: "Rolled Back", variant: "danger" },
}

export function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.draft
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

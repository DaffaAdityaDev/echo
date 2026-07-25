"use client"

import { useStudioDashboard, StudioDashboard } from "@/features/studio"

export default function StudioRoute() {
  const dashboard = useStudioDashboard()
  return <StudioDashboard {...dashboard} />
}

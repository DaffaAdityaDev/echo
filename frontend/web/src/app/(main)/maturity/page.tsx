"use client"

import { useMaturityPage, MaturityDashboard } from "@/features/studio"

export default function MaturityRoute() {
  const props = useMaturityPage()
  return <MaturityDashboard {...props} />
}

"use client"

import { useShadowPage, ShadowDashboard } from "@/features/studio"

export default function ShadowRoute() {
  const props = useShadowPage()
  return <ShadowDashboard {...props} />
}

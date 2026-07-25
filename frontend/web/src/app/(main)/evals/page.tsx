"use client"

import { useEvalSuite, EvalDashboard } from "@/features/studio"

export default function EvalsRoute() {
  const props = useEvalSuite()
  return <EvalDashboard {...props} />
}

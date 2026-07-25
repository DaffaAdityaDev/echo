"use client"

import { useState } from "react"

export function useShadowTest() {
  const [trafficPct, setTrafficPct] = useState(0)

  return {
    trafficPct,
    setTrafficPct,
  }
}

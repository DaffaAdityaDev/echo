"use client"

import { usePlayground, PlaygroundPage } from "@/features/studio"

export default function PlaygroundRoute() {
  const props = usePlayground()
  return <PlaygroundPage {...props} />
}

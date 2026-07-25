"use client"

import { usePromptLibrary, PromptsPage } from "@/features/studio"

export default function PromptsRoute() {
  const props = usePromptLibrary()
  return <PromptsPage {...props} />
}

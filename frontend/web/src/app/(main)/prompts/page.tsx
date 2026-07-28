"use client";

import { PromptsPage, usePromptLibrary } from "@/features/studio";

export default function PromptsRoute() {
  const props = usePromptLibrary();
  return <PromptsPage {...props} />;
}

"use client";

import { PlaygroundPage, usePlayground } from "@/features/studio";

export default function PlaygroundRoute() {
  const props = usePlayground();
  return <PlaygroundPage {...props} />;
}

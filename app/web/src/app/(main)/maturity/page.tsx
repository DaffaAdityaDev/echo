"use client";

import { MaturityDashboard, useMaturityPage } from "@/features/studio";

export default function MaturityRoute() {
  const props = useMaturityPage();
  return <MaturityDashboard {...props} />;
}

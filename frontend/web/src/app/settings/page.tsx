"use client";

import { AuthGuard } from "@/features/auth";
import { SettingsPage, useSettingsPage } from "@/features/settings";

export default function SettingsRoute() {
  const settings = useSettingsPage();
  return (
    <AuthGuard>
      <SettingsPage {...settings} />
    </AuthGuard>
  );
}

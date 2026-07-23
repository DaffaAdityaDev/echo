"use client";

import { useSettingsPage, SettingsPage } from "@/features/settings";
import { AuthGuard } from "@/features/auth";

export default function SettingsRoute() {
  const settings = useSettingsPage();
  return (
    <AuthGuard>
      <SettingsPage {...settings} />
    </AuthGuard>
  );
}

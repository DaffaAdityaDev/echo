"use client";

import { useSettingsPage } from "@/features/settings/hooks/useSettingsPage";
import { SettingsPage } from "@/features/settings/components/SettingsPage";

export default function SettingsRoute() {
  const settings = useSettingsPage();
  return <SettingsPage {...settings} />;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function StudioRoute() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}

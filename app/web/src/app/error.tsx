"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center min-h-[400px] gap-4 p-6 text-center">
      <div className="w-12 h-12 bg-danger/10 border border-danger/20 rounded-md flex items-center justify-center">
        <AlertCircle className="text-danger" size={24} aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted max-w-sm">
          {error.message || "An unexpected error occurred while processing your request."}
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={() => reset()}>
        <RefreshCcw size={14} aria-hidden="true" />
        <span>Try again</span>
      </Button>
    </div>
  );
}

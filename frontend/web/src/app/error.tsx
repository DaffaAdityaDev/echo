"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center">
      <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
        <AlertCircle className="text-red-500" size={24} />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Something went wrong!</h2>
        <p className="text-white/40 max-w-sm">{error.message || "An unexpected error occurred while processing your request."}</p>
      </div>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10"
      >
        <RefreshCcw size={16} />
        <span>Try again</span>
      </button>
    </div>
  );
}

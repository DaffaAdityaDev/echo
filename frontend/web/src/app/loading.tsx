import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loader2 className="animate-spin text-blue-500" size={32} />
      <p className="text-white/40 text-sm font-medium animate-pulse">Initializing Interface…</p>
    </div>
  );
}

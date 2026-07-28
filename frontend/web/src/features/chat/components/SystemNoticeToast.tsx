"use client";
import { useEffect } from "react";
import { X, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { useChatStore } from "../stores/chatStore";

export function SystemNoticeToast() {
  const notices = useChatStore((s) => s.systemNotices);
  const dismiss = useChatStore((s) => s.dismissSystemNotice);

  useEffect(() => {
    if (notices.length === 0) return;
    const latest = notices[notices.length - 1];
    const timer = setTimeout(() => dismiss(latest.id), 8000);
    return () => clearTimeout(timer);
  }, [notices, dismiss]);

  const visible = notices.slice(-3);

  const levelStyles: Record<string, string> = {
    info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    error: "bg-red-500/10 border-red-500/30 text-red-400",
  };

  const levelIcons: Record<string, typeof Info> = {
    info: Info,
    warning: AlertTriangle,
    error: AlertCircle,
  };

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {visible.map((notice) => {
        const Icon = levelIcons[notice.level] || Info;
        return (
          <div
            key={notice.id}
            className={`flex items-start gap-3 p-3 rounded-xl border backdrop-blur-md shadow-xl animate-in slide-in-from-right ${levelStyles[notice.level] || levelStyles.info}`}
          >
            <Icon size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase">{notice.code}</p>
              <p className="text-xs opacity-80 mt-0.5">{notice.message}</p>
            </div>
            <button
              onClick={() => dismiss(notice.id)}
              className="p-0.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

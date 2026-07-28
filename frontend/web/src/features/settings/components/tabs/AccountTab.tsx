"use client";

import Link from "next/link";
import { Key, LogOut } from "lucide-react";

interface AccountTabProps {
  user: { email?: string; role?: string } | null;
  logout: () => void;
  onClose: () => void;
}

export function AccountTab({ user, logout, onClose }: AccountTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
            {user?.email ? user.email[0].toUpperCase() : "U"}
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
              {user?.email || "Guest Account"}
            </h4>
            <p className="text-xs text-zinc-400">
              Role: <span className="font-semibold text-purple-500 uppercase">{user?.role || "User"}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <Link
          href="/admin/api-keys"
          onClick={onClose}
          className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 hover:border-purple-500/40 transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-zinc-900 dark:text-white">Developer API Keys</h5>
            <p className="text-[11px] text-zinc-400">Manage credentials & scopes</p>
          </div>
        </Link>

        <button
          onClick={() => { logout(); onClose(); }}
          className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all flex items-center gap-3 text-left cursor-pointer"
        >
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-red-500">Sign Out</h5>
            <p className="text-[11px] text-red-400/70">Terminate active session</p>
          </div>
        </button>
      </div>
    </div>
  );
}

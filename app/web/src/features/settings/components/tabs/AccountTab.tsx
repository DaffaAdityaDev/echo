"use client";

import { LogOut } from "lucide-react";

interface AccountTabProps {
  user: { email?: string; role?: string } | null;
  logout: () => void;
  onClose: () => void;
}

export function AccountTab({ user, logout, onClose }: AccountTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-md border border-border bg-surface space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-gb-dark-blue flex items-center justify-center text-primary-foreground font-bold text-sm"
            aria-hidden="true"
          >
            {user?.email ? user.email[0].toUpperCase() : "U"}
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">{user?.email || "Guest Account"}</h4>
            <p className="text-xs text-muted">
              Role: <span className="font-semibold text-accent uppercase">{user?.role || "User"}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            logout();
            onClose();
          }}
          className="p-4 rounded-md border border-danger/20 bg-danger/5 hover:bg-danger/10 transition-all flex items-center gap-3 text-left cursor-pointer"
        >
          <span className="p-2.5 rounded-md bg-danger/10 text-danger">
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xs font-bold text-danger">Sign Out</span>
            <span className="block text-xs text-danger/80">Terminate active session</span>
          </span>
        </button>
      </div>
    </div>
  );
}

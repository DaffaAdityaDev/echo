"use client";

import React from "react";
import { ApiKeyList } from "./ApiKeyList";
import { CreateKeyModal } from "./CreateKeyModal";
import { KeyDisplay } from "./KeyDisplay";
import { Button } from "@/components/ui/Button";
import { Plus, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ApiKey } from "../types";

interface AdminApiKeysPageProps {
  keys: ApiKey[];
  isLoading: boolean;
  error: Error | null;
  createKey: (data: { name: string; scopes: string[] }) => Promise<ApiKey>;
  isCreating: boolean;
  createdKey: ApiKey | null | undefined;
  resetCreate: () => void;
  revokeKey: (id: string) => Promise<void>;
  isRevoking: boolean;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  handleCreateSubmit: (data: { name: string; scopes: string[] }) => Promise<void>;
  handleCloseDisplay: () => void;
}

export function AdminApiKeysPage({
  keys,
  isLoading,
  error,
  isCreating,
  createdKey,
  revokeKey,
  isRevoking,
  isModalOpen,
  setIsModalOpen,
  handleCreateSubmit,
  handleCloseDisplay,
}: AdminApiKeysPageProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-red-500/20 bg-red-500/5 rounded-xl text-center max-w-lg mx-auto mt-12">
        <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
        <h4 className="text-zinc-200 font-semibold mb-1">Failed to load API keys</h4>
        <p className="text-xs text-zinc-500">
          {error?.message || "An unexpected error occurred while fetching system API credentials."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-zinc-100">
            API Keys
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage authorization tokens for accessing the Echo orchestrator services programmatically.
          </p>
        </div>
        {!createdKey && (
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 self-start sm:self-auto shrink-0"
          >
            <Plus size={16} />
            Create API Key
          </Button>
        )}
      </div>

      {/* Created Key Display Alert */}
      {createdKey?.key && (
        <div className="max-w-xl">
          <KeyDisplay 
            apiKey={createdKey.key} 
            onClose={handleCloseDisplay} 
          />
        </div>
      )}

      {/* Main List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full bg-zinc-800" />
            <Skeleton className="h-16 w-full bg-zinc-800" />
            <Skeleton className="h-16 w-full bg-zinc-800" />
          </div>
        ) : (
          <ApiKeyList 
            keys={keys} 
            onRevoke={revokeKey} 
            isRevoking={isRevoking} 
          />
        )}
      </div>

      {/* Modal Dialog */}
      <CreateKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isSubmitting={isCreating}
      />
    </div>
  );
}

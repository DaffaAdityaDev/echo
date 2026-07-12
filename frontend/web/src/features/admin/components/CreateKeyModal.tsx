"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { X, Shield } from "lucide-react";

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; scopes: string[] }) => Promise<void>;
  isSubmitting: boolean;
}

const AVAILABLE_SCOPES = [
  { id: "read:chat", name: "Read Chat", description: "Allows reading chat sessions and logs" },
  { id: "write:chat", name: "Write Chat", description: "Allows sending chat messages and starting sessions" },
  { id: "read:models", name: "Read Models", description: "Allows listing available LLM models" },
  { id: "admin", name: "Full Admin", description: "Complete access, including key administration" },
];

export function CreateKeyModal({ isOpen, onClose, onSubmit, isSubmitting }: CreateKeyModalProps) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read:chat"]);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleScopeToggle = (scopeId: string) => {
    if (selectedScopes.includes(scopeId)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scopeId));
    } else {
      setSelectedScopes([...selectedScopes, scopeId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Key name is required");
      return;
    }
    setError("");
    try {
      await onSubmit({ name, scopes: selectedScopes });
      setName("");
      setSelectedScopes(["read:chat"]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl z-10 animate-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold text-zinc-100 mb-2 font-display flex items-center gap-2">
          <Shield size={18} className="text-blue-500" />
          Create API Key
        </h3>
        <p className="text-xs text-zinc-400 mb-6">
          Generate a new key to authenticate programmatically with the Echo API.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Key Name
            </label>
            <Input
              type="text"
              placeholder="e.g. Production Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Scopes
            </label>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {AVAILABLE_SCOPES.map((scope) => {
                const checked = selectedScopes.includes(scope.id);
                return (
                  <div
                    key={scope.id}
                    onClick={() => handleScopeToggle(scope.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                      checked
                        ? "border-blue-500/50 bg-blue-500/5"
                        : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}} // toggled by parent div click
                      className="mt-1 rounded border-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 bg-transparent"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-100">{scope.name}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{scope.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Generate Key
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

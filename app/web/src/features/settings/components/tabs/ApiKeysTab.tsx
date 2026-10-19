"use client";

import { Check, Copy, Key, Loader2, Plus, RefreshCcw, ShieldAlert, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";
import { useApiKeys } from "../../hooks/useApiKeys";
import type { ApiKey } from "../../types/apiKey";

const CREATED_DATE_FORMAT: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function ApiKeysTab() {
  const { keys, status, reload, create, revoke } = useApiKeys();
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleCreate = async (name: string) => {
    try {
      setCreatedKey(await create(name));
      setIsCreating(false);
      showToast("API Key generated successfully!", "success");
    } catch (err: unknown) {
      showToast(errorMessage(err, "Failed to create API key"), "error");
    }
  };

  const handleRevoke = async (key: ApiKey) => {
    const confirmed = window.confirm(
      `Are you sure you want to revoke API key "${key.name}"? External apps using this key will immediately lose access.`,
    );
    if (!confirmed) return;

    try {
      await revoke(key.id);
      showToast("API Key revoked", "success");
    } catch (err: unknown) {
      showToast(errorMessage(err, "Failed to revoke API key"), "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md border border-border bg-surface">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-md bg-accent/10 border border-accent/20 text-accent shrink-0">
            <Key className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Developer API Keys</h3>
            <p className="text-xs text-muted">
              Authenticate external applications (like KataraGnosis or CLI) to access Echo agents.
            </p>
          </div>
        </div>

        <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5 text-xs font-semibold shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Create Key</span>
        </Button>
      </div>

      {createdKey && <CreatedKeyNotice secret={createdKey} onDismiss={() => setCreatedKey(null)} />}

      {isCreating && <CreateKeyForm onSubmit={handleCreate} onCancel={() => setIsCreating(false)} />}

      <section className="space-y-3" aria-labelledby="api-keys-list-heading">
        <h3 id="api-keys-list-heading" className="text-xs font-bold uppercase tracking-wider text-muted">
          Active Keys ({keys.filter((k) => k.status === "active").length})
        </h3>

        <ApiKeyList keys={keys} status={status} onRetry={reload} onRevoke={handleRevoke} />
      </section>
    </div>
  );
}

interface ApiKeyListProps {
  keys: ApiKey[];
  status: ReturnType<typeof useApiKeys>["status"];
  onRetry: () => void;
  onRevoke: (key: ApiKey) => void;
}

function ApiKeyList({ keys, status, onRetry, onRevoke }: ApiKeyListProps) {
  if (status === "loading") {
    return (
      <div role="status" className="py-8 text-center text-xs text-muted flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
        <span>Loading API keys...</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="p-6 text-center rounded-md border border-danger/30 bg-danger/5 space-y-3 flex flex-col items-center"
      >
        <p className="text-xs font-medium text-danger">Failed to load API keys.</p>
        <Button size="sm" variant="secondary" onClick={onRetry} className="gap-1.5 text-xs">
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="p-8 text-center rounded-md border border-dashed border-border-strong text-muted space-y-2">
        <Key className="h-8 w-8 mx-auto text-subtle" aria-hidden="true" />
        <p className="text-xs font-medium text-foreground">No API keys created yet</p>
        <p className="text-xs text-muted">Create a secret key to connect external tools and background services.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border overflow-hidden bg-elevated">
      {keys.map((k) => (
        <ApiKeyRow key={k.id} apiKey={k} onRevoke={onRevoke} />
      ))}
    </ul>
  );
}

function ApiKeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (key: ApiKey) => void }) {
  const isRevoked = apiKey.status === "revoked";
  const name = apiKey.name || "Untitled Key";
  const createdDate = new Date(apiKey.created_at).toLocaleDateString("id-ID", CREATED_DATE_FORMAT);

  return (
    <li
      className={cn(
        "p-4 flex items-center justify-between gap-4 transition-colors",
        isRevoked ? "opacity-60 bg-surface" : "hover:bg-surface",
      )}
    >
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground truncate">{name}</span>
          <span
            className={cn(
              "text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
              isRevoked ? "bg-danger/10 text-danger border-danger/20" : "bg-success/10 text-success border-success/20",
            )}
          >
            {apiKey.status}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted font-mono">
          <span>{apiKey.prefix}...</span>
          <span aria-hidden="true">•</span>
          <span>Created {createdDate}</span>
        </div>
      </div>

      {!isRevoked && (
        <button
          type="button"
          onClick={() => onRevoke(apiKey)}
          className="p-2 rounded-sm text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
          aria-label={`Revoke key ${name}`}
          title="Revoke key"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

function CreatedKeyNotice({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const { copied, copy } = useCopyToClipboard(2500);
  const { showToast } = useToast();

  const handleCopy = async () => {
    const ok = await copy(secret);
    showToast(
      ok ? "Secret key copied to clipboard!" : "Could not copy the key. Select it and copy manually.",
      ok ? "success" : "error",
    );
  };

  return (
    <div role="alert" className="p-5 rounded-md border border-warning/30 bg-warning/5 space-y-4 animate-in fade-in">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-warning/10 text-warning shrink-0">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-warning">Save Your Secret Key Now</h3>
          <p className="text-xs text-foreground">
            Please copy this secret key and store it securely (e.g. in your application environment variable). For your
            security, you will not be able to view it again.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-md border border-border bg-elevated">
        <code className="flex-1 font-mono text-xs text-foreground select-all overflow-x-auto px-2">{secret}</code>
        <Button size="sm" variant="secondary" onClick={handleCopy} className="gap-1.5 text-xs font-semibold shrink-0">
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className={copied ? "text-success" : undefined}>{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onDismiss} className="text-xs text-muted hover:text-foreground">
          I have saved my key
        </Button>
      </div>
    </div>
  );
}

function CreateKeyForm({ onSubmit, onCancel }: { onSubmit: (name: string) => Promise<void>; onCancel: () => void }) {
  const [keyName, setKeyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const trimmed = keyName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="create-key-heading"
      className="p-4 rounded-md border border-accent/30 bg-accent/5 space-y-3 animate-in fade-in"
    >
      <h3 id="create-key-heading" className="text-xs font-bold uppercase tracking-wider text-accent">
        Generate New Secret Key
      </h3>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="keyNameInput" className="text-xs font-medium text-foreground">
          Key Name / Description
        </label>
        <input
          id="keyNameInput"
          type="text"
          required
          placeholder="e.g. KataraGnosis Integration, CLI Tool"
          value={keyName}
          onChange={(e) => setKeyName(e.target.value)}
          className="w-full px-3.5 py-2 text-xs rounded-sm border border-border bg-elevated text-foreground placeholder:text-subtle focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs">
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!trimmed}
          isLoading={submitting}
          className="gap-1.5 text-xs font-semibold"
        >
          {!submitting && <Key className="h-3.5 w-3.5" aria-hidden="true" />}
          <span>Generate Key</span>
        </Button>
      </div>
    </form>
  );
}

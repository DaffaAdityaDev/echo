"use client";

import { Badge } from "@/components/ui/Badge";
import { CHAT_MODES } from "@/features/chat/constants";
import { cn } from "@/utils/cn";
import type { AgentConfig } from "../../types";

interface PreferencesTabProps {
  config: AgentConfig;
  setConfig: (partial: Partial<AgentConfig>) => void;
  groupedModels: Record<string, { id: string; name: string; provider_name: string }[]>;
}

export function PreferencesTab({ config, setConfig, groupedModels }: PreferencesTabProps) {
  return (
    <>
      <div className="space-y-3">
        <p className="text-xs font-bold text-foreground uppercase tracking-wider block">Default Execution Strategy</p>
        <div className="grid grid-cols-2 gap-3">
          {([CHAT_MODES.STANDARD, CHAT_MODES.AGENT] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setConfig({ defaultMode: value })}
              aria-pressed={config.defaultMode === value}
              className={cn(
                "p-4 rounded-md text-left border transition-all text-xs font-medium flex flex-col gap-1 cursor-pointer",
                config.defaultMode === value
                  ? "bg-accent/10 border-accent/30 text-accent shadow-sm"
                  : "bg-surface border-border text-muted hover:bg-surface-hover",
              )}
            >
              <div className="flex items-center justify-between font-bold capitalize text-sm">
                <span>{value === "standard" ? "Standard Stream" : "Deeper Research"}</span>
                {config.defaultMode === value && (
                  <Badge variant="success" className="text-2xs">
                    Active
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted font-normal">
                {value === "standard"
                  ? "Direct model completion streaming."
                  : "Multi-step iterative agent execution harness."}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label
          htmlFor="default-model-select"
          className="text-xs font-bold text-foreground uppercase tracking-wider block"
        >
          Default Model
        </label>
        <select
          id="default-model-select"
          value={config.defaultModel}
          onChange={(e) => setConfig({ defaultModel: e.target.value })}
          className="w-full bg-surface border border-border rounded-md px-4 py-3 text-xs text-foreground focus:outline-none focus:border-accent/50"
        >
          <option value="">Auto-select first available</option>
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <optgroup key={provider} label={provider}>
              {providerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-xs font-bold text-foreground uppercase tracking-wider block">LLM Provider Configuration</p>

        <select
          value={config.providerType}
          aria-label="LLM provider"
          onChange={(e) => setConfig({ providerType: e.target.value })}
          className="w-full bg-surface border border-border rounded-md px-4 py-3 text-xs text-foreground focus:outline-none focus:border-accent/50"
        >
          <option value="opencode-go">OpenCode Go</option>
          <option value="lm-studio">LM Studio (Local)</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>

        <div className="flex items-center justify-between">
          <label htmlFor="api-key-input" className="text-xs font-medium text-muted">
            API Key
          </label>
          <span
            className={cn(
              "text-2xs font-semibold px-2 py-0.5 rounded-full",
              config.hasApiKey
                ? "bg-success/10 text-success border border-success/20"
                : "bg-surface-hover text-muted border border-border",
            )}
          >
            {config.hasApiKey ? "Active" : "Not Set"}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            id="api-key-input"
            type="password"
            autoComplete="new-password"
            value={config.apiKey}
            onChange={(e) => setConfig({ apiKey: e.target.value })}
            placeholder={config.hasApiKey ? "Enter new key to change" : "Enter your API key"}
            className="flex-1 bg-surface border border-border rounded-md px-4 py-3 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50"
          />
          {config.hasApiKey && (
            <button
              type="button"
              onClick={() => setConfig({ apiKey: "" })}
              className="px-3 py-2 rounded-md bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 text-xs font-medium transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <label htmlFor="base-url-input" className="text-xs font-medium text-muted">
          Base URL
        </label>
        <input
          id="base-url-input"
          type="text"
          value={config.baseUrl}
          onChange={(e) => setConfig({ baseUrl: e.target.value })}
          placeholder="https://..."
          className="w-full bg-surface border border-border rounded-md px-4 py-3 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50 font-mono"
        />

        <div
          className={cn(
            "p-3 rounded-md border text-xs leading-relaxed",
            config.providerType === "opencode-go"
              ? "bg-warning/5 border-warning/20 text-warning"
              : config.providerType === "lm-studio"
                ? "bg-accent/5 border-accent/20 text-accent"
                : "bg-surface border-border text-muted",
          )}
        >
          {config.providerType === "opencode-go" && (
            <>
              API Key for OpenCode Go <span className="font-semibold">is required</span> to use this provider.
            </>
          )}
          {config.providerType === "lm-studio" && (
            <>
              Use a <span className="font-semibold">local IP</span> (e.g. http://192.168.1.10:1234/v1) if the backend
              runs on a cloud server.
            </>
          )}
          {config.providerType === "openai" && (
            <>Leave empty to use the server API key. The key is encrypted (AES-256-GCM).</>
          )}
          {config.providerType === "anthropic" && (
            <>Leave empty to use the server API key. The key is encrypted (AES-256-GCM).</>
          )}
        </div>
      </div>
    </>
  );
}

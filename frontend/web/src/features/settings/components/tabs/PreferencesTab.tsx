"use client";

import { Badge } from "@/components/ui/Badge";
import { CHAT_MODES } from "@/features/chat/constants";
import { cn } from "@/utils/cn";
import type { AgentConfig } from "../../types";

interface PreferencesTabProps {
  config: AgentConfig;
  setConfig: (partial: Partial<AgentConfig>) => void;
  groupedModels: Record<string, { id: string; name: string; provider_name: string }[]>;
  handleModeChange: (value: string) => void;
  handleModelChange: (value: string) => void;
  handleProviderTypeChange: (value: string) => void;
  handleApiKeyChange: (value: string) => void;
  handleBaseUrlChange: (value: string) => void;
}

export function PreferencesTab({
  config,
  setConfig,
  groupedModels,
  handleModeChange,
  handleModelChange,
  handleProviderTypeChange,
  handleApiKeyChange,
  handleBaseUrlChange,
}: PreferencesTabProps) {
  return (
    <>
      <div className="space-y-3">
        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
          Default Execution Strategy
        </label>
        <div className="grid grid-cols-2 gap-3">
          {([CHAT_MODES.STANDARD, CHAT_MODES.AGENT] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleModeChange(value)}
              className={cn(
                "p-4 rounded-2xl text-left border transition-all text-xs font-medium flex flex-col gap-1 cursor-pointer",
                config.defaultMode === value
                  ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900",
              )}
            >
              <div className="flex items-center justify-between font-bold capitalize text-sm">
                <span>{value === "standard" ? "Standard Stream" : "Deeper Research"}</span>
                {config.defaultMode === value && (
                  <Badge variant="success" className="text-[10px]">
                    Active
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
                {value === "standard"
                  ? "Direct model completion streaming."
                  : "Multi-step iterative agent execution harness."}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
          Default Model
        </label>
        <select
          value={config.defaultModel}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-purple-500/50"
          style={{ colorScheme: "dark" }}
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
        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
          LLM Provider Configuration
        </label>

        <select
          value={config.providerType}
          onChange={(e) => handleProviderTypeChange(e.target.value)}
          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-purple-500/50"
          style={{ colorScheme: "dark" }}
        >
          <option value="opencode-go">OpenCode Go</option>
          <option value="lm-studio">LM Studio (Local)</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">API Key</label>
          <span
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full",
              config.hasApiKey
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700",
            )}
          >
            {config.hasApiKey ? "Active" : "Not Set"}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder={config.hasApiKey ? "Enter new key to change" : "Enter your API key"}
            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-purple-500/50"
          />
          {config.hasApiKey && (
            <button
              type="button"
              onClick={() => handleApiKeyChange("")}
              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 text-xs font-medium transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Base URL</label>
        <input
          type="text"
          value={config.baseUrl}
          onChange={(e) => handleBaseUrlChange(e.target.value)}
          placeholder="https://..."
          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 font-mono"
        />

        <div
          className={cn(
            "p-3 rounded-xl border text-[11px] leading-relaxed",
            config.providerType === "opencode-go"
              ? "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-300"
              : config.providerType === "lm-studio"
                ? "bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-300"
                : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400",
          )}
        >
          {config.providerType === "opencode-go" && (
            <>
              API Key OpenCode Go <span className="font-semibold">wajib diisi</span> untuk menggunakan provider ini.
            </>
          )}
          {config.providerType === "lm-studio" && (
            <>
              Gunakan <span className="font-semibold">IP lokal</span> (contoh: http://192.168.1.10:1234/v1) jika backend
              di server cloud.
            </>
          )}
          {config.providerType === "openai" && (
            <>Kosongkan untuk menggunakan API Key server. Key akan dienkripsi (AES-256-GCM).</>
          )}
          {config.providerType === "anthropic" && (
            <>Kosongkan untuk menggunakan API Key server. Key akan dienkripsi (AES-256-GCM).</>
          )}
        </div>
      </div>
    </>
  );
}

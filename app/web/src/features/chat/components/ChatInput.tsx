"use client";

import { Globe, Paperclip, Send, Sliders, Sparkles, Square, X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { cn } from "@/utils/cn";
import { CHAT_MODES } from "../constants";
import { usePersistAgentConfig } from "../hooks/usePersistAgentConfig";
import { checkTextAttachment, composeMessage, type TextAttachment } from "../lib/text-attachment";
import { notifySystem } from "../services/system-notice";
import { useChatStore } from "../stores/chatStore";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
  onOpenSettings: () => void;
}

export function ChatInput({ onSend, onStop, isLoading, onOpenSettings }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<TextAttachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mode = useSettingsStore((s) => s.config.defaultMode);
  const selectedFeatures = useSettingsStore((s) => s.config.defaultFeatures);
  const activeSessionId = useChatStore((s) => s.activeSessionId);

  const isWebSearchActive = selectedFeatures.includes("web_search");

  const persistConfig = usePersistAgentConfig();

  const toggleMode = () => {
    void persistConfig({ defaultMode: mode === CHAT_MODES.AGENT ? CHAT_MODES.STANDARD : CHAT_MODES.AGENT });
  };

  const toggleWebSearch = () => {
    const nextFeatures = isWebSearchActive
      ? selectedFeatures.filter((f) => f !== "web_search")
      : [...selectedFeatures, "web_search"];

    void persistConfig({ defaultFeatures: nextFeatures });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file) return;

    const check = checkTextAttachment(file);

    if (!check.ok) {
      notifySystem("warning", "ATTACHMENT_REJECTED", check.reason);

      return;
    }

    try {
      setAttachment({ name: file.name, content: await file.text() });
    } catch {
      notifySystem("error", "ATTACHMENT_READ_FAILED", `Could not read "${file.name}".`);
    }
  };

  const adjustHeight = () => {
    const el = textareaRef.current;

    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = (input.trim() !== "" || attachment !== null) && !isLoading;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!canSend) return;
    onSend(composeMessage(input, attachment));
    setInput("");
    setAttachment(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const isAgentMode = mode === CHAT_MODES.AGENT;

  return (
    <div className="w-full max-w-5xl mx-auto">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" tabIndex={-1} />

      <form
        onSubmit={handleSubmit}
        className="bg-elevated border border-border rounded-md p-3 sm:p-4 shadow-md space-y-3 transition-all focus-within:border-accent focus-within:ring-1 focus-within:ring-accent font-mono"
      >
        {attachment && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-sm bg-accent-soft border border-accent/30 text-xs font-semibold text-accent">
            <span className="truncate">Attached: {attachment.name}</span>
            <button
              type="button"
              aria-label={`Remove attachment ${attachment.name}`}
              onClick={() => setAttachment(null)}
              className="p-0.5 rounded-sm hover:bg-accent/15 cursor-pointer shrink-0"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={2}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          aria-label="Message"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent border-none outline-none text-sm text-foreground font-mono placeholder:text-subtle focus:ring-0 resize-none max-h-[180px] overflow-y-auto"
        />

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={toggleMode}
              disabled={!activeSessionId}
              title="Toggle chat mode"
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-sm text-2xs font-bold transition-all border cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed",
                isAgentMode
                  ? "bg-accent-soft border-accent/40 text-accent shadow-xs"
                  : "bg-surface border-border text-muted hover:text-foreground hover:bg-surface-hover",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Mode: </span>
              <span className="sr-only sm:not-sr-only">{isAgentMode ? "Deeper Research" : "Standard"}</span>
            </button>

            <button
              type="button"
              onClick={toggleWebSearch}
              disabled={!activeSessionId}
              aria-pressed={isWebSearchActive}
              aria-label="Web search"
              title={isWebSearchActive ? "Web Search Active" : "Enable Web Search"}
              className={cn(
                "p-1.5 rounded-sm transition-colors border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                isWebSearchActive
                  ? "bg-accent-soft border-accent/30 text-accent"
                  : "bg-transparent border-transparent text-muted hover:text-foreground hover:bg-surface-hover",
              )}
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 rounded-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors border border-transparent cursor-pointer"
              title="Harness Settings"
              aria-label="Harness settings"
            >
              <Sliders className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-sm border border-border text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-all cursor-pointer"
            >
              <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Attach file</span>
            </button>

            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generating"
                aria-label="Stop generating"
                className="p-2 rounded-sm transition-all shrink-0 cursor-pointer bg-danger text-background hover:bg-danger/90 shadow-md"
              >
                <Square className="h-4 w-4 fill-current" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send message"
                title="Send message"
                className={cn(
                  "p-2 rounded-sm transition-all shrink-0",
                  canSend
                    ? "bg-primary text-primary-foreground hover:bg-primary-hover shadow-md cursor-pointer"
                    : "bg-surface-hover text-subtle cursor-not-allowed",
                )}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

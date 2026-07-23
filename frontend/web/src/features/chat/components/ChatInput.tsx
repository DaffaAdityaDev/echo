"use client";

import React, { useState, useRef } from "react";
import { Send, Loader2, Sparkles, Paperclip, Globe, Sliders, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { useChatStore } from "../stores/chatStore";
import { CHAT_MODES } from "../constants";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mode, setMode, selectedFeatures, setSelectedFeatures } = useChatStore();

  const isWebSearchActive = selectedFeatures.includes("web_search");

  const toggleWebSearch = () => {
    if (isWebSearchActive) {
      setSelectedFeatures(selectedFeatures.filter((f) => f !== "web_search"));
    } else {
      setSelectedFeatures([...selectedFeatures, "web_search"]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setInput((prev) =>
          prev
            ? `${prev}\n\n[Attached File: ${file.name}]\n${content}`
            : `[Attached File: ${file.name}]\n${content}`
        );
      };
      reader.readAsText(file);
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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
    setAttachedFileName(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-3 transition-all focus-within:border-purple-500/40 focus-within:ring-2 focus-within:ring-purple-500/10"
      >
        {attachedFileName && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs font-medium text-purple-600 dark:text-purple-400">
            <span>Attached: {attachedFileName}</span>
            <button
              type="button"
              onClick={() => setAttachedFileName(null)}
              className="p-0.5 hover:bg-purple-500/20 rounded"
            >
              <X className="h-3 w-3" />
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
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent border-none outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:ring-0 resize-none max-h-[180px] overflow-y-auto"
        />

        {/* Input Bar Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {/* Mode Toggle Pill */}
            <button
              type="button"
              onClick={() =>
                setMode(
                  mode === CHAT_MODES.AGENT ? CHAT_MODES.STANDARD : CHAT_MODES.AGENT
                )
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer",
                mode === CHAT_MODES.AGENT
                  ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{mode === CHAT_MODES.AGENT ? "Deeper Research" : "Standard"}</span>
            </button>

            {/* Quick Feature Pills */}
            <button
              type="button"
              onClick={toggleWebSearch}
              className={cn(
                "p-1.5 rounded-lg transition-colors border cursor-pointer",
                isWebSearchActive
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                  : "bg-transparent border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
              title={isWebSearchActive ? "Web Search Active" : "Enable Web Search"}
            >
              <Globe className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-transparent"
              title="Harness Settings"
            >
              <Sliders className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span>Attach file</span>
            </button>

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={cn(
                "p-2 rounded-full transition-all shrink-0 cursor-pointer",
                input.trim() && !isLoading
                  ? "bg-purple-600 text-white hover:bg-purple-500 shadow-md shadow-purple-600/20"
                  : "bg-purple-600/20 text-purple-400/50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

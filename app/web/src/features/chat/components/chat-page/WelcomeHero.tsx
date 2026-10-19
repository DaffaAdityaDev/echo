"use client";

import { FileText, HelpCircle, Languages, Lightbulb, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { ChatInput } from "../ChatInput";

interface WelcomeHeroProps {
  userName: string;
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

const promptSuggestions = [
  {
    title: "Synthesize Data",
    description: "Turn my meeting notes into 5 key bullet points for the team",
    icon: FileText,
    prompt: "Turn my meeting notes into 5 key bullet points for the team:",
  },
  {
    title: "Creative Brainstorm",
    description: "Generate 3 taglines for a new sustainable fashion brand",
    icon: Lightbulb,
    prompt: "Generate 3 taglines for a new sustainable fashion brand",
  },
  {
    title: "Check Facts",
    description: "Compare key differences between GDPR and CCPA compliance",
    icon: ShieldCheck,
    prompt: "Compare key differences between GDPR and CCPA compliance",
  },
];

export function WelcomeHero({ userName, onSend, onStop, isLoading, onOpenHelp, onOpenSettings }: WelcomeHeroProps) {
  const { showToast } = useToast();

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:p-6 md:p-10 flex flex-col justify-between items-center text-center">
      <div className="w-full max-w-5xl my-auto space-y-8 flex flex-col items-center">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center my-2" aria-hidden="true">
          <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl animate-pulse" />
          <svg
            className="w-16 h-16 sm:w-20 sm:h-20 relative z-10 drop-shadow-xl"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="echoOrbGrad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#93C5FD" />
                <stop offset="50%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1E3A8A" />
              </radialGradient>
              <filter id="glowBlur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <circle cx="50" cy="50" r="42" fill="url(#echoOrbGrad)" filter="url(#glowBlur)" />
            <circle cx="38" cy="38" r="14" fill="#FFFFFF" fillOpacity="0.25" />
          </svg>
        </div>

        <div className="space-y-2">
          <p className="text-lg md:text-2xl font-semibold text-accent font-display tracking-tight">Hello, {userName}</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground font-display tracking-section">
            How can I assist you today?
          </h1>
        </div>

        <div className="w-full pt-2">
          <ChatInput onSend={onSend} onStop={onStop} isLoading={isLoading} onOpenSettings={onOpenSettings} />
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-4">
          {promptSuggestions.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                type="button"
                onClick={() => onSend(item.prompt)}
                className="p-4 rounded-md border border-border bg-elevated/80 hover:border-accent/40 hover:bg-elevated transition-all text-left group shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="p-2 w-fit rounded-sm bg-accent-soft text-accent group-hover:scale-105 transition-transform">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-foreground group-hover:text-accent transition-colors">
                    {item.title}
                  </span>
                  <span className="block text-xs text-muted mt-1 leading-relaxed line-clamp-2 font-normal">
                    {item.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-5xl flex items-center justify-between gap-3 pt-6 mt-6 border-t border-border text-xs text-muted">
        <Link href="/docs" className="hover:text-accent transition-colors font-medium text-left">
          Explore Echo Developer Documentation & APIs
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => showToast("System language set to English (US)", "info")}
            className="p-1.5 rounded-sm hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
            title="Language Selector"
            aria-label="Language selector"
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            className="p-1.5 rounded-sm hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
            title="Help & Shortcuts"
            aria-label="Help and keyboard shortcuts"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

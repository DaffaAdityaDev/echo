"use client";

import { FileText, HelpCircle, Languages, Lightbulb, ShieldCheck } from "lucide-react";
import { ChatInput } from "../ChatInput";

interface WelcomeHeroProps {
  userName: string;
  onSend: (message: string) => void;
  isLoading: boolean;
  onOpenHelp: () => void;
  onShowToast: (message: string) => void;
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

export function WelcomeHero({ userName, onSend, isLoading, onOpenHelp, onShowToast }: WelcomeHeroProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col justify-between items-center text-center">
      <div className="w-full max-w-5xl my-auto space-y-8 flex flex-col items-center">
        {/* Pure SVG Ambient Orb Graphic */}
        <div className="relative w-24 h-24 flex items-center justify-center my-2">
          <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-2xl animate-pulse" />
          <svg
            className="w-20 h-20 relative z-10 drop-shadow-xl"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Echo ambient orb</title>
            <defs>
              <radialGradient id="purpleOrbGrad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#C084FC" />
                <stop offset="50%" stopColor="#9333EA" />
                <stop offset="100%" stopColor="#4C1D95" />
              </radialGradient>
              <filter id="glowBlur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <circle cx="50" cy="50" r="42" fill="url(#purpleOrbGrad)" filter="url(#glowBlur)" />
            <circle cx="38" cy="38" r="14" fill="#FFFFFF" fillOpacity="0.25" />
          </svg>
        </div>

        {/* Welcome Typography */}
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-semibold text-purple-600 dark:text-purple-400 font-display tracking-tight">
            Hello, {userName}
          </h2>
          <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 dark:text-white font-display tracking-tight">
            How can I assist you today?
          </h1>
        </div>

        {/* Floating Input Box */}
        <div className="w-full pt-2">
          <ChatInput onSend={onSend} isLoading={isLoading} />
        </div>

        {/* Prompt Suggestion Cards (3-Column Grid) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {promptSuggestions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => onSend(item.prompt)}
                className="p-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 hover:border-purple-500/40 hover:bg-white dark:hover:bg-zinc-900 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="p-2 w-fit rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2 font-normal">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Footer Line */}
      <div className="w-full max-w-5xl flex items-center justify-between pt-6 border-t border-zinc-200/50 dark:border-zinc-800/50 text-[11px] text-zinc-400">
        <a href="/docs" className="hover:text-purple-500 transition-colors font-medium">
          Explore Echo Developer Documentation & APIs
        </a>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onShowToast("System language set to English (US)")}
            className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            title="Language Selector"
          >
            <Languages className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            title="Help & Shortcuts"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

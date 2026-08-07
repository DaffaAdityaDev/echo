"use client";

import { Badge } from "@/components/ui/Badge";
import type { AgentFeature, AgentSkill } from "@/features/shared/types";
import { cn } from "@/utils/cn";
import type { AgentConfig } from "../../types";

interface CapabilitiesTabProps {
  config: AgentConfig;
  features: AgentFeature[];
  skills: AgentSkill[];
  setConfig: (partial: Partial<AgentConfig>) => void;
}

export function CapabilitiesTab({ config, features, skills, setConfig }: CapabilitiesTabProps) {
  const toggleFeature = (id: string) => {
    const next = config.defaultFeatures.includes(id)
      ? config.defaultFeatures.filter((f) => f !== id)
      : [...config.defaultFeatures, id];
    setConfig({ defaultFeatures: next });
  };

  const toggleSkill = (name: string) => {
    const next = config.defaultSkills.includes(name)
      ? config.defaultSkills.filter((s) => s !== name)
      : [...config.defaultSkills, name];
    setConfig({ defaultSkills: next });
  };

  return (
    <>
      <div className="space-y-3">
        <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
          Harness Tool Capabilities
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 -mt-1">
          Checked = capabilities enabled by default for new chats. Unchecked tools are not provided to the agent.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f) => (
            <label
              key={f.id}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 cursor-pointer transition-all hover:border-zinc-400 dark:hover:border-zinc-700",
                f.locked && "opacity-50 cursor-not-allowed",
              )}
            >
              <input
                type="checkbox"
                checked={config.defaultFeatures.includes(f.id)}
                disabled={f.locked}
                onChange={() => toggleFeature(f.id)}
                className="rounded border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-purple-600 focus:ring-0 w-4 h-4 mt-0.5"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 truncate">
                  {f.name}
                  {f.locked && (
                    <Badge variant="warning" className="text-[9px]">
                      PRO
                    </Badge>
                  )}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                  {f.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
          Autoloaded Agent Skills
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {skills.map((s) => (
            <label
              key={s.name}
              className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 cursor-pointer transition-all hover:border-zinc-400 dark:hover:border-zinc-700"
            >
              <input
                type="checkbox"
                checked={config.defaultSkills.includes(s.name)}
                onChange={() => toggleSkill(s.name)}
                className="rounded border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-purple-600 focus:ring-0 w-4 h-4 mt-0.5"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{s.name}</span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                  {s.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

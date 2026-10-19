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
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Harness Tool Capabilities</h3>
        <p className="text-xs text-muted -mt-1">
          Checked = capabilities enabled by default for new chats. Unchecked tools are not provided to the agent.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f) => (
            <label
              key={f.id}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-md border border-border bg-surface cursor-pointer transition-all hover:border-border-strong",
                f.locked && "opacity-50 cursor-not-allowed",
              )}
            >
              <input
                type="checkbox"
                checked={config.defaultFeatures.includes(f.id)}
                disabled={f.locked}
                onChange={() => toggleFeature(f.id)}
                className="rounded-sm border-border-strong bg-surface-hover text-accent focus:ring-0 w-4 h-4 mt-0.5"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                  {f.name}
                  {f.locked && (
                    <Badge variant="warning" className="text-2xs">
                      PRO
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-muted leading-snug mt-0.5">{f.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Autoloaded Agent Skills</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {skills.map((s) => (
            <label
              key={s.name}
              className="flex items-start gap-3 p-3.5 rounded-md border border-border bg-surface cursor-pointer transition-all hover:border-border-strong"
            >
              <input
                type="checkbox"
                checked={config.defaultSkills.includes(s.name)}
                onChange={() => toggleSkill(s.name)}
                className="rounded-sm border-border-strong bg-surface-hover text-accent focus:ring-0 w-4 h-4 mt-0.5"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">{s.name}</span>
                <span className="text-xs text-muted leading-snug mt-0.5">{s.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

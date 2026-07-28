"use client";

import { Brain, Loader2, Wrench } from "lucide-react";
import React from "react";
import type { AgentFeature } from "@/features/shared/hooks/useFeatures";
import type { AgentSkill } from "@/features/shared/hooks/useSkills";

interface FeatureSkillPickerProps {
  features: AgentFeature[];
  skills: AgentSkill[];
  selectedFeatures: string[];
  selectedSkills: string[];
  onFeaturesChange: (ids: string[]) => void;
  onSkillsChange: (names: string[]) => void;
  isLoading?: boolean;
}

export function FeatureSkillPicker({
  features,
  skills,
  selectedFeatures,
  selectedSkills,
  onFeaturesChange,
  onSkillsChange,
  isLoading,
}: FeatureSkillPickerProps) {
  const toggleFeature = (id: string) => {
    if (selectedFeatures.includes(id)) {
      onFeaturesChange(selectedFeatures.filter((f) => f !== id));
    } else {
      onFeaturesChange([...selectedFeatures, id]);
    }
  };

  const toggleSkill = (name: string) => {
    if (selectedSkills.includes(name)) {
      onSkillsChange(selectedSkills.filter((s) => s !== name));
    } else {
      onSkillsChange([...selectedSkills, name]);
    }
  };

  return (
    <details className="group text-sm">
      <summary className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 hover:text-zinc-800 py-1">
        <Wrench className="h-3.5 w-3.5" />
        <span className="font-medium">Tools &amp; Skills</span>
        <span className="text-[10px] text-zinc-400 ml-auto group-open:hidden">Click to expand</span>
      </summary>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Wrench className="h-3 w-3" />
            Features
          </h4>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading features...
            </div>
          ) : features.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">No features available</p>
          ) : (
            <div className="space-y-1.5">
              {features.map((f) => {
                const isSelected = selectedFeatures.includes(f.id);
                return (
                  <label key={f.id} className="flex items-start gap-2 cursor-pointer group/label">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFeature(f.id)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      disabled={f.locked}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={f.locked ? "text-zinc-400" : isSelected ? "text-zinc-800" : "text-zinc-600"}>
                        {f.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 ml-1.5">{f.id}</span>
                      {f.locked && <span className="text-[10px] text-amber-500 ml-1.5">locked</span>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Brain className="h-3 w-3" />
            Skills
          </h4>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading skills...
            </div>
          ) : skills.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">No skills available</p>
          ) : (
            <div className="space-y-1.5">
              {skills.map((s) => {
                const isSelected = selectedSkills.includes(s.name);
                return (
                  <label key={s.name} className="flex items-start gap-2 cursor-pointer group/label">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSkill(s.name)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={isSelected ? "text-zinc-800" : "text-zinc-600"}>{s.name}</span>
                      <span className="text-[10px] text-zinc-400 ml-1.5">{s.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

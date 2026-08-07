"use client";

import { AlertCircle, Rocket, Save, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { usePromptLibrary } from "../../hooks/usePromptLibrary";
import { PromptLibrary } from "./PromptLibrary";
import { PromptVersionTimeline } from "./PromptVersionTimeline";
import { VersionDiffViewer } from "./VersionDiffViewer";
import { VersionStatusBadge } from "./VersionStatusBadge";

type Props = ReturnType<typeof usePromptLibrary>;

export function PromptsPage(props: Props) {
  const {
    templates,
    versions,
    activeTemplate,
    activeVersionData,
    selectedTemplateId,
    selectedVersion,
    draftPrompt,
    isLoading,
    error,
    isCreatingTemplate,
    isSavingVersion,
    isPromoting,
    isRollingBack,
    handleSelectTemplate,
    setSelectedVersion,
    setDraftPrompt,
    handleCreateTemplate,
    handleSaveVersion,
    handlePromote,
    handleRollback,
  } = props;

  const [showDiff, setShowDiff] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "promote" | "rollback"; version: number } | null>(null);

  const currentLiveVersion = activeTemplate ? versions.find((v) => v.version === activeTemplate.active_version) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 font-sans text-zinc-900 dark:text-zinc-100">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 font-display">
          Prompt Template Governance
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Version, diff, and govern your production prompt templates.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: library + timeline */}
        <div className="space-y-5">
          <PromptLibrary
            templates={templates}
            isLoading={isLoading}
            error={error}
            onSelect={handleSelectTemplate}
            onCreate={handleCreateTemplate}
            isCreating={isCreatingTemplate}
          />

          {selectedTemplateId && versions.length > 0 && (
            <div className="border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 rounded-2xl p-4 space-y-3 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Version History
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {versions.length} versions
                </span>
              </div>
              <PromptVersionTimeline
                versions={versions}
                activeVersion={activeTemplate?.active_version ?? 0}
                selectedVersion={selectedVersion}
                onSelect={setSelectedVersion}
              />
            </div>
          )}
        </div>

        {/* Right column: editor + diff */}
        <div className="lg:col-span-2 space-y-5">
          {selectedTemplateId ? (
            <>
              {/* Selected version viewer */}
              {activeVersionData && (
                <div className="border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        Version {activeVersionData.version}
                      </h3>
                      <VersionStatusBadge status={activeVersionData.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      {activeVersionData.status !== "production" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5 text-xs font-semibold cursor-pointer"
                          onClick={() => setConfirmAction({ type: "promote", version: activeVersionData.version })}
                        >
                          <Rocket className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Promote
                        </Button>
                      )}
                      {currentLiveVersion && activeVersionData.version !== currentLiveVersion.version && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs font-semibold cursor-pointer"
                          onClick={() => setShowDiff(!showDiff)}
                        >
                          Diff vs v{currentLiveVersion.version}
                        </Button>
                      )}
                      {currentLiveVersion &&
                        currentLiveVersion.version !== 1 &&
                        activeVersionData.status === "production" && (
                          <Button
                            size="sm"
                            variant="danger"
                            className="gap-1.5 text-xs font-semibold cursor-pointer"
                            onClick={() =>
                              setConfirmAction({ type: "rollback", version: currentLiveVersion.version - 1 })
                            }
                          >
                            <Undo2 className="h-3.5 w-3.5" /> Rollback
                          </Button>
                        )}
                    </div>
                  </div>
                  <pre className="p-4 bg-zinc-900 dark:bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed select-text shadow-inner">
                    {activeVersionData.system_prompt}
                  </pre>

                  {showDiff && currentLiveVersion && (
                    <VersionDiffViewer
                      oldText={currentLiveVersion.system_prompt}
                      newText={activeVersionData.system_prompt}
                      oldLabel={`v${currentLiveVersion.version} (live)`}
                      newLabel={`v${activeVersionData.version}`}
                    />
                  )}
                </div>
              )}

              {/* New draft editor */}
              <div className="border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  New Version Draft
                </h3>
                <textarea
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  placeholder="Write your new system prompt here... Use {{variable_name}} for dynamic slots."
                  rows={8}
                  className="w-full p-4 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 font-mono focus:outline-none focus:border-blue-500/50 transition-colors resize-y leading-relaxed"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSaveVersion}
                    isLoading={isSavingVersion}
                    disabled={!draftPrompt.trim()}
                    className="gap-2 font-semibold cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" /> Save as New Version
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 rounded-2xl text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-zinc-400 dark:text-zinc-600" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Select a template</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Choose a prompt template from the library to view and edit its versions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Dismiss confirmation"
            className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            onClick={() => setConfirmAction(null)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              {confirmAction.type === "promote" ? "Promote to Production?" : "Rollback Version?"}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {confirmAction.type === "promote"
                ? `This will make version ${confirmAction.version} the live production prompt. All live traffic will use this version immediately.`
                : `This will revert the live prompt to version ${confirmAction.version}. The current production version will be marked as rolled back.`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant={confirmAction.type === "rollback" ? "danger" : "primary"}
                isLoading={isPromoting || isRollingBack}
                onClick={async () => {
                  if (confirmAction.type === "promote") await handlePromote(confirmAction.version);
                  else await handleRollback(confirmAction.version);
                  setConfirmAction(null);
                }}
              >
                {confirmAction.type === "promote" ? "Promote" : "Rollback"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

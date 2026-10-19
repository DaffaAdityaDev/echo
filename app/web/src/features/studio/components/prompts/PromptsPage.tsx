"use client";

import { AlertCircle, RefreshCcw, Rocket, Save, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import type { usePromptLibrary } from "../../hooks/usePromptLibrary";
import { PromptLibrary } from "./PromptLibrary";
import { PromptVersionTimeline } from "./PromptVersionTimeline";
import { VersionDiffViewer } from "./VersionDiffViewer";
import { VersionStatusBadge } from "./VersionStatusBadge";

type Props = ReturnType<typeof usePromptLibrary>;

interface ConfirmAction {
  type: "promote" | "rollback";
  version: number;
}

function confirmDescription(action: ConfirmAction): string {
  return action.type === "promote"
    ? `This will make version ${action.version} the live production prompt. All live traffic will use this version immediately.`
    : `This will revert the live prompt to version ${action.version}. The current production version will be marked as rolled back.`;
}

function VersionHistoryState({
  isLoading,
  error,
  onRetry,
}: {
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading version history" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-hover rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  if (!error) return null;

  return (
    <div role="alert" className="p-4 border border-danger/30 bg-danger/5 rounded-md space-y-2">
      <p className="text-xs text-danger">Failed to load version history: {error.message}</p>
      <Button size="sm" variant="secondary" onClick={onRetry} className="gap-1.5 text-xs">
        <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

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
    retryTemplates,
    isVersionsLoading,
    versionsError,
    retryVersions,
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

  const { showToast } = useToast();
  const [showDiff, setShowDiff] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const onCreateTemplate = async (name: string, description: string): Promise<boolean> => {
    try {
      await handleCreateTemplate(name, description);
      showToast(`Template "${name}" created`, "success");

      return true;
    } catch (err: unknown) {
      showToast(errorMessage(err, "Failed to create template"), "error");

      return false;
    }
  };

  const onSaveVersion = async () => {
    try {
      await handleSaveVersion();
      showToast("New version saved", "success");
    } catch (err: unknown) {
      showToast(errorMessage(err, "Failed to save version"), "error");
    }
  };

  const runConfirmedAction = async (action: ConfirmAction) => {
    try {
      if (action.type === "promote") {
        await handlePromote(action.version);
        showToast(`Version ${action.version} promoted to production`, "success");
      } else {
        await handleRollback(action.version);
        showToast(`Rolled back to version ${action.version}`, "success");
      }
    } catch (err: unknown) {
      showToast(errorMessage(err, "Action failed"), "error");
    } finally {
      setConfirmAction(null);
    }
  };

  const currentLiveVersion = activeTemplate ? versions.find((v) => v.version === activeTemplate.active_version) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 font-sans text-foreground">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground font-display">
          Prompt Template Governance
        </h1>
        <p className="text-xs text-muted mt-0.5">Version, diff, and govern your production prompt templates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <PromptLibrary
            templates={templates}
            isLoading={isLoading}
            error={error}
            onRetry={retryTemplates}
            selectedId={selectedTemplateId}
            onSelect={handleSelectTemplate}
            onCreate={onCreateTemplate}
            isCreating={isCreatingTemplate}
          />

          {selectedTemplateId && (
            <VersionHistoryState isLoading={isVersionsLoading} error={versionsError} onRetry={retryVersions} />
          )}

          {selectedTemplateId && versions.length > 0 && (
            <div className="border border-border bg-elevated rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Version History</h2>
                <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded-full bg-surface-hover text-muted">
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

        <div className="lg:col-span-2 space-y-5">
          {selectedTemplateId ? (
            <>
              {activeVersionData && (
                <section
                  aria-labelledby="prompt-version-heading"
                  className="border border-border bg-elevated rounded-md p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h2
                        id="prompt-version-heading"
                        className="text-xs font-extrabold uppercase tracking-wider text-foreground"
                      >
                        Version {activeVersionData.version}
                      </h2>
                      <VersionStatusBadge status={activeVersionData.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeVersionData.status !== "production" && activeVersionData.status !== "rolled_back" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5 text-xs font-semibold cursor-pointer"
                          onClick={() => setConfirmAction({ type: "promote", version: activeVersionData.version })}
                        >
                          <Rocket className="h-3.5 w-3.5 text-success" aria-hidden="true" /> Promote
                        </Button>
                      )}
                      {currentLiveVersion && activeVersionData.version !== currentLiveVersion.version && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs font-semibold cursor-pointer"
                          onClick={() => setShowDiff(!showDiff)}
                          aria-pressed={showDiff}
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
                            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Rollback
                          </Button>
                        )}
                    </div>
                  </div>
                  <pre className="p-4 bg-code border border-code-border rounded-md text-xs text-code-foreground font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed select-text">
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
                </section>
              )}

              <section className="border border-border bg-elevated rounded-md p-5 space-y-4">
                <label
                  htmlFor="prompt-draft"
                  className="block text-xs font-extrabold uppercase tracking-wider text-foreground"
                >
                  New Version Draft
                </label>
                <textarea
                  id="prompt-draft"
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  placeholder="Write your new system prompt here... Use {{variable_name}} for dynamic slots."
                  rows={8}
                  className="w-full p-4 bg-surface-hover border border-border rounded-md text-xs text-foreground placeholder:text-subtle font-mono focus:outline-none focus:border-accent/50 transition-colors resize-y leading-relaxed"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={onSaveVersion}
                    isLoading={isSavingVersion}
                    disabled={!draftPrompt.trim()}
                    className="gap-2 font-semibold cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" /> Save as New Version
                  </Button>
                </div>
              </section>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border border-border bg-surface rounded-md text-center space-y-3 px-4">
              <AlertCircle className="h-8 w-8 text-muted" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Select a template</h2>
                <p className="text-xs text-muted mt-1">
                  Choose a prompt template from the library to view and edit its versions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === "rollback" ? "Rollback Version?" : "Promote to Production?"}
        description={confirmAction ? confirmDescription(confirmAction) : undefined}
        className="max-w-md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={confirmAction?.type === "rollback" ? "danger" : "primary"}
              isLoading={isPromoting || isRollingBack}
              onClick={() => confirmAction && runConfirmedAction(confirmAction)}
            >
              {confirmAction?.type === "rollback" ? "Rollback" : "Promote"}
            </Button>
          </>
        }
      />
    </div>
  );
}

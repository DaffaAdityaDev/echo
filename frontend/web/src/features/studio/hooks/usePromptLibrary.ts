"use client"

import { useState } from "react"
import { usePromptTemplates, usePromptVersions, useCreateTemplate, useCreateVersion, usePromoteVersion, useRollbackVersion } from "../api/usePrompts"

export function usePromptLibrary() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [draftPrompt, setDraftPrompt] = useState("")

  const templatesQuery = usePromptTemplates()
  const versionsQuery = usePromptVersions(selectedTemplateId)
  const createTemplate = useCreateTemplate()
  const createVersion = useCreateVersion()
  const promoteVersion = usePromoteVersion()
  const rollbackVersion = useRollbackVersion()

  const templates = templatesQuery.data?.templates ?? []
  const versions = versionsQuery.data?.versions ?? []
  const activeTemplate = templates.find(t => t.id === selectedTemplateId) ?? null
  const activeVersionData = versions.find(v => v.version === selectedVersion) ?? null

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id)
    const tmpl = templates.find(t => t.id === id)
    setSelectedVersion(tmpl?.active_version ?? null)
    setDraftPrompt("")
  }

  const handleCreateTemplate = async (name: string, description: string) => {
    await createTemplate.mutateAsync({ name, description })
  }

  const handleSaveVersion = async () => {
    if (!selectedTemplateId || !draftPrompt.trim()) return
    await createVersion.mutateAsync({
      id: selectedTemplateId,
      body: { system_prompt: draftPrompt, bound_tools: [], variables: [] },
    })
    setDraftPrompt("")
  }

  const handlePromote = async (version: number) => {
    if (!selectedTemplateId) return
    await promoteVersion.mutateAsync({ id: selectedTemplateId, version })
  }

  const handleRollback = async (version: number) => {
    if (!selectedTemplateId) return
    await rollbackVersion.mutateAsync({ id: selectedTemplateId, version })
  }

  return {
    templates,
    versions,
    activeTemplate,
    activeVersionData,
    selectedTemplateId,
    selectedVersion,
    draftPrompt,
    isLoading: templatesQuery.isLoading || versionsQuery.isLoading,
    error: templatesQuery.error ?? versionsQuery.error,
    isCreatingTemplate: createTemplate.isPending,
    isSavingVersion: createVersion.isPending,
    isPromoting: promoteVersion.isPending,
    isRollingBack: rollbackVersion.isPending,
    handleSelectTemplate,
    setSelectedVersion,
    setDraftPrompt,
    handleCreateTemplate,
    handleSaveVersion,
    handlePromote,
    handleRollback,
  }
}

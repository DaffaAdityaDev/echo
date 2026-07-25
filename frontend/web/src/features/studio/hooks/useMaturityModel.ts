"use client"

import { useState, useMemo } from "react"
import {
  MATURITY_DIMENSIONS,
  MATURITY_LEVELS,
  ECHO_SELF_ASSESSMENT_ROADMAP,
  SCORING_QUESTIONS,
} from "../data/maturity-data"
import type {
  MaturityLevel,
  MaturityDimensionKey,
  SystemMaturityAssessment,
  RoadmapItem,
  ClientAssessmentScore,
  ClientCompanyAssessment,
} from "../types"

const LEVEL_WEIGHTS: Record<MaturityLevel, number> = {
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5,
}

const WEIGHT_TO_LEVEL: Record<number, MaturityLevel> = {
  1: 'L1',
  2: 'L2',
  3: 'L3',
  4: 'L4',
  5: 'L5',
}

export function useMaturityModel() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'scoring' | 'roadmap' | 'client'>('matrix')
  const [clientName, setClientName] = useState('')
  const [clientScores, setClientScores] = useState<Record<MaturityDimensionKey, MaturityLevel>>({
    tools: 'L2',
    skills: 'L1',
    prompts: 'L2',
    security: 'L2',
    data: 'L2',
    observability: 'L1',
    documentation: 'L1',
  })
  const [clientEvidences, setClientEvidences] = useState<Record<MaturityDimensionKey, string>>({
    tools: 'Standard REST endpoints, no tool schemas.',
    skills: 'Ad-hoc prompt strings embedded in controllers.',
    prompts: 'String concatenation without validation.',
    security: 'Basic auth token header.',
    data: 'Prose documentation of database tables.',
    observability: 'Raw console logging.',
    documentation: 'Manual markdown files.',
  })

  const [roadmap, setRoadmap] = useState<RoadmapItem[]>(
    ECHO_SELF_ASSESSMENT_ROADMAP.map((item) => ({ ...item })) as RoadmapItem[]
  )

  const [questionAnswers, setQuestionAnswers] = useState<Record<string, boolean>>({
    'q-tools-1': true,
    'q-tools-2': false,
    'q-tools-3': false,
    'q-skills-1': false,
    'q-skills-2': false,
    'q-prompts-1': true,
    'q-prompts-2': false,
    'q-sec-1': true,
    'q-sec-2': false,
    'q-data-1': true,
    'q-obs-1': true,
    'q-obs-2': false,
    'q-doc-1': true,
  })

  // Calculate internal assessment using Weakest Link Rule
  const echoAssessment = useMemo<SystemMaturityAssessment>(() => {
    let minWeight = 5
    let weakest: MaturityDimensionKey = 'skills'

    const dimMap = {} as Record<MaturityDimensionKey, any>

    MATURITY_DIMENSIONS.forEach((dim) => {
      const w = LEVEL_WEIGHTS[dim.currentLevel as MaturityLevel]
      if (w < minWeight) {
        minWeight = w
        weakest = dim.key as MaturityDimensionKey
      }
      dimMap[dim.key as MaturityDimensionKey] = { ...dim }
    })

    return {
      overallLevel: WEIGHT_TO_LEVEL[minWeight] || 'L2',
      weakestDimension: weakest,
      dimensions: dimMap,
      lastAssessedAt: '2026-07-25',
    }
  }, [])

  // Calculate client company overall level using Weakest Link Rule
  const clientAssessment = useMemo<ClientCompanyAssessment>(() => {
    let minWeight = 5
    let weakest: MaturityDimensionKey = 'tools'

    const scoresMap = {} as Record<MaturityDimensionKey, ClientAssessmentScore>

    (Object.keys(clientScores) as MaturityDimensionKey[]).forEach((key) => {
      const level = clientScores[key]
      const weight = LEVEL_WEIGHTS[level]
      if (weight < minWeight) {
        minWeight = weight
        weakest = key
      }
      scoresMap[key] = {
        dimension: key,
        level,
        evidence: clientEvidences[key] || 'No evidence provided',
        quickestL3Action: `Upgrade ${key} to L3 (Structured) schemas and contracts`,
      }
    })

    return {
      clientName: clientName || 'Sample Client Corp',
      assessedAt: new Date().toISOString().split('T')[0],
      overallLevel: WEIGHT_TO_LEVEL[minWeight] || 'L1',
      weakestDimension: weakest,
      scores: scoresMap,
    }
  }, [clientName, clientScores, clientEvidences])

  const toggleQuestion = (qId: string) => {
    setQuestionAnswers((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }))
  }

  const setClientScore = (dimension: MaturityDimensionKey, level: MaturityLevel) => {
    setClientScores((prev) => ({
      ...prev,
      [dimension]: level,
    }))
  }

  const setClientEvidence = (dimension: MaturityDimensionKey, text: string) => {
    setClientEvidences((prev) => ({
      ...prev,
      [dimension]: text,
    }))
  }

  const toggleRoadmapStatus = (id: string) => {
    setRoadmap((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const nextStatus =
          item.status === 'completed'
            ? 'planned'
            : item.status === 'planned'
            ? 'in_progress'
            : 'completed'
        return { ...item, status: nextStatus }
      })
    )
  }

  return {
    activeTab,
    setActiveTab,
    echoAssessment,
    clientAssessment,
    clientName,
    setClientName,
    clientScores,
    setClientScore,
    clientEvidences,
    setClientEvidence,
    roadmap,
    toggleRoadmapStatus,
    questionAnswers,
    toggleQuestion,
    levelsInfo: MATURITY_LEVELS,
    dimensions: MATURITY_DIMENSIONS,
    questions: SCORING_QUESTIONS,
  }
}

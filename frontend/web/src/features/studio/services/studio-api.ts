import { api } from '@/lib/api-client'
import { STUDIO_ENDPOINTS } from '../constants'
import type {
  PromptTemplate,
  PromptVersion,
  EvalRun,
  EvalDataset,
  ShadowRun,
  AuditLog,
  SystemMaturityAssessment,
  ClientCompanyAssessment,
} from '../types'

export const studioApi = {
  getPrompts: async (): Promise<PromptTemplate[]> => {
    return api.get<PromptTemplate[]>(STUDIO_ENDPOINTS.PROMPTS)
  },

  getPromptVersions: async (id: string): Promise<PromptVersion[]> => {
    return api.get<PromptVersion[]>(STUDIO_ENDPOINTS.PROMPT_VERSIONS(id))
  },

  getEvalRuns: async (): Promise<EvalRun[]> => {
    return api.get<EvalRun[]>(STUDIO_ENDPOINTS.EVAL_RUNS)
  },

  getEvalDatasets: async (): Promise<EvalDataset[]> => {
    return api.get<EvalDataset[]>(STUDIO_ENDPOINTS.EVAL_DATASETS)
  },

  getShadowRuns: async (): Promise<ShadowRun[]> => {
    return api.get<ShadowRun[]>(STUDIO_ENDPOINTS.SHADOW)
  },

  getAuditLogs: async (): Promise<AuditLog[]> => {
    return api.get<AuditLog[]>(STUDIO_ENDPOINTS.AUDIT)
  },

  getMaturityAssessment: async (): Promise<SystemMaturityAssessment> => {
    return api.get<SystemMaturityAssessment>(STUDIO_ENDPOINTS.MATURITY)
  },

  saveClientAssessment: async (assessment: ClientCompanyAssessment): Promise<ClientCompanyAssessment> => {
    return api.post<ClientCompanyAssessment>(`${STUDIO_ENDPOINTS.MATURITY}/client`, assessment)
  },
}

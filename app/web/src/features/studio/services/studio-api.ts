import { api } from "@/lib/api-client";
import { STUDIO_ENDPOINTS } from "../constants";
import type { ClientCompanyAssessment, PromptTemplate, PromptVersion, SystemMaturityAssessment } from "../types";

export interface PromptTemplateList {
  templates: PromptTemplate[];
}

export interface PromptVersionList {
  versions: PromptVersion[];
}

export const studioApi = {
  listPrompts: async (): Promise<PromptTemplateList> => {
    return api.get<PromptTemplateList>(STUDIO_ENDPOINTS.PROMPTS);
  },

  getActivePrompt: async (name: string): Promise<PromptTemplate> => {
    return api.get<PromptTemplate>(STUDIO_ENDPOINTS.PROMPTS_ACTIVE(name));
  },

  listPromptVersions: async (templateId: string): Promise<PromptVersionList> => {
    return api.get<PromptVersionList>(STUDIO_ENDPOINTS.PROMPT_VERSIONS(templateId));
  },

  createPrompt: async (body: { name: string; description: string }): Promise<PromptTemplate> => {
    return api.post<PromptTemplate>(STUDIO_ENDPOINTS.PROMPTS, body);
  },

  createPromptVersion: async (
    id: string,
    body: { system_prompt: string; bound_tools: string[]; variables: string[] },
  ): Promise<PromptVersion> => {
    return api.post<PromptVersion>(STUDIO_ENDPOINTS.PROMPT_VERSIONS(id), body);
  },

  promotePromptVersion: async (id: string, version: number): Promise<unknown> => {
    return api.post(STUDIO_ENDPOINTS.PROMPT_PROMOTE(id, version), {});
  },

  rollbackPromptVersion: async (id: string, version: number): Promise<unknown> => {
    return api.post(STUDIO_ENDPOINTS.PROMPT_ROLLBACK(id, version), {});
  },

  getMaturity: async (): Promise<SystemMaturityAssessment> => {
    return api.get<SystemMaturityAssessment>(STUDIO_ENDPOINTS.MATURITY);
  },

  saveClientAssessment: async (assessment: ClientCompanyAssessment): Promise<ClientCompanyAssessment> => {
    return api.post<ClientCompanyAssessment>(STUDIO_ENDPOINTS.MATURITY_CLIENT, assessment);
  },
};

import { z } from 'zod';
import { 
  MISSION_STRATEGIES, 
  DEFAULT_MISSION_VALUES, 
  STRATEGY_MAPPING, 
  VALIDATION_MESSAGES 
} from './mission.constants';

export const createMissionSchema = z.preprocess((input: any) => {
  if (!input || typeof input !== 'object') return input;

  const rawStrategy = String(input.strategy || input.mode || DEFAULT_MISSION_VALUES.STRATEGY).toLowerCase();
  let strategy: typeof MISSION_STRATEGIES[number] = DEFAULT_MISSION_VALUES.STRATEGY;
  if (STRATEGY_MAPPING.react.includes(rawStrategy)) {
    strategy = 'react';
  } else if (STRATEGY_MAPPING.sequential.includes(rawStrategy)) {
    strategy = 'sequential';
  } else if (STRATEGY_MAPPING.standard.includes(rawStrategy)) {
    strategy = 'standard';
  } else if (STRATEGY_MAPPING.nlah.includes(rawStrategy)) {
    strategy = 'nlah';
  }

  const userIdRaw = input.userId ?? input.user_id;
  const tenantIdRaw = input.tenantId ?? input.tenant_id;
  const orgIdRaw = input.orgId ?? input.org_id;

  return {
    ...input,
    strategy,
    prompt: input.prompt || input.message,
    tenantId: tenantIdRaw != null ? String(tenantIdRaw) : DEFAULT_MISSION_VALUES.TENANT_ID,
    userId: userIdRaw != null ? String(userIdRaw) : DEFAULT_MISSION_VALUES.USER_ID,
    orgId: orgIdRaw != null ? String(orgIdRaw) : DEFAULT_MISSION_VALUES.ORG_ID,
    history: input.history ?? undefined,
    features: input.features ?? undefined,
    missionId: input.missionId ?? undefined,
    model: input.model ?? undefined,
  };
}, z.object({
  prompt: z.string({ message: VALIDATION_MESSAGES.PROMPT_REQUIRED }),
  strategy: z.enum(MISSION_STRATEGIES),
  tenantId: z.string(),
  userId: z.string(),
  orgId: z.string(),
  missionId: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  provider_config: z.object({
    type: z.enum(['openai', 'anthropic', 'lm-studio', 'opencode-go']),
    base_url: z.string(),
    api_key: z.string().nullable().optional(),
    model: z.string(),
  }),
  features: z.array(z.string()).nullable().optional(),
  history: z.array(
    z.object({
      role: z.string(),
      content: z.string()
    })
  ).nullable().optional()
}));

export type CreateMissionInput = z.infer<typeof createMissionSchema>;

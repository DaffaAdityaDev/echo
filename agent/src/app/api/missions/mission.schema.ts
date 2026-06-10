import { z } from 'zod';
import { 
  MISSION_STRATEGIES, 
  MISSION_PROVIDERS, 
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
  }

  return {
    ...input,
    strategy,
    prompt: input.prompt || input.message,
    tenantId: input.tenantId || DEFAULT_MISSION_VALUES.TENANT_ID,
    userId: input.userId || DEFAULT_MISSION_VALUES.USER_ID,
    orgId: input.orgId || DEFAULT_MISSION_VALUES.ORG_ID,
  };
}, z.object({
  prompt: z.string({ message: VALIDATION_MESSAGES.PROMPT_REQUIRED }),
  strategy: z.enum(MISSION_STRATEGIES),
  provider: z.enum(MISSION_PROVIDERS).default(DEFAULT_MISSION_VALUES.PROVIDER),
  tenantId: z.string(),
  userId: z.string(),
  orgId: z.string(),
  missionId: z.string().optional(),
  model: z.string().optional(),
  history: z.array(
    z.object({
      role: z.string(),
      content: z.string()
    })
  ).optional()
}));

export type CreateMissionInput = z.infer<typeof createMissionSchema>;

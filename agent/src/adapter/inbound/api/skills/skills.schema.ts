import { z } from "zod";

export const SkillsResponseSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    preferredTools: z.array(z.string()).optional(),
    modifiers: z
      .object({
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        compression: z.boolean().optional(),
        pacing: z.boolean().optional(),
        loopDetection: z.boolean().optional(),
      })
      .optional(),
  }),
);

export type SkillsResponse = z.infer<typeof SkillsResponseSchema>;

import { z } from "zod";

export const ModelsResponseSchema = z.object({
  models: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
});

export type ModelsResponse = z.infer<typeof ModelsResponseSchema>;

import { z } from "zod";

export const FeaturesResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  }),
);

export type FeaturesResponse = z.infer<typeof FeaturesResponseSchema>;

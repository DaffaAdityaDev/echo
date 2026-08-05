import { z } from "zod";

export const StrategiesResponseSchema = z.array(
  z.object({
    name: z.string(),
    versions: z.array(
      z.object({
        version: z.string(),
        status: z.enum(["active", "deprecated"]),
        aliases: z.array(z.string()),
      }),
    ),
  }),
);

export type StrategiesResponse = z.infer<typeof StrategiesResponseSchema>;

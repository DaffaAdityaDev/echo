import { z } from "zod";

/**
 * Schema for mission generation requests.
 * Ensures all incoming data follows the expected format before reaching the harness.
 */
export const generateMissionSchema = z.object({
    message: z.string().min(1, "Mission objective is required"),
    model: z.string().optional(),
    missionId: z.string().uuid().optional(),
    history: z.array(
        z.object({
            role: z.string(),
            content: z.string(),
        })
    ).optional(),
});

export type GenerateMissionInput = z.infer<typeof generateMissionSchema>;

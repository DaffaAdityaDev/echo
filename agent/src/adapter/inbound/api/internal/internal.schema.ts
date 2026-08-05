import { z } from "zod";

export const SummarizeRequestSchema = z.object({
  session_id: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
    }),
  ),
  max_summary_tokens: z.number().optional(),
  provider_config: z.object({
    type: z.enum(["openai", "anthropic", "lm-studio", "opencode-go"]),
    base_url: z.string(),
    api_key: z.string().nullable().optional(),
    model: z.string(),
  }),
});

export const SummarizeResponseSchema = z.object({
  summary: z.string(),
  token_count: z.number(),
  messages_summarized: z.number(),
});

export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;
export type SummarizeResponse = z.infer<typeof SummarizeResponseSchema>;

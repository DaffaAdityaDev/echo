import type { Model } from "@/lib/queries";

export function resolveDefaultModel(models: Model[], defaultModel: string | undefined): Model | undefined {
  if (!defaultModel) return undefined;

  const byExactId = models.find((m) => m.id === defaultModel);
  if (byExactId) return byExactId;

  const byExactName = models.find((m) => m.name === defaultModel);
  if (byExactName) return byExactName;

  // Legacy bare-id storage (e.g. "gpt-4o" for "openai/gpt-4o"): only match a
  // unique id suffix so two providers sharing a suffix cannot both claim it.
  const bySuffix = models.filter((m) => m.id.endsWith(`/${defaultModel}`));
  return bySuffix.length === 1 ? bySuffix[0] : undefined;
}

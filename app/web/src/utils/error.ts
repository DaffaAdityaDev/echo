function readMessageField(value: object): string | undefined {
  if ("message" in value && typeof value.message === "string" && value.message) return value.message;

  if ("error" in value && typeof value.error === "string" && value.error) return value.error;

  return undefined;
}

export function extractErrorMessage(err: unknown, fallback = "Unexpected error"): string {
  if (err instanceof Error) return err.message;

  if (typeof err === "string") return err;

  if (typeof err === "object" && err !== null) return readMessageField(err) ?? fallback;

  return fallback;
}

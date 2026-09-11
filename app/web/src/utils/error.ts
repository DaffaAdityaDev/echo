export type ErrorContext = Error | string | { message?: string; error?: string } | null | undefined;

function isString(value: ErrorContext): value is string {
  return typeof value === "string";
}

function isErrorObject(value: ErrorContext): value is { message?: string; error?: string } {
  return typeof value === "object" && value !== null && !(value instanceof Error);
}

export function extractErrorMessage(err: ErrorContext, fallback = "Unexpected error"): string {
  if (err instanceof Error) return err.message;

  if (isString(err)) return err;

  if (isErrorObject(err)) {
    if (err.message) return err.message;

    if (err.error) return err.error;
  }

  return fallback;
}

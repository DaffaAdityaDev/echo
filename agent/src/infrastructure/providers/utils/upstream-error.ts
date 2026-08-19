import { ERROR_MESSAGES } from "../../../shared/constants/errors";

export const UPSTREAM_ERROR_CODES = {
  USAGE_LIMIT: "USAGE_LIMIT",
  RATE_LIMIT: "RATE_LIMIT",
  TIMEOUT: "TIMEOUT",
  PROVIDER_ERROR: "PROVIDER_ERROR",
} as const;

export type UpstreamErrorKind = "usage_limit" | "rate_limit" | "timeout" | "provider_error";

interface SdkErrorLike {
  status?: number;
  headers?: Headers;
  message?: string;
  error?: { type?: string; error?: { type?: string; message?: string } };
}

const PROVIDER_ERROR_MESSAGE = "Upstream LLM provider request failed. Please retry.";

// Extracts the provider's own error text from SDK error bodies. OpenAI-style
// SDKs parse the JSON body into err.error ({ type, error: { type, message } });
// other SDKs only embed the JSON in the message string.
function extractProviderMessage(err: SdkErrorLike, rawMessage: string): string {
  const nested = err.error?.error?.message;
  if (nested?.trim()) return nested;
  const match = rawMessage.match(/"message"\s*:\s*"([^"]+)"/);
  if (match?.[1]) return match[1];
  return "";
}

function parseRetryAfter(headers?: Headers): number | undefined {
  if (!headers) return undefined;
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

export class UpstreamProviderError extends Error {
  readonly kind: UpstreamErrorKind;
  readonly code: string;
  readonly status?: number;
  readonly detail?: string;
  readonly retryAfterMs?: number;
  readonly original?: unknown;

  constructor(opts: {
    kind: UpstreamErrorKind;
    code: string;
    message: string;
    status?: number;
    detail?: string;
    retryAfterMs?: number;
    original?: unknown;
  }) {
    super(opts.message);
    this.name = "UpstreamProviderError";
    this.kind = opts.kind;
    this.code = opts.code;
    this.status = opts.status;
    this.detail = opts.detail;
    this.retryAfterMs = opts.retryAfterMs;
    this.original = opts.original;
  }
}

// classifyProviderError turns raw upstream LLM provider SDK errors (OpenAI
// APIError and similar duck-typed shapes) into a structured, user-safe error.
// Returns null for errors that are NOT upstream provider failures (internal
// harness logic errors, aborts, cancellation) so callers keep their existing
// generic handling for those.
export function classifyProviderError(err: unknown): UpstreamProviderError | null {
  const sdk = (err ?? {}) as SdkErrorLike;
  const status = typeof sdk?.status === "number" ? sdk.status : undefined;
  const rawMessage = sdk?.message || String(err ?? "Unknown provider error");
  const lower = rawMessage.toLowerCase();
  const providerMessage = extractProviderMessage(sdk, rawMessage);
  const retryAfterMs = parseRetryAfter(sdk?.headers);

  if (status === 429 || lower.includes("429") || lower.includes("rate limit")) {
    const isUsageLimit = sdk.error?.error?.type === "GoUsageLimitError" || lower.includes("usage limit");
    if (isUsageLimit) {
      return new UpstreamProviderError({
        kind: "usage_limit",
        code: UPSTREAM_ERROR_CODES.USAGE_LIMIT,
        message:
          providerMessage || "Upstream LLM provider usage limit reached. Please check your provider account and retry.",
        status,
        detail: providerMessage || rawMessage,
        retryAfterMs,
        original: err,
      });
    }
    return new UpstreamProviderError({
      kind: "rate_limit",
      code: UPSTREAM_ERROR_CODES.RATE_LIMIT,
      message:
        retryAfterMs !== undefined
          ? `${ERROR_MESSAGES.RATE_LIMIT} Retry after ${Math.ceil(retryAfterMs / 1000)}s.`
          : ERROR_MESSAGES.RATE_LIMIT,
      status,
      detail: providerMessage || rawMessage,
      retryAfterMs,
      original: err,
    });
  }

  if (status === 408 || status === 504 || lower.includes("timeout") || lower.includes("deadline")) {
    return new UpstreamProviderError({
      kind: "timeout",
      code: UPSTREAM_ERROR_CODES.TIMEOUT,
      message: ERROR_MESSAGES.TIMEOUT,
      status,
      detail: providerMessage || rawMessage,
      original: err,
    });
  }

  if (status !== undefined && status >= 500) {
    return new UpstreamProviderError({
      kind: "provider_error",
      code: UPSTREAM_ERROR_CODES.PROVIDER_ERROR,
      message: providerMessage
        ? `Upstream LLM provider error: ${providerMessage}`
        : status !== undefined
          ? `Upstream LLM provider returned HTTP ${status}.`
          : PROVIDER_ERROR_MESSAGE,
      status,
      detail: providerMessage || rawMessage,
      original: err,
    });
  }

  return null;
}

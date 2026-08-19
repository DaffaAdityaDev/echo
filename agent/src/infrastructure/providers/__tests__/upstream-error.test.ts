import { ERROR_MESSAGES } from "../../../shared/constants/errors";
import { classifyProviderError, UPSTREAM_ERROR_CODES, UpstreamProviderError } from "../utils/upstream-error";

describe("classifyProviderError", () => {
  it("classifies a 429 GoUsageLimitError body as usage_limit", () => {
    const err = {
      status: 429,
      message:
        'Error code: 429 - {"type":"error","error":{"type":"GoUsageLimitError","message":"Monthly usage limit reached. Resets in 14 days."}}',
      error: {
        type: "error",
        error: {
          type: "GoUsageLimitError",
          message: "Monthly usage limit reached. Resets in 14 days.",
        },
      },
      headers: new Headers(),
    };

    const classified = classifyProviderError(err);

    expect(classified).toBeInstanceOf(UpstreamProviderError);
    expect(classified?.kind).toBe("usage_limit");
    expect(classified?.code).toBe(UPSTREAM_ERROR_CODES.USAGE_LIMIT);
    expect(classified?.status).toBe(429);
    expect(classified?.message).toBe("Monthly usage limit reached. Resets in 14 days.");
    expect(classified?.detail).toBe("Monthly usage limit reached. Resets in 14 days.");
  });

  it("classifies a plain 429 as rate_limit with the friendly message", () => {
    const err = { status: 429, message: "Error code: 429 - too many requests", error: {} };

    const classified = classifyProviderError(err);

    expect(classified?.kind).toBe("rate_limit");
    expect(classified?.code).toBe(UPSTREAM_ERROR_CODES.RATE_LIMIT);
    expect(classified?.message).toBe(ERROR_MESSAGES.RATE_LIMIT);
  });

  it("detects usage limit from the message when the body is not parsed", () => {
    const err = { status: 429, message: "429 Monthly usage limit reached. Please upgrade your plan." };

    const classified = classifyProviderError(err);

    expect(classified?.kind).toBe("usage_limit");
    expect(classified?.code).toBe(UPSTREAM_ERROR_CODES.USAGE_LIMIT);
  });

  it("appends the retry-after duration to the rate-limit message", () => {
    const err = {
      status: 429,
      message: "Error code: 429 - rate limited",
      headers: new Headers({ "retry-after": "5" }),
    };

    const classified = classifyProviderError(err);

    expect(classified?.retryAfterMs).toBe(5000);
    expect(classified?.message).toContain("Retry after 5s.");
  });

  it("classifies a 504 as timeout", () => {
    const err = { status: 504, message: "Error code: 504 - gateway timeout", error: {} };

    const classified = classifyProviderError(err);

    expect(classified?.kind).toBe("timeout");
    expect(classified?.code).toBe(UPSTREAM_ERROR_CODES.TIMEOUT);
    expect(classified?.message).toBe(ERROR_MESSAGES.TIMEOUT);
  });

  it("classifies a deadline message as timeout without a status", () => {
    const classified = classifyProviderError(new Error("request deadline exceeded"));

    expect(classified?.kind).toBe("timeout");
    expect(classified?.code).toBe(UPSTREAM_ERROR_CODES.TIMEOUT);
  });

  it("classifies a 5xx as provider_error and surfaces the provider message", () => {
    const err = {
      status: 502,
      message: 'Error code: 502 - {"error":{"message":"upstream exploded"}}',
      error: { type: "error", error: { type: "api_error", message: "upstream exploded" } },
    };

    const classified = classifyProviderError(err);

    expect(classified?.kind).toBe("provider_error");
    expect(classified?.code).toBe(UPSTREAM_ERROR_CODES.PROVIDER_ERROR);
    expect(classified?.message).toBe("Upstream LLM provider error: upstream exploded");
  });

  it("returns null for non-upstream errors", () => {
    expect(classifyProviderError(new Error("boom"))).toBeNull();
    expect(classifyProviderError("random string")).toBeNull();
    expect(classifyProviderError(undefined)).toBeNull();
  });
});

import { Hono } from "hono";
import { ERROR_MESSAGES, ERROR_TYPES } from "../../../../shared/constants/errors";
import { AppError } from "../../../../shared/utils/errors";
import { errorHandler } from "../error";

vi.mock("../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), langfuse: vi.fn() },
}));

describe("errorHandler", () => {
  test("maps AppError to its statusCode with error envelope", async () => {
    const app = new Hono();
    app.get("/boom", () => {
      throw new AppError("validation failed", 400);
    });
    app.onError(errorHandler);

    const res = await app.request("/boom");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error_type: string; message: string };
    expect(body.status).toBe("error");
    expect(body.error_type).toBe(ERROR_TYPES.APPLICATION_ERROR);
    expect(body.message).toBe("validation failed");
  });

  test("maps AppError without statusCode to 500", async () => {
    const app = new Hono();
    app.get("/boom", () => {
      throw new AppError("boom");
    });
    app.onError(errorHandler);

    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const body = (await res.json()) as { status: string; error_type: string; message: string };
    expect(body.status).toBe("error");
    expect(body.message).toBe("boom");
  });

  test("maps rate limit errors to 429", async () => {
    const app = new Hono();
    app.get("/boom", () => {
      throw new Error("rate limit exceeded");
    });
    app.onError(errorHandler);

    const res = await app.request("/boom");
    expect(res.status).toBe(429);
    const body = (await res.json()) as { status: string; error_type: string; message: string };
    expect(body.status).toBe("error");
    expect(body.error_type).toBe(ERROR_TYPES.RATE_LIMIT);
    expect(body.message).toBe(ERROR_MESSAGES.RATE_LIMIT);
  });

  test("maps timeout errors to 504", async () => {
    const app = new Hono();
    app.get("/boom", () => {
      throw new Error("upstream timeout");
    });
    app.onError(errorHandler);

    const res = await app.request("/boom");
    expect(res.status).toBe(504);
    const body = (await res.json()) as { status: string; error_type: string; message: string };
    expect(body.status).toBe("error");
    expect(body.error_type).toBe(ERROR_TYPES.TIMEOUT);
    expect(body.message).toBe(ERROR_MESSAGES.TIMEOUT);
  });

  test("maps unknown errors to 500 with the original message", async () => {
    const app = new Hono();
    app.get("/boom", () => {
      throw new Error("random failure");
    });
    app.onError(errorHandler);

    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const body = (await res.json()) as { status: string; error_type: string; message: string };
    expect(body.status).toBe("error");
    expect(body.error_type).toBe(ERROR_TYPES.INTERNAL_SERVER);
    expect(body.message).toBe("random failure");
  });

  test("maps invalid JSON syntax errors to 400", async () => {
    const app = new Hono();
    app.get("/boom", () => {
      throw new SyntaxError("Unexpected token in JSON at position 5");
    });
    app.onError(errorHandler);

    const res = await app.request("/boom");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error_type: string; message: string };
    expect(body.status).toBe("error");
    expect(body.error_type).toBe(ERROR_TYPES.BAD_REQUEST);
  });
});

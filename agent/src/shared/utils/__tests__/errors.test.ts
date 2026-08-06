import { HTTP_STATUS } from "../../constants/http";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "../errors";

describe("AppError", () => {
  test("defaults to 500 internal server error and operational", () => {
    const error = new AppError("boom");
    expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.message).toBe("boom");
  });

  test("accepts custom message, statusCode and isOperational", () => {
    const error = new AppError("bad request", HTTP_STATUS.BAD_REQUEST, false);
    expect(error.message).toBe("bad request");
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(false);
  });

  test("is an instance of Error", () => {
    const error = new AppError("anything");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("Error");
  });

  test("is an instance of AppError", () => {
    const error = new AppError("anything");
    expect(error).toBeInstanceOf(AppError);
  });
});

describe("ValidationError", () => {
  test("defaults to 400 bad request", () => {
    const error = new ValidationError("invalid payload");
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("invalid payload");
    expect(error.isOperational).toBe(true);
  });
});

describe("NotFoundError", () => {
  test("defaults to 404 not found", () => {
    const error = new NotFoundError("resource missing");
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("resource missing");
  });
});

describe("ForbiddenError", () => {
  test("defaults to 403 forbidden", () => {
    const error = new ForbiddenError("access denied");
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("access denied");
  });
});

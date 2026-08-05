import { HTTP_STATUS } from "../../constants/http";
import { AppError } from "../errors";

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

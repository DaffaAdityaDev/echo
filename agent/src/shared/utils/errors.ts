import { HTTP_STATUS } from "../constants/http";

/**
 * Base class for all application-specific errors.
 */
export class AppError extends Error {
  public errors?: unknown[];

  constructor(
    public message: string,
    public statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    public isOperational: boolean = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

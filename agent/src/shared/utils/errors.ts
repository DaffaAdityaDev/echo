import { HTTP_STATUS } from "../constants/http";
import type { JsonValue } from "../types";

/**
 * Base class for all application-specific errors.
 */
export class AppError extends Error {
  public errors?: JsonValue[];

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

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS.BAD_REQUEST);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS.NOT_FOUND);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS.FORBIDDEN);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/** Narrows a caught error into a loggable context. */
export function toLogCause(cause: unknown): Error | string {
  return cause instanceof Error ? cause : String(cause);
}

/**
 * Base class for all application-specific errors.
 */
export class AppError extends Error {
    public errors?: any[];

    constructor(
        public message: string,
        public statusCode: number = 500,
        public isOperational: boolean = true
    ) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Thrown when client input fails validation.
 */
export class ValidationError extends AppError {
    constructor(message: string, public errors?: any[]) {
        super(message, 400);
    }
}

/**
 * Thrown when a requested resource is not found.
 */
export class NotFoundError extends AppError {
    constructor(message: string = "Resource not found") {
        super(message, 404);
    }
}

/**
 * Thrown when an operation is forbidden.
 */
export class ForbiddenError extends AppError {
    constructor(message: string = "Forbidden") {
        super(message, 403);
    }
}

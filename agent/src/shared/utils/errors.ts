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



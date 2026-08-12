// AppError keeps the exact same "just throw it" ergonomics but carries
// a statusCode the global handler can read (see middleware/globalErrorHandler.ts).
export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

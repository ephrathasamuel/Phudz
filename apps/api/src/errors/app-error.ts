export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(fields: Record<string, string>) {
    super(400, "VALIDATION_ERROR", "Request validation failed", fields);
    this.name = "ValidationError";
  }
}

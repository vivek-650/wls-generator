export class AppError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code?: string): AppError {
    return new AppError(400, message, code);
  }

  static unauthorized(message = "Unauthorized", code?: string): AppError {
    return new AppError(401, message, code);
  }

  static forbidden(message = "Forbidden", code?: string): AppError {
    return new AppError(403, message, code);
  }

  static notFound(message = "Not found", code?: string): AppError {
    return new AppError(404, message, code);
  }

  static conflict(message: string, code?: string): AppError {
    return new AppError(409, message, code);
  }

  static unprocessable(message: string, code?: string): AppError {
    return new AppError(422, message, code);
  }

  static internal(message = "Internal server error", code?: string): AppError {
    return new AppError(500, message, code);
  }
}

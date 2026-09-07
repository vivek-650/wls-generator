import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";
import { MulterError } from "multer";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { message: "Not found" } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { message: err.message, ...(err.code ? { code: err.code } : {}) } });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join(".") || "body"}: ${e.message}`).join("; ");
    res.status(400).json({ error: { message, code: "VALIDATION_ERROR" } });
    return;
  }

  if (err instanceof MulterError) {
    res.status(400).json({ error: { message: err.message, code: err.code } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: "Internal server error" } });
}

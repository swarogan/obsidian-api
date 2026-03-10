import type { Request, Response, NextFunction } from "express";
import { ErrorCode, ApiError } from "../types";
import { ERROR_MESSAGES } from "../constants";

export function errorHandler(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log full error internally
  console.error("[obsidian-api] Error:", err.message, err.stack);

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      errorCode: ErrorCode.InvalidContentType,
      message: "Malformed request body.",
    });
    return;
  }

  if (err instanceof ApiError) {
    const httpStatus = Math.floor(err.errorCode / 100);
    const body: Record<string, unknown> = {
      errorCode: err.errorCode,
      message: err.message,
    };
    if (err.details) {
      body.details = err.details;
    }
    res.status(httpStatus).json(body);
    return;
  }

  const httpStatus = err.status ?? 500;
  const defaultMessage = ERROR_MESSAGES[ErrorCode.InternalError];

  res.status(httpStatus).json({
    errorCode: ErrorCode.InternalError,
    message: defaultMessage,
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    errorCode: ErrorCode.FileNotFound,
    message: "Endpoint not found.",
  });
}

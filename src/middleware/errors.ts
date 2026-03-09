import type { Request, Response, NextFunction } from "express";
import { ErrorCode } from "../types";
import { ERROR_MESSAGES } from "../constants";

export function errorHandler(
  err: Error & { errorCode?: ErrorCode; details?: Record<string, unknown>; status?: number },
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

  const errorCode = err.errorCode ?? ErrorCode.InternalError;
  const httpStatus = err.status ?? Math.floor(errorCode / 100);
  const defaultMessage = ERROR_MESSAGES[errorCode] ?? "An internal error occurred.";

  const body: Record<string, unknown> = {
    errorCode,
    message: err.errorCode ? err.message : defaultMessage,
  };

  if (err.details) {
    body.details = err.details;
  }

  res.status(httpStatus).json(body);
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    errorCode: 40400,
    message: "Endpoint not found.",
  });
}

import type { Response } from "express";
import { ErrorCode, type ResponseServiceInterface } from "../types";
import { ERROR_MESSAGES } from "../constants";

export class ResponseService implements ResponseServiceInterface {
  sendSuccess(res: Response, data: unknown, status = 200): void {
    res.status(status).json(data);
  }

  sendError(
    res: Response,
    errorCode: ErrorCode,
    message?: string,
    details?: Record<string, unknown>,
  ): void {
    const httpStatus = Math.floor(errorCode / 100);
    const defaultMessage = ERROR_MESSAGES[errorCode] ?? "Unknown error.";

    const body: Record<string, unknown> = {
      errorCode,
      message: message ?? defaultMessage,
    };

    if (details) {
      body.details = details;
    }

    res.status(httpStatus).json(body);
  }

  sendFile(res: Response, content: string | ArrayBuffer, contentType: string): void {
    res.setHeader("Content-Type", contentType);
    if (typeof content === "string") {
      res.send(content);
    } else {
      res.send(Buffer.from(content));
    }
  }
}

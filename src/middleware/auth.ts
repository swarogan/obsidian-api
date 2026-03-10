import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { CERT_NAME } from "../constants";
import { ErrorCode } from "../types";

const PUBLIC_PATHS = new Set(["/", `/${CERT_NAME}`, "/openapi.yaml"]);

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

export function createAuthMiddleware(getApiKey: () => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (PUBLIC_PATHS.has(req.path)) {
      next();
      return;
    }

    const token = extractBearerToken(req);

    if (!token || !verifyApiKey(token, getApiKey())) {
      res.status(401).json({
        errorCode: ErrorCode.ApiKeyAuthorizationRequired,
        message: "API key authorization is required.",
      });
      return;
    }

    next();
  };
}

export function isAuthenticated(req: Request, apiKey: string): boolean {
  const token = extractBearerToken(req);
  if (!token) return false;
  return verifyApiKey(token, apiKey);
}

export function verifyApiKey(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length) {
    // Still do a comparison to avoid timing leaks on length differences
    const dummy = Buffer.alloc(b.length);
    timingSafeEqual(dummy, b);
    return false;
  }

  return timingSafeEqual(a, b);
}

import type { Request, Response, NextFunction } from "express";

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      console.warn(
        `[obsidian-api] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`,
      );
    }
  });

  next();
}

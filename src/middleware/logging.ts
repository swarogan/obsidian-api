import type { Request, Response, NextFunction } from "express";

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[obsidian-api] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
}

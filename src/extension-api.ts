import express from "express";
import type { Response, IRoute } from "express";
import type { TFile, CachedMetadata } from "obsidian";
import type { HandlerContext, FileMetadataObject } from "./types";
import { ErrorCode } from "./types";

export class ExtensionApi {
  private readonly router: express.Router;
  private readonly parentRouter: express.Router;

  constructor(
    private readonly ctx: HandlerContext,
    parentRouter: express.Router,
  ) {
    this.router = express.Router();
    this.parentRouter = parentRouter;
    parentRouter.use(this.router);
  }

  addRoute(path: string): IRoute {
    return this.router.route(path);
  }

  resolveFile(nameOrPath: string): TFile | null {
    return this.ctx.resolver.resolve(nameOrPath);
  }

  async getFileMetadata(file: TFile): Promise<FileMetadataObject> {
    return this.ctx.metadata.getFileMetadata(file);
  }

  async waitForFileCache(file: TFile, timeoutMs?: number): Promise<CachedMetadata | null> {
    return this.ctx.metadata.waitForFileCache(file, timeoutMs);
  }

  sendSuccess(res: Response, data: unknown, status?: number): void {
    this.ctx.respond.sendSuccess(res, data, status);
  }

  sendError(res: Response, code: ErrorCode, message?: string): void {
    this.ctx.respond.sendError(res, code, message);
  }

  get ErrorCode(): typeof ErrorCode {
    return ErrorCode;
  }

  unregister(): void {
    const stack = (this.parentRouter as any).stack;
    if (Array.isArray(stack)) {
      const idx = stack.findIndex(
        (layer: any) => layer.handle === this.router,
      );
      if (idx !== -1) {
        stack.splice(idx, 1);
      }
    }
  }
}

export function getAPI(
  ctx: HandlerContext,
  parentRouter: express.Router,
): ExtensionApi {
  return new ExtensionApi(ctx, parentRouter);
}

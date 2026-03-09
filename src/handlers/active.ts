import type { Router } from "express";
import type { HandlerContext } from "../types";
import { ErrorCode } from "../types";
import { vaultGet, vaultPut, vaultPost, vaultPatch, vaultDelete } from "./vault";

export function register(router: Router, ctx: HandlerContext): void {
  const methods = ["get", "put", "post", "patch", "delete"] as const;
  const handlers = { get: vaultGet, put: vaultPut, post: vaultPost, patch: vaultPatch, delete: vaultDelete };

  for (const method of methods) {
    router[method]("/active/", async (req, res) => {
      const activeFile = ctx.app.workspace.getActiveFile();
      if (!activeFile) {
        ctx.respond.sendError(res, ErrorCode.ActiveFileNotFound);
        return;
      }

      res.setHeader("Content-Location", `/vault/${activeFile.path}`);
      await handlers[method](ctx, req, res, activeFile.path);
    });
  }
}

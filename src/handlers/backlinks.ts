import type { Router } from "express";
import type { HandlerContext } from "../types";
import { ErrorCode } from "../types";
import { getSplatPath } from "./vault";

interface BacklinkItem {
  source: string;
  displayText: string;
  line: number;
  context: string;
}

export function register(router: Router, ctx: HandlerContext): void {
  router.get("/backlinks/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    const limit = Number(req.query.limit) || 0;

    const targetFile = ctx.app.vault.getFileByPath(filePath);
    if (!targetFile) {
      ctx.respond.sendError(res, ErrorCode.FileNotFound);
      return;
    }

    const targetBasename = targetFile.basename;
    const targetPath = targetFile.path;
    const backlinks: BacklinkItem[] = [];
    const allFiles = ctx.app.vault.getMarkdownFiles();

    for (const file of allFiles) {
      if (file.path === targetPath) continue;

      const cache = ctx.app.metadataCache.getFileCache(file);
      if (!cache?.links) continue;

      for (const link of cache.links) {
        const resolved = ctx.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        const matches = resolved?.path === targetPath || link.link === targetBasename;

        if (matches) {
          const content = await ctx.app.vault.cachedRead(file);
          const lines = content.split("\n");
          const line = link.position.start.line;
          const context = lines[line] ?? "";

          backlinks.push({
            source: file.path,
            displayText: link.displayText ?? link.link,
            line,
            context: context.trim(),
          });
        }
      }
    }

    const result = limit > 0 ? backlinks.slice(0, limit) : backlinks;
    ctx.respond.sendSuccess(res, {
      file: targetPath,
      backlinks: result,
      total: backlinks.length,
    });
  });
}

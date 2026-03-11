import type { Router } from "express";
import type { HandlerContext } from "../types";
import { ErrorCode } from "../types";
import { getSplatPath } from "./vault";

interface LinkItem {
  link: string;
  displayText: string;
  line: number;
  resolved: boolean;
  resolvedPath: string | null;
}

interface EmbedItem {
  link: string;
  line: number;
  resolved: boolean;
  resolvedPath: string | null;
}

export function register(router: Router, ctx: HandlerContext): void {
  router.get("/links/*splat", (req, res) => {
    const filePath = getSplatPath(req);
    const limit = Number(req.query.limit) || 0;
    const resolvedFilter = req.query.resolved;

    const file = ctx.app.vault.getFileByPath(filePath);
    if (!file) {
      ctx.respond.sendError(res, ErrorCode.FileNotFound);
      return;
    }

    const cache = ctx.app.metadataCache.getFileCache(file);

    let links: LinkItem[] = (cache?.links ?? []).map((l) => {
      const dest = ctx.app.metadataCache.getFirstLinkpathDest(l.link, file.path);
      return {
        link: l.link,
        displayText: l.displayText ?? l.link,
        line: l.position.start.line,
        resolved: dest !== null,
        resolvedPath: dest?.path ?? null,
      };
    });

    let embeds: EmbedItem[] = (cache?.embeds ?? []).map((e) => {
      const dest = ctx.app.metadataCache.getFirstLinkpathDest(e.link, file.path);
      return {
        link: e.link,
        line: e.position.start.line,
        resolved: dest !== null,
        resolvedPath: dest?.path ?? null,
      };
    });

    if (resolvedFilter === "true") {
      links = links.filter((l) => l.resolved);
      embeds = embeds.filter((e) => e.resolved);
    } else if (resolvedFilter === "false") {
      links = links.filter((l) => !l.resolved);
      embeds = embeds.filter((e) => !e.resolved);
    }

    const total = links.length + embeds.length;

    if (limit > 0) {
      links = links.slice(0, limit);
      embeds = embeds.slice(0, limit);
    }

    ctx.respond.sendSuccess(res, { file: filePath, links, embeds, total });
  });
}

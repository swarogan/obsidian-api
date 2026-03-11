import type { Router } from "express";
import type { HandlerContext } from "../types";
import { ErrorCode } from "../types";
import { getSplatPath } from "./vault";

interface PropertyInfo {
  count: number;
}

export function register(router: Router, ctx: HandlerContext): void {
  // List all properties across vault
  router.get("/properties/", (req, res) => {
    const sort = req.query.sort === "count" ? "count" : "name";
    const limit = Number(req.query.limit) || 0;

    const propMap = new Map<string, PropertyInfo>();
    const files = ctx.app.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = ctx.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;

      for (const key of Object.keys(cache.frontmatter)) {
        if (key === "position") continue;

        if (!propMap.has(key)) {
          propMap.set(key, { count: 0 });
        }
        propMap.get(key)!.count++;
      }
    }

    const entries = [...propMap.entries()].map(([name, info]) => ({
      name,
      count: info.count,
    }));

    if (sort === "count") {
      entries.sort((a, b) => b.count - a.count);
    } else {
      entries.sort((a, b) => a.name.localeCompare(b.name));
    }

    const result = limit > 0 ? entries.slice(0, limit) : entries;
    ctx.respond.sendSuccess(res, { properties: result, total: propMap.size });
  });

  // Get properties of a specific file
  router.get("/properties/*splat", (req, res) => {
    const filePath = getSplatPath(req);
    const file = ctx.app.vault.getFileByPath(filePath);
    if (!file) {
      ctx.respond.sendError(res, ErrorCode.FileNotFound);
      return;
    }

    const cache = ctx.app.metadataCache.getFileCache(file);
    const frontmatter = { ...cache?.frontmatter };
    delete frontmatter.position;

    ctx.respond.sendSuccess(res, { file: filePath, properties: frontmatter });
  });

  // Set a property on a file
  router.put("/properties/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    const file = ctx.app.vault.getFileByPath(filePath);
    if (!file) {
      ctx.respond.sendError(res, ErrorCode.FileNotFound);
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const name = body?.name;
    const value = body?.value;

    if (!name) {
      ctx.respond.sendError(res, ErrorCode.MissingRequiredField, "Field 'name' is required.");
      return;
    }

    await ctx.app.fileManager.processFrontMatter(file, (fm) => {
      fm[name] = value;
    });

    res.status(204).send();
  });

  // Delete a property from a file
  router.delete("/properties/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    const file = ctx.app.vault.getFileByPath(filePath);
    if (!file) {
      ctx.respond.sendError(res, ErrorCode.FileNotFound);
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const name = body?.name;

    if (!name) {
      ctx.respond.sendError(res, ErrorCode.MissingRequiredField, "Field 'name' is required.");
      return;
    }

    await ctx.app.fileManager.processFrontMatter(file, (fm) => {
      delete fm[name];
    });

    res.status(204).send();
  });
}

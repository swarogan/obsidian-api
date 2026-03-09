import type { Router, Request, Response } from "express";
import type { HandlerContext, SearchResponseItem, SearchJsonResponseItem } from "../types";
import { ErrorCode } from "../types";
import { CONTENT_TYPES } from "../constants";
import { prepareSimpleSearch } from "obsidian";

export function register(router: Router, ctx: HandlerContext): void {
  router.post("/search/", async (req, res) => {
    await searchQuery(ctx, req, res);
  });

  router.post("/search/simple/", async (req, res) => {
    await searchSimple(ctx, req, res);
  });
}

async function searchQuery(
  ctx: HandlerContext,
  req: Request,
  res: Response,
): Promise<void> {
  const contentType = req.headers["content-type"] ?? "";

  if (contentType.includes(CONTENT_TYPES.dataviewDql)) {
    await searchDataview(ctx, req, res);
    return;
  }

  if (
    contentType.includes(CONTENT_TYPES.jsonLogic) ||
    contentType.includes("application/json")
  ) {
    await searchJsonLogic(ctx, req, res);
    return;
  }

  ctx.respond.sendError(
    res,
    ErrorCode.ContentTypeSpecificationRequired,
    "Content-Type must be application/vnd.olrapi.dataview.dql+txt or application/vnd.olrapi.jsonlogic+json",
  );
}

async function searchDataview(
  ctx: HandlerContext,
  req: Request,
  res: Response,
): Promise<void> {
  const query = typeof req.body === "string" ? req.body : String(req.body);

  try {
    const dataviewApi = (ctx.app as any).plugins?.plugins?.dataview?.api;
    if (!dataviewApi) {
      ctx.respond.sendError(
        res,
        ErrorCode.SearchFailed,
        "Dataview plugin is not available.",
      );
      return;
    }

    const result = await dataviewApi.tryQuery(query);
    if (!result.successful) {
      ctx.respond.sendError(res, ErrorCode.InvalidSearchQuery, result.error);
      return;
    }

    const items: SearchJsonResponseItem[] = [];
    if (result.value?.values) {
      for (const row of result.value.values) {
        if (row.length > 0) {
          const filename = String(row[0]?.path ?? row[0] ?? "");
          const resultData: Record<string, unknown> = {};
          const headers = result.value.headers ?? [];
          for (let i = 1; i < row.length; i++) {
            resultData[headers[i] ?? `col${i}`] = row[i];
          }
          items.push({ filename, result: resultData });
        }
      }
    }

    ctx.respond.sendSuccess(res, items);
  } catch (e: unknown) {
    ctx.respond.sendError(
      res,
      ErrorCode.SearchFailed,
      e instanceof Error ? e.message : "Search failed.",
    );
  }
}

async function searchJsonLogic(
  ctx: HandlerContext,
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const jsonLogic = await import("json-logic-js");
    const apply = jsonLogic.default?.apply ?? jsonLogic.apply;

    const rule = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const files = ctx.app.vault.getMarkdownFiles();
    const results: SearchJsonResponseItem[] = [];

    for (const file of files) {
      const metadata = await ctx.metadata.getFileMetadata(file);
      const matches = apply(rule, metadata);
      if (matches) {
        results.push({ filename: file.path, result: metadata });
      }
    }

    ctx.respond.sendSuccess(res, results);
  } catch (e: unknown) {
    ctx.respond.sendError(
      res,
      ErrorCode.SearchFailed,
      e instanceof Error ? e.message : "Search failed.",
    );
  }
}

async function searchSimple(
  ctx: HandlerContext,
  req: Request,
  res: Response,
): Promise<void> {
  const query = typeof req.body === "string" ? req.body : String(req.body);

  if (!query.trim()) {
    ctx.respond.sendError(res, ErrorCode.InvalidSearchQuery, "Query cannot be empty.");
    return;
  }

  try {
    const searchFn = prepareSimpleSearch(query);
    const files = ctx.app.vault.getMarkdownFiles();
    const results: SearchResponseItem[] = [];
    const contextLength = Number(req.query.contextLength) || 100;

    for (const file of files) {
      const content = await ctx.app.vault.cachedRead(file);
      const searchTarget = file.path + "\n" + content;
      const matchResult = searchFn(searchTarget);

      if (matchResult) {
        const filePathLength = file.path.length + 1; // +1 for newline
        const matches = matchResult.matches
          .filter(([start, end]) => start >= filePathLength || end <= file.path.length)
          .map(([start, end]) => {
            const adjustedStart = Math.max(0, start - filePathLength);
            const adjustedEnd = Math.max(0, end - filePathLength);
            const contextStart = Math.max(0, adjustedStart - contextLength);
            const contextEnd = Math.min(content.length, adjustedEnd + contextLength);
            return {
              match: { start: adjustedStart, end: adjustedEnd },
              context: content.slice(contextStart, contextEnd),
            };
          });

        results.push({
          filename: file.path,
          score: matchResult.score,
          matches,
        });
      }
    }

    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    ctx.respond.sendSuccess(res, results);
  } catch (e: unknown) {
    ctx.respond.sendError(
      res,
      ErrorCode.SearchFailed,
      e instanceof Error ? e.message : "Search failed.",
    );
  }
}

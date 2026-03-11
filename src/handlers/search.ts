import type { Router, Request, Response } from "express";
import type { HandlerContext, SearchResponseItem, SearchJsonResponseItem, ObsidianAppInternal } from "../types";
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

  router.post("/search/smart", async (req, res) => {
    await searchSmart(ctx, req, res);
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
    contentType.includes(CONTENT_TYPES.json)
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
    const appInternal = ctx.app as unknown as ObsidianAppInternal;
    const dataviewApi = appInternal.plugins?.plugins?.dataview?.api;
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
  const bodyQuery = typeof req.body === "string" && req.body.trim() ? req.body : "";
  const queryParam = typeof req.query.query === "string" ? req.query.query : "";
  const query = bodyQuery || queryParam;
  const contextLength = Number(req.query.contextLength) || 100;

  if (!query.trim()) {
    ctx.respond.sendError(res, ErrorCode.InvalidSearchQuery, "Query cannot be empty.");
    return;
  }

  try {
    const searchFn = prepareSimpleSearch(query);
    const files = ctx.app.vault.getMarkdownFiles();
    const results: SearchResponseItem[] = [];

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

interface SmartSearchResult {
  path: string;
  text: string;
  score: number;
  breadcrumbs: string;
}

async function searchSmart(
  ctx: HandlerContext,
  req: Request,
  res: Response,
): Promise<void> {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const query = String(body?.query ?? "");
  const filter = body?.filter ?? {};

  if (!query.trim()) {
    ctx.respond.sendError(res, ErrorCode.InvalidSearchQuery, "Query cannot be empty.");
    return;
  }

  try {
    const appInternal = ctx.app as unknown as ObsidianAppInternal;
    const smartConnections = appInternal.plugins?.plugins?.["smart-connections"];
    if (!smartConnections) {
      ctx.respond.sendError(
        res,
        ErrorCode.SearchFailed,
        "Smart Connections plugin is not available. Install and enable it for semantic search.",
      );
      return;
    }

    const env = smartConnections.env;
    if (!env?.smart_sources) {
      ctx.respond.sendError(
        res,
        ErrorCode.SearchFailed,
        "Smart Connections is not fully initialized. Wait for indexing to complete.",
      );
      return;
    }

    const lookupResults = await env.smart_sources.lookup({ hypotheticals: [query] });
    const limit = filter.limit ?? 50;
    const folders: string[] | undefined = filter.folders;
    const excludeFolders: string[] | undefined = filter.excludeFolders;

    const results: SmartSearchResult[] = [];

    for (const item of lookupResults) {
      if (results.length >= limit) break;

      const itemPath = String(item.item?.path ?? item.path ?? "");
      if (!itemPath) continue;

      // Apply folder filters
      if (folders?.length && !folders.some((f) => itemPath.startsWith(f))) continue;
      if (excludeFolders?.length && excludeFolders.some((f) => itemPath.startsWith(f))) continue;

      const parts = itemPath.replace(/\.md$/, "").split("/");
      results.push({
        path: itemPath,
        text: String(item.item?.name ?? item.name ?? parts[parts.length - 1] ?? ""),
        score: Number(item.score ?? item.sim ?? 0),
        breadcrumbs: parts.join(" > "),
      });
    }

    ctx.respond.sendSuccess(res, { results });
  } catch (e: unknown) {
    ctx.respond.sendError(
      res,
      ErrorCode.SearchFailed,
      e instanceof Error ? e.message : "Smart search failed.",
    );
  }
}

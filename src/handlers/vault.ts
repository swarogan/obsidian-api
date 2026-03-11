import type { Router, Request, Response } from "express";
import type { HandlerContext, SplatParams } from "../types";
import { ErrorCode } from "../types";
import { CONTENT_TYPES } from "../constants";
import { extractPatchParams, applyPatch } from "../services/patch";
import { lookup } from "mime-types";
import type { TFile } from "obsidian";

export function register(router: Router, ctx: HandlerContext): void {
  // /vault/ (root listing) - Express 5 *splat doesn't match empty path
  router.get("/vault/", async (req, res) => {
    await vaultGet(ctx, req, res, "");
  });

  router.get("/vault/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    await vaultGet(ctx, req, res, filePath);
  });

  router.put("/vault/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    await vaultPut(ctx, req, res, filePath);
  });

  router.post("/vault/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    await vaultPost(ctx, req, res, filePath);
  });

  router.patch("/vault/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    await vaultPatch(ctx, req, res, filePath);
  });

  router.delete("/vault/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    await vaultDelete(ctx, req, res, filePath);
  });
}

export function getSplatPath(req: Request): string {
  // Express 5 splat param
  const splat = (req.params as unknown as SplatParams).splat;
  if (Array.isArray(splat)) return splat.join("/");
  return String(splat ?? "");
}

export async function vaultGet(
  ctx: HandlerContext,
  req: Request,
  res: Response,
  filePath: string,
): Promise<void> {
  // Directory listing
  if (filePath.endsWith("/") || filePath === "") {
    const dirPath = filePath.replace(/\/$/, "");
    const files = listDirectory(ctx, dirPath);
    ctx.respond.sendSuccess(res, { files });
    return;
  }

  const file = ctx.app.vault.getFileByPath(filePath);
  if (!file) {
    ctx.respond.sendError(res, ErrorCode.FileNotFound);
    return;
  }

  const accept = req.headers.accept ?? "";

  if (accept.includes(CONTENT_TYPES.noteJson)) {
    const metadata = await ctx.metadata.getFileMetadata(file);
    ctx.respond.sendSuccess(res, metadata);
    return;
  }

  if (accept.includes(CONTENT_TYPES.documentMap)) {
    const cache = await ctx.metadata.waitForFileCache(file);
    const docMap = ctx.metadata.getDocumentMap(cache);
    ctx.respond.sendSuccess(res, docMap);
    return;
  }

  const content = await ctx.app.vault.cachedRead(file);
  const contentType = lookup(file.extension) || "application/octet-stream";
  res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
  ctx.respond.sendFile(res, content, contentType);
}

export async function vaultPut(
  ctx: HandlerContext,
  _req: Request,
  res: Response,
  filePath: string,
): Promise<void> {
  if (filePath.endsWith("/")) {
    ctx.respond.sendError(res, ErrorCode.RequestMethodValidOnlyForFiles);
    return;
  }

  const content = getBodyAsString(_req);

  // Create parent directories if needed
  const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
  if (dirPath) {
    await ensureDirectory(ctx, dirPath);
  }

  const existing = ctx.app.vault.getFileByPath(filePath);
  if (existing) {
    await ctx.app.vault.modify(existing, content);
  } else {
    await ctx.app.vault.create(filePath, content);
  }

  res.status(204).send();
}

export async function vaultPost(
  ctx: HandlerContext,
  req: Request,
  res: Response,
  filePath: string,
): Promise<void> {
  if (filePath.endsWith("/")) {
    ctx.respond.sendError(res, ErrorCode.RequestMethodValidOnlyForFiles);
    return;
  }

  const content = getBodyAsString(req);
  const file = ctx.app.vault.getFileByPath(filePath);

  if (!file) {
    ctx.respond.sendError(res, ErrorCode.FileNotFound);
    return;
  }

  const existing = await ctx.app.vault.cachedRead(file);
  const separator = existing.endsWith("\n") || existing === "" ? "" : "\n";
  await ctx.app.vault.modify(file, existing + separator + content);

  res.status(204).send();
}

export async function vaultPatch(
  ctx: HandlerContext,
  req: Request,
  res: Response,
  filePath: string,
): Promise<void> {
  if (filePath.endsWith("/")) {
    ctx.respond.sendError(res, ErrorCode.RequestMethodValidOnlyForFiles);
    return;
  }

  const file = ctx.app.vault.getFileByPath(filePath);
  if (!file) {
    ctx.respond.sendError(res, ErrorCode.FileNotFound);
    return;
  }

  const params = extractPatchParams(req);
  const result = await applyPatch(ctx.app, file, params);

  res.status(200).send(result);
}

export async function vaultDelete(
  ctx: HandlerContext,
  _req: Request,
  res: Response,
  filePath: string,
): Promise<void> {
  const file = ctx.app.vault.getFileByPath(filePath);
  if (!file) {
    ctx.respond.sendError(res, ErrorCode.FileNotFound);
    return;
  }

  await ctx.app.fileManager.trashFile(file);
  res.status(204).send();
}

function listDirectory(ctx: HandlerContext, dirPath: string): string[] {
  const files = ctx.app.vault.getFiles();
  const prefix = dirPath ? dirPath + "/" : "";

  return files
    .filter((f) => f.path.startsWith(prefix))
    .map((f) => f.path)
    .sort();
}

function getBodyAsString(req: Request): string {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  return String(req.body ?? "");
}

async function ensureDirectory(ctx: HandlerContext, dirPath: string): Promise<void> {
  const existing = ctx.app.vault.getAbstractFileByPath(dirPath);
  if (existing) return;

  await ctx.app.vault.createFolder(dirPath);
}

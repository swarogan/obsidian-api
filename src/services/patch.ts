import type { App, CachedMetadata, TFile } from "obsidian";
import type { PatchParams, PatchErrorDetails, DocumentMapObject } from "../types";
import { ErrorCode, ApiError } from "../types";
import { MetadataService } from "./metadata";
import type { Request } from "express";

export function extractPatchParams(req: Request): PatchParams {
  const contentType = req.headers["content-type"] ?? "";
  const isJsonBody =
    contentType.includes("application/json") &&
    req.body &&
    typeof req.body === "object" &&
    "operation" in req.body;

  if (isJsonBody) {
    return extractFromBody(req.body);
  }
  return extractFromHeaders(req);
}

function extractFromBody(body: Record<string, unknown>): PatchParams {
  const operation = validateOperation(String(body.operation ?? ""));
  const targetType = validateTargetType(String(body.targetType ?? ""));
  const target = String(body.target ?? "");
  const content = String(body.content ?? "");
  const targetDelimiter = String(body.targetDelimiter ?? "::");
  const createTargetIfMissing = Boolean(body.createTargetIfMissing ?? false);
  const trimTargetWhitespace = Boolean(body.trimTargetWhitespace ?? false);

  return { operation, targetType, target, content, targetDelimiter, createTargetIfMissing, trimTargetWhitespace };
}

function extractFromHeaders(req: Request): PatchParams {
  const operation = validateOperation(String(req.headers["operation"] ?? ""));
  const targetType = validateTargetType(String(req.headers["target-type"] ?? ""));
  const rawTarget = String(req.headers["target"] ?? "");
  const target = decodeURIComponent(rawTarget);
  const targetDelimiter = String(req.headers["target-delimiter"] ?? "::");
  const createTargetIfMissing = req.headers["create-target-if-missing"] === "true";
  const trimTargetWhitespace = req.headers["trim-target-whitespace"] === "true";

  const content = typeof req.body === "string" ? req.body : String(req.body ?? "");

  return { operation, targetType, target, content, targetDelimiter, createTargetIfMissing, trimTargetWhitespace };
}

function validateOperation(op: string): PatchParams["operation"] {
  if (op === "append" || op === "prepend" || op === "replace") return op;
  throw new ApiError(`Invalid operation: "${op}"`, ErrorCode.InvalidOperation);
}

function validateTargetType(tt: string): PatchParams["targetType"] {
  if (tt === "heading" || tt === "block" || tt === "frontmatter") return tt;
  throw new ApiError(`Invalid target type: "${tt}"`, ErrorCode.InvalidTargetType);
}

export async function applyPatch(
  app: App,
  file: TFile,
  params: PatchParams,
): Promise<string> {
  if (params.targetType === "frontmatter") {
    await patchFrontmatter(app, file, params);
    return await app.vault.cachedRead(file);
  }

  const fileContent = await app.vault.cachedRead(file);
  const cache = app.metadataCache.getFileCache(file);

  if (!cache) {
    throw createPatchError("No metadata cache available for file.", params.target);
  }

  const target = params.trimTargetWhitespace ? params.target.trim() : params.target;

  let bounds: { contentStart: number; contentEnd: number } | null;

  if (params.targetType === "heading") {
    const headingPath = target.split(params.targetDelimiter);
    bounds = findHeadingBounds(cache, headingPath, fileContent);
  } else {
    bounds = findBlockBounds(cache, target, fileContent);
  }

  if (!bounds) {
    if (params.createTargetIfMissing && params.targetType === "heading") {
      const patched = createMissingHeading(fileContent, params);
      await app.vault.modify(file, patched);
      return patched;
    }

    const docMap = MetadataService.buildDocumentMap(cache);
    const err = createPatchError(
      `Target "${target}" not found in document.`,
      target,
      docMap,
    );
    throw err;
  }

  const patched = patchContent(fileContent, bounds, params.operation, params.content);
  await app.vault.modify(file, patched);
  return patched;
}

export function findHeadingBounds(
  cache: CachedMetadata,
  headingPath: string[],
  fileContent: string,
): { contentStart: number; contentEnd: number } | null {
  const headings = cache.headings ?? [];
  if (headings.length === 0 || headingPath.length === 0) return null;

  let currentScope = 0;
  let targetIndex = -1;
  let targetLevel = -1;

  // Navigate nested heading path
  for (let pathIdx = 0; pathIdx < headingPath.length; pathIdx++) {
    const targetName = headingPath[pathIdx].trim();
    const isLast = pathIdx === headingPath.length - 1;
    let found = false;

    for (let i = currentScope; i < headings.length; i++) {
      if (headings[i].heading.trim() === targetName) {
        if (isLast) {
          targetIndex = i;
          targetLevel = headings[i].level;
          found = true;
          break;
        } else {
          // Move scope to after this heading for next path segment
          currentScope = i + 1;
          found = true;
          break;
        }
      }
    }

    if (!found) return null;
  }

  if (targetIndex === -1) return null;

  const lines = fileContent.split("\n");
  const headingLine = headings[targetIndex].position.start.line;

  // Content starts on the line after the heading
  const contentStart = lineToOffset(lines, headingLine + 1);

  // Content ends at the next heading of same or higher level, or end of file
  let contentEnd = fileContent.length;
  for (let i = targetIndex + 1; i < headings.length; i++) {
    if (headings[i].level <= targetLevel) {
      contentEnd = lineToOffset(lines, headings[i].position.start.line);
      break;
    }
  }

  return { contentStart, contentEnd };
}

export function findBlockBounds(
  cache: CachedMetadata,
  blockId: string,
  fileContent: string,
): { contentStart: number; contentEnd: number } | null {
  const blocks = cache.blocks;
  if (!blocks) return null;

  const block = blocks[blockId];
  if (!block) return null;

  const lines = fileContent.split("\n");
  const contentStart = lineToOffset(lines, block.position.start.line);
  const contentEnd = lineToOffset(lines, block.position.end.line) +
    lines[block.position.end.line].length;

  return { contentStart, contentEnd };
}

async function patchFrontmatter(
  app: App,
  file: TFile,
  params: PatchParams,
): Promise<void> {
  let value: unknown;
  try {
    value = JSON.parse(params.content);
  } catch {
    value = params.content;
  }

  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    const key = params.target;

    switch (params.operation) {
      case "replace":
        frontmatter[key] = value;
        break;
      case "append":
        if (Array.isArray(frontmatter[key])) {
          const items = Array.isArray(value) ? value : [value];
          frontmatter[key].push(...items);
        } else if (frontmatter[key] === undefined) {
          frontmatter[key] = value;
        } else {
          frontmatter[key] = String(frontmatter[key]) + String(value);
        }
        break;
      case "prepend":
        if (Array.isArray(frontmatter[key])) {
          const items = Array.isArray(value) ? value : [value];
          frontmatter[key].unshift(...items);
        } else if (frontmatter[key] === undefined) {
          frontmatter[key] = value;
        } else {
          frontmatter[key] = String(value) + String(frontmatter[key]);
        }
        break;
    }
  });
}

export function patchContent(
  fileContent: string,
  bounds: { contentStart: number; contentEnd: number },
  operation: PatchParams["operation"],
  newContent: string,
): string {
  const before = fileContent.slice(0, bounds.contentStart);
  const existing = fileContent.slice(bounds.contentStart, bounds.contentEnd);
  const after = fileContent.slice(bounds.contentEnd);

  switch (operation) {
    case "append":
      return before + existing + ensureTrailingNewline(newContent) + after;
    case "prepend":
      return before + ensureTrailingNewline(newContent) + existing + after;
    case "replace":
      return before + ensureTrailingNewline(newContent) + after;
  }
}

function createMissingHeading(fileContent: string, params: PatchParams): string {
  const headingPath = params.target.split(params.targetDelimiter);
  const headingText = headingPath[headingPath.length - 1].trim();
  // Default to level 2 for auto-created headings
  const level = Math.min(headingPath.length + 1, 6);
  const heading = `${"#".repeat(level)} ${headingText}`;

  const separator = fileContent.endsWith("\n") ? "\n" : "\n\n";
  return fileContent + separator + heading + "\n" + params.content + "\n";
}

function lineToOffset(lines: string[], lineNumber: number): number {
  let offset = 0;
  for (let i = 0; i < lineNumber && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  return offset;
}

function ensureTrailingNewline(content: string): string {
  if (content.length === 0) return content;
  return content.endsWith("\n") ? content : content + "\n";
}

function createPatchError(
  message: string,
  targetRequested: string,
  documentMap?: DocumentMapObject,
): ApiError {
  const details: PatchErrorDetails = {
    targetRequested,
    ...(documentMap && { documentMap }),
    ...(documentMap && {
      availableTargets: [
        ...documentMap.headings,
        ...documentMap.blocks.map((b) => `^${b}`),
        ...documentMap.frontmatterFields,
      ],
    }),
  };
  return new ApiError(message, ErrorCode.TargetNotFound, details);
}

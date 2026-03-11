import type { Router } from "express";
import type { HandlerContext } from "../types";

interface TagInfo {
  count: number;
  files: { path: string; source: "frontmatter" | "inline" }[];
}

export function register(router: Router, ctx: HandlerContext): void {
  router.get("/tags/", (_req, res) => {
    const tagMap = buildTagMap(ctx);

    const sort = _req.query.sort === "count" ? "count" : "name";
    const limit = Number(_req.query.limit) || 0;

    const entries = Object.entries(tagMap);
    if (sort === "count") {
      entries.sort((a, b) => b[1].count - a[1].count);
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }

    const limited = limit > 0 ? entries.slice(0, limit) : entries;
    const tags: Record<string, number> = {};
    for (const [tag, info] of limited) {
      tags[tag] = info.count;
    }

    ctx.respond.sendSuccess(res, { tags, total: Object.keys(tagMap).length });
  });

  router.get("/tags/:tag", (req, res) => {
    const tagMap = buildTagMap(ctx);
    const tagName = req.params.tag;
    const info = tagMap[tagName];

    if (!info) {
      ctx.respond.sendSuccess(res, { tag: tagName, files: [], total: 0 });
      return;
    }

    const limit = Number(req.query.limit) || 0;
    const files = limit > 0 ? info.files.slice(0, limit) : info.files;

    ctx.respond.sendSuccess(res, { tag: tagName, files, total: info.count });
  });
}

function buildTagMap(ctx: HandlerContext): Record<string, TagInfo> {
  const tagMap: Record<string, TagInfo> = {};
  const files = ctx.app.vault.getMarkdownFiles();

  for (const file of files) {
    const cache = ctx.app.metadataCache.getFileCache(file);
    if (!cache) continue;

    // Frontmatter tags
    const fmTags = cache.frontmatter?.tags;
    if (Array.isArray(fmTags)) {
      for (const t of fmTags) {
        if (t) addTag(tagMap, String(t), file.path, "frontmatter");
      }
    } else if (typeof fmTags === "string" && fmTags) {
      addTag(tagMap, fmTags, file.path, "frontmatter");
    }

    // Inline tags
    if (cache.tags) {
      for (const t of cache.tags) {
        const name = t.tag.replace(/^#/, "");
        addTag(tagMap, name, file.path, "inline");
      }
    }
  }

  return tagMap;
}

function addTag(
  map: Record<string, TagInfo>,
  tag: string,
  path: string,
  source: "frontmatter" | "inline",
): void {
  if (!map[tag]) {
    map[tag] = { count: 0, files: [] };
  }
  // Avoid duplicate file entries for same tag
  if (!map[tag].files.some((f) => f.path === path && f.source === source)) {
    map[tag].files.push({ path, source });
    map[tag].count++;
  }
}

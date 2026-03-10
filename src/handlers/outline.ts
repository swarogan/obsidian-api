import type { Router } from "express";
import type { HandlerContext } from "../types";
import { ErrorCode } from "../types";
import { getSplatPath } from "./vault";

interface FlatHeading {
  heading: string;
  level: number;
  line: number;
}

interface TreeHeading {
  heading: string;
  level: number;
  line: number;
  children: TreeHeading[];
}

export function register(router: Router, ctx: HandlerContext): void {
  router.get("/outline/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    const format = req.query.format === "tree" ? "tree" : "flat";

    const file = ctx.app.vault.getFileByPath(filePath);
    if (!file) {
      ctx.respond.sendError(res, ErrorCode.FileNotFound);
      return;
    }

    const cache = ctx.app.metadataCache.getFileCache(file);
    const rawHeadings = cache?.headings ?? [];

    if (format === "tree") {
      const tree = buildTree(rawHeadings.map((h) => ({
        heading: h.heading,
        level: h.level,
        line: h.position.start.line,
      })));
      ctx.respond.sendSuccess(res, { headings: tree });
    } else {
      const flat: FlatHeading[] = rawHeadings.map((h) => ({
        heading: h.heading,
        level: h.level,
        line: h.position.start.line,
      }));
      ctx.respond.sendSuccess(res, { headings: flat });
    }
  });
}

function buildTree(flat: FlatHeading[]): TreeHeading[] {
  const root: TreeHeading[] = [];
  const stack: TreeHeading[] = [];

  for (const item of flat) {
    const node: TreeHeading = { ...item, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

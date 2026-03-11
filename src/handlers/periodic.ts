import type { Router, Request, Response } from "express";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import { moment } from "obsidian";
import type { HandlerContext, ObsidianAppInternal } from "../types";
import { ErrorCode } from "../types";
import { vaultGet, vaultPut, vaultPost, vaultPatch, vaultDelete } from "./vault";

type PeriodType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
const VALID_PERIODS = new Set<string>(["daily", "weekly", "monthly", "quarterly", "yearly"]);

interface PeriodicConfig {
  folder: string;
  format: string;
  template: string;
}

export function register(router: Router, ctx: HandlerContext): void {
  const methods = ["get", "put", "post", "patch", "delete"] as const;
  const handlers = { get: vaultGet, put: vaultPut, post: vaultPost, patch: vaultPatch, delete: vaultDelete };

  for (const method of methods) {
    router[method]("/periodic/:period/", async (req, res) => {
      await handlePeriodic(ctx, req, res, method, handlers[method]);
    });

    router[method]("/periodic/:period/:year/:month/:day/", async (req, res) => {
      await handlePeriodic(ctx, req, res, method, handlers[method]);
    });
  }
}

async function handlePeriodic(
  ctx: HandlerContext,
  req: Request,
  res: Response,
  method: string,
  handler: (ctx: HandlerContext, req: Request, res: Response, path: string) => Promise<void>,
): Promise<void> {
  const period = String(req.params.period);

  if (!VALID_PERIODS.has(period)) {
    ctx.respond.sendError(
      res,
      ErrorCode.PeriodNotConfigured,
      "Invalid period: \"" + period + "\". Must be one of: daily, weekly, monthly, quarterly, yearly.",
    );
    return;
  }

  try {
    const config = getPeriodicConfig(ctx.app, period as PeriodType);
    if (!config) {
      ctx.respond.sendError(
        res,
        ErrorCode.PeriodNotConfigured,
        "The " + period + " notes plugin is not configured or enabled.",
      );
      return;
    }

    const date = getPeriodicDate(req);
    const filename = date.format(config.format);
    const notePath = config.folder
      ? `${config.folder}/${filename}.md`
      : `${filename}.md`;

    let file = ctx.app.vault.getFileByPath(notePath);

    // For write operations, create note if it doesn't exist
    if (!file && method !== "get") {
      const templateContent = await getTemplateContent(ctx.app, config.template);
      const dirPath = notePath.substring(0, notePath.lastIndexOf("/"));
      if (dirPath) {
        const dir = ctx.app.vault.getAbstractFileByPath(dirPath);
        if (!dir) await ctx.app.vault.createFolder(dirPath);
      }
      const created = await ctx.app.vault.create(notePath, templateContent);
      if (created instanceof TFile) file = created;
    }

    if (!file) {
      ctx.respond.sendError(res, ErrorCode.PeriodicNoteNotFound);
      return;
    }

    res.setHeader("Content-Location", `/vault/${file.path}`);
    await handler(ctx, req, res, file.path);
  } catch (e: unknown) {
    ctx.respond.sendError(
      res,
      ErrorCode.PeriodNotConfigured,
      e instanceof Error ? e.message : "Failed to access " + period + " note.",
    );
  }
}

function getPeriodicConfig(app: App, period: PeriodType): PeriodicConfig | null {
  const appInternal = app as unknown as ObsidianAppInternal;

  // 1. Check community "periodic-notes" plugin first
  const periodicNotes = appInternal.plugins?.plugins?.["periodic-notes"];
  if (periodicNotes?.settings?.[period]?.enabled) {
    const s = periodicNotes.settings[period] as Record<string, string>;
    return {
      folder: s.folder ?? "",
      format: s.format ?? getDefaultFormat(period),
      template: s.template ?? "",
    };
  }

  // 2. For daily: check core "daily-notes" internal plugin
  if (period === "daily") {
    const dailyNotes = appInternal.internalPlugins?.plugins?.["daily-notes"];
    if (dailyNotes?.enabled) {
      const s = dailyNotes.instance?.options ?? {};
      return {
        folder: s.folder ?? "",
        format: s.format ?? "YYYY-MM-DD",
        template: s.template ?? "",
      };
    }
  }

  return null;
}

function getDefaultFormat(period: PeriodType): string {
  switch (period) {
    case "daily": return "YYYY-MM-DD";
    case "weekly": return "gggg-[W]ww";
    case "monthly": return "YYYY-MM";
    case "quarterly": return "YYYY-[Q]Q";
    case "yearly": return "YYYY";
  }
}

async function getTemplateContent(app: App, templatePath: string): Promise<string> {
  if (!templatePath) return "";

  const normalized = templatePath.endsWith(".md") ? templatePath : `${templatePath}.md`;
  const file = app.vault.getFileByPath(normalized);
  if (!file) return "";

  return await app.vault.cachedRead(file);
}

function getPeriodicDate(req: Request): moment.Moment {
  const { year, month, day } = req.params;

  if (year && month && day) {
    return moment(new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
    ));
  }

  return moment();
}

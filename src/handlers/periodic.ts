import type { Router, Request, Response } from "express";
import type { HandlerContext } from "../types";
import { ErrorCode } from "../types";
import { vaultGet, vaultPut, vaultPost, vaultPatch, vaultDelete } from "./vault";

type PeriodType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
const VALID_PERIODS = new Set<string>(["daily", "weekly", "monthly", "quarterly", "yearly"]);

interface PeriodicNoteInterface {
  settings: unknown;
  loaded: boolean;
  create: (date: any) => Promise<any>;
  get: (date: any) => any;
  getAll: () => Record<string, any>;
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
  const period = req.params.period;

  if (!VALID_PERIODS.has(period)) {
    ctx.respond.sendError(
      res,
      ErrorCode.PeriodNotConfigured,
      `Invalid period: "${period}". Must be one of: daily, weekly, monthly, quarterly, yearly.`,
    );
    return;
  }

  try {
    const periodicInterface = getPeriodicNoteInterface(period as PeriodType);
    if (!periodicInterface) {
      ctx.respond.sendError(
        res,
        ErrorCode.PeriodNotConfigured,
        `The ${period} notes plugin is not configured.`,
      );
      return;
    }

    const date = getPeriodicDate(req);
    let note = periodicInterface.get(date);

    // For write operations, create note if it doesn't exist
    if (!note && method !== "get") {
      note = await periodicInterface.create(date);
    }

    if (!note) {
      ctx.respond.sendError(res, ErrorCode.PeriodicNoteNotFound);
      return;
    }

    res.setHeader("Content-Location", `/vault/${note.path}`);
    await handler(ctx, req, res, note.path);
  } catch (e: unknown) {
    ctx.respond.sendError(
      res,
      ErrorCode.PeriodNotConfigured,
      e instanceof Error ? e.message : `Failed to access ${period} note.`,
    );
  }
}

function getPeriodicNoteInterface(period: PeriodType): PeriodicNoteInterface | null {
  try {
    // Dynamic import from obsidian-daily-notes-interface
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dni = require("obsidian-daily-notes-interface");

    const mapping: Record<PeriodType, () => PeriodicNoteInterface | null> = {
      daily: () => ({
        settings: dni.getDailyNoteSettings?.(),
        loaded: true,
        create: dni.createDailyNote,
        get: dni.getDailyNote,
        getAll: dni.getAllDailyNotes,
      }),
      weekly: () => ({
        settings: dni.getWeeklyNoteSettings?.(),
        loaded: true,
        create: dni.createWeeklyNote,
        get: dni.getWeeklyNote,
        getAll: dni.getAllWeeklyNotes,
      }),
      monthly: () => ({
        settings: dni.getMonthlyNoteSettings?.(),
        loaded: true,
        create: dni.createMonthlyNote,
        get: dni.getMonthlyNote,
        getAll: dni.getAllMonthlyNotes,
      }),
      quarterly: () => ({
        settings: dni.getQuarterlyNoteSettings?.(),
        loaded: true,
        create: dni.createQuarterlyNote,
        get: dni.getQuarterlyNote,
        getAll: dni.getAllQuarterlyNotes,
      }),
      yearly: () => ({
        settings: dni.getYearlyNoteSettings?.(),
        loaded: true,
        create: dni.createYearlyNote,
        get: dni.getYearlyNote,
        getAll: dni.getAllYearlyNotes,
      }),
    };

    return mapping[period]?.() ?? null;
  } catch {
    return null;
  }
}

function getPeriodicDate(req: Request): Date {
  const { year, month, day } = req.params;

  if (year && month && day) {
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
    );
  }

  return new Date();
}

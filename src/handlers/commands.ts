import type { Router } from "express";
import type { HandlerContext, ObsidianAppInternal } from "../types";
import { ErrorCode } from "../types";

export function register(router: Router, ctx: HandlerContext): void {
  router.get("/commands/", (_req, res) => {
    const appInternal = ctx.app as unknown as ObsidianAppInternal;
    const commands = Object.values(appInternal.commands.commands).map(
      (cmd) => ({
        id: cmd.id,
        name: cmd.name,
      }),
    );

    ctx.respond.sendSuccess(res, { commands });
  });

  router.post("/commands/:commandId/", async (req, res) => {
    const { commandId } = req.params;
    const appInternal = ctx.app as unknown as ObsidianAppInternal;
    const commands = appInternal.commands;

    if (!commands.commands[commandId]) {
      ctx.respond.sendError(res, ErrorCode.CommandNotFound);
      return;
    }

    try {
      await commands.executeCommandById(commandId);
      res.status(204).send();
    } catch (e: unknown) {
      ctx.respond.sendError(
        res,
        ErrorCode.CommandExecutionFailed,
        e instanceof Error ? e.message : "Command execution failed.",
      );
    }
  });
}

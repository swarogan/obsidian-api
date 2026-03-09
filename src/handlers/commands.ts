import type { Router } from "express";
import type { HandlerContext } from "../types";
import { ErrorCode } from "../types";

export function register(router: Router, ctx: HandlerContext): void {
  router.get("/commands/", (_req, res) => {
    const commands = Object.values((ctx.app as any).commands.commands).map(
      (cmd: any) => ({
        id: cmd.id,
        name: cmd.name,
      }),
    );

    ctx.respond.sendSuccess(res, { commands });
  });

  router.post("/commands/:commandId/", async (req, res) => {
    const { commandId } = req.params;
    const commands = (ctx.app as any).commands;

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

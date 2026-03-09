import type { Router } from "express";
import type { HandlerContext } from "../types";
import { getSplatPath } from "./vault";

export function register(router: Router, ctx: HandlerContext): void {
  router.post("/open/*splat", async (req, res) => {
    const filePath = getSplatPath(req);
    const newLeaf = req.query.newLeaf === "true";

    await ctx.app.workspace.openLinkText(filePath, "/", newLeaf);

    res.status(200).json({});
  });
}

import type { Router } from "express";
import type { HandlerContext } from "../types";
import { ErrorCode } from "../types";

const TASK_REGEX = /^(\s*- \[)(.)(\]\s+)(.*)/;

interface TaskItem {
  text: string;
  status: string;
  completed: boolean;
  file: string;
  line: number;
}

export function register(router: Router, ctx: HandlerContext): void {
  router.get("/tasks/", async (req, res) => {
    const statusFilter = String(req.query.status ?? "all");
    const fileFilter = req.query.file ? String(req.query.file) : null;
    const pathFilter = req.query.path ? String(req.query.path) : null;
    const limit = Number(req.query.limit) || 0;

    let files = ctx.app.vault.getMarkdownFiles();

    if (fileFilter) {
      files = files.filter((f) => f.basename === fileFilter || f.path === fileFilter);
    }
    if (pathFilter) {
      files = files.filter((f) => f.path.startsWith(pathFilter));
    }

    const tasks: TaskItem[] = [];

    for (const file of files) {
      const content = await ctx.app.vault.cachedRead(file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(TASK_REGEX);
        if (!match) continue;

        const status = match[2];
        const text = match[4];
        const completed = status !== " ";

        if (statusFilter === "todo" && completed) continue;
        if (statusFilter === "done" && !completed) continue;

        tasks.push({ text, status, completed, file: file.path, line: i });
      }
    }

    const result = limit > 0 ? tasks.slice(0, limit) : tasks;
    ctx.respond.sendSuccess(res, { tasks: result, total: tasks.length });
  });

  router.patch("/tasks/", async (req, res) => {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const filePath = body?.file;
    const line = Number(body?.line);
    const newStatus = String(body?.status ?? "x");

    if (!filePath || isNaN(line)) {
      ctx.respond.sendError(res, ErrorCode.MissingRequiredField, "Fields 'file' and 'line' are required.");
      return;
    }

    const file = ctx.app.vault.getFileByPath(filePath);
    if (!file) {
      ctx.respond.sendError(res, ErrorCode.FileNotFound);
      return;
    }

    const content = await ctx.app.vault.cachedRead(file);
    const lines = content.split("\n");

    if (line < 0 || line >= lines.length) {
      ctx.respond.sendError(res, ErrorCode.TargetNotFound, `Line ${line} out of range.`);
      return;
    }

    const match = lines[line].match(TASK_REGEX);
    if (!match) {
      ctx.respond.sendError(res, ErrorCode.TargetNotFound, `Line ${line} is not a task.`);
      return;
    }

    lines[line] = `${match[1]}${newStatus}${match[3]}${match[4]}`;
    await ctx.app.vault.modify(file, lines.join("\n"));

    res.status(204).send();
  });
}

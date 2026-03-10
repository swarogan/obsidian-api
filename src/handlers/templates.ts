import type { Router, Request, Response } from "express";
import type { HandlerContext } from "../types";
import { ErrorCode } from "../types";

export function register(router: Router, ctx: HandlerContext): void {
  router.post("/templates/execute", async (req, res) => {
    await executeTemplate(ctx, req, res);
  });
}

async function executeTemplate(
  ctx: HandlerContext,
  req: Request,
  res: Response,
): Promise<void> {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const templateName = String(body?.name ?? "");
  const templateArgs: Record<string, string> = body?.arguments ?? {};
  const createFile: boolean = body?.createFile === true;
  const targetPath: string | undefined = body?.targetPath;

  if (!templateName) {
    ctx.respond.sendError(res, ErrorCode.MissingRequiredField, "Template name is required.");
    return;
  }

  const templater = (ctx.app as any).plugins?.plugins?.["templater-obsidian"];
  if (!templater) {
    ctx.respond.sendError(
      res,
      ErrorCode.SearchFailed,
      "Templater plugin is not available. Install and enable it to use templates.",
    );
    return;
  }

  const templateFile = ctx.app.vault.getFileByPath(templateName);
  if (!templateFile) {
    ctx.respond.sendError(res, ErrorCode.FileNotFound, `Template file not found: ${templateName}`);
    return;
  }

  try {
    const templateContent = await ctx.app.vault.cachedRead(templateFile);

    // Replace tp.user arguments in template content
    let processedContent = templateContent;
    for (const [key, value] of Object.entries(templateArgs)) {
      const pattern = new RegExp(`<%[*\\s]*tp\\.user\\.${escapeRegex(key)}[^%]*%>`, "g");
      processedContent = processedContent.replace(pattern, value);
    }

    // Try to use Templater's API to process the template
    const templaterApi = templater.templater;
    if (templaterApi?.parse_template) {
      try {
        const activeFile = ctx.app.workspace.getActiveFile();
        processedContent = await templaterApi.parse_template(
          { target_file: activeFile ?? templateFile, run_mode: 4 },
          processedContent,
        );
      } catch {
        // Fall back to basic replacement if Templater API fails
      }
    }

    if (createFile && targetPath) {
      const dirPath = targetPath.substring(0, targetPath.lastIndexOf("/"));
      if (dirPath) {
        const existingDir = ctx.app.vault.getAbstractFileByPath(dirPath);
        if (!existingDir) {
          await ctx.app.vault.createFolder(dirPath);
        }
      }

      const existing = ctx.app.vault.getFileByPath(targetPath);
      if (existing) {
        await ctx.app.vault.modify(existing, processedContent);
      } else {
        await ctx.app.vault.create(targetPath, processedContent);
      }
    }

    ctx.respond.sendSuccess(res, {
      message: createFile
        ? `Template executed and saved to ${targetPath}`
        : "Template executed successfully",
      content: processedContent,
    });
  } catch (e: unknown) {
    ctx.respond.sendError(
      res,
      ErrorCode.InternalError,
      e instanceof Error ? e.message : "Template execution failed.",
    );
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

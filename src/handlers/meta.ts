import type { Router } from "express";
import type { HandlerContext } from "../types";
import { CERT_NAME } from "../constants";
import { isAuthenticated } from "../middleware/auth";
import { getCertificateValidityDays } from "../crypto";

export function register(router: Router, ctx: HandlerContext): void {
  router.get("/", (req, res) => {
    const authenticated = isAuthenticated(req, ctx.settings.apiKey);

    const response: Record<string, unknown> = {
      status: "OK",
      manifest: ctx.manifest,
      versions: {
        self: ctx.manifest.version,
      },
      service: "Obsidian API",
      authenticated,
    };

    if (authenticated && ctx.settings.crypto) {
      const validityDays = getCertificateValidityDays(ctx.settings.crypto.cert);
      response.certificateInfo = {
        validityDays,
        regenerateRecommended: validityDays < 30,
      };
    }

    res.json(response);
  });

  router.get(`/${CERT_NAME}`, (_req, res) => {
    if (!ctx.settings.crypto) {
      res.status(404).json({ message: "No certificate available." });
      return;
    }

    res.setHeader("Content-Type", "application/x-pem-file");
    res.setHeader("Content-Disposition", `attachment; filename="${CERT_NAME}"`);
    res.send(ctx.settings.crypto.cert);
  });
}

import type { Router } from "express";
import type { HandlerContext, ObsidianAppInternal } from "../types";
import { CERT_NAME } from "../constants";
import { isAuthenticated } from "../middleware/auth";
import { getCertificateValidityDays } from "../crypto";

export function register(router: Router, ctx: HandlerContext): void {
  router.get("/", (req, res) => {
    const authenticated = isAuthenticated(req, ctx.settings.apiKey);

    const certificateInfo = ctx.settings.crypto
      ? {
          validityDays: getCertificateValidityDays(ctx.settings.crypto.cert),
          regenerateRecommended: getCertificateValidityDays(ctx.settings.crypto.cert) < 30,
        }
      : { validityDays: 0, regenerateRecommended: true };

    const appInternal = ctx.app as unknown as ObsidianAppInternal;
    res.json({
      status: "OK",
      manifest: ctx.manifest,
      versions: {
        self: String(ctx.manifest.version ?? "0.0.0"),
        obsidian: appInternal.vault?.config?.version ?? "unknown",
      },
      service: "Obsidian API",
      authenticated,
      apiExtensions: [],
      certificateInfo,
    });
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

import express from "express";
import cors from "cors";
import type { HandlerContext } from "./types";
import { MAX_REQUEST_SIZE, CONTENT_TYPES } from "./constants";
import { createAuthMiddleware } from "./middleware/auth";
import { loggingMiddleware } from "./middleware/logging";
import { errorHandler, notFoundHandler } from "./middleware/errors";

import * as metaHandler from "./handlers/meta";
import * as vaultHandler from "./handlers/vault";
import * as activeHandler from "./handlers/active";
import * as searchHandler from "./handlers/search";
import * as commandsHandler from "./handlers/commands";
import * as openHandler from "./handlers/open";
import * as periodicHandler from "./handlers/periodic";
import * as tagsHandler from "./handlers/tags";
import * as tasksHandler from "./handlers/tasks";
import * as backlinksHandler from "./handlers/backlinks";
import * as linksHandler from "./handlers/links";
import * as outlineHandler from "./handlers/outline";
import * as propertiesHandler from "./handlers/properties";
import * as templatesHandler from "./handlers/templates";

export function createApp(ctx: HandlerContext): express.Express {
  const app = express();

  app.set("json spaces", 2);

  // Middleware stack
  app.use(loggingMiddleware);

  app.use(
    cors({
      origin: ctx.settings.corsOrigin || "*",
    }),
  );

  app.use(createAuthMiddleware(() => ctx.settings.apiKey));

  // Body parsers
  app.use(
    express.text({
      type: [
        "text/*",
        CONTENT_TYPES.dataviewDql,
      ],
      limit: MAX_REQUEST_SIZE,
    }),
  );

  app.use(
    express.json({
      type: [
        "application/json",
        CONTENT_TYPES.noteJson,
        CONTENT_TYPES.jsonLogic,
      ],
      limit: MAX_REQUEST_SIZE,
    }),
  );

  app.use(
    express.raw({
      type: "*/*",
      limit: MAX_REQUEST_SIZE,
    }),
  );

  // Router registration
  const router = express.Router();

  metaHandler.register(router, ctx);
  vaultHandler.register(router, ctx);
  activeHandler.register(router, ctx);
  searchHandler.register(router, ctx);
  commandsHandler.register(router, ctx);
  openHandler.register(router, ctx);
  periodicHandler.register(router, ctx);
  tagsHandler.register(router, ctx);
  tasksHandler.register(router, ctx);
  backlinksHandler.register(router, ctx);
  linksHandler.register(router, ctx);
  outlineHandler.register(router, ctx);
  propertiesHandler.register(router, ctx);
  templatesHandler.register(router, ctx);

  app.use(router);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

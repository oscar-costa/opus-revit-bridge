import express, { type Request, type Response } from "express";
import { registerExportRoutes } from "./routes/export.js";
import { registerRevitRoutes } from "./routes/revit.js";
import { registerValidationRoutes } from "./routes/validation.js";
import { RevitClient } from "./revit-client.js";

export function createServer(revitClient = new RevitClient()) {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "opus-revit-bridge",
    });
  });

  registerRevitRoutes(app, revitClient);
  registerExportRoutes(app, revitClient);
  registerValidationRoutes(app, revitClient);

  return app;
}

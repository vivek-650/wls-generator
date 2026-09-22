import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import companyRoutes from "./routes/company.routes";
import candidatesRoutes from "./routes/candidates.routes";
import adminRoutes from "./routes/admin.routes";
import healthRoutes from "./routes/health.routes";
import searchRoutes from "./routes/search.routes";
import notificationsRoutes from "./routes/notifications.routes";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/auth", authRoutes);
  app.use("/api/company", companyRoutes);
  app.use("/api/candidates", candidatesRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/health", healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import "dotenv/config";
import express from "express";
import cors from "cors";

import analysisRoutes from "./routes/analysis.js";
import troubleshootRoutes from "./routes/troubleshoot.js";
import referenceRoutes from "./routes/reference.js";
import historyRoutes from "./routes/history.js";
import profileRoutes from "./routes/profile.js";

const app = express();

const allowed = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.length === 0 || allowed.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error("CORS: origin " + origin + " not allowed"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));

app.use("/api/analysis", analysisRoutes);
app.use("/api/troubleshoot", troubleshootRoutes);
app.use("/api/reference", referenceRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/profile", profileRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "windpal", timestamp: new Date().toISOString() });
});

export default app;

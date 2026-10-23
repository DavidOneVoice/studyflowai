import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";
import process from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAIService, friendlyAIError } from "./lib/generation.js";

export function createApp({ client, service, env = process.env } = {}) {
  const ai = service || createAIService({
    client: client || new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0 }),
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
  });
  const app = express();

  app.use(cors({
    origin: env.FRONTEND_ORIGIN
      ? env.FRONTEND_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean)
      : true,
  }));
  app.use(express.json({ limit: "4mb" }));

  app.get("/health", (req, res) => res.json({ ok: true }));

  function handle(generate) {
    return async (req, res) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      const onClose = () => {
        if (!res.writableEnded) abort();
      };
      req.on("aborted", abort);
      res.on("close", onClose);

      try {
        const result = await generate(req.body || {}, { signal: controller.signal });
        if (!controller.signal.aborted) res.json(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          const failure = friendlyAIError(error);
          res.status(failure.status).json({ error: failure.error, code: failure.code });
        }
      } finally {
        req.off("aborted", abort);
        res.off("close", onClose);
      }
    };
  }

  app.post("/api/generate-mcqs", handle(ai.generateQuestions));
  app.post("/api/summarize", handle(ai.summarize));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.too.large") {
      return res.status(413).json({
        error: "The request exceeds the server's existing transport size. Send the material in separate parts.",
        code: "request_too_large",
      });
    }
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "The request must contain valid JSON.", code: "invalid_json" });
    }
    const failure = friendlyAIError(error);
    return res.status(failure.status).json({ error: failure.error, code: failure.code });
  });

  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 5050;
  createApp().listen(port, () => console.log(`AI server running on port ${port}`));
}

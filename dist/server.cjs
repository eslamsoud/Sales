var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBWfIvlYVSioQhhq90Hw93hN9ZNk_h5DLA";
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  const HMR_PORT = Number(process.env.HMR_PORT) || 24679;
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "https://eslamsoud.github.io");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(import_express.default.json());
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { systemInstruction, history, message } = req.body;
      const ai = new import_genai.GoogleGenAI({
        apiKey: API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: systemInstruction || "You are a helpful assistant."
        }
      });
      let contents = [];
      if (history && Array.isArray(history)) {
        contents = history.map((item) => ({
          role: item.role,
          parts: [{ text: item.text }]
        }));
      }
      contents.push({ role: "user", parts: [{ text: message }] });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: systemInstruction || "You are a helpful assistant."
        }
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error.message || "Something went wrong" });
    }
  });
  app.post("/api/gemini/market-research", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required" });
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey: API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const systemInstruction = `\u0623\u0646\u062A \u062E\u0628\u064A\u0631 \u0627\u0642\u062A\u0635\u0627\u062F\u064A \u0648\u0645\u062E\u062A\u0635 \u0641\u064A \u0648\u0628\u0648\u0631\u0635\u0629 \u0648\u062D\u0631\u0643\u0629 \u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0633\u0644\u0639\u060C \u0648\u0627\u0644\u0632\u064A\u0648\u062A \u0627\u0644\u0646\u0628\u0627\u062A\u064A\u0629 \u0648\u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 (\u0645\u062B\u0644 \u0632\u064A\u062A \u0627\u0644\u062E\u0644\u064A\u0637\u060C \u0632\u064A\u062A \u0627\u0644\u0623\u0648\u0644\u064A\u0646\u060C \u0632\u064A\u062A \u0627\u0644\u0635\u0648\u064A\u0627\u060C \u0632\u064A\u062A \u0627\u0644\u0646\u062E\u064A\u0644\u060C \u0627\u0644\u062F\u0648\u0627\u0631 \u0648\u063A\u064A\u0631\u0647\u0627).
\u0623\u062C\u0628 \u0639\u0646 \u0633\u0624\u0627\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u062F\u0642\u0629 \u0648\u0645\u0648\u062B\u0648\u0642\u064A\u0629 \u0628\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0639\u0644\u0649 \u0646\u062A\u0627\u0626\u062C \u0645\u062D\u0631\u0643 \u0628\u062D\u062B \u062C\u0648\u062C\u0644 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u062F\u064A\u0643\u060C \u0645\u0648\u0636\u062D\u0627\u064B \u0627\u0644\u062D\u0631\u0643\u0629 \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0629 \u0648\u0627\u0644\u0645\u062D\u0644\u064A\u0629 \u0648\u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0648\u062A\u0641\u0627\u0635\u064A\u0644 \u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u062A\u0635\u0646\u064A\u0639 \u0623\u0648 \u0627\u0644\u062A\u0643\u0631\u064A\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.
\u0627\u0643\u062A\u0628 \u0628\u0627\u0644\u062A\u0641\u0635\u064A\u0644 \u0648\u0628\u0623\u0633\u0644\u0648\u0628 \u0645\u0646\u0638\u0645 \u0648\u0645\u0647\u0646\u064A \u062C\u062F\u0627\u064B \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: query,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks.filter((chunk) => chunk.web && chunk.web.uri).map((chunk) => ({
        title: chunk.web.title || "\u0645\u0635\u062F\u0631 \u062E\u0627\u0631\u062C\u064A",
        uri: chunk.web.uri
      }));
      res.json({
        text: response.text,
        sources
      });
    } catch (error) {
      console.error("Gemini Market Research error:", error);
      res.status(500).json({ error: error.message || "Something went wrong" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: {
          port: HMR_PORT
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    const staticOptions = {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
          res.setHeader("Content-Type", "application/javascript");
        } else if (filePath.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css");
        }
      }
    };
    app.use(import_express.default.static(distPath, staticOptions));
    app.use("/Sales", import_express.default.static(distPath, staticOptions));
    app.get(["/Sales", "/Sales/*", "*"], (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  const MAX_PORT_ATTEMPTS = 5;
  const tryListen = (port, attemptsLeft) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
        const nextPort = port + 1;
        console.warn(`Port ${port} is already in use. Trying ${nextPort}...`);
        setTimeout(() => tryListen(nextPort, attemptsLeft - 1), 100);
        return;
      }
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. \u064A\u0631\u062C\u0649 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u062A\u064A \u062A\u0633\u062A\u062E\u062F\u0645\u0647 \u0623\u0648 \u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u0646\u0641\u0630 \u0622\u062E\u0631.`);
        process.exit(1);
      }
      console.error("Server error:", error);
      process.exit(1);
    });
  };
  tryListen(PORT, MAX_PORT_ATTEMPTS);
}
startServer();
//# sourceMappingURL=server.cjs.map

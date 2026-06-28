import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import { 
  initDb, 
  getProducts, 
  addProduct, 
  deleteProduct, 
  getPriceHistory, 
  updateProductPrice, 
  getTelegramSettings, 
  saveTelegramSettings,
  updateProductTargetPrice
} from "./src/db/index.js";
import { scrapeLazadaProduct } from "./src/services/scraper.js";
import { testTelegramConnection, sendTelegramMessage, formatPriceDropMessage } from "./src/services/telegram.js";

dotenv.config();

const PORT = 3000;
const isProd = process.env.NODE_ENV === "production";

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' })); // Allow large manual HTML uploads

  // 1. Initialize database first
  try {
    await initDb();
  } catch (err: any) {
    console.error("[Server] DB Initialization Failed:", err.message || err);
  }

  // ==================================================
  // API Authentication Middleware
  // ==================================================
  // All /api/* routes require X-Api-Key header matching API_SECRET env var.
  // Set API_SECRET in your .env file. /api/health is intentionally public.
  const API_SECRET = process.env.API_SECRET;
  if (!API_SECRET) {
    console.warn("[Server] WARNING: API_SECRET is not set. All /api/* routes are unprotected. Set API_SECRET in your .env file.");
  }
  app.use("/api", (req, res, next) => {
    // Public endpoints that don't require a key
    if (req.path === "/health") return next();
    if (!API_SECRET) return next(); // dev fallback: no key configured = allow all
    const provided = req.headers["x-api-key"];
    if (!provided || provided !== API_SECRET) {
      return res.status(401).json({ error: "Unauthorized: missing or invalid X-Api-Key header." });
    }
    next();
  });

  // ==================================================
  // API Routes
  // ==================================================

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await getProducts();
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a product to track
  app.post("/api/products", async (req, res) => {
    const { url, targetPrice, manualHtml } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Lazada URL is required" });
    }

    try {
      console.log(`[Server] Request to add product: ${url}`);
      // Run scraper (which handles local meta, Gemini AI parser, and manual HTML import)
      const result = await scrapeLazadaProduct(url, manualHtml);

      if (!result.success) {
        return res.status(422).json({ 
          error: result.error || "Failed to analyze product. Lazada anti-bot blocks page scanning.", 
          methodUsed: result.methodUsed,
          canRetryManual: true
        });
      }

      const product = await addProduct({
        url,
        title: result.title,
        imageUrl: result.imageUrl,
        initialPrice: result.price,
        currentPrice: result.price,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      });

      res.status(201).json({ product, methodUsed: result.methodUsed });
    } catch (err: any) {
      console.error("[Server] Error adding product:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update target price
  app.post("/api/products/:id/target", async (req, res) => {
    const id = parseInt(req.params.id);
    const { targetPrice } = req.body;
    try {
      await updateProductTargetPrice(id, targetPrice ? parseFloat(targetPrice) : null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete product
  app.delete("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      await deleteProduct(id);
      res.json({ success: true, message: "Product deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get price history
  app.get("/api/products/:id/history", async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const history = await getPriceHistory(id);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Force check all prices (manual trigger)
  app.post("/api/tracker/check-all", async (req, res) => {
    try {
      const products = await getProducts();
      const tgSettings = await getTelegramSettings();
      const hasTelegram = tgSettings.token && tgSettings.chatId;

      console.log(`[Server] Triggered check-all. Scannning ${products.length} products...`);
      
      const results = [];
      for (const prod of products) {
        const scrapeResult = await scrapeLazadaProduct(prod.url);
        
        if (scrapeResult.success) {
          const { priceDropped, dropAmount } = await updateProductPrice(
            prod.id,
            scrapeResult.price,
            'active',
            new Date().toISOString()
          );

          results.push({
            id: prod.id,
            title: prod.title,
            oldPrice: prod.currentPrice,
            newPrice: scrapeResult.price,
            success: true,
            priceDropped,
            dropAmount
          });

          // Send Telegram notification if dropped
          if (priceDropped && dropAmount > 0 && hasTelegram && tgSettings.token && tgSettings.chatId) {
            const msg = formatPriceDropMessage(
              prod.title,
              prod.url,
              prod.currentPrice,
              scrapeResult.price,
              dropAmount,
              prod.targetPrice
            );
            await sendTelegramMessage(tgSettings.token, tgSettings.chatId, msg);
          }
        } else {
          await updateProductPrice(prod.id, prod.currentPrice, 'error_scrape', new Date().toISOString());
          results.push({
            id: prod.id,
            title: prod.title,
            success: false,
            error: scrapeResult.error
          });
        }
      }

      res.json({ success: true, checkedCount: products.length, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Simulate price drop for testing Telegram alerts instantly!
  // DRY-RUN: this endpoint composes a mock alert and sends it directly to Telegram
  // WITHOUT writing anything to the database. The real price baseline is never touched.
  app.post("/api/products/:id/simulate-drop", async (req, res) => {
    const id = parseInt(req.params.id);
    const { dropAmount } = req.body;
    const amountToDrop = parseFloat(dropAmount) || 100;

    try {
      const products = await getProducts();
      const prod = products.find(p => p.id === id);

      if (!prod) {
        return res.status(404).json({ error: "Product not found" });
      }

      const simulatedNewPrice = Math.max(1, prod.currentPrice - amountToDrop);
      const simulatedDrop = prod.currentPrice - simulatedNewPrice;
      console.log(`[Server] DRY-RUN simulate-drop on "${prod.title}": ฿${prod.currentPrice} → ฿${simulatedNewPrice} (DB unchanged)`);

      // Send the Telegram alert directly — no DB writes
      const tgSettings = await getTelegramSettings();
      let alertSent = false;
      if (tgSettings.token && tgSettings.chatId) {
        const msg = formatPriceDropMessage(
          prod.title,
          prod.url,
          prod.currentPrice,
          simulatedNewPrice,
          simulatedDrop,
          prod.targetPrice
        );
        alertSent = await sendTelegramMessage(tgSettings.token, tgSettings.chatId, msg);
      }

      res.json({
        success: true,
        dryRun: true,
        oldPrice: prod.currentPrice,
        simulatedNewPrice,
        simulatedDropAmount: simulatedDrop,
        alertSent
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Telegram pairing settings
  // NOTE: never return the raw token — hasToken boolean is enough for the UI
  app.get("/api/telegram/status", async (req, res) => {
    try {
      const settings = await getTelegramSettings();
      res.json({
        hasToken: !!settings.token,
        chatId: settings.chatId || "",
        botName: "Lazada Tracker Bot"
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save Telegram settings and trigger connection test
  app.post("/api/telegram/save", async (req, res) => {
    let { token, chatId } = req.body;
    if (!token || !chatId) {
      return res.status(400).json({ error: "Token and Chat ID are required" });
    }

    // Sanitize token and chatId
    token = token.trim();
    if (token.toLowerCase().startsWith('bot')) {
      token = token.substring(3);
    }
    chatId = chatId.trim();

    try {
      // Test the Telegram Connection first!
      const testSuccess = await testTelegramConnection(token, chatId);
      if (!testSuccess) {
        return res.status(422).json({ 
          error: "Failed to send test message. Check your bot Token and Chat ID. Make sure you have started a chat with the bot first." 
        });
      }

      // Save to DB
      await saveTelegramSettings(token, chatId);
      res.json({ success: true, message: "Settings saved and test alert sent successfully!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Download compiled project standalone ZIP file
  app.get("/api/download-zip", (req, res) => {
    const filePath = path.join(process.cwd(), "lazada-price-tracker.zip");
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "application/zip");
      res.download(filePath, "lazada-price-tracker.zip");
    } else {
      res.status(404).json({ error: "ZIP file not generated yet. Please run 'npm run zip' first." });
    }
  });

  // ==================================================
  // Frontend Asset Pipeline
  // ==================================================

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Lazada Price Tracker Server running on http://localhost:${PORT}`);
  });
}

startServer();

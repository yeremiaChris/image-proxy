import express from "express";
import crypto from "crypto";
import cors from "cors";
import sharp from "sharp";
import download from "./helpers/download.js";

const app = express();
const port = process.env.PORT || 3000;
const cache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

// Middleware
app.use(cors({ origin: "*", methods: ["GET"] }));

// Utility function to generate ETag
const generateETag = (buffer) =>
  crypto.createHash("md5").update(buffer).digest("hex");

// Utility function to set response headers
const setResponseHeaders = (res, buffer, isCacheHit = false) => {
  const hash = generateETag(buffer);
  res.set({
    "Content-Type": "image/webp",
    "Cache-Control": "public, max-age=86400, must-revalidate",
    ETag: `"${hash}"`,
    "X-Cache": isCacheHit ? "HIT" : "MISS",
  });
  return hash;
};

// Proxy route for image processing
app.get("/proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send("Missing URL parameter");
  }

  try {
    // Check cache
    if (cache.has(url)) {
      const { buffer, timestamp } = cache.get(url);
      if (Date.now() - timestamp < CACHE_TTL) {
        const hash = setResponseHeaders(res, buffer, true);
        if (req.get("If-None-Match") === `"${hash}"`) {
          return res.status(304).end();
        }
        return res.send(buffer);
      }
    }

    // Download image
    const buffer = await download(url);
    if (!buffer) {
      return res.status(404).send("Image not found");
    }

    // Optimize image
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 128 })
      .webp({ quality: 80 })
      .toBuffer();

    // Store in cache
    cache.set(url, { buffer: optimizedBuffer, timestamp: Date.now() });

    // Send response
    const hash = setResponseHeaders(res, optimizedBuffer);
    if (req.get("If-None-Match") === `"${hash}"`) {
      return res.status(304).end();
    }
    res.send(optimizedBuffer);
  } catch (err) {
    res.status(500).send(`Error processing image: ${err.message}`);
  }
});

// Heartbeat route
app.get("/heartbeat", (req, res) => res.send("Alive"));

// Start server
app.listen(port, () => console.log(`Listening on port ${port}`));

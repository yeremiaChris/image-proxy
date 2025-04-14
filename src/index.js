import express from "express";
import fs from "fs";
import crypto from "crypto";
import download from "./helpers/download.js";

const app = express();
const port = process.env.PORT || 3000;

const PATH_TO_ASSETS = "./src/assets/";

// if (!fs.existsSync(PATH_TO_ASSETS)) {
//   fs.mkdirSync(PATH_TO_ASSETS);
// }

// app.get("/proxy", async (req, res) => {
//   let url = req.query.url; //url to download

//   console.log("asdf");
//   let hash = crypto.createHash("md5").update(url).digest("hex"); //create hash of url

//   if (fs.existsSync(`${PATH_TO_ASSETS}${hash}.jpg`)) {
//     //if file exists, send it without creating and storing it again

//     res.header("Cache", "HIT"); //set cache header to HIT

//     res.sendFile(`${PATH_TO_ASSETS}${hash}.jpg`, { root: "." }, () => {});
//   } else {
//     //if file doesn't exist, create it and send it
//     let buffer = await download(url);
//     if (buffer) {
//       fs.writeFile(
//         `${PATH_TO_ASSETS}${hash}.jpg`,
//         buffer,
//         { flag: "w" },
//         () => {
//           res.sendFile(`${PATH_TO_ASSETS}${hash}.jpg`, { root: "." }, () => {});
//           return;
//         }
//       );
//     } else {
//       //if download failed, send error
//       res.send("Error"); //can set to whatever you want
//     }
//   }
// });

const crypto = require("crypto");
const sharp = require("sharp");
const { fileTypeFromBuffer } = await import("file-type");

const cache = new Map();
const TTL = 3600 * 1000; // 1 hour server-side cache

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing URL parameter");

  // Validate URL
  try {
    const parsedUrl = new URL(url);
    const allowedDomains = ["coinimages.com", "memecoincdn.com"];
    if (!allowedDomains.includes(parsedUrl.hostname)) {
      return res.status(403).send("Invalid URL");
    }
  } catch {
    return res.status(400).send("Malformed URL");
  }

  // Check server-side cache
  // asfd
  if (cache.has(url)) {
    const { buffer, timestamp } = cache.get(url);
    if (Date.now() - timestamp < TTL) {
      const hash = crypto.createHash("md5").update(buffer).digest("hex");
      if (req.get("If-None-Match") === `"${hash}"`) {
        return res.status(304).end();
      }
      const type = await fileTypeFromBuffer(buffer);
      res.set({
        "Content-Type": type?.mime || "image/webp",
        "Cache-Control": "public, max-age=86400, must-revalidate",
        ETag: `"${hash}"`,
        "X-Cache": "HIT",
      });
      return res.send(buffer);
    }
  }

  // Download and optimize
  try {
    let buffer = await download(url);
    if (!buffer) return res.status(404).send("Image not found");

    // Optimize image
    buffer = await sharp(buffer)
      .resize({ width: 128 })
      .webp({ quality: 80 })
      .toBuffer();

    // Cache server-side
    cache.set(url, { buffer, timestamp: Date.now() });

    // Set headers
    const hash = crypto.createHash("md5").update(buffer).digest("hex");
    if (req.get("If-None-Match") === `"${hash}"`) {
      return res.status(304).end();
    }
    res.set({
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400, must-revalidate",
      ETag: `"${hash}"`,
      "X-Cache": "MISS",
    });
    res.send(buffer);
  } catch (err) {
    res.status(500).send(`Error downloading image: ${err.message}`);
  }
});

//basic heartbeat route to check if server is running
app.get("/heartbeat", async (req, res) => {
  res.send("Alive");
});

//start the server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

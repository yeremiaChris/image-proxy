import express from "express";
import fs from "fs";
import crypto from "crypto";
import download from "./helpers/download.js";

const app = express();
const port = process.env.PORT || 3000;

const PATH_TO_ASSETS = "./src/assets/";

if (!fs.existsSync(PATH_TO_ASSETS)) {
  fs.mkdirSync(PATH_TO_ASSETS);
}

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

app.get("/proxy", async (req, res) => {
  let url = req.query.url;
  if (!url) {
    return res.status(400).send("Missing URL parameter");
  }

  let buffer = await download(url);
  if (buffer) {
    // Generate hash for ETag (optional, for caching)
    let hash = crypto.createHash("md5").update(url).digest("hex");
    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      ETag: `"${hash}"`, // Helps with conditional requests
      "X-Cache": "MISS", // Mimic your original Cache header
    });
    res.send(buffer);
  } else {
    res.status(500).send("Error downloading image");
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

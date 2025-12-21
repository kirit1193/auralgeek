import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const src = path.join(root, "node_modules", "mediainfo.js", "dist", "MediaInfoModule.wasm");
const dstDir = path.join(root, "public");
const dst = path.join(dstDir, "MediaInfoModule.wasm");

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log(`Copied ${src} -> ${dst}`);

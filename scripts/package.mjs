#!/usr/bin/env node
// Builds the Chrome Web Store upload: dist/ai-guardian-web-shield-<version>.zip
// Pure Node, no dependencies, works on Windows, macOS and Linux.
// Run with: npm run package
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

// Only runtime files ship. Docs, screenshots, tests and tooling stay in the repo.
const INCLUDE_DIRS = ["shared", "email", "icons"];
const INCLUDE_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "glance.css",
  "glance.js",
  "sidepanel.html"
];
const EXCLUDE_FILE = /(?:^|\/)(?:\.DS_Store|Thumbs\.db)$|\.(?:ps1|md|test\.js)$/i;

function collect(dir, out) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) collect(relative, out);
    else if (!EXCLUDE_FILE.test(relative)) out.push(relative);
  }
}

const files = [...INCLUDE_FILES];
for (const dir of INCLUDE_DIRS) collect(dir, files);
files.sort();

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`Missing packaged file: ${file}`);
    process.exit(1);
  }
}

// Minimal ZIP writer (deflate, no encryption), enough for the Web Store uploader.
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const localParts = [];
const centralParts = [];
let offset = 0;
// Fixed timestamp keeps builds reproducible for the same source.
const { time, day } = dosDateTime(new Date(2024, 0, 1, 0, 0, 0));

for (const file of files) {
  const data = fs.readFileSync(path.join(root, file));
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const name = Buffer.from(file, "utf8");
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(day, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(offset, 42);

  localParts.push(local, name, deflated);
  centralParts.push(central, name);
  offset += local.length + name.length + deflated.length;
}

const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20);

const distDir = path.join(root, "dist");
fs.mkdirSync(distDir, { recursive: true });
const outputPath = path.join(distDir, `ai-guardian-web-shield-${manifest.version}.zip`);
fs.writeFileSync(outputPath, Buffer.concat([...localParts, ...centralParts, end]));

const sizeKb = Math.round(fs.statSync(outputPath).size / 1024);
console.log(`Packaged ${files.length} files into ${path.relative(root, outputPath)} (${sizeKb} KB).`);
console.log("Upload this file at https://chrome.google.com/webstore/devconsole");

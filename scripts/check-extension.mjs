#!/usr/bin/env node
// Validates the unpacked extension before packaging or publishing.
// Run with: npm run check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

// 1. Manifest shape and referenced files.
const manifest = JSON.parse(read("manifest.json"));
if (manifest.manifest_version !== 3) fail("manifest_version must be 3.");
if (!/^\d+(\.\d+){1,3}$/.test(manifest.version || "")) fail(`Invalid manifest version "${manifest.version}".`);
if (!manifest.description || manifest.description.length > 132) {
  fail("manifest description must be 1-132 characters for the Chrome Web Store.");
}

const referenced = new Set();
for (const iconPath of Object.values(manifest.icons || {})) referenced.add(iconPath);
for (const iconPath of Object.values(manifest.action?.default_icon || {})) referenced.add(iconPath);
if (manifest.action?.default_popup) referenced.add(manifest.action.default_popup);
if (manifest.side_panel?.default_path) referenced.add(manifest.side_panel.default_path);
if (manifest.background?.service_worker) referenced.add(manifest.background.service_worker);
for (const script of manifest.content_scripts || []) {
  for (const file of [...(script.js || []), ...(script.css || [])]) referenced.add(file);
}

const allowedPermissions = new Set(["activeTab", "sidePanel", "scripting", "storage"]);
for (const permission of manifest.permissions || []) {
  if (!allowedPermissions.has(permission)) fail(`Unexpected permission "${permission}" (update the allowlist deliberately).`);
}
if ((manifest.host_permissions || []).length) fail("host_permissions must stay empty; the extension relies on activeTab.");

// 2. HTML pages: every script/stylesheet/image they load must be packaged and local.
for (const page of referenced) {
  if (!page.endsWith(".html")) continue;
  if (!exists(page)) {
    fail(`Manifest references missing page ${page}.`);
    continue;
  }
  const html = read(page);
  if (/<script(?![^>]*\ssrc=)[^>]*>[^<]*\S[^<]*<\/script>/i.test(html)) fail(`${page} contains an inline script, which MV3 blocks.`);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    if (/^(https?:|\/\/|data:)/i.test(target)) {
      fail(`${page} loads remote or data resource ${target}.`);
      continue;
    }
    referenced.add(target.replace(/[?#].*$/, ""));
  }
}

// 3. On-demand page scripts: list must match disk and dependency order.
const pageScripts = require(path.join(root, "shared/pageScripts.js"));
for (const file of pageScripts) referenced.add(file);
const order = (file) => pageScripts.indexOf(file);
if (!(order("shared/behaviorCorrelation.js") < order("shared/behaviorMonitor.js") && order("shared/behaviorMonitor.js") < order("content.js"))) {
  fail("pageScripts order must be behaviorCorrelation -> behaviorMonitor -> content.js.");
}
if (!(order("content.js") < order("email/emailState.js") && order("email/emailState.js") < order("email/emailSafetyController.js"))) {
  fail("pageScripts order must load content.js before the email modules and emailSafetyController.js last.");
}
for (const dir of ["shared", "email"]) {
  for (const entry of fs.readdirSync(path.join(root, dir))) {
    const file = `${dir}/${entry}`;
    if (file === "shared/pageScripts.js") continue;
    if (!pageScripts.includes(file)) fail(`${file} exists on disk but is not in shared/pageScripts.js.`);
  }
}
for (const file of ["glance.js", "popup.js"]) {
  if (!read(file).includes("globalThis.AI_GUARDIAN_PAGE_SCRIPT_FILES")) {
    fail(`${file} must take its injection list from shared/pageScripts.js.`);
  }
}

// 4. All referenced files exist.
for (const file of referenced) {
  if (!exists(file)) fail(`Referenced file is missing: ${file}`);
}

// 5. Syntax check every packaged script and forbid network APIs in page code.
const scripts = [...referenced].filter((file) => file.endsWith(".js") || file.endsWith(".mjs"));
for (const file of scripts) {
  if (!exists(file)) continue;
  const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
  if (result.status !== 0) fail(`Syntax error in ${file}:\n${result.stderr.trim()}`);
  const source = read(file);
  if (/\beval\s*\(|new\s+Function\s*\(/.test(source)) fail(`${file} uses eval or Function(), which the Web Store rejects.`);
  if (/\b(fetch|XMLHttpRequest|navigator\.sendBeacon|WebSocket)\s*\(/.test(source)) {
    fail(`${file} appears to make a network request; the extension must stay local-only.`);
  }
}

// 6. Version consistency across manifest, package.json and CHANGELOG.
const pkg = JSON.parse(read("package.json"));
if (pkg.version !== manifest.version) fail(`package.json version ${pkg.version} differs from manifest ${manifest.version}.`);
if (exists("CHANGELOG.md") && !read("CHANGELOG.md").includes(`## ${manifest.version}`)) {
  fail(`CHANGELOG.md has no "## ${manifest.version}" entry.`);
}

notes.push(`Checked ${referenced.size} packaged files for manifest ${manifest.version}.`);
notes.push(`Page scripts injected on demand: ${pageScripts.length}.`);

for (const note of notes) console.log(note);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
console.log("Extension checks passed.");

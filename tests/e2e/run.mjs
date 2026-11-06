#!/usr/bin/env node
// Browser smoke test for the real extension. See tests/e2e/README.md.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outDir = path.join(here, "output");
const PORT = Number(process.env.E2E_PORT || 8443);
const HOSTS = ["library.example.test", "paypa1-secure-login.test", "shop.example.test", "news.example.test", "mail.yahoo.com", "google.de", "amazon.fr"];

function loadPlaywright() {
  for (const candidate of [process.env.PLAYWRIGHT_PATH, "playwright", "@playwright/test"].filter(Boolean)) {
    try { return require(candidate); } catch { /* try the next one */ }
  }
  console.error("Playwright is not resolvable. Install it (npx playwright install chromium) or set PLAYWRIGHT_PATH.");
  process.exit(2);
}
const { chromium } = loadPlaywright();

// 1. Throwaway certificate and fixture server.
const work = fs.mkdtempSync(path.join(os.tmpdir(), "agws-e2e-"));
const keyPath = path.join(work, "key.pem");
const certPath = path.join(work, "cert.pem");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "1",
  "-subj", "/CN=localhost", "-addext", `subjectAltName=${["DNS:localhost", ...HOSTS.map((h) => `DNS:${h}`)].join(",")}`], { stdio: "ignore" });
// Fixture bodies are read once into memory; the request URL only selects a key.
const fixturesDir = path.join(here, "fixtures");
const fixtureBodies = new Map(fs.readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".html"))
  .map((name) => [name, fs.readFileSync(path.join(fixturesDir, name))]));
const server = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, (req, res) => {
  const requested = path.posix.basename(String(req.url || "").split("?")[0]);
  const body = fixtureBodies.get(requested) || fixtureBodies.get("safe.html");
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
});
await new Promise((resolve) => server.listen(PORT, resolve));
const base = (host) => `https://${host}:${PORT}`;

// 2. Test-only copy of the extension with host permissions for the fixture hosts.
const extDir = path.join(work, "ext");
for (const entry of ["manifest.json", "background.js", "content.js", "popup.html", "popup.css", "popup.js", "glance.css", "glance.js", "sidepanel.html", "shared", "email", "icons"]) {
  fs.cpSync(path.join(repoRoot, entry), path.join(extDir, entry), { recursive: true });
}
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, "manifest.json"), "utf8"));
manifest.name += " (e2e)";
manifest.host_permissions = HOSTS.map((h) => `https://${h}/*`);
fs.writeFileSync(path.join(extDir, "manifest.json"), JSON.stringify(manifest, null, 2));
const pageScripts = require(path.join(extDir, "shared/pageScripts.js"));
const PAGE_SCRIPTS = Array.from(pageScripts);
const HOOK_SOURCE = pageScripts.installRouteChangeHook.toString();

// 3. Browser with the extension loaded.
fs.mkdirSync(outDir, { recursive: true });
const context = await chromium.launchPersistentContext(path.join(work, "profile"), {
  headless: process.env.HEADLESS !== "0", channel: "chromium", ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, "--ignore-certificate-errors", "--no-sandbox", "--no-proxy-server",
    `--host-resolver-rules=${HOSTS.map((h) => `MAP ${h} 127.0.0.1`).join(", ")}`]
});
let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 });
const extId = new URL(worker.url()).host;

const results = [];
const note = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " :: " + detail : ""}`);
};
const tabIdFor = (page) => worker.evaluate(async (url) => (await chrome.tabs.query({ url }))[0]?.id, page.url());
async function scan(page) {
  const tabId = await tabIdFor(page);
  await worker.evaluate(({ tabId, files }) => chrome.scripting.executeScript({ target: { tabId }, files }), { tabId, files: PAGE_SCRIPTS });
  // The hook is the extension's own function; Playwright evaluates its source
  // in the worker, which hands it to executeScript as a function reference.
  await worker.evaluate(`chrome.scripting.executeScript({ target: { tabId: ${tabId} }, world: "MAIN", func: ${HOOK_SOURCE} })`).catch(() => {});
  await page.waitForTimeout(600);
  return tabId;
}
const report = (tabId, forceRefresh = true) => worker.evaluate(({ tabId, forceRefresh }) => chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_REPORT", forceRefresh }), { tabId, forceRefresh });
const dialogText = (page) => page.evaluate(() => document.querySelector("#ai-guardian-modal-root")?.innerText?.replace(/\s+/g, " ").trim() || "");
const open = async (url) => { const page = await context.newPage(); await page.goto(url); return page; };
const brief = (r) => `score=${r.score} ${r.label} | ${(r.reasons || []).slice(0, 3).join(" / ")}`;
const shot = (page, name, options = {}) => page.screenshot({ path: path.join(outDir, `${name}.png`), ...options });

try {
  const safe = await open(`${base("library.example.test")}/safe.html`);
  const safeReport = await report(await scan(safe));
  note("safe page stays below the caution band", (safeReport.score || 0) < 40, brief(safeReport));
  note("'purchase' is not read as a Chase brand mention", !JSON.stringify(safeReport).toLowerCase().includes("chase"));
  await shot(safe, "01-safe");

  const phishUrl = `${base("paypa1-secure-login.test")}/phish.html`;
  const phish = await open(phishUrl);
  const phishTab = await scan(phish);
  const phishReport = await report(phishTab);
  note("lookalike phishing page scores high or risk", ["high", "risk"].includes(phishReport.band), brief(phishReport));
  const laundered = (phishReport.flaggedLinks || []).find((l) => String(l.cleanedUrl || "").includes("verify.tk"));
  note("google-redirect laundering link is flagged", Boolean(laundered) && laundered.score >= 60, laundered ? `${laundered.score} ${laundered.label}` : "not flagged");
  await shot(phish, "02-phish");

  await phish.click("text=paypal.com/secure", { noWaitAfter: true }).catch(() => {});
  await phish.waitForTimeout(500);
  note("misleading sign-in link opens a warning dialog", (await dialogText(phish)).length > 0 && phish.url() === phishUrl, (await dialogText(phish)).slice(0, 120));
  await shot(phish, "03-phish-dialog");
  await phish.evaluate(() => [...document.querySelectorAll("#ai-guardian-modal-root button")].find((b) => /go back/i.test(b.textContent))?.click());
  await phish.waitForTimeout(200);
  await phish.click("text=paypal.com/secure", { noWaitAfter: true }).catch(() => {});
  await phish.waitForTimeout(500);
  note("'Go Back' does not approve the next click", (await dialogText(phish)).length > 0 && phish.url() === phishUrl, phish.url());

  for (const host of ["google.de", "amazon.fr"]) {
    const page = await open(`${base(host)}/safe.html`);
    const r = await report(await scan(page));
    note(`${host} is not flagged as a lookalike`, !(r.reasons || []).some((x) => /looks a bit like/i.test(x)), brief(r));
    await page.close();
  }

  const spa = await open(`${base("shop.example.test")}/spa.html`);
  const spaTab = await scan(spa);
  const before = await report(spaTab);
  await spa.click("#go");
  await spa.waitForTimeout(2500);
  const after = await report(spaTab, false);
  note("SPA pushState is noticed without a forced rescan", String(after.pageUrl || "").includes("/checkout"), `${before.pageUrl} -> ${after.pageUrl}`);
  note("SPA checkout state scores higher than home", (after.score || 0) > (before.score || 0), `${before.score} -> ${after.score}`);

  const inbox = await open(`${base("mail.yahoo.com")}/inbox.html`);
  const inboxTab = await scan(inbox);
  await inbox.waitForTimeout(1200);
  const ep = (await report(inboxTab)).emailSafetyPreview || {};
  note("Yahoo inbox detected as an inbox list", ep.available === true && ep.pageMode === "inbox", JSON.stringify({ provider: ep.providerLabel, view: ep.view, rows: ep.rowCount, risky: ep.riskyRowCount }));
  note("some but not all rows are flagged", ep.riskyRowCount >= 1 && ep.riskyRowCount < ep.rowCount, `${ep.riskyRowCount}/${ep.rowCount}`);
  const forged = await inbox.evaluate(() => ({ present: Boolean(document.getElementById("forged")), own: document.querySelectorAll(".ai-guardian-mail-cue-slot[data-agws-token]").length }));
  note("forged page slot survives and real cues carry a token", forged.present && forged.own > 0, JSON.stringify(forged));
  await shot(inbox, "04-inbox");

  const message = await open(`${base("mail.yahoo.com")}/message.html`);
  const messageTab = await scan(message);
  await message.waitForTimeout(1200);
  const mp = (await report(messageTab)).emailSafetyPreview || {};
  note("opened message detected with risky links", mp.pageMode === "opened_message" && (mp.riskyLinkCount || 0) >= 2, JSON.stringify({ view: mp.view, links: mp.linkCount, risky: mp.riskyLinkCount }));
  await shot(message, "05-message");

  const sso = await open(`${base("news.example.test")}/sso.html`);
  const ssoTab = await scan(sso);
  const ssoLinks = await worker.evaluate(async (tabId) => (await chrome.scripting.executeScript({ target: { tabId }, func: () => {
    const d = window.aiGuardianEmailDeps; const host = d.normalizeHost(location.hostname); const root = d.getRootDomain(host);
    return [...document.querySelectorAll("a[href]")].map((a) => { const r = d.assessLinkElement(a, { currentHost: host, currentRootDomain: root }); return { host: a.hostname, text: a.textContent, score: r.score, band: r.band }; });
  } }))[0].result, ssoTab);
  const badLogin = ssoLinks.find((l) => l.host === "login.badsite.test");
  note("brand bait pointing at an unknown 'login.' host leaves the safe band", Boolean(badLogin) && badLogin.band !== "safe" && badLogin.score >= 40, JSON.stringify(badLogin));
  const portalLogin = ssoLinks.find((l) => l.host === "sso.company-portal.test");
  note("an SSO-looking link without brand bait stays below the warning band", Boolean(portalLogin) && portalLogin.score < 60, JSON.stringify(portalLogin));
  const badgeState = await phish.evaluate(() => document.querySelector(".ai-guardian-indicator")?.getAttribute("data-state"));
  note("floating badge expands by itself on a high-risk page", badgeState === "expanded", String(badgeState));

  const forms = await open(`${base("news.example.test")}/forms.html`);
  await scan(forms);
  await forms.click("text=Try GET override", { noWaitAfter: true });
  await forms.waitForTimeout(500);
  note("sign-in field + GET submission is paused", /GET|address/i.test(await dialogText(forms)), (await dialogText(forms)).slice(0, 120));
  await shot(forms, "06-form-warning");

  await phish.goto(phishUrl);
  await scan(phish);
  const shim = (tabId, url) => `(() => { const q = chrome.tabs.query.bind(chrome.tabs); chrome.tabs.query = async (info) => info && info.active ? [{ id: ${tabId}, url: ${JSON.stringify(url)}, title: "Fixture", windowId: 1, active: true }] : q(info); })();`;
  const popup = await context.newPage();
  await popup.addInitScript(shim(phishTab, phishUrl));
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForTimeout(1500);
  const popupText = (await popup.innerText("body")).replace(/\s+/g, " ");
  note("toolbar popup shows the live score", /High risk|High caution/.test(popupText), popupText.slice(0, 120));
  await shot(popup, "07-popup");

  const panel = await context.newPage();
  await panel.setViewportSize({ width: 420, height: 1200 });
  await panel.addInitScript(shim(phishTab, phishUrl));
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  await panel.waitForTimeout(2000);
  const displays = await panel.evaluate(() => ["passcodeSetupPanel", "unlockPasscodePanel"].map((id) => getComputedStyle(document.getElementById(id)).display));
  note("passcode panels are collapsed by default", displays.every((d) => d === "none"), displays.join(","));
  note("side panel renders the report", /High risk|looks a bit like/i.test(await panel.innerText("body")));
  await shot(panel, "08-sidepanel", { fullPage: true });
} catch (error) {
  console.error("HARNESS ERROR", error);
  results.push({ name: "harness completed", ok: false, detail: String(error?.message || error) });
} finally {
  await context.close();
  server.close();
  fs.rmSync(work, { recursive: true, force: true });
  const passed = results.filter((r) => r.ok).length;
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${passed}/${results.length} checks passed. Screenshots: ${path.relative(repoRoot, outDir)}/`);
  process.exit(passed === results.length ? 0 : 1);
}

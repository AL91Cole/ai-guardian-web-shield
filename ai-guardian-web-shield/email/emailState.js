// Keeps per-page email preview state local to the current tab's content script instance.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  const state = {
    currentUrl: "",
    processedRowKeys: new Set(),
    processedLinkKeys: new Set(),
    warnedTargets: new Map(),
    allowOnceTargets: new Map()
  };

  function normalizeKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function cleanupTimedMap(map) {
    const now = Date.now();

    Array.from(map.entries()).forEach(([key, expiresAt]) => {
      if (Number(expiresAt || 0) <= now) {
        map.delete(key);
      }
    });
  }

  function ensureForUrl(url = location.href) {
    const normalizedUrl = String(url || location.href || "").trim();

    if (state.currentUrl !== normalizedUrl) {
      reset(normalizedUrl);
    }

    cleanupTimedMap(state.warnedTargets);
    cleanupTimedMap(state.allowOnceTargets);
    return state;
  }

  function reset(url = location.href) {
    state.currentUrl = String(url || location.href || "").trim();
    state.processedRowKeys.clear();
    state.processedLinkKeys.clear();
    state.warnedTargets.clear();
    state.allowOnceTargets.clear();
    return state;
  }

  function buildRowKey(row) {
    const text = String(row?.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);
    const stableHint =
      row?.getAttribute?.("data-legacy-message-id") ||
      row?.getAttribute?.("data-message-id") ||
      row?.getAttribute?.("data-thread-id") ||
      row?.getAttribute?.("data-test-id") ||
      row?.id ||
      text;

    return normalizeKey(`row|${stableHint}`);
  }

  function buildLinkKey(element, targetHref = "") {
    const text = [
      element?.textContent || "",
      element?.getAttribute?.("aria-label") || "",
      element?.getAttribute?.("title") || ""
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);

    return normalizeKey(`link|${targetHref}|${text}`);
  }

  function rememberProcessedRow(rowKey) {
    ensureForUrl();
    state.processedRowKeys.add(normalizeKey(rowKey));
  }

  function rememberProcessedLink(linkKey) {
    ensureForUrl();
    state.processedLinkKeys.add(normalizeKey(linkKey));
  }

  function rememberWarnedTarget(targetHref, durationMs = 15000) {
    ensureForUrl();
    state.warnedTargets.set(normalizeKey(targetHref), Date.now() + durationMs);
  }

  function isWarnedTarget(targetHref) {
    ensureForUrl();
    return state.warnedTargets.has(normalizeKey(targetHref));
  }

  function allowOnceTarget(targetHref, durationMs = 45000) {
    ensureForUrl();
    state.allowOnceTargets.set(normalizeKey(targetHref), Date.now() + durationMs);
  }

  function isAllowOnceTarget(targetHref) {
    ensureForUrl();
    return state.allowOnceTargets.has(normalizeKey(targetHref));
  }

  emailNamespace.emailState = {
    ensureForUrl,
    reset,
    buildRowKey,
    buildLinkKey,
    rememberProcessedRow,
    rememberProcessedLink,
    rememberWarnedTarget,
    isWarnedTarget,
    allowOnceTarget,
    isAllowOnceTarget
  };
})();

// Injects small isolated email cues and reuses slots so inbox layouts stay stable.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  // Only slots this injection created are trusted. A page or HTML email can
  // copy the class names, so class names alone never grant skip or removal.
  const ownedSlots = new WeakSet();
  const cueToken = createCueToken();

  // If this module is injected again, retire the previous instance's cues first:
  // its WeakSet is unreachable from here, so they could never be pruned later.
  emailNamespace.emailUiInjector?.clearPreviews?.();

  function createCueToken() {
    const bytes = new Uint8Array(12);

    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function getCueToken() {
    return cueToken;
  }

  function isOwnSlot(element) {
    if (!element || typeof element.closest !== "function") {
      return false;
    }

    const slot = element.closest(".ai-guardian-mail-cue-slot");
    return Boolean(slot) && ownedSlots.has(slot) && slot.dataset?.agwsToken === cueToken;
  }

  function createOwnedSlot(kind, extraClass) {
    const cueSlot = document.createElement("span");
    cueSlot.className = `ai-guardian-mail-cue-slot ${extraClass}`;
    cueSlot.dataset.kind = kind;
    cueSlot.dataset.agwsEnhanced = "true";
    cueSlot.dataset.agwsFeature = "email-preview";
    cueSlot.dataset.agwsToken = cueToken;
    ownedSlots.add(cueSlot);
    return cueSlot;
  }

  function forEachOwnedSlot(callback) {
    document.querySelectorAll(".ai-guardian-mail-cue-slot").forEach((cueSlot) => {
      if (ownedSlots.has(cueSlot)) {
        callback(cueSlot);
      }
    });
  }

  function clearPreviews() {
    forEachOwnedSlot((cueSlot) => {
      cueSlot.remove();
    });
  }

  function getRowCueHostSelectors(environment = {}) {
    switch (environment.id) {
      case "gmail":
        return ["td.xY.a4W", "td.a4W", "td.xY", "td:last-child"];
      case "outlook":
        return ["div[role='gridcell']:last-child", "div[data-app-section*='MessageList']", "div:last-child"];
      case "yahoo":
      case "aol":
        return ["div[data-test-id*='message']", "li > div:last-child", "div:last-child"];
      case "proton":
        return ["[data-testid*='message-row'] [role='gridcell']:last-child", "[role='gridcell']:last-child", "div:last-child"];
      case "icloud":
        return ["[role='gridcell']:last-child", "div:last-child"];
      default:
        return ["td:last-child", "div[role='gridcell']:last-child", "div:last-child"];
    }
  }

  function getRowCueHost(row, environment = {}) {
    const deps = getDeps();
    const selectors = getRowCueHostSelectors(environment);

    for (const selector of selectors) {
      try {
        const host = row.querySelector(selector);

        if (host instanceof HTMLElement && deps.isVisibleElement?.(host)) {
          return host;
        }
      } catch (error) {
        continue;
      }
    }

    const fallbackCell = row.querySelector("td:last-child, div[role='gridcell']:last-child, div:last-child");
    return fallbackCell instanceof HTMLElement ? fallbackCell : row;
  }

  function ensureRowCueSlot(row, environment) {
    const host = getRowCueHost(row, environment);

    if (!(host instanceof HTMLElement)) {
      return null;
    }

    const existingSlot = Array.from(host.children).find((child) => {
      return child instanceof HTMLElement && ownedSlots.has(child) && child.dataset.kind === "row";
    });

    if (existingSlot instanceof HTMLElement) {
      return existingSlot;
    }

    const cueSlot = createOwnedSlot("row", "ai-guardian-mail-row-slot");
    host.appendChild(cueSlot);
    return cueSlot;
  }

  function ensureLinkCueSlot(element) {
    const sibling = element.nextElementSibling;

    if (sibling instanceof HTMLElement && ownedSlots.has(sibling) && sibling.dataset.kind === "link") {
      return sibling;
    }

    const cueSlot = createOwnedSlot("link", "ai-guardian-mail-link-slot");
    element.insertAdjacentElement("afterend", cueSlot);
    return cueSlot;
  }

  function updateCue(cueSlot, label, detail, tone) {
    if (!ownedSlots.has(cueSlot)) {
      return;
    }

    let cue = cueSlot.firstElementChild;

    if (!(cue instanceof HTMLElement) || !cue.classList.contains("ai-guardian-mail-cue")) {
      cue = document.createElement("span");
      cue.className = "ai-guardian-mail-cue";
      cueSlot.replaceChildren(cue);
    }

    cue.dataset.tone = tone;
    cue.dataset.agwsEnhanced = "true";
    cue.dataset.agwsFeature = "email-preview";
    cue.textContent = label;
    cue.setAttribute("role", "note");
    cue.setAttribute("aria-label", `${label}. ${detail}`);
    cue.title = detail;
  }

  function pruneInactiveCueSlots(activeSlots) {
    forEachOwnedSlot((cueSlot) => {
      if (!activeSlots.has(cueSlot)) {
        cueSlot.remove();
      }
    });
  }

  emailNamespace.emailUiInjector = {
    clearPreviews,
    getCueToken,
    isOwnSlot,
    getRowCueHostSelectors,
    ensureRowCueSlot,
    ensureLinkCueSlot,
    updateCue,
    pruneInactiveCueSlots
  };
})();

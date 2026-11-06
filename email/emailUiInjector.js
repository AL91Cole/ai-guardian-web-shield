// Injects small isolated email cues and reuses slots so inbox layouts stay stable.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};
  const SLOT_CLASS = "ai-guardian-mail-cue-slot";
  const SLOT_SELECTOR = `.${SLOT_CLASS}`;
  const TOKEN_ATTRIBUTE = "data-agws-token";

  // Cue slots live in the page DOM, so a page (or an HTML email rendered by a
  // provider that keeps class names) can author elements that look exactly like
  // ours. Only elements created here are trusted: they are tracked in a WeakSet
  // that page scripts cannot reach, and they carry a per-load token so other
  // modules can confirm they belong to this injection.
  const ownedSlots = new WeakSet();
  const ownershipToken = createOwnershipToken();

  // If this module is injected again, retire the previous instance's cues first.
  // Its WeakSet is unreachable from here, so those slots could not be pruned later.
  emailNamespace.emailUiInjector?.clearPreviews?.();

  function createOwnershipToken() {
    const bytes = new Uint8Array(16);
    const cryptoApi = root.crypto;

    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      cryptoApi.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function getOwnershipToken() {
    return ownershipToken;
  }

  // The token alone never grants trust: it sits on a DOM attribute, so a page
  // script could copy it. Membership in the WeakSet proves this module created
  // the element; the token check additionally ties it to the current load.
  function isOwnSlot(element) {
    return (
      element instanceof HTMLElement &&
      ownedSlots.has(element) &&
      element.getAttribute(TOKEN_ATTRIBUTE) === ownershipToken
    );
  }

  function isInsideOwnSlot(node) {
    if (!node) {
      return false;
    }

    const element = node instanceof Element ? node : node.parentElement;

    if (!(element instanceof Element) || typeof element.closest !== "function") {
      return false;
    }

    return isOwnSlot(element.closest(SLOT_SELECTOR));
  }

  function registerOwnedSlot(cueSlot) {
    cueSlot.setAttribute(TOKEN_ATTRIBUTE, ownershipToken);
    ownedSlots.add(cueSlot);
    return cueSlot;
  }

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  function getOwnedSlots() {
    return Array.from(document.querySelectorAll(SLOT_SELECTOR)).filter((cueSlot) => isOwnSlot(cueSlot));
  }

  function clearPreviews() {
    getOwnedSlots().forEach((cueNode) => {
      cueNode.remove();
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
      return isOwnSlot(child) && child.dataset.kind === "row";
    });

    if (existingSlot instanceof HTMLElement) {
      return existingSlot;
    }

    const cueSlot = document.createElement("span");
    cueSlot.className = `${SLOT_CLASS} ai-guardian-mail-row-slot`;
    cueSlot.dataset.kind = "row";
    cueSlot.dataset.agwsEnhanced = "true";
    cueSlot.dataset.agwsFeature = "email-preview";
    registerOwnedSlot(cueSlot);
    host.appendChild(cueSlot);
    return cueSlot;
  }

  function ensureLinkCueSlot(element) {
    const sibling = element.nextElementSibling;

    if (isOwnSlot(sibling) && sibling.dataset.kind === "link") {
      return sibling;
    }

    const cueSlot = document.createElement("span");
    cueSlot.className = `${SLOT_CLASS} ai-guardian-mail-link-slot`;
    cueSlot.dataset.kind = "link";
    cueSlot.dataset.agwsEnhanced = "true";
    cueSlot.dataset.agwsFeature = "email-preview";
    registerOwnedSlot(cueSlot);
    element.insertAdjacentElement("afterend", cueSlot);
    return cueSlot;
  }

  function updateCue(cueSlot, label, detail, tone) {
    if (!isOwnSlot(cueSlot)) {
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
    getOwnedSlots().forEach((cueSlot) => {
      if (!activeSlots.has(cueSlot)) {
        cueSlot.remove();
      }
    });
  }

  emailNamespace.emailUiInjector = {
    clearPreviews,
    getRowCueHostSelectors,
    ensureRowCueSlot,
    ensureLinkCueSlot,
    updateCue,
    pruneInactiveCueSlots,
    isOwnSlot,
    isInsideOwnSlot,
    getOwnershipToken
  };
})();

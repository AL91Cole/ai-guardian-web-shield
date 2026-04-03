// Injects small isolated email cues and reuses slots so inbox layouts stay stable.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  function clearPreviews() {
    document.querySelectorAll(".ai-guardian-mail-cue-slot").forEach((cueNode) => {
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
      return child instanceof HTMLElement &&
        child.classList.contains("ai-guardian-mail-cue-slot") &&
        child.dataset.kind === "row";
    });

    if (existingSlot instanceof HTMLElement) {
      return existingSlot;
    }

    const cueSlot = document.createElement("span");
    cueSlot.className = "ai-guardian-mail-cue-slot ai-guardian-mail-row-slot";
    cueSlot.dataset.kind = "row";
    cueSlot.dataset.agwsEnhanced = "true";
    cueSlot.dataset.agwsFeature = "email-preview";
    host.appendChild(cueSlot);
    return cueSlot;
  }

  function ensureLinkCueSlot(element) {
    const sibling = element.nextElementSibling;

    if (
      sibling instanceof HTMLElement &&
      sibling.classList.contains("ai-guardian-mail-cue-slot") &&
      sibling.dataset.kind === "link"
    ) {
      return sibling;
    }

    const cueSlot = document.createElement("span");
    cueSlot.className = "ai-guardian-mail-cue-slot ai-guardian-mail-link-slot";
    cueSlot.dataset.kind = "link";
    cueSlot.dataset.agwsEnhanced = "true";
    cueSlot.dataset.agwsFeature = "email-preview";
    element.insertAdjacentElement("afterend", cueSlot);
    return cueSlot;
  }

  function updateCue(cueSlot, label, detail, tone) {
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
    document.querySelectorAll(".ai-guardian-mail-cue-slot").forEach((cueSlot) => {
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
    pruneInactiveCueSlots
  };
})();

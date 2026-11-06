// Single source of truth for what popup.js and glance.js inject on demand:
// the page script files (isolated world) and the route-change hook (main world).
// Order matters: content.js reads the behavior globals during setup, and the
// email modules build on content.js and each other.
// Loaded by popup.html and sidepanel.html before their controller scripts.
(() => {
  "use strict";

  const files = Object.freeze([
    "shared/behaviorCorrelation.js",
    "shared/behaviorMonitor.js",
    "shared/debounce.js",
    "shared/domUtils.js",
    "shared/urlUtils.js",
    "content.js",
    "email/emailState.js",
    "email/providerDetection.js",
    "email/emailHeuristics.js",
    "email/inboxRowScanner.js",
    "email/messageLinkScanner.js",
    "email/pageModeDetection.js",
    "email/authFlowHandler.js",
    "email/emailUiInjector.js",
    "email/emailSafetyController.js"
  ]);

  // Injected into the page's MAIN world with chrome.scripting.executeScript
  // ({ func }) so that history.pushState/replaceState calls made by page
  // scripts are visible: a wrapper installed from the isolated world never
  // runs for them. It is serialized by Chrome, so it must stay self-contained,
  // and it must not carry extension data: it only announces "the URL may have
  // changed" with a payload-free event that content.js treats as untrusted.
  function installRouteChangeNotifier() {
    const FLAG = "__agwsRouteChangeHooked";
    if (history[FLAG]) {
      return;
    }

    try {
      Object.defineProperty(history, FLAG, { value: true });
    } catch (error) {
      // A page that sealed its history object cannot be marked, so leave it
      // untouched rather than risk wrapping it twice.
      return;
    }

    const notify = () => {
      document.dispatchEvent(new CustomEvent("agws:route-change"));
    };

    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      if (typeof original !== "function") {
        continue;
      }
      history[method] = function (...args) {
        const result = original.apply(this, args);
        notify();
        return result;
      };
    }
  }

  globalThis.AI_GUARDIAN_PAGE_SCRIPT_FILES = files;
  globalThis.AI_GUARDIAN_MAIN_WORLD_ROUTE_HOOK = installRouteChangeNotifier;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = files;
  }
})();

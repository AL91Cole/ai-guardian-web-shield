// Single source of truth for the page scripts injected on demand.
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

  globalThis.AI_GUARDIAN_PAGE_SCRIPT_FILES = files;

  // Runs in the page's MAIN world through chrome.scripting.executeScript({ func }).
  // It must stay self-contained: it is serialized, so it cannot reference anything
  // outside its own body. It exposes no extension data; it only announces that
  // history changed so the isolated-world scripts re-read location.href.
  function installRouteChangeHook() {
    const marker = "__agwsRouteHookInstalled";

    if (Object.prototype.hasOwnProperty.call(history, marker)) {
      return true;
    }

    Object.defineProperty(history, marker, { value: true, enumerable: false, configurable: false, writable: false });

    const notify = () => {
      try {
        document.dispatchEvent(new Event("agws:route-change"));
      } catch (_) { /* The document may be tearing down. */ }
    };

    for (const name of ["pushState", "replaceState"]) {
      const original = history[name];

      if (typeof original !== "function") {
        continue;
      }

      history[name] = function routeHook(...args) {
        const result = original.apply(this, args);
        notify();
        return result;
      };
    }

    return true;
  }

  globalThis.AI_GUARDIAN_MAIN_WORLD_ROUTE_HOOK = installRouteChangeHook;

  if (typeof module !== "undefined" && module.exports) {
    // Node consumers get the frozen list plus the hook for testing.
    module.exports = Object.freeze(Object.assign(Array.from(files), { installRouteChangeHook }));
  }
})();

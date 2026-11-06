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

  if (typeof module !== "undefined" && module.exports) {
    module.exports = files;
  }
})();

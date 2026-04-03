// Shared DOM helpers for visible, near-viewport scanning.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  function isElementNearViewport(element, padding = 160) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.bottom >= -padding && rect.top <= window.innerHeight + padding;
  }

  function getVisibleMatches(selectors, options = {}) {
    const deps = getDeps();
    const limit = Number(options.limit || 20);
    const padding = Number(options.padding || 240);
    const matches = [];
    const seenElements = new Set();

    selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((element) => {
          if (
            matches.length >= limit ||
            !(element instanceof HTMLElement) ||
            seenElements.has(element) ||
            typeof deps.isVisibleElement !== "function" ||
            !deps.isVisibleElement(element) ||
            !isElementNearViewport(element, padding)
          ) {
            return;
          }

          seenElements.add(element);
          matches.push(element);
        });
      } catch (error) {
        return;
      }
    });

    return matches;
  }

  function countVisibleMatches(selectors, limit = 20, padding = 240) {
    return getVisibleMatches(selectors, {
      limit,
      padding
    }).length;
  }

  emailNamespace.domUtils = {
    isElementNearViewport,
    getVisibleMatches,
    countVisibleMatches
  };
})();

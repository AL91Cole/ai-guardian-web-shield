// Shared debounce helper for dynamic inbox rescans.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  // Small shared debounce helper for dynamic inbox UIs.
  function debounce(callback, waitMs = 250) {
    let timerId = 0;

    return function debouncedCallback(...args) {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        callback.apply(this, args);
      }, waitMs);
    };
  }

  emailNamespace.debounceUtils = {
    debounce
  };
})();

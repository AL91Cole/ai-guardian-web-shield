// Small URL wrappers that let the email modules reuse the main script's URL helpers safely.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  // These wrappers keep email modules decoupled from the main content script internals.
  function normalizeHost(value) {
    const deps = getDeps();
    return typeof deps.normalizeHost === "function"
      ? deps.normalizeHost(value)
      : String(value || "").toLowerCase();
  }

  function getRootDomain(value) {
    const deps = getDeps();
    return typeof deps.getRootDomain === "function"
      ? deps.getRootDomain(value)
      : String(value || "").toLowerCase();
  }

  function resolveHttpUrl(value) {
    const deps = getDeps();
    return typeof deps.resolveHttpUrl === "function"
      ? deps.resolveHttpUrl(value)
      : String(value || "");
  }

  emailNamespace.urlUtils = {
    normalizeHost,
    getRootDomain,
    resolveHttpUrl
  };
})();

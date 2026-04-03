// Keeps trusted account and sign-in steps gentle, with short-lived allow-once support.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  function looksLikeTrustedEmailAuthFlow(assessment, emailContext = null) {
    return Boolean(
      assessment?.identitySignals?.trustedAuthFlow &&
      assessment.identitySignals.protocol === "https:" &&
      !assessment.identitySignals.lookalikeBrand &&
      !assessment.identitySignals.localKnownRiskMatch &&
      !assessment.identitySignals.usesIpAddress &&
      !assessment.identitySignals.usesEncodedHost &&
      !assessment.identitySignals.suspiciousTld &&
      assessment.score < 70 &&
      (
        !emailContext ||
        emailContext.providerMatchedSurface === "auth" ||
        emailContext.pageMode === "auth_flow" ||
        emailContext.pageMode === "account_chooser"
      )
    );
  }

  function allowOnceTarget(targetHref, durationMs = 45000) {
    emailNamespace.emailState?.allowOnceTarget(targetHref, durationMs);
  }

  function isAllowOnceTarget(targetHref) {
    return Boolean(emailNamespace.emailState?.isAllowOnceTarget(targetHref));
  }

  function rememberWarnedTarget(targetHref, durationMs = 15000) {
    emailNamespace.emailState?.rememberWarnedTarget(targetHref, durationMs);
  }

  function isRecentlyWarned(targetHref) {
    return Boolean(emailNamespace.emailState?.isWarnedTarget(targetHref));
  }

  emailNamespace.authFlowHandler = {
    looksLikeTrustedEmailAuthFlow,
    allowOnceTarget,
    isAllowOnceTarget,
    rememberWarnedTarget,
    isRecentlyWarned
  };
})();

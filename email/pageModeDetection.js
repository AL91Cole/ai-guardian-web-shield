// Decides whether the page looks like an inbox, open message, auth flow, or another mail view.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  const GENERIC_INBOX_SIGNAL_NAMES = [
    "compose button present",
    "folder labels present",
    "mail search field present",
    "repeated row-like items",
    "sender/subject/snippet pattern",
    "reading pane present",
    "attachment controls present"
  ];

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  function getMinimumInboxRowCount(environment) {
    return environment.supportTier === 1 ? 2 : environment.supportTier === 2 ? 3 : 5;
  }

  function isTrustedAccountChooserPath() {
    const normalizedPath = String(location.pathname || "").toLowerCase();
    const normalizedUrl = String(location.href || "").toLowerCase();
    return normalizedPath.includes("accountchooser") || normalizedUrl.includes("selectaccount");
  }

  function isTrustedAuthPath() {
    const deps = getDeps();
    const normalizedPath = String(location.pathname || "").toLowerCase();
    return (deps.GENERIC_SSO_PATH_HINTS || []).some((hint) => normalizedPath.includes(hint));
  }

  function countMatches(selectors, limit = 10) {
    const domUtils = emailNamespace.domUtils || {};
    return typeof domUtils.countVisibleMatches === "function"
      ? domUtils.countVisibleMatches(selectors, limit)
      : 0;
  }

  function collectModeSignals(environment, currentHost, currentRootDomain) {
    const providerDetection = emailNamespace.providerDetection || {};
    const inboxRowScanner = emailNamespace.inboxRowScanner || {};
    const messageLinkScanner = emailNamespace.messageLinkScanner || {};
    const rows = typeof inboxRowScanner.getVisibleRows === "function" ? inboxRowScanner.getVisibleRows(environment) : [];
    const rowDetails = typeof inboxRowScanner.scanRows === "function" ? inboxRowScanner.scanRows(environment) : [];
    const messageScopes = typeof messageLinkScanner.getVisibleMessageScopes === "function"
      ? messageLinkScanner.getVisibleMessageScopes(environment)
      : [];
    const visibleLinks = typeof messageLinkScanner.getVisibleMessageLinks === "function"
      ? messageLinkScanner.getVisibleMessageLinks(environment)
      : [];
    const composeCount = countMatches(providerDetection.getComposeSelectors(environment), 8);
    const accountChooserCount = countMatches(providerDetection.getAccountChooserSelectors(environment), 12);
    const authCount =
      countMatches(providerDetection.getAuthSelectors(environment), 8) +
      document.querySelectorAll('input[type="password"]').length;
    const attachmentViewCount = countMatches(providerDetection.getAttachmentViewSelectors(environment), 8);
    const folderListDetected = countMatches(providerDetection.getFolderSelectors(environment), 10) > 0;
    const searchFieldDetected = countMatches(providerDetection.getSearchSelectors(environment), 8) > 0;
    const composeButtonDetected = countMatches(providerDetection.getComposeButtonSelectors(environment), 6) > 0;
    const messageTextLength = messageScopes
      .slice(0, 3)
      .map((scope) => String(scope.innerText || ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim().length;
    const repeatedRowPatterns = rowDetails.filter((item) => {
      return Boolean(item?.rowParts?.sender && item?.rowParts?.subject);
    }).length;
    const attachmentHints = emailNamespace.emailHeuristics?.PHISHING_PHRASE_CATEGORIES?.paymentInvoiceBait || [];
    const visibleAttachmentCount = visibleLinks.filter((element) => {
      const text = String(messageLinkScanner.getInteractiveElementText?.(element) || "").toLowerCase();
      return (
        messageLinkScanner.getInteractiveTargetUrl?.(element)?.length > 0 &&
        (text.includes("download") ||
          text.includes("attachment") ||
          attachmentHints.some((hint) => text.includes(String(hint).toLowerCase())) ||
          element.matches?.("a[download], button[formaction]"))
      );
    }).length;
    const hasSenderSubjectSnippetPattern = rowDetails.some((item) => {
      return Boolean(item?.rowParts?.sender && (item.rowParts.subject || item.rowParts.snippet));
    });
    const genericInboxSignals = [
      composeButtonDetected,
      folderListDetected,
      searchFieldDetected,
      rows.length >= 4,
      hasSenderSubjectSnippetPattern,
      messageScopes.length > 0,
      visibleAttachmentCount > 0
    ];
    const genericInboxSignalCount = genericInboxSignals.filter(Boolean).length;
    const genericInboxSignalNames = GENERIC_INBOX_SIGNAL_NAMES.filter((name, index) => genericInboxSignals[index]);

    return {
      currentHost,
      currentRootDomain,
      rowCount: rows.length,
      rowDetails,
      messageScopeCount: messageScopes.length,
      visibleLinkCount: visibleLinks.length,
      composeCount,
      accountChooserCount,
      authCount,
      attachmentViewCount,
      folderListDetected,
      searchFieldDetected,
      composeButtonDetected,
      messageTextLength,
      repeatedRowPatterns,
      visibleAttachmentCount,
      hasReadingPane: rows.length >= 2 && messageScopes.length > 0,
      hasSenderSubjectSnippetPattern,
      genericInboxSignalCount,
      genericInboxSignalNames
    };
  }

  function detectPageMode(environment, providerMatch, modeSignals) {
    const minimumInboxRowCount = getMinimumInboxRowCount(environment);
    const looksLikeStructuredInbox =
      modeSignals.rowCount >= minimumInboxRowCount &&
      (
        modeSignals.folderListDetected ||
        modeSignals.searchFieldDetected ||
        modeSignals.composeButtonDetected ||
        modeSignals.repeatedRowPatterns >= 2
      );

    if (modeSignals.accountChooserCount > 0 || isTrustedAccountChooserPath()) {
      return "account_chooser";
    }

    if (
      providerMatch.matchedSurface === "auth" ||
      (modeSignals.authCount > 0 && (isTrustedAuthPath() || providerMatch.matchedSurface === "auth"))
    ) {
      return "auth_flow";
    }

    if (
      modeSignals.composeCount > 0 &&
      modeSignals.messageScopeCount === 0 &&
      modeSignals.rowCount < 2
    ) {
      return "compose";
    }

    if (
      modeSignals.attachmentViewCount > 0 &&
      modeSignals.rowCount < 2 &&
      (modeSignals.visibleAttachmentCount > 0 || modeSignals.visibleLinkCount <= 2)
    ) {
      return "attachment_view";
    }

    if (looksLikeStructuredInbox) {
      return "inbox";
    }

    if (modeSignals.genericInboxSignalCount >= 3 && modeSignals.rowCount >= 2) {
      return "inbox";
    }

    if (
      modeSignals.messageScopeCount > 0 &&
      (modeSignals.visibleLinkCount > 0 || modeSignals.messageTextLength > 160 || modeSignals.visibleAttachmentCount > 0)
    ) {
      return "opened_message";
    }

    return "unknown";
  }

  function decideInjectionConfidence(environment, providerMatch, pageMode, modeSignals) {
    if (
      providerMatch.matchedSurface === "auth" ||
      pageMode === "account_chooser" ||
      pageMode === "auth_flow" ||
      pageMode === "compose"
    ) {
      return "low";
    }

    if (environment.supportTier === 1) {
      if (pageMode === "inbox" || pageMode === "opened_message" || pageMode === "attachment_view") {
        return providerMatch.matchConfidence === "high" ? "high" : "medium";
      }
    }

    if (environment.supportTier === 2) {
      if (pageMode === "opened_message" || pageMode === "attachment_view") {
        return "medium";
      }

      if (
        pageMode === "inbox" &&
        modeSignals.rowCount >= Math.max(4, getMinimumInboxRowCount(environment)) &&
        modeSignals.genericInboxSignalCount >= 3
      ) {
        return "high";
      }

      return "medium";
    }

    if (
      pageMode === "inbox" &&
      modeSignals.rowCount >= 6 &&
      modeSignals.genericInboxSignalCount >= 3
    ) {
      return "high";
    }

    if (pageMode === "opened_message" || pageMode === "attachment_view") {
      return "medium";
    }

    return "low";
  }

  function shouldInjectRowPreviews(pageMode, injectionConfidence, modeSignals) {
    return pageMode === "inbox" && injectionConfidence === "high" && modeSignals.rowCount >= 2;
  }

  function shouldInjectLinkCues(pageMode, injectionConfidence, modeSignals) {
    if (injectionConfidence === "low") {
      return false;
    }

    return (
      pageMode === "opened_message" ||
      pageMode === "attachment_view" ||
      (pageMode === "inbox" && modeSignals.hasReadingPane)
    );
  }

  function detectContext(currentHost, currentRootDomain) {
    const deps = getDeps();
    const normalizedHost = currentHost || deps.normalizeHost?.(location.hostname) || String(location.hostname || "").toLowerCase();
    const normalizedRoot = currentRootDomain || deps.getRootDomain?.(normalizedHost) || normalizedHost;
    const providerDetection = emailNamespace.providerDetection || {};
    const providerMatch = providerDetection.detectProvider?.(normalizedHost);

    if (!providerMatch) {
      return null;
    }

    const environment = providerMatch.environment;
    const modeSignals = collectModeSignals(environment, normalizedHost, normalizedRoot);
    const pageMode = detectPageMode(environment, providerMatch, modeSignals);
    const injectionConfidence = decideInjectionConfidence(environment, providerMatch, pageMode, modeSignals);

    return {
      ...environment,
      providerDetectedBy: providerMatch.detectedBy,
      providerMatchedSurface: providerMatch.matchedSurface,
      providerMatchConfidence: providerMatch.matchConfidence,
      pageMode,
      injectionConfidence,
      rowPreviewAllowed: shouldInjectRowPreviews(pageMode, injectionConfidence, modeSignals),
      linkCueAllowed: shouldInjectLinkCues(pageMode, injectionConfidence, modeSignals),
      modeSignals
    };
  }

  emailNamespace.pageModeDetection = {
    GENERIC_INBOX_SIGNAL_NAMES,
    detectContext,
    collectModeSignals,
    detectPageMode,
    decideInjectionConfidence,
    shouldInjectRowPreviews,
    shouldInjectLinkCues
  };
})();

// Orchestrates provider detection, page-mode detection, scanning, and email UI refreshes.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};
  const SCAN_CACHE_MS = 400;
  let emailObserver = null;
  let scrollListener = null;
  let routeChangeHandler = null;
  let restoreHistoryMethods = null;
  let lastObservedUrl = "";
  let lastScanCache = null;
  let lastScanCacheAt = 0;
  let lastSyncedPreviewSignature = "";
  let started = false;

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  function formatViewLabel(pageMode) {
    switch (pageMode) {
      case "inbox":
        return "Inbox list";
      case "opened_message":
        return "Opened message";
      case "compose":
        return "Compose view";
      case "auth_flow":
        return "Sign-in/auth page";
      case "account_chooser":
        return "Account chooser";
      case "attachment_view":
        return "Attachment view";
      default:
        return "Mail page";
    }
  }

  function getContext(currentHost, currentRootDomain) {
    return emailNamespace.pageModeDetection?.detectContext?.(currentHost, currentRootDomain) || null;
  }

  function isSupportedPage() {
    return Boolean(emailNamespace.providerDetection?.detectProvider?.());
  }

  function clearPreviews() {
    emailNamespace.emailUiInjector?.clearPreviews?.();
  }

  function invalidateScanCache() {
    lastScanCache = null;
    lastScanCacheAt = 0;
  }

  function createPreviewSignature(preview) {
    if (!preview) {
      return "";
    }

    return [
      preview.providerLabel || "",
      preview.pageMode || "",
      preview.injectionConfidence || "",
      preview.summary || "",
      preview.advice || "",
      (preview.reasons || []).join("|"),
      preview.rowCount || 0,
      preview.riskyRowCount || 0,
      preview.linkCount || 0,
      preview.riskyLinkCount || 0
    ].join("::");
  }

  function handleNavigationReset(url = location.href) {
    emailNamespace.emailState?.reset?.(url);
    invalidateScanCache();
    lastSyncedPreviewSignature = "";
    clearPreviews();
  }

  function scanCurrentSurface(currentHost, currentRootDomain, options = {}) {
    const deps = getDeps();
    const normalizedHost = currentHost || deps.normalizeHost?.(location.hostname) || String(location.hostname || "").toLowerCase();
    const normalizedRoot = currentRootDomain || deps.getRootDomain?.(normalizedHost) || normalizedHost;
    const now = Date.now();

    if (
      !options.forceFresh &&
      lastScanCache &&
      lastScanCache.url === location.href &&
      now - lastScanCacheAt <= SCAN_CACHE_MS
    ) {
      return lastScanCache;
    }

    const emailContext = getContext(normalizedHost, normalizedRoot);

    if (!emailContext) {
      invalidateScanCache();
      return null;
    }

    emailNamespace.emailState?.ensureForUrl?.(location.href);

    const rowResults = emailContext.rowPreviewAllowed
      ? emailNamespace.inboxRowScanner?.scanRows?.(emailContext) || []
      : [];
    const linkResults = emailContext.linkCueAllowed
      ? emailNamespace.messageLinkScanner?.scanLinks?.(emailContext, {
          currentHost: normalizedHost,
          currentRootDomain: normalizedRoot
        }) || []
      : [];
    const rowAssessments = rowResults.map((item) => item.preview).filter(Boolean);
    const linkPreviews = linkResults
      .filter((item) => item.preview?.show)
      .map((item) => {
        return {
          ...item.preview,
          cleanedUrl: item.assessment.cleanedUrl,
          domain: item.assessment.domain
        };
      });
    const riskyRows = rowAssessments.filter((preview) => preview.tone !== "safe");
    const riskyLinks = linkPreviews.filter((preview) => preview.tone !== "safe");
    const loginCautions = linkPreviews.filter((preview) => preview.label === "Login caution").length;
    const downloadCautions = linkPreviews.filter((preview) => preview.label === "Download caution").length;
    const heuristics = emailNamespace.emailHeuristics || {};
    const preview = {
      available: true,
      providerLabel: emailContext.providerLabel,
      supportTier: emailContext.supportTier,
      supportLabel:
        emailContext.supportTier === 1
          ? "Direct support"
          : emailContext.supportTier === 2
            ? "Adaptive support"
            : "Fallback support",
      rowPreviewMode: emailContext.rowPreviewMode,
      view: formatViewLabel(emailContext.pageMode),
      pageMode: emailContext.pageMode,
      injectionConfidence: emailContext.injectionConfidence,
      summary: heuristics.buildEmailSafetySummary
        ? heuristics.buildEmailSafetySummary(emailContext, riskyRows, riskyLinks, rowAssessments.length, linkPreviews.length)
        : "Email previews are ready.",
      advice: heuristics.buildEmailSafetyAdvice
        ? heuristics.buildEmailSafetyAdvice(riskyRows, riskyLinks, loginCautions, downloadCautions)
        : "Use the small mail cues if something feels unusual.",
      reasons: heuristics.buildEmailSafetyReasons
        ? heuristics.buildEmailSafetyReasons(riskyRows, riskyLinks, loginCautions, downloadCautions).slice(0, 3)
        : [],
      riskyLinks: riskyLinks.slice(0, 5).map((item) => {
        return {
          label: item.label,
          detail: item.detail,
          cleanedUrl: item.cleanedUrl,
          domain: item.domain
        };
      }),
      rowCount: rowAssessments.length,
      riskyRowCount: riskyRows.length,
      linkCount: linkPreviews.length,
      riskyLinkCount: riskyLinks.length
    };
    const scanResult = {
      url: location.href,
      currentHost: normalizedHost,
      currentRootDomain: normalizedRoot,
      emailContext,
      rowResults,
      linkResults,
      preview
    };

    lastScanCache = scanResult;
    lastScanCacheAt = now;
    return scanResult;
  }

  function applyPreviewDecorations(scanResult) {
    if (!scanResult?.emailContext) {
      clearPreviews();
      return null;
    }

    const activeSlots = new Set();

    scanResult.rowResults.forEach((item) => {
      if (!item?.preview || item.preview.tone === "safe") {
        return;
      }

      const cueSlot = emailNamespace.emailUiInjector?.ensureRowCueSlot?.(item.row, scanResult.emailContext);

      if (!cueSlot) {
        return;
      }

      activeSlots.add(cueSlot);
      emailNamespace.emailState?.rememberProcessedRow?.(item.rowKey);
      emailNamespace.emailUiInjector?.updateCue?.(
        cueSlot,
        item.preview.label,
        item.preview.detail,
        item.preview.tone
      );
    });

    scanResult.linkResults.forEach((item) => {
      if (!item?.preview || !item.preview.show) {
        return;
      }

      const cueSlot = emailNamespace.emailUiInjector?.ensureLinkCueSlot?.(item.element);

      if (!cueSlot) {
        return;
      }

      activeSlots.add(cueSlot);
      emailNamespace.emailState?.rememberProcessedLink?.(item.linkKey);
      emailNamespace.emailUiInjector?.updateCue?.(
        cueSlot,
        item.preview.label,
        item.preview.detail,
        item.preview.tone
      );
    });

    emailNamespace.emailUiInjector?.pruneInactiveCueSlots?.(activeSlots);
    return scanResult.emailContext;
  }

  function maybeSyncPreview(scanResult) {
    const deps = getDeps();
    const previewSignature = createPreviewSignature(scanResult?.preview);

    if (!scanResult?.preview || !previewSignature || previewSignature === lastSyncedPreviewSignature) {
      return;
    }

    lastSyncedPreviewSignature = previewSignature;
    deps.syncEmailPreviewQuietly?.(scanResult.preview);
  }

  function decoratePreviews(options = {}) {
    const scanResult = scanCurrentSurface(null, null, {
      forceFresh: Boolean(options.forceFresh)
    });

    if (!scanResult) {
      clearPreviews();
      return null;
    }

    const emailContext = applyPreviewDecorations(scanResult);

    if (options.syncPreview) {
      maybeSyncPreview(scanResult);
    }

    return emailContext;
  }

  function shouldIgnoreMutationNode(node) {
    if (!node) {
      return true;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return shouldIgnoreMutationNode(node.parentElement);
    }

    if (!(node instanceof Element)) {
      return false;
    }

    return Boolean(
      node.closest(".ai-guardian-mail-cue-slot") ||
      node.closest("#ai-guardian-root") ||
      node.closest("#ai-guardian-modal-root") ||
      node.closest("#ai-guardian-family-root")
    );
  }

  function isInterestingMailNode(node) {
    const providerDetection = emailNamespace.providerDetection || {};
    const providerConfig = providerDetection.detectProvider?.()?.environment || providerDetection.GENERIC_PROVIDER_CONFIG;
    const providerSelectors = [
      ...(providerConfig?.rowSelectors || []),
      ...(providerDetection.getOpenMessageSelectors?.(providerConfig, "messageBody") || []),
      ...(providerDetection.getOpenMessageSelectors?.(providerConfig, "links") || []),
      ...(providerDetection.getOpenMessageSelectors?.(providerConfig, "attachments") || []),
      ...(providerDetection.getFolderSelectors?.(providerConfig) || []),
      ...(providerDetection.getSearchSelectors?.(providerConfig) || []),
      ...(providerDetection.getComposeSelectors?.(providerConfig) || []),
      ...(providerDetection.getComposeButtonSelectors?.(providerConfig) || []),
      ...(providerDetection.getAuthSelectors?.(providerConfig) || []),
      ...(providerDetection.getFieldSelectors?.(providerConfig, "sender") || []),
      ...(providerDetection.getFieldSelectors?.(providerConfig, "subject") || []),
      ...(providerDetection.getFieldSelectors?.(providerConfig, "snippet") || []),
      ...(providerDetection.getGenericRowSelectors?.() || [])
    ];

    if (!node) {
      return false;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return isInterestingMailNode(node.parentElement);
    }

    if (!(node instanceof Element)) {
      return false;
    }

    return providerSelectors.some((selector) => {
      try {
        return Boolean(node.matches?.(selector) || node.querySelector?.(selector));
      } catch (error) {
        return false;
      }
    });
  }

  function shouldRefreshForMutations(mutations) {
    return mutations.some((mutation) => {
      const nodes = [
        mutation.target,
        ...Array.from(mutation.addedNodes || []),
        ...Array.from(mutation.removedNodes || [])
      ];

      return nodes.some((node) => {
        return !shouldIgnoreMutationNode(node) && isInterestingMailNode(node);
      });
    });
  }

  function requestRefresh() {
    decoratePreviews({
      forceFresh: true,
      syncPreview: true
    });
  }

  function refreshForCurrentRoute() {
    if (location.href !== lastObservedUrl) {
      lastObservedUrl = location.href;
      handleNavigationReset(location.href);
    }

    requestRefresh();
  }

  function stop() {
    if (emailObserver) {
      emailObserver.disconnect();
      emailObserver = null;
    }

    if (scrollListener) {
      window.removeEventListener("scroll", scrollListener, true);
      scrollListener = null;
    }

    if (routeChangeHandler) {
      window.removeEventListener("hashchange", routeChangeHandler, true);
      window.removeEventListener("popstate", routeChangeHandler, true);
      routeChangeHandler = null;
    }

    if (typeof restoreHistoryMethods === "function") {
      restoreHistoryMethods();
      restoreHistoryMethods = null;
    }

    started = false;
  }

  function startRouteListeners(scheduleRefresh) {
    if (routeChangeHandler) {
      return;
    }

    routeChangeHandler = () => {
      scheduleRefresh();
    };

    window.addEventListener("hashchange", routeChangeHandler, true);
    window.addEventListener("popstate", routeChangeHandler, true);

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function pushStateWrapper(...args) {
      const result = originalPushState(...args);
      routeChangeHandler();
      return result;
    };

    history.replaceState = function replaceStateWrapper(...args) {
      const result = originalReplaceState(...args);
      routeChangeHandler();
      return result;
    };

    restoreHistoryMethods = () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }

  function startObserver() {
    const debounce = emailNamespace.debounceUtils?.debounce;

    if (typeof debounce !== "function" || emailObserver) {
      return;
    }

    const debouncedRefresh = debounce(refreshForCurrentRoute, 350);

    emailObserver = new MutationObserver((mutations) => {
      if (!shouldRefreshForMutations(mutations)) {
        return;
      }

      debouncedRefresh();
    });

    emailObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "class",
        "href",
        "title",
        "aria-label",
        "aria-selected",
        "data-message-id",
        "data-thread-id",
        "data-convid",
        "data-test-id"
      ],
      childList: true,
      subtree: true,
      characterData: true
    });

    scrollListener = debounce(() => {
      const deps = getDeps();
      const normalizedHost = deps.normalizeHost?.(location.hostname) || String(location.hostname || "").toLowerCase();
      const normalizedRoot = deps.getRootDomain?.(normalizedHost) || normalizedHost;
      const emailContext = getContext(normalizedHost, normalizedRoot);

      if (!emailContext || emailContext.pageMode !== "inbox") {
        return;
      }

      requestRefresh();
    }, 250);

    window.addEventListener("scroll", scrollListener, true);
    startRouteListeners(debouncedRefresh);
  }

  function buildPreview(currentHost, currentRootDomain) {
    return scanCurrentSurface(currentHost, currentRootDomain, {
      forceFresh: false
    })?.preview || null;
  }

  function start() {
    if (started) {
      return;
    }

    started = true;
    lastObservedUrl = location.href;
    refreshForCurrentRoute();
    startObserver();
  }

  emailNamespace.controller = {
    start,
    stop,
    isSupportedPage,
    getContext,
    clearPreviews,
    handleNavigationReset,
    decoratePreviews,
    buildPreview
  };

  document.dispatchEvent(new CustomEvent("agws:email-controller-ready"));
})();

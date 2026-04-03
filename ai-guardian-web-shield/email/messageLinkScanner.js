// Scans links, buttons, and download actions inside visible open-message areas.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  function getVisibleMessageScopes(environment) {
    const deps = getDeps();
    const domUtils = emailNamespace.domUtils || {};
    const providerDetection = emailNamespace.providerDetection || {};
    const providerSelectors = providerDetection.getOpenMessageSelectors?.(environment, "messageBody") || [];
    const genericSelectors = providerDetection.getGenericMessageSelectors?.().messageBody || [];

    function queryVisibleScopes(selectors) {
      return selectors
        .flatMap((selector) => {
          try {
            return Array.from(document.querySelectorAll(selector));
          } catch (error) {
            return [];
          }
        })
        .filter((scope) => {
          return (
            scope instanceof HTMLElement &&
            typeof deps.isVisibleElement === "function" &&
            deps.isVisibleElement(scope) &&
            typeof domUtils.isElementNearViewport === "function" &&
            domUtils.isElementNearViewport(scope, 240)
          );
        });
    }

    const providerScopes = queryVisibleScopes(providerSelectors);

    if (providerScopes.length > 0 || environment?.supportTier === 1) {
      return providerScopes;
    }

    return queryVisibleScopes(genericSelectors);
  }

  function getVisibleMessageLinks(environment) {
    const deps = getDeps();
    const domUtils = emailNamespace.domUtils || {};
    const providerDetection = emailNamespace.providerDetection || {};
    const links = [];
    const seenUrls = new Set();
    const scopes = getVisibleMessageScopes(environment);
    const scopedSelectors = [
      ...(providerDetection.getOpenMessageSelectors?.(environment, "links") || ["a[href]"]),
      ...(providerDetection.getOpenMessageSelectors?.(environment, "attachments") || [])
    ];

    scopes.forEach((scope) => {
      scopedSelectors.forEach((selector) => {
        try {
          scope.querySelectorAll(selector).forEach((element) => {
            if (
              !(element instanceof HTMLElement) ||
              element.closest(".ai-guardian-mail-cue-slot") ||
              typeof deps.isVisibleElement !== "function" ||
              !deps.isVisibleElement(element) ||
              typeof domUtils.isElementNearViewport !== "function" ||
              !domUtils.isElementNearViewport(element, 200)
            ) {
              return;
            }

            const resolvedUrl = getInteractiveTargetUrl(element);

            if (!resolvedUrl || seenUrls.has(resolvedUrl)) {
              return;
            }

            seenUrls.add(resolvedUrl);
            links.push(element);
          });
        } catch (error) {
          return;
        }
      });

      scope.querySelectorAll("button[formaction], button[data-url], [role='button'][data-url]").forEach((element) => {
        if (
          !(element instanceof HTMLElement) ||
          element.closest(".ai-guardian-mail-cue-slot") ||
          typeof deps.isVisibleElement !== "function" ||
          !deps.isVisibleElement(element) ||
          typeof domUtils.isElementNearViewport !== "function" ||
          !domUtils.isElementNearViewport(element, 200)
        ) {
          return;
        }

        const resolvedUrl = getInteractiveTargetUrl(element);

        if (!resolvedUrl || seenUrls.has(resolvedUrl)) {
          return;
        }

        seenUrls.add(resolvedUrl);
        links.push(element);
      });
    });

    return links;
  }

  function getInteractiveTargetUrl(element) {
    const deps = getDeps();

    if (element instanceof HTMLAnchorElement) {
      return typeof deps.getExactNavigationTargetHref === "function"
        ? deps.getExactNavigationTargetHref(element)
        : String(element.href || "").trim();
    }

    if (!(element instanceof HTMLElement)) {
      return "";
    }

    const candidateUrl =
      element.getAttribute("formaction") ||
      element.getAttribute("data-url") ||
      element.getAttribute("href");

    return typeof deps.resolveHttpUrl === "function" ? deps.resolveHttpUrl(candidateUrl) : String(candidateUrl || "");
  }

  function getInteractiveElementText(element, fallbackText = "") {
    const text = [
      element?.textContent || "",
      element?.getAttribute?.("aria-label"),
      element?.getAttribute?.("title")
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return text || fallbackText || "message action";
  }

  function assessInteractiveElement(element, context = {}) {
    const deps = getDeps();

    if (element instanceof HTMLAnchorElement && typeof deps.assessLinkElement === "function") {
      return deps.assessLinkElement(element, context);
    }

    const resolvedUrl = getInteractiveTargetUrl(element);

    if (!resolvedUrl || typeof deps.assessUrl !== "function") {
      return null;
    }

    const assessment = deps.assessUrl(resolvedUrl, context);

    return {
      ...assessment,
      mismatchLevel: "none",
      text: getInteractiveElementText(element, assessment.domain)
    };
  }

  function buildLinkFeatureObject(element, assessment, environment) {
    const providerDetection = emailNamespace.providerDetection || {};
    const heuristics = emailNamespace.emailHeuristics || {};
    const attachmentSelectors = providerDetection.getOpenMessageSelectors?.(environment, "attachments") || [];
    const text = getInteractiveElementText(element, assessment.text);
    const phraseMatches = typeof heuristics.buildPhraseCategoryMatches === "function"
      ? heuristics.buildPhraseCategoryMatches(text)
      : {};
    const phraseSignals = {
      urgency: (phraseMatches.urgency || []).length > 0,
      accountThreats: (phraseMatches.accountThreats || []).length > 0,
      paymentInvoiceBait: (phraseMatches.paymentInvoiceBait || []).length > 0,
      scamPromoBait: (phraseMatches.scamPromoBait || []).length > 0,
      credentialResetBait: (phraseMatches.credentialResetBait || []).length > 0,
      cryptoScamBait: (phraseMatches.cryptoScamBait || []).length > 0
    };

    return {
      provider: environment?.id || "unknown",
      mode: "opened_message",
      supportTier: environment?.supportTier || 3,
      actionText: text,
      destinationHost: assessment.domain,
      isDownload: Boolean(assessment.isDownload),
      isShortener: Boolean(assessment.identitySignals?.isShortener),
      hasLookalikeBrand: Boolean(assessment.identitySignals?.lookalikeBrand),
      hasHiddenRedirect: Boolean(assessment.identitySignals?.hiddenRedirect),
      isTrustedAuthFlow: Boolean(assessment.identitySignals?.trustedAuthFlow),
      sameSiteLevel: assessment.sameSiteLevel || "external",
      phraseSignals,
      phraseMatches,
      visibleReasonCount: Array.isArray(assessment.reasons) ? assessment.reasons.length : 0,
      matchesAttachmentSelector: attachmentSelectors.some((selector) => {
        try {
          return element.matches(selector);
        } catch (error) {
          return false;
        }
      })
    };
  }

  function scanLinks(environment, context = {}) {
    const heuristics = emailNamespace.emailHeuristics;
    const state = emailNamespace.emailState;

    return getVisibleMessageLinks(environment)
      .slice(0, environment?.maxLinks || 14)
      .map((element) => {
        const assessment = assessInteractiveElement(element, context);

        if (!assessment) {
          return null;
        }

        const preview = heuristics?.buildMessageLinkPreview
          ? heuristics.buildMessageLinkPreview(element, assessment, environment)
          : null;

        return preview
          ? {
              element,
              linkKey: state?.buildLinkKey ? state.buildLinkKey(element, getInteractiveTargetUrl(element)) : "",
              assessment,
              features: buildLinkFeatureObject(element, assessment, environment),
              preview
            }
          : null;
      })
      .filter(Boolean);
  }

  emailNamespace.messageLinkScanner = {
    getVisibleMessageScopes,
    getVisibleMessageLinks,
    getInteractiveTargetUrl,
    getInteractiveElementText,
    assessInteractiveElement,
    buildLinkFeatureObject,
    scanLinks
  };
})();

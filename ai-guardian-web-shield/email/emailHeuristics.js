// Holds lightweight email-specific labels and scoring hints for row and link previews.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  const PHISHING_PHRASE_CATEGORIES = {
    urgency: [
      "urgent",
      "immediately",
      "act now",
      "final notice",
      "last warning",
      "limited time",
      "expires today",
      "verify now",
      "urgent action",
      "act today",
      "respond now",
      "срочно",
      "немедленно",
      "последнее предупреждение",
      "истекает сегодня",
      "проверьте сейчас"
    ],
    accountThreats: [
      "account suspended",
      "account locked",
      "password expired",
      "verify your account",
      "security alert",
      "unusual activity",
      "confirm your identity",
      "account disabled",
      "mailbox suspended",
      "unusual sign-in",
      "аккаунт заблокирован",
      "учетная запись заблокирована",
      "пароль истек",
      "подтвердите аккаунт"
    ],
    paymentInvoiceBait: [
      "invoice attached",
      "payment failed",
      "refund available",
      "billing issue",
      "outstanding balance",
      "transaction alert",
      "receipt enclosed",
      "invoice",
      "billing",
      "deposit",
      "withdrawal",
      "payout",
      "bonus credit",
      "оплата",
      "платеж",
      "счет",
      "возврат",
      "баланс",
      "выплата",
      "выплаты",
      "депозит",
      "квитанция"
    ],
    scamPromoBait: [
      "jackpot",
      "bonus",
      "claim reward",
      "cash prize",
      "win now",
      "deposit bonus",
      "free spins",
      "casino",
      "promo",
      "offer",
      "special offer",
      "gift",
      "winner",
      "click and bonus",
      "one click",
      "spin now",
      "подарок",
      "бонус",
      "джекпот",
      "выигрыш",
      "выиграй",
      "победа",
      "приз",
      "акция",
      "оффер",
      "играй",
      "игра",
      "казино",
      "слоты",
      "бонусов",
      "подарок к депозиту",
      "начни игру",
      "1 клик"
    ],
    credentialResetBait: [
      "reset password",
      "login now",
      "sign in to continue",
      "update credentials",
      "restore access",
      "verify login",
      "unlock account",
      "log in",
      "sign in",
      "войти",
      "вход",
      "логин",
      "подтвердите вход",
      "сброс пароля",
      "восстановить доступ"
    ],
    cryptoScamBait: [
      "wallet recovery",
      "seed phrase",
      "claim token",
      "connect wallet",
      "crypto bonus",
      "сид фраза",
      "сид-фраза",
      "восстановление кошелька",
      "подключите кошелек",
      "крипто бонус"
    ]
  };

  const MAIL_ATTACHMENT_HINTS = [
    "attachment",
    "download",
    "open document",
    "open file",
    "invoice",
    "receipt",
    "pdf",
    "zip"
  ];

  const SPAM_PROMO_EMOJIS = ["🔥", "🎁", "💸", "💰", "🎰", "🏆", "✅"];

  const PHISHING_CATEGORY_ORDER = [
    "urgency",
    "accountThreats",
    "paymentInvoiceBait",
    "scamPromoBait",
    "credentialResetBait",
    "cryptoScamBait"
  ];

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  function normalizeText(value) {
    const deps = getDeps();
    return typeof deps.normalizeThreatText === "function"
      ? deps.normalizeThreatText(value)
      : String(value || "").toLowerCase();
  }

  function countPhraseMatches(text, phrases) {
    const normalizedText = normalizeText(text);
    return phrases.filter((phrase) => normalizedText.includes(normalizeText(phrase)));
  }

  function buildPhraseCategoryMatches(text) {
    return PHISHING_CATEGORY_ORDER.reduce((result, category) => {
      result[category] = countPhraseMatches(text, PHISHING_PHRASE_CATEGORIES[category] || []);
      return result;
    }, {});
  }

  function getMailboxRiskContext() {
    const normalizedUrl = String(location.href || "").toLowerCase();
    const normalizedHash = String(location.hash || "").toLowerCase();

    if (
      normalizedUrl.includes("in:spam") ||
      normalizedUrl.includes("label=spam") ||
      normalizedHash.includes("spam") ||
      normalizedUrl.includes("junk") ||
      normalizedHash.includes("junk")
    ) {
      return "spam";
    }

    if (
      normalizedUrl.includes("category=promotions") ||
      normalizedHash.includes("category=promotions") ||
      normalizedHash.includes("promotions")
    ) {
      return "promotions";
    }

    return "normal";
  }

  function countPromoEmojiMatches(text) {
    const normalizedText = String(text || "");
    return SPAM_PROMO_EMOJIS.reduce((count, emoji) => {
      return count + (normalizedText.includes(emoji) ? 1 : 0);
    }, 0);
  }

  function getVisibleEmailAddress(scope) {
    const possibleValues = [
      scope?.getAttribute?.("email"),
      scope?.getAttribute?.("data-hovercard-id"),
      scope?.getAttribute?.("data-email"),
      scope?.getAttribute?.("title")
    ];

    scope?.querySelectorAll?.("[email], [data-hovercard-id], [data-email], [title*='@']").forEach((node) => {
      possibleValues.push(node.getAttribute("email"));
      possibleValues.push(node.getAttribute("data-hovercard-id"));
      possibleValues.push(node.getAttribute("data-email"));
      possibleValues.push(node.getAttribute("title"));
      possibleValues.push(node.textContent || "");
    });

    const emailMatch = possibleValues
      .filter(Boolean)
      .map((value) => String(value).match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/i))
      .find((match) => Boolean(match));

    return emailMatch ? emailMatch[0].toLowerCase() : "";
  }

  function buildRowFeatureObject(rowParts = {}, environment = {}) {
    const deps = getDeps();
    const senderText = String(rowParts.sender || "");
    const subjectText = String(rowParts.subject || "");
    const snippetText = String(rowParts.snippet || "");
    const combinedText = [senderText, subjectText, snippetText].join(" ").trim();
    const phraseMatches = buildPhraseCategoryMatches(combinedText);
    const claimedBrand = typeof deps.findBrandMention === "function"
      ? deps.findBrandMention(normalizeText(combinedText))
      : "";
    const senderEmail = senderText.includes("@") ? senderText : "";
    const senderDomain = senderEmail ? deps.normalizeHost(senderEmail.split("@").pop() || "") : "";
    const attachmentHintMatches = MAIL_ATTACHMENT_HINTS.filter((hint) => normalizeText(combinedText).includes(normalizeText(hint)));
    const mailboxContext = getMailboxRiskContext();
    const promoEmojiCount = countPromoEmojiMatches(combinedText);
    const phraseSignals = {
      urgency: phraseMatches.urgency.length > 0,
      accountThreats: phraseMatches.accountThreats.length > 0,
      paymentInvoiceBait: phraseMatches.paymentInvoiceBait.length > 0,
      scamPromoBait: phraseMatches.scamPromoBait.length > 0,
      credentialResetBait: phraseMatches.credentialResetBait.length > 0,
      cryptoScamBait: phraseMatches.cryptoScamBait.length > 0
    };
    const phraseCounts = {
      urgency: phraseMatches.urgency.length,
      accountThreats: phraseMatches.accountThreats.length,
      paymentInvoiceBait: phraseMatches.paymentInvoiceBait.length,
      scamPromoBait: phraseMatches.scamPromoBait.length,
      credentialResetBait: phraseMatches.credentialResetBait.length,
      cryptoScamBait: phraseMatches.cryptoScamBait.length
    };
    const trustedDomainMatch =
      Boolean(claimedBrand) &&
      Boolean(senderDomain) &&
      typeof deps.isOfficialHostForBrand === "function" &&
      deps.isOfficialHostForBrand(senderDomain, claimedBrand);

    return {
      provider: environment?.id || "unknown",
      mode: "inbox",
      supportTier: environment?.supportTier || 3,
      senderText,
      subjectText,
      snippetText,
      combinedText,
      senderDomain,
      brandMention: claimedBrand || "",
      mailboxContext,
      phraseSignals,
      phraseCounts,
      phraseMatches,
      hasUrgency: phraseSignals.urgency,
      hasAccountThreat: phraseSignals.accountThreats,
      hasPaymentLanguage: phraseSignals.paymentInvoiceBait,
      hasScamPromoLanguage: phraseSignals.scamPromoBait,
      hasCredentialLanguage: phraseSignals.credentialResetBait,
      hasCryptoLanguage: phraseSignals.cryptoScamBait,
      hasAttachmentHint: attachmentHintMatches.length > 0,
      promoEmojiCount,
      hasPromoEmojiBurst: promoEmojiCount >= 2,
      phraseCategoryHitCount: Object.values(phraseSignals).filter(Boolean).length,
      attachmentHintMatches,
      urgencyMatchCount: phraseCounts.urgency,
      accountThreatMatchCount: phraseCounts.accountThreats,
      paymentMatchCount: phraseCounts.paymentInvoiceBait,
      scamPromoMatchCount: phraseCounts.scamPromoBait,
      credentialMatchCount: phraseCounts.credentialResetBait,
      cryptoMatchCount: phraseCounts.cryptoScamBait,
      trustedDomainMatch,
      authFlowTrusted: false
    };
  }

  function assessInboxRow(row, environment = {}, rowParts = null) {
    const deps = getDeps();
    const parts = rowParts || {
      sender: "",
      subject: "",
      snippet: "",
      combinedText: String(row?.innerText || "")
    };
    const features = buildRowFeatureObject(parts, environment);

    if (!features.combinedText) {
      return null;
    }

    let score = Number(deps.SCORE_BASE || 4);
    let detail = "This message looks normal.";
    let strongSignals = 0;
    let moderateSignals = 0;
    const hasStackedSpamBait =
      features.phraseCategoryHitCount >= 2 ||
      (features.hasScamPromoLanguage && (features.hasPaymentLanguage || features.hasUrgency)) ||
      (features.hasAttachmentHint && (features.hasUrgency || features.hasPaymentLanguage));
    const spamFolderContext = features.mailboxContext === "spam";

    if (features.hasCryptoLanguage) {
      score += deps.SIGNAL_WEIGHTS?.strong?.heavy || 30;
      strongSignals += 1;
      detail = "This message uses wallet or crypto wording that often needs extra care.";
    }

    if (features.hasUrgency && (features.hasAccountThreat || features.hasCredentialLanguage || features.hasPaymentLanguage)) {
      score += deps.SIGNAL_WEIGHTS?.strong?.normal || 24;
      strongSignals += 1;
      detail = "This message is trying to rush you about an account or payment issue.";
    } else if (features.hasAccountThreat || features.hasCredentialLanguage) {
      score += deps.SIGNAL_WEIGHTS?.moderate?.normal || 12;
      moderateSignals += 1;
      detail = "This message asks for sign-in or account action.";
    }

    if (features.hasPaymentLanguage) {
      score += deps.SIGNAL_WEIGHTS?.moderate?.normal || 12;
      moderateSignals += 1;
      detail = "This message talks about billing, invoices, or payment details.";
    }

    if (features.hasScamPromoLanguage) {
      score +=
        features.scamPromoMatchCount >= 2 || features.hasPromoEmojiBurst
          ? deps.SIGNAL_WEIGHTS?.moderate?.heavy || 15
          : deps.SIGNAL_WEIGHTS?.moderate?.normal || 12;
      moderateSignals += 1;
      detail = "This message uses prize, bonus, or promo wording that can need a second look.";
    }

    if (hasStackedSpamBait) {
      score += deps.SIGNAL_WEIGHTS?.moderate?.light || 8;
      moderateSignals += 1;
      detail = "This message mixes several spam-like cues together.";
    }

    if (
      features.brandMention &&
      features.senderDomain &&
      !features.trustedDomainMatch &&
      typeof deps.isStrongBrandClaim === "function" &&
      deps.isStrongBrandClaim(`${features.brandMention} ${features.combinedText}`, features.brandMention)
    ) {
      score += deps.SIGNAL_WEIGHTS?.strong?.normal || 25;
      strongSignals += 1;
      detail = `This message mentions ${deps.formatBrandName(features.brandMention)}, but the sender address looks different.`;
    }

    if (features.hasAttachmentHint && (features.hasUrgency || features.hasPaymentLanguage)) {
      score += deps.SIGNAL_WEIGHTS?.moderate?.normal || 12;
      moderateSignals += 1;
      detail = "This message pushes you to open a file or download quickly.";
    }

    if (spamFolderContext && (features.phraseCategoryHitCount > 0 || features.hasAttachmentHint)) {
      score += deps.SIGNAL_WEIGHTS?.low?.normal || 4;
      detail = "This message is already in a spam-style folder and also uses caution cues.";
    }

    if (features.hasCryptoLanguage) {
      score = Math.max(score, 72);
    } else if (features.hasUrgency && (features.hasAccountThreat || features.hasCredentialLanguage || features.hasPaymentLanguage)) {
      score = Math.max(score, 58);
    } else if (features.hasScamPromoLanguage && (features.hasPaymentLanguage || features.hasAttachmentHint || spamFolderContext)) {
      score = Math.max(score, 42);
    } else if (features.phraseCategoryHitCount >= 3) {
      score = Math.max(score, 48);
    }

    if (environment.rowPreviewMode === "adaptive" && strongSignals === 0 && moderateSignals <= 1) {
      score = Math.min(score, 24);
    }

    if (strongSignals === 0 && moderateSignals === 0) {
      return {
        score,
        label: "Looks safe",
        tone: "safe",
        detail: "Nothing unusual stood out in this message preview.",
        features
      };
    }

    return {
      score: deps.clampScore(score),
      label: strongSignals > 0 || score >= 55 ? "Needs a closer look" : "Check carefully",
      tone: strongSignals > 0 || score >= 55 ? "risk" : "caution",
      detail,
      features
    };
  }

  function buildMessageLinkPreview(element, assessment, environment) {
    const deps = getDeps();
    const providerDetection = emailNamespace.providerDetection || {};
    const attachmentSelectors = providerDetection.getOpenMessageSelectors?.(environment, "attachments") || [];
    const anchorText = String(
      emailNamespace.messageLinkScanner?.getInteractiveElementText(element, assessment.text) || assessment.text || ""
    ).toLowerCase();
    const isAttachmentLike =
      assessment.isDownload ||
      attachmentSelectors.some((selector) => {
        try {
          return element.matches(selector);
        } catch (error) {
          return false;
        }
      }) ||
      MAIL_ATTACHMENT_HINTS.some((hint) => anchorText.includes(hint));

    if (assessment.sameSiteLevel === "same-host" && !assessment.identitySignals.trustedAuthFlow && !isAttachmentLike) {
      return null;
    }

    if (assessment.identitySignals.trustedAuthFlow && assessment.score < 40) {
      return {
        show: true,
        label: "Looks normal",
        tone: "safe",
        detail: "This account step looks normal."
      };
    }

    if (
      assessment.mismatchLevel === "misleading" ||
      assessment.identitySignals.lookalikeBrand ||
      assessment.identitySignals.localKnownRiskMatch
    ) {
      return {
        show: true,
        label: "Check link",
        tone: "risk",
        detail: assessment.reasons[0] || "This link may not match the site it claims to be."
      };
    }

    if (
      (deps.ACTION_PROMPT_WORDS || []).some((word) => anchorText.includes(word)) &&
      (
        assessment.identitySignals.lookalikeBrand ||
        assessment.identitySignals.hiddenRedirect ||
        assessment.identitySignals.protocol !== "https:" ||
        assessment.identitySignals.suspiciousTld ||
        assessment.identitySignals.usesIpAddress ||
        assessment.identitySignals.usesEncodedHost ||
        assessment.score >= 35
      )
    ) {
      return {
        show: true,
        label: "Login caution",
        tone: assessment.score >= 60 ? "risk" : "caution",
        detail: "This sign-in step looks unusual."
      };
    }

    if (isAttachmentLike) {
      return {
        show: true,
        label: "Download caution",
        tone: assessment.score >= 60 ? "risk" : "caution",
        detail:
          assessment.score >= 60
            ? assessment.reasons[0] || "This download may need extra care."
            : "This message offers a file or download. Take a quick look before opening it."
      };
    }

    if (assessment.score >= 60) {
      return {
        show: true,
        label: "Check link",
        tone: "risk",
        detail: assessment.reasons[0] || "This link may need extra care."
      };
    }

    if (
      assessment.score >= 20 ||
      assessment.identitySignals.hiddenRedirect ||
      assessment.identitySignals.isShortener ||
      assessment.identitySignals.protocol !== "https:" ||
      isAttachmentLike
    ) {
      return {
        show: true,
        label: "Check link",
        tone: "caution",
        detail: assessment.reasons[0] || "Check this link before clicking."
      };
    }

    return {
      show: true,
      label: "Looks normal",
      tone: "safe",
      detail: "The address looks consistent for this link."
    };
  }

  function buildEmailSafetySummary(environment, riskyRows, riskyLinks, totalRows, totalLinks) {
    if (riskyLinks.length > 0) {
      return "This message view has links or actions worth checking before you click.";
    }

    if (riskyRows.length > 0) {
      return "This inbox has a few messages that may need a closer look.";
    }

    if (totalRows > 0) {
      return "This inbox looks calm right now.";
    }

    if (totalLinks > 0) {
      return "This open message looks mostly normal right now.";
    }

    return `${environment.providerLabel} is ready for lightweight email safety checks.`;
  }

  function buildEmailSafetyAdvice(riskyRows, riskyLinks, loginCautions, downloadCautions) {
    if (loginCautions > 0) {
      return "Open sign-in links carefully. When unsure, go to the service directly.";
    }

    if (downloadCautions > 0) {
      return "Open message files only when you expected them.";
    }

    if (riskyLinks.length > 0) {
      return "Check where message links go before clicking.";
    }

    if (riskyRows.length > 0) {
      return "Open unusual messages carefully and double-check who sent them.";
    }

    return "Use the small mail cues if something feels unusual.";
  }

  function buildEmailSafetyReasons(riskyRows, riskyLinks, loginCautions, downloadCautions) {
    const deps = getDeps();
    const reasons = [];

    if (riskyRows.length > 0) {
      reasons.push(riskyRows[0].detail);
    }

    if (loginCautions > 0) {
      reasons.push("At least one visible message link looks like an unusual sign-in step.");
    }

    if (downloadCautions > 0) {
      reasons.push("At least one visible message action looks like a file or download.");
    }

    if (riskyLinks.length > 0) {
      reasons.push(riskyLinks[0].detail);
    }

    if (!reasons.length) {
      reasons.push("No unusual email cues stood out right now.");
    }

    return typeof deps.uniqueList === "function" ? deps.uniqueList(reasons) : reasons;
  }

  emailNamespace.emailHeuristics = {
    PHISHING_PHRASE_CATEGORIES,
    PHISHING_CATEGORY_ORDER,
    MAIL_ATTACHMENT_HINTS,
    getVisibleEmailAddress,
    buildPhraseCategoryMatches,
    buildRowFeatureObject,
    assessInboxRow,
    buildMessageLinkPreview,
    buildEmailSafetySummary,
    buildEmailSafetyAdvice,
    buildEmailSafetyReasons
  };
})();

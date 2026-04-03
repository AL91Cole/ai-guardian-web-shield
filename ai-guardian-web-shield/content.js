// This script runs on pages and does the live assistant work:
// - scores pages and links from 0 to 100
// - shows Google result badges with a lightweight Search Result Identity Preview
// - adds lightweight pre-click mail cues in supported webmail views
// - shows a floating page score
// - warns before risky clicks, downloads, and form sends
// - adds a simple Site Identity Check to explain connection and address trust cues

(() => {
  if (window.aiGuardianWebShieldLoaded) {
    return;
  }

  window.aiGuardianWebShieldLoaded = true;

  const PUSHY_PHRASES = [
    "act now",
    "verify immediately",
    "urgent",
    "immediately",
    "suspended",
    "final warning",
    "limited time",
    "confirm now",
    "security alert",
    "unusual activity",
    "update now",
    "verify now",
    "your account is locked",
    "confirm your identity",
    "problem with your account"
  ];

  const PRIVATE_FIELD_KEYWORDS = [
    "email",
    "phone",
    "mobile",
    "address",
    "birth",
    "dob",
    "ssn",
    "social",
    "credit",
    "card",
    "cvv",
    "bank",
    "routing",
    "account",
    "zip",
    "postal"
  ];

  const FRIENDLY_FIELD_NAMES = {
    email: "email",
    phone: "phone number",
    mobile: "phone number",
    address: "home address",
    birth: "birthday",
    dob: "birthday",
    ssn: "id number",
    social: "id number",
    credit: "card number",
    card: "card number",
    cvv: "card code",
    bank: "bank details",
    routing: "bank details",
    account: "account info",
    zip: "zip code",
    postal: "zip code"
  };

  const TRACKER_PARAM_NAMES = new Set([
    "fbclid",
    "gclid",
    "dclid",
    "msclkid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
    "source",
    "src",
    "si"
  ]);

  const TRACKER_PARAM_PREFIXES = ["utm_"];

  const SUSPICIOUS_TLDS = new Set([
    "zip",
    "mov",
    "xyz",
    "top",
    "click",
    "gq",
    "tk",
    "pw",
    "rest",
    "fit",
    "country",
    "support"
  ]);

  const URL_SHORTENERS = new Set([
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "buff.ly",
    "rebrand.ly",
    "shorturl.at",
    "is.gd",
    "cutt.ly",
    "lnkd.in"
  ]);

  const RISKY_DOWNLOAD_EXTENSIONS = new Set([
    "apk",
    "app",
    "bat",
    "bin",
    "cmd",
    "com",
    "dmg",
    "exe",
    "img",
    "iso",
    "jar",
    "js",
    "lnk",
    "msi",
    "pkg",
    "ps1",
    "scr",
    "vbs",
    "zip"
  ]);

  const LOOKALIKE_HINTS = [
    "login",
    "secure",
    "update",
    "verify",
    "account",
    "signin",
    "support",
    "auth",
    "billing",
    "confirm",
    "check"
  ];

  const BRAND_RULES = [
    { brand: "google", officialHosts: ["google.com", "google.co.uk", "google.ca", "google.co.in"] },
    { brand: "paypal", officialHosts: ["paypal.com"] },
    { brand: "amazon", officialHosts: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca"] },
    { brand: "apple", officialHosts: ["apple.com"] },
    { brand: "microsoft", officialHosts: ["microsoft.com", "office.com", "live.com"] },
    { brand: "netflix", officialHosts: ["netflix.com"] },
    { brand: "facebook", officialHosts: ["facebook.com", "fb.com"] },
    { brand: "instagram", officialHosts: ["instagram.com"] },
    { brand: "chase", officialHosts: ["chase.com"] }
  ];

  const DEFAULT_SETTINGS = Object.freeze({
    searchBadgesEnabled: true,
    floatingBadgeEnabled: true,
    proactiveWarningsEnabled: true,
    readAloudEnabled: true,
    localOnlyMode: true,
    privacyShieldEnabled: false,
    labyrinthModeEnabled: true,
    guidedProtectionModeEnabled: true,
    onboardingCompleted: false,
    protectionStyle: "balanced",
    accessibilityProfile: "general",
    extraSimpleLanguageEnabled: false,
    lowStimulusModeEnabled: false,
    highContrastModeEnabled: false,
    largeTextModeEnabled: false,
    reducedClutterModeEnabled: false,
    reducedMotionModeEnabled: false,
    adultSiteBlockingEnabled: false,
    protectionLevel: "standard",
    familyProtectionExceptions: [],
    trustedAdultAlertEnabled: false,
    trustedAdultContact: ""
  });

  const GENERIC_LINK_TEXTS = new Set([
    "click here",
    "learn more",
    "read more",
    "open",
    "next",
    "continue",
    "details",
    "more",
    "website",
    "visit site",
    "go",
    "here"
  ]);

  const ACTION_PROMPT_WORDS = [
    "sign in",
    "log in",
    "login",
    "verify",
    "confirm",
    "update",
    "reset",
    "billing",
    "account",
    "support"
  ];

  const SIGN_IN_PAGE_HINTS = [
    "sign in",
    "log in",
    "login",
    "password",
    "reset password",
    "verify account",
    "account access"
  ];

  const HIGH_RISK_PAGE_PHRASES = [
    "seed phrase",
    "recovery phrase",
    "private key",
    "wallet recovery",
    "recover wallet",
    "gift card payment",
    "gift card only",
    "free unlock",
    "hacked account recovery",
    "urgent verify now",
    "password expired",
    "immediate action required",
    "keygen",
    "serial key",
    "activation code",
    "crack download"
  ];

  const WALLET_BAIT_HINTS = [
    "seed phrase",
    "recovery phrase",
    "private key",
    "wallet recovery",
    "recover wallet"
  ];

  const CRYPTO_SCAM_HINTS = [
    "crypto giveaway",
    "claim token",
    "claim your token",
    "verify wallet",
    "wallet verify",
    "free unlock"
  ];

  const CRACK_BAIT_HINTS = [
    "keygen",
    "crack",
    "serial key",
    "license key",
    "activation code",
    "full version",
    "free unlock"
  ];
  const BENIGN_DOWNLOAD_HINTS = [
    "mods",
    "modding",
    "download",
    "downloads",
    "install",
    "installation",
    "upload",
    "uploads",
    "community",
    "forums",
    "files"
  ];

  const LOGIN_URL_HINTS = [
    "login",
    "signin",
    "sign in",
    "verify",
    "account",
    "billing",
    "secure",
    "auth",
    "update"
  ];

  const HIDDEN_REDIRECT_PARAM_NAMES = new Set([
    "url",
    "u",
    "target",
    "dest",
    "destination",
    "redirect",
    "redirect_url",
    "redir",
    "next",
    "continue",
    "return",
    "return_to",
    "returnurl"
  ]);

  const TRUSTED_AUTH_FLOW_RULES = [
    {
      brand: "google",
      hosts: ["accounts.google.com", "mail.google.com"],
      allowedRoots: ["google.com"],
      pathHints: ["accountchooser", "servicelogin", "signin", "logout"],
      continueParams: ["continue", "followup", "next", "service", "rart"],
      serviceHints: ["mail", "gmail", "accounts"]
    },
    {
      brand: "microsoft",
      hosts: ["login.live.com", "login.microsoftonline.com", "outlook.live.com", "outlook.office.com"],
      allowedRoots: ["live.com", "microsoft.com", "office.com", "outlook.com"],
      pathHints: ["signin", "logout", "authorize", "oauth"],
      continueParams: ["continue", "next", "redirect_uri", "ru"],
      serviceHints: ["outlook", "office", "live", "mail"]
    },
    {
      brand: "yahoo",
      hosts: ["login.yahoo.com", "mail.yahoo.com"],
      allowedRoots: ["yahoo.com"],
      pathHints: ["signin", "account"],
      continueParams: ["done", "src", "next"],
      serviceHints: ["mail", "yahoo"]
    }
  ];

  const MAIL_ROW_RISK_HINTS = [
    "verify your account",
    "account locked",
    "password expired",
    "payment failed",
    "invoice attached",
    "confirm now",
    "security alert",
    "urgent action",
    "gift card"
  ];

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

  const WEBMAIL_ENVIRONMENTS = [
    {
      id: "gmail",
      providerLabel: "Gmail",
      supportTier: 1,
      rowPreviewMode: "direct",
      hosts: ["mail.google.com"],
      authHosts: ["accounts.google.com"],
      inboxRowSelectors: ["tr.zA", "tr[role='row']"],
      messageScopeSelectors: ["div.a3s", "div[role='listitem']", "div[role='main']"],
      attachmentSelectors: ["a[href][download]", "a[href*='view=att' i]", "a[href*='attid=' i]"],
      maxRows: 36,
      maxLinks: 18
    },
    {
      id: "outlook",
      providerLabel: "Outlook Web",
      supportTier: 1,
      rowPreviewMode: "direct",
      hosts: ["outlook.live.com", "outlook.office.com", "outlook.office365.com"],
      authHosts: ["login.live.com", "login.microsoftonline.com"],
      inboxRowSelectors: ["div[role='option']", "div[aria-selected][role='option']", "div[role='row']"],
      messageScopeSelectors: ["div[role='document']", "div[aria-label*='Message body' i]", "main"],
      attachmentSelectors: ["a[href][download]", "button[aria-label*='Download' i]"],
      maxRows: 34,
      maxLinks: 18
    },
    {
      id: "yahoo",
      providerLabel: "Yahoo Mail",
      supportTier: 1,
      rowPreviewMode: "direct",
      hosts: ["mail.yahoo.com"],
      authHosts: ["login.yahoo.com"],
      inboxRowSelectors: ["li[data-test-id*='message']", "[data-test-id='message-list-item']"],
      messageScopeSelectors: ["[data-test-id='message-view-body']", "[role='article']", "main"],
      attachmentSelectors: ["a[href][download]", "a[href*='download' i]"],
      maxRows: 34,
      maxLinks: 16
    },
    {
      id: "proton",
      providerLabel: "Proton Mail",
      supportTier: 2,
      rowPreviewMode: "adaptive",
      hosts: ["mail.proton.me", "mail.protonmail.com"],
      authHosts: ["account.proton.me", "account.protonmail.com"],
      inboxRowSelectors: ["[data-testid*='message-row']", "[role='row']", "[data-shortcut-target='item-container']"],
      messageScopeSelectors: ["[data-testid='message-body']", "[role='document']", "main"],
      attachmentSelectors: ["a[href][download]", "button[aria-label*='download' i]"],
      maxRows: 28,
      maxLinks: 14
    },
    {
      id: "icloud",
      providerLabel: "iCloud Mail",
      supportTier: 2,
      rowPreviewMode: "adaptive",
      hosts: ["www.icloud.com"],
      authHosts: ["idmsa.apple.com", "appleid.apple.com"],
      pathHints: ["/mail"],
      inboxRowSelectors: ["[role='row']", "[role='option']"],
      messageScopeSelectors: ["[role='document']", "main", "[aria-label*='Message' i]"],
      attachmentSelectors: ["a[href][download]", "button[aria-label*='download' i]"],
      maxRows: 24,
      maxLinks: 14
    },
    {
      id: "aol",
      providerLabel: "AOL Mail",
      supportTier: 2,
      rowPreviewMode: "adaptive",
      hosts: ["mail.aol.com"],
      authHosts: ["login.aol.com"],
      inboxRowSelectors: ["[data-test-id='message-list-item']", "li[data-test-id*='message']", "[role='option']"],
      messageScopeSelectors: ["[role='article']", "[role='document']", "main"],
      attachmentSelectors: ["a[href][download]", "a[href*='download' i]"],
      maxRows: 28,
      maxLinks: 14
    },
    {
      id: "generic-webmail",
      providerLabel: "Secure webmail",
      supportTier: 2,
      rowPreviewMode: "adaptive",
      hostPrefixes: ["mail.", "webmail."],
      pathHints: ["/owa/", "/mail/", "/webmail/", "/exchange/", "/inbox/"],
      inboxRowSelectors: ["[role='option']", "tr[role='row']"],
      messageScopeSelectors: ["[role='document']", "main"],
      attachmentSelectors: ["a[href][download]", "a[href*='download' i]"],
      maxRows: 24,
      maxLinks: 14
    }
  ];

  const GENERIC_SSO_PATH_HINTS = ["sso", "oauth", "authorize", "auth", "saml", "login", "signin", "selectaccount"];
  const GENERIC_SSO_PARAM_HINTS = ["continue", "next", "redirect_uri", "return", "target", "RelayState"];
  const WEBMAIL_TITLE_HINTS = ["inbox", "mail", "webmail", "message", "messages"];

  const LOCAL_HIGH_RISK_HOSTS = new Set([
    "malware.wicar.org",
    "testsafebrowsing.appspot.com"
  ]);

  const LOCAL_HIGH_RISK_ROOT_DOMAINS = new Set([
    "wicar.org"
  ]);

  const TRACKING_HOST_HINTS = [
    "doubleclick.net",
    "google-analytics.com",
    "googletagmanager.com",
    "googleadservices.com",
    "facebook.com",
    "facebook.net",
    "connect.facebook.net",
    "hotjar.com",
    "segment.com",
    "mixpanel.com",
    "amplitude.com",
    "taboola.com",
    "outbrain.com",
    "criteo.com",
    "adsrvr.org",
    "quantserve.com",
    "scorecardresearch.com",
    "newrelic.com",
    "sentry.io",
    "clarity.ms",
    "bing.com"
  ];

  const PROTECTION_PROFILES = {
    standard: {
      label: "Standard Protection",
      levelNote: "Standard Protection keeps everyday guidance balanced.",
      actionWarningThreshold: 60,
      guidedRiskThreshold: 80,
      autoPageWarningThreshold: 80,
      adultBlockingMode: "exact"
    },
    family: {
      label: "Family Safe",
      levelNote: "Family Safe adds stronger filtering and calmer guidance for shared browsing.",
      actionWarningThreshold: 58,
      guidedRiskThreshold: 76,
      autoPageWarningThreshold: 78,
      adultBlockingMode: "obvious"
    },
    child: {
      label: "Child Safe",
      levelNote: "Child Safe uses stricter filtering and simpler safety prompts.",
      actionWarningThreshold: 55,
      guidedRiskThreshold: 72,
      autoPageWarningThreshold: 76,
      adultBlockingMode: "obvious"
    },
    maximum: {
      label: "Maximum Protection",
      levelNote: "Maximum Protection uses the strongest filtering and the earliest safety guidance.",
      actionWarningThreshold: 50,
      guidedRiskThreshold: 68,
      autoPageWarningThreshold: 74,
      adultBlockingMode: "obvious"
    }
  };

  const BLOCKED_ADULT_ROOT_DOMAINS = new Set([
    "pornhub.com",
    "xvideos.com",
    "xnxx.com",
    "xhamster.com",
    "redtube.com",
    "youporn.com",
    "tube8.com",
    "spankbang.com"
  ]);

  const ADULT_HOST_KEYWORDS = ["porn", "xxx", "sexcam", "adultvideo"];
  const ADULT_PATH_KEYWORDS = [
    "porn",
    "xxx",
    "sex-video",
    "sexvideos",
    "cam-girl",
    "nude-video",
    "escort"
  ];
  const ADULT_CONTENT_KEYWORDS = [
    "explicit videos",
    "watch porn",
    "free porn",
    "sex cam",
    "live sex",
    "adult videos",
    "hardcore",
    "nsfw",
    "nude models"
  ];
  const ADULT_MEDIA_HINTS = [
    "18+ only",
    "adults only",
    "live cams",
    "explicit content",
    "porn stars"
  ];
  const SAFE_CONTEXT_KEYWORDS = [
    "sexual health",
    "health education",
    "planned parenthood",
    "lgbtq",
    "lgbt",
    "support center",
    "hotline",
    "medical",
    "clinic",
    "academic",
    "research",
    "news",
    "legal",
    "education",
    "university",
    "public health",
    "cancer screening",
    "hiv testing"
  ];
  const ADULT_ALLOWLIST_ROOT_DOMAINS = new Set(["adultswim.com"]);
  const TERMS_PAGE_HINTS = [
    "sign up",
    "signup",
    "create account",
    "create-account",
    "create_account",
    "join now",
    "start trial",
    "free trial",
    "register",
    "open account",
    "subscribe",
    "checkout",
    "billing",
    "subscription",
    "member",
    "plan",
    "pricing"
  ];
  const TERMS_SECTION_HINTS = [
    "terms",
    "terms of service",
    "terms and conditions",
    "conditions",
    "privacy policy",
    "user agreement",
    "acceptable use",
    "subscription terms",
    "billing terms",
    "refund policy",
    "refunds",
    "cancel anytime",
    "cancellation",
    "subscriber agreement",
    "by continuing",
    "by signing up"
  ];
  const TERMS_SURFACE_HINTS = [
    "terms",
    "privacy",
    "conditions",
    "agreement",
    "refund",
    "refunds",
    "billing",
    "subscription",
    "cancel",
    "cancellation"
  ];
  const TERMS_TRIGGER_SELECTORS = [
    'form[action*="signup" i]',
    'form[action*="register" i]',
    'form[action*="create-account" i]',
    'form[action*="create_account" i]',
    'form[action*="join" i]',
    'form[action*="subscribe" i]',
    'form[action*="checkout" i]',
    'form[action*="billing" i]',
    'form[action*="terms" i]',
    'form[action*="conditions" i]',
    'a[href*="signup" i]',
    'a[href*="register" i]',
    'a[href*="create-account" i]',
    'a[href*="subscribe" i]',
    'a[href*="checkout" i]',
    'a[href*="billing" i]',
    'a[href*="terms" i]',
    'a[href*="privacy" i]',
    'a[href*="conditions" i]',
    'a[href*="refund" i]'
  ];
  const TERMS_TOPIC_RULES = [
    {
      id: "dataCollection",
      keywords: ["collect", "share", "personal information", "usage data", "cookies", "analytics", "tracking"],
      summary: "This page says it may collect or share personal data."
    },
    {
      id: "autoRenewal",
      keywords: ["auto-renew", "automatically renew", "recurring", "renews until canceled", "subscription continues", "free trial"],
      summary: "A plan may keep charging until you cancel."
    },
    {
      id: "cancellationDifficulty",
      keywords: ["written notice", "cancel before", "no refunds", "support request", "30 days", "advance notice"],
      summary: "Canceling may take extra steps or may need advance notice."
    },
    {
      id: "arbitration",
      keywords: ["arbitration", "class action waiver", "waive your right to sue", "disputes will be resolved"],
      summary: "Disagreements may have to go through arbitration instead of court."
    },
    {
      id: "liabilityLimits",
      keywords: ["limitation of liability", "not liable", "as is", "no warranties"],
      summary: "The company says its responsibility may be limited."
    },
    {
      id: "contentRights",
      keywords: ["license to your content", "royalty-free", "perpetual", "worldwide license", "your content"],
      summary: "The site may get rights to use what you post or upload."
    },
    {
      id: "accountTermination",
      keywords: ["terminate your account", "suspend your account", "close your account", "remove your content", "terminate at any time"],
      summary: "The site says it can suspend or close accounts."
    }
  ];

  const BAND_DETAILS = [
    {
      max: 19,
      band: "safe",
      label: "Looks safe",
      summary: "No obvious risk signals found.",
      advice: "You can keep browsing. Only share personal details if you trust the site."
    },
    {
      max: 39,
      band: "low",
      label: "Low caution",
      summary: "This page may need a quick double-check.",
      advice: "A quick double-check is enough here."
    },
    {
      max: 59,
      band: "medium",
      label: "Check carefully",
      summary: "We found a few things worth checking.",
      advice: "Slow down and take a closer look before you click or sign in."
    },
    {
      max: 79,
      band: "high",
      label: "Elevated risk",
      summary: "We found several warning signs.",
      advice: "Pause here. Check the site name and destination before you continue."
    },
    {
      max: 100,
      band: "risk",
      label: "High risk",
      summary: "We found strong warning signs on this page.",
      advice: "It may be better not to sign in, download, or share personal details here."
    }
  ];
  const SCORE_BASE = 4;
  const SIGNAL_WEIGHTS = Object.freeze({
    low: Object.freeze({
      light: 2,
      normal: 4,
      heavy: 6
    }),
    moderate: Object.freeze({
      light: 8,
      normal: 12,
      heavy: 15
    }),
    strong: Object.freeze({
      light: 18,
      normal: 24,
      heavy: 30,
      critical: 35
    })
  });
  const SCORE_FLOORS = Object.freeze({
    knownBadHost: 85,
    impersonationLogin: 80,
    suspiciousPaymentPage: 78,
    suspiciousDownloadScam: 72,
    walletRecoveryBait: 90,
    fakeSuspensionSignIn: 76,
    threeModerateSignals: 45,
    oneStrongSignal: 60,
    twoStrongSignals: 78
  });

  const state = {
    currentReport: null,
    lastReportSignature: "",
    lastUrl: location.href,
    pageWarningLevelShown: 0,
    approvedNavigations: new Set(),
    approvedNavigationExpirations: new Map(),
    approvedForms: new Set(),
    shownWarningKeys: new Set(),
    refreshTimer: null,
    pageBannerTimer: null,
    indicator: null,
    indicatorToggle: null,
    scoreValue: null,
    scoreLabel: null,
    overlay: null,
    dialog: null,
    dialogTitle: null,
    dialogMessage: null,
    dialogReasons: null,
    stayButton: null,
    learnButton: null,
    continueButton: null,
    modalRoot: null,
    familyRoot: null,
    familyBlock: null,
    familyBlockState: null,
    familyBlockTitle: null,
    familyBlockMessage: null,
    familyBlockNote: null,
    familyBlockLearnMore: null,
    familyGoBackButton: null,
    familyLearnMoreButton: null,
    banner: null,
    indicatorCollapsed: true,
    activeDecisionOptions: null,
    activeFamilyRestriction: null,
    root: null,
    settings: {
      ...DEFAULT_SETTINGS
    }
  };

  void init();

  async function init() {
    injectAssistantStyles();
    createAssistantUi();
    attachMessageHandler();
    attachPageListeners();
    attachStorageHandler();
    patchHistoryForSpaNavigation();
    await loadSettings();
    applyUiSettings();
    analyzePage({ forceRefresh: true, showPageWarnings: false });
  }

  async function loadSettings() {
    try {
      const storedSettings = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
      state.settings = {
        ...DEFAULT_SETTINGS,
        ...storedSettings
      };
    } catch (error) {
      state.settings = {
        ...DEFAULT_SETTINGS
      };
    }
  }

  function attachStorageHandler() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      let didUpdateSettings = false;

      Object.keys(DEFAULT_SETTINGS).forEach((key) => {
        if (typeof changes[key] !== "undefined") {
          state.settings[key] = changes[key].newValue;
          didUpdateSettings = true;
        }
      });

      if (!didUpdateSettings) {
        return;
      }

      applyUiSettings();
      analyzePage({
        forceRefresh: true,
        showPageWarnings: false
      });
    });
  }

  function applyUiSettings() {
    if (state.indicator) {
      state.indicator.hidden = !state.settings.floatingBadgeEnabled;
      syncFloatingIndicatorState();
    }

    if (!state.settings.searchBadgesEnabled) {
      clearSearchBadges();
    }

    if (!state.settings.proactiveWarningsEnabled) {
      hidePageBanner();
      hideDecisionDialog();
    }
  }

  function getProtectionProfile() {
    return PROTECTION_PROFILES[state.settings.protectionLevel] || PROTECTION_PROFILES.standard;
  }

  function getAdultSiteRestriction(urlString, options = {}) {
    if (!state.settings.adultSiteBlockingEnabled) {
      return {
        blocked: false
      };
    }

    try {
      const parsedUrl = new URL(urlString, location.href);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return {
          blocked: false
        };
      }

      const hostname = normalizeHost(parsedUrl.hostname);
      const rootDomain = getRootDomain(hostname);
      const pageText = String(options.pageText || "").toLowerCase();
      const normalizedPath = `${parsedUrl.pathname || ""} ${parsedUrl.search || ""}`.toLowerCase();

      if (
        !rootDomain ||
        ADULT_ALLOWLIST_ROOT_DOMAINS.has(rootDomain) ||
        isFamilyProtectionException(rootDomain)
      ) {
        return {
          blocked: false
        };
      }

      const profile = getProtectionProfile();
      let strongSignals = 0;
      let moderateSignals = 0;
      const reasons = [];

      if (BLOCKED_ADULT_ROOT_DOMAINS.has(rootDomain)) {
        strongSignals += 2;
        reasons.push("This site matches a known adult-content website.");
      }

      const hostLabels = hostname.split(".");
      const hostKeywordMatches = ADULT_HOST_KEYWORDS.filter((keyword) => {
        return hostLabels.some((label) => label === keyword || label.startsWith(keyword) || label.endsWith(keyword));
      });

      if (hostKeywordMatches.length > 0) {
        strongSignals += 1;
        reasons.push("The website address strongly suggests explicit adult content.");
      }

      const pathKeywordMatches = ADULT_PATH_KEYWORDS.filter((keyword) => normalizedPath.includes(keyword));

      if (pathKeywordMatches.length > 0) {
        moderateSignals += 1;
        reasons.push("The address path includes adult-content wording.");
      }

      const contentKeywordMatches = ADULT_CONTENT_KEYWORDS.filter((keyword) => pageText.includes(keyword));

      if (contentKeywordMatches.length >= 2) {
        strongSignals += 1;
        reasons.push("The page text strongly suggests explicit adult content.");
      } else if (contentKeywordMatches.length === 1) {
        moderateSignals += 1;
        reasons.push("The page text includes adult-content wording.");
      }

      const mediaHintMatches = ADULT_MEDIA_HINTS.filter((keyword) => pageText.includes(keyword));

      if (mediaHintMatches.length >= 2) {
        strongSignals += 1;
        reasons.push("The page includes several adult-content markers.");
      } else if (mediaHintMatches.length === 1) {
        moderateSignals += 1;
        reasons.push("The page includes one adult-content marker.");
      }

      const safeContextMatches = SAFE_CONTEXT_KEYWORDS.filter((keyword) => pageText.includes(keyword));
      const safeContextDetected = safeContextMatches.length > 0;

      if (safeContextDetected) {
        strongSignals = Math.max(0, strongSignals - 1);
        moderateSignals = Math.max(0, moderateSignals - 1);
      }

      const shouldBlock =
        strongSignals >= 2 ||
        (strongSignals >= 1 && moderateSignals >= (safeContextDetected ? 2 : 1)) ||
        (!safeContextDetected &&
          profile.adultBlockingMode === "obvious" &&
          strongSignals === 0 &&
          moderateSignals >= 3);

      if (shouldBlock) {
        return {
          blocked: true,
          hostname,
          rootDomain,
          reason: safeContextDetected
            ? "Multiple strong adult-content signs were found, even after checking for educational or support context."
            : "Multiple signs suggest this site is explicit adult content.",
          reasons: reasons.slice(0, 3),
          strongSignals,
          moderateSignals,
          safeContextDetected
        };
      }
    } catch (error) {
      return {
        blocked: false
      };
    }

    return {
      blocked: false
    };
  }

  function attachMessageHandler() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "PING_AI_GUARDIAN") {
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "GET_PAGE_REPORT" || message.type === "SCAN_PAGE") {
        const report = analyzePage({
          forceRefresh: Boolean(message.forceRefresh),
          showPageWarnings: false
        });

        sendResponse(report);
        return;
      }

      if (message.type === "LABYRINTH_GUARDIAN_UPDATE") {
        handleGuardianSlowdownPrompt(message);
        sendResponse({ ok: true });
      }
    });
  }

  function attachPageListeners() {
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("submit", handleFormSubmit, true);
    window.addEventListener("hashchange", handleLocationMaybeChanged);
    window.addEventListener("popstate", handleLocationMaybeChanged);

    const observer = new MutationObserver((mutations) => {
      const hasRealPageChange = mutations.some((mutation) => !isAssistantMutation(mutation));

      if (!hasRealPageChange) {
        return;
      }

      scheduleAnalysis(isSupportedWebmailPage() ? 2600 : 1200);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function isAssistantMutation(mutation) {
    const nodes = [
      mutation.target,
      ...Array.from(mutation.addedNodes || []),
      ...Array.from(mutation.removedNodes || [])
    ];

    return nodes.every((node) => isAssistantNode(node));
  }

  function isAssistantNode(node) {
    if (!node) {
      return true;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return isAssistantNode(node.parentElement);
    }

    if (!(node instanceof Element)) {
      return false;
    }

    if (
      node.id === "ai-guardian-root" ||
      node.closest("#ai-guardian-root") ||
      node.id === "ai-guardian-modal-root" ||
      node.closest("#ai-guardian-modal-root") ||
      node.id === "ai-guardian-family-root" ||
      node.closest("#ai-guardian-family-root") ||
      node.closest(".ai-guardian-mail-cue-slot") ||
      node.closest("[data-agws-enhanced='true'][data-agws-feature='email-preview']")
    ) {
      return true;
    }

    return Boolean(node.closest(".ai-guardian-gsr-slot, .ai-guardian-gsr-badge-wrap"));
  }

  function patchHistoryForSpaNavigation() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      handleLocationMaybeChanged();
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      handleLocationMaybeChanged();
      return result;
    };
  }

  function handleLocationMaybeChanged() {
    window.setTimeout(() => {
      if (location.href === state.lastUrl) {
        return;
      }

      state.lastUrl = location.href;
      resetCurrentPageStateForNavigation();
      analyzePage({ showPageWarnings: false });
    }, 80);
  }

  function resetCurrentPageStateForNavigation() {
    state.currentReport = null;
    state.lastReportSignature = "";
    state.pageWarningLevelShown = 0;
    state.approvedNavigations.clear();
    state.approvedForms.clear();
    state.shownWarningKeys.clear();

    hideDecisionDialog();
    hidePageBanner();
    hideFamilyProtectionBlock();
    getEmailSafetyController()?.handleNavigationReset?.(location.href);
    setFloatingIndicatorCollapsed(true);
    showPendingFloatingIndicator();
    clearTabPageStateInBackground();
    sendTabUiStateToBackground();
    cleanupExpiredNavigationApprovals();
  }

  function scheduleAnalysis(delayMs = 1200) {
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(() => {
      analyzePage({ showPageWarnings: false });
    }, delayMs);
  }

  function analyzePage(options = {}) {
    const report = buildPageReport();
    const signature = createReportSignature(report);

    state.currentReport = report;
    syncFamilyProtectionBlock(report);
    updateFloatingIndicator(report);
    sendTabUiStateToBackground();

    if (isGoogleSearchPage()) {
      if (state.settings.searchBadgesEnabled) {
        decorateGoogleResults();
      } else {
        clearSearchBadges();
      }
    } else {
      clearSearchBadges();
    }

    if (isSupportedWebmailPage()) {
      decorateWebmailPreviews();
    } else {
      clearWebmailPreviews();
    }

    if (signature !== state.lastReportSignature || options.forceRefresh) {
      state.lastReportSignature = signature;
      sendReportToBackground(report);

      if (options.showPageWarnings !== false && state.settings.proactiveWarningsEnabled) {
        maybeShowPageWarning(report);
      }
    }

    return report;
  }

  function buildPageReport() {
    const currentHost = normalizeHost(location.hostname);
    const currentRootDomain = getRootDomain(currentHost);
    const protectionProfile = getProtectionProfile();
    const pageTitle = (document.title || "This page").trim();
    const urlAssessment = assessUrl(location.href, {
      currentHost: "",
      currentRootDomain: ""
    });
    const pageSignals = collectPageSignals();
    const adultSiteRestriction = getAdultSiteRestriction(location.href, {
      pageText: pageSignals.pageText
    });
    pageSignals.suspiciousFormCount = countSuspiciousForms(urlAssessment, pageSignals);
    const linkInsights = collectLinkInsights(currentHost, currentRootDomain);
    const emailSafetyPreview = buildEmailSafetyPreview(currentHost, currentRootDomain);
    const termsSummary = buildTermsSummary(pageSignals);
    const reasonEntries = cloneReasonEntries(
      Array.isArray(urlAssessment.reasonEntries)
        ? urlAssessment.reasonEntries
        : (urlAssessment.reasons || []).map((reason) => {
            return {
              text: reason,
              weight: SIGNAL_WEIGHTS.moderate.light
            };
          })
    );
    let score = urlAssessment.score;
    const signalCounts = {
      moderate: urlAssessment.signalCounts.moderate,
      strong: urlAssessment.signalCounts.strong,
      severe: Number(urlAssessment.signalCounts.severe || 0)
    };
    const siteIdentityCheck = buildSiteIdentityCheck(urlAssessment, pageSignals);
    const pageThreatFlags = getPageThreatFlags(pageSignals);
    const requestsPaymentDetails =
      pageSignals.privateFieldExamples.includes("card number") ||
      pageSignals.privateFieldExamples.includes("card code") ||
      pageSignals.privateFieldExamples.includes("bank details");
    const strongBrandClaim = Boolean(
      pageSignals.claimedBrand &&
      isStrongBrandClaim(pageSignals.prominentIdentityText, pageSignals.claimedBrand)
    );
    const fakeAccountSuspensionAndSignIn = Boolean(
      pageSignals.passwordFieldCount > 0 &&
      (
        pageSignals.pushyPhrases.includes("suspended") ||
        pageSignals.pushyPhrases.includes("your account is locked") ||
        pageSignals.pushyPhrases.includes("problem with your account") ||
        pageSignals.highRiskPhrases.includes("password expired") ||
        pageSignals.highRiskPhrases.includes("urgent verify now") ||
        pageSignals.highRiskPhrases.includes("immediate action required")
      )
    );
    const benignDownloadContextCount = findPhraseMatches(pageSignals.pageText, BENIGN_DOWNLOAD_HINTS).length;
    const hasBenignDownloadContext = benignDownloadContextCount >= 2;
    const hasStrongExternalRiskContext = Boolean(
      urlAssessment.identitySignals.localKnownRiskMatch ||
      urlAssessment.identitySignals.lookalikeBrand ||
      urlAssessment.identitySignals.hiddenRedirect ||
      strongBrandClaim ||
      pageThreatFlags.walletRecoveryBait ||
      pageThreatFlags.cryptoScamLanguage ||
      pageThreatFlags.crackBait ||
      requestsPaymentDetails ||
      (
        pageSignals.passwordFieldCount > 0 &&
        (
          pageSignals.suspiciousFormCount > 0 ||
          pageSignals.pushyPhraseCount > 0 ||
          pageSignals.highRiskPhraseCount > 0
        )
      )
    );

    const isTrustedPage = Boolean(urlAssessment.trusted);
    const skipOutgoingLinkPenalty = isGoogleSearchPage();

    const hasRiskyPageContext =
      urlAssessment.signalCounts.strong > 0 ||
      urlAssessment.signalCounts.moderate > 1 ||
      pageSignals.pushyPhraseCount > 0 ||
      pageSignals.highRiskPhraseCount > 0 ||
      pageSignals.suspiciousFormCount > 0;
    const isTrustedAuthFlowPage = Boolean(urlAssessment.identitySignals.trustedAuthFlow);

    if (pageSignals.passwordFieldCount > 0) {
      if (
        urlAssessment.signalCounts.strong > 0 ||
        pageSignals.suspiciousFormCount > 0 ||
        pageSignals.highRiskPhraseCount > 0
      ) {
        score += SIGNAL_WEIGHTS.moderate.heavy;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, "This page asks for a password on a page that already looks off.", SIGNAL_WEIGHTS.moderate.heavy);
      } else if (
        !isTrustedPage &&
        urlAssessment.score >= 20 &&
        (pageSignals.signInHintCount > 0 || pageSignals.privateFieldCount > 0)
      ) {
        score += SIGNAL_WEIGHTS.moderate.light;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, "This page asks you to sign in on a site that needs a closer look.", SIGNAL_WEIGHTS.moderate.light);
      } else if (!isTrustedPage && pageSignals.pushyPhraseCount > 0) {
        score += SIGNAL_WEIGHTS.moderate.light;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, "This page asks for a password while also using pressure words.", SIGNAL_WEIGHTS.moderate.light);
      } else if (!isTrustedPage && hasRiskyPageContext) {
        score += SIGNAL_WEIGHTS.low.light;
        addReasonEntry(reasonEntries, "This page asks for a password.", SIGNAL_WEIGHTS.low.light);
      }
    }

    if (pageSignals.privateFieldCount >= 3) {
      if (hasRiskyPageContext || !isTrustedPage) {
        score += SIGNAL_WEIGHTS.moderate.normal;
        signalCounts.moderate += 1;
        addReasonEntry(
          reasonEntries,
          `This page asks for details like ${formatQuotedExamples(
            pageSignals.privateFieldExamples
          )}.`,
          SIGNAL_WEIGHTS.moderate.normal
        );
      }
    } else if (pageSignals.privateFieldCount > 0) {
      if (urlAssessment.score >= 30 || pageSignals.suspiciousFormCount > 0) {
        score += SIGNAL_WEIGHTS.low.normal;
        signalCounts.moderate += 1;
        addReasonEntry(
          reasonEntries,
          `This page asks for details like ${formatQuotedExamples(
            pageSignals.privateFieldExamples
          )}.`,
          SIGNAL_WEIGHTS.low.normal
        );
      }
    }

    if (pageSignals.pushyPhraseCount >= 2) {
      score += SIGNAL_WEIGHTS.moderate.normal;
      signalCounts.moderate += 1;
      addReasonEntry(reasonEntries, `We saw pushy words like ${formatQuotedExamples(pageSignals.pushyPhrases)}.`, SIGNAL_WEIGHTS.moderate.normal);
    } else if (pageSignals.pushyPhraseCount === 1) {
      score += SIGNAL_WEIGHTS.low.normal;
      addReasonEntry(reasonEntries, `We saw a pushy word: ${formatQuotedExamples(pageSignals.pushyPhrases)}.`, SIGNAL_WEIGHTS.low.normal);
    }

    if (pageSignals.highRiskPhraseCount >= 2) {
      score += SIGNAL_WEIGHTS.strong.light;
      signalCounts.strong += 1;
      addReasonEntry(
        reasonEntries,
        `We saw risky words like ${formatQuotedExamples(pageSignals.highRiskPhrases)}.`,
        SIGNAL_WEIGHTS.strong.light
      );
    } else if (
      pageSignals.highRiskPhraseCount === 1 &&
      (pageSignals.passwordFieldCount > 0 ||
        pageSignals.privateFieldCount > 0 ||
        linkInsights.downloadCount > 0 ||
        urlAssessment.signalCounts.strong > 0)
    ) {
      score += SIGNAL_WEIGHTS.moderate.normal;
      signalCounts.moderate += 1;
      addReasonEntry(
        reasonEntries,
        `We saw a risky phrase: ${formatQuotedExamples(pageSignals.highRiskPhrases)}.`,
        SIGNAL_WEIGHTS.moderate.normal
      );
    }

    const hasManyOutsideServices =
      pageSignals.trackerHostCount >= 3 || pageSignals.thirdPartyResourceCount >= 10;
    const hasVeryManyOutsideServices =
      pageSignals.trackerHostCount >= 5 || pageSignals.thirdPartyResourceCount >= 18;

    if (hasManyOutsideServices) {
      const outsideServiceScore = hasStrongExternalRiskContext
        ? SIGNAL_WEIGHTS.moderate.light
        : hasVeryManyOutsideServices
          ? SIGNAL_WEIGHTS.low.normal
          : SIGNAL_WEIGHTS.low.light;

      score += Math.min(outsideServiceScore, 8);

      if (hasStrongExternalRiskContext) {
        signalCounts.moderate += 1;
      }

      addReasonEntry(
        reasonEntries,
        "This page loads resources from several outside services. This is common on modern websites, but more connections can increase complexity.",
        hasStrongExternalRiskContext ? SIGNAL_WEIGHTS.moderate.light : SIGNAL_WEIGHTS.low.normal
      );
    } else if (pageSignals.trackerHostCount > 0) {
      score += SIGNAL_WEIGHTS.low.light;
      addReasonEntry(
        reasonEntries,
        "This page loads resources from a few outside services. That is common on many websites.",
        SIGNAL_WEIGHTS.low.light
      );
    }

    if (pageSignals.suspiciousFormCount > 0) {
      score += pageSignals.suspiciousFormCount > 1 ? SIGNAL_WEIGHTS.moderate.heavy : SIGNAL_WEIGHTS.moderate.normal;
      signalCounts.moderate += pageSignals.suspiciousFormCount > 1 ? 2 : 1;
      addReasonEntry(reasonEntries, "At least one form on this page may need extra care.", pageSignals.suspiciousFormCount > 1 ? SIGNAL_WEIGHTS.moderate.heavy : SIGNAL_WEIGHTS.moderate.normal);
    }

    const riskyDownloadContext =
      urlAssessment.signalCounts.strong > 0 ||
      pageSignals.highRiskPhraseCount > 0 ||
      pageSignals.pushyPhraseCount > 0 ||
      pageSignals.suspiciousFormCount > 0 ||
      linkInsights.highRiskCount > 0;

    if (linkInsights.downloadCount > 0 && riskyDownloadContext) {
      score += linkInsights.downloadCount > 1 ? SIGNAL_WEIGHTS.moderate.normal : SIGNAL_WEIGHTS.moderate.light;
      signalCounts.moderate += 1;
      addReasonEntry(reasonEntries, "This page offers a download that may need a closer look.", linkInsights.downloadCount > 1 ? SIGNAL_WEIGHTS.moderate.normal : SIGNAL_WEIGHTS.moderate.light);
    } else if (linkInsights.downloadCount > 2 && !isTrustedPage && urlAssessment.score >= 30) {
      score += SIGNAL_WEIGHTS.low.normal;
      addReasonEntry(reasonEntries, "This page offers many downloads.", SIGNAL_WEIGHTS.low.normal);
    }

    if (!skipOutgoingLinkPenalty) {
      if (linkInsights.highRiskCount > 0) {
        score += linkInsights.highRiskCount > 2 ? SIGNAL_WEIGHTS.moderate.normal : SIGNAL_WEIGHTS.moderate.light;
        signalCounts.moderate += linkInsights.highRiskCount > 2 ? 2 : 1;
        addReasonEntry(reasonEntries, "This page links out to places that may need extra care.", linkInsights.highRiskCount > 2 ? SIGNAL_WEIGHTS.moderate.normal : SIGNAL_WEIGHTS.moderate.light);
      } else if (linkInsights.mediumOrHigherCount > 2) {
        score += SIGNAL_WEIGHTS.low.normal;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, "Some links on this page may need another look.", SIGNAL_WEIGHTS.low.normal);
      }
    }

    if (pageSignals.passwordFieldCount > 0 && pageSignals.pushyPhraseCount > 0) {
      score += SIGNAL_WEIGHTS.moderate.normal;
      signalCounts.strong += 1;
      addReasonEntry(reasonEntries, "A password box and pushy words together need extra care.", SIGNAL_WEIGHTS.strong.light);
    }

    score += siteIdentityCheck.scoreDelta;
    signalCounts.moderate += siteIdentityCheck.signalCounts.moderate;
    signalCounts.strong += siteIdentityCheck.signalCounts.strong;
    signalCounts.severe += Number(siteIdentityCheck.signalCounts.severe || 0);
    mergeReasonEntries(reasonEntries, siteIdentityCheck.reasonEntries || siteIdentityCheck.reasons, SIGNAL_WEIGHTS.moderate.light);

    if (isTrustedPage && pageSignals.pushyPhraseCount === 0 && linkInsights.highRiskCount === 0) {
      score -= 12;
    }

    if (linkInsights.sameDomainRatio > 0.75 && pageSignals.pushyPhraseCount === 0) {
      score -= 8;
    }

    if (
      hasBenignDownloadContext &&
      !pageThreatFlags.crackBait &&
      !pageThreatFlags.cryptoScamLanguage &&
      !pageThreatFlags.walletRecoveryBait &&
      pageSignals.suspiciousFormCount === 0 &&
      urlAssessment.signalCounts.strong === 0
    ) {
      score -= isTrustedPage ? 10 : 6;
    }

    if (
      pageSignals.accountFlowHintCount > 0 &&
      pageSignals.pushyPhraseCount === 0 &&
      pageSignals.highRiskPhraseCount === 0 &&
      pageSignals.suspiciousFormCount === 0 &&
      urlAssessment.signalCounts.strong === 0
    ) {
      score -= 6;
    }

    if (
      isTrustedAuthFlowPage &&
      isTrustedPage &&
      pageSignals.hasHttps &&
      pageSignals.pushyPhraseCount === 0 &&
      pageSignals.highRiskPhraseCount === 0 &&
      !pageThreatFlags.walletRecoveryBait &&
      !pageThreatFlags.crackBait
    ) {
      score -= pageSignals.passwordFieldCount > 0 ? 12 : 8;
    }

    score = applyRiskGuardrails(score, signalCounts, {
      trusted: isTrustedPage,
      isEduDomain: urlAssessment.isEduDomain,
      trustedAuthFlow: isTrustedAuthFlowPage
    });
    score = applyPageScoreFloors(score, {
      trusted: isTrustedPage,
      localKnownRiskMatch: Boolean(urlAssessment.identitySignals.localKnownRiskMatch),
      impersonationLike:
        Boolean(urlAssessment.identitySignals.lookalikeBrand) ||
        Boolean(strongBrandClaim && !isOfficialHostForBrand(urlAssessment.domain, pageSignals.claimedBrand)),
      signInRequested: pageSignals.passwordFieldCount > 0 || pageSignals.signInHintCount > 0,
      suspiciousDownload: linkInsights.downloadCount > 0,
      suspiciousForms: pageSignals.suspiciousFormCount > 0,
      pushyPhraseCount: pageSignals.pushyPhraseCount,
      highRiskPhraseCount: pageSignals.highRiskPhraseCount,
      walletRecoveryBait: pageThreatFlags.walletRecoveryBait,
      cryptoScamLanguage: pageThreatFlags.cryptoScamLanguage,
      crackBait: pageThreatFlags.crackBait,
      requestsPaymentDetails,
      requestsCredentials: pageSignals.passwordFieldCount > 0,
      urlStrongCount: urlAssessment.signalCounts.strong,
      strongSignalCount: signalCounts.strong,
      moderateSignalCount: signalCounts.moderate,
      fakeAccountSuspensionAndSignIn
    });
    score = applyScoreDistributionBaseline(score, signalCounts, {
      trusted: isTrustedPage,
      isEduDomain: urlAssessment.isEduDomain,
      hasHttps: pageSignals.hasHttps,
      noisy: Boolean(urlAssessment.identitySignals.hasLongUrl),
      heavyTracking: pageSignals.trackerHostCount >= 3,
      thirdPartyHeavy: pageSignals.thirdPartyResourceCount >= 10,
      sameSiteLevel: urlAssessment.sameSiteLevel,
      trustedAuthFlow: isTrustedAuthFlowPage
    });
    score = alignLiveScoreWithPreview(urlAssessment.score, score, {
      strong: signalCounts.strong,
      moderate: signalCounts.moderate,
      severe: signalCounts.severe
    }, {
      strong:
        (pageSignals.passwordFieldCount > 0 && pageSignals.pushyPhraseCount > 0 ? 1 : 0) +
        (pageSignals.highRiskPhraseCount >= 2 ? 1 : 0) +
        (pageSignals.suspiciousFormCount > 1 ? 1 : 0),
      moderate:
        (pageSignals.passwordFieldCount > 0 && hasRiskyPageContext ? 1 : 0) +
        (pageSignals.privateFieldCount > 0 && (pageSignals.suspiciousFormCount > 0 || pageSignals.highRiskPhraseCount > 0) ? 1 : 0) +
        (pageSignals.pushyPhraseCount > 0 ? 1 : 0) +
        (pageSignals.highRiskPhraseCount === 1 ? 1 : 0) +
        (pageSignals.suspiciousFormCount > 0 ? 1 : 0) +
        (riskyDownloadContext && linkInsights.downloadCount > 0 ? 1 : 0) +
        (linkInsights.highRiskCount > 0 ? 1 : 0),
      severe:
        (urlAssessment.identitySignals.localKnownRiskMatch ? 1 : 0) +
        (pageThreatFlags.walletRecoveryBait ? 1 : 0) +
        (
          Boolean(
            (
              Boolean(urlAssessment.identitySignals.lookalikeBrand) ||
              Boolean(strongBrandClaim && !isOfficialHostForBrand(urlAssessment.domain, pageSignals.claimedBrand))
            ) &&
            (pageSignals.passwordFieldCount > 0 || pageSignals.signInHintCount > 0)
          )
            ? 1
            : 0
        ) +
        (requestsPaymentDetails && (urlAssessment.signalCounts.strong > 0 || pageSignals.suspiciousFormCount > 0) ? 1 : 0) +
        (linkInsights.downloadCount > 0 && (pageThreatFlags.cryptoScamLanguage || pageThreatFlags.crackBait) ? 1 : 0) +
        (fakeAccountSuspensionAndSignIn ? 1 : 0)
    });

    const bandDetails = getBandDetails(score);
    const finalReasons = getTopReasonTexts(reasonEntries, 3);
    const autoWarningEligible =
      score >= protectionProfile.autoPageWarningThreshold &&
      signalCounts.strong > 0 &&
      !isTrustedPage &&
      !isTrustedAuthFlowPage &&
      !isGoogleSearchPage() &&
      (pageSignals.suspiciousFormCount > 0 ||
        pageSignals.passwordFieldCount > 0 ||
        linkInsights.highRiskCount > 0 ||
        urlAssessment.signalCounts.strong > 0);

    return {
      ok: true,
      pageUrl: location.href,
      score,
      band: bandDetails.band,
      label: bandDetails.label,
      summary: bandDetails.summary,
      advice: bandDetails.advice,
      reasons:
        finalReasons.length > 0
          ? finalReasons
          : [
              "This address looks normal.",
              "We did not see pushy language or unusual form requests."
            ],
      pageTitle,
      domain: currentHost,
      cleanedUrl: urlAssessment.cleanedUrl,
      emailSafetyPreview,
      siteIdentityCheck,
      flaggedLinks: linkInsights.flaggedLinks,
      termsSummary,
      familyProtection: {
        currentPageRestricted: adultSiteRestriction.blocked,
        currentPageMessage: adultSiteRestriction.blocked
          ? "This site is blocked for safety."
          : state.settings.adultSiteBlockingEnabled
            ? "Adult site blocking is on for this browser."
            : "Adult site blocking is off right now.",
        currentPageDetail: adultSiteRestriction.blocked
          ? adultSiteRestriction.reason
          : "Guardian Family Protection can help create a safer browsing space.",
        currentPageReasons: adultSiteRestriction.reasons || [],
        allowBackNavigation: history.length > 1,
        level: state.settings.protectionLevel,
        levelLabel: protectionProfile.label,
        levelNote: protectionProfile.levelNote,
        adultSiteBlockingEnabled: state.settings.adultSiteBlockingEnabled,
        exceptions: Array.isArray(state.settings.familyProtectionExceptions)
          ? state.settings.familyProtectionExceptions.slice(0, 8)
          : []
      },
      protectionStatus: "ON",
      strongSignalCount: signalCounts.strong,
      moderateSignalCount: signalCounts.moderate,
      autoWarningEligible
    };
  }

  function collectPageSignals() {
    const pageText = getPageText();
    const prominentIdentityText = getProminentIdentityText();
    const privateFields = findPrivateFieldsInScope(document);
    const pushyPhrases = findPhraseMatches(pageText, PUSHY_PHRASES);
    const highRiskPhrases = findPhraseMatches(pageText, HIGH_RISK_PAGE_PHRASES);
    const signInHints = findPhraseMatches(pageText, SIGN_IN_PAGE_HINTS);
    const accountFlowHints = findPhraseMatches(pageText, TERMS_PAGE_HINTS);
    const connectionSignals = getConnectionSignals();
    const trackingSignals = getTrackingSignals();

    return {
      pageText,
      prominentIdentityText,
      passwordFieldCount: document.querySelectorAll('input[type="password"]').length,
      privateFieldCount: privateFields.length,
      privateFieldExamples: uniqueList(privateFields.map((field) => field.label)),
      pushyPhraseCount: pushyPhrases.length,
      pushyPhrases,
      highRiskPhraseCount: highRiskPhrases.length,
      highRiskPhrases,
      suspiciousFormCount: 0,
      signInHintCount: signInHints.length,
      accountFlowHintCount: accountFlowHints.length,
      claimedBrand: findBrandMention(prominentIdentityText),
      hasHttps: connectionSignals.hasHttps,
      secureContext: connectionSignals.secureContext,
      insecureResourceCount: connectionSignals.insecureResourceCount,
      insecureFormActionCount: connectionSignals.insecureFormActionCount,
      trackerHostCount: trackingSignals.trackerHostCount,
      trackerHosts: trackingSignals.trackerHosts,
      thirdPartyResourceCount: trackingSignals.thirdPartyResourceCount
    };
  }

  function buildTermsSummary(pageSignals) {
    const pageText = String(pageSignals.pageText || "");
    const normalizedText = pageText.toLowerCase();
    const termsSurfaceText = collectTermsSurfaceText();
    const pageLinkText = Array.from(document.querySelectorAll('a[href], button, form[action]'))
      .slice(0, 120)
      .map((item) => {
        const textContent = item.textContent || "";
        const href = item.getAttribute && item.getAttribute("href");
        const action = item.getAttribute && item.getAttribute("action");
        const formAction = item.getAttribute && item.getAttribute("formaction");
        return `${textContent} ${href || ""} ${action || ""} ${formAction || ""}`.toLowerCase();
      })
      .join(" ");
    const hasTriggerSelector = TERMS_TRIGGER_SELECTORS.some((selector) => document.querySelector(selector));
    const likelyAccountFlow =
      pageSignals.passwordFieldCount > 0 ||
      pageSignals.signInHintCount > 0 ||
      pageSignals.accountFlowHintCount > 0 ||
      hasTriggerSelector;
    const termsHintsFound =
      TERMS_SECTION_HINTS.some((hint) => normalizedText.includes(hint)) ||
      TERMS_SECTION_HINTS.some((hint) => pageLinkText.includes(hint)) ||
      TERMS_SURFACE_HINTS.some((hint) => termsSurfaceText.includes(hint));

    if (!likelyAccountFlow || !termsHintsFound) {
      return {
        available: false,
        summary: "No simple terms summary was found on this page.",
        points: [],
        disclaimer: "This is a simplified summary, not legal advice."
      };
    }

    const points = TERMS_TOPIC_RULES.filter((rule) => {
      return rule.keywords.some((keyword) => {
        return normalizedText.includes(keyword) || termsSurfaceText.includes(keyword);
      });
    }).map((rule) => rule.summary);

    return {
      available: points.length > 0,
      summary: points.length > 0
        ? "We found a few terms that may matter before you continue."
        : "This looks like an account page, but we did not find clear terms points to simplify here.",
      points: points.slice(0, 5),
      disclaimer: "This is a simplified summary, not legal advice."
    };
  }

  function getConnectionSignals() {
    const hasHttps = location.protocol === "https:";

    if (!hasHttps) {
      return {
        hasHttps,
        secureContext: window.isSecureContext,
        insecureResourceCount: 0,
        insecureFormActionCount: 0
      };
    }

    const insecureResourceSelector = [
      'script[src^="http://"]',
      'iframe[src^="http://"]',
      'frame[src^="http://"]',
      'img[src^="http://"]',
      'audio[src^="http://"]',
      'video[src^="http://"]',
      'source[src^="http://"]',
      'embed[src^="http://"]',
      'object[data^="http://"]',
      'link[rel="stylesheet"][href^="http://"]'
    ].join(",");

    const insecureResourceCount = document.querySelectorAll(insecureResourceSelector).length;
    const insecureFormActionCount = Array.from(document.forms).filter((form) => {
      const action = (form.getAttribute("action") || "").trim().toLowerCase();
      return action.startsWith("http://");
    }).length;

    return {
      hasHttps,
      secureContext: window.isSecureContext,
      insecureResourceCount,
      insecureFormActionCount
    };
  }

  function getTrackingSignals() {
    const currentHost = normalizeHost(location.hostname);
    const currentRootDomain = getRootDomain(currentHost);
    const trackerHosts = new Set();
    const thirdPartyHosts = new Set();
    const resourceNodes = Array.from(
      document.querySelectorAll('script[src], iframe[src], img[src], link[href], source[src], video[src], audio[src]')
    ).slice(0, 220);

    resourceNodes.forEach((node) => {
      const rawUrl =
        node.getAttribute("src") ||
        node.getAttribute("href") ||
        "";

      if (!rawUrl) {
        return;
      }

      let parsedUrl = null;

      try {
        parsedUrl = new URL(rawUrl, location.href);
      } catch (error) {
        return;
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return;
      }

      const resourceHost = normalizeHost(parsedUrl.hostname);
      const resourceRootDomain = getRootDomain(resourceHost);

      if (!resourceHost || !resourceRootDomain || resourceRootDomain === currentRootDomain) {
        return;
      }

      thirdPartyHosts.add(resourceHost);

      if (TRACKING_HOST_HINTS.some((hint) => resourceHost === hint || resourceHost.endsWith(`.${hint}`))) {
        trackerHosts.add(resourceHost);
      }
    });

    return {
      trackerHostCount: trackerHosts.size,
      trackerHosts: Array.from(trackerHosts).slice(0, 3),
      thirdPartyResourceCount: thirdPartyHosts.size
    };
  }

  function collectTermsSurfaceText() {
    return Array.from(document.querySelectorAll("a[href], form[action], button[formaction]"))
      .slice(0, 140)
      .map((node) => {
        const textContent = node.textContent || "";
        const href = node.getAttribute && node.getAttribute("href");
        const action = node.getAttribute && node.getAttribute("action");
        const formAction = node.getAttribute && node.getAttribute("formaction");
        return `${textContent} ${href || ""} ${action || ""} ${formAction || ""}`.toLowerCase();
      })
      .join(" ");
  }

  function countSuspiciousForms(urlAssessment, pageSignals) {
    const currentHost = normalizeHost(location.hostname);
    const currentRootDomain = getRootDomain(currentHost);

    return Array.from(document.forms).reduce((count, form) => {
      const fieldInfo = describeFormFields(form);
      const actionUrl = form.getAttribute("action") || location.href;
      const actionAssessment = assessUrl(actionUrl, {
        currentHost,
        currentRootDomain
      });

      const hasSuspiciousDestination =
        !actionAssessment.identitySignals.trustedAuthFlow &&
        (actionAssessment.signalCounts.strong > 0 || actionAssessment.signalCounts.moderate >= 2);
      const hasSensitiveFields = fieldInfo.passwordCount > 0 || fieldInfo.privateCount > 0;
      const sameSiteSensitiveFormOnRiskyHost =
        !actionAssessment.trusted &&
        !actionAssessment.identitySignals.trustedAuthFlow &&
        (
          (urlAssessment?.signalCounts?.strong || 0) > 0 ||
          (pageSignals?.pushyPhraseCount || 0) > 0 ||
          (pageSignals?.highRiskPhraseCount || 0) > 0
        ) &&
        (fieldInfo.passwordCount > 0 || fieldInfo.privateCount >= 2);

      if (hasSensitiveFields && (hasSuspiciousDestination || sameSiteSensitiveFormOnRiskyHost)) {
        return count + 1;
      }

      return count;
    }, 0);
  }

  function buildSiteIdentityCheck(urlAssessment, pageSignals) {
    const hasNormalSecureConnection =
      pageSignals.hasHttps &&
      pageSignals.secureContext &&
      pageSignals.insecureResourceCount === 0 &&
      pageSignals.insecureFormActionCount === 0;
    const addressLooksUnusual =
      Boolean(urlAssessment.identitySignals.lookalikeBrand) ||
      Boolean(urlAssessment.identitySignals.localKnownRiskMatch) ||
      urlAssessment.identitySignals.usesIpAddress ||
      urlAssessment.identitySignals.usesEncodedHost ||
      urlAssessment.identitySignals.suspiciousTld ||
      urlAssessment.identitySignals.unusualPort;
    const trustedAuthFlow = Boolean(urlAssessment.identitySignals.trustedAuthFlow);
    const signInRequested = pageSignals.passwordFieldCount > 0 || pageSignals.signInHintCount > 0;
    const strongBrandClaim = Boolean(
      pageSignals.claimedBrand &&
      isStrongBrandClaim(pageSignals.prominentIdentityText, pageSignals.claimedBrand)
    );
    const brandClaimMismatch = Boolean(
      strongBrandClaim &&
      (signInRequested || pageSignals.privateFieldCount >= 2) &&
      !isOfficialHostForBrand(urlAssessment.domain, pageSignals.claimedBrand)
    );
    const signalCounts = {
      moderate: 0,
      strong: 0,
      severe: 0
    };
    const reasonEntries = [];
    let scoreDelta = 0;

    const secureConnection = {
      status: "good",
      value: "Secure connection found",
      detail: "We can see normal browser signs of a secure connection."
    };

    if (!pageSignals.hasHttps) {
      secureConnection.status = "warning";
      secureConnection.value = "Connection needs a closer look";
        secureConnection.detail = "This page does not use the usual secure connection.";

        if (signInRequested || pageSignals.privateFieldCount > 0) {
        scoreDelta += SIGNAL_WEIGHTS.moderate.light;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, "This page asks for details without the usual secure connection.", SIGNAL_WEIGHTS.moderate.light);
      }
    } else if (!hasNormalSecureConnection) {
      secureConnection.status = "caution";
      secureConnection.value = "Connection needs a closer look";

      if (pageSignals.insecureFormActionCount > 0) {
        secureConnection.detail = "Part of this page may send information in a less safe way.";
      } else if (pageSignals.insecureResourceCount > 0) {
        secureConnection.detail = "Part of this page may load in a less safe way.";
      } else {
        secureConnection.detail = "The connection signs we can see look unusual.";
      }

      scoreDelta += SIGNAL_WEIGHTS.low.heavy;
      signalCounts.moderate += 1;
      addReasonEntry(reasonEntries, secureConnection.detail, SIGNAL_WEIGHTS.low.heavy);
    }

    const websiteAddressCheck = {
      status: "good",
      value: "Address looks consistent",
      detail: "The website address looks normal for this page."
    };

    if (brandClaimMismatch) {
      websiteAddressCheck.status = "warning";
      websiteAddressCheck.value = "Address needs a closer look";
      websiteAddressCheck.detail = `This page says "${pageSignals.claimedBrand}", but the address does not match the usual site.`;
      scoreDelta += SIGNAL_WEIGHTS.moderate.heavy;
      signalCounts.strong += 1;
      addReasonEntry(reasonEntries, websiteAddressCheck.detail, SIGNAL_WEIGHTS.strong.normal);
    } else if (urlAssessment.identitySignals.localKnownRiskMatch) {
      websiteAddressCheck.status = "warning";
      websiteAddressCheck.value = "Address needs a closer look";
      websiteAddressCheck.detail = "This address matches a built-in local high-risk list.";
      scoreDelta += SIGNAL_WEIGHTS.moderate.normal;
      signalCounts.strong += 1;
      signalCounts.severe += 1;
      addReasonEntry(reasonEntries, websiteAddressCheck.detail, SIGNAL_WEIGHTS.strong.critical);
    } else if (urlAssessment.identitySignals.lookalikeBrand) {
      websiteAddressCheck.status = "warning";
      websiteAddressCheck.value = "Address needs a closer look";
      websiteAddressCheck.detail = `This address looks a bit like "${urlAssessment.identitySignals.lookalikeBrand}", but it is not the usual site.`;
    } else if (addressLooksUnusual) {
      websiteAddressCheck.status = "caution";
      websiteAddressCheck.value = "Address needs a closer look";
      websiteAddressCheck.detail = hasNormalSecureConnection
        ? "This site uses encryption, but the address looks unusual."
        : "The website address looks unusual.";
    } else if (urlAssessment.trusted || urlAssessment.sameSiteLevel !== "external" || urlAssessment.isEduDomain) {
      websiteAddressCheck.detail = "The website address looks consistent with where you meant to go.";
    }

    const signInTrustCheck = {
      status: "good",
      value: "No sign-in request noticed",
      detail: "This page does not appear to ask for a sign-in right now."
    };

    if (signInRequested) {
      if (brandClaimMismatch) {
        signInTrustCheck.status = "warning";
        signInTrustCheck.value = "Sign-in trust needs a closer look";
        signInTrustCheck.detail = "This page asks you to sign in, but the site name does not match what it claims.";
      } else if (!hasNormalSecureConnection) {
        signInTrustCheck.status = "warning";
        signInTrustCheck.value = "Sign-in trust needs a closer look";
        signInTrustCheck.detail = "This page asks you to sign in without normal secure connection signs.";
      } else if ((addressLooksUnusual || urlAssessment.signalCounts.strong > 0) && !trustedAuthFlow) {
        signInTrustCheck.status = "caution";
        signInTrustCheck.value = "Sign-in trust needs a closer look";
        signInTrustCheck.detail = "This site asks for sign-in details, but the address looks unusual.";
        scoreDelta += SIGNAL_WEIGHTS.low.normal;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, signInTrustCheck.detail, SIGNAL_WEIGHTS.moderate.light);
      } else if (trustedAuthFlow) {
        signInTrustCheck.value = "Sign-in page looks consistent";
        signInTrustCheck.detail = "This sign-in step looks consistent with a trusted account flow.";
      } else {
        signInTrustCheck.value = "Sign-in page looks consistent";
        signInTrustCheck.detail = "The sign-in request looks consistent with this site.";
      }
    }

    if (
      hasNormalSecureConnection &&
      !addressLooksUnusual &&
      !brandClaimMismatch &&
      urlAssessment.signalCounts.strong === 0
    ) {
      scoreDelta -= 3;
    }

    return {
      secureConnection,
      websiteAddressCheck,
      signInTrustCheck,
      note: "A secure connection protects traffic, but it does not guarantee the site is honest.",
      limitation:
        "This check uses browser signs like HTTPS and the site name. It cannot confirm every certificate detail from inside the page.",
      reasons: getTopReasonTexts(reasonEntries, 3),
      reasonEntries: cloneReasonEntries(reasonEntries),
      signalCounts,
      scoreDelta
    };
  }

  function collectLinkInsights(currentHost, currentRootDomain) {
    const seenUrls = new Set();
    const assessments = [];
    const anchors = Array.from(document.querySelectorAll("a[href]")).slice(0, 180);
    let sameDomainCount = 0;

    anchors.forEach((anchor) => {
      if (anchor.closest("#ai-guardian-root")) {
        return;
      }

      const resolvedUrl = resolveHttpUrl(anchor.getAttribute("href"));

      if (!resolvedUrl || seenUrls.has(resolvedUrl)) {
        return;
      }

      seenUrls.add(resolvedUrl);

      const assessment = assessLinkElement(anchor, {
        currentHost,
        currentRootDomain
      });

      if (assessment.domain === currentHost || assessment.rootDomain === currentRootDomain) {
        sameDomainCount += 1;
      }

      assessments.push({
        ...assessment,
        text: getLinkText(anchor, assessment.domain)
      });
    });

    const flaggedLinks = assessments
      .filter((assessment) => assessment.score >= 40)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6)
      .map((assessment) => {
        return {
          text: assessment.text,
          domain: assessment.domain,
          cleanedUrl: assessment.cleanedUrl,
          score: assessment.score,
          band: assessment.band,
          label: assessment.label,
          reason: assessment.reasons[0] || "This link may need extra care."
        };
      });

    const totalLinks = assessments.length || 1;

    return {
      flaggedLinks,
      downloadCount: assessments.filter((assessment) => assessment.isDownload).length,
      highRiskCount: assessments.filter((assessment) => assessment.score >= 80).length,
      mediumOrHigherCount: assessments.filter((assessment) => assessment.score >= 40).length,
      sameDomainRatio: sameDomainCount / totalLinks
    };
  }

  function assessUrl(urlString, context = {}) {
    try {
      const rawUrl = unwrapGoogleRedirect(urlString);
      const parsedUrl = new URL(rawUrl, location.href);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return buildUrlAssessmentFallback(rawUrl);
      }

      const domain = normalizeHost(parsedUrl.hostname);
      const rootDomain = getRootDomain(domain);
      const cleanedUrl = buildCleanUrl(parsedUrl);
      const reasonEntries = [];
      const signalCounts = {
        moderate: 0,
        strong: 0,
        severe: 0
      };
      let score = SCORE_BASE;
      const sameSiteLevel = getSameSiteLevel(domain, rootDomain, context);
      const isEduDomain = isEduHost(domain);
      const usesIpAddress = isIpAddress(domain);
      const usesEncodedHost = domain.includes("xn--");
      const isShortener = URL_SHORTENERS.has(domain);
      const localKnownRiskMatch = getLocalKnownRiskMatch(domain, rootDomain);
      const urlThreatSignals = getUrlThreatSignals(parsedUrl);
      const trustedAuthFlow = getTrustedAuthFlowDetails(parsedUrl, domain, rootDomain);

      if (parsedUrl.protocol !== "https:") {
        score += SIGNAL_WEIGHTS.moderate.light;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, "This link does not use the usual secure connection.", SIGNAL_WEIGHTS.moderate.light);
      }

      if (parsedUrl.username || parsedUrl.password) {
        score += SIGNAL_WEIGHTS.strong.normal;
        signalCounts.strong += 1;
        addReasonEntry(reasonEntries, "This address has extra user details in it.", SIGNAL_WEIGHTS.strong.normal);
      }

      if (usesIpAddress) {
        score += SIGNAL_WEIGHTS.strong.normal;
        signalCounts.strong += 1;
        addReasonEntry(reasonEntries, "This address uses numbers instead of a normal site name.", SIGNAL_WEIGHTS.strong.normal);
      }

      if (usesEncodedHost) {
        score += SIGNAL_WEIGHTS.strong.normal;
        signalCounts.strong += 1;
        addReasonEntry(reasonEntries, "This address uses an unusual letter code.", SIGNAL_WEIGHTS.strong.normal);
      }

      if (isShortener) {
        score += SIGNAL_WEIGHTS.strong.heavy;
        signalCounts.strong += 1;
        addReasonEntry(reasonEntries, "This link uses a short address. Short links can hide where they go.", SIGNAL_WEIGHTS.strong.heavy);
      }

      const tld = domain.split(".").pop() || "";
      const suspiciousTld = SUSPICIOUS_TLDS.has(tld);

      if (suspiciousTld) {
        score += SIGNAL_WEIGHTS.moderate.light;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, `This link ends with ".${tld}". That ending may need extra care.`, SIGNAL_WEIGHTS.moderate.light);
      }

      const trackerParams = getTrackerParams(parsedUrl);
      const hasTrackerParams = trackerParams.length > 0;

      if (hasTrackerParams) {
        score += trackerParams.length > 2 ? SIGNAL_WEIGHTS.moderate.light : SIGNAL_WEIGHTS.low.normal;
        if (trackerParams.length > 2) {
          signalCounts.moderate += 1;
        }
        addReasonEntry(
          reasonEntries,
          "This link has extra tracking parts.",
          trackerParams.length > 2 ? SIGNAL_WEIGHTS.moderate.light : SIGNAL_WEIGHTS.low.normal
        );
      }

      const paramCount = Array.from(parsedUrl.searchParams.keys()).length;
      const rawLength = rawUrl.length;
      const hasLongUrl = rawLength > 120;

      if (paramCount > 6) {
        const paramWeight = trustedAuthFlow.isTrustedAuthFlow ? SIGNAL_WEIGHTS.low.light : SIGNAL_WEIGHTS.moderate.light;
        score += paramWeight;

        if (!trustedAuthFlow.isTrustedAuthFlow) {
          signalCounts.moderate += 1;
          addReasonEntry(reasonEntries, "This link uses many extra address parts.", SIGNAL_WEIGHTS.moderate.light);
        }
      }

      if (hasLongUrl) {
        if (trustedAuthFlow.isTrustedAuthFlow) {
          score += SIGNAL_WEIGHTS.low.light;
        } else {
          score += rawLength > 220 ? SIGNAL_WEIGHTS.moderate.normal : SIGNAL_WEIGHTS.low.heavy;
          signalCounts.moderate += 1;
          addReasonEntry(
            reasonEntries,
            "This link uses a very long address. Sometimes that can hide where it really goes.",
            rawLength > 220 ? SIGNAL_WEIGHTS.moderate.normal : SIGNAL_WEIGHTS.low.heavy
          );
        }
      }

      const firstLabel = domain.split(".")[0] || "";
      const hyphenCount = (firstLabel.match(/-/g) || []).length;

      if (hyphenCount >= 3) {
        score += SIGNAL_WEIGHTS.low.normal;
        addReasonEntry(reasonEntries, "This site name uses many hyphens.", SIGNAL_WEIGHTS.low.normal);
      }

      if (hasManyDigits(firstLabel)) {
        score += SIGNAL_WEIGHTS.low.normal;
        addReasonEntry(reasonEntries, "This site name uses many numbers.", SIGNAL_WEIGHTS.low.normal);
      }

      const unusualPort = Boolean(parsedUrl.port && !["80", "443"].includes(parsedUrl.port));

      if (unusualPort) {
        score += SIGNAL_WEIGHTS.moderate.light;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, "This link uses an unusual web door number.", SIGNAL_WEIGHTS.moderate.light);
      }

      const lookalikeBrand = findLookalikeBrand(domain);

      if (lookalikeBrand) {
        score += SIGNAL_WEIGHTS.strong.heavy;
        signalCounts.strong += 1;
        addReasonEntry(
          reasonEntries,
          `This address looks a bit like "${lookalikeBrand}", but it is not the usual site.`,
          SIGNAL_WEIGHTS.strong.heavy
        );
      }

      if (urlThreatSignals.hiddenRedirect && !trustedAuthFlow.isTrustedAuthFlow) {
        score += SIGNAL_WEIGHTS.strong.normal;
        signalCounts.strong += 1;
        addReasonEntry(reasonEntries, "This link may hide another destination inside the address.", SIGNAL_WEIGHTS.strong.normal);
      }

      if (urlThreatSignals.walletRecoveryBait) {
        score += SIGNAL_WEIGHTS.strong.critical;
        signalCounts.strong += 1;
        signalCounts.severe += 1;
        addReasonEntry(reasonEntries, "This address looks like wallet recovery or seed phrase bait.", SIGNAL_WEIGHTS.strong.critical);
      } else if (urlThreatSignals.crackBait) {
        score += SIGNAL_WEIGHTS.strong.heavy;
        signalCounts.strong += 1;
        addReasonEntry(reasonEntries, "This address looks like crack, keygen, or pirated download bait.", SIGNAL_WEIGHTS.strong.heavy);
      } else if (urlThreatSignals.cryptoScamLanguage) {
        score += SIGNAL_WEIGHTS.moderate.normal;
        signalCounts.moderate += 1;
        addReasonEntry(reasonEntries, "This address uses crypto-related language that may need extra care.", SIGNAL_WEIGHTS.moderate.normal);
      }

      if (
        urlThreatSignals.loginLikePath &&
        !trustedAuthFlow.isTrustedAuthFlow &&
        (lookalikeBrand || suspiciousTld || usesIpAddress || usesEncodedHost)
      ) {
        score += SIGNAL_WEIGHTS.strong.normal;
        signalCounts.strong += 1;
        addReasonEntry(reasonEntries, "This address points to a sign-in style page on an unusual site.", SIGNAL_WEIGHTS.strong.normal);
      }

      const downloadExtension = getFileExtension(parsedUrl.pathname);
      const isDownload = Boolean(downloadExtension) && RISKY_DOWNLOAD_EXTENSIONS.has(downloadExtension);

      if (isDownload) {
        score += SIGNAL_WEIGHTS.strong.normal;
        signalCounts.strong += 1;
        addReasonEntry(reasonEntries, `This link looks like a .${downloadExtension} download.`, SIGNAL_WEIGHTS.strong.normal);
      }

      if (localKnownRiskMatch) {
        score += SIGNAL_WEIGHTS.strong.critical;
        signalCounts.strong += 1;
        signalCounts.severe += 1;
        addReasonEntry(reasonEntries, "This address matches a built-in local high-risk list.", SIGNAL_WEIGHTS.strong.critical);
      }

      const trusted = isTrustedHost(domain);

      if (trusted) {
        score -= 26;
      }

      if (isEduDomain) {
        score -= 10;
      }

      if (sameSiteLevel === "same-host") {
        score -= 22;
      } else if (sameSiteLevel === "same-root") {
        score -= 14;
      }

      if (
        trustedAuthFlow.isTrustedAuthFlow &&
        parsedUrl.protocol === "https:" &&
        trusted &&
        !lookalikeBrand &&
        !localKnownRiskMatch &&
        !usesIpAddress &&
        !usesEncodedHost
      ) {
        score -= 10;
      }

      score = applyRiskGuardrails(score, signalCounts, {
        trusted,
        isEduDomain,
        sameSiteLevel,
        trustedAuthFlow: trustedAuthFlow.isTrustedAuthFlow
      });
      score = applyUrlScoreFloors(score, {
        localKnownRiskMatch,
        lookalikeBrand,
        isDownload,
        trusted,
        isShortener,
        suspiciousTld,
        usesIpAddress,
        usesEncodedHost,
        loginLikePath: urlThreatSignals.loginLikePath,
        walletRecoveryBait: urlThreatSignals.walletRecoveryBait,
        cryptoScamLanguage: urlThreatSignals.cryptoScamLanguage,
        crackBait: urlThreatSignals.crackBait,
        hiddenRedirect: urlThreatSignals.hiddenRedirect,
        trustedAuthFlow: trustedAuthFlow.isTrustedAuthFlow
      });
      score = applyScoreDistributionBaseline(score, signalCounts, {
        trusted,
        isEduDomain,
        hasHttps: parsedUrl.protocol === "https:",
        hasTrackerParams,
        noisy:
          hasLongUrl ||
          paramCount > 6 ||
          hyphenCount >= 3 ||
          hasManyDigits(firstLabel),
        sameSiteLevel,
        trustedAuthFlow: trustedAuthFlow.isTrustedAuthFlow
      });

      const bandDetails = getBandDetails(score);

      return {
        score,
        band: bandDetails.band,
        label: bandDetails.label,
        domain,
        rootDomain,
        cleanedUrl,
        reasons: getTopReasonTexts(reasonEntries, 3),
        reasonEntries: cloneReasonEntries(reasonEntries),
        trusted,
        isDownload,
        isEduDomain,
        sameSiteLevel,
        signalCounts,
        identitySignals: {
          protocol: parsedUrl.protocol,
          hasTrackerParams,
          suspiciousTld,
          unusualPort,
          lookalikeBrand,
          isShortener,
          usesIpAddress,
          usesEncodedHost,
          hasLongUrl,
          loginLikePath: urlThreatSignals.loginLikePath,
          hiddenRedirect: urlThreatSignals.hiddenRedirect,
          walletRecoveryBait: urlThreatSignals.walletRecoveryBait,
          cryptoScamLanguage: urlThreatSignals.cryptoScamLanguage,
          crackBait: urlThreatSignals.crackBait,
          localKnownRiskMatch,
          trustedAuthFlow: trustedAuthFlow.isTrustedAuthFlow,
          trustedAuthBrand: trustedAuthFlow.brand,
          trustedContinuationHost: trustedAuthFlow.continuationHost
        }
      };
    } catch (error) {
      return buildUrlAssessmentFallback(urlString);
    }
  }

  function assessLinkElement(anchor, context = {}) {
    const resolvedUrl = resolveHttpUrl(anchor.getAttribute("href"));
    const assessment = assessUrl(resolvedUrl || anchor.href, context);
    const linkText = getLinkText(anchor, assessment.domain);
    const reasonEntries = cloneReasonEntries(
      Array.isArray(assessment.reasonEntries)
        ? assessment.reasonEntries
        : (assessment.reasons || []).map((reason) => {
            return {
              text: reason,
              weight: SIGNAL_WEIGHTS.moderate.light
            };
          })
    );
    const signalCounts = {
      moderate: assessment.signalCounts.moderate,
      strong: assessment.signalCounts.strong,
      severe: Number(assessment.signalCounts.severe || 0)
    };
    let score = assessment.score;

    const mismatch = getLinkMismatchDetails(linkText, assessment, context);

    if (mismatch.level === "misleading") {
      score += SIGNAL_WEIGHTS.strong.normal;
      signalCounts.strong += 1;
      addReasonEntry(reasonEntries, mismatch.reason, SIGNAL_WEIGHTS.strong.normal);
    } else if (mismatch.level === "second-look") {
      score += SIGNAL_WEIGHTS.moderate.light;
      signalCounts.moderate += 1;
      addReasonEntry(reasonEntries, mismatch.reason, SIGNAL_WEIGHTS.moderate.light);
    }

    score = applyRiskGuardrails(score, signalCounts, {
      trusted: assessment.trusted,
      isEduDomain: assessment.isEduDomain,
      sameSiteLevel: assessment.sameSiteLevel
    });

    const bandDetails = getBandDetails(score);

    return {
      ...assessment,
      score,
      band: bandDetails.band,
      label: bandDetails.label,
      reasons: getTopReasonTexts(reasonEntries, 3),
      reasonEntries: cloneReasonEntries(reasonEntries),
      mismatchLevel: mismatch.level,
      text: linkText
    };
  }

  function buildUrlAssessmentFallback(urlString) {
    const bandDetails = getBandDetails(28);

    return {
      score: 28,
      band: bandDetails.band,
      label: bandDetails.label,
      domain: "unreadable link",
      rootDomain: "",
      cleanedUrl: urlString || "Unavailable",
      reasons: ["We could not read this link clearly."],
      reasonEntries: [
        {
          text: "We could not read this link clearly.",
          weight: SIGNAL_WEIGHTS.moderate.light,
          order: 0
        }
      ],
      trusted: false,
      isDownload: false,
      isEduDomain: false,
      sameSiteLevel: "external",
      signalCounts: {
        moderate: 1,
        strong: 0
      },
      identitySignals: {
        protocol: "",
        hasTrackerParams: false,
        suspiciousTld: false,
        unusualPort: false,
        lookalikeBrand: "",
        isShortener: false,
        usesIpAddress: false,
        usesEncodedHost: false,
        hasLongUrl: false
      }
    };
  }

  function getLinkMismatchDetails(linkText, assessment, context = {}) {
    const normalizedText = normalizeLinkText(linkText);

    if (!normalizedText || GENERIC_LINK_TEXTS.has(normalizedText)) {
      return {
        level: "none",
        reason: ""
      };
    }

    if (assessment.rootDomain && assessment.rootDomain === context.currentRootDomain) {
      return {
        level: "none",
        reason: ""
      };
    }

    const visibleDomain = extractVisibleDomain(normalizedText);

    if (visibleDomain && looksLikeExplicitUrlLabel(normalizedText, visibleDomain)) {
      const visibleRootDomain = getRootDomain(normalizeHost(visibleDomain));

      if (visibleRootDomain && visibleRootDomain !== assessment.rootDomain) {
        return {
          level: "misleading",
          reason: `This link shows "${visibleDomain}" but goes to ${assessment.domain}.`
        };
      }
    }

    const actionBrand = findActionBrandInText(normalizedText);

    if (actionBrand) {
      const pointsToOfficialHost = actionBrand.officialHosts.some((officialHost) => {
        return assessment.domain === officialHost || assessment.domain.endsWith(`.${officialHost}`);
      });

      if (!pointsToOfficialHost) {
        return {
          level: "second-look",
          reason: `This link mentions ${actionBrand.brand}, but it opens ${assessment.domain}.`
        };
      }
    }

    return {
      level: "none",
      reason: ""
    };
  }

  function isFamilyProtectionException(rootDomain) {
    const exceptions = Array.isArray(state.settings.familyProtectionExceptions)
      ? state.settings.familyProtectionExceptions
      : [];

    return exceptions.includes(rootDomain);
  }

  function normalizeLinkText(value) {
    return (value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractVisibleDomain(text) {
    const match = text.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
    return match ? match[0].toLowerCase() : "";
  }

  function looksLikeExplicitUrlLabel(text, visibleDomain) {
    return (
      text === visibleDomain ||
      text === `www.${visibleDomain}` ||
      text.startsWith("http://") ||
      text.startsWith("https://") ||
      text.startsWith("www.") ||
      text.startsWith(visibleDomain) ||
      text.endsWith(visibleDomain)
    );
  }

  function findActionBrandInText(text) {
    return BRAND_RULES.find((rule) => {
      const mentionsBrand = text.includes(rule.brand);
      const mentionsAction = ACTION_PROMPT_WORDS.some((word) => text.includes(word));

      return mentionsBrand && mentionsAction;
    }) || null;
  }

  function getSameSiteLevel(domain, rootDomain, context = {}) {
    if (context.currentHost && domain === context.currentHost) {
      return "same-host";
    }

    if (context.currentRootDomain && rootDomain === context.currentRootDomain) {
      return "same-root";
    }

    return "external";
  }

  function getPageThreatFlags(pageSignals) {
    const normalizedThreatText = normalizeThreatText((pageSignals.highRiskPhrases || []).join(" "));

    return {
      walletRecoveryBait: includesAnyThreatHint(normalizedThreatText, WALLET_BAIT_HINTS),
      cryptoScamLanguage: includesAnyThreatHint(normalizedThreatText, CRYPTO_SCAM_HINTS),
      crackBait: includesAnyThreatHint(normalizedThreatText, CRACK_BAIT_HINTS)
    };
  }

  function getTrustedAuthFlowDetails(parsedUrl, domain, rootDomain) {
    const pathname = String(parsedUrl.pathname || "").toLowerCase();
    const matchedRule = TRUSTED_AUTH_FLOW_RULES.find((rule) => {
      return rule.hosts.some((officialHost) => domain === officialHost || domain.endsWith(`.${officialHost}`));
    });

    if (!matchedRule) {
      return getGenericTrustedSsoFlowDetails(parsedUrl, domain, rootDomain, pathname);
    }

    const usesContinueParam = matchedRule.continueParams.some((paramName) => parsedUrl.searchParams.has(paramName));
    const serviceValue = String(parsedUrl.searchParams.get("service") || "").toLowerCase();
    const hasTrustedAuthPath =
      matchedRule.pathHints.some((hint) => pathname.includes(hint)) ||
      usesContinueParam ||
      matchedRule.serviceHints.some((hint) => serviceValue.includes(hint));

    if (!hasTrustedAuthPath) {
      return {
        isTrustedAuthFlow: false,
        brand: matchedRule.brand,
        continuationHost: ""
      };
    }

    const continuationValue = matchedRule.continueParams
      .map((paramName) => parsedUrl.searchParams.get(paramName))
      .find((value) => Boolean(value && /^https?:/i.test(String(value))));
    let continuationHost = "";

    if (continuationValue) {
      try {
        continuationHost = normalizeHost(new URL(continuationValue, parsedUrl.toString()).hostname);
      } catch (error) {
        continuationHost = "";
      }
    }

    const continuationRoot = continuationHost ? getRootDomain(continuationHost) : "";
    const sameBrandContinuation =
      !continuationRoot || matchedRule.allowedRoots.includes(continuationRoot) || continuationRoot === rootDomain;
    const secureTrustedHost = parsedUrl.protocol === "https:" && isTrustedHost(domain);

    return {
      isTrustedAuthFlow: secureTrustedHost && sameBrandContinuation,
      brand: matchedRule.brand,
      continuationHost
    };
  }

  function getGenericTrustedSsoFlowDetails(parsedUrl, domain, rootDomain, pathname) {
    const hasTrustedHostSignals =
      parsedUrl.protocol === "https:" &&
      (isTrustedHost(domain) ||
        isEduHost(domain) ||
        domain.startsWith("login.") ||
        domain.startsWith("sso.") ||
        domain.startsWith("auth.") ||
        pathname.includes("/adfs/"));
    const hasSsoPath = GENERIC_SSO_PATH_HINTS.some((hint) => pathname.includes(hint));
    const hasSsoParam = GENERIC_SSO_PARAM_HINTS.some((paramName) => parsedUrl.searchParams.has(paramName));
    const continuationValue = GENERIC_SSO_PARAM_HINTS
      .map((paramName) => parsedUrl.searchParams.get(paramName))
      .find((value) => Boolean(value && /^https?:/i.test(String(value))));
    let continuationHost = "";

    if (continuationValue) {
      try {
        continuationHost = normalizeHost(new URL(continuationValue, parsedUrl.toString()).hostname);
      } catch (error) {
        continuationHost = "";
      }
    }

    const continuationRoot = continuationHost ? getRootDomain(continuationHost) : "";
    const continuationLooksConsistent =
      !continuationRoot ||
      continuationRoot === rootDomain ||
      isTrustedHost(continuationHost) ||
      isEduHost(continuationHost);

    return {
      isTrustedAuthFlow: hasTrustedHostSignals && (hasSsoPath || hasSsoParam) && continuationLooksConsistent,
      brand: "",
      continuationHost
    };
  }

  function getUrlThreatSignals(parsedUrl) {
    let combinedText = "";

    try {
      combinedText = decodeURIComponent(
        `${parsedUrl.pathname || ""} ${parsedUrl.search || ""} ${parsedUrl.hash || ""}`
      );
    } catch (error) {
      combinedText = `${parsedUrl.pathname || ""} ${parsedUrl.search || ""} ${parsedUrl.hash || ""}`;
    }

    const normalizedText = normalizeThreatText(combinedText);
    const hiddenRedirect = Array.from(parsedUrl.searchParams.entries()).some(([key, value]) => {
      if (!HIDDEN_REDIRECT_PARAM_NAMES.has(String(key || "").toLowerCase())) {
        return false;
      }

      const trimmedValue = String(value || "").trim().toLowerCase();
      return trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://");
    });

    return {
      loginLikePath: includesAnyThreatHint(normalizedText, LOGIN_URL_HINTS),
      walletRecoveryBait: includesAnyThreatHint(normalizedText, WALLET_BAIT_HINTS),
      cryptoScamLanguage: includesAnyThreatHint(normalizedText, CRYPTO_SCAM_HINTS),
      crackBait: includesAnyThreatHint(normalizedText, CRACK_BAIT_HINTS),
      hiddenRedirect
    };
  }

  function normalizeThreatText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includesAnyThreatHint(text, hints) {
    return hints.some((hint) => text.includes(normalizeThreatText(hint)));
  }

  function applyUrlScoreFloors(score, flags = {}) {
    let nextScore = clampScore(score);

    if (flags.localKnownRiskMatch) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.knownBadHost);
    }

    if (flags.walletRecoveryBait && !flags.trusted) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.walletRecoveryBait);
    }

    if (flags.lookalikeBrand && flags.loginLikePath) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.impersonationLogin);
    } else if (flags.lookalikeBrand) {
      nextScore = Math.max(nextScore, 72);
    }

    if (flags.isDownload && (flags.cryptoScamLanguage || flags.crackBait)) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.suspiciousDownloadScam);
    } else if (flags.isDownload) {
      nextScore = Math.max(nextScore, 62);
    }

    if (!flags.trustedAuthFlow && flags.hiddenRedirect && flags.isShortener) {
      nextScore = Math.max(nextScore, 72);
    } else if (!flags.trustedAuthFlow && flags.hiddenRedirect) {
      nextScore = Math.max(nextScore, 64);
    }

    if (flags.isShortener) {
      nextScore = Math.max(nextScore, 58);
    }

    if ((flags.usesIpAddress || flags.usesEncodedHost) && flags.loginLikePath) {
      nextScore = Math.max(nextScore, 72);
    }

    if (flags.suspiciousTld && flags.loginLikePath) {
      nextScore = Math.max(nextScore, 66);
    }

    return clampScore(nextScore);
  }

  function applyPageScoreFloors(score, flags = {}) {
    let nextScore = clampScore(score);

    if (flags.localKnownRiskMatch) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.knownBadHost);
    }

    if (
      flags.walletRecoveryBait &&
      !flags.trusted &&
      (flags.requestsCredentials ||
        flags.requestsPaymentDetails ||
        flags.suspiciousDownload ||
        flags.suspiciousForms ||
        flags.urlStrongCount > 0 ||
        flags.pushyPhraseCount > 0)
    ) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.walletRecoveryBait);
    }

    if (flags.impersonationLike && flags.signInRequested) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.impersonationLogin);
    }

    if (flags.suspiciousDownload && (flags.cryptoScamLanguage || flags.crackBait)) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.suspiciousDownloadScam);
    }

    if (
      flags.requestsCredentials &&
      flags.pushyPhraseCount > 0 &&
      (flags.suspiciousForms || flags.urlStrongCount > 0)
    ) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.fakeSuspensionSignIn);
    }

    if (
      flags.requestsPaymentDetails &&
      (flags.urlStrongCount > 0 || flags.suspiciousForms || flags.highRiskPhraseCount > 0)
    ) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.suspiciousPaymentPage);
    }

    if (flags.fakeAccountSuspensionAndSignIn) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.fakeSuspensionSignIn);
    }

    if (flags.strongSignalCount >= 2) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.twoStrongSignals);
    } else if (flags.strongSignalCount >= 1) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.oneStrongSignal);
    }

    if (flags.moderateSignalCount >= 3) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.threeModerateSignals);
    }

    return clampScore(nextScore);
  }

  function applyScoreDistributionBaseline(score, signalCounts, options = {}) {
    let nextScore = clampScore(score);
    const moderateCount = Number(signalCounts.moderate || 0);
    const strongCount = Number(signalCounts.strong || 0);

    if (options.trustedAuthFlow && strongCount === 0) {
      return clampScore(Math.min(Math.max(nextScore, options.hasHttps ? 6 : 10), 24));
    }

    if (strongCount >= 2) {
      return clampScore(Math.max(nextScore, SCORE_FLOORS.twoStrongSignals));
    }

    if (strongCount === 1) {
      return clampScore(Math.max(nextScore, SCORE_FLOORS.oneStrongSignal));
    }

    if (moderateCount >= 3) {
      nextScore = Math.max(nextScore, SCORE_FLOORS.threeModerateSignals);
    } else if (moderateCount === 2) {
      nextScore = Math.max(nextScore, options.trusted ? 18 : options.isEduDomain ? 16 : 24);
    } else if (moderateCount === 1) {
      nextScore = Math.max(nextScore, options.trusted ? 12 : options.isEduDomain ? 10 : 18);
    } else if (options.hasHttps) {
      if (options.trusted) {
        nextScore = Math.max(nextScore, 4);
      } else if (options.isEduDomain) {
        nextScore = Math.max(nextScore, 4);
      } else if (options.heavyTracking || options.thirdPartyHeavy) {
        nextScore = Math.max(nextScore, 8);
      } else if (options.hasTrackerParams || options.noisy) {
        nextScore = Math.max(nextScore, 12);
      } else if (options.sameSiteLevel === "same-host") {
        nextScore = Math.max(nextScore, 4);
      } else if (options.sameSiteLevel === "same-root") {
        nextScore = Math.max(nextScore, 4);
      } else {
        nextScore = Math.max(nextScore, 9);
      }
    }

    return clampScore(nextScore);
  }

  function alignLiveScoreWithPreview(previewScore, liveScore, totalSignals = {}, liveSignals = {}) {
    let nextScore = clampScore(liveScore);
    const previewValue = Number(previewScore || 0);
    const liveStrong = Number(liveSignals.strong || 0);
    const liveModerate = Number(liveSignals.moderate || 0);
    const liveSevere = Number(liveSignals.severe || 0);

    if (previewValue < 20 && nextScore > 60) {
      const hasConfirmedStrongSignal = liveStrong >= 1;
      const hasThreeModerateSignals = liveModerate >= 3;

      if (!hasConfirmedStrongSignal && !hasThreeModerateSignals) {
        nextScore = Math.min(nextScore, 45);
      }
    }

    if (previewValue < 20 && nextScore > 80) {
      const hasSevereSignal = liveSevere >= 1;
      const hasTwoStrongSignals = liveStrong >= 2;

      if (!hasSevereSignal && !hasTwoStrongSignals) {
        nextScore = Math.min(nextScore, 80);
      }
    }

    return clampScore(nextScore);
  }

  function applyRiskGuardrails(score, signalCounts, options = {}) {
    let guardedScore = clampScore(score);
    const moderateCount = signalCounts.moderate || 0;
    const strongCount = signalCounts.strong || 0;

    if (options.trustedAuthFlow && strongCount === 0) {
      guardedScore = Math.min(guardedScore, moderateCount >= 2 ? 32 : 22);
    }

    if (options.sameSiteLevel === "same-host" && strongCount === 0) {
      guardedScore = Math.min(guardedScore, moderateCount >= 2 ? 24 : 19);
    } else if (options.sameSiteLevel === "same-root" && strongCount === 0) {
      guardedScore = Math.min(guardedScore, moderateCount >= 2 ? 34 : 24);
    }

    if (options.trusted && strongCount === 0) {
      guardedScore = Math.min(guardedScore, moderateCount >= 2 ? 39 : 19);
    }

    if (options.isEduDomain && strongCount === 0) {
      guardedScore = Math.min(guardedScore, moderateCount >= 2 ? 29 : 15);
    }

    if (strongCount === 0 && moderateCount < 2 && guardedScore >= 60) {
      guardedScore = 59;
    }

    if (strongCount === 0 && guardedScore >= 80) {
      guardedScore = 79;
    }

    if (strongCount === 1 && moderateCount < 1 && guardedScore >= 80) {
      guardedScore = 79;
    }

    return clampScore(guardedScore);
  }

  function getBandDetails(score) {
    return BAND_DETAILS.find((item) => score <= item.max) || BAND_DETAILS[BAND_DETAILS.length - 1];
  }

  function clampScore(score) {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function shouldUseGuidedProtectionMode(score, signalCounts = {}, extraFlags = {}) {
    const protectionProfile = getProtectionProfile();

    if (
      !state.settings.labyrinthModeEnabled ||
      !state.settings.guidedProtectionModeEnabled ||
      score < protectionProfile.actionWarningThreshold
    ) {
      return false;
    }

    return (
      score >= protectionProfile.guidedRiskThreshold ||
      (signalCounts.strong || 0) > 0 ||
      Boolean(extraFlags.looksMisleading) ||
      Boolean(extraFlags.impersonationLike) ||
      Boolean(extraFlags.requestsPaymentDetails) ||
      Boolean(
        extraFlags.signInLike &&
          (extraFlags.connectionConcern ||
            extraFlags.unusualAddress ||
            extraFlags.suspiciousDestination)
      ) ||
      Boolean(
        extraFlags.requestsPersonalInfo &&
          (extraFlags.connectionConcern ||
            extraFlags.unusualAddress ||
            extraFlags.suspiciousDestination)
      ) ||
      Boolean(extraFlags.pushyAndSuspicious) ||
      Boolean(extraFlags.redirectLike)
    );
  }

  function buildGuidedProtectionCopy(details = {}) {
    const saferPath = "Going back is the safer choice.";

    if (details.downloadLike) {
      return {
        title: "Let's slow down",
        message: `This download may not be what it says. ${saferPath}`
      };
    }

    if (details.requestsPaymentDetails) {
      return {
        title: "Let's slow down",
        message: `This page is asking for payment details in an unusual way. ${saferPath}`
      };
    }

    if (
      details.requestsPersonalInfo &&
      (details.connectionConcern || details.unusualAddress || details.suspiciousDestination)
    ) {
      return {
        title: "Let's slow down",
        message: `This page is asking for personal information in an unusual way. ${saferPath}`
      };
    }

    if (details.looksMisleading || details.redirectLike) {
      return {
        title: "Let's slow down",
        message: `This link may not go where it says. ${saferPath}`
      };
    }

    if (
      details.impersonationLike ||
      (details.signInLike &&
        (details.unusualAddress || details.connectionConcern || details.suspiciousDestination))
    ) {
      return {
        title: "Let's slow down",
        message: `This page may be pretending to be someone you trust. ${saferPath}`
      };
    }

    if (details.pushyAndSuspicious) {
      return {
        title: "Let's slow down",
        message: `This page is trying to rush you in an unusual way. ${saferPath}`
      };
    }

    return {
      title: "Let's slow down",
      message: `This page may need extra care. ${saferPath}`
    };
  }

  function buildWarningTrustCopy(options = {}) {
    const score = Number(options.score || 0);
    const isEmailLink = Boolean(options.isEmailLink);
    const isTrustedProviderSignIn = Boolean(options.isTrustedProviderSignIn);

    if (isTrustedProviderSignIn) {
      return {
        title: "Check this sign-in step",
        message: "Always confirm the address before continuing."
      };
    }

    if (isEmailLink) {
      return {
        title: "Check this email link",
        message: "This message may be trying to rush you."
      };
    }

    if (score >= 80) {
      return {
        title: "This page may not be safe",
        message: "We found patterns often linked to scams or impersonation."
      };
    }

    if (score >= 60) {
      return {
        title: "Pause before continuing",
        message: "This page shows stronger warning signs."
      };
    }

    return {
      title: "Take a quick look",
      message: "Something here may need a closer check."
    };
  }

  function getLinkGuidedProtectionFlags(assessment, isDownload) {
    const normalizedText = normalizeLinkText(assessment.text);

    return {
      downloadLike: Boolean(isDownload),
      looksMisleading: assessment.mismatchLevel !== "none",
      impersonationLike: Boolean(assessment.identitySignals.lookalikeBrand),
      signInLike: ACTION_PROMPT_WORDS.some((word) => normalizedText.includes(word)),
      redirectLike: Boolean(assessment.identitySignals.isShortener),
      requestsPaymentDetails: false,
      requestsPersonalInfo: false,
      suspiciousDestination:
        assessment.signalCounts.strong > 0 || assessment.signalCounts.moderate >= 2,
      unusualAddress:
        Boolean(assessment.identitySignals.lookalikeBrand) ||
        assessment.identitySignals.usesIpAddress ||
        assessment.identitySignals.usesEncodedHost ||
        assessment.identitySignals.suspiciousTld ||
        assessment.identitySignals.unusualPort,
      connectionConcern: assessment.identitySignals.protocol !== "https:",
      pushyAndSuspicious:
        PUSHY_PHRASES.some((phrase) => normalizedText.includes(phrase)) &&
        (assessment.signalCounts.strong > 0 || assessment.score >= 80)
    };
  }

  function getFormGuidedProtectionFlags(formAssessment) {
    return {
      downloadLike: false,
      looksMisleading: Boolean(formAssessment.riskContext.suspiciousDestination),
      impersonationLike: Boolean(formAssessment.riskContext.unusualAddress),
      signInLike: Boolean(formAssessment.riskContext.asksForPassword),
      redirectLike: false,
      requestsPaymentDetails: Boolean(formAssessment.riskContext.asksForPaymentDetails),
      requestsPersonalInfo: Boolean(formAssessment.riskContext.asksForPersonalInfo),
      suspiciousDestination: Boolean(formAssessment.riskContext.suspiciousDestination),
      unusualAddress: Boolean(formAssessment.riskContext.unusualAddress),
      connectionConcern: Boolean(formAssessment.riskContext.connectionConcern),
      pushyAndSuspicious:
        Boolean(formAssessment.riskContext.pushyPage) &&
        (formAssessment.signalCounts.strong > 0 ||
          formAssessment.riskContext.suspiciousDestination ||
          formAssessment.riskContext.asksForPassword ||
          formAssessment.riskContext.asksForPaymentDetails)
    };
  }

  function getPageGuidedProtectionFlags(report) {
    const reasonText = report.reasons.join(" ").toLowerCase();
    const websiteAddressStatus = report.siteIdentityCheck?.websiteAddressCheck?.status || "";
    const secureConnectionStatus = report.siteIdentityCheck?.secureConnection?.status || "";
    const signInTrustStatus = report.siteIdentityCheck?.signInTrustCheck?.status || "";

    return {
      downloadLike: reasonText.includes("download"),
      looksMisleading:
        reasonText.includes("link shows") ||
        reasonText.includes("goes to") ||
        reasonText.includes("not the usual site"),
      impersonationLike:
        reasonText.includes("pretending") ||
        reasonText.includes("does not match what it claims") ||
        websiteAddressStatus === "warning" ||
        signInTrustStatus === "warning",
      signInLike:
        reasonText.includes("password") ||
        reasonText.includes("sign in") ||
        reasonText.includes("sign-in"),
      redirectLike: reasonText.includes("short address"),
      requestsPaymentDetails:
        reasonText.includes("card number") ||
        reasonText.includes("card code") ||
        reasonText.includes("bank details"),
      requestsPersonalInfo:
        reasonText.includes("details like") || reasonText.includes("personal information"),
      suspiciousDestination: report.strongSignalCount > 0 || report.moderateSignalCount >= 3,
      unusualAddress:
        websiteAddressStatus === "warning" || websiteAddressStatus === "caution",
      connectionConcern:
        secureConnectionStatus === "warning" || secureConnectionStatus === "caution",
      pushyAndSuspicious:
        reasonText.includes("pushy") &&
        (report.strongSignalCount > 0 || report.score >= 80)
    };
  }

  function cleanupExpiredNavigationApprovals() {
    const now = Date.now();

    Array.from(state.approvedNavigationExpirations.entries()).forEach(([warningKey, expiresAt]) => {
      if (Number(expiresAt || 0) <= now) {
        state.approvedNavigationExpirations.delete(warningKey);
      }
    });
  }

  function isNavigationApproved(warningKey) {
    cleanupExpiredNavigationApprovals();

    if (state.approvedNavigations.has(warningKey)) {
      return true;
    }

    const expiresAt = Number(state.approvedNavigationExpirations.get(warningKey) || 0);
    return expiresAt > Date.now();
  }

  function markNavigationApproved(warningKey, durationMs = 12000) {
    state.approvedNavigations.add(warningKey);

    if (durationMs > 0) {
      state.approvedNavigationExpirations.set(warningKey, Date.now() + durationMs);
      window.setTimeout(() => {
        state.approvedNavigations.delete(warningKey);

        const expiresAt = Number(state.approvedNavigationExpirations.get(warningKey) || 0);

        if (expiresAt <= Date.now()) {
          state.approvedNavigationExpirations.delete(warningKey);
        }
      }, durationMs + 50);
    }
  }

  function buildNavigationWarningKey(targetHref) {
    return `link|${String(targetHref || "").trim()}`;
  }

  function captureNavigationIntent(anchor, clickEvent) {
    const exactTargetHref = getExactNavigationTargetHref(anchor);

    if (!exactTargetHref) {
      return null;
    }

    const explicitTarget = String(anchor.target || "").trim();
    const openInNewTab =
      explicitTarget === "_blank" ||
      clickEvent.ctrlKey ||
      clickEvent.metaKey ||
      clickEvent.shiftKey ||
      clickEvent.button === 1;

    return {
      exactTargetHref,
      warningKey: buildNavigationWarningKey(exactTargetHref),
      target: openInNewTab ? "_blank" : explicitTarget || "_self",
      rel: anchor.rel || "noopener noreferrer",
      download: anchor.hasAttribute("download") ? anchor.getAttribute("download") || "" : "",
      openInNewTab,
      preserveDownload: anchor.hasAttribute("download")
    };
  }

  function getExactNavigationTargetHref(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) {
      return "";
    }

    try {
      const exactTargetHref = String(anchor.href || "").trim();

      if (!exactTargetHref) {
        return "";
      }

      const parsedUrl = new URL(exactTargetHref, location.href);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return "";
      }

      return parsedUrl.toString();
    } catch (error) {
      return "";
    }
  }

  function shouldBypassTrustedAuthWarning(assessment) {
    return Boolean(
      assessment.identitySignals.trustedAuthFlow &&
      (assessment.trusted || assessment.isEduDomain || assessment.sameSiteLevel !== "external" || assessment.identitySignals.trustedContinuationHost) &&
      assessment.identitySignals.protocol === "https:" &&
      !assessment.identitySignals.lookalikeBrand &&
      !assessment.identitySignals.localKnownRiskMatch &&
      !assessment.identitySignals.usesIpAddress &&
      !assessment.identitySignals.usesEncodedHost &&
      !assessment.identitySignals.suspiciousTld &&
      assessment.score < 70
    );
  }

  function handleDocumentClick(event) {
    if (!state.settings.proactiveWarningsEnabled) {
      return;
    }

    const anchor = event.target.closest("a[href]");

    if (!anchor || anchor.closest("#ai-guardian-root")) {
      return;
    }

    const navigationIntent = captureNavigationIntent(anchor, event);
    const resolvedUrl = navigationIntent?.exactTargetHref || resolveHttpUrl(anchor.getAttribute("href"));

    if (!resolvedUrl || isSamePageJump(resolvedUrl)) {
      return;
    }

    const adultSiteRestriction = getAdultSiteRestriction(resolvedUrl);

    if (adultSiteRestriction.blocked) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showFamilyProtectionBlock({
        currentPageRestricted: true,
        currentPageMessage: "This site is blocked for safety.",
        currentPageDetail: adultSiteRestriction.reason,
        allowBackNavigation: false,
        levelNote: getProtectionProfile().levelNote
      });
      return;
    }

    const warningKey = navigationIntent?.warningKey || buildNavigationWarningKey(resolvedUrl);
    const emailAuthFlowHandler = getEmailAuthFlowHandler();

    if (
      isNavigationApproved(warningKey) ||
      state.shownWarningKeys.has(warningKey) ||
      emailAuthFlowHandler?.isRecentlyWarned?.(resolvedUrl) ||
      emailAuthFlowHandler?.isAllowOnceTarget?.(resolvedUrl)
    ) {
      return;
    }

    const currentHost = normalizeHost(location.hostname);
    const currentRootDomain = getRootDomain(currentHost);
    const emailContext = getEmailSafetyController()?.getContext?.(currentHost, currentRootDomain) || null;
    const assessment = assessLinkElement(anchor, {
      currentHost,
      currentRootDomain
    });
    const trustedAuthNavigation =
      shouldBypassTrustedAuthWarning(assessment) ||
      Boolean(emailAuthFlowHandler?.looksLikeTrustedEmailAuthFlow?.(assessment, emailContext));
    const protectionProfile = getProtectionProfile();

    if (trustedAuthNavigation) {
      emailAuthFlowHandler?.allowOnceTarget?.(resolvedUrl, 45000);
      markNavigationApproved(warningKey, 45000);
      return;
    }

    if (assessment.score < protectionProfile.actionWarningThreshold) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const isDownload = anchor.hasAttribute("download") || assessment.isDownload;
    const guidedFlags = getLinkGuidedProtectionFlags(assessment, isDownload);
    const useGuidedProtection = shouldUseGuidedProtectionMode(
      assessment.score,
      assessment.signalCounts,
      guidedFlags
    );
    const guidedCopy = useGuidedProtection ? buildGuidedProtectionCopy(guidedFlags) : null;
    const trustCopy = buildWarningTrustCopy({
      score: assessment.score,
      isDownload,
      contextType: isDownload ? "download" : "link",
      isEmailLink:
        Boolean(emailContext) &&
        (emailContext.pageMode === "opened_message" || emailContext.pageMode === "inbox"),
      isTrustedProviderSignIn: Boolean(assessment.identitySignals.trustedAuthFlow)
    });
    const title = useGuidedProtection ? guidedCopy.title : trustCopy.title;
    const message = useGuidedProtection ? guidedCopy.message : trustCopy.message;

    emailAuthFlowHandler?.rememberWarnedTarget?.(resolvedUrl, 15000);

    showDecisionDialog({
      severity: assessment.score >= 80 ? "risk" : "high",
      title,
      message,
      reasons: useGuidedProtection ? [] : assessment.reasons.slice(0, 3),
      guidedMode: useGuidedProtection,
      score: assessment.score,
      warningKey,
      continueLabel: isDownload ? "Continue Anyway" : "Continue Anyway",
      stayLabel: "Go Back",
      onContinue: () => {
        if (assessment.identitySignals.trustedAuthFlow) {
          emailAuthFlowHandler?.allowOnceTarget?.(resolvedUrl, 45000);
        }
        markNavigationApproved(
          warningKey,
          assessment.identitySignals.trustedAuthFlow ? 45000 : 12000
        );
        resumeStoredNavigation(navigationIntent || {
          exactTargetHref: resolvedUrl,
          warningKey,
          target: anchor.target || "_self",
          rel: anchor.rel || "noopener noreferrer",
          download: anchor.hasAttribute("download") ? anchor.getAttribute("download") || "" : "",
          openInNewTab: false,
          preserveDownload: anchor.hasAttribute("download")
        });
      }
    });
    reportGuardianActivity("risky-action", {
      score: assessment.score
    });
  }

  function handleFormSubmit(event) {
    if (!state.settings.proactiveWarningsEnabled) {
      return;
    }

    const form = event.target;

    if (!(form instanceof HTMLFormElement) || form.closest("#ai-guardian-root")) {
      return;
    }

    const formAssessment = assessForm(form);
    const protectionProfile = getProtectionProfile();

    if (formAssessment.score < protectionProfile.actionWarningThreshold) {
      return;
    }

    const warningKey = `form|${formAssessment.key}`;

    if (state.approvedForms.has(warningKey) || state.shownWarningKeys.has(warningKey)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const guidedFlags = getFormGuidedProtectionFlags(formAssessment);
    const useGuidedProtection = shouldUseGuidedProtectionMode(
      formAssessment.score,
      formAssessment.signalCounts,
      guidedFlags
    );
    const guidedCopy = useGuidedProtection ? buildGuidedProtectionCopy(guidedFlags) : null;
    const trustCopy = buildWarningTrustCopy({
      score: formAssessment.score,
      contextType: "form"
    });

    showDecisionDialog({
      severity: formAssessment.score >= 80 ? "risk" : "high",
      title: useGuidedProtection
        ? guidedCopy.title
        : trustCopy.title,
      message: useGuidedProtection
        ? guidedCopy.message
        : state.settings.extraSimpleLanguageEnabled
          ? "Pause before you send your details."
          : "Please take a moment before you send your details.",
      reasons: useGuidedProtection ? [] : formAssessment.reasons.slice(0, 3),
      guidedMode: useGuidedProtection,
      score: formAssessment.score,
      warningKey,
      continueLabel: "Continue Anyway",
      stayLabel: "Go Back",
      onContinue: () => {
        state.approvedForms.add(warningKey);
        HTMLFormElement.prototype.submit.call(form);
      }
    });
    reportGuardianActivity("risky-action", {
      score: formAssessment.score
    });
  }

  function assessForm(form) {
    const currentHost = normalizeHost(location.hostname);
    const currentRootDomain = getRootDomain(currentHost);
    const actionUrl = form.getAttribute("action") || location.href;
    const actionAssessment = assessUrl(actionUrl, {
      currentHost,
      currentRootDomain
    });
    const fieldInfo = describeFormFields(form);
    const reasons = [];
    const signalCounts = {
      moderate: actionAssessment.signalCounts.moderate,
      strong: actionAssessment.signalCounts.strong
    };
    let score = Math.max(actionAssessment.score, state.currentReport ? state.currentReport.score : 0);

    if (fieldInfo.passwordCount > 0) {
      if (actionAssessment.signalCounts.strong > 0 || (state.currentReport && state.currentReport.score >= 40)) {
        score += 10;
        signalCounts.moderate += 1;
        reasons.push("This form asks for a password on a page that needs extra care.");
      } else {
        score += 3;
        reasons.push("This form asks for a password.");
      }
    }

    if (fieldInfo.privateCount > 0) {
      const needsExtraCare =
        actionAssessment.signalCounts.strong > 0 ||
        actionAssessment.signalCounts.moderate >= 2 ||
        (state.currentReport && state.currentReport.score >= 40);

      score += fieldInfo.privateCount >= 3 ? (needsExtraCare ? 10 : 6) : needsExtraCare ? 6 : 4;

      if (needsExtraCare) {
        signalCounts.moderate += 1;
      }

      reasons.push(`This form asks for details like ${formatQuotedExamples(fieldInfo.privateExamples)}.`);
    }

    if (actionAssessment.signalCounts.strong > 0 || actionAssessment.signalCounts.moderate >= 2) {
      reasons.push(actionAssessment.reasons[0] || "The form destination may need extra care.");
    }

    if ((form.method || "get").toLowerCase() === "get" && fieldInfo.privateCount > 0) {
      score += 10;
      signalCounts.strong += 1;
      reasons.push("This form may place personal details into the address bar.");
    }

    score = applyRiskGuardrails(score, signalCounts, {
      trusted: actionAssessment.trusted,
      isEduDomain: actionAssessment.isEduDomain,
      sameSiteLevel: actionAssessment.sameSiteLevel
    });

    const requestsPaymentDetails =
      fieldInfo.privateExamples.includes("card number") ||
      fieldInfo.privateExamples.includes("card code") ||
      fieldInfo.privateExamples.includes("bank details");

    return {
      key: `${actionAssessment.cleanedUrl}|${fieldInfo.passwordCount}|${fieldInfo.privateCount}`,
      score,
      reasons: uniqueList(reasons),
      signalCounts,
      riskContext: {
        asksForPassword: fieldInfo.passwordCount > 0,
        asksForPersonalInfo: fieldInfo.privateCount > 0,
        asksForPaymentDetails: requestsPaymentDetails,
        suspiciousDestination:
          actionAssessment.signalCounts.strong > 0 || actionAssessment.signalCounts.moderate >= 2,
        unusualAddress:
          Boolean(actionAssessment.identitySignals.lookalikeBrand) ||
          actionAssessment.identitySignals.usesIpAddress ||
          actionAssessment.identitySignals.usesEncodedHost ||
          actionAssessment.identitySignals.suspiciousTld ||
          actionAssessment.identitySignals.unusualPort,
        connectionConcern: actionAssessment.identitySignals.protocol !== "https:",
        pushyPage: Boolean(
          state.currentReport &&
            state.currentReport.reasons.some((reason) => reason.toLowerCase().includes("pushy"))
        )
      }
    };
  }

  function maybeShowPageWarning(report) {
    if (!state.settings.proactiveWarningsEnabled) {
      return;
    }

    const protectionProfile = getProtectionProfile();
    const guidedFlags = getPageGuidedProtectionFlags(report);
    const useGuidedProtection = shouldUseGuidedProtectionMode(
      report.score,
      {
        strong: report.strongSignalCount,
        moderate: report.moderateSignalCount
      },
      guidedFlags
    );
    const guidedCopy = useGuidedProtection ? buildGuidedProtectionCopy(guidedFlags) : null;

    if (report.autoWarningEligible && state.pageWarningLevelShown < protectionProfile.autoPageWarningThreshold) {
      state.pageWarningLevelShown = protectionProfile.autoPageWarningThreshold;
      const trustCopy = buildWarningTrustCopy({
        score: report.score,
        contextType: "page"
      });
      showDecisionDialog({
        severity: "risk",
        title: useGuidedProtection ? guidedCopy.title : trustCopy.title,
        message: useGuidedProtection
          ? guidedCopy.message
          : state.settings.extraSimpleLanguageEnabled
            ? "Pause before you sign in, download anything, or share your details."
            : "Take a moment before you sign in, download anything, or share your details.",
        reasons: useGuidedProtection ? [] : report.reasons.slice(0, 3),
        guidedMode: useGuidedProtection,
        score: report.score,
        continueLabel: "Continue Anyway",
        stayLabel: "Go Back",
        onContinue: () => {},
        onStay: () => {
          if (history.length > 1) {
            history.back();
          }
        }
      });
    }
  }

  function syncFamilyProtectionBlock(report) {
    if (!report?.familyProtection?.currentPageRestricted) {
      hideFamilyProtectionBlock();
      return;
    }

    showFamilyProtectionBlock(report.familyProtection);
  }

  function showFamilyProtectionBlock(familyProtection) {
    if (
      !state.familyRoot ||
      !state.familyBlock ||
      !state.familyBlockTitle ||
      !state.familyBlockMessage ||
      !state.familyBlockNote ||
      !state.familyBlockLearnMore
    ) {
      return;
    }

    state.activeFamilyRestriction = familyProtection;
    hideDecisionDialog();
    hidePageBanner();

    if (state.familyBlockState) {
      state.familyBlockState.textContent = familyProtection.levelLabel || "Restricted page";
    }
    state.familyBlockTitle.textContent = "This site is blocked for safety.";
    state.familyBlockMessage.textContent =
      familyProtection.currentPageDetail ||
      "Adult site blocking is turned on for this browser.";
    state.familyBlockNote.textContent =
      familyProtection.levelNote || getProtectionProfile().levelNote;
    state.familyBlockLearnMore.textContent =
      Array.isArray(familyProtection.currentPageReasons) && familyProtection.currentPageReasons.length > 0
        ? familyProtection.currentPageReasons.join(" ")
        : "Guardian Family Protection blocks explicit adult websites and keeps the message simple and respectful.";
    state.familyBlockLearnMore.hidden = true;
    state.familyRoot.classList.add("ai-guardian-family-open");
    state.familyBlock.hidden = false;
    sendTabUiStateToBackground();

    if (state.root) {
      state.root.hidden = true;
    }

    if (state.familyGoBackButton) {
      state.familyGoBackButton.focus();
    }
  }

  function hideFamilyProtectionBlock() {
    state.activeFamilyRestriction = null;

    if (state.familyRoot) {
      state.familyRoot.classList.remove("ai-guardian-family-open");
    }

    if (state.familyBlock) {
      state.familyBlock.hidden = true;
    }

    if (state.root) {
      state.root.hidden = false;
      state.indicator.hidden = !state.settings.floatingBadgeEnabled;
    }

    sendTabUiStateToBackground();
  }

  function handleGuardianSlowdownPrompt(message) {
    if (
      !state.settings.labyrinthModeEnabled ||
      !state.settings.proactiveWarningsEnabled ||
      state.activeFamilyRestriction
    ) {
      return;
    }

    const warningKey = `guardian|${Date.now()}`;

    showDecisionDialog({
      severity: "high",
      guidedMode: true,
      title: message.title || "Let's slow down for a second",
      message:
        message.message ||
        "A short pause can help before the next page or click.",
      reasons: [],
      warningKey,
      stayLabel: "Go Back",
      continueLabel: "Continue Anyway",
      onStay: () => {
        if (history.length > 1) {
          history.back();
        }
      },
      onContinue: () => {}
    });
  }

  function reportGuardianActivity(activityType, details = {}) {
    safeRuntimeSendMessage({
      type: "REPORT_GUARDIAN_ACTIVITY",
      activityType,
      domain: state.currentReport?.domain || location.hostname,
      score: Number(details.score || state.currentReport?.score || 0)
    });
  }

  function showPageBanner(report) {
    state.banner.innerHTML = "";
    state.banner.className = `ai-guardian-banner ai-guardian-${report.band}`;

    const title = document.createElement("p");
    title.className = "ai-guardian-banner-title";
    title.textContent = `${report.score} ${report.label}`;

    const message = document.createElement("p");
    message.className = "ai-guardian-banner-text";
    message.textContent = report.advice;

    const buttonRow = document.createElement("div");
    buttonRow.className = "ai-guardian-banner-buttons";

    const learnButton = document.createElement("button");
    learnButton.type = "button";
    learnButton.className = "ai-guardian-banner-button ai-guardian-banner-button-secondary";
    learnButton.textContent = "Learn Why";
    learnButton.addEventListener("click", () => {
      openDetailsPanel();
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "ai-guardian-banner-button";
    closeButton.textContent = "Okay";
    closeButton.addEventListener("click", () => {
      hidePageBanner();
    });

    state.banner.appendChild(title);
    state.banner.appendChild(message);
    buttonRow.appendChild(learnButton);
    buttonRow.appendChild(closeButton);
    state.banner.appendChild(buttonRow);
    state.banner.hidden = false;

    window.clearTimeout(state.pageBannerTimer);
    state.pageBannerTimer = window.setTimeout(() => {
      hidePageBanner();
    }, 10000);
  }

  function hidePageBanner() {
    window.clearTimeout(state.pageBannerTimer);
    state.banner.hidden = true;
  }

  function handleDecisionStay(options) {
    reportGuardianActivity("warning-dismissed", {
      score: options?.score || state.currentReport?.score || 0
    });
    hideDecisionDialog();

    if (typeof options?.onStay === "function") {
      options.onStay();
    }
  }

  function showDecisionDialog(options) {
    console.debug("[AI Guardian] Warning modal rendered.", {
      severity: options.severity || "high",
      title: options.title
    });
    console.debug("[AI Guardian] Warning modal buttons found.", {
      stay: Boolean(state.stayButton),
      learn: Boolean(state.learnButton),
      continue: Boolean(state.continueButton)
    });

    if (!state.dialog || !state.dialogTitle || !state.dialogMessage || !state.dialogReasons || !state.stayButton || !state.learnButton || !state.continueButton) {
      console.debug("[AI Guardian] Warning modal could not attach because required elements were missing.");
      return;
    }

    const reasons = Array.isArray(options.reasons) ? options.reasons : [];
    const isGuidedMode = Boolean(options.guidedMode);

    state.overlay.className = `ai-guardian-overlay ai-guardian-${options.severity || "high"}`;
    state.dialog.classList.toggle("ai-guardian-dialog-guided", isGuidedMode);
    state.dialogTitle.textContent = options.title;
    state.dialogMessage.textContent = options.message;
    state.dialogReasons.innerHTML = "";
    state.dialogReasons.hidden = isGuidedMode || reasons.length === 0;
    state.activeDecisionOptions = options;
    if (options.warningKey) {
      state.shownWarningKeys.add(options.warningKey);
    }

    reasons.forEach((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      state.dialogReasons.appendChild(item);
    });

    state.stayButton.textContent = options.stayLabel || "Stay here";
    state.stayButton.setAttribute(
      "aria-label",
      isGuidedMode
        ? `${state.stayButton.textContent}. Recommended safer option.`
        : state.stayButton.textContent
    );
    state.continueButton.textContent = options.continueLabel || "Continue";
    state.continueButton.setAttribute("aria-label", state.continueButton.textContent);
    state.learnButton.setAttribute("aria-label", "Learn why this warning showed");

    console.debug("[AI Guardian] Warning modal listeners attached.");
    state.dialog.setAttribute("aria-label", options.title);
    state.modalRoot.classList.add("ai-guardian-modal-open");
    state.overlay.hidden = false;
    sendTabUiStateToBackground();
    state.stayButton.focus();
  }

  function hideDecisionDialog() {
    if (state.modalRoot) {
      state.modalRoot.classList.remove("ai-guardian-modal-open");
    }

    state.activeDecisionOptions = null;
    state.overlay.hidden = true;
    sendTabUiStateToBackground();
  }

  function resumeStoredNavigation(navigationIntent) {
    if (!navigationIntent?.exactTargetHref) {
      return;
    }

    if (!navigationIntent.openInNewTab && !navigationIntent.preserveDownload && navigationIntent.target === "_self") {
      window.location.assign(navigationIntent.exactTargetHref);
      return;
    }

    const tempLink = document.createElement("a");

    tempLink.href = navigationIntent.exactTargetHref;
    tempLink.target = navigationIntent.target || "";
    tempLink.rel = navigationIntent.rel || "noopener noreferrer";

    if (navigationIntent.preserveDownload) {
      tempLink.download = navigationIntent.download || "";
    }

    tempLink.style.display = "none";
    document.body.appendChild(tempLink);
    tempLink.click();
    tempLink.remove();
  }

  function getAssistantMountTarget() {
    return document.body;
  }

  function createAssistantUi() {
    const root = document.createElement("div");
    root.id = "ai-guardian-root";
    const modalRoot = document.createElement("div");
    modalRoot.id = "ai-guardian-modal-root";
    const familyRoot = document.createElement("div");
    familyRoot.id = "ai-guardian-family-root";

    const indicator = document.createElement("div");
    indicator.className = "ai-guardian-indicator ai-guardian-safe";
    indicator.innerHTML = `
      <button type="button" class="ai-guardian-indicator-main">
        <div class="ai-guardian-indicator-mark">
          <svg viewBox="0 0 64 64" class="ai-guardian-mark-icon" focusable="false" aria-hidden="true">
            <defs>
              <linearGradient id="pageShieldFill" x1="22" y1="12" x2="42" y2="51" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#2a6f86" />
                <stop offset="1" stop-color="#12384e" />
              </linearGradient>
            </defs>
            <path
              d="M32 12L43 15.5C45.5 16.3 47 17.9 47 20V29C47 38.5 41 45 32 51C23 45 17 38.5 17 29V20C17 17.9 18.5 16.3 21 15.5L32 12Z"
              fill="url(#pageShieldFill)"
              stroke="#9be5d0"
              stroke-width="2"
              stroke-linejoin="round"
            />
            <path
              d="M21 33H26L29 26L33 39L36.5 30H42"
              fill="none"
              stroke="#f4fffc"
              stroke-width="3.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="43.3" cy="23.3" r="2.4" fill="#88d7c1" />
          </svg>
        </div>
        <div class="ai-guardian-indicator-copy">
          <div class="ai-guardian-indicator-score" id="ai-guardian-score-value">0</div>
          <div class="ai-guardian-indicator-label" id="ai-guardian-score-label">Looks safe</div>
        </div>
      </button>
      <button type="button" class="ai-guardian-indicator-toggle" aria-label="Collapse the floating badge">
        Hide
      </button>
    `;

    const banner = document.createElement("div");
    banner.className = "ai-guardian-banner";
    banner.hidden = true;

    const overlay = document.createElement("div");
    overlay.className = "ai-guardian-overlay";
    overlay.hidden = true;
    const dialog = document.createElement("div");
    dialog.className = "ai-guardian-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;

    const dialogTitle = document.createElement("p");
    dialogTitle.className = "ai-guardian-dialog-title";

    const dialogMessage = document.createElement("p");
    dialogMessage.className = "ai-guardian-dialog-message";

    const dialogReasons = document.createElement("ul");
    dialogReasons.className = "ai-guardian-dialog-reasons";

    const dialogButtons = document.createElement("div");
    dialogButtons.className = "ai-guardian-dialog-buttons";

    const stayButton = document.createElement("button");
    stayButton.type = "button";
    stayButton.className = "ai-guardian-stay-button";
    stayButton.textContent = "Go Back";

    const learnButton = document.createElement("button");
    learnButton.type = "button";
    learnButton.className = "ai-guardian-learn-button";
    learnButton.textContent = "Learn Why";

    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.className = "ai-guardian-continue-button";
    continueButton.textContent = "Continue Anyway";

    const familyBlock = document.createElement("div");
    familyBlock.className = "ai-guardian-family-block";
    familyBlock.hidden = true;
    familyBlock.setAttribute("role", "dialog");
    familyBlock.setAttribute("aria-modal", "true");
    familyBlock.setAttribute("aria-label", "This site is blocked for safety.");

    const familyCard = document.createElement("div");
    familyCard.className = "ai-guardian-family-card";

    const familyTop = document.createElement("div");
    familyTop.className = "ai-guardian-family-top";

    const familyMark = document.createElement("div");
    familyMark.className = "ai-guardian-family-mark";
    familyMark.setAttribute("aria-hidden", "true");
    familyMark.innerHTML = `
      <svg viewBox="0 0 64 64" focusable="false">
        <defs>
          <linearGradient id="familyShieldFill" x1="22" y1="12" x2="42" y2="51" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#2a6f86" />
            <stop offset="1" stop-color="#12384e" />
          </linearGradient>
        </defs>
        <path
          d="M32 12L43 15.5C45.5 16.3 47 17.9 47 20V29C47 38.5 41 45 32 51C23 45 17 38.5 17 29V20C17 17.9 18.5 16.3 21 15.5L32 12Z"
          fill="url(#familyShieldFill)"
          stroke="#9be5d0"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path
          d="M21 33H26L29 26L33 39L36.5 30H42"
          fill="none"
          stroke="#f4fffc"
          stroke-width="3.25"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="43.3" cy="23.3" r="2.4" fill="#88d7c1" />
      </svg>
    `;

    const familyHeader = document.createElement("div");
    familyHeader.className = "ai-guardian-family-header";

    const familyEyebrow = document.createElement("p");
    familyEyebrow.className = "ai-guardian-family-eyebrow";
    familyEyebrow.textContent = "Guardian Family Protection";

    const familyState = document.createElement("p");
    familyState.className = "ai-guardian-family-state";
    familyState.textContent = "Restricted page";

    const familyTitle = document.createElement("p");
    familyTitle.className = "ai-guardian-family-title";

    const familyMessage = document.createElement("p");
    familyMessage.className = "ai-guardian-family-message";

    const familyNote = document.createElement("p");
    familyNote.className = "ai-guardian-family-note";

    const familyLearnMore = document.createElement("p");
    familyLearnMore.className = "ai-guardian-family-learn-more";
    familyLearnMore.hidden = true;
    familyLearnMore.textContent =
      "Guardian Family Protection blocks explicit adult websites and keeps the message simple and respectful.";

    const familyButtons = document.createElement("div");
    familyButtons.className = "ai-guardian-family-buttons";

    const familyGoBackButton = document.createElement("button");
    familyGoBackButton.type = "button";
    familyGoBackButton.className = "ai-guardian-family-go-back";
    familyGoBackButton.textContent = "Go Back";

    const familyLearnMoreButton = document.createElement("button");
    familyLearnMoreButton.type = "button";
    familyLearnMoreButton.className = "ai-guardian-family-learn";
    familyLearnMoreButton.textContent = "Learn More";

    familyHeader.appendChild(familyEyebrow);
    familyHeader.appendChild(familyState);
    familyTop.appendChild(familyMark);
    familyTop.appendChild(familyHeader);
    familyButtons.appendChild(familyGoBackButton);
    familyButtons.appendChild(familyLearnMoreButton);
    familyCard.appendChild(familyTop);
    familyCard.appendChild(familyTitle);
    familyCard.appendChild(familyMessage);
    familyCard.appendChild(familyNote);
    familyCard.appendChild(familyLearnMore);
    familyCard.appendChild(familyButtons);
    familyBlock.appendChild(familyCard);

    dialogButtons.appendChild(stayButton);
    dialogButtons.appendChild(learnButton);
    dialogButtons.appendChild(continueButton);
    dialog.appendChild(dialogTitle);
    dialog.appendChild(dialogMessage);
    dialog.appendChild(dialogReasons);
    dialog.appendChild(dialogButtons);
    overlay.appendChild(dialog);

    overlay.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target || target === overlay) {
        console.debug("[AI Guardian] Warning modal overlay clicked.");
        handleDecisionStay(state.activeDecisionOptions);
      }
    });

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        console.debug("[AI Guardian] Warning modal Escape pressed.");
        handleDecisionStay(state.activeDecisionOptions);
      }
    });

    stayButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.debug("[AI Guardian] Warning modal Go Back clicked.");
      handleDecisionStay(state.activeDecisionOptions);
    });

    learnButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.debug("[AI Guardian] Warning modal Learn Why clicked.");
      hideDecisionDialog();
      openDetailsPanel();
    });

    continueButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.debug("[AI Guardian] Warning modal Continue Anyway clicked.");
      const options = state.activeDecisionOptions;
      reportGuardianActivity("warning-continued", {
        score: options?.score || state.currentReport?.score || 0
      });
      hideDecisionDialog();

      if (typeof options?.onContinue === "function") {
        options.onContinue();
      }
    });

    familyGoBackButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const restriction = state.activeFamilyRestriction;
      hideFamilyProtectionBlock();

      if (restriction?.allowBackNavigation && history.length > 1) {
        history.back();
      } else if (restriction?.allowBackNavigation) {
        location.replace("about:blank");
      }
    });

    familyLearnMoreButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      familyLearnMore.hidden = !familyLearnMore.hidden;
    });

    root.appendChild(indicator);
    root.appendChild(banner);
    getAssistantMountTarget().appendChild(root);
    modalRoot.appendChild(overlay);
    getAssistantMountTarget().appendChild(modalRoot);
    familyRoot.appendChild(familyBlock);
    getAssistantMountTarget().appendChild(familyRoot);

    state.indicator = indicator;
    state.indicatorToggle = root.querySelector(".ai-guardian-indicator-toggle");
    state.scoreValue = root.querySelector("#ai-guardian-score-value");
    state.scoreLabel = root.querySelector("#ai-guardian-score-label");
    state.overlay = overlay;
    state.dialog = dialog;
    state.dialogTitle = dialogTitle;
    state.dialogMessage = dialogMessage;
    state.dialogReasons = dialogReasons;
    state.stayButton = stayButton;
    state.learnButton = learnButton;
    state.continueButton = continueButton;
    state.modalRoot = modalRoot;
    state.familyRoot = familyRoot;
    state.familyBlock = familyBlock;
    state.familyBlockState = familyState;
    state.familyBlockTitle = familyTitle;
    state.familyBlockMessage = familyMessage;
    state.familyBlockNote = familyNote;
    state.familyBlockLearnMore = familyLearnMore;
    state.familyGoBackButton = familyGoBackButton;
    state.familyLearnMoreButton = familyLearnMoreButton;
    state.banner = banner;
    state.root = root;

    root.querySelector(".ai-guardian-indicator-main").addEventListener("click", (event) => {
      if (state.indicatorCollapsed) {
        event.preventDefault();
        event.stopPropagation();
        setFloatingIndicatorCollapsed(false);
        return;
      }

      openDetailsPanel();
    });

    state.indicator.addEventListener("click", (event) => {
      if (!state.indicatorCollapsed) {
        return;
      }

      if (event.target === state.indicator) {
        event.preventDefault();
        event.stopPropagation();
        setFloatingIndicatorCollapsed(false);
      }
    });

    state.indicatorToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFloatingIndicatorCollapsed();
    });

    syncFloatingIndicatorState();
  }

  function updateFloatingIndicator(report) {
    state.indicator.className = `ai-guardian-indicator ai-guardian-${report.band}`;
    state.scoreValue.textContent = String(report.score);
    state.scoreLabel.textContent = report.label;
    const indicatorMain = state.indicator.querySelector(".ai-guardian-indicator-main");

    indicatorMain.setAttribute(
      "aria-label",
      `AI Guardian score ${report.score}. ${report.label}. ${report.summary}. Open details.`
    );

    state.indicator.hidden = !state.settings.floatingBadgeEnabled;
    syncFloatingIndicatorState();
  }

  function showPendingFloatingIndicator() {
    if (!state.indicator || !state.scoreValue || !state.scoreLabel) {
      return;
    }

    state.indicator.className = "ai-guardian-indicator ai-guardian-unknown";
    state.scoreValue.textContent = "--";
    state.scoreLabel.textContent = "Scanning";
    state.indicator.hidden = !state.settings.floatingBadgeEnabled;

    const indicatorMain = state.indicator.querySelector(".ai-guardian-indicator-main");

    if (indicatorMain) {
      indicatorMain.setAttribute("aria-label", "AI Guardian is scanning the new page.");
    }

    syncFloatingIndicatorState();
  }

  function toggleFloatingIndicatorCollapsed() {
    setFloatingIndicatorCollapsed(!state.indicatorCollapsed);
  }

  function setFloatingIndicatorCollapsed(isCollapsed) {
    state.indicatorCollapsed = Boolean(isCollapsed);
    syncFloatingIndicatorState();
    sendTabUiStateToBackground();
  }

  function syncFloatingIndicatorState() {
    if (!state.indicator || !state.indicatorToggle) {
      return;
    }

    state.indicator.classList.toggle("ai-guardian-indicator-collapsed", state.indicatorCollapsed);
    state.indicator.classList.toggle("ai-guardian-indicator-expanded", !state.indicatorCollapsed);
    state.indicator.setAttribute("data-state", state.indicatorCollapsed ? "collapsed" : "expanded");
    state.indicatorToggle.textContent = state.indicatorCollapsed ? "Show" : "Hide";
    state.indicatorToggle.hidden = state.indicatorCollapsed;
    state.indicatorToggle.setAttribute("aria-expanded", String(!state.indicatorCollapsed));
    state.indicatorToggle.setAttribute(
      "aria-label",
      state.indicatorCollapsed ? "Show the full floating badge" : "Hide the extra floating badge details"
    );

    if (state.currentReport) {
      const indicatorMain = state.indicator.querySelector(".ai-guardian-indicator-main");
      indicatorMain.setAttribute(
        "aria-label",
        state.indicatorCollapsed
          ? `AI Guardian score ${state.currentReport.score}. ${state.currentReport.label}. Open the floating badge.`
          : `AI Guardian score ${state.currentReport.score}. ${state.currentReport.label}. ${state.currentReport.summary}. Open details.`
      );
    }
  }

  function clearSearchBadges() {
    document.querySelectorAll(".ai-guardian-gsr-slot, .ai-guardian-gsr-badge-wrap").forEach((badgeNode) => {
      badgeNode.remove();
    });
  }

  function openDetailsPanel() {
    safeRuntimeSendMessage({
      type: "OPEN_DETAILS_PANEL"
    });
  }

  function sendReportToBackground(report) {
    safeRuntimeSendMessage({
      type: "PAGE_REPORT_UPDATE",
      report
    });
  }

  function createEmailPreviewSignature(preview) {
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

  function syncEmailPreviewQuietly(preview) {
    if (!state.currentReport || state.currentReport.pageUrl !== location.href) {
      return;
    }

    const currentSignature = createEmailPreviewSignature(state.currentReport.emailSafetyPreview);
    const nextSignature = createEmailPreviewSignature(preview);

    if (currentSignature === nextSignature) {
      return;
    }

    state.currentReport = {
      ...state.currentReport,
      emailSafetyPreview: preview
    };
    state.lastReportSignature = createReportSignature(state.currentReport);
    sendReportToBackground(state.currentReport);
  }

  function clearTabPageStateInBackground() {
    safeRuntimeSendMessage({
      type: "CLEAR_TAB_PAGE_STATE"
    });
  }

  function sendTabUiStateToBackground() {
    const reportMatchesCurrentPage = state.currentReport?.pageUrl === location.href;

    safeRuntimeSendMessage({
      type: "TAB_UI_STATE_UPDATE",
      uiState: {
        pageUrl: location.href,
        indicatorCollapsed: Boolean(state.indicatorCollapsed),
        pageWarningLevelShown: Number(state.pageWarningLevelShown || 0),
        warningOpen: Boolean(state.activeDecisionOptions),
        familyBlockOpen: Boolean(state.activeFamilyRestriction),
        score: reportMatchesCurrentPage && typeof state.currentReport?.score === "number"
          ? state.currentReport.score
          : null,
        label: reportMatchesCurrentPage ? state.currentReport?.label || "" : ""
      }
    });
  }

  function safeRuntimeSendMessage(message) {
    try {
      if (!chrome?.runtime?.id || typeof chrome.runtime.sendMessage !== "function") {
        return null;
      }

      const pendingMessage = chrome.runtime.sendMessage(message);

      if (pendingMessage && typeof pendingMessage.catch === "function") {
        pendingMessage.catch(() => {
          // The page can still work even if the extension is reloading or sleeping.
        });
      }

      return pendingMessage;
    } catch (error) {
      return null;
    }
  }

  function decorateGoogleResults() {
    const candidates = getPrimaryGoogleSearchCandidates();
    const currentHost = normalizeHost(location.hostname);
    const currentRootDomain = getRootDomain(currentHost);
    const activeBadgeSlots = new Set();

    candidates.forEach(({ anchor, heading }) => {
      const rawUrl = anchor.getAttribute("href") || anchor.href;
      const resolvedUrl = resolveHttpUrl(rawUrl);

      if (!resolvedUrl) {
        return;
      }

      const badgeSlot = ensureGoogleSearchBadgeSlot(anchor, heading);

      if (!badgeSlot) {
        return;
      }

      activeBadgeSlots.add(badgeSlot);

      const existingBadgeWrap = getExistingGoogleSearchBadge(badgeSlot);
      const assessment = assessUrl(resolvedUrl, {
        currentHost,
        currentRootDomain
      });
      const identityPreview = buildSearchResultIdentityPreview(anchor, heading, assessment);
      const badgeText = `${assessment.label} ${assessment.score}`;
      const badgeReason = buildSearchResultBadgeDescription(assessment, identityPreview);

      if (existingBadgeWrap) {
        updateGoogleSearchBadge(existingBadgeWrap, assessment.band, badgeText, badgeReason, identityPreview);
        return;
      }

      const badgeWrap = createGoogleSearchBadge(assessment.band, badgeText, badgeReason, identityPreview);
      badgeSlot.replaceChildren(badgeWrap);
    });

    document.querySelectorAll(".ai-guardian-gsr-slot").forEach((badgeSlot) => {
      if (!activeBadgeSlots.has(badgeSlot)) {
        badgeSlot.remove();
      }
    });
  }

  function getPrimaryGoogleSearchCandidates() {
    const seenOwners = new Set();
    const headings = Array.from(document.querySelectorAll("#search a[href] h3"));

    return headings
      .map((heading) => {
        const anchor = heading.closest("a[href]");

        if (!anchor || !isPrimaryGoogleSearchHeading(anchor, heading, seenOwners)) {
          return null;
        }

        const owner = getGooglePrimaryResultOwner(anchor, heading);

        if (!owner || seenOwners.has(owner)) {
          return null;
        }

        seenOwners.add(owner);
        return { anchor, heading };
      })
      .filter(Boolean);
  }

  function getGooglePrimaryResultOwner(anchor, heading) {
    const ownerSelectors = [
      "div.MjjYud",
      "div.Gx5Zad",
      "div.g",
      "div[data-snc]"
    ];

    for (const selector of ownerSelectors) {
      const owner = heading.closest(selector) || anchor.closest(selector);

      if (owner instanceof HTMLElement && owner.closest("#search")) {
        return owner;
      }
    }

    return getGoogleSearchBadgeHost(anchor, heading);
  }

  function isPrimaryGoogleSearchHeading(anchor, heading, seenOwners = new Set()) {
    if (!(heading instanceof HTMLElement) || !(anchor instanceof HTMLAnchorElement)) {
      return false;
    }

    if (!isVisibleElement(anchor) || !isVisibleElement(heading) || heading.closest(".ai-guardian-gsr-slot")) {
      return false;
    }

    const owner = getGooglePrimaryResultOwner(anchor, heading);

    if (!(owner instanceof HTMLElement) || seenOwners.has(owner)) {
      return false;
    }

    const firstVisibleHeading = Array.from(owner.querySelectorAll("a[href] h3")).find((candidate) => {
      if (!(candidate instanceof HTMLElement)) {
        return false;
      }

      const candidateAnchor = candidate.closest("a[href]");
      return candidateAnchor instanceof HTMLAnchorElement && isVisibleElement(candidateAnchor) && isVisibleElement(candidate);
    });

    return firstVisibleHeading === heading;
  }

  function getExistingGoogleSearchBadge(slot) {
    if (!(slot instanceof HTMLElement)) {
      return null;
    }

    const badgeWrap = slot.firstElementChild;
    return badgeWrap instanceof HTMLElement && badgeWrap.classList.contains("ai-guardian-gsr-badge-wrap")
      ? badgeWrap
      : null;
  }

  function ensureGoogleSearchBadgeSlot(anchor, heading) {
    const placement = getGoogleSearchBadgePlacement(anchor, heading);

    if (!placement) {
      return null;
    }

    const { host, reference } = placement;
    const existingSlot = getExistingGoogleSearchBadgeSlot(host, reference);

    if (existingSlot) {
      return existingSlot;
    }

    const badgeSlot = document.createElement("div");
    badgeSlot.className = "ai-guardian-gsr-slot";
    badgeSlot.setAttribute("dir", "ltr");
    badgeSlot.setAttribute("role", "presentation");

    if (reference && reference.parentElement === host) {
      reference.insertAdjacentElement("afterend", badgeSlot);
      return badgeSlot;
    }

    host.appendChild(badgeSlot);
    return badgeSlot;
  }

  function getExistingGoogleSearchBadgeSlot(host, reference) {
    if (!(host instanceof HTMLElement)) {
      return null;
    }

    if (reference instanceof HTMLElement) {
      const sibling = reference.nextElementSibling;

      if (sibling && sibling.classList.contains("ai-guardian-gsr-slot")) {
        return sibling;
      }
    }

    const directSlot = Array.from(host.children).find((child) => child.classList.contains("ai-guardian-gsr-slot"));
    return directSlot instanceof HTMLElement ? directSlot : null;
  }

  function getGoogleSearchBadgePlacement(anchor, heading) {
    const host = getGoogleSearchBadgeHost(anchor, heading);

    if (!host) {
      return null;
    }

    return {
      host,
      reference: getGoogleSearchBadgeReference(host, anchor, heading)
    };
  }

  function getGoogleSearchBadgeHost(anchor, heading) {
    const preferredSelectors = [
      "div[data-snc]",
      "div.yuRUbf",
      "div.N54PNb",
      "div.MjjYud",
      "div.g",
      "div.Gx5Zad"
    ];

    for (const selector of preferredSelectors) {
      const preferredHost = heading.closest(selector) || anchor.closest(selector);

      if (isSafeGoogleBadgeNode(preferredHost)) {
        return preferredHost;
      }
    }

    let ancestor = anchor.parentElement;

    while (ancestor && ancestor.id !== "search") {
      if (isSafeGoogleBadgeNode(ancestor)) {
        return ancestor;
      }

      ancestor = ancestor.parentElement;
    }

    return null;
  }

  function getGoogleSearchBadgeReference(host, anchor, heading) {
    const preferredStarts = [
      heading.parentElement,
      anchor.parentElement,
      heading,
      anchor
    ].filter((candidate) => candidate instanceof HTMLElement);

    for (const start of preferredStarts) {
      let current = start;

      while (current && current.parentElement && current.parentElement !== host) {
        current = current.parentElement;
      }

      if (current && current.parentElement === host && isSafeGoogleBadgeNode(current)) {
        return current;
      }
    }

    return null;
  }

  function isSafeGoogleBadgeNode(element) {
    if (!(element instanceof HTMLElement) || !element.closest("#search")) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const display = style.display || "";
    const writingMode = style.writingMode || "";
    const direction = style.direction || "";
    const transform = style.transform || "";
    const rotate = style.rotate || "";
    const scale = style.scale || "";
    const visibility = style.visibility || "";
    const overflowY = style.overflowY || "";
    const overflowX = style.overflowX || "";

    const isDisplaySafe = ["block", "flex", "grid", "inline-block", "inline-flex"].includes(display);
    const isWritingSafe = writingMode === "horizontal-tb";
    const isDirectionSafe = direction === "ltr";
    const isTransformSafe = transform === "none" && (rotate === "none" || rotate === "0deg") && (scale === "none" || scale === "1");
    const isVisible = visibility !== "hidden";
    const isOverflowSafe = overflowY !== "hidden" && overflowX !== "hidden";

    return isDisplaySafe && isWritingSafe && isDirectionSafe && isTransformSafe && isVisible && isOverflowSafe;
  }

  function createGoogleSearchBadge(band, badgeText, badgeReason, identityPreview) {
    const badgeWrap = document.createElement("div");
    badgeWrap.className = `ai-guardian-gsr-badge-wrap ai-guardian-gsr-${band}`;
    badgeWrap.setAttribute("role", "note");
    badgeWrap.setAttribute("dir", "ltr");
    badgeWrap.setAttribute("aria-label", `${badgeText}. ${badgeReason}`);
    badgeWrap.title = badgeReason;

    const badgeChip = document.createElement("span");
    badgeChip.className = "ai-guardian-gsr-badge-chip";

    const badgeTextNode = document.createElement("span");
    badgeTextNode.className = "ai-guardian-gsr-badge-text";
    badgeTextNode.textContent = badgeText;

    const identityNode = document.createElement("span");
    identityNode.className = "ai-guardian-gsr-identity-chip";

    badgeChip.appendChild(badgeTextNode);
    badgeWrap.appendChild(badgeChip);
    badgeWrap.appendChild(identityNode);
    updateGoogleSearchBadge(badgeWrap, band, badgeText, badgeReason, identityPreview);

    return badgeWrap;
  }

  function updateGoogleSearchBadge(badgeWrap, band, badgeText, badgeReason, identityPreview) {
    const badgeTextNode = badgeWrap.querySelector(".ai-guardian-gsr-badge-text");
    let identityNode = badgeWrap.querySelector(".ai-guardian-gsr-identity-chip");

    if (!identityNode) {
      identityNode = document.createElement("span");
      identityNode.className = "ai-guardian-gsr-identity-chip";
      badgeWrap.appendChild(identityNode);
    }

    badgeWrap.className = `ai-guardian-gsr-badge-wrap ai-guardian-gsr-${band}`;
    badgeWrap.setAttribute("dir", "ltr");
    badgeWrap.setAttribute("aria-label", `${badgeText}. ${badgeReason}`);
    badgeWrap.title = badgeReason;

    if (badgeTextNode) {
      badgeTextNode.textContent = badgeText;
    }

    identityNode.textContent = identityPreview?.headline || "Address looks consistent";
    identityNode.dataset.status = identityPreview?.status || "neutral";

    if (identityPreview?.detail) {
      identityNode.setAttribute("aria-label", identityPreview.detail);
      identityNode.title = identityPreview.detail;
    } else {
      identityNode.removeAttribute("aria-label");
      identityNode.removeAttribute("title");
    }
  }

  function buildSearchResultBadgeDescription(assessment, identityPreview) {
    return [
      identityPreview?.detail,
      assessment.reasons[0] || "This link looks normal."
    ]
      .filter(Boolean)
      .join(" ");
  }

  function buildSearchResultIdentityPreview(anchor, heading, assessment) {
    const contextText = getGoogleSearchResultContextText(anchor, heading);
    const claimedBrand = findBrandMention(contextText);
    const strongBrandClaim = claimedBrand && isStrongBrandClaim(contextText, claimedBrand);
    const officialForClaim = claimedBrand ? isOfficialHostForBrand(assessment.domain, claimedBrand) : false;
    const hasLoginClaim =
      Boolean(assessment.identitySignals.loginLikePath) ||
      SIGN_IN_PAGE_HINTS.some((hint) => contextText.includes(hint));
    const hasPaymentClaim = [
      "payment",
      "pay now",
      "checkout",
      "billing",
      "invoice",
      "renew"
    ].some((hint) => contextText.includes(hint));
    const unusualIdentityHost = Boolean(
      assessment.identitySignals.lookalikeBrand ||
      assessment.identitySignals.localKnownRiskMatch ||
      assessment.identitySignals.hiddenRedirect ||
      assessment.identitySignals.isShortener ||
      assessment.identitySignals.usesIpAddress ||
      assessment.identitySignals.usesEncodedHost ||
      assessment.identitySignals.suspiciousTld ||
      assessment.identitySignals.unusualPort
    );

    if (strongBrandClaim && claimedBrand && !officialForClaim) {
      return {
        status: "warning",
        headline: "This link may not match the site it claims to be",
        detail: `This result mentions ${formatBrandName(claimedBrand)}, but the address is ${assessment.domain}.`
      };
    }

    if (assessment.identitySignals.lookalikeBrand) {
      return {
        status: "warning",
        headline: "This link may not match the site it claims to be",
        detail: `This address looks a bit like ${formatBrandName(assessment.identitySignals.lookalikeBrand)}, but it is not the usual site.`
      };
    }

    if ((hasLoginClaim || hasPaymentClaim) && unusualIdentityHost) {
      return {
        status: "warning",
        headline: "Identity needs a closer look",
        detail: hasPaymentClaim
          ? "This result looks like a payment page on an unusual address."
          : "This result looks like a sign-in page on an unusual address."
      };
    }

    if (assessment.identitySignals.hiddenRedirect || assessment.identitySignals.isShortener) {
      return {
        status: "caution",
        headline: "Identity needs a closer look",
        detail: "This link may hide where it really goes."
      };
    }

    if (assessment.identitySignals.protocol !== "https:") {
      return {
        status: "caution",
        headline: "Identity needs a closer look",
        detail: "This result does not use the usual secure connection."
      };
    }

    if (
      assessment.identitySignals.hasLongUrl ||
      assessment.identitySignals.hasTrackerParams ||
      assessment.identitySignals.suspiciousTld ||
      assessment.identitySignals.unusualPort
    ) {
      return {
        status: "caution",
        headline: "Identity needs a closer look",
        detail: "The address mostly looks normal, but a few parts may need a second look."
      };
    }

    if (assessment.identitySignals.protocol === "https:") {
      return {
        status: "good",
        headline: "Secure-looking link",
        detail: "This result uses the usual secure connection. That helps protect traffic, but it does not prove the site is honest."
      };
    }

    return {
      status: "neutral",
      headline: "Address looks consistent",
      detail: "The address looks consistent for this search result."
    };
  }

  function getGoogleSearchResultContextText(anchor, heading) {
    const host = getGoogleSearchBadgeHost(anchor, heading);
    const textParts = [];
    const seenTexts = new Set();

    const addText = (value) => {
      const normalizedValue = String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (!normalizedValue || normalizedValue.length < 2 || seenTexts.has(normalizedValue)) {
        return;
      }

      seenTexts.add(normalizedValue);
      textParts.push(normalizedValue);
    };

    addText(heading?.textContent || "");
    addText(anchor?.getAttribute("aria-label") || "");
    addText(anchor?.textContent || "");

    if (host instanceof HTMLElement) {
      Array.from(host.querySelectorAll("h3, cite, span, div"))
        .filter((node) => !node.closest(".ai-guardian-gsr-slot"))
        .slice(0, 24)
        .forEach((node) => {
          addText(node.textContent || "");
        });
    }

    return textParts.join(" ").slice(0, 1200);
  }

  function formatBrandName(brand) {
    const value = String(brand || "").trim();

    if (!value) {
      return "this brand";
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function getEmailFeatureModule() {
    return window.AI_GUARDIAN_EMAIL || null;
  }

  function getEmailSafetyController() {
    return getEmailFeatureModule()?.controller || null;
  }

  function getEmailAuthFlowHandler() {
    return getEmailFeatureModule()?.authFlowHandler || null;
  }

  function initializeEmailSafetyController() {
    getEmailSafetyController()?.start?.();
  }

  document.addEventListener("agws:email-controller-ready", initializeEmailSafetyController);

  function clearWebmailPreviews() {
    getEmailSafetyController()?.clearPreviews?.();
  }

  function isSupportedWebmailPage() {
    return Boolean(getEmailSafetyController()?.isSupportedPage?.());
  }

  function detectEmailProvider(hostname = normalizeHost(location.hostname)) {
    const pathname = String(location.pathname || "").toLowerCase();
    const matchedEnvironment = WEBMAIL_ENVIRONMENTS.find((environment) => {
      const matchesHost = Array.isArray(environment.hosts)
        ? environment.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
        : false;
      const matchesAuthHost = Array.isArray(environment.authHosts)
        ? environment.authHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
        : false;
      const matchesPrefix = Array.isArray(environment.hostPrefixes)
        ? environment.hostPrefixes.some((prefix) => hostname.startsWith(prefix))
        : false;
      const matchesPath = Array.isArray(environment.pathHints)
        ? environment.pathHints.some((pathHint) => pathname.includes(pathHint))
        : false;

      return matchesHost || matchesAuthHost || matchesPrefix || matchesPath;
    });

    if (matchedEnvironment) {
      const matchedSurface = Array.isArray(matchedEnvironment.authHosts) &&
        matchedEnvironment.authHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
        ? "auth"
        : "mail";
      return {
        environment: matchedEnvironment,
        detectedBy: matchedSurface === "auth" ? "auth-hostname" : "hostname",
        matchedSurface,
        matchConfidence: matchedEnvironment.supportTier === 1 ? "high" : "medium"
      };
    }

    const uiMatchedEnvironment = WEBMAIL_ENVIRONMENTS.find((environment) => hasProviderUiCues(environment));

    if (uiMatchedEnvironment) {
      return {
        environment: uiMatchedEnvironment,
        detectedBy: "ui",
        matchedSurface: "mail",
        matchConfidence: uiMatchedEnvironment.supportTier === 1 ? "high" : "medium"
      };
    }

    const fallbackEnvironment = detectFallbackWebmailEnvironment(hostname, pathname);

    if (!fallbackEnvironment) {
      return null;
    }

    return {
      environment: fallbackEnvironment,
      detectedBy: "heuristic",
      matchedSurface: "mail",
      matchConfidence: "medium"
    };
  }

  function getWebmailEnvironment(hostname = normalizeHost(location.hostname)) {
    const providerMatch = detectEmailProvider(hostname);
    return providerMatch ? providerMatch.environment : null;
  }

  function detectFallbackWebmailEnvironment(hostname, pathname) {
    if (!looksLikeBrowserMail(hostname, pathname)) {
      return null;
    }

    return {
      id: "fallback-mail",
      providerLabel: "Secure browser mail",
      supportTier: 3,
      rowPreviewMode: "fallback",
      inboxRowSelectors: ["[role='option']", "tr[role='row']", "[role='row']"],
      messageScopeSelectors: ["[role='document']", "main", "[role='article']"],
      attachmentSelectors: ["a[href][download]", "a[href*='download' i]", "button[aria-label*='download' i]"],
      maxRows: 18,
      maxLinks: 12
    };
  }

  function looksLikeBrowserMail(hostname, pathname) {
    const normalizedTitle = String(document.title || "").toLowerCase();
    const bodyText = String(document.body?.innerText || "").toLowerCase().slice(0, 4000);
    const hostLooksMailLike =
      hostname.includes("mail") ||
      hostname.includes("webmail") ||
      pathname.includes("/mail") ||
      pathname.includes("/inbox") ||
      pathname.includes("/messages") ||
      pathname.includes("/owa");
    const titleLooksMailLike = WEBMAIL_TITLE_HINTS.some((hint) => normalizedTitle.includes(hint));
    const bodyLooksMailLike =
      bodyText.includes("inbox") &&
      (bodyText.includes("compose") || bodyText.includes("sent") || bodyText.includes("draft"));

    return hostLooksMailLike || titleLooksMailLike || bodyLooksMailLike;
  }

  function hasProviderUiCues(environment) {
    const uiSelectors = getProviderUiSelectors(environment);
    const uiTextHints = getProviderUiTextHints(environment);
    const titleText = String(document.title || "").toLowerCase();
    const bodySample = String(document.body?.innerText || "").toLowerCase().slice(0, 2500);

    if (uiSelectors.length > 0 && countVisibleMatches(uiSelectors, 8) > 0) {
      return true;
    }

    return uiTextHints.some((hint) => titleText.includes(hint) || bodySample.includes(hint));
  }

  function detectEmailSafetyContext(currentHost = normalizeHost(location.hostname), currentRootDomain = getRootDomain(currentHost)) {
    const providerMatch = detectEmailProvider(currentHost);

    if (!providerMatch) {
      return null;
    }

    const environment = providerMatch.environment;
    const modeSignals = collectEmailModeSignals(environment, currentHost, currentRootDomain);
    const pageMode = detectEmailPageMode(environment, providerMatch, modeSignals);
    const injectionConfidence = decideEmailInjectionConfidence(environment, providerMatch, pageMode, modeSignals);

    return {
      ...environment,
      providerDetectedBy: providerMatch.detectedBy,
      providerMatchedSurface: providerMatch.matchedSurface,
      providerMatchConfidence: providerMatch.matchConfidence,
      pageMode,
      injectionConfidence,
      rowPreviewAllowed: shouldInjectEmailRowPreviews(pageMode, injectionConfidence, modeSignals),
      linkCueAllowed: shouldInjectEmailLinkCues(pageMode, injectionConfidence, modeSignals),
      modeSignals
    };
  }

  function collectEmailModeSignals(environment, currentHost, currentRootDomain) {
    const rows = getWebmailMessageRows(environment);
    const messageScopes = getVisibleWebmailMessageScopes(environment);
    const visibleLinks = getVisibleWebmailMessageLinks(environment);
    const composeCount = countVisibleMatches(getComposeSelectors(environment), 8);
    const accountChooserCount = countVisibleMatches(getAccountChooserSelectors(environment), 12);
    const authCount =
      countVisibleMatches(getAuthSelectors(environment), 8) +
      document.querySelectorAll('input[type="password"]').length;
    const attachmentViewCount = countVisibleMatches(getAttachmentViewSelectors(environment), 8);
    const folderListDetected = countVisibleMatches(getFolderSelectors(environment), 10) > 0;
    const searchFieldDetected = countVisibleMatches(getSearchSelectors(environment), 8) > 0;
    const composeButtonDetected = countVisibleMatches(getComposeButtonSelectors(environment), 6) > 0;
    const messageTextLength = messageScopes
      .slice(0, 3)
      .map((scope) => String(scope.innerText || ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim().length;
    const visibleAttachmentCount = visibleLinks.filter((element) => {
      const text = getWebmailInteractiveElementText(element).toLowerCase();
      return (
        getWebmailInteractiveTargetUrl(element).length > 0 &&
        (MAIL_ATTACHMENT_HINTS.some((hint) => text.includes(hint)) || element.matches?.("a[download], button[formaction]"))
      );
    }).length;

    return {
      currentHost,
      currentRootDomain,
      rowCount: rows.length,
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
      visibleAttachmentCount,
      hasReadingPane: rows.length >= 2 && messageScopes.length > 0
    };
  }

  function detectEmailPageMode(environment, providerMatch, modeSignals) {
    if (modeSignals.accountChooserCount > 0 || isTrustedAccountChooserPath()) {
      return "account chooser";
    }

    if (
      providerMatch.matchedSurface === "auth" ||
      (modeSignals.authCount > 0 && (isTrustedAuthPath() || providerMatch.matchedSurface === "auth"))
    ) {
      return "sign-in/auth page";
    }

    if (
      modeSignals.composeCount > 0 &&
      modeSignals.messageScopeCount === 0 &&
      modeSignals.rowCount < 2
    ) {
      return "compose view";
    }

    if (
      modeSignals.attachmentViewCount > 0 &&
      modeSignals.rowCount < 2 &&
      (modeSignals.visibleAttachmentCount > 0 || modeSignals.visibleLinkCount <= 2)
    ) {
      return "attachment/download view";
    }

    if (
      modeSignals.messageScopeCount > 0 &&
      (modeSignals.visibleLinkCount > 0 || modeSignals.messageTextLength > 160 || modeSignals.visibleAttachmentCount > 0)
    ) {
      return "opened message";
    }

    if (
      modeSignals.rowCount >= getMinimumInboxRowCount(environment) &&
      (modeSignals.folderListDetected || modeSignals.searchFieldDetected || modeSignals.composeButtonDetected)
    ) {
      return "inbox list";
    }

    if (providerMatch.environment.supportTier === 1 && modeSignals.rowCount >= 2) {
      return "inbox list";
    }

    return "mail page";
  }

  function decideEmailInjectionConfidence(environment, providerMatch, pageMode, modeSignals) {
    if (
      providerMatch.matchedSurface === "auth" ||
      pageMode === "account chooser" ||
      pageMode === "sign-in/auth page" ||
      pageMode === "compose view"
    ) {
      return "low";
    }

    if (environment.supportTier === 1) {
      if (pageMode === "inbox list" || pageMode === "opened message" || pageMode === "attachment/download view") {
        return providerMatch.matchConfidence === "high" ? "high" : "medium";
      }
    }

    if (environment.supportTier === 2) {
      if (pageMode === "opened message" || pageMode === "attachment/download view") {
        return "medium";
      }

      if (
        pageMode === "inbox list" &&
        modeSignals.rowCount >= Math.max(4, getMinimumInboxRowCount(environment)) &&
        modeSignals.folderListDetected &&
        modeSignals.searchFieldDetected
      ) {
        return "high";
      }

      return "medium";
    }

    if (
      pageMode === "inbox list" &&
      modeSignals.rowCount >= 6 &&
      modeSignals.folderListDetected &&
      modeSignals.searchFieldDetected &&
      modeSignals.composeButtonDetected
    ) {
      return "high";
    }

    if (pageMode === "opened message" || pageMode === "attachment/download view") {
      return "medium";
    }

    return "low";
  }

  function shouldInjectEmailRowPreviews(pageMode, injectionConfidence, modeSignals) {
    return pageMode === "inbox list" && injectionConfidence === "high" && modeSignals.rowCount >= 2;
  }

  function shouldInjectEmailLinkCues(pageMode, injectionConfidence, modeSignals) {
    if (injectionConfidence === "low") {
      return false;
    }

    return (
      pageMode === "opened message" ||
      pageMode === "attachment/download view" ||
      (pageMode === "inbox list" && modeSignals.hasReadingPane)
    );
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
    const normalizedPath = String(location.pathname || "").toLowerCase();
    return GENERIC_SSO_PATH_HINTS.some((hint) => normalizedPath.includes(hint));
  }

  function decorateWebmailPreviews() {
    getEmailSafetyController()?.decoratePreviews?.();
  }

  function buildEmailSafetyPreview(currentHost, currentRootDomain) {
    return getEmailSafetyController()?.buildPreview?.(currentHost, currentRootDomain) || null;
  }

  function getProviderUiSelectors(environment) {
    switch (environment.id) {
      case "gmail":
        return ["div[gh='cm']", "table[role='grid']", "div.aeF"];
      case "outlook":
        return ["button[aria-label*='New mail' i]", "div[role='tree']", "[aria-label*='Outlook' i]"];
      case "yahoo":
        return ["a[data-test-id='compose-button']", "[data-test-id='message-list']", "[data-test-folder-name]"];
      case "proton":
        return ["[data-testid='navigation-list']", "[data-testid='composer:button']"];
      case "icloud":
        return ["[aria-label*='Mailboxes' i]", "button[title*='Compose' i]"];
      case "aol":
        return ["a[data-test-id='compose-button']", "[data-test-folder-name]"];
      default:
        return ["[role='tree']", "button[aria-label*='compose' i]", "input[aria-label*='search mail' i]"];
    }
  }

  function getProviderUiTextHints(environment) {
    switch (environment.id) {
      case "gmail":
        return ["gmail", "compose", "inbox"];
      case "outlook":
        return ["outlook", "focused", "other"];
      case "yahoo":
        return ["yahoo mail", "compose", "inbox"];
      case "proton":
        return ["proton mail", "inbox"];
      case "icloud":
        return ["icloud mail", "mailboxes"];
      case "aol":
        return ["aol mail", "inbox"];
      default:
        return ["webmail", "inbox", "compose"];
    }
  }

  function getComposeSelectors(environment) {
    switch (environment.id) {
      case "gmail":
        return ["div[role='dialog'] textarea[name='to']", "div[role='dialog'] input[name='subjectbox']"];
      case "outlook":
        return ["div[aria-label*='Message body' i][contenteditable='true']", "input[aria-label*='Add a subject' i]"];
      case "yahoo":
        return ["textarea[id*='compose-to']", "input[data-test-id='compose-subject']"];
      case "proton":
        return ["[data-testid='composer'] textarea", "[data-testid='composer'] input"];
      case "icloud":
        return ["[role='dialog'] textarea", "[role='dialog'] input"];
      case "aol":
        return ["textarea[name='to']", "input[name='subject']"];
      default:
        return ["[role='dialog'] textarea", "[role='dialog'] input[name*='subject' i]", "textarea[aria-label*='message' i]"];
    }
  }

  function getComposeButtonSelectors(environment) {
    switch (environment.id) {
      case "gmail":
        return ["div[gh='cm']", "button[aria-label*='Compose' i]"];
      case "outlook":
        return ["button[aria-label*='New mail' i]", "button[title*='New mail' i]"];
      case "yahoo":
        return ["a[data-test-id='compose-button']", "button[aria-label*='Compose' i]"];
      default:
        return ["button[aria-label*='Compose' i]", "a[aria-label*='Compose' i]", "button[title*='Compose' i]"];
    }
  }

  function getFolderSelectors(environment) {
    switch (environment.id) {
      case "gmail":
        return ["a[title='Inbox']", "div[role='navigation'] a", "div[gh='tl']"];
      case "outlook":
        return ["div[role='tree'] div[role='treeitem']", "button[aria-label*='Inbox' i]"];
      case "yahoo":
        return ["[data-test-folder-name]", "a[title='Inbox']"];
      default:
        return ["div[role='tree'] [role='treeitem']", "nav a[title*='Inbox' i]", "[aria-label*='Folders' i]"];
    }
  }

  function getSearchSelectors(environment) {
    switch (environment.id) {
      case "gmail":
        return ["input[aria-label*='Search mail' i]"];
      case "outlook":
        return ["input[placeholder*='Search' i]", "input[aria-label*='Search' i]"];
      case "yahoo":
        return ["input[aria-label*='Search mail' i]", "input[placeholder*='Search' i]"];
      default:
        return ["input[aria-label*='Search' i]", "input[placeholder*='Search' i]"];
    }
  }

  function getAttachmentViewSelectors(environment) {
    switch (environment.id) {
      case "gmail":
        return ["div[role='main'] a[href*='view=att' i]", "div[role='main'] a[download]"];
      case "outlook":
        return ["button[aria-label*='Download' i]", "a[download]"];
      case "yahoo":
        return ["a[href*='download' i]", "a[download]"];
      default:
        return ["a[download]", "button[aria-label*='Download' i]", "a[href*='download' i]"];
    }
  }

  function getAuthSelectors(environment) {
    switch (environment.id) {
      case "gmail":
        return ["input[type='password']", "div[data-view-id] input[type='email']"];
      case "outlook":
        return ["input[type='password']", "input[name='loginfmt']"];
      case "yahoo":
        return ["input[type='password']", "input[name='username']"];
      default:
        return ["input[type='password']", "input[name*='user' i]", "input[name*='email' i]"];
    }
  }

  function getAccountChooserSelectors(environment) {
    switch (environment.id) {
      case "gmail":
        return ["div[role='listitem'][data-identifier]", "div[data-identifier]"];
      case "outlook":
        return ["div[data-test-id='account-picker']", "div[role='option'][data-value]"];
      case "yahoo":
        return ["li[data-username]", "[data-test-id='account-switcher']"];
      default:
        return ["[data-identifier]", "[data-test-id*='account']", "[role='option'][data-value]"];
    }
  }

  function getVisibleWebmailMessageScopes(environment) {
    return environment.messageScopeSelectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter((scope) => scope instanceof HTMLElement && isVisibleElement(scope) && isElementNearViewport(scope, 240));
  }

  function countVisibleMatches(selectors, limit = 20) {
    const seenElements = new Set();
    let count = 0;

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (
          count >= limit ||
          !(element instanceof HTMLElement) ||
          seenElements.has(element) ||
          !isVisibleElement(element) ||
          !isElementNearViewport(element, 240)
        ) {
          return;
        }

        seenElements.add(element);
        count += 1;
      });
    });

    return count;
  }

  function isElementNearViewport(element, padding = 160) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.bottom >= -padding && rect.top <= window.innerHeight + padding;
  }

  function getWebmailMessageRows(environment) {
    const rows = [];
    const seenRows = new Set();

    environment.inboxRowSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((row) => {
        if (
          !(row instanceof HTMLElement) ||
          seenRows.has(row) ||
          !isVisibleElement(row) ||
          !isElementNearViewport(row, 260)
        ) {
          return;
        }

        const rowText = String(row.innerText || "").replace(/\s+/g, " ").trim();

        if (rowText.length < 8) {
          return;
        }

        seenRows.add(row);
        rows.push(row);
      });
    });

    return rows;
  }

  function getVisibleWebmailMessageLinks(environment) {
    const links = [];
    const seenUrls = new Set();
    const scopes = getVisibleWebmailMessageScopes(environment);

    scopes.forEach((scope) => {
      scope.querySelectorAll("a[href], button[formaction], button[data-url], [role='button'][data-url]").forEach((element) => {
        if (!(element instanceof HTMLElement) || element.closest(".ai-guardian-mail-cue-slot")) {
          return;
        }

        if (!isVisibleElement(element) || !isElementNearViewport(element, 200)) {
          return;
        }

        const resolvedUrl = getWebmailInteractiveTargetUrl(element);

        if (!resolvedUrl || seenUrls.has(resolvedUrl)) {
          return;
        }

        seenUrls.add(resolvedUrl);
        links.push(element);
      });
    });

    return links;
  }

  function getWebmailInteractiveTargetUrl(element) {
    if (element instanceof HTMLAnchorElement) {
      return getExactNavigationTargetHref(element);
    }

    if (!(element instanceof HTMLElement)) {
      return "";
    }

    const candidateUrl =
      element.getAttribute("formaction") ||
      element.getAttribute("data-url") ||
      element.getAttribute("href");

    return resolveHttpUrl(candidateUrl);
  }

  function assessWebmailInteractiveElement(element, context = {}) {
    if (element instanceof HTMLAnchorElement) {
      return assessLinkElement(element, context);
    }

    const resolvedUrl = getWebmailInteractiveTargetUrl(element);

    if (!resolvedUrl) {
      return null;
    }

    const assessment = assessUrl(resolvedUrl, context);

    return {
      ...assessment,
      mismatchLevel: "none",
      text: getWebmailInteractiveElementText(element, assessment.domain)
    };
  }

  function getWebmailInteractiveElementText(element, fallbackText = "") {
    const text = [
      element.textContent || "",
      element.getAttribute && element.getAttribute("aria-label"),
      element.getAttribute && element.getAttribute("title")
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return text || fallbackText || "message action";
  }

  function assessWebmailMessageRow(row, environment = {}) {
    const rowText = normalizeThreatText(row.innerText || "");

    if (!rowText) {
      return null;
    }

    let score = SCORE_BASE;
    let detail = "This message looks normal.";
    let strongSignals = 0;
    let moderateSignals = 0;

    const pushyMatches = findPhraseMatches(rowText, PUSHY_PHRASES);
    const signInMatches = findPhraseMatches(rowText, SIGN_IN_PAGE_HINTS);
    const highRiskMatches = findPhraseMatches(rowText, HIGH_RISK_PAGE_PHRASES);
    const rowRiskMatches = findPhraseMatches(rowText, MAIL_ROW_RISK_HINTS);
    const attachmentMatches = findPhraseMatches(rowText, MAIL_ATTACHMENT_HINTS);
    const senderEmail = getVisibleEmailAddress(row);
    const senderDomain = senderEmail ? normalizeHost(senderEmail.split("@").pop() || "") : "";
    const claimedBrand = findBrandMention(rowText);
    const isAdaptiveRowPreview = environment.rowPreviewMode === "adaptive";

    if (highRiskMatches.length > 0) {
      score += SIGNAL_WEIGHTS.strong.light;
      strongSignals += 1;
      detail = `This message uses words like ${formatQuotedExamples(highRiskMatches.slice(0, 2))}.`;
    }

    if (pushyMatches.length > 0 && (signInMatches.length > 0 || rowRiskMatches.length > 0)) {
      score += SIGNAL_WEIGHTS.strong.light;
      strongSignals += 1;
      detail = "This message is trying to rush you about an account or payment issue.";
    } else if (signInMatches.length > 0 || rowRiskMatches.length > 0) {
      score += SIGNAL_WEIGHTS.moderate.light;
      moderateSignals += 1;
      detail = "This message asks for account, sign-in, or payment action.";
    }

    if (
      claimedBrand &&
      senderDomain &&
      !isOfficialHostForBrand(senderDomain, claimedBrand) &&
      isStrongBrandClaim(`${claimedBrand} ${rowText}`, claimedBrand)
    ) {
      score += SIGNAL_WEIGHTS.strong.normal;
      strongSignals += 1;
      detail = `This message mentions ${formatBrandName(claimedBrand)}, but the sender address looks different.`;
    }

    if (attachmentMatches.length > 0 && (pushyMatches.length > 0 || highRiskMatches.length > 0)) {
      score += SIGNAL_WEIGHTS.moderate.normal;
      moderateSignals += 1;
      detail = "This message pushes you to open a file or download quickly.";
    }

    if (isAdaptiveRowPreview && strongSignals === 0 && moderateSignals <= 1) {
      score = Math.min(score, 24);
    }

    if (strongSignals === 0 && moderateSignals === 0) {
      return {
        score,
        label: "Looks safe",
        tone: "safe",
        detail: "Nothing unusual stood out in this message preview."
      };
    }

    return {
      score: clampScore(score),
      label: strongSignals > 0 || score >= 60 ? "Needs a closer look" : "Check carefully",
      tone: strongSignals > 0 || score >= 60 ? "risk" : "caution",
      detail
    };
  }

  function buildWebmailLinkPreview(element, assessment, environment) {
    const anchorText = getWebmailInteractiveElementText(element, assessment.text).toLowerCase();
    const isAttachmentLike =
      assessment.isDownload ||
      environment.attachmentSelectors.some((selector) => {
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
      ACTION_PROMPT_WORDS.some((word) => anchorText.includes(word)) &&
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

    return uniqueList(reasons);
  }

  function ensureWebmailRowCueSlot(row, environment) {
    const host = getWebmailRowCueHost(row, environment);

    if (!(host instanceof HTMLElement)) {
      return null;
    }

    const existingSlot = Array.from(host.children).find((child) => {
      return child instanceof HTMLElement &&
        child.classList.contains("ai-guardian-mail-cue-slot") &&
        child.dataset.kind === "row";
    });

    if (existingSlot instanceof HTMLElement) {
      return existingSlot;
    }

    const cueSlot = document.createElement("span");
    cueSlot.className = "ai-guardian-mail-cue-slot ai-guardian-mail-row-slot";
    cueSlot.dataset.kind = "row";
    cueSlot.dataset.agwsEnhanced = "true";
    cueSlot.dataset.agwsFeature = "email-preview";
    host.appendChild(cueSlot);
    return cueSlot;
  }

  function ensureWebmailLinkCueSlot(element) {
    const sibling = element.nextElementSibling;

    if (
      sibling instanceof HTMLElement &&
      sibling.classList.contains("ai-guardian-mail-cue-slot") &&
      sibling.dataset.kind === "link"
    ) {
      return sibling;
    }

    const cueSlot = document.createElement("span");
    cueSlot.className = "ai-guardian-mail-cue-slot ai-guardian-mail-link-slot";
    cueSlot.dataset.kind = "link";
    cueSlot.dataset.agwsEnhanced = "true";
    cueSlot.dataset.agwsFeature = "email-preview";
    element.insertAdjacentElement("afterend", cueSlot);
    return cueSlot;
  }

  function getWebmailRowCueHost(row, environment = {}) {
    const selectors = getWebmailRowCueHostSelectors(environment);

    for (const selector of selectors) {
      try {
        const host = row.querySelector(selector);

        if (host instanceof HTMLElement && isVisibleElement(host)) {
          return host;
        }
      } catch (error) {
        continue;
      }
    }

    const fallbackCell = row.querySelector("td:last-child, div[role='gridcell']:last-child, div:last-child");
    return fallbackCell instanceof HTMLElement ? fallbackCell : row;
  }

  function getWebmailRowCueHostSelectors(environment = {}) {
    switch (environment.id) {
      case "gmail":
        return ["td.xY.a4W", "td.a4W", "td.xY", "td:last-child"];
      case "outlook":
        return ["div[role='gridcell']:last-child", "div[data-app-section*='MessageList']", "div:last-child"];
      case "yahoo":
      case "aol":
        return ["div[data-test-id*='message']", "li > div:last-child", "div:last-child"];
      case "proton":
        return ["[data-testid*='message-row'] [role='gridcell']:last-child", "[role='gridcell']:last-child", "div:last-child"];
      case "icloud":
        return ["[role='gridcell']:last-child", "div:last-child"];
      default:
        return ["td:last-child", "div[role='gridcell']:last-child", "div:last-child"];
    }
  }

  function updateWebmailCue(cueSlot, label, detail, tone) {
    let cue = cueSlot.firstElementChild;

    if (!(cue instanceof HTMLElement) || !cue.classList.contains("ai-guardian-mail-cue")) {
      cue = document.createElement("span");
      cue.className = "ai-guardian-mail-cue";
      cueSlot.replaceChildren(cue);
    }

    cue.dataset.tone = tone;
    cue.dataset.agwsEnhanced = "true";
    cue.dataset.agwsFeature = "email-preview";
    cue.textContent = label;
    cue.setAttribute("role", "note");
    cue.setAttribute("aria-label", `${label}. ${detail}`);
    cue.title = detail;
  }

  function getVisibleEmailAddress(scope) {
    const possibleValues = [
      scope.getAttribute && scope.getAttribute("email"),
      scope.getAttribute && scope.getAttribute("data-hovercard-id"),
      scope.getAttribute && scope.getAttribute("data-email"),
      scope.getAttribute && scope.getAttribute("title")
    ];

    scope.querySelectorAll("[email], [data-hovercard-id], [data-email], [title*='@']").forEach((node) => {
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

  function isVisibleElement(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function findPrivateFieldsInScope(scope) {
    const fields = Array.from(scope.querySelectorAll("input, textarea, select"));

    return fields
      .filter((field) => !isIgnoredField(field))
      .map((field) => {
        const fieldText = [
          field.getAttribute("name"),
          field.getAttribute("id"),
          field.getAttribute("placeholder"),
          field.getAttribute("aria-label"),
          field.getAttribute("autocomplete"),
          field.type,
          getLabelText(field)
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchedKeyword = PRIVATE_FIELD_KEYWORDS.find((keyword) => fieldText.includes(keyword));

        if (!matchedKeyword) {
          return null;
        }

        return {
          label: FRIENDLY_FIELD_NAMES[matchedKeyword] || matchedKeyword
        };
      })
      .filter(Boolean);
  }

  function describeFormFields(form) {
    const privateFields = findPrivateFieldsInScope(form);

    return {
      passwordCount: form.querySelectorAll('input[type="password"]').length,
      privateCount: privateFields.length,
      privateExamples: uniqueList(privateFields.map((field) => field.label))
    };
  }

  function isIgnoredField(field) {
    const ignoredTypes = [
      "hidden",
      "submit",
      "button",
      "reset",
      "checkbox",
      "radio",
      "file",
      "image"
    ];

    return ignoredTypes.includes((field.type || "").toLowerCase());
  }

  function getLabelText(field) {
    return Array.from(field.labels || [])
      .map((label) => label.innerText || "")
      .join(" ");
  }

  function getPageText() {
    const titleText = document.title || "";
    const bodyText = document.body ? document.body.innerText || "" : "";
    return `${titleText} ${bodyText}`.toLowerCase().slice(0, 50000);
  }

  function getProminentIdentityText() {
    const titleText = document.title || "";
    const prominentNodes = Array.from(
      document.querySelectorAll("h1, h2, [role='heading'], form label, button, [aria-label]")
    )
      .slice(0, 20)
      .map((node) => {
        const ariaLabel = node.getAttribute && node.getAttribute("aria-label");
        const textContent = node.textContent || "";
        return `${ariaLabel || ""} ${textContent}`.trim();
      })
      .filter(Boolean)
      .join(" ");

    return `${titleText} ${prominentNodes}`.toLowerCase().slice(0, 5000);
  }

  function findPhraseMatches(text, phraseList) {
    return phraseList.filter((phrase) => text.includes(phrase));
  }

  function getTrackerParams(parsedUrl) {
    return Array.from(parsedUrl.searchParams.keys()).filter((name) => {
      const lowerName = name.toLowerCase();

      if (TRACKER_PARAM_NAMES.has(lowerName)) {
        return true;
      }

      return TRACKER_PARAM_PREFIXES.some((prefix) => lowerName.startsWith(prefix));
    });
  }

  function buildCleanUrl(parsedUrl) {
    const cleanUrl = new URL(parsedUrl.toString());

    getTrackerParams(cleanUrl).forEach((name) => {
      cleanUrl.searchParams.delete(name);
    });

    cleanUrl.hash = "";
    return cleanUrl.toString();
  }

  function resolveHttpUrl(href) {
    if (!href) {
      return "";
    }

    try {
      const parsedUrl = new URL(href, location.href);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return "";
      }

      return parsedUrl.toString();
    } catch (error) {
      return "";
    }
  }

  function unwrapGoogleRedirect(urlString) {
    try {
      const parsedUrl = new URL(urlString, location.href);

      if (!parsedUrl.hostname.includes("google.")) {
        return parsedUrl.toString();
      }

      const directLink = parsedUrl.searchParams.get("q") || parsedUrl.searchParams.get("url");

      if (directLink && /^https?:/i.test(directLink)) {
        return directLink;
      }

      return parsedUrl.toString();
    } catch (error) {
      return urlString;
    }
  }

  function normalizeHost(hostname) {
    return (hostname || "").toLowerCase().replace(/^www\./, "");
  }

  function getRootDomain(hostname) {
    const parts = hostname.split(".").filter(Boolean);

    if (parts.length <= 2) {
      return hostname;
    }

    const commonCountryPairs = new Set(["co.uk", "org.uk", "com.au", "co.nz", "com.br", "co.jp"]);
    const lastTwo = parts.slice(-2).join(".");
    const lastThree = parts.slice(-3).join(".");

    if (commonCountryPairs.has(lastTwo)) {
      return lastThree;
    }

    return lastTwo;
  }

  function isTrustedHost(hostname) {
    if (hostname.endsWith(".gov")) {
      return true;
    }

    return BRAND_RULES.some((rule) => {
      return rule.officialHosts.some((officialHost) => {
        return hostname === officialHost || hostname.endsWith(`.${officialHost}`);
      });
    });
  }

  function isEduHost(hostname) {
    return hostname.endsWith(".edu");
  }

  function getLocalKnownRiskMatch(hostname, rootDomain) {
    if (LOCAL_HIGH_RISK_HOSTS.has(hostname)) {
      return hostname;
    }

    if (LOCAL_HIGH_RISK_ROOT_DOMAINS.has(rootDomain)) {
      return rootDomain;
    }

    return "";
  }

  function isOfficialHostForBrand(hostname, brandName) {
    const matchedRule = BRAND_RULES.find((rule) => rule.brand === brandName);

    if (!matchedRule) {
      return false;
    }

    return matchedRule.officialHosts.some((officialHost) => {
      return hostname === officialHost || hostname.endsWith(`.${officialHost}`);
    });
  }

  function findBrandMention(text) {
    const normalizedText = (text || "").toLowerCase();
    const matchedRule = BRAND_RULES.find((rule) => normalizedText.includes(rule.brand));
    return matchedRule ? matchedRule.brand : "";
  }

  function isStrongBrandClaim(text, brand) {
    const normalizedText = String(text || "").toLowerCase();

    if (!brand || !normalizedText.includes(brand)) {
      return false;
    }

    const identityClaimHints = [
      "official",
      "support",
      "security",
      "account",
      "billing",
      "verify",
      "sign in",
      "login",
      "log in",
      "password"
    ];

    return identityClaimHints.some((hint) => {
      const brandIndex = normalizedText.indexOf(brand);
      const hintIndex = normalizedText.indexOf(hint);

      return hintIndex >= 0 && Math.abs(hintIndex - brandIndex) <= 40;
    });
  }

  function findLookalikeBrand(hostname) {
    const firstLabel = (hostname.split(".")[0] || "").toLowerCase();
    const normalizedLabel = normalizeLookalikeText(firstLabel.replace(/[^a-z0-9-]/g, ""));

    for (const rule of BRAND_RULES) {
      const isOfficial = rule.officialHosts.some((officialHost) => {
        return hostname === officialHost || hostname.endsWith(`.${officialHost}`);
      });

      if (isOfficial) {
        continue;
      }

      const compactLabel = normalizedLabel.replace(/-/g, "");

      if (isSingleEditAway(compactLabel, rule.brand)) {
        return rule.brand;
      }

      if (compactLabel === rule.brand) {
        return rule.brand;
      }

      if (compactLabel.startsWith(rule.brand) || compactLabel.endsWith(rule.brand)) {
        const extraText = compactLabel.replace(rule.brand, "");

        if (hasLookalikeHint(extraText, firstLabel)) {
          return rule.brand;
        }
      }

      if (compactLabel.includes(rule.brand)) {
        const leftoverText = compactLabel.split(rule.brand).join("");

        if (hasLookalikeHint(leftoverText, firstLabel)) {
          return rule.brand;
        }
      }
    }

    return "";
  }

  function hasLookalikeHint(extraText, originalLabel) {
    if (!extraText) {
      return true;
    }

    if (/[0-9]/.test(originalLabel) || originalLabel.includes("-")) {
      return true;
    }

    return LOOKALIKE_HINTS.some((hint) => extraText.includes(hint));
  }

  function normalizeLookalikeText(value) {
    return value
      .replace(/0/g, "o")
      .replace(/1/g, "l")
      .replace(/3/g, "e")
      .replace(/5/g, "s")
      .replace(/7/g, "t");
  }

  function isSingleEditAway(value, target) {
    if (!value || !target || Math.abs(value.length - target.length) > 1) {
      return false;
    }

    if (value === target) {
      return true;
    }

    let valueIndex = 0;
    let targetIndex = 0;
    let differenceCount = 0;

    while (valueIndex < value.length && targetIndex < target.length) {
      if (value[valueIndex] === target[targetIndex]) {
        valueIndex += 1;
        targetIndex += 1;
        continue;
      }

      differenceCount += 1;

      if (differenceCount > 1) {
        return false;
      }

      if (value.length > target.length) {
        valueIndex += 1;
      } else if (target.length > value.length) {
        targetIndex += 1;
      } else {
        valueIndex += 1;
        targetIndex += 1;
      }
    }

    if (valueIndex < value.length || targetIndex < target.length) {
      differenceCount += 1;
    }

    return differenceCount <= 1;
  }

  function hasManyDigits(text) {
    return (text.match(/[0-9]/g) || []).length >= 4 && /[a-z]/i.test(text);
  }

  function isIpAddress(hostname) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  }

  function getFileExtension(pathname) {
    const lastSegment = (pathname || "").split("/").pop() || "";
    const match = lastSegment.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function getLinkText(anchor, fallbackText) {
    const label = (anchor.innerText || anchor.textContent || "")
      .trim()
      .replace(/\s+/g, " ");

    return label ? label.slice(0, 80) : fallbackText;
  }

  function formatQuotedExamples(items) {
    const examples = uniqueList(items).slice(0, 2).map((item) => `"${item}"`);

    if (examples.length === 0) {
      return '"private info"';
    }

    if (examples.length === 1) {
      return examples[0];
    }

    return `${examples[0]} and ${examples[1]}`;
  }

  function uniqueList(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function cloneReasonEntries(reasonEntries = []) {
    return reasonEntries.map((entry, index) => {
      return {
        text: entry.text,
        weight: Number(entry.weight || SIGNAL_WEIGHTS.low.normal),
        order: Number.isInteger(entry.order) ? entry.order : index
      };
    });
  }

  function addReasonEntry(reasonEntries, text, weight = SIGNAL_WEIGHTS.low.normal) {
    const nextText = String(text || "").trim();

    if (!nextText) {
      return;
    }

    const existingEntry = reasonEntries.find((entry) => entry.text === nextText);

    if (existingEntry) {
      existingEntry.weight = Math.max(existingEntry.weight, weight);
      return;
    }

    reasonEntries.push({
      text: nextText,
      weight,
      order: reasonEntries.length
    });
  }

  function mergeReasonEntries(reasonEntries, newEntries = [], fallbackWeight = SIGNAL_WEIGHTS.low.normal) {
    newEntries.forEach((entry) => {
      if (!entry) {
        return;
      }

      if (typeof entry === "string") {
        addReasonEntry(reasonEntries, entry, fallbackWeight);
        return;
      }

      addReasonEntry(reasonEntries, entry.text, Number(entry.weight || fallbackWeight));
    });
  }

  function getTopReasonTexts(reasonEntries, limit = 3) {
    return cloneReasonEntries(reasonEntries)
      .sort((left, right) => {
        return right.weight - left.weight || left.order - right.order;
      })
      .slice(0, limit)
      .map((entry) => entry.text);
  }

  function isSamePageJump(urlString) {
    try {
      const parsedUrl = new URL(urlString, location.href);
      return parsedUrl.origin === location.origin && parsedUrl.pathname === location.pathname && parsedUrl.search === location.search && parsedUrl.hash;
    } catch (error) {
      return false;
    }
  }

  function createReportSignature(report) {
    return [
      location.href,
      report.score,
      report.label,
      report.reasons.join("|"),
      report.emailSafetyPreview?.summary || "",
      report.emailSafetyPreview?.reasons?.join("|") || "",
      report.flaggedLinks.map((link) => `${link.cleanedUrl}:${link.score}`).join("|"),
      report.termsSummary?.points?.join("|") || "",
      report.familyProtection?.currentPageRestricted ? "family-blocked" : "family-open",
      report.familyProtection?.level || ""
    ].join("::");
  }

  function isGoogleSearchPage() {
    return location.hostname.startsWith("www.google.") && location.pathname === "/search";
  }

  function injectAssistantStyles() {
    if (document.getElementById("ai-guardian-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "ai-guardian-style";
    style.textContent = `
      #ai-guardian-root {
        all: initial !important;
        position: fixed;
        inset: 0;
        z-index: 2147483644 !important;
        pointer-events: none !important;
        isolation: isolate !important;
        contain: layout style paint !important;
        transform: none !important;
        filter: none !important;
        mix-blend-mode: normal !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        color: #1f2632 !important;
        direction: ltr !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
      }

      #ai-guardian-root,
      #ai-guardian-root *,
      #ai-guardian-root *::before,
      #ai-guardian-root *::after {
        box-sizing: border-box !important;
      }

      #ai-guardian-modal-root {
        all: initial !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483646 !important;
        pointer-events: none !important;
        isolation: isolate !important;
        contain: layout style paint !important;
        overflow: visible !important;
        transform: none !important;
        filter: none !important;
        mix-blend-mode: normal !important;
        direction: ltr !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        color: #1f2632 !important;
      }

      #ai-guardian-family-root {
        all: initial !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        isolation: isolate !important;
        contain: layout style paint !important;
        overflow: visible !important;
        transform: none !important;
        filter: none !important;
        mix-blend-mode: normal !important;
        direction: ltr !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        color: #1f2632 !important;
      }

      #ai-guardian-modal-root,
      #ai-guardian-modal-root *,
      #ai-guardian-modal-root *::before,
      #ai-guardian-modal-root *::after {
        box-sizing: border-box !important;
      }

      #ai-guardian-family-root,
      #ai-guardian-family-root *,
      #ai-guardian-family-root *::before,
      #ai-guardian-family-root *::after {
        box-sizing: border-box !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        direction: ltr !important;
        transform: none !important;
      }

      #ai-guardian-modal-root.ai-guardian-modal-open {
        pointer-events: auto !important;
      }

      #ai-guardian-family-root.ai-guardian-family-open {
        pointer-events: auto !important;
      }

      .ai-guardian-safe { --ai-bg: #dcefdc; --ai-border: #8bb58e; }
      .ai-guardian-low { --ai-bg: #ecf2d8; --ai-border: #adc27a; }
      .ai-guardian-medium { --ai-bg: #f7e8bf; --ai-border: #c7a95b; }
      .ai-guardian-high { --ai-bg: #f5dfc7; --ai-border: #d2985a; }
      .ai-guardian-risk { --ai-bg: #f2d6d2; --ai-border: #cb8d84; }

      .ai-guardian-indicator {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483645;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 200px;
        padding: 10px 12px;
        border: 1px solid var(--ai-border, #9db5d3);
        border-radius: 18px;
        background: var(--ai-bg, #dce7f5);
        box-shadow: 0 10px 22px rgba(31, 38, 50, 0.14);
        max-width: min(280px, calc(100vw - 32px));
        overflow: hidden;
        transition:
          max-width 180ms ease,
          min-width 180ms ease,
          padding 180ms ease,
          gap 180ms ease,
          border-radius 180ms ease,
          box-shadow 180ms ease,
          transform 180ms ease;
      }

      .ai-guardian-indicator-main {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1 1 auto;
        min-width: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        transition: gap 180ms ease;
      }

      .ai-guardian-indicator-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.86);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
        flex-shrink: 0;
        transition: width 180ms ease, height 180ms ease, border-radius 180ms ease;
      }

      .ai-guardian-mark-icon {
        width: 28px;
        height: 28px;
        display: block;
        transition: width 180ms ease, height 180ms ease;
      }

      .ai-guardian-indicator-copy {
        display: grid;
        gap: 2px;
        min-width: 0;
        overflow: hidden;
        transition: gap 180ms ease;
      }

      .ai-guardian-indicator-score {
        font-size: 28px;
        font-weight: 800;
        line-height: 1;
        transition: font-size 180ms ease, transform 180ms ease;
      }

      .ai-guardian-indicator-label {
        font-size: 16px;
        font-weight: 700;
        line-height: 1.2;
        max-height: 24px;
        max-width: 160px;
        opacity: 1;
        overflow: hidden;
        white-space: nowrap;
        transform: translateY(0);
        transition:
          max-width 180ms ease,
          max-height 180ms ease,
          opacity 140ms ease,
          transform 180ms ease;
      }

      .ai-guardian-indicator-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        min-height: 34px;
        padding: 8px 10px;
        border: 1px solid rgba(31, 38, 50, 0.16);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.86);
        color: #1f2632 !important;
        -webkit-text-fill-color: #1f2632 !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        font-size: 13px;
        font-weight: 800;
        line-height: 1;
        text-align: center;
        text-transform: none;
        letter-spacing: normal;
        white-space: nowrap;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        direction: ltr !important;
        appearance: none;
        -webkit-appearance: none;
        cursor: pointer;
        transition:
          min-height 180ms ease,
          padding 180ms ease,
          border-radius 180ms ease,
          font-size 180ms ease,
          transform 180ms ease;
      }

      .ai-guardian-indicator-expanded {
        min-width: 200px;
        max-width: min(280px, calc(100vw - 32px));
      }

      .ai-guardian-indicator-collapsed {
        gap: 0;
        min-width: 56px;
        width: 56px;
        max-width: 56px;
        min-height: 56px;
        padding: 8px;
        border-radius: 18px;
        box-shadow: 0 7px 16px rgba(31, 38, 50, 0.12);
        cursor: pointer;
      }

      .ai-guardian-indicator-collapsed .ai-guardian-indicator-main {
        gap: 0;
        justify-content: center;
      }

      .ai-guardian-indicator-collapsed .ai-guardian-indicator-mark {
        width: 40px;
        height: 40px;
        border-radius: 12px;
      }

      .ai-guardian-indicator-collapsed .ai-guardian-mark-icon {
        width: 26px;
        height: 26px;
      }

      .ai-guardian-indicator-collapsed .ai-guardian-indicator-copy {
        gap: 0;
        max-width: 0;
        width: 0;
        opacity: 0;
      }

      .ai-guardian-indicator-collapsed .ai-guardian-indicator-label {
        max-width: 0;
        max-height: 0;
        opacity: 0;
        transform: translateY(4px);
      }

      .ai-guardian-indicator-collapsed .ai-guardian-indicator-score {
        font-size: 0;
        line-height: 1;
        transform: translateY(0);
        opacity: 0;
      }

      .ai-guardian-indicator-collapsed .ai-guardian-indicator-toggle {
        display: none;
      }

      .ai-guardian-banner {
        position: fixed;
        right: 16px;
        bottom: 92px;
        z-index: 2147483645;
        pointer-events: auto;
        width: min(360px, calc(100vw - 32px));
        padding: 16px;
        border: 1px solid var(--ai-border, #d2985a);
        border-radius: 18px;
        background: var(--ai-bg, #f5dfc7);
        box-shadow: 0 10px 22px rgba(31, 38, 50, 0.14);
      }

      .ai-guardian-banner-title {
        font-size: 20px;
        font-weight: 800;
        line-height: 1.2;
      }

      .ai-guardian-banner-text {
        margin-top: 8px;
        font-size: 17px;
        line-height: 1.45;
      }

      .ai-guardian-banner-buttons {
        display: flex;
        gap: 10px;
        margin-top: 12px;
      }

      .ai-guardian-banner-button {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid rgba(31, 38, 50, 0.18);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.92);
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
      }

      .ai-guardian-banner-button-secondary {
        background: rgba(245, 250, 249, 0.96);
      }

      .ai-guardian-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        pointer-events: auto !important;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(18, 23, 31, 0.42);
        isolation: isolate;
        touch-action: auto;
        transform: none !important;
      }

      .ai-guardian-overlay[hidden] {
        display: none !important;
      }

      .ai-guardian-family-block {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(18, 23, 31, 0.46);
        pointer-events: auto !important;
      }

      .ai-guardian-family-block[hidden] {
        display: none !important;
      }

      .ai-guardian-family-card {
        width: min(560px, calc(100vw - 32px));
        padding: 28px 24px 24px;
        border: 1px solid #cfe1dc;
        border-radius: 28px;
        background: linear-gradient(180deg, #ffffff 0%, #f7fbfa 100%);
        box-shadow: 0 20px 42px rgba(18, 23, 31, 0.2);
      }

      .ai-guardian-family-top {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .ai-guardian-family-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 58px;
        height: 58px;
        border-radius: 18px;
        background: radial-gradient(circle at 28% 24%, rgba(136, 215, 193, 0.28), rgba(223, 247, 239, 0) 68%);
        flex-shrink: 0;
      }

      .ai-guardian-family-mark svg {
        width: 46px;
        height: 46px;
        display: block;
        filter: drop-shadow(0 8px 14px rgba(11, 38, 57, 0.18));
      }

      .ai-guardian-family-header {
        display: grid;
        gap: 8px;
        min-width: 0;
      }

      .ai-guardian-family-eyebrow {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #2a5a70;
      }

      .ai-guardian-family-state {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        min-height: 32px;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid #d7c1a1;
        background: #f8ecd0;
        color: #654b14;
        font-size: 14px;
        font-weight: 800;
      }

      .ai-guardian-family-title {
        margin-top: 18px;
        font-size: 30px;
        font-weight: 800;
        line-height: 1.15;
        color: #123b52;
      }

      .ai-guardian-family-message {
        margin-top: 14px;
        font-size: 20px;
        line-height: 1.5;
        color: #1f2632;
      }

      .ai-guardian-family-note,
      .ai-guardian-family-learn-more {
        margin-top: 10px;
        font-size: 17px;
        line-height: 1.5;
        color: #4a6170;
      }

      .ai-guardian-family-learn-more {
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid #d7e4e0;
        background: #eef6f3;
      }

      .ai-guardian-family-buttons {
        display: grid;
        grid-template-columns: 1.15fr 1fr;
        gap: 10px;
        margin-top: 18px;
      }

      .ai-guardian-family-buttons button {
        min-height: 54px;
        padding: 12px 14px;
        border-radius: 14px;
        font-size: 17px;
        font-weight: 800;
        cursor: pointer;
        pointer-events: auto !important;
      }

      .ai-guardian-family-go-back {
        border: 1px solid #84bca9;
        background: #dff4ec;
        color: #123b52;
      }

      .ai-guardian-family-learn {
        border: 1px solid #cde0da;
        background: #f3f9f7;
        color: #123b52;
      }

      .ai-guardian-overlay,
      .ai-guardian-overlay *,
      .ai-guardian-overlay *::before,
      .ai-guardian-overlay *::after {
        box-sizing: border-box !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        direction: ltr !important;
        text-transform: none !important;
        letter-spacing: normal !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }

      .ai-guardian-dialog {
        position: relative;
        z-index: 2147483647;
        pointer-events: auto !important;
        width: min(440px, calc(100vw - 36px));
        padding: 22px;
        border: 1px solid var(--ai-border, #cb8d84);
        border-radius: 22px;
        background: #ffffff;
        box-shadow: 0 16px 36px rgba(18, 23, 31, 0.24);
        transform: none !important;
        overflow: visible !important;
      }

      .ai-guardian-dialog-guided {
        border-color: #b9d8cc;
        box-shadow: 0 18px 40px rgba(18, 23, 31, 0.18);
      }

      .ai-guardian-dialog::before,
      .ai-guardian-dialog::after {
        pointer-events: none !important;
      }

      .ai-guardian-dialog-title {
        font-size: 28px;
        font-weight: 800;
        line-height: 1.15;
      }

      .ai-guardian-dialog-message {
        margin-top: 12px;
        font-size: 19px;
        line-height: 1.45;
      }

      .ai-guardian-dialog-guided .ai-guardian-dialog-title {
        color: #123b52;
      }

      .ai-guardian-dialog-guided .ai-guardian-dialog-message {
        margin-top: 14px;
        font-size: 21px;
        line-height: 1.5;
      }

      .ai-guardian-dialog-reasons {
        margin: 14px 0 0;
        padding-left: 24px;
        font-size: 17px;
        line-height: 1.45;
      }

      .ai-guardian-dialog-guided .ai-guardian-dialog-reasons {
        display: none !important;
      }

      .ai-guardian-dialog-reasons li + li {
        margin-top: 8px;
      }

      .ai-guardian-dialog-buttons {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 18px;
        position: relative;
        z-index: 2;
        pointer-events: auto !important;
        transform: none !important;
      }

      .ai-guardian-dialog-guided .ai-guardian-dialog-buttons {
        grid-template-columns: minmax(0, 1.2fr) repeat(2, minmax(0, 1fr));
        margin-top: 20px;
      }

      .ai-guardian-dialog-buttons button {
        position: relative;
        z-index: 3;
        min-height: 52px;
        padding: 12px;
        border-radius: 14px;
        font-size: 17px;
        font-weight: 800;
        cursor: pointer;
        pointer-events: auto !important;
        transform: none !important;
      }

      .ai-guardian-stay-button {
        border: 1px solid #c8d4e3;
        background: #eef3fa;
        color: #1f2632;
      }

      .ai-guardian-dialog-guided .ai-guardian-stay-button {
        border-color: #84bca9;
        background: #dff4ec;
        color: #123b52;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      }

      .ai-guardian-learn-button {
        border: 1px solid #cde0da;
        background: #f3f9f7;
        color: #123b52;
      }

      .ai-guardian-continue-button {
        border: 1px solid rgba(31, 38, 50, 0.18);
        background: #446a96;
        color: #ffffff;
      }

      .ai-guardian-dialog-guided .ai-guardian-continue-button {
        border-color: #d2dbe7;
        background: #f3f6fa;
        color: #3e536f;
      }

      .ai-guardian-indicator-main:focus-visible,
      .ai-guardian-indicator-toggle:focus-visible,
      .ai-guardian-banner-button:focus-visible,
      .ai-guardian-dialog-buttons button:focus-visible,
      .ai-guardian-family-buttons button:focus-visible {
        outline: 3px solid #123b52;
        outline-offset: 3px;
      }

      .ai-guardian-gsr-safe { --ai-gsr-bg: #dcefdc; --ai-gsr-border: #8bb58e; --ai-gsr-text: #173327; }
      .ai-guardian-gsr-low { --ai-gsr-bg: #ecf2d8; --ai-gsr-border: #adc27a; --ai-gsr-text: #304018; }
      .ai-guardian-gsr-medium { --ai-gsr-bg: #f7e8bf; --ai-gsr-border: #c7a95b; --ai-gsr-text: #4b3610; }
      .ai-guardian-gsr-high { --ai-gsr-bg: #f5dfc7; --ai-gsr-border: #d2985a; --ai-gsr-text: #56361f; }
      .ai-guardian-gsr-risk { --ai-gsr-bg: #f2d6d2; --ai-gsr-border: #cb8d84; --ai-gsr-text: #5a2621; }

      .ai-guardian-gsr-slot,
      .ai-guardian-gsr-slot *,
      .ai-guardian-gsr-slot *::before,
      .ai-guardian-gsr-slot *::after,
      .ai-guardian-gsr-badge-wrap,
      .ai-guardian-gsr-badge-wrap *,
      .ai-guardian-gsr-badge-wrap *::before,
      .ai-guardian-gsr-badge-wrap *::after {
        box-sizing: border-box !important;
        font: inherit !important;
        font-synthesis: none !important;
        font-variant-ligatures: none !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        direction: ltr !important;
        unicode-bidi: isolate !important;
        transform: none !important;
        transform-origin: center center !important;
        rotate: 0deg !important;
        scale: 1 !important;
        translate: 0 !important;
        perspective: none !important;
        text-transform: none !important;
        letter-spacing: normal !important;
        word-spacing: normal !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
        hyphens: none !important;
        animation: none !important;
        transition: none !important;
        appearance: none !important;
      }

      .ai-guardian-gsr-slot {
        all: initial !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        position: static !important;
        inset: auto !important;
        float: none !important;
        clear: both !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        margin: 6px 0 10px !important;
        padding: 0 !important;
        overflow: visible !important;
        isolation: isolate !important;
        contain: layout style paint !important;
        background: transparent !important;
        pointer-events: none !important;
        filter: none !important;
        backface-visibility: hidden !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        line-height: 1 !important;
        color-scheme: light dark !important;
        mix-blend-mode: normal !important;
      }

      .ai-guardian-gsr-badge-wrap {
        all: initial !important;
        display: inline-flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: flex-start !important;
        gap: 4px !important;
        position: static !important;
        inset: auto !important;
        float: none !important;
        clear: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: visible !important;
        vertical-align: top !important;
        isolation: isolate !important;
        contain: layout style paint !important;
        z-index: auto !important;
        background: transparent !important;
        pointer-events: none !important;
        filter: none !important;
        backface-visibility: hidden !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        line-height: 1 !important;
        color-scheme: light dark !important;
        mix-blend-mode: normal !important;
      }

      .ai-guardian-gsr-badge-chip {
        all: initial !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 24px !important;
        padding: 4px 10px !important;
        border-radius: 999px !important;
        border: 1px solid var(--ai-gsr-border, #9db5d3) !important;
        background: var(--ai-gsr-bg, #dce7f5) !important;
        color: var(--ai-gsr-text, #1f2632) !important;
        box-shadow: 0 1px 3px rgba(31, 38, 50, 0.08) !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
        text-decoration: none !important;
        -webkit-text-fill-color: currentColor !important;
        text-rendering: geometricPrecision !important;
      }

      .ai-guardian-gsr-identity-chip {
        all: initial !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 20px !important;
        max-width: 100% !important;
        padding: 3px 8px !important;
        border-radius: 999px !important;
        border: 1px solid #c6d4df !important;
        background: #eef4f8 !important;
        color: #315063 !important;
        box-shadow: 0 1px 2px rgba(31, 38, 50, 0.06) !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
        text-decoration: none !important;
        text-rendering: geometricPrecision !important;
        -webkit-text-fill-color: currentColor !important;
      }

      .ai-guardian-gsr-identity-chip[data-status="good"] {
        border-color: #a9c5b0 !important;
        background: #edf6ee !important;
        color: #254336 !important;
      }

      .ai-guardian-gsr-identity-chip[data-status="caution"] {
        border-color: #d2b67e !important;
        background: #fbf1d9 !important;
        color: #624613 !important;
      }

      .ai-guardian-gsr-identity-chip[data-status="warning"] {
        border-color: #d29a92 !important;
        background: #f7e1de !important;
        color: #6a2e27 !important;
      }

      .ai-guardian-gsr-badge-text {
        all: initial !important;
        display: inline !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        line-height: 1.2 !important;
        color: inherit !important;
        white-space: nowrap !important;
        text-decoration: none !important;
        -webkit-text-fill-color: currentColor !important;
      }

      .ai-guardian-mail-cue-slot,
      .ai-guardian-mail-cue-slot *,
      .ai-guardian-mail-cue-slot *::before,
      .ai-guardian-mail-cue-slot *::after {
        box-sizing: border-box !important;
        font: inherit !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        direction: ltr !important;
        unicode-bidi: isolate !important;
        transform: none !important;
        rotate: 0deg !important;
        scale: 1 !important;
        translate: 0 !important;
        text-transform: none !important;
        letter-spacing: normal !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
        hyphens: none !important;
        animation: none !important;
        transition: none !important;
        appearance: none !important;
      }

      .ai-guardian-mail-cue-slot {
        all: initial !important;
        display: inline-flex !important;
        vertical-align: middle !important;
        margin-left: 6px !important;
        position: static !important;
        isolation: isolate !important;
        contain: layout style paint !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        line-height: 1 !important;
        color-scheme: light dark !important;
        pointer-events: none !important;
      }

      .ai-guardian-mail-row-slot {
        margin-left: 8px !important;
      }

      .ai-guardian-mail-cue {
        all: initial !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 20px !important;
        padding: 3px 8px !important;
        border-radius: 999px !important;
        border: 1px solid #c8d5df !important;
        background: #eef4f8 !important;
        color: #2f5063 !important;
        box-shadow: 0 1px 2px rgba(31, 38, 50, 0.08) !important;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
        text-decoration: none !important;
        -webkit-text-fill-color: currentColor !important;
        pointer-events: none !important;
      }

      .ai-guardian-mail-cue[data-tone="safe"] {
        border-color: #a9c5b0 !important;
        background: #edf6ee !important;
        color: #254336 !important;
      }

      .ai-guardian-mail-cue[data-tone="caution"] {
        border-color: #d2b67e !important;
        background: #fbf1d9 !important;
        color: #624613 !important;
      }

      .ai-guardian-mail-cue[data-tone="risk"] {
        border-color: #d29a92 !important;
        background: #f7e1de !important;
        color: #6a2e27 !important;
      }

      @media (prefers-color-scheme: dark) {
        .ai-guardian-gsr-badge-chip {
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.24) !important;
        }

        .ai-guardian-mail-cue {
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2) !important;
        }
      }
    `;

    document.documentElement.appendChild(style);
  }

  window.aiGuardianEmailDeps = {
    normalizeHost,
    getRootDomain,
    resolveHttpUrl,
    getExactNavigationTargetHref,
    assessLinkElement,
    assessUrl,
    normalizeThreatText,
    findPhraseMatches,
    findBrandMention,
    isOfficialHostForBrand,
    isStrongBrandClaim,
    formatBrandName,
    formatQuotedExamples,
    clampScore,
    uniqueList,
    isVisibleElement,
    SIGNAL_WEIGHTS,
    SCORE_BASE,
    PUSHY_PHRASES,
    SIGN_IN_PAGE_HINTS,
    HIGH_RISK_PAGE_PHRASES,
    ACTION_PROMPT_WORDS,
    GENERIC_SSO_PATH_HINTS,
    syncEmailPreviewQuietly,
    requestEmailPreviewRefresh: () => {
      analyzePage({
        showPageWarnings: false,
        forceRefresh: true
      });
    }
  };
})();

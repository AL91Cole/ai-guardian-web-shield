// Detects supported email providers from hostname first, then lightweight UI clues.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  const WEBMAIL_TITLE_HINTS = [
    "gmail",
    "outlook",
    "yahoo mail",
    "proton mail",
    "icloud mail",
    "aol mail",
    "webmail",
    "mailbox",
    "inbox",
    "roundcube",
    "zimbra",
    "exchange"
  ];

  const GENERIC_PROVIDER_CONFIG = {
    id: "generic_webmail",
    providerLabel: "Secure webmail",
    supportTier: 2,
    rowPreviewMode: "adaptive",
      detection: {
        hostPrefixes: ["mail.", "webmail."],
        pathHints: [
        "/owa/",
        "/mail/",
        "/webmail/",
        "/exchange/",
        "/roundcube/",
        "/zimbra/",
        "/horde/",
        "/squirrelmail/",
        "/inbox/"
        ],
        uiSelectors: [
          "[aria-label*='mailboxes' i]",
          "[data-folder-name]",
          "button[aria-label*='compose mail' i]",
          "button[title*='compose mail' i]",
          "input[aria-label*='search mail' i]"
        ],
        uiTextHints: ["webmail", "inbox", "compose", "exchange", "roundcube", "zimbra"]
    },
    rowSelectors: [
      "[role='option']",
      "tr[role='row']",
      "div[role='row']",
      "[role='row']",
      "[data-message-id]",
      "[data-thread-id]",
      "[data-convid]",
      "li[data-message-id]"
    ],
    fields: {
      sender: ["[email]", "[data-hovercard-id]", "[data-email]", "[aria-label*='from' i]", "[class*='sender' i]"],
      subject: ["[data-test-id*='subject']", "[class*='subject' i]", "strong", "b"],
      snippet: ["[data-test-id*='snippet']", "[class*='snippet' i]", "[title]"]
    },
    openMessage: {
      messageBody: ["[role='document']", "[role='main']", ".message", ".mail-body", "main"],
      links: ["a[href]"],
      attachments: ["a[download]", "button[title*='Download' i]", "[data-attachment]", "a[href*='download' i]"],
      senderBlock: ["[email]", "[data-hovercard-id]", "[class*='sender' i]"],
      subject: ["h1", "h2", "[role='heading']"]
    },
    auth: {
      chooser: [
        "[data-identifier]",
        "[data-test-id*='account']",
        "[role='option'][data-value]",
        "[data-test-id*='account-picker']"
      ],
      email: [
        "input[type='email']",
        "input[name*='email' i]",
        "input[name*='user' i]",
        "input[name*='login' i]"
      ],
      password: ["input[type='password']"]
    },
    folders: ["div[role='tree'] [role='treeitem']", "nav a[title*='Inbox' i]", "[aria-label*='Folders' i]"],
    search: ["input[aria-label*='Search' i]", "input[placeholder*='Search' i]"],
    composeFields: ["[role='dialog'] textarea", "[role='dialog'] input[name*='subject' i]", "textarea[aria-label*='message' i]"],
    composeButtons: ["button[aria-label*='Compose' i]", "a[aria-label*='Compose' i]", "button[title*='Compose' i]"],
    maxRows: 24,
    maxLinks: 14
  };

  const PROVIDER_CONFIGS = {
    gmail: {
      id: "gmail",
      providerLabel: "Gmail",
      supportTier: 1,
      rowPreviewMode: "direct",
      detection: {
        hosts: ["mail.google.com"],
        authHosts: ["accounts.google.com"],
        uiSelectors: ["div[gh='cm']", "table[role='grid']", "div.aeF"],
        uiTextHints: ["gmail", "compose", "inbox"]
      },
      rowSelectors: ["tr.zA", "tr[role='row']", "div[role='row']"],
      fields: {
        sender: [".yP", ".zF"],
        subject: [".bog"],
        snippet: [".y2"],
        date: [".xW span", "[title][role='gridcell']"]
      },
      openMessage: {
        messageBody: [".a3s", "[role='listitem'] .a3s", ".adn.ads .a3s"],
        links: [".a3s a[href]", "[role='listitem'] .a3s a[href]", ".adn.ads .a3s a[href]"],
        attachments: [".aQH span", ".aZo", ".aQy", "a[href*='view=att' i]", "a[href*='attid=' i]"],
        senderBlock: [".gD", ".go"],
        subject: ["h2"]
      },
      auth: {
        chooser: ["div[role='listitem'][data-identifier]", "div[data-identifier]"],
        email: ["input[type='email']", "div[data-view-id] input[type='email']"],
        password: ["input[type='password']"]
      },
      folders: ["a[title='Inbox']", "div[role='navigation'] a", "div[gh='tl']"],
      search: ["input[aria-label*='Search mail' i]"],
      composeFields: ["div[role='dialog'] textarea[name='to']", "div[role='dialog'] input[name='subjectbox']"],
      composeButtons: ["div[gh='cm']", "button[aria-label*='Compose' i]"],
      maxRows: 24,
      maxLinks: 14
    },
    outlook: {
      id: "outlook",
      providerLabel: "Outlook Web",
      supportTier: 1,
      rowPreviewMode: "direct",
      detection: {
        hosts: ["outlook.live.com", "outlook.office.com", "outlook.office365.com"],
        authHosts: ["login.live.com", "login.microsoftonline.com"],
        uiSelectors: [
          "button[aria-label*='New mail' i]",
          "[aria-label*='Outlook' i]",
          "[aria-label*='Folders' i] [role='treeitem']",
          "[data-app-section='Mail']"
        ],
        uiTextHints: ["outlook", "focused", "other", "microsoft 365"]
      },
      rowSelectors: ["[role='option']", "[role='row']", "[data-convid]", "[aria-selected]"],
      fields: {
        sender: ["[title]", "[aria-label]"],
        subject: ["[data-testid='message-subject']", "span"],
        snippet: ["[data-testid='message-snippet']", "div[title]"]
      },
      openMessage: {
        messageBody: ["[role='document']", ".ReadingPaneContainer", "[data-app-section='MailReadCompose']", "main"],
        links: ["[role='document'] a[href]", "[data-app-section='MailReadCompose'] a[href]"],
        attachments: ["button[title*='Download' i]", "[data-testid*='attachment']", "a[download]"],
        senderBlock: ["[aria-label*='From' i]", "[title*='@']"],
        subject: ["[role='heading']", "h1", "h2"]
      },
      auth: {
        chooser: ["div[data-test-id='account-picker']", ".table", "div[role='option'][data-value]"],
        email: ["input[type='email']", "input[name='loginfmt']"],
        password: ["input[type='password']"]
      },
      folders: ["div[role='tree'] div[role='treeitem']", "button[aria-label*='Inbox' i]"],
      search: ["input[placeholder*='Search' i]", "input[aria-label*='Search' i]"],
      composeFields: ["div[aria-label*='Message body' i][contenteditable='true']", "input[aria-label*='Add a subject' i]"],
      composeButtons: ["button[aria-label*='New mail' i]", "button[title*='New mail' i]"],
      maxRows: 24,
      maxLinks: 14
    },
    yahoo: {
      id: "yahoo",
      providerLabel: "Yahoo Mail",
      supportTier: 1,
      rowPreviewMode: "direct",
      detection: {
        hosts: ["mail.yahoo.com"],
        authHosts: ["login.yahoo.com"],
        uiSelectors: ["a[data-test-id='compose-button']", "[data-test-id='message-list']", "[data-test-folder-name]"],
        uiTextHints: ["yahoo mail", "compose", "inbox"]
      },
      rowSelectors: ["[role='row']", "li[data-test-id='message-list-item']", "tr[role='row']"],
      fields: {
        sender: ["[data-test-id='sender']", ".sender"],
        subject: ["[data-test-id='message-subject']", ".subject"],
        snippet: ["[data-test-id='message-snippet']", ".snippet"]
      },
      openMessage: {
        messageBody: ["[data-test-id='message-view-body']", "[role='main']", "main"],
        links: ["[data-test-id='message-view-body'] a[href]", "main a[href]"],
        attachments: ["[data-test-id*='attachment']", "a[download]", "a[href*='download' i]"],
        senderBlock: ["[data-test-id='message-view-from']", "[title*='@']"],
        subject: ["h1", "[data-test-id='message-view-subject']"]
      },
      auth: {
        chooser: ["[data-test-id='account-switcher']", "li[data-username]", "body"],
        email: ["input[type='text']", "input[name='username']"],
        password: ["input[type='password']"]
      },
      folders: ["[data-test-folder-name]", "a[title='Inbox']"],
      search: ["input[aria-label*='Search mail' i]", "input[placeholder*='Search' i]"],
      composeFields: ["textarea[id*='compose-to']", "input[data-test-id='compose-subject']"],
      composeButtons: ["a[data-test-id='compose-button']", "button[aria-label*='Compose' i]"],
      maxRows: 24,
      maxLinks: 14
    },
    proton: {
      id: "proton",
      providerLabel: "Proton Mail",
      supportTier: 2,
      rowPreviewMode: "adaptive",
      detection: {
        hosts: ["mail.proton.me", "mail.protonmail.com"],
        authHosts: ["account.proton.me", "account.protonmail.com"],
        uiSelectors: ["[data-testid='navigation-list']", "[data-testid='composer:button']"],
        uiTextHints: ["proton mail", "inbox"]
      },
      rowSelectors: ["[data-testid*='message-row']", "[role='row']", "[data-shortcut-target='item-container']"],
      fields: {
        sender: ["[data-testid*='sender']", "[title*='@']"],
        subject: ["[data-testid*='subject']", "[class*='subject' i]"],
        snippet: ["[data-testid*='snippet']", "[class*='snippet' i]"]
      },
      openMessage: {
        messageBody: ["[data-testid='message-body']", "[role='document']", "main"],
        links: ["[data-testid='message-body'] a[href]", "main a[href]"],
        attachments: ["button[aria-label*='download' i]", "a[download]"],
        senderBlock: ["[data-testid*='message-sender']", "[title*='@']"],
        subject: ["[data-testid*='message-subject']", "h1", "h2"]
      },
      auth: {
        chooser: ["[data-testid*='account']", "[role='option']"],
        email: ["input[type='email']", "input[name*='username' i]"],
        password: ["input[type='password']"]
      },
      folders: ["[data-testid='navigation-list']", "[role='tree']"],
      search: ["input[placeholder*='Search' i]", "input[aria-label*='Search' i]"],
      composeFields: ["[data-testid='composer'] textarea", "[data-testid='composer'] input"],
      composeButtons: ["[data-testid='composer:button']", "button[aria-label*='Compose' i]"],
      maxRows: 28,
      maxLinks: 14
    },
    icloud: {
      id: "icloud",
      providerLabel: "iCloud Mail",
      supportTier: 2,
      rowPreviewMode: "adaptive",
      detection: {
        hosts: ["www.icloud.com"],
        authHosts: ["idmsa.apple.com", "appleid.apple.com"],
        pathHints: ["/mail"],
        uiSelectors: ["[aria-label*='Mailboxes' i]", "button[title*='Compose' i]"],
        uiTextHints: ["icloud mail", "mailboxes"]
      },
      rowSelectors: ["[role='row']", "[role='option']"],
      fields: {
        sender: ["[title*='@']", "[class*='sender' i]"],
        subject: ["[class*='subject' i]", "strong", "b"],
        snippet: ["[class*='snippet' i]", "[title]"]
      },
      openMessage: {
        messageBody: ["[role='document']", "main", "[aria-label*='Message' i]"],
        links: ["[role='document'] a[href]", "main a[href]"],
        attachments: ["button[aria-label*='download' i]", "a[download]"],
        senderBlock: ["[title*='@']", "[class*='sender' i]"],
        subject: ["h1", "h2", "[role='heading']"]
      },
      auth: {
        chooser: ["[data-testid*='account']", "[role='option']"],
        email: ["input[type='email']", "input[name*='apple' i]"],
        password: ["input[type='password']"]
      },
      folders: ["[aria-label*='Mailboxes' i]", "[role='tree']"],
      search: ["input[placeholder*='Search' i]", "input[aria-label*='Search' i]"],
      composeFields: ["[role='dialog'] textarea", "[role='dialog'] input"],
      composeButtons: ["button[title*='Compose' i]", "button[aria-label*='Compose' i]"],
      maxRows: 24,
      maxLinks: 14
    },
    aol: {
      id: "aol",
      providerLabel: "AOL Mail",
      supportTier: 2,
      rowPreviewMode: "adaptive",
      detection: {
        hosts: ["mail.aol.com"],
        authHosts: ["login.aol.com"],
        uiSelectors: ["a[data-test-id='compose-button']", "[data-test-folder-name]"],
        uiTextHints: ["aol mail", "inbox"]
      },
      rowSelectors: ["[data-test-id='message-list-item']", "li[data-test-id*='message']", "[role='option']"],
      fields: {
        sender: ["[data-test-id='sender']", ".sender"],
        subject: ["[data-test-id='message-subject']", ".subject"],
        snippet: ["[data-test-id='message-snippet']", ".snippet"]
      },
      openMessage: {
        messageBody: ["[role='article']", "[role='document']", "main"],
        links: ["[role='article'] a[href]", "main a[href]"],
        attachments: ["a[download]", "a[href*='download' i]"],
        senderBlock: ["[title*='@']", "[class*='sender' i]"],
        subject: ["h1", "h2", "[role='heading']"]
      },
      auth: {
        chooser: ["[data-testid*='account']", "[role='option']"],
        email: ["input[type='email']", "input[name*='username' i]"],
        password: ["input[type='password']"]
      },
      folders: ["[data-test-folder-name]", "[role='tree']"],
      search: ["input[placeholder*='Search' i]", "input[aria-label*='Search' i]"],
      composeFields: ["textarea[name='to']", "input[name='subject']"],
      composeButtons: ["a[data-test-id='compose-button']", "button[aria-label*='Compose' i]"],
      maxRows: 28,
      maxLinks: 14
    }
  };

  const PROVIDER_ORDER = [
    PROVIDER_CONFIGS.gmail,
    PROVIDER_CONFIGS.outlook,
    PROVIDER_CONFIGS.yahoo,
    PROVIDER_CONFIGS.proton,
    PROVIDER_CONFIGS.icloud,
    PROVIDER_CONFIGS.aol,
    GENERIC_PROVIDER_CONFIG
  ];

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  function normalizeHost(value) {
    const deps = getDeps();
    return typeof deps.normalizeHost === "function"
      ? deps.normalizeHost(value)
      : String(value || "").toLowerCase();
  }

  function getDetectionConfig(environment = {}) {
    return environment.detection || {};
  }

  function getProviderUiSelectors(environment) {
    return getDetectionConfig(environment).uiSelectors || [];
  }

  function getProviderUiTextHints(environment) {
    return getDetectionConfig(environment).uiTextHints || [];
  }

  function getComposeSelectors(environment) {
    return environment.composeFields || [];
  }

  function getComposeButtonSelectors(environment) {
    return environment.composeButtons || [];
  }

  function getFolderSelectors(environment) {
    return environment.folders || [];
  }

  function getSearchSelectors(environment) {
    return environment.search || [];
  }

  function getAttachmentViewSelectors(environment) {
    return environment.openMessage?.attachments || [];
  }

  function getAuthSelectors(environment) {
    return [
      ...(environment.auth?.password || []),
      ...(environment.auth?.email || [])
    ];
  }

  function getAccountChooserSelectors(environment) {
    return environment.auth?.chooser || [];
  }

  function getFieldSelectors(environment, fieldName) {
    return environment.fields?.[fieldName] || [];
  }

  function getOpenMessageSelectors(environment, sectionName) {
    return environment.openMessage?.[sectionName] || [];
  }

  function getGenericRowSelectors() {
    return GENERIC_PROVIDER_CONFIG.rowSelectors;
  }

  function getGenericMessageSelectors() {
    return GENERIC_PROVIDER_CONFIG.openMessage;
  }

  function looksLikeBrowserMail(hostname, pathname) {
    const normalizedTitle = String(document.title || "").toLowerCase();
    const bodyText = String(document.body?.innerText || "").toLowerCase().slice(0, 4000);
    const hostLooksMailLike =
      hostname.includes("mail") ||
      hostname.includes("webmail") ||
      hostname.includes("owa") ||
      pathname.includes("/mail") ||
      pathname.includes("/inbox") ||
      pathname.includes("/messages") ||
      pathname.includes("/owa");
    const titleLooksMailLike = WEBMAIL_TITLE_HINTS.some((hint) => normalizedTitle.includes(hint));
    const bodyLooksMailLike =
      (bodyText.includes("inbox") || bodyText.includes("mailbox")) &&
      (bodyText.includes("compose") || bodyText.includes("sent") || bodyText.includes("draft") || bodyText.includes("trash"));

    return hostLooksMailLike || titleLooksMailLike || bodyLooksMailLike;
  }

  function detectFallbackEnvironment(hostname, pathname) {
    if (!looksLikeBrowserMail(hostname, pathname)) {
      return null;
    }

    return {
      ...GENERIC_PROVIDER_CONFIG,
      id: "fallback-mail",
      providerLabel: "Secure browser mail",
      supportTier: 3,
      rowPreviewMode: "fallback"
    };
  }

  function hasProviderUiCues(environment) {
    const domUtils = emailNamespace.domUtils || {};
    const titleText = String(document.title || "").toLowerCase();
    const bodySample = String(document.body?.innerText || "").toLowerCase().slice(0, 2500);
    const visibleSelectorCount =
      typeof domUtils.countVisibleMatches === "function"
        ? domUtils.countVisibleMatches(getProviderUiSelectors(environment), 8)
        : 0;
    const matchedTextHints = getProviderUiTextHints(environment).filter((hint) => {
      return titleText.includes(hint) || bodySample.includes(hint);
    });
    const textHintCount = matchedTextHints.length;

    if (visibleSelectorCount >= 2) {
      return true;
    }

    if (visibleSelectorCount >= 1 && textHintCount >= 1) {
      return true;
    }

    return textHintCount >= 2;
  }

  function detectProvider(hostname = normalizeHost(location.hostname)) {
    const pathname = String(location.pathname || "").toLowerCase();
    const matchedEnvironment = PROVIDER_ORDER.find((environment) => {
      const detection = getDetectionConfig(environment);
      const matchesHost = Array.isArray(detection.hosts)
        ? detection.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
        : false;
      const matchesAuthHost = Array.isArray(detection.authHosts)
        ? detection.authHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
        : false;
      const matchesPrefix = Array.isArray(detection.hostPrefixes)
        ? detection.hostPrefixes.some((prefix) => hostname.startsWith(prefix))
        : false;
      const matchesPath = Array.isArray(detection.pathHints)
        ? detection.pathHints.some((pathHint) => pathname.includes(pathHint))
        : false;

      return matchesHost || matchesAuthHost || matchesPrefix || matchesPath;
    });

    if (matchedEnvironment) {
      const detection = getDetectionConfig(matchedEnvironment);
      const matchedSurface = Array.isArray(detection.authHosts) &&
        detection.authHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
        ? "auth"
        : "mail";

      return {
        environment: matchedEnvironment,
        detectedBy: matchedSurface === "auth" ? "auth-hostname" : "hostname",
        matchedSurface,
        matchConfidence: matchedEnvironment.supportTier === 1 ? "high" : "medium"
      };
    }

    const uiMatchedEnvironment = PROVIDER_ORDER.find((environment) => hasProviderUiCues(environment));

    if (uiMatchedEnvironment) {
      return {
        environment: uiMatchedEnvironment,
        detectedBy: "ui",
        matchedSurface: "mail",
        matchConfidence: uiMatchedEnvironment.supportTier === 1 ? "high" : "medium"
      };
    }

    const fallbackEnvironment = detectFallbackEnvironment(hostname, pathname);

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

  function getEnvironment(hostname = normalizeHost(location.hostname)) {
    const providerMatch = detectProvider(hostname);
    return providerMatch ? providerMatch.environment : null;
  }

  function resolveProviderConfig(providerId) {
    if (!providerId) {
      return GENERIC_PROVIDER_CONFIG;
    }

    return PROVIDER_CONFIGS[providerId] || GENERIC_PROVIDER_CONFIG;
  }

  emailNamespace.providerDetection = {
    PROVIDER_CONFIGS,
    PROVIDER_ORDER,
    GENERIC_PROVIDER_CONFIG,
    detectProvider,
    getEnvironment,
    hasProviderUiCues,
    detectFallbackEnvironment,
    looksLikeBrowserMail,
    getProviderUiSelectors,
    getProviderUiTextHints,
    getComposeSelectors,
    getComposeButtonSelectors,
    getFolderSelectors,
    getSearchSelectors,
    getAttachmentViewSelectors,
    getAuthSelectors,
    getAccountChooserSelectors,
    getFieldSelectors,
    getOpenMessageSelectors,
    getGenericRowSelectors,
    getGenericMessageSelectors,
    resolveProviderConfig
  };
})();

// This script powers the full side panel dashboard.
// The page itself shows the first warning, while this view explains why.

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

const PAGE_SCRIPT_FILES = Object.freeze([
  "content.js",
  "shared/debounce.js",
  "shared/domUtils.js",
  "shared/urlUtils.js",
  "email/emailState.js",
  "email/providerDetection.js",
  "email/emailHeuristics.js",
  "email/inboxRowScanner.js",
  "email/messageLinkScanner.js",
  "email/pageModeDetection.js",
  "email/authFlowHandler.js",
  "email/emailUiInjector.js",
  "email/emailSafetyController.js"
]);

const PROTECTION_LEVEL_COPY = {
  standard: "Standard Protection keeps everyday guidance balanced.",
  family: "Family Safe adds stronger filtering and calmer guidance for shared browsing.",
  child: "Child Safe uses stricter filtering and simpler safety prompts.",
  maximum: "Maximum Protection uses the strongest filtering and the earliest safety guidance."
};

const PROTECTION_STYLE_COPY = {
  balanced: "Balanced protection keeps warnings calm while still stepping in for higher-risk moments.",
  calmer: "Calmer guidance keeps the tone softer and more reassuring during warnings.",
  watchful: "Earlier warnings step in sooner when a page, link, or action needs extra care."
};

const ONBOARDING_PROTECTION_PRESET_SETTINGS = {
  standard: {
    protectionLevel: "standard",
    guidedProtectionModeEnabled: false,
    protectionStyle: "balanced",
    adultSiteBlockingEnabled: false
  },
  guided: {
    protectionLevel: "standard",
    guidedProtectionModeEnabled: true,
    protectionStyle: "calmer",
    adultSiteBlockingEnabled: false
  },
  family: {
    protectionLevel: "family",
    guidedProtectionModeEnabled: true,
    protectionStyle: "calmer",
    adultSiteBlockingEnabled: true
  },
  maximum: {
    protectionLevel: "maximum",
    guidedProtectionModeEnabled: true,
    protectionStyle: "watchful",
    adultSiteBlockingEnabled: true
  }
};

const ACCESSIBILITY_PROFILE_COPY = {
  general: "General support keeps wording simple and readable for most people.",
  reading: "Reading support helps with dyslexia, dysgraphia, or reading strain by favoring simpler wording and easier scanning.",
  vision: "Low vision support keeps stronger contrast and read-aloud tools closer at hand for blind or low-vision users.",
  hearing: "Text-first support keeps written guidance clear and easy to follow for deaf or hard-of-hearing users.",
  calm: "Calm support reduces pressure for autistic, anxious, or overwhelmed moments.",
  focus: "Focus support keeps steps shorter and easier to follow for ADHD or focus challenges.",
  older: "Older adult friendly mode keeps guidance slower, clearer, and easier for lower-tech moments."
};

const ONBOARDING_STEPS = [
  {
    title: "Welcome to AI Guardian Web Shield",
    body: "AI Guardian helps people browse more safely using clear guidance.",
    bullets: [
      "The page shows the first warning.",
      "This panel explains why in calmer detail."
    ]
  },
  {
    title: "What AI Guardian helps with",
    body: "AI Guardian helps with risky links, website safety, sign-in pages, suspicious downloads, email previews, and quick terms summaries.",
    bullets: [
      "Spot risky links before harm happens.",
      "Preview risk in supported email and search results."
    ]
  },
  {
    title: "How it speaks",
    body: "AI Guardian uses simple language instead of technical alerts.",
    bullets: [
      "Looks safe",
      "Check carefully",
      "Needs a closer look"
    ]
  },
  {
    title: "Privacy approach",
    body: "Safety checks try to stay inside your browser when possible. AI Guardian does not replace antivirus or VPN tools.",
    bullets: [
      "Local checks come first.",
      "Limits are explained in plain language."
    ]
  },
  {
    title: "Choose your protection style",
    body: "Choose the starting protection style that fits you best.",
    bullets: [
      "Standard protection is a good starting point.",
      "You can change this later any time."
    ],
    showsProtectionChoices: true
  },
  {
    title: "Accessibility options",
    body: "Choose reading and support settings that make this easier to use.",
    bullets: [
      "Large text, read aloud, extra simple language, high contrast, and reduced motion can help.",
      "Profiles can support reading struggles, low vision, hearing needs, calm support, focus help, or older-adult simplicity."
    ],
    showsAccessibilityChoices: true
  }
];

const refreshButton = document.getElementById("refreshButton");
const copyButton = document.getElementById("copyButton");
const readButton = document.getElementById("readButton");
const scoreBadge = document.getElementById("scoreBadge");
const scoreNumber = document.getElementById("scoreNumber");
const scoreLabel = document.getElementById("scoreLabel");
const statusSummary = document.getElementById("statusSummary");
const statusAdvice = document.getElementById("statusAdvice");
const reasonList = document.getElementById("reasonList");
const currentSiteLabel = document.getElementById("currentSiteLabel");
const heroReadShortcutButton = document.getElementById("heroReadShortcutButton");
const heroSettingsShortcutButton = document.getElementById("heroSettingsShortcutButton");
const seeAllSignalsButton = document.getElementById("seeAllSignalsButton");
const emailPreviewSummary = document.getElementById("emailPreviewSummary");
const emailPreviewProviderChip = document.getElementById("emailPreviewProviderChip");
const emailPreviewSupportChip = document.getElementById("emailPreviewSupportChip");
const emailPreviewViewChip = document.getElementById("emailPreviewViewChip");
const emailPreviewReasonsList = document.getElementById("emailPreviewReasonsList");
const emailPreviewAdvice = document.getElementById("emailPreviewAdvice");
const emailPreviewLinksList = document.getElementById("emailPreviewLinksList");
const pageTitle = document.getElementById("pageTitle");
const domainName = document.getElementById("domainName");
const cleanUrl = document.getElementById("cleanUrl");
const secureConnectionStatus = document.getElementById("secureConnectionStatus");
const secureConnectionValue = document.getElementById("secureConnectionValue");
const secureConnectionDetail = document.getElementById("secureConnectionDetail");
const addressCheckStatus = document.getElementById("addressCheckStatus");
const addressCheckValue = document.getElementById("addressCheckValue");
const addressCheckDetail = document.getElementById("addressCheckDetail");
const brandSimilarityStatus = document.getElementById("brandSimilarityStatus");
const brandSimilarityValue = document.getElementById("brandSimilarityValue");
const brandSimilarityDetail = document.getElementById("brandSimilarityDetail");
const signInTrustStatus = document.getElementById("signInTrustStatus");
const signInTrustValue = document.getElementById("signInTrustValue");
const signInTrustDetail = document.getElementById("signInTrustDetail");
const certificateVerificationStatus = document.getElementById("certificateVerificationStatus");
const certificateVerificationValue = document.getElementById("certificateVerificationValue");
const certificateVerificationDetail = document.getElementById("certificateVerificationDetail");
const siteIdentityNote = document.getElementById("siteIdentityNote");
const siteIdentityLimit = document.getElementById("siteIdentityLimit");
const flaggedLinksList = document.getElementById("flaggedLinksList");
const searchBadgesToggle = document.getElementById("searchBadgesToggle");
const floatingBadgeToggle = document.getElementById("floatingBadgeToggle");
const warningsToggle = document.getElementById("warningsToggle");
const readAloudToggle = document.getElementById("readAloudToggle");
const privacyShieldToggle = document.getElementById("privacyShieldToggle");
const labyrinthModeToggle = document.getElementById("labyrinthModeToggle");
const guidedProtectionModeToggle = document.getElementById("guidedProtectionModeToggle");
const slowdownStatusChip = document.getElementById("slowdownStatusChip");
const slowdownStatusText = document.getElementById("slowdownStatusText");
const adultSiteBlockingToggle = document.getElementById("adultSiteBlockingToggle");
const protectionLevelSelect = document.getElementById("protectionLevelSelect");
const familyLockChip = document.getElementById("familyLockChip");
const familySafetyLevelChip = document.getElementById("familySafetyLevelChip");
const familySettingsStateChip = document.getElementById("familySettingsStateChip");
const familyPageStatus = document.getElementById("familyPageStatus");
const familyLevelNote = document.getElementById("familyLevelNote");
const familyExceptionStatus = document.getElementById("familyExceptionStatus");
const familyProtectedHint = document.getElementById("familyProtectedHint");
const toggleCurrentSiteExceptionButton = document.getElementById("toggleCurrentSiteExceptionButton");
const familyLockStatus = document.getElementById("familyLockStatus");
const showPasscodeSetupButton = document.getElementById("showPasscodeSetupButton");
const showUnlockButton = document.getElementById("showUnlockButton");
const passcodeSetupPanel = document.getElementById("passcodeSetupPanel");
const unlockPasscodePanel = document.getElementById("unlockPasscodePanel");
const passcodePanelTitle = document.getElementById("passcodePanelTitle");
const currentPasscodeField = document.getElementById("currentPasscodeField");
const currentPasscodeInput = document.getElementById("currentPasscodeInput");
const newPasscodeInput = document.getElementById("newPasscodeInput");
const confirmPasscodeInput = document.getElementById("confirmPasscodeInput");
const unlockPasscodeInput = document.getElementById("unlockPasscodeInput");
const savePasscodeButton = document.getElementById("savePasscodeButton");
const cancelPasscodeSetupButton = document.getElementById("cancelPasscodeSetupButton");
const unlockPasscodeButton = document.getElementById("unlockPasscodeButton");
const cancelUnlockButton = document.getElementById("cancelUnlockButton");
const familyFeedback = document.getElementById("familyFeedback");
const trustedAdultAlertToggle = document.getElementById("trustedAdultAlertToggle");
const trustedAdultContactInput = document.getElementById("trustedAdultContactInput");
const familyHistoryList = document.getElementById("familyHistoryList");
const termsSummaryText = document.getElementById("termsSummaryText");
const termsSummaryList = document.getElementById("termsSummaryList");
const termsSummaryDisclaimer = document.getElementById("termsSummaryDisclaimer");
const onboardingCard = document.getElementById("onboardingCard");
const onboardingStepCount = document.getElementById("onboardingStepCount");
const onboardingStepTitle = document.getElementById("onboardingStepTitle");
const onboardingStepBody = document.getElementById("onboardingStepBody");
const onboardingStepList = document.getElementById("onboardingStepList");
const onboardingProtectionChoices = document.getElementById("onboardingProtectionChoices");
const onboardingAccessibilityChoices = document.getElementById("onboardingAccessibilityChoices");
const onboardingProtectionStyleSelect = document.getElementById("onboardingProtectionStyleSelect");
const onboardingAccessibilityProfileSelect = document.getElementById("onboardingAccessibilityProfileSelect");
const onboardingExtraSimpleToggle = document.getElementById("onboardingExtraSimpleToggle");
const onboardingBackButton = document.getElementById("onboardingBackButton");
const onboardingSkipButton = document.getElementById("onboardingSkipButton");
const onboardingNextButton = document.getElementById("onboardingNextButton");
const protectionStyleSelect = document.getElementById("protectionStyleSelect");
const protectionStyleNote = document.getElementById("protectionStyleNote");
const accessibilityProfileSelect = document.getElementById("accessibilityProfileSelect");
const accessibilityProfileNote = document.getElementById("accessibilityProfileNote");
const extraSimpleLanguageToggle = document.getElementById("extraSimpleLanguageToggle");
const lowStimulusModeToggle = document.getElementById("lowStimulusModeToggle");
const highContrastModeToggle = document.getElementById("highContrastModeToggle");
const largeTextModeToggle = document.getElementById("largeTextModeToggle");
const reducedClutterModeToggle = document.getElementById("reducedClutterModeToggle");
const reducedMotionModeToggle = document.getElementById("reducedMotionModeToggle");
const aboutReadPrinciplesButton = document.getElementById("aboutReadPrinciplesButton");
const aboutTransparencyButton = document.getElementById("aboutTransparencyButton");
const reopenOnboardingButton = document.getElementById("reopenOnboardingButton");
const termsSummaryReadButton = document.getElementById("termsSummaryReadButton");
const privacyStatementToggleButton = document.getElementById("privacyStatementToggleButton");
const privacyStatementFull = document.getElementById("privacyStatementFull");
const systemLimitationsToggleButton = document.getElementById("systemLimitationsToggleButton");
const systemLimitationsFull = document.getElementById("systemLimitationsFull");
const ethicsShortViewButton = document.getElementById("ethicsShortViewButton");
const ethicsEasyViewButton = document.getElementById("ethicsEasyViewButton");
const ethicsShortView = document.getElementById("ethicsShortView");
const ethicsEasyView = document.getElementById("ethicsEasyView");
const ethicsReadFullButton = document.getElementById("ethicsReadFullButton");
const ethicsFullCard = document.getElementById("ethicsFullCard");
const ethicsHideFullButton = document.getElementById("ethicsHideFullButton");
const isSidePanelView = window.location.pathname.endsWith("sidepanel.html");

const BAND_CLASS = {
  safe: "tone-safe",
  low: "tone-low",
  medium: "tone-medium",
  high: "tone-high",
  risk: "tone-risk",
  unknown: "tone-unknown"
};

let lastReport = null;
let currentSpeech = null;
let currentSettings = {
  ...DEFAULT_SETTINGS
};
let familyProtectionState = {
  hasPasscode: false,
  isUnlocked: false,
  unlockExpiresAt: 0,
  cooldownUntil: 0,
  passcodeCooldownUntil: 0,
  pendingProtectionLevel: "",
  settingsHistory: []
};
let guardianEthicsView = "short";
let onboardingStepIndex = 0;
let onboardingVisible = false;
let showAllSignals = false;

document.addEventListener("DOMContentLoaded", async () => {
  refreshButton.addEventListener("click", () => loadReport(true));
  copyButton.addEventListener("click", handleCopyCleanLink);
  readButton.addEventListener("click", handleReadAloudClick);
  heroReadShortcutButton?.addEventListener("click", handleReadAloudClick);
  heroSettingsShortcutButton?.addEventListener("click", () => scrollToSettingsCard());
  seeAllSignalsButton?.addEventListener("click", handleSeeAllSignalsClick);
  searchBadgesToggle.addEventListener("change", async () => updateSetting("searchBadgesEnabled", searchBadgesToggle.checked));
  floatingBadgeToggle.addEventListener("change", async () => updateSetting("floatingBadgeEnabled", floatingBadgeToggle.checked));
  warningsToggle.addEventListener("change", async () => updateSetting("proactiveWarningsEnabled", warningsToggle.checked));
  readAloudToggle.addEventListener("change", handleReadAloudToggleChange);
  privacyShieldToggle.addEventListener("change", async () => updateSetting("privacyShieldEnabled", privacyShieldToggle.checked));
  labyrinthModeToggle.addEventListener("change", async () => updateSetting("labyrinthModeEnabled", labyrinthModeToggle.checked));
  guidedProtectionModeToggle.addEventListener("change", async () => updateSetting("guidedProtectionModeEnabled", guidedProtectionModeToggle.checked));
  protectionStyleSelect?.addEventListener("change", async () => updateSetting("protectionStyle", protectionStyleSelect.value));
  accessibilityProfileSelect?.addEventListener("change", async () => updateSetting("accessibilityProfile", accessibilityProfileSelect.value));
  extraSimpleLanguageToggle?.addEventListener("change", async () => updateSetting("extraSimpleLanguageEnabled", extraSimpleLanguageToggle.checked));
  lowStimulusModeToggle?.addEventListener("change", async () => updateSetting("lowStimulusModeEnabled", lowStimulusModeToggle.checked));
  highContrastModeToggle?.addEventListener("change", async () => updateSetting("highContrastModeEnabled", highContrastModeToggle.checked));
  largeTextModeToggle?.addEventListener("change", async () => updateSetting("largeTextModeEnabled", largeTextModeToggle.checked));
  reducedClutterModeToggle?.addEventListener("change", async () => updateSetting("reducedClutterModeEnabled", reducedClutterModeToggle.checked));
  reducedMotionModeToggle?.addEventListener("change", async () => updateSetting("reducedMotionModeEnabled", reducedMotionModeToggle.checked));
  adultSiteBlockingToggle.addEventListener("change", async () => updateSetting("adultSiteBlockingEnabled", adultSiteBlockingToggle.checked));
  protectionLevelSelect.addEventListener("change", async () => updateSetting("protectionLevel", protectionLevelSelect.value));
  toggleCurrentSiteExceptionButton.addEventListener("click", handleCurrentSiteExceptionClick);
  showPasscodeSetupButton.addEventListener("click", handlePasscodeSetupButtonClick);
  showUnlockButton.addEventListener("click", handleUnlockButtonClick);
  savePasscodeButton.addEventListener("click", handleSavePasscodeClick);
  cancelPasscodeSetupButton.addEventListener("click", closePasscodeSetupPanel);
  unlockPasscodeButton.addEventListener("click", handleUnlockPasscodeClick);
  cancelUnlockButton.addEventListener("click", closeUnlockPanel);
  trustedAdultAlertToggle.addEventListener("change", async () => updateSetting("trustedAdultAlertEnabled", trustedAdultAlertToggle.checked));
  trustedAdultContactInput.addEventListener("change", async () => updateSetting("trustedAdultContact", trustedAdultContactInput.value.trim()));
  ethicsShortViewButton?.addEventListener("click", () => setGuardianEthicsView("short"));
  ethicsEasyViewButton?.addEventListener("click", () => setGuardianEthicsView("easy"));
  ethicsReadFullButton?.addEventListener("click", () => toggleGuardianEthicsFullCard());
  ethicsHideFullButton?.addEventListener("click", () => toggleGuardianEthicsFullCard(false));
  privacyStatementToggleButton?.addEventListener("click", () => togglePrivacyStatement());
  systemLimitationsToggleButton?.addEventListener("click", () => toggleSystemLimitations());
  aboutReadPrinciplesButton?.addEventListener("click", () => toggleGuardianEthicsFullCard(true));
  aboutTransparencyButton?.addEventListener("click", () => openTransparencyCard());
  reopenOnboardingButton?.addEventListener("click", () => reopenOnboardingGuide());
  termsSummaryReadButton?.addEventListener("click", () => focusTermsSummary());
  onboardingBackButton?.addEventListener("click", handleOnboardingBackClick);
  onboardingNextButton?.addEventListener("click", handleOnboardingNextClick);
  onboardingSkipButton?.addEventListener("click", handleOnboardingSkipClick);

  renderGuardianEthicsPrinciples();
  await loadStoredSettings();
  await loadFamilyProtectionState();
  await loadReport(false);
  startSidePanelSyncIfNeeded();
});

window.addEventListener("beforeunload", stopReading);

async function loadStoredSettings() {
  const storedSettings = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  applySettings({
    ...DEFAULT_SETTINGS,
    ...storedSettings
  });
}

function applySettings(settings) {
  currentSettings = {
    ...DEFAULT_SETTINGS,
    ...settings
  };
  searchBadgesToggle.checked = Boolean(settings.searchBadgesEnabled);
  floatingBadgeToggle.checked = Boolean(settings.floatingBadgeEnabled);
  warningsToggle.checked = Boolean(settings.proactiveWarningsEnabled);
  readAloudToggle.checked = Boolean(settings.readAloudEnabled);
  privacyShieldToggle.checked = Boolean(settings.privacyShieldEnabled);
  labyrinthModeToggle.checked = Boolean(settings.labyrinthModeEnabled);
  guidedProtectionModeToggle.checked = Boolean(settings.guidedProtectionModeEnabled);
  guidedProtectionModeToggle.disabled = !settings.labyrinthModeEnabled;
  if (protectionStyleSelect) {
    protectionStyleSelect.value = settings.protectionStyle || DEFAULT_SETTINGS.protectionStyle;
  }
  if (accessibilityProfileSelect) {
    accessibilityProfileSelect.value = settings.accessibilityProfile || DEFAULT_SETTINGS.accessibilityProfile;
  }
  if (extraSimpleLanguageToggle) {
    extraSimpleLanguageToggle.checked = Boolean(settings.extraSimpleLanguageEnabled);
  }
  if (lowStimulusModeToggle) {
    lowStimulusModeToggle.checked = Boolean(settings.lowStimulusModeEnabled);
  }
  if (highContrastModeToggle) {
    highContrastModeToggle.checked = Boolean(settings.highContrastModeEnabled);
  }
  if (largeTextModeToggle) {
    largeTextModeToggle.checked = Boolean(settings.largeTextModeEnabled);
  }
  if (reducedClutterModeToggle) {
    reducedClutterModeToggle.checked = Boolean(settings.reducedClutterModeEnabled);
  }
  if (reducedMotionModeToggle) {
    reducedMotionModeToggle.checked = Boolean(settings.reducedMotionModeEnabled);
  }
  adultSiteBlockingToggle.checked = Boolean(settings.adultSiteBlockingEnabled);
  protectionLevelSelect.value = settings.protectionLevel || DEFAULT_SETTINGS.protectionLevel;
  trustedAdultAlertToggle.checked = Boolean(settings.trustedAdultAlertEnabled);
  trustedAdultContactInput.value = settings.trustedAdultContact || "";
  updateReadButtonAvailability();
  renderProtectionStyleNote();
  renderAccessibilitySupport();
  applyAccessibilityViewState();
  renderOnboardingFlow();
  renderSlowdownCard();
  renderFamilyProtectionPanel();
}

async function updateSetting(key, value) {
  const response = await chrome.runtime.sendMessage({
    type: "UPDATE_SETTING_GUARDED",
    key,
    value
  });

  if (response && response.ok) {
    applySettings(response.settings || {
      ...currentSettings,
      [key]: value
    });
    if (response.familyState) {
      applyFamilyProtectionState(response.familyState);
    }
    clearFamilyFeedback();
    return response;
  }

  await loadStoredSettings();
  await loadFamilyProtectionState();

  if (response && response.locked) {
    showFamilyFeedback(response.message || "This setting is locked. Enter your passcode first.");
    if (familyProtectionState.hasPasscode) {
      openUnlockPanel();
    } else {
      handlePasscodeSetupButtonClick();
    }
  } else if (response && response.message) {
    showFamilyFeedback(response.message);
  }

  return response;
}

async function handleReadAloudToggleChange() {
  await updateSetting("readAloudEnabled", readAloudToggle.checked);
  updateReadButtonAvailability();
}

async function loadFamilyProtectionState() {
  const response = await chrome.runtime.sendMessage({
    type: "GET_FAMILY_PROTECTION_STATE"
  });

  applyFamilyProtectionState(response && response.ok ? response : familyProtectionState);
}

function applyFamilyProtectionState(state) {
  familyProtectionState = {
    hasPasscode: Boolean(state.hasPasscode),
    isUnlocked: Boolean(state.isUnlocked),
    unlockExpiresAt: Number(state.unlockExpiresAt || 0),
    cooldownUntil: Number(state.cooldownUntil || 0),
    passcodeCooldownUntil: Number(state.passcodeCooldownUntil || 0),
    pendingProtectionLevel: state.pendingProtectionLevel || "",
    settingsHistory: Array.isArray(state.settingsHistory) ? state.settingsHistory : []
  };

  renderFamilyProtectionPanel();
}

function renderFamilyProtectionPanel() {
  const level = currentSettings.protectionLevel || DEFAULT_SETTINGS.protectionLevel;
  const reportFamilyInfo = lastReport?.familyProtection || null;
  const adultBlockingEnabled = Boolean(currentSettings.adultSiteBlockingEnabled);
  const isRestricted = Boolean(reportFamilyInfo && reportFamilyInfo.currentPageRestricted);
  const currentRootDomain = getCurrentRootDomain();
  const exceptions = Array.isArray(currentSettings.familyProtectionExceptions)
    ? currentSettings.familyProtectionExceptions
    : [];
  const currentSiteAllowed = Boolean(currentRootDomain && exceptions.includes(currentRootDomain));

  familyLevelNote.textContent =
    reportFamilyInfo?.levelNote || PROTECTION_LEVEL_COPY[level] || PROTECTION_LEVEL_COPY.standard;
  setChipState(familySafetyLevelChip, formatProtectionLevelLabel(level), adultBlockingEnabled ? "ready" : "open");

  if (isRestricted) {
    familyPageStatus.textContent = reportFamilyInfo.currentPageMessage;
  } else if (adultBlockingEnabled) {
    familyPageStatus.textContent = "Adult site blocking is on for this browser.";
  } else {
    familyPageStatus.textContent = "Adult site blocking is off right now.";
  }

  if (!currentRootDomain) {
    familyExceptionStatus.textContent = "Open a normal website to manage an exception.";
    toggleCurrentSiteExceptionButton.disabled = true;
    toggleCurrentSiteExceptionButton.textContent = "Allow This Site";
  } else if (currentSiteAllowed) {
    familyExceptionStatus.textContent = `${currentRootDomain} is allowed as a site exception.`;
    toggleCurrentSiteExceptionButton.disabled = false;
    toggleCurrentSiteExceptionButton.textContent = "Remove Exception";
  } else {
    familyExceptionStatus.textContent = `${currentRootDomain} follows the current Family Protection rules.`;
    toggleCurrentSiteExceptionButton.disabled = false;
    toggleCurrentSiteExceptionButton.textContent = "Allow This Site";
  }

  if (!familyProtectionState.hasPasscode) {
    setChipState(familyLockChip, "No lock", "off");
    setChipState(familySettingsStateChip, "No lock", "off");
    familyLockStatus.textContent = "No passcode is set yet.";
    familyProtectedHint.textContent = "Set a passcode if you want these important settings protected.";
    showUnlockButton.hidden = true;
    showPasscodeSetupButton.textContent = "Set Passcode";
  } else if (familyProtectionState.isUnlocked) {
    setChipState(familyLockChip, "Unlocked", "open");
    setChipState(familySettingsStateChip, "Open now", "open");
    familyLockStatus.textContent = "Protected settings are unlocked for a short time.";
    familyProtectedHint.textContent = "These important settings are open for a short time and will lock again soon.";
    showUnlockButton.hidden = true;
    showPasscodeSetupButton.textContent = "Change Passcode";
  } else {
    setChipState(familyLockChip, "Locked", "locked");
    setChipState(familySettingsStateChip, "Locked now", "locked");
    familyLockStatus.textContent = "Protected settings need the passcode before important changes.";
    familyProtectedHint.textContent = "These important settings are locked right now. Use the passcode before changing them.";
    showUnlockButton.hidden = false;
    showPasscodeSetupButton.textContent = "Change Passcode";
  }

  if (currentPasscodeField) {
    currentPasscodeField.hidden = !familyProtectionState.hasPasscode;
  }

  if (passcodePanelTitle) {
    passcodePanelTitle.textContent = "Change Passcode";
  }

  if (
    familyProtectionState.cooldownUntil > Date.now() &&
    familyProtectionState.pendingProtectionLevel
  ) {
    familyFeedback.textContent = `Please wait a moment before lowering protection to ${formatProtectionLevelLabel(
      familyProtectionState.pendingProtectionLevel
    )}.`;
  } else if (familyProtectionState.passcodeCooldownUntil > Date.now()) {
    familyFeedback.textContent = "Please wait a short moment before trying the passcode again.";
  }

  renderFamilyHistory();
}

function renderSlowdownCard() {
  if (!slowdownStatusChip || !slowdownStatusText) {
    return;
  }

  if (!currentSettings.labyrinthModeEnabled) {
    setChipState(slowdownStatusChip, "Off", "off");
    slowdownStatusText.textContent =
      "Turn on Labyrinth Mode if you want a calmer pause when browsing starts to look risky.";
    return;
  }

  if (!currentSettings.proactiveWarningsEnabled) {
    setChipState(slowdownStatusChip, "Paused", "caution");
    slowdownStatusText.textContent =
      "Slowdown prompts are waiting, but risky-action warnings are off right now.";
    return;
  }

  if (currentSettings.guidedProtectionModeEnabled) {
    setChipState(slowdownStatusChip, "Ready", "ready");
    slowdownStatusText.textContent =
      "If several risky clicks or fast page changes happen, AI Guardian can slow things down and highlight the safest option.";
    return;
  }

  setChipState(slowdownStatusChip, "Ready", "ready");
  slowdownStatusText.textContent =
    "If browsing gets risky fast, AI Guardian can pause the flow and explain the next safer step.";
}

function setGuardianEthicsView(view) {
  guardianEthicsView = view === "easy" ? "easy" : "short";
  renderGuardianEthicsPrinciples();
}

function toggleGuardianEthicsFullCard(forceOpen) {
  if (!ethicsFullCard || !ethicsReadFullButton) {
    return;
  }

  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : ethicsFullCard.hidden;
  ethicsFullCard.hidden = !shouldOpen;
  ethicsReadFullButton.textContent = shouldOpen ? "Hide Full Principles" : "Read Full Principles";
  ethicsReadFullButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");

  if (shouldOpen) {
    ethicsFullCard.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function renderGuardianEthicsPrinciples() {
  if (!ethicsShortViewButton || !ethicsEasyViewButton || !ethicsShortView || !ethicsEasyView || !ethicsReadFullButton) {
    return;
  }

  const showingEasyView = guardianEthicsView === "easy";

  ethicsShortView.hidden = showingEasyView;
  ethicsEasyView.hidden = !showingEasyView;
  ethicsShortViewButton.classList.toggle("is-active", !showingEasyView);
  ethicsEasyViewButton.classList.toggle("is-active", showingEasyView);
  ethicsShortViewButton.setAttribute("aria-pressed", showingEasyView ? "false" : "true");
  ethicsEasyViewButton.setAttribute("aria-pressed", showingEasyView ? "true" : "false");

  if (ethicsFullCard) {
    ethicsReadFullButton.textContent = ethicsFullCard.hidden ? "Read Full Principles" : "Hide Full Principles";
    ethicsReadFullButton.setAttribute("aria-expanded", ethicsFullCard.hidden ? "false" : "true");
  }
}

function renderProtectionStyleNote() {
  if (!protectionStyleNote) {
    return;
  }

  protectionStyleNote.textContent =
    PROTECTION_STYLE_COPY[currentSettings.protectionStyle] || PROTECTION_STYLE_COPY.balanced;
}

function renderAccessibilitySupport() {
  if (!accessibilityProfileNote) {
    return;
  }

  accessibilityProfileNote.textContent =
    ACCESSIBILITY_PROFILE_COPY[currentSettings.accessibilityProfile] || ACCESSIBILITY_PROFILE_COPY.general;
}

function applyAccessibilityViewState() {
  document.body.classList.toggle("accessibility-extra-simple", Boolean(currentSettings.extraSimpleLanguageEnabled));
  document.body.classList.toggle("accessibility-low-stimulus", Boolean(currentSettings.lowStimulusModeEnabled));
  document.body.classList.toggle("accessibility-high-contrast", Boolean(currentSettings.highContrastModeEnabled));
  document.body.classList.toggle("accessibility-large-text", Boolean(currentSettings.largeTextModeEnabled));
  document.body.classList.toggle("accessibility-reduced-clutter", Boolean(currentSettings.reducedClutterModeEnabled));
  document.body.classList.toggle("accessibility-reduced-motion", Boolean(currentSettings.reducedMotionModeEnabled));
}

function renderOnboardingFlow() {
  if (!onboardingCard || !onboardingStepTitle || !onboardingStepBody || !onboardingStepList) {
    return;
  }

  onboardingVisible = !currentSettings.onboardingCompleted;
  onboardingCard.hidden = !onboardingVisible;

  if (!onboardingVisible) {
    return;
  }

  const step = ONBOARDING_STEPS[Math.min(onboardingStepIndex, ONBOARDING_STEPS.length - 1)];

  onboardingStepCount.textContent = `Step ${onboardingStepIndex + 1} of ${ONBOARDING_STEPS.length}`;
  onboardingStepTitle.textContent = step.title;
  onboardingStepBody.textContent = step.body;
  onboardingStepList.innerHTML = "";
  step.bullets.forEach((bullet) => {
    const item = document.createElement("li");
    item.textContent = bullet;
    onboardingStepList.appendChild(item);
  });

  if (onboardingProtectionChoices) {
    onboardingProtectionChoices.hidden = !step.showsProtectionChoices;
  }

  if (onboardingAccessibilityChoices) {
    onboardingAccessibilityChoices.hidden = !step.showsAccessibilityChoices;
  }

  if (onboardingProtectionStyleSelect) {
    onboardingProtectionStyleSelect.value = getOnboardingProtectionPresetValue();
  }

  if (onboardingAccessibilityProfileSelect) {
    onboardingAccessibilityProfileSelect.value = currentSettings.accessibilityProfile || DEFAULT_SETTINGS.accessibilityProfile;
  }

  if (onboardingExtraSimpleToggle) {
    onboardingExtraSimpleToggle.checked = Boolean(currentSettings.extraSimpleLanguageEnabled);
  }

  if (onboardingBackButton) {
    onboardingBackButton.disabled = onboardingStepIndex === 0;
  }

  if (onboardingNextButton) {
    if (onboardingStepIndex === 0) {
      onboardingNextButton.textContent = "Get Started";
    } else if (onboardingStepIndex === 4) {
      onboardingNextButton.textContent = "Continue";
    } else if (onboardingStepIndex >= ONBOARDING_STEPS.length - 1) {
      onboardingNextButton.textContent = "Finish Setup";
    } else {
      onboardingNextButton.textContent = "Next";
    }
  }
}

function getOnboardingProtectionPresetValue() {
  if (currentSettings.protectionLevel === "maximum") {
    return "maximum";
  }

  if (currentSettings.protectionLevel === "family") {
    return "family";
  }

  if (currentSettings.guidedProtectionModeEnabled) {
    return "guided";
  }

  return "standard";
}

function reopenOnboardingGuide() {
  onboardingStepIndex = 0;
  currentSettings.onboardingCompleted = false;
  renderOnboardingFlow();
  onboardingCard?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function handleOnboardingBackClick() {
  onboardingStepIndex = Math.max(0, onboardingStepIndex - 1);
  renderOnboardingFlow();
}

async function handleOnboardingNextClick() {
  if (onboardingStepIndex < ONBOARDING_STEPS.length - 1) {
    onboardingStepIndex += 1;
    renderOnboardingFlow();
    return;
  }

  await finishOnboardingGuide(false);
}

async function handleOnboardingSkipClick() {
  await finishOnboardingGuide(true);
}

async function finishOnboardingGuide(skipped) {
  const preset = onboardingProtectionStyleSelect?.value || getOnboardingProtectionPresetValue();
  const nextAccessibilityProfile =
    onboardingAccessibilityProfileSelect?.value || currentSettings.accessibilityProfile || DEFAULT_SETTINGS.accessibilityProfile;
  const nextExtraSimple = Boolean(onboardingExtraSimpleToggle?.checked);

  if (!skipped) {
    const onboardingPresetSettings =
      ONBOARDING_PROTECTION_PRESET_SETTINGS[preset] || ONBOARDING_PROTECTION_PRESET_SETTINGS.standard;
    await updateSetting("protectionLevel", onboardingPresetSettings.protectionLevel);
    await updateSetting("guidedProtectionModeEnabled", onboardingPresetSettings.guidedProtectionModeEnabled);
    await updateSetting("protectionStyle", onboardingPresetSettings.protectionStyle);
    await updateSetting("adultSiteBlockingEnabled", onboardingPresetSettings.adultSiteBlockingEnabled);
    await updateSetting("accessibilityProfile", nextAccessibilityProfile);
    await updateSetting("extraSimpleLanguageEnabled", nextExtraSimple);
  }

  await updateSetting("onboardingCompleted", true);
  onboardingStepIndex = 0;
  currentSettings.onboardingCompleted = true;
  renderOnboardingFlow();
}

function togglePrivacyStatement(forceOpen) {
  if (!privacyStatementFull || !privacyStatementToggleButton) {
    return;
  }

  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : privacyStatementFull.hidden;
  privacyStatementFull.hidden = !shouldOpen;
  privacyStatementToggleButton.textContent = shouldOpen ? "Hide Full Privacy Statement" : "Read Full Privacy Statement";
  privacyStatementToggleButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function toggleSystemLimitations(forceOpen) {
  if (!systemLimitationsFull || !systemLimitationsToggleButton) {
    return;
  }

  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : systemLimitationsFull.hidden;
  systemLimitationsFull.hidden = !shouldOpen;
  systemLimitationsToggleButton.textContent = shouldOpen ? "Hide System Limitations" : "System Limitations";
  systemLimitationsToggleButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function openTransparencyCard() {
  togglePrivacyStatement(true);
  toggleSystemLimitations(true);
  const transparencyCard = document.getElementById("transparencyCard");
  transparencyCard?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function scrollToSettingsCard() {
  const settingsCard = document.getElementById("settingsHeading");
  settingsCard?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function focusTermsSummary() {
  const termsCard = document.getElementById("termsSummaryHeading");
  termsCard?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function handleSeeAllSignalsClick() {
  showAllSignals = !showAllSignals;
  renderReasonList(lastReport?.reasons || []);
}

async function handleCurrentSiteExceptionClick() {
  const currentRootDomain = getCurrentRootDomain();

  if (!currentRootDomain) {
    showFamilyFeedback("Open a normal website before adding an exception.");
    return;
  }

  const exceptions = Array.isArray(currentSettings.familyProtectionExceptions)
    ? [...currentSettings.familyProtectionExceptions]
    : [];
  const currentSiteAllowed = exceptions.includes(currentRootDomain);
  const nextExceptions = currentSiteAllowed
    ? exceptions.filter((item) => item !== currentRootDomain)
    : [...exceptions, currentRootDomain].sort();
  const response = await updateSetting("familyProtectionExceptions", nextExceptions);

  if (response && response.ok) {
    showFamilyFeedback(
      currentSiteAllowed
        ? `${currentRootDomain} now follows Family Protection again.`
        : `${currentRootDomain} was added as a site exception.`
    );
  }
}

function renderFamilyHistory() {
  familyHistoryList.innerHTML = "";
  const entries = Array.isArray(familyProtectionState.settingsHistory)
    ? familyProtectionState.settingsHistory.slice(0, 5)
    : [];

  if (!entries.length) {
    const item = document.createElement("li");
    item.className = "empty-state";
    item.textContent = "Important Family Protection changes will appear here.";
    familyHistoryList.appendChild(item);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("li");
    const timeLabel = formatHistoryTime(entry.timestamp);
    const alertNote = entry.trustedAdultAlert
      ? ` Local reminder for ${entry.trustedAdultContact || "a trusted adult"} is on.`
      : "";
    item.textContent = `${timeLabel}: ${entry.note || "A family safety setting changed."}${alertNote}`;
    familyHistoryList.appendChild(item);
  });
}

function getCurrentRootDomain() {
  const domain = lastReport?.domain;

  if (!domain || domain === "Unavailable") {
    return "";
  }

  const hostParts = String(domain).toLowerCase().split(".").filter(Boolean);

  if (hostParts.length <= 2) {
    return String(domain).toLowerCase();
  }

  return hostParts.slice(-2).join(".");
}

function formatProtectionLevelLabel(level) {
  if (level === "family") {
    return "Family Safe";
  }

  if (level === "child") {
    return "Child Safe";
  }

  if (level === "maximum") {
    return "Maximum Protection";
  }

  return "Standard Protection";
}

function formatHistoryTime(timestamp) {
  if (!timestamp) {
    return "Recently";
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function setChipState(element, text, tone) {
  if (!element) {
    return;
  }

  element.textContent = text;

  if (tone) {
    element.dataset.tone = tone;
  } else {
    delete element.dataset.tone;
  }
}

function handlePasscodeSetupButtonClick() {
  closeUnlockPanel();
  passcodeSetupPanel.hidden = false;
  if (familyProtectionState.hasPasscode && currentPasscodeInput) {
    currentPasscodeInput.focus();
  } else {
    newPasscodeInput.focus();
  }
}

function handleUnlockButtonClick() {
  openUnlockPanel();
}

async function handleSavePasscodeClick() {
  const currentPasscode = currentPasscodeInput ? currentPasscodeInput.value.trim() : "";
  const newPasscode = newPasscodeInput.value.trim();
  const confirmPasscode = confirmPasscodeInput.value.trim();

  if (familyProtectionState.hasPasscode && !/^\d{4,8}$/.test(currentPasscode)) {
    showFamilyFeedback("Enter your current 4 to 8 digit passcode first.");
    currentPasscodeInput.focus();
    return;
  }

  if (!/^\d{4,8}$/.test(newPasscode)) {
    showFamilyFeedback("Use a 4 to 8 digit new passcode.");
    newPasscodeInput.focus();
    return;
  }

  if (newPasscode !== confirmPasscode) {
    showFamilyFeedback("Those passcodes did not match.");
    confirmPasscodeInput.focus();
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "SET_FAMILY_PROTECTION_PASSCODE",
    currentPasscode,
    newPasscode
  });

  if (response && response.ok) {
    if (currentPasscodeInput) {
      currentPasscodeInput.value = "";
    }
    newPasscodeInput.value = "";
    confirmPasscodeInput.value = "";
    closePasscodeSetupPanel();
    await loadFamilyProtectionState();
    showFamilyFeedback(response.message || "Passcode saved.");
    return;
  }

  showFamilyFeedback((response && response.message) || "We could not save the passcode.");
}

async function handleUnlockPasscodeClick() {
  const passcode = unlockPasscodeInput.value.trim();

  if (!/^\d{4,8}$/.test(passcode)) {
    showFamilyFeedback("Use the same 4 to 8 digit passcode.");
    unlockPasscodeInput.focus();
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "UNLOCK_FAMILY_PROTECTION",
    passcode
  });

  if (response && response.ok) {
    unlockPasscodeInput.value = "";
    closeUnlockPanel();
    applyFamilyProtectionState(response);
    showFamilyFeedback(response.message || "Protected settings are unlocked.");
    return;
  }

  showFamilyFeedback((response && response.message) || "That passcode did not match.");
}

function openUnlockPanel() {
  closePasscodeSetupPanel();
  unlockPasscodePanel.hidden = false;
  unlockPasscodeInput.focus();
}

function closePasscodeSetupPanel() {
  passcodeSetupPanel.hidden = true;
  if (currentPasscodeInput) {
    currentPasscodeInput.value = "";
  }
  newPasscodeInput.value = "";
  confirmPasscodeInput.value = "";
}

function closeUnlockPanel() {
  unlockPasscodePanel.hidden = true;
  unlockPasscodeInput.value = "";
}

function showFamilyFeedback(message) {
  familyFeedback.textContent = message;
}

function clearFamilyFeedback() {
  familyFeedback.textContent =
    "Family Protection can protect important settings without watching personal content.";
}

function startSidePanelSyncIfNeeded() {
  if (!isSidePanelView || getTargetTabId()) {
    return;
  }

  chrome.tabs.onActivated.addListener(handleSidePanelTabChanged);
  chrome.tabs.onUpdated.addListener(handleSidePanelTabUpdated);

  if (chrome.windows && chrome.windows.onFocusChanged) {
    chrome.windows.onFocusChanged.addListener(handleSidePanelWindowFocusChanged);
  }
}

function handleSidePanelTabChanged() {
  void loadReport(false);
}

function handleSidePanelTabUpdated(tabId, changeInfo) {
  if (changeInfo.status === "loading" || typeof changeInfo.url === "string") {
    void loadReport(false);
  }
}

function handleSidePanelWindowFocusChanged(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  void loadReport(false);
}

function updateReadButtonAvailability() {
  const canRead = readAloudToggle.checked && "speechSynthesis" in window;

  if (!canRead && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    currentSpeech = null;
  }

  readButton.disabled = !canRead;
  readButton.textContent = canRead
    ? window.speechSynthesis.speaking
      ? "Stop Reading"
      : "Read This Out Loud"
    : "Read Aloud Off";

  if (heroReadShortcutButton) {
    heroReadShortcutButton.disabled = !canRead;
    heroReadShortcutButton.textContent = canRead
      ? window.speechSynthesis.speaking
        ? "Stop"
        : "Read"
      : "Read Off";
  }
}

async function loadReport(forceRefresh) {
  setRefreshingState(true);

  try {
    const targetTabId = getTargetTabId();
    const tab = targetTabId ? await getTabById(targetTabId) : await getActiveTab();
    const tabId = tab?.id;

    if (!tabId) {
      renderReport(buildUnavailableReport());
      return;
    }

    renderReport(buildUnavailableReport({
      reason: "scanning-page",
      tab
    }));

    let report = null;

    if (!forceRefresh) {
      const response = await chrome.runtime.sendMessage({
        type: "GET_TAB_STATE",
        tabId
      });

      const cachedState = response && response.ok ? response.state : null;
      report = isFreshTabReport(cachedState, tab) ? cachedState.report : null;
    }

    if (!report && !isScannableTab(tab)) {
      renderReport(buildUnavailableReport({
        reason: "unsupported-page",
        tab
      }));
      return;
    }

    if (!report) {
      report = await requestLivePageReport(tab);
    }

    renderReport(report && report.ok ? report : buildUnavailableReport({
      reason: "scan-unavailable",
      tab
    }));
  } catch (error) {
    if (isMissingReceiverError(error)) {
      renderReport(buildUnavailableReport({
        reason: "scan-unavailable"
      }));
    } else {
      console.error("Could not load the page report.", error);
      renderReport(buildUnavailableReport());
    }
  } finally {
    setRefreshingState(false);
  }
}

function getTargetTabId() {
  const rawValue = new URLSearchParams(window.location.search).get("tabId");
  const parsedValue = Number(rawValue);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0];
}

async function getTabById(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch (error) {
    return null;
  }
}

function isScannableTab(tab) {
  const urlString = tab?.url || "";

  if (!urlString) {
    return false;
  }

  try {
    const parsedUrl = new URL(urlString);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function isMissingReceiverError(error) {
  const message = String(error?.message || error || "").toLowerCase();

  return (
    message.includes("receiving end does not exist") ||
    message.includes("could not establish connection") ||
    message.includes("message port closed before a response was received")
  );
}

function isFreshTabReport(tabState, tab) {
  const report = tabState?.report;

  if (!report || !tab?.id || report.tabId !== tab.id) {
    return false;
  }

  if (!tab.url || !report.pageUrl) {
    return true;
  }

  return normalizeComparableUrl(tab.url) === normalizeComparableUrl(report.pageUrl);
}

function normalizeComparableUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    parsedUrl.hash = "";
    return parsedUrl.toString();
  } catch (error) {
    return String(urlString || "");
  }
}

async function requestLivePageReport(tab) {
  if (!tab?.id || !isScannableTab(tab)) {
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PAGE_REPORT",
      forceRefresh: true
    });
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }
  }

  try {
    const injectionWorked = await ensurePageScriptsInjected(tab.id);

    if (!injectionWorked) {
      return null;
    }
  } catch (error) {
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PAGE_REPORT",
      forceRefresh: true
    });
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    return null;
  }
}

async function ensurePageScriptsInjected(tabId) {
  if (typeof tabId !== "number") {
    return false;
  }

  try {
    const [{ result: alreadyReady = false } = {}] = await chrome.scripting.executeScript({
      target: {
        tabId
      },
      func: () => {
        return Boolean(window.aiGuardianWebShieldLoaded && window.AI_GUARDIAN_EMAIL?.controller);
      }
    });

    if (alreadyReady) {
      return true;
    }
  } catch (error) {
    return false;
  }

  try {
    await chrome.scripting.executeScript({
      target: {
        tabId
      },
      files: PAGE_SCRIPT_FILES
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function handleCopyCleanLink() {
  if (!lastReport || !lastReport.cleanedUrl || lastReport.cleanedUrl === "Unavailable") {
    return;
  }

  try {
    await navigator.clipboard.writeText(lastReport.cleanedUrl);
    copyButton.textContent = "Copied";

    window.setTimeout(() => {
      copyButton.textContent = "Copy Clean Link";
    }, 1400);
  } catch (error) {
    console.error("Could not copy the clean link.", error);
  }
}

function handleReadAloudClick() {
  if (!readAloudToggle.checked || !lastReport) {
    return;
  }

  if (!("speechSynthesis" in window)) {
    return;
  }

  if (window.speechSynthesis.speaking) {
    stopReading();
    return;
  }

  const speechParts = [
    typeof lastReport.score === "number" ? `AI Guardian score ${lastReport.score}. ${lastReport.label}.` : "",
    lastReport.summary,
    lastReport.advice,
    buildSpeechReasons(lastReport.reasons || []),
    buildSpeechFlaggedLinks(lastReport.flaggedLinks || []),
    buildSpeechTermsSummary(lastReport.termsSummary)
  ].filter(Boolean);

  currentSpeech = new SpeechSynthesisUtterance(speechParts.join(" "));
  currentSpeech.rate = 0.95;
  currentSpeech.pitch = 1;
  currentSpeech.onend = resetReadButton;
  currentSpeech.onerror = resetReadButton;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(currentSpeech);
  readButton.textContent = "Stop Reading";
}

function buildSpeechReasons(reasons) {
  const topReasons = reasons.slice(0, 3);

  if (!topReasons.length) {
    return "";
  }

  return `What we noticed. ${topReasons.join(" ")}`;
}

function buildSpeechFlaggedLinks(flaggedLinks) {
  if (!flaggedLinks.length) {
    return "";
  }

  const topLinks = flaggedLinks.slice(0, 2).map((link) => {
    return `${link.domain}. ${link.reason}`;
  });

  return `Links worth another look. ${topLinks.join(" ")}`;
}

function buildSpeechTermsSummary(termsSummary) {
  if (!termsSummary || !termsSummary.available || !Array.isArray(termsSummary.points) || !termsSummary.points.length) {
    return "";
  }

  return `Quick terms summary. ${termsSummary.points.slice(0, 3).join(" ")} ${termsSummary.disclaimer || ""}`;
}

function stopReading() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  currentSpeech = null;
  readButton.textContent = readButton.disabled ? "Read Aloud Off" : "Read This Out Loud";

  if (heroReadShortcutButton) {
    heroReadShortcutButton.textContent = heroReadShortcutButton.disabled ? "Read Off" : "Read";
  }
}

function resetReadButton() {
  currentSpeech = null;
  updateReadButtonAvailability();
}

function renderReport(report) {
  lastReport = report;
  showAllSignals = false;

  scoreNumber.textContent = typeof report.score === "number" ? String(report.score) : "--";
  scoreLabel.textContent = report.label || "Unavailable";
  scoreBadge.className = `score-badge ${getBandClass(report.band)}`;
  scoreBadge.setAttribute(
    "aria-label",
    typeof report.score === "number"
      ? `Score ${report.score}. ${report.label}. ${report.summary}`
      : report.summary
  );

  statusSummary.textContent = report.summary;
  statusAdvice.textContent = report.advice;
  if (currentSiteLabel) {
    currentSiteLabel.textContent = `Current site: ${report.domain || "Unavailable"}`;
  }
  pageTitle.textContent = report.pageTitle;
  domainName.textContent = report.domain;
  cleanUrl.textContent = report.cleanedUrl;

  renderReasonList(report.reasons || []);
  renderEmailSafetyPreview(report.emailSafetyPreview);
  renderSiteIdentityCheck(report.siteIdentityCheck);
  renderFlaggedLinks(report.flaggedLinks || []);
  renderTermsSummary(report.termsSummary);
  renderSlowdownCard();
  renderFamilyProtectionPanel();
}

function renderEmailSafetyPreview(emailPreview) {
  if (
    !emailPreviewSummary ||
    !emailPreviewProviderChip ||
    !emailPreviewSupportChip ||
    !emailPreviewViewChip ||
    !emailPreviewReasonsList ||
    !emailPreviewAdvice ||
    !emailPreviewLinksList
  ) {
    return;
  }

  const preview = emailPreview || {
    available: false,
    providerLabel: "Not active",
    supportLabel: "Waiting",
    view: "No mail view",
    summary: "Open a supported webmail inbox or message to see lightweight email guidance.",
    advice: "When email previews are active, this panel will explain what stood out before you click.",
    reasons: [],
    riskyLinks: []
  };

  emailPreviewSummary.textContent = preview.summary;
  emailPreviewProviderChip.textContent = preview.providerLabel || "Not active";
  setChipState(
    emailPreviewSupportChip,
    preview.supportLabel || "Waiting",
    preview.available
      ? preview.supportTier === 1
        ? "ready"
        : preview.supportTier === 2
          ? "open"
          : "caution"
      : "off"
  );
  setChipState(
    emailPreviewViewChip,
    preview.view || "No mail view",
    preview.available ? (preview.riskyLinkCount > 0 || preview.riskyRowCount > 0 ? "caution" : "ready") : "off"
  );
  emailPreviewAdvice.textContent = preview.advice;

  emailPreviewReasonsList.innerHTML = "";

  if (!preview.available || !Array.isArray(preview.reasons) || preview.reasons.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No email-specific preview is active on this page.";
    emailPreviewReasonsList.appendChild(emptyItem);
  } else {
    preview.reasons.slice(0, 3).forEach((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      emailPreviewReasonsList.appendChild(item);
    });
  }

  emailPreviewLinksList.innerHTML = "";

  if (!preview.available || !Array.isArray(preview.riskyLinks) || preview.riskyLinks.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "Open a supported email message to see link and download cues here.";
    emailPreviewLinksList.appendChild(emptyItem);
    return;
  }

  preview.riskyLinks.forEach((link) => {
    const item = document.createElement("li");
    const title = document.createElement("p");
    title.className = "protected-setting-label";
    title.textContent = link.label || "Check link";
    const note = document.createElement("p");
    note.className = "protected-setting-note";
    note.textContent = link.detail || "This message link may need a closer look.";
    const domain = document.createElement("p");
    domain.className = "protected-setting-note";
    domain.textContent = link.domain || link.cleanedUrl || "";
    item.appendChild(title);
    item.appendChild(note);
    if (domain.textContent) {
      item.appendChild(domain);
    }
    emailPreviewLinksList.appendChild(item);
  });
}

function renderSiteIdentityCheck(siteIdentityCheck) {
  const fallbackCheck = siteIdentityCheck || buildUnavailableSiteIdentityCheck();
  const defaultCheck = buildUnavailableSiteIdentityCheck();

  renderIdentityRow(
    secureConnectionStatus,
    secureConnectionValue,
    secureConnectionDetail,
    fallbackCheck.secureConnection || defaultCheck.secureConnection
  );
  renderIdentityRow(
    addressCheckStatus,
    addressCheckValue,
    addressCheckDetail,
    fallbackCheck.domainConsistency || fallbackCheck.websiteAddressCheck || defaultCheck.domainConsistency
  );
  renderIdentityRow(
    brandSimilarityStatus,
    brandSimilarityValue,
    brandSimilarityDetail,
    fallbackCheck.brandSimilaritySignals || defaultCheck.brandSimilaritySignals
  );
  renderIdentityRow(
    signInTrustStatus,
    signInTrustValue,
    signInTrustDetail,
    fallbackCheck.signInPatternDetection || fallbackCheck.signInTrustCheck || defaultCheck.signInPatternDetection
  );
  renderIdentityRow(
    certificateVerificationStatus,
    certificateVerificationValue,
    certificateVerificationDetail,
    fallbackCheck.certificateVerification || defaultCheck.certificateVerification
  );

  siteIdentityNote.textContent = fallbackCheck.note;
  siteIdentityLimit.textContent = fallbackCheck.limitation;
}

function renderIdentityRow(statusElement, valueElement, detailElement, row) {
  if (!statusElement || !valueElement || !detailElement || !row) {
    return;
  }

  statusElement.className = `mini-badge ${getIdentityStatusClass(row.status)}`;
  statusElement.textContent = getIdentityStatusText(row.status);
  valueElement.textContent = row.value;
  detailElement.textContent = row.detail;
}

function renderReasonList(reasons) {
  reasonList.innerHTML = "";
  const shownReasons = showAllSignals ? reasons : reasons.slice(0, 3);

  if (!shownReasons.length) {
    const item = document.createElement("li");
    item.textContent = "Nothing unusual stood out on this page.";
    reasonList.appendChild(item);
    if (seeAllSignalsButton) {
      seeAllSignalsButton.hidden = true;
    }
    return;
  }

  shownReasons.forEach((reason) => {
    const listItem = document.createElement("li");
    listItem.textContent = reason;
    reasonList.appendChild(listItem);
  });

  if (seeAllSignalsButton) {
    seeAllSignalsButton.hidden = reasons.length <= 3;
    seeAllSignalsButton.textContent = showAllSignals ? "Show Top Signals" : "See All Signals";
  }
}

function renderFlaggedLinks(flaggedLinks) {
  flaggedLinksList.innerHTML = "";

  if (!flaggedLinks.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No links on this page stood out right now.";
    flaggedLinksList.appendChild(emptyItem);
    return;
  }

  flaggedLinks.forEach((link) => {
    const item = document.createElement("li");
    item.className = "flagged-link";

    const topRow = document.createElement("div");
    topRow.className = "flagged-link-top";

    const title = document.createElement("p");
    title.className = "flagged-link-title";
    title.textContent = link.text;

    const badge = document.createElement("span");
    badge.className = `mini-badge ${getBandClass(link.band, true)}`;
    badge.textContent = `${link.label} ${link.score}`;

    topRow.appendChild(title);
    topRow.appendChild(badge);

    const domain = document.createElement("p");
    domain.className = "flagged-link-domain";
    domain.textContent = link.domain;

    const reason = document.createElement("p");
    reason.className = "flagged-link-reason";
    reason.textContent = link.reason;

    const url = document.createElement("p");
    url.className = "flagged-link-url";
    url.textContent = link.cleanedUrl;

    item.appendChild(topRow);
    item.appendChild(domain);
    item.appendChild(reason);
    item.appendChild(url);
    flaggedLinksList.appendChild(item);
  });
}

function renderTermsSummary(termsSummary) {
  const summary = termsSummary || {
    available: false,
    summary: "No simple terms summary is available on this page.",
    points: [],
    disclaimer: "This is a simplified summary, not legal advice."
  };

  termsSummaryText.textContent = summary.summary;
  termsSummaryDisclaimer.textContent = summary.disclaimer;
  termsSummaryList.innerHTML = "";

  if (!summary.available || !Array.isArray(summary.points) || summary.points.length === 0) {
    const item = document.createElement("li");
    item.className = "empty-state";
    item.textContent = "No simple terms summary is available on this page.";
    termsSummaryList.appendChild(item);
    return;
  }

  summary.points.forEach((point) => {
    const item = document.createElement("li");
    item.textContent = point;
    termsSummaryList.appendChild(item);
  });
}

function setRefreshingState(isRefreshing) {
  refreshButton.disabled = isRefreshing;
  refreshButton.textContent = isRefreshing ? "Scanning..." : "Scan Again";
}

function getBandClass(band, isMiniBadge = false) {
  const className = BAND_CLASS[band] || BAND_CLASS.unknown;

  if (!isMiniBadge) {
    return className;
  }

  return className.replace("tone-", "mini-");
}

function getIdentityStatusClass(status) {
  if (status === "good") {
    return "mini-safe";
  }

  if (status === "warning") {
    return "mini-risk";
  }

  if (status === "caution") {
    return "mini-medium";
  }

  return "mini-unknown";
}

function getIdentityStatusText(status) {
  if (status === "good") {
    return "Okay";
  }

  if (status === "warning") {
    return "Check";
  }

  if (status === "caution") {
    return "Look";
  }

  return "Waiting";
}

function buildUnavailableSiteIdentityCheck() {
  return {
    secureConnection: {
      label: "Secure connection",
      value: "Unavailable",
      detail: "We could not check connection details here.",
      status: "unknown"
    },
    domainConsistency: {
      label: "Domain consistency",
      value: "Unavailable",
      detail: "We could not compare the address here.",
      status: "unknown"
    },
    brandSimilaritySignals: {
      label: "Brand similarity signals",
      value: "Unavailable",
      detail: "We could not compare visible brand cues here.",
      status: "unknown"
    },
    signInPatternDetection: {
      label: "Sign-in pattern detection",
      value: "Unavailable",
      detail: "We could not read sign-in details here.",
      status: "unknown"
    },
    certificateVerification: {
      label: "Certificate verification",
      value: "Limited",
      detail: "Full certificate verification is limited from inside the page.",
      status: "unknown"
    },
    note: "A secure connection helps, but it does not guarantee honesty.",
    limitation:
      "This check uses browser signs like HTTPS and the site name. It cannot confirm every certificate detail from inside the page."
  };
}

function buildUnavailableReport(options = {}) {
  const reason = options.reason || "unavailable";
  const tab = options.tab || null;
  const pageUrl = tab?.url || "Unavailable";
  const pageTitleText = tab?.title || "This page could not be read here";
  const pageHost = getHostFromUrl(pageUrl) || "Unavailable";
  const unavailableState = getUnavailableState(reason);

  return {
    ok: false,
    score: null,
    label: "Unavailable",
    band: "unknown",
    summary: unavailableState.summary,
    advice: unavailableState.advice,
    reasons: unavailableState.reasons,
    emailSafetyPreview: {
      available: false,
      providerLabel: "Not active",
      supportLabel: "Waiting",
      view: "No mail view",
      summary: "Open a supported webmail inbox or message to see lightweight email guidance.",
      advice: "When email previews are active, this panel will explain what stood out before you click.",
      reasons: [],
      riskyLinks: []
    },
    pageTitle: pageTitleText,
    domain: pageHost,
    cleanedUrl: pageUrl,
    siteIdentityCheck: buildUnavailableSiteIdentityCheck(),
    flaggedLinks: [],
    termsSummary: {
      available: false,
      summary: "No simple terms summary is available on this page.",
      points: [],
      disclaimer: "This is a simplified summary, not legal advice."
    },
    familyProtection: {
      currentPageRestricted: false,
      currentPageMessage: "Family Protection details are not available here.",
      levelNote: PROTECTION_LEVEL_COPY[currentSettings.protectionLevel] || PROTECTION_LEVEL_COPY.standard
    }
  };
}

function getHostFromUrl(urlString) {
  try {
    return new URL(urlString).hostname || "Unavailable";
  } catch (error) {
    return "";
  }
}

function getUnavailableState(reason) {
  if (reason === "unsupported-page") {
    return {
      summary: "This kind of page cannot be scanned in the popup.",
      advice: "Open a normal website page if you want a live page score.",
      reasons: [
        "Browser pages, extension pages, and some special tabs do not share page details with extensions.",
        "No page data was sent anywhere else."
      ]
    };
  }

  if (reason === "scan-unavailable") {
    return {
      summary: "This page is not ready for a live score yet.",
      advice: "Try scanning again, or refresh the page if it was open before the extension loaded.",
      reasons: [
        "The page helper was not connected yet.",
        "No page data was sent anywhere else."
      ]
    };
  }

  if (reason === "scanning-page") {
    return {
      summary: "Scanning this page now.",
      advice: "Hold on for a moment while we load the current tab only.",
      reasons: [
        "Old page details were cleared so tabs do not get mixed together.",
        "No page data was sent anywhere else."
      ]
    };
  }

  return {
    summary: "We could not load a page score here.",
    advice: "If anything feels odd, it is okay to leave the page and use a site you trust.",
    reasons: [
      "Some browser pages do not allow extension details here.",
      "No page data was sent anywhere else."
    ]
  };
}

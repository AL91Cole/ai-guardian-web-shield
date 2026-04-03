// The background worker stores the latest page report for each tab.
// That lets the popup show details while the page itself handles live warnings.

const tabReports = new Map();
const tabUiState = new Map();
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

const FAMILY_PASSCODE_HASH_KEY = "familyProtectionPasscodeHash";
const FAMILY_PASSCODE_SALT_KEY = "familyProtectionPasscodeSalt";
const FAMILY_UNLOCK_UNTIL_KEY = "familyProtectionUnlockedUntil";
const FAMILY_SETTINGS_HISTORY_KEY = "familyProtectionSettingsHistory";
const PROTECTION_LEVEL_COOLDOWN_UNTIL_KEY = "familyProtectionCooldownUntil";
const PROTECTION_LEVEL_PENDING_TARGET_KEY = "familyProtectionPendingTarget";
const FAMILY_PASSCODE_FAILED_ATTEMPTS_KEY = "familyProtectionFailedAttempts";
const FAMILY_PASSCODE_FAILED_COOLDOWN_UNTIL_KEY = "familyProtectionFailedCooldownUntil";
const FAMILY_UNLOCK_MINUTES = 10;
const PROTECTION_LOWERING_COOLDOWN_MS = 30000;
const PASSCODE_FAILURE_LIMIT = 3;
const PASSCODE_FAILURE_COOLDOWN_MS = 30000;
const SETTINGS_HISTORY_LIMIT = 16;
const GUARDIAN_ACTIVITY_WINDOW_MS = 90000;
const GUARDIAN_PROMPT_COOLDOWN_MS = 90000;
const PROTECTION_LEVEL_ORDER = ["standard", "family", "child", "maximum"];
const PROTECTED_KEYS = new Set([
  "searchBadgesEnabled",
  "floatingBadgeEnabled",
  "proactiveWarningsEnabled",
  "adultSiteBlockingEnabled",
  "labyrinthModeEnabled",
  "guidedProtectionModeEnabled",
  "protectionLevel",
  "familyProtectionExceptions"
]);
const tabGuardianState = new Map();

void ensureDefaultSettings();

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultSettings();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PAGE_REPORT_UPDATE") {
    handlePageReportUpdate(message.report, sender.tab);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "GET_TAB_REPORT") {
    sendResponse({
      ok: true,
      report: tabReports.get(message.tabId) || null
    });
    return;
  }

  if (message.type === "GET_TAB_STATE") {
    sendResponse({
      ok: true,
      state: getTabState(message.tabId)
    });
    return;
  }

  if (message.type === "OPEN_DETAILS_PANEL") {
    const targetTab = message.tabId
      ? {
          id: message.tabId,
          windowId: message.windowId
        }
      : sender.tab;

    void openDetailsPanel(targetTab)
      .then((result) => {
        sendResponse(result);
      })
      .catch(() => {
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message.type === "GET_FAMILY_PROTECTION_STATE") {
    void getFamilyProtectionState()
      .then((result) => {
        sendResponse({
          ok: true,
          ...result
        });
      })
      .catch(() => {
        sendResponse({
          ok: false,
          hasPasscode: false,
          isUnlocked: false,
          unlockExpiresAt: 0
        });
      });
    return true;
  }

  if (message.type === "SET_FAMILY_PROTECTION_PASSCODE") {
    void setFamilyProtectionPasscode({
      currentPasscode: message.currentPasscode || "",
      newPasscode: message.newPasscode || ""
    })
      .then((result) => {
        sendResponse(result);
      })
      .catch(() => {
        sendResponse({
          ok: false,
          message: "We could not save the passcode right now."
        });
      });
    return true;
  }

  if (message.type === "UNLOCK_FAMILY_PROTECTION") {
    void unlockFamilyProtection(message.passcode || "")
      .then((result) => {
        sendResponse(result);
      })
      .catch(() => {
        sendResponse({
          ok: false,
          message: "We could not check that passcode right now."
        });
      });
    return true;
  }

  if (message.type === "UPDATE_SETTING_GUARDED") {
    void updateSettingGuarded(message.key, message.value)
      .then((result) => {
        sendResponse(result);
      })
      .catch(() => {
        sendResponse({
          ok: false,
          locked: false,
          message: "We could not save that setting right now."
        });
      });
    return true;
  }

  if (message.type === "REPORT_GUARDIAN_ACTIVITY") {
    void recordGuardianActivity(message, sender.tab)
      .then((result) => {
        sendResponse({
          ok: true,
          prompted: Boolean(result?.prompted)
        });
      })
      .catch(() => {
        sendResponse({
          ok: false
        });
      });
    return true;
  }

  if (message.type === "TAB_UI_STATE_UPDATE") {
    handleTabUiStateUpdate(message.uiState, sender.tab);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "CLEAR_TAB_PAGE_STATE") {
    clearTabPageState(sender.tab?.id);
    sendResponse({ ok: true });
    return;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabState(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (typeof changeInfo.url === "string") {
    clearTabState(tabId);
    return;
  }

  if (changeInfo.status !== "loading") {
    return;
  }

  clearTabState(tabId);
});

async function ensureDefaultSettings() {
  const keys = Object.keys(DEFAULT_SETTINGS);
  const storedSettings = await chrome.storage.local.get(keys);
  const missingSettings = {};

  keys.forEach((key) => {
    if (typeof storedSettings[key] === "undefined") {
      missingSettings[key] = DEFAULT_SETTINGS[key];
    }
  });

  if (Object.keys(missingSettings).length > 0) {
    await chrome.storage.local.set(missingSettings);
  }
}

async function getStoredSettings() {
  const keys = Object.keys(DEFAULT_SETTINGS);
  const storedSettings = await chrome.storage.local.get(keys);

  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings
  };
}

async function getFamilyProtectionState() {
  const storedValues = await chrome.storage.local.get([
    FAMILY_PASSCODE_HASH_KEY,
    FAMILY_PASSCODE_SALT_KEY,
    FAMILY_UNLOCK_UNTIL_KEY,
    FAMILY_SETTINGS_HISTORY_KEY,
    PROTECTION_LEVEL_COOLDOWN_UNTIL_KEY,
    PROTECTION_LEVEL_PENDING_TARGET_KEY,
    FAMILY_PASSCODE_FAILED_COOLDOWN_UNTIL_KEY
  ]);
  const unlockExpiresAt = Number(storedValues[FAMILY_UNLOCK_UNTIL_KEY] || 0);

  return {
    hasPasscode: Boolean(storedValues[FAMILY_PASSCODE_HASH_KEY]),
    isUnlocked: unlockExpiresAt > Date.now(),
    unlockExpiresAt,
    cooldownUntil: Number(storedValues[PROTECTION_LEVEL_COOLDOWN_UNTIL_KEY] || 0),
    passcodeCooldownUntil: Number(storedValues[FAMILY_PASSCODE_FAILED_COOLDOWN_UNTIL_KEY] || 0),
    pendingProtectionLevel: storedValues[PROTECTION_LEVEL_PENDING_TARGET_KEY] || "",
    settingsHistory: Array.isArray(storedValues[FAMILY_SETTINGS_HISTORY_KEY])
      ? storedValues[FAMILY_SETTINGS_HISTORY_KEY]
      : []
  };
}

async function setFamilyProtectionPasscode(input = {}) {
  const normalizedCurrentPasscode = String(input.currentPasscode || "").trim();
  const normalizedPasscode = String(input.newPasscode || "").trim();

  if (!/^\d{4,8}$/.test(normalizedPasscode)) {
    return {
      ok: false,
      message: "Use a 4 to 8 digit new passcode."
    };
  }

  const storedValues = await chrome.storage.local.get([
    FAMILY_PASSCODE_HASH_KEY,
    FAMILY_PASSCODE_SALT_KEY,
    FAMILY_UNLOCK_UNTIL_KEY
  ]);
  const hasExistingPasscode = Boolean(storedValues[FAMILY_PASSCODE_HASH_KEY]);

  if (hasExistingPasscode) {
    const verificationResult = await verifyStoredPasscode(normalizedCurrentPasscode, {
      mismatchMessage: "The current passcode did not match."
    });

    if (!verificationResult.ok) {
      return verificationResult;
    }
  }

  const nextSalt = createPasscodeSalt();

  await chrome.storage.local.set({
    [FAMILY_PASSCODE_HASH_KEY]: await hashPasscode(normalizedPasscode, nextSalt),
    [FAMILY_PASSCODE_SALT_KEY]: nextSalt,
    [FAMILY_UNLOCK_UNTIL_KEY]: Date.now() + FAMILY_UNLOCK_MINUTES * 60 * 1000
  });
  await clearPasscodeFailureState();

  await recordSettingsHistory({
    type: "passcode-change",
    key: "familyProtectionPasscode",
    fromValue: hasExistingPasscode ? "Existing passcode" : "No passcode",
    toValue: "Protected with passcode",
    trustedAdultAlert: false,
    trustedAdultContact: "",
    note: hasExistingPasscode
      ? "The Family Protection passcode was changed."
      : "A Family Protection passcode was added."
  });

  return {
    ok: true,
    message: hasExistingPasscode
      ? "Family Protection passcode updated."
      : "Family Protection passcode saved."
  };
}

async function unlockFamilyProtection(passcode) {
  const normalizedPasscode = String(passcode || "").trim();
  const storedValues = await chrome.storage.local.get([FAMILY_PASSCODE_HASH_KEY]);
  const storedHash = storedValues[FAMILY_PASSCODE_HASH_KEY];

  if (!storedHash) {
    return {
      ok: false,
      message: "Set a passcode first."
    };
  }

  if (!/^\d{4,8}$/.test(normalizedPasscode)) {
    return {
      ok: false,
      message: "Use the same 4 to 8 digit passcode."
    };
  }

  const verificationResult = await verifyStoredPasscode(normalizedPasscode, {
    mismatchMessage: "That passcode did not match."
  });

  if (!verificationResult.ok) {
    return verificationResult;
  }

  const unlockExpiresAt = Date.now() + FAMILY_UNLOCK_MINUTES * 60 * 1000;

  await chrome.storage.local.set({
    [FAMILY_UNLOCK_UNTIL_KEY]: unlockExpiresAt
  });
  await clearPasscodeFailureState();

  return {
    ok: true,
    hasPasscode: true,
    isUnlocked: true,
    unlockExpiresAt,
    message: "Protected settings are unlocked for a short time."
  };
}

async function updateSettingGuarded(key, value) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    return {
      ok: false,
      locked: false,
      message: "That setting is not available here."
    };
  }

  const currentSettings = await getStoredSettings();
  const familyState = await getFamilyProtectionState();
  const hasPasscode = familyState.hasPasscode;
  const keyNeedsProtection = isProtectedSettingChange(key, currentSettings[key], value);
  const isProtectedChange = hasPasscode && keyNeedsProtection;
  const isLoweringProtection =
    key === "protectionLevel" && getProtectionLevelRank(value) < getProtectionLevelRank(currentSettings[key]);

  if (keyNeedsProtection && !hasPasscode) {
    return {
      ok: false,
      locked: true,
      settings: currentSettings,
      familyState,
      message: "Set a Family Protection passcode before making that change."
    };
  }

  if (isProtectedChange && !familyState.isUnlocked) {
    return {
      ok: false,
      locked: true,
      settings: currentSettings,
      familyState,
      message: "This change is locked. Enter your passcode first."
    };
  }

  if (isLoweringProtection) {
    const cooldownResult = await handleProtectionLevelCooldown(
      currentSettings[key],
      value,
      familyState
    );

    if (!cooldownResult.ok) {
      return {
        ok: false,
        locked: false,
        cooldown: true,
        cooldownUntil: cooldownResult.cooldownUntil,
        settings: currentSettings,
        familyState: await getFamilyProtectionState(),
        message: cooldownResult.message
      };
    }
  } else if (key === "protectionLevel") {
    await clearProtectionLevelCooldown();
  }

  const updatedSettings = {
    ...currentSettings,
    [key]: value
  };

  await chrome.storage.local.set({
    [key]: value
  });

  if (shouldRecordFamilyHistory(key)) {
    await recordSettingsHistory({
      type: "setting-change",
      key,
      fromValue: describeSettingValue(key, currentSettings[key]),
      toValue: describeSettingValue(key, value),
      trustedAdultAlert:
        isMajorSafetyChange(key, currentSettings[key], value) && Boolean(updatedSettings.trustedAdultAlertEnabled),
      trustedAdultContact: updatedSettings.trustedAdultContact || "",
      note: buildHistoryNote(key, currentSettings[key], value, updatedSettings)
    });
  }

  return {
    ok: true,
    locked: false,
    settings: updatedSettings,
    familyState: await getFamilyProtectionState()
  };
}

function isProtectedSettingChange(key, currentValue, nextValue) {
  if (!PROTECTED_KEYS.has(key)) {
    return false;
  }

  if (key === "familyProtectionExceptions") {
    return JSON.stringify(currentValue || []) !== JSON.stringify(nextValue || []);
  }

  if (key === "protectionLevel") {
    return getProtectionLevelRank(nextValue) < getProtectionLevelRank(currentValue);
  }

  if (typeof currentValue === "boolean" && typeof nextValue === "boolean") {
    return currentValue && !nextValue;
  }

  return false;
}

function isMajorSafetyChange(key, currentValue, nextValue) {
  if (key === "protectionLevel") {
    return getProtectionLevelRank(nextValue) < getProtectionLevelRank(currentValue);
  }

  if (key === "familyProtectionExceptions") {
    return JSON.stringify(currentValue || []) !== JSON.stringify(nextValue || []);
  }

  return typeof currentValue === "boolean" && typeof nextValue === "boolean" && currentValue !== nextValue;
}

function shouldRecordFamilyHistory(key) {
  return [
    "searchBadgesEnabled",
    "floatingBadgeEnabled",
    "proactiveWarningsEnabled",
    "adultSiteBlockingEnabled",
    "labyrinthModeEnabled",
    "guidedProtectionModeEnabled",
    "protectionLevel",
    "familyProtectionExceptions",
    "trustedAdultAlertEnabled",
    "trustedAdultContact"
  ].includes(key);
}

async function handleProtectionLevelCooldown(currentLevel, nextLevel, familyState) {
  const storedValues = await chrome.storage.local.get([
    PROTECTION_LEVEL_COOLDOWN_UNTIL_KEY,
    PROTECTION_LEVEL_PENDING_TARGET_KEY
  ]);
  const now = Date.now();
  const cooldownUntil = Number(storedValues[PROTECTION_LEVEL_COOLDOWN_UNTIL_KEY] || 0);
  const pendingTarget = storedValues[PROTECTION_LEVEL_PENDING_TARGET_KEY] || "";

  if (pendingTarget === nextLevel && cooldownUntil > 0 && now >= cooldownUntil) {
    await clearProtectionLevelCooldown();
    return {
      ok: true
    };
  }

  if (cooldownUntil > now && pendingTarget === nextLevel) {
    return {
      ok: false,
      cooldownUntil,
      message: "Please wait a moment before lowering protection."
    };
  }

  const nextCooldownUntil = now + PROTECTION_LOWERING_COOLDOWN_MS;

  await chrome.storage.local.set({
    [PROTECTION_LEVEL_COOLDOWN_UNTIL_KEY]: nextCooldownUntil,
    [PROTECTION_LEVEL_PENDING_TARGET_KEY]: nextLevel
  });

  await recordSettingsHistory({
    type: "cooldown-started",
    key: "protectionLevel",
    fromValue: describeSettingValue("protectionLevel", currentLevel),
    toValue: describeSettingValue("protectionLevel", nextLevel),
    trustedAdultAlert: false,
    trustedAdultContact: "",
    note: "A short cooldown started before lowering protection."
  });

  return {
    ok: false,
    cooldownUntil: nextCooldownUntil,
    message: "Please wait 30 seconds, then choose that lower level again."
  };
}

async function clearProtectionLevelCooldown() {
  await chrome.storage.local.remove([
    PROTECTION_LEVEL_COOLDOWN_UNTIL_KEY,
    PROTECTION_LEVEL_PENDING_TARGET_KEY
  ]);
}

async function recordSettingsHistory(entry) {
  const storedValues = await chrome.storage.local.get([FAMILY_SETTINGS_HISTORY_KEY]);
  const currentHistory = Array.isArray(storedValues[FAMILY_SETTINGS_HISTORY_KEY])
    ? storedValues[FAMILY_SETTINGS_HISTORY_KEY]
    : [];
  const nextHistory = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...entry
    },
    ...currentHistory
  ].slice(0, SETTINGS_HISTORY_LIMIT);

  await chrome.storage.local.set({
    [FAMILY_SETTINGS_HISTORY_KEY]: nextHistory
  });
}

function describeSettingValue(key, value) {
  if (key === "protectionLevel") {
    return value ? getProtectionLevelLabel(value) : "Not set";
  }

  if (key === "familyProtectionExceptions") {
    const items = Array.isArray(value) ? value : [];
    return items.length ? items.join(", ") : "No site exceptions";
  }

  if (typeof value === "boolean") {
    return value ? "On" : "Off";
  }

  return String(value ?? "");
}

function getProtectionLevelLabel(level) {
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

function buildHistoryNote(key, previousValue, nextValue, settings) {
  if (key === "adultSiteBlockingEnabled") {
    return nextValue
      ? "Adult site blocking was turned on."
      : "Adult site blocking was turned off.";
  }

  if (key === "labyrinthModeEnabled") {
    return nextValue
      ? "Labyrinth Mode was turned on."
      : "Labyrinth Mode was turned off.";
  }

  if (key === "guidedProtectionModeEnabled") {
    return nextValue
      ? "Guided Protection Mode was turned on."
      : "Guided Protection Mode was turned off.";
  }

  if (key === "proactiveWarningsEnabled") {
    return nextValue
      ? "Pause-before-risk warnings were turned on."
      : "Pause-before-risk warnings were turned off.";
  }

  if (key === "protectionLevel") {
    return `Protection level changed to ${getProtectionLevelLabel(nextValue)}.`;
  }

  if (key === "familyProtectionExceptions") {
    const previousItems = Array.isArray(previousValue) ? previousValue : [];
    const nextItems = Array.isArray(nextValue) ? nextValue : [];
    const addedItem = nextItems.find((item) => !previousItems.includes(item));
    const removedItem = previousItems.find((item) => !nextItems.includes(item));

    if (addedItem) {
      return `A site exception was added for ${addedItem}.`;
    }

    if (removedItem) {
      return `A site exception was removed for ${removedItem}.`;
    }
  }

  if (key === "trustedAdultAlertEnabled") {
    return nextValue
      ? "Trusted adult review reminders were turned on."
      : "Trusted adult review reminders were turned off.";
  }

  if (key === "trustedAdultContact") {
    return nextValue
      ? "The trusted adult review note was updated."
      : "The trusted adult review note was cleared.";
  }

  if (key === "searchBadgesEnabled" || key === "floatingBadgeEnabled") {
    return nextValue ? "A major safety helper was turned on." : "A major safety helper was turned off.";
  }

  return "A family safety setting changed.";
}

function getProtectionLevelRank(level) {
  const rank = PROTECTION_LEVEL_ORDER.indexOf(level);
  return rank >= 0 ? rank : 0;
}

function createPasscodeSalt() {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(saltBytes).map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function hashPasscode(passcode, salt = "") {
  const encodedPasscode = new TextEncoder().encode(`${salt}:${passcode}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedPasscode);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function hashLegacyPasscode(passcode) {
  const encodedPasscode = new TextEncoder().encode(passcode);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedPasscode);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function openDetailsPanel(tab) {
  const resolvedTab = tab && typeof tab.id === "number"
    ? tab
    : await getCurrentActiveTab();

  if (
    !resolvedTab?.windowId ||
    !chrome.sidePanel ||
    typeof chrome.sidePanel.open !== "function"
  ) {
    return { ok: false, mode: "unavailable" };
  }

  try {
    await chrome.sidePanel.open({
      windowId: resolvedTab.windowId
    });
  } catch (error) {
    return { ok: false, mode: "unavailable" };
  }

  return { ok: true, mode: "side-panel" };
}

async function getCurrentActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0] || null;
}

async function doesTabStillExist(tabId) {
  if (typeof tabId !== "number") {
    return false;
  }

  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch (error) {
    return false;
  }
}

function safeChromeActionCall(task) {
  try {
    const pendingTask = task();

    if (pendingTask && typeof pendingTask.catch === "function") {
      pendingTask.catch(() => {
        // Tabs can disappear while the background worker is updating UI state.
      });
    }
  } catch (error) {
    // Tabs can disappear while the background worker is updating UI state.
  }
}

async function verifyStoredPasscode(passcode, options = {}) {
  const storedValues = await chrome.storage.local.get([
    FAMILY_PASSCODE_HASH_KEY,
    FAMILY_PASSCODE_SALT_KEY,
    FAMILY_PASSCODE_FAILED_ATTEMPTS_KEY,
    FAMILY_PASSCODE_FAILED_COOLDOWN_UNTIL_KEY
  ]);
  const storedHash = storedValues[FAMILY_PASSCODE_HASH_KEY];
  const storedSalt = storedValues[FAMILY_PASSCODE_SALT_KEY] || "";
  const cooldownUntil = Number(storedValues[FAMILY_PASSCODE_FAILED_COOLDOWN_UNTIL_KEY] || 0);

  if (!storedHash) {
    return {
      ok: false,
      message: "Set a passcode first."
    };
  }

  if (cooldownUntil > Date.now()) {
    return {
      ok: false,
      message: "Please wait a short moment before trying the passcode again."
    };
  }

  if (!/^\d{4,8}$/.test(passcode)) {
    return {
      ok: false,
      message: "Use the same 4 to 8 digit passcode."
    };
  }

  const candidateHashes = storedSalt
    ? [await hashPasscode(passcode, storedSalt)]
    : [await hashLegacyPasscode(passcode)];

  if (candidateHashes.includes(storedHash)) {
    if (!storedSalt) {
      const nextSalt = createPasscodeSalt();

      await chrome.storage.local.set({
        [FAMILY_PASSCODE_HASH_KEY]: await hashPasscode(passcode, nextSalt),
        [FAMILY_PASSCODE_SALT_KEY]: nextSalt
      });
    }

    return { ok: true };
  }

  const failureResult = await registerFailedPasscodeAttempt(
    Number(storedValues[FAMILY_PASSCODE_FAILED_ATTEMPTS_KEY] || 0)
  );

  return {
    ok: false,
    message: failureResult.message || options.mismatchMessage || "That passcode did not match."
  };
}

async function registerFailedPasscodeAttempt(currentCount) {
  const nextCount = currentCount + 1;

  if (nextCount >= PASSCODE_FAILURE_LIMIT) {
    const cooldownUntil = Date.now() + PASSCODE_FAILURE_COOLDOWN_MS;

    await chrome.storage.local.set({
      [FAMILY_PASSCODE_FAILED_ATTEMPTS_KEY]: 0,
      [FAMILY_PASSCODE_FAILED_COOLDOWN_UNTIL_KEY]: cooldownUntil
    });

    return {
      message: "Please wait a short moment before trying the passcode again.",
      cooldownUntil
    };
  }

  await chrome.storage.local.set({
    [FAMILY_PASSCODE_FAILED_ATTEMPTS_KEY]: nextCount
  });

  return {
    message: "That passcode did not match."
  };
}

async function clearPasscodeFailureState() {
  await chrome.storage.local.remove([
    FAMILY_PASSCODE_FAILED_ATTEMPTS_KEY,
    FAMILY_PASSCODE_FAILED_COOLDOWN_UNTIL_KEY
  ]);
}

function handlePageReportUpdate(report, tab) {
  if (!report || !tab || typeof tab.id !== "number") {
    return;
  }

  if (
    typeof tab.url === "string" &&
    report.pageUrl &&
    normalizeComparableUrl(tab.url) !== normalizeComparableUrl(report.pageUrl)
  ) {
    return;
  }

  const reportRecord = {
    ...report,
    tabId: tab.id,
    pageUrl: report.pageUrl || tab.url || "",
    capturedAt: Date.now()
  };

  tabReports.set(tab.id, reportRecord);
  handleTabUiStateUpdate({
    pageUrl: reportRecord.pageUrl,
    score: reportRecord.score,
    label: reportRecord.label,
    summary: reportRecord.summary
  }, tab);
  updateActionBadge(tab.id, reportRecord);
  void recordGuardianPageVisit(reportRecord, tab);
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

function handleTabUiStateUpdate(uiState, tab) {
  if (!tab || typeof tab.id !== "number") {
    return;
  }

  const previousState = tabUiState.get(tab.id) || {};
  const nextState = {
    ...previousState,
    ...(uiState || {}),
    tabId: tab.id,
    updatedAt: Date.now()
  };

  if (!nextState.pageUrl && typeof tab.url === "string") {
    nextState.pageUrl = tab.url;
  }

  tabUiState.set(tab.id, nextState);
}

function getTabState(tabId) {
  return {
    tabId,
    report: tabReports.get(tabId) || null,
    uiState: tabUiState.get(tabId) || null
  };
}

function clearTabState(tabId) {
  tabReports.delete(tabId);
  tabUiState.delete(tabId);
  tabGuardianState.delete(tabId);
  clearActionBadge(tabId);
}

function clearTabPageState(tabId) {
  if (typeof tabId !== "number") {
    return;
  }

  tabReports.delete(tabId);
  tabUiState.delete(tabId);
  clearActionBadge(tabId);
}

function updateActionBadge(tabId, report) {
  const badgeText = typeof report.score === "number" ? String(report.score) : "";
  const badgeColor = getBadgeColor(report.score);

  safeChromeActionCall(() => chrome.action.setBadgeText({
    tabId,
    text: badgeText
  }));

  safeChromeActionCall(() => chrome.action.setBadgeBackgroundColor({
    tabId,
    color: badgeColor
  }));

  safeChromeActionCall(() => chrome.action.setTitle({
    tabId,
    title: `AI Guardian Web Shield: ${report.score} ${report.label}`
  }));
}

function clearActionBadge(tabId) {
  safeChromeActionCall(() => chrome.action.setBadgeText({
    tabId,
    text: ""
  }));

  safeChromeActionCall(() => chrome.action.setTitle({
    tabId,
    title: "AI Guardian Web Shield"
  }));
}

async function recordGuardianPageVisit(report, tab) {
  const settings = await getStoredSettings();

  if (!settings.labyrinthModeEnabled) {
    return;
  }

  const activityState = getGuardianTabState(tab.id);
  const now = Date.now();

  activityState.pageVisits.push({
    time: now,
    domain: report.domain || "",
    rootDomain: getRootDomain(report.domain || ""),
    score: Number(report.score || 0)
  });

  pruneGuardianActivity(activityState, now);
  await maybePromptGuardianSlowdown(tab.id, activityState);
}

async function recordGuardianActivity(message, tab) {
  if (!tab || typeof tab.id !== "number") {
    return { prompted: false };
  }

  const settings = await getStoredSettings();

  if (!settings.labyrinthModeEnabled) {
    return { prompted: false };
  }

  const activityState = getGuardianTabState(tab.id);
  const now = Date.now();
  const rootDomain = getRootDomain(message.domain || "");

  if (message.activityType === "risky-action") {
    activityState.riskyActions.push({
      time: now,
      domain: message.domain || "",
      rootDomain,
      score: Number(message.score || 0)
    });
  } else if (message.activityType === "warning-dismissed") {
    activityState.warningDismissals.push({
      time: now,
      domain: message.domain || "",
      rootDomain
    });
  } else if (message.activityType === "warning-continued") {
    activityState.warningContinues.push({
      time: now,
      domain: message.domain || "",
      rootDomain
    });
  }

  pruneGuardianActivity(activityState, now);
  return maybePromptGuardianSlowdown(tab.id, activityState);
}

function getGuardianTabState(tabId) {
  if (!tabGuardianState.has(tabId)) {
    tabGuardianState.set(tabId, {
      pageVisits: [],
      riskyActions: [],
      warningDismissals: [],
      warningContinues: [],
      promptCooldownUntil: 0
    });
  }

  return tabGuardianState.get(tabId);
}

function pruneGuardianActivity(activityState, now) {
  const cutoffTime = now - GUARDIAN_ACTIVITY_WINDOW_MS;
  activityState.pageVisits = activityState.pageVisits.filter((item) => item.time >= cutoffTime);
  activityState.riskyActions = activityState.riskyActions.filter((item) => item.time >= cutoffTime);
  activityState.warningDismissals = activityState.warningDismissals.filter((item) => item.time >= cutoffTime);
  activityState.warningContinues = activityState.warningContinues.filter((item) => item.time >= cutoffTime);
}

async function maybePromptGuardianSlowdown(tabId, activityState) {
  const now = Date.now();

  if (activityState.promptCooldownUntil > now) {
    return { prompted: false };
  }

  const trigger = getGuardianSlowdownTrigger(activityState);

  if (!trigger) {
    return { prompted: false };
  }

  activityState.promptCooldownUntil = now + GUARDIAN_PROMPT_COOLDOWN_MS;

  if (!(await doesTabStillExist(tabId))) {
    return { prompted: false };
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "LABYRINTH_GUARDIAN_UPDATE",
      title: "Let's slow down for a second",
      message: trigger.message,
      reasons: trigger.reasons
    });
  } catch (error) {
    return { prompted: false };
  }

  return { prompted: true };
}

function getGuardianSlowdownTrigger(activityState) {
  const recentPageVisits = activityState.pageVisits.slice(-8);
  const distinctDomains = new Set(
    recentPageVisits
      .map((item) => item.rootDomain || item.domain)
      .filter(Boolean)
  );
  const riskyVisitCount = recentPageVisits.filter((item) => item.score >= 60).length;

  if (recentPageVisits.length >= 6 && riskyVisitCount >= 2) {
    return {
      message: "You have been moving through a lot of pages quickly. A short pause can help you stay in control.",
      reasons: [
        "Many page changes happened in a short time.",
        "Fast browsing can make tricky pages harder to spot."
      ]
    };
  }

  if (distinctDomains.size >= 4 && recentPageVisits.length >= 5 && riskyVisitCount >= 2) {
    return {
      message: "You have been switching across several unrelated sites quickly. A short pause can help.",
      reasons: [
        "Several different website names showed up in a short time.",
        "Slowing down can make hidden tricks easier to notice."
      ]
    };
  }

  if (activityState.riskyActions.length >= 3) {
    return {
      message: "Several risky clicks showed up in a short time. A short pause can help you choose the safer path.",
      reasons: [
        "Risky links or forms were tried more than once.",
        "Taking a moment can help before the next click."
      ]
    };
  }

  if (activityState.warningDismissals.length >= 2) {
    return {
      message: "You have closed more than one warning quickly. A short pause can help before moving on.",
      reasons: [
        "Warnings were dismissed more than once.",
        "Reviewing one more time can help with tricky pages."
      ]
    };
  }

  return null;
}

function getRootDomain(hostname) {
  const normalizedHost = String(hostname || "").toLowerCase();
  const hostParts = normalizedHost.split(".").filter(Boolean);

  if (hostParts.length <= 2) {
    return normalizedHost;
  }

  return hostParts.slice(-2).join(".");
}

function getBadgeColor(score) {
  if (score >= 80) {
    return "#c45b4d";
  }

  if (score >= 60) {
    return "#d8844b";
  }

  if (score >= 40) {
    return "#d9b458";
  }

  if (score >= 20) {
    return "#b9c884";
  }

  return "#72a978";
}

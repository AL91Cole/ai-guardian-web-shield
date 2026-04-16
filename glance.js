const DEFAULT_SETTINGS = Object.freeze({
  readAloudEnabled: true
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

const BAND_CLASS = {
  safe: "tone-safe",
  low: "tone-low",
  medium: "tone-medium",
  high: "tone-high",
  risk: "tone-risk",
  unknown: "tone-unknown"
};

const openPanelButton = document.getElementById("openPanelButton");
const refreshButton = document.getElementById("refreshButton");
const readButton = document.getElementById("readButton");
const scoreBadge = document.getElementById("scoreBadge");
const scoreNumber = document.getElementById("scoreNumber");
const scoreLabel = document.getElementById("scoreLabel");
const statusSummary = document.getElementById("statusSummary");

let lastReport = null;
let currentSpeech = null;
let readAloudEnabled = true;

document.addEventListener("DOMContentLoaded", async () => {
  openPanelButton.addEventListener("click", handleOpenPanelClick);
  refreshButton.addEventListener("click", () => loadQuickReport(true));
  readButton.addEventListener("click", handleReadAloudClick);

  await loadQuickSettings();
  updateReadButton();
  await loadQuickReport(false);
});

window.addEventListener("beforeunload", stopReading);

async function loadQuickSettings() {
  const storedSettings = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  readAloudEnabled = Boolean(
    typeof storedSettings.readAloudEnabled === "boolean"
      ? storedSettings.readAloudEnabled
      : DEFAULT_SETTINGS.readAloudEnabled
  );
}

async function loadQuickReport(forceRefresh) {
  setRefreshingState(true);

  try {
    renderReport(buildScanningReport());
    const tab = await getActiveTab();
    const tabId = tab?.id;

    if (!tabId) {
      renderReport(buildUnavailableReport("We could not find the current tab."));
      return;
    }

    let report = null;

    if (!forceRefresh) {
      const response = await chrome.runtime.sendMessage({
        type: "GET_TAB_STATE",
        tabId
      });
      const cachedState = response && response.ok ? response.state : null;
      report = isFreshTabReport(cachedState, tab) ? cachedState.report : null;
    }

    if (!report) {
      report = await requestLivePageReport(tab);
    }

    renderReport(report && report.ok ? report : buildUnavailableReport("This page is not ready for a live score yet."));
  } catch (error) {
    renderReport(buildUnavailableReport("We could not load the current page score."));
  } finally {
    setRefreshingState(false);
  }
}

async function handleOpenPanelClick() {
  const tab = await getActiveTab();

  const response = await chrome.runtime.sendMessage({
    type: "OPEN_DETAILS_PANEL",
    tabId: tab?.id,
    windowId: tab?.windowId
  });

  if (response && response.ok) {
    window.close();
  }
}

function handleReadAloudClick() {
  if (!readAloudEnabled || !lastReport || !("speechSynthesis" in window)) {
    return;
  }

  if (window.speechSynthesis.speaking) {
    stopReading();
    return;
  }

  const speechText = [
    typeof lastReport.score === "number" ? `AI Guardian score ${lastReport.score}. ${lastReport.label}.` : "",
    lastReport.summary || "",
    Array.isArray(lastReport.reasons) && lastReport.reasons.length
      ? `Top reasons. ${lastReport.reasons.slice(0, 3).join(" ")}`
      : ""
  ].filter(Boolean).join(" ");

  if (!speechText) {
    return;
  }

  currentSpeech = new SpeechSynthesisUtterance(speechText);
  currentSpeech.rate = 0.95;
  currentSpeech.pitch = 1;
  currentSpeech.onend = updateReadButton;
  currentSpeech.onerror = updateReadButton;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(currentSpeech);
  updateReadButton();
}

function stopReading() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  currentSpeech = null;
  updateReadButton();
}

function updateReadButton() {
  const canRead = readAloudEnabled && "speechSynthesis" in window;
  readButton.disabled = !canRead;
  readButton.textContent = canRead && window.speechSynthesis.speaking ? "Stop Reading" : "Read Out Loud";
}

function renderReport(report) {
  lastReport = report;
  scoreNumber.textContent = typeof report.score === "number" ? String(report.score) : "--";
  scoreLabel.textContent = report.label || "Unavailable";
  scoreBadge.className = `score-badge ${BAND_CLASS[report.band] || BAND_CLASS.unknown}`;
  statusSummary.textContent = report.summary || "No summary yet.";
}

function setRefreshingState(isRefreshing) {
  refreshButton.disabled = isRefreshing;
  refreshButton.textContent = isRefreshing ? "Scanning..." : "Scan Again";
}

function buildScanningReport() {
  return {
    score: null,
    label: "Scanning",
    band: "unknown",
    summary: "Scanning this page now.",
    reasons: []
  };
}

function buildUnavailableReport(summary) {
  return {
    score: null,
    label: "Unavailable",
    band: "unknown",
    summary,
    reasons: []
  };
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0];
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

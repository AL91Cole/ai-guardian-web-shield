// Scans only visible inbox rows and returns simple row preview results.
(() => {
  const root = window;
  const emailNamespace = root.AI_GUARDIAN_EMAIL = root.AI_GUARDIAN_EMAIL || {};

  function getDeps() {
    return root.aiGuardianEmailDeps || {};
  }

  function getNormalizedText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getVisibleRows(environment) {
    const deps = getDeps();
    const domUtils = emailNamespace.domUtils || {};
    const providerDetection = emailNamespace.providerDetection || {};
    const rows = [];
    const seenRows = new Set();
    const rowSelectors = [
      ...(environment?.rowSelectors || []),
      ...providerDetection.getGenericRowSelectors?.() || []
    ];

    rowSelectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((row) => {
          if (
            !(row instanceof HTMLElement) ||
            seenRows.has(row) ||
            typeof deps.isVisibleElement !== "function" ||
            !deps.isVisibleElement(row) ||
            typeof domUtils.isElementNearViewport !== "function" ||
            !domUtils.isElementNearViewport(row, 260)
          ) {
            return;
          }

          if (!looksLikeInboxRow(row, environment)) {
            return;
          }

          seenRows.add(row);
          rows.push(row);
        });
      } catch (error) {
        return;
      }
    });

    if (rows.length < 4) {
      getHeuristicRowCandidates(environment).forEach((row) => {
        if (seenRows.has(row) || !looksLikeInboxRow(row, environment)) {
          return;
        }

        seenRows.add(row);
        rows.push(row);
      });
    }

    return rows;
  }

  function getHeuristicRowCandidates(environment) {
    const deps = getDeps();
    const domUtils = emailNamespace.domUtils || {};
    const containerSelectors = [
      "[role='grid']",
      "[role='table']",
      "[role='list']",
      "[role='listbox']",
      "[role='main']",
      "main",
      "[data-test-id*='message-list']",
      "[class*='message-list' i]",
      "[class*='thread-list' i]"
    ];
    const candidateSelectors = [
      "tr",
      "li",
      "article",
      "[role='row']",
      "[role='option']",
      "[data-message-id]",
      "[data-thread-id]",
      "[data-convid]"
    ];
    const candidates = [];
    const seenRows = new Set();

    containerSelectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((container) => {
          if (
            !(container instanceof HTMLElement) ||
            typeof deps.isVisibleElement !== "function" ||
            !deps.isVisibleElement(container)
          ) {
            return;
          }

          candidateSelectors.forEach((candidateSelector) => {
            container.querySelectorAll(candidateSelector).forEach((row) => {
              if (
                !(row instanceof HTMLElement) ||
                seenRows.has(row) ||
                typeof deps.isVisibleElement !== "function" ||
                !deps.isVisibleElement(row) ||
                typeof domUtils.isElementNearViewport !== "function" ||
                !domUtils.isElementNearViewport(row, 260)
              ) {
                return;
              }

              seenRows.add(row);
              candidates.push(row);
            });
          });
        });
      } catch (error) {
        return;
      }
    });

    return candidates.slice(0, environment?.maxRows || 24);
  }

  function getFieldText(row, selectors = []) {
    for (const selector of selectors) {
      try {
        const node = row.querySelector(selector);

        if (!(node instanceof HTMLElement)) {
          continue;
        }

        const text = getNormalizedText(
          node.textContent ||
          node.getAttribute("email") ||
          node.getAttribute("data-email") ||
          node.getAttribute("data-hovercard-id") ||
          node.getAttribute("title")
        );

        if (text) {
          return text;
        }
      } catch (error) {
        continue;
      }
    }

    return "";
  }

  function getGmailRowParts(row, environment) {
    const providerDetection = emailNamespace.providerDetection || {};
    const sender = getFieldText(row, providerDetection.getFieldSelectors?.(environment, "sender") || []);
    const subject = getFieldText(row, providerDetection.getFieldSelectors?.(environment, "subject") || []);
    const snippet = getFieldText(row, providerDetection.getFieldSelectors?.(environment, "snippet") || []);

    return {
      sender,
      subject,
      snippet,
      combinedText: getNormalizedText([sender, subject, snippet].filter(Boolean).join(" "))
    };
  }

  function getFallbackRowParts(row) {
    const lines = String(row?.innerText || "")
      .split(/\n+/)
      .map((line) => getNormalizedText(line))
      .filter(Boolean);
    const sender = lines[0] || "";
    const subject = lines[1] || "";
    const snippet = lines.slice(2).join(" ");

    return {
      sender,
      subject,
      snippet,
      combinedText: getNormalizedText([sender, subject, snippet].filter(Boolean).join(" "))
    };
  }

  function extractRowParts(row, environment) {
    const providerDetection = emailNamespace.providerDetection || {};
    const sender = getFieldText(row, providerDetection.getFieldSelectors?.(environment, "sender") || []);
    const subject = getFieldText(row, providerDetection.getFieldSelectors?.(environment, "subject") || []);
    const snippet = getFieldText(row, providerDetection.getFieldSelectors?.(environment, "snippet") || []);
    const combinedText = getNormalizedText([sender, subject, snippet].filter(Boolean).join(" "));

    if (environment?.id === "gmail" && combinedText.length > 0) {
      return getGmailRowParts(row, environment);
    }

    if (combinedText.length > 0) {
      return {
        sender,
        subject,
        snippet,
        combinedText
      };
    }

    return getFallbackRowParts(row);
  }

  function looksLikeInboxRow(row, environment) {
    const rowParts = extractRowParts(row, environment);
    const rowText = rowParts.combinedText || getNormalizedText(row.innerText || "");
    const signalCount = [
      rowText.length >= 12,
      Boolean(rowParts.sender),
      Boolean(rowParts.subject || rowParts.snippet),
      row.querySelectorAll("a, button, [role='button']").length > 0,
      row.childElementCount >= 2
    ].filter(Boolean).length;

    return signalCount >= 3;
  }

  function buildStableRowKey(row, rowParts, fallbackKey = "") {
    const extractedKey = getNormalizedText(
      [rowParts.sender, rowParts.subject, rowParts.snippet].filter(Boolean).join("|")
    );

    return extractedKey || fallbackKey;
  }

  function scanRows(environment) {
    const state = emailNamespace.emailState;
    const heuristics = emailNamespace.emailHeuristics;
    const seenRowKeys = new Set();

    return getVisibleRows(environment)
      .slice(0, environment?.maxRows || 24)
      .map((row) => {
        const fallbackKey = state?.buildRowKey ? state.buildRowKey(row) : "";
        const rowParts = extractRowParts(row, environment);
        const rowKey = buildStableRowKey(row, rowParts, fallbackKey);

        if (!rowKey || seenRowKeys.has(rowKey)) {
          return null;
        }

        seenRowKeys.add(rowKey);

        return {
          row,
          rowKey,
          rowParts,
          features: heuristics?.buildRowFeatureObject
            ? heuristics.buildRowFeatureObject(rowParts, environment)
            : null,
          preview: heuristics?.assessInboxRow ? heuristics.assessInboxRow(row, environment, rowParts) : null
        };
      })
      .filter((item) => Boolean(item?.preview));
  }

  emailNamespace.inboxRowScanner = {
    getVisibleRows,
    getHeuristicRowCandidates,
    extractRowParts,
    looksLikeInboxRow,
    scanRows
  };
})();

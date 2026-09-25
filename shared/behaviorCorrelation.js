// Correlate browser-visible form actions locally. Never retain field values or URL paths.
(function (root) {
  "use strict";

  const DEFAULT_WINDOW_MS = 90000;
  const MAX_EVENTS = 64;
  const MAX_FINDINGS = 8;
  const STAGES = new Set(["attempted", "paused", "continued"]);

  function httpOrigin(value, base) {
    if (typeof value !== "string" || !value || value.length > 16384) return null;
    try {
      const url = base ? new URL(value, base) : new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.origin : null;
    } catch (_) {
      return null;
    }
  }

  function normalizeEvent(input, time) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    if (!["credential-interaction", "form-submit"].includes(input.type)) return null;
    const formId = typeof input.formId === "number" && Number.isSafeInteger(input.formId)
      ? String(input.formId)
      : input.formId;
    // Callers use generated identifiers, never DOM labels, names, or field contents.
    if (typeof formId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(formId)) return null;
    const pageOrigin = httpOrigin(input.pageUrl);
    if (!pageOrigin) return null;
    const destinationOrigin = httpOrigin(input.destinationUrl, input.pageUrl);
    if (!destinationOrigin) return null;
    const method = typeof input.method === "string" ? input.method.toUpperCase() : "GET";
    if (!["GET", "POST"].includes(method)) return null;
    const event = {
      type: input.type,
      formId,
      pageOrigin,
      destinationOrigin,
      method,
      credential: input.credential === true || input.type === "credential-interaction",
      suspiciousDestination: input.suspiciousDestination === true,
      time
    };
    if (input.type === "form-submit") {
      event.stage = STAGES.has(input.stage) ? input.stage : "attempted";
    }
    return event;
  }

  function fingerprint(event) {
    return JSON.stringify([
      event.type, event.formId, event.pageOrigin, event.destinationOrigin,
      event.method, event.credential, event.suspiciousDestination
    ]);
  }

  function createCorrelator(options = {}) {
    if (!options || typeof options !== "object") options = {};
    const clock = typeof options.now === "function" ? options.now : Date.now;
    const windowMs = Number.isFinite(options.windowMs) && options.windowMs > 0
      ? Math.min(options.windowMs, DEFAULT_WINDOW_MS)
      : DEFAULT_WINDOW_MS;
    let events = [];

    function currentTime() {
      try {
        const time = clock();
        return Number.isFinite(time) ? time : Date.now();
      } catch (_) {
        return Date.now();
      }
    }

    function prune(time) {
      events = events.filter((event) => event.time > time - windowMs && event.time <= time)
        .slice(-MAX_EVENTS);
    }

    function buildSummary(currentEvent = null) {
      prune(currentTime());
      const findings = [];
      const currentFindings = [];
      events.forEach((event, index) => {
        if (event.type !== "form-submit") return;
        const interactions = events.slice(0, index).filter((prior) =>
          prior.type === "credential-interaction" && prior.formId === event.formId &&
          prior.pageOrigin === event.pageOrigin
        );
        // A prior interaction alone does not mean the current submission includes
        // a credential control: it may since have been disabled or unnamed.
        if (!event.credential) return;
        const external = event.destinationOrigin !== event.pageOrigin;
        const changedDestination = external && interactions.some((prior) =>
          prior.destinationOrigin !== event.destinationOrigin
        );
        let rule;
        let score;
        let reason;
        let consequence;
        if (event.method === "GET") {
          rule = "credential-get";
          score = 88;
          reason = "This sign-in form uses GET, which can put entered credentials in the destination URL.";
          consequence = "Credentials could appear in a URL";
        } else if (event.destinationOrigin.startsWith("http:")) {
          rule = "credential-http";
          score = 86;
          reason = "This sign-in form targets an unencrypted HTTP connection.";
          consequence = "Credentials could travel without encryption";
        } else if (changedDestination) {
          rule = "credential-destination-change";
          score = 82;
          reason = "After a sign-in field interaction, this form now targets a different external origin.";
          consequence = "Entered credentials could reach a changed destination";
        } else if (external && event.suspiciousDestination) {
          rule = "credential-suspicious-destination";
          score = 80;
          reason = "This sign-in form targets an external origin with additional warning signs.";
          consequence = "Entered credentials could reach a suspicious destination";
        } else {
          return;
        }
        const interaction = interactions.length > 0;
        const finding = {
          rule, score, reason,
          stage: event.stage,
          formId: event.formId,
          pageOrigin: event.pageOrigin,
          destinationOrigin: event.destinationOrigin,
          method: event.method,
          observedAt: event.time,
          chain: [
            interaction ? "Sign-in field interaction observed" : "Sign-in field present",
            `Form submission ${event.stage}`,
            consequence
          ]
        };
        findings.push(finding);
        if (event === currentEvent) currentFindings.push(finding);
      });
      const boundedFindings = findings.slice(-MAX_FINDINGS).reverse();
      return {
        score: boundedFindings.reduce((highest, finding) => Math.max(highest, finding.score), 0),
        reasons: [...new Set(boundedFindings.map((finding) => finding.reason))].slice(0, 3),
        findings: boundedFindings,
        events: events.map((event) => ({ ...event })),
        current: {
          score: currentFindings.reduce((highest, finding) => Math.max(highest, finding.score), 0),
          reasons: currentFindings.map((finding) => finding.reason),
          findings: currentFindings
        }
      };
    }

    function getSummary() {
      const { current, ...summary } = buildSummary();
      return summary;
    }

    function observe(input) {
      const time = currentTime();
      prune(time);
      let event;
      try {
        event = normalizeEvent(input, time);
      } catch (_) {
        event = null;
      }
      if (event) {
        const key = fingerprint(event);
        // A repeated action or a stage update replaces its old record, not its weight.
        if (event.type === "form-submit") {
          events = events.filter((previous) => fingerprint(previous) !== key);
        } else if (events.length && fingerprint(events[events.length - 1]) === key) {
          // Coalesce uninterrupted typing, but preserve interactions before earlier submissions.
          events.pop();
        }
        events.push(event);
        events = events.slice(-MAX_EVENTS);
      }
      return buildSummary(event);
    }

    function reset() {
      events = [];
      return getSummary();
    }

    return Object.freeze({ observe, getSummary, reset });
  }

  const api = Object.freeze({ createCorrelator });
  root.AI_GUARDIAN_BEHAVIOR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);

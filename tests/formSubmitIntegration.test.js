const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Execute the actual content-script handler in a small DOM harness. Native
// browser validation/navigation are outside this harness; requestSubmit's
// synchronous event delivery is modeled so one-use approvals can be exercised.
function harness({ realAssessment = false } = {}) {
  const pageUrl = "https://accounts.example.test/sign-in";
  const decisions = [];
  const requests = [];
  const activity = [];
  let context;
  class HTMLFormElement {
    constructor() {
      this.tagName = "FORM";
      this.isConnected = true;
      this.ownerDocument = { baseURI: pageUrl };
      this.attributes = {
        action: "/session", method: "get", target: "_self",
        enctype: "application/x-www-form-urlencoded"
      };
      this.elements = [{
        tagName: "INPUT", form: this, type: "password", name: "password",
        disabled: false, matches: () => false, closest: () => null
      }];
      Object.defineProperty(this.elements[0], "value", {
        get() { throw new Error("The handler must not read credential contents"); }
      });
    }
    get method() { return this.attributes.method; }
    set method(value) { this.attributes.method = value; }
    get target() { return this.attributes.target; }
    set target(value) { this.attributes.target = value; }
    get enctype() { return this.attributes.enctype; }
    set enctype(value) { this.attributes.enctype = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    closest() { return null; }
    requestSubmit(submitter) {
      const event = makeEvent(this, submitter || null);
      requests.push({ form: this, submitter, event });
      context.handleFormSubmit(event);
    }
  }
  function makeEvent(form, submitter = null, isTrusted = true) {
    return {
      target: form, submitter, isTrusted, defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.propagationStopped = true; }
    };
  }
  context = vm.createContext({
    URL, console, HTMLFormElement, location: new URL(pageUrl),
    document: { baseURI: pageUrl },
    uniqueList: items => [...new Set(items)],
    assessForm: () => ({
      score: 0, reasons: [], key: "test-form", signalCounts: { moderate: 0, strong: 0 },
      riskContext: { suspiciousDestination: false }
    }),
    normalizeHost: hostname => hostname,
    getRootDomain: hostname => hostname,
    assessUrl: url => ({
      score: 0, reasons: [], cleanedUrl: url,
      signalCounts: { moderate: 0, strong: 0 },
      identitySignals: { protocol: "https:" }
    }),
    describeFormFields: form => ({
      passwordCount: form.elements.filter(field => field.type === "password" && !field.disabled).length,
      privateCount: 0,
      privateExamples: []
    }),
    applyRiskGuardrails: score => score,
    formatQuotedExamples: examples => examples.join(", "),
    refreshBehaviorReport: () => {},
    getProtectionProfile: () => ({ actionWarningThreshold: 70 }),
    getFormGuidedProtectionFlags: () => ({}),
    shouldUseGuidedProtectionMode: () => false,
    buildGuidedProtectionCopy: () => ({ title: "Check", message: "Check" }),
    buildWarningTrustCopy: () => ({ title: "Check", message: "Check" }),
    showDecisionDialog: decision => decisions.push(decision),
    reportGuardianActivity: (type, details) => activity.push({ type, details }),
    resetCurrentPageStateForNavigation: () => context.state.behaviorMonitor.reset()
  });
  context.window = context;
  for (const filename of ["behaviorCorrelation.js", "behaviorMonitor.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "shared", filename), "utf8"), context);
  }
  context.state = {
    settings: { proactiveWarningsEnabled: true, extraSimpleLanguageEnabled: false },
    lastUrl: pageUrl,
    approvedForms: new WeakMap(),
    behaviorMonitor: context.AI_GUARDIAN_BEHAVIOR_MONITOR.createMonitor({ now: () => 1000 })
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
  const start = source.indexOf("  function handleFormSubmit(event) {");
  const end = source.indexOf("\n  function refreshBehaviorReport()", start);
  assert.ok(start >= 0 && end > start, "actual content-script handler is available");
  vm.runInContext(source.slice(start, end), context);
  if (realAssessment) {
    const assessmentStart = source.indexOf("  function assessForm(form,");
    const assessmentEnd = source.indexOf("\n  function maybeShowPageWarning(", assessmentStart);
    assert.ok(assessmentStart >= 0 && assessmentEnd > assessmentStart);
    vm.runInContext(source.slice(assessmentStart, assessmentEnd), context);
  }
  function submitter(form, attributes = {}) {
    return {
      tagName: "BUTTON", type: "submit", form, isConnected: true, attributes,
      getAttribute(name) { return this.attributes[name] ?? null; },
      hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
      get formMethod() { return this.attributes.formmethod || "get"; },
      get formTarget() { return this.attributes.formtarget || ""; },
      get formEnctype() { return this.attributes.formenctype || "application/x-www-form-urlencoded"; }
    };
  }
  return {
    context, decisions, requests, activity, makeEvent, submitter,
    form: () => new HTMLFormElement(),
    handle: event => context.handleFormSubmit(event),
    summary: () => context.state.behaviorMonitor.getSummary()
  };
}

test("a risky submission pauses, then requestSubmit preserves the original submitter exactly once", () => {
  const app = harness();
  const form = app.form();
  form.method = "post";
  const button = app.submitter(form, {
    formaction: "https://collector.example.net/receive", formmethod: "get"
  });
  const first = app.makeEvent(form, button);
  app.handle(first);
  assert.equal(first.defaultPrevented, true);
  assert.equal(first.propagationStopped, true);
  assert.equal(app.decisions.length, 1);
  assert.equal(app.summary().findings[0].stage, "paused");
  app.decisions[0].onContinue();
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].submitter, button);
  assert.equal(app.requests[0].event.defaultPrevented, false);
  assert.equal(app.decisions.length, 1);
  assert.equal(app.summary().findings[0].stage, "continued");
  assert.equal(app.context.state.approvedForms.has(form), false);
  const repeated = app.makeEvent(form, button);
  app.handle(repeated);
  assert.equal(repeated.defaultPrevented, true);
  assert.equal(app.decisions.length, 2);
});

test("changing a destination while the warning is open requires a fresh warning", () => {
  const app = harness();
  const form = app.form();
  const button = app.submitter(form, { formaction: "https://first.example.net/receive" });
  app.handle(app.makeEvent(form, button));
  button.attributes.formaction = "https://second.example.net/receive";
  app.decisions[0].onContinue();
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].event.defaultPrevented, true);
  assert.equal(app.decisions.length, 2);
  assert.equal(app.context.state.approvedForms.has(form), false);
});

test("changing the browsing target also invalidates a pending approval", () => {
  const app = harness();
  const form = app.form();
  app.handle(app.makeEvent(form));
  form.target = "_blank";
  app.decisions[0].onContinue();
  assert.equal(app.requests[0].event.defaultPrevented, true);
  assert.equal(app.decisions.length, 2);
});

test("synthetic submit events do not create warnings or behavior evidence", () => {
  const app = harness();
  const event = app.makeEvent(app.form(), null, false);
  app.handle(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(app.decisions.length, 0);
  assert.equal(app.summary().events.length, 0);
  assert.equal(app.activity.length, 0);
});

test("dialog method does not create a transfer warning", () => {
  const app = harness();
  const form = app.form();
  const button = app.submitter(form, { formmethod: "dialog" });
  const event = app.makeEvent(form, button);
  app.handle(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(app.decisions.length, 0);
  assert.equal(app.summary().events.length, 0);
});

test("a removed form or reassociated submitter cannot be resumed", () => {
  for (const mutate of [
    (form) => { form.isConnected = false; },
    (_form, button) => { button.isConnected = false; },
    (_form, button) => { button.form = {}; }
  ]) {
    const app = harness();
    const form = app.form();
    const button = app.submitter(form);
    app.handle(app.makeEvent(form, button));
    mutate(form, button);
    app.decisions[0].onContinue();
    assert.equal(app.requests.length, 0);
    assert.equal(app.context.state.approvedForms.has(form), false);
  }
});

test("warnings disabled still observes attempted behavior without claiming completion", () => {
  const app = harness();
  app.context.state.settings.proactiveWarningsEnabled = false;
  const event = app.makeEvent(app.form());
  app.handle(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(app.decisions.length, 0);
  assert.equal(app.summary().findings[0].stage, "attempted");
});

test("a risky form does not make a different harmless form inherit its warning", () => {
  const app = harness({ realAssessment: true });
  const risky = app.form();
  app.handle(app.makeEvent(risky));
  assert.equal(app.decisions.length, 1);
  assert.equal(app.summary().score, 88);
  // Model the page report after correlation raises its displayed score.
  app.context.state.currentReport = {
    score: app.summary().score, baseScore: 0, reasons: app.summary().reasons
  };
  const harmless = app.form();
  harmless.elements = [];
  harmless.method = "post";
  const event = app.makeEvent(harmless);
  app.handle(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(app.decisions.length, 1);
  assert.equal(app.summary().score, 88, "earlier page evidence remains available");
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PAGE_URL = "https://accounts.example.test/sign-in";

function loadMonitor(baseURI = PAGE_URL, core = null) {
  const context = vm.createContext({
    URL,
    console,
    document: { baseURI },
    location: new URL(PAGE_URL)
  });
  context.window = context;
  if (core) context.AI_GUARDIAN_BEHAVIOR = core;
  for (const filename of ["behaviorCorrelation.js", "behaviorMonitor.js"]) {
    if (filename === "behaviorCorrelation.js" && core) continue;
    const source = fs.readFileSync(path.join(__dirname, "..", "shared", filename), "utf8");
    vm.runInContext(source, context, { filename });
  }
  return context.AI_GUARDIAN_BEHAVIOR_MONITOR;
}

function recordingMonitor() {
  const events = [];
  let resets = 0;
  const core = {
    createCorrelator() {
      return {
        observe(event) { events.push(event); return { count: events.length }; },
        getSummary() { return { count: events.length }; },
        reset() { events.length = 0; resets += 1; }
      };
    }
  };
  const monitor = loadMonitor(PAGE_URL, core).createMonitor();
  return { monitor, events, resetCount: () => resets };
}

function attributes(values) {
  return {
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(values, name);
    }
  };
}

function makeForm({ action = "/session", method = "post", baseURI = PAGE_URL } = {}) {
  const values = { action, method };
  return {
    tagName: "FORM",
    ownerDocument: { baseURI, URL: PAGE_URL },
    ...attributes(values),
    action: new URL(action || PAGE_URL, baseURI).href,
    method,
    elements: [],
    closest() { return null; },
    querySelectorAll() {
      throw new Error("Use form.elements to include externally associated controls");
    }
  };
}

function addField(form, {
  type = "password", name = "password", autocomplete = "",
  disabled = false, disabledByFieldset = false, owner = form
} = {}) {
  const field = {
    tagName: "INPUT", type, name, autocomplete, disabled, form: owner,
    ...attributes({ type, name, autocomplete }),
    matches(selector) {
      return selector === ":disabled" && (disabled || disabledByFieldset);
    },
    closest() { return null; }
  };
  for (const property of ["value", "defaultValue", "textContent", "innerText"]) {
    Object.defineProperty(field, property, {
      get() { throw new Error(`Credential content must never be read: ${property}`); }
    });
  }
  form.elements.push(field);
  return field;
}

function makeSubmitter(form, overrides = {}) {
  const baseURI = form.ownerDocument.baseURI;
  return {
    tagName: "BUTTON", type: "submit", form,
    ...attributes(overrides),
    formAction: new URL(overrides.formaction || PAGE_URL, baseURI).href,
    formMethod: overrides.formmethod || "get",
    closest() { return null; }
  };
}

test("normal submission resolves the destination and detects credential metadata without values", () => {
  const api = loadMonitor();
  const form = makeForm();
  addField(form);
  const intent = api.getSubmission(form, null, PAGE_URL);
  assert.equal(intent.destinationUrl, "https://accounts.example.test/session");
  assert.equal(intent.method.toLowerCase(), "post");
  assert.equal(intent.credential, true);
  assert.equal(typeof intent.intentKey, "string");
});

test("submitter overrides reveal a cross-origin GET even when the form defaults are safe", () => {
  const api = loadMonitor();
  const form = makeForm();
  addField(form);
  const normal = api.getSubmission(form, null, PAGE_URL);
  const submitter = makeSubmitter(form, {
    formaction: "https://collector.example.net/receive",
    formmethod: "get"
  });
  const intent = api.getSubmission(form, submitter, PAGE_URL);
  assert.equal(intent.destinationUrl, "https://collector.example.net/receive");
  assert.equal(intent.method.toLowerCase(), "get");
  assert.notEqual(intent.intentKey, normal.intentKey);
});

test("relative destinations use the document base URI", () => {
  const baseURI = "https://forms.example.net/account/";
  const api = loadMonitor(baseURI);
  const form = makeForm({ action: "session", baseURI });
  assert.equal(api.getSubmission(form, null, PAGE_URL).destinationUrl,
    "https://forms.example.net/account/session");
});

test("empty action targets the current document despite an external base URI", () => {
  const baseURI = "https://forms.example.net/account/";
  const api = loadMonitor(baseURI);
  const form = makeForm({ action: "", baseURI });
  assert.equal(api.getSubmission(form, null, PAGE_URL).destinationUrl, PAGE_URL);
});

test("empty submitter action targets the current document", () => {
  const baseURI = "https://forms.example.net/account/";
  const api = loadMonitor(baseURI);
  const form = makeForm({ action: "https://collector.example.net/receive", baseURI });
  const submitter = makeSubmitter(form, { formaction: "" });
  assert.equal(api.getSubmission(form, submitter, PAGE_URL).destinationUrl, PAGE_URL);
});

test("a submitter belonging to another form cannot change this form's destination", () => {
  const api = loadMonitor();
  const form = makeForm();
  const unrelated = makeForm();
  const submitter = makeSubmitter(unrelated, {
    formaction: "https://collector.example.net/receive", formmethod: "get"
  });
  const intent = api.getSubmission(form, submitter, PAGE_URL);
  assert.equal(intent.destinationUrl, form.action);
  assert.equal(intent.method.toLowerCase(), "post");
});

test("disabled, fieldset-disabled, and unnamed passwords do not imply credentials will be sent", () => {
  const api = loadMonitor();
  for (const options of [{ disabled: true }, { disabledByFieldset: true }, { name: "" }]) {
    const form = makeForm();
    addField(form, options);
    assert.equal(api.getSubmission(form, null, PAGE_URL).credential, false);
  }
});

test("a credential control associated with another form is ignored", () => {
  const api = loadMonitor();
  const form = makeForm();
  addField(form, { owner: makeForm() });
  assert.equal(api.getSubmission(form, null, PAGE_URL).credential, false);
});

test("externally associated password and one-time-code controls count without reading values", () => {
  const api = loadMonitor();
  for (const options of [
    { type: "password" },
    { type: "text", name: "pin", autocomplete: "one-time-code" },
    { type: "text", autocomplete: "current-password" },
    { type: "text", autocomplete: "new-password" },
    { type: "text", autocomplete: "section-login current-password" }
  ]) {
    const form = makeForm();
    addField(form, options);
    assert.equal(api.getSubmission(form, null, PAGE_URL).credential, true);
  }
});

test("ordinary search and email inputs are not treated as password access", () => {
  const api = loadMonitor();
  const form = makeForm();
  addField(form, { type: "search", name: "query" });
  addField(form, { type: "email", name: "email", autocomplete: "email" });
  assert.equal(api.getSubmission(form, null, PAGE_URL).credential, false);
});

test("only trusted credential input or focus events reach the correlator", () => {
  const { monitor, events } = recordingMonitor();
  const form = makeForm();
  const password = addField(form);
  const ordinary = addField(form, { type: "search", name: "q" });
  const disabled = addField(form, { disabled: true });
  for (const event of [
    { type: "input", isTrusted: false, target: password },
    { type: "click", isTrusted: true, target: password },
    { type: "input", isTrusted: true, target: ordinary },
    { type: "input", isTrusted: true, target: disabled }
  ]) monitor.interaction(event, PAGE_URL);
  assert.equal(events.length, 0);
  monitor.interaction({ type: "focusin", isTrusted: true, target: password }, PAGE_URL);
  monitor.interaction({ type: "input", isTrusted: true, target: password }, PAGE_URL);
  assert.equal(events.length, 2);
  assert.equal(events[0].type, "credential-interaction");
  assert.equal(events[0].formId, events[1].formId);
});

test("the extension's own credential controls do not become page behavior evidence", () => {
  const { monitor, events } = recordingMonitor();
  const form = makeForm();
  const field = addField(form);
  field.closest = () => ({ id: "ai-guardian-modal-root" });
  monitor.interaction({ type: "input", isTrusted: true, target: field }, PAGE_URL);
  assert.equal(events.length, 0);
});

test("form identity correlates only its own interaction with its own submit", () => {
  const { monitor, events } = recordingMonitor();
  const first = makeForm();
  const second = makeForm();
  const firstField = addField(first);
  addField(second);
  monitor.interaction({ type: "input", isTrusted: true, target: firstField }, PAGE_URL);
  monitor.submit(second, null, PAGE_URL);
  monitor.submit(first, null, PAGE_URL);
  assert.notEqual(events[0].formId, events[1].formId);
  assert.equal(events[0].formId, events[2].formId);
});

test("submission is an attempt unless an explicit locally observed stage is supplied", () => {
  const { monitor, events } = recordingMonitor();
  const form = makeForm();
  addField(form);
  const result = monitor.submit(form, null, PAGE_URL);
  assert.equal(events[0].type, "form-submit");
  assert.equal(events[0].stage, "attempted");
  assert.equal(result.intent.credential, true);
  monitor.submit(form, null, PAGE_URL, { stage: "paused", suspiciousDestination: true });
  assert.equal(events[1].stage, "paused");
  assert.equal(events[1].suspiciousDestination, true);
  monitor.submit(form, null, PAGE_URL, { stage: "continued" });
  assert.equal(events[2].stage, "continued");
  assert.ok(events.every(event => !Object.hasOwn(event, "networkSuccess")));
});

test("page changes reset evidence before observations from the new page", () => {
  const { monitor, events, resetCount } = recordingMonitor();
  const first = makeForm();
  addField(first);
  monitor.submit(first, null, PAGE_URL);
  monitor.submit(makeForm(), null, "https://accounts.example.test/profile");
  assert.equal(resetCount(), 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].pageUrl, "https://accounts.example.test/profile");
});

test("reset clears history and starts fresh form identifiers", () => {
  const { monitor, events, resetCount } = recordingMonitor();
  monitor.submit(makeForm(), null, PAGE_URL);
  const firstId = events[0].formId;
  monitor.submit(makeForm(), null, PAGE_URL);
  monitor.reset();
  assert.equal(events.length, 0);
  monitor.submit(makeForm(), null, PAGE_URL);
  assert.equal(events[0].formId, firstId);
  assert.equal(resetCount(), 1);
});

test("a changed external destination produces one finding with updated local stages", () => {
  let now = 1000;
  const monitor = loadMonitor().createMonitor({ now: () => now });
  const form = makeForm();
  const field = addField(form);
  monitor.interaction({ type: "focusin", isTrusted: true, target: field }, PAGE_URL);
  const submitter = makeSubmitter(form, { formaction: "https://collector.example.net/session" });
  for (const stage of ["attempted", "paused", "continued"]) {
    now += 100;
    const { summary } = monitor.submit(form, submitter, PAGE_URL, { stage });
    assert.equal(summary.findings.length, 1);
    assert.equal(summary.findings[0].rule, "credential-destination-change");
    assert.equal(summary.findings[0].stage, stage);
    assert.equal(summary.findings[0].destinationOrigin, "https://collector.example.net");
    assert.ok(summary.findings[0].chain.some(item => item.includes(stage)));
  }
  now += 90001;
  assert.equal(monitor.getSummary().findings.length, 0);
  assert.equal(monitor.getSummary().events.length, 0);
});

test("disabling a password after focus prevents a claim that this submission sends credentials", () => {
  const monitor = loadMonitor().createMonitor({ now: () => 1000 });
  const form = makeForm({ method: "get" });
  const field = addField(form);
  monitor.interaction({ type: "focusin", isTrusted: true, target: field }, PAGE_URL);
  field.disabled = true;
  const { intent, summary } = monitor.submit(form, null, PAGE_URL);
  assert.equal(intent.credential, false);
  assert.equal(summary.findings.length, 0);
});

test("dialog submissions and ordinary HTTPS sign-ins have no correlated risk finding", () => {
  const monitor = loadMonitor().createMonitor({ now: () => 1000 });
  for (const method of ["post", "dialog"]) {
    const form = makeForm({ method });
    const field = addField(form);
    monitor.interaction({ type: "input", isTrusted: true, target: field }, PAGE_URL);
    assert.equal(monitor.submit(form, null, PAGE_URL).summary.findings.length, 0);
  }
});

test("behavior summaries exclude URL paths, query parameters, fragments, and credential values", () => {
  const monitor = loadMonitor().createMonitor({ now: () => 1000 });
  const form = makeForm({ action: "https://collector.example.net/private-path?token=secret-query#private-fragment", method: "get" });
  addField(form);
  const { summary } = monitor.submit(form, null, PAGE_URL);
  assert.equal(summary.findings.length, 1);
  const serialized = JSON.stringify(summary);
  for (const secret of ["private-path", "secret-query", "private-fragment", "intentKey"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { createCorrelator } = require("../shared/behaviorCorrelation.js");

function event(overrides = {}) {
  return {
    type: "form-submit", formId: "form-1", pageUrl: "https://account.example/login",
    destinationUrl: "https://account.example/session", method: "POST", credential: true,
    ...overrides
  };
}

test("isolated password interaction and ordinary HTTPS logins remain quiet", () => {
  const correlator = createCorrelator();
  assert.equal(correlator.observe(event({ type: "credential-interaction" })).score, 0);
  assert.equal(correlator.observe(event()).score, 0);
  correlator.reset();
  assert.equal(correlator.observe(event({ destinationUrl: "https://sso.example/session" })).score, 0);
});

test("GET and HTTP password submissions elevate even for same-origin destinations", () => {
  for (const overrides of [
    { method: "GET" },
    { pageUrl: "http://account.example/login", destinationUrl: "http://account.example/session" }
  ]) {
    const summary = createCorrelator().observe(event(overrides));
    assert.ok(summary.score >= 78);
    assert.equal(summary.findings.length, 1);
    assert.equal(summary.findings[0].stage, "attempted");
    assert.match(summary.findings[0].chain[2], /could/);
  }
});

test("a destination switch after interaction joins only the same form and page origin", () => {
  const correlator = createCorrelator();
  correlator.observe(event({ type: "credential-interaction" }));
  assert.equal(correlator.observe(event({ formId: "form-2", credential: false,
    destinationUrl: "https://collector.example/receive" })).score, 0);
  assert.equal(correlator.observe(event({ credential: false, pageUrl: "https://other.example",
    destinationUrl: "https://collector.example/receive" })).score, 0);
  const summary = correlator.observe(event({ destinationUrl: "https://collector.example/receive" }));
  assert.ok(summary.score >= 78);
  assert.equal(summary.findings[0].rule, "credential-destination-change");
});

test("an already external HTTPS identity provider remains quiet after interaction", () => {
  const correlator = createCorrelator();
  const login = event({ destinationUrl: "https://identity.example/login" });
  correlator.observe({ ...login, type: "credential-interaction" });
  assert.equal(correlator.observe(login).score, 0);
});

test("later field interactions cannot erase a previously observed destination-change chain", () => {
  const correlator = createCorrelator();
  const interaction = event({ type: "credential-interaction" });
  correlator.observe(interaction);
  correlator.observe(event({ destinationUrl: "https://collector.example" }));
  correlator.observe(interaction);
  assert.equal(correlator.getSummary().findings[0].rule, "credential-destination-change");
});

test("prior interaction cannot claim credentials on a now noncredential submission", () => {
  for (const overrides of [
    { method: "GET" },
    { destinationUrl: "http://collector.example" },
    { destinationUrl: "https://collector.example", suspiciousDestination: true }
  ]) {
    const correlator = createCorrelator();
    correlator.observe(event({ type: "credential-interaction" }));
    assert.equal(correlator.observe(event({ ...overrides, credential: false })).score, 0);
  }
});

test("latest findings appear first and credential wording also covers one-time codes", () => {
  const correlator = createCorrelator();
  correlator.observe(event({ formId: "earlier", method: "GET" }));
  const summary = correlator.observe(event({ formId: "latest", destinationUrl: "http://collector.example" }));
  assert.equal(summary.findings[0].formId, "latest");
  assert.doesNotMatch(JSON.stringify(summary.findings), /password/i);
});

test("additional destination risk joins credentials but is harmless alone", () => {
  const correlator = createCorrelator();
  const submission = event({ destinationUrl: "https://collector.example", suspiciousDestination: true });
  assert.equal(correlator.observe({ ...submission, credential: false }).score, 0);
  const summary = correlator.observe(submission);
  assert.ok(summary.score >= 78);
  assert.equal(summary.findings[0].rule, "credential-suspicious-destination");
});

test("exact origins keep unrelated hosted tenants separate", () => {
  const summary = createCorrelator().observe(event({
    pageUrl: "https://alice.github.io/login", destinationUrl: "https://mallory.github.io/session",
    suspiciousDestination: true
  }));
  assert.ok(summary.score >= 78);
  assert.equal(summary.findings[0].destinationOrigin, "https://mallory.github.io");
});

test("duplicates do not accumulate and stage updates make no successful-transfer claim", () => {
  const correlator = createCorrelator();
  const submission = event({ method: "GET" });
  const initial = correlator.observe(submission).score;
  for (let index = 0; index < 100; index++) correlator.observe(submission);
  let summary = correlator.observe({ ...submission, stage: "paused" });
  assert.equal(summary.score, initial);
  assert.equal(summary.events.length, 1);
  assert.equal(summary.findings[0].stage, "paused");
  summary = correlator.observe({ ...submission, stage: "continued" });
  assert.equal(summary.findings[0].stage, "continued");
  assert.doesNotMatch(JSON.stringify(summary), /successfully|were sent|were stolen|exfiltrated/);
});

test("method and destination context changes stay distinct", () => {
  const correlator = createCorrelator();
  correlator.observe(event());
  correlator.observe(event({ method: "GET" }));
  correlator.observe(event({ destinationUrl: "https://collector.example", suspiciousDestination: true }));
  const summary = correlator.getSummary();
  assert.equal(summary.events.length, 3);
  assert.equal(summary.findings.length, 2);
});

test("current findings belong only to the exact latest attempt, not earlier risky forms", () => {
  const correlator = createCorrelator({ now: () => 1000 });
  let summary = correlator.observe(event({ method: "GET" }));
  assert.equal(summary.current.score, 88);
  summary = correlator.observe(event({ formId: "search", credential: false, method: "GET" }));
  assert.equal(summary.score, 88);
  assert.equal(summary.current.score, 0);
  assert.deepEqual(summary.current.findings, []);
  assert.equal(correlator.observe(null).current.score, 0);
  assert.equal(correlator.observe(event({ type: "credential-interaction" })).current.score, 0);
  assert.equal(Object.hasOwn(correlator.getSummary(), "current"), false);
});

test("same-millisecond attempts with different risk contexts cannot borrow each other's finding", () => {
  const correlator = createCorrelator({ now: () => 1000 });
  const submission = event({ destinationUrl: "https://collector.example" });
  assert.equal(correlator.observe({ ...submission, suspiciousDestination: true }).current.score, 80);
  const summary = correlator.observe({ ...submission, suspiciousDestination: false });
  assert.equal(summary.score, 80);
  assert.equal(summary.current.score, 0);
});

test("expiry and reset discard evidence including previous form interactions", () => {
  let time = 1000;
  const correlator = createCorrelator({ now: () => time, windowMs: 100 });
  correlator.observe(event({ type: "credential-interaction" }));
  time = 1100;
  assert.equal(correlator.getSummary().events.length, 0);
  assert.equal(correlator.observe(event({ credential: false, destinationUrl: "https://other.example" })).score, 0);
  correlator.observe(event({ method: "GET" }));
  assert.ok(correlator.getSummary().score >= 78);
  assert.equal(correlator.reset().score, 0);
  assert.deepEqual(correlator.getSummary().events, []);
});

test("metadata retains origins only and returned arrays cannot mutate internal evidence", () => {
  const correlator = createCorrelator();
  const summary = correlator.observe(event({
    method: "GET", pageUrl: "https://name:secret@account.example/private?token=secret#secret",
    destinationUrl: "https://collector.example/private?password=secret#secret", value: "secret",
    password: "secret", headers: { authorization: "secret" }
  }));
  assert.doesNotMatch(JSON.stringify(summary), /secret|\/private|password=|authorization/);
  assert.equal(summary.events[0].pageOrigin, "https://account.example");
  summary.events[0].destinationOrigin = "https://tampered.example";
  summary.findings[0].chain.push("tampered");
  assert.doesNotMatch(JSON.stringify(correlator.getSummary()), /tampered/);
});

test("invalid input, dialog forms and non-HTTP actions do not produce claims", () => {
  const correlator = createCorrelator();
  for (const input of [null, [], {}, "bad", event({ type: "fetch" }), event({ formId: "" }),
    event({ pageUrl: "not a URL" }), event({ method: "DIALOG" }),
    event({ destinationUrl: "javascript:alert(1)" }), event({ destinationUrl: "mailto:user@example.com" })]) {
    assert.equal(correlator.observe(input).score, 0);
  }
  assert.equal(correlator.getSummary().events.length, 0);
});

test("metadata and findings remain bounded", () => {
  const correlator = createCorrelator();
  for (let index = 0; index < 200; index++) correlator.observe(event({ formId: `form-${index}`, method: "GET" }));
  const summary = correlator.getSummary();
  assert.equal(summary.events.length, 64);
  assert.equal(summary.findings.length, 8);
  assert.equal(summary.score, 88);
});

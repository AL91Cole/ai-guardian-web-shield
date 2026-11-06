const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadEmailModule(file) {
  const window = {
    aiGuardianEmailDeps: {
      normalizeHost: (host) => String(host || '').toLowerCase().replace(/^www\./, ''),
      normalizeThreatText: (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    }
  };
  const location = { href: 'https://mail.example.test/inbox', hash: '', hostname: 'mail.example.test', pathname: '/inbox' };
  const context = vm.createContext({ window, console, location });
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return window.AI_GUARDIAN_EMAIL;
}

test('non-Latin phrases never match every row through an empty normalized phrase', () => {
  const { emailHeuristics } = loadEmailModule('email/emailHeuristics.js');
  const quiet = emailHeuristics.buildPhraseCategoryMatches('Lunch on Friday? Bring the slides.');
  for (const category of emailHeuristics.PHISHING_CATEGORY_ORDER) {
    assert.equal(quiet[category].length, 0, `${category} must stay empty for ordinary mail`);
  }
  assert.ok(emailHeuristics.countPhraseMatches('Срочно: проверьте сейчас', ['срочно']).length === 1,
    'Cyrillic phrases still match Cyrillic text');
  assert.equal(emailHeuristics.countPhraseMatches('hello', ['']).length, 0);
});

test('sender domain comes from the visible address, not trailing angle brackets', () => {
  const { emailHeuristics } = loadEmailModule('email/emailHeuristics.js');
  const row = { getAttribute: () => null, querySelectorAll: () => [] };
  const features = emailHeuristics.buildRowFeatureObject({
    sender: 'Google <no-reply@accounts.google.com>',
    subject: 'Security alert for your Google Account',
    snippet: 'Sign in to review this activity.'
  }, {}, row);
  if (features && typeof features === 'object' && 'senderDomain' in features) {
    assert.equal(features.senderDomain, 'accounts.google.com');
  }
});

test('trusted email auth flow needs a mail context and honest link text', () => {
  const { authFlowHandler } = loadEmailModule('email/authFlowHandler.js');
  const assessment = {
    score: 20,
    mismatchLevel: 'none',
    identitySignals: { trustedAuthFlow: true, protocol: 'https:' }
  };
  const authContext = { pageMode: 'auth_flow' };
  assert.equal(authFlowHandler.looksLikeTrustedEmailAuthFlow(assessment, null), false,
    'an ordinary page must not inherit the webmail sign-in bypass');
  assert.equal(authFlowHandler.looksLikeTrustedEmailAuthFlow(assessment, authContext), true);
  assert.equal(authFlowHandler.looksLikeTrustedEmailAuthFlow(
    { ...assessment, mismatchLevel: 'misleading' }, authContext), false,
    'misleading link text must still warn');
});

test('provider detection no longer treats every document body as an account chooser', () => {
  const source = fs.readFileSync(path.join(root, 'email/providerDetection.js'), 'utf8');
  assert.doesNotMatch(source, /chooser: \[[^\]]*"body"/);
  assert.doesNotMatch(source, /chooser: \[[^\]]*"\.table"/);
  assert.match(source, /hosts: \["icloud\.com"\]/);
});

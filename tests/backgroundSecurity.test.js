const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
const ui = { id: 'guardian', url: 'chrome-extension://guardian/popup.html' };
const content = { id: 'guardian', url: 'https://example.test/page', frameId: 0,
  tab: { id: 10, url: 'https://example.test/page', windowId: 1 } };

function worker(initial = {}, denyAccess = false) {
  const values = structuredClone(initial);
  let listener;
  let accessLevel;
  const changed = [];
  const sent = [];
  const chrome = {
    runtime: { id: 'guardian', getURL: p => `chrome-extension://guardian/${p}`,
      onInstalled: { addListener() {} }, onMessage: { addListener: fn => { listener = fn; } } },
    storage: {
      local: {
        async setAccessLevel(input) {
          if (denyAccess) throw new Error('Unavailable');
          accessLevel = input.accessLevel;
        },
        async get(keys) {
          assert.equal(accessLevel, 'TRUSTED_CONTEXTS', 'restrict access before any storage read');
          return Object.fromEntries(keys.filter(k => k in values).map(k => [k, values[k]]));
        },
        async set(input) {
          assert.equal(accessLevel, 'TRUSTED_CONTEXTS');
          Object.assign(values, structuredClone(input));
        },
        async remove(keys) { for (const key of keys) delete values[key]; }
      },
      onChanged: { addListener: fn => changed.push(fn) }
    },
    tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} },
      async query() { return [{ id: 10 }]; }, async get() { return content.tab; },
      async sendMessage(id, message) { sent.push({ id, message }); } },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    sidePanel: { async open() {} }
  };
  vm.runInNewContext(source, { chrome, crypto: webcrypto, TextEncoder, URL, Uint8Array,
    console, structuredClone });
  return { values, sent, changed, send(message, sender = ui) {
    return new Promise(resolve => listener(message, sender, resolve));
  } };
}

test('content can read necessary preferences without reading passcode or personal review data', async () => {
  const w = worker({ trustedAdultContact: 'private note', familyProtectionPasscodeHash: 'secret',
    familyProtectionUnlockedUntil: Date.now() + 5000 });
  const result = await w.send({ type: 'GET_CONTENT_SETTINGS' }, content);
  assert.equal(result.ok, true);
  assert.equal(result.settings.proactiveWarningsEnabled, true);
  assert.equal(result.settings.trustedAdultContact, undefined);
  assert.equal(result.settings.trustedAdultAlertEnabled, undefined);
  assert.equal(result.settings.familyProtectionPasscodeHash, undefined);
  assert.equal(result.settings.familyProtectionUnlockedUntil, undefined);
});

test('content cannot call privileged commands, read another tab, or impersonate the popup', async () => {
  const w = worker();
  for (const sender of [content, { ...content, url: ui.url }, { ...ui, id: 'other' },
    { ...ui, url: `${ui.url}?spoof` }, {}]) {
    for (const type of ['GET_TAB_REPORT', 'GET_TAB_STATE', 'GET_FAMILY_PROTECTION_STATE',
      'SET_FAMILY_PROTECTION_PASSCODE', 'UNLOCK_FAMILY_PROTECTION', 'UPDATE_SETTING_GUARDED']) {
      const result = await w.send({ type, tabId: 99, key: 'readAloudEnabled', value: false,
        newPasscode: '1234', passcode: '1234' }, sender);
      assert.equal(result.ok, false, `${type} must be denied`);
    }
  }
  assert.equal(w.values.familyProtectionPasscodeHash, undefined);
  assert.equal(w.values.readAloudEnabled, true);
});

test('malformed and subframe messages fail closed', async () => {
  const w = worker();
  for (const message of [null, [], {}, { type: 1 }]) {
    assert.equal((await w.send(message, content)).ok, false);
  }
  assert.equal((await w.send({ type: 'GET_CONTENT_SETTINGS' }, { ...content, frameId: 1 })).ok, false);
  assert.equal((await w.send({ type: 'GET_CONTENT_SETTINGS' }, { ...content, url: 'file:///test' })).ok, false);
});

test('setting values are checked before weakening protection or writing preferences', async () => {
  const w = worker();
  for (const [key, value] of [['proactiveWarningsEnabled', 'false'], ['localOnlyMode', false],
    ['protectionLevel', 'none'], ['protectionStyle', 'none'], ['accessibilityProfile', {}],
    ['familyProtectionExceptions', ['safe.test/path']], ['trustedAdultContact', 'x'.repeat(201)],
    ['familyProtectionUnlockedUntil', Date.now() + 999999]]) {
    assert.equal((await w.send({ type: 'UPDATE_SETTING_GUARDED', key, value })).ok, false);
  }
  assert.equal((await w.send({ type: 'UPDATE_SETTING_GUARDED', key: 'readAloudEnabled', value: false })).ok, true);
  assert.equal(w.values.readAloudEnabled, false);
});

test('concurrent incorrect passcodes cannot race the attempt counter', async () => {
  const w = worker();
  assert.equal((await w.send({ type: 'SET_FAMILY_PROTECTION_PASSCODE', newPasscode: '8437' })).ok, true);
  const replies = await Promise.all(Array.from({ length: 10 }, () =>
    w.send({ type: 'UNLOCK_FAMILY_PROTECTION', passcode: '0000' })));
  assert.ok(replies.every(r => r.ok === false));
  assert.ok(w.values.familyProtectionFailedCooldownUntil > Date.now());
  assert.equal(w.values.familyProtectionFailedAttempts, 0);
  assert.equal((await w.send({ type: 'UNLOCK_FAMILY_PROTECTION', passcode: '8437' })).ok, false);
});

test('storage isolation failure blocks requests instead of leaving storage open', async () => {
  const w = worker({}, true);
  assert.equal((await w.send({ type: 'GET_CONTENT_SETTINGS' }, content)).ok, false);
  assert.deepEqual(w.values, {});
});

test('settings broadcasts exclude personal data and target the top frame', async () => {
  const w = worker({ trustedAdultContact: 'private note' });
  await w.send({ type: 'GET_CONTENT_SETTINGS' }, content);
  w.changed[0]({ readAloudEnabled: { newValue: false } }, 'local');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(w.sent[0].id, 10);
  assert.equal(w.sent[0].message.type, 'CONTENT_SETTINGS_UPDATE');
  assert.equal(w.sent[0].message.settings.trustedAdultContact, undefined);
});

test('old and new settings history does not retain copies of the personal review note', async () => {
  const w = worker({ trustedAdultContact: 'old private note', familyProtectionSettingsHistory: [
    { key: 'trustedAdultContact', fromValue: 'earlier private note', toValue: 'old private note',
      trustedAdultContact: 'old private note' },
    { key: 'protectionLevel', trustedAdultContact: 'old private note' }
  ] });
  await w.send({ type: 'UPDATE_SETTING_GUARDED', key: 'trustedAdultContact', value: 'new private note' });
  assert.equal(w.values.trustedAdultContact, 'new private note');
  const history = JSON.stringify(w.values.familyProtectionSettingsHistory);
  assert.ok(!history.includes('private note'));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

// A deliberately tiny DOM: enough for the injector's slot bookkeeping.
class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    this.textContent = '';
    this.title = '';
    this.className = '';
  }
  get classList() {
    const owner = this;
    return { contains: (name) => owner.className.split(/\s+/).includes(name) };
  }
  get firstElementChild() { return this.children[0] || null; }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    return siblings[siblings.indexOf(this) + 1] || null;
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  insertAdjacentElement(position, element) {
    assert.equal(position, 'afterend');
    const siblings = this.parentElement.children;
    element.parentElement = this.parentElement;
    siblings.splice(siblings.indexOf(this) + 1, 0, element);
    return element;
  }
  replaceChildren(...nodes) {
    this.children = nodes;
    for (const node of nodes) node.parentElement = this;
  }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  closest(selector) {
    const className = selector.replace(/^\./, '');
    let node = this;
    while (node) {
      if (node.classList.contains(className)) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const className = selector.replace(/^\./, '');
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (child.classList.contains(className)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

function loadInjector() {
  const body = new FakeElement('body');
  const document = {
    body,
    createElement: (tagName) => new FakeElement(tagName),
    querySelectorAll: (selector) => body.querySelectorAll(selector)
  };
  const window = { aiGuardianEmailDeps: { isVisibleElement: () => true } };
  const context = vm.createContext({
    window, document, HTMLElement: FakeElement, crypto: require('node:crypto').webcrypto, console
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'email/emailUiInjector.js'), 'utf8'), context,
    { filename: 'email/emailUiInjector.js' });
  return { injector: window.AI_GUARDIAN_EMAIL.emailUiInjector, body, document };
}

function pageAuthoredSlot(document) {
  const fake = document.createElement('span');
  fake.className = 'ai-guardian-mail-cue-slot ai-guardian-mail-link-slot';
  fake.dataset.kind = 'link';
  fake.dataset.agwsEnhanced = 'true';
  fake.dataset.agwsFeature = 'email-preview';
  const cue = document.createElement('span');
  cue.className = 'ai-guardian-mail-cue';
  cue.textContent = 'Looks normal';
  fake.appendChild(cue);
  return fake;
}

test('a page-authored slot with the same class names is neither trusted nor removed', () => {
  const { injector, body, document } = loadInjector();
  const link = document.createElement('a');
  body.appendChild(link);
  const fake = pageAuthoredSlot(document);
  body.appendChild(fake);

  assert.equal(injector.isOwnSlot(fake), false);
  assert.equal(injector.isOwnSlot(fake.firstElementChild), false);

  // The scanner would skip links inside an owned slot only; this one stays visible to it.
  const innerLink = document.createElement('a');
  fake.appendChild(innerLink);
  assert.equal(injector.isOwnSlot(innerLink), false);

  // A forged slot is not reused: the injector makes its own next to the link.
  const ownSlot = injector.ensureLinkCueSlot(link);
  assert.notEqual(ownSlot, fake);
  assert.equal(injector.isOwnSlot(ownSlot), true);
  assert.equal(ownSlot.dataset.agwsToken, injector.getCueToken());

  injector.updateCue(fake, 'Spoofed', 'detail', 'safe');
  assert.equal(fake.firstElementChild.textContent, 'Looks normal', 'page content must not be rewritten');

  injector.pruneInactiveCueSlots(new Set());
  injector.clearPreviews();
  assert.ok(body.children.includes(fake), 'page content must not be deleted');
  assert.ok(!body.children.includes(ownSlot), 'own slots are cleaned up');
});

test('the cue token is random per injection and not guessable from markup alone', () => {
  const first = loadInjector().injector.getCueToken();
  const second = loadInjector().injector.getCueToken();
  assert.match(first, /^[0-9a-f]{24}$/);
  assert.notEqual(first, second);
});

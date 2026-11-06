const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// A deliberately small DOM: enough element, attribute, and selector behavior for
// the email injector, the message link scanner, and the content-script mutation
// filter to run unchanged. Anything beyond the supported selector syntax throws,
// so a test cannot pass by accident when a selector silently matches nothing.
function createDom() {
  class Node {
    static get ELEMENT_NODE() { return 1; }
    static get TEXT_NODE() { return 3; }
  }

  class Text extends Node {
    constructor(data, parentElement) {
      super();
      this.nodeType = 3;
      this.data = data;
      this.parentElement = parentElement;
    }
  }

  function parseCompound(selector) {
    const compound = selector.trim();
    if (!compound || /[\s>+~]/.test(compound)) {
      throw new Error(`unsupported selector in test DOM: ${selector}`);
    }
    const parts = { tag: null, id: null, classes: [], attrs: [], lastChild: false };
    let rest = compound;
    const tagMatch = rest.match(/^[a-zA-Z][\w-]*/);
    if (tagMatch) {
      parts.tag = tagMatch[0].toUpperCase();
      rest = rest.slice(tagMatch[0].length);
    }
    while (rest.length) {
      let match;
      if ((match = rest.match(/^#([\w-]+)/))) {
        parts.id = match[1];
      } else if ((match = rest.match(/^\.([\w-]+)/))) {
        parts.classes.push(match[1]);
      } else if ((match = rest.match(/^\[([\w-]+)(?:(\*?=)(?:'([^']*)'|"([^"]*)"))?\]/))) {
        parts.attrs.push({ name: match[1], op: match[2] || null, value: match[3] ?? match[4] ?? null });
      } else if ((match = rest.match(/^:last-child/))) {
        parts.lastChild = true;
      } else {
        throw new Error(`unsupported selector in test DOM: ${selector}`);
      }
      rest = rest.slice(match[0].length);
    }
    return parts;
  }

  function parseSelector(selector) {
    return String(selector).split(",").map(parseCompound);
  }

  class Element extends Node {
    constructor(tagName) {
      super();
      this.nodeType = 1;
      this.tagName = String(tagName).toUpperCase();
      this.attributes = new Map();
      this.children = [];
      this.parentElement = null;
      this.textContent = "";
      this.title = "";
      const element = this;
      this.classList = {
        contains(name) { return element.classNames().includes(name); }
      };
      this.dataset = new Proxy({}, {
        get(_target, key) {
          return typeof key === "string" ? element.getAttribute(toDataName(key)) ?? undefined : undefined;
        },
        set(_target, key, value) { element.setAttribute(toDataName(key), String(value)); return true; },
        has(_target, key) { return typeof key === "string" && element.hasAttribute(toDataName(key)); }
      });
    }
    get className() { return this.getAttribute("class") || ""; }
    set className(value) { this.setAttribute("class", value); }
    classNames() { return this.className.split(/\s+/).filter(Boolean); }
    get id() { return this.getAttribute("id") || ""; }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    get firstElementChild() { return this.children[0] || null; }
    get nextElementSibling() {
      if (!this.parentElement) return null;
      const siblings = this.parentElement.children;
      return siblings[siblings.indexOf(this) + 1] || null;
    }
    get isConnected() {
      let current = this;
      while (current.parentElement) current = current.parentElement;
      return current.isDocumentRoot === true;
    }
    appendChild(child) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
      return child;
    }
    insertAdjacentElement(position, element) {
      if (position !== "afterend" || !this.parentElement) {
        throw new Error(`unsupported insertAdjacentElement position: ${position}`);
      }
      element.remove();
      const siblings = this.parentElement.children;
      element.parentElement = this.parentElement;
      siblings.splice(siblings.indexOf(this) + 1, 0, element);
      return element;
    }
    replaceChildren(...nodes) {
      this.children.slice().forEach((child) => child.remove());
      nodes.forEach((node) => this.appendChild(node));
    }
    remove() {
      if (!this.parentElement) return;
      const siblings = this.parentElement.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentElement = null;
    }
    matchesCompound(parts) {
      if (parts.tag && parts.tag !== "*" && parts.tag !== this.tagName) return false;
      if (parts.id && parts.id !== this.id) return false;
      if (!parts.classes.every((name) => this.classList.contains(name))) return false;
      if (parts.lastChild && (!this.parentElement || this.parentElement.children.at(-1) !== this)) return false;
      return parts.attrs.every(({ name, op, value }) => {
        if (!this.hasAttribute(name)) return false;
        if (op === null) return true;
        const actual = this.getAttribute(name);
        return op === "=" ? actual === value : actual.includes(value);
      });
    }
    matches(selector) {
      return parseSelector(selector).some((parts) => this.matchesCompound(parts));
    }
    closest(selector) {
      let current = this;
      while (current instanceof Element) {
        if (current.matches(selector)) return current;
        current = current.parentElement;
      }
      return null;
    }
    descendants() {
      return this.children.flatMap((child) => [child, ...child.descendants()]);
    }
    querySelectorAll(selector) {
      return this.descendants().filter((element) => element.matches(selector));
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  }

  class HTMLElement extends Element {}
  class HTMLAnchorElement extends HTMLElement {
    get href() { return this.getAttribute("href") || ""; }
  }

  function toDataName(key) {
    return `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  }

  const documentElement = new HTMLElement("html");
  documentElement.isDocumentRoot = true;
  const body = documentElement.appendChild(new HTMLElement("body"));
  const document = {
    documentElement,
    body,
    baseURI: "https://mail.example.test/inbox",
    createElement(tagName) {
      return String(tagName).toLowerCase() === "a" ? new HTMLAnchorElement(tagName) : new HTMLElement(tagName);
    },
    createTextNode(data) { return new Text(data, null); },
    querySelectorAll(selector) { return documentElement.querySelectorAll(selector); },
    querySelector(selector) { return documentElement.querySelector(selector); }
  };

  function el(tagName, attributes = {}, children = []) {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    children.forEach((child) => element.appendChild(child));
    return element;
  }

  function text(element, data) {
    return new Text(data, element);
  }

  return { Node, Element, HTMLElement, HTMLAnchorElement, document, body, el, text };
}

function loadEmailModules(dom, files) {
  const context = vm.createContext({
    console,
    URL,
    crypto: globalThis.crypto,
    Node: dom.Node,
    Element: dom.Element,
    HTMLElement: dom.HTMLElement,
    HTMLAnchorElement: dom.HTMLAnchorElement,
    document: dom.document,
    location: new URL(dom.document.baseURI)
  });
  context.window = context;
  context.aiGuardianEmailDeps = {
    isVisibleElement: () => true
  };
  context.AI_GUARDIAN_EMAIL = {
    domUtils: { isElementNearViewport: () => true },
    providerDetection: {
      getOpenMessageSelectors(_environment, kind) {
        return kind === "messageBody" ? ["div.message-body"] : kind === "links" ? ["a[href]"] : [];
      },
      getGenericMessageSelectors() { return { messageBody: ["div.message-body"] }; }
    }
  };
  for (const filename of files) {
    const source = fs.readFileSync(path.join(__dirname, "..", "email", filename), "utf8");
    vm.runInContext(source, context, { filename });
  }
  return context;
}

const ENVIRONMENT = { id: "generic", supportTier: 3, maxLinks: 14 };

// Markup a page or HTML email could author: the same classes, kinds, and
// data-agws-* attributes the injector uses, wrapped around a reassuring cue.
function makeSpoofedSlot(dom, link) {
  const cue = dom.el("span", {
    class: "ai-guardian-mail-cue",
    "data-tone": "safe",
    "data-agws-enhanced": "true",
    "data-agws-feature": "email-preview",
    role: "note"
  });
  cue.textContent = "Looks normal";
  return dom.el("span", {
    class: "ai-guardian-mail-cue-slot ai-guardian-mail-link-slot",
    "data-kind": "link",
    "data-agws-enhanced": "true",
    "data-agws-feature": "email-preview"
  }, [cue, ...(link ? [link] : [])]);
}

function setup() {
  const dom = createDom();
  const context = loadEmailModules(dom, ["messageLinkScanner.js", "emailUiInjector.js"]);
  const injector = context.AI_GUARDIAN_EMAIL.emailUiInjector;
  const scanner = context.AI_GUARDIAN_EMAIL.messageLinkScanner;
  const messageBody = dom.el("div", { class: "message-body" });
  dom.body.appendChild(messageBody);
  return { dom, context, injector, scanner, messageBody };
}

test("slots created by the injector are owned and carry the per-load token", () => {
  const { dom, injector, messageBody } = setup();
  const link = dom.el("a", { href: "https://news.example.test/story" });
  messageBody.appendChild(link);

  const slot = injector.ensureLinkCueSlot(link);
  const token = injector.getOwnershipToken();

  assert.match(token, /^[0-9a-f]{32}$/);
  assert.equal(slot.getAttribute("data-agws-token"), token);
  assert.equal(injector.isOwnSlot(slot), true);
  assert.equal(injector.ensureLinkCueSlot(link), slot, "an owned slot is reused");
  assert.equal(injector.isInsideOwnSlot(slot.firstElementChild || slot), true);

  injector.updateCue(slot, "Check first", "Example detail", "caution");
  assert.equal(slot.firstElementChild.textContent, "Check first");
  assert.equal(injector.isInsideOwnSlot(slot.firstElementChild), true);
});

test("a page-authored slot with the same class names is not owned, not skipped by the scanner, and not removed", () => {
  const { dom, injector, scanner, messageBody } = setup();
  const hiddenLink = dom.el("a", { href: "https://login.example-verify.test/reset" });
  const spoofedSlot = makeSpoofedSlot(dom, hiddenLink);
  const ordinaryLink = dom.el("a", { href: "https://news.example.test/story" });
  messageBody.appendChild(ordinaryLink);
  messageBody.appendChild(spoofedSlot);

  assert.equal(injector.isOwnSlot(spoofedSlot), false);
  assert.equal(injector.isInsideOwnSlot(hiddenLink), false);

  const scanned = scanner.getVisibleMessageLinks(ENVIRONMENT);
  assert.deepEqual(Array.from(scanned, (element) => element.href), [ordinaryLink.href, hiddenLink.href]);
  assert.ok(scanned.includes(hiddenLink), "the link inside the fake slot is still scanned");

  // Links inside a slot the injector really created stay hidden from scanning.
  const ownedSlot = injector.ensureLinkCueSlot(ordinaryLink);
  const decoyLink = dom.el("a", { href: "https://decoy.example.test/" });
  ownedSlot.appendChild(decoyLink);
  assert.equal(scanner.getVisibleMessageLinks(ENVIRONMENT).includes(decoyLink), false);

  // The page-authored slot survives every removal path; only owned slots go.
  injector.pruneInactiveCueSlots(new Set());
  assert.equal(ownedSlot.parentElement, null, "an inactive owned slot is pruned");
  assert.equal(spoofedSlot.parentElement, messageBody, "the page-authored slot is left alone");

  const secondOwnedSlot = injector.ensureLinkCueSlot(ordinaryLink);
  injector.clearPreviews();
  assert.equal(secondOwnedSlot.parentElement, null);
  assert.equal(spoofedSlot.parentElement, messageBody);
  assert.equal(spoofedSlot.firstElementChild.textContent, "Looks normal");
});

test("the injector never adopts or edits page-authored slots", () => {
  const { dom, injector, messageBody } = setup();
  const link = dom.el("a", { href: "https://news.example.test/story" });
  const spoofedLinkSlot = makeSpoofedSlot(dom, null);
  messageBody.appendChild(link);
  messageBody.appendChild(spoofedLinkSlot);

  const linkSlot = injector.ensureLinkCueSlot(link);
  assert.notEqual(linkSlot, spoofedLinkSlot);
  assert.equal(injector.isOwnSlot(linkSlot), true);
  assert.equal(link.nextElementSibling, linkSlot);

  injector.updateCue(spoofedLinkSlot, "Check first", "Example detail", "risk");
  assert.equal(spoofedLinkSlot.firstElementChild.textContent, "Looks normal");
  assert.equal(spoofedLinkSlot.firstElementChild.getAttribute("data-tone"), "safe");

  const spoofedRowSlot = dom.el("span", {
    class: "ai-guardian-mail-cue-slot ai-guardian-mail-row-slot",
    "data-kind": "row",
    "data-agws-enhanced": "true",
    "data-agws-feature": "email-preview"
  });
  const cell = dom.el("td", {}, [spoofedRowSlot]);
  const row = dom.el("tr", {}, [dom.el("td"), cell]);
  dom.body.appendChild(row);

  const rowSlot = injector.ensureRowCueSlot(row, ENVIRONMENT);
  assert.notEqual(rowSlot, spoofedRowSlot);
  assert.equal(injector.isOwnSlot(rowSlot), true);
  assert.equal(rowSlot.parentElement, cell);
  assert.equal(injector.ensureRowCueSlot(row, ENVIRONMENT), rowSlot);
});

test("copying the token onto a page-authored slot does not make it trusted", () => {
  const { dom, injector, scanner, messageBody } = setup();
  const hiddenLink = dom.el("a", { href: "https://login.example-verify.test/reset" });
  const spoofedSlot = makeSpoofedSlot(dom, hiddenLink);
  spoofedSlot.setAttribute("data-agws-token", injector.getOwnershipToken());
  messageBody.appendChild(spoofedSlot);

  assert.equal(injector.isOwnSlot(spoofedSlot), false);
  const scanned = scanner.getVisibleMessageLinks(ENVIRONMENT);
  assert.equal(scanned.length, 1);
  assert.equal(scanned[0], hiddenLink);
  injector.clearPreviews();
  assert.equal(spoofedSlot.parentElement, messageBody);
});

test("each injection gets its own random token and only trusts its own slots", () => {
  const first = setup();
  const second = setup();
  assert.notEqual(first.injector.getOwnershipToken(), second.injector.getOwnershipToken());

  const link = first.dom.el("a", { href: "https://news.example.test/story" });
  first.messageBody.appendChild(link);
  const slot = first.injector.ensureLinkCueSlot(link);
  assert.equal(second.injector.isOwnSlot(slot), false);
});

test("re-injecting the module retires the previous instance's slots", () => {
  const { dom, context, injector, messageBody } = setup();
  const link = dom.el("a", { href: "https://news.example.test/story" });
  messageBody.appendChild(link);
  const staleSlot = injector.ensureLinkCueSlot(link);
  const spoofedSlot = makeSpoofedSlot(dom, null);
  messageBody.appendChild(spoofedSlot);

  const source = fs.readFileSync(path.join(__dirname, "..", "email", "emailUiInjector.js"), "utf8");
  vm.runInContext(source, context, { filename: "emailUiInjector.js" });
  const reloaded = context.AI_GUARDIAN_EMAIL.emailUiInjector;

  assert.notEqual(reloaded, injector);
  assert.equal(staleSlot.parentElement, null, "slots from the previous load are cleared");
  assert.equal(spoofedSlot.parentElement, messageBody, "page-authored markup is still untouched");
  assert.notEqual(reloaded.getOwnershipToken(), injector.getOwnershipToken());
});

// The content script's mutation filter runs before the email modules load and
// must look ownership up at mutation time. Execute the real functions.
function loadMutationFilter(context) {
  const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
  const start = source.indexOf("  function isAssistantMutation(mutation) {");
  const end = source.indexOf("\n  function patchHistoryForSpaNavigation()", start);
  assert.ok(start >= 0 && end > start, "actual content-script mutation filter is available");
  vm.runInContext(source.slice(start, end), context);
  return (mutation) => context.isAssistantMutation({ addedNodes: [], removedNodes: [], ...mutation });
}

test("content script only treats mutations inside injector-owned slots as assistant output", () => {
  const { dom, context, injector, messageBody } = setup();
  const isAssistantMutation = loadMutationFilter(context);
  const link = dom.el("a", { href: "https://news.example.test/story" });
  messageBody.appendChild(link);
  const ownedSlot = injector.ensureLinkCueSlot(link);
  injector.updateCue(ownedSlot, "Check first", "Example detail", "caution");
  const ownedCue = ownedSlot.firstElementChild;

  assert.equal(isAssistantMutation({ target: ownedSlot, addedNodes: [ownedCue] }), true);
  assert.equal(isAssistantMutation({ target: ownedCue, addedNodes: [dom.text(ownedCue, "Check first")] }), true);

  const spoofedSlot = makeSpoofedSlot(dom, null);
  messageBody.appendChild(spoofedSlot);
  assert.equal(isAssistantMutation({ target: messageBody, addedNodes: [spoofedSlot] }), false);
  assert.equal(isAssistantMutation({ target: spoofedSlot, addedNodes: [spoofedSlot.firstElementChild] }), false);
  assert.equal(
    isAssistantMutation({ target: spoofedSlot.firstElementChild, addedNodes: [dom.text(spoofedSlot.firstElementChild, "Looks normal")] }),
    false
  );

  // The static attributes on their own are not enough either.
  const enhancedLookalike = dom.el("div", { "data-agws-enhanced": "true", "data-agws-feature": "email-preview" });
  messageBody.appendChild(enhancedLookalike);
  assert.equal(isAssistantMutation({ target: enhancedLookalike, addedNodes: [dom.el("a", { href: "https://x.test/" })] }), false);

  // A copied token without real ownership, or a stripped token, is a page change.
  spoofedSlot.setAttribute("data-agws-token", injector.getOwnershipToken());
  assert.equal(isAssistantMutation({ target: spoofedSlot }), false);
  ownedSlot.removeAttribute("data-agws-token");
  assert.equal(isAssistantMutation({ target: ownedSlot, addedNodes: [ownedCue] }), false);
});

test("content script treats cue markup as a page change when the injector is not loaded", () => {
  const dom = createDom();
  const context = loadEmailModules(dom, []);
  const isAssistantMutation = loadMutationFilter(context);
  const spoofedSlot = makeSpoofedSlot(dom, null);
  dom.body.appendChild(spoofedSlot);

  assert.equal(isAssistantMutation({ target: dom.body, addedNodes: [spoofedSlot] }), false);
  assert.equal(isAssistantMutation({ target: spoofedSlot, addedNodes: [spoofedSlot.firstElementChild] }), false);

  const assistantRoot = dom.el("div", { id: "ai-guardian-root" });
  dom.body.appendChild(assistantRoot);
  const assistantChild = assistantRoot.appendChild(dom.el("div"));
  assert.equal(isAssistantMutation({ target: assistantRoot, addedNodes: [assistantChild] }), true);
});

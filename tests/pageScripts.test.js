const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const pageScripts = require(path.join(root, 'shared', 'pageScripts.js'));

test('every injected page script exists on disk', () => {
  for (const file of pageScripts) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);
  }
});

test('behavior modules load before content.js, email controller last', () => {
  const at = (file) => pageScripts.indexOf(file);
  assert.ok(at('shared/behaviorCorrelation.js') < at('shared/behaviorMonitor.js'));
  assert.ok(at('shared/behaviorMonitor.js') < at('content.js'));
  assert.equal(pageScripts.at(-1), 'email/emailSafetyController.js');
});

test('popup and side panel share the injection list and load it first', () => {
  for (const [page, controller] of [['popup.html', 'glance.js'], ['sidepanel.html', 'popup.js']]) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const listIndex = html.indexOf('<script src="shared/pageScripts.js"></script>');
    const controllerIndex = html.indexOf(`<script src="${controller}"></script>`);
    assert.ok(listIndex > -1, `${page} does not load shared/pageScripts.js`);
    assert.ok(listIndex < controllerIndex, `${page} loads ${controller} before the list`);
    const source = fs.readFileSync(path.join(root, controller), 'utf8');
    assert.match(source, /PAGE_SCRIPT_FILES = globalThis\.AI_GUARDIAN_PAGE_SCRIPT_FILES/);
  }
});

test('content.js refuses to mark itself loaded without the behavior modules', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  const window = { addEventListener() {} };
  const context = vm.createContext({ window, globalThis: undefined, console: { warn() {} } });
  context.globalThis = context;
  vm.runInContext(source, context, { filename: 'content.js' });
  assert.equal(window.aiGuardianWebShieldLoaded, undefined, 'a partial injection must stay retryable');
});

function loadRouteHook() {
  const source = fs.readFileSync(path.join(root, 'shared', 'pageScripts.js'), 'utf8');
  const context = vm.createContext({});
  context.globalThis = context;
  vm.runInContext(source, context, { filename: 'pageScripts.js' });
  return context.AI_GUARDIAN_MAIN_WORLD_ROUTE_HOOK;
}

// Models what chrome.scripting.executeScript({ world: "MAIN", func }) does:
// the function is serialized and run in the page's own realm, which has no
// extension APIs and no access to the content script's closures.
function mainWorld() {
  const calls = [];
  const dispatched = [];
  class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail ?? null; }
  }
  const history = {
    pushState(...args) { calls.push(['pushState', this, args]); return 'push'; },
    replaceState(...args) { calls.push(['replaceState', this, args]); return 'replace'; }
  };
  const document = { dispatchEvent(event) { dispatched.push(event); return true; } };
  const context = vm.createContext({ history, document, CustomEvent });
  const run = (hook) => vm.runInContext(`(${hook.toString()})()`, context);
  return { history, calls, dispatched, run };
}

test('the main-world route hook is self-contained and carries no extension data', () => {
  const hook = loadRouteHook();
  assert.equal(typeof hook, 'function');
  const source = hook.toString();
  assert.doesNotMatch(source, /chrome|browser\.|AI_GUARDIAN|runtime|tabId/);
  assert.match(source, /new CustomEvent\("agws:route-change"\)/);
});

test('the route hook wraps pushState and replaceState and announces each call', () => {
  const hook = loadRouteHook();
  const page = mainWorld();
  page.run(hook);
  assert.equal(page.history.pushState({ a: 1 }, '', '/next'), 'push');
  assert.equal(page.history.replaceState(null, '', '#panel'), 'replace');
  assert.deepEqual(page.calls.map(([name, self, args]) => [name, self === page.history, args]), [
    ['pushState', true, [{ a: 1 }, '', '/next']],
    ['replaceState', true, [null, '', '#panel']]
  ]);
  assert.deepEqual(page.dispatched.map(event => [event.type, event.detail]), [
    ['agws:route-change', null],
    ['agws:route-change', null]
  ]);
});

test('the route hook installs once even when injected repeatedly', () => {
  const hook = loadRouteHook();
  const page = mainWorld();
  page.run(hook);
  const wrappedPush = page.history.pushState;
  page.run(hook);
  page.run(hook);
  assert.equal(page.history.pushState, wrappedPush);
  assert.equal(page.history.__agwsRouteChangeHooked, true);
  page.history.pushState(null, '', '/once');
  assert.equal(page.dispatched.length, 1);
  assert.equal(page.calls.length, 1);
});

test('the route hook leaves a history object without the methods alone', () => {
  const hook = loadRouteHook();
  const page = mainWorld();
  delete page.history.replaceState;
  page.run(hook);
  assert.equal(page.history.replaceState, undefined);
  page.history.pushState(null, '', '/x');
  assert.equal(page.dispatched.length, 1);
});

test('popup and side panel inject the route hook into the main world as a function, not a file', () => {
  for (const controller of ['glance.js', 'popup.js']) {
    const source = fs.readFileSync(path.join(root, controller), 'utf8');
    assert.match(source, /MAIN_WORLD_ROUTE_HOOK = globalThis\.AI_GUARDIAN_MAIN_WORLD_ROUTE_HOOK/);
    const mainWorldCall = source.match(/world: "MAIN",\s*func: MAIN_WORLD_ROUTE_HOOK/);
    assert.ok(mainWorldCall, `${controller} must inject the hook with world: "MAIN" and func`);
    assert.doesNotMatch(source, /world: "MAIN",\s*files/);
  }
});

test('no extension script wraps history itself; content and email code listen for the event', () => {
  for (const file of ['content.js', 'email/emailSafetyController.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /history\.(pushState|replaceState)\s*=/, `${file} wraps history in the isolated world`);
    assert.match(source, /addEventListener\("agws:route-change"/, `${file} does not listen for route changes`);
  }
  const content = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.doesNotMatch(content, /patchHistoryForSpaNavigation/);
});

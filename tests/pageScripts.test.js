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

test('main-world route hook announces pushState and replaceState once', () => {
  const { installRouteChangeHook } = pageScripts;
  assert.equal(typeof installRouteChangeHook, 'function');
  // The function is serialized into the page, so it must not close over module scope.
  assert.doesNotMatch(installRouteChangeHook.toString(), /files|globalThis|chrome\./);

  const events = [];
  const history = {
    calls: [],
    pushState(...args) { this.calls.push(['push', ...args]); return 'pushed'; },
    replaceState(...args) { this.calls.push(['replace', ...args]); }
  };
  const context = vm.createContext({
    history,
    document: { dispatchEvent: (event) => events.push(event.type) },
    Event: class { constructor(type) { this.type = type; } },
    Object
  });
  const run = () => vm.runInContext(`(${installRouteChangeHook.toString()})()`, context);

  assert.equal(run(), true);
  assert.equal(history.pushState({}, '', '/a'), 'pushed', 'the original return value is preserved');
  history.replaceState({}, '', '/b');
  assert.deepEqual(events, ['agws:route-change', 'agws:route-change']);
  assert.equal(history.calls.length, 2);

  assert.equal(run(), true, 'a second install is a no-op');
  history.pushState({}, '', '/c');
  assert.equal(events.length, 3, 'no double wrapping');
  assert.equal(Object.keys(history).includes('__agwsRouteHookInstalled'), false, 'marker is not enumerable');
});

test('popup and side panel install the main-world hook after injecting page scripts', () => {
  for (const file of ['glance.js', 'popup.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /world: "MAIN"/, `${file} must inject the route hook into the main world`);
    assert.match(source, /func: hook/, `${file} must pass the shared hook function`);
  }
  const content = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(content, /addEventListener\("agws:route-change"/);
  assert.doesNotMatch(content, /patchHistoryForSpaNavigation/);
});

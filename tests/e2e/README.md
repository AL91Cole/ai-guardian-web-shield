# Browser smoke test

Runs the real extension in Chromium through Playwright and checks the page
badge, warning dialogs, search of risky links, webmail cues, single-page-app
navigation, the toolbar popup and the side panel against local fixture pages.

It does not replace loading the unpacked extension in your own Chrome, but it
catches regressions that the Node unit tests cannot see.

## Requirements

- Node.js 22 or newer
- Playwright with its Chromium build: `npx playwright install chromium`
  (Playwright is not a dependency of the extension; install it globally or in
  a scratch folder and point `PLAYWRIGHT_PATH` at it if it is not resolvable.)
- `openssl` on the PATH, used once to create a throwaway self-signed certificate

## Run

```bash
npm run e2e
```

What it does:

1. Copies the extension into a temporary folder and adds `host_permissions`
   for the fixture hosts only, so the service worker can inject the page
   scripts without a toolbar click. The packaged extension is not changed.
2. Serves `tests/e2e/fixtures/` over HTTPS on port 8443 with a self-signed
   certificate, and maps fake hostnames such as `paypa1-secure-login.test`,
   `google.de` and `mail.yahoo.com` to it with Chromium's host resolver rules.
3. Drives the extension through its own service worker and prints one line per
   check. Screenshots land in `tests/e2e/output/`.

Fixture hostnames never leave the machine. The port shows up as an "unusual
web door number" note on safe pages, which the checks allow for.

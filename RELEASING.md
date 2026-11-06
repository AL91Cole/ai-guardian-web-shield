# Releasing a new version

Requirements: Node.js 22 or newer and a current Chrome.

1. Update the version in `manifest.json` and `package.json`, and add a matching
   `## x.y.z` entry at the top of `CHANGELOG.md`.
2. Run the release checks. They run the unit tests, validate the manifest, the
   on-demand injection list and every packaged script, then build the zip:

   ```bash
   npm run release
   ```

   The package lands in `dist/ai-guardian-web-shield-<version>.zip`.
3. If Playwright is installed, run the browser smoke test and glance at the
   screenshots it writes to `tests/e2e/output/`:

   ```bash
   npm run e2e
   ```

4. Load the unpacked folder in `chrome://extensions` with Developer Mode on and
   walk through the browser smoke test in `SECURITY.md` (popup, side panel,
   "Scan Again" on a fresh tab, settings updates on an already scanned tab,
   passcode setup and unlock, navigation resets).
5. Upload the zip in the Chrome Web Store Developer Dashboard, paste the release
   notes from `CHANGELOG.md`, and confirm the listing fields in
   `store/LISTING.md` still match.
6. Tag the release in git:

   ```bash
   git tag v<version>
   ```

   ```bash
   git push origin v<version>
   ```

Every push also runs the same checks in GitHub Actions and attaches the zip as a
workflow artifact, so a reviewer can download the exact package that CI built.

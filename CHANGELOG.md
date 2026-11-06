# Changelog

All notable changes to AI Guardian Web Shield. Versions match `manifest.json`.

## 1.2.0 - 2026-11-06

### Fixed

- The toolbar popup injected the page scripts without
  `shared/behaviorCorrelation.js` and `shared/behaviorMonitor.js`, so the first
  scan or "Scan Again" on a tab that had not been scanned from the side panel
  crashed `content.js` during setup and left the tab unable to scan until
  reload. Both views now use the single list in `shared/pageScripts.js`, and
  `content.js` no longer marks itself loaded when a required module is absent.

### Added

- `package.json` with `npm test`, `npm run check`, `npm run package` and
  `npm run release`.
- `scripts/check-extension.mjs`: validates the manifest, Web Store limits,
  referenced files, injection order, script syntax, the no-network rule and
  version consistency.
- `scripts/package.mjs`: dependency-free, reproducible Chrome Web Store zip
  builder that ships only runtime files.
- `tests/pageScripts.test.js` covering the injection list and the retry guard.
- `store/LISTING.md` with listing copy, permission justifications and privacy
  disclosures, and `RELEASING.md` with the publishing checklist.
- CI now runs the validator and packaging step and uploads the zip artifact.

## 1.1.0

- Connected form actions: correlates sign-in field metadata, form interaction,
  effective destination and submission method before warning.
- Restricted extension storage to trusted contexts and minimized local privacy
  data.

## 1.0.0

- Initial Chrome Web Store release: local risk scoring, floating badge, search
  result badges, Site Identity Check, email safety previews, Labyrinth Guardian,
  Family Protection and accessibility profiles.

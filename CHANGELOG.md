# Changelog

All notable changes to AI Guardian Web Shield. Versions match `manifest.json`.

## 1.2.0 - 2026-11-06

### Fixed

- A fragment-only URL change (`#panel` routing on the same page) no longer
  resets the Connected Form Actions evidence chain, page approvals or shown
  warnings. A fragment change is not a navigation to a new document, and
  resetting on it let a page discard the credential interaction before a
  changed-destination submission. Navigation to a new path or query still
  resets everything, and the chain still records origins only.
- The toolbar popup injected the page scripts without
  `shared/behaviorCorrelation.js` and `shared/behaviorMonitor.js`, so the first
  scan or "Scan Again" on a tab that had not been scanned from the side panel
  crashed `content.js` during setup and left the tab unable to scan until
  reload. Both views now use the single list in `shared/pageScripts.js`, and
  `content.js` no longer marks itself loaded when a required module is absent.

- Side panel passcode panels could never collapse: `.family-passcode-panel`
  and `.family-field` set `display: grid`, which overrides the `hidden`
  attribute. Both stylesheets now keep `[hidden]` authoritative.
- Labyrinth Guardian "many page changes" prompts were unreachable because the
  per-tab activity window was wiped on every navigation. It now survives
  navigation and is dropped only when the tab closes.
- `chrome.sidePanel.open()` needs Chrome 116, so `minimum_chrome_version` is
  now 116 instead of 114; on older builds "Open Side Panel" silently did nothing.
- The side panel showed "cannot be scanned" for ordinary sites in tabs the user
  had not activated. It now explains that the toolbar icon must be clicked on
  that tab, and background-tab loads no longer reset the active tab's panel.
- Re-running the onboarding guide could silently drop a locked protection
  choice; the guide now stays open and shows why.
- Email: every inbox row was flagged as crypto or phishing risk because
  non-Latin phrase entries normalized to an empty string that matched any text.
  Phrase matching is now Unicode-aware and skips empty phrases.
- Email: Yahoo Mail was always detected as an account chooser (a `body`
  selector), which hid all cues and widened the sign-in warning bypass; an
  Outlook `.table` chooser selector had the same shape. Both removed.
- Email: the "trusted sign-in flow" bypass applied on every non-mail page and
  ignored misleading link text. It now requires a webmail context and honest
  link text.
- Email: iCloud never matched by host, and its `/mail` path hint hijacked other
  sites; named providers now match by host only.
- Email: sender domain extraction kept a trailing `>`, breaking the brand
  versus sender check. The visible address is now parsed with a pattern.
- Email: the document-wide mutation observer no longer runs on non-mail pages,
  provider selectors are cached per route, and a second injection no longer
  creates a duplicate controller.
- Page scoring: Google redirect unwrapping only applies to the real `/url`
  endpoint on an official Google host, so lookalike hosts cannot launder a score.
- Page scoring: brand mentions are whole-word matches ("purchase" is not
  "chase"); the brand's own regional domains such as google.de or amazon.fr are
  not lookalikes; short brands no longer trigger single-edit lookalike matches.
- Page warnings: "Go Back" on a link warning no longer approves the next click
  on the same link.
- Page analysis has a six second maximum wait so pages that mutate every
  second (countdowns, feeds) still get re-scored; a single generic urgency word
  next to a password box no longer counts as a strong signal.
- Re-injection after an extension update replaces stale badge and dialog roots
  instead of duplicating them; synthetic clicks without an element target no
  longer throw; link labels like "Vue.js" are not treated as addresses.
- Popup read-aloud button now switches to "Stop Reading" when speech starts.
- Email cue markup can no longer be spoofed or used to hide links: the
  injector only trusts slots it created (tracked in a WeakSet and tagged with
  a per-injection random token). Page-authored elements that copy the class
  names are never skipped by the link scanner, rewritten, or removed.
- Single-page-app navigation is now detected. The old history patch ran in
  the isolated world, which page scripts never call, so it was dead code. A
  small main-world hook installed at injection time announces pushState and
  replaceState through a payload-free event, and the page and email scanners
  re-read the address on it.

### Added

- `package.json` with `npm test`, `npm run check`, `npm run package` and
  `npm run release`.
- `scripts/check-extension.mjs`: validates the manifest, Web Store limits,
  referenced files, injection order, script syntax, the no-network rule and
  version consistency.
- `scripts/package.mjs`: dependency-free, reproducible Chrome Web Store zip
  builder that ships only runtime files.
- `tests/pageScripts.test.js` covering the injection list, the retry guard and
  the main-world route hook; `tests/emailHeuristics.test.js` covering phrase
  matching, sender parsing and the sign-in bypass rules; and
  `tests/emailCueOwnership.test.js` covering cue slot ownership.
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

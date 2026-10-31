# Security and privacy

Web Shield uses local heuristics and can miss threats or flag harmless pages. A low score is not a safety guarantee. The current source has no telemetry or remote rule synchronization. Browser extension pages prohibit network connections through their content security policy.

## Trust boundaries

- Page content and content scripts are untrusted inputs to the service worker.
- Only the packaged popup and side panel may read cross-tab reports, change preferences, or use Family Protection commands.
- Persistent extension storage is restricted to trusted extension contexts. Content scripts receive a read-only set of analysis preferences through messages; they do not receive passcode records, unlock deadlines, review notes, or settings history.
- Passcode attempts and setting mutations run in sequence, and setting values must match supported types and bounds.
- Settings updates reach only tabs where the extension already has permission. The extension uses `activeTab` and does not request access to all sites.

Family Protection is a local convenience lock. Someone who controls the browser profile, can edit extension files, or can remove the extension can bypass it. Short numeric passcodes and browser storage do not provide encryption at rest. Use device management and operating-system controls for enforced child or school policies.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature if enabled for this repository. If it is unavailable, open an issue asking for a private reporting channel without including the vulnerability details, personal data, passcodes, browsing history, or working exploit. Never attach real student or user data to a public issue.

## Release checks

Run `node --test tests/*.test.js`, check every packaged JavaScript file with `node --check`, and load the unpacked extension in a current Chrome profile. Verify the popup and side panel, on-demand scanning, preference updates on an already scanned tab, passcode setup/unlock/cooldown, and navigation resets before publishing a browser-store release. Automated tests emulate Chrome APIs and do not replace that browser check.

Repository administrators should enable private vulnerability reporting, secret scanning and push protection where available, and protect `main` with review and required checks. These are account settings, not controls that this source change can enable.

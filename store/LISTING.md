# Chrome Web Store listing copy

Paste these fields into the Developer Dashboard when publishing a new version.
Keep this file in sync with `manifest.json` and `CHANGELOG.md`.

Store page: https://chromewebstore.google.com/detail/ipledehmklfhhdpobeogfdhmhdhmnden

## Name

AI Guardian Web Shield

## Short description (132 characters max)

A privacy-first helper that checks links and pages on your device using calm, plain-language guidance.

## Category

Privacy & Security

## Detailed description

AI Guardian Web Shield is a calm, privacy-first safety assistant for everyday browsing. It looks at the page you are on, the links around you, and the forms you are about to send, then explains what it sees in plain language instead of technical alerts.

Everything runs on your device. The extension has no servers, no accounts, no telemetry and no remote rules. It never uploads your browsing history, page content or form values.

What it helps with

- Page risk score from 0 to 100 with a short reason list.
- Floating badge that keeps the score visible while you browse.
- Google search result badges so you can judge a link before you click.
- Site Identity Check that explains HTTPS, lookalike domains and sign-in prompts.
- Connected form checks that pause when a password could travel over HTTP, in a URL, or to a destination that changed.
- Email previews in supported webmail that flag suspicious senders, links and urgency language.
- Labyrinth Guardian mode that adds gentle friction when browsing patterns look risky.
- Family Protection with passcode-locked settings, adult-site blocking and a trusted-adult review log.
- Accessibility profiles: reading support, low vision, calm, focus, older adult, large text, high contrast, reduced motion and read-aloud.

How it works

Activate the extension on a tab by opening the popup or side panel. It only reads pages where you have activated it, using Chrome's activeTab permission. Scores are guidance, not proof. A low score does not guarantee a page is safe, and the extension does not replace antivirus, a VPN or operating-system parental controls.

Open source under the MIT license: https://github.com/AL91Cole/ai-guardian-web-shield

## Single purpose

Analyze the current page, its links and its forms locally and show plain-language safety guidance.

## Permission justifications

| Permission | Why it is needed |
| --- | --- |
| activeTab | Read and annotate only the tab where the user opened the popup or side panel. No host permissions are requested. |
| scripting | Inject the local analysis scripts into that tab on demand. |
| sidePanel | Show the detailed guidance, settings and Family Protection controls in the side panel. |
| storage | Keep settings, accessibility preferences and the local Family Protection passcode hash on the device. |

Remote code: none. All scripts are packaged in the extension.

## Privacy practices (Developer Dashboard)

- Does not collect or transmit user data.
- Does not sell data to third parties.
- Does not use data for purposes unrelated to the single purpose.
- Does not use data to determine creditworthiness or for lending.
- Privacy policy URL: https://github.com/AL91Cole/ai-guardian-web-shield/blob/main/Privacy%20Policy

## Screenshots (1280x800 or 640x400)

Export fresh captures from `images/` after each UI change, in this order:

1. `risk-score-safe.png` - popup score on a safe page
2. `search-results-risk-badges.png` - Google result badges
3. `site-identity-check.png` - Site Identity Check panel
4. `email-risk-inbox-warning.png` - webmail warning
5. `family-protection-controls.png` - Family Protection
6. `accessibility-reading-profiles.png` - accessibility profiles

## Release notes for this version

See the top entry in `CHANGELOG.md`.

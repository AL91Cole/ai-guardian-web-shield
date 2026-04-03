# AI Guardian Web Shield

AI Guardian Web Shield is a privacy-first Chrome extension that watches pages and links in the browser and gives calm, simple safety guidance.

Scores are guidance to help people decide what to do next. They are not proof that a page is safe or unsafe.

## What changed

- Every supported page now gets a live risk score from `0` to `100`
- Google search results now show score badges next to each result
- Pages now show a small floating score badge without opening the popup
- The floating badge can be hidden when you want less clutter and opens the details view when clicked
- Risky links, risky downloads, and risky forms can show a warning before you continue
- Warning cards now include a simple `Learn Why` path to the full explanation
- The popup now includes `Site Identity Check` with simple notes about the connection, address, and sign-in trust
- The popup is now the detail view for the full score, top reasons, next steps, flagged links, settings, read-aloud help, and clean URL tools
- The popup now includes an `AI Guardian Privacy Shield` concept card for tracking-awareness and cleaner-link help inside the browser
- The popup now includes `Guardian Family Protection` with adult site blocking, safety levels, site exceptions, change history, and a passcode for important safety settings
- The popup now includes a `Quick Terms Summary` for signup, login, and account pages when simple terms clues are found
- Labyrinth Guardian can now slow things down when risky browsing patterns happen quickly

## Score labels

- `0-19` `Looks safe`
- `20-39` `Low caution`
- `40-59` `Be careful`
- `60-79` `High caution`
- `80-100` `High risk`

## Local-first scoring

The extension uses local-only checks such as:

- Less familiar domain endings
- Very long links
- Tracking parts in a link
- Shortened links
- Lookalike site names
- Basic browser-visible secure connection signs like HTTPS
- Pushy page language
- Password fields and personal-detail forms
- Risky downloads and risky form destinations
- Optional Family Protection can block explicit adult websites with a calm block page using local multi-signal checks
- Family Protection tries not to block health education, LGBTQ+ support, medical, legal, academic, or news pages unless stronger adult-content signals appear together

## Files

- `manifest.json` - Chrome extension setup
- `BRANDING.md` - Icon directions and visual identity guidance
- `background.js` - Stores the latest tab report, updates the toolbar badge, protects Family Protection changes, and tracks rapid risky browsing patterns
- `content.js` - Live scoring, floating indicator, Google badges, smarter link checks, proactive warnings, Family Protection block pages, slowdown prompts, and quick terms summaries
- `icons/` - The live Shield + AI Pulse icon set for Chrome
- `popup.html` - Detail popup layout
- `popup.css` - Popup styling
- `popup.js` - Popup detail rendering, settings, and read-aloud actions
- `scripts/generate-icons.ps1` - Rebuilds the PNG extension icons from the chosen brand direction

## Load it into Chrome

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Choose `C:\Projects\ai-guardian-web-shield`.
6. Open a site or a Google search page.
7. The page should show a floating score badge, and the popup will show full details.

## Privacy note

- Your scan happens on your device.
- No page content is sent to outside servers.
- This is a calm helper, not a promise that a page is safe.
- Privacy Shield does not replace a VPN, but can help reduce tracking signals inside the browser.
- Site Identity Check uses browser-visible signs like HTTPS and the site name, but it cannot confirm every certificate detail from inside the page.
- Guardian Family Protection can block explicit adult websites, lock important safety settings with a passcode, and keep a local change history, but it does not monitor private messages or personal content.
- Trusted adult review reminders are local-only in this version. They do not send outside alerts yet.
- Browser extensions can help, but they are not fully tamper-proof if someone else controls the device.
- The extension uses light permissions and now runs only on normal `http` and `https` pages.

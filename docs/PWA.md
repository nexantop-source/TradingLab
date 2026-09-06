# TradingLab mobile app

## Design decision

The reviewed reference is [Appllama/liquid-glass-screens](https://github.com/Appllama/liquid-glass-screens), an Expo / React Native demonstration, not a Next.js PWA or an authentication backend. Its original code uses GPL-3.0 and its NOTICE requires replacing its identity and making the experience meaningfully distinct before commercial publication.

This implementation does **not** copy its source, stickers, screens or animation sequence. TradingLab retains its own 13A mark and uses independently authored SVG artwork, CSS optical depth and Framer Motion already installed in the project. This is a web glass treatment, not Apple's native Liquid Glass renderer.

## Implemented

- `/app`: session-aware entry. Guests see a three-scene introduction; existing users continue to onboarding or their dashboard.
- Horizontal drag with bounded scenes, equivalent visible navigation buttons, no automatic carousel or mandatory sequence before registration.
- Original market-themed illustration; explicitly illustrative, never a live quote or forecast.
- Auth split layout, touch-sized inputs, accessible password visibility, preserved checkout intent and all existing consent requirements. No fictitious Apple/Google sign-in controls.
- Onboarding keeps server-side assessment and virtual balance. Explicit continuation prevents rapid taps from skipping questions. ETFs can be selected as an educational interest.
- Safe-area-aware mobile header and floating navigation, spring selection indicator, profile-level and operating-system motion preferences.
- Manifest with real PNG icons at 192/512 px and 180 px Apple touch icon, rendered from the original logo.
- Real Chromium installation prompt when available and manual Safari instructions on iOS. Installation is not falsely reported as complete.
- Static offline fallback. Updating an installed app requires an explicit action and warns about unsaved changes.

## Installed iPhone presentation (September 2026)

- Detects both `display-mode: standalone` and iOS `navigator.standalone` before paint. An older home-screen installation opening `/` is repaired to `/app`; ordinary Safari visits stay on the website. Payment/auth deep links are never intercepted.
- On installed mobile, a dedicated home presents the real demo balance, educational progress, next lesson and explicitly simulated market references. It is not just the desktop dashboard squeezed down.
- Five thumb-accessible tabs, safe-area-aware headers, system typography, reduced-motion support and a modal bottom sheet with focus containment, Escape dismissal and focus restoration.
- Plans and legal pages retain a compact app header instead of website marketing navigation. All educational disclosures and consent controls remain.
- After login/registration, a fresh same-origin document establishes the new session without racing an anonymous router refresh. Subscription intent and the onboarding gate are preserved. Secure/HttpOnly cookie settings are unchanged.
- Returning to the foreground checks for a service-worker update; applying it remains explicit. The manifest identity and `/app` start URL are unchanged, and only obsolete **public** fallback caches are removed.

On iPhone, open `/app` in Safari, choose Share → Add to Home Screen and enable **Open as Web App** when offered. A bookmark opened in Safari cannot programmatically hide browser controls. See [Apple's installation instructions](https://support.apple.com/es-es/guide/iphone/iphea86e5236/ios). This remains a PWA, not a compiled Swift application.

## Native home, orientation and billing refresh (6 September 2026 UTC)

- The installed dashboard has a dedicated layout: next lesson, original layered 13A sculpture, demo wallet, actual lesson/XP progress, simulated market references and links to open positions and the journal. The desktop dashboard remains separate; there are no invented performance charts or progress values.
- A three-step first-visit orientation is skippable, supports Back/Escape and restores focus. It can be replayed with **Conoce tu app**. Its versioned localStorage flag is presentation-only and never bypasses the server-side assessment, account authentication or checkout intent. No automatic carousel; OS and account reduced-motion preferences are honored.
- Explore is the automatic base entitlement when no eligible paid period exists. It is a status, not a radio option or checkout. Plus/Pro are optional upgrades. `resolveActivePlan` retains paid access through its valid period and fails closed to Free for absent, expired, canceled or invalid plans.
- Plans show the total USD reference for the selected month/year. Checkout reviews the COP total before navigating to Wompi. It has a Back control and hides the installed tab bar during payment; payment ID, reference, conversion and security details use expandable disclosure. No recurring debits are enabled.
- Account settings use grouped native navigation with heading focus after switching sections. Light/dark presentations preserve the account controls and privacy settings.
- The billing Origin guard now compares against the configured public HTTPS URL in production, not Firebase's internal request origin. Foreign origins and untrusted forwarded headers do not bypass the guard. See `WOMPI-READINESS.md`.

Validation: 284 unit tests, typecheck and production build passed. The isolated `scripts/qa-native-checkout.cjs` flow tests Chromium and WebKit at 320/390/430 px, tour dismissal/replay/focus/reduced motion, automatic Free presentation, paid selection, annual intent, real local subscribe route behind a TLS proxy, COP link/ID, idempotent retry, foreign-origin rejection and error recovery. It uses new temporary SQLite databases, fabricated keys and blocked external requests; it never navigates to Wompi or charges a card. Physical iPhone testing remains a separate acceptance check.

To run that fixture, build with `NEXT_PUBLIC_APP_URL=https://127.0.0.1:3443`, stop processes occupying local ports 3010/3443, set `PLAYWRIGHT_MODULE`, `PWA_QA_OPENSSL` and an absolute `PWA_QA_OUTPUT`, then run `node scripts/qa-native-checkout.cjs`. Firebase builds with its own public URL from `apphosting.yaml`; do not change production configuration to the local fixture URL.

## Privacy and offline contract

`public/sw.js` stores **only** `/offline.html`, fetched without credentials. No session HTML, React Server Component responses, API requests, market prices, account information, passwords, payment sources or checkout details are stored in Cache Storage. It never queues requests. Authenticated routes remain dynamic; API privacy rules remain in their existing handlers.

App features require connectivity. A loaded screen can display stale data after a disconnect; the runtime displays a warning. No trades or payments can be submitted offline by this service worker. This is deliberately not an offline trading terminal.

The service worker is served with no-cache/no-store headers; obsolete caches are deleted only within its own prefix. Do not expand caching without a separate account-data threat review.

## Verification

Run `npm run typecheck`, `npm test`, `npm run build`.

September 2026 verification: 256 unit tests passed, typecheck and production build passed. The final production build passed Chromium's installed account/navigation/offline flow, WebKit's HTTPS installed account/navigation flow, and normal-browser public-web regression checks, with zero page errors in those final runs. Physical iPhone installation/keyboard/VoiceOver remain device acceptance checks.

`scripts/qa-pwa.cjs` uses isolated headless Chromium (default) or WebKit (`PWA_QA_ENGINE=webkit`), without a personal profile. It blocks requests outside the fixed local test origin. Provide `PLAYWRIGHT_MODULE` if Playwright is supplied externally and `PWA_QA_OUTPUT` as an existing absolute screenshot directory. `PWA_QA_REGISTER=1` creates a local-only `@example.invalid` test account and exercises the assessment. `PWA_QA_REUSE_EMAIL` can instead reuse a synthetic `pwa-qa-<timestamp>@example.invalid` account, without disabling signup rate limits. Never point this script at production or real customer accounts.

`PWA_QA_STANDALONE=1` simulates iOS standalone detection; this is **not** physical iPhone installation. It checks the legacy root launch, native home, hidden website chrome, widths 320/390/430, account tab, modal sheet and plans navigation. Without this flag the normal responsive website is tested.

WebKit's production Secure-cookie test uses local HTTPS: start Next on `127.0.0.1:3010`, run `scripts/qa-pwa-https.cjs` with `PWA_QA_OPENSSL` pointing at OpenSSL, then use `PWA_QA_HTTPS=1`. The proxy binds only `127.0.0.1:3443`; its one-day test certificate stays in a new temp folder and is never trusted in the OS. The test browser alone ignores that local certificate error. `PWA_QA_ONLINE_ONLY=1` separates WebKit's HTTPS online flow from offline testing because Windows WebKit reports an internal navigation error for the self-signed TLS offline fallback. Chromium covers offline navigation; the service-worker unit suite verifies its privacy contract.

Desktop Chromium emulation is not evidence of a physical iPhone test. Before release, verify installation in Safari on a real iPhone, safe areas with the keyboard, VoiceOver, reduced transparency, and reopening after session expiration. An HTTPS deployment is required outside localhost.

This work does not enable Wompi, add recurring charges, or replace simulated market data with an exchange-licensed live feed. Those are separate backend integrations.

Reference: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).

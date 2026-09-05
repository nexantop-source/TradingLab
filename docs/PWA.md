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

## Privacy and offline contract

`public/sw.js` stores **only** `/offline.html`, fetched without credentials. No session HTML, React Server Component responses, API requests, market prices, account information, passwords, payment sources or checkout details are stored in Cache Storage. It never queues requests. Authenticated routes remain dynamic; API privacy rules remain in their existing handlers.

App features require connectivity. A loaded screen can display stale data after a disconnect; the runtime displays a warning. No trades or payments can be submitted offline by this service worker. This is deliberately not an offline trading terminal.

The service worker is served with no-cache/no-store headers; obsolete caches are deleted only within its own prefix. Do not expand caching without a separate account-data threat review.

## Verification

Run `npm run typecheck`, `npm test`, `npm run build`.

`scripts/qa-pwa.cjs` uses an isolated headless Chromium with no personal profile and blocks requests outside `http://127.0.0.1:3010`. Provide `PLAYWRIGHT_MODULE` if Playwright is supplied externally and `PWA_QA_OUTPUT` as an existing absolute screenshot directory. `PWA_QA_REGISTER=1` additionally creates a clearly named, local-only `@example.invalid` test account and exercises the assessment. Never point this script at production or real customer accounts.

Desktop Chromium emulation is not evidence of a physical iPhone test. Before release, verify installation in Safari on a real iPhone, safe areas with the keyboard, VoiceOver, reduced transparency, and reopening after session expiration. An HTTPS deployment is required outside localhost.

This work does not enable Wompi, add recurring charges, or replace simulated market data with an exchange-licensed live feed. Those are separate backend integrations.

Reference: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).

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

## Gesture navigation and simple terminal (September 2026)

- Installed mobile navigation opens a left drawer by dragging right from the left portion of non-interactive content. The drawer tracks the finger and settles with a velocity-aware spring. Buttons, fields, charts, horizontal scrollers and other dialogs are excluded; vertical intent and multi-touch yield. The visible menu button, focus containment and Escape remain available. Browser history is never modified or trapped.
- iOS owns some screen-edge gestures. `overscroll-behavior` alone is not a guarantee; a narrowly scoped cancelable edge touch is reserved where supported. Headless WebKit does **not** certify OS Back behavior. Physical iPhone acceptance is required, including charts, scrolling, pinch and the keyboard. See [WebKit issue 240183](https://bugs.webkit.org/show_bug.cgi?id=240183).
- The default terminal starts with Bitcoin's 24/7 **synthetic educational** market, virtual amount and green **Subir** / red **Bajar** position controls. This is not a deposit flow, binary payout or broker order. SL/TP distances are optional; leverage is fixed at 1× in simple mode. The existing advanced terminal remains available.
- Every order requires a review, an original observation and explicit virtual-money acknowledgement. Ambiguous network outcomes prompt position reconciliation, not automatic order retries. Balance changes and simulation creation/settlement share database transactions; conditional updates reject stale concurrent writes.
- The chart receives authenticated server observations approximately once per second, with one abortable request at a time. Line/area interpolation only travels to a received endpoint; it does not invent future ticks. Hidden/offline states suspend polling, retain clearly stale data and disable opening. The chart excludes menu gestures and supports OS/account reduced motion.
- Position evaluation is separate (every ten seconds while the screen is active). SL/TP are educational server-side simulations, not guaranteed background broker execution. Retrospective candle evaluation remains bounded to 600 one-minute candles. No new scheduler or live exchange subscription is provided.
- Signed-out `/app` has three independently composed, interactive scenes: instrument exploration, a hypothetical direction lesson and an academy/journal preview. No scene creates trades, payment intents or fake user progress. Registration remains immediately accessible. Images and instrument marks use existing local assets; illustrations are original SVG/CSS.
- Manifest name, short name and Apple app title are **TradingLab**. `/app` has the exact page title too. Existing iPhone icon labels may retain the name chosen at installation; this does not rename the user's existing shortcut.

Run the existing isolated checkout fixture with `PWA_QA_NATIVE_TRADING=1` to include `qa-welcome-scenes.cjs`, `qa-native-gestures.cjs` and `qa-simple-terminal.cjs`. It uses local TLS, fabricated billing keys and temporary demo accounts, not production users. Run `node --conditions=react-server --import tsx scripts/qa-simulation-integrity.ts` for the isolated SQLite ledger/concurrency suite. Production PostgreSQL and physical iPhone behavior require their own acceptance; do not equate emulation with those environments.

Final verification for this revision: 346 unit tests, typecheck, production build and 16 isolated SQLite integrity scenarios pass. The complete Chromium/WebKit fixture passed without diagnostic hooks and with zero page errors: guest scenes, touch navigation, one-second pulse, offline/visibility pause, amount/SL/TP validation, demo open/close, paid checkout preparation, Free status and light/dark regressions. The default direction buttons fit the first 390×844 viewport. Earlier release checks had reproduced intermittent React #418; publication was held until the correction and verification below.

The terminal uses RSC props only to seed a symbol-keyed mount. Subsequent balance, positions and daily usage come from the authenticated private/no-store JSON snapshot under the mutation generation guard. Both browser engines passed deliberate out-of-order JSON and RSC delivery: a pre-order snapshot cannot restore the old balance, and a delayed pre-close RSC cannot restore a closed position or overwrite its confirmed balance. The fixture holds later responses so they cannot hide a transient rollback.

### Production hydration regression

The isolated production probe reproduced React #418 on `/precios` and `/entrar`, with the captured component stack `a → body → html → RootLayout`. At the throw, React expected `a.skip-link` but its `nextHydratableInstance` pointed at a `META` whose parent was `HEAD`. The actual body already contained the correct skip link and page. Development mode and debugger logpoints changed timing and did not reproduce it; neither was accepted as a resolution. Blocking streamed metadata was tested, still reproduced the same failure and was reverted.

The cause is an asynchronous module boundary inside the root head: the server layout imported `THEME_INIT_SCRIPT` from a module marked `'use client'`. The built server registered that export as a client reference, not a plain string. Resolving its script props can suspend head hydration. The installed React runtime re-enters that head singleton without restoring its saved cursor, replacing the body's cursor with `head.firstChild`; the following skip link then fails to hydrate. See React's [client-module boundary contract](https://react.dev/reference/rsc/use-client).

`src/packages/ui/theme-bootstrap.ts` now supplies the same script and storage keys from a shared module with no client boundary. RootLayout serializes the literal bootstrap; ThemeProvider imports its unchanged keys. Early theme/motion application, SSR, metadata streaming, the accessible skip link and normal error reporting are preserved. No additional hydration-warning suppression, runtime instrumentation or dependency patch is shipped in the app.

`scripts/qa-hydration-probe.cjs` accepts only a realpath-resolved database under `os.tmpdir()/tradinglab-native-checkout-*/qa.db` (`PWA_QA_PROBE_DATABASE`), with fabricated accounts and local TLS. In production mode (`PWA_QA_PROBE_PRODUCTION=1`), its fixed 8 guest + 8 authenticated navigation rounds stop at the first error. Set `PWA_QA_PROBE_VERIFY_BOOTSTRAP=1` to assert an early literal theme script, no Flight import for `THEME_INIT_SCRIPT`, and the accessible skip link. The diagnostic recovery hook preserves Next's original error callback while recording the component stack it normally drops. Optional `PWA_QA_PROBE_NODE_DIAG=1` instruments the served React response **in the isolated loopback browser only**, without modifying the build/dependencies or suppressing errors. `PWA_QA_PROBE_THEME_DELAY_MS=300` deliberately delays only the local ThemeProvider chunk to stress the formerly asynchronous boundary.

After the shared-bootstrap fix, the rebuilt production app passed all 48 fixed guest/authenticated navigations with that 300 ms causal stress, literal-bootstrap/Flight/skip-link assertions and zero page errors, with runtime-node instrumentation disabled. The same stress failed on the second document before the fix. Three focused unit tests cover the shared-module boundary, unchanged early theme/motion application and preservation of the original recoverable-error callback. The final normal Chromium/WebKit release fixture also passed, without any diagnostic hooks or runtime instrumentation.

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

## Notificaciones push (septiembre 2026)

Sirven a una sola cosa: sostener el hábito de estudio. **No** hay alertas de
precio ni avisos que inviten a operar por impulso; en una plataforma educativa,
una notificación que empuje a «no perderse un movimiento» trabajaría contra su
propósito.

### Puesta en marcha

1. Genera el par de claves: `npx web-push generate-vapid-keys`.
2. Define `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`. Sin las dos
   primeras la función queda apagada: la interfaz lo indica y no se registra
   ningún dispositivo. La clave privada nunca llega al navegador.
3. Define `PUSH_DISPATCH_SECRET` con al menos 32 caracteres aleatorios.
4. Programa `POST /api/push/dispatch` **cada hora** con la cabecera
   `Authorization: Bearer $PUSH_DISPATCH_SECRET`. En Firebase App Hosting se
   hace con Cloud Scheduler:

   ```
   gcloud scheduler jobs create http tradinglab-study-reminders \
     --schedule="0 * * * *" \
     --uri="https://<tu-dominio>/api/push/dispatch" \
     --http-method=POST \
     --headers="Authorization=Bearer <PUSH_DISPATCH_SECRET>" \
     --location=<region>
   ```

Cada ejecución avisa solo a quien tiene esa hora como preferida **en su zona
horaria**, así que las 24 ejecuciones diarias cubren el mundo sin despertar a
nadie de madrugada. Sin el secreto definido la ruta responde 503 y no envía
nada, en lugar de quedar abierta.

### Reglas de envío

- Se avisa a quien lo pidió explícitamente, tiene al menos un dispositivo
  registrado y **no ha estudiado hoy**. Recordar a quien ya hizo su lección es
  ruido, y el ruido es lo que hace que la gente desactive las notificaciones.
- El permiso del navegador se pide solo tras un gesto explícito y después de
  explicar para qué sirve. Una denegación es casi irreversible.
- Registrar el dispositivo no activa el recordatorio: son dos decisiones
  separadas, igual que el consentimiento de correo.
- Una suscripción que el servicio rechaza con 404 o 410 se borra en lugar de
  reintentarse: ese navegador ya no existe.
- El worker siempre muestra una notificación visible. Un `push` silencioso hace
  que el navegador retire el permiso.
- Al tocar la notificación solo se abren rutas propias, y se reutiliza la
  ventana ya abierta en lugar de acumular pestañas.

En iPhone las notificaciones requieren que TradingLab esté añadida a la pantalla
de inicio; en Safari sin instalar, la interfaz lo indica en lugar de ofrecer un
control que no funcionaría.

## Academia sin conexión (septiembre 2026)

El contenido descargado vive en IndexedDB y **lo escribe la página**, nunca el
service worker: el worker mantiene intacta su política de no interceptar
navegación autenticada, `/api/` ni RSC, y sigue guardando un único documento.

- `GET /api/academy/offline` entrega solo las lecciones publicadas que el plan
  vigente permite leer. El filtro es el mismo `minPlan` que protege la ruta de
  lectura, así que descargar no puede saltarse el muro de pago.
- No se descarga progreso, cuestionarios ni identificadores de la cuenta. Los
  bloques de gráfico se cuentan pero no se sirven: sin conexión no hay precio
  que dibujar.
- La descarga se marca con un ámbito derivado de la cuenta y su plan. Si entra
  otra persona en el mismo dispositivo no coincide y se borra antes de escribir;
  al cerrar sesión se borra siempre.
- `offline.html` es el lector: índice por ruta formativa y lectura completa.
  Es autocontenido a propósito, sin una sola hoja de estilo, fuente o script
  externos, porque es lo único disponible justo cuando no hay red.

/** Presentation only. Never used for authentication, entitlements or payments. */
export function isStandalone(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

// Runs before paint, including old iOS installations that reopen the landing.
// Do not alter payment/auth deep links or normal browser navigation.
export const APP_MODE_INIT_SCRIPT = `(()=>{try{const app=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;document.documentElement.dataset.appMode=app?'standalone':'browser';if(app&&location.pathname==='/'){document.documentElement.dataset.appLaunch='true';location.replace('/app'+location.search+location.hash)}}catch{}})();`;

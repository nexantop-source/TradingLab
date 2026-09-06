/** Shared, synchronous bootstrap data. Keep this outside any `use client`
 * module: RootLayout must serialize a literal string into its head script,
 * not a lazy client-module reference that can suspend head hydration. */
export const STORAGE_THEME = 'tl-theme';
export const STORAGE_MOTION = 'tl-reduce-motion';

export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var choice = localStorage.getItem('${STORAGE_THEME}') || 'system';
    var valid = choice === 'system' || choice === 'dark' || choice === 'light' || choice === 'high-contrast';
    if (!valid) choice = 'system';
    var t = choice === 'system'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : choice;
    var m = localStorage.getItem('${STORAGE_MOTION}') === 'true';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-theme-preference', choice);
    document.documentElement.setAttribute('data-reduce-motion', String(m));
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-theme-preference', 'system');
  }
})();
`.trim();

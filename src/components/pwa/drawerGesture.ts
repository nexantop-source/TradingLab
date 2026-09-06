/** Gesture policy only: no browser history, account state or network side effects. */
export type DrawerIntent = 'pending' | 'horizontal' | 'cancel';

export function drawerIntent(dx: number, dy: number, opening: boolean): DrawerIntent {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return 'pending';
  // Yield early to vertical scrolling. Diagonals never capture the page.
  if (Math.abs(dy) >= Math.abs(dx) * 0.8) return 'cancel';
  if (opening && dx < 0) return 'cancel';
  return Math.abs(dx) > Math.abs(dy) * 1.3 ? 'horizontal' : 'pending';
}

export function canStartDrawerSwipe(x: number, viewportWidth: number, open: boolean): boolean {
  return Number.isFinite(x) && x >= 0 && (open || x <= Math.min(96, viewportWidth * 0.27));
}

export function drawerPosition(start: number, dx: number, width: number): number {
  return Math.max(-width, Math.min(0, start + dx));
}

export function drawerShouldOpen(position: number, velocity: number, width: number): boolean {
  // Short, deliberate flicks project forward; reversals project back immediately.
  // A 0.993 exponential decay projects ~142 ms of the sampled release velocity.
  const projected = position + (velocity / 1000) * 0.993 / (1 - 0.993);
  return projected > -width * 0.5;
}

export type DrawerSample = { x: number; time: number };

export function drawerReleaseVelocity(samples: DrawerSample[], releaseTime: number): number {
  const recent = samples.filter(sample => releaseTime - sample.time <= 100);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const elapsed = last.time - first.time;
  if (elapsed <= 0 || releaseTime - last.time > 60) return 0;
  return Math.max(-2000, Math.min(2000, (last.x - first.x) / elapsed * 1000));
}

/** Parents of custom canvases / horizontal gestures can opt out explicitly. */
export const DRAWER_GESTURE_EXCLUDE = [
  '[data-gesture-exclude]', 'a', 'button', 'input', 'select', 'textarea',
  '[contenteditable]:not([contenteditable="false"])', '[role="button"]',
  '[role="slider"]', '[role="switch"]', '[role="tab"]', '[role="listbox"]',
  'canvas', 'video', 'iframe', '[draggable="true"]',
].join(',');

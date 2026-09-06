'use client';

import * as React from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useTheme } from '@tl/ui/ThemeProvider';
import { isStandalone } from './appMode';
import { useMotionPreference } from './useMotionPreference';
import {
  canStartDrawerSwipe, drawerIntent, drawerPosition, drawerReleaseVelocity,
  drawerShouldOpen, DRAWER_GESTURE_EXCLUDE, type DrawerSample,
} from './drawerGesture';

const subscribeMode = (notify: () => void) => {
  const queries = [window.matchMedia('(display-mode: standalone)'), window.matchMedia('(max-width: 1023px)')];
  queries.forEach(query => query.addEventListener('change', notify));
  return () => queries.forEach(query => query.removeEventListener('change', notify));
};
const modeSnapshot = () => isStandalone() && window.matchMedia('(max-width: 1023px)').matches;
const serverMode = () => false;

type Drag = {
  kind: 'touch' | 'pointer'; id: number; startX: number; startY: number;
  origin: number; wasOpen: boolean; committed: boolean; samples: DrawerSample[];
};

/** A native modal supplies inert background, focus containment and Escape support.
 * Touch arbitration is deliberately separate from presentation and never writes history.
 */
export function GestureDrawer({ open, onOpenChange, scopeRef, disabled = false, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const native = React.useSyncExternalStore(subscribeMode, modeSnapshot, serverMode);
  const systemReduce = useMotionPreference();
  const { reduceMotion } = useTheme();
  const reduce = systemReduce || reduceMotion;
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<Drag | null>(null);
  const animationRef = React.useRef<ReturnType<typeof animate> | null>(null);
  const targetOpen = React.useRef(false);
  const widthRef = React.useRef(340);
  const focusRef = React.useRef<HTMLElement | null>(null);
  const overflowRef = React.useRef<string | null>(null);
  const suppressClickUntil = React.useRef(0);
  const x = useMotionValue(-340);
  const width = useMotionValue(340);
  const progress = useTransform(() => Math.max(0, Math.min(1, 1 + x.get() / width.get())));
  const latest = React.useRef({ native, reduce, disabled, onOpenChange });
  latest.current = { native, reduce, disabled, onOpenChange };

  const show = React.useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    focusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    if (panelRef.current) panelRef.current.scrollTop = 0;
    dialog.querySelector<HTMLElement>('[data-drawer-close]')?.focus({ preventScroll: true });
  }, []);

  const hide = React.useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    dialog.close();
    if (overflowRef.current !== null) {
      document.body.style.overflow = overflowRef.current;
      overflowRef.current = null;
    }
    // A swipe may begin with body focused. Give keyboard / VoiceOver a real exit target.
    const previous = focusRef.current;
    const fallback = scopeRef.current?.querySelector<HTMLElement>('.app-menu-trigger');
    const target = previous?.isConnected && previous !== document.body ? previous : fallback;
    if (target && target.getClientRects().length > 0) target.focus({ preventScroll: true });
  }, [scopeRef]);

  const settle = React.useCallback((nextOpen: boolean, velocity?: number) => {
    const liveVelocity = velocity ?? x.getVelocity();
    animationRef.current?.stop();
    targetOpen.current = nextOpen;
    latest.current.onOpenChange(nextOpen);
    dialogRef.current?.removeAttribute('data-dragging');
    if (nextOpen) show();
    const destination = nextOpen ? 0 : -widthRef.current;
    if (!latest.current.native || latest.current.reduce) {
      x.set(destination);
      if (!nextOpen) hide();
      return;
    }
    animationRef.current = animate(x, destination, {
      type: 'spring', stiffness: 470, damping: 43, mass: 1,
      velocity: liveVelocity, restDelta: 0.4, restSpeed: 4,
      onComplete: () => { if (!targetOpen.current && !dragRef.current) hide(); },
    });
  }, [hide, show, x]);

  React.useEffect(() => {
    if (open !== targetOpen.current) settle(open);
  }, [open, settle]);

  React.useEffect(() => {
    const resize = () => {
      const nextWidth = Math.min(360, window.innerWidth - 48);
      widthRef.current = nextWidth;
      width.set(nextWidth);
      animationRef.current?.stop();
      dragRef.current = null;
      x.set(targetOpen.current ? 0 : -nextWidth);
      if (!targetOpen.current) hide();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [hide, width, x]);

  const previousMode = React.useRef(native);
  React.useEffect(() => {
    if (previousMode.current && !native) { dragRef.current = null; settle(false, 0); }
    previousMode.current = native;
  }, [native, settle]);

  React.useEffect(() => {
    if (!native) return;

    const excluded = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return true;
      if (target.closest(DRAWER_GESTURE_EXCLUDE)) return true;
      if (target.closest('[role="dialog"], dialog') && !dialogRef.current?.contains(target)) return true;
      if (document.querySelector('dialog[open]') && !dialogRef.current?.open) return true;
      if (window.getSelection()?.toString()) return true;
      // Do not steal horizontal carousels even when their descendants have no role.
      for (let node: Element | null = target; node && node !== scopeRef.current; node = node.parentElement) {
        const style = window.getComputedStyle(node);
        if (node.scrollWidth > node.clientWidth + 2 && /auto|scroll/.test(style.overflowX)) return true;
      }
      return false;
    };

    const start = (kind: Drag['kind'], id: number, clientX: number, clientY: number, target: EventTarget | null, time: number) => {
      suppressClickUntil.current = 0;
      if (latest.current.disabled || !latest.current.native || dragRef.current) return false;
      if (!(target instanceof Node) || !scopeRef.current?.contains(target) || excluded(target)) return false;
      if (!canStartDrawerSwipe(clientX, window.innerWidth, Boolean(dialogRef.current?.open))) return false;
      animationRef.current?.stop();
      dragRef.current = { kind, id, startX: clientX, startY: clientY, origin: x.get(), wasOpen: targetOpen.current, committed: false, samples: [{ x: clientX, time }] };
      return true;
    };

    const cancel = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      settle(drag.wasOpen, 0);
    };

    const move = (clientX: number, clientY: number, time: number) => {
      const drag = dragRef.current;
      if (!drag) return false;
      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      if (!drag.committed) {
        const intent = drawerIntent(dx, dy, !drag.wasOpen && !dialogRef.current?.open);
        if (intent === 'cancel') { cancel(); return false; }
        if (intent === 'pending') return false;
        drag.committed = true;
        show();
        dialogRef.current?.setAttribute('data-dragging', 'true');
        // Mouse / pen keep tracking if the pointer exits the drawer.
        if (drag.kind === 'pointer') {
          try { dialogRef.current?.setPointerCapture(drag.id); } catch { /* pointer already canceled */ }
        }
      }
      x.set(drawerPosition(drag.origin, dx, widthRef.current));
      drag.samples.push({ x: clientX, time });
      drag.samples = drag.samples.filter(sample => time - sample.time <= 120);
      return true;
    };

    const finish = (time: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (!drag.committed) { settle(drag.wasOpen, 0); return; }
      suppressClickUntil.current = performance.now() + 350;
      const velocity = drawerReleaseVelocity(drag.samples, time);
      settle(drawerShouldOpen(x.get(), velocity, widthRef.current), velocity);
    };

    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) { cancel(); return; }
      const touch = event.touches[0];
      const started = start('touch', touch.identifier, touch.clientX, touch.clientY, event.target, event.timeStamp);
      // Safari may claim its history gesture before touchmove. Only reserve this
      // narrow, non-interactive left edge in installed mode; never block all touches.
      // WebKit / OS gestures are not uniformly overrideable on every iOS version.
      if (started && touch.clientX <= 18 && event.cancelable) event.preventDefault();
    };
    const touchMove = (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.kind !== 'touch') return;
      if (event.touches.length !== 1) { cancel(); return; }
      const touch = Array.from(event.touches).find(item => item.identifier === drag.id);
      if (!touch) { cancel(); return; }
      if (move(touch.clientX, touch.clientY, event.timeStamp) && event.cancelable) event.preventDefault();
    };
    const touchEnd = (event: TouchEvent) => {
      if (dragRef.current?.kind !== 'touch') return;
      if (event.touches.length) { cancel(); return; }
      finish(event.timeStamp);
    };
    const pointerDown = (event: PointerEvent) => {
      // TouchEvents let iOS scroll / pinch win until directional intent is certain.
      // Pointer Events cover mouse and pen without duplicate touch tracking.
      if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
      start('pointer', event.pointerId, event.clientX, event.clientY, event.target, event.timeStamp);
    };
    const pointerMove = (event: PointerEvent) => {
      if (dragRef.current?.kind !== 'pointer' || dragRef.current.id !== event.pointerId) return;
      if (move(event.clientX, event.clientY, event.timeStamp) && event.cancelable) event.preventDefault();
    };
    const pointerUp = (event: PointerEvent) => {
      if (dragRef.current?.kind === 'pointer' && dragRef.current.id === event.pointerId) finish(event.timeStamp);
    };
    const pointerCancel = (event: PointerEvent) => {
      // Browsers may cancel their parallel touch PointerEvent stream while the
      // non-passive TouchEvent recognizer is still deciding scroll vs. drawer.
      if (dragRef.current?.kind === 'pointer' && dragRef.current.id === event.pointerId) cancel();
    };
    const click = (event: MouseEvent) => {
      if (event.detail > 0 && performance.now() < suppressClickUntil.current) {
        event.preventDefault(); event.stopPropagation(); suppressClickUntil.current = 0;
      }
    };
    const visibility = () => { if (document.hidden) cancel(); };
    const options = { capture: true, passive: false };
    window.addEventListener('touchstart', touchStart, options);
    window.addEventListener('touchmove', touchMove, options);
    window.addEventListener('touchend', touchEnd, options);
    window.addEventListener('touchcancel', cancel, options);
    window.addEventListener('pointerdown', pointerDown, options);
    window.addEventListener('pointermove', pointerMove, options);
    window.addEventListener('pointerup', pointerUp, options);
    window.addEventListener('pointercancel', pointerCancel, options);
    window.addEventListener('click', click, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('touchstart', touchStart, true);
      window.removeEventListener('touchmove', touchMove, true);
      window.removeEventListener('touchend', touchEnd, true);
      window.removeEventListener('touchcancel', cancel, true);
      window.removeEventListener('pointerdown', pointerDown, true);
      window.removeEventListener('pointermove', pointerMove, true);
      window.removeEventListener('pointerup', pointerUp, true);
      window.removeEventListener('pointercancel', pointerCancel, true);
      window.removeEventListener('click', click, true);
      document.removeEventListener('visibilitychange', visibility);
      dragRef.current = null;
    };
  }, [native, scopeRef, settle, show, x]);

  React.useEffect(() => () => {
    animationRef.current?.stop();
    if (overflowRef.current !== null) document.body.style.overflow = overflowRef.current;
    dialogRef.current?.close();
  }, []);

  return <dialog
    ref={dialogRef}
    aria-label="Todas las secciones"
    className={native ? 'native-gesture-drawer' : 'app-menu-sheet'}
    onCancel={event => { event.preventDefault(); dragRef.current = null; settle(false); }}
    onClick={event => { if (event.target === event.currentTarget) settle(false); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
  >
    {native && <motion.div className="native-drawer-scrim" aria-hidden="true" style={{ opacity: progress }} onClick={() => settle(false)} />}
    <motion.div ref={panelRef} className={native ? 'native-drawer-panel' : 'app-menu-sheet-content'} style={native ? { x: reduce ? 0 : x, opacity: reduce ? progress : 1, width } : undefined}>
      {!native && <span className="app-sheet-handle" aria-hidden="true" />}
      {children}
      {native && <p className="native-drawer-hint" aria-hidden="true"><span>←</span> Desliza para cerrar</p>}
    </motion.div>
  </dialog>;
}

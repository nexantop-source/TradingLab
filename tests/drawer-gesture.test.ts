import { describe, expect, it } from 'vitest';
import {
  canStartDrawerSwipe, drawerIntent, drawerPosition, drawerReleaseVelocity,
  drawerShouldOpen, DRAWER_GESTURE_EXCLUDE,
} from '../src/components/pwa/drawerGesture';

describe('installed drawer gesture arbitration', () => {
  it('waits for intent instead of capturing taps or tremor', () => {
    expect(drawerIntent(7, 2, true)).toBe('pending');
    expect(drawerIntent(-3, 9, true)).toBe('pending');
  });
  it('opens only rightward and yields to vertical / diagonal movement', () => {
    expect(drawerIntent(18, 2, true)).toBe('horizontal');
    expect(drawerIntent(-18, 2, true)).toBe('cancel');
    expect(drawerIntent(12, 10, true)).toBe('cancel');
    expect(drawerIntent(2, -16, true)).toBe('cancel');
  });
  it('allows either horizontal direction when grabbing an open drawer', () => {
    expect(drawerIntent(-25, 3, false)).toBe('horizontal');
    expect(drawerIntent(25, -3, false)).toBe('horizontal');
  });
  it('limits opening to the left portion without a full-page edge overlay', () => {
    expect(canStartDrawerSwipe(18, 390, false)).toBe(true);
    expect(canStartDrawerSwipe(90, 390, false)).toBe(true);
    expect(canStartDrawerSwipe(120, 390, false)).toBe(false);
    expect(canStartDrawerSwipe(87, 320, false)).toBe(false);
    expect(canStartDrawerSwipe(260, 390, true)).toBe(true);
    expect(canStartDrawerSwipe(-1, 390, false)).toBe(false);
  });
  it('tracks the actual grab offset and bounds without jumping to the finger', () => {
    expect(drawerPosition(-340, 50, 340)).toBe(-290);
    expect(drawerPosition(-160, -30, 340)).toBe(-190);
    expect(drawerPosition(-160, 400, 340)).toBe(0);
    expect(drawerPosition(-160, -400, 340)).toBe(-340);
  });
  it('uses projected velocity, including a reversed flick, for the snap target', () => {
    expect(drawerShouldOpen(-220, 0, 340)).toBe(false);
    expect(drawerShouldOpen(-220, 800, 340)).toBe(true);
    expect(drawerShouldOpen(-70, 0, 340)).toBe(true);
    expect(drawerShouldOpen(-70, -1000, 340)).toBe(false);
  });
  it('samples only recent motion and a stationary release has no old momentum', () => {
    expect(drawerReleaseVelocity([{ x: 0, time: 0 }, { x: 40, time: 70 }, { x: 64, time: 100 }], 105)).toBe(800);
    expect(drawerReleaseVelocity([{ x: 0, time: 0 }, { x: 80, time: 40 }], 120)).toBe(0);
    expect(drawerReleaseVelocity([{ x: 0, time: 10 }, { x: 100, time: 11 }], 11)).toBe(2000);
    expect(drawerReleaseVelocity([{ x: 100, time: 10 }, { x: 0, time: 11 }], 11)).toBe(-2000);
  });
  it('exposes an explicit chart opt-out and excludes controls / embeds', () => {
    for (const selector of ['[data-gesture-exclude]', 'button', 'input', '[role="slider"]', 'canvas', 'iframe']) expect(DRAWER_GESTURE_EXCLUDE).toContain(selector);
  });
});

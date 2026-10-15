import { useSyncExternalStore } from "react";
export const DISPLAY_KEY = "dreamDisplay";
export function readDisplay(storage) {
  try {
    const value = JSON.parse(storage?.getItem(DISPLAY_KEY) || "null");
    return {
      background: value?.background === true,
      immersive: value?.immersive === true,
    };
  } catch {
    return { background: false, immersive: false };
  }
}
let storage;
try {
  storage = globalThis.localStorage;
} catch {}
let state = readDisplay(storage),
  target = null,
  returnFocus = null,
  nativeActive = false;
const listeners = new Set();
export const displaySnapshot = () => state;
export const subscribeDisplay = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function update(patch) {
  state = { ...state, ...patch };
  try {
    storage?.setItem(DISPLAY_KEY, JSON.stringify(state));
  } catch {}
  for (const fn of listeners) fn();
}
export function useDisplay() {
  return useSyncExternalStore(
    subscribeDisplay,
    displaySnapshot,
    displaySnapshot,
  );
}
export function registerDisplay(element) {
  target = element;
  return () => {
    if (target === element) {
      target = null;
      nativeActive = false;
    }
  };
}
export function toggleBackground() {
  update({ background: !state.background });
}
export function enterAquarium() {
  if (!target) return;
  returnFocus = globalThis.document?.activeElement;
  if (returnFocus?.closest?.(".display-panel"))
    returnFocus = document.querySelector(".display-trigger");
  update({ immersive: true });
  // Called synchronously from the user's gesture. Rejection keeps the in-page fallback.
  try {
    const requestedTarget = target;
    const request = target.requestFullscreen?.();
    request?.then(
      () => {
        if (target !== requestedTarget) return;
        nativeActive = true;
        // Entry/exit events may be queued together; the Promise also records entry.
        if (globalThis.document?.fullscreenElement !== target)
          nativeFullscreenEnded();
      },
      () => {},
    );
  } catch {}
}
function restoreFocus() {
  const element = returnFocus;
  setTimeout(() => {
    if (!state.immersive) element?.focus?.();
  }, 0);
}
export async function exitAquarium() {
  try {
    if (globalThis.document?.fullscreenElement === target)
      await document.exitFullscreen();
  } catch {
    return;
  }
  nativeActive = false;
  update({ immersive: false });
  restoreFocus();
}
export function nativeFullscreenChanged() {
  if (globalThis.document?.fullscreenElement === target) nativeActive = true;
  else if (nativeActive) nativeFullscreenEnded();
}
export function nativeFullscreenEnded() {
  nativeActive = false;
  update({ immersive: false });
  restoreFocus();
}

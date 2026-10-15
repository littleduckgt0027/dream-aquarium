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
  returnFocus = null;
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
    if (target === element) target = null;
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
    const request = target.requestFullscreen?.();
    request?.catch(() => {});
  } catch {}
}
export async function exitAquarium() {
  update({ immersive: false });
  try {
    if (globalThis.document?.fullscreenElement === target)
      await document.exitFullscreen();
  } catch {}
  setTimeout(() => returnFocus?.focus?.(), 0);
}
export function nativeFullscreenEnded() {
  update({ immersive: false });
  setTimeout(() => returnFocus?.focus?.(), 0);
}

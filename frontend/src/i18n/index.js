import { useSyncExternalStore } from "react";
import { messages, sourceKeys } from "./catalog.js";
export { messages, sourceKeys };
export const LANGUAGES = [
  { code: "th", label: "ไทย", locale: "th-TH" },
  { code: "zh-CN", label: "简体中文", locale: "zh-CN" },
  { code: "ja", label: "日本語", locale: "ja-JP" },
  { code: "ko", label: "한국어", locale: "ko-KR" },
  { code: "en", label: "English", locale: "en-US" },
];
const listeners = new Set();
export const LANGUAGE_KEY = "dreamLanguage";
const storage = {
  get(key) {
    try {
      return globalThis.localStorage?.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* private mode */
    }
  },
};
const savedLanguage = storage.get(LANGUAGE_KEY);
let language = LANGUAGES.some((l) => l.code === savedLanguage)
  ? savedLanguage
  : "th";
export const getLanguage = () => language;
export const getLocale = () =>
  LANGUAGES.find((l) => l.code === language).locale;
export function setLanguage(next) {
  if (!LANGUAGES.some((l) => l.code === next)) return;
  language = next;
  storage.set(LANGUAGE_KEY, next);
  if (globalThis.document) document.documentElement.lang = next;
  for (const listener of listeners) listener();
}
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function t(key, params = {}) {
  let value = Object.hasOwn(messages[language], key)
    ? messages[language][key]
    : undefined;
  if (value === undefined)
    throw Error(`Missing translation: ${language}:${key}`);
  if (typeof value === "object")
    value =
      value[new Intl.PluralRules(getLocale()).select(Number(params.count))] ||
      value.other;
  return value.replace(/\{(\w+)\}/g, (_, name) => {
    if (params[name] === undefined)
      throw Error(`Missing interpolation: ${key}:${name}`);
    return typeof params[name] === "number"
      ? new Intl.NumberFormat(getLocale()).format(params[name])
      : String(params[name]);
  });
}
export function useI18n() {
  useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return { t, language, setLanguage };
}
export const number = (n, options = {}) =>
  new Intl.NumberFormat(getLocale(), options).format(n);
export const date = (time, options = { dateStyle: "medium" }) =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "Asia/Bangkok",
    calendar: "gregory",
    ...options,
  }).format(new Date(time));
export const dateTime = (time) =>
  date(time, { dateStyle: "medium", timeStyle: "short" });
export const duration = (seconds) =>
  t("ui.value0h_value1m", {
    p0: number(Math.floor(seconds / 3600)),
    p1: number(Math.floor((seconds % 3600) / 60)),
  });
// Existing database records remain untouched; only known system messages are
// translated. Player names, usernames, IDs and DNA values never pass through this.
export function systemMessage(text) {
  if (Object.hasOwn(sourceKeys, text)) return t(sourceKeys[text]);
  for (const [pattern, key] of [
    [/^Gacha x(\d+)$/, "ui.gacha_xvalue0"],
    [/^Limited (\d{4}-\d{2})$/, "ui.limited_value0"],
  ]) {
    const m = String(text).match(pattern);
    if (m) return t(key, { p0: m[1] });
  }
  return t("ui.something_went_wrong_please_reconnect_and_try_again");
}
if (globalThis.document) document.documentElement.lang = language;

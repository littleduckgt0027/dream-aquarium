import React from "react";
import { t, useI18n } from "./i18n/index.js";
import { useDisplay, enterAquarium, toggleBackground } from "./display.js";
export function ExpandIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" />
    </svg>
  );
}
export function LayersIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="m12 3 10 6-10 6L2 9Zm-10 11 10 6 10-6M2 18l10 6 10-6" />
    </svg>
  );
}
export default function DisplayControls({ onAction = () => {} }) {
  useI18n();
  const { background } = useDisplay();
  return (
    <div className="display-actions">
      <button
        className="outline"
        title={t("display.fullscreen_hint")}
        onClick={() => {
          enterAquarium();
          onAction();
        }}
      >
        <ExpandIcon />
        {t("display.fullscreen")}
      </button>
      <button
        className="outline"
        aria-pressed={background}
        title={t("display.background_hint")}
        onClick={() => {
          toggleBackground();
          onAction();
        }}
      >
        <LayersIcon />
        {t(background ? "display.background_off" : "display.background")}
      </button>
    </div>
  );
}

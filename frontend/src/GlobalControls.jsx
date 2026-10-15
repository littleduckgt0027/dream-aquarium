import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { LANGUAGES, useI18n, number } from "./i18n/index.js";
import DisplayControls, { LayersIcon } from "./DisplayControls.jsx";
import { audio } from "./audio.js";
export default function GlobalControls({ displayControls = false }) {
  const { t, language, setLanguage } = useI18n(),
    [panel, setPanel] = useState(null),
    root = useRef(null),
    trigger = useRef(null);
  const { prefs, active, available } = useSyncExternalStore(
    audio.subscribe,
    audio.getSnapshot,
    audio.getSnapshot,
  );
  useEffect(() => {
    if (!panel) return;
    const outside = (e) => {
      if (!root.current?.contains(e.target)) setPanel(null);
    };
    const escape = (e) => {
      if (e.key === "Escape") {
        setPanel(null);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    root.current
      ?.querySelector(
        panel === "language"
          ? '[aria-checked="true"]'
          : ".control-panel button",
      )
      ?.focus();
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);
  const toggle = (next, event) => {
    trigger.current = event.currentTarget;
    setPanel(panel === next ? null : next);
  };
  const labels = {
    master: "ui.master_volume",
    music: "ui.music_volume",
    ambient: "ui.ambient_volume",
    effects: "ui.sound_effects_volume",
  };
  return (
    <div className="global-controls" ref={root}>
      <button
        className="control-trigger language-trigger"
        aria-label={t("ui.language")}
        aria-haspopup="menu"
        aria-expanded={panel === "language"}
        onClick={(e) => toggle("language", e)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3 12h18M5 7h14M5 17h14" />
        </svg>{" "}
        <span>{LANGUAGES.find((l) => l.code === language).label}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      <button
        data-audio-control
        className="control-trigger"
        aria-label={t("ui.sound_settings")}
        aria-haspopup="dialog"
        aria-expanded={panel === "audio"}
        onClick={(e) => toggle("audio", e)}
      >
        <span aria-hidden="true">{active && !prefs.muted ? "♫" : "♩"}</span>
      </button>
      {displayControls && (
        <button
          className="control-trigger display-trigger"
          aria-label={t("display.controls")}
          aria-haspopup="dialog"
          aria-expanded={panel === "display"}
          onClick={(e) => toggle("display", e)}
        >
          <LayersIcon />
        </button>
      )}
      {panel === "display" && (
        <section
          className="control-panel display-panel"
          role="dialog"
          aria-label={t("display.controls")}
        >
          <DisplayControls onAction={() => setPanel(null)} />
        </section>
      )}
      {panel === "language" && (
        <div
          className="control-panel language-panel"
          role="menu"
          aria-label={t("ui.language")}
          onKeyDown={(e) => {
            const choices = [
              ...root.current.querySelectorAll('[role="menuitemradio"]'),
            ];
            const at = choices.indexOf(document.activeElement);
            let next;
            if (e.key === "ArrowDown") next = (at + 1) % choices.length;
            if (e.key === "ArrowUp")
              next = (at - 1 + choices.length) % choices.length;
            if (e.key === "Home") next = 0;
            if (e.key === "End") next = choices.length - 1;
            if (next !== undefined) {
              e.preventDefault();
              choices[next].focus();
            }
          }}
        >
          {LANGUAGES.map((l) => (
            <button
              role="menuitemradio"
              aria-checked={l.code === language}
              lang={l.code}
              key={l.code}
              onClick={() => {
                setLanguage(l.code);
                setPanel(null);
                trigger.current?.focus();
              }}
            >
              {l.label}
              <span aria-hidden="true">{l.code === language ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      )}
      {panel === "audio" && (
        <section
          className="control-panel sound-panel"
          role="dialog"
          aria-label={t("ui.sound_settings")}
          data-audio-control
        >
          <div className="control-panel-title">
            <b>{t("ui.sound_settings")}</b>
            <button
              aria-label={t("ui.close")}
              onClick={() => {
                setPanel(null);
                trigger.current?.focus();
              }}
            >
              ×
            </button>
          </div>
          {!available ? (
            <p role="status">{t("ui.sound_unavailable_on_this_device")}</p>
          ) : (
            <>
              {!active && (
                <button
                  className="primary"
                  onClick={() => {
                    audio.update({ muted: false });
                    audio.enable();
                  }}
                >
                  {t("ui.enable_sound")}
                </button>
              )}
              <button
                aria-pressed={prefs.muted}
                onClick={() => audio.update({ muted: !prefs.muted })}
              >
                {t(prefs.muted ? "ui.unmute" : "ui.mute")}
              </button>
              {Object.entries(labels).map(([key, label]) => (
                <label
                  className="volume-control"
                  key={key}
                  htmlFor={`audio-volume-${key}`}
                >
                  <span>
                    {t(label)}
                    <output>{number(prefs[key])}%</output>
                  </span>
                  <input
                    id={`audio-volume-${key}`}
                    aria-label={t(label)}
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={prefs[key]}
                    onChange={(e) =>
                      audio.update({ [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
              {[
                ["musicOn", "ui.music"],
                ["ambientOn", "ui.ambient"],
                ["effectsOn", "ui.sound_effects"],
              ].map(([key, label]) => (
                <label className="audio-toggle" key={key}>
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={(e) => audio.update({ [key]: e.target.checked })}
                  />
                  {t(label)}
                </label>
              ))}
            </>
          )}
          <p className="muted">
            {t(
              "ui.sound_begins_only_when_you_enable_it_your_preferences_stay_on_this_device",
            )}
          </p>
        </section>
      )}
    </div>
  );
}

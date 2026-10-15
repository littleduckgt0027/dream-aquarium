import React, { useEffect, useRef, useState } from "react";
import Aquarium from "./Aquarium.jsx";
import GlobalControls from "./GlobalControls.jsx";
import { t, useI18n } from "./i18n/index.js";
import {
  useDisplay,
  registerDisplay,
  exitAquarium,
  nativeFullscreenEnded,
} from "./display.js";
export default function AquariumStage(props) {
  useI18n();
  const mode = useDisplay(),
    ref = useRef(null),
    [idle, setIdle] = useState(false);
  useEffect(() => registerDisplay(ref.current), []);
  useEffect(() => {
    let native = false;
    const changed = () => {
      if (document.fullscreenElement === ref.current) native = true;
      else if (native) {
        native = false;
        nativeFullscreenEnded();
      }
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!mode.immersive) return;
    let timer;
    const reveal = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 3000);
    };
    const key = (e) => {
      reveal();
      if (e.key === "Escape") {
        e.preventDefault();
        exitAquarium();
      } else if (e.key === "Tab") {
        const choices = [
          ...ref.current.querySelectorAll('button,input,select,[tabindex="0"]'),
        ].filter((el) => !el.disabled && el.getClientRects().length);
        const first = choices[0],
          last = choices.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const selectors =
      ".app>.sidebar,.workspace>header,.content>:not(.aquarium-page),.aquarium-page>:not(.tank-view),.tank-view>:not(.aquarium-stage),.app>.modal-backdrop,.app>.toast";
    const others = [...document.querySelectorAll(selectors)].map((el) => [
      el,
      el.inert,
    ]);
    others.forEach(([el]) => (el.inert = true));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", key);
    document.addEventListener("pointermove", reveal);
    document.addEventListener("pointerdown", reveal);
    ref.current?.focus();
    reveal();
    return () => {
      clearTimeout(timer);
      others.forEach(([el, value]) => (el.inert = value));
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointermove", reveal);
      document.removeEventListener("pointerdown", reveal);
    };
  }, [mode.immersive]);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={`aquarium-stage ${mode.immersive ? "immersive" : mode.background ? "background" : "inline"}`}
      role={mode.immersive ? "dialog" : undefined}
      aria-modal={mode.immersive ? "true" : undefined}
      aria-label={mode.immersive ? t("display.fullscreen") : undefined}
    >
      <Aquarium
        {...props}
        background={mode.background && !mode.immersive}
        onSelect={mode.immersive || mode.background ? () => {} : props.onSelect}
      />
      {mode.immersive && (
        <div
          className={`immersive-toolbar ${idle ? "idle" : ""}`}
          aria-label={t("display.controls")}
          role="toolbar"
        >
          <button className="exit-immersive" onClick={exitAquarium}>
            {t("display.exit")}
          </button>
          <GlobalControls />
        </div>
      )}
    </div>
  );
}

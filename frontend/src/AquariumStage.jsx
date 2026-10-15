import React, { useEffect, useRef, useState } from "react";
import Aquarium from "./Aquarium.jsx";
import GlobalControls from "./GlobalControls.jsx";
import { t, useI18n } from "./i18n/index.js";
import {
  useDisplay,
  registerDisplay,
  exitAquarium,
  nativeFullscreenChanged,
} from "./display.js";
export default function AquariumStage(props) {
  useI18n();
  const [drag, setDrag] = useState(null);
  const mode = useDisplay(),
    ref = useRef(null),
    [idle, setIdle] = useState(false);
  useEffect(() => registerDisplay(ref.current), []);
  useEffect(() => {
    document.addEventListener("fullscreenchange", nativeFullscreenChanged);
    return () =>
      document.removeEventListener("fullscreenchange", nativeFullscreenChanged);
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
        cosmetics={
          drag
            ? {
                ...props.cosmetics,
                placements: props.cosmetics.placements.map((i) =>
                  i.id === drag.id ? { ...i, ...drag } : i,
                ),
              }
            : props.cosmetics
        }
        background={mode.background && !mode.immersive}
        onSelect={mode.immersive || mode.background ? () => {} : props.onSelect}
      />
      {props.editing &&
        !mode.immersive &&
        !mode.background &&
        props.cosmetics?.placements.map((item) => (
          <button
            key={item.id}
            className="placement-handle"
            aria-label={t("exp.edit")}
            style={{
              left: `${(drag?.id === item.id ? drag.x : item.x) * 100}%`,
              top: `${(drag?.id === item.id ? drag.y : item.y) * 100}%`,
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ ...item });
              props.onChoosePlacement?.(item.id);
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const r = ref.current.getBoundingClientRect();
              setDrag({
                ...item,
                x: Math.max(
                  0.03,
                  Math.min(0.97, (e.clientX - r.left) / r.width),
                ),
                y: Math.max(
                  0.1,
                  Math.min(0.97, (e.clientY - r.top) / r.height),
                ),
              });
            }}
            onPointerUp={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              e.currentTarget.releasePointerCapture(e.pointerId);
              if (drag)
                props.onPlace?.({
                  id: item.id,
                  x: drag.x,
                  y: drag.y,
                  rotation: item.rotation,
                  scale: item.scale,
                });
              setDrag(null);
            }}
            onPointerCancel={() => setDrag(null)}
          >
            ✥
          </button>
        ))}
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

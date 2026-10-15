import React, { useEffect, useRef } from "react";
import { COLORS } from "../../shared/rules.js";
export function drawFish(c, f, x, y, size = 55, dir = 1, time = 0) {
  const d = f.dna;
  c.save();
  c.translate(x, y);
  c.scale(dir, 1);
  const length = size * (0.8 + d.proportion * 0.4),
    h = size * (0.23 + d.body * 0.24);
  const hue = d.hue;
  if (f.rarity >= 3 || d.glow) {
    c.shadowColor = COLORS[f.rarity];
    c.shadowBlur = 12 + f.rarity * 2;
  }
  const gradient = c.createLinearGradient(-length, -h, length, h);
  gradient.addColorStop(0, `hsl(${d.accent} 78% 65%)`);
  gradient.addColorStop(0.45, `hsl(${hue} 78% 62%)`);
  gradient.addColorStop(1, `hsl(${hue} 65% 38%)`);
  c.fillStyle = gradient;
  const tail = length * (0.35 + d.tailLength * 0.4);
  const flap = Math.sin(time * 4 + d.hue) * 0.12;
  c.save();
  c.translate(-length * 0.65, 0);
  c.rotate(flap);
  c.beginPath();
  c.moveTo(0, 0);
  if (d.tail === 0) {
    c.lineTo(-tail, -h * 1.4);
    c.quadraticCurveTo(-tail * 0.6, 0, -tail, h * 1.4);
  } else if (d.tail === 1) {
    c.bezierCurveTo(-tail * 0.3, -h * 2, -tail * 1.2, -h * 2, -tail, -h * 0.2);
    c.quadraticCurveTo(-tail * 0.6, 0, -tail, h * 1.6);
  } else if (d.tail === 2) {
    c.lineTo(-tail, -h * 1.2);
    c.lineTo(-tail * 0.65, 0);
    c.lineTo(-tail, h * 1.2);
  } else {
    c.arc(-tail * 0.4, 0, h * 1.5, -Math.PI / 2, Math.PI / 2, true);
  }
  c.closePath();
  c.fill();
  c.restore();
  c.globalAlpha = 0.75;
  c.beginPath();
  c.moveTo(-length * 0.4, -h * 0.3);
  if (d.fin === 1) {
    c.lineTo(-length * 0.05, -h * (2 + d.finLength));
    c.lineTo(length * 0.35, -h * 0.5);
  } else if (d.fin === 2) {
    c.bezierCurveTo(
      -length * 0.6,
      -h * 2,
      -length * 0.4,
      -h * 3,
      length * 0.35,
      -h * 0.5,
    );
  } else
    c.quadraticCurveTo(
      -length * 0.3,
      -h * (2 + d.finLength),
      length * 0.35,
      -h * 0.5,
    );
  c.fill();
  c.beginPath();
  c.moveTo(-length * 0.2, h * 0.2);
  c.quadraticCurveTo(0, h * (1.7 + d.finLength), length * 0.3, h * 0.5);
  c.fill();
  c.globalAlpha = 1;
  c.beginPath();
  c.moveTo(-length * 0.7, 0);
  c.bezierCurveTo(
    -length * 0.6,
    -h * 1.2,
    length * (0.3 + d.head * 0.25),
    -h * 1.25,
    length * 0.7,
    -h * (0.05 + d.head * 0.2),
  );
  c.quadraticCurveTo(
    length * (0.8 + d.head * 0.1),
    h * 0.15,
    length * 0.61,
    h * 0.45,
  );
  c.bezierCurveTo(
    length * 0.2,
    h * 1.25,
    -length * 0.5,
    h * 1.15,
    -length * 0.7,
    0,
  );
  c.fill();
  c.save();
  c.clip();
  c.shadowBlur = 0;
  c.strokeStyle = "rgba(255,255,255,.42)";
  c.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const px = (i - 3) * length * 0.17;
    if (d.pattern === 0) {
      c.beginPath();
      c.moveTo(px, -h);
      c.lineTo(px - length * 0.13, h);
      c.stroke();
    } else if (d.pattern === 1) {
      c.fillStyle = `hsla(${d.accent} 85% 75% / .75)`;
      c.beginPath();
      c.arc(px, Math.sin(i * 2 + d.hue) * h * 0.6, 3 + (i % 3), 0, 7);
      c.fill();
    } else if (d.pattern === 2) {
      c.beginPath();
      c.ellipse(px, 0, length * 0.16, h * 0.6, 0, 0, 7);
      c.stroke();
    }
  }
  c.restore();
  c.shadowBlur = 0;
  c.fillStyle = "rgba(255,255,255,.2)";
  c.beginPath();
  c.ellipse(length * 0.07, -h * 0.45, length * 0.4, h * 0.2, -0.1, 0, 7);
  c.fill();
  c.fillStyle = "#e4f8ed";
  c.beginPath();
  c.arc(length * 0.43, -h * 0.15, 4 + d.eye * 2, 0, 7);
  c.fill();
  c.fillStyle = "#051b25";
  c.beginPath();
  c.arc(length * 0.45, -h * 0.15, 2.6 + d.eye, 0, 7);
  c.fill();
  c.fillStyle = "white";
  c.beginPath();
  c.arc(length * 0.46, -h * 0.22, 1.1, 0, 7);
  c.fill();
  c.restore();
}
export function FishIcon({ fish }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current.getContext("2d");
    c.clearRect(0, 0, 160, 90);
    drawFish(c, fish, 95, 44, 49, 1, 0);
  }, [fish]);
  return (
    <canvas
      ref={ref}
      width="160"
      height="90"
      className="fish-icon"
      aria-label={`${fish.name} procedural fish`}
    />
  );
}
export default function Aquarium({
  fish,
  theme,
  decor,
  onSelect,
  quality = "high",
}) {
  const ref = useRef(),
    world = useRef([]),
    latest = useRef({ fish, onSelect, theme, decor, quality });
  latest.current = { fish, onSelect, theme, decor, quality };
  useEffect(() => {
    const canvas = ref.current,
      c = canvas.getContext("2d");
    let frame,
      w = 1000,
      h = 600,
      last = 0,
      t = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      const ratio = Math.min(devicePixelRatio, 2);
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    function render(ms) {
      const dt = Math.min((ms - last) / 1000, 0.04);
      last = ms;
      t += dt;
      const { fish, theme, decor, quality } = latest.current;
      const water = c.createLinearGradient(0, 0, 0, h);
      water.addColorStop(
        0,
        theme === "midnight"
          ? "#102645"
          : theme === "coral"
            ? "#24646c"
            : "#15788a",
      );
      water.addColorStop(0.48, "#064957");
      water.addColorStop(1, "#03242f");
      c.fillStyle = water;
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = `rgba(155,255,228,${0.028 + Math.sin(t * 0.3 + i) * 0.01})`;
        c.beginPath();
        const a = w * (i * 0.22 - 0.2) + Math.sin(t * 0.16 + i) * 35;
        c.moveTo(a, 0);
        c.lineTo(a + 70, 0);
        c.lineTo(a + 370, h);
        c.lineTo(a + 100, h);
        c.fill();
      }
      c.fillStyle = "#184a4b";
      c.beginPath();
      c.moveTo(0, h);
      for (let i = 0; i <= 20; i++)
        c.lineTo((i * w) / 20, h - 40 - Math.sin(i * 0.8) * 12);
      c.lineTo(w, h);
      c.fill();
      if (decor !== "minimal") {
        for (let i = 0; i < 26; i++) {
          const x = (i * 83.79) % w,
            ph = 45 + ((i * 47) % 135);
          for (let j = 0; j < 3; j++) {
            c.strokeStyle = ["#226f60", "#278d73", "#3b9e80"][j];
            c.lineWidth = 3 + j * 2;
            c.beginPath();
            c.moveTo(x + j * 8, h - 20);
            c.bezierCurveTo(
              x - 25 + Math.sin(t + i) * 8,
              h - ph * 0.4,
              x + 25,
              h - ph * 0.7,
              x + Math.sin(t * 0.8 + i) * 15,
              h - ph,
            );
            c.stroke();
          }
        }
      }
      for (let i = 0; i < 7; i++) {
        const x = (i * 193 + 60) % w;
        c.fillStyle = i % 2 ? "#183f43" : "#24575a";
        c.beginPath();
        c.ellipse(x, h - 27, 30 + (i % 3) * 13, 16 + (i % 3) * 9, -0.2, 0, 7);
        c.fill();
      }
      if (decor === "ruins") {
        c.fillStyle = "#567c79";
        for (let i = 0; i < 3; i++)
          c.fillRect(w * 0.65 + i * 35, h - 140, 19, 112);
        c.fillRect(w * 0.65 - 10, h - 152, 110, 18);
      }
      world.current = fish.map((f, i) => {
        let old = world.current.find((x) => x.id === f.id);
        if (!old)
          old = {
            id: f.id,
            x: w * (0.15 + ((i * 0.177) % 0.7)),
            y: h * (0.2 + ((i * 0.223) % 0.5)),
            dir: i % 2 ? 1 : -1,
            phase: i * 1.72,
            turn: i % 2 ? 1 : -1,
          };
        const speed = 16 + f.dna.proportion * 25;
        old.turn += (old.dir - old.turn) * Math.min(1, dt * 3);
        const idle = 0.7 + Math.sin(t * 0.3 + old.phase) * 0.3;
        old.x += old.dir * speed * idle * dt;
        const margin = 75;
        if (old.x > w - margin) old.dir = -1;
        if (old.x < margin) old.dir = 1;
        old.y =
          h * (0.19 + ((i * 0.173) % 0.52)) +
          Math.sin(t * 0.6 + old.phase) * 20;
        old.f = f;
        return old;
      });
      for (const a of [...world.current].sort((a, b) => a.y - b.y)) {
        const scale = 0.45 + 0.55 * (a.f.growth || 0);
        drawFish(
          c,
          a.f,
          a.x,
          a.y,
          (36 + a.f.dna.maxSize * 17) * scale,
          a.turn,
          t,
        );
      }
      const n = quality === "low" ? 12 : 42;
      for (let i = 0; i < n; i++) {
        const x = (i * 131.7 + Math.sin(t * 0.5 + i) * 10) % w,
          y = h - ((t * (8 + (i % 5)) + i * 37) % h);
        c.strokeStyle = `rgba(181,243,234,${0.1 + (i % 3) * 0.08})`;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(x, y, 1 + (i % 4), 0, 7);
        c.stroke();
      }
      frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);
    const click = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left,
        y = e.clientY - r.top;
      const hit = [...world.current]
        .reverse()
        .find((f) => Math.hypot(x - f.x, y - f.y) < 58);
      if (hit) latest.current.onSelect(hit.f);
    };
    canvas.addEventListener("click", click);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      canvas.removeEventListener("click", click);
    };
  }, []);
  return (
    <canvas
      ref={ref}
      className="aquarium-canvas"
      aria-label="Living aquarium with swimming procedural fish"
    />
  );
}

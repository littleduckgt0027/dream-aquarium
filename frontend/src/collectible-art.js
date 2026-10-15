import { definition } from "../../shared/collectibles.js";
// Original vector artwork, drawn in local coordinates. No third-party assets.
export function decoration(c, instance, w, h, time = 0, reduced = false) {
  const d = definition(instance.definition_id);
  if (!d) return;
  c.save();
  c.translate(instance.x * w, instance.y * h);
  c.rotate((instance.rotation * Math.PI) / 180);
  c.scale(instance.scale, instance.scale);
  c.fillStyle = `hsl(${d.hue} 45% ${35 + d.rarity * 3}%)`;
  c.strokeStyle = `hsl(${d.hue + 25} 80% 75%)`;
  c.lineWidth = 2;
  if (d.rarity >= 4 && !reduced) {
    c.shadowColor = c.strokeStyle;
    c.shadowBlur = 10 + Math.sin(time) * 3;
  }
  const path = (points) => {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
    c.stroke();
  };
  switch (d.motif) {
    case "pebble":
    case "crystal":
      for (let i = 0; i < (d.motif === "crystal" ? 5 : 3); i++) {
        const x = (i - 2) * 16;
        path([
          [x - 16, 0],
          [x - 10, -20 - (i % 3) * 15],
          [x, -40 - (i % 3) * 13],
          [x + 15, -15],
          [x + 17, 0],
        ]);
      }
      break;
    case "reed":
    case "fern":
    case "coral":
      for (let i = 0; i < 7; i++) {
        c.beginPath();
        c.moveTo((i - 3) * 8, 0);
        c.bezierCurveTo(
          i * 5 - 20,
          -20,
          Math.sin(i + time * 0.3) * 15,
          -40,
          (i - 3) * 14,
          -45 - (i % 3) * 16,
        );
        c.lineWidth = d.motif === "coral" ? 8 : 4;
        c.stroke();
        if (d.motif === "fern") {
          for (let j = 1; j < 4; j++) {
            c.beginPath();
            c.ellipse((i - 3) * 10, -j * 16, 12, 4, -0.5, 0, 7);
            c.fill();
          }
        }
      }
      break;
    case "chest":
      c.fillRect(-36, -30, 72, 32);
      c.fillRect(-36, -47, 72, 14);
      c.strokeRect(-36, -47, 72, 49);
      c.fillStyle = "#ffd585";
      c.fillRect(-5, -35, 10, 12);
      break;
    case "arch":
    case "portal":
      c.lineWidth = d.motif === "portal" ? 9 : 17;
      c.beginPath();
      c.arc(0, -25, 38, Math.PI, 0);
      c.moveTo(-38, -25);
      c.lineTo(-38, 0);
      c.moveTo(38, -25);
      c.lineTo(38, 0);
      c.stroke();
      if (d.motif === "portal") {
        c.globalAlpha = 0.4;
        c.fillStyle = "#b9eaff";
        c.beginPath();
        c.ellipse(0, -25, 23, 32, 0, 0, 7);
        c.fill();
      }
      break;
    case "wreck":
      path([
        [-70, -30],
        [65, -30],
        [40, 0],
        [-40, 0],
      ]);
      c.fillRect(-3, -95, 6, 65);
      path([
        [4, -90],
        [48, -43],
        [4, -43],
      ]);
      break;
    case "statue":
    case "dragon":
    case "relic":
      c.fillRect(-26, -12, 52, 12);
      c.beginPath();
      c.ellipse(0, -40, 18, 28, 0, 0, 7);
      c.fill();
      c.beginPath();
      c.arc(0, -76, 14, 0, 7);
      c.fill();
      if (d.motif === "dragon") {
        path([
          [-10, -55],
          [-55, -84],
          [-35, -25],
        ]);
        path([
          [10, -55],
          [55, -84],
          [35, -25],
        ]);
      }
      if (d.motif === "relic") {
        c.strokeRect(-30, -95, 60, 82);
      }
      break;
    case "castle":
    case "throne":
      for (let i = -1; i <= 1; i++) {
        c.fillRect(
          i * 31 - 14,
          -55 - (i === 0 ? 25 : 0),
          28,
          55 + (i === 0 ? 25 : 0),
        );
        for (let j = 0; j < 3; j++)
          c.fillRect(i * 31 - 14 + j * 10, -62 - (i === 0 ? 25 : 0), 6, 10);
      }
      c.fillStyle = "#082e40";
      c.fillRect(-8, -24, 16, 24);
      break;
  }
  c.restore();
}
export function background(c, item, w, h, t = 0, reduced = false) {
  const d = definition(item.definition_id);
  if (!d) return;
  const motifs = [
    "lagoon",
    "sandbank",
    "reef",
    "kelp",
    "cave",
    "trench",
    "temple",
    "grotto",
    "city",
    "aurora",
    "nebula",
    "abyss",
    "cosmos",
    "elysium",
  ];
  const i = motifs.indexOf(d.motif),
    hue = [
      184, 193, 196, 172, 218, 209, 202, 228, 214, 174, 234, 241, 250, 197,
    ][i];
  const g = c.createLinearGradient(0, 0, w * 0.2, h);
  g.addColorStop(0, `hsl(${hue} 62% ${i >= 10 ? 18 : 31}%)`);
  g.addColorStop(0.6, `hsl(${hue + 8} 65% 14%)`);
  g.addColorStop(1, `hsl(${hue + 14} 70% 5%)`);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.save();
  c.fillStyle = `hsla(${hue + 10},45%,30%,.45)`;
  for (let layer = 0; layer < 3; layer++) {
    c.globalAlpha = 0.3 + layer * 0.15;
    c.beginPath();
    c.moveTo(0, h);
    for (let j = 0; j <= 30; j++)
      c.lineTo(
        (j * w) / 30,
        h * (0.68 + layer * 0.1) - Math.sin(j * 0.4 + i + layer) * h * 0.06,
      );
    c.lineTo(w, h);
    c.fill();
  }
  c.globalAlpha = 0.32;
  c.strokeStyle = `hsl(${hue - 10} 45% 48%)`;
  if (["reef", "kelp", "lagoon", "elysium"].includes(d.motif)) {
    for (let j = 0; j < 10; j++) {
      const x = (j * w) / 9;
      c.lineWidth = d.motif === "reef" ? 8 : 4;
      c.beginPath();
      c.moveTo(x, h);
      c.bezierCurveTo(
        x - 25,
        h * 0.8,
        x + 30,
        h * 0.7,
        x + Math.sin(j) * 30,
        h * (0.5 + (j % 3) * 0.08),
      );
      c.stroke();
      if (d.motif === "reef") {
        for (let k = 0; k < 3; k++) {
          c.beginPath();
          c.moveTo(x, h * (0.75 + k * 0.05));
          c.lineTo(x + 25 * (k % 2 ? 1 : -1), h * (0.65 + k * 0.05));
          c.stroke();
        }
      }
    }
  } else if (["temple", "city"].includes(d.motif)) {
    for (let j = 0; j < 7; j++) {
      const x = w * (0.12 + j * 0.13),
        top = h * (0.42 + (j % 3) * 0.1);
      c.fillRect(x, top, w * 0.025, h - top);
      c.fillRect(x - w * 0.015, top - h * 0.02, w * 0.055, h * 0.025);
      if (d.motif === "city")
        c.fillRect(x + w * 0.035, top + h * 0.1, w * 0.05, h);
    }
    c.fillRect(w * 0.1, h * 0.4, w * 0.8, h * 0.018);
  } else if (["cave", "grotto", "trench", "abyss"].includes(d.motif)) {
    c.fillStyle = "#02121bcc";
    for (const side of [0, 1]) {
      c.beginPath();
      c.moveTo(side * w, 0);
      c.lineTo(side * w, h);
      c.lineTo((side ? 0.75 : 0.25) * w, h);
      c.bezierCurveTo(
        (side ? 0.94 : 0.06) * w,
        h * 0.62,
        (side ? 0.68 : 0.32) * w,
        h * 0.3,
        (side ? 0.85 : 0.15) * w,
        0,
      );
      c.closePath();
      c.fill();
    }
    if (["cave", "grotto"].includes(d.motif)) {
      c.beginPath();
      c.moveTo(0, 0);
      for (let j = 0; j <= 20; j++)
        c.lineTo((j * w) / 20, h * (0.12 + Math.sin(j * 1.3) * 0.08));
      c.lineTo(w, 0);
      c.fill();
    }
  } else if (["cosmos", "nebula", "aurora"].includes(d.motif)) {
    c.globalAlpha = 0.13;
    c.lineWidth = w * 0.035;
    for (let j = 0; j < 3; j++) {
      c.strokeStyle = `hsl(${hue + j * 35} 90% 70%)`;
      c.beginPath();
      c.moveTo(-w * 0.1, h * (0.2 + j * 0.1));
      c.bezierCurveTo(
        w * 0.3,
        h * 0.6,
        w * 0.6,
        -h * 0.2,
        w * 1.1,
        h * (0.2 + j * 0.1),
      );
      c.stroke();
    }
  }
  if (d.motif === "sandbank") {
    c.globalAlpha = 0.18;
    c.strokeStyle = "#ffdda0";
    c.lineWidth = 1;
    for (let j = 0; j < 8; j++) {
      c.beginPath();
      c.ellipse(
        w * 0.5,
        h * (0.78 + j * 0.025),
        w * 0.45,
        h * 0.03,
        0,
        Math.PI,
        Math.PI * 2,
      );
      c.stroke();
    }
  }
  if (d.rarity >= 4) {
    c.globalAlpha = 0.25;
    c.fillStyle = "#b9fff5";
    for (let j = 0; j < 16; j++) {
      c.beginPath();
      c.arc(
        (((j * 131) % 1000) / 1000) * w,
        (((j * 97) % 700) / 700) * h,
        1 + (!reduced ? Math.sin(t * 0.3 + j) + 1 : 1),
        0,
        7,
      );
      c.fill();
    }
  }
  c.restore();
}
// Called inside drawFish's existing translation/direction/growth transform.
export function accessories(c, items, time = 0, reduced = false) {
  for (const item of items || []) {
    const d = definition(item.definition_id);
    if (!d) continue;
    c.save();
    c.fillStyle = `hsl(${d.hue} 80% 65%)`;
    c.strokeStyle = "#e4ffef";
    c.lineWidth = 1.5;
    if (d.rarity >= 4 && !reduced) {
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 6;
    }
    const y = d.slot === "head" ? -21 : d.slot === "face" ? -3 : 10,
      x = d.slot === "face" ? 19 : 0;
    c.translate(x, y);
    c.beginPath();
    switch (d.motif) {
      case "glasses":
      case "mask":
        c.ellipse(-3, 0, 7, 5, 0, 0, 7);
        c.ellipse(9, 0, 7, 5, 0, 0, 7);
        c.stroke();
        break;
      case "halo":
      case "galaxy":
        c.ellipse(0, -4, 24, 6, -0.1, 0, 7);
        c.stroke();
        if (d.motif === "galaxy") {
          for (let i = 0; i < 5; i++) {
            c.beginPath();
            c.arc(Math.cos(i * 1.3) * 22, Math.sin(i * 1.3) * 6 - 4, 2, 0, 7);
            c.fill();
          }
        }
        break;
      case "crown":
      case "antlers":
      case "comet":
        c.moveTo(-18, 0);
        c.lineTo(-22, -18);
        c.lineTo(-8, -8);
        c.lineTo(0, -25);
        c.lineTo(8, -8);
        c.lineTo(22, -18);
        c.lineTo(18, 0);
        c.closePath();
        c.fill();
        c.stroke();
        break;
      case "bow":
      case "ribbon":
      case "wings":
        for (const dir of [-1, 1]) {
          c.moveTo(0, 0);
          c.lineTo(dir * 22, -12);
          c.lineTo(dir * 18, 13);
          c.closePath();
        }
        c.fill();
        c.stroke();
        break;
      case "necklace":
        c.arc(0, -4, 16, 0, Math.PI);
        c.stroke();
        c.beginPath();
        c.arc(0, 12, 4, 0, 7);
        c.fill();
        break;
      case "armor":
        c.moveTo(-18, -15);
        c.lineTo(18, -15);
        c.lineTo(14, 10);
        c.lineTo(0, 20);
        c.lineTo(-14, 10);
        c.closePath();
        c.fill();
        c.stroke();
        break;
      default:
        c.rect(-20, -8, 40, 10);
        c.rect(-13, -22, 26, 15);
        c.fill();
        c.stroke();
        break;
    }
    c.restore();
  }
}

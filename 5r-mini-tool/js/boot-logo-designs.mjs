// Boot-logo visual designs. Pure canvas drawing, no framework dependency so it
// can be unit-rendered in isolation. Targets are tiny (160x128 / 128x128) and
// RGB565, so designs lean on bold shapes and high contrast over fine detail.

export const LOGO_DESIGNS = [
  { key: "signal", name: "Signal", colors: ["#03120a", "#064e3b"], title: "#ecfdf5", subtitle: "#86efac", accent: "#22c55e" },
  { key: "army", name: "Army", colors: ["#2e3b1f", "#2e3b1f"], title: "#fef3c7", subtitle: "#d9f99d", accent: "#d9f99d" },
  { key: "fun", name: "Fun", colors: ["#2d0a31", "#0e7490"], title: "#fff7ed", subtitle: "#fef08a", accent: "#fb7185" },
  { key: "clean", name: "Clean", colors: ["#0b0e13", "#0b0e13"], title: "#f8fafc", subtitle: "#cbd5e1", accent: "#ffb000" },
  { key: "nokia", name: "Nokia", colors: ["#c7f0d8", "#c7f0d8"], title: "#43523d", subtitle: "#43523d", accent: "#43523d" },
  { key: "forest", name: "Forest Outdoor", colors: ["#16310f", "#3f6f2a"], title: "#f0fdf4", subtitle: "#d9f99d", accent: "#bef264" },
  { key: "serious", name: "Serious", colors: ["#050505", "#27272a"], title: "#ffffff", subtitle: "#d4d4d8", accent: "#71717a" },
  { key: "hunt", name: "Hunting", colors: ["#0e1f18", "#16271b"], title: "#f3ecd2", subtitle: "#e0bf78", accent: "#e8a33d" },
  { key: "custom", name: "Custom", colors: ["#0b0e13", "#0b0e13"], title: "#f8fafc", subtitle: "#cbd5e1", accent: "#ffb000" }
];

export function getLogoDesign(key) {
  return LOGO_DESIGNS.find((design) => design.key === key) || LOGO_DESIGNS[0];
}

export function drawLogoDesign(ctx, target, design, title, subtitle, glyph) {
  const width = target.width;
  const height = target.height;
  fillGradient(ctx, 0, 0, width, height, design.colors[0], design.colors[1]);
  ctx.save();
  if (design.key === "serious") {
    drawSeriousMark(ctx, width, height, design);
  } else if (design.key === "signal") {
    ctx.strokeStyle = design.accent;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(width - 18, 18, 12 + i * 10, Math.PI * 0.9, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(34,197,94,0.20)";
    ctx.fillRect(0, height - 18, width, 18);
  } else if (design.key === "army") {
    drawArmyCamo(ctx, width, height, design);
  } else if (design.key === "fun") {
    drawFunScene(ctx, width, height);
  } else if (design.key === "clean") {
    drawCleanSignal(ctx, width, height, design);
  } else if (design.key === "nokia") {
    drawNokiaLcd(ctx, width, height);
  } else if (design.key === "forest") {
    drawForestScene(ctx, width, height, design);
  } else if (design.key === "hunt") {
    drawHuntScene(ctx, width, height);
  } else if (design.key === "custom") {
    drawCustomGlyph(ctx, width, height, glyph, design);
  } else {
    ctx.strokeStyle = design.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, width - 10, height - 10);
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.strokeRect(11, 11, width - 22, height - 22);
  }
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (design.key === "army") {
    ctx.fillStyle = "rgba(20,24,13,0.8)";
    drawFittedText(ctx, title, width / 2 + 1, height * 0.71 + 1, width - 22, 22, 20, "700");
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.71, width - 22, 22, 20, "700");
    if (subtitle) {
      ctx.fillStyle = "rgba(20,24,13,0.8)";
      drawFittedText(ctx, subtitle, width / 2 + 1, height * 0.86 + 1, width - 34, 14, 11, "700");
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, subtitle, width / 2, height * 0.86, width - 34, 14, 11, "700");
    }
  } else if (design.key === "clean" || design.key === "custom") {
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.61, width - 20, 25, 22, "700");
    if (subtitle) {
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, subtitle, width / 2, height * 0.78, width - 34, 15, 11, "500");
    }
  } else if (design.key === "nokia") {
    ctx.fillStyle = "#a7c4ad";
    drawFittedText(ctx, title, width / 2 + 1, height * 0.73 + 1, width - 20, 24, 20, "700");
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.73, width - 20, 24, 20, "700");
    if (subtitle) {
      const statusText = subtitle.toUpperCase();
      ctx.fillStyle = "#a7c4ad";
      drawFittedText(ctx, statusText, width / 2 + 1, height * 0.88 + 1, width - 28, 14, 10, "700");
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, statusText, width / 2, height * 0.88, width - 28, 14, 10, "700");
    }
  } else if (design.key === "hunt") {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    drawFittedText(ctx, title, width / 2 + 1, height * 0.76 + 1, width - 18, 24, 22, "700");
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.76, width - 18, 24, 22, "700");
    if (subtitle) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      drawFittedText(ctx, subtitle, width / 2 + 1, height * 0.9 + 1, width - 28, 15, 12, "600");
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, subtitle, width / 2, height * 0.9, width - 28, 15, 12, "600");
    }
  } else if (design.key === "forest") {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    drawFittedText(ctx, title, width / 2 + 1, height * 0.44 + 1, width - 18, 30, 24, "700");
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.44, width - 18, 30, 24, "700");
    if (subtitle) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      drawFittedText(ctx, subtitle, width / 2 + 1, height * 0.6 + 1, width - 24, 18, 14, "600");
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, subtitle, width / 2, height * 0.6, width - 24, 18, 14, "600");
    }
  } else {
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.42, width - 16, 32, 26, "700");
    if (subtitle) {
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, subtitle, width / 2, height * 0.64, width - 24, 20, 15, "500");
    }
  }
}

function fillGradient(ctx, x, y, width, height, start, end) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, start);
  gradient.addColorStop(1, end);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

// ---- Serious: minimal, just a thin accent rule under the wordmark ----------
function drawSeriousMark(ctx, width, height, design) {
  ctx.strokeStyle = design.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width * 0.3, height * 0.55);
  ctx.lineTo(width * 0.7, height * 0.55);
  ctx.stroke();
}

// ---- Army: clean camo + a crisp military star badge ------------------------
function drawArmyCamo(ctx, width, height, design) {
  ctx.fillStyle = "#3a4a26";
  ctx.fillRect(0, 0, width, height);
  // Angular, hard-edged blotches read as proper DPM camo (no rounded blobs).
  drawCamoPatch(ctx, "#55672f", width * 0.26, height * 0.2, width * 0.4, height * 0.34, 0.2);
  drawCamoPatch(ctx, "#8a7c4e", width * 0.8, height * 0.18, width * 0.38, height * 0.32, -0.5);
  drawCamoPatch(ctx, "#242d15", width * 0.18, height * 0.74, width * 0.44, height * 0.4, 0.8);
  drawCamoPatch(ctx, "#6b7c3c", width * 0.82, height * 0.76, width * 0.42, height * 0.36, -0.3);
  drawCamoPatch(ctx, "#8a7c4e", width * 0.5, height * 0.52, width * 0.34, height * 0.3, 1.2);
  drawCamoPatch(ctx, "#242d15", width * 1.02, height * 0.5, width * 0.3, height * 0.34, 0.4);
  // Star badge centred above the wordmark.
  const cx = width / 2;
  const cy = height * 0.33;
  const outer = Math.min(width, height) * 0.18;
  ctx.fillStyle = "rgba(20,24,13,0.45)";
  ctx.beginPath();
  ctx.arc(cx, cy, outer * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(20,24,13,0.85)";
  drawStar(ctx, cx, cy, 5, outer + 2, (outer + 2) * 0.42);
  ctx.fillStyle = design.accent;
  drawStar(ctx, cx, cy, 5, outer, outer * 0.42);
  // Darken the lower band so the camo never fights the text.
  const fade = ctx.createLinearGradient(0, height * 0.55, 0, height);
  fade.addColorStop(0, "rgba(20,24,13,0)");
  fade.addColorStop(1, "rgba(20,24,13,0.55)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);
}

function drawStar(ctx, cx, cy, points, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// Hard-edged irregular polygon (jagged camo blotch) — no rounded curves.
const CAMO_SHAPE = [
  [1.05, -0.1], [0.5, -0.35], [0.65, -0.82], [0.12, -0.6], [-0.22, -0.98],
  [-0.45, -0.45], [-0.98, -0.32], [-0.62, 0.12], [-0.95, 0.6], [-0.32, 0.5],
  [-0.08, 0.96], [0.3, 0.52], [0.88, 0.7], [0.58, 0.18],
];
function drawCamoPatch(ctx, color, cx, cy, rx, ry, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  CAMO_SHAPE.forEach((p, i) => {
    const px = p[0] * rx;
    const py = p[1] * ry;
    const x = cx + px * c - py * s;
    const y = cy + px * s + py * c;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

// ---- Fun: sunburst + balanced confetti, center kept clear for text ---------
function drawFunScene(ctx, width, height) {
  const cx = width / 2;
  const cy = height * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 16; i += 1) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(254,240,138,0.09)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, -10);
    ctx.lineTo(width, 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const cols = ["#fde047", "#fb7185", "#22d3ee", "#a78bfa", "#fff7ed"];
  const dots = [
    [0.1, 0.1], [0.28, 0.07], [0.46, 0.13], [0.64, 0.07], [0.82, 0.12], [0.93, 0.2], [0.06, 0.22],
    [0.12, 0.86], [0.3, 0.9], [0.5, 0.84], [0.7, 0.9], [0.88, 0.85], [0.95, 0.74], [0.05, 0.72]
  ];
  const s = Math.max(4, width * 0.03);
  dots.forEach((d, i) => {
    const x = width * d[0];
    const y = height * d[1];
    ctx.fillStyle = cols[i % cols.length];
    if (i % 3 === 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(i);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    } else if (i % 3 === 1) {
      ctx.beginPath();
      ctx.arc(x, y, s / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(i);
      ctx.beginPath();
      ctx.moveTo(0, -s / 2);
      ctx.lineTo(s / 2, s / 2);
      ctx.lineTo(-s / 2, s / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });
}

// ---- Clean: minimal amber signal mark --------------------------------------
function drawCleanSignal(ctx, width, height, design) {
  const cx = width / 2;
  const cy = height * 0.33;
  ctx.fillStyle = design.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = design.accent;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, 12 + i * 11, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();
  }
}

// ---- Forest: layered ridges, sun glow, pine treeline -----------------------
function drawForestScene(ctx, width, height, design) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#0c2b30");
  sky.addColorStop(0.5, "#16401f");
  sky.addColorStop(1, "#225c2b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const sun = ctx.createRadialGradient(width * 0.8, height * 0.2, 2, width * 0.8, height * 0.2, width * 0.4);
  sun.addColorStop(0, "rgba(190,242,100,0.5)");
  sun.addColorStop(1, "rgba(190,242,100,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#e9ffc7";
  ctx.beginPath();
  ctx.arc(width * 0.8, height * 0.2, Math.max(5, width * 0.045), 0, Math.PI * 2);
  ctx.fill();
  drawRidge(ctx, width, height, height * 0.64, height * 0.1, "#1d4a24", 0.6);
  drawRidge(ctx, width, height, height * 0.73, height * 0.08, "#103618", 1.7);
  drawPineRow(ctx, width, height, height * 0.99, "#06180a", 8, height * 0.26);
}

function drawRidge(ctx, width, height, baseY, amp, color, phase) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, baseY);
  const steps = 8;
  for (let i = 0; i <= steps; i += 1) {
    const x = (width * i) / steps;
    const y = baseY - Math.sin(i * 0.9 + phase) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
}

function drawPineRow(ctx, width, height, baseY, color, count, treeH) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const cx = (i + 0.5) * (width / count);
    const h = treeH * (0.78 + (i % 3) * 0.12);
    const w = (width / count) * 0.46;
    for (let t = 0; t < 3; t += 1) {
      const ty = baseY - h * (t * 0.26);
      const tw = w * (1 - t * 0.22);
      const th = h * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, ty - th);
      ctx.lineTo(cx - tw, ty);
      ctx.lineTo(cx + tw, ty);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ---- Custom: a plain dark backdrop with a user-supplied emoji or text as the
// "logo", drawn large and centred above the wordmark. Type anything in the
// Symbol field — an emoji, a call-sign, a glyph — and it becomes the mark.
function drawCustomGlyph(ctx, width, height, glyph, design) {
  const mark = (glyph || "").trim();
  if (!mark) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Emoji render in their own colour; plain text picks up the design title hue.
  ctx.fillStyle = design.title;
  drawFittedText(ctx, mark, width / 2, height * 0.32, width - 24, height * 0.42, 72, "700");
}

// Render an emoji/glyph as a solid single-colour silhouette — a reliable way
// to get a recognisable icon (deer, hands) at tiny sizes where hand-drawn
// paths read as blobs.
function drawGlyphSilhouette(ctx, glyph, cx, cy, size, color) {
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const o = off.getContext("2d");
  o.font = `${Math.round(size * 0.84)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Noto Emoji",sans-serif`;
  o.textAlign = "center";
  o.textBaseline = "middle";
  o.fillText(glyph, size / 2, size / 2);
  o.globalCompositeOperation = "source-in";
  o.fillStyle = color;
  o.fillRect(0, 0, size, size);
  ctx.drawImage(off, Math.round(cx - size / 2), Math.round(cy - size / 2));
}

// ---- Hunting: a stag silhouette (antlers + head) on a backlit forest -----
function drawHuntScene(ctx, width, height) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#0e1f18");
  bg.addColorStop(1, "#16271b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width / 2, height * 0.32, 2, width / 2, height * 0.32, width * 0.46);
  glow.addColorStop(0, "rgba(232,163,61,0.35)");
  glow.addColorStop(0.6, "rgba(176,108,40,0.12)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  const s = Math.min(width, height) * 0.62;
  drawGlyphSilhouette(ctx, "\u{1F98C}", width / 2, height * 0.36, s, "#ece3c8");
}

// ---- Nokia: authentic 3310 LCD palette + the "Connecting People" hands ------
// Two pointing hands reach toward each other over an ordered-dither background
// — the original mono boot screen, in #c7f0d8 / #43523d.
function drawNokiaLcd(ctx, width, height) {
  const light = "#c7f0d8";
  const ink = "#43523d";
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);
  // Bayer 4x4 ordered dither, denser up top and clearing toward the wordmark.
  const cell = Math.max(1, Math.round(width / 84));
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bandH = height * 0.62;
  ctx.fillStyle = ink;
  for (let y = 0; y < bandH; y += cell) {
    const threshold = Math.round(8 * (1 - y / bandH));
    const by = ((y / cell) % 4 + 4) % 4;
    for (let x = 0; x < width; x += cell) {
      const bx = ((x / cell) % 4 + 4) % 4;
      if (bayer[by * 4 + bx] < threshold) ctx.fillRect(x, y, cell, cell);
    }
  }
  // Two open hands reaching toward each other, fingertips almost touching at
  // centre — the original "Connecting People" graphic. A light halo clears the
  // dither behind each hand, then the ink silhouette sits on top.
  const s = width * 0.54;
  const y = height * 0.34;
  drawGlyphSilhouette(ctx, "\u{1FAF1}", width * 0.25, y, s * 1.08, light);
  drawGlyphSilhouette(ctx, "\u{1FAF2}", width * 0.75, y, s * 1.08, light);
  drawGlyphSilhouette(ctx, "\u{1FAF1}", width * 0.25, y, s, ink);
  drawGlyphSilhouette(ctx, "\u{1FAF2}", width * 0.75, y, s, ink);
}

function drawFittedText(ctx, text, x, y, maxWidth, maxHeight, startSize, weight) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    if (ctx.measureText(text).width <= maxWidth && size <= maxHeight) break;
    size -= 1;
  } while (size > 7);
  ctx.fillText(text, x, y);
}

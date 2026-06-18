import { html, useEffect, useRef, useState } from "./preact.mjs?v=ani-sync";
import { sleep, toHex } from "./format.mjs?v=ani-sync";

const CHUNK = 1024;
const STORAGE_KEY = "baofeng-uv5r-mini-boot-logo";
const IMAGE_ADDR = 0x000c0000;
const CONFIG_BLOCKS = 1;
const CMD_PROGRAM = 0x02;
const CMD_SET_ADDRESS = 0x03;
const CMD_CONFIG = 0x04;
const CMD_DATA = 0x57;
const CMD_OVER = 0x06;
const BOOT_TARGETS = [
  { key: "uv5rmA5", name: "UV-5R Mini", handshake: "PROGRAMBFNORMALU", width: 160, height: 128, defaultFormat: "rgb565le", crop: false, delay: 200 },
  { key: "miniColor", name: "UV-5R Mini Color", handshake: "PROGRAMCOLORPROU", width: 128, height: 128, defaultFormat: "rgb565le", crop: true, delay: 500 }
];
const LOGO_DESIGNS = [
  { key: "signal", name: "Signal", colors: ["#03120a", "#064e3b"], title: "#ecfdf5", subtitle: "#86efac", accent: "#22c55e" },
  { key: "army", name: "Army", colors: ["#2e3b1f", "#2e3b1f"], title: "#fef3c7", subtitle: "#d9f99d", accent: "#14180d" },
  { key: "fun", name: "Fun", colors: ["#2d0a31", "#0e7490"], title: "#fff7ed", subtitle: "#fef08a", accent: "#fb7185" },
  { key: "clean", name: "Clean", colors: ["#0b0e13", "#0b0e13"], title: "#f8fafc", subtitle: "#cbd5e1", accent: "#ffb000" },
  { key: "nokia", name: "Nokia", colors: ["#9fb66a", "#c6d68f"], title: "#10230d", subtitle: "#244216", accent: "#10230d" },
  { key: "forest", name: "Forest Outdoor", colors: ["#16310f", "#3f6f2a"], title: "#f0fdf4", subtitle: "#bbf7d0", accent: "#84cc16" },
  { key: "fire", name: "Firefighter", colors: ["#1a1a1d", "#7f1d1d"], title: "#fff7ed", subtitle: "#fed7aa", accent: "#f97316" },
  { key: "serious", name: "Serious", colors: ["#050505", "#27272a"], title: "#ffffff", subtitle: "#d4d4d8", accent: "#71717a" }
];

function getBootTarget(key) {
  return BOOT_TARGETS.find((target) => target.key === key) || BOOT_TARGETS[0];
}

function getLogoDesign(key) {
  return LOGO_DESIGNS.find((design) => design.key === key) || LOGO_DESIGNS[0];
}

function loadBootLogoPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveBootLogoPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures; rendering should still work.
  }
}

export function buildBootPacket(cmd, packageId, payload) {
  const header = Uint8Array.from([0xa5, cmd & 0xff, (packageId >> 8) & 0xff, packageId & 0xff, (payload.length >> 8) & 0xff, payload.length & 0xff]);
  const crc = crc16CcittZero([...header.slice(1), ...payload]);
  return Uint8Array.from([...header, ...payload, (crc >> 8) & 0xff, crc & 0xff]);
}

export function parseBootPacket(bytes) {
  if (bytes.length < 8) throw new Error(`Boot response too short: ${toHex(bytes)}`);
  if (bytes[0] !== 0xa5) throw new Error(`Boot response expected A5, got ${toHex(bytes)}`);
  const length = (bytes[4] << 8) | bytes[5];
  const need = 6 + length + 2;
  if (bytes.length < need) throw new Error(`Boot response incomplete: have ${bytes.length}, need ${need}`);
  const payload = bytes.slice(6, 6 + length);
  const rxCrc = (bytes[6 + length] << 8) | bytes[7 + length];
  const calcCrc = crc16CcittZero([...bytes.slice(1, 6), ...payload]);
  if (rxCrc !== calcCrc) throw new Error(`Boot response CRC mismatch: got ${rxCrc.toString(16)}, expected ${calcCrc.toString(16)}`);
  return payload;
}

export async function flashBootLogo({ transport, payload, target, log, setStatus, setProgress, stopRequested }) {
  const expectedLength = target.width * target.height * 2;
  if (payload.length !== expectedLength) throw new Error(`Boot logo payload must be ${expectedLength} bytes`);
  const total = payload.length / CHUNK;
  setProgress({ value: 0, max: total + 4, text: "Boot logo handshake" });
  transport.clearQueue();
  await transport.sendBytes(asciiBytes(target.handshake), { expect: [0x06], responseLength: 1, name: "boot pre-handshake", timeout: 3000, writeWithResponse: true });
  await transport.sendBytes([0x44], { expect: [], responseLength: 0, name: "boot enter", writeWithResponse: true });
  await sleep(target.delay);
  await sendBootCommand(transport, CMD_PROGRAM, 0, asciiBytes("PROGRAM"), "boot PROGRAM", log, { timeout: 2500 });
  setProgress({ value: 1, max: total + 4, text: "Boot logo config" });
  await sendBootCommand(transport, CMD_CONFIG, 0x4504, Uint8Array.from([...u32le(IMAGE_ADDR), (CONFIG_BLOCKS >> 8) & 0xff, CONFIG_BLOCKS & 0xff]), "boot CONFIG", log, { timeout: 15000 });
  setProgress({ value: 2, max: total + 4, text: "Boot logo set address" });
  await sendBootCommand(transport, CMD_SET_ADDRESS, 0, Uint8Array.from(u32le(IMAGE_ADDR)), "boot SET ADDRESS", log, { timeout: 4000 });
  for (let index = 0; index < total; index += 1) {
    if (stopRequested.current) throw new Error("Boot logo write stopped");
    const chunk = payload.slice(index * CHUNK, (index + 1) * CHUNK);
    await sendBootCommand(transport, CMD_DATA, index, chunk, `boot DATA ${index + 1}/${total}`, log, { timeout: 5000 });
    setProgress({ value: index + 3, max: total + 4, text: `Boot logo data ${index + 1}/${total}` });
  }
  await transport.sendBytes(buildBootPacket(CMD_OVER, 0, asciiBytes("Over")), { expect: [], responseLength: 0, name: "boot OVER", chunkSize: 20, chunkDelay: 20, writeWithResponse: true, compactLog: true, logChunks: true });
  setStatus("Boot logo write sent", "ok");
  setProgress({ value: total + 4, max: total + 4, text: "Boot logo write sent" });
}

export function BootLogoTab({ connected, busy, getTransport, setStatus, setProgress, stopRequested, log }) {
  const canvasRef = useRef(null);
  const pendingPreviewRef = useRef(null);
  const saved = loadBootLogoPrefs();
  const [bootTargetKey, setBootTargetKey] = useState(saved.bootTargetKey || "uv5rmA5");
  const [payload, setPayload] = useState(null);
  const [armed, setArmed] = useState(Boolean(saved.armed));
  const [fileName, setFileName] = useState("");
  const [logoText, setLogoText] = useState(saved.logoText || "BAOFENG");
  const [subText, setSubText] = useState(saved.subText || "UV-5R Mini");
  const [designKey, setDesignKey] = useState(saved.designKey || "signal");
  const [pixelFormat, setPixelFormat] = useState(saved.pixelFormat || "rgb565le");
  const [invertPixels, setInvertPixels] = useState(Boolean(saved.invertPixels));
  const [message, setMessage] = useState("Enter a radio name or choose an image to build a boot-logo payload.");
  const bootTarget = getBootTarget(bootTargetKey);

  useEffect(() => {
    saveBootLogoPrefs({ armed, bootTargetKey, designKey, invertPixels, logoText, pixelFormat, subText });
  }, [armed, bootTargetKey, designKey, invertPixels, logoText, pixelFormat, subText]);

  useEffect(() => {
    const pending = pendingPreviewRef.current;
    if (pending?.targetKey === bootTarget.key) {
      paintPayloadPreview(canvasRef.current, pending.payload, bootTarget, pending.format, pending.invert);
      pendingPreviewRef.current = null;
      return;
    }
    if (payload?.length === bootTarget.width * bootTarget.height * 2) {
      paintPayloadPreview(canvasRef.current, payload, bootTarget, pixelFormat, invertPixels);
      return;
    }
    renderTextLogo({ silent: true });
  }, [bootTargetKey]);

  async function loadImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = canvasRef.current;
      canvas.width = bootTarget.width;
      canvas.height = bootTarget.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, bootTarget.width, bootTarget.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (bootTarget.crop) {
        const side = Math.min(bitmap.width, bitmap.height);
        const sx = Math.floor((bitmap.width - side) / 2);
        const sy = Math.floor((bitmap.height - side) / 2);
        ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, bootTarget.width, bootTarget.height);
      } else {
        ctx.drawImage(bitmap, 0, 0, bootTarget.width, bootTarget.height);
      }
      const next = payloadFromCanvas(canvas, bootTarget, pixelFormat, invertPixels);
      setPayload(next);
      setFileName(file.name.replace(/\.[^.]+$/, ""));
      setMessage(`Prepared ${next.length} bytes from ${file.name} as ${pixelFormatLabel(pixelFormat, invertPixels)}.`);
      setStatus("Boot logo payload prepared", "ok");
    } catch (error) {
      setStatus(error.message, "err");
      setMessage(error.message);
    } finally {
      event.target.value = "";
    }
  }

  async function loadRawPayload(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const next = new Uint8Array(await file.arrayBuffer());
      const expectedLength = bootTarget.width * bootTarget.height * 2;
      if (next.length !== expectedLength) throw new Error(`Raw boot logo must be ${expectedLength} bytes for ${bootTarget.name}`);
      setPayload(next);
      setFileName(file.name.replace(/\.[^.]+$/, ""));
      paintPayloadPreview(canvasRef.current, next, bootTarget, pixelFormat, invertPixels);
      setMessage(`Loaded ${next.length} raw RGB565 bytes from ${file.name}.`);
      setStatus("Boot logo raw payload loaded", "ok");
    } catch (error) {
      setStatus(error.message, "err");
      setMessage(error.message);
    } finally {
      event.target.value = "";
    }
  }

  function renderTextLogo(options = {}) {
    const args = options && !options.currentTarget ? options : {};
    const { silent = false, target = bootTarget, format = pixelFormat, invert = invertPixels, designKey: selectedDesignKey = designKey } = args;
    const renderTarget = Number.isFinite(target?.width) && Number.isFinite(target?.height) ? target : bootTarget;
    const design = getLogoDesign(selectedDesignKey);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = renderTarget.width;
    canvas.height = renderTarget.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    drawLogoDesign(ctx, renderTarget, design, logoText.trim() || "BAOFENG", subText.trim());
    const next = payloadFromCanvas(canvas, renderTarget, format, invert);
    setPayload(next);
    setFileName((logoText.trim() || "radio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "radio");
    setMessage(`Rendered ${next.length} bytes with ${design.name} design for ${renderTarget.name}.`);
    if (!silent) setStatus("Boot logo text rendered", "ok");
  }

  function updateDesign(key) {
    setDesignKey(key);
    renderTextLogo({ designKey: key });
  }

  function renderColorBars() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = bootTarget.width;
    canvas.height = bootTarget.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const bars = ["#ffffff", "#ffff00", "#00ffff", "#00ff00", "#ff00ff", "#ff0000", "#0000ff", "#000000"];
    bars.forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.fillRect(index * (bootTarget.width / bars.length), 0, bootTarget.width / bars.length, bootTarget.height);
    });
    const next = payloadFromCanvas(canvas, bootTarget, pixelFormat, invertPixels);
    setPayload(next);
    setFileName("boot-color-bars");
    setMessage(`Rendered ${next.length} bytes from color bars as ${pixelFormatLabel(pixelFormat, invertPixels)}.`);
    setStatus("Boot logo color bars rendered", "ok");
  }

  function updateFormat(nextFormat, nextInvert = invertPixels) {
    setPixelFormat(nextFormat);
    setInvertPixels(nextInvert);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next = payloadFromCanvas(canvas, bootTarget, nextFormat, nextInvert);
    setPayload(next);
    setMessage(`Rebuilt ${next.length} bytes as ${pixelFormatLabel(nextFormat, nextInvert)}.`);
  }

  function updateBootTarget(key) {
    const nextTarget = getBootTarget(key);
    const nextFormat = nextTarget.defaultFormat;
    const nextInvert = false;
    const nextPayload = canvasRef.current ? resizePreviewPayload(canvasRef.current, nextTarget, nextFormat, nextInvert) : null;
    pendingPreviewRef.current = nextPayload ? { targetKey: nextTarget.key, payload: nextPayload, format: nextFormat, invert: nextInvert } : null;
    setBootTargetKey(nextTarget.key);
    setPixelFormat(nextFormat);
    setInvertPixels(nextInvert);
    if (nextPayload) {
      setPayload(nextPayload);
      setMessage(`Resized preview to ${nextTarget.width}x${nextTarget.height} for ${nextTarget.name}.`);
    }
  }

  function exportRaw() {
    if (!payload) return;
    downloadBlob(payload, `${fileName || "baofeng-uv-5r-mini-boot-logo"}.rgb565`, "application/octet-stream");
  }

  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => downloadBlob(blob, `${fileName || "baofeng-uv-5r-mini-boot-logo"}-preview.png`, "image/png"));
  }

  async function writeLogo() {
    if (!payload) return;
    if (!connected || busy) {
      setStatus("Connect radio first", "err");
      return;
    }
    if (!armed) {
      setStatus("Arm boot-logo write first", "err");
      return;
    }
    if (!confirm(`Boot-logo write will send ${payload.length} bytes using ${bootTarget.name}. Continue?`)) return;
    try {
      await flashBootLogo({ transport: getTransport(), payload, target: bootTarget, log, setStatus, setProgress, stopRequested });
    } catch (error) {
      setStatus(error.message, "err");
      log(`Boot logo write failed: ${error.message}`);
    } finally {
      await getTransport().disconnect?.();
    }
  }

  return html`<section>
    <h2>Boot Logo</h2>
    <div class="wizard">
      <div class="wizard-head"><div><h3>Custom startup image</h3><p>Prepares a boot-logo image and can send the separate boot-logo flash protocol. This is not normal channel memory writing.</p></div><span class="pill">${bootTarget.width}x${bootTarget.height}</span></div>
      <div class="boot-logo-layout">
        <div class="boot-logo-preview"><canvas ref=${canvasRef} width=${bootTarget.width} height=${bootTarget.height}></canvas></div>
        <div class="wizard-grid">
          <div class="wizard-step boot-text-tool"><strong>1. Make text logo</strong><p>Enter a radio name, choose a visual design, and render it into the preview.</p><label>Main text<input value=${logoText} maxlength="18" onInput=${(e) => setLogoText(e.target.value)} /></label><label>Small text<input value=${subText} maxlength="18" onInput=${(e) => setSubText(e.target.value)} /></label><label>Design<select value=${designKey} onChange=${(e) => updateDesign(e.target.value)}>${LOGO_DESIGNS.map((design) => html`<option value=${design.key}>${design.name}</option>`)}</select></label><button class="secondary" type="button" onClick=${() => renderTextLogo()}>Render Text Logo</button><button class="secondary" type="button" onClick=${renderColorBars}>Render Color Bars</button></div>
          <div class="wizard-step"><strong>Or import file</strong><p>Images are resized for the selected target. Raw files must match the target byte length.</p><label class="file-button">Choose Image<input class="hidden-file" type="file" accept="image/*" onChange=${loadImage} /></label><label class="file-button secondary">Import RGB565<input class="hidden-file" type="file" accept=".rgb565,.raw,.bin,application/octet-stream" onChange=${loadRawPayload} /></label></div>
          <div class="wizard-step"><strong>2. Export first</strong><p>Choose the pixel format, then export a copy before flashing.</p><label>Pixel format<select value=${pixelFormat} onChange=${(e) => updateFormat(e.target.value)}><option value="rgb565le">RGB565 little-endian</option><option value="rgb565be">RGB565 big-endian</option><option value="bgr565le">BGR565 little-endian</option><option value="bgr565be">BGR565 big-endian</option></select></label><label class="check"><input type="checkbox" checked=${invertPixels} onChange=${(e) => updateFormat(pixelFormat, e.target.checked)} />Invert pixels</label><button class="secondary" type="button" disabled=${!payload} onClick=${exportRaw}>Export RGB565</button><button class="secondary" type="button" disabled=${!payload} onClick=${exportPng}>Export Preview PNG</button></div>
          <div class="wizard-step"><strong>3. Write to radio</strong><p>Select the target profile first. Changing it resizes the preview and rebuilds the payload.</p><label>Boot target<select value=${bootTargetKey} onChange=${(e) => updateBootTarget(e.target.value)}>${BOOT_TARGETS.map((target) => html`<option value=${target.key}>${target.name}</option>`)}</select></label><label class="check"><input type="checkbox" checked=${armed} onChange=${(e) => setArmed(e.target.checked)} /> Arm boot-logo write</label><button class="danger" type="button" disabled=${!payload || !connected || busy || !armed} onClick=${writeLogo}>Write Boot Logo</button></div>
        </div>
      </div>
    </div>
  </section>`;
}

async function sendBootCommand(transport, cmd, packageId, payload, name, log, { timeout = 8000 } = {}) {
  const packet = buildBootPacket(cmd, packageId, payload);
  transport.clearQueue();
  const serialFrame = transport.kind === "serial";
  let response = await transport.sendBytes(packet, { expect: [0xa5], responseLength: 8, name, timeout, chunkSize: serialFrame ? "frame" : 20, chunkDelay: serialFrame ? 0 : 20, writeWithResponse: true, compactLog: true, logChunks: true, logResponse: true });
  if (response.length >= 6) {
    const need = 8 + ((response[4] << 8) | response[5]);
    if (response.length < need) {
      const rest = await transport.waitForNotification(need - response.length, timeout, 0);
      response = Uint8Array.from([...response, ...rest]);
      log(`${name} RX continuation: ${toHex(rest)}`);
    }
  }
  const parsed = parseBootPacket(response);
  log(`${name} payload: ${toHex(parsed) || "(empty)"}`);
  return parsed;
}

function crc16CcittZero(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function asciiBytes(text) {
  return Uint8Array.from([...text].map((char) => char.charCodeAt(0)));
}

function u32le(value) {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function drawLogoDesign(ctx, target, design, title, subtitle) {
  const width = target.width;
  const height = target.height;
  fillGradient(ctx, 0, 0, width, height, design.colors[0], design.colors[1]);
  ctx.save();
  if (design.key === "serious") {
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
    drawArmyCamo(ctx, width, height);
  } else if (design.key === "fun") {
    ctx.fillStyle = "rgba(251,113,133,0.28)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width * 0.46, 0);
    ctx.lineTo(0, height * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(34,211,238,0.24)";
    ctx.beginPath();
    ctx.moveTo(width, height);
    ctx.lineTo(width * 0.52, height);
    ctx.lineTo(width, height * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(15,23,42,0.26)";
    ctx.fillRect(16, 42, width - 32, 42);
    ctx.fillStyle = "rgba(254,240,138,0.72)";
    for (let x = 14; x < width - 8; x += 22) ctx.fillRect(x, 13 + (x % 3) * 4, 7, 7);
    ctx.fillStyle = "rgba(251,113,133,0.72)";
    for (let x = 20; x < width - 12; x += 28) ctx.fillRect(x, height - 20, 10, 5);
    ctx.strokeStyle = "rgba(255,247,237,0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 9; x < width - 8; x += 12) {
      const y = height - 11 + (x % 2 ? 3 : -3);
      if (x === 9) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (design.key === "clean") {
    drawCleanSignal(ctx, width, height, design);
  } else if (design.key === "nokia") {
    drawNokiaLcd(ctx, width, height, design);
  } else if (design.key === "forest") {
    drawForestScene(ctx, width, height, design);
  } else if (design.key === "fire") {
    drawFireScene(ctx, width, height, design);
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
    ctx.fillStyle = "rgba(20,24,13,0.75)";
    drawFittedText(ctx, title, width / 2 + 1, height * 0.71 + 1, width - 22, 22, 20, "700");
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.71, width - 22, 22, 20, "700");
    if (subtitle) {
      ctx.fillStyle = "rgba(20,24,13,0.75)";
      drawFittedText(ctx, subtitle, width / 2 + 1, height * 0.86 + 1, width - 34, 14, 11, "700");
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, subtitle, width / 2, height * 0.86, width - 34, 14, 11, "700");
    }
  } else if (design.key === "clean") {
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.61, width - 20, 25, 22, "700");
    if (subtitle) {
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, subtitle, width / 2, height * 0.78, width - 34, 15, 11, "500");
    }
  } else if (design.key === "nokia") {
    ctx.fillStyle = "#6e7e55";
    drawFittedText(ctx, title, width / 2 + 1, height * 0.73 + 1, width - 20, 24, 20, "700");
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.73, width - 20, 24, 20, "700");
    if (subtitle) {
      const statusText = subtitle.toUpperCase();
      ctx.fillStyle = "#6e7e55";
      drawFittedText(ctx, statusText, width / 2 + 1, height * 0.88 + 1, width - 28, 14, 10, "700");
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, statusText, width / 2, height * 0.88, width - 28, 14, 10, "700");
    }
  } else if (design.key === "forest" || design.key === "fire") {
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    drawFittedText(ctx, title, width / 2 + 1, height * 0.45 + 1, width - 18, 30, 24, "700");
    ctx.fillStyle = design.title;
    drawFittedText(ctx, title, width / 2, height * 0.45, width - 18, 30, 24, "700");
    if (subtitle) {
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      drawFittedText(ctx, subtitle, width / 2 + 1, height * 0.62 + 1, width - 24, 18, 14, "500");
      ctx.fillStyle = design.subtitle;
      drawFittedText(ctx, subtitle, width / 2, height * 0.62, width - 24, 18, 14, "500");
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

function drawArmyCamo(ctx, width, height) {
  ctx.fillStyle = "#2e3b1f";
  ctx.fillRect(0, 0, width, height);
  drawOrganicBlob(ctx, "#6b7344", width * 0.02, height * 0.02, width * 0.43, height * 0.36, 0.3);
  drawOrganicBlob(ctx, "#a89968", width * 0.54, height * -0.08, width * 0.52, height * 0.38, -0.2);
  drawOrganicBlob(ctx, "#14180d", width * -0.13, height * 0.42, width * 0.52, height * 0.37, -0.05);
  drawOrganicBlob(ctx, "#6b7344", width * 0.46, height * 0.35, width * 0.48, height * 0.34, 0.25);
  drawOrganicBlob(ctx, "#a89968", width * 0.15, height * 0.74, width * 0.58, height * 0.35, 0.1);
  drawOrganicBlob(ctx, "#14180d", width * 0.73, height * 0.66, width * 0.42, height * 0.37, -0.18);
  const shadow = ctx.createRadialGradient(width / 2, height * 0.45, 8, width / 2, height * 0.45, Math.max(width, height) * 0.55);
  shadow.addColorStop(0, "rgba(20,24,13,0.36)");
  shadow.addColorStop(1, "rgba(20,24,13,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, width, height);
  drawRadioSilhouette(ctx, width, height);
}

function drawOrganicBlob(ctx, color, x, y, width, height, skew) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.2, y + height * 0.06);
  ctx.bezierCurveTo(x + width * (0.48 + skew), y - height * 0.08, x + width * 0.92, y + height * 0.1, x + width * 0.95, y + height * 0.36);
  ctx.bezierCurveTo(x + width * 1.05, y + height * 0.65, x + width * 0.68, y + height * 0.94, x + width * 0.36, y + height * 0.88);
  ctx.bezierCurveTo(x + width * 0.04, y + height * 0.94, x - width * 0.12, y + height * 0.54, x + width * 0.2, y + height * 0.06);
  ctx.fill();
}

function drawRadioSilhouette(ctx, width, height) {
  const unit = Math.max(1, Math.round(width / 80));
  const cx = width / 2;
  const top = height * 0.18;
  const bodyW = width * 0.24;
  const bodyH = height * 0.36;
  ctx.fillStyle = "#14180d";
  ctx.beginPath();
  ctx.moveTo(cx - unit, top + unit * 2);
  ctx.lineTo(cx + unit * 5, top - unit * 11);
  ctx.lineTo(cx + unit * 7, top - unit * 10);
  ctx.lineTo(cx + unit * 1, top + unit * 3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - bodyW / 2 + unit * 4, top + unit * 14);
  ctx.quadraticCurveTo(cx - bodyW / 2, top + unit * 14, cx - bodyW / 2, top + unit * 18);
  ctx.lineTo(cx - bodyW / 2 + unit * 3, top + bodyH);
  ctx.quadraticCurveTo(cx - bodyW / 2 + unit * 4, top + bodyH + unit * 4, cx, top + bodyH + unit * 4);
  ctx.lineTo(cx + bodyW / 2 - unit * 3, top + bodyH + unit);
  ctx.quadraticCurveTo(cx + bodyW / 2 + unit, top + bodyH, cx + bodyW / 2, top + bodyH - unit * 4);
  ctx.lineTo(cx + bodyW / 2 - unit * 2, top + unit * 17);
  ctx.quadraticCurveTo(cx + bodyW / 2 - unit * 3, top + unit * 13, cx + bodyW / 2 - unit * 7, top + unit * 13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#a89968";
  ctx.beginPath();
  ctx.arc(cx + bodyW * 0.18, top + bodyH * 0.52, unit * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a89968";
  ctx.lineWidth = Math.max(2, unit * 2);
  ctx.beginPath();
  ctx.moveTo(cx - bodyW * 0.19, top + bodyH * 0.28);
  ctx.lineTo(cx + bodyW * 0.17, top + bodyH * 0.25);
  ctx.moveTo(cx - bodyW * 0.16, top + bodyH * 0.39);
  ctx.lineTo(cx + bodyW * 0.13, top + bodyH * 0.37);
  ctx.stroke();
}

function drawCleanSignal(ctx, width, height, design) {
  const cx = width / 2;
  const cy = height * 0.35;
  ctx.fillStyle = design.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = design.accent;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, 12 + i * 11, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  }
}

function drawForestScene(ctx, width, height, design) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#173c18");
  sky.addColorStop(1, "#081c08");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(132,204,22,0.9)";
  ctx.beginPath();
  ctx.arc(width - 22, 22, 8, 0, Math.PI * 2);
  ctx.fill();
  drawTreeLine(ctx, width, height, height * 0.7, "#0f2f12", 6, 0.21);
  drawTreeLine(ctx, width, height, height * 0.78, "#061806", 7, 0.18);
  ctx.strokeStyle = design.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.19, height * 0.28);
  ctx.lineTo(width * 0.25, height * 0.21);
  ctx.lineTo(width * 0.31, height * 0.28);
  ctx.moveTo(width * 0.26, height * 0.21);
  ctx.lineTo(width * 0.26, height * 0.39);
  ctx.stroke();
}

function drawTreeLine(ctx, width, height, base, color, count, scale) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const cx = (i + 0.5) * (width / count);
    const treeHeight = height * (scale + (i % 2) * 0.05);
    const treeWidth = width * (0.09 + (i % 3) * 0.015);
    ctx.beginPath();
    ctx.moveTo(cx, base - treeHeight);
    ctx.lineTo(cx - treeWidth, base);
    ctx.lineTo(cx + treeWidth, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - treeWidth * 0.12, base - treeHeight * 0.12, treeWidth * 0.24, treeHeight * 0.18);
  }
}

function drawFireScene(ctx, width, height, design) {
  const glow = ctx.createRadialGradient(width / 2, height, 4, width / 2, height, height * 0.62);
  glow.addColorStop(0, "rgba(249,115,22,0.55)");
  glow.addColorStop(0.45, "rgba(127,29,29,0.55)");
  glow.addColorStop(1, "rgba(26,26,29,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  const stripeY = height * 0.16;
  for (let x = -28; x < width + 28; x += 28) {
    ctx.fillStyle = Math.round((x + 28) / 28) % 2 ? "rgba(249,115,22,0.95)" : "rgba(254,243,199,0.92)";
    ctx.beginPath();
    ctx.moveTo(x, stripeY);
    ctx.lineTo(x + 14, stripeY + 11);
    ctx.lineTo(x + 14, stripeY + 25);
    ctx.lineTo(x, stripeY + 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = design.accent;
  ctx.beginPath();
  ctx.moveTo(width * 0.5, height * 0.76);
  ctx.bezierCurveTo(width * 0.35, height * 0.58, width * 0.47, height * 0.46, width * 0.45, height * 0.35);
  ctx.bezierCurveTo(width * 0.62, height * 0.49, width * 0.7, height * 0.62, width * 0.5, height * 0.76);
  ctx.fill();
  ctx.fillStyle = "#fed7aa";
  ctx.beginPath();
  ctx.moveTo(width * 0.5, height * 0.67);
  ctx.bezierCurveTo(width * 0.43, height * 0.58, width * 0.51, height * 0.52, width * 0.5, height * 0.45);
  ctx.bezierCurveTo(width * 0.58, height * 0.55, width * 0.6, height * 0.62, width * 0.5, height * 0.67);
  ctx.fill();
}

function drawNokiaLcd(ctx, width, height, design) {
  ctx.fillStyle = "#a7b58a";
  ctx.fillRect(0, 0, width, height);
  const cell = Math.max(1, Math.round(width / 80));
  const ink = design.accent;
  const mid = "#6e7e55";
  ctx.fillStyle = "rgba(110,126,85,0.18)";
  for (let y = cell * 5; y < height - cell * 6; y += cell * 5) {
    for (let x = cell * 5; x < width - cell * 5; x += cell * 10) ctx.fillRect(x, y, cell, cell);
  }
  ctx.fillStyle = ink;
  for (let i = 0; i < 4; i += 1) lcdRect(ctx, cell * (5 + i * 3), cell * (8 - i), cell * 2, cell * (2 + i), cell);
  lcdRect(ctx, width - cell * 16, cell * 6, cell * 10, cell * 4, cell);
  lcdRect(ctx, width - cell * 6, cell * 7, cell * 2, cell * 2, cell);
  ctx.fillStyle = mid;
  lcdRect(ctx, width - cell * 15, cell * 7, cell * 6, cell * 2, cell);
  ctx.fillStyle = ink;
  const mastX = Math.round(width / 2 / cell) * cell;
  const mastTop = cell * 24;
  lcdRect(ctx, mastX - cell, mastTop, cell * 2, cell * 10, cell);
  lcdRect(ctx, mastX - cell * 4, mastTop + cell * 10, cell * 8, cell * 2, cell);
  for (let i = 0; i < 3; i += 1) {
    const radius = cell * (7 + i * 5);
    for (let deg = 218; deg <= 322; deg += 13) {
      const rad = deg * Math.PI / 180;
      lcdRect(ctx, mastX + Math.cos(rad) * radius, mastTop + Math.sin(rad) * radius, cell, cell, cell);
    }
  }
  ctx.fillStyle = mid;
  for (let x = cell * 18; x < width - cell * 18; x += cell * 4) lcdRect(ctx, x, height - cell * 23, cell, cell, cell);
}

function lcdRect(ctx, x, y, width, height, cell) {
  ctx.fillRect(Math.round(x / cell) * cell, Math.round(y / cell) * cell, Math.round(width / cell) * cell, Math.round(height / cell) * cell);
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

function payloadFromCanvas(canvas, target, format = "rgb565le", invert = false) {
  const image = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, target.width, target.height);
  const payload = new Uint8Array(target.width * target.height * 2);
  for (let i = 0, out = 0; i < image.data.length; i += 4, out += 2) {
    const red = invert ? 255 - image.data[i] : image.data[i];
    const green = invert ? 255 - image.data[i + 1] : image.data[i + 1];
    const blue = invert ? 255 - image.data[i + 2] : image.data[i + 2];
    const first = format.startsWith("bgr") ? blue : red;
    const third = format.startsWith("bgr") ? red : blue;
    const rgb565 = ((first >> 3) << 11) | ((green >> 2) << 5) | (third >> 3);
    if (format.endsWith("be")) {
      payload[out] = (rgb565 >> 8) & 0xff;
      payload[out + 1] = rgb565 & 0xff;
    } else {
      payload[out] = rgb565 & 0xff;
      payload[out + 1] = (rgb565 >> 8) & 0xff;
    }
  }
  return payload;
}

function paintPayloadPreview(canvas, payload, target, format = "rgb565le", invert = false) {
  if (!canvas) return;
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.createImageData(target.width, target.height);
  for (let i = 0, out = 0; i < payload.length; i += 2, out += 4) {
    const value = format.endsWith("be") ? (payload[i] << 8) | payload[i + 1] : payload[i] | (payload[i + 1] << 8);
    let first = ((value >> 11) & 0x1f) << 3;
    let green = ((value >> 5) & 0x3f) << 2;
    let third = (value & 0x1f) << 3;
    first |= first >> 5;
    green |= green >> 6;
    third |= third >> 5;
    const red = format.startsWith("bgr") ? third : first;
    const blue = format.startsWith("bgr") ? first : third;
    image.data[out] = invert ? 255 - red : red;
    image.data[out + 1] = invert ? 255 - green : green;
    image.data[out + 2] = invert ? 255 - blue : blue;
    image.data[out + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function resizePreviewPayload(sourceCanvas, target, format = "rgb565le", invert = false) {
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width || target.width, sourceCanvas.height || target.height, 0, 0, target.width, target.height);
  return payloadFromCanvas(canvas, target, format, invert);
}

function pixelFormatLabel(format, invert = false) {
  const label = {
    bgr565be: "BGR565 big-endian",
    bgr565le: "BGR565 little-endian",
    rgb565be: "RGB565 big-endian",
    rgb565le: "RGB565 little-endian"
  }[format] || "RGB565 little-endian";
  return invert ? `${label}, inverted` : label;
}

function downloadBlob(data, name, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

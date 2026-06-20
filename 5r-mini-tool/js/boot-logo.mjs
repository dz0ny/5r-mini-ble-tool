import { html, useEffect, useRef, useState } from "./preact.mjs?v=ani-sync";
import { sleep, toHex } from "./format.mjs?v=ani-sync";
import { LOGO_DESIGNS, drawLogoDesign, getLogoDesign } from "./boot-logo-designs.mjs?v=custom-wizard";

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
function getBootTarget(key) {
  return BOOT_TARGETS.find((target) => target.key === key) || BOOT_TARGETS[0];
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
  const [iconText, setIconText] = useState(saved.iconText || "📻");
  const [bgTop, setBgTop] = useState(saved.bgTop || "#0b0e13");
  const [bgBottom, setBgBottom] = useState(saved.bgBottom || "#0b0e13");
  const [designKey, setDesignKey] = useState(saved.designKey || "signal");
  const [pixelFormat, setPixelFormat] = useState(saved.pixelFormat || "rgb565le");
  const [invertPixels, setInvertPixels] = useState(Boolean(saved.invertPixels));
  const [message, setMessage] = useState("Enter a radio name or choose an image to build a boot-logo payload.");
  const bootTarget = getBootTarget(bootTargetKey);

  useEffect(() => {
    saveBootLogoPrefs({ armed, bgBottom, bgTop, bootTargetKey, designKey, iconText, invertPixels, logoText, pixelFormat, subText });
  }, [armed, bgBottom, bgTop, bootTargetKey, designKey, iconText, invertPixels, logoText, pixelFormat, subText]);

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

  function renderTextLogo(options = {}) {
    const args = options && !options.currentTarget ? options : {};
    const { silent = false, target = bootTarget, format = pixelFormat, invert = invertPixels, designKey: selectedDesignKey = designKey, mainText = logoText, smallText = subText, glyph = iconText, bgStart = bgTop, bgEnd = bgBottom } = args;
    const renderTarget = Number.isFinite(target?.width) && Number.isFinite(target?.height) ? target : bootTarget;
    const baseDesign = getLogoDesign(selectedDesignKey);
    const design = selectedDesignKey === "custom" ? { ...baseDesign, colors: [bgStart, bgEnd] } : baseDesign;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = renderTarget.width;
    canvas.height = renderTarget.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    drawLogoDesign(ctx, renderTarget, design, mainText.trim() || "BAOFENG", smallText.trim(), glyph);
    const next = payloadFromCanvas(canvas, renderTarget, format, invert);
    setPayload(next);
    setFileName((mainText.trim() || "radio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "radio");
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
          <div class="wizard-step boot-text-tool"><strong>1. Make text logo</strong><p>Enter a radio name, choose a visual design, and render it into the preview. Pick the Custom design to set your own emoji/text icon and background colors.</p><label>Main text<input value=${logoText} maxlength="18" onInput=${(e) => { setLogoText(e.target.value); renderTextLogo({ silent: true, mainText: e.target.value }); }} /></label><label>Small text<input value=${subText} maxlength="18" onInput=${(e) => { setSubText(e.target.value); renderTextLogo({ silent: true, smallText: e.target.value }); }} /></label><label>Design<select value=${designKey} onChange=${(e) => updateDesign(e.target.value)}>${LOGO_DESIGNS.map((design) => html`<option value=${design.key}>${design.name}</option>`)}</select></label>${designKey === "custom" ? html`<label>Symbol / emoji<input value=${iconText} maxlength="12" placeholder="📻 or text" onInput=${(e) => { setIconText(e.target.value); renderTextLogo({ silent: true, glyph: e.target.value }); }} /></label><div class="bg-pickers"><label>Background top<input type="color" value=${bgTop} onInput=${(e) => { setBgTop(e.target.value); renderTextLogo({ silent: true, bgStart: e.target.value }); }} /></label><label>Background bottom<input type="color" value=${bgBottom} onInput=${(e) => { setBgBottom(e.target.value); renderTextLogo({ silent: true, bgEnd: e.target.value }); }} /></label></div>` : ""}<button class="secondary" type="button" onClick=${() => renderTextLogo()}>Render Text Logo</button><button class="secondary" type="button" onClick=${renderColorBars}>Render Color Bars</button></div>
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
  // The radio returns framed A5/CRC acks over the serial UART, but its BLE bridge
  // does not surface them reliably (PROGRAM never answers and the flow stalls).
  // So over BLE we fire-and-forget the boot commands, pacing only by chunk delay,
  // which is the flow that historically produced correct BLE writes.
  if (!serialFrame) {
    await transport.sendBytes(packet, { expect: [], responseLength: 0, name, chunkSize: 20, chunkDelay: 20, writeWithResponse: true, compactLog: true, logChunks: true });
    log(`${name}: sent (BLE, no response wait)`);
    return new Uint8Array();
  }
  let response = await transport.sendBytes(packet, { expect: [0xa5], responseLength: 8, name, timeout, chunkSize: "frame", chunkDelay: 0, writeWithResponse: true, compactLog: true, logChunks: true, logResponse: true });
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

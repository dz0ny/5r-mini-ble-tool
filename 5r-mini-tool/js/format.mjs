export function hexAddr(addr) {
  return addr.toString(16).toUpperCase().padStart(4, "0");
}

export function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

export function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cleanUuid(value) {
  return value.trim();
}

export function parseByteValue(value) {
  const text = String(value).trim();
  const parsed = text.startsWith("0x") ? Number.parseInt(text.slice(2), 16) : Number.parseInt(text, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) throw new Error("Expected byte value 0..255");
  return parsed;
}

export function parseHexBytes(value, expectedLength) {
  const clean = value.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length !== expectedLength * 2) throw new Error(`Expected ${expectedLength} hex bytes`);
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(Number.parseInt(clean.slice(i, i + 2), 16));
  return out;
}

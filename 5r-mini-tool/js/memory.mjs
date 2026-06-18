import { BASIC_SETTINGS, CRYPT_KEY, DTMF_CHARS, PMR_CHANNELS, PROTOCOL } from "./protocol.mjs?v=ani-sync";
import { hexAddr, parseByteValue, parseHexBytes, toHex } from "./format.mjs?v=ani-sync";

export function buildDefaultBlocks() {
  const blocks = {};
  for (const [begin, end] of PROTOCOL.readRanges) {
    for (let addr = begin; addr <= end; addr += PROTOCOL.blockSize) {
      blocks[hexAddr(addr)] = [0x52, addr >> 8, addr & 0xff, 0x40, ...new Array(64).fill(0xff)];
    }
  }
  return blocks;
}

export function cloneBlocks(blocks) {
  return structuredClone(blocks);
}

export function formatMemoryJson(blocks) {
  const lines = Object.keys(blocks).sort().map((key) => `  "${key}": [${blocks[key].join(",")}]`);
  return `{\n${lines.join(",\n")}\n}`;
}

export function getChannelCapacity() {
  return Math.floor((PROTOCOL.channelEnd - PROTOCOL.channelBegin + 1) / PROTOCOL.channelRecordSize);
}

export function cryptByte(byte, payloadOffset) {
  const key = CRYPT_KEY[payloadOffset % CRYPT_KEY.length];
  if (key !== 0x20 && byte !== 0x00 && byte !== 0xff && byte !== key && byte !== (key ^ 0xff)) return byte ^ key;
  return byte;
}

export function cryptBuffer(bytes, payloadOffset = 0) {
  return bytes.map((byte, index) => cryptByte(byte, payloadOffset + index));
}

export function getDecodedByte(blocks, addr) {
  const key = hexAddr(Math.floor(addr / 64) * 64);
  const block = blocks[key];
  if (!block) return 0xff;
  return cryptByte(block[4 + (addr % 64)], addr % 64);
}

export function setDecodedByte(blocks, addr, value) {
  const key = hexAddr(Math.floor(addr / 64) * 64);
  const block = blocks[key];
  if (!block) throw new Error(`Missing block ${key}`);
  block[4 + (addr % 64)] = cryptByte(value, addr % 64);
}

export function getDecodedBytes(blocks, addr, length) {
  const out = [];
  for (let i = 0; i < length; i += 1) out.push(getDecodedByte(blocks, addr + i));
  return out;
}

export function setDecodedBytes(blocks, addr, bytes) {
  for (let i = 0; i < bytes.length; i += 1) setDecodedByte(blocks, addr + i, bytes[i]);
}

export function parseChannel(blocks, channel) {
  const offset = PROTOCOL.channelBegin + channel * PROTOCOL.channelRecordSize;
  const key = hexAddr(Math.floor(offset / 64) * 64);
  const block = blocks[key];
  if (!block) return emptyChannel(channel);
  const pos = 4 + (offset % 64);
  const data = block.slice(pos, pos + PROTOCOL.channelRecordSize);
  if (data.length < PROTOCOL.channelRecordSize) return emptyChannel(channel);
  const decoded = cryptBuffer(data, offset % 64);
  const empty = data.every((v) => v === 0xff || v === 0x00);
  if (empty) return emptyChannel(channel);
  return {
    channel,
    empty,
    name: channelNameToText(decoded.slice(20, 32)),
    rx: freqBytesToMhz(decoded.slice(0, 4)),
    tx: freqBytesToMhz(decoded.slice(4, 8)),
    rxTone: toneToText(word16(decoded, 8)),
    txTone: toneToText(word16(decoded, 10)),
    signaling: decoded[12],
    pttId: decoded[13],
    power: decoded[14] & 0x01,
    width: (decoded[15] >> 1) & 0x01,
    bcl: (decoded[15] >> 4) & 0x01,
    scan: (decoded[15] >> 5) & 0x01,
    fhss: (decoded[15] >> 7) & 0x01,
    dtmfEncoder: decoded[16],
    jmpFreq: decoded[17]
  };
}

function emptyChannel(channel) {
  return { channel, empty: true, name: "", rx: "", tx: "", rxTone: "OFF", txTone: "OFF", signaling: 0, pttId: 0, power: 0, width: 0, bcl: 0, scan: 0, fhss: 0, dtmfEncoder: 0, jmpFreq: 0 };
}

export function updateChannelField(blocks, channel, field, rawValue) {
  const offset = PROTOCOL.channelBegin + channel * PROTOCOL.channelRecordSize;
  const key = hexAddr(Math.floor(offset / 64) * 64);
  if (!blocks[key]) blocks[key] = buildDefaultBlocks()[key];
  const block = blocks[key];
  const pos = 4 + (offset % 64);
  const payloadOffset = offset % 64;
  if (field === "name") {
    writeEncoded(block, pos + 20, payloadOffset + 20, textToChannelName(rawValue));
  } else if (field === "rx" || field === "tx") {
    const start = field === "rx" ? pos : pos + 4;
    const phaseOffset = field === "rx" ? payloadOffset : payloadOffset + 4;
    writeEncoded(block, start, phaseOffset, freqMhzToBytes(rawValue));
  } else if (field === "rxTone" || field === "txTone") {
    const tone = textToTone(rawValue);
    const toneOffset = field === "rxTone" ? 8 : 10;
    writeEncoded(block, pos + toneOffset, payloadOffset + toneOffset, [tone & 0xff, tone >> 8]);
  } else if (field === "pttId") {
    block[pos + 13] = cryptByte(parseByteValue(rawValue), payloadOffset + 13);
  } else if (field === "signaling") {
    block[pos + 12] = cryptByte(parseByteValue(rawValue), payloadOffset + 12);
  } else if (field === "dtmfEncoder") {
    block[pos + 16] = cryptByte(parseByteValue(rawValue), payloadOffset + 16);
  } else if (field === "jmpFreq") {
    block[pos + 17] = cryptByte(parseByteValue(rawValue), payloadOffset + 17);
  } else {
    const flagsOffset = field === "power" ? 14 : 15;
    const flagsPos = pos + flagsOffset;
    const decodedFlags = cryptByte(block[flagsPos], payloadOffset + flagsOffset);
    const bit = field === "power" ? 0 : field === "width" ? 1 : field === "bcl" ? 4 : field === "scan" ? 5 : 7;
    const mask = 1 << bit;
    const value = Number(rawValue);
    block[flagsPos] = cryptByte(value ? decodedFlags | mask : decodedFlags & ~mask, payloadOffset + flagsOffset);
  }
}

export function clearChannel(blocks, channel) {
  const offset = PROTOCOL.channelBegin + channel * PROTOCOL.channelRecordSize;
  const key = hexAddr(Math.floor(offset / 64) * 64);
  if (!blocks[key]) blocks[key] = buildDefaultBlocks()[key];
  const block = blocks[key];
  const pos = 4 + (offset % 64);
  for (let i = 0; i < PROTOCOL.channelRecordSize; i += 1) block[pos + i] = 0xff;
}

export function clearAllChannels(blocks) {
  for (let channel = 0; channel < getChannelCapacity(); channel += 1) clearChannel(blocks, channel);
}

function writeEncoded(block, start, payloadOffset, bytes) {
  const encoded = cryptBuffer(bytes, payloadOffset);
  for (let i = 0; i < encoded.length; i += 1) block[start + i] = encoded[i];
}

export function getVfos(blocks) {
  return [["A", 0x8000], ["B", 0x8020]].map(([side, addr]) => {
    const data = getDecodedBytes(blocks, addr, 32);
    return {
      side,
      addr,
      mhz: vfoFreqToMhz(data.slice(0, 8)),
      rxTone: toneToText(word16(data, 8)),
      txTone: toneToText(word16(data, 10)),
      signaling: data[12],
      muteWay: data[13],
      jmpFreq: data[14],
      pttId: data[15],
      busyLock: data[16],
      direction: data[18],
      step: data[19],
      offset: vfoOffsetToMhz(data.slice(20, 26)),
      power: data[26],
      width: data[27]
    };
  });
}

export function getSettings(blocks) {
  return BASIC_SETTINGS.map((setting) => {
    const { addr, kind } = setting;
    const value = kind === "word16" ? getDecodedByte(blocks, addr) | (getDecodedByte(blocks, addr + 1) << 8) : getDecodedByte(blocks, addr);
    return { ...setting, value, textValue: kind === "hex" ? toHex([value]) : String(value) };
  });
}

export function getRawBasicSettings(blocks) {
  const mapped = new Set();
  BASIC_SETTINGS.forEach((setting) => {
    for (let index = 0; index < (setting.length || 1); index += 1) mapped.add(setting.addr + index);
  });
  const out = [];
  for (let addr = 0x9000; addr <= 0x903f; addr += 1) {
    if (mapped.has(addr)) continue;
    const value = getDecodedByte(blocks, addr);
    if (value === 0x00 || value === 0xff) continue;
    out.push({
      key: `raw${hexAddr(addr)}`,
      label: `Raw ${hexAddr(addr)}`,
      addr,
      kind: "byte",
      description: "Unmapped Ola settings byte. Preserve unless you are testing this field.",
      value,
      textValue: String(value)
    });
  }
  return out;
}

export function getMembers(blocks) {
  return Array.from({ length: 20 }, (_, index) => {
    const addr = 0xa020 + index * 16;
    const nameAddr = addr + 5;
    const codeBytes = getDecodedBytes(blocks, addr, 5);
    const nameBytes = getDecodedBytes(blocks, nameAddr, 10);
    return { index, addr, nameAddr, code: dtmfBytesToText(codeBytes), name: decodeGbk(nameBytes) };
  });
}

export function getDtmfEncoderSettings(blocks) {
  return {
    aniCode: { label: "ANI Code", kind: "dtmfSequence", addr: 0xa000, length: 3, value: dtmfBytesToText(getDecodedBytes(blocks, 0xa000, 3)) },
    onTime: { label: "DTMF On Time", kind: "byte", addr: 0xa007, value: getDecodedByte(blocks, 0xa007), options: [[0, "50ms"], [1, "100ms"], [2, "200ms"], [3, "300ms"], [4, "400ms"], [5, "500ms"]] },
    offTime: { label: "DTMF Off Time", kind: "byte", addr: 0xa008, value: getDecodedByte(blocks, 0xa008), options: [[0, "50ms"], [1, "100ms"], [2, "200ms"], [3, "300ms"], [4, "400ms"], [5, "500ms"]] },
    hangupTime: { label: "Hangup Time", kind: "byte", addr: 0xa009, value: getDecodedByte(blocks, 0xa009), options: [[3, "3s"], [4, "4s"], [5, "5s"], [6, "6s"], [7, "7s"], [8, "8s"], [9, "9s"], [10, "10s"]] },
    separator: { label: "Separator", kind: "byte", addr: 0xa00b, value: getDecodedByte(blocks, 0xa00b), options: [[0, "A"], [1, "B"], [2, "C"], [3, "D"], [4, "*"], [5, "#"]] },
    groupCallCode: { label: "Group Call Code", kind: "byte", addr: 0xa00a, value: getDecodedByte(blocks, 0xa00a), options: [[0, "Off"], [1, "A"], [2, "B"], [3, "C"], [4, "D"], [5, "*"], [6, "#"]] },
    onlineCode: { label: "Online Code", kind: "dtmfSequence", addr: 0xa180, length: 16, value: dtmfBytesToText(getDecodedBytes(blocks, 0xa180, 16)) },
    offlineCode: { label: "Offline Code", kind: "dtmfSequence", addr: 0xa190, length: 16, value: dtmfBytesToText(getDecodedBytes(blocks, 0xa190, 16)) }
  };
}

export function updateMemoryField(blocks, kind, addr, value, length = 1) {
  if (kind === "vfoFreq") setDecodedBytes(blocks, addr, mhzToVfoFreq(value));
  else if (kind === "vfoOffset") setDecodedBytes(blocks, addr, mhzToVfoOffset(value));
  else if (kind === "tone16") {
    const tone = textToTone(value);
    setDecodedBytes(blocks, addr, [tone & 0xff, tone >> 8]);
  } else if (kind === "word16") {
    const word = parseWordValue(value);
    setDecodedBytes(blocks, addr, [word & 0xff, word >> 8]);
  } else if (kind === "byte") setDecodedByte(blocks, addr, parseByteValue(value));
  else if (kind === "byteHex") setDecodedByte(blocks, addr, parseHexBytes(value, 1)[0]);
  else if (kind === "dtmfCode") setDecodedBytes(blocks, addr, textToDtmfBytes(value, length));
  else if (kind === "dtmfSequence") setDecodedBytes(blocks, addr, textToDtmfSequence(value, length));
  else if (kind === "memberName") setDecodedBytes(blocks, addr, textToAsciiBytes(value, length));
  else if (kind === "hexBytes") setDecodedBytes(blocks, addr, parseHexBytes(value, length));
}

export function fillPmrChannels(blocks, startSlot, toneText, options = {}) {
  const firstSlot = Number(startSlot);
  if (!Number.isInteger(firstSlot) || firstSlot < 1 || firstSlot + PMR_CHANNELS.length - 1 > getChannelCapacity()) throw new Error("PMR start slot is outside channel memory");
  const tone = textToTone(toneText);
  const namePrefix = options.namePrefix || "PMR";
  const pttId = parseByteValue(options.pttId ?? 0);
  const power = parseByteValue(options.power ?? 1);
  const width = parseByteValue(options.width ?? 1);
  const scan = parseByteValue(options.scan ?? 1);
  const signalCode = parseByteValue(options.signalCode ?? 1);
  const callingScope = options.callingScope || "none";
  const flags = (width ? 0x02 : 0x00) | (scan ? 0x20 : 0x00);
  PMR_CHANNELS.forEach((mhz, index) => {
    const callingEnabled = callingScope === "all" || (callingScope === "first" && index === 0);
    setChannelDecoded(blocks, firstSlot - 1 + index, {
      name: `${namePrefix}${String(index + 1).padStart(2, "0")}`,
      rx: mhz,
      tx: mhz,
      rxTone: tone,
      txTone: tone,
      signaling: callingEnabled ? signalCode : 0,
      pttId: callingEnabled ? pttId : 0,
      power,
      flags,
      unknown: [callingEnabled ? 1 : 0xff, 0xff, 0xff, 0xff]
    });
  });
}

export function labelMembers(blocks, prefix, firstId) {
  for (let index = 0; index < 20; index += 1) {
    const addr = 0xa020 + index * 16;
    setDecodedBytes(blocks, addr, textToDtmfBytes(String(firstId + index), 5));
    setDecodedBytes(blocks, addr + 5, textToAsciiBytes(`${prefix}${String(index + 1).padStart(2, "0")}`, 10));
  }
}

export function labelMemberRange(blocks, startMember, count, prefix, firstId) {
  const firstMember = Number(startMember);
  const memberCount = Number(count);
  if (!Number.isInteger(firstMember) || firstMember < 1 || firstMember > 20) throw new Error("Member start must be 1-20");
  if (!Number.isInteger(memberCount) || memberCount < 1 || firstMember + memberCount - 1 > 20) throw new Error("Member count exceeds the 20 DTMF slots");
  for (let index = 0; index < memberCount; index += 1) {
    const addr = 0xa020 + (firstMember - 1 + index) * 16;
    setDecodedBytes(blocks, addr, textToDtmfBytes(String(firstId + index), 5));
    setDecodedBytes(blocks, addr + 5, textToAsciiBytes(`${prefix}${String(index + 1).padStart(2, "0")}`, 10));
  }
}

export function setCallChannel(blocks, slot, values) {
  const channel = Number(slot) - 1;
  if (!Number.isInteger(channel) || channel < 0 || channel >= getChannelCapacity()) throw new Error("Channel slot is outside memory");
  const tone = textToTone(values.tone || "OFF");
  setChannelDecoded(blocks, channel, {
    name: values.name,
    rx: values.frequency,
    tx: values.frequency,
    rxTone: tone,
    txTone: tone,
    signaling: parseByteValue(values.signaling),
    pttId: parseByteValue(values.pttId),
    power: parseByteValue(values.power ?? 1),
    flags: 0x22,
    unknown: [parseByteValue(values.dtmfEncoder ?? 1), 0xff, 0xff, 0xff]
  });
}

function setChannelDecoded(blocks, channel, values) {
  const offset = PROTOCOL.channelBegin + channel * PROTOCOL.channelRecordSize;
  const rxTone = values.rxTone ?? 0;
  const txTone = values.txTone ?? 0;
  const decoded = [
    ...freqMhzToBytes(String(values.rx)), ...freqMhzToBytes(String(values.tx)),
    rxTone & 0xff, rxTone >> 8, txTone & 0xff, txTone >> 8,
    values.signaling ?? 0, values.pttId ?? 0, values.power ?? 1, values.flags ?? 0x22,
    ...(values.unknown ?? [0x00, 0x00, 0x00, 0x33]), ...textToChannelName(values.name ?? "")
  ];
  setDecodedBytes(blocks, offset, decoded);
}

export function normalizeBlock(addr, response) {
  const out = Array.from(response);
  if (out.length >= 68 && out[0] === 0x52) return out.slice(0, 68);
  if (out.length >= 64) return [0x52, addr >> 8, addr & 0xff, 0x40, ...out.slice(0, 64)];
  throw new Error(`Short block at ${hexAddr(addr)}: ${out.length} bytes`);
}

export function blockPayload(block, addr) {
  if (!Array.isArray(block) && !(block instanceof Uint8Array)) throw new Error(`Block ${hexAddr(addr)} is not byte data`);
  const bytes = Array.from(block);
  if (bytes.length >= 68 && (bytes[0] === 0x52 || bytes[0] === 0x57) && bytes[3] === 0x40) return bytes.slice(4, 68);
  if (bytes.length >= 64) {
    if (bytes[0] === 0x57 && bytes[3] === 0x40) throw new Error(`Block ${hexAddr(addr)} looks like a truncated write frame, not raw memory`);
    return bytes.slice(0, 64);
  }
  throw new Error(`Short block at ${hexAddr(addr)}: ${bytes.length} bytes`);
}

export function validateBlocks(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Memory JSON must be an object");
  for (const [key, block] of Object.entries(value)) {
    if (!/^[0-9A-Fa-f]{4}$/.test(key)) throw new Error(`Bad block key ${key}`);
    if (!Array.isArray(block) || block.length !== 68) throw new Error(`Block ${key} must contain 68 bytes`);
    if (block.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error(`Block ${key} contains invalid byte values`);
  }
}

export function countBlocks(ranges) {
  return ranges.reduce((total, [begin, end]) => total + Math.floor((end - begin) / PROTOCOL.blockSize) + 1, 0);
}

function parseWordValue(value) {
  const text = String(value).trim();
  const parsed = text.startsWith("0x") ? Number.parseInt(text.slice(2), 16) : Number.parseInt(text, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffff) throw new Error("Expected word value 0..65535");
  return parsed;
}

function channelNameToText(bytes) {
  const chars = [];
  for (const byte of bytes) {
    if (byte === 0xff || byte === 0x00) break;
    chars.push(String.fromCharCode(byte));
  }
  return chars.join("");
}

function textToChannelName(value) {
  return textToAsciiBytes(value, 12);
}

function freqBytesToMhz(bytes) {
  if (bytes.every((v) => v === 0xff || v === 0x00)) return "";
  const digits = [];
  for (let i = bytes.length - 1; i >= 0; i -= 1) digits.push((bytes[i] >> 4) & 0x0f, bytes[i] & 0x0f);
  if (digits.some((digit) => digit > 9)) return toHex(bytes);
  const hz10 = Number(digits.join(""));
  if (!Number.isFinite(hz10) || hz10 === 0) return "";
  return trimMhz(hz10 / 100000);
}

function freqMhzToBytes(value) {
  const textValue = value.trim();
  if (!textValue) return [0xff, 0xff, 0xff, 0xff];
  const mhz = Number(textValue);
  if (!Number.isFinite(mhz)) throw new Error("Frequency must be MHz");
  if (!isValidFrequency(mhz)) throw new Error("Frequency outside 5R Mini ranges");
  const text = String(Math.round(mhz * 100000)).padStart(8, "0").slice(-8);
  const out = [];
  for (let i = text.length - 2; i >= 0; i -= 2) out.push((Number(text[i]) << 4) | Number(text[i + 1]));
  return out;
}

function isValidFrequency(mhz) {
  return (mhz >= 136 && mhz <= 174) || (mhz >= 220 && mhz <= 260) || (mhz >= 360 && mhz <= 520);
}

function trimMhz(value) {
  return value.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
}

function word16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function toneToText(value) {
  if (value === 0 || value === 0xffff) return "OFF";
  if (value >= 0x0258) return `T${Number.parseFloat((value / 10).toFixed(1))}`;
  return `D${String(value).padStart(3, "0")}`;
}

function textToTone(value) {
  const text = value.trim().toUpperCase();
  if (!text || text === "OFF") return 0;
  if (text.startsWith("T")) {
    const tone = Math.round(Number(text.slice(1)) * 10);
    if (!Number.isFinite(tone) || tone < 0x0258 || tone > 0xffff) throw new Error("Bad CTCSS tone");
    return tone;
  }
  if (text.startsWith("D")) {
    const code = Number.parseInt(text.slice(1), 10);
    if (!Number.isInteger(code) || code < 1 || code > 0x0258) throw new Error("Bad DCS code");
    return code;
  }
  if (/^[0-9A-F]{1,4}$/i.test(text)) return Number.parseInt(text, 16);
  throw new Error("Tone must be OFF, T88.5, D023, or hex");
}

function vfoFreqToMhz(bytes) {
  if (bytes.every((v) => v === 0xff || v === 0x00)) return "";
  const hz10 = Number(bytes.filter((v) => v !== 0xff).join(""));
  if (!Number.isFinite(hz10) || hz10 === 0) return "";
  return trimMhz(hz10 / 100000);
}

function mhzToVfoFreq(value) {
  const textValue = value.trim();
  if (!textValue) return new Array(8).fill(0xff);
  const mhz = Number(textValue);
  if (!Number.isFinite(mhz)) throw new Error("Frequency must be MHz");
  if (!isValidFrequency(mhz)) throw new Error("Frequency outside 5R Mini ranges");
  return String(Math.round(mhz * 100000)).padStart(8, "0").slice(-8).split("").map(Number);
}

function vfoOffsetToMhz(bytes) {
  if (bytes.every((v) => v === 0xff || v === 0x00)) return "";
  const khz = Number(bytes.filter((v) => v !== 0xff).join(""));
  if (!Number.isFinite(khz) || khz === 0) return "";
  return trimMhz(khz / 1000);
}

function mhzToVfoOffset(value) {
  const textValue = value.trim();
  if (!textValue) return new Array(6).fill(0xff);
  const khz = Math.round(Number(textValue) * 1000);
  if (!Number.isFinite(khz) || khz < 0 || khz > 999999) throw new Error("Bad offset MHz");
  return String(khz).padStart(6, "0").slice(-6).split("").map(Number);
}

function dtmfBytesToText(bytes) {
  const chars = [];
  for (const byte of bytes) {
    if (byte === 0xff) break;
    if (byte < DTMF_CHARS.length) chars.push(DTMF_CHARS[byte]);
  }
  return chars.join("");
}

function textToDtmfBytes(value, length) {
  const text = String(value).trim().toUpperCase();
  if (!/^[0-9A-D*#]{1,5}$/.test(text)) throw new Error("DTMF ID must be 1-5 keypad chars");
  return textToDtmfSequence(text, length);
}

function textToDtmfSequence(value, length) {
  const text = String(value).trim().toUpperCase();
  if (text && (!/^[0-9A-D*#]+$/.test(text) || text.length > length)) throw new Error(`DTMF value must be 0-${length} keypad chars`);
  const out = new Array(length).fill(0xff);
  for (let i = 0; i < text.length; i += 1) out[i] = DTMF_CHARS.indexOf(text[i]);
  return out;
}

function textToAsciiBytes(value, length) {
  const out = new Array(length).fill(0xff);
  const text = String(value).slice(0, length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) throw new Error("Label must use printable ASCII");
    out[i] = code;
  }
  return out;
}

function decodeGbk(bytes) {
  const data = Uint8Array.from(bytes.filter((byte) => byte !== 0xff && byte !== 0x00));
  if (!data.length) return "";
  try { return new TextDecoder("gb18030").decode(data); } catch { return toHex(data); }
}

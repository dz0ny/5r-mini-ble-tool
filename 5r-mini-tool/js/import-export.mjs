import { BASIC_SETTINGS, PROTOCOL } from "./protocol.mjs?v=multimodel";
import { hexAddr } from "./format.mjs?v=ani-sync";
import { blockPayload, buildDefaultBlocks, clearAllChannels, cloneBlocks, countBlocks, getChannelCapacity, getMembers, getSettings, parseChannel, updateChannelField, updateMemoryField } from "./memory.mjs?v=ani-sync";

const DEFAULT_BLOCKS = buildDefaultBlocks();

const CHANNEL_ENUMS = {
  power: [[0, "High"], [1, "Low"]],
  width: [[0, "Wide"], [1, "Narrow"]],
  scan: [[0, "No"], [1, "Yes"]],
  dtmf: [[0, "Off"], [1, "On"]],
  jump: [[0, "Off"], [1, "On"]],
  ptt: [[0, "Off"], [1, "Begin"], [2, "End"], [3, "Both"]],
  bcl: [[0, "Off"], [1, "On"]],
  fhss: [[0, "Off"], [1, "On"]]
};
const PROVISION_DEFAULTS = {
  rxTone: "OFF",
  txTone: "OFF",
  power: "Low",
  width: "Narrow",
  scan: "Yes",
  signal: 0,
  dtmf: "Off",
  jump: "Off",
  ptt: "Off",
  bcl: "Off",
  fhss: "Off"
};

export function buildProvisionYaml(blocks) {
  return emitYaml({
    model: "5r-mini",
    clearChannels: false,
    defaults: { channel: PROVISION_DEFAULTS },
    settings: Object.fromEntries(getSettings(blocks).map((setting) => [setting.key, settingToYamlValue(setting)])),
    frequencies: buildProvisionFrequencies(blocks),
    members: getMembers(blocks).map((member) => {
      const row = { slot: member.index + 1, code: member.code };
      if (isPrintableAscii(member.name)) row.name = member.name;
      return row;
    })
  });
}

function buildProvisionFrequencies(blocks) {
  const rows = [];
  for (let index = 0; index < getChannelCapacity(); index += 1) {
    const channel = parseChannel(blocks, index);
    if (channel.empty) continue;
    const row = {
      slot: channel.channel + 1,
      name: channel.name,
      tone: channel.rxTone === channel.txTone ? channel.rxTone : undefined,
      rxTone: channel.rxTone !== channel.txTone ? channel.rxTone : undefined,
      txTone: channel.rxTone !== channel.txTone ? channel.txTone : undefined,
      power: enumLabel(CHANNEL_ENUMS.power, channel.power),
      width: enumLabel(CHANNEL_ENUMS.width, channel.width),
      scan: enumLabel(CHANNEL_ENUMS.scan, channel.scan),
      signal: channel.signaling,
      dtmf: enumLabel(CHANNEL_ENUMS.dtmf, channel.dtmfEncoder === 0xff ? 0 : channel.dtmfEncoder),
      jump: enumLabel(CHANNEL_ENUMS.jump, channel.jmpFreq === 0xff ? 0 : channel.jmpFreq),
      ptt: enumLabel(CHANNEL_ENUMS.ptt, channel.pttId),
      bcl: enumLabel(CHANNEL_ENUMS.bcl, channel.bcl),
      fhss: enumLabel(CHANNEL_ENUMS.fhss, channel.fhss)
    };
    if (channel.rx && channel.rx === channel.tx && isWritableFrequency(channel.rx)) row.frequency = channel.rx;
    else {
      if (channel.rx && isWritableFrequency(channel.rx)) row.rx = channel.rx;
      if (channel.tx && isWritableFrequency(channel.tx)) row.tx = channel.tx;
    }
    Object.keys(row).forEach((key) => {
      if (row[key] === undefined || row[key] === "") delete row[key];
    });
    if (!row.frequency && !row.rx && !row.tx) row.preserveFrequency = true;
    rows.push(row);
  }
  return rows;
}

function settingToYamlValue(setting) {
  if (setting.key === "workMode") {
    return { sideA: enumLabel([[0, "Frequency"], [1, "Channel"]], setting.value & 0x0f), sideB: enumLabel([[0, "Frequency"], [1, "Channel"]], (setting.value >> 4) & 0x0f) };
  }
  return setting.options ? enumLabel(setting.options, setting.value) : setting.value;
}

export function applyProvisionYaml(blocks, text) {
  const config = parseYaml(text);
  const next = cloneBlocks(blocks);
  if (config.clearChannels === true) clearAllChannels(next);
  const defaults = config.defaults?.channel && typeof config.defaults.channel === "object" ? { ...PROVISION_DEFAULTS, ...config.defaults.channel } : PROVISION_DEFAULTS;
  if (Array.isArray(config.frequencies)) {
    config.frequencies.forEach((row) => applyProvisionChannel(next, { ...defaults, ...row }));
  }
  if (config.settings && typeof config.settings === "object") applyProvisionSettings(next, config.settings);
  if (Array.isArray(config.members)) applyProvisionMembers(next, config.members);
  return next;
}

function applyProvisionChannel(blocks, row) {
  const slot = Number(row.slot ?? row.channel);
  if (!Number.isInteger(slot) || slot < 1 || slot > getChannelCapacity()) throw new Error(`Bad frequency slot: ${row.slot}`);
  const fields = {};
  if (row.frequency !== undefined) {
    fields.rx = row.frequency;
    fields.tx = row.frequency;
  }
  if (row.rx !== undefined) fields.rx = row.rx;
  if (row.tx !== undefined) fields.tx = row.tx;
  if (row.tone !== undefined) {
    fields.rxTone = row.tone;
    fields.txTone = row.tone;
  }
  const mapping = {
    name: "name",
    rxTone: "rxTone",
    txTone: "txTone",
    power: "power",
    width: "width",
    scan: "scan",
    signal: "signaling",
    signaling: "signaling",
    dtmf: "dtmfEncoder",
    dtmfEncoder: "dtmfEncoder",
    jump: "jmpFreq",
    jmpFreq: "jmpFreq",
    ptt: "pttId",
    pttId: "pttId",
    bcl: "bcl",
    fhss: "fhss"
  };
  Object.entries(mapping).forEach(([from, to]) => {
    if (row[from] !== undefined) fields[to] = row[from];
  });
  Object.entries(fields).forEach(([field, raw]) => {
    const value = channelFieldValue(field, raw);
    try {
      updateChannelField(blocks, slot - 1, field, String(value));
    } catch (error) {
      throw new Error(`Channel ${slot} ${field}: ${error.message}`);
    }
  });
}

function channelFieldValue(field, raw) {
  if (field === "power") return enumValue(CHANNEL_ENUMS.power, raw);
  if (field === "width") return enumValue(CHANNEL_ENUMS.width, raw);
  if (field === "scan") return enumValue(CHANNEL_ENUMS.scan, raw);
  if (field === "dtmfEncoder") return enumValue(CHANNEL_ENUMS.dtmf, raw);
  if (field === "jmpFreq") return enumValue(CHANNEL_ENUMS.jump, raw);
  if (field === "pttId") return enumValue(CHANNEL_ENUMS.ptt, raw);
  if (field === "bcl") return enumValue(CHANNEL_ENUMS.bcl, raw);
  if (field === "fhss") return enumValue(CHANNEL_ENUMS.fhss, raw);
  return raw;
}

function applyProvisionSettings(blocks, settings) {
  const settingsByKey = new Map(BASIC_SETTINGS.map((setting) => [setting.key, setting]));
  Object.entries(settings).forEach(([key, raw]) => {
    const setting = settingsByKey.get(key);
    if (!setting) throw new Error(`Unknown setting: ${key}`);
    if (setting.kind === "workModePair") {
      if (raw && typeof raw === "object") {
        const sideA = enumValue([[0, "Frequency"], [1, "Channel"]], raw.sideA ?? raw.a ?? 0);
        const sideB = enumValue([[0, "Frequency"], [1, "Channel"]], raw.sideB ?? raw.b ?? 0);
        updateMemoryField(blocks, "byte", setting.addr, String((sideB << 4) | sideA));
      } else updateMemoryField(blocks, "byte", setting.addr, String(raw));
      return;
    }
    const value = setting.options ? enumValue(setting.options, raw) : raw;
    updateMemoryField(blocks, setting.kind === "word16" ? "word16" : "byte", setting.addr, String(value));
  });
}

function applyProvisionMembers(blocks, members) {
  members.forEach((member) => {
    const slot = Number(member.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 20) throw new Error(`Bad member slot: ${member.slot}`);
    const addr = 0xa020 + (slot - 1) * 16;
    if (member.code !== undefined) updateMemoryField(blocks, "dtmfSequence", addr, String(member.code), 5);
    if (member.name !== undefined) updateMemoryField(blocks, "memberName", addr + 5, String(member.name), 10);
  });
}

export function blocksToRawBin(blocks) {
  const bytes = [];
  for (const [begin, end] of PROTOCOL.readRanges) {
    for (let addr = begin; addr <= end; addr += PROTOCOL.blockSize) {
      const block = blocks[hexAddr(addr)] || DEFAULT_BLOCKS[hexAddr(addr)];
      bytes.push(...blockPayload(block, addr));
    }
  }
  return Uint8Array.from(bytes);
}

export function blocksFromRawBin(bytes) {
  const total = countBlocks(PROTOCOL.readRanges);
  if (bytes.length !== total * 64 && bytes.length !== total * 68) throw new Error(`Raw binary must be ${total * 64} payload bytes or ${total * 68} framed bytes`);
  const blocks = {};
  let offset = 0;
  for (const [begin, end] of PROTOCOL.readRanges) {
    for (let addr = begin; addr <= end; addr += PROTOCOL.blockSize) {
      if (bytes.length === total * 68) {
        blocks[hexAddr(addr)] = [0x52, addr >> 8, addr & 0xff, 0x40, ...blockPayload(bytes.slice(offset, offset + 68), addr)];
        offset += 68;
      } else {
        const payload = Array.from(bytes.slice(offset, offset + 64));
        if (payload[0] === 0x57 && payload[3] === 0x40) throw new Error(`Raw binary block ${hexAddr(addr)} starts with a write command header; export raw memory again after this fix`);
        blocks[hexAddr(addr)] = [0x52, addr >> 8, addr & 0xff, 0x40, ...payload];
        offset += 64;
      }
    }
  }
  return blocks;
}

function enumLabel(options, value) {
  const found = options.find(([optionValue]) => Number(optionValue) === Number(value));
  return found ? found[1] : value;
}

function enumValue(options, value) {
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (/^0x[0-9a-f]+$/i.test(text)) return Number.parseInt(text.slice(2), 16);
  if (/^-?\d+$/.test(text)) return Number.parseInt(text, 10);
  const found = options.find(([, label]) => String(label).toLowerCase() === text.toLowerCase());
  if (!found) throw new Error(`Unknown option ${JSON.stringify(value)}; expected ${options.map(([, label]) => label).join(", ")}`);
  return found[0];
}

function isWritableFrequency(value) {
  const mhz = Number(value);
  return Number.isFinite(mhz) && ((mhz >= 136 && mhz <= 174) || (mhz >= 220 && mhz <= 260) || (mhz >= 360 && mhz <= 520));
}

function isPrintableAscii(value) {
  return Array.from(String(value)).every((char) => {
    const code = char.charCodeAt(0);
    return code >= 0x20 && code <= 0x7e;
  });
}

function emitYaml(value, indent = 0) {
  if (Array.isArray(value)) {
    if (!value.length) return "[]\n";
    return value.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const entries = Object.entries(item);
        if (!entries.length) return `${" ".repeat(indent)}- {}\n`;
        const [firstKey, firstValue] = entries[0];
        let out = `${" ".repeat(indent)}- ${firstKey}: ${formatScalar(firstValue)}\n`;
        for (const [key, child] of entries.slice(1)) out += emitMapEntry(key, child, indent + 2);
        return out;
      }
      return `${" ".repeat(indent)}- ${formatScalar(item)}\n`;
    }).join("");
  }
  if (value && typeof value === "object") return Object.entries(value).map(([key, child]) => emitMapEntry(key, child, indent)).join("");
  return `${formatScalar(value)}\n`;
}

function emitMapEntry(key, value, indent) {
  if (Array.isArray(value) || (value && typeof value === "object")) return `${" ".repeat(indent)}${key}:\n${emitYaml(value, indent + 2)}`;
  return `${" ".repeat(indent)}${key}: ${formatScalar(value)}\n`;
}

function formatScalar(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = String(value);
  if (!text) return "\"\"";
  if (/^[A-Za-z0-9_.+/-]+$/.test(text) && !/^(true|false|null|yes|no|on|off)$/i.test(text)) return text;
  return JSON.stringify(text);
}

function parseYaml(text) {
  const lines = text.split(/\r?\n/).map((line) => ({ indent: line.match(/^ */)[0].length, text: stripComment(line).trimEnd() })).filter((line) => line.text.trim());
  if (!lines.length) return {};
  const [value, index] = parseYamlBlock(lines, 0, lines[0].indent);
  if (index !== lines.length) throw new Error(`Could not parse YAML near: ${lines[index].text}`);
  return value;
}

function parseYamlBlock(lines, index, indent) {
  return lines[index].text.trimStart().startsWith("- ") ? parseYamlList(lines, index, indent) : parseYamlMap(lines, index, indent);
}

function parseYamlMap(lines, index, indent) {
  const out = {};
  while (index < lines.length && lines[index].indent === indent && !lines[index].text.trimStart().startsWith("- ")) {
    const line = lines[index].text.trim();
    const colon = line.indexOf(":");
    if (colon < 0) throw new Error(`Expected key: value, got ${line}`);
    const key = line.slice(0, colon).trim();
    const raw = line.slice(colon + 1).trim();
    if (raw) {
      out[key] = parseScalar(raw);
      index += 1;
    } else {
      const nextIndent = lines[index + 1]?.indent;
      if (nextIndent === undefined || nextIndent <= indent) {
        out[key] = {};
        index += 1;
      } else [out[key], index] = parseYamlBlock(lines, index + 1, nextIndent);
    }
  }
  return [out, index];
}

function parseYamlList(lines, index, indent) {
  const out = [];
  while (index < lines.length && lines[index].indent === indent && lines[index].text.trimStart().startsWith("- ")) {
    const rest = lines[index].text.trimStart().slice(2).trim();
    if (rest.includes(":")) {
      const colon = rest.indexOf(":");
      const item = {};
      item[rest.slice(0, colon).trim()] = rest.slice(colon + 1).trim() ? parseScalar(rest.slice(colon + 1).trim()) : {};
      index += 1;
      while (index < lines.length && lines[index].indent > indent) {
        const [child, next] = parseYamlMap(lines, index, lines[index].indent);
        Object.assign(item, child);
        index = next;
      }
      out.push(item);
    } else {
      out.push(parseScalar(rest));
      index += 1;
    }
  }
  return [out, index];
}

function parseScalar(value) {
  const text = value.trim();
  if (!text) return "";
  if (text === "[]" || text === "{}") return text === "[]" ? [] : {};
  if (text === "null") return null;
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) return text.startsWith("\"") ? JSON.parse(text) : text.slice(1, -1).replace(/''/g, "'");
  return text;
}

function stripComment(line) {
  let quote = "";
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === quote && line[index - 1] !== "\\") quote = "";
    } else if (char === "\"" || char === "'") quote = char;
    else if (char === "#") return line.slice(0, index);
  }
  return line;
}

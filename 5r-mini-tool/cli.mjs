#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  clearAllChannels,
  cloneBlocks,
  formatMemoryJson,
  getChannelCapacity,
  getDtmfEncoderSettings,
  getMembers,
  getSettings,
  getVfos,
  parseChannel,
  updateChannelField,
  updateMemoryField,
  validateBlocks
} from "./js/memory.mjs";
import { BASIC_SETTINGS, STEPS } from "./js/protocol.mjs";

const CHANNEL_FIELDS = ["name", "rx", "tx", "rxTone", "txTone", "power", "width", "scan", "signaling", "dtmfEncoder", "jmpFreq", "pttId", "bcl", "fhss"];
const CHANNEL_ALIASES = { dtmf: "dtmfEncoder", jump: "jmpFreq", ptt: "pttId", signal: "signaling" };
const CHANNEL_ENUMS = {
  power: [[0, "High"], [1, "Low"]],
  width: [[0, "Wide"], [1, "Narrow"]],
  scan: [[0, "No"], [1, "Yes"]],
  dtmfEncoder: [[0, "Off"], [1, "On"]],
  jmpFreq: [[0, "Off"], [1, "On"]],
  pttId: [[0, "Off"], [1, "Begin"], [2, "End"], [3, "Both"]],
  bcl: [[0, "Off"], [1, "On"]],
  fhss: [[0, "Off"], [1, "On"]]
};
const VFO_FIELDS = ["mhz", "rxTone", "txTone", "direction", "step", "offset", "power", "width", "signaling", "muteWay", "jmpFreq", "pttId", "busyLock"];
const VFO_ENUMS = {
  direction: [[0, "Off"], [1, "+"], [2, "-"]],
  step: STEPS.map((label, value) => [value, label]),
  power: [[0, "High"], [1, "Low"]],
  width: [[0, "Wide"], [1, "Narrow"]],
  muteWay: [[0, "Off"], [1, "On"]],
  jmpFreq: [[0, "Off"], [1, "On"]],
  pttId: [[0, "Off"], [1, "Begin"], [2, "End"], [3, "Both"]],
  busyLock: [[0, "Off"], [1, "On"]]
};
const PROVISION_CHANNEL_DEFAULTS = {
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

main();

function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  try {
    if (command === "dump") dumpCommand(args);
    else if (command === "apply") applyCommand(args);
    else if (command === "ble-dump") runBleCommand("dump", args);
    else if (command === "ble-write") runBleCommand("write", args);
    else if (command === "ble") runBleAlias(args);
    else usage(command ? `Unknown command: ${command}` : "");
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}

function runBleAlias(args) {
  const subcommand = args.shift();
  if (subcommand === "dump" || subcommand === "read") runBleCommand("dump", args);
  else if (subcommand === "write") runBleCommand("write", args);
  else usage(subcommand ? `Unknown BLE command: ${subcommand}` : "ble needs dump, read, or write");
}

function runBleCommand(command, args) {
  const script = fileURLToPath(new URL("./ble_cli.py", import.meta.url));
  const runner = process.env.PYTHON || "uv";
  const runnerArgs = process.env.PYTHON ? [script, command, ...args] : ["run", "--script", script, command, ...args];
  const result = spawnSync(runner, runnerArgs, { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? (result.signal ? 1 : 0));
}

function dumpCommand(args) {
  const { positional, options } = parseArgs(args);
  if (positional.length !== 1) usage("dump needs one memory JSON path");
  const blocks = readMemoryJson(positional[0]);
  const config = options.provision ? buildProvisionConfig(blocks, Boolean(options["all-channels"])) : buildConfig(blocks, Boolean(options["all-channels"]));
  writeOutput(options.output || options.o, emitYaml(config));
}

function applyCommand(args) {
  const { positional, options } = parseArgs(args);
  if (positional.length !== 2) usage("apply needs memory JSON and YAML config paths");
  const blocks = readMemoryJson(positional[0]);
  const config = parseYaml(fs.readFileSync(positional[1], "utf8"));
  const next = applyConfig(blocks, normalizeProvisionConfig(config));
  writeOutput(options.output || options.o, `${formatMemoryJson(next)}\n`);
}

function buildConfig(blocks, includeAllChannels) {
  const channels = [];
  for (let index = 0; index < getChannelCapacity(); index += 1) {
    const channel = parseChannel(blocks, index);
    if (!includeAllChannels && channel.empty) continue;
    const row = {
      slot: channel.channel + 1,
      name: channel.name,
      rxTone: channel.rxTone,
      txTone: channel.txTone,
      power: enumLabel(CHANNEL_ENUMS.power, channel.power),
      width: enumLabel(CHANNEL_ENUMS.width, channel.width),
      scan: enumLabel(CHANNEL_ENUMS.scan, channel.scan),
      signaling: channel.signaling,
      dtmfEncoder: enumLabel(CHANNEL_ENUMS.dtmfEncoder, normalizeToggle(channel.dtmfEncoder)),
      jmpFreq: enumLabel(CHANNEL_ENUMS.jmpFreq, normalizeToggle(channel.jmpFreq)),
      pttId: enumLabel(CHANNEL_ENUMS.pttId, channel.pttId),
      bcl: enumLabel(CHANNEL_ENUMS.bcl, channel.bcl),
      fhss: enumLabel(CHANNEL_ENUMS.fhss, channel.fhss)
    };
    if (!channel.rx || isWritableFrequency(channel.rx)) row.rx = channel.rx;
    if (!channel.tx || isWritableFrequency(channel.tx)) row.tx = channel.tx;
    channels.push(row);
  }
  return {
    model: "5r-mini",
    channels,
    vfo: getVfos(blocks).map((vfo) => ({
      side: vfo.side,
      mhz: vfo.mhz,
      rxTone: vfo.rxTone,
      txTone: vfo.txTone,
      direction: enumLabel(VFO_ENUMS.direction, vfo.direction),
      step: enumLabel(VFO_ENUMS.step, vfo.step),
      offset: vfo.offset,
      power: enumLabel(VFO_ENUMS.power, vfo.power),
      width: enumLabel(VFO_ENUMS.width, vfo.width),
      signaling: vfo.signaling,
      muteWay: enumLabel(VFO_ENUMS.muteWay, vfo.muteWay),
      jmpFreq: enumLabel(VFO_ENUMS.jmpFreq, vfo.jmpFreq),
      pttId: enumLabel(VFO_ENUMS.pttId, vfo.pttId),
      busyLock: enumLabel(VFO_ENUMS.busyLock, vfo.busyLock)
    })),
    settings: Object.fromEntries(getSettings(blocks).map((setting) => [setting.key, settingToYamlValue(setting)])),
    dtmf: Object.fromEntries(Object.entries(getDtmfEncoderSettings(blocks)).map(([key, setting]) => [key, setting.value])),
    members: getMembers(blocks).map((member) => {
      const row = { slot: member.index + 1, code: member.code };
      if (isPrintableAscii(member.name)) row.name = member.name;
      return row;
    })
  };
}

function settingToYamlValue(setting) {
  if (setting.key === "workMode") {
    return { sideA: enumLabel([[0, "Frequency"], [1, "Channel"]], setting.value & 0x0f), sideB: enumLabel([[0, "Frequency"], [1, "Channel"]], (setting.value >> 4) & 0x0f) };
  }
  return setting.options ? enumLabel(setting.options, setting.value) : setting.value;
}

function buildProvisionConfig(blocks, includeAllChannels) {
  const frequencies = [];
  for (let index = 0; index < getChannelCapacity(); index += 1) {
    const channel = parseChannel(blocks, index);
    if (!includeAllChannels && channel.empty) continue;
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
      dtmf: enumLabel(CHANNEL_ENUMS.dtmfEncoder, normalizeToggle(channel.dtmfEncoder)),
      ptt: enumLabel(CHANNEL_ENUMS.pttId, channel.pttId)
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
    frequencies.push(row);
  }
  return {
    model: "5r-mini",
    clearChannels: false,
    defaults: {
      channel: PROVISION_CHANNEL_DEFAULTS
    },
    settings: Object.fromEntries(getSettings(blocks).map((setting) => [setting.key, settingToYamlValue(setting)])),
    frequencies,
    members: getMembers(blocks).map((member) => {
      const row = { slot: member.index + 1, code: member.code };
      if (isPrintableAscii(member.name)) row.name = member.name;
      return row;
    })
  };
}

function normalizeProvisionConfig(config) {
  if (!Array.isArray(config.frequencies)) return config;
  const defaults = config.defaults && typeof config.defaults === "object" && config.defaults.channel && typeof config.defaults.channel === "object" ? { ...PROVISION_CHANNEL_DEFAULTS, ...config.defaults.channel } : PROVISION_CHANNEL_DEFAULTS;
  return {
    ...config,
    channels: config.frequencies.map((frequency) => provisionChannelToChannel({ ...defaults, ...frequency })),
    vfo: config.vfo,
    dtmf: config.dtmf,
    members: config.members,
    settings: config.settings
  };
}

function provisionChannelToChannel(row) {
  const slot = row.slot ?? row.channel;
  if (slot === undefined) throw new Error("Provision frequency entry needs slot");
  const out = { slot };
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
  if (row.frequency !== undefined) {
    out.rx = row.frequency;
    out.tx = row.frequency;
  }
  if (row.rx !== undefined) out.rx = row.rx;
  if (row.tx !== undefined) out.tx = row.tx;
  if (row.tone !== undefined) {
    out.rxTone = row.tone;
    out.txTone = row.tone;
  }
  Object.entries(mapping).forEach(([from, to]) => {
    if (row[from] !== undefined) out[to] = row[from];
  });
  return out;
}

function applyConfig(blocks, config) {
  const next = cloneBlocks(blocks);
  if (config.clearChannels === true) clearAllChannels(next);
  if (Array.isArray(config.channels)) {
    config.channels.forEach((channel) => {
      const slot = Number(channel.slot);
      if (!Number.isInteger(slot) || slot < 1 || slot > getChannelCapacity()) throw new Error(`Bad channel slot: ${channel.slot}`);
      Object.entries(channel).forEach(([rawKey, rawValue]) => {
        if (rawKey === "slot" || rawValue === undefined || rawValue === null) return;
        const key = CHANNEL_ALIASES[rawKey] || rawKey;
        if (!CHANNEL_FIELDS.includes(key)) throw new Error(`Unknown channel field: ${rawKey}`);
        const value = CHANNEL_ENUMS[key] ? enumValue(CHANNEL_ENUMS[key], rawValue) : rawValue;
        try {
          updateChannelField(next, slot - 1, key, String(value));
        } catch (error) {
          throw new Error(`Channel ${slot} ${key}: ${error.message}`);
        }
      });
    });
  }
  if (Array.isArray(config.vfo)) {
    config.vfo.forEach((vfo) => {
      const addr = String(vfo.side || "").toUpperCase() === "A" ? 0x8000 : String(vfo.side || "").toUpperCase() === "B" ? 0x8020 : null;
      if (addr === null) throw new Error(`Bad VFO side: ${vfo.side}`);
      Object.entries(vfo).forEach(([key, rawValue]) => {
        if (key === "side" || rawValue === undefined || rawValue === null) return;
        if (!VFO_FIELDS.includes(key)) throw new Error(`Unknown VFO field: ${key}`);
        applyVfoField(next, addr, key, rawValue);
      });
    });
  }
  if (config.settings && typeof config.settings === "object") applySettings(next, config.settings);
  if (config.dtmf && typeof config.dtmf === "object") applyDtmf(next, config.dtmf);
  if (Array.isArray(config.members)) applyMembers(next, config.members);
  validateBlocks(next);
  return next;
}

function applyVfoField(blocks, addr, key, rawValue) {
  const value = VFO_ENUMS[key] ? enumValue(VFO_ENUMS[key], rawValue) : rawValue;
  const offsets = { mhz: 0, rxTone: 8, txTone: 10, signaling: 12, muteWay: 13, jmpFreq: 14, pttId: 15, busyLock: 16, direction: 18, step: 19, offset: 20, power: 26, width: 27 };
  const kinds = { mhz: "vfoFreq", rxTone: "tone16", txTone: "tone16", offset: "vfoOffset" };
  updateMemoryField(blocks, kinds[key] || "byte", addr + offsets[key], String(value));
}

function applySettings(blocks, settings) {
  const settingsByKey = new Map(BASIC_SETTINGS.map((setting) => [setting.key, setting]));
  Object.entries(settings).forEach(([key, rawValue]) => {
    const setting = settingsByKey.get(key);
    if (!setting) throw new Error(`Unknown setting: ${key}`);
    if (setting.kind === "workModePair") {
      if (typeof rawValue === "object" && rawValue !== null) {
        const sideA = enumValue([[0, "Frequency"], [1, "Channel"]], rawValue.sideA ?? rawValue.a ?? 0);
        const sideB = enumValue([[0, "Frequency"], [1, "Channel"]], rawValue.sideB ?? rawValue.b ?? 0);
        updateMemoryField(blocks, "byte", setting.addr, String((sideB << 4) | sideA));
      } else updateMemoryField(blocks, "byte", setting.addr, String(rawValue));
      return;
    }
    const value = setting.options ? enumValue(setting.options, rawValue) : rawValue;
    updateMemoryField(blocks, setting.kind === "word16" ? "word16" : "byte", setting.addr, String(value));
  });
}

function applyDtmf(blocks, dtmf) {
  const current = getDtmfEncoderSettings(blocks);
  Object.entries(dtmf).forEach(([key, rawValue]) => {
    const setting = current[key];
    if (!setting) throw new Error(`Unknown DTMF setting: ${key}`);
    const value = setting.options ? enumValue(setting.options, rawValue) : rawValue;
    updateMemoryField(blocks, setting.kind === "dtmfSequence" ? "dtmfSequence" : "byte", setting.addr, String(value), setting.length || 1);
  });
}

function applyMembers(blocks, members) {
  members.forEach((member) => {
    const slot = Number(member.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 20) throw new Error(`Bad member slot: ${member.slot}`);
    const addr = 0xa020 + (slot - 1) * 16;
    if (member.code !== undefined) updateMemoryField(blocks, "dtmfSequence", addr, String(member.code), 5);
    if (member.name !== undefined) updateMemoryField(blocks, "memberName", addr + 5, String(member.name), 10);
  });
}

function readMemoryJson(file) {
  const blocks = JSON.parse(fs.readFileSync(file, "utf8"));
  validateBlocks(blocks);
  return blocks;
}

function parseArgs(args) {
  const positional = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-o" || arg === "--output") options[arg.replace(/^-+/, "")] = args[++index];
    else if (arg === "--all-channels") options["all-channels"] = true;
    else if (arg === "--provision") options.provision = true;
    else if (arg === "-h" || arg === "--help") usage("");
    else positional.push(arg);
  }
  return { positional, options };
}

function writeOutput(file, text) {
  if (!file || file === "-") process.stdout.write(text);
  else fs.writeFileSync(file, text);
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

function normalizeToggle(value) {
  return value === 0xff ? 0 : value;
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
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, child]) => emitMapEntry(key, child, indent)).join("");
  }
  return `${formatScalar(value)}\n`;
}

function emitMapEntry(key, value, indent) {
  if (Array.isArray(value) || (value && typeof value === "object")) {
    const nested = emitYaml(value, indent + 2);
    return `${" ".repeat(indent)}${key}:\n${nested}`;
  }
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
  const [value, index] = parseYamlBlock(lines, 0, lines[0]?.indent || 0);
  if (index !== lines.length) throw new Error(`Could not parse YAML near: ${lines[index].text}`);
  return value;
}

function parseYamlBlock(lines, index, indent) {
  if (!lines[index]) return [{}, index];
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
      } else {
        [out[key], index] = parseYamlBlock(lines, index + 1, nextIndent);
      }
    }
  }
  return [out, index];
}

function parseYamlList(lines, index, indent) {
  const out = [];
  while (index < lines.length && lines[index].indent === indent && lines[index].text.trimStart().startsWith("- ")) {
    const rest = lines[index].text.trimStart().slice(2).trim();
    if (!rest) {
      const nextIndent = lines[index + 1]?.indent;
      let value;
      [value, index] = parseYamlBlock(lines, index + 1, nextIndent);
      out.push(value);
    } else if (rest.includes(":")) {
      const colon = rest.indexOf(":");
      const item = {};
      const key = rest.slice(0, colon).trim();
      const raw = rest.slice(colon + 1).trim();
      item[key] = raw ? parseScalar(raw) : {};
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
  if (text === "[]") return [];
  if (text === "{}") return {};
  if (text === "null") return null;
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.startsWith("\"") ? JSON.parse(text) : text.slice(1, -1).replace(/''/g, "'");
  }
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

function usage(message) {
  if (message) console.error(`error: ${message}\n`);
  console.error(`Usage:
  node outputs/5r-mini-tool/cli.mjs dump <memory.json> [-o config.yaml] [--all-channels] [--provision]
  node outputs/5r-mini-tool/cli.mjs apply <memory.json> <config.yaml> [-o memory-updated.json]
  node outputs/5r-mini-tool/cli.mjs ble-dump -o memory.bin|memory.json [--format raw|json]
  node outputs/5r-mini-tool/cli.mjs ble-write <memory.bin|memory.json> [--target all|first|channels|settings]

BLE commands use uv script metadata to install Python BLE dependencies.`);
  process.exit(message ? 1 : 0);
}

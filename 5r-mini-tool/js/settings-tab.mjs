import { html } from "./preact.mjs?v=ani-sync";
import { getRawBasicSettings, getSettings, updateMemoryField } from "./memory.mjs?v=ani-sync";
import { MemoryInput } from "./components.mjs?v=ani-sync";

export function SettingsTab({ blocks, updateBlocks }) {
  const settings = getSettings(blocks);
  const groups = [
    ["Receive & Audio", ["squelch", "voxSwitch", "vox", "voxDelay", "beep", "voiceSwitch", "voice", "sideTone"]],
    ["Display & Keys", ["backlight", "channelADisplay", "channelBDisplay", "autoLock", "keyLock", "resetMenu", "sideKeyShort", "powerOnDisplay", "menuQuit"]],
    ["Transmit & Scan", ["timeout", "totAlarm", "scanMode", "vfoScanStart", "vfoScanEnd", "pttId", "pttDelay", "bcl", "tailClear", "repeaterTailClear", "repeaterTailDelay", "rTone", "roger"]],
    ["Other Radio Features", ["save", "dualWatch", "alarmMode", "alarmTone", "fmEnable", "workMode", "qtSave", "unknown9039"]]
  ].map(([title, keys]) => ({ title, settings: keys.map((key) => settings.find((s) => s.key === key)).filter(Boolean) }));
  const rawSettings = getRawBasicSettings(blocks);
  if (rawSettings.length) groups.push({ title: "Advanced Raw Bytes", settings: rawSettings });
  return html`<section><div class="section-head"><div><h2>Settings</h2><p>Radio behavior stored in the memory image. Changes are local until Write.</p></div></div><div class="settings-layout">${groups.map((group) => html`<div class="settings-group"><div class="settings-group-head"><h3>${group.title}</h3><span class="pill">${group.settings.length}</span></div><div class="settings-list">${group.settings.map((setting) => html`<div class=${`setting-card ${setting.kind === "workModePair" ? "setting-card-wide" : ""}`}><div class="setting-card-top"><strong>${setting.label}</strong><${SettingValue} setting=${setting} updateBlocks=${updateBlocks} /></div><p>${setting.description}</p>${setting.help ? html`<ul class="setting-help">${setting.help.map((item) => html`<li>${item}</li>`)}</ul>` : null}</div>`)}</div></div>`)}</div></section>`;
}

function SettingValue({ setting, updateBlocks }) {
  if (setting.kind === "workModePair") {
    const sideA = setting.value & 0x0f;
    const sideB = (setting.value >> 4) & 0x0f;
    const setSide = (side, value) => {
      const next = side === "a" ? ((sideB << 4) | Number(value)) : ((Number(value) << 4) | sideA);
      updateBlocks((b) => updateMemoryField(b, "byte", setting.addr, String(next)));
    };
    return html`<div class="workmode-control">
      <label><span>Side A</span><select value=${sideA} onChange=${(e) => setSide("a", e.target.value)}>${workModeOptions(sideA)}</select></label>
      <label><span>Side B</span><select value=${sideB} onChange=${(e) => setSide("b", e.target.value)}>${workModeOptions(sideB)}</select></label>
    </div>`;
  }
  if (setting.options) {
    return html`<select value=${setting.value} onChange=${(e) => updateBlocks((b) => updateMemoryField(b, setting.kind === "word16" ? "word16" : "byte", setting.addr, e.target.value))}>
      ${setting.options.some(([value]) => value === setting.value) ? null : html`<option value=${setting.value}>Raw ${setting.value}</option>`}
      ${setting.options.map(([value, label]) => html`<option value=${value}>${label}</option>`)}
    </select>`;
  }
  return html`<${MemoryInput} value=${setting.textValue} kind=${setting.kind === "hex" ? "byteHex" : setting.kind === "word16" ? "word16" : "byte"} addr=${setting.addr} updateBlocks=${updateBlocks} />`;
}

function workModeOptions(value) {
  return html`
    ${[0, 1].includes(value) ? null : html`<option value=${value}>Raw ${value}</option>`}
    <option value=${0}>Frequency</option>
    <option value=${1}>Channel</option>
  `;
}

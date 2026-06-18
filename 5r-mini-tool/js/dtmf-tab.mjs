import { html } from "./preact.mjs?v=ani-sync";
import { getDtmfEncoderSettings, getMembers, labelMembers, updateMemoryField } from "./memory.mjs?v=ani-sync";
import { Input, MemoryInput } from "./components.mjs?v=ani-sync";

export function DtmfTab({ blocks, updateBlocks, memberPrefix, setMemberPrefix, memberStartId, setMemberStartId, setStatus }) {
  const encoderSettings = getDtmfEncoderSettings(blocks);
  const encoderKeys = ["aniCode", "onTime", "offTime", "hangupTime", "separator", "groupCallCode", "onlineCode", "offlineCode"];
  const memberColumns = [
    ["#", "DTMF member slot number, 1 through 20."],
    ["DTMF ID", "Five-byte DTMF contact ID used for selective calling."],
    ["Name", "Ten-byte contact label. Editing writes ASCII bytes."],
    ["Manual Call", "Copy the member ID for manual testing."]
  ];
  return html`<section><h2>DTMF / Offline Members</h2><div class="grid" style="margin-bottom:12px"><${Input} label="Member Prefix" value=${memberPrefix} onInput=${(e) => setMemberPrefix(e.target.value)} /><${Input} label="First DTMF ID" value=${memberStartId} onInput=${(e) => setMemberStartId(e.target.value)} /></div><div class="actions" style="margin-bottom:12px"><button class="secondary" onClick=${() => { updateBlocks((b) => labelMembers(b, memberPrefix || "R", Number(memberStartId || 101))); setStatus(`Labeled 20 radios from DTMF ${memberStartId}`, "ok"); }}>Label 20 Radios</button></div><div class="settings-group dtmf-settings"><div class="settings-group-head"><h3>DTMF Encoder Settings</h3><span class="pill">A000/A180</span></div><p class="dtmf-guide">DTMF sends short keypad tones over RF. Use member IDs for selective calling; enable PTT ID on a channel or VFO to send the ANI/ID tone burst automatically.</p><div class="settings-list">${encoderKeys.map((key) => html`<div class="setting-card"><div class="setting-card-top"><strong>${encoderSettings[key].label}</strong><${DtmfSettingInput} setting=${encoderSettings[key]} updateBlocks=${updateBlocks} /></div><p>${dtmfSettingHelp[key]}</p></div>`)}</div></div><div class="table-wrap mini-table" style="margin-top:12px"><table><thead><tr>${memberColumns.map(([label, tooltip]) => html`<th title=${tooltip}>${label}</th>`)}</tr></thead><tbody>${getMembers(blocks).map((m) => html`<tr><td>${m.index + 1}</td><td><${MemoryInput} value=${m.code} kind="dtmfCode" addr=${m.addr} length=${5} updateBlocks=${updateBlocks} /></td><td><${MemoryInput} value=${m.name} kind="memberName" addr=${m.nameAddr} length=${10} updateBlocks=${updateBlocks} /></td><td><button class="secondary" onClick=${() => navigator.clipboard?.writeText(m.code).then(() => setStatus(`Copied DTMF ${m.code}`, "ok"))}>Copy</button></td></tr>`)}</tbody></table></div></section>`;
}

const dtmfSettingHelp = {
  aniCode: "Your radio ID sent by PTT ID modes.",
  onTime: "Duration of each DTMF tone.",
  offTime: "Pause between DTMF tones.",
  hangupTime: "How long the radio waits before ending a DTMF call state.",
  separator: "Key used between ID parts when the firmware supports separated codes.",
  groupCallCode: "Wildcard/group-call key for calling more than one matching ID.",
  onlineCode: "Code sent for online/presence signaling.",
  offlineCode: "Code sent for offline/leave signaling."
};

function DtmfSettingInput({ setting, updateBlocks }) {
  if (setting.options) {
    return html`<select value=${setting.value} onChange=${(e) => updateBlocks((b) => updateMemoryField(b, "byte", setting.addr, e.target.value))}>
      ${setting.options.some(([value]) => value === setting.value) ? null : html`<option value=${setting.value}>Raw ${setting.value}</option>`}
      ${setting.options.map(([value, label]) => html`<option value=${value}>${label}</option>`)}
    </select>`;
  }
  return html`<${MemoryInput} value=${setting.value} kind=${setting.kind} addr=${setting.addr} length=${setting.length} updateBlocks=${updateBlocks} />`;
}

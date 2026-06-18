import { html } from "./preact.mjs?v=ani-sync";
import { STEPS } from "./protocol.mjs?v=ani-sync";
import { getVfos, updateMemoryField } from "./memory.mjs?v=ani-sync";
import { MemoryInput, ValueSelect } from "./components.mjs?v=ani-sync";

export function VfoTab({ blocks, updateBlocks }) {
  const columns = [
    ["Side", "VFO side A or B."],
    ["MHz", "VFO receive/transmit frequency in MHz."],
    ["RX Tone", "CTCSS/DCS tone required to open receive audio."],
    ["TX Tone", "CTCSS/DCS tone sent while transmitting."],
    ["Dir", "Repeater offset direction: off, plus, or minus."],
    ["Step", "Frequency tuning step size."],
    ["Offset", "Repeater offset amount in MHz."],
    ["Power", "Transmit power level for this VFO."],
    ["Width", "FM bandwidth: wide or narrow."],
    ["Signal", "VFO signaling code, usually unset or 1-20."],
    ["Mute", "VFO mute/signaling behavior byte."],
    ["Jump", "Jump-frequency toggle for VFO mode."],
    ["PTT", "PTT ID behavior for automatic ANI/DTMF ID sending."],
    ["BCL", "Busy channel lockout; blocks TX while busy."]
  ];
  return html`<section><h2>VFO / Frequency Mode</h2><div class="table-wrap mini-table"><table><thead><tr>${columns.map(([label, tooltip]) => html`<th title=${tooltip}>${label}</th>`)}</tr></thead><tbody>${getVfos(blocks).map((vfo) => html`<tr><td>${vfo.side}</td><td><${MemoryInput} value=${vfo.mhz} kind="vfoFreq" addr=${vfo.addr} length=${0} updateBlocks=${updateBlocks} /></td><td><${MemoryInput} value=${vfo.rxTone} kind="tone16" addr=${vfo.addr + 8} updateBlocks=${updateBlocks} /></td><td><${MemoryInput} value=${vfo.txTone} kind="tone16" addr=${vfo.addr + 10} updateBlocks=${updateBlocks} /></td><td><${ValueSelect} value=${vfo.direction} options=${[[0, "Off"], [1, "+"], [2, "-"]]} onChange=${(v) => updateBlocks((b) => updateMemoryField(b, "byte", vfo.addr + 18, v))} /></td><td><select value=${vfo.step} onChange=${(e) => updateBlocks((b) => updateMemoryField(b, "byte", vfo.addr + 19, e.target.value))}>${STEPS.map((s, i) => html`<option value=${i}>${s}</option>`)}</select></td><td><${MemoryInput} value=${vfo.offset} kind="vfoOffset" addr=${vfo.addr + 20} updateBlocks=${updateBlocks} /></td><td><${ValueSelect} value=${vfo.power} options=${[[0, "High"], [1, "Low"]]} onChange=${(v) => updateBlocks((b) => updateMemoryField(b, "byte", vfo.addr + 26, v))} /></td><td><${ValueSelect} value=${vfo.width} options=${[[0, "Wide"], [1, "Narrow"]]} onChange=${(v) => updateBlocks((b) => updateMemoryField(b, "byte", vfo.addr + 27, v))} /></td><td><${MemoryInput} value=${vfo.signaling} kind="byte" addr=${vfo.addr + 12} updateBlocks=${updateBlocks} /></td><td><${ValueSelect} value=${vfo.muteWay} options=${[[0, "Off"], [1, "On"]]} onChange=${(v) => updateBlocks((b) => updateMemoryField(b, "byte", vfo.addr + 13, v))} /></td><td><${ValueSelect} value=${vfo.jmpFreq} options=${[[0, "Off"], [1, "On"]]} onChange=${(v) => updateBlocks((b) => updateMemoryField(b, "byte", vfo.addr + 14, v))} /></td><td><${ValueSelect} value=${vfo.pttId} options=${[[0, "Off"], [1, "Begin"], [2, "End"], [3, "Both"]]} onChange=${(v) => updateBlocks((b) => updateMemoryField(b, "byte", vfo.addr + 15, v))} /></td><td><${ValueSelect} value=${vfo.busyLock} options=${[[0, "Off"], [1, "On"]]} onChange=${(v) => updateBlocks((b) => updateMemoryField(b, "byte", vfo.addr + 16, v))} /></td></tr>`)}</tbody></table></div></section>`;
}

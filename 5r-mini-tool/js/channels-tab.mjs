import { html, useEffect, useMemo, useRef, useState } from "./preact.mjs?v=ani-sync";
import { clearAllChannels, clearChannel, cloneBlocks, getChannelCapacity, parseChannel, updateChannelField } from "./memory.mjs?v=ani-sync";
import { Input, Select, ValueSelect } from "./components.mjs?v=ani-sync";

export function ChannelsTab({ blocks, setBlocks, pageStart, setPageStart }) {
  const signalOptions = [[0, "Off"], ...Array.from({ length: 20 }, (_, index) => [index + 1, `Member ${index + 1}`])];
  const pttOptions = [[0, "Off"], [1, "Begin"], [2, "End"], [3, "Both"]];
  const columns = [
    ["#", "Memory slot number."],
    ["Name", "ASCII channel label stored in the channel record."],
    ["RX MHz", "Receive frequency in MHz."],
    ["TX MHz", "Transmit frequency in MHz."],
    ["Power", "Transmit power level for this channel."],
    ["Width", "FM bandwidth: wide or narrow."],
    ["Scan", "Whether this channel participates in scan lists."],
    ["RX Tone", "CTCSS/DCS tone required to open receive audio."],
    ["TX Tone", "CTCSS/DCS tone sent while transmitting."],
    ["Signal", "Channel signaling code, 0 or 1-20 DTMF encoder slot."],
    ["DTMF", "Enable this channel's DTMF encoder behavior."],
    ["Jump", "Jump-frequency toggle stored in the channel record."],
    ["PTT", "PTT ID behavior for automatic ANI/DTMF ID sending."],
    ["BCL", "Busy channel lockout; blocks TX while the channel is busy."],
    ["FHSS", "Frequency hopping toggle if supported by firmware."]
  ];
  const count = getChannelCapacity();
  const rowHeight = 30;
  const overscan = 14;
  const scrollerRef = useRef(null);
  const frameRef = useRef(0);
  const rangeRef = useRef({ start: 0, end: 41 });
  const [range, setRange] = useState({ start: 0, end: 41 });
  const [jumpSlot, setJumpSlot] = useState(String(pageStart + 1));
  const start = range.start;
  const end = range.end;
  const topPad = start * rowHeight;
  const bottomPad = Math.max(0, (count - end) * rowHeight);
  const channels = useMemo(() => Array.from({ length: end - start }, (_, i) => parseChannel(blocks, start + i)), [blocks, start, end]);
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const update = () => {
      const nextStart = Math.max(0, Math.floor(node.scrollTop / rowHeight) - overscan);
      const visibleCount = Math.ceil((node.clientHeight || 520) / rowHeight) + overscan * 2;
      const nextEnd = Math.min(count, nextStart + visibleCount);
      const previous = rangeRef.current;
      if (previous.start !== nextStart || previous.end !== nextEnd) {
        const next = { start: nextStart, end: nextEnd };
        rangeRef.current = next;
        setRange(next);
      }
    };
    const scheduleUpdate = () => {
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        update();
      });
    };
    update();
    node.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      node.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", update);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);
  useEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTop = pageStart * rowHeight;
    setJumpSlot(String(pageStart + 1));
  }, [pageStart]);
  const change = (channel, field, value) => setBlocks((old) => { const next = cloneBlocks(old); updateChannelField(next, channel, field, value); return next; });
  const jumpIndex = () => Math.max(0, Math.min(count - 1, Number(jumpSlot || 1) - 1));
  const clearJumpChannel = () => {
    const index = jumpIndex();
    setBlocks((old) => { const next = cloneBlocks(old); clearChannel(next, index); return next; });
  };
  const clearEveryChannel = () => {
    setBlocks((old) => { const next = cloneBlocks(old); clearAllChannels(next); return next; });
    setPageStart(0);
  };
  return html`<section><h2>Channels</h2><div class="pager"><label>Jump to slot<input type="number" min="1" max=${count} value=${jumpSlot} onInput=${(e) => setJumpSlot(e.target.value)} onKeyDown=${(e) => { if (e.key === "Enter") setPageStart(jumpIndex()); }} /></label><button class="secondary" type="button" onClick=${() => setPageStart(jumpIndex())}>Jump</button><button class="secondary" type="button" onClick=${clearJumpChannel}>Clear Slot</button><button class="danger" type="button" onClick=${clearEveryChannel}>Clear All Channels</button></div><div class="table-wrap" ref=${scrollerRef}><table class="channels-table"><thead><tr>${columns.map(([label, tooltip]) => html`<th title=${tooltip}>${label}</th>`)}</tr></thead><tbody><tr class="virtual-spacer" style=${`height:${topPad}px`}><td colspan="15"></td></tr>${channels.map((ch) => html`<tr class="channel-row" style=${`height:${rowHeight}px`}><td>${ch.channel + 1}</td><td><input class="name" defaultValue=${ch.name} onChange=${(e) => change(ch.channel, "name", e.target.value)} /></td><td><input defaultValue=${ch.rx} onChange=${(e) => change(ch.channel, "rx", e.target.value)} /></td><td><input defaultValue=${ch.tx} onChange=${(e) => change(ch.channel, "tx", e.target.value)} /></td><td><${Select} value=${ch.power} labels=${["High", "Low"]} onChange=${(v) => change(ch.channel, "power", v)} /></td><td><${Select} value=${ch.width} labels=${["Wide", "Narrow"]} onChange=${(v) => change(ch.channel, "width", v)} /></td><td><${Select} value=${ch.scan} labels=${["No", "Yes"]} onChange=${(v) => change(ch.channel, "scan", v)} /></td><td><input defaultValue=${ch.rxTone} onChange=${(e) => change(ch.channel, "rxTone", e.target.value)} /></td><td><input defaultValue=${ch.txTone} onChange=${(e) => change(ch.channel, "txTone", e.target.value)} /></td><td><${ValueSelect} value=${ch.signaling} options=${signalOptions} onChange=${(v) => change(ch.channel, "signaling", v)} /></td><td><${ValueSelect} value=${ch.dtmfEncoder} displayValue=${ch.dtmfEncoder === 0xff ? 0 : ch.dtmfEncoder} options=${[[0, "Off"], [1, "On"]]} onChange=${(v) => change(ch.channel, "dtmfEncoder", v)} /></td><td><${ValueSelect} value=${ch.jmpFreq} displayValue=${ch.jmpFreq === 0xff ? 0 : ch.jmpFreq} options=${[[0, "Off"], [1, "On"]]} onChange=${(v) => change(ch.channel, "jmpFreq", v)} /></td><td><${ValueSelect} value=${ch.pttId} options=${pttOptions} onChange=${(v) => change(ch.channel, "pttId", v)} /></td><td><${Select} value=${ch.bcl} labels=${["Off", "On"]} onChange=${(v) => change(ch.channel, "bcl", v)} /></td><td><${Select} value=${ch.fhss} labels=${["Off", "On"]} onChange=${(v) => change(ch.channel, "fhss", v)} /></td></tr>`)}<tr class="virtual-spacer" style=${`height:${bottomPad}px`}><td colspan="15"></td></tr></tbody></table></div></section>`;
}

import { html, useMemo } from "./preact.mjs?v=ani-sync";
import { PMR_CHANNELS } from "./protocol.mjs?v=multimodel";
import { fillPmrChannels, getChannelCapacity, labelMemberRange, parseChannel, setCallChannel, updateChannelField, updateMemoryField } from "./memory.mjs?v=ani-sync";
import { Input } from "./components.mjs?v=ani-sync";

export function PmrWizardTab({ updateBlocks, pmrTone, setPmrTone, pmrStartSlot, setPmrStartSlot, pmrNamePrefix, setPmrNamePrefix, pmrPower, setPmrPower, pmrWidth, setPmrWidth, pmrScan, setPmrScan, pmrPttId, setPmrPttId, pmrCallingScope, setPmrCallingScope, pmrSignalCode, setPmrSignalCode, setPageStart, setTab, setStatus }) {
  const channelCapacity = getChannelCapacity();
  const pmrStart = Math.max(1, Math.min(channelCapacity - PMR_CHANNELS.length + 1, Number(pmrStartSlot || 1)));
  const pmrEnd = pmrStart + PMR_CHANNELS.length - 1;
  const applyPmrPreset = () => {
    updateBlocks((b) => fillPmrChannels(b, pmrStart, pmrTone, {
      namePrefix: pmrNamePrefix,
      power: pmrPower,
      width: pmrWidth,
      scan: pmrScan,
      pttId: pmrPttId,
      callingScope: pmrCallingScope,
      signalCode: pmrSignalCode
    }));
    setPageStart(pmrStart - 1);
    setTab("channels");
    setStatus(`Filled PMR446 slots ${pmrStart}-${pmrEnd}`, "ok");
  };
  return html`<section><h2>PMR446 Channel Wizard</h2><div class="wizard"><div class="wizard-head"><div><h3>PMR446 Channel Wizard</h3><p>Creates a 16-channel PMR block. It overwrites only the selected channel slots in memory; nothing is written to the radio until you use the main Write button.</p></div><span class="pill">Slots ${pmrStart}-${pmrEnd}</span></div><div class="wizard-grid"><div class="wizard-step"><strong>1. Choose where the block goes</strong><p>Pick the first channel slot. The wizard fills 16 consecutive slots with PMR446 frequencies.</p><${Input} label="Start Slot" type="number" value=${pmrStartSlot} onInput=${(e) => setPmrStartSlot(e.target.value)} /></div><div class="wizard-step"><strong>2. Choose channel names</strong><p>The radio has short ASCII channel names. Prefix PMR creates PMR01 through PMR16.</p><${Input} label="Name Prefix" value=${pmrNamePrefix} onInput=${(e) => setPmrNamePrefix(e.target.value)} /></div><div class="wizard-step"><strong>3. Choose the squelch tone</strong><p>OFF means open PMR channel audio. A tone like T67 or T88.5 only opens radios set to the same tone; it is not privacy.</p><${Input} label="CTCSS/DCS Tone" value=${pmrTone} onInput=${(e) => setPmrTone(e.target.value)} /></div><div class="wizard-step"><strong>4. Choose radio behavior</strong><p>Low power and narrow width are the conservative defaults. Scan adds the channels to scan.</p><label>Power<select value=${pmrPower} onChange=${(e) => setPmrPower(e.target.value)}><option value="1">Low</option><option value="0">High</option></select></label><label>Width<select value=${pmrWidth} onChange=${(e) => setPmrWidth(e.target.value)}><option value="1">Narrow</option><option value="0">Wide</option></select></label><label>Scan<select value=${pmrScan} onChange=${(e) => setPmrScan(e.target.value)}><option value="1">Yes</option><option value="0">No</option></select></label></div><div class="wizard-step"><strong>5. Choose calling channels</strong><p>DTMF calling can be enabled on one shared calling channel or on every generated PMR channel. Voice-only leaves DTMF/signaling off.</p><label>Calling Scope<select value=${pmrCallingScope} onChange=${(e) => setPmrCallingScope(e.target.value)}><option value="none">Voice only</option><option value="first">First PMR channel only</option><option value="all">All PMR channels</option></select></label><label>Signal Slot<select value=${pmrSignalCode} onChange=${(e) => setPmrSignalCode(e.target.value)}>${Array.from({ length: 20 }, (_, index) => html`<option value=${index + 1}>Member ${index + 1}</option>`)}</select></label><label>PTT ID<select value=${pmrPttId} onChange=${(e) => setPmrPttId(e.target.value)}><option value="0">Off</option><option value="1">Begin</option><option value="2">End</option><option value="3">Both</option></select></label></div></div><div class="wizard-note"><strong>DTMF calling is separate from the PMR voice channel.</strong><p>Use one calling channel when everyone monitors the same PMR slot for calls. Use all channels if you want each programmed PMR channel to carry the same calling setup. The matching member IDs below still define who the tone burst represents.</p></div><div class="table-wrap mini-table wizard-preview"><table><thead><tr><th>Slot</th><th>Name</th><th>RX/TX MHz</th><th>Tone</th><th>Calling</th></tr></thead><tbody>${PMR_CHANNELS.map((mhz, index) => { const calling = pmrCallingScope === "all" || (pmrCallingScope === "first" && index === 0); return html`<tr><td>${pmrStart + index}</td><td>${pmrNamePrefix}${String(index + 1).padStart(2, "0")}</td><td>${mhz}</td><td>${pmrTone || "OFF"}</td><td>${calling ? `Member ${pmrSignalCode}` : "Voice only"}</td></tr>`; })}</tbody></table></div><div class="actions"><button class="secondary" onClick=${applyPmrPreset}>Apply PMR446 Preset</button></div></div></section>`;
}

export function BatchWizardTab({ blocks, updateBlocks, batchTarget, setBatchTarget, batchStartSlot, setBatchStartSlot, batchEndSlot, setBatchEndSlot, batchToneMode, setBatchToneMode, batchRxTone, setBatchRxTone, batchTxTone, setBatchTxTone, batchPower, setBatchPower, batchWidth, setBatchWidth, batchScan, setBatchScan, batchBcl, setBatchBcl, batchPttId, setBatchPttId, batchDtmf, setBatchDtmf, setPageStart, setTab, setStatus }) {
  const capacity = getChannelCapacity();
  const first = Math.max(1, Math.min(capacity, Number(batchStartSlot || 1)));
  const last = Math.max(first, Math.min(capacity, Number(batchEndSlot || first)));
  const allChannels = useMemo(() => Array.from({ length: capacity }, (_, index) => parseChannel(blocks, index)), [blocks, capacity]);
  const targets = allChannels.filter((channel) => {
    if (channel.empty) return false;
    const slot = channel.channel + 1;
    if (batchTarget === "range") return slot >= first && slot <= last;
    if (batchTarget === "pmr") return PMR_CHANNELS.some((mhz) => Math.abs(Number(channel.rx) - mhz) < 0.000001);
    return true;
  });
  const hasChanges = batchToneMode !== "keep" || [batchPower, batchWidth, batchScan, batchBcl, batchPttId, batchDtmf].some((value) => value !== "keep");
  const label = (value, pairs) => pairs.find(([key]) => String(key) === String(value))?.[1] || "Keep";
  const tonePreview = batchToneMode === "off" ? "RX/TX OFF" : batchToneMode === "same" ? `RX/TX ${batchRxTone || "OFF"}` : batchToneMode === "split" ? `RX ${batchRxTone || "OFF"}, TX ${batchTxTone || "OFF"}` : "Keep";
  const applyBatch = () => {
    if (!hasChanges) {
      setStatus("Choose at least one batch change", "err");
      return;
    }
    if (!targets.length) {
      setStatus("No populated channels match the batch target", "err");
      return;
    }
    try {
      updateBlocks((b) => {
        targets.forEach((channel) => {
          if (batchToneMode === "off") {
            updateChannelField(b, channel.channel, "rxTone", "OFF");
            updateChannelField(b, channel.channel, "txTone", "OFF");
          } else if (batchToneMode === "same") {
            updateChannelField(b, channel.channel, "rxTone", batchRxTone || "OFF");
            updateChannelField(b, channel.channel, "txTone", batchRxTone || "OFF");
          } else if (batchToneMode === "split") {
            updateChannelField(b, channel.channel, "rxTone", batchRxTone || "OFF");
            updateChannelField(b, channel.channel, "txTone", batchTxTone || "OFF");
          }
          if (batchPower !== "keep") updateChannelField(b, channel.channel, "power", batchPower);
          if (batchWidth !== "keep") updateChannelField(b, channel.channel, "width", batchWidth);
          if (batchScan !== "keep") updateChannelField(b, channel.channel, "scan", batchScan);
          if (batchBcl !== "keep") updateChannelField(b, channel.channel, "bcl", batchBcl);
          if (batchPttId !== "keep") updateChannelField(b, channel.channel, "pttId", batchPttId);
          if (batchDtmf !== "keep") updateChannelField(b, channel.channel, "dtmfEncoder", batchDtmf);
        });
      });
      setPageStart(targets[0].channel);
      setTab("channels");
      setStatus(`Applied batch changes to ${targets.length} channels`, "ok");
    } catch (error) {
      setStatus(error.message, "err");
    }
  };
  return html`<section><h2>Channel Batch Wizard</h2>
    <div class="wizard">
      <div class="wizard-head"><div><h3>Goal: change many existing channels at once</h3><p>Use this after reading or importing memory when you want consistent tones, scan behavior, power, width, or lockout across a group of channels.</p></div><span class="pill">${targets.length} populated targets</span></div>
      <div class="goal-strip">
        <div><strong>Safe target rule</strong><p>Blank slots are skipped. The wizard will not create partial channel records by editing empty memory.</p></div>
        <div><strong>Keep means untouched</strong><p>Only options changed away from Keep are written into the local memory image.</p></div>
        <div><strong>Good use cases</strong><p>Put all PMR channels on narrow/low/scan, apply a shared tone, or turn BCL on for a working set.</p></div>
      </div>
      <div class="wizard-grid">
        <div class="wizard-step"><strong>1. Choose channel group</strong><p>Pick all populated channels, populated slots inside a range, or channels whose RX frequency is one of the PMR446 channels.</p><label>Target<select value=${batchTarget} onChange=${(e) => setBatchTarget(e.target.value)}><option value="populated">All populated channels</option><option value="range">Populated slots in range</option><option value="pmr">Detected PMR446 channels</option></select></label><${Input} label="Start Slot" type="number" value=${batchStartSlot} onInput=${(e) => setBatchStartSlot(e.target.value)} /><${Input} label="End Slot" type="number" value=${batchEndSlot} onInput=${(e) => setBatchEndSlot(e.target.value)} /></div>
        <div class="wizard-step"><strong>2. Choose tone behavior</strong><p>OFF opens normal carrier squelch. Same tone uses one CTCSS/DCS value for RX and TX. Split lets receive and transmit tones differ.</p><label>Tone Mode<select value=${batchToneMode} onChange=${(e) => setBatchToneMode(e.target.value)}><option value="keep">Keep tones</option><option value="off">Set RX/TX OFF</option><option value="same">Same RX/TX tone</option><option value="split">Split RX/TX tones</option></select></label><${Input} label="RX Tone" value=${batchRxTone} onInput=${(e) => setBatchRxTone(e.target.value)} /><${Input} label="TX Tone" value=${batchTxTone} onInput=${(e) => setBatchTxTone(e.target.value)} /></div>
        <div class="wizard-step"><strong>3. Choose radio behavior</strong><p>These are the common per-channel options people usually want to normalize after importing or filling channels.</p><label>Power<select value=${batchPower} onChange=${(e) => setBatchPower(e.target.value)}><option value="keep">Keep</option><option value="1">Low</option><option value="0">High</option></select></label><label>Width<select value=${batchWidth} onChange=${(e) => setBatchWidth(e.target.value)}><option value="keep">Keep</option><option value="1">Narrow</option><option value="0">Wide</option></select></label><label>Scan<select value=${batchScan} onChange=${(e) => setBatchScan(e.target.value)}><option value="keep">Keep</option><option value="1">Yes</option><option value="0">No</option></select></label><label>BCL<select value=${batchBcl} onChange=${(e) => setBatchBcl(e.target.value)}><option value="keep">Keep</option><option value="1">On</option><option value="0">Off</option></select></label></div>
        <div class="wizard-step"><strong>4. Choose calling behavior</strong><p>Leave these on Keep for ordinary voice channels. Change them when you want to enable or clear DTMF ID behavior in bulk.</p><label>PTT ID<select value=${batchPttId} onChange=${(e) => setBatchPttId(e.target.value)}><option value="keep">Keep</option><option value="0">Off</option><option value="1">Begin</option><option value="2">End</option><option value="3">Both</option></select></label><label>DTMF Encoder<select value=${batchDtmf} onChange=${(e) => setBatchDtmf(e.target.value)}><option value="keep">Keep</option><option value="1">On</option><option value="0">Off</option></select></label></div>
      </div>
      <div class="wizard-note"><strong>Planned change</strong><p>Tone: ${tonePreview}. Power: ${label(batchPower, [["1", "Low"], ["0", "High"]])}. Width: ${label(batchWidth, [["1", "Narrow"], ["0", "Wide"]])}. Scan: ${label(batchScan, [["1", "Yes"], ["0", "No"]])}. BCL: ${label(batchBcl, [["1", "On"], ["0", "Off"]])}. PTT ID: ${label(batchPttId, [["0", "Off"], ["1", "Begin"], ["2", "End"], ["3", "Both"]])}. DTMF: ${label(batchDtmf, [["1", "On"], ["0", "Off"]])}.</p></div>
      <div class="table-wrap mini-table wizard-preview"><table><thead><tr><th>Slot</th><th>Name</th><th>RX MHz</th><th>RX Tone</th><th>TX Tone</th><th>Power</th><th>Width</th><th>Scan</th></tr></thead><tbody>${targets.slice(0, 60).map((channel) => html`<tr><td>${channel.channel + 1}</td><td>${channel.name || "-"}</td><td>${channel.rx || "-"}</td><td>${channel.rxTone}</td><td>${channel.txTone}</td><td>${channel.power ? "Low" : "High"}</td><td>${channel.width ? "Narrow" : "Wide"}</td><td>${channel.scan ? "Yes" : "No"}</td></tr>`)}</tbody></table></div>
      <div class="actions"><button class="secondary" onClick=${applyBatch}>Apply Batch Changes</button>${targets.length > 60 ? html`<span class="pill">Preview shows first 60</span>` : null}<span class="pill">Memory only until Write</span></div>
    </div>
  </section>`;
}

export function CallingWizardTab({ blocks, updateBlocks, callingTarget, setCallingTarget, callingStartSlot, setCallingStartSlot, callingEndSlot, setCallingEndSlot, callingSignalCode, setCallingSignalCode, callingPttId, setCallingPttId, callingDtmf, setCallingDtmf, fleetCount, setFleetCount, fleetPrefix, setFleetPrefix, fleetFirstId, setFleetFirstId, fleetOwnAni, setFleetOwnAni, fleetOwnAniTouched, setFleetOwnAniTouched, fleetMemberStart, setFleetMemberStart, fleetChannelStart, setFleetChannelStart, fleetFrequency, setFleetFrequency, fleetTone, setFleetTone, fleetPttId, setFleetPttId, setPageStart, setTab, setStatus }) {
  const capacity = getChannelCapacity();
  const first = Math.max(1, Math.min(capacity, Number(callingStartSlot || 1)));
  const last = Math.max(first, Math.min(capacity, Number(callingEndSlot || first)));
  const fleetSize = Math.max(1, Math.min(20, Number(fleetCount || 1)));
  const memberStart = Math.max(1, Math.min(20, Number(fleetMemberStart || 1)));
  const usableFleetSize = Math.max(1, Math.min(fleetSize, 21 - memberStart));
  const channelStart = Math.max(1, Math.min(capacity, Number(fleetChannelStart || 1)));
  const usableChannelCount = Math.max(1, Math.min(usableFleetSize, capacity - channelStart + 1));
  const fleetRows = Array.from({ length: usableChannelCount }, (_, index) => ({
    slot: channelStart + index,
    member: memberStart + index,
    name: `${fleetPrefix || "R"}${String(index + 1).padStart(2, "0")}`,
    code: String(Number(fleetFirstId || 101) + index),
    channelName: `CALL${String(index + 1).padStart(2, "0")}`
  }));
  const allChannels = useMemo(() => Array.from({ length: capacity }, (_, index) => parseChannel(blocks, index)), [blocks, capacity]);
  const setFleetFirstDtmfId = (value) => {
    setFleetFirstId(value);
    if (!fleetOwnAniTouched) setFleetOwnAni(value);
  };
  const setOwnAniCode = (value) => {
    setFleetOwnAniTouched(true);
    setFleetOwnAni(value);
  };
  const targets = allChannels.filter((channel) => {
    const slot = channel.channel + 1;
    if (callingTarget === "single") return slot === first;
    if (callingTarget === "range") return slot >= first && slot <= last;
    if (callingTarget === "populated") return !channel.empty;
    return true;
  });
  const applyCalling = () => {
    if (!targets.length) {
      setStatus("No channels match the DTMF calling target", "err");
      return;
    }
    updateBlocks((b) => {
      targets.forEach((channel) => {
        updateChannelField(b, channel.channel, "signaling", callingSignalCode);
        updateChannelField(b, channel.channel, "pttId", callingPttId);
        updateChannelField(b, channel.channel, "dtmfEncoder", callingDtmf);
      });
    });
    setPageStart(targets[0].channel);
    setTab("channels");
    setStatus(`Applied DTMF calling to ${targets.length} channels`, "ok");
  };
  const applyFleet = () => {
    if (!fleetRows.length) {
      setStatus("No fleet rows to apply", "err");
      return;
    }
    try {
      updateBlocks((b) => {
        updateMemoryField(b, "dtmfSequence", 0xa000, fleetOwnAni, 3);
        labelMemberRange(b, memberStart, fleetRows.length, fleetPrefix || "R", Number(fleetFirstId || 101));
        fleetRows.forEach((row) => setCallChannel(b, row.slot, {
          name: row.channelName,
          frequency: fleetFrequency,
          tone: fleetTone,
          signaling: row.member,
          pttId: fleetPttId,
          dtmfEncoder: 1,
          power: 1
        }));
      });
      setPageStart(channelStart - 1);
      setTab("channels");
      setStatus(`Created ${fleetRows.length} DTMF call channels`, "ok");
    } catch (error) {
      setStatus(error.message, "err");
    }
  };
  return html`<section><h2>DTMF Calling Wizard</h2>
    <div class="wizard">
      <div class="wizard-head">
        <div>
          <h3>Goal: call one radio from a small group</h3>
          <p>For a fleet on one frequency, this creates one channel position per person. Each position uses the same RX/TX frequency but points at a different DTMF member ID.</p>
        </div>
        <span class="pill">${fleetRows.length} call slots</span>
      </div>
      <div class="goal-strip">
        <div><strong>What you get</strong><p>Select CALL01 to call ${fleetRows[0]?.name || "radio 1"}, CALL02 to call ${fleetRows[1]?.name || "radio 2"}, and so on. Voice still happens on the same frequency.</p></div>
        <div><strong>What DTMF does</strong><p>DTMF is a short tone ID sent over RF. It is useful for selective calling or ID bursts; it is not encryption or privacy.</p></div>
        <div><strong>Per-radio setup</strong><p>Use the same member list on all radios, but give each physical radio a unique Own ANI code before writing its image.</p></div>
      </div>
      <div class="wizard-grid fleet-grid">
        <div class="wizard-step"><strong>1. Radios to call</strong><p>Example: six radios named R01-R06 with DTMF IDs 101-106.</p><${Input} label="How many radios" type="number" value=${fleetCount} onInput=${(e) => setFleetCount(e.target.value)} /><${Input} label="Radio name prefix" value=${fleetPrefix} onInput=${(e) => setFleetPrefix(e.target.value)} /><${Input} label="First DTMF ID" value=${fleetFirstId} onInput=${(e) => setFleetFirstDtmfId(e.target.value)} /></div>
        <div class="wizard-step"><strong>2. This radio's identity</strong><p>ANI is the ID this programmed handset sends as its own caller ID. It starts as the first DTMF ID; change it for each physical radio.</p><${Input} label="Own ANI Code" value=${fleetOwnAni} onInput=${(e) => setOwnAniCode(e.target.value)} /><label>PTT ID Burst<select value=${fleetPttId} onChange=${(e) => setFleetPttId(e.target.value)}><option value="0">Off</option><option value="1">At transmit start</option><option value="2">At transmit end</option><option value="3">Start and end</option></select></label></div>
        <div class="wizard-step"><strong>3. Shared PMR channel</strong><p>All generated call slots use this same PMR446 channel and tone. OFF tone means everyone on frequency can open squelch.</p><label>PMR Channel<select value=${fleetFrequency} onChange=${(e) => setFleetFrequency(e.target.value)}>${PMR_CHANNELS.map((mhz, index) => html`<option value=${mhz}>PMR ${index + 1} - ${mhz} MHz</option>`)}</select></label><${Input} label="CTCSS/DCS Tone" value=${fleetTone} onInput=${(e) => setFleetTone(e.target.value)} /></div>
        <div class="wizard-step"><strong>4. Where to store it</strong><p>Members use DTMF slots 1-20. Channel slots are normal radio memories and will be overwritten.</p><${Input} label="First Member Slot" type="number" value=${fleetMemberStart} onInput=${(e) => setFleetMemberStart(e.target.value)} /><${Input} label="First Channel Slot" type="number" value=${fleetChannelStart} onInput=${(e) => setFleetChannelStart(e.target.value)} /></div>
      </div>
      <div class="wizard-note"><strong>How to use it in the field</strong><p>Write this image to the radio. On the radio, choose the call channel for the person you want, for example CALL04. Press PTT or the radio's call action according to its firmware behavior. The called radio must be monitoring the same frequency and have matching DTMF/signaling settings.</p></div>
      <div class="table-wrap mini-table wizard-preview">
        <table><thead><tr><th>Channel Slot</th><th>Channel Name</th><th>Frequency</th><th>Calls Member</th><th>DTMF ID</th><th>Member Name</th></tr></thead><tbody>${fleetRows.map((row) => html`<tr><td>${row.slot}</td><td>${row.channelName}</td><td>${fleetFrequency}</td><td>${row.member}</td><td>${row.code}</td><td>${row.name}</td></tr>`)}</tbody></table>
      </div>
      <div class="actions"><button class="secondary" onClick=${applyFleet}>Create Fleet Calling Setup</button><span class="pill">Memory only until Write</span></div>
    </div>
    <details class="advanced-panel">
      <summary>Advanced: bulk edit existing channel signaling</summary>
      <div class="wizard">
        <div class="wizard-head"><div><h3>Apply Calling To Existing Channels</h3><p>Sets channel Signal, DTMF encoder, and PTT ID together. Use this when channels already exist and you only want to change their signaling fields.</p></div><span class="pill">${targets.length} targets</span></div>
        <div class="wizard-grid"><div class="wizard-step"><strong>1. Choose target channels</strong><p>Use a single slot, a slot range, every populated channel, or every possible channel slot.</p><label>Target<select value=${callingTarget} onChange=${(e) => setCallingTarget(e.target.value)}><option value="single">Single slot</option><option value="range">Slot range</option><option value="populated">All populated</option><option value="all">All slots</option></select></label><${Input} label="Start Slot" type="number" value=${callingStartSlot} onInput=${(e) => setCallingStartSlot(e.target.value)} /><${Input} label="End Slot" type="number" value=${callingEndSlot} onInput=${(e) => setCallingEndSlot(e.target.value)} /></div><div class="wizard-step"><strong>2. Choose the called member</strong><p>Signal slot links the channel to one of the 20 DTMF member IDs.</p><label>Signal Slot<select value=${callingSignalCode} onChange=${(e) => setCallingSignalCode(e.target.value)}>${Array.from({ length: 20 }, (_, index) => html`<option value=${index + 1}>Member ${index + 1}</option>`)}</select></label></div><div class="wizard-step"><strong>3. Choose when ID tones send</strong><p>PTT ID controls whether the ANI/DTMF ID burst is sent at transmit start, transmit end, both, or never.</p><label>PTT ID<select value=${callingPttId} onChange=${(e) => setCallingPttId(e.target.value)}><option value="0">Off</option><option value="1">Begin</option><option value="2">End</option><option value="3">Both</option></select></label></div><div class="wizard-step"><strong>4. Enable or clear DTMF</strong><p>Enable DTMF for calling. Choose Off to clear calling behavior while keeping the selected signal slot value.</p><label>DTMF Encoder<select value=${callingDtmf} onChange=${(e) => setCallingDtmf(e.target.value)}><option value="1">On</option><option value="0">Off</option></select></label></div></div>
        <div class="table-wrap mini-table wizard-preview"><table><thead><tr><th>Slot</th><th>Name</th><th>RX MHz</th><th>Current Signal</th><th>Current PTT</th></tr></thead><tbody>${targets.slice(0, 40).map((channel) => html`<tr><td>${channel.channel + 1}</td><td>${channel.name || "-"}</td><td>${channel.rx || "-"}</td><td>${channel.signaling}</td><td>${channel.pttId}</td></tr>`)}</tbody></table></div>
        <div class="actions"><button class="secondary" onClick=${applyCalling}>Apply Bulk Calling Fields</button>${targets.length > 40 ? html`<span class="pill">Preview shows first 40</span>` : null}</div>
      </div>
    </details>
  </section>`;
}

import { html, render, useRef, useState } from "./preact.mjs?v=ani-sync";
import { BleTransport } from "./ble-transport.mjs?v=boot-targets";
import { BootLogoTab } from "./boot-logo.mjs?v=boot-ble-fix";
import { hexAddr, sleep } from "./format.mjs?v=ani-sync";
import { PROTOCOL } from "./protocol.mjs?v=tool-copy";
import { blockPayload, buildDefaultBlocks, cloneBlocks, countBlocks, normalizeBlock, validateBlocks } from "./memory.mjs?v=ani-sync";
import { ChannelsTab } from "./channels-tab.mjs?v=plain-channels-heading";
import { RawTab } from "./components.mjs?v=ani-sync";
import { DtmfTab } from "./dtmf-tab.mjs?v=ani-sync";
import { applyProvisionYaml, blocksFromRawBin, blocksToRawBin, buildProvisionYaml } from "./import-export.mjs?v=ani-sync";
import { ConnectionPanel, OperationsPanel } from "./panels.mjs?v=serial-toggle";
import { SerialTransport } from "./serial-transport.mjs?v=serial-close";
import { SettingsTab } from "./settings-tab.mjs?v=settings-redesign";
import { Tabs } from "./tabs.mjs?v=boot-logo";
import { VfoTab } from "./vfo-tab.mjs?v=ani-sync";
import { getWriteAddresses, getWriteGroups } from "./write-plan.mjs?v=ani-sync";
import { BatchWizardTab, CallingWizardTab, PmrWizardTab } from "./wizards.mjs?v=wizard-batch";

const DEFAULT_BLOCKS = buildDefaultBlocks();

function App() {
  const [blocks, setBlocks] = useState(() => cloneBlocks(DEFAULT_BLOCKS));
  const [baselineBlocks, setBaselineBlocks] = useState(null);
  const [tab, setTab] = useState("channels");
  const [status, setStatusState] = useState({ text: "Disconnected", type: "" });
  const [logText, setLogText] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState({ value: 0, max: 1, text: "Idle" });
  const [pageStart, setPageStart] = useState(0);
  const [settings, setSettings] = useState({
    transportType: "ble",
    serviceUuid: "0000ffe0-0000-1000-8000-00805f9b34fb",
    nameFilter: "walkie",
    writeUuid: "0000ffe1-0000-1000-8000-00805f9b34fb",
    notifyUuid: "0000ffe1-0000-1000-8000-00805f9b34fb",
    writeDelay: "0",
    writeAck: "ignore",
    writeMode: "pairedResponse",
    writeScope: "all",
    chunkSize: "20",
    serialBaud: "115200",
    serialChunkSize: "1024",
    serialDtr: true,
    serialRts: true,
    rxIdle: "140",
    verboseLog: false
  });
  const [memberPrefix, setMemberPrefix] = useState("R");
  const [memberStartId, setMemberStartId] = useState("101");
  const [pmrTone, setPmrTone] = useState("OFF");
  const [pmrStartSlot, setPmrStartSlot] = useState("1");
  const [pmrNamePrefix, setPmrNamePrefix] = useState("PMR");
  const [pmrPower, setPmrPower] = useState("1");
  const [pmrWidth, setPmrWidth] = useState("1");
  const [pmrScan, setPmrScan] = useState("1");
  const [pmrPttId, setPmrPttId] = useState("0");
  const [pmrCallingScope, setPmrCallingScope] = useState("none");
  const [pmrSignalCode, setPmrSignalCode] = useState("1");
  const [batchTarget, setBatchTarget] = useState("populated");
  const [batchStartSlot, setBatchStartSlot] = useState("1");
  const [batchEndSlot, setBatchEndSlot] = useState("16");
  const [batchToneMode, setBatchToneMode] = useState("keep");
  const [batchRxTone, setBatchRxTone] = useState("OFF");
  const [batchTxTone, setBatchTxTone] = useState("OFF");
  const [batchPower, setBatchPower] = useState("keep");
  const [batchWidth, setBatchWidth] = useState("keep");
  const [batchScan, setBatchScan] = useState("keep");
  const [batchBcl, setBatchBcl] = useState("keep");
  const [batchPttId, setBatchPttId] = useState("keep");
  const [batchDtmf, setBatchDtmf] = useState("keep");
  const [callingTarget, setCallingTarget] = useState("range");
  const [callingStartSlot, setCallingStartSlot] = useState("1");
  const [callingEndSlot, setCallingEndSlot] = useState("16");
  const [callingSignalCode, setCallingSignalCode] = useState("1");
  const [callingPttId, setCallingPttId] = useState("1");
  const [callingDtmf, setCallingDtmf] = useState("1");
  const [fleetCount, setFleetCount] = useState("6");
  const [fleetPrefix, setFleetPrefix] = useState("R");
  const [fleetFirstId, setFleetFirstId] = useState("101");
  const [fleetOwnAni, setFleetOwnAni] = useState("101");
  const [fleetOwnAniTouched, setFleetOwnAniTouched] = useState(false);
  const [fleetMemberStart, setFleetMemberStart] = useState("1");
  const [fleetChannelStart, setFleetChannelStart] = useState("1");
  const [fleetFrequency, setFleetFrequency] = useState("446.00625");
  const [fleetTone, setFleetTone] = useState("OFF");
  const [fleetPttId, setFleetPttId] = useState("1");
  const stopRequested = useRef(false);
  const transport = useRef(null);

  const setStatus = (text, type = "") => setStatusState({ text, type });
  const log = (message) => setLogText((old) => `${old}[${new Date().toLocaleTimeString()}] ${message}\n`);
  const updateBlocks = (mutator) => setBlocks((old) => { const next = cloneBlocks(old); mutator(next); return next; });
  const getTransport = () => {
    const kind = settings.transportType === "serial" ? "serial" : "ble";
    if (!transport.current || transport.current.kind !== kind) {
      transport.current?.disconnect();
      const Transport = kind === "serial" ? SerialTransport : BleTransport;
      transport.current = new Transport({
        log,
        setStatus,
        getSettings: () => settings,
        setManualUuids: (patch) => setSettings((old) => ({ ...old, ...patch }))
      });
      transport.current.kind = kind;
    }
    return transport.current;
  };

  async function connect() {
    try {
      const name = await getTransport().connect();
      setConnected(true);
      setStatus(`Ready: ${name}`, "ok");
    } catch (error) {
      setConnected(Boolean(transport.current?.connected));
      setStatus(error.message, "err");
      log(`Connect failed: ${error.message}`);
    }
  }

  async function disconnect() {
    await transport.current?.disconnect?.();
    setConnected(false);
    setStatus("Disconnected");
  }

  async function runSetup() {
    const tx = getTransport();
    tx.clearQueue();
    for (const step of PROTOCOL.setup) await tx.sendBytes(step.send, { expect: step.expect, name: step.name, timeout: 2500 });
  }

  async function probeHandshake() {
    try {
      setBusy(true); setProgress({ value: 0, max: 1, text: "Probing handshake" });
      await runSetup();
      await getTransport().sendBytes([0x45], { expect: [], name: "exit" });
      setStatus("Handshake passed", "ok");
    } catch (error) {
      setStatus(error.message, "err"); log(`Probe failed: ${error.message}`);
    } finally {
      setBusy(false); setProgress((p) => ({ ...p, text: "Idle" }));
    }
  }

  async function readChannels() {
    const total = countBlocks(PROTOCOL.readRanges);
    let done = 0;
    let setupComplete = false;
    try {
      setBusy(true); stopRequested.current = false; setProgress({ value: 0, max: total, text: "Starting read" });
      await runSetup(); setupComplete = true;
      const nextBlocks = {};
      for (const [begin, end] of PROTOCOL.readRanges) {
        for (let addr = begin; addr <= end; addr += PROTOCOL.blockSize) {
          if (stopRequested.current) throw new Error("Read stopped");
          const response = await getTransport().sendBytes([0x52, addr >> 8, addr & 0xff, 0x40], { expect: [0x52], responseLength: 68, name: `read ${hexAddr(addr)}`, timeout: 2500, compactLog: true });
          nextBlocks[hexAddr(addr)] = normalizeBlock(addr, response);
          done += 1;
          setProgress({ value: done, max: total, text: `Read ${done}/${total} blocks (${hexAddr(addr)})` });
        }
      }
      await getTransport().sendBytes([0x45], { expect: [], name: "exit" });
      setBlocks(nextBlocks);
      setBaselineBlocks(cloneBlocks(nextBlocks));
      setStatus("Read complete", "ok");
      setProgress({ value: total, max: total, text: `Read complete: ${total} blocks` });
    } catch (error) {
      if (setupComplete) await getTransport().sendBytes([0x45], { expect: [], name: "exit" }).catch((e) => log(`Exit failed: ${e.message}`));
      setStatus(error.message, "err"); log(`Read failed: ${error.message}`); setProgress({ value: done, max: total, text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function writeBack() {
    const writeScope = settings.writeScope || "all";
    if (writeScope === "changed" && !baselineBlocks) {
      setStatus("Read radio first before writing changed blocks", "err");
      log("Write changes only requires a successful read in this page session");
      return;
    }
    const writeAddresses = getWriteAddresses(writeScope, blocks, baselineBlocks);
    const total = writeAddresses.length;
    if (total === 0) {
      setStatus("No changed blocks to write", "ok");
      setProgress({ value: 0, max: 1, text: "No changed blocks" });
      return;
    }
    if (!confirm(`Write ${total} block${total === 1 ? "" : "s"} back to the radio?`)) return;
    const waitForAck = settings.writeAck === "wait";
    const writeMode = settings.writeMode || "pairedResponse";
    const writeProfiles = {
      pairedResponse: { blockDelay: 0, chunkDelay: 20, chunkSize: 20, disconnectDelay: 1000, exitDelay: 1000, pairFrame: true, setupDelay: 450, timeout: 10000, writeWithResponse: true },
      paired: { blockDelay: 0, chunkDelay: 20, chunkSize: 20, disconnectDelay: 1000, exitDelay: 1000, pairFrame: true, setupDelay: 450, timeout: 10000, writeWithResponse: false },
      wholeResponse: { blockDelay: 0, chunkDelay: 20, chunkSize: 20, disconnectDelay: 1000, exitDelay: 1000, setupDelay: 450, timeout: 10000, wholeFrame: true, writeWithResponse: true },
      whole: { blockDelay: 0, chunkDelay: 20, chunkSize: 20, disconnectDelay: 1000, exitDelay: 1000, setupDelay: 450, timeout: 10000, wholeFrame: true, writeWithResponse: false },
      frame: { blockDelay: 180, chunkDelay: 0, chunkSize: "frame", disconnectDelay: 1000, exitDelay: 1000, setupDelay: 350, timeout: 10000, writeWithResponse: false },
      frameResponse: { blockDelay: 0, chunkDelay: 0, chunkSize: "frame", disconnectDelay: 1000, exitDelay: 1000, setupDelay: 450, timeout: 10000, writeWithResponse: true },
      frameResponseSlow: { blockDelay: 1500, chunkDelay: 0, chunkSize: "frame", disconnectDelay: 2000, exitDelay: 3000, setupDelay: 1000, timeout: 10000, writeWithResponse: true },
      paced: { blockDelay: 90, chunkDelay: 25, disconnectDelay: 1000, exitDelay: 1000, setupDelay: 350, timeout: 10000, writeWithResponse: false },
      response: { blockDelay: 80, chunkDelay: 20, disconnectDelay: 1000, exitDelay: 1000, setupDelay: 350, timeout: 10000, writeWithResponse: true },
      uart: { blockDelay: 35, chunkDelay: 0, disconnectDelay: 1000, exitDelay: 1000, setupDelay: 250, timeout: 6500, writeWithResponse: false }
    };
    const writeProfile = writeProfiles[writeMode] || writeProfiles.paced;
    let done = 0;
    let setupComplete = false;
    try {
      setBusy(true); stopRequested.current = false; setProgress({ value: 0, max: total, text: "Starting write" });
      log(`Write target=${writeScope}, blocks=${total}, mode=${writeMode}, ack=${waitForAck ? "wait" : "ignore"}`);
      if (writeScope === "all" && writeProfile.pairFrame) log("Final paired write uses A1C0 as filler after A180");
      else if (writeScope === "all") log("A1C0 is read by Ola but not included in its write protocol");
      await runSetup(); setupComplete = true; await sleep(writeProfile.setupDelay);
      for (const group of getWriteGroups(writeAddresses, writeProfile)) {
        if (stopRequested.current) throw new Error("Write stopped");
        const key = hexAddr(group.addr);
        const payload = group.addresses.flatMap((payloadAddr) => blockPayload(blocks[hexAddr(payloadAddr)] || DEFAULT_BLOCKS[hexAddr(payloadAddr)], payloadAddr));
        getTransport().clearQueue();
        if (writeProfile.pairFrame || writeProfile.wholeFrame) {
          await getTransport().sendBytes([0x57, group.addr >> 8, group.addr & 0xff, 0x40, ...payload], { expect: waitForAck ? [0x06] : [], responseLength: waitForAck ? 1 : 0, name: `write ${key} frame`, timeout: writeProfile.timeout, compactLog: true, logChunks: true, chunkDelay: writeProfile.chunkDelay, chunkSize: writeProfile.chunkSize, writeWithResponse: writeProfile.writeWithResponse });
        } else {
          await getTransport().sendBytes([0x57, group.addr >> 8, group.addr & 0xff, 0x40], { expect: [], responseLength: 0, name: `write ${key} command`, timeout: writeProfile.timeout, compactLog: true, logChunks: true, chunkDelay: 0, chunkSize: "frame", writeWithResponse: writeProfile.writeWithResponse });
          await getTransport().sendBytes(payload, { expect: waitForAck ? [0x06] : [], responseLength: waitForAck ? 1 : 0, name: `write ${key} data`, timeout: writeProfile.timeout, compactLog: true, logChunks: true, chunkDelay: writeProfile.chunkDelay, chunkSize: writeProfile.chunkSize, writeWithResponse: writeProfile.writeWithResponse });
        }
        done += group.requested;
        setProgress({ value: done, max: total, text: `Wrote ${done}/${total} blocks (${key})` });
        await sleep(writeProfile.blockDelay);
      }
      setProgress({ value: done, max: total, text: "Settling before exit" });
      await sleep(writeProfile.exitDelay);
      await getTransport().sendBytes([0x45], { expect: [], name: "exit" });
      if (baselineBlocks) setBaselineBlocks(cloneBlocks(blocks));
      setStatus("Write complete", "ok");
      setProgress({ value: total, max: total, text: `Write complete: ${total} blocks` });
    } catch (error) {
      if (setupComplete) await getTransport().sendBytes([0x45], { expect: [], name: "exit" }).catch((e) => log(`Exit failed: ${e.message}`));
      setStatus(error.message, "err"); log(`Write failed: ${error.message}`); setProgress({ value: done, max: total, text: error.message });
    } finally {
      if (setupComplete) {
        setProgress((old) => ({ ...old, text: "Settling before disconnect" }));
        await sleep(writeProfile.disconnectDelay);
      }
      await transport.current?.disconnect?.();
      setConnected(false);
      setBusy(false);
    }
  }

  function importYaml(event) {
    const file = event.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      const next = applyProvisionYaml(blocks, text);
      validateBlocks(next);
      setBlocks(next);
      setStatus("YAML import complete", "ok");
    }).catch((error) => setStatus(error.message, "err")).finally(() => { event.target.value = ""; });
  }

  function exportYaml() {
    const blob = new Blob([buildProvisionYaml(blocks)], { type: "application/x-yaml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `5r-mini-provision-${new Date().toISOString().replace(/[:.]/g, "-")}.yaml`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importRawBin(event) {
    const file = event.target.files[0];
    if (!file) return;
    file.arrayBuffer().then((buffer) => {
      const next = blocksFromRawBin(new Uint8Array(buffer));
      validateBlocks(next);
      setBlocks(next);
      setBaselineBlocks(cloneBlocks(next));
      setStatus("Raw binary import complete", "ok");
    }).catch((error) => setStatus(error.message, "err")).finally(() => { event.target.value = ""; });
  }

  function exportRawBin() {
    const blob = new Blob([blocksToRawBin(blocks)], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `5r-mini-memory-${new Date().toISOString().replace(/[:.]/g, "-")}.bin`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const canUseTransport = connected && !busy;
  return html`
    <main>
      <div class="top"><div><h1>BAOFENG UV-5R Mini BLE Tool</h1><p>Browser tool for reading, editing, importing, exporting, and writing radio memory.</p></div><span class=${`status ${status.type}`.trim()}>${status.text}</span></div>
      <${ConnectionPanel} settings=${settings} setSettings=${setSettings} connected=${connected} busy=${busy} connect=${connect} disconnect=${disconnect} probe=${probeHandshake} />
      <${OperationsPanel} canUseTransport=${canUseTransport} busy=${busy} readChannels=${readChannels} writeBack=${writeBack} stop=${() => { stopRequested.current = true; setStatus("Stopping after current response"); }} loadDefaults=${() => { setBlocks(cloneBlocks(DEFAULT_BLOCKS)); setStatus("Loaded blank template", "ok"); }} exportYaml=${exportYaml} importYaml=${importYaml} exportRawBin=${exportRawBin} importRawBin=${importRawBin} progress=${progress} settings=${settings} setSettings=${setSettings} />
      <${Tabs} tab=${tab} setTab=${setTab} />
      ${tab === "channels" && html`<${ChannelsTab} blocks=${blocks} setBlocks=${setBlocks} pageStart=${pageStart} setPageStart=${setPageStart} />`}
      ${tab === "pmr" && html`<${PmrWizardTab} updateBlocks=${updateBlocks} pmrTone=${pmrTone} setPmrTone=${setPmrTone} pmrStartSlot=${pmrStartSlot} setPmrStartSlot=${setPmrStartSlot} pmrNamePrefix=${pmrNamePrefix} setPmrNamePrefix=${setPmrNamePrefix} pmrPower=${pmrPower} setPmrPower=${setPmrPower} pmrWidth=${pmrWidth} setPmrWidth=${setPmrWidth} pmrScan=${pmrScan} setPmrScan=${setPmrScan} pmrPttId=${pmrPttId} setPmrPttId=${setPmrPttId} pmrCallingScope=${pmrCallingScope} setPmrCallingScope=${setPmrCallingScope} pmrSignalCode=${pmrSignalCode} setPmrSignalCode=${setPmrSignalCode} setPageStart=${setPageStart} setTab=${setTab} setStatus=${setStatus} />`}
      ${tab === "batch" && html`<${BatchWizardTab} blocks=${blocks} updateBlocks=${updateBlocks} batchTarget=${batchTarget} setBatchTarget=${setBatchTarget} batchStartSlot=${batchStartSlot} setBatchStartSlot=${setBatchStartSlot} batchEndSlot=${batchEndSlot} setBatchEndSlot=${setBatchEndSlot} batchToneMode=${batchToneMode} setBatchToneMode=${setBatchToneMode} batchRxTone=${batchRxTone} setBatchRxTone=${setBatchRxTone} batchTxTone=${batchTxTone} setBatchTxTone=${setBatchTxTone} batchPower=${batchPower} setBatchPower=${setBatchPower} batchWidth=${batchWidth} setBatchWidth=${setBatchWidth} batchScan=${batchScan} setBatchScan=${setBatchScan} batchBcl=${batchBcl} setBatchBcl=${setBatchBcl} batchPttId=${batchPttId} setBatchPttId=${setBatchPttId} batchDtmf=${batchDtmf} setBatchDtmf=${setBatchDtmf} setPageStart=${setPageStart} setTab=${setTab} setStatus=${setStatus} />`}
      ${tab === "calling" && html`<${CallingWizardTab} blocks=${blocks} updateBlocks=${updateBlocks} callingTarget=${callingTarget} setCallingTarget=${setCallingTarget} callingStartSlot=${callingStartSlot} setCallingStartSlot=${setCallingStartSlot} callingEndSlot=${callingEndSlot} setCallingEndSlot=${setCallingEndSlot} callingSignalCode=${callingSignalCode} setCallingSignalCode=${setCallingSignalCode} callingPttId=${callingPttId} setCallingPttId=${setCallingPttId} callingDtmf=${callingDtmf} setCallingDtmf=${setCallingDtmf} fleetCount=${fleetCount} setFleetCount=${setFleetCount} fleetPrefix=${fleetPrefix} setFleetPrefix=${setFleetPrefix} fleetFirstId=${fleetFirstId} setFleetFirstId=${setFleetFirstId} fleetOwnAni=${fleetOwnAni} setFleetOwnAni=${setFleetOwnAni} fleetOwnAniTouched=${fleetOwnAniTouched} setFleetOwnAniTouched=${setFleetOwnAniTouched} fleetMemberStart=${fleetMemberStart} setFleetMemberStart=${setFleetMemberStart} fleetChannelStart=${fleetChannelStart} setFleetChannelStart=${setFleetChannelStart} fleetFrequency=${fleetFrequency} setFleetFrequency=${setFleetFrequency} fleetTone=${fleetTone} setFleetTone=${setFleetTone} fleetPttId=${fleetPttId} setFleetPttId=${setFleetPttId} setPageStart=${setPageStart} setTab=${setTab} setStatus=${setStatus} />`}
      ${tab === "vfo" && html`<${VfoTab} blocks=${blocks} updateBlocks=${updateBlocks} />`}
      ${tab === "settings" && html`<${SettingsTab} blocks=${blocks} updateBlocks=${updateBlocks} />`}
      ${tab === "contacts" && html`<${DtmfTab} blocks=${blocks} updateBlocks=${updateBlocks} memberPrefix=${memberPrefix} setMemberPrefix=${setMemberPrefix} memberStartId=${memberStartId} setMemberStartId=${setMemberStartId} setStatus=${setStatus} />`}
      ${tab === "bootLogo" && html`<${BootLogoTab} connected=${connected} busy=${busy} getTransport=${getTransport} setStatus=${setStatus} setProgress=${setProgress} stopRequested=${stopRequested} log=${log} />`}
      ${tab === "raw" && html`<${RawTab} logText=${logText} />`}
    </main>`;
}

render(html`<${App} />`, document.getElementById("app"));

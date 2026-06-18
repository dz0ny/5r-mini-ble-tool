import { html } from "./preact.mjs?v=ani-sync";
import { Input } from "./components.mjs?v=ani-sync";

export function ConnectionPanel({ settings, setSettings, connected, busy, connect, disconnect, probe }) {
  const update = (key) => (event) => setSettings((old) => ({ ...old, [key]: event.target.value }));
  const updateChecked = (key) => (event) => setSettings((old) => ({ ...old, [key]: event.target.checked }));
  const resetDefaults = () => setSettings((old) => ({
    ...old,
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
    rxIdle: "140"
  }));
  const isSerial = settings.transportType === "serial";
  const setTransportType = (event) => setSettings((old) => ({ ...old, transportType: event.target.checked ? "serial" : "ble" }));
  return html`<section><h2>Connect Radio</h2>
    <div class="connection-card">
      <div>
        <strong>Radio connection</strong>
        <p>${isSerial ? "USB serial cable mode is enabled in advanced options." : "Scan for the radio and connect with the known default wireless settings."}</p>
      </div>
      <span class="pill">${isSerial ? "Web Serial" : "Wireless BLE"}</span>
    </div>
    <div class="actions connect-actions">
      <button onClick=${connect} disabled=${connected}>${isSerial ? "Connect Serial" : "Connect Bluetooth"}</button>
      <button class="secondary" onClick=${probe} disabled=${!connected || busy}>Test</button>
      <button class="secondary" onClick=${disconnect} disabled=${!connected || busy}>Disconnect</button>
    </div>
    <details class="advanced-panel">
      <summary>Advanced connection options</summary>
      <div class="actions advanced-actions">
        <label class="check"><input type="checkbox" checked=${isSerial} disabled=${connected || busy} onChange=${setTransportType} />Use USB serial cable instead of Bluetooth</label>
      </div>
      <div class="grid">
        ${isSerial ? html`
          <${Input} label="Baud rate" type="number" value=${settings.serialBaud || "115200"} onInput=${update("serialBaud")} />
          <${Input} label="Serial chunk bytes" type="number" value=${settings.serialChunkSize || "1024"} onInput=${update("serialChunkSize")} />
          <label class="check"><input type="checkbox" checked=${settings.serialDtr !== false} onChange=${updateChecked("serialDtr")} />DTR high</label>
          <label class="check"><input type="checkbox" checked=${settings.serialRts !== false} onChange=${updateChecked("serialRts")} />RTS high</label>
        ` : html`
          <${Input} label="Device name starts with" value=${settings.nameFilter} onInput=${update("nameFilter")} />
          <${Input} label="Service UUID" value=${settings.serviceUuid} onInput=${update("serviceUuid")} />
          <${Input} label="Write Characteristic UUID" value=${settings.writeUuid} onInput=${update("writeUuid")} />
          <${Input} label="Notify Characteristic UUID" value=${settings.notifyUuid} onInput=${update("notifyUuid")} />
          <${Input} label="BLE chunk bytes" type="number" value=${settings.chunkSize} onInput=${update("chunkSize")} />
        `}
        <${Input} label="Write Delay ms" type="number" value=${settings.writeDelay} onInput=${update("writeDelay")} />
        <${Input} label="RX Idle ms" type="number" value=${settings.rxIdle} onInput=${update("rxIdle")} />
      </div>
      <div class="actions advanced-actions">
        <button class="secondary" type="button" onClick=${resetDefaults}>Reset connection defaults</button>
        <span class="pill">${isSerial ? "Use Chrome or Edge with Web Serial" : "Use Chrome or Edge with Web Bluetooth"}</span>
      </div>
    </details>
  </section>`;
}

export function OperationsPanel({ canUseTransport, busy, readChannels, writeBack, stop, loadDefaults, exportYaml, importYaml, exportRawBin, importRawBin, progress, settings, setSettings }) {
  const update = (key) => (event) => setSettings((old) => ({ ...old, [key]: event.target.value }));
  const percent = Math.max(0, Math.min(100, Math.round((Number(progress.value || 0) / Math.max(1, Number(progress.max || 1))) * 100)));
  return html`<section><h2>Read / Write / Import / Export</h2>
    <div class="actions">
      <button disabled=${!canUseTransport} onClick=${readChannels}>Read</button>
      <button class="danger" disabled=${!canUseTransport} onClick=${writeBack}>Write</button>
      <label class="file-button">Import YAML<input type="file" accept=".yaml,.yml,text/yaml,application/x-yaml" hidden onChange=${importYaml} /></label>
      <button class="secondary" onClick=${exportYaml}>Export YAML</button>
    </div>
    <div class="progress"><div class="progress-head"><span>${progress.text}</span><span>${percent}%</span></div><div class="progress-track"><div class="progress-bar" style=${`width:${percent}%`}></div></div></div>
    <details class="advanced-panel">
      <summary>Advanced operations</summary>
      <div class="grid">
        <label>Write Mode
          <select value=${settings.writeMode || "pairedResponse"} onChange=${update("writeMode")}>
            <option value="pairedResponse">Paired 128-byte frame, GATT response chunks</option>
            <option value="paired">Paired 128-byte frame, no-response chunks</option>
            <option value="wholeResponse">Whole frame, 20-byte GATT response chunks</option>
            <option value="whole">Whole frame, 20-byte no-response chunks</option>
            <option value="frameResponse">Legacy split command/data, GATT response write</option>
            <option value="frameResponseSlow">Legacy split command/data, GATT response write, slow</option>
            <option value="frame">Legacy split command/data, no response write</option>
            <option value="paced">Paced UART, no response writes</option>
            <option value="uart">Fast UART, no response writes</option>
            <option value="response">GATT response writes</option>
          </select>
        </label>
        <label>ACK Handling
          <select value=${settings.writeAck || "ignore"} onChange=${update("writeAck")}>
            <option value="ignore">Do not wait for write ACK</option>
            <option value="wait">Wait for 06 ACK</option>
          </select>
        </label>
        <label>Write Target
          <select value=${settings.writeScope || "all"} onChange=${update("writeScope")}>
            <option value="all">Full writable memory</option>
            <option value="changed">Changed blocks only after read</option>
            <option value="first">Test first block only</option>
            <option value="channels">Channels only</option>
            <option value="settings">VFO, settings, DTMF only</option>
          </select>
        </label>
      </div>
      <div class="actions advanced-actions">
        <button class="secondary" disabled=${!busy} onClick=${stop}>Stop current operation</button>
        <button class="secondary" onClick=${loadDefaults}>Load blank template</button>
        <label class="file-button secondary">Import Raw BIN<input type="file" accept=".bin,application/octet-stream" hidden onChange=${importRawBin} /></label>
        <button class="secondary" onClick=${exportRawBin}>Export Raw BIN</button>
        <label class="check"><input type="checkbox" checked=${settings.verboseLog} onChange=${(e) => setSettings((old) => ({ ...old, verboseLog: e.target.checked }))} />Verbose block log</label>
      </div>
    </details>
  </section>`;
}

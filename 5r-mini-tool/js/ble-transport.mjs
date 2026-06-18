import { COMMON_TRANSPORTS } from "./protocol.mjs?v=ani-sync";
import { cleanUuid, sleep, toHex } from "./format.mjs?v=ani-sync";

export class BleTransport {
  constructor({ log, getSettings, setStatus, setManualUuids }) {
    this.kind = "ble";
    this.log = log;
    this.getSettings = getSettings;
    this.setStatus = setStatus;
    this.setManualUuids = setManualUuids;
    this.device = null;
    this.server = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.notificationQueue = [];
    this.notificationWaiter = null;
  }

  get connected() {
    return Boolean(this.device?.gatt?.connected && this.writeChar && this.notifyChar);
  }

  async connect() {
    if (!navigator.bluetooth) throw new Error("Web Bluetooth is not available");
    const { serviceUuid, writeUuid, notifyUuid, nameFilter } = this.getSettings();
    const service = cleanUuid(serviceUuid);
    const write = cleanUuid(writeUuid);
    const notify = cleanUuid(notifyUuid || writeUuid);
    const optionalServices = this.buildOptionalServices(service);
    const requestOptions = nameFilter.trim()
      ? { filters: [{ namePrefix: nameFilter.trim() }], optionalServices }
      : { acceptAllDevices: true, optionalServices };

    this.setStatus("Scanning...");
    this.device = await navigator.bluetooth.requestDevice(requestOptions);
    this.device.addEventListener("gattserverdisconnected", () => this.disconnectLocal());
    this.server = await this.device.gatt.connect();
    this.log(`Connected GATT: ${this.device.name || this.device.id}`);

    if (service && write && notify) await this.useManualTransport(service, write, notify);
    else await this.autoSelectTransport();

    await this.notifyChar.startNotifications();
    this.notifyChar.addEventListener("characteristicvaluechanged", (event) => this.onNotification(event));
    return this.device.name || this.device.id;
  }

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.disconnectLocal();
  }

  disconnectLocal() {
    this.writeChar = null;
    this.notifyChar = null;
    this.server = null;
    this.log("Disconnected");
  }

  async useManualTransport(serviceUuid, writeUuid, notifyUuid) {
    const service = await this.server.getPrimaryService(serviceUuid);
    this.writeChar = await service.getCharacteristic(writeUuid);
    this.notifyChar = notifyUuid === writeUuid ? this.writeChar : await service.getCharacteristic(notifyUuid);
    this.log(`Using manual transport service=${serviceUuid}, write=${writeUuid}, notify=${notifyUuid}`);
  }

  async autoSelectTransport() {
    const tried = [];
    for (const preset of COMMON_TRANSPORTS) {
      try {
        const service = await this.server.getPrimaryService(preset.service);
        const chars = await service.getCharacteristics();
        this.log(`Found ${preset.name}: ${preset.service}`);
        chars.forEach((char) => this.log(`  characteristic ${char.uuid} props=${describeProperties(char.properties)}`));
        this.writeChar = pickCharacteristic(chars, preset.write, "write");
        this.notifyChar = pickCharacteristic(chars, preset.notify, "notify") || this.writeChar;
        if (this.writeChar && this.notifyChar && canNotify(this.notifyChar)) {
          this.setManualUuids({ serviceUuid: preset.service, writeUuid: this.writeChar.uuid, notifyUuid: this.notifyChar.uuid });
          this.log(`Auto-selected ${preset.name}`);
          return;
        }
        tried.push(`${preset.name}: no writable/notifiable pair`);
      } catch (error) {
        tried.push(`${preset.name}: ${error.message}`);
      }
    }
    throw new Error(`Connected, but no supported UART service was found. Tried: ${tried.join("; ")}`);
  }

  async sendBytes(bytes, options = {}) {
    const { writeDelay, chunkSize, rxIdle, verboseLog } = this.getSettings();
    const configuredDelay = Number(writeDelay || 0);
    const payload = Uint8Array.from(bytes);
    const configuredChunkBytes = Math.max(1, Math.min(244, Number(chunkSize || 20)));
    const chunkBytes = options.chunkSize === "frame" ? payload.length : options.chunkSize ? Math.max(1, Math.min(244, Number(options.chunkSize))) : configuredChunkBytes;
    const delay = options.chunkDelay ?? (payload.length > chunkBytes ? Math.max(configuredDelay, 18) : configuredDelay);
    const compact = options.compactLog && !verboseLog;
    if (!compact) this.log(`TX ${options.name || ""}: ${toHex(payload)}`);
    else if (options.logChunks) this.log(`TX ${options.name || ""}: ${payload.length} bytes as ${Math.ceil(payload.length / chunkBytes)} chunk(s), ${options.writeWithResponse ? "GATT response" : "no response"}`);
    for (let offset = 0; offset < payload.length; offset += chunkBytes) {
      const chunk = payload.slice(offset, offset + chunkBytes);
      if (options.writeWithResponse && this.writeChar.properties.write) await this.writeChar.writeValueWithResponse(chunk);
      else if (this.writeChar.properties.writeWithoutResponse) {
        await this.writeChar.writeValueWithoutResponse(chunk).catch(async () => {
          if (!this.writeChar.properties.write) throw new Error("writeWithoutResponse failed and writeWithResponse is not supported");
          await this.writeChar.writeValueWithResponse(chunk);
        });
      } else await this.writeChar.writeValueWithResponse(chunk);
      if (delay > 0) await sleep(delay);
    }
    if (!options.expect && !options.responseLength) return new Uint8Array();
    if (options.expect?.length === 0 && !options.responseLength) return new Uint8Array();
    let response;
    try {
      response = await this.waitForNotification(
        options.responseLength || options.expect.length,
        options.timeout || 1500,
        options.responseLength ? 0 : Number(rxIdle || 140)
      );
    } catch (error) {
      throw new Error(`${options.name || "command"}: ${error.message}`);
    }
    if (!compact || options.logResponse) this.log(`RX ${options.name || ""}: ${toHex(response)}`);
    if (options.expect?.length) {
      for (let i = 0; i < options.expect.length; i += 1) {
        if (response[i] !== options.expect[i]) throw new Error(`${options.name || "command"} expected ${toHex(Uint8Array.from(options.expect))}, got ${toHex(response)}`);
      }
    }
    return response;
  }

  clearQueue() {
    this.notificationQueue = [];
  }

  onNotification(event) {
    const value = new Uint8Array(event.target.value.buffer.slice(0));
    if (this.notificationWaiter) this.notificationWaiter.resolve(value);
    else this.notificationQueue.push(...value);
  }

  waitForNotification(minLength, timeout, idleMs) {
    return new Promise((resolve, reject) => {
      const pending = [];
      let idleTimer;
      const tryResolve = () => {
        while (this.notificationQueue.length && pending.length < minLength) pending.push(this.notificationQueue.shift());
        if (pending.length >= minLength) {
          clearTimeout(timer);
          clearTimeout(idleTimer);
          if (idleMs <= 0) {
            this.notificationWaiter = null;
            resolve(Uint8Array.from(pending));
            return true;
          }
          idleTimer = setTimeout(() => {
            this.notificationWaiter = null;
            resolve(Uint8Array.from(pending));
          }, idleMs);
          return true;
        }
        return false;
      };
      const timer = setTimeout(() => {
        clearTimeout(idleTimer);
        this.notificationWaiter = null;
        pending.length ? resolve(Uint8Array.from(pending)) : reject(new Error("Timed out waiting for notification"));
      }, timeout);
      if (tryResolve()) return;
      this.notificationWaiter = { resolve: (value) => { pending.push(...value); tryResolve(); } };
    });
  }

  buildOptionalServices(manualService) {
    const services = new Set(COMMON_TRANSPORTS.map((preset) => preset.service));
    if (manualService) services.add(manualService);
    return Array.from(services);
  }
}

function pickCharacteristic(chars, preferredUuids, mode) {
  const preferred = chars.find((char) => preferredUuids.map((uuid) => uuid.toLowerCase()).includes(char.uuid.toLowerCase()));
  if (preferred && (mode === "write" ? canWrite(preferred) : canNotify(preferred))) return preferred;
  return chars.find((char) => mode === "write" ? canWrite(char) : canNotify(char));
}

function canWrite(char) {
  return char.properties.write || char.properties.writeWithoutResponse;
}

function canNotify(char) {
  return char.properties.notify || char.properties.indicate;
}

function describeProperties(props) {
  return ["read", "write", "writeWithoutResponse", "notify", "indicate"].filter((key) => props[key]).join(",") || "none";
}

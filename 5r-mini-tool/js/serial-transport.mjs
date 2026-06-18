import { sleep, toHex } from "./format.mjs?v=ani-sync";

export class SerialTransport {
  constructor({ log, getSettings, setStatus }) {
    this.kind = "serial";
    this.log = log;
    this.getSettings = getSettings;
    this.setStatus = setStatus;
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.reading = false;
    this.disconnecting = false;
    this.notificationQueue = [];
    this.notificationWaiter = null;
  }

  get connected() {
    return Boolean(this.port?.readable && this.port?.writable && this.writer);
  }

  async connect() {
    if (!navigator.serial) throw new Error("Web Serial is not available in this browser");
    const settings = this.getSettings();
    const baudRate = Math.max(1200, Number(settings.serialBaud || 115200));
    if (this.connected) {
      this.log(`Serial already connected: ${baudRate} 8N1`);
      return `serial ${baudRate}`;
    }
    if (this.port) await this.disconnect();
    this.setStatus("Choosing serial port...");
    this.port = await navigator.serial.requestPort();
    if (!this.port.readable || !this.port.writable) {
      await this.port.open({ baudRate, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" });
    } else {
      this.log("Serial port was already open; reusing existing session");
    }
    await this.port.setSignals({
      dataTerminalReady: settings.serialDtr !== false,
      requestToSend: settings.serialRts !== false
    }).catch((error) => this.log(`Serial signal setup skipped: ${error.message}`));
    try {
      this.writer = this.port.writable.getWriter();
    } catch (error) {
      await this.disconnect();
      throw new Error(`Serial writer unavailable: ${error.message}`);
    }
    this.readLoop();
    this.log(`Connected serial: ${baudRate} 8N1`);
    return `serial ${baudRate}`;
  }

  async disconnect() {
    if (this.disconnecting) return;
    this.disconnecting = true;
    const port = this.port;
    const reader = this.reader;
    const writer = this.writer;
    this.port = null;
    this.writer = null;
    this.notificationQueue = [];
    this.notificationWaiter = null;
    try {
      if (writer) {
        await writer.close().catch(() => {});
        try {
          writer.releaseLock();
        } catch {
          // The stream may already be released after a failed write.
        }
      }
      if (reader) {
        await reader.cancel().catch(() => {});
        try {
          reader.releaseLock();
        } catch {
          // The read loop may own final lock cleanup.
        }
        if (this.reader === reader) this.reader = null;
      }
      for (let i = 0; i < 20 && this.reading; i += 1) await sleep(25);
      if (port) await port.close().catch((error) => this.log(`Serial close skipped: ${error.message}`));
    } finally {
      this.disconnecting = false;
      this.log("Disconnected");
    }
  }

  async sendBytes(bytes, options = {}) {
    if (!this.writer) throw new Error("Serial port is not connected");
    const { rxIdle, serialChunkSize, verboseLog, writeDelay } = this.getSettings();
    const payload = Uint8Array.from(bytes);
    const configuredChunkBytes = Math.max(1, Number(serialChunkSize || 1024));
    const chunkBytes = options.chunkSize === "frame" ? payload.length : options.chunkSize ? Math.max(1, Number(options.chunkSize)) : configuredChunkBytes;
    const delay = options.chunkDelay ?? Number(writeDelay || 0);
    const compact = options.compactLog && !verboseLog;
    if (!compact) this.log(`TX ${options.name || ""}: ${toHex(payload)}`);
    else if (options.logChunks) this.log(`TX ${options.name || ""}: ${payload.length} bytes as ${Math.ceil(payload.length / chunkBytes)} serial chunk(s)`);
    for (let offset = 0; offset < payload.length; offset += chunkBytes) {
      await this.writer.write(payload.slice(offset, offset + chunkBytes));
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

  async readLoop() {
    if (this.reading) return;
    this.reading = true;
    while (this.port?.readable) {
      this.reader = this.port.readable.getReader();
      try {
        while (this.port) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value?.length) this.onData(value);
        }
      } catch (error) {
        if (this.port) this.log(`Serial read failed: ${error.message}`);
      } finally {
        try {
          this.reader?.releaseLock();
        } catch {
          // The disconnect path may already have released this lock.
        }
        this.reader = null;
      }
    }
    this.reading = false;
  }

  onData(value) {
    const bytes = Uint8Array.from(value);
    if (this.notificationWaiter) this.notificationWaiter.resolve(bytes);
    else this.notificationQueue.push(...bytes);
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
        pending.length ? resolve(Uint8Array.from(pending)) : reject(new Error("Timed out waiting for serial data"));
      }, timeout);
      if (tryResolve()) return;
      this.notificationWaiter = { resolve: (value) => { pending.push(...value); tryResolve(); } };
    });
  }
}

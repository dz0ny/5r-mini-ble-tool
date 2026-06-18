#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "bleak>=0.22.3",
# ]
# ///
import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb"
WRITE_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"
BLOCK_SIZE = 0x40
READ_RANGES = [(0x0000, 0x7CC0), (0x8000, 0x8040), (0x9000, 0x9040), (0xA000, 0xA1C0)]
WRITE_RANGES = [(0x0000, 0x7CC0), (0x8000, 0x8040), (0x9000, 0x9040), (0xA000, 0xA180)]
SETUP_STEPS = [
    ("PROGRAMCOLORPROU", bytes.fromhex("50 52 4F 47 52 41 4D 43 4F 4C 4F 52 50 52 4F 55"), b"\x06", 1),
    ("range", bytes([0x46]), b"\x01", 16),
    ("model", bytes([0x4D]), b"\x35", 15),
    ("SEND!", bytes.fromhex("53 45 4E 44 21 05 0D 01 01 01 04 11 08 05 0D 0D 01 11 0F 09 12 09 10 04 00"), b"\x06", 1),
]


def main():
    parser = argparse.ArgumentParser(description="5R Mini BLE memory read/write backend")
    sub = parser.add_subparsers(dest="command", required=True)

    dump = sub.add_parser("dump", help="read memory from a BLE radio")
    add_ble_options(dump)
    dump.add_argument("-o", "--output", default="-", help="output path, or - for stdout")
    dump.add_argument("--format", choices=["raw", "json"], help="output format; defaults from extension")

    write = sub.add_parser("write", help="write memory BIN/JSON to a BLE radio")
    add_ble_options(write)
    write.add_argument("input", help="raw memory .bin or memory .json")
    write.add_argument("--target", choices=["all", "first", "channels", "settings"], default="all")
    write.add_argument("--mode", choices=["paired", "single"], default="paired")
    write.add_argument("--wait-ack", action="store_true", help="wait for 06 notification after each write frame")

    args = parser.parse_args()
    try:
        if args.command == "dump":
            asyncio.run(dump_command(args))
        elif args.command == "write":
            asyncio.run(write_command(args))
    except KeyboardInterrupt:
        print("stopped", file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)


def add_ble_options(parser):
    parser.add_argument("--name-prefix", default="walkie", help="BLE device name prefix")
    parser.add_argument("--service", default=SERVICE_UUID, help="BLE service UUID")
    parser.add_argument("--write-char", default=WRITE_UUID, help="BLE write characteristic UUID")
    parser.add_argument("--notify-char", default=NOTIFY_UUID, help="BLE notify characteristic UUID")
    parser.add_argument("--scan-timeout", type=float, default=8.0, help="seconds to scan for the radio")
    parser.add_argument("--chunk-size", type=int, default=20, help="BLE write chunk size")
    parser.add_argument("--chunk-delay", type=float, default=0.02, help="delay between BLE chunks, seconds")
    parser.add_argument("--setup-delay", type=float, default=0.45, help="delay after entering program mode, seconds")
    parser.add_argument("--response-write", action=argparse.BooleanOptionalAction, default=True, help="use GATT response writes")
    parser.add_argument("-v", "--verbose", action="store_true")


async def dump_command(args):
    async with RadioBle(args) as radio:
        entered = False
        try:
            await radio.enter_program_mode()
            entered = True
            blocks = await radio.read_blocks()
        finally:
            if entered:
                await radio.exit_program_mode()
    output_format = args.format or ("json" if str(args.output).lower().endswith(".json") else "raw")
    if output_format == "json":
        write_output(args.output, format_memory_json(blocks).encode())
    else:
        write_output(args.output, blocks_to_raw_bin(blocks))


async def write_command(args):
    blocks = read_memory_input(args.input)
    async with RadioBle(args) as radio:
        entered = False
        try:
            await radio.enter_program_mode()
            entered = True
            await radio.write_blocks(blocks, args.target, args.mode, args.wait_ack)
        finally:
            if entered:
                await radio.exit_program_mode()


class RadioBle:
    def __init__(self, args):
        self.args = args
        self.client = None
        self.rx = bytearray()
        self.rx_event = asyncio.Event()

    async def __aenter__(self):
        bleak = load_bleak()
        name_prefix = (self.args.name_prefix or "").lower()

        def match(device, _advertisement):
            name = (device.name or "").lower()
            return not name_prefix or name.startswith(name_prefix)

        print(f"scan: name-prefix={self.args.name_prefix!r}", file=sys.stderr)
        device = await bleak.BleakScanner.find_device_by_filter(match, timeout=self.args.scan_timeout)
        if not device:
            raise RuntimeError(f"no BLE device found with name prefix {self.args.name_prefix!r}")
        print(f"connect: {device.name or device.address}", file=sys.stderr)
        self.client = bleak.BleakClient(device)
        await self.client.connect()
        await self.client.start_notify(self.args.notify_char, self.on_notify)
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self.client:
            try:
                if self.client.is_connected:
                    await self.client.stop_notify(self.args.notify_char)
            except Exception:
                pass
            try:
                if self.client.is_connected:
                    await self.client.disconnect()
            finally:
                print("disconnect", file=sys.stderr)

    def on_notify(self, _sender, data):
        self.rx.extend(bytes(data))
        self.rx_event.set()

    async def enter_program_mode(self):
        for name, payload, expect, response_length in SETUP_STEPS:
            response = await self.send(payload, name=name, expect=expect, response_length=response_length, timeout=2.5)
            if self.args.verbose:
                print(f"rx {name}: {hex_bytes(response)}", file=sys.stderr)
        await asyncio.sleep(self.args.setup_delay)

    async def exit_program_mode(self):
        await self.send(bytes([0x45]), name="exit", response_length=0, timeout=1.0)

    async def read_blocks(self):
        blocks = {}
        addresses = range_addresses(READ_RANGES)
        total = len(addresses)
        for index, addr in enumerate(addresses, start=1):
            response = await self.send(bytes([0x52, addr >> 8, addr & 0xFF, 0x40]), name=f"read {hex_addr(addr)}", expect=b"\x52", response_length=68, timeout=2.5)
            blocks[hex_addr(addr)] = normalize_block(addr, response)
            progress("read", index, total, addr)
        print(file=sys.stderr)
        return blocks

    async def write_blocks(self, blocks, target, mode, wait_ack):
        addresses = write_addresses(target)
        groups = write_groups(addresses, mode)
        total = len(addresses)
        done = 0
        for group in groups:
            addr = group[0]
            payload = b"".join(block_payload(blocks.get(hex_addr(payload_addr), default_block(payload_addr)), payload_addr) for payload_addr in group)
            frame = bytes([0x57, addr >> 8, addr & 0xFF, 0x40]) + payload
            await self.send(frame, name=f"write {hex_addr(addr)}", expect=b"\x06" if wait_ack else b"", response_length=1 if wait_ack else 0, timeout=10.0)
            done += sum(1 for group_addr in group if group_addr in addresses)
            progress("write", done, total, addr)
        print(file=sys.stderr)

    async def send(self, payload, name, expect=b"", response_length=0, timeout=1.5):
        self.rx.clear()
        self.rx_event.clear()
        if self.args.verbose:
            print(f"tx {name}: {hex_bytes(payload)}", file=sys.stderr)
        for offset in range(0, len(payload), self.args.chunk_size):
            chunk = payload[offset:offset + self.args.chunk_size]
            await self.client.write_gatt_char(self.args.write_char, chunk, response=self.args.response_write)
            if self.args.chunk_delay > 0 and offset + self.args.chunk_size < len(payload):
                await asyncio.sleep(self.args.chunk_delay)
        if response_length <= 0 and not expect:
            return b""
        response = await self.wait_response(max(response_length, len(expect)), timeout)
        if expect and response[:len(expect)] != expect:
            raise RuntimeError(f"{name} expected {hex_bytes(expect)}, got {hex_bytes(response)}")
        return response

    async def wait_response(self, length, timeout):
        deadline = time.monotonic() + timeout
        while len(self.rx) < length:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("timed out waiting for notification")
            try:
                await asyncio.wait_for(self.rx_event.wait(), remaining)
            except asyncio.TimeoutError:
                raise TimeoutError("timed out waiting for notification") from None
            self.rx_event.clear()
        out = bytes(self.rx[:length])
        del self.rx[:length]
        return out


def load_bleak():
    try:
        import bleak
    except ImportError as error:
        raise RuntimeError("Python package 'bleak' is required for BLE CLI support. Install with: python3 -m pip install bleak") from error
    return bleak


def range_addresses(ranges):
    return [addr for begin, end in ranges for addr in range(begin, end + 1, BLOCK_SIZE)]


def write_addresses(target):
    if target == "first":
        return [0x0000]
    ranges = WRITE_RANGES[1:] if target == "settings" else [WRITE_RANGES[0]] if target == "channels" else WRITE_RANGES
    return range_addresses(ranges)


def write_groups(addresses, mode):
    if mode == "single":
        return [[addr] for addr in addresses]
    starts = sorted({(addr // (BLOCK_SIZE * 2)) * BLOCK_SIZE * 2 for addr in addresses})
    return [[addr, addr + BLOCK_SIZE] for addr in starts]


def normalize_block(addr, response):
    data = bytes(response)
    if len(data) >= 68 and data[0] == 0x52:
        return list(data[:68])
    if len(data) >= 64:
        return [0x52, addr >> 8, addr & 0xFF, 0x40, *data[:64]]
    raise RuntimeError(f"short block at {hex_addr(addr)}: {len(data)} bytes")


def block_payload(block, addr):
    data = bytes(block)
    if len(data) >= 68 and data[0] in (0x52, 0x57) and data[3] == 0x40:
        return data[4:68]
    if len(data) >= 64:
        if data[0] == 0x57 and data[3] == 0x40:
            raise RuntimeError(f"block {hex_addr(addr)} looks like a truncated write frame, not raw memory")
        return data[:64]
    raise RuntimeError(f"short block at {hex_addr(addr)}: {len(data)} bytes")


def default_block(addr):
    return [0x52, addr >> 8, addr & 0xFF, 0x40, *([0xFF] * 64)]


def blocks_to_raw_bin(blocks):
    return b"".join(block_payload(blocks.get(hex_addr(addr), default_block(addr)), addr) for addr in range_addresses(READ_RANGES))


def raw_bin_to_blocks(data):
    total = len(range_addresses(READ_RANGES))
    if len(data) not in (total * 64, total * 68):
        raise RuntimeError(f"raw binary must be {total * 64} payload bytes or {total * 68} framed bytes")
    blocks = {}
    offset = 0
    framed = len(data) == total * 68
    for addr in range_addresses(READ_RANGES):
        if framed:
            payload = block_payload(data[offset:offset + 68], addr)
            offset += 68
        else:
            payload = data[offset:offset + 64]
            if payload[:1] == b"\x57" and len(payload) >= 4 and payload[3] == 0x40:
                raise RuntimeError(f"raw binary block {hex_addr(addr)} starts with a write command header")
            offset += 64
        blocks[hex_addr(addr)] = [0x52, addr >> 8, addr & 0xFF, 0x40, *payload]
    return blocks


def read_memory_input(path):
    data = Path(path).read_bytes()
    if path.lower().endswith(".json"):
        blocks = json.loads(data.decode())
        validate_blocks(blocks)
        return blocks
    return raw_bin_to_blocks(data)


def validate_blocks(blocks):
    if not isinstance(blocks, dict):
        raise RuntimeError("memory JSON must be an object")
    for key, block in blocks.items():
        if not isinstance(key, str) or len(key) != 4:
            raise RuntimeError(f"bad block key {key!r}")
        if not isinstance(block, list) or len(block) != 68:
            raise RuntimeError(f"block {key} must contain 68 bytes")
        if any(not isinstance(byte, int) or byte < 0 or byte > 255 for byte in block):
            raise RuntimeError(f"block {key} contains invalid byte values")


def format_memory_json(blocks):
    lines = [f'  "{key}": [{",".join(str(byte) for byte in blocks[key])}]' for key in sorted(blocks)]
    return "{\n" + ",\n".join(lines) + "\n}\n"


def write_output(path, data):
    if path == "-":
        sys.stdout.buffer.write(data)
    else:
        Path(path).write_bytes(data)


def progress(label, done, total, addr):
    print(f"\r{label}: {done}/{total} ({hex_addr(addr)})", end="", file=sys.stderr, flush=True)


def hex_addr(addr):
    return f"{addr:04X}"


def hex_bytes(data):
    return " ".join(f"{byte:02X}" for byte in data)


if __name__ == "__main__":
    main()

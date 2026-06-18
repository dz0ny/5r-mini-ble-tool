# 5R Mini CLI

The CLI can read/write the radio over BLE and can edit exported memory JSON files.

BLE commands use `uv` script metadata, so the Python BLE dependency is installed automatically:

```sh
uv run --script 5r-mini-tool/ble_cli.py dump -o radio.bin
```

Read the radio to a raw memory dump:

```sh
outputs/5r-mini-tool/cli ble-dump -o radio.bin
```

Read the radio to memory JSON for YAML editing:

```sh
outputs/5r-mini-tool/cli ble-dump --format json -o radio.json
```

Write memory back to the radio:

```sh
outputs/5r-mini-tool/cli ble-write radio.bin
outputs/5r-mini-tool/cli ble-write radio-updated.json
```

The default BLE write mode uses the working paired protocol: one `57 addr 40`
command with two 64-byte memory blocks. That prevents the command header from
being written into every other channel block.

Dump an editable provision YAML config:

```sh
outputs/5r-mini-tool/cli dump /path/to/read.json --provision -o radio.yaml
```

Apply provision YAML back onto a memory JSON:

```sh
outputs/5r-mini-tool/cli apply /path/to/read.json radio.yaml -o radio-updated.json
```

Then write it directly:

```sh
outputs/5r-mini-tool/cli ble-write radio-updated.json
```

Useful BLE options:

```sh
outputs/5r-mini-tool/cli ble-dump --name-prefix walkie -o radio.bin
outputs/5r-mini-tool/cli ble-write --target channels radio-updated.json
outputs/5r-mini-tool/cli ble-write --target first radio-updated.json
```

Use `--target first` for a small write test. Because this radio writes paired
blocks, it writes the first two 64-byte blocks as one radio frame.

Provision YAML shape:

```yaml
clearChannels: false

defaults:
  channel:
    rxTone: OFF
    txTone: OFF
    power: Low
    width: Narrow
    scan: Yes
    signal: 0
    dtmf: Off
    jump: Off
    ptt: Off
    bcl: Off
    fhss: Off

settings:
  squelch: 3
  voice: English
  sideKeyShort: FM Radio
  vfoScanStart: 400
  vfoScanEnd: 470

frequencies:
  - slot: 1
    name: PMR01
    frequency: 446.00625
    tone: OFF
  - slot: 2
    name: CALL01
    frequency: 446.00625
    signal: 1
    dtmf: On
    ptt: Begin

members:
  - slot: 1
    code: "101"
    name: R01
```

Use `frequency` when RX and TX are the same. Use `rx` and `tx` when they differ.
Entries inherit `defaults.channel`, and each entry can override any channel field.

`clearChannels: true` clears all channel slots before applying the frequency list.

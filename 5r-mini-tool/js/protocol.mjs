export const PROTOCOL = {
  setup: [
    { send: [0x50,0x52,0x4f,0x47,0x52,0x41,0x4d,0x43,0x4f,0x4c,0x4f,0x52,0x50,0x52,0x4f,0x55], expect: [0x06], responseLength: 1, name: "PROGRAMCOLORPROU" },
    { send: [0x46], expect: [0x01], responseLength: 16, name: "range" },
    { send: [0x4d], expect: [0x35], responseLength: 15, name: "model" },
    { send: [0x53,0x45,0x4e,0x44,0x21,0x05,0x0d,0x01,0x01,0x01,0x04,0x11,0x08,0x05,0x0d,0x0d,0x01,0x11,0x0f,0x09,0x12,0x09,0x10,0x04,0x00], expect: [0x06], responseLength: 1, name: "SEND!" }
  ],
  readRanges: [[0x0000, 0x7cc0], [0x8000, 0x8040], [0x9000, 0x9040], [0xa000, 0xa1c0]],
  writeRanges: [[0x0000, 0x7cc0], [0x8000, 0x8040], [0x9000, 0x9040], [0xa000, 0xa180]],
  blockSize: 0x40,
  channelBegin: 0x0000,
  channelEnd: 0x7cff,
  channelRecordSize: 0x20
};

export const CRYPT_KEY = [0x43, 0x4f, 0x20, 0x37];
export const DTMF_CHARS = "0123456789ABCD*#";
export const STEPS = ["2.5", "5", "6.25", "10", "12.5", "20", "25", "50"];
const OFF_ON = [[0, "Off"], [1, "On"]];
const SQUELCH_OPTIONS = [[0, "0"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]];
const VOX_OPTIONS = [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [7, "7"], [8, "8"], [9, "9"]];
const TIMEOUT_OPTIONS = [[0, "Off"], [1, "15s"], [2, "30s"], [3, "45s"], [4, "60s"], [5, "75s"], [6, "90s"], [7, "105s"], [8, "120s"], [9, "135s"], [10, "150s"], [11, "165s"], [12, "180s"]];
const BACKLIGHT_OPTIONS = [[0, "Always on"], [1, "5s"], [2, "10s"], [3, "15s"], [4, "20s"]];
const MENU_TIMEOUT_OPTIONS = [[0, "5s"], [1, "10s"], [2, "15s"], [3, "20s"], [4, "25s"], [5, "30s"], [6, "35s"], [7, "40s"], [8, "45s"], [9, "50s"], [10, "60s"]];
const PTT_DELAY_OPTIONS = [[0, "100ms"], [1, "200ms"], [2, "300ms"], [3, "400ms"], [4, "500ms"], [5, "600ms"], [6, "700ms"], [7, "800ms"], [8, "900ms"], [9, "1000ms"], [10, "1100ms"], [11, "1200ms"], [12, "1300ms"], [13, "1400ms"], [14, "1500ms"], [15, "1600ms"], [16, "1700ms"], [17, "1800ms"], [18, "1900ms"], [19, "2000ms"], [20, "2100ms"], [21, "2200ms"], [22, "2300ms"], [23, "2400ms"], [24, "2500ms"], [25, "2600ms"], [26, "2700ms"], [27, "2800ms"], [28, "2900ms"], [29, "3000ms"]];
const REPEATER_NOISE_OPTIONS = [[0, "0ms"], [1, "100ms"], [2, "200ms"], [3, "300ms"], [4, "400ms"], [5, "500ms"], [6, "600ms"], [7, "700ms"], [8, "800ms"], [9, "900ms"], [10, "1000ms"]];
const VOX_DELAY_OPTIONS = Array.from({ length: 16 }, (_, index) => [index, `${500 + index * 100}ms`]);
const RTONE_OPTIONS = [[0, "1000Hz"], [1, "1450Hz"], [2, "1750Hz"], [3, "2100Hz"]];
export const PMR_CHANNELS = [
  446.00625, 446.01875, 446.03125, 446.04375,
  446.05625, 446.06875, 446.08125, 446.09375,
  446.10625, 446.11875, 446.13125, 446.14375,
  446.15625, 446.16875, 446.18125, 446.19375
];

export const BASIC_SETTINGS = [
  { key: "squelch", label: "Squelch", addr: 0x9000, kind: "number", description: "How strong a signal must be before the speaker opens.", options: SQUELCH_OPTIONS },
  { key: "save", label: "Battery Save", addr: 0x9001, kind: "number", description: "Receiver sleep cycling to save battery. Use Off if it clips weak or short calls.", options: OFF_ON },
  { key: "vox", label: "VOX Level", addr: 0x9002, kind: "number", description: "Hands-free voice transmit sensitivity.", options: VOX_OPTIONS },
  { key: "backlight", label: "Backlight", addr: 0x9003, kind: "number", description: "LCD/keypad light timeout.", options: BACKLIGHT_OPTIONS },
  { key: "dualWatch", label: "Dual Watch", addr: 0x9004, kind: "number", description: "Monitor A and B sides instead of only the active side.", options: OFF_ON },
  { key: "timeout", label: "Transmit Timeout", addr: 0x9005, kind: "number", description: "Maximum transmit time before the radio cuts TX.", options: TIMEOUT_OPTIONS },
  { key: "beep", label: "Key Beep", addr: 0x9006, kind: "number", description: "Keypad/menu confirmation beeps.", options: OFF_ON },
  { key: "voiceSwitch", label: "Voice Prompt", addr: 0x9007, kind: "number", description: "Spoken menu/channel prompts.", options: OFF_ON },
  { key: "voice", label: "Voice Language", addr: 0x9008, kind: "number", description: "Voice prompt language.", options: [[0, "English"], [1, "Chinese"]] },
  { key: "sideTone", label: "DTMF Sidetone", addr: 0x9009, kind: "number", description: "Which DTMF/ANI tones are heard locally while sending.", options: [[0, "Off"], [1, "Keypad DTMF"], [2, "ANI/DTMF"], [3, "Keypad + ANI/DTMF"]] },
  { key: "scanMode", label: "Scan Resume", addr: 0x900a, kind: "number", description: "How scan behaves after finding activity.", options: [[0, "Time"], [1, "Carrier"], [2, "Search"]] },
  { key: "pttId", label: "PTT ID Mode", addr: 0x900b, kind: "number", description: "When to send ANI/DTMF ID during transmit.", options: [[0, "Off"], [1, "Begin"], [2, "End"], [3, "Both"]] },
  { key: "pttDelay", label: "PTT Delay", addr: 0x900c, kind: "number", description: "Delay before sending PTT ID.", options: PTT_DELAY_OPTIONS },
  { key: "channelADisplay", label: "A Display", addr: 0x900d, kind: "number", description: "What the A side shows in channel mode.", options: [[0, "Channel"], [1, "Frequency"], [2, "Name"]] },
  { key: "channelBDisplay", label: "B Display", addr: 0x900e, kind: "number", description: "What the B side shows in channel mode.", options: [[0, "Channel"], [1, "Frequency"], [2, "Name"]] },
  { key: "bcl", label: "Busy Lock", addr: 0x900f, kind: "number", description: "Prevent transmitting when the channel is already busy.", options: OFF_ON },
  { key: "autoLock", label: "Auto Key Lock", addr: 0x9010, kind: "number", description: "Automatically lock keypad after idle time.", options: OFF_ON },
  { key: "alarmMode", label: "Alarm Mode", addr: 0x9011, kind: "number", description: "Emergency alarm behavior.", options: [[0, "Site"], [1, "Tone"], [2, "Code"]], help: ["Site: local alarm behavior on this radio.", "Tone: send an audible alarm tone.", "Code: send an alarm code/ANI-style signal."] },
  { key: "alarmTone", label: "Alarm Sound", addr: 0x9012, kind: "number", description: "Emergency alarm sound.", options: OFF_ON },
  { key: "totAlarm", label: "TOT Alarm", addr: 0x9013, kind: "number", description: "Warning time before transmit timeout.", options: [[0, "Off"], [1, "1s"], [2, "2s"], [3, "3s"], [4, "4s"], [5, "5s"], [6, "6s"], [7, "7s"], [8, "8s"], [9, "9s"], [10, "10s"]] },
  { key: "tailClear", label: "Tail Eliminate", addr: 0x9014, kind: "number", description: "Suppress squelch tail noise at the end of received transmissions.", options: OFF_ON },
  { key: "repeaterTailClear", label: "Repeater Tail Clear", addr: 0x9015, kind: "number", description: "Delay used when clearing repeater tail noise.", options: REPEATER_NOISE_OPTIONS },
  { key: "repeaterTailDelay", label: "Repeater Tail Delay", addr: 0x9016, kind: "number", description: "Repeater tail noise delay.", options: REPEATER_NOISE_OPTIONS },
  { key: "roger", label: "Roger Beep", addr: 0x9017, kind: "number", description: "Send an end-of-transmission beep.", options: OFF_ON },
  { key: "rTone", label: "Repeater Tone Burst", addr: 0x901d, kind: "number", description: "Tone burst frequency sent for repeater access.", options: RTONE_OPTIONS },
  { key: "voxSwitch", label: "VOX Switch", addr: 0x901e, kind: "number", description: "Enable or disable hands-free voice transmit.", options: OFF_ON },
  { key: "voxDelay", label: "VOX Delay", addr: 0x9020, kind: "number", description: "Delay before VOX transmit returns to receive.", options: VOX_DELAY_OPTIONS },
  { key: "fmEnable", label: "FM Radio", addr: 0x9019, kind: "number", description: "Enable or hide broadcast FM radio mode.", options: OFF_ON },
  { key: "workMode", label: "A/B Work Mode", addr: 0x901a, kind: "workModePair", description: "Packed A/B mode byte. Each side can start in frequency mode or channel mode." },
  { key: "keyLock", label: "Key Lock", addr: 0x901b, kind: "number", description: "Current keypad lock state.", options: [[0, "Unlocked"], [1, "Locked"]] },
  { key: "powerOnDisplay", label: "Power-On Display", addr: 0x901c, kind: "number", description: "What appears when the radio starts.", options: [[0, "Logo"], [1, "Battery voltage"]] },
  { key: "resetMenu", label: "Reset Menu", addr: 0x9022, kind: "number", description: "Whether reset menu behavior is enabled in the radio UI.", options: OFF_ON },
  { key: "menuQuit", label: "Menu Exit Time", addr: 0x9021, kind: "number", description: "How long menus stay open while idle.", options: MENU_TIMEOUT_OPTIONS },
  { key: "qtSave", label: "QT Save", addr: 0x902b, kind: "number", description: "Which side of a scanned CTCSS/DCS tone pair is saved.", options: [[0, "RX + TX"], [1, "RX only"], [2, "TX only"]] },
  { key: "vfoScanStart", label: "VFO Scan Start", addr: 0x902c, length: 2, kind: "word16", description: "Lower edge of the VFO scan range stored by Ola. Values look like whole MHz.", options: [[136, "136 MHz"], [174, "174 MHz"], [220, "220 MHz"], [260, "260 MHz"], [400, "400 MHz"], [470, "470 MHz"], [520, "520 MHz"]] },
  { key: "vfoScanEnd", label: "VFO Scan End", addr: 0x902e, length: 2, kind: "word16", description: "Upper edge of the VFO scan range stored by Ola. Values look like whole MHz.", options: [[136, "136 MHz"], [174, "174 MHz"], [220, "220 MHz"], [260, "260 MHz"], [400, "400 MHz"], [470, "470 MHz"], [520, "520 MHz"]] },
  { key: "sideKeyShort", label: "Side Key Short Press", addr: 0x9032, kind: "number", description: "Function assigned to the short side-key press.", options: [[3, "Alarm"], [7, "FM Radio"], [8, "Flashlight"], [28, "Scan"], [29, "Frequency Search"], [45, "VOX"]] },
  { key: "unknown9039", label: "Ola Flag 9039", addr: 0x9039, kind: "number", description: "Ola stores this as an on/off-style flag in the basic settings area; exact radio UI name is still unconfirmed.", options: OFF_ON }
];

export const COMMON_TRANSPORTS = [
  { name: "Default BLE connection", service: "0000ffe0-0000-1000-8000-00805f9b34fb", write: ["0000ffe1-0000-1000-8000-00805f9b34fb"], notify: ["0000ffe1-0000-1000-8000-00805f9b34fb"] },
  { name: "FFF0 UART", service: "0000fff0-0000-1000-8000-00805f9b34fb", write: ["0000fff1-0000-1000-8000-00805f9b34fb", "0000fff2-0000-1000-8000-00805f9b34fb"], notify: ["0000fff1-0000-1000-8000-00805f9b34fb", "0000fff4-0000-1000-8000-00805f9b34fb"] },
  { name: "Nordic UART", service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", write: ["6e400002-b5a3-f393-e0a9-e50e24dcca9e"], notify: ["6e400003-b5a3-f393-e0a9-e50e24dcca9e"] },
  { name: "JieLi OTA", service: "0000ae00-0000-1000-8000-00805f9b34fb", write: ["0000ae01-0000-1000-8000-00805f9b34fb"], notify: ["0000ae02-0000-1000-8000-00805f9b34fb"] }
];

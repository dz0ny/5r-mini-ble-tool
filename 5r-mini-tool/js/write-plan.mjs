import { hexAddr } from "./format.mjs?v=ani-sync";
import { buildDefaultBlocks } from "./memory.mjs?v=ani-sync";
import { PROTOCOL } from "./protocol.mjs?v=multimodel";

const DEFAULT_BLOCKS = buildDefaultBlocks();

export function getWriteAddresses(scope, blocks, baselineBlocks) {
  const ranges = scope === "first" ? [[0x0000, 0x0000]]
    : scope === "settings" ? PROTOCOL.writeRanges.slice(1)
      : scope === "channels" ? [PROTOCOL.writeRanges[0]]
        : PROTOCOL.writeRanges;
  const addresses = ranges.flatMap(([begin, end]) => {
    const out = [];
    for (let addr = begin; addr <= end; addr += PROTOCOL.blockSize) out.push(addr);
    return out;
  });
  if (scope !== "changed") return addresses;
  return addresses.filter((addr) => {
    const key = hexAddr(addr);
    return !blocksEqual(blocks[key] || DEFAULT_BLOCKS[key], baselineBlocks?.[key]);
  });
}

export function getWriteGroups(addresses, writeProfile) {
  if (!writeProfile.pairFrame) return addresses.map((addr) => ({ addr, addresses: [addr], requested: 1 }));
  const requested = new Set(addresses);
  const starts = new Set(addresses.map((addr) => Math.floor(addr / (PROTOCOL.blockSize * 2)) * PROTOCOL.blockSize * 2));
  return Array.from(starts).sort((a, b) => a - b).map((addr) => {
    const groupAddresses = [addr, addr + PROTOCOL.blockSize];
    return {
      addr,
      addresses: groupAddresses,
      requested: groupAddresses.filter((groupAddr) => requested.has(groupAddr)).length
    };
  });
}

function blocksEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

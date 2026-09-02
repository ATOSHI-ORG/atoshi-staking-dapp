/**
 * Atoshi 链的 viem chain 定义 + bech32/hex 地址换算。
 *
 * Atoshi 是 Ethermint 系的链，一个账户同时有两种地址表示：
 *   0x71cb87…（EVM，20 字节）  ←→  atoshi1x7tsuwv…（bech32，同样那 20 字节）
 * 私钥是同一个（eth_secp256k1），所以两种地址可以纯前端互转，不需要问链。
 *
 * 为什么必须换：钱包给的是 0x 地址，预编译调用也要 0x 地址；但 Cosmos REST
 * 的查询路径要的是 atoshi1 地址。少了这层换算，读和写就对不上同一个账户。
 */

import { bech32 } from 'bech32';
import { defineChain } from 'viem';

/** 链上 bech32 前缀。验证人地址是 atoshivaloper1…（多 8 个字符，所以是 52 位而不是 51 位） */
export const BECH32_PREFIX = 'atoshi';

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 88288);

const EVM_RPC = ((import.meta.env.VITE_EVM_RPC_URL as string) || 'https://rpc-testnet.atoshi.org').replace(
  /\/+$/,
  '',
);

export const atoshi = defineChain({
  id: CHAIN_ID,
  name: 'Atoshi',
  // EVM 侧的展示单位。链上最小单位叫 liao（1 ATOS = 10^18 liao），
  // 名字取自项目方指定，不要改。
  nativeCurrency: { name: 'ATOS', symbol: 'ATOS', decimals: 18 },
  rpcUrls: {
    default: { http: [EVM_RPC] },
  },
  blockExplorers: {
    default: {
      name: 'Atoshi Explorer',
      url: (import.meta.env.VITE_EXPLORER_URL as string) || 'https://explorer-testnet.atoshi.org',
    },
  },
  testnet: CHAIN_ID !== 88888,
});

/** 0x 地址 → bech32（atoshi1…）。给 Cosmos REST 查询用。 */
export function hexToBech32(hex: string, prefix = BECH32_PREFIX): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{40}$/.test(clean)) {
    throw new Error(`不是合法的 EVM 地址: ${hex}`);
  }
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bech32.encode(prefix, bech32.toWords(bytes));
}

/** bech32（atoshi1…）→ 0x 地址。给预编译调用用。 */
export function bech32ToHex(addr: string): `0x${string}` {
  const { words } = bech32.decode(addr);
  const bytes = bech32.fromWords(words);
  if (bytes.length !== 20) {
    throw new Error(`地址解出来是 ${bytes.length} 字节，期望 20 字节: ${addr}`);
  }
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`;
}

/** 两种格式都接受，统一成 bech32。UI 里用户可能粘任意一种。 */
export function toBech32(addr: string): string {
  return addr.startsWith('0x') ? hexToBech32(addr) : addr;
}

/** 两种格式都接受，统一成 0x。 */
export function toHex(addr: string): `0x${string}` {
  return addr.startsWith('0x') ? (addr as `0x${string}`) : bech32ToHex(addr);
}

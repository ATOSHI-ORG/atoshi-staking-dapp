/**
 * Cosmos REST (LCD) 客户端
 *
 * 只做三件事：拼 URL、发请求、把错误变成能看懂的话。字段映射在
 * stakingApiChain.ts 里做。
 *
 * ⚠️ 这里要的是 Cosmos REST API（节点 app.toml 的 [api]，默认 1317），
 * 不是 EVM JSON-RPC（8545），也不是 CometBFT RPC（26657）。
 * 质押、委托、奖励、解质押这些数据都在 Cosmos 模块里，EVM JSON-RPC
 * 一个都查不到 —— 没有任何 eth_* 方法能读 cosmos/staking/v1beta1/validators。
 */

/** 链上最小单位与展示单位的换算基数：1 ATOS = 10^18 liao，1 ATOX = 10^18 aatox */
export const DECIMALS_18 = 1000000000000000000n;

export const BOND_DENOM = (import.meta.env.VITE_BOND_DENOM as string) || 'liao';
export const ATOX_DENOM = (import.meta.env.VITE_ATOX_DENOM as string) || 'aatox';

/** Cosmos REST 的根地址，不含尾斜杠 */
export const REST_BASE = ((import.meta.env.VITE_REST_URL as string) || '').replace(/\/+$/, '');

export class ChainRestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly path?: string,
  ) {
    super(message);
    this.name = 'ChainRestError';
  }
}

/**
 * GET 一个 REST 路径。
 *
 * 超时用 AbortController 而不是靠 fetch 自己——浏览器默认没有超时，
 * 节点无响应时页面会一直转圈而不是给出错误。
 */
export async function restGet<T>(path: string, timeoutMs = 12000): Promise<T> {
  if (!REST_BASE) {
    throw new ChainRestError(
      '未配置 VITE_REST_URL。质押数据需要节点的 Cosmos REST 端点（app.toml 里的 [api]，默认 1317）。',
      undefined,
      path,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${REST_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      // REST 网关把链上的错误放在 body 里，比 HTTP 状态码有用得多
      let detail = '';
      try {
        const body = await res.json();
        detail = body?.message || body?.error || '';
      } catch {
        /* body 不是 JSON，用状态码就行 */
      }
      throw new ChainRestError(
        detail || `请求失败 (HTTP ${res.status})`,
        res.status,
        path,
      );
    }

    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ChainRestError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ChainRestError(`请求超时 (${timeoutMs}ms)`, undefined, path);
    }
    // 跨域被拦、DNS 失败、节点没起来，在 fetch 里都是同一个 TypeError，
    // 分不出来，所以把三种可能都列给使用者。
    throw new ChainRestError(
      `连不上节点。检查 VITE_REST_URL 是否可达、节点 [api] 是否开启、是否允许跨域。`,
      undefined,
      path,
    );
  }
}

/** 分页拉完一个 REST 列表接口。Cosmos 默认每页 100 条，验证人可能超过。 */
export async function restGetAllPages<T>(
  path: string,
  pick: (page: any) => T[],
  limit = 200,
): Promise<T[]> {
  const out: T[] = [];
  let key: string | null = null;
  // 上限 20 页：够 4000 条，同时避免节点返回坏 next_key 时无限循环
  for (let i = 0; i < 20; i++) {
    const sep = path.includes('?') ? '&' : '?';
    const paged =
      `${path}${sep}pagination.limit=${limit}` +
      (key ? `&pagination.key=${encodeURIComponent(key)}` : '');
    const page = await restGet<any>(paged);
    out.push(...pick(page));
    key = page?.pagination?.next_key || null;
    if (!key) break;
  }
  return out;
}

/** 取一个 coins 数组里指定 denom 的数量，缺失时返回 "0"。 */
export function amountOf(
  coins: Array<{ denom: string; amount: string }> | undefined | null,
  denom: string,
): string {
  if (!coins) return '0';
  return coins.find((c) => c.denom === denom)?.amount ?? '0';
}

/**
 * DecCoin 的 amount 转成最小单位的整数字符串。
 *
 * distribution 模块返回的是 DecCoin，它的 amount 是 LegacyDec。**REST 网关把它
 * 渲染成带小数点的十进制字符串**，小数点前面那段就已经是最小单位（aatox）了：
 *
 *   "8735786555267686800000000.000000000000000000"
 *    └────── 这段就是 aatox ──────┘ └── 只是 Dec 的小数部分 ──┘
 *
 * 所以只要截掉小数部分，**不能再除 10^18**。
 *
 * 我第一版除了 10^18，理由是「LegacyDec 内部是放大 10^18 的定点数」—— 那句话
 * 对内部表示成立，但对网关吐出来的这个字符串不成立，它已经把倍数还原过了。
 * 结果是奖励被缩小 10^18 倍，8,735,786 ATOX 显示成 0.0000，而且不报错。
 * 判断依据很简单：字符串里有小数点，说明是人类可读的十进制，不是放大后的整数。
 */
export function decCoinToInt(amount: string | undefined): string {
  if (!amount) return '0';
  const [whole] = amount.split('.');
  try {
    // 走一遍 BigInt 是为了校验它确实是整数，顺手去掉前导零和空串
    return BigInt(whole || '0').toString();
  } catch {
    return '0';
  }
}

/** LegacyDec 字符串（"0.050000000000000000"）转成 UI 用的 4 位小数字符串 */
export function decToFixed4(dec: string | undefined): string {
  if (!dec) return '0.0000';
  const n = Number(dec);
  return Number.isFinite(n) ? n.toFixed(4) : '0.0000';
}

/** "1814400s" → 1814400 */
export function durationToSeconds(d: string | undefined): number {
  if (!d) return 0;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(d.trim());
  return m ? Math.round(Number(m[1])) : 0;
}

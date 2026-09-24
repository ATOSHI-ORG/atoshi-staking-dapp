import { ChainRestError, restGet } from './chainRest';

export interface CosmosTxResponse {
  tx_response?: {
    code?: number | string;
    txhash?: string;
    raw_log?: string;
    height?: string;
  };
}

const POLL_INTERVAL_MS = Number(import.meta.env.VITE_COSMOS_TX_POLL_MS ?? 1500);
const TIMEOUT_MS = Number(import.meta.env.VITE_COSMOS_TX_TIMEOUT_MS ?? 90000);

export function isCosmosTxHash(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

export function isEvmTxHash(value: string): value is `0x${string}` {
  return /^0x[0-9a-f]{64}$/i.test(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Wait for inclusion and final Cosmos execution status. */
export async function waitForCosmosTx(hash: string): Promise<CosmosTxResponse> {
  if (!isCosmosTxHash(hash)) {
    throw new ChainRestError(`不是合法的 Cosmos 交易哈希: ${hash}`);
  }

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await restGet<CosmosTxResponse>(
        `/cosmos/tx/v1beta1/txs/${encodeURIComponent(hash)}`,
      );
      const tx = response.tx_response;
      if (!tx) throw new ChainRestError(`Cosmos 节点返回了无效交易结果，tx: ${hash}`);

      const code = Number(tx.code ?? 0);
      if (code !== 0) {
        const detail = tx.raw_log ? `: ${tx.raw_log}` : '';
        throw new ChainRestError(`Cosmos 交易执行失败（code ${code}）${detail}，tx: ${hash}`);
      }
      return response;
    } catch (error) {
      if (!(error instanceof ChainRestError) || error.status !== 404) throw error;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new ChainRestError(`Cosmos 交易确认超时，请稍后按哈希查询: ${hash}`);
}

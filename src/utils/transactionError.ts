import type { TranslationKey } from '../i18n/translations';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  shortMessage?: unknown;
  details?: unknown;
  reason?: unknown;
  cause?: unknown;
  error?: unknown;
  data?: unknown;
}

function errorChain(error: unknown): ErrorLike[] {
  const chain: ErrorLike[] = [];
  const seen = new Set<unknown>();
  const pending: unknown[] = [error];

  while (pending.length > 0 && chain.length < 12) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    const item = current as ErrorLike;
    chain.push(item);
    pending.push(item.cause, item.error, item.data);
  }

  return chain;
}

function textValues(chain: ErrorLike[]): string[] {
  const values: string[] = [];
  for (const item of chain) {
    for (const value of [item.shortMessage, item.details, item.reason, item.message, item.name]) {
      if (typeof value === 'string' && value.trim()) values.push(value.trim());
    }
  }
  return values;
}

/** Turn verbose viem/wallet errors into a short message suitable for transaction modals. */
export function transactionErrorMessage(
  error: unknown,
  t: Translate,
  fallback: string = t('errTransactionFailed'),
): string {
  const chain = errorChain(error);
  const values = textValues(chain);
  const combined = values.join('\n').toLowerCase();

  const rejectedByCode = chain.some(({ code }) => code === 4001 || code === '4001' || code === 'ACTION_REJECTED');
  const rejectedByName = chain.some(({ name }) => name === 'UserRejectedRequestError');
  const rejectedByText = /user (?:rejected|denied|cancelled|canceled)|rejected by (?:the )?user|用户(?:拒绝|取消)/i.test(combined);
  if (rejectedByCode || rejectedByName || rejectedByText) return t('errUserRejected');

  if (/insufficient funds|insufficient balance|exceeds (?:the )?balance/.test(combined)) {
    return t('errInsufficientFunds');
  }
  if (/out of gas|intrinsic gas too low|gas required exceeds allowance/.test(combined)) {
    return t('errOutOfGas');
  }
  if (/redelegat/.test(combined) && /cooldown|in progress|already|matur|receiving redelegation|cannot redelegate/.test(combined)) {
    return t('errRedelegateCooldown');
  }
  if (/validator/.test(combined) && /jailed|inactive/.test(combined)) {
    return t('errValidatorJailed');
  }
  if (/failed to fetch|network error|network request failed|disconnected|connection refused|timed? out/.test(combined)) {
    return t('errNetworkUnavailable');
  }

  // viem appends the contract call, args, docs and version after the useful part.
  // Generic revert headers are not useful either, so use the operation-specific fallback.
  if (/contractfunctionexecutionerror|execution reverted|transaction failed|contract call:|request arguments:/.test(combined)) {
    return fallback;
  }

  for (const value of values) {
    const concise = value
      .split(/\n(?:Contract Call|Request Arguments|Raw Call Arguments|Docs|Version|Details):/i, 1)[0]
      .replace(/\s+/g, ' ')
      .trim();
    if (concise && concise.length <= 180) return concise;
  }

  return fallback;
}

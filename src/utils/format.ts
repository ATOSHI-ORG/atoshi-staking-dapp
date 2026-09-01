/**
 * High-precision BigInt / Decimal conversion and formatting utilities for Atoshi Chain.
 * 1 ATOS = 10^18 liao
 * 1 ATOX = 10^18 aatox
 */

const DECIMALS = 18n;
const ONE_COIN = 10n ** DECIMALS;

/**
 * Format raw integer string (in liao or aatox) into human-readable coin string with 4 decimals and thousand separators.
 */
export function formatCoinAmount(rawAmountStr: string | bigint | number | undefined, precision = 4): string {
  if (rawAmountStr === undefined || rawAmountStr === null || rawAmountStr === '') {
    return '0.0000';
  }

  try {
    let rawBigInt: bigint;
    if (typeof rawAmountStr === 'bigint') {
      rawBigInt = rawAmountStr;
    } else if (typeof rawAmountStr === 'number') {
      rawBigInt = BigInt(Math.floor(rawAmountStr));
    } else {
      // Remove any trailing decimal part if accidentally present
      const cleanStr = rawAmountStr.split('.')[0] || '0';
      rawBigInt = BigInt(cleanStr);
    }

    const isNegative = rawBigInt < 0n;
    if (isNegative) rawBigInt = -rawBigInt;

    const integerPart = rawBigInt / ONE_COIN;
    const fractionPart = rawBigInt % ONE_COIN;

    // Pad fraction to 18 digits
    const fractionStr = fractionPart.toString().padStart(18, '0');
    const truncatedFraction = fractionStr.slice(0, precision);

    // Format integer part with commas
    const integerFormatted = integerPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return `${isNegative ? '-' : ''}${integerFormatted}.${truncatedFraction}`;
  } catch {
    return '0.0000';
  }
}

/**
 * Convert human input string (e.g. "123.4567") to raw liao/aatox BigInt string (10^18).
 */
export function parseHumanAmountToRaw(humanStr: string): string {
  if (!humanStr || humanStr.trim() === '') return '0';
  const clean = humanStr.replace(/,/g, '').trim();
  if (!/^\d*(\.\d*)?$/.test(clean)) return '0';

  const parts = clean.split('.');
  const intPart = parts[0] ? BigInt(parts[0]) : 0n;
  let raw = intPart * ONE_COIN;

  if (parts.length > 1 && parts[1]) {
    const fractionStr = parts[1].slice(0, 18).padEnd(18, '0');
    raw += BigInt(fractionStr);
  }

  return raw.toString();
}

/**
 * Convert raw liao string to a pure number for calculations like percentage or graph scaling.
 */
export function rawToNumber(rawStr: string | bigint): number {
  try {
    const raw = typeof rawStr === 'bigint' ? rawStr : BigInt(rawStr || '0');
    const intPart = Number(raw / ONE_COIN);
    const fracPart = Number(raw % ONE_COIN) / 1e18;
    return intPart + fracPart;
  } catch {
    return 0;
  }
}

export type Language = 'en' | 'zh';

/**
 * Format large token amounts with language-appropriate units (K/M/B/T vs 万/亿/万亿)
 */
export function formatLargeAmount(rawAmountStr: string | bigint, unit = 'ATOS', lang: Language = 'en'): string {
  const num = rawToNumber(rawAmountStr);
  if (lang === 'zh') {
    if (num >= 1000000000000) {
      return `${(num / 1000000000000).toFixed(2)} 万亿 ${unit}`;
    }
    if (num >= 100000000) {
      return `${(num / 100000000).toFixed(2)} 亿 ${unit}`;
    }
    if (num >= 10000) {
      return `${(num / 10000).toFixed(2)} 万 ${unit}`;
    }
    return `${num.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`;
  }

  // English formatting (T, B, M, K)
  if (num >= 1_000_000_000_000) {
    return `${(num / 1_000_000_000_000).toFixed(2)}T ${unit}`;
  }
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B ${unit}`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M ${unit}`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K ${unit}`;
  }
  return `${num.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`;
}

/**
 * Legacy compatibility alias
 */
export function formatLargeAmountCN(rawAmountStr: string | bigint, unit = 'ATOS'): string {
  return formatLargeAmount(rawAmountStr, unit, 'zh');
}

/**
 * Shorten wallet or validator address for mobile display
 */
export function shortenAddress(address: string, prefixLen = 8, suffixLen = 6): string {
  if (!address) return '';
  if (address.length <= prefixLen + suffixLen) return address;
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

/**
 * Format countdown from target timestamp in ms to "Xd Xh Xm" or Chinese "20天 23小时 45分"
 */
export function formatCountdown(targetMs: number, lang: Language = 'en'): { text: string; isFinished: boolean; totalSeconds: number } {
  const now = Date.now();
  const diffMs = targetMs - now;

  if (diffMs <= 0) {
    return { 
      text: lang === 'zh' ? '可立即提现' : 'Available in balance', 
      isFinished: true, 
      totalSeconds: 0 
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let text = '';
  if (lang === 'zh') {
    if (days > 0) {
      text = `${days}天 ${hours}小时 ${minutes}分`;
    } else if (hours > 0) {
      text = `${hours}小时 ${minutes}分 ${seconds}秒`;
    } else {
      text = `${minutes}分 ${seconds}秒`;
    }
  } else {
    if (days > 0) {
      text = `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      text = `${hours}h ${minutes}m ${seconds}s`;
    } else {
      text = `${minutes}m ${seconds}s`;
    }
  }

  return { text, isFinished: false, totalSeconds };
}

/**
 * Format commission percent string e.g. "0.0500" -> "5.00%"
 */
export function formatCommission(rateStr: string | number): string {
  const num = typeof rateStr === 'string' ? parseFloat(rateStr) : rateStr;
  if (isNaN(num)) return '5.00%';
  return `${(num * 100).toFixed(2)}%`;
}

/**
 * Format date time string
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

import type { Currency } from '../types';

export const APP_LOCALE = 'id-ID';
export const DEFAULT_CURRENCY: Currency = 'IDR';

function normalizeCurrencySpacing(value: string): string {
  return value.replace(/\s+/g, '').replace(/([^\d-])(?=\d)/, '$1');
}

export function normalizeCurrency(currency?: string | null): Currency {
  return currency === 'USD' ? 'USD' : 'IDR';
}

export function formatCurrency(amount: number, currency: Currency = DEFAULT_CURRENCY): string {
  const normalized = normalizeCurrency(currency);
  const fractionDigits = normalized === 'IDR' ? 0 : 2;
  const value = new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency: normalized,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);

  return normalizeCurrencySpacing(value);
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

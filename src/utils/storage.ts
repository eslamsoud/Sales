/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Customer, Invoice, Expense, FactoryLoad, AppSettings } from '../types';

// توقيت مصر (Africa/Cairo) — UTC+2 عادي، UTC+3during DST
const EGYPT_TZ = 'Africa/Cairo';

/** يُرجع التاريخ والوقت بتوقيت مصر بصيغة ISO محلية بدون حرف Z */
export function nowEgyptISO(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EGYPT_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
}

/** يُرجع التاريخ فقط بتوقيت مصر بصيغة YYYY-MM-DD */
export function todayEgyptISO(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EGYPT_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

/** يُرجع التاريخ والوقت بتوقيت مصر كنص عربي */
export function nowEgyptLocale(): string {
  return new Date().toLocaleString('ar-EG', { timeZone: EGYPT_TZ });
}

/** يُرجع التاريخ فقط بتوقيت مصر كنص عربي */
export function todayEgyptLocale(): string {
  return new Date().toLocaleDateString('ar-EG', { timeZone: EGYPT_TZ });
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultDiscounts: [1, 1.25, 1.5],
  googleSheetsUrl: '',
  currency: 'ج.م',
  aiPitchGuidelines: '',
  workAreas: []
};

export const DEFAULT_PRODUCTS: Product[] = [];

export const DEFAULT_CUSTOMERS: Customer[] = [];

export const DEFAULT_FACTORY_LOADS: FactoryLoad[] = [];

export const DEFAULT_INVOICES: Invoice[] = [];

export const DEFAULT_EXPENSES: Expense[] = [];

export function getStoredData<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading key ${key} from storage:`, e);
    return defaultValue;
  }
}

export function setStoredData<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving key ${key} to storage:`, e);
  }
}

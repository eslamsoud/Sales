/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Customer, Invoice, Expense, FactoryLoad, AppSettings } from '../types';

// توقيت مصر (Africa/Cairo) — UTC+2 عادي، UTC+3during DST
const EGYPT_TZ = 'Africa/Cairo';

/** يُرجع التاريخ والوقت بتوقيت مصر بصيغة ISO */
export function nowEgyptISO(): string {
  const now = new Date();
  const parts = now.toLocaleString('sv-SE', { timeZone: EGYPT_TZ }).split(' ');
  const datePart = parts[0]; // YYYY-MM-DD
  const timePart = parts[1]; // HH:MM:SS
  return `${datePart}T${timePart}.000Z`;
}

/** يُرجع التاريخ فقط بتوقيت مصر بصيغة YYYY-MM-DD */
export function todayEgyptISO(): string {
  return nowEgyptISO().substring(0, 10);
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

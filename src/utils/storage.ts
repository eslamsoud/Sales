/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Customer, Invoice, Expense, FactoryLoad, AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  defaultDiscounts: [1, 1.25, 1.5],
  googleSheetsUrl: 'https://script.google.com/macros/s/AKfycbwD31gqJycRFZO5EKs9aGx2-IeLLr_MGqKLvXZu_Yqo-AGmJ5_SCqrUwaPkIinOkrxH/exec',
  currency: 'ج.م',
  aiPitchGuidelines: ''
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

// @ts-nocheck
import { confirmDialog, duaConfirmDialog } from '../utils/confirm';
import { jsPDF } from 'jspdf';
import { COMPACT_PRO_CSS } from '../utils/reportStyles';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Product, FactoryLoad, CarBalance, ProductWeight, getProductWeightsFallback, Invoice, Trip, formatNum, Expense, UserAuth, getItemFactoryCost } from '../types';
import { Truck, Plus, PackagePlus, Package, ArrowRight, History, Trash2, AlertCircle, Edit, Save, HelpCircle, FileText, Image, Scale, CirclePercent, DollarSign, Box, Clock, CheckCircle2, ShieldMinus, Wallet, Printer, Calendar, MapPin, Download, ScanLine, Archive, Landmark, RefreshCw } from 'lucide-react';
import { showToast } from '../utils/toast';

interface FactoryTabProps {
  products: Product[];
  factoryLoads: FactoryLoad[];
  invoices: Invoice[];
  trips: Trip[];
  expenses: Expense[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onDeleteAllProducts?: () => void;
  onAddLoad: (load: Omit<FactoryLoad, 'id'>) => void;
  onDeleteLoad: (id: string) => void;
  onAddTrip: (trip: Omit<Trip, 'id'>) => void;
  onEditTrip: (id: string, updates: Partial<Omit<Trip, 'id'>>) => void;
  onToggleTripCollected: (id: string) => void;
  onDeleteTrip: (id: string) => void;
  onClearAllData?: () => void;
  onGoBack: () => void;
  permittedSubTabs?: string[];
  canEditPrices?: boolean;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onEditExpense?: (id: string, updates: Partial<Omit<Expense, 'id'>>) => void;
  currentUser?: UserAuth | null;
  onArchiveFactoryCycle?: (delegatePhone: string, delegateName: string) => void;
}

export default function FactoryTab({
  products,
  factoryLoads,
  invoices,
  trips,
  expenses,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onDeleteAllProducts,
  onAddLoad,
  onDeleteLoad,
  onAddTrip,
  onEditTrip,
  onToggleTripCollected,
  onDeleteTrip,
  onClearAllData,
  onGoBack,
  permittedSubTabs,
  canEditPrices = true,
  onAddExpense,
  onDeleteExpense,
  onEditExpense,
  currentUser,
  onArchiveFactoryCycle
}: FactoryTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'loads' | 'products' | 'previous_loads' | 'factory_account' | 'trips'>(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('loads')) return 'loads';
      if (permittedSubTabs.includes('products')) return 'products';
      if (permittedSubTabs.includes('factory_account')) return 'factory_account';
      if (permittedSubTabs.includes('trips')) return 'trips';
      if (permittedSubTabs.includes('previous_loads')) return 'previous_loads';
    }
    return 'loads';
  });
  const [reportTimeframe, setReportTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0 && !permittedSubTabs.includes(activeSubTab)) {
      if (permittedSubTabs.includes('loads')) setActiveSubTab('loads');
      else if (permittedSubTabs.includes('products')) setActiveSubTab('products');
      else if (permittedSubTabs.includes('factory_account')) setActiveSubTab('factory_account');
      else if (permittedSubTabs.includes('trips')) setActiveSubTab('trips');
      else if (permittedSubTabs.includes('previous_loads')) setActiveSubTab('previous_loads');
    }
  }, [permittedSubTabs, activeSubTab]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeSubTab]);

  // Helper: High-DPI canvas setup for crisp image downloads
  const setupHiDPICanvas = (W: number, H: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; dpr: number } => {
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    return { canvas, ctx, dpr };
  };

  // Filtering states for the previous loads archive tab
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('all');
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');
  const [archiveSection, setArchiveSection] = useState<'factory' | 'trips'>('factory');

  const [archiveDelegateFilter, setArchiveDelegateFilter] = useState<string>('all');
  const [openArchiveDay, setOpenArchiveDay] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveDayFilters, setArchiveDayFilters] = useState<string[]>([]);
  const [paymentTargetDelegate, setPaymentTargetDelegate] = useState<string>('');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState<string>('');
  const [editingPaymentNotes, setEditingPaymentNotes] = useState<string>('');
  const [editingPaymentRecipient, setEditingPaymentRecipient] = useState<string>('');
  const [editingPaymentDelegate, setEditingPaymentDelegate] = useState<string>('');

  // States for live load filtering
  const [liveLoadFilter, setLiveLoadFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [liveLoadStartDate, setLiveLoadStartDate] = useState('');
  const [liveLoadEndDate, setLiveLoadEndDate] = useState('');
  const [liveLoadDelegateFilter, setLiveLoadDelegateFilter] = useState<string>('all');
  const [liveLoadDayFilters, setLiveLoadDayFilters] = useState<string[]>([]);

  // Filter for current cycle payments
  const [currentPaymentsFilter, setCurrentPaymentsFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('all');
  const [currentPaymentsDayFilters, setCurrentPaymentsDayFilters] = useState<string[]>([]);
  const [currentPaymentsStartDate, setCurrentPaymentsStartDate] = useState('');
  const [currentPaymentsEndDate, setCurrentPaymentsEndDate] = useState('');

  const archiveDelegates = React.useMemo(() => {
    const delegatesMap = new Map<string, { phone: string, name: string }>();
    
    const addDelegate = (phone: string, name: string) => {
      const cleanPhone = phone ? phone.trim() : '';
      const cleanName = name ? name.replace(/\s*\(.*?\)/g, '').trim() : 'مجهول';
      if (!cleanPhone && cleanName === 'مجهول') return;
      const key = cleanPhone || cleanName;
      if (!delegatesMap.has(key)) {
        delegatesMap.set(key, { phone: cleanPhone || 'مجهول', name: cleanName });
      }
    };

    factoryLoads.forEach(l => { 
      addDelegate(l.delegatePhone || '', l.delegateName || '');
    });
    trips.forEach(t => { 
      addDelegate(t.delegatePhone || '', t.delegateName || '');
    });
    return Array.from(delegatesMap.values());
  }, [factoryLoads, trips]);

  const filteredLiveLoads = React.useMemo(() => {
    return factoryLoads.filter(load => {
      if (liveLoadDelegateFilter !== 'all') {
        const lPhone = (load.delegatePhone || '').trim();
        const lName = (load.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
        const selectedDel = archiveDelegates.find(d => d.phone === liveLoadDelegateFilter || d.name === liveLoadDelegateFilter);
        if (selectedDel) {
          const matchPhone = selectedDel.phone !== 'مجهول' && lPhone === selectedDel.phone;
          const matchName = lName === selectedDel.name;
          if (!matchPhone && !matchName) return false;
        } else {
          return false;
        }
      }

      const loadDateObj = new Date(load.date);
      if (isNaN(loadDateObj.getTime())) return false;

      const now = new Date();
      if (liveLoadFilter === 'daily') return loadDateObj.getDate() === now.getDate() && loadDateObj.getMonth() === now.getMonth() && loadDateObj.getFullYear() === now.getFullYear();
      if (liveLoadFilter === 'weekly') {
        if (Math.abs(new Date().getTime() - loadDateObj.getTime()) / (1000 * 60 * 60 * 24) > 7) return false;
        if (liveLoadDayFilters.length > 0) return liveLoadDayFilters.includes(new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(loadDateObj));
        return true;
      }
      if (liveLoadFilter === 'monthly') return loadDateObj.getMonth() === new Date().getMonth() && loadDateObj.getFullYear() === new Date().getFullYear();
      if (liveLoadFilter === 'custom') return (!liveLoadStartDate || load.date >= liveLoadStartDate) && (!liveLoadEndDate || load.date <= liveLoadEndDate + 'T23:59:59');
      return true;
    });
  }, [factoryLoads, liveLoadFilter, liveLoadStartDate, liveLoadEndDate, liveLoadDelegateFilter, liveLoadDayFilters]);

  // States for Trips
  const [tripDescription, setTripDescription] = useState('');
  const [tripPrice, setTripPrice] = useState('');
  const [tripDate, setTripDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [tripFilter, setTripFilter] = useState<'all' | 'collected' | 'pending'>('all');
  const [tripDelegatePhone, setTripDelegatePhone] = useState('');

  const isManager = currentUser?.role === 'owner' || currentUser?.phone === '01228466613';

  // Delegate filtering state for factory account
  const [factoryDelegateFilter, setFactoryDelegateFilter] = useState<string>('all');

  const selectedDelegatePhone = useMemo(() => {
    if (!isManager) return currentUser?.phone || '';
    return factoryDelegateFilter === 'all' ? '' : factoryDelegateFilter;
  }, [isManager, currentUser, factoryDelegateFilter]);

  const currentDelegateKey = useMemo(() => {
    return selectedDelegatePhone || 'default';
  }, [selectedDelegatePhone]);

  React.useEffect(() => {
    if (factoryDelegateFilter !== 'all') {
      setPaymentTargetDelegate(factoryDelegateFilter);
    } else {
      setPaymentTargetDelegate('');
    }
  }, [factoryDelegateFilter]);

  // Helper to check if a record belongs to the selected delegate
  const filterByFactoryDelegate = (item: any) => {
    if (!isManager) return true; // Already filtered at app level
    if (factoryDelegateFilter === 'all') return true;
    
    const itemPhone = (item.delegatePhone || '').trim();
    const itemName = (item.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
    const selectedDel = archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter);
    if (!selectedDel) return false;
    
    const matchPhone = selectedDel.phone !== 'مجهول' && itemPhone === selectedDel.phone;
    const matchName = itemName === selectedDel.name;
    return matchPhone || matchName;
  };

  // Persistent carried over debt for the factory, keyed per delegate
  const [carriedOverDebt, setCarriedOverDebt] = useState<number>(0);
  const [carriedOverDebtDate, setCarriedOverDebtDate] = useState<string>('');

  useEffect(() => {
    const key = `factory_carried_debt_sys_${currentDelegateKey}`;
    const dateKey = `factory_carried_debt_date_sys_${currentDelegateKey}`;
    let val = parseFloat(localStorage.getItem(key) || 'NaN');
    if (isNaN(val)) {
      val = parseFloat(localStorage.getItem('factory_carried_debt_sys') || '0');
    }
    let dateVal = localStorage.getItem(dateKey);
    if (dateVal === null) {
      dateVal = localStorage.getItem('factory_carried_debt_date_sys') || '';
    }
    setCarriedOverDebt(val);
    setCarriedOverDebtDate(dateVal);
  }, [currentDelegateKey]);

  useEffect(() => {
    if (currentDelegateKey) {
      localStorage.setItem(`factory_carried_debt_sys_${currentDelegateKey}`, carriedOverDebt.toString());
    }
  }, [carriedOverDebt, currentDelegateKey]);

  useEffect(() => {
    if (currentDelegateKey) {
      localStorage.setItem(`factory_carried_debt_date_sys_${currentDelegateKey}`, carriedOverDebtDate);
    }
  }, [carriedOverDebtDate, currentDelegateKey]);

  const [archiveCycles, setArchiveCycles] = useState<any[]>([]);
  useEffect(() => {
    if (currentDelegateKey) {
      try {
        const saved = localStorage.getItem(`factory_archive_cycles_${currentDelegateKey}`);
        setArchiveCycles(saved ? JSON.parse(saved) : []);
      } catch (_) {
        setArchiveCycles([]);
      }
    } else {
      setArchiveCycles([]);
    }
  }, [currentDelegateKey]);

  useEffect(() => {
    if (currentDelegateKey) {
      localStorage.setItem(`factory_archive_cycles_${currentDelegateKey}`, JSON.stringify(archiveCycles));
    }
  }, [archiveCycles, currentDelegateKey]);

  const lastArchiveTimestamp = useMemo(() => {
    if (!archiveCycles || archiveCycles.length === 0) return 0;
    const timestamps = archiveCycles
      .map(c => Number(c.id))
      .filter(t => !isNaN(t));
    if (timestamps.length === 0) return 0;
    return Math.max(...timestamps);
  }, [archiveCycles]);

  const [editingCycle, setEditingCycle] = useState<any>(null);
  const [editData, setEditData] = useState<any>(null);

  // Extra manual payments computed directly from synced expenses
  const extraPayments = useMemo(() => {
    return expenses
      .filter(e => e.category === 'سداد للمصنع' || e.type === 'factory_payment')
      .filter(filterByFactoryDelegate)
      .map(e => {
        let notes = e.description;
        let appliedToCarriedDebt = 0;
        let recipient = '';
        if (e.description && e.description.startsWith('{')) {
          try {
            const parsed = JSON.parse(e.description);
            notes = parsed.notes || '';
            appliedToCarriedDebt = parsed.appliedToCarriedDebt || 0;
            recipient = parsed.recipient || '';
          } catch (err) {}
        }
        return {
          id: e.id,
          amount: e.amount,
          date: e.date && e.date.includes('-') && !isNaN(new Date(e.date).getTime())
            ? new Date(e.date).toLocaleDateString('ar-EG') + ' ' + new Date(e.date).toLocaleTimeString('ar-EG')
            : e.date || '',
          rawDate: e.date,
          notes,
          appliedToCarriedDebt,
          recipient,
          delegatePhone: e.delegatePhone,
          delegateName: e.delegateName
        };
      });
  }, [expenses, factoryDelegateFilter, isManager, currentUser, archiveDelegates]);

  const currentCycleExtraPayments = useMemo(() => {
    return extraPayments.filter(p => {
      const timeVal = p.rawDate ? new Date(p.rawDate).getTime() : 0;
      return timeVal > lastArchiveTimestamp;
    });
  }, [extraPayments, lastArchiveTimestamp]);

  const filteredCurrentPayments = useMemo(() => {
    return currentCycleExtraPayments.filter(pay => {
      const payDate = new Date(pay.rawDate || pay.date);
      if (isNaN(payDate.getTime())) return true;
      const now = new Date();
      if (currentPaymentsFilter === 'daily') {
        return payDate.toDateString() === now.toDateString();
      }
      if (currentPaymentsFilter === 'weekly') {
        const diffTime = Math.abs(now.getTime() - payDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
        if (currentPaymentsDayFilters.length > 0) {
          const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(payDate);
          return currentPaymentsDayFilters.includes(englishDay);
        }
        return true;
      }
      if (currentPaymentsFilter === 'monthly') {
        return payDate.getMonth() === now.getMonth() && payDate.getFullYear() === now.getFullYear();
      }
      if (currentPaymentsFilter === 'custom') {
        const dStr = (pay.rawDate || pay.date).split('T')[0];
        if (currentPaymentsStartDate && dStr < currentPaymentsStartDate) return false;
        if (currentPaymentsEndDate && dStr > currentPaymentsEndDate) return false;
        return true;
      }
      return true;
    });
  }, [currentCycleExtraPayments, currentPaymentsFilter, currentPaymentsDayFilters, currentPaymentsStartDate, currentPaymentsEndDate]);

  // حساب الأرصدة الحالية في السيارة لكل صنف ووزن لعرضها في شاشة التحميل
  const weightStocks = useMemo(() => {
    const stocks: Record<string, { loaded: number; sold: number; remaining: number }> = {};
    
    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        const key = `${p.id}_${w.id}`;
        const loaded = factoryLoads
          .filter(l => String(l.productId).trim() === String(p.id).trim() && String(l.weightId || w.id).trim() === String(w.id).trim())
          .filter(filterByFactoryDelegate)
          .filter(l => new Date(l.date).getTime() > lastArchiveTimestamp)
          .reduce((sum, l) => sum + l.quantity, 0);
        let sold = 0;
        invoices
          .filter(filterByFactoryDelegate)
          .filter(inv => new Date(inv.date).getTime() > lastArchiveTimestamp)
          .forEach(inv => {
            inv.items.forEach(item => {
              if (String(item.productId).trim() === String(p.id).trim() && String(item.weightId || w.id).trim() === String(w.id).trim()) {
                sold += item.quantity;
              }
            });
          });
        stocks[key] = {
          loaded,
          sold,
          remaining: Math.max(0, loaded - sold)
        };
      });
    });

    factoryLoads
      .filter(filterByFactoryDelegate)
      .filter(l => new Date(l.date).getTime() > lastArchiveTimestamp)
      .forEach(load => {
        const pid = String(load.productId).trim();
        const wid = String(load.weightId || '').trim();
        if (!wid) return;
        const key = `${pid}_${wid}`;
        if (stocks[key]) return;
        const prod = products.find(p => String(p.id).trim() === pid);
        if (!prod) {
          stocks[key] = { loaded: load.quantity || 0, sold: 0, remaining: load.quantity || 0 };
          return;
        }
        const weights = getProductWeightsFallback(prod);
        const matched = weights.find(w => String(w.id).trim() === wid);
        if (!matched) {
          const fallbackKey = key;
          if (!stocks[fallbackKey]) {
            stocks[fallbackKey] = { loaded: load.quantity || 0, sold: 0, remaining: load.quantity || 0 };
          } else {
            stocks[fallbackKey].loaded += load.quantity || 0;
            stocks[fallbackKey].remaining = Math.max(0, stocks[fallbackKey].loaded - stocks[fallbackKey].sold);
          }
        }
      });

    return stocks;
  }, [products, factoryLoads, invoices, lastArchiveTimestamp, factoryDelegateFilter]);

  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('all');
  const [inventoryStartDate, setInventoryStartDate] = useState('');
  const [inventoryEndDate, setInventoryEndDate] = useState('');
  const [inventoryDayFilters, setInventoryDayFilters] = useState<string[]>([]);

  const weightStocksInCartons = useMemo(() => {
    const stocks: Record<string, { loaded: number; sold: number; remaining: number }> = {};
    const seenKeys = new Set<string>();

    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        const key = `${p.id}_${w.id}`;
        seenKeys.add(key);
        const unitsPerC = w.unitsPerCarton || 12;
        const u = weightStocks[key] || { loaded: 0, sold: 0, remaining: 0 };
        stocks[key] = {
          loaded: Math.floor(u.loaded / unitsPerC),
          sold: Math.floor(u.sold / unitsPerC),
          remaining: Math.floor(u.remaining / unitsPerC)
        };
      });
    });

    Object.keys(weightStocks).forEach(key => {
      if (seenKeys.has(key)) return;
      const u = weightStocks[key];
      stocks[key] = {
        loaded: Math.floor(u.loaded / 12),
        sold: Math.floor(u.sold / 12),
        remaining: Math.floor(u.remaining / 12)
      };
    });

    return stocks;
  }, [weightStocks, products]);

  const inventoryFilteredStocks = useMemo(() => {
    if (inventoryFilter === 'all') return weightStocksInCartons;

    const now = new Date();
    const isDateInRange = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      if (inventoryFilter === 'daily') return d.toDateString() === now.toDateString();
      if (inventoryFilter === 'weekly') {
        if ((now.getTime() - d.getTime()) > 7 * 24 * 60 * 60 * 1000) return false;
        if (inventoryDayFilters.length > 0) {
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
          if (!inventoryDayFilters.includes(dayName)) return false;
        }
        return true;
      }
      if (inventoryFilter === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (inventoryFilter === 'custom') {
        const dStr = dateStr.split('T')[0];
        if (inventoryStartDate && dStr < inventoryStartDate) return false;
        if (inventoryEndDate && dStr > inventoryEndDate) return false;
      }
      return true;
    };

    const stocks: Record<string, { loaded: number; sold: number; remaining: number }> = {};
    const seenKeys = new Set<string>();
    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        const key = `${p.id}_${w.id}`;
        seenKeys.add(key);
        const unitsPerC = w.unitsPerCarton || 12;
        const loaded = factoryLoads
          .filter(l => String(l.productId).trim() === String(p.id).trim() && String(l.weightId || w.id).trim() === String(w.id).trim() && isDateInRange(l.date))
          .filter(filterByFactoryDelegate)
          .filter(l => new Date(l.date).getTime() > lastArchiveTimestamp)
          .reduce((sum, l) => sum + l.quantity, 0);
        let sold = 0;
        invoices
          .filter(filterByFactoryDelegate)
          .filter(inv => new Date(inv.date).getTime() > lastArchiveTimestamp)
          .forEach(inv => {
            if (!isDateInRange(inv.date)) return;
            inv.items.forEach(item => {
              if (String(item.productId).trim() === String(p.id).trim() && String(item.weightId || w.id).trim() === String(w.id).trim()) {
                sold += item.quantity;
              }
            });
          });
        stocks[key] = {
          loaded: Math.floor(loaded / unitsPerC),
          sold: Math.floor(sold / unitsPerC),
          remaining: Math.floor((loaded - sold) / unitsPerC)
        };
      });
    });
    factoryLoads
      .filter(filterByFactoryDelegate)
      .filter(l => new Date(l.date).getTime() > lastArchiveTimestamp)
      .filter(l => isDateInRange(l.date))
      .forEach(load => {
        const pid = String(load.productId).trim();
        const wid = String(load.weightId || '').trim();
        if (!wid) return;
        const key = `${pid}_${wid}`;
        if (seenKeys.has(key)) return;
        const unitsPerC = 12;
        const loaded = load.quantity || 0;
        let sold = 0;
        invoices
          .filter(filterByFactoryDelegate)
          .filter(inv => new Date(inv.date).getTime() > lastArchiveTimestamp)
          .forEach(inv => {
            if (!isDateInRange(inv.date)) return;
            inv.items.forEach(item => {
              if (String(item.productId).trim() === pid && String(item.weightId || '').trim() === wid) {
                sold += item.quantity;
              }
            });
          });
        stocks[key] = { loaded: Math.floor(loaded / unitsPerC), sold: Math.floor(sold / unitsPerC), remaining: Math.floor((loaded - sold) / unitsPerC) };
      });
    return stocks;
  }, [weightStocksInCartons, products, factoryLoads, invoices, inventoryFilter, inventoryStartDate, inventoryEndDate, inventoryDayFilters, lastArchiveTimestamp, factoryDelegateFilter]);

  const filteredLoads = React.useMemo(() => {
    return factoryLoads.filter(load => {
      if (archiveDelegateFilter !== 'all') {
        const lPhone = (load.delegatePhone || '').trim();
        const lName = (load.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
        const selectedDel = archiveDelegates.find(d => d.phone === archiveDelegateFilter || d.name === archiveDelegateFilter);
        if (selectedDel) {
           const matchPhone = selectedDel.phone !== 'مجهول' && lPhone === selectedDel.phone;
           const matchName = lName === selectedDel.name;
           if (!matchPhone && !matchName) return false;
        } else {
           return false;
        }
      }

      const loadDateObj = new Date(load.date);
      if (isNaN(loadDateObj.getTime())) return false;

      const now = new Date();
      
      if (archiveFilter === 'daily') {
        return loadDateObj.getDate() === now.getDate() && loadDateObj.getMonth() === now.getMonth() && loadDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'weekly') {
        const diffTime = Math.abs(now.getTime() - loadDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
        if (archiveDayFilters.length > 0) {
          const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(loadDateObj);
          return archiveDayFilters.includes(englishDay);
        }
        return true;
      }
      if (archiveFilter === 'monthly') {
        return loadDateObj.getMonth() === now.getMonth() && loadDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'custom') {
        const dStr = load.date.split('T')[0]; // "YYYY-MM-DD" or similar
        if (archiveStartDate && dStr < archiveStartDate) return false;
        if (archiveEndDate && dStr > archiveEndDate) return false;
        return true;
      }
      return true;
    });
  }, [factoryLoads, archiveFilter, archiveStartDate, archiveEndDate, archiveDelegateFilter, archiveDayFilters]);

  const groupedLoadsByDate = React.useMemo(() => {
    const groups: Record<string, typeof filteredLoads> = {};
    filteredLoads.forEach(load => {
      const dateKey = load.date ? load.date.split('T')[0] : 'date_missing';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(load);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredLoads]);

  const filteredArchiveExtraPayments = useMemo(() => {
    return extraPayments.filter(pay => {
      const payDateObj = new Date(pay.date);
      if (isNaN(payDateObj.getTime())) return true;
      const now = new Date();
      if (archiveFilter === 'daily') {
        return payDateObj.getDate() === now.getDate() && payDateObj.getMonth() === now.getMonth() && payDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'weekly') {
        const diffTime = Math.abs(now.getTime() - payDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
        if (archiveDayFilters.length > 0) {
          const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(payDateObj);
          return archiveDayFilters.includes(englishDay);
        }
        return true;
      }
      if (archiveFilter === 'monthly') {
        return payDateObj.getMonth() === now.getMonth() && payDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'custom') {
        const dStr = pay.date.split('T')[0];
        if (archiveStartDate && dStr < archiveStartDate) return false;
        if (archiveEndDate && dStr > archiveEndDate) return false;
        return true;
      }
      return true;
    });
  }, [extraPayments, archiveFilter, archiveStartDate, archiveEndDate, archiveDayFilters]);

  const filteredArchiveTrips = React.useMemo(() => {
    if (!trips) return [];
    return trips.filter(trip => {
      if (!trip.collected) return false; // Only show collected (paid) trips in this archive
      
      if (archiveDelegateFilter !== 'all') {
        const lPhone = (trip.delegatePhone || '').trim();
        const lName = (trip.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
        const selectedDel = archiveDelegates.find(d => d.phone === archiveDelegateFilter || d.name === archiveDelegateFilter);
        if (selectedDel) {
           const matchPhone = selectedDel.phone !== 'مجهول' && lPhone === selectedDel.phone;
           const matchName = lName === selectedDel.name;
           if (!matchPhone && !matchName) return false;
        } else {
           return false;
        }
      }

      // Parse trip.date. It's usually "YYYY-MM-DD" from info input, but fallback is fine
      let tripDateObj = new Date(trip.date);
      if (isNaN(tripDateObj.getTime())) tripDateObj = new Date(); // fallback
      
      const now = new Date();
      
      if (archiveFilter === 'daily') {
        return tripDateObj.toDateString() === now.toDateString();
      }
      if (archiveFilter === 'weekly') {
        const diffTime = Math.abs(now.getTime() - tripDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
        if (archiveDayFilters.length > 0) {
          const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(tripDateObj);
          return archiveDayFilters.includes(englishDay);
        }
        return true;
      }
      if (archiveFilter === 'monthly') {
        return tripDateObj.getMonth() === now.getMonth() && tripDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'custom') {
        const dStr = trip.date; // assuming formatting is YYYY-MM-DD
        if (archiveStartDate && dStr < archiveStartDate) return false;
        if (archiveEndDate && dStr > archiveEndDate) return false;
        return true;
      }
      return true;
    });
  }, [trips, archiveFilter, archiveStartDate, archiveEndDate, archiveDelegateFilter, archiveDayFilters]);

  // Register extra factory payment form
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentNotes, setNewPaymentNotes] = useState('');
  const [newPaymentRecipient, setNewPaymentRecipient] = useState('');
  
  // Product form states
  const [isAddingProduct, setIsAddingProduct] = useState(false); // Controls visibility of the add form
  const [prodName, setProdName] = useState('');
  const [accountingUnit, setAccountingUnit] = useState('كرتونة'); // كرتونة، صندوق، رابطة، علبة، الخ
  const [prodPrice, setProdPrice] = useState('0'); // Default baseline price for old/compatibility compatibility
  const [prodMinAlert, setProdMinAlert] = useState('20');
  const [editingProdId, setEditingProdId] = useState<string | null>(null);

  // Nested weights/variants under the product being created/edited
  const [prodWeights, setProdWeights] = useState<ProductWeight[]>([]);

  // Sub-form states to build weight/size items
  const [weightSize, setWeightSize] = useState(''); // e.g., "1 لتر", "750 مل", "5 لتر"
  const [weightCartonPrice, setWeightCartonPrice] = useState(''); // سعر كرتونة المصنع
  const [weightUnitsPerCarton, setWeightUnitsPerCarton] = useState('12'); // عبوات في الكرتونة
  const [weightAddedValue, setWeightAddedValue] = useState(''); // القيمة المضافة بالجنيه مباشرة على سعر العبوة من المصنع
  const [weightRetailPrice, setWeightRetailPrice] = useState(''); // سعر بيع العبوة الصافي للجمهور
  const [weightBarcode, setWeightBarcode] = useState(''); // الباركود

  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);

  // Auto calculate retail price from flat added value and factory costs
  useEffect(() => {
    const cartonP = parseFloat(weightCartonPrice) || 0;
    const unitsPerC = parseInt(weightUnitsPerCarton) || 12;
    const addedV = parseFloat(weightAddedValue) || 0;

    if (cartonP > 0 && unitsPerC > 0) {
      const retailCarton = cartonP + addedV;
      const computedRetail = retailCarton / unitsPerC;
      setWeightRetailPrice(computedRetail.toString()); // الحفاظ على الدقة العشرية لضمان تطابق حسابات الجملة
    } else {
      setWeightRetailPrice('');
    }
  }, [weightCartonPrice, weightUnitsPerCarton, weightAddedValue]);

  // Load state
  const [loadProductId, setLoadProductId] = useState('');
  const [loadDate, setLoadDate] = useState(() => {
    const now = new Date();
    // Egyptian local datetime format alignment (YYYY-MM-DDTHH:MM)
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().substring(0, 16);
  });
  const [loadNotes, setLoadNotes] = useState('');
  const [warehouseKeeper, setWarehouseKeeper] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [showAdvanceInput, setShowAdvanceInput] = useState(false);
  const [loadDelegatePhone, setLoadDelegatePhone] = useState<string>('');

  // Quantities recorded per-weight of the currently selected loadProductId
  // Record<weightId, { cartons: string, units: string }>
  const [loadWeightsQty, setLoadWeightsQty] = useState<Record<string, { cartons: string, units: string }>>({});
  const [selectedLoadWeightId, setSelectedLoadWeightId] = useState('');
  const [loadQtyCartons, setLoadQtyCartons] = useState('');

  // Reset loading quantities when changing target product to load
  useEffect(() => {
    setSelectedLoadWeightId('');
    setLoadQtyCartons('');
  }, [loadProductId]);

  const handleAddWeightQtyToDraft = () => {
    if (!selectedLoadWeightId) {
      showToast('⚠️ يرجى اختيار الوزن أو الحجم من القائمة أولاً.');
      return;
    }
    const q = parseInt(loadQtyCartons) || 0;
    if (q <= 0) {
      showToast('⚠️ يرجى تحديد كمية تحميل صحيحة أكبر من الصفر.');
      return;
    }

    setLoadWeightsQty(prev => {
      const existing = prev[selectedLoadWeightId] || { cartons: '0', units: '0' };
      const currentCartons = parseInt(existing.cartons) || 0;
      return {
        ...prev,
        [selectedLoadWeightId]: {
          cartons: (currentCartons + q).toString(),
          units: '0'
        }
      };
    });

    setSelectedLoadWeightId('');
    setLoadQtyCartons('');
  };

  const handleRemoveWeightQtyFromDraft = (weightId: string) => {
    setLoadWeightsQty(prev => {
      const copy = { ...prev };
      delete copy[weightId];
      return copy;
    });
  };

  // Auto-select oil (or first product) by default for loading
  useEffect(() => {
    if (!loadProductId && products.length > 0) {
      const oilProduct = products.find(p => p.name.includes('زيت') || p.name.includes('الزيت'));
      if (oilProduct) {
        setLoadProductId(oilProduct.id);
      } else {
        setLoadProductId(products[0].id);
      }
    }
  }, [products, loadProductId]);

  // Retrieve current active product's weights or fallback
  const activeProductObj = useMemo(() => {
    return products.find(p => p.id === loadProductId);
  }, [loadProductId, products]);

  const activeWeights = useMemo(() => {
    if (!activeProductObj) return [];
    return getProductWeightsFallback(activeProductObj);
  }, [activeProductObj]);

  const groupedDraftItems = useMemo(() => {
    const groups: Record<string, { product: Product; items: { weight: ProductWeight; cartons: number }[] }> = {};

    Object.entries(loadWeightsQty).forEach(([weightId, wState]) => {
      const cartonsNum = parseInt((wState as { cartons: string }).cartons) || 0;
      if (cartonsNum <= 0) return;

      let foundProduct: Product | undefined;
      let foundWeight: ProductWeight | undefined;

      for (const p of products) {
        const weights = getProductWeightsFallback(p);
        const w = weights.find(wt => wt.id === weightId);
        if (w) {
          foundProduct = p;
          foundWeight = w;
          break;
        }
      }

      if (foundProduct && foundWeight) {
        if (!groups[foundProduct.id]) {
          groups[foundProduct.id] = {
            product: foundProduct,
            items: []
          };
        }
        groups[foundProduct.id].items.push({
          weight: foundWeight,
          cartons: cartonsNum
        });
      }
    });

    return Object.values(groups);
  }, [loadWeightsQty, products]);

  const handleAddWeightToList = () => {
    if (!weightSize.trim()) {
      showToast('⚠️ يرجى التوضيح أولاً الصنف الفرعي (سعة لترية / وزن / عدد).');
      return;
    }
    const cartonPriceNum = parseFloat(weightCartonPrice) || 0;
    const unitsCountNum = parseInt(weightUnitsPerCarton) || 12;
    const addedValueNum = parseFloat(weightAddedValue) || 0;
    const retailPriceNum = parseFloat(weightRetailPrice) || 0;

    if (cartonPriceNum <= 0) {
      showToast('⚠️ الرجاء تعبئة السعر من المصنع بشكل صحيح.');
      return;
    }
    if (unitsCountNum <= 0) {
      showToast('⚠️ الرجاء إدخال عدد العبوات بشكل صحيح.');
      return;
    }

    const newWeight: ProductWeight = {
      id: editingWeightId || `weight-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      size: weightSize.trim(),
      cartonPriceFromFactory: cartonPriceNum,
      unitsPerCarton: unitsCountNum,
      factoryPricePerUnit: Number((cartonPriceNum / unitsCountNum).toFixed(3)),
      profitMarginPercent: 0, // Using flat added value instead
      addedValue: addedValueNum,
      retailPricePerUnit: retailPriceNum,
      barcode: weightBarcode.trim()
    };

    if (editingWeightId) {
      setProdWeights(prev => prev.map(w => w.id === editingWeightId ? newWeight : w));
      setEditingWeightId(null);
    } else {
      setProdWeights(prev => [...prev, newWeight]);
    }

    // Reset subform
    setWeightSize('');
    setWeightCartonPrice('');
    setWeightUnitsPerCarton('12');
    setWeightAddedValue('');
    setWeightRetailPrice('');
    setWeightBarcode('');
  };

  const handleEditWeightInList = (id: string) => {
    const w = prodWeights.find(w => w.id === id);
    if (!w) return;
    setWeightSize(w.size);
    setWeightCartonPrice(w.cartonPriceFromFactory.toString());
    setWeightUnitsPerCarton(w.unitsPerCarton.toString());
    setWeightAddedValue((w as any).addedValuePerCarton?.toString() || w.addedValue?.toString() || '');
    setWeightRetailPrice(w.retailPricePerUnit.toString());
    setWeightBarcode(w.barcode || '');
    setEditingWeightId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveWeightFromList = (id: string) => {
    setProdWeights(prev => prev.filter(w => w.id !== id));
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;

    if (prodWeights.length === 0) {
      showToast('⚠️ يجب إضافة وزن/سعة واحدة على الأقل لهذا المنتج!');
      return;
    }

    // Baseline fallback price is the first weight's retail price
    const fallbackPriceNum = prodWeights[0]?.retailPricePerUnit || parseFloat(prodPrice) || 90;
    const minAlertNum = parseInt(prodMinAlert) || 20;

    if (editingProdId) {
      onEditProduct({
        id: editingProdId,
        name: prodName.trim(),
        price: fallbackPriceNum,
        minStockAlert: minAlertNum,
        accountingUnit: accountingUnit.trim() || 'كرتونة',
        weights: prodWeights
      });
      setEditingProdId(null);
      setIsAddingProduct(false);
      showToast('✓ تم تحديث الصنف بنجاح!');
    } else {
      onAddProduct({
        name: prodName.trim(),
        price: fallbackPriceNum,
        minStockAlert: minAlertNum,
        accountingUnit: accountingUnit.trim() || 'كرتونة',
        weights: prodWeights
      });
      setIsAddingProduct(false);
      showToast('✓ تم تسجيل المنتج الجديد بنجاح!');
    }

    // Reset fields
    setProdName('');
    setAccountingUnit('كرتونة');
    setProdPrice('0');
    setProdMinAlert('20');
    setProdWeights([]);
  };

  const startEditProduct = (prod: Product) => {
    setEditingProdId(prod.id);
    setProdName(prod.name);
    setAccountingUnit(prod.accountingUnit || 'كرتونة');
    setProdPrice(prod.price.toString());
    setProdMinAlert(prod.minStockAlert.toString());
    setProdWeights(prod.weights || getProductWeightsFallback(prod));
    setIsAddingProduct(true);
    setActiveSubTab('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit all loaded weights quantities
  const handleAddLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (groupedDraftItems.length === 0) {
      showToast('⚠️ الرجاء إضافة كمية تحميل واحدة على الأقل.');
      return;
    }

    const duaMsg = "اللهم إني أسألك خير هذا العمل وخير ما فيه، وأعوذ بك من شره وشر ما فيه. اللهم ارزقني فيه التوفيق، وبارك لي في وقتي وجهدي ورزقي";
    const confirmed = await duaConfirmDialog("تأكيد تسجيل الحمولة: هل ترغب في ترحيل وحفظ حمولة السيارة المؤقتة الحالية؟", duaMsg, "توكلت على الله");
    if (!confirmed) return;

    const selectedDelegate = isManager && loadDelegatePhone
      ? archiveDelegates.find(d => d.phone === loadDelegatePhone)
      : null;

    let hasAddedAny = false;

    groupedDraftItems.forEach(group => {
      group.items.forEach(item => {
        const totalUnits = item.cartons * item.weight.unitsPerCarton;
        if (totalUnits > 0) {
          onAddLoad({
            productId: group.product.id,
            weightId: item.weight.id,
            productName: group.product.name,
            weightSize: item.weight.size,
            quantity: totalUnits,
            cartonsCount: item.cartons,
            looseUnitsCount: 0,
            cartonPrice: item.weight.cartonPriceFromFactory || 0,
            unitPrice: (item.weight.factoryPricePerUnit || 0),
            notes: loadNotes.trim() || `شحنة محملة [${group.product.name} - وزن ${item.weight.size}]`,
            warehouseKeeper: warehouseKeeper.trim() || undefined,
            advanceAmount: showAdvanceInput ? (parseFloat(advanceAmount) || undefined) : undefined,
            date: new Date(loadDate).toISOString(),
            delegateName: selectedDelegate?.name || currentUser?.name || '',
            delegatePhone: selectedDelegate?.phone || currentUser?.phone || ''
          });
          hasAddedAny = true;
        }
      });
    });

    if (!hasAddedAny) {
      showToast('⚠️ الرجاء إدخال كمية تحميل واحدة على الأقل.');
      return;
    }

    showToast('✓ تم حفظ حمولة السيارة بنجاح!');
    // Reset loading states
    setLoadProductId('');
    setLoadWeightsQty({});
    setLoadNotes('');
    setWarehouseKeeper('');
    setAdvanceAmount('');
    setShowAdvanceInput(false);
    if (isManager) setLoadDelegatePhone('');
  };

  // Compute live cumulative totals of the current total factory load invoice (حساب المصنع والكميات المحملة)
  const factoryInvoiceSummary = useMemo(() => {
    let grandFactoryCost = 0;
    let totalCrates = 0;
    let totalIndividualItems = 0;

    const itemsList = factoryLoads.map(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];

      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / (weight?.unitsPerCarton || 12));
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % (weight?.unitsPerCarton || 12));
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const factoryPricePerUnit = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);

      const subtotal = (cartons * cartonPrice) + (loose * factoryPricePerUnit);

      grandFactoryCost += subtotal;
      totalCrates += cartons;
      totalIndividualItems += load.quantity;

      return {
        id: load.id,
        productName: prod ? prod.name : ((load as any).productName || 'صنف مجهول'),
        size: weight ? weight.size : ((load as any).weightSize || 'حجم عادي'),
        cartons,
        loose,
        cartonPrice,
        subtotal,
        date: load.date,
        warehouseKeeper: load.warehouseKeeper,
        advanceAmount: load.advanceAmount,
        delegateName: load.delegateName
      };
    });

    return {
      itemsList,
      grandFactoryCost,
      totalCrates,
      totalIndividualItems
    };
  }, [factoryLoads, products]);

  const filteredLiveLoadsSummary = useMemo(() => {
    let grandFactoryCost = 0;
    let totalCrates = 0;
    let totalIndividualItems = 0;

    const itemsList = filteredLiveLoads.map(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];

      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / (weight?.unitsPerCarton || 12));
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % (weight?.unitsPerCarton || 12));
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const factoryPricePerUnit = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);

      const subtotal = (cartons * cartonPrice) + (loose * factoryPricePerUnit);

      grandFactoryCost += subtotal;
      totalCrates += cartons;
      totalIndividualItems += load.quantity;

      return {
        id: load.id,
        productName: prod ? prod.name : ((load as any).productName || 'صنف مجهول'),
        size: weight ? weight.size : ((load as any).weightSize || 'حجم عادي'),
        cartons,
        loose,
        cartonPrice,
        subtotal,
        date: load.date,
        warehouseKeeper: load.warehouseKeeper,
        advanceAmount: load.advanceAmount,
        delegateName: load.delegateName
      };
    });

    return {
      itemsList, grandFactoryCost, totalCrates, totalIndividualItems
    };
  }, [filteredLiveLoads, products]);

  // Group load items by product so they are listed with each product name written only once
  const groupedFactoryLoads = useMemo(() => {
    const groups: Record<string, {
      productId: string;
      productName: string;
      accountingUnit: string;
      weights: Array<{
        loadId: string;
        weightId: string;
        size: string;
        cartons: number;
        loose: number;
        cartonPrice: number;
        subtotal: number;
        quantity: number;
        date: string;
        warehouseKeeper?: string;
        advanceAmount?: number;
      }>
    }> = {};

    factoryLoads.forEach(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];

      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / (weight?.unitsPerCarton || 12));
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % (weight?.unitsPerCarton || 12));
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const factoryPricePerUnit = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * factoryPricePerUnit);

      const pId = load.productId;
      if (!groups[pId]) {
        groups[pId] = {
          productId: pId,
          productName: prod ? prod.name : ((load as any).productName || 'صنف مجهول'),
          accountingUnit: prod?.accountingUnit || 'كرتونة',
          weights: []
        };
      }

      groups[pId].weights.push({
        loadId: load.id,
        weightId: load.weightId || '',
        size: weight ? weight.size : 'حجم عادي',
        cartons,
        loose,
        cartonPrice,
        subtotal,
        quantity: load.quantity,
        date: load.date,
        warehouseKeeper: load.warehouseKeeper,
        advanceAmount: load.advanceAmount
      });
    });

    return Object.values(groups);
  }, [factoryLoads, products]);

  // DRAW AND DOWNLOAD DYNAMIC STATEMENT OF SELLING LOADS AS HIGH-FIDELITY PDF
  const handlePrintCurrentLoads = () => {
    const list = filteredLiveLoadsSummary.itemsList;
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات تحميل سابقة لتنزيل البيان.');
      return;
    }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;

    const headerH = 110;
    const loadsTableH = 36 + list.length * loadRowH + 36;
    const summaryRowH = 36;
    const bottomBoxH = 120;
    const footerH = 50;
    const totalH = headerH + 10 + loadsTableH + summaryRowH + 15 + bottomBoxH + footerH + 30;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // Outer frame
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // Header
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('بيان حمولة السيارة', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('مستند جرد وتفريغ كميات أصناف السيارة المعتمد للتحميل والمطابقة', W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ ووقت البيان: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`عدد الأصناف: ${list.length}`, 55, 92);

    let y = 12 + headerH + 12;

    // ── Loads Table (5 columns) ──
    const colX = padX;
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('البيان / المرحلة', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('العدد', colQty, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الإجمالي', colTotal, y + 22);
    y += 32;

    let grandTotal = 0;

    list.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);

      const subtotal = item.subtotal || 0;
      grandTotal += subtotal;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(`${item.productName} (${item.size})`, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(`${item.cartons} كرتونة${item.loose > 0 ? ` + ${item.loose}` : ''}`, colQty, y + 24);
      ctx.fillText(`${item.cartonPrice?.toFixed(0) || '0'} ج.م`, colPrice, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${subtotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);

      y += loadRowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المسحوبات (المطلوب)', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${grandTotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);
    y += summaryRowH + 15;

    // ── Bottom two boxes ──
    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;
    const leftBoxW = (tableW - boxGap) * 0.45;
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    // Right Box: ملخص الشحنات
    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص الشحنات', rightBoxX + rightBoxW / 2, y + 21);

    let infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد الأصناف: ${list.length}`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي الإجمالي: ${grandTotal.toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي الكرتونات: ${filteredLiveLoadsSummary.totalCrates} كرتونة`, rightBoxX + rightBoxW - 20, infoY);

    // Left Box: تم التصدير
    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('بيانات المستند', leftBoxX + leftBoxW / 2, y + 21);

    infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ البيان: ${new Date().toLocaleDateString('ar-EG')}`, leftBoxX + leftBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`وقت الطباعة: ${new Date().toLocaleTimeString('ar-EG')}`, leftBoxX + leftBoxW - 20, infoY);

    y += bottomBoxH + 20;

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    // Save as PDF
    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, Math.max(297, pdfHeight + 10)]
    });
    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    doc.save(`بيان_حمولة_السيارة_${new Date().toISOString().substring(0, 10)}.pdf`);
  };

  const handleDownloadInvoiceImage = () => {
    const list = filteredLiveLoadsSummary.itemsList;
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات تحميل سابقة لتنزيل البيان.');
      return;
    }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;

    const headerH = 120;
    const loadsTableH = 36 + list.length * loadRowH + 36;
    const summaryRowH = 36;
    const bottomBoxH = 120;
    const footerH = 50;
    const totalH = headerH + 10 + loadsTableH + summaryRowH + 15 + bottomBoxH + footerH + 30;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // Outer frame
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // Header
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('بيان حمولة السيارة', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('مستند جرد وتفريغ كميات أصناف السيارة المعتمد للتحميل والمطابقة', W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ ووقت البيان: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 86);
    const loadDates = [...new Set(list.map((it: any) => it.date ? new Date(it.date).toLocaleDateString('ar-EG') : '').filter(Boolean))];
    ctx.fillText(`يوم التحميل: ${loadDates.length > 0 ? loadDates.join(' — ') : 'غير محدد'}`, W - 55, 102);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`عدد الأصناف: ${list.length}`, 55, 92);

    let y = 12 + headerH + 12;

    // ── Loads Table (5 columns) ──
    const colX = padX;
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('البيان / المرحلة', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('العدد', colQty, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الإجمالي', colTotal, y + 22);
    y += 32;

    let grandTotal = 0;

    list.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);

      const subtotal = item.subtotal || 0;
      grandTotal += subtotal;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(`${item.productName} (${item.size})`, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(`${item.cartons} كرتونة${item.loose > 0 ? ` + ${item.loose}` : ''}`, colQty, y + 24);
      ctx.fillText(`${item.cartonPrice?.toFixed(0) || '0'} ج.م`, colPrice, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${subtotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);

      y += loadRowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المسحوبات (المطلوب)', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${grandTotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);
    y += summaryRowH + 15;

    // ── Bottom two boxes ──
    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;
    const leftBoxW = (tableW - boxGap) * 0.45;
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    // Right Box: ملخص الشحنات
    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص الشحنات', rightBoxX + rightBoxW / 2, y + 21);

    let infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد الأصناف: ${list.length}`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي الإجمالي: ${grandTotal.toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي الكرتونات: ${filteredLiveLoadsSummary.totalCrates} كرتونة`, rightBoxX + rightBoxW - 20, infoY);

    // Left Box: بيانات المستند
    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('بيانات المستند', leftBoxX + leftBoxW / 2, y + 21);

    infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ البيان: ${new Date().toLocaleDateString('ar-EG')}`, leftBoxX + leftBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`يوم التحميل: ${loadDates.length > 0 ? loadDates[0] : 'غير محدد'}`, leftBoxX + leftBoxW - 20, infoY);

    y += bottomBoxH + 20;

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    // Download as image
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `بيان_حمولة_السيارة_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  };

  const exportFactoryLedgerAsPDF = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-1000px';
    iframe.style.left = '-1000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const selectedDel = archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter);
    const delegateHeader = selectedDel ? `<div style="display:inline-block;background:#e0e7ff;color:#3730a3;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:700;margin-top:8px;">المندوب: ${selectedDel.name} ${selectedDel.phone !== 'مجهول' ? `(${selectedDel.phone})` : ''}</div>` : '';

    const soldItems = allAccountLoadsForExport.filter(item => item.loaded > 0 || item.sold > 0).map(item => {
      const avgCartonPrice = item.loaded > 0 ? Math.round(item.loadedValue / item.loaded) : 0;
      return {
        productName: item.productName,
        size: item.size,
        loaded: item.loaded,
        sold: item.sold,
        remaining: item.remaining,
        factoryCartonPrice: avgCartonPrice,
        factoryValue: item.soldValue
      };
    });

    const totalLoadedCrates = soldItems.reduce((sum, item) => sum + item.loaded, 0);
    const totalSoldCrates = soldItems.reduce((sum, item) => sum + item.sold, 0);
    const totalRemainingCrates = soldItems.reduce((sum, item) => sum + item.remaining, 0);
    const totalSoldValuePdf = soldItems.reduce((sum, item) => sum + item.factoryValue, 0);
    const totalLoadedValuePdf = soldItems.reduce((sum, item) => sum + (item.loaded * item.factoryCartonPrice), 0);

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>${COMPACT_PRO_CSS}</head>
      <body>

        <div class="rh">
          <h1>كشف حساب المصنع</h1>
          <div class="sub">نظام إدارة المبيعات — كشف حساب تفصيلي</div>
          ${delegateHeader}
          <div class="ref">
            <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</span>
            <span>رقم العملية: FACT-${Date.now().toString().slice(-6)}</span>
          </div>
        </div>

        <div class="sg">
          <div class="sb bl">
            <div class="l">حساب المصنع (المحمل)</div>
            <div class="v">${totalFactoryBalanceDetails.totalWithdrawnValue.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb gr">
            <div class="l">إجمالي المسدد</div>
            <div class="v">${totalFactoryBalanceDetails.totalAdvancePayments.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          ${totalFactoryBalanceDetails.netRemainingDueToFactory > 0 ? `
          <div class="sb rd">
            <div class="l">المتبقي للمصنع</div>
            <div class="v">${totalFactoryBalanceDetails.netRemainingDueToFactory.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>` : totalFactoryBalanceDetails.netRemainingDueToFactory === 0 ? `
          <div class="sb gr">
            <div class="l">المتبقي للمصنع</div>
            <div class="v" style="color:#16a34a">مسوى ✔️</div>
          </div>` : `
          <div class="sb pu">
            <div class="l">رصيد دائن لصالحنا</div>
            <div class="v">${Math.abs(totalFactoryBalanceDetails.netRemainingDueToFactory).toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>`}
        </div>

        <div class="st"><span class="i">1</span> تفاصيل البضاعة (المحمل - المبيع - المتبقي)</div>
        <table>
          <thead>
            <tr>
              <th width="30">م</th>
              <th>الصنف والحجم</th>
              <th>المحمل (كرتونة)</th>
              <th>المبيع (كرتونة)</th>
              <th>المتبقي (كرتونة)</th>
              <th>سعر الكرتونة</th>
              <th>قيمة المبيع</th>
            </tr>
          </thead>
          <tbody>
            ${soldItems.length === 0 ? '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">لا توجد بضاعة مباع مسجلة.</td></tr>' :
              soldItems.map((item, idx) => `
                <tr>
                  <td style="text-align:center; font-weight:700; color:#94a3b8;">${idx + 1}</td>
                  <td><b style="color:#1e3a5f">${item.productName}</b> <span style="color:#64748b">${item.size}</span></td>
                  <td style="text-align:center">${item.loaded}</td>
                  <td style="text-align:center; color: #16a34a; font-weight: 800;">${item.sold}</td>
                  <td style="text-align:center; color: ${item.remaining > 0 ? '#f97316' : '#16a34a'}; font-weight: 800;">${item.remaining}</td>
                  <td style="text-align:center">${item.factoryCartonPrice > 0 ? item.factoryCartonPrice.toLocaleString('ar-EG') : '—'}</td>
                  <td style="text-align:center; font-weight:800; color:#1e3a5f">${item.factoryValue.toLocaleString('ar-EG')}</td>
                </tr>
              `).join('')
            }
          </tbody>
          <tfoot>
            <tr class="tt">
              <td colspan="2" style="text-align:right">المجموع</td>
              <td style="text-align:center">${totalLoadedCrates}</td>
              <td style="text-align:center">${totalSoldCrates}</td>
              <td style="text-align:center; color: #fbbf24;">${totalRemainingCrates}</td>
              <td></td>
              <td></td>
            </tr>
            <tr class="ts">
              <td colspan="5" style="text-align:right; font-size:11px">إجمالي المستحق (المبيع بسعر المصنع)</td>
              <td colspan="2" style="text-align:center; font-size: 14px; font-weight:900;">${totalSoldValuePdf.toLocaleString('ar-EG')} ج.م</td>
            </tr>
          </tfoot>
        </table>

        <div class="st"><span class="i">2</span> تفاصيل دفعات السداد المباشرة للمورد</div>
        <table>
          <thead>
            <tr>
              <th width="28">م</th>
              <th>التاريخ والوقت</th>
              <th>البيان</th>
              <th>المبلغ</th>
              <th>المندوب المسدد</th>
              <th>المتبقي للمديونية</th>
            </tr>
          </thead>
          <tbody>
            ${currentCycleExtraPayments.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:16px;">لم يتم تسجيل دفعات مباشرة إضافية.</td></tr>' :
              currentCycleExtraPayments.map((pay, idx) => {
                const cumBefore = currentCycleExtraPayments.slice(0, idx).reduce((s, p) => s + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
                const remainAfter = totalFactoryBalanceDetails.totalWithdrawnValue - totalFactoryBalanceDetails.totalAdvancePayments + (totalFactoryBalanceDetails.netRemainingDueToFactory > 0 ? totalFactoryBalanceDetails.netRemainingDueToFactory : 0) - cumBefore - (pay.amount - (pay.appliedToCarriedDebt || 0));
                const runningTotal = totalFactoryBalanceDetails.totalWithdrawnValue - totalFactoryBalanceDetails.currentAdvances - cumBefore - (pay.amount - (pay.appliedToCarriedDebt || 0));
                return `
                <tr>
                  <td style="text-align:center; font-weight:700; color:#94a3b8;">${idx + 1}</td>
                  <td style="font-size:9px">${pay.date}</td>
                  <td>${pay.notes || 'تسديد مباشر للمصنع'}</td>
                  <td style="font-weight:800; color:#15803d">${pay.amount.toLocaleString('ar-EG')}</td>
                  <td>${pay.delegateName || '-'}</td>
                  <td style="text-align:center; font-weight:700; color: ${runningTotal > 0 ? '#dc2626' : '#16a34a'}">
                    ${runningTotal > 0 ? runningTotal.toLocaleString('ar-EG') + ' ج.م' : runningTotal < 0 ? 'دائن ' + Math.abs(runningTotal).toLocaleString('ar-EG') : '— مسوى'}
                  </td>
                </tr>
              `}).join('')
            }
          </tbody>
        </table>

        <div class="st"><span class="i">3</span> ملخص الحساب النهائي</div>
        <table class="final-summary">
          <thead>
            <tr>
              <th style="width:60%">البيان</th>
              <th style="width:40%">المبلغ (ج.م)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:700">إجمالي قيمة المحمل من المصنع</td>
              <td style="text-align:center; font-weight:800; font-family:'Tajawal',monospace">${totalFactoryBalanceDetails.totalWithdrawnValue.toLocaleString('ar-EG')}</td>
            </tr>
            <tr>
              <td>إجمالي المستحق (المبيع بسعر المصنع)</td>
              <td style="text-align:center; font-weight:700; font-family:'Tajawal',monospace">${totalSoldValuePdf.toLocaleString('ar-EG')}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#15803d">إجمالي المسدد والمقدمات</td>
              <td style="text-align:center; font-weight:800; color:#15803d; font-family:'Tajawal',monospace">${totalFactoryBalanceDetails.totalAdvancePayments.toLocaleString('ar-EG')}</td>
            </tr>
            ${carriedOverDebt > 0 ? `
            <tr>
              <td style="color:#dc2626">دين من دورة سابقة</td>
              <td style="text-align:center; font-weight:700; color:#dc2626; font-family:'Tajawal',monospace">${carriedOverDebt.toLocaleString('ar-EG')}</td>
            </tr>` : ''}
            <tr class="result-row">
              <td style="font-size:12px; letter-spacing:0.3px">المتبقي للمصنع (الرصيد النهائي)</td>
              <td style="text-align:center; font-size:16px; font-weight:900; font-family:'Tajawal',monospace">
                ${totalFactoryBalanceDetails.netRemainingDueToFactory > 0 ? totalFactoryBalanceDetails.netRemainingDueToFactory.toLocaleString('ar-EG') + ' ج.م' : totalFactoryBalanceDetails.netRemainingDueToFactory === 0 ? 'مسوى ✔️' : Math.abs(totalFactoryBalanceDetails.netRemainingDueToFactory).toLocaleString('ar-EG') + ' ج.م (دائن)'}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="fs">
          <div class="sb2">
            <div class="ti">المدير المالي للشركة</div>
            <div class="ln">التوقيع</div>
          </div>
          <div class="sb2">
            <div class="ti">مندوب المبيعات المستلم</div>
            <div class="ln">التوقيع</div>
          </div>
        </div>

      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 500);
    }, 800);
  };

  // Compute comprehensive factory account statement: withdrawn vs sold vs remaining financial balance
  const factoryBalanceDetails = useMemo(() => {
    let rawLoadedValue = 0; // إجمالي قيمة البضاعة المحملة فعلياً بسعر المصنع في الحمولة الحالية
    let currentAdvances = 0; // إجمالي مقدمات البضاعة المدفوعة للمصنع المرتبطة بالتحميل
    
    const filteredLoads = factoryLoads
      .filter(filterByFactoryDelegate)
      .filter(l => new Date(l.date).getTime() > lastArchiveTimestamp);
      
    const filteredInvoices = invoices
      .filter(filterByFactoryDelegate)
      .filter(inv => new Date(inv.date).getTime() > lastArchiveTimestamp);

    // Calculate total loaded costs from factoryLoads
    filteredLoads.forEach(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * unitPrice);
      rawLoadedValue += subtotal;
      currentAdvances += load.advanceAmount ?? 0;
    });

    // Calculate total sold items from invoices matching our products list
    let totalSoldValue = 0; // إجمالي قيمة المبيعات للعملاء
    let totalSoldFactoryValue = 0; // إجمالي قيمة المبيعات بسعر المصنع (المستحق للمصنع)
    const soldCounts: Record<string, { cartons: number, units: number, value: number, factoryValue: number }> = {}; // weightId -> counts

    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const prod = products.find(p => String(p.id).trim() === String(item.productId).trim());
        if (!prod) return;
        const weights = getProductWeightsFallback(prod);
        const weight = weights.find(w => String(w.id).trim() === String(item.weightId).trim());
        if (!weight) return;

        const key = item.weightId || 'raw_' + item.productId;
        const current = soldCounts[key] || { cartons: 0, units: 0, value: 0, factoryValue: 0 };
        const upc = weight.unitsPerCarton || 12;
        current.units += item.quantity;
        current.cartons += item.quantity / upc;
        current.value += item.finalPrice * item.quantity;
        const factoryCartonPrice = Number(weight.cartonPriceFromFactory) || Number(prod.price) || (Number(weight.factoryPricePerUnit) || 0);
        const factoryUnitPrice = factoryCartonPrice / upc;
        current.factoryValue += (item.quantity / upc) * factoryCartonPrice;
        soldCounts[key] = current;

        totalSoldValue += item.finalPrice * item.quantity;
        totalSoldFactoryValue += (item.quantity / upc) * factoryCartonPrice;
      });
    });

    // المدين = إجمالي قيمة البضاعة المحملة من المصنع بسعر المصنع (كل ما تم سحبه من المصنع)
    const totalWithdrawnValue = rawLoadedValue;

    // إجمالي الدفعات المسجلة - مع خصم ما تم تسديده من المديونية القديمة لتجنب ازدواج الخصم
    const manualPaymentsSum = currentCycleExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);

    // المسدد = مقدمات الشحن بالسيارة + دفعات ميزان المصنع المباشرة
    const totalAdvancePayments = currentAdvances + manualPaymentsSum;

    const netRemainingDueToFactory = totalWithdrawnValue - totalAdvancePayments + carriedOverDebt;

    return {
      rawLoadedValue,
      totalWithdrawnValue,
      totalAdvancePayments,
      totalSoldValue,
      totalSoldFactoryValue,
      netRemainingDueToFactory,
      soldCounts,
      manualPaymentsSum,
      currentAdvances
    };
  }, [factoryLoads, products, invoices, carriedOverDebt, currentCycleExtraPayments, factoryDelegateFilter, isManager, lastArchiveTimestamp]);

  // ═══════════════════════════════════════════════════════════════
  // الرصيد الكلي للمصنع (بدون فلتر مندوب) — لضمان أي سداد يُحسب على الرصيد الكلي
  // ═══════════════════════════════════════════════════════════════
  const totalFactoryPayments = useMemo(() => {
    return expenses
      .filter(e => e.category === 'سداد للمصنع' || e.type === 'factory_payment')
      .filter(e => {
        const timeVal = e.date ? new Date(e.date).getTime() : 0;
        return timeVal > lastArchiveTimestamp;
      });
  }, [expenses, lastArchiveTimestamp]);

  const totalFactoryBalanceDetails = useMemo(() => {
    let rawLoadedValue = 0;
    let currentAdvances = 0;

    const allLoads = factoryLoads
      .filter(l => new Date(l.date).getTime() > lastArchiveTimestamp);

    allLoads.forEach(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * unitPrice);
      rawLoadedValue += subtotal;
      currentAdvances += load.advanceAmount ?? 0;
    });

    const totalWithdrawnValue = rawLoadedValue;

    const allPaymentsSum = totalFactoryPayments.reduce((sum, p) => {
      let parsed = p;
      try { parsed = JSON.parse(p.description || '{}'); } catch {}
      const applied = (parsed && parsed.appliedToCarriedDebt) || 0;
      return sum + (p.amount - applied);
    }, 0);

    const totalAdvancePayments = currentAdvances + allPaymentsSum;
    const netRemainingDueToFactory = totalWithdrawnValue - totalAdvancePayments + carriedOverDebt;

    return { rawLoadedValue, totalWithdrawnValue, totalAdvancePayments, netRemainingDueToFactory };
  }, [factoryLoads, products, totalFactoryPayments, carriedOverDebt, lastArchiveTimestamp]);

  // Filters for the withdrawn goods visual component (Box 1 in Factory Account)
  const [accountLoadsFilter, setAccountLoadsFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('all');
  const [accountLoadsStartDate, setAccountLoadsStartDate] = useState('');
  const [accountLoadsEndDate, setAccountLoadsEndDate] = useState('');
  const [accountLoadsDayFilters, setAccountLoadsDayFilters] = useState<string[]>([]);

  const filteredAccountLoads = React.useMemo(() => {
    return factoryLoads.filter(load => {
      if (!filterByFactoryDelegate(load)) return false;
      const loadDateObj = new Date(load.date);
      if (isNaN(loadDateObj.getTime())) return false;
      const loadTime = loadDateObj.getTime();
      if (loadTime <= lastArchiveTimestamp) return false;
      const now = new Date();
      if (accountLoadsFilter === 'daily') return loadDateObj.toDateString() === now.toDateString();
      if (accountLoadsFilter === 'weekly') {
        if ((now.getTime() - loadDateObj.getTime()) > 7 * 24 * 60 * 60 * 1000) return false;
        if (accountLoadsDayFilters.length > 0) {
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][loadDateObj.getDay()];
          if (!accountLoadsDayFilters.includes(dayName)) return false;
        }
        return true;
      }
      if (accountLoadsFilter === 'monthly') return loadDateObj.getMonth() === now.getMonth() && loadDateObj.getFullYear() === now.getFullYear();
      if (accountLoadsFilter === 'custom') {
        const dStr = load.date.split('T')[0];
        if (accountLoadsStartDate && dStr < accountLoadsStartDate) return false;
        if (accountLoadsEndDate && dStr > accountLoadsEndDate) return false;
      }
      return true;
    });
  }, [factoryLoads, accountLoadsFilter, accountLoadsStartDate, accountLoadsEndDate, accountLoadsDayFilters, factoryDelegateFilter, isManager, lastArchiveTimestamp]);

  const accountLoadsSummary = useMemo(() => {
    const totals: Record<string, { loaded: number; sold: number; remaining: number; loadedValue: number; soldValue: number; remainingValue: number; storedProductName?: string; storedWeightSize?: string }> = {};

    filteredAccountLoads.forEach(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];

      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * unitPrice);

      const key = `${load.productId}_${load.weightId || (weight ? weight.id : '')}`;
      const existing = totals[key] || { loaded: 0, sold: 0, remaining: 0, loadedValue: 0, soldValue: 0, remainingValue: 0 };
      existing.loaded += cartons;
      existing.loadedValue += subtotal;
      if (!existing.storedProductName && load.productName) existing.storedProductName = load.productName;
      if (!existing.storedWeightSize && load.weightSize) existing.storedWeightSize = load.weightSize;
      totals[key] = existing;
    });

    Object.keys(totals).forEach(key => {
      const [prodId, weightId] = key.split('_');
      const stock = weightStocks[key] || { loaded: 0, sold: 0, remaining: 0 };
      const prod = products.find(p => String(p.id).trim() === String(prodId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(weightId).trim());
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartonPrice = weight ? (Number(weight.cartonPriceFromFactory) || Number(prod?.price || 0)) : 0;
      const unitPrice = weight ? (Number(weight.factoryPricePerUnit) || Number(prod?.price || 0)) : 0;
      // stock.sold و stock.remaining بالقطعة — تحويل إلى كرتونة + باقي
      const soldFullCartons = Math.floor(stock.sold / unitsPerCarton);
      const soldLoose = stock.sold % unitsPerCarton;
      const soldValue = (soldFullCartons * cartonPrice) + (soldLoose * unitPrice);
      const remFullCartons = Math.floor(stock.remaining / unitsPerCarton);
      const remLoose = stock.remaining % unitsPerCarton;
      const remainingValue = (remFullCartons * cartonPrice) + (remLoose * unitPrice);
      totals[key].sold = soldFullCartons;
      totals[key].remaining = remFullCartons;
      totals[key].soldValue = soldValue;
      totals[key].remainingValue = remainingValue;
    });

    const prod = (pid: string) => products.find(p => String(p.id).trim() === String(pid).trim());
    const wgt = (pid: string, wid: string) => { const pp = prod(pid); const ww = pp ? getProductWeightsFallback(pp) : []; return ww.find(w => String(w.id).trim() === String(wid).trim()); };

    return Object.entries(totals).map(([key, data]) => {
      const [pid, wid] = key.split('_');
      const p = prod(pid);
      const w = wgt(pid, wid);
      const unitsPerCarton = w?.unitsPerCarton || 12;
      return {
        id: key,
        productName: p ? p.name : (data.storedProductName || 'صنف محذوف'),
        size: w ? w.size : (data.storedWeightSize || 'افتراضي'),
        loaded: data.loaded,
        sold: data.sold,
        remaining: data.remaining,
        loadedValue: data.loadedValue,
        soldValue: data.soldValue,
        remainingValue: data.remainingValue,
        unitsPerCarton
      };
    });
  }, [filteredAccountLoads, products, weightStocks]);

  // فلترة بيانات المبيعات لنفس الفترة الزمنية المستخدمة في حركة البضاعة المسحوبة
  const filteredSoldCounts = useMemo(() => {
    const now = new Date();
    const isDateInRange = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      if (accountLoadsFilter === 'all') return true;
      if (accountLoadsFilter === 'daily') return d.toDateString() === now.toDateString();
      if (accountLoadsFilter === 'weekly') {
        if ((now.getTime() - d.getTime()) > 7 * 24 * 60 * 60 * 1000) return false;
        if (accountLoadsDayFilters.length > 0) {
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
          if (!accountLoadsDayFilters.includes(dayName)) return false;
        }
        return true;
      }
      if (accountLoadsFilter === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (accountLoadsFilter === 'custom') {
        const dStr = dateStr.split('T')[0];
        if (accountLoadsStartDate && dStr < accountLoadsStartDate) return false;
        if (accountLoadsEndDate && dStr > accountLoadsEndDate) return false;
      }
      return true;
    };

    const filtered = invoices
      .filter(filterByFactoryDelegate)
      .filter(inv => new Date(inv.date).getTime() > lastArchiveTimestamp)
      .filter(inv => isDateInRange(inv.date));

    const counts: Record<string, { cartons: number; units: number; value: number; factoryValue: number }> = {};
    filtered.forEach(inv => {
      inv.items.forEach(item => {
        const prod = products.find(p => String(p.id).trim() === String(item.productId).trim());
        if (!prod) return;
        const weights = getProductWeightsFallback(prod);
        const weight = weights.find(w => String(w.id).trim() === String(item.weightId).trim());
        if (!weight) return;
        const key = item.weightId || 'raw_' + item.productId;
        const current = counts[key] || { cartons: 0, units: 0, value: 0, factoryValue: 0 };
        const upc = weight.unitsPerCarton || 12;
        current.units += item.quantity;
        current.cartons += item.quantity / upc;
        current.value += item.finalPrice * item.quantity;
        const factoryCartonPrice = Number(weight.cartonPriceFromFactory) || Number(prod.price) || 0;
        current.factoryValue += (item.quantity / upc) * factoryCartonPrice;
        counts[key] = current;
      });
    });
    return counts;
  }, [invoices, products, accountLoadsFilter, accountLoadsStartDate, accountLoadsEndDate, accountLoadsDayFilters, factoryDelegateFilter, isManager, lastArchiveTimestamp]);

  const allAccountLoadsForExport = useMemo(() => {
    const allLoads = factoryLoads.filter(filterByFactoryDelegate).filter(l => !l.archivedAt);
    const totals: Record<string, { loaded: number; sold: number; remaining: number; loadedValue: number; soldValue: number; remainingValue: number; storedProductName?: string; storedWeightSize?: string }> = {};

    allLoads.forEach(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];

      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * unitPrice);

      const key = `${load.productId}_${load.weightId || (weight ? weight.id : '')}`;
      const existing = totals[key] || { loaded: 0, sold: 0, remaining: 0, loadedValue: 0, soldValue: 0, remainingValue: 0 };
      existing.loaded += cartons;
      existing.loadedValue += subtotal;
      if (!existing.storedProductName && load.productName) existing.storedProductName = load.productName;
      if (!existing.storedWeightSize && load.weightSize) existing.storedWeightSize = load.weightSize;
      totals[key] = existing;
    });

    Object.keys(totals).forEach(key => {
      const [prodId, weightId] = key.split('_');
      const stock = weightStocks[key] || { loaded: 0, sold: 0, remaining: 0 };
      const prod = products.find(p => String(p.id).trim() === String(prodId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(weightId).trim());
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartonPrice = weight ? (Number(weight.cartonPriceFromFactory) || Number(prod?.price || 0)) : 0;
      const unitPrice = weight ? (Number(weight.factoryPricePerUnit) || Number(prod?.price || 0)) : 0;
      // stock.sold و stock.remaining بالقطعة — تحويل إلى كرتونة + باقي
      const soldFullCartons = Math.floor(stock.sold / unitsPerCarton);
      const soldLoose = stock.sold % unitsPerCarton;
      const soldValue = (soldFullCartons * cartonPrice) + (soldLoose * unitPrice);
      const remFullCartons = Math.floor(stock.remaining / unitsPerCarton);
      const remLoose = stock.remaining % unitsPerCarton;
      const remainingValue = (remFullCartons * cartonPrice) + (remLoose * unitPrice);
      totals[key].sold = soldFullCartons;
      totals[key].remaining = remFullCartons;
      totals[key].soldValue = soldValue;
      totals[key].remainingValue = remainingValue;
    });

    const prod = (pid: string) => products.find(p => String(p.id).trim() === String(pid).trim());
    const wgt = (pid: string, wid: string) => { const pp = prod(pid); const ww = pp ? getProductWeightsFallback(pp) : []; return ww.find(w => String(w.id).trim() === String(wid).trim()); };

    return Object.entries(totals).map(([key, data]) => {
      const [pid, wid] = key.split('_');
      const p = prod(pid);
      const w = wgt(pid, wid);
      const unitsPerCarton = w?.unitsPerCarton || 12;
      return {
        id: key,
        productName: p ? p.name : (data.storedProductName || 'صنف محذوف'),
        size: w ? w.size : (data.storedWeightSize || 'افتراضي'),
        loaded: data.loaded,
        sold: data.sold,
        remaining: data.remaining,
        loadedValue: data.loadedValue,
        soldValue: data.soldValue,
        remainingValue: data.remainingValue,
        unitsPerCarton
      };
    });
  }, [factoryLoads, products, weightStocks, factoryDelegateFilter, isManager]);

  const exportAccountLoads = (format: 'png' | 'pdf') => {
    const list = allAccountLoadsForExport;
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات تحميل مسجلة.');
      return;
    }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const rowH = 38;
    const summaryRowH = 36;
    const bottomBoxH = 140;
    const footerH = 60;
    const headerH = 110;
    const totalH = 24 + headerH + 32 + (list.length * rowH) + summaryRowH + 12 + bottomBoxH + footerH + 24;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W-16, totalH-16);

    roundRect(ctx, 12, 12, W-24, headerH, 6);
    ctx.fillStyle = '#1e2a4a';
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W-24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('بيان حركة البضاعة (المحمل - المبيع - المتبقي)', W/2, 12 + 38);
    ctx.fillStyle = '#93c5fd';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText('شامل لجميع الفترات — حركة سحب البضائع من المصنع ومبيعاتها وجردها', W/2, 12 + 58);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`التاريخ: ${new Date().toLocaleDateString('ar-EG')}`, W - padX - 10, 12 + 80);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`عدد الأصناف: ${list.length}`, padX + 10, 12 + 80);

    const tableY = 24 + headerH;
    const headers = ['م', 'المنتج', 'الحجم', 'المحمل (كرتونة)', 'المبيع (كرتونة)', 'المتبقي (كرتونة)', 'قيمة المبيع'];
    const colXs = [padX + tableW - 30, padX + tableW - 120, padX + tableW - 220, padX + tableW - 340, padX + tableW - 460, padX + tableW - 580, padX + tableW - 720];

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(padX, tableY, tableW, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    headers.forEach((h, i) => { ctx.fillText(h, colXs[i], tableY + 21); });

    let y = tableY + 32;
    let totalLoaded = 0, totalSold = 0, totalRemaining = 0, totalSoldValue = 0;

    list.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(padX, y, tableW, rowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(padX, y, tableW, rowH);

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1), colXs[0], y + 23);
      ctx.textAlign = 'right';
      ctx.fillText(item.productName, colXs[1], y + 23);
      ctx.textAlign = 'center';
      ctx.fillText(item.size, colXs[2], y + 23);
      ctx.fillText(String(item.loaded), colXs[3], y + 23);

      ctx.fillStyle = '#38A169';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(String(item.sold), colXs[4], y + 23);

      ctx.fillStyle = item.remaining > 0 ? '#DD6B20' : '#38A169';
      ctx.fillText(String(item.remaining), colXs[5], y + 23);

      ctx.fillStyle = '#4f46e5';
      ctx.fillText(`${formatNum(item.soldValue)} ج.م`, colXs[6], y + 23);

      totalLoaded += item.loaded;
      totalSold += item.sold;
      totalRemaining += item.remaining;
      totalSoldValue += item.soldValue;
      y += rowH;
    });

    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(padX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('الإجمالي', colXs[0], y + 23);
    ctx.fillText('', colXs[1], y + 23);
    ctx.fillText('', colXs[2], y + 23);
    ctx.fillText(String(totalLoaded), colXs[3], y + 23);
    ctx.fillText(String(totalSold), colXs[4], y + 23);
    ctx.fillText(String(totalRemaining), colXs[5], y + 23);
    ctx.fillText(`${formatNum(totalSoldValue)} ج.م`, colXs[6], y + 23);
    y += summaryRowH + 12;

    const boxW = (tableW - 12) / 2;
    roundRect(ctx, padX, y, boxW, bottomBoxH, 4);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(padX, y, boxW, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص الجرد', padX + boxW/2, y + 16);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`إجمالي المحمل: ${totalLoaded} كرتونة`, padX + boxW - 12, y + 52);
    ctx.fillText(`إجمالي المبيع: ${totalSold} كرتونة`, padX + boxW - 12, y + 74);
    ctx.fillStyle = totalRemaining > 0 ? '#DD6B20' : '#38A169';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`إجمالي المتبقي: ${totalRemaining} كرتونة`, padX + boxW - 12, y + 96);
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`قيمة المبيع للمصنع: ${formatNum(totalSoldValue)} ج.م`, padX + boxW - 12, y + 118);

    const box2X = padX + boxW + 12;
    roundRect(ctx, box2X, y, boxW, bottomBoxH, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(box2X, y, boxW, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملاحظات', box2X + boxW/2, y + 16);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('• المحمل = الكمية المسحوبة من المصنع', box2X + boxW - 12, y + 52);
    ctx.fillText('• المبيع = الكمية المباع للعملاء فعلياً', box2X + boxW - 12, y + 74);
    ctx.fillText('• المتبقي = المحمل - المبيع (في السيارة)', box2X + boxW - 12, y + 96);
    ctx.fillText(`• تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}`, box2X + boxW - 12, y + 118);
    y += bottomBoxH + 8;

    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + tableW, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`نظام إدارة المبيعات | ${new Date().toLocaleString('ar-EG')}`, W/2, y);

    if (format === 'png') {
      const link = document.createElement('a');
      link.download = `بيان_البضاعة_${new Date().toISOString().substring(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, Math.max(297, pdfHeight + 10)]
      });
      doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      doc.save(`بيان_البضاعة_${new Date().toISOString().substring(0, 10)}.pdf`);
    }
  };

  // Hook to handle active debt date tracking
  useEffect(() => {
    const activeDebt = factoryBalanceDetails.netRemainingDueToFactory;
    if (activeDebt <= 0) {
      if (carriedOverDebt > 0) {
        setCarriedOverDebt(0);
      }
      // Keep negative carriedOverDebt (credit balance) — don't clear it
      if (carriedOverDebtDate) {
        setCarriedOverDebtDate('');
      }
    } else {
      if (!carriedOverDebtDate) {
        setCarriedOverDebtDate(new Date().toLocaleDateString('ar-EG'));
      }
    }
  }, [factoryBalanceDetails.netRemainingDueToFactory, carriedOverDebtDate, carriedOverDebt]);

  // Auto-archive when remaining balance becomes exactly 0 (after payment settles it) — uses TOTAL factory balance
  const prevNetRemainingRef = React.useRef(totalFactoryBalanceDetails.netRemainingDueToFactory);
  useEffect(() => {
    const prev = prevNetRemainingRef.current;
    const curr = totalFactoryBalanceDetails.netRemainingDueToFactory;
    prevNetRemainingRef.current = curr;

    // Only trigger when transitioning from > 0 to exactly 0
    if (prev > 0 && curr === 0 && !isArchiving) {
      const hasLoads = factoryLoads.filter(l => new Date(l.date).getTime() > lastArchiveTimestamp).length > 0;
      const hasPayments = totalFactoryPayments.length > 0;
      if (hasLoads || hasPayments) {
        showToast("✅ الحساب المتبقي صفر! جاري ترحيل الدورة تلقائياً للأرشيف...");
        setTimeout(async () => {
          setIsArchiving(true);
          try {
            const currentLoads = factoryLoads.filter(l => new Date(l.date).getTime() > lastArchiveTimestamp).map(l => {
              const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
              const weights = prod ? getProductWeightsFallback(prod) : [];
              const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim());
              const unitsPerCarton = weight?.unitsPerCarton || 12;
              const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor(l.quantity / unitsPerCarton);
              const loose = l.looseUnitsCount !== undefined ? l.looseUnitsCount : (l.quantity % unitsPerCarton);
              const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
              const unitPrice = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
              return {
                date: l.date, productName: prod?.name || l.productName || 'غير معروف',
                weightSize: weight?.size || (l as any).weightSize || '', cartons, loose,
                cartonPrice, subtotal: (cartons * cartonPrice) + (loose * unitPrice),
                advanceAmount: l.advanceAmount ?? 0, delegateName: l.delegateName || ''
              };
            });
            const currentPayments = totalFactoryPayments.map(p => {
              let parsed: any = {};
              try { parsed = JSON.parse(p.description || '{}'); } catch {}
              return {
                id: p.id, amount: p.amount, date: p.date, notes: parsed.notes || '',
                recipient: parsed.recipient || '', delegateName: p.delegateName || '',
                delegatePhone: p.delegatePhone || '', appliedToCarriedDebt: parsed.appliedToCarriedDebt || 0
              };
            });
            const rawSum = currentLoads.reduce((s, l) => s + l.subtotal, 0);
            const totalPaidAuto = currentPayments.reduce((s, p) => s + p.amount, 0);
            const newCycle = {
              id: Date.now().toString(),
              settledAt: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
              loads: currentLoads,
              payments: currentPayments,
              rawLoadedValue: rawSum,
              totalWithdrawnValue: totalFactoryBalanceDetails.totalWithdrawnValue,
              totalAdvancePayments: totalPaidAuto,
              creditBalance: 0,
              carriedOverDebtAtTime: carriedOverDebt,
              settledFully: true
            };
            setArchiveCycles(prev => [...prev, newCycle]);
            setCarriedOverDebt(0);
            setCarriedOverDebtDate('');

            if (onArchiveFactoryCycle) {
              const finalPhone = selectedDelegatePhone || factoryDelegateFilter || currentUser?.phone || '';
              const finalName = selectedDelegatePhone ? (archiveDelegates.find(d => d.phone === selectedDelegatePhone)?.name || currentUser?.name || 'مجهول') : (factoryDelegateFilter ? (archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter)?.name || 'مجهول') : 'مجهول');
              onArchiveFactoryCycle(finalPhone, finalName);
            } else {
              const loadsToArchive = factoryLoads.filter(l => new Date(l.date).getTime() > lastArchiveTimestamp);
              for (const load of loadsToArchive) { onDeleteLoad(load.id); }
              const currentExpenses = expenses.filter(e =>
                (e.category === 'سداد للمصنع' || e.type === 'factory_payment') && new Date(e.date).getTime() > lastArchiveTimestamp);
              for (const exp of currentExpenses) { onDeleteExpense(exp.id); }
            }
            showToast("✓ تم ترحيل الدورة تلقائياً للأرشيف!");
          } catch (err) {
            console.error(err);
            showToast("❌ حدث خطأ أثناء الترحيل التلقائي!");
          } finally {
            setIsArchiving(false);
          }
        }, 1500);
      }
    }
  }, [totalFactoryBalanceDetails.netRemainingDueToFactory, isArchiving]);

  // Draw and download factory account statement image — clean professional invoice style
  const handleDownloadFactoryLedgerImage = () => {
    const { totalWithdrawnValue, totalAdvancePayments, netRemainingDueToFactory, currentAdvances, soldCounts, rawLoadedValue } = factoryBalanceDetails;
    const list = extraPayments;

    const soldItems = allAccountLoadsForExport.filter(item => item.loaded > 0 || item.sold > 0).map(item => {
      const avgCartonPrice = item.loaded > 0 ? Math.round(item.loadedValue / item.loaded) : 0;
      return {
        key: item.id,
        productName: item.productName,
        size: item.size,
        loaded: item.loaded,
        sold: item.sold,
        remaining: item.remaining,
        factoryCartonPrice: avgCartonPrice,
        factoryValue: item.soldValue
      };
    });

    const totalLoadedCrates = soldItems.reduce((sum, item) => sum + item.loaded, 0);
    const totalSoldCrates = soldItems.reduce((sum, item) => sum + item.sold, 0);
    const totalRemainingCrates = soldItems.reduce((sum, item) => sum + item.remaining, 0);

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;
    const summaryRowH = 36;
    const totalsRowH = 36;
    const payRowH = 34;
    const headerH = 110;
    const loadsTableH = soldItems.length > 0 ? 32 + soldItems.length * loadRowH + summaryRowH + totalsRowH : 50;
    const bottomBoxH = Math.max(list.length * payRowH + 100, 180);
    const footerH = 70;
    const totalH = headerH + 10 + loadsTableH + 15 + bottomBoxH + footerH + 40;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('كشف حساب مالي للمصنع', W / 2, 48);
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('بيان الأصناف المحملة والمباع والمتبقية', W / 2, 68);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الكشف: ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`رقم العملية: FACT-${Date.now().toString().slice(-6)}`, 55, 92);

    if (factoryDelegateFilter !== 'all') {
      const delName = archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter)?.name || factoryDelegateFilter;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText(`المندوب: ${delName}`, 55, 110);
    }

    let y = 12 + headerH + 12;

    const colX = padX;
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    const colSerial = colX + tableW - 30;
    const colDesc = colX + tableW - 150;
    const colLoaded = colX + tableW - 290;
    const colSold = colX + tableW - 400;
    const colRemaining = colX + tableW - 510;
    const colPrice = colX + tableW - 640;
    const colTotal = colX + tableW - 770;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('الصنف', colDesc, y + 22);
    ctx.fillText('المحمل (كر)', colLoaded, y + 22);
    ctx.fillText('المبيع (كر)', colSold, y + 22);
    ctx.fillText('المتبقي (كر)', colRemaining, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('سعر المصنع', colPrice, y + 22);
    ctx.fillText('قيمة المبيع', colTotal, y + 22);
    y += 32;

    let totalSoldValueCanvas = 0;

    soldItems.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 23);
      ctx.textAlign = 'right';
      ctx.fillText(`${item.productName} ${item.size}`, colDesc, y + 23);
      ctx.textAlign = 'center';
      ctx.fillText(String(item.loaded), colLoaded, y + 23);
      ctx.fillStyle = '#38A169';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(String(item.sold), colSold, y + 23);
      ctx.fillStyle = item.remaining > 0 ? '#DD6B20' : '#38A169';
      ctx.fillText(String(item.remaining), colRemaining, y + 23);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${item.factoryCartonPrice > 0 ? item.factoryCartonPrice.toLocaleString('ar-EG') : '—'}`, colPrice, y + 23);
      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(`${item.factoryValue.toLocaleString('ar-EG')} ج.م`, colTotal, y + 23);

      totalSoldValueCanvas += item.factoryValue;
      y += loadRowH;
    });

    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#152a4a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('المجموع', colDesc, y + 23);
    ctx.textAlign = 'center';
    ctx.fillText(String(totalLoadedCrates), colLoaded, y + 23);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(String(totalSoldCrates), colSold, y + 23);
    ctx.fillStyle = totalRemainingCrates > 0 ? '#fbbf24' : '#86efac';
    ctx.fillText(String(totalRemainingCrates), colRemaining, y + 23);
    y += summaryRowH;

    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, totalsRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, totalsRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المستحق (المبيع بسعر المصنع)', colDesc, y + 23);
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`${totalSoldValueCanvas.toLocaleString('ar-EG')} ج.م`, colTotal, y + 23);
    y += totalsRowH + 15;

    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;
    const leftBoxW = (tableW - boxGap) * 0.45;
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('سجل الدفعات المستلمة', rightBoxX + rightBoxW / 2, y + 21);

    let payY = y + 38;
    let totalPayments = 0;

    if (list.length > 0) {
      list.forEach((pay, idx) => {
        if (idx > 0) {
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = '#c5b89a';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(rightBoxX + 15, payY - 4);
          ctx.lineTo(rightBoxX + rightBoxW - 15, payY - 4);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        const desc = pay.notes || 'تسديد مباشر';
        const dateStr = pay.date || '';
        ctx.fillText(`• ${desc} - ${dateStr}`, rightBoxX + rightBoxW - 20, payY + 14);
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = '#0d7c5f';
        ctx.textAlign = 'left';
        ctx.fillText(`${pay.amount.toLocaleString('ar-EG')} ج.م`, rightBoxX + 20, payY + 14);
        totalPayments += pay.amount;
        payY += payRowH;
      });
      payY += 4;
      ctx.strokeStyle = '#2c3e6b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rightBoxX + 15, payY);
      ctx.lineTo(rightBoxX + rightBoxW - 15, payY);
      ctx.stroke();
      payY += 18;
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`إجمالي المسدد: ${totalPayments.toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, payY);
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`مقدمات الشحن: ${currentAdvances.toLocaleString('ar-EG')} ج.م`, rightBoxX + 20, payY);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('لا توجد دفعات مسجلة', rightBoxX + rightBoxW / 2, payY + 30);
    }

    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('صافي المستحق (المتبقي)', leftBoxX + leftBoxW / 2, y + 21);

    const netCenterY = y + 30 + (bottomBoxH - 30) / 2;

    if (netRemainingDueToFactory > 0) {
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${netRemainingDueToFactory.toLocaleString('ar-EG')} ج.م`, leftBoxX + leftBoxW / 2, netCenterY);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#dc2626';
      ctx.fillText('يجب سداد المبلغ أعلاه', leftBoxX + leftBoxW / 2, netCenterY + 28);
    } else if (netRemainingDueToFactory === 0) {
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('٠.٠٠ ج.م', leftBoxX + leftBoxW / 2, netCenterY);
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#059669';
      ctx.fillText('*تم تسوية الحساب بالكامل*', leftBoxX + leftBoxW / 2, netCenterY + 30);
    } else {
      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.abs(netRemainingDueToFactory).toLocaleString('ar-EG')} ج.م`, leftBoxX + leftBoxW / 2, netCenterY);
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#4f46e5';
      ctx.fillText('رصيد دائن لصالحنا (دفعات زائدة)', leftBoxX + leftBoxW / 2, netCenterY + 30);
    }

    y += bottomBoxH + 20;

    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 22;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تم التصدير من نظام تتبع المبيعات — ' + new Date().toLocaleDateString('ar-EG'), W / 2, y);
    y += 30;
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();

    const dataUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.download = `كشف_حساب_المصنع_${new Date().toISOString().substring(0, 10)}.png`;
    downloadLink.href = dataUrl;
    downloadLink.click();
  };

  // ── Archived cycle image export (professional invoice style) ──
  const downloadArchivedCycleImage = (cycle: any) => {
    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;
    const payRowH = 34;
    const loads = cycle.loads || [];
    const pays = cycle.payments || [];

    const headerH = 110;
    const loadsTableH = loads.length > 0 ? 36 + loads.length * loadRowH + 36 : 50;
    const summaryRowH = 36;
    const bottomBoxH = Math.max(pays.length * payRowH + 100, 180);
    const footerH = 70;
    const totalH = headerH + 10 + loadsTableH + summaryRowH + 15 + bottomBoxH + footerH + 40;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // Outer frame
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // Header
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();

    // Gold accent line
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('دورة مؤرشفة — كشف حساب المصنع', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('نظام التوزيع والمبيعات المعتمد للأغذية والمستودع', W / 2, 68);

    // Date
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الإقفال: ${cycle.settledAt || '—'}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`رقم الدورة: ${cycle.id?.slice(-6) || '—'}`, 55, 92);

    let y = 12 + headerH + 12;

    // ── Loads Table ──
    const colX = padX;
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('البيان / المرحلة', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('العدد', colQty, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الإجمالي', colTotal, y + 22);
    y += 32;

    let totalLoadValue = 0;
    loads.forEach((l: any, idx: number) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);
      ctx.beginPath();
      ctx.moveTo(colX, y + loadRowH);
      ctx.lineTo(colX + tableW, y + loadRowH);
      ctx.stroke();

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';

      const arabicNum = String(idx + 1).padStart(2, '0');
      ctx.textAlign = 'center';
      ctx.fillText(arabicNum, colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(`${l.productName} (${l.weightSize})`, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(`${l.cartons} كرتونة${l.loose > 0 ? ` + ${l.loose}` : ''}`, colQty, y + 24);
      ctx.fillText(`${formatNum(l.cartonPrice)} ج.م`, colPrice, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${formatNum(l.subtotal)} ج.م`, colTotal, y + 24);

      totalLoadValue += l.subtotal || 0;
      y += loadRowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المسحوبات (المطلوب)', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${formatNum(totalLoadValue)} ج.م`, colTotal, y + 24);
    y += summaryRowH + 15;

    // ── Bottom two boxes ──
    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;
    const leftBoxW = (tableW - boxGap) * 0.45;
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    // Right Box: سجل الدفعات المستلمة
    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('سجل الدفعات المستلمة', rightBoxX + rightBoxW / 2, y + 21);

    let payY = y + 38;
    let totalPayments = 0;

    if (pays.length > 0) {
      pays.forEach((p: any, idx: number) => {
        if (idx > 0) {
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = '#c5b89a';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(rightBoxX + 15, payY - 4);
          ctx.lineTo(rightBoxX + rightBoxW - 15, payY - 4);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`• ${p.notes || 'تسديد'} - ${p.date || ''}`, rightBoxX + rightBoxW - 20, payY + 14);
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = '#0d7c5f';
        ctx.textAlign = 'left';
        ctx.fillText(`${formatNum(p.amount)} ج.م`, rightBoxX + 20, payY + 14);
        totalPayments += p.amount || 0;
        payY += payRowH;
      });

      payY += 4;
      ctx.strokeStyle = '#2c3e6b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rightBoxX + 15, payY);
      ctx.lineTo(rightBoxX + rightBoxW - 15, payY);
      ctx.stroke();

      payY += 18;
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`إجمالي المسدد: ${formatNum(totalPayments)} ج.م`, rightBoxX + rightBoxW - 20, payY);
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`عدد الدفعات: ${pays.length}`, rightBoxX + 20, payY);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('لا توجد دفعات مسجلة', rightBoxX + rightBoxW / 2, payY + 30);
    }

    // Left Box: صافي المستحق (المتبقي)
    const netRemaining = (cycle.totalWithdrawnValue || 0) - (cycle.totalAdvancePayments || 0);
    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('صافي المستحق (المتبقي)', leftBoxX + leftBoxW / 2, y + 21);

    const netCenterY = y + 30 + (bottomBoxH - 30) / 2;
    if (netRemaining > 0) {
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${formatNum(netRemaining)} ج.م`, leftBoxX + leftBoxW / 2, netCenterY);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('يجب سداد المبلغ أعلاه', leftBoxX + leftBoxW / 2, netCenterY + 28);
    } else if (netRemaining === 0) {
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('٠.٠٠ ج.م', leftBoxX + leftBoxW / 2, netCenterY);
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('*تم تسوية الحساب بالكامل*', leftBoxX + leftBoxW / 2, netCenterY + 30);
    } else {
      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${formatNum(Math.abs(netRemaining))} ج.م`, leftBoxX + leftBoxW / 2, netCenterY);
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('رصيد دائن لصالحنا (دفعات زائدة)', leftBoxX + leftBoxW / 2, netCenterY + 30);
    }

    y += bottomBoxH + 20;

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 22;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تم التصدير من نظام تتبع المبيعات — ' + new Date().toLocaleDateString('ar-EG'), W / 2, y);

    // Download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `دورة_مؤرشفة_${(cycle.settledAt || '').replace(/[/:]/g, '-')}.png`;
    link.href = dataUrl;
    link.click();
  };

  // ── Archived cycle PDF export (professional invoice style) ──
  const downloadArchivedCyclePDF = (cycle: any) => {
    const loads = cycle.loads || [];
    const pays = cycle.payments || [];
    const totalLoadValue = loads.reduce((s: number, l: any) => s + (l.subtotal || 0), 0);
    const totalPayments = pays.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const netRemaining = (cycle.totalWithdrawnValue || 0) - (cycle.totalAdvancePayments || 0);

    const loadsRows = loads.map((l: any, i: number) => `
      <tr>
        <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
        <td style="text-align:right">${l.productName} (${l.weightSize})</td>
        <td style="text-align:center">${l.cartons} كرتونة${l.loose > 0 ? ` + ${l.loose}` : ''}</td>
        <td style="text-align:center">${formatNum(l.cartonPrice)} ج.م</td>
        <td style="text-align:center;font-weight:bold">${formatNum(l.subtotal)} ج.م</td>
      </tr>
    `).join('');

    const payRows = pays.map((p: any, i: number) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="text-align:right">${p.notes || 'تسديد'} - ${p.date || ''}</td>
        <td style="text-align:center;font-weight:bold;color:#0d7c5f">${formatNum(p.amount)} ج.م</td>
        <td style="text-align:right">${p.delegateName || '-'}</td>
      </tr>
    `).join('');

    const netColor = netRemaining > 0 ? '#dc2626' : netRemaining === 0 ? '#059669' : '#4f46e5';
    const netText = netRemaining > 0 ? `${formatNum(netRemaining)} ج.م` : netRemaining === 0 ? '٠.٠٠ ج.م — *تم تسوية الحساب بالكامل*' : `${formatNum(Math.abs(netRemaining))} ج.م — رصيد دائن لصالحنا`;
    const settleNote = netRemaining === 0 ? '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:8px 12px;color:#059669;font-weight:bold;font-size:13px;text-align:center;margin-top:8px">*تم تسوية الحساب بالكامل*</div>' : '';

    const html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
      <div style="padding:12mm 14mm">
        <div class="rh">
          <h1>دورة مؤرشفة — كشف حساب المصنع</h1>
          <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
          <div class="ref">
            <span>تاريخ الإقفال: ${cycle.settledAt || '—'}</span>
            <span>رقم الدورة: ${cycle.id?.slice(-6) || '—'}</span>
          </div>
        </div>

        <div class="st"><span class="i">1</span> الحمولات (${loads.length})</div>
        <table>
          <thead><tr><th width="30">م</th><th>البيان</th><th>العدد</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>${loadsRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">لا توجد حمولات</td></tr>'}</tbody>
        </table>
        <div class="ts" style="padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:800;font-size:12px;margin-bottom:14px">
          <span>إجمالي المسحوبات (المطلوب)</span>
          <span>${formatNum(totalLoadValue)} ج.م</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
          <div style="border:2px solid #1e3a5f;border-radius:12px;overflow:hidden">
            <div class="tt" style="padding:8px 12px;font-weight:800;font-size:12px;text-align:center">سجل الدفعات المستلمة</div>
            <div style="padding:12px;min-height:100px;background:#f8fafc">
              ${pays.length > 0 ? pays.map((p: any) => `
                <div style="border-bottom:1px dashed #e2e8f0;padding:6px 0;font-size:10px;display:flex;justify-content:space-between">
                  <span>${p.notes || 'تسديد'} - ${p.date || ''}</span>
                  <span style="color:#059669;font-weight:800">${formatNum(p.amount)} ج.م</span>
                </div>
              `).join('') : '<div style="text-align:center;color:#94a3b8;padding:16px;font-size:10px">لا توجد دفعات</div>'}
              ${pays.length > 0 ? `
              <div style="border-top:2px solid #1e3a5f;padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;font-weight:800;font-size:11px">
                <span>إجمالي: ${formatNum(totalPayments)} ج.م</span>
                <span>الدفعات: ${pays.length}</span>
              </div>` : ''}
            </div>
          </div>
          <div style="border:2px solid #1e3a5f;border-radius:12px;overflow:hidden">
            <div class="tt" style="padding:8px 12px;font-weight:800;font-size:12px;text-align:center">صافي المستحق (المتبقي)</div>
            <div style="padding:12px;min-height:100px;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <div style="font-size:28px;font-weight:900;margin:8px 0;color:${netColor}">${netRemaining === 0 ? '٠.٠٠ ج.م' : `${formatNum(Math.abs(netRemaining))} ج.م`}</div>
              <div style="font-size:11px;font-weight:700;color:${netColor}">${netRemaining > 0 ? 'يجب سداد المبلغ أعلاه' : netRemaining === 0 ? '*تم تسوية الحساب بالكامل*' : 'رصيد دائن لصالحنا'}</div>
              ${settleNote}
            </div>
          </div>
        </div>

        <div class="fs" style="margin-top:30px">
          <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
          <div class="sb2"><div class="ti">مندوب المبيعات</div><div class="ln">التوقيع</div></div>
        </div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    }
  };

  // Combined PDF export for ALL archived cycles
  const downloadAllArchivedCyclesPDF = () => {
    if (archiveCycles.length === 0) { showToast('⚠️ لا توجد دورات مؤرشفة!'); return; }

    let allLoadsHtml = '';
    let allPaymentsHtml = '';
    let cycleIndex = 0;
    let grandTotalLoad = 0;
    let grandTotalPayments = 0;

    archiveCycles.forEach((cycle) => {
      cycleIndex++;
      const loads = cycle.loads || [];
      const pays = cycle.payments || [];
      const totalLoadValue = loads.reduce((s: number, l: any) => s + (l.subtotal || 0), 0);
      const totalPayments = pays.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      grandTotalLoad += totalLoadValue;
      grandTotalPayments += totalPayments;

      const loadsRows = loads.map((l: any, i: number) => `
        <tr>
          <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
          <td style="text-align:right">${l.productName} (${l.weightSize})</td>
          <td style="text-align:center">${l.cartons} كرتونة${l.loose > 0 ? ` + ${l.loose}` : ''}</td>
          <td style="text-align:center">${formatNum(l.cartonPrice)} ج.م</td>
          <td style="text-align:center;font-weight:bold">${formatNum(l.subtotal)} ج.م</td>
        </tr>
      `).join('');

      const payRows = pays.map((p: any, i: number) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td style="text-align:right">${p.notes || 'تسديد'} - ${p.date || ''}</td>
          <td style="text-align:center;font-weight:bold;color:#0d7c5f">${formatNum(p.amount)} ج.م</td>
          <td style="text-align:right">${p.delegateName || '-'}</td>
          <td style="text-align:right">${p.recipient ? 'السيد / ' + p.recipient : '-'}</td>
        </tr>
      `).join('');

      allLoadsHtml += `
        <div style="margin-bottom:30px;page-break-inside:avoid">
          <h3 style="color:#2c3e6b;margin-bottom:8px;border-bottom:2px solid #2c3e6b;padding-bottom:6px">الدورة ${cycleIndex} — ${cycle.settledAt || '—'} (${loads.length} حمولة)</h3>
          <table>
            <thead><tr><th width="40">م</th><th>البيان / المرحلة</th><th>العدد</th><th>السعر</th><th>الإجمالي</th></tr></thead>
            <tbody>${loadsRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">لا توجد حمولات</td></tr>'}</tbody>
          </table>
          <div style="background:#0d7c5f;color:#fff;padding:8px 12px;border-radius:6px;display:flex;justify-content:space-between;font-weight:bold;font-size:12px;margin-bottom:8px">
            <span>إجمالي المسحوبات</span>
            <span>${formatNum(totalLoadValue)} ج.م</span>
          </div>
          ${cycle.creditBalance > 0 ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:6px;color:#92400e;font-weight:bold;font-size:11px;text-align:center">رصيد دائن: ${formatNum(cycle.creditBalance)} ج.م</div>` : ''}
        </div>`;

      allPaymentsHtml += `
        <div style="margin-bottom:20px;page-break-inside:avoid">
          <h4 style="color:#2c3e6b;margin-bottom:6px">الدورة ${cycleIndex} — الدفعات (${pays.length} دفعة)</h4>
          ${pays.length > 0 ? `<table>
            <thead><tr><th>م</th><th>البيان</th><th>المبلغ</th><th>المندوب</th><th>المستلم</th></tr></thead>
            <tbody>${payRows}</tbody>
          </table>
          <div style="background:#065f46;color:#fff;padding:6px 10px;border-radius:6px;display:flex;justify-content:space-between;font-weight:bold;font-size:11px;margin-top:4px">
            <span>إجمالي المسدد: ${formatNum(totalPayments)} ج.م</span>
            <span>عدد الدفعات: ${pays.length}</span>
          </div>` : '<p style="color:#94a3b8;text-align:center;font-size:11px">لا توجد دفعات</p>'}
        </div>`;
    });

    const netGrand = grandTotalLoad - grandTotalPayments;

    const html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
      <div style="padding:12mm 14mm">
        <div class="rh">
          <h1>جميع الدورات المؤرشفة — كشف حساب المصنع</h1>
          <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
          <div class="ref">
            <span>عدد الدورات: ${archiveCycles.length}</span>
            <span>إجمالي المسحوبات: ${formatNum(grandTotalLoad)} ج.م</span>
          </div>
          <div class="ref" style="margin-top:4px">
            <span>إجمالي المسدد: ${formatNum(grandTotalPayments)} ج.م</span>
            <span style="color:${netGrand > 0 ? '#f87171' : '#4ade80'};font-weight:800">الصافي: ${formatNum(Math.abs(netGrand))} ج.م ${netGrand > 0 ? 'مدين' : netGrand === 0 ? 'مسوى' : 'دائن'}</span>
          </div>
        </div>
        ${allLoadsHtml}
        <div class="st"><span class="i">2</span> الدفعات المباشرة لجميع الدورات</div>
        ${allPaymentsHtml}
        <div style="text-align:center;color:#94a3b8;font-size:9px;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:10px">تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    }
  };

  // Combined Image export for ALL archived cycles
  const downloadAllArchivedCyclesImage = () => {
    if (archiveCycles.length === 0) { showToast('⚠️ لا توجد دورات مؤرشفة!'); return; }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const headerH = 110;
    const rowH = 34;
    const footerH = 50;

    // Pre-calculate total height
    let totalContentH = 0;
    archiveCycles.forEach(cycle => {
      const loads = cycle.loads || [];
      totalContentH += 40; // cycle title
      totalContentH += 32; // table header
      totalContentH += loads.length * rowH; // load rows
      totalContentH += 36; // summary row
      totalContentH += 30; // gap
    });
    const totalH = headerH + 10 + totalContentH + footerH + 40;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // Outer frame
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // Header
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('جميع الدورات المؤرشفة — كشف حساب المصنع', W / 2, 45);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`عدد الدورات: ${archiveCycles.length} — تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`, W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`الدورات: ${archiveCycles.length}`, 55, 92);

    let y = 12 + headerH + 12;

    // Column positions
    const colX = padX;
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    archiveCycles.forEach((cycle, cycleIdx) => {
      const loads = cycle.loads || [];
      const totalLoadValue = loads.reduce((s: number, l: any) => s + (l.subtotal || 0), 0);

      // Cycle title
      ctx.fillStyle = '#2c3e6b';
      ctx.fillRect(colX, y, tableW, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`الدورة ${cycleIdx + 1} — ${cycle.settledAt || '—'} (${loads.length} حمولة)`, colX + tableW - 10, y + 21);
      y += 30;

      // Table header
      ctx.fillStyle = '#374151';
      ctx.fillRect(colX, y, tableW, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('م', colSerial, y + 22);
      ctx.textAlign = 'right';
      ctx.fillText('البيان / المرحلة', colDesc, y + 22);
      ctx.textAlign = 'center';
      ctx.fillText('العدد', colQty, y + 22);
      ctx.fillText('السعر', colPrice, y + 22);
      ctx.fillText('الإجمالي', colTotal, y + 22);
      y += 32;

      // Load rows
      loads.forEach((load: any, idx: number) => {
        ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
        ctx.fillRect(colX, y, tableW, rowH);
        ctx.strokeStyle = '#d5d0c8';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(colX, y, tableW, rowH);

        ctx.fillStyle = '#1a1a1a';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 22);
        ctx.textAlign = 'right';
        ctx.fillText(`${load.productName} (${load.weightSize})`, colDesc, y + 22);
        ctx.textAlign = 'center';
        ctx.fillText(`${load.cartons} كرتونة${load.loose > 0 ? ` + ${load.loose}` : ''}`, colQty, y + 22);
        ctx.fillText(`${formatNum(load.cartonPrice)} ج.م`, colPrice, y + 22);
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText(`${formatNum(load.subtotal)} ج.م`, colTotal, y + 22);
        y += rowH;
      });

      // Summary row
      ctx.fillStyle = '#0d7c5f';
      ctx.fillRect(colX, y, tableW, 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('إجمالي المسحوبات', colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(`${formatNum(totalLoadValue)} ج.م`, colTotal, y + 24);
      y += 36 + 30;
    });

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    const link = document.createElement('a');
    link.download = `جميع_الدورات_المؤرشفة_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Filtered archive download - PDF
  const downloadFilteredArchivePDF = () => {
    const filtered = archiveCycles.filter(c => {
      const settled = new Date(c.settledAt);
      if (isNaN(settled.getTime())) return true;
      const now = new Date();
      if (archiveFilter === 'daily') return settled.toDateString() === now.toDateString();
      if (archiveFilter === 'weekly') { const d = Math.abs(now.getTime() - settled.getTime()); return Math.ceil(d / 86400000) <= 7; }
      if (archiveFilter === 'monthly') return settled.getMonth() === now.getMonth() && settled.getFullYear() === now.getFullYear();
      if (archiveFilter === 'custom') {
        const ds = settled.toISOString().substring(0, 10);
        if (archiveStartDate && ds < archiveStartDate) return false;
        if (archiveEndDate && ds > archiveEndDate) return false;
      }
      return true;
    });
    if (filtered.length === 0) { showToast('⚠️ لا توجد دورات في هذه الفترة!'); return; }

    const filterLabel = archiveFilter === 'all' ? 'الكل' : archiveFilter === 'daily' ? 'يومي' : archiveFilter === 'weekly' ? 'أسبوعي' : archiveFilter === 'monthly' ? 'شهري' : 'مخصص';
    let allLoadsHtml = '';
    let allPaymentsHtml = '';
    let grandTotalLoad = 0;
    let grandTotalPayments = 0;

    filtered.forEach((cycle, idx) => {
      const loads = cycle.loads || [];
      const pays = cycle.payments || [];
      const totalLoadValue = loads.reduce((s: number, l: any) => s + (l.subtotal || 0), 0);
      const totalPayments = pays.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      grandTotalLoad += totalLoadValue;
      grandTotalPayments += totalPayments;

      allLoadsHtml += `<tr style="background:#e0e7ff"><td colspan="5" style="font-weight:bold;text-align:center;padding:8px">دورة ${idx + 1} — ${cycle.settledAt} — (${loads.length} حمولة)</td></tr>`;
      loads.forEach((l: any, i: number) => {
        allLoadsHtml += `<tr><td style="text-align:center">${i + 1}</td><td style="text-align:right">${l.productName} (${l.weightSize})</td><td style="text-align:center">${l.cartons} كرتونة${l.loose > 0 ? ` + ${l.loose}` : ''}</td><td style="text-align:center">${formatNum(l.cartonPrice)} ج.م</td><td style="text-align:center;font-weight:bold">${formatNum(l.subtotal)} ج.م</td></tr>`;
      });

      allPaymentsHtml += `<tr style="background:#fef3c7"><td colspan="5" style="font-weight:bold;text-align:center;padding:8px">دفعات الدورة ${idx + 1}</td></tr>`;
      pays.forEach((p: any, i: number) => {
        allPaymentsHtml += `<tr><td style="text-align:center">${i + 1}</td><td style="text-align:right">${p.notes || 'تسديد مباشر'}</td><td style="text-align:center;font-weight:bold;color:#059669">${formatNum(p.amount)} ج.م</td><td style="text-align:center">${p.delegateName || '-'}</td><td style="text-align:center">${p.recipient || '-'}</td></tr>`;
      });
    });

    const grandNet = grandTotalLoad - grandTotalPayments;
    const html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
      <div style="padding:12mm 14mm">
        <div class="rh">
          <h1>تقرير الدورات المؤرشفة — فلتر: ${filterLabel}</h1>
          <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
          <div class="ref">
            <span>عدد الدورات: ${filtered.length}</span>
            <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</span>
          </div>
        </div>

        <div class="st"><span class="i">1</span> الحمولات (${filtered.length})</div>
        <table><thead><tr><th>م</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>القيمة</th></tr></thead><tbody>${allLoadsHtml}</tbody></table>

        <div class="st"><span class="i">2</span> الدفعات (${filtered.length})</div>
        <table><thead><tr><th>م</th><th>البيان</th><th>المبلغ</th><th>المندوب</th><th>المستلم</th></tr></thead><tbody>${allPaymentsHtml}</tbody></table>

        <div class="sg">
          <div class="sb bl"><div class="l">إجمالي الحمولات</div><div class="v">${formatNum(grandTotalLoad)} ج.م</div></div>
          <div class="sb gr"><div class="l">إجمالي الدفعات</div><div class="v">${formatNum(grandTotalPayments)} ج.م</div></div>
          <div class="sb rd"><div class="l">المتبقي</div><div class="v">${formatNum(grandNet)} ج.م</div></div>
        </div>

        <div class="fs" style="margin-top:30px">
          <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
          <div class="sb2"><div class="ti">مندوب المبيعات</div><div class="ln">التوقيع</div></div>
        </div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    showToast('✓ تم فتح تقرير PDF للفترة المفلترة!');
  };

  // Filtered archive download - Image
  const downloadFilteredArchiveImage = () => {
    const filtered = archiveCycles.filter(c => {
      const settled = new Date(c.settledAt);
      if (isNaN(settled.getTime())) return true;
      const now = new Date();
      if (archiveFilter === 'daily') return settled.toDateString() === now.toDateString();
      if (archiveFilter === 'weekly') { const d = Math.abs(now.getTime() - settled.getTime()); return Math.ceil(d / 86400000) <= 7; }
      if (archiveFilter === 'monthly') return settled.getMonth() === now.getMonth() && settled.getFullYear() === now.getFullYear();
      if (archiveFilter === 'custom') {
        const ds = settled.toISOString().substring(0, 10);
        if (archiveStartDate && ds < archiveStartDate) return false;
        if (archiveEndDate && ds > archiveEndDate) return false;
      }
      return true;
    });
    if (filtered.length === 0) { showToast('⚠️ لا توجد دورات في هذه الفترة!'); return; }

    const filterLabel = archiveFilter === 'all' ? 'الكل' : archiveFilter === 'daily' ? 'يومي' : archiveFilter === 'weekly' ? 'أسبوعي' : archiveFilter === 'monthly' ? 'شهري' : 'مخصص';
    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const rowH = 30;
    const headerH = 90;
    const summaryRowH = 40;
    const footerH = 50;

    let totalRows = 0;
    let grandTotalLoad = 0;
    let grandTotalPayments = 0;
    filtered.forEach(c => {
      totalRows += (c.loads?.length || 0) + (c.payments?.length || 0) + 2;
      grandTotalLoad += (c.loads || []).reduce((s: number, l: any) => s + (l.subtotal || 0), 0);
      grandTotalPayments += (c.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
    });
    const totalH = headerH + 10 + totalRows * rowH + summaryRowH + footerH + 40;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    ctx.fillStyle = '#1e2a4a';
    ctx.fillRect(12, 12, W - 24, headerH);
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`الدورات المؤرشفة — فلتر: ${filterLabel}`, W / 2, 45);
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`${filtered.length} دورة | إجمالي الحمولات: ${formatNum(grandTotalLoad)} ج.م`, W / 2, 65);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W / 2, 82);

    let y = headerH + 20;
    ctx.font = 'bold 12px system-ui, sans-serif';

    filtered.forEach((cycle, idx) => {
      ctx.fillStyle = '#3b5998';
      ctx.fillRect(padX, y, tableW, 24);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`دورة ${idx + 1} — ${cycle.settledAt}`, W / 2, y + 16);
      y += 28;

      ctx.fillStyle = '#1e2a4a';
      ctx.fillRect(padX, y, tableW, 22);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText('📦 الحمولات', W / 2, y + 15);
      y += 24;

      (cycle.loads || []).forEach((l: any, i: number) => {
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
        ctx.fillRect(padX, y, tableW, rowH);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(padX, y, tableW, rowH);
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'right';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(`${l.productName} (${l.weightSize}) — ${l.cartons} كرتونة — ${formatNum(l.subtotal)} ج.م`, W - padX - 10, y + 19);
        y += rowH;
      });

      if ((cycle.payments || []).length > 0) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(padX, y, tableW, 22);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.fillText('💳 الدفعات', W / 2, y + 15);
        y += 24;

        (cycle.payments || []).forEach((p: any, i: number) => {
          ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#fef3c7';
          ctx.fillRect(padX, y, tableW, rowH);
          ctx.strokeStyle = '#e2e8f0';
          ctx.strokeRect(padX, y, tableW, rowH);
          ctx.fillStyle = '#059669';
          ctx.textAlign = 'right';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.fillText(`${p.notes || 'تسديد مباشر'} — ${formatNum(p.amount)} ج.م`, W - padX - 10, y + 19);
          y += rowH;
        });
      }
      y += 10;
    });

    y += 10;
    ctx.fillStyle = '#1e2a4a';
    ctx.fillRect(padX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const net = grandTotalLoad - grandTotalPayments;
    ctx.fillText(`إجمالي الحمولات: ${formatNum(grandTotalLoad)} ج.م | الدفعات: ${formatNum(grandTotalPayments)} ج.م | المتبقي: ${formatNum(net)} ج.م`, W / 2, y + 25);

    y += summaryRowH + 15;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    const link = document.createElement('a');
    link.download = `الدورات_المؤرشفة_${filterLabel}_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('✓ تم تنزيل صورة الدورات المفلترة!');
  };

  // ── Professional trips exports (pending) ──
  const downloadPendingTripsImage = () => {
    const pendingTrips = (trips || []).filter(t => !t.collected);
    if (pendingTrips.length === 0) { showToast('⚠️ لا توجد مشاوير معلقة!'); return; }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const rowH = 38;
    const headerH = 110;
    const summaryRowH = 36;
    const footerH = 50;
    const totalH = headerH + 10 + 32 + pendingTrips.length * rowH + summaryRowH + 15 + 120 + footerH + 30;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('كشف المشاوير المعلقة (غير المحصلة)', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`عدد المشاوير: ${pendingTrips.length}`, W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);

    let y = 12 + headerH + 12;
    const colX = padX;

    // Table header
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 200;
    const colDate = colX + tableW - 420;
    const colPrice = colX + tableW - 580;
    const colStatus = colX + tableW - 750;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('الجهة / الوصف', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('التاريخ', colDate, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الحالة', colStatus, y + 22);
    y += 32;

    let totalPrice = 0;
    [...pendingTrips].reverse().forEach((trip, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, rowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, rowH);

      totalPrice += trip.price || 0;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(trip.description, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(trip.date || '-', colDate, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = trip.price > 0 ? '#1a1a1a' : '#dc2626';
      ctx.fillText(trip.price > 0 ? `${formatNum(trip.price)} ج.م` : 'غير مسعر', colPrice, y + 24);
      ctx.fillStyle = '#f59e0b';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('معلق', colStatus, y + 24);
      y += rowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المشاوير المعلقة', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${formatNum(totalPrice)} ج.م`, colPrice, y + 24);
    y += summaryRowH + 15;

    // Bottom box
    roundRect(ctx, colX, y, tableW, 120, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص المشاوير المعلقة', colX + tableW / 2, y + 21);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد المشاوير: ${pendingTrips.length}`, colX + tableW - 20, y + 55);
    ctx.fillText(`إجمالي السعر: ${formatNum(totalPrice)} ج.م`, colX + tableW - 20, y + 78);

    y += 120 + 20;

    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    const link = document.createElement('a');
    link.download = `مشاوير_معلقة_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadPendingTripsPDF = () => {
    const pendingTrips = (trips || []).filter(t => !t.collected);
    if (pendingTrips.length === 0) { showToast('⚠️ لا توجد مشاوير معلقة!'); return; }

    const reversedTrips = [...pendingTrips].reverse();
    let totalPrice = 0;
    const rowsHtml = reversedTrips.map((trip, i) => {
      totalPrice += trip.price || 0;
      return `<tr>
        <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
        <td style="text-align:right">${trip.description}</td>
        <td style="text-align:center">${trip.date || '-'}</td>
        <td style="text-align:center;font-weight:bold;color:${trip.price > 0 ? '#1a1a1a' : '#dc2626'}">${trip.price > 0 ? formatNum(trip.price) + ' ج.م' : 'غير مسعر'}</td>
        <td style="text-align:center;color:#f59e0b;font-weight:bold">معلق</td>
      </tr>`;
    }).join('');

    const html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
      <div style="padding:12mm 14mm">
        <div class="rh">
          <h1>كشف المشاوير المعلقة (غير المحصلة)</h1>
          <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
          <div class="ref">
            <span>عدد المشاوير: ${pendingTrips.length}</span>
            <span>إجمالي السعر: ${formatNum(totalPrice)} ج.م</span>
          </div>
        </div>

        <table>
          <thead><tr><th width="40">م</th><th>الجهة / الوصف</th><th>التاريخ</th><th>السعر</th><th>الحالة</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="ts" style="padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:800;font-size:12px;margin-bottom:14px">
          <span>إجمالي المشاوير المعلقة</span>
          <span>${formatNum(totalPrice)} ج.م</span>
        </div>

        <div class="fs" style="margin-top:30px">
          <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
          <div class="sb2"><div class="ti">مندوب المبيعات</div><div class="ln">التوقيع</div></div>
        </div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400); }
  };

  // ── Professional trips archive exports (collected) ──
  const downloadCollectedTripsImage = () => {
    if (filteredArchiveTrips.length === 0) { showToast('⚠️ لا توجد مشاوير مسددة!'); return; }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const rowH = 38;
    const headerH = 110;
    const summaryRowH = 36;
    const footerH = 50;
    const totalH = headerH + 10 + 32 + filteredArchiveTrips.length * rowH + summaryRowH + 15 + 120 + footerH + 30;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('كشف المشاوير المسددة (المحصلة)', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`عدد المشاوير: ${filteredArchiveTrips.length} — جميعها مسددة`, W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);

    let y = 12 + headerH + 12;
    const colX = padX;

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 200;
    const colDate = colX + tableW - 420;
    const colPrice = colX + tableW - 580;
    const colStatus = colX + tableW - 750;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('الجهة / الوصف', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('التاريخ', colDate, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الحالة', colStatus, y + 22);
    y += 32;

    let totalPrice = 0;
    [...filteredArchiveTrips].reverse().forEach((trip, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, rowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, rowH);

      totalPrice += trip.price || 0;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(trip.description, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(trip.date || '-', colDate, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#059669';
      ctx.fillText(`${formatNum(trip.price)} ج.م`, colPrice, y + 24);
      ctx.fillStyle = '#059669';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('مسدد ✓', colStatus, y + 24);
      y += rowH;
    });

    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المشاوير المحصلة', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${formatNum(totalPrice)} ج.م`, colPrice, y + 24);
    y += summaryRowH + 15;

    roundRect(ctx, colX, y, tableW, 120, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص المشاوير المحصلة', colX + tableW / 2, y + 21);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد المشاوير: ${filteredArchiveTrips.length}`, colX + tableW - 20, y + 55);
    ctx.fillText(`إجمالي المحصل: ${formatNum(totalPrice)} ج.م`, colX + tableW - 20, y + 78);

    y += 120 + 20;

    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    const link = document.createElement('a');
    link.download = `مشاوير_مسددة_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadCollectedTripsPDF = () => {
    if (filteredArchiveTrips.length === 0) { showToast('⚠️ لا توجد مشاوير مسددة!'); return; }

    let totalPrice = 0;
    const rowsHtml = [...filteredArchiveTrips].reverse().map((trip, i) => {
      totalPrice += trip.price || 0;
      return `<tr>
        <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
        <td style="text-align:right">${trip.description}</td>
        <td style="text-align:center">${trip.date || '-'}</td>
        <td style="text-align:center;font-weight:bold;color:#059669">${formatNum(trip.price)} ج.م</td>
        <td style="text-align:center;color:#059669;font-weight:bold">مسدد ✓</td>
      </tr>`;
    }).join('');

    const html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
      <div style="padding:12mm 14mm">
        <div class="rh">
          <h1>كشف المشاوير المسددة (المحصلة)</h1>
          <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
          <div class="ref">
            <span>عدد المشاوير: ${filteredArchiveTrips.length}</span>
            <span>إجمالي المحصل: ${formatNum(totalPrice)} ج.م</span>
          </div>
        </div>

        <table>
          <thead><tr><th width="40">م</th><th>الجهة / الوصف</th><th>التاريخ</th><th>السعر</th><th>الحالة</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="ts" style="padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:800;font-size:12px;margin-bottom:14px">
          <span>إجمالي المشاوير المحصلة</span>
          <span>${formatNum(totalPrice)} ج.م</span>
        </div>

        <div class="fs" style="margin-top:30px">
          <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
          <div class="sb2"><div class="ti">مندوب المبيعات</div><div class="ln">التوقيع</div></div>
        </div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400); }
  };

  const getFilteredLoads = () => {
    const now = new Date();
    return factoryLoads.filter(load => {
      const loadDateObj = new Date(load.date);
      if (reportTimeframe === 'daily') {
        return loadDateObj.toDateString() === now.toDateString();
      }
      const diffTime = now.getTime() - loadDateObj.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (reportTimeframe === 'weekly') {
        return diffDays <= 7;
      } else if (reportTimeframe === 'monthly') {
        return diffDays <= 30;
      }
      return true;
    });
  };

  const exportPreviousLoadsToCanvas = (timeframe: 'daily' | 'weekly' | 'monthly') => {
    const list = getFilteredLoads();
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات مسجلة للتقرير في هذه الفترة!');
      return;
    }

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    // Build solid background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border Frame for a document look
    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);

    // Header block
    const headerGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    headerGrad.addColorStop(0, '#1e1b4b');
    headerGrad.addColorStop(0.5, '#312e81');
    headerGrad.addColorStop(1, '#4f46e5');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(14, 14, canvas.width - 28, 120);

    // Header texts
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('تقرير حركة شحن وتوزيع مبيعات المصنع', canvas.width - 45, 60);

    const timeframeLabel = timeframe === 'daily' ? 'يومي (اليوم الحالي)' : timeframe === 'weekly' ? 'أسبوعي (آخر 7 أيام)' : 'شهري (آخر 30 يوم)';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillStyle = '#e0e7ff';
    ctx.fillText(`فترة التقرير المالي والكمي للوكيل: ${timeframeLabel}`, canvas.width - 45, 95);

    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`, 45, 60);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('إدارة حركة مبيعات زيت وسمن سوفانا', 45, 90);

    // Draw Column Headers
    let y = 180;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(35, y - 25, canvas.width - 70, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('الصنف والحجم التاريخ', canvas.width - 55, y + 2);

    ctx.textAlign = 'center';
    ctx.fillText('العدد المسحوب', canvas.width - 325, y + 2);
    ctx.fillText('قيمة الشحنة', canvas.width - 465, y + 2);
    ctx.fillText('المباع بالسيارة', canvas.width - 605, y + 2);
    ctx.fillText('المتبقي بالسيارة', canvas.width - 725, y + 2);

    ctx.textAlign = 'left';
    ctx.fillText('الدفعة المسددة', 85, y + 2);

    y += 25;

    let grandTotalCartons = 0;
    let grandTotalValue = 0;
    let grandTotalSoldUnits = 0;
    let grandTotalAdvances = 0;

    list.forEach((load, idx) => {
      const prod = products.find(p => p.id === load.productId);
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => w.id === load.weightId) || weights[0];
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
      const totalLoadedValue = loadedCartons * cartonPrice;

      // Calculate total quantity sold for this specific product + weight variant in all client invoices
      let totalUnitsSold = 0;
      invoices.forEach(inv => {
        inv.items.forEach(item => {
          if (item.productId === load.productId && item.weightId === load.weightId) {
            totalUnitsSold += item.quantity;
          }
        });
      });

      // Summing totals
      grandTotalCartons += loadedCartons;
      grandTotalValue += totalLoadedValue;
      grandTotalSoldUnits += totalUnitsSold;
      grandTotalAdvances += load.advanceAmount || 0;

      const daysOfWeek = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const loadDateObj = new Date(load.date);
      const dayName = daysOfWeek[loadDateObj.getDay()];
      const dateStr = `${dayName} ${loadDateObj.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' })}`;

      // Row alternate background colors
      if (idx % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(35, y - 5, canvas.width - 70, 50);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(35, y - 5, canvas.width - 70, 50);
      }

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(35, y - 5, canvas.width - 70, 50);

      // Drawer columns text
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(prod ? prod.name : ((load as any).productName || 'صنف مجهول'), canvas.width - 55, y + 17);
      ctx.fillStyle = '#64748b';
      ctx.font = '500 10px system-ui, sans-serif';
      ctx.fillText(`${weight ? weight.size : ((load as any).weightSize || '')} • (${dateStr})`, canvas.width - 55, y + 34);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${loadedCartons} كرتونة`, canvas.width - 325, y + 25);
      
      ctx.fillStyle = '#4f46e5';
      ctx.fillText(`${totalLoadedValue.toFixed(2)}ج.م`, canvas.width - 465, y + 25);

      const cartonsSoldNum = Number((totalUnitsSold / (weight?.unitsPerCarton || 12)).toFixed(3));
      ctx.fillStyle = '#059669';
      ctx.fillText(`${cartonsSoldNum} كرتونة`, canvas.width - 605, y + 25);

      const remUnits = load.quantity - totalUnitsSold;
      const remCartons = Number((remUnits / (weight?.unitsPerCarton || 12)).toFixed(3));
      ctx.fillStyle = remUnits < 0 ? '#dc2626' : '#2563eb';
      ctx.fillText(`${remCartons} كرتونة`, canvas.width - 725, y + 25);

      ctx.fillStyle = '#b45309';
      ctx.textAlign = 'left';
      ctx.fillText(load.advanceAmount && load.advanceAmount > 0 ? `${load.advanceAmount.toFixed(2)}ج.م` : '0.00', 85, y + 25);

      y += 50;
    });

    // Summary block (Bottom calculations)
    y += 20;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(35, y - 10, canvas.width - 70, 85);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(35, y - 10, canvas.width - 70, 85);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('الملخص المالي الشامل للفترة المحددة في التقرير:', canvas.width - 55, y + 15);

    ctx.font = 'bold 12.5px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`إجمالي الشحن: ${grandTotalCartons} كرتونة بقيمة ${grandTotalValue.toFixed(2)}ج.م`, canvas.width - 55, y + 42);
    ctx.fillText(`إجمالي قيمة البضائع المحملة: ${grandTotalValue.toFixed(2)}ج.م`, canvas.width - 55, y + 63);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`المُسدد للمصنع: ${grandTotalAdvances.toFixed(2)}ج.م`, 85, y + 42);

    // Footer copyright lines
    y += 115;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, y - 15);
    ctx.lineTo(canvas.width - 35, y - 15);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تم التصدير تلقائياً من تطبيق تتبع الشحنات وحسابات المصنع • مراجعة حركة البيع والسداد للمصنع', canvas.width / 2, y - 2);

    // Trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.download = `تقرير_حركة_المصنع_${timeframe}_${new Date().toISOString().substring(0, 10)}.png`;
    downloadLink.href = dataUrl;
    downloadLink.click();
  };

  // ── Filtered loads image export (professional invoice style) ──
  const downloadFilteredLoadsImage = () => {
    if (filteredLoads.length === 0) { showToast('⚠️ لا توجد شحنات تحميل مسجلة!'); return; }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;

    const headerH = 110;
    const loadsTableH = 36 + filteredLoads.length * loadRowH + 36;
    const summaryRowH = 36;
    const bottomBoxH = 160;
    const footerH = 50;
    const totalH = headerH + 10 + loadsTableH + summaryRowH + 15 + bottomBoxH + footerH + 30;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('بيان شحنات المصنع', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    const filterLabel = archiveFilter === 'all' ? 'جميع الفترات' : archiveFilter === 'daily' ? 'يومي (اليوم الحالي)' : archiveFilter === 'weekly' ? 'أسبوعي (آخر 7 أيام)' : archiveFilter === 'monthly' ? 'شهري (آخر 30 يوم)' : 'مخصص';
    ctx.fillText(`الفترة: ${filterLabel}`, W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`عدد الشحنات: ${filteredLoads.length}`, 55, 92);

    let y = 12 + headerH + 12;

    // ── Loads Table: 7 columns ──
    const colX = padX;
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    const colSerial = colX + tableW - 30;
    const colDesc = colX + tableW - 135;
    const colLoaded = colX + tableW - 240;
    const colSold = colX + tableW - 345;
    const colRemaining = colX + tableW - 450;
    const colPrice = colX + tableW - 580;
    const colTotal = colX + tableW - 720;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('الصنف والحجم', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('المحمل', colLoaded, y + 22);
    ctx.fillText('المبيع', colSold, y + 22);
    ctx.fillText('المتبقي', colRemaining, y + 22);
    ctx.fillText('سعر الكرتونة', colPrice, y + 22);
    ctx.fillText('قيمة المبيع', colTotal, y + 22);
    y += 32;

    let totalLoadedCrates = 0;
    let totalSoldCrates = 0;
    let totalRemainingCrates = 0;
    let totalSoldValue = 0;
    let totalAdvanceAmounts = 0;

    filteredLoads.forEach((load, idx) => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);

      const key = `${load.productId}_${load.weightId || (weight ? weight.id : '')}`;
      const stock = weightStocks[key] || { loaded: 0, sold: 0, remaining: 0 };
      const soldCartons = Math.floor(stock.sold / unitsPerCarton);
      const remainingCartons = Math.max(0, cartons - soldCartons);
      const soldValueForLoad = soldCartons * cartonPrice;

      const prodName = prod ? prod.name : (load.productName || 'غير معروف');
      const weightSize = weight ? weight.size : (load as any).weightSize || '';

      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(`${prodName} (${weightSize})`, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(String(cartons), colLoaded, y + 24);
      ctx.fillStyle = '#16a34a';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(String(soldCartons), colSold, y + 24);
      ctx.fillStyle = remainingCartons > 0 ? '#DD6B20' : '#16a34a';
      ctx.fillText(String(remainingCartons), colRemaining, y + 24);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`${cartonPrice.toLocaleString('ar-EG')} ج.م`, colPrice, y + 24);
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(`${soldValueForLoad.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);

      totalLoadedCrates += cartons;
      totalSoldCrates += soldCartons;
      totalRemainingCrates += remainingCartons;
      totalSoldValue += soldValueForLoad;
      totalAdvanceAmounts += (load.advanceAmount || 0);
      y += loadRowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('المجموع', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(String(totalLoadedCrates), colLoaded, y + 24);
    ctx.fillText(String(totalSoldCrates), colSold, y + 24);
    ctx.fillText(String(totalRemainingCrates), colRemaining, y + 24);
    ctx.fillText(`${totalSoldValue.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);

    // Totals row
    y += summaryRowH;
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المستحق (المبيع بسعر المصنع)', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${totalSoldValue.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);
    y += summaryRowH + 15;

    // ── Bottom two boxes ──
    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;
    const leftBoxW = (tableW - boxGap) * 0.45;
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    // Right Box: ملخص الشحنات
    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص الشحنات', rightBoxX + rightBoxW / 2, y + 21);

    let infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد الشحنات: ${filteredLoads.length}`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي المحمل: ${totalLoadedCrates} كرتونة`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي المقدمات: ${totalAdvanceAmounts.toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#0d7c5f';
    ctx.fillText(`المتبقي: ${totalRemainingCrates} كرتونة`, rightBoxX + rightBoxW - 20, infoY);

    // Left Box: صافي المستحق
    const totalDirectPayments = filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
    const netDue = totalSoldValue - totalAdvanceAmounts - totalDirectPayments;

    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = netDue > 0 ? '#FFF5F5' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('صافي المستحق (المتبقي)', leftBoxX + leftBoxW / 2, y + 21);

    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = netDue > 0 ? '#dc2626' : netDue === 0 ? '#059669' : '#4f46e5';
    ctx.fillText(`${Math.abs(netDue).toLocaleString('ar-EG')} ج.م`, leftBoxX + leftBoxW / 2, y + 80);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(netDue > 0 ? 'يجب سداد المبلغ أعلاه' : netDue === 0 ? '*تم تسوية الحساب بالكامل*' : 'رصيد دائن لصالحنا (دفعات زائدة)', leftBoxX + leftBoxW / 2, y + 110);

    y += bottomBoxH + 20;

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    // Download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `بيان_شحنات_المصنع_${filterLabel}_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  };

  // ── Filtered loads PDF export (professional invoice style) ──
  const downloadFilteredLoadsPDF = () => {
    if (filteredLoads.length === 0) { showToast('⚠️ لا توجد شحنات تحميل مسجلة!'); return; }

    const filterLabel = archiveFilter === 'all' ? 'جميع الفترات' : archiveFilter === 'daily' ? 'يومي (اليوم الحالي)' : archiveFilter === 'weekly' ? 'أسبوعي (آخر 7 أيام)' : archiveFilter === 'monthly' ? 'شهري (آخر 30 يوم)' : 'مخصص';

    let totalLoadedCrates = 0;
    let totalSoldCrates = 0;
    let totalRemainingCrates = 0;
    let totalSoldValue = 0;
    let totalAdvanceAmounts = 0;

    const loadsRows = filteredLoads.map((load, i) => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);

      const key = `${load.productId}_${load.weightId || (weight ? weight.id : '')}`;
      const stock = weightStocks[key] || { loaded: 0, sold: 0, remaining: 0 };
      const soldCartons = Math.floor(stock.sold / unitsPerCarton);
      const remainingCartons = Math.max(0, cartons - soldCartons);
      const soldValueForLoad = soldCartons * cartonPrice;

      const prodName = prod ? prod.name : (load.productName || 'غير معروف');
      const weightSize = weight ? weight.size : (load as any).weightSize || '';
      totalLoadedCrates += cartons;
      totalSoldCrates += soldCartons;
      totalRemainingCrates += remainingCartons;
      totalSoldValue += soldValueForLoad;
      totalAdvanceAmounts += (load.advanceAmount || 0);
      return `<tr>
        <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
        <td style="text-align:right">${prodName} ${weightSize}</td>
        <td style="text-align:center">${cartons}</td>
        <td style="text-align:center;color:#16a34a;font-weight:bold">${soldCartons}</td>
        <td style="text-align:center;color:${remainingCartons > 0 ? '#DD6B20' : '#16a34a'};font-weight:bold">${remainingCartons}</td>
        <td style="text-align:center">${cartonPrice.toLocaleString('ar-EG')} ج.م</td>
        <td style="text-align:center;font-weight:bold">${soldValueForLoad.toLocaleString('ar-EG')} ج.م</td>
      </tr>`;
    }).join('');

    const totalDirectPayments = filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
    const netDue = totalSoldValue - totalAdvanceAmounts - totalDirectPayments;
    const netColor = netDue > 0 ? '#dc2626' : netDue === 0 ? '#059669' : '#4f46e5';
    const netText = netDue > 0 ? `${netDue.toLocaleString('ar-EG')} ج.م — يجب سداد المبلغ` : netDue === 0 ? '٠.٠٠ ج.م — *تم تسوية الحساب بالكامل*' : `${Math.abs(netDue).toLocaleString('ar-EG')} ج.م — رصيد دائن لصالحنا (دفعات زائدة)`;

    const html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
      <div style="padding:12mm 14mm">
        <div class="rh">
          <h1>بيان شحنات المصنع</h1>
          <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
          <div class="ref">
            <span>الفترة: ${filterLabel}</span>
            <span>عدد الشحنات: ${filteredLoads.length}</span>
          </div>
        </div>

        <table>
          <thead><tr>
            <th width="35">م</th>
            <th>الصنف والحجم</th>
            <th>المحمل (كرتونة)</th>
            <th>المبيع (كرتونة)</th>
            <th>المتبقي (كرتونة)</th>
            <th>سعر الكرتونة</th>
            <th>قيمة المبيع</th>
          </tr></thead>
          <tbody>
            ${loadsRows}
            <tr class="summary-row">
              <td colspan="2" style="text-align:center;border:none;padding:10px 6px">المجموع</td>
              <td style="text-align:center;border:none;padding:10px 6px">${totalLoadedCrates}</td>
              <td style="text-align:center;border:none;padding:10px 6px">${totalSoldCrates}</td>
              <td style="text-align:center;border:none;padding:10px 6px">${totalRemainingCrates}</td>
              <td style="border:none;padding:10px 6px"></td>
              <td style="text-align:center;border:none;padding:10px 6px">${totalSoldValue.toLocaleString('ar-EG')} ج.م</td>
            </tr>
          </tbody>
        </table>
        <div class="tt" style="padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:800;font-size:12px;margin-bottom:14px">
          <span>إجمالي المستحق (المبيع)</span>
          <span>${totalSoldValue.toLocaleString('ar-EG')} ج.م</span>
        </div>

        <div class="sg">
          <div class="sb bl">
            <div class="l">ملخص الشحنات</div>
            <div style="margin-top:8px">
              <div style="font-size:11px;margin:4px 0;display:flex;justify-content:space-between"><span>عدد الشحنات:</span><span style="font-weight:800">${filteredLoads.length}</span></div>
              <div style="font-size:11px;margin:4px 0;display:flex;justify-content:space-between"><span>إجمالي المحمل:</span><span style="font-weight:800">${totalLoadedCrates.toLocaleString('ar-EG')} كرتونة</span></div>
              <div style="font-size:11px;margin:4px 0;display:flex;justify-content:space-between"><span>إجمالي المبيع:</span><span style="font-weight:800;color:#059669">${totalSoldCrates.toLocaleString('ar-EG')} كرتونة</span></div>
              <div style="font-size:11px;margin:4px 0;display:flex;justify-content:space-between"><span>إجمالي المتبقي:</span><span style="font-weight:800;color:#DD6B20">${totalRemainingCrates.toLocaleString('ar-EG')} كرتونة</span></div>
              <div style="font-size:11px;margin:4px 0;display:flex;justify-content:space-between"><span>إجمالي المقدمات:</span><span style="font-weight:800">${totalAdvanceAmounts.toLocaleString('ar-EG')} ج.م</span></div>
            </div>
          </div>
          <div class="sb gr" style="display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div class="l">صافي المستحق (المتبقي)</div>
            <div style="font-size:28px;font-weight:900;margin:8px 0;color:${netColor}">${Math.abs(netDue).toLocaleString('ar-EG')} ج.م</div>
            <div style="font-size:11px;font-weight:700;color:${netColor}">${netDue > 0 ? 'يجب سداد المبلغ أعلاه' : netDue === 0 ? '*تم تسوية الحساب بالكامل*' : 'رصيد دائن لصالحنا'}</div>
          </div>
        </div>

        <div class="fs" style="margin-top:30px">
          <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
          <div class="sb2"><div class="ti">مندوب المبيعات</div><div class="ln">التوقيع</div></div>
        </div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    }
  };

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 text-right animate-fade-in" dir="rtl" id="factory-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-[60] shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-emerald-300" />
          <h1 className="text-xl font-bold">حمولة السيارة</h1>
        </div>
        <button
          onClick={onGoBack}
          className="bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 active:scale-95 text-white rounded-lg py-1.5 px-3.5 text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>الرئيسية</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="w-full max-w-xl mx-auto p-2 md:p-4 flex flex-col gap-4 bg-[#F7FAFC] min-h-screen">
        {/* Tab selector */}
        {(() => {
          const showLoads = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('loads');
          const showProducts = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('products');
          const showPreviousLoads = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('previous_loads');
          const showFactoryAccount = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('factory_account');
          const showTrips = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('trips');
          return (
            <div className="flex flex-wrap bg-[#FFFFFF] p-2 rounded-2xl border border-slate-200 gap-1 sm:gap-2 shadow-sm text-center">
              {showLoads && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('loads')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'loads'
                      ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm'
                      : 'text-[#9CA3AF] hover:bg-emerald-50 hover:text-[#DD6B20] select-none'
                  }`}
                >
                  الحمولة
                </button>
              )}
              {showProducts && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('products')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'products'
                      ? 'bg-sky-600 text-white shadow-md select-none'
                      : 'text-[#9CA3AF] hover:bg-sky-50 hover:text-sky-700 select-none'
                  }`}
                >
                  الأصناف
                </button>
              )}
              {showFactoryAccount && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('factory_account')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'factory_account'
                      ? 'bg-violet-600 text-white shadow-md select-none'
                      : 'text-[#9CA3AF] hover:bg-violet-50 hover:text-violet-700 select-none'
                  }`}
                >
                  الحساب
                </button>
              )}
              {showTrips && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('trips')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'trips'
                      ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm'
                      : 'text-[#9CA3AF] hover:bg-[#1A365D] hover:text-white hover:text-[#1A365D] select-none'
                  }`}
                >
                  المشاوير
                </button>
              )}
              {showPreviousLoads && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('previous_loads')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'previous_loads'
                      ? 'bg-amber-600 text-white shadow-md select-none'
                      : 'text-[#9CA3AF] hover:bg-amber-50 hover:text-amber-700 select-none'
                  }`}
                >
                  الأرشيف
                </button>
              )}
            </div>
          );
        })()}

        {/* 1. حمولة السيارة */}
        {activeSubTab === 'loads' && (
          <div className="flex flex-col gap-5">
            {/* Create Load Form as requested */}
            <form onSubmit={handleAddLoadSubmit} className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <h3 className="font-bold text-[#1A365D] text-base flex items-center gap-1.5">
                  <PackagePlus className="h-5 w-5 text-[#2B6CB0]" />
                  حمولة السيارة
                </h3>
                
                {/* Date & Time controls colocated adjacent to Title */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-400 bg-[#F7FAFC]/80 p-1 px-2 rounded-md shrink-0">تاريخ ووقت التحميل:</span>
                  <input
                    type="datetime-local"
                    required
                    value={loadDate}
                    onChange={(e) => setLoadDate(e.target.value)}
                    className="bg-indigo-50 border border-indigo-100 rounded-md p-1 px-2 text-[11px] font-mono text-[#1A365D] focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                <div>
                  <label className="inline-block bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">المنتج</label>
                  <select
                    required
                    value={loadProductId}
                    onChange={(e) => setLoadProductId(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#1A365D]"
                  >
                    <option value="">-- اختر الصنف من المصنع --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {isManager && (
                  <div>
                    <label className="inline-block bg-violet-100 text-violet-950 border border-violet-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">المندوب</label>
                    <select
                      value={loadDelegatePhone}
                      onChange={(e) => setLoadDelegatePhone(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#1A365D]"
                    >
                      <option value="">-- اختر المندوب المستلم --</option>
                      {archiveDelegates.filter(d => d.phone !== 'مجهول').map(d => (
                        <option key={d.phone} value={d.phone}>{d.name} ({d.phone})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Weights selection & input via dropdown as requested */}
                {loadProductId && (
                  <div className="bg-[#F7FAFC] p-4 rounded-xl border border-slate-150 flex flex-col gap-4">
                    <span className="text-xs font-black text-indigo-950 flex items-center gap-1 border-b border-indigo-100/50 pb-1.5">
                      <Scale className="h-4 w-4 text-[#2B6CB0]" />
                      المنتجات المحملة
                    </span>
                    
                    {activeWeights.length === 0 ? (
                      <p className="text-center text-gray-400 py-4 text-xs">لا توجد أوزان مضافة لهذا المنتج بعد. يرجى إضافتها في تبويب (المنتجات)</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {/* لوحة جرد السيارة الحية للصنف المختار */}
                        <div className="flex flex-col gap-2 mb-1 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                          <span className="text-[10px] font-bold text-indigo-800">📊 جرد السيارة الحالي لهذا الصنف:</span>
                          <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                            {activeWeights.map(w => {
                              const stock = weightStocks[`${activeProductObj?.id}_${w.id}`] || { loaded: 0, remaining: 0 };
                              const unitsPerC = w.unitsPerCarton || 12;
                              const loadedC = Math.floor(stock.loaded / unitsPerC);
                              const remC = Math.floor(stock.remaining / unitsPerC);
                              const remP = stock.remaining % unitsPerC;
                              const remText = remP > 0 ? `${remC}ك و ${remP}ع` : `${remC}ك`;
                              return (
                                <div key={w.id} className="bg-white border border-indigo-100/60 p-1.5 rounded-md flex flex-col shadow-xs">
                                  <span className="font-extrabold text-[#1A365D] mb-0.5">{w.size}</span>
                                  <div className="flex justify-between px-1 text-slate-500 font-bold">
                                    <span>مُحمل: <strong className="text-[#1A365D]">{loadedC}ك</strong></span>
                                    <span>متبقي: <strong className={stock.remaining > 0 ? 'text-emerald-600' : 'text-rose-600'}>{remText}</strong></span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {/* Dropdown for weight selection */}
                          <div>
                            <label className="inline-block bg-sky-100 text-sky-950 border border-sky-200 text-[11px] font-black px-2 py-0.5 rounded-md mb-1.5 shadow-sm">الوزن</label>
                            <select
                              value={selectedLoadWeightId}
                              onChange={(e) => setSelectedLoadWeightId(e.target.value)}
                              className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-indigo-500 text-[#1A365D] focus:outline-none shrink-0"
                            >
                              <option value="">-- اضغط للاختيار --</option>
                              {activeWeights.map(w => {
                                const stock = weightStocks[`${activeProductObj?.id}_${w.id}`] || { loaded: 0, remaining: 0 };
                                const remC = Math.floor(stock.remaining / (w.unitsPerCarton || 12));
                                const remP = stock.remaining % (w.unitsPerCarton || 12);
                                const remText = remP > 0 ? `${remC}ك و ${remP}ع` : `${remC}ك`;
                                return (
                                  <option key={w.id} value={w.id}>
                                    {w.size} (متبقي بالسيارة: {remText})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Input for loading quantity (Cartons count) */}
                          <div>
                            <label className="inline-block bg-amber-100 text-amber-950 border border-amber-200 text-[11px] font-black px-2 py-0.5 rounded-md mb-1.5 shadow-sm">
                              الكمية للحمولة ({activeProductObj?.accountingUnit || 'كرتونة'})
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="number"
                                min="1"
                                placeholder="مثال: 50"
                                value={loadQtyCartons}
                                onChange={(e) => setLoadQtyCartons(e.target.value)}
                                className="flex-1 bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold text-center text-[#1A365D] focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                              />
                              <button
                                type="button"
                                onClick={handleAddWeightQtyToDraft}
                                className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition-all active:scale-95 duration-75 text-center flex items-center justify-center shrink-0"
                              >
                                إضافة للحمولة
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* List items with the product name displayed ONLY ONCE and details below it */}
                        {groupedDraftItems.length > 0 && (
                          <div className="mt-2.5 bg-[#FFFFFF] border border-slate-200 rounded-xl p-3 shadow-inner flex flex-col gap-3">
                            <span className="block text-xs font-extrabold text-indigo-950 border-b border-slate-100 pb-1.5 flex items-center gap-1">
                              <span className="h-2 w-2 bg-indigo-500 rounded-full"></span>
                              بيان حمولة السيارة المؤقتة الحالية لتسجيل الدفعة:
                            </span>

                            <div className="flex flex-col gap-3">
                              {groupedDraftItems.map(group => (
                                <div key={group.product.id} className="border border-slate-150 rounded-xl p-2.5 bg-[#F7FAFC]/50 flex flex-col">
                                  {/* Product Name appears ONLY ONCE */}
                                  <span className="block text-xs font-black text-[#1A365D] bg-indigo-50 border border-indigo-100/50 py-1 px-2.5 rounded mb-1.5 self-start inline-block">
                                    {group.product.name}
                                  </span>

                                  <div className="flex flex-col gap-1.5">
                                    {group.items.map(item => (
                                      <div key={item.weight.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-[#FFFFFF] rounded-lg border border-slate-150/60">
                                        <div className="flex flex-col">
                                          <span className="font-bold text-slate-850 font-sans text-xs">{item.weight.size}</span>
                                          <span className="text-[10px] text-[#2B6CB0] mt-0.5 font-semibold">
                                            الكمية: {item.cartons} {group.product.accountingUnit || 'كرتونة'}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveWeightQtyFromDraft(item.weight.id)}
                                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer active:scale-90 transition-all shrink-0"
                                          title="حذف"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#2B6CB0] mb-1">أمين المخزن</label>
                    <input
                      type="text"
                      placeholder="اسم أمين المخزن المسؤول"
                      value={warehouseKeeper}
                      onChange={(e) => setWarehouseKeeper(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    {!showAdvanceInput ? (
                      <button
                        type="button"
                        onClick={() => setShowAdvanceInput(true)}
                        className="w-full bg-[#F7FAFC] hover:bg-[#F7FAFC] text-[#1A365D] hover:text-[#1A365D] border border-slate-200 rounded-lg p-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[42px] mt-auto"
                      >
                        <Plus className="h-4 w-4 text-indigo-550" />
                        <span>إضافة مقدم بضاعة للمصنع</span>
                      </button>
                    ) : (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-bold text-[#2B6CB0]">المقدم (ج.م)</label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAdvanceInput(false);
                              setAdvanceAmount('');
                            }}
                            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                          >
                            × إلغاء الخصم
                          </button>
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder="0.00"
                          value={advanceAmount}
                          onChange={(e) => setAdvanceAmount(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 font-bold font-mono text-[#1A365D]"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">ملاحظات</label>
                  <input
                    type="text"
                    placeholder="مثال: رقم لوحة السيارة أو ملاحظات عامة"
                    value={loadNotes}
                    onChange={(e) => setLoadNotes(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!loadProductId}
                className="w-full bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent disabled:bg-slate-300 text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Plus className="h-5 w-5" />
                <span>حفظ تحديد حمولة السيارة</span>
              </button>
            </form>

            {/* STATEMENT OF LOADS AS REQUESTED - QUANTITY ONLY */}
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5">
                  <FileText className="h-4.5 w-4.5 text-[#1A365D]" />
                  بيان الكميات المحملة بالسيارة
                </h3>
              </div>
              
              <div className="bg-[#F7FAFC] border border-slate-250/50 p-3 rounded-2xl flex flex-col gap-3">
                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[#2B6CB0]" />
                  فلترة وتحديد فترة عرض الحمولة
                </span>

                {archiveDelegates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-gray-500">المندوب:</label>
                    <select
                      value={liveLoadDelegateFilter}
                      onChange={(e) => setLiveLoadDelegateFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-[#1A365D] focus:outline-none flex-1"
                    >
                      <option value="all">الكل (جميع المناديب)</option>
                      {archiveDelegates.map(del => (
                  <option key={del.phone} value={del.phone}>{del.name} {del.phone !== 'مجهول' && del.phone !== del.name ? `(${del.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-5 bg-[#FFFFFF] border border-slate-205 p-1 rounded-xl text-center gap-1">
                  <button type="button" onClick={() => { setLiveLoadFilter('all'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'all' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>الكل</button>
                  <button type="button" onClick={() => { setLiveLoadFilter('daily'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'daily' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>يومي</button>
                  <button type="button" onClick={() => { setLiveLoadFilter('weekly'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'weekly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>أسبوعي</button>
                  <button type="button" onClick={() => { setLiveLoadFilter('monthly'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'monthly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>شهري</button>
                  <button type="button" onClick={() => { setLiveLoadFilter('custom'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'custom' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>مخصص</button>
                </div>

                {liveLoadFilter === 'weekly' && (
                  <div className="flex bg-[#FFFFFF] border border-slate-200 rounded-lg overflow-hidden flex-wrap gap-px p-0.5 animate-fade-in" dir="rtl">
                    <button onClick={() => setLiveLoadDayFilters([])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${liveLoadDayFilters.length === 0 ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>الكل</button>
                    {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                       const arabicDays: Record<string, string> = { 'Saturday':'السبت', 'Sunday':'الأحد', 'Monday':'الإثنين', 'Tuesday':'الثلاثاء', 'Wednesday':'الأربعاء', 'Thursday':'الخميس', 'Friday':'الجمعة' };
                       return (
                         <button key={day} onClick={() => setLiveLoadDayFilters(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${liveLoadDayFilters.includes(day) ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>{arabicDays[day]}</button>
                       )
                    })}
                  </div>
                )}

                {liveLoadFilter === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 animate-fade-in">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">من تاريخ</label>
                      <input type="date" value={liveLoadStartDate} onChange={(e) => setLiveLoadStartDate(e.target.value)} className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">إلى تاريخ</label>
                      <input type="date" value={liveLoadEndDate} onChange={(e) => setLiveLoadEndDate(e.target.value)} className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]" />
                    </div>
                  </div>
                )}
              </div>

              {filteredLiveLoads.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-xs">لا توجد تحميلات مسجلة تطابق الفلتر.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="max-h-64 overflow-y-auto custom-scroll border border-slate-100 rounded-xl p-2.5 bg-[#F7FAFC]/50 divide-y divide-slate-150 flex flex-col gap-2.5">
                    {filteredLiveLoads.map((load) => {
                      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                      const weights = prod ? getProductWeightsFallback(prod) : [];
                      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
                      const pName = prod ? prod.name : ((load as any).productName || 'الصنف مجهول');
                      const wSize = weight ? weight.size : ((load as any).weightSize || 'وزن غير مسجل');
                      const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                      const loadDateObj = new Date(load.date);
                      const formattedDateStr = loadDateObj.toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) + ` - ` + loadDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div key={load.id} className="pt-2 pb-2 mr-1 flex flex-col gap-1.5 first:pt-0 last:pb-0">
                          {/* Product details in one line */}
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-black text-[#1A365D] text-xs flex-1 leading-relaxed">
                              {pName} ({wSize})
                            </span>
                            <span className="text-xs text-[#DD6B20] font-extrabold shrink-0" dir="rtl">
                              {loadedCartons} {prod?.accountingUnit || 'كرتونة'}
                            </span>
                          </div>

                          {/* Extra info */}
                          <div className="flex justify-between items-center text-[10px]">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 font-bold font-mono">
                                {formattedDateStr}
                              </span>
                              {load.delegateName && (
                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold">
                          المندوب: {load.delegateName.replace(/ \(.*?\)/g, '').trim()} {load.delegatePhone ? `(${load.delegatePhone})` : ''}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteLoad(load.id);
                              }}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer active:scale-90 transition-all font-bold"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions Below the list */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadInvoiceImage}
                      disabled={filteredLiveLoads.length === 0}
                      className="w-full bg-indigo-50 text-[#1A365D] hover:bg-indigo-100 disabled:bg-[#F7FAFC] disabled:text-gray-400 py-3 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-indigo-200/50"
                    >
                      <Image className="h-4 w-4" />
                      <span>تنزيل بيان حمولة اليوم كصورة</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintCurrentLoads}
                      disabled={filteredLiveLoads.length === 0}
                      className="w-full bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:bg-[#F7FAFC] disabled:text-gray-400 py-3 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-rose-200/50"
                    >
                      <Printer className="h-4 w-4" />
                      <span>طباعة مستند الحمولة PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Print-Only Hidden Document Container for factoryLoads */}
            <div id="print-archive-view" className="hidden text-black bg-[#FFFFFF]">
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body * { visibility: hidden !important; }
                  #print-archive-view, #print-archive-view * { visibility: visible !important; }
                  #print-archive-view {
                    position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important;
                    display: block !important; background-color: white !important; color: black !important;
                    direction: rtl !important; padding: 25px !important; margin: 0 !important;
                    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
                  }
                  .no-print { display: none !important; }
                  @page { margin: 1cm; size: A4 portrait; }
                }
              `}} />
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-5">
                <h1 className="text-xl font-bold tracking-tight">شحنات المصنع الحالية</h1>
                <p className="text-xs mt-1 font-bold">للمسحوبات الحالية والدفعات المقدمة</p>
                <div className="flex justify-between text-[11px] mt-4 font-bold mx-auto">
                  <span>تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</span>
                </div>
              </div>

              {filteredLiveLoads.length === 0 ? (
                <p className="text-center py-5">لا توجد شحنات محملة حالياً.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  <table className="w-full text-right text-[11px] border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-[#F7FAFC] border-b border-slate-800">
                        <th className="border border-slate-800 p-2 font-bold text-center">#</th>
                        <th className="border border-slate-800 p-2 font-bold">التاريخ والوقت</th>
                        <th className="border border-slate-800 p-2 font-bold">اسم المنتج وتفاصيله</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الكمية المسحوبة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">سعر الكرتونة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">إجمالي القيمة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الدفعة المقدمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLiveLoads.map((load, index) => {
                        const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                        const weights = prod ? getProductWeightsFallback(prod) : [];
                        const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
                        const pName = prod ? prod.name : ((load as any).productName || 'صنف غير معرف');
                        const wSize = weight ? weight.size : ((load as any).weightSize || 'وزن مجهول');
                        const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
                        const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                        const totalLoadedValue = loadedCartons * cartonPrice;

                        const loadDateObj = new Date(load.date);
                        const formattedDateStr = loadDateObj.toLocaleDateString('ar-EG') + ` • ` + loadDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <tr key={'print_load_' + load.id} className="border-b border-slate-600">
                            <td className="border border-slate-800 p-1.5 text-center">{index + 1}</td>
                            <td className="border border-slate-800 p-1.5">{formattedDateStr}</td>
                            <td className="border border-slate-800 p-1.5 font-bold">
                              <div>{pName} - ({wSize})</div>
                        <div className="text-gray-500 font-normal mt-0.5 text-[10px]">المندوب: {load.delegateName?.replace(/ \(.*?\)/g, '').trim() || 'مجهول'} {load.delegatePhone ? `(${load.delegatePhone})` : ''}</div>
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold" dir="rtl">
                              {loadedCartons} كرتونة
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center">{formatNum(cartonPrice)}ج.م</td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">{formatNum(totalLoadedValue)}ج.م</td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">
                              {load.advanceAmount && load.advanceAmount > 0 ? `${formatNum(load.advanceAmount)}ج.م` : '0'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Cumulative financial block */}
                  <div className="border border-slate-800 p-3 rounded mt-3 text-[11.5px] font-bold bg-[#F7FAFC] flex flex-col gap-2 w-full ml-auto">
                    <div className="flex justify-between">
                      <span>إجمالي عدد شحنات السحب:</span>
                      <span>{filteredLiveLoads.length} شحنة تحميل</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1">
                      <span>إجمالي قيم البضائع المسحوبة من المصنع الحالية:</span>
                      <span className="text-md">
                        {formatNum(filteredLiveLoadsSummary.grandFactoryCost)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-emerald-800">
                      <span>إجمالي الدفعات المقدمة والمباشرة:</span>
                      <span>
                        {formatNum(filteredLiveLoads.reduce((s, l) => s + (l.advanceAmount || 0), 0))}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-rose-800 text-sm">
                      <span>المتبقي للمصنع (المدين الباقي):</span>
                      <span>
                        {formatNum(filteredLiveLoadsSummary.grandFactoryCost - filteredLiveLoads.reduce((s, l) => s + (l.advanceAmount || 0), 0))}ج.م
                      </span>
                    </div>
                  </div>

                  {/* Legal Signatures slot */}
                  <div className="grid grid-cols-3 gap-4 text-center text-[10.5px] font-bold mt-12 pt-5 border-t border-dashed border-slate-400">
                    <div className="flex flex-col gap-8">
                      <span>توقيع أمين مستودع المصنع</span>
                      <span className="text-gray-400">.................................</span>
                    </div>
                    <div className="flex flex-col gap-8">
                      <span>توقيع السائق (المستلم)</span>
                      <span className="text-gray-400">.................................</span>
                    </div>
                    <div className="flex flex-col gap-8">
                      <span>الإدارة المـالية</span>
                      <span className="text-gray-400">.................................</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. سجل الشحنات السابقة */}
        {activeSubTab === 'previous_loads' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex bg-slate-200 p-1.5 rounded-xl border border-slate-300 shadow-inner gap-1 mb-2">
                <button
                  type="button"
                  onClick={() => setArchiveSection('factory')}
                  className={`flex-1 text-center py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                    archiveSection === 'factory' ? 'bg-amber-600 text-white shadow-md' : 'text-[#9CA3AF] hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>أرشيف المصنع</span>
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveSection('trips')}
                  className={`flex-1 text-center py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                    archiveSection === 'trips' ? 'bg-amber-600 text-white shadow-md' : 'text-[#9CA3AF] hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  <span>المشاوير المسددة</span>
                </button>
              </div>

              {/* Timeframe Filters Section */}
              <div className="bg-[#F7FAFC] border border-slate-250/50 p-3 rounded-2xl flex flex-col gap-3">
                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[#2B6CB0]" />
                  فلترة وتحديد فترة الأرشيف للتصفح والطباعة
                </span>

                {archiveDelegates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-gray-500">المندوب:</label>
                    <select
                      value={archiveDelegateFilter}
                      onChange={(e) => setArchiveDelegateFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-[#1A365D] focus:outline-none flex-1"
                    >
                      <option value="all">الكل (جميع المناديب)</option>
                      {archiveDelegates.map(del => (
                  <option key={del.phone} value={del.phone}>{del.name} {del.phone !== 'مجهول' && del.phone !== del.name ? `(${del.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Archived cycles from localStorage (settled zero-balance snapshots) */}
              {archiveSection === 'factory' && archiveCycles.length > 0 && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <span className="text-xs font-black text-indigo-800 flex items-center gap-1.5 border-b border-indigo-100 pb-2">
                    <Archive className="h-4 w-4 text-indigo-500" />
                    الدورات المؤرشفة ({archiveCycles.length} دورة)
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 block">بيانات التحميل والبيع</span>
                  {archiveCycles.length > 1 && (
                    <div className="flex gap-2 w-full">
                      <button
                        type="button"
                        onClick={downloadAllArchivedCyclesPDF}
                        className="flex-1 bg-[#1A365D] hover:bg-[#2B6CB0] text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        <span>تنزيل كل الدورات المؤرشفة (PDF)</span>
                      </button>
                      <button
                        type="button"
                        onClick={downloadAllArchivedCyclesImage}
                        className="flex-1 bg-[#DD6B20] hover:bg-[#C05621] text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        <span>تنزيل صورة كل الدورات المؤرشفة</span>
                      </button>
                    </div>
                  )}
                  {archiveFilter !== 'all' && (
                    <div className="flex gap-2 w-full">
                      <button
                        type="button"
                        onClick={downloadFilteredArchivePDF}
                        className="flex-1 bg-indigo-700 hover:bg-indigo-800 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        <span>تنزيل الدورات المفلترة (PDF)</span>
                      </button>
                      <button
                        type="button"
                        onClick={downloadFilteredArchiveImage}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        <Image className="h-4 w-4" />
                        <span>تنزيل صورة الدورات المفلترة</span>
                      </button>
                    </div>
                  )}
                  {archiveCycles.map((cycle, cycleIdx) => (
                    <details key={cycle.id} className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                      <summary className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-indigo-100/50 transition-colors select-none">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black ml-1">دورة {archiveCycles.length - cycleIdx}</span>
                          <span className="text-indigo-900">{cycle.settledAt}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-slate-600">{cycle.loads?.length || 0} حمولة</span>
                          <span className="text-slate-600">{cycle.payments?.length || 0} دفعة</span>
                          {cycle.creditBalance > 0 && <span className="text-amber-600 font-extrabold">رصيد دائن: {formatNum(cycle.creditBalance)} ج.م</span>}
                          {(cycle as any).waivedAmount > 0 && <span className="text-rose-600 font-extrabold">مبلغ مسموح: {formatNum((cycle as any).waivedAmount)} ج.م</span>}
                        </div>
                      </summary>
                      <div className="px-4 pb-4 pt-2 border-t border-indigo-100 flex flex-col gap-3">
                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => downloadArchivedCyclePDF(cycle)}
                            className="bg-[#1A365D] hover:bg-[#2B6CB0] text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Printer className="h-3 w-3" /> PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadArchivedCycleImage(cycle)}
                            className="bg-[#DD6B20] hover:bg-[#C05621] text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Image className="h-3 w-3" /> صورة
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingCycle(cycle); setEditData(JSON.parse(JSON.stringify(cycle))); }}
                            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" /> تعديل
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const confirmed = await confirmDialog(`هل تريد رجوع الدورة رقم ${archiveCycles.length - cycleIdx} للدورة الحالية؟\n⚠️ سيتم حذف هذه الدورة من الأرشيف. الحمولات والدفعات ستظهر مجدداً في الحساب.`);
                              if (confirmed) {
                                setArchiveCycles(prev => prev.filter(c => c.id !== cycle.id));
                                showToast('✓ تم رجوع الدورة من الأرشيف! الحمولات والدفعات ستظهر في الحساب.');
                              }
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <RefreshCw className="h-3 w-3" /> رجوع
                          </button>
                        </div>
                        {/* Loads in this cycle */}
                        {cycle.loads && cycle.loads.length > 0 && (
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-500 block mb-2">📦 الحمولات</span>
                            <div className="max-h-40 overflow-y-auto custom-scroll border border-slate-200 rounded-lg">
                              <table className="w-full text-[10px] font-bold">
                                <thead className="bg-slate-100 sticky top-0">
                                  <tr>
                                    <th className="p-1.5 text-center w-8">م</th>
                                    <th className="p-1.5 text-right">الصنف</th>
                                    <th className="p-1.5 text-center">الكمية</th>
                                    <th className="p-1.5 text-center">السعر</th>
                                    <th className="p-1.5 text-center">القيمة</th>
                                    <th className="p-1.5 text-center">المقدم</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cycle.loads.map((load: any, i: number) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                      <td className="p-1.5 text-center text-slate-400">{i + 1}</td>
                                      <td className="p-1.5 text-right">{load.productName} ({load.weightSize})</td>
                                      <td className="p-1.5 text-center">{load.cartons} كرتونة{load.loose > 0 ? ` + ${load.loose} وحدة` : ''}</td>
                                      <td className="p-1.5 text-center">{formatNum(load.cartonPrice)} ج.م</td>
                                      <td className="p-1.5 text-center font-extrabold">{formatNum(load.subtotal)} ج.م</td>
                                      <td className="p-1.5 text-center text-amber-700">{formatNum(load.advanceAmount)} ج.م</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {/* Payments in this cycle */}
                        {cycle.payments && cycle.payments.length > 0 && (
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-500 block mb-2">💳 الدفعات المباشرة</span>
                            <div className="max-h-32 overflow-y-auto custom-scroll border border-slate-200 rounded-lg">
                              <table className="w-full text-[10px] font-bold">
                                <thead className="bg-slate-100 sticky top-0">
                                  <tr>
                                    <th className="p-1.5 text-center w-8">م</th>
                                    <th className="p-1.5 text-right">البيان</th>
                                    <th className="p-1.5 text-center">المبلغ</th>
                                    <th className="p-1.5 text-center">المندوب</th>
                                    <th className="p-1.5 text-center">المستلم</th>
                                    <th className="p-1.5 text-center w-10">تعديل</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cycle.payments.map((pay: any, i: number) => (
                                    <tr key={pay.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                      <td className="p-1.5 text-center text-slate-400">{i + 1}</td>
                                      <td className="p-1.5 text-right">{pay.notes || 'تسديد مباشر'}</td>
                                      <td className="p-1.5 text-center font-extrabold text-emerald-700">{formatNum(pay.amount)} ج.م</td>
                                      <td className="p-1.5 text-center">{pay.delegateName || '-'}</td>
                                      <td className="p-1.5 text-center">{pay.recipient ? `السيد / ${pay.recipient}` : '-'}</td>
                                      <td className="p-1.5 text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newAmount = prompt('تعديل مبلغ السداد:', pay.amount);
                                            if (newAmount === null) return;
                                            const parsed = parseFloat(newAmount);
                                            if (isNaN(parsed) || parsed < 0) { showToast('⚠️ مبلغ غير صحيح!'); return; }
                                            const newNotes = prompt('تعديل البيان:', pay.notes || '') || pay.notes;
                                            const newRecipient = prompt('تعديل المستلم:', pay.recipient || '') || pay.recipient;
                                            setArchiveCycles(prev => prev.map(c => {
                                              if (c.id !== cycle.id) return c;
                                              const updatedPayments = [...(c.payments || [])];
                                              updatedPayments[i] = { ...updatedPayments[i], amount: parsed, notes: newNotes, recipient: newRecipient };
                                              const totalPayments = updatedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
                                              return { ...c, payments: updatedPayments, totalAdvancePayments: totalPayments };
                                            }));
                                            showToast('✓ تم تعديل الدفعة في الدورة المؤرشفة!');
                                          }}
                                          className="text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 p-1 rounded border border-slate-200 cursor-pointer transition-all active:scale-95"
                                          title="تعديل هذه الدفعة"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {/* Cycle summary */}
                        <div className="bg-indigo-100/50 rounded-lg p-3 flex flex-col gap-2 text-xs font-bold">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">قيمة المحمل من المصنع: {formatNum(cycle.rawLoadedValue || cycle.loads?.reduce?.((s: number, l: any) => s + l.subtotal, 0) || 0)} ج.م</span>
                            <span className="text-emerald-700">مسدد: {formatNum(cycle.totalAdvancePayments)} ج.م</span>
                          </div>
                          <div className="flex items-center justify-between">
                            {cycle.creditBalance > 0 ? (
                              <span className="text-amber-600">رصيد دائن منقول للدورة التالية: {formatNum(cycle.creditBalance)} ج.م</span>
                            ) : (cycle as any).waivedAmount > 0 ? (
                              <span className="text-rose-600">مبلغ مسموح به (أسقط من المديونية): {formatNum((cycle as any).waivedAmount)} ج.م</span>
                            ) : (
                              <span className="text-green-700">✅ تم التسوية بالكامل</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}

              {archiveSection === 'factory' && (
                <>
                {filteredLoads.length > 0 && (
                  <div className="flex gap-2 w-full mt-1 mb-3">
                    <button
                      type="button"
                      onClick={downloadFilteredLoadsPDF}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      <Printer className="h-4 w-4" />
                      <span>تنزيل بيان المبيعات والتحميل المعتمد (PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadFilteredLoadsImage}
                      className="flex-1 text-xs bg-[#FFFFFF] hover:bg-slate-50 text-[#1A365D] py-2 rounded-xl border border-slate-200 cursor-pointer font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="h-4 w-4 text-indigo-600" /> تنزيل صورة الفاتورة المعتمدة
                    </button>
                  </div>
                )}

              {/* Records Loop */}
              <div className="flex flex-col gap-4">
                {filteredLoads.length === 0 ? (
                  <div className="text-center py-10 bg-[#F7FAFC] rounded-2xl border border-dashed border-slate-200">
                    <p className="text-sm text-gray-400 font-bold">لا توجد شحنات تحميل سابقة مطابقة لهذه الفترة.</p>
                    <p className="text-xs text-gray-400 mt-1">جرب تغيير محدد الفترة أو تسجيل شحنات جديدة.</p>
                  </div>
                ) : (
                  groupedLoadsByDate.map(([dateKey, loadsForDay]) => {
                    const daysOfWeek = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
                    const dateObj = new Date(dateKey + 'T12:00:00');
                    const dayName = daysOfWeek[dateObj.getDay()];
                    const formattedDate = dateObj.toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });

                    const dayTotalValue = loadsForDay.reduce((sum, load) => {
                      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                      const weights = prod ? getProductWeightsFallback(prod) : [];
                      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
                      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || 0);
                      const loadedCartons = load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12));
                      return sum + (loadedCartons * cartonPrice);
                    }, 0);
                    
                    const dayTotalAdvance = loadsForDay.reduce((sum, load) => sum + (load.advanceAmount || 0), 0);

                    return (
                      <details
                        key={'archive_day_' + dateKey}
                        open={openArchiveDay === dateKey}
                        className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all"
                      >
                        <summary
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenArchiveDay(openArchiveDay === dateKey ? null : dateKey);
                          }}
                          className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/60 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2 text-xs font-black text-indigo-950">
                            <Clock className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span>شحنة يوم {dayName} — {formattedDate}</span>
                            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{loadsForDay.length} أصناف</span>
                          </div>
                          <div className="flex items-center gap-4 text-[10.5px] font-bold">
                            <span className="text-[#1A365D]">إجمالي: {formatNum(dayTotalValue)} ج.م</span>
                            <span className="text-emerald-700">المقدم: {formatNum(dayTotalAdvance)} ج.م</span>
                          </div>
                        </summary>
                        <div className="px-4 pb-4 pt-2 border-t border-slate-150/65 flex flex-col gap-3 bg-white">
                          <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-[10px] font-bold text-slate-800">
                              <thead className="bg-slate-100 sticky top-0 text-slate-600">
                                <tr>
                                  <th className="p-2 text-right">الصنف</th>
                                  <th className="p-2 text-center">الكمية</th>
                                  <th className="p-2 text-center">سعر الكرتونة</th>
                                  <th className="p-2 text-center">القيمة الإجمالية</th>
                                  <th className="p-2 text-center">المقدم المدفوع</th>
                                  <th className="p-2 text-center w-8">إجراء</th>
                                </tr>
                              </thead>
                              <tbody>
                                {loadsForDay.map((load, i) => {
                                  const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                                  const weights = prod ? getProductWeightsFallback(prod) : [];
                                  const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
                                  const pName = prod ? prod.name : ((load as any).productName || 'صنف مجهول');
                                  const wSize = weight ? weight.size : ((load as any).weightSize || 'حجم مبدئي');
                                  const accountingUnitLabel = prod?.accountingUnit || 'كرتونة';

                                  const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || 0);
                                  const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                                  const totalLoadedValue = loadedCartons * cartonPrice;

                                  return (
                                    <tr key={load.id || i} className="border-t border-slate-100 hover:bg-slate-50/50">
                                      <td className="p-2 text-right text-[#1A365D]">
                                        <div>{pName}</div>
                                        <div className="text-[9px] text-[#2B6CB0] font-medium">الوزن / الحجم: {wSize}</div>
                                      </td>
                                      <td className="p-2 text-center">{loadedCartons} {accountingUnitLabel}</td>
                                      <td className="p-2 text-center">{formatNum(cartonPrice)} ج.م</td>
                                      <td className="p-2 text-center font-extrabold text-indigo-950">{formatNum(totalLoadedValue)} ج.م</td>
                                      <td className="p-2 text-center text-emerald-700">{formatNum(load.advanceAmount || 0)} ج.م</td>
                                      <td className="p-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => onDeleteLoad(load.id)}
                                          title="حذف الشحنة"
                                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>
                    );
                  })
                )}

                {filteredArchiveExtraPayments.length > 0 && (
                  <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <span className="text-xs font-black text-[#1A365D] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <History className="h-4 w-4 text-emerald-500" />
                      أرشيف الدفعات النقدية والمسددات المباشرة للمورد
                    </span>
                    <div className="grid grid-cols-5 bg-[#F7FAFC] border border-slate-200 p-1 rounded-xl text-center gap-1">
                      <button type="button" onClick={() => { setArchiveFilter('all'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'all' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>الكل</button>
                      <button type="button" onClick={() => { setArchiveFilter('daily'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'daily' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>يومي</button>
                      <button type="button" onClick={() => { setArchiveFilter('weekly'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'weekly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>أسبوعي</button>
                      <button type="button" onClick={() => { setArchiveFilter('monthly'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'monthly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>شهري</button>
                      <button type="button" onClick={() => { setArchiveFilter('custom'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'custom' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>مخصص</button>
                    </div>
                    {archiveFilter === 'weekly' && (
                      <div className="flex bg-[#F7FAFC] border border-slate-200 rounded-lg overflow-hidden flex-wrap gap-px p-0.5 animate-fade-in" dir="rtl">
                        <button onClick={() => setArchiveDayFilters([])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${archiveDayFilters.length === 0 ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>الكل</button>
                        {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                           const arabicDays: Record<string, string> = { 'Saturday':'السبت', 'Sunday':'الأحد', 'Monday':'الإثنين', 'Tuesday':'الثلاثاء', 'Wednesday':'الأربعاء', 'Thursday':'الخميس', 'Friday':'الجمعة' };
                           return (
                             <button key={day} onClick={() => setArchiveDayFilters(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${archiveDayFilters.includes(day) ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>{arabicDays[day]}</button>
                           )
                        })}
                      </div>
                    )}
                    {archiveFilter === 'custom' && (
                      <div className="grid grid-cols-2 gap-2 animate-fade-in">
                        <div><label className="block text-[10px] text-gray-400 font-bold mb-0.5">من تاريخ</label><input type="date" value={archiveStartDate} onChange={(e) => setArchiveStartDate(e.target.value)} className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]" /></div>
                        <div><label className="block text-[10px] text-gray-400 font-bold mb-0.5">إلى تاريخ</label><input type="date" value={archiveEndDate} onChange={(e) => setArchiveEndDate(e.target.value)} className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]" /></div>
                      </div>
                    )}
                    {archiveFilter !== 'all' && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => {
                          const filterLabel = archiveFilter === 'daily' ? 'يومي' : archiveFilter === 'weekly' ? 'أسبوعي' : archiveFilter === 'monthly' ? 'شهري' : 'مخصص';
                          const total = filteredArchiveExtraPayments.reduce((s, p) => s + p.amount, 0);
                          let html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
                          <div style="padding:12mm 14mm">
                            <div class="rh">
                              <h1>سجل الدفعات المؤرشفة — فلتر: ${filterLabel}</h1>
                              <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
                              <div class="ref">
                                <span>عدد الدفعات: ${filteredArchiveExtraPayments.length}</span>
                                <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</span>
                              </div>
                            </div>
                            <table><thead><tr><th>م</th><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>المندوب</th><th>المستلم</th></tr></thead><tbody>
                            ${filteredArchiveExtraPayments.map((p, i) => `<tr><td style="text-align:center">${i + 1}</td><td style="text-align:center">${p.date}</td><td style="text-align:right">${p.notes || 'تسديد مباشر'}</td><td style="text-align:center;font-weight:bold;color:#059669">${formatNum(p.amount)} ج.م</td><td style="text-align:center">${p.delegateName || '-'}</td><td style="text-align:center">${p.recipient || '-'}</td></tr>`).join('')}
                            </tbody></table>
                            <div class="ts" style="padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:800;font-size:12px;margin-bottom:14px">
                              <span>إجمالي الدفعات</span>
                              <span>${formatNum(total)} ج.م</span>
                            </div>
                            <div class="fs" style="margin-top:30px">
                              <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
                              <div class="sb2"><div class="ti">مندوب المبيعات</div><div class="ln">التوقيع</div></div>
                            </div>
                          </div>
                          </body></html>`;
                          const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
                        }} className="flex-1 bg-indigo-700 hover:bg-indigo-800 text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"><Printer className="h-3 w-3" /> PDF</button>
                        <button type="button" onClick={() => {
                          const filterLabel = archiveFilter === 'daily' ? 'يومي' : archiveFilter === 'weekly' ? 'أسبوعي' : archiveFilter === 'monthly' ? 'شهري' : 'مخصص';
                          const total = filteredArchiveExtraPayments.reduce((s, p) => s + p.amount, 0);
                          const W = 700; const padX = 20; const rowH = 32; const headerH = 80; const footerH = 40;
                          const totalH = headerH + 10 + filteredArchiveExtraPayments.length * rowH + 50 + footerH + 20;
                          const canvas = document.createElement('canvas'); const dpr = window.devicePixelRatio || 1;
                          canvas.width = W * dpr; canvas.height = totalH * dpr; canvas.style.width = W + 'px'; canvas.style.height = totalH + 'px';
                          const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(dpr, dpr);
                          ctx.fillStyle = '#faf8f5'; ctx.fillRect(0, 0, W, totalH); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, W - 12, totalH - 12);
                          ctx.fillStyle = '#1e2a4a'; ctx.fillRect(10, 10, W - 20, headerH); ctx.fillStyle = '#d4a843'; ctx.fillRect(10, 10 + headerH - 3, W - 20, 3);
                          ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 18px system-ui, sans-serif';
                          ctx.fillText(`سجل الدفعات المؤرشفة — فلتر: ${filterLabel}`, W / 2, 40);
                          ctx.font = '500 11px system-ui, sans-serif'; ctx.fillStyle = '#93c5fd';
                          ctx.fillText(`${filteredArchiveExtraPayments.length} دفعة | إجمالي: ${formatNum(total)} ج.م`, W / 2, 58);
                          ctx.font = '10px system-ui, sans-serif'; ctx.fillStyle = '#cbd5e1';
                          ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}`, W / 2, 72);
                          let y = headerH + 15;
                          ctx.fillStyle = '#1e2a4a'; ctx.fillRect(padX, y, W - padX * 2, 20); ctx.fillStyle = '#ffffff';
                          ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
                          const cols = [padX + 20, padX + 100, padX + 250, padX + 370, padX + 470, padX + 560];
                          ['م', 'التاريخ', 'البيان', 'المبلغ', 'المندوب', 'المستلم'].forEach((h, i) => { ctx.fillText(h, cols[i] + 40, y + 14); });
                          y += 22;
                          filteredArchiveExtraPayments.forEach((p, i) => {
                            ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
                            ctx.fillRect(padX, y, W - padX * 2, rowH); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5; ctx.strokeRect(padX, y, W - padX * 2, rowH);
                            ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.font = '10px system-ui, sans-serif';
                            ctx.fillText(String(i + 1), cols[0] + 40, y + 20); ctx.fillText(p.date || '', cols[1] + 40, y + 20);
                            ctx.textAlign = 'right'; ctx.fillText(p.notes || 'تسديد مباشر', cols[2] + 80, y + 20);
                            ctx.fillStyle = '#059669'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
                            ctx.fillText(`${formatNum(p.amount)} ج.م`, cols[3] + 40, y + 20);
                            ctx.fillStyle = '#1a1a1a'; ctx.font = '10px system-ui, sans-serif';
                            ctx.fillText(p.delegateName || '-', cols[4] + 40, y + 20); ctx.fillText(p.recipient || '-', cols[5] + 40, y + 20);
                            y += rowH;
                          });
                          y += 5; ctx.fillStyle = '#1e2a4a'; ctx.fillRect(padX, y, W - padX * 2, 30); ctx.fillStyle = '#ffffff';
                          ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
                          ctx.fillText(`إجمالي الدفعات: ${formatNum(total)} ج.م`, W / 2, y + 20);
                          y += 40; ctx.fillStyle = '#94a3b8'; ctx.font = '10px system-ui, sans-serif';
                          ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);
                          const link = document.createElement('a'); link.download = `دفعات_مؤرشفة_${filterLabel}_${new Date().toISOString().substring(0, 10)}.png`;
                          link.href = canvas.toDataURL('image/png'); link.click();
                        }} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"><Image className="h-3 w-3" /> صورة</button>
                      </div>
                    )}
                    <div className="max-h-40 overflow-y-auto custom-scroll flex flex-col gap-2">
                      {filteredArchiveExtraPayments.map(pay => (
                        <div key={pay.id} className="bg-[#F7FAFC] border border-slate-100 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-[#1A365D] shadow-inner">
                          {editingPaymentId === pay.id ? (
                            <div className="flex flex-col gap-2 w-full p-2 bg-indigo-50/40 rounded-lg border border-indigo-100 animate-fade-in text-right">
                              <div className="flex gap-2">
                                <div className="w-1/3 flex flex-col gap-1">
                                  <label className="text-[9px] text-slate-500 font-bold">مبلغ السداد:</label>
                                  <input type="number" placeholder="المبلغ" value={editingPaymentAmount} onChange={(e) => setEditingPaymentAmount(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500" />
                                </div>
                                <div className="w-2/3 flex flex-col gap-1">
                                  <label className="text-[9px] text-slate-500 font-bold">البيان / ملاحظات:</label>
                                  <input type="text" placeholder="البيان" value={editingPaymentNotes} onChange={(e) => setEditingPaymentNotes(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500" />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end mt-1">
                                <button type="button" onClick={() => setEditingPaymentId(null)} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold cursor-pointer transition-all active:scale-95">إلغاء</button>
                                <button type="button" onClick={() => {
                                  const newAmount = parseFloat(editingPaymentAmount);
                                  if (!newAmount || newAmount <= 0) { showToast("⚠️ يرجى إدخال قيمة صحيحة!"); return; }
                                  const oldAmount = pay.amount;
                                  const diff = newAmount - oldAmount;
                                  setArchiveCycles(prev => prev.map(c => {
                                    if (c.id !== cycle.id) return c;
                                    const updatedPayments = (c.payments || []).map((p: any) => p.id === pay.id ? { ...p, amount: newAmount, notes: editingPaymentNotes || p.notes } : p);
                                    const totalPayments = updatedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
                                    return { ...c, payments: updatedPayments, totalAdvancePayments: totalPayments };
                                  }));
                                  setEditingPaymentId(null);
                                  showToast(diff > 0 ? `✓ تم تعديل الدفعة. المصنع مدين بـ ${formatNum(diff)} ج.م إضافية` : diff < 0 ? `✓ تم تعديل الدفعة. تم خصم ${formatNum(Math.abs(diff))} ج.م من المصنع` : '✓ تم تعديل الدفعة!');
                                }} className="px-3 py-1 rounded bg-[#DD6B20] hover:bg-[#C05621] text-white text-[10px] font-bold cursor-pointer transition-all active:scale-95">حفظ</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[#DD6B20] font-extrabold">{Number(pay.amount).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                                <span className="text-[10px] text-[#2B6CB0] font-medium">{pay.date}</span>
                                <span className="text-[9.5px] text-slate-600 leading-relaxed">📝 {pay.notes || 'تسديد مباشر'}{pay.delegateName ? ` • 👤 ${pay.delegateName}` : ''}</span>
                                {pay.recipient ? <span className="text-[9px] text-indigo-600">👤 مستلم: السيد / {pay.recipient}</span> : null}
                                {(pay.appliedToCarriedDebt || 0) > 0 && <span className="text-[9px] text-amber-600">🔄 مسدد من المديونية السابقة: {Number(pay.appliedToCarriedDebt).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>}
                              </div>
                              <div className="flex gap-1">
                                <button type="button" onClick={() => { setEditingPaymentId(pay.id); setEditingPaymentAmount(String(pay.amount)); setEditingPaymentNotes(pay.notes || ''); setEditingPaymentRecipient(pay.recipient || ''); }} className="text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 p-1.5 rounded-lg border border-slate-200 cursor-pointer transition-all active:scale-95" title="تعديل"><Edit className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={async () => {
                                  const confirmed = await confirmDialog(`هل تريد حذف هذه الدفعة بقيمة ${formatNum(pay.amount)}ج.م؟\n⚠️ سيتم خصم هذا المبلغ من إجمالي الدفعات (المصنع سيصبح مديناً بهذا المبلغ).`);
                                  if (!confirmed) return;
                                  setArchiveCycles(prev => prev.map(c => {
                                    if (c.id !== cycle.id) return c;
                                    const updatedPayments = (c.payments || []).filter((p: any) => p.id !== pay.id);
                                    const totalPayments = updatedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
                                    return { ...c, payments: updatedPayments, totalAdvancePayments: totalPayments };
                                  }));
                                  showToast(`✓ تم حذف الدفعة. الم_factory مدين بـ ${formatNum(pay.amount)} ج.م`);
                                }} className="text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 p-1.5 rounded-lg border border-slate-200 cursor-pointer transition-all active:scale-95" title="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Invoice-like summary for Factory Archive */}
                {filteredLoads.length > 0 && (() => {
                  let totalLoadedCrates = 0;
                  let totalSoldCrates = 0;
                  let totalRemainingCrates = 0;
                  let totalSoldValue = 0;
                  filteredLoads.forEach(l => {
                    const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                    const weights = prod ? getProductWeightsFallback(prod) : [];
                    const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim()) || weights[0];
                    const unitsPerCarton = weight?.unitsPerCarton || 12;
                    const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor(l.quantity / unitsPerCarton);
                    const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
                    const key = `${l.productId}_${l.weightId || (weight ? weight.id : '')}`;
                    const stock = weightStocks[key] || { loaded: 0, sold: 0, remaining: 0 };
                    const soldCartons = Math.floor(stock.sold / unitsPerCarton);
                    const remainingCartons = Math.max(0, cartons - soldCartons);
                    totalLoadedCrates += cartons;
                    totalSoldCrates += soldCartons;
                    totalRemainingCrates += remainingCartons;
                    totalSoldValue += soldCartons * cartonPrice;
                  });
                  const totalAdvance = filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0);
                  const totalDirectPayments = filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
                  const totalPaid = totalAdvance + totalDirectPayments;
                  const remainingDue = Math.max(0, totalSoldValue - totalPaid);
                  return (
                  <div className="mt-4 bg-[#1A365D] text-white border-transparent text-white p-5 rounded-2xl flex flex-col gap-3 shadow-md">
                    <h3 className="text-center font-bold text-sm border-b border-slate-700 pb-2 mb-1">ملخص حساب الأرشيف المفلتر</h3>
                    
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/10 rounded-xl p-2">
                        <span className="text-[9px] text-blue-200 font-bold block">المحمل</span>
                        <span className="text-sm font-black">{totalLoadedCrates.toLocaleString('ar-EG')}</span>
                        <span className="text-[8px] text-blue-300">كرتونة</span>
                      </div>
                      <div className="bg-white/10 rounded-xl p-2">
                        <span className="text-[9px] text-blue-200 font-bold block">المبيع</span>
                        <span className="text-sm font-black text-emerald-300">{totalSoldCrates.toLocaleString('ar-EG')}</span>
                        <span className="text-[8px] text-blue-300">كرتونة</span>
                      </div>
                      <div className="bg-white/10 rounded-xl p-2">
                        <span className="text-[9px] text-blue-200 font-bold block">المتبقي</span>
                        <span className="text-sm font-black text-amber-300">{totalRemainingCrates.toLocaleString('ar-EG')}</span>
                        <span className="text-[8px] text-blue-300">كرتونة</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
                      <span className="text-slate-300">قيمة المبيع (بعد الجرد):</span>
                      <span className="font-bold font-mono">{totalSoldValue.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">المسدد المباشر للمورد:</span>
                      <span className="font-bold font-mono text-emerald-400">{totalDirectPayments.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
                      <span className="text-slate-300">إجمالي المسدد (مقدم + مباشر):</span>
                      <span className="font-bold font-mono text-emerald-400">{totalPaid.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-black text-slate-100">المتبقي للمصنع:</span>
                      <span className="text-lg font-black font-mono text-amber-400">{remainingDue.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                  </div>
                  );
                })()}
              </div>
              </>
            )}

            {archiveSection === 'trips' && (
              <div className="flex flex-col gap-3 mt-2">
                {filteredArchiveTrips.length > 0 && (
                  <div className="flex gap-2 w-full">
                    <button type="button" onClick={downloadCollectedTripsPDF} className="flex-1 bg-[#1A365D] hover:bg-[#2B6CB0] text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer">
                      <Printer className="h-4 w-4" /> تنزيل المشاوير المحصلة (PDF)
                    </button>
                    <button type="button" onClick={downloadCollectedTripsImage} className="flex-1 bg-[#DD6B20] hover:bg-[#C05621] text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer">
                      <Download className="h-4 w-4" /> تنزيل صورة المشاوير المحصلة
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto">
                  {filteredArchiveTrips.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-xs font-bold">لا يوجد مشاوير مسددة (محصلة) مطابقة لهذه الفترة.</p>
                  ) : (
                    [...filteredArchiveTrips].reverse().map(trip => (
                      <div key={trip.id} className="border rounded-xl p-3.5 flex flex-col gap-3 text-xs shadow-xs transition-all bg-emerald-50/40 border-emerald-100">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-[#1A365D] text-sm">{trip.description}</span>
                              <span className="text-[10px] bg-[#F7FAFC] border border-slate-200 text-[#2B6CB0] font-bold font-mono p-0.5 px-1.5 rounded">{trip.date}</span>
                            </div>
                            <span className="font-mono text-[#1A365D] font-bold block mt-0.5">السعر المسدد: {trip.price}ج.م</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-[#DD6B20]" />
                            <span className="text-emerald-800 font-bold">مسددة</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            </div>

            {/* Print-Only Hidden Document Container */}
            <div id="print-previous-archive-view" className="hidden text-black bg-[#FFFFFF]">
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body * { visibility: hidden !important; }
                  #print-previous-archive-view, #print-previous-archive-view * { visibility: visible !important; }
                  #print-previous-archive-view {
                    position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important;
                    display: block !important; background-color: white !important; color: black !important;
                    direction: rtl !important; padding: 25px !important; margin: 0 !important;
                    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
                  }
                  .no-print { display: none !important; }
                  @page { margin: 1cm; size: A4 portrait; }
                }
              `}} />
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-5">
                <h1 className="text-xl font-bold tracking-tight">سجل الشحنات</h1>
                <div className="flex justify-between text-[11px] mt-4 font-bold max-w-md mx-auto">
                  <span>
                    الفترة المحددة للكشف: {
                      archiveFilter === 'all' ? 'كافة الشحنات التاريخية' :
                      archiveFilter === 'daily' ? 'حركة اليوم الحالي' :
                      archiveFilter === 'weekly' ? 'الأسبوع الأخير' :
                      archiveFilter === 'monthly' ? 'الشهر الأخير' :
                      `مخصص من ${archiveStartDate || 'مفتوح'} إلى ${archiveEndDate || 'مفتوح'}`
                    }
                  </span>
                  <span>تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</span>
                </div>
              </div>

              {filteredLoads.length === 0 ? (
                <p className="text-center py-5">لا توجد شحنات مطابقة للفترة المحددة في هذا التقرير.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  <table className="w-full text-right text-[11px] border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-[#F7FAFC] border-b border-slate-800">
                        <th className="border border-slate-800 p-2 font-bold text-center">#</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">التاريخ واليوم</th>
                        <th className="border border-slate-800 p-2 font-bold">اسم المنتج وتفاصيله</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الكمية المسحوبة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">سعر الكرتونة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الإجمالي</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">المباع بالسيارة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الدفعة المقدمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLoads.map((load, index) => {
                        const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                        const weights = prod ? getProductWeightsFallback(prod) : [];
                        const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
                        const pName = prod ? prod.name : ((load as any).productName || 'مجهول');
                        const wSize = weight ? weight.size : ((load as any).weightSize || '');
                        const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
                        const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                        const totalLoadedValue = loadedCartons * cartonPrice;

                        // Quantity sold
                        let totalUnitsSold = 0;
                        invoices.forEach(inv => {
                          inv.items.forEach(item => {
                            if (item.productId === load.productId && item.weightId === load.weightId) {
                              totalUnitsSold += item.quantity;
                            }
                          });
                        });
                        const cartonsSold = Number((totalUnitsSold / (weight?.unitsPerCarton || 12)).toFixed(3));

                        const loadDateObj = new Date(load.date);
                        const formattedDateStr = loadDateObj.toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric'
                        }) + ` • ` + loadDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <tr key={'print_prev_load_' + load.id} className="border-b border-slate-600">
                            <td className="border border-slate-800 p-1.5 text-center">{index + 1}</td>
                            <td className="border border-slate-800 p-1.5 text-center" dir="rtl">{formattedDateStr}</td>
                            <td className="border border-slate-800 p-1.5">
                              <div>{pName} <span className="text-[9px] text-[#2B6CB0]">({wSize})</span></div>
                        <div className="text-gray-500 text-[10px] mt-0.5">المندوب: {load.delegateName?.replace(/ \(.*?\)/g, '').trim() || 'مجهول'} {load.delegatePhone ? `(${load.delegatePhone})` : ''}</div>
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">
                              {loadedCartons}
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center">{cartonPrice.toFixed(2)}ج.م</td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">{(totalLoadedValue).toFixed(2)}ج.م</td>
                            <td className="border border-slate-800 p-1.5 text-center">
                              {cartonsSold}
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">
                              {load.advanceAmount && load.advanceAmount > 0 ? `${load.advanceAmount.toFixed(2)}ج.م` : '0.00'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {/* Cumulative block for print */}
                  <div className="border border-slate-800 p-3 rounded mt-3 text-[11.5px] font-bold bg-[#F7FAFC] flex flex-col gap-2 w-full ml-auto">
                    <div className="flex justify-between">
                      <span>إجمالي عدد شحنات السحب المفلترة:</span>
                      <span>{filteredLoads.length} شحنة تحميل</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1">
                      <span>استحقاق البضائع المسحوبة من المصنع المفلترة (المدين):</span>
                      <span className="text-md">
                        {filteredLoads.reduce((sum, l) => {
                          const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                          const weights = prod ? getProductWeightsFallback(prod) : [];
                          const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim()) || weights[0];
                          const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
                          const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                          return sum + (loadedCartons * cartonPrice);
                        }, 0).toFixed(2)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-emerald-800">
                      <span>إجمالي الدفعات المقدمة والمباشرة المفلترة:</span>
                      <span>
                        {(filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0) + filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0)).toFixed(2)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-rose-800 text-sm">
                       <span>المتبقي للمصنع (المبلغ المدين الباقي):</span>
                       <span>
                          {(() => {
                            const totalLoadVal = filteredLoads.reduce((sum, l) => {
                              const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                              const weights = prod ? getProductWeightsFallback(prod) : [];
                              const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim()) || weights[0];
                              const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
                              const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                              return sum + (loadedCartons * cartonPrice);
                            }, 0);
                            const totalAdvance = filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0);
                            const totalDirect = filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
                            const remaining = totalLoadVal - totalAdvance - totalDirect;
                            return remaining > 0 ? remaining.toFixed(2) : '0.00';
                          })()}ج.م
                       </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        )}

        {/* 2.5 سجل المشاوير */}
        {activeSubTab === 'trips' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1A365D] text-white border-transparent text-white p-3 rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] text-indigo-100 font-bold">إجمالي المشاوير</span>
                <span className="text-sm font-black mt-2 font-mono">{(trips?.reduce((sum, t) => sum + t.price, 0) || 0).toFixed(1)}ج.م</span>
              </div>
              <div className="bg-[#DD6B20] text-white text-white p-3 rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] text-emerald-100 font-bold">المحصل</span>
                <span className="text-sm font-black mt-2 font-mono">{(trips?.filter(t => t.collected).reduce((sum, t) => sum + t.price, 0) || 0).toFixed(1)}ج.م</span>
              </div>
              <div className="bg-amber-600 text-white p-3 rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] text-amber-100 font-bold">المتبقي</span>
                <span className="text-sm font-black mt-2 font-mono">{((trips?.reduce((sum, t) => sum + t.price, 0) || 0) - (trips?.filter(t => t.collected).reduce((sum, t) => sum + t.price, 0) || 0)).toFixed(1)}ج.م</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsedPrice = tripPrice ? parseFloat(tripPrice) : 0;
                if (!tripDescription.trim()) return showToast('⚠️ يرجى إدخال وصف المشوار!');
                if (tripPrice && (isNaN(parsedPrice) || parsedPrice < 0)) return showToast('⚠️ يرجى إدخال سعر صحيح للمشوار!');
                const selectedTripDel = isManager && tripDelegatePhone
                  ? archiveDelegates.find(d => d.phone === tripDelegatePhone)
                  : null;
                onAddTrip({
                  description: tripDescription.trim(),
                  price: parsedPrice,
                  date: tripDate,
                  collected: false,
                  delegateName: selectedTripDel?.name || currentUser?.name || '',
                  delegatePhone: selectedTripDel?.phone || currentUser?.phone || ''
                });
                setTripDescription('');
                setTripPrice('');
                if (isManager) setTripDelegatePhone('');
                showToast('✓ تم تسجيل المشوار بنجاح!');
              }}
              className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3.5"
            >
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1 bg-[#F7FAFC] px-2 py-1.5 rounded-lg border border-slate-250 w-max">
                <Plus className="h-4 w-4" />
                تسجيل مشوار
              </span>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#1A365D] mb-1">وصف أو جهة المشوار</label>
                  <input type="text" required placeholder="مثال: دمياط، بلقاس، توصيل طلبية خاصة" value={tripDescription} onChange={(e) => setTripDescription(e.target.value)} className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-[#1A365D]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#DD6B20] mb-1">سعر المشوار</label>
                    <input type="number" min="0" placeholder="يمكن تركه فارغاً" value={tripPrice} onChange={(e) => setTripPrice(e.target.value)} className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-center text-[#1A365D] font-mono" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-700 mb-1">التاريخ</label>
                    <input type="date" required value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-center text-[#1A365D]" />
                  </div>
                </div>
                {isManager && (
                  <div>
                    <label className="block text-[11px] font-bold text-violet-700 mb-1">المندوب</label>
                    <select
                      value={tripDelegatePhone}
                      onChange={(e) => setTripDelegatePhone(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-[#1A365D]"
                    >
                      <option value="">-- اختر المندوب --</option>
                      {archiveDelegates.filter(d => d.phone !== 'مجهول').map(d => (
                        <option key={d.phone} value={d.phone}>{d.name} ({d.phone})</option>
                      ))}
                    </select>
                  </div>
                )}
                <button type="submit" className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer">
                  تسجيل المشوار بالسيستم
                </button>
              </div>
            </form>

            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <MapPin className="h-4.5 w-4.5 text-[#2B6CB0]" />
                    المشاوير المعلقة (غير محصلة)
                  </span>
                </div>
                <div className="flex gap-2">
                  {trips && trips.filter(t => !t.collected).length > 0 && (
                    <>
                      <button type="button" onClick={downloadPendingTripsPDF} className="text-[10px] bg-[#1A365D] hover:bg-[#2B6CB0] text-white px-2 py-1.5 rounded-lg cursor-pointer font-bold flex items-center gap-1 transition-colors">
                        <Printer className="h-3 w-3" /> PDF
                      </button>
                      <button type="button" onClick={downloadPendingTripsImage} className="text-[10px] bg-[#DD6B20] hover:bg-[#C05621] text-white px-2 py-1.5 rounded-lg cursor-pointer font-bold flex items-center gap-1 transition-colors">
                        <Download className="h-3 w-3" /> صورة
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto">
                {(!trips || trips.filter(t => !t.collected).length === 0) ? (
                  <p className="text-center text-gray-400 py-8 text-xs font-bold">لا يوجد مشاوير معلقة مسجلة.</p>
                ) : (
                  [...trips].filter(t => !t.collected).reverse().map((trip) => (
                    <div key={trip.id} className="border rounded-xl p-3.5 flex flex-col gap-3 text-xs shadow-xs transition-all bg-amber-50/20 border-amber-100">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#1A365D] text-sm">{trip.description}</span>
                            <span className="text-[10px] bg-[#F7FAFC] border border-slate-200 text-[#2B6CB0] font-bold font-mono p-0.5 px-1.5 rounded">{trip.date}</span>
                          </div>
                          {trip.price > 0 ? (
                            <span className="font-mono text-[#1A365D] font-bold block mt-0.5">السعر: {trip.price}ج.م</span>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-rose-500 font-bold">لم يتم تسعير المشوار بعد</span>
                              <button type="button" onClick={() => {
                                const newPriceStr = prompt('أدخل قيمة هذا المشوار (ج.م):');
                                if (newPriceStr) {
                                  const pr = parseFloat(newPriceStr);
                                  if (!isNaN(pr) && pr > 0) onEditTrip(trip.id, { price: pr });
                                }
                              }} className="bg-indigo-50 text-[#1A365D] px-2 py-1 rounded text-[10px] font-bold border border-indigo-200 cursor-pointer">إضافة القيمة</button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-start gap-1.5 shrink-0 h-full pt-1">
                          {trip.price > 0 && (
                            <button type="button" onClick={() => onToggleTripCollected(trip.id)} className="bg-[#1A365D] text-white border-transparent text-white hover:bg-[#1A365D] text-white border-transparent shadow-xs px-3 py-1.5 rounded-lg text-[10.5px] font-black cursor-pointer flex items-center gap-1">
                              <span>تسجيل تم تحصيل</span>
                            </button>
                          )}
                          <button type="button" onClick={() => { onDeleteTrip(trip.id); }} className="p-1.5 text-gray-400 hover:text-[#DD6B20] hover:bg-rose-50 rounded-lg cursor-pointer border border-transparent hover:border-rose-100">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Odometer Section inside Trip */}
                      <div className="border-t border-slate-200/60 pt-2 flex items-center justify-between gap-2 mt-1">
                        <div className="flex gap-2">
                          {trip.odometerStart ? (
                            <span className="text-[10px] font-bold text-[#2B6CB0] bg-[#FFFFFF] px-2 py-1 rounded border border-slate-200">
                              بداية العداد: <span className="font-mono text-[#1A365D]">{trip.odometerStart}</span>
                            </span>
                          ) : (
                            <button type="button" onClick={() => {
                              const odo = prompt('أدخل قراءة العداد الحالية لبدء الرحلة:');
                              if (odo && !isNaN(parseFloat(odo))) onEditTrip(trip.id, { odometerStart: parseFloat(odo) });
                            }} className="text-[10px] font-bold text-[#2B6CB0] bg-[#F7FAFC] hover:bg-slate-200 px-2 py-1 border border-slate-300 rounded cursor-pointer transition-colors flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> بدأ الرحلة (العداد)
                            </button>
                          )}
                          
                          {trip.odometerStart && !trip.odometerEnd && (
                            <button type="button" onClick={() => {
                              const odo = prompt('أدخل قراءة العداد الحالية لإنهاء الرحلة والتسعير المبدئي:');
                              if (odo && !isNaN(parseFloat(odo))) {
                                const endOdo = parseFloat(odo);
                                if (endOdo >= trip.odometerStart!) {
                                  onEditTrip(trip.id, { odometerEnd: endOdo });
                                } else {
                                  showToast('⚠️ قراءة النهاية يجب أن تكون أكبر من البداية!');
                                }
                              }
                            }} className="text-[10px] font-bold text-[#1A365D] bg-indigo-50 hover:bg-indigo-100 px-2 py-1 border border-indigo-200 rounded cursor-pointer transition-colors flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> إنهاء الرحلة
                            </button>
                          )}

                          {trip.odometerStart && trip.odometerEnd && (
                            <span className="text-[10px] font-bold text-[#2B6CB0] bg-[#FFFFFF] px-2 py-1 rounded border border-slate-200">
                              نهاية العداد: <span className="font-mono text-[#1A365D]">{trip.odometerEnd}</span>
                            </span>
                          )}
                        </div>
                        
                        {trip.odometerStart && trip.odometerEnd && (
                          <div className="bg-amber-100/50 border border-amber-200 text-[#1A365D] px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide">
                            المسافة: <span className="font-mono">{trip.odometerEnd - trip.odometerStart}</span> كم
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3/3. المنتجات (إضافة وتعديل المنتجات) */}
        {activeSubTab === 'products' && (
          <div className="flex flex-col gap-5">
            {/* Elegant Add Product Button */}
            {!isAddingProduct && !editingProdId && canEditPrices && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProduct(true);
                    // Reset states for a fresh add
                    setProdName('');
                    setAccountingUnit('كرتونة');
                    setProdPrice('0');
                    setProdMinAlert('20');
                    setProdWeights([]);
                  }}
                  className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent active:scale-95 text-white font-bold py-3.5 px-5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <Plus className="h-5 w-5 text-emerald-300" />
                  <span>اضافة منتج جديد</span>
                </button>
                {onDeleteAllProducts && (
                  <button
                    type="button"
                    onClick={async () => { if (await confirmDialog("هل أنت متأكد من تفريغ كافة المنتجات؟ سيتم مسح قائمة المنتجات بالكامل.")) {
                        onDeleteAllProducts();
                        showToast("✓ تم تفريغ قائمة المنتجات بنجاح!");
                      }
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3.5 px-5 rounded-2xl border border-rose-200 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-sm font-sans"
                  >
                    <Trash2 className="h-5 w-5 text-rose-500 animate-pulse" />
                    <span>تفريغ المنتجات</span>
                  </button>
                )}
              </div>
            )}

            {/* Create / Edit Product Form (shows on toggle or edit) */}
            {(isAddingProduct || editingProdId) && (
              <form onSubmit={handleCreateProduct} className="bg-[#FFFFFF] p-5 rounded-2xl border-2 border-indigo-100 shadow-md flex flex-col gap-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                  <h3 className="font-bold text-indigo-950 text-base flex items-center gap-1.5">
                    <PackagePlus className="h-5 w-5 text-[#1A365D]" />
                    {editingProdId ? 'تعديل بيانات الصنف وحساباته' : 'تسجيل منتج جديد'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingProduct(false);
                      setEditingProdId(null);
                    }}
                    className="text-gray-400 hover:text-[#2B6CB0] text-xs font-bold bg-[#F7FAFC] p-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  <div>
                    <label className="inline-block bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">المنتج</label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="مثال: زيت طعام عافية"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-[#cfd3d9] rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-[#1A365D]"
                    />
                  </div>

                  {/* Accounting Unit Option as requested */}
                  <div>
                    <label className="inline-block bg-amber-100 text-amber-950 border border-amber-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">الوحدة</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: كرتونة، صندوق، رابطة..."
                      value={accountingUnit}
                      onChange={(e) => setAccountingUnit(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-[#cfd3d9] rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-[#1A365D]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="inline-block bg-sky-100 text-sky-950 border border-sky-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">تنبيه المخزون</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="مثال: 20"
                        value={prodMinAlert}
                        onChange={(e) => setProdMinAlert(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-[#cfd3d9] rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-[#1A365D] text-center"
                      />
                    </div>
                  </div>

                  {/* Sub-table Weights Configuration matching perfectly the manual pricing, factory cost, and margins */}
                  <div className="border border-indigo-100 rounded-xl p-3.5 bg-indigo-50/30 flex flex-col gap-3">
                    <span className="text-xs font-extrabold text-emerald-950 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg flex items-center gap-1.5 self-start shadow-sm">
                      <Scale className="h-4 w-4 text-[#DD6B20]" />
                      المنتج
                    </span>

                    <div className="bg-[#FFFFFF] p-3 rounded-lg border border-slate-150 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="col-span-2">
                        <label className="inline-block bg-[#d5f7f0] text-[#1A365D] border border-slate-200 text-[10px] font-black px-1.5 py-0.5 rounded mb-1">الحجم</label>
                        <input
                          type="text"
                          placeholder="مثال: 1 لتر، 750 مل..."
                          value={weightSize}
                          onChange={(e) => setWeightSize(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-md p-1.5 text-xs text-[#1A365D] font-bold"
                        />
                      </div>

                      <div>
                        <label className="inline-block bg-[#d5f7f0] text-[#1A365D] border border-slate-200 text-[10px] font-black px-1.5 py-0.5 rounded mb-1">سعر الكرتونة</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="مثال: 1000"
                          value={weightCartonPrice}
                          onChange={(e) => setWeightCartonPrice(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-md p-1.5 text-xs text-[#1A365D] text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="inline-block bg-[#d5f7f0] text-[#1A365D] border border-[#edf0e2] text-[10px] font-black px-1.5 py-0.5 rounded mb-1">العدد</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="12"
                          value={weightUnitsPerCarton}
                          onChange={(e) => setWeightUnitsPerCarton(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-md p-1.5 text-xs text-[#1A365D] text-center font-bold"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="inline-block bg-[#fce4e4] text-[#1A365D] border border-rose-200 text-[10px] font-black px-1.5 py-0.5 rounded mb-1 flex items-center gap-1 w-max"><ScanLine className="h-3 w-3"/> الباركود (اختياري)</label>
                        <input
                          type="text"
                          placeholder="امسح او اكتب الباركود..."
                          value={weightBarcode}
                          onChange={(e) => setWeightBarcode(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-md p-1.5 text-xs text-[#1A365D] font-mono font-bold text-left"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddWeightToList}
                        className={`col-span-2 sm:col-span-4 bg-[#1b090f] hover:bg-opacity-80 text-white font-bold py-1.5 px-3 rounded-md text-xs border border-indigo-200 active:scale-95 transition-all text-center flex items-center justify-center gap-1 cursor-pointer mt-1`}
                      >
                        <Plus className="h-4 w-4" />
                        {editingWeightId ? 'تحديث الصنف' : 'إضافة'}
                      </button>
                    </div>

                    {/* Registered weights list table */}
                    <div className="flex flex-col gap-1.5 mt-2">
                      <span className="text-[11px] font-bold text-gray-400">قائمة الأصناف الفرعية (الأوزان / المقاسات / السعات):</span>
                      {prodWeights.length === 0 ? (
                        <p className="text-center text-gray-400 py-3 text-[10px] bg-[#F7FAFC] rounded border border-slate-200 border-dashed">لم تقم بإضافة أي عبوة فرعية لهذا المنتج بعد.</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {prodWeights.map((w, index) => (
                            <div key={w.id || index} className="bg-white border border-slate-200 p-2 rounded-lg flex items-center justify-between text-xs">
                              <div className="flex flex-col">
                                <span className="font-bold text-[#1A365D]">{w.size}</span>
                                <span className="text-[10px] text-gray-500 font-medium">سعر الكرتونة من المصنع: {w.cartonPriceFromFactory}ج.م • العدد بالكرتونة: {w.unitsPerCarton}</span>
                                {w.barcode && (
                                  <span className="text-[9px] text-emerald-600 font-mono font-bold mt-0.5">باركود: {w.barcode}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditWeightInList(w.id || '')}
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveWeightFromList(w.id || '')}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save button for the product form */}
                  <button
                    type="submit"
                    className="w-full bg-[#1A365D] text-white border-transparent hover:bg-indigo-900 font-bold py-3 px-4 rounded-xl text-xs cursor-pointer transition-all active:scale-95 text-center flex items-center justify-center gap-1.5 shadow-md mt-2"
                  >
                    <Save className="h-4 w-4 text-emerald-300" />
                    <span>حفظ بيانات المنتج والتسعير</span>
                  </button>
                </div>
              </form>
            )}

            {/* List existing products (المنتجات الحالية) */}
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <PackagePlus className="h-4.5 w-4.5 text-[#2B6CB0]" />
                قائمة المنتجات وجدول التسعير المسجلة بالمصنع
              </span>

              <div className="flex flex-col gap-3.5">
                {products.length === 0 ? (
                  <p className="text-center text-gray-400 py-6 text-xs">لم تقم بإضافة منتجات بعد.</p>
                ) : (
                  products.map((p) => {
                    const ws = getProductWeightsFallback(p);
                    const labelUnit = p.accountingUnit || 'كرتونة';
                    return (
                      <div key={p.id} className="bg-[#F7FAFC] border border-slate-200 rounded-xl p-3 flex flex-col gap-2 shadow-xs">
                        <div className="flex justify-between items-start gap-2 border-[3px] rounded-[3px] border-[#a3c2eb]">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-[#1A365D] text-sm">{p.name}</span>
                            <span className="text-[10px] text-gray-400 font-bold">طريقة المحاسبة: {labelUnit}</span>
                          </div>

                          {canEditPrices && (
                            <div className="flex items-center gap-1.5 self-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProdId(p.id);
                                  setProdName(p.name);
                                  setAccountingUnit(p.accountingUnit || 'كرتونة');
                                  setProdMinAlert(p.minStockAlert ? p.minStockAlert.toString() : '20');
                                  setProdWeights(ws);
                                  setIsAddingProduct(false);
                                }}
                                className="p-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-[#1A365D] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="تعديل هذا المنتج"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteProduct(p.id);
                                }}
                                className="p-1 px-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* List nested weights of this category */}
                        <div className="bg-[#FFFFFF] rounded-lg border border-slate-100 p-2 text-xs flex flex-col gap-1.5 divide-y divide-slate-100">
                          {ws.map((w, index) => {
                            const retailPrice = w.cartonPriceFromFactory + (w.addedValue || 0);
                            return (
                              <div key={w.id || index} className="pt-1.5 first:pt-0 flex flex-wrap justify-between items-center text-[11px] text-[#2B6CB0] font-medium border-b-0 pb-1 mb-1 border-b border-b-slate-100/50 gap-2">
                                <span>الوزن/الحجم: <strong className="text-slate-850 font-bold">{w.size}</strong></span>
                                <span>سعر المصنع للـ {labelUnit}: <strong className="text-blue-750 font-bold">{w.cartonPriceFromFactory}ج.م</strong></span>
                                <span>قيمة مضافة: <strong className="text-orange-700 font-bold">{w.addedValue || 0}ج.م</strong></span>
                                <span>التجزئة (التسليم): <strong className="text-emerald-700 font-bold">{retailPrice}ج.م</strong></span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. الحساب المالي للمصنع */}
        {activeSubTab === 'factory_account' && (
          <div className="flex flex-col gap-5 animate-fade-in" id="factory-account-tab">
            
            <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-black text-[#1A365D] flex items-center gap-1.5">
                  <FileText className="h-4.5 w-4.5 text-[#2B6CB0]" />
                  كشف الحساب والمديونية المفتوحة للمصنع
                </span>
                <span className="text-[10px] text-gray-400 font-bold">مراجعة ميزان المسحوبات والمقدمات الحالية للموردين</span>
              </div>
              <button
                type="button"
                onClick={exportFactoryLedgerAsPDF}
                className="bg-[#1A365D] hover:bg-[#2B6CB0] text-white font-extrabold text-[#ffffff] text-xs py-2 px-3.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 border-0"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة كشف ميزانية المصنع (PDF)</span>
              </button>
            </div>

            {isManager && (
              <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2">
                <span className="text-xs font-black text-[#1A365D]">تصفية حساب المصنع حسب المندوب:</span>
                <select
                  value={factoryDelegateFilter}
                  onChange={(e) => setFactoryDelegateFilter(e.target.value)}
                  className="bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D]"
                >
                  <option value="all">كل المناديب (تجميعي)</option>
                  {archiveDelegates.map(d => (
                    <option key={d.phone || d.name} value={d.phone !== 'مجهول' ? d.phone : d.name}>
                      {d.name} {d.phone !== 'مجهول' ? `(${d.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Top Grid of Balance sheet — الرصيد الكلي للمصنع (لكل المناديب) */}
            <div className="grid grid-cols-3 gap-2 font-sans">
              <div className="bg-[#1A365D] text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                <span className="text-[10px] text-indigo-205 font-bold">حساب المصنع (كلي)</span>
                <span className="text-sm font-black mt-2 font-mono">
                  {formatNum(totalFactoryBalanceDetails.totalWithdrawnValue)} <span className="text-[10px]">ج.م</span>
                </span>
              </div>
              <div className="bg-[#10B981] text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                <span className="text-[10px] text-emerald-100 font-bold">المسدد للمصنع (كلي)</span>
                <span className="text-sm font-black mt-2 font-mono">
                  {formatNum(totalFactoryBalanceDetails.totalAdvancePayments)} <span className="text-[10px]">ج.م</span>
                </span>
              </div>
              {totalFactoryBalanceDetails.netRemainingDueToFactory > 0 ? (
                <div className="bg-rose-600 text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-rose-100 font-bold">المتبقي للمصنع (كلي)</span>
                  <span className="text-sm font-black mt-2 font-mono">
                    {formatNum(totalFactoryBalanceDetails.netRemainingDueToFactory)} <span className="text-[10px]">ج.م</span>
                  </span>
                </div>
              ) : totalFactoryBalanceDetails.netRemainingDueToFactory === 0 ? (
                <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-emerald-100 font-bold">المتبقي للمصنع (كلي)</span>
                  <span className="text-sm font-black mt-2 font-mono">
                    مسوى <span className="text-[10px]">✔️</span>
                  </span>
                </div>
              ) : (
                <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-indigo-100 font-bold">رصيد دائن لصالحنا (دفعات زائدة)</span>
                  <span className="text-sm font-black mt-2 font-mono">
                    {formatNum(Math.abs(totalFactoryBalanceDetails.netRemainingDueToFactory))} <span className="text-[10px]">ج.م</span>
                  </span>
                </div>
              )}
            </div>

            {/* Direct Multi-Panel configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Panel A: تسجيل دفعة سداد للمصنع */}
              <div className="bg-[#FFFFFF] p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <span className="text-xs font-black text-[#1A365D] flex items-center gap-1 bg-[#F7FAFC] px-2 py-1.5 rounded-lg border border-slate-200 w-max">
                  <Wallet className="h-4 w-4 text-[#DD6B20]" />
                  تسجيل دفعة مسددة للمورد
                </span>

                <div className="flex flex-col gap-3 mt-1.5">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="مبلغ السداد (ج.م)"
                      value={newPaymentAmount}
                      onChange={(e) => setNewPaymentAmount(e.target.value)}
                      className="w-1/2 bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-bold text-center text-[#1A365D]"
                    />
                    <input
                      type="text"
                      placeholder="البيان (مثال: شيك، نقدي مندوب)"
                      value={newPaymentNotes}
                      onChange={(e) => setNewPaymentNotes(e.target.value)}
                      className="w-1/2 bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D] flex items-center gap-1">
                      <span className="text-slate-500 shrink-0">السيد /</span>
                      <input
                        type="text"
                        placeholder="مستلم السداد"
                        value={newPaymentRecipient}
                        onChange={(e) => setNewPaymentRecipient(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-xs font-bold text-[#1A365D]"
                      />
                    </div>
                  </div>
                  {isManager && (
                    <div className="flex flex-col gap-1 mt-1">
                      <label className="text-[10px] text-slate-500 font-bold">المندوب المستهدف بالسداد:</label>
                      <select
                        value={paymentTargetDelegate}
                        onChange={(e) => setPaymentTargetDelegate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">-- اختر المندوب المستهدف بالسداد --</option>
                        <option value="admin">المدير العام (سداد عام مباشر)</option>
                        {archiveDelegates.map(d => {
                          const phoneKey = d.phone !== 'مجهول' ? d.phone : d.name;
                          return (
                            <React.Fragment key={phoneKey}>
                              <option value={phoneKey}>
                                المندوب: {d.name} (سداد مباشر)
                              </option>
                              <option value={`gm_on_behalf_${phoneKey}`}>
                                المدير العام (نيابة عن المندوب: {d.name})
                              </option>
                            </React.Fragment>
                          );
                        })}
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const amount = parseFloat(newPaymentAmount);
                      if (!amount || amount <= 0) {
                        showToast("⚠️ يرجى إدخال قيمة صحيحة للدفعة المالية!");
                        return;
                      }
                      
                      if (isManager && !paymentTargetDelegate) {
                        showToast("⚠️ يرجى اختيار المندوب المستهدف بالسداد أولاً!");
                        return;
                      }

                      let appliedToCarriedDebt = 0;
                      let newCarried = carriedOverDebt;
                      if (newCarried > 0) {
                        if (amount >= newCarried) {
                          appliedToCarriedDebt = newCarried;
                          setCarriedOverDebt(0);
                          setCarriedOverDebtDate('');
                        } else {
                          appliedToCarriedDebt = amount;
                          setCarriedOverDebt(newCarried - amount);
                        }
                      }

                      let finalPhone = '';
                      let finalName = '';
                      let noteText = newPaymentNotes.trim();

                      if (!isManager) {
                        finalPhone = currentUser?.phone || '';
                        finalName = currentUser?.name || 'مجهول';
                      } else {
                        if (paymentTargetDelegate === 'admin') {
                          finalPhone = 'admin';
                          finalName = 'المدير العام';
                        } else if (paymentTargetDelegate.startsWith('gm_on_behalf_')) {
                          const actualPhone = paymentTargetDelegate.replace('gm_on_behalf_', '');
                          const targetDel = archiveDelegates.find(d => d.phone === actualPhone || d.name === actualPhone);
                          finalPhone = targetDel ? targetDel.phone : actualPhone;
                          finalName = targetDel ? targetDel.name : 'مجهول';
                          const cleanNote = noteText.replace(/\s*\(سداد بواسطة المدير العام نيابة عن المندوب\)/g, '').trim();
                          noteText = `${cleanNote || 'تسديد مباشر'} (سداد بواسطة المدير العام نيابة عن المندوب)`;
                        } else {
                          const targetDel = archiveDelegates.find(d => d.phone === paymentTargetDelegate || d.name === paymentTargetDelegate);
                          finalPhone = targetDel ? targetDel.phone : paymentTargetDelegate;
                          finalName = targetDel ? targetDel.name : 'مجهول';
                        }
                      }

                      onAddExpense({
                        amount,
                        category: 'سداد للمصنع',
                        type: 'factory_payment',
                        date: new Date().toISOString(),
                        description: JSON.stringify({
                          notes: noteText || 'تسديد مباشر',
                          appliedToCarriedDebt,
                          recipient: newPaymentRecipient.trim()
                        }),
                        delegateName: finalName,
                        delegatePhone: finalPhone
                      });
                      setNewPaymentAmount('');
                      setNewPaymentNotes('');
                      setNewPaymentRecipient('');
                      showToast(`✓ تم تسجيل دفعة مالية للمصنع بقيمة ${amount}ج.م بنجاح!`);
                    }}
                    className="bg-[#DD6B20] text-white hover:bg-[#C05621] text-white font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer transition-all active:scale-95 text-center mt-1"
                  >
                    اعتماد السداد
                  </button>
                </div>
              </div>

              {/* Panel B: خانة المتبقي للمصنع / الرصيد الدائن / زر الأرشفة — يستخدم الرصيد الكلي */}
              {(() => {
                const netRemaining = totalFactoryBalanceDetails.netRemainingDueToFactory;
                const rawValue = totalFactoryBalanceDetails.rawLoadedValue;
                const creditBalance = Math.max(0, totalFactoryBalanceDetails.totalAdvancePayments - totalFactoryBalanceDetails.totalWithdrawnValue - carriedOverDebt);
                const isSettledAndCanArchive = (netRemaining <= 0) && (factoryLoads.length > 0 || totalFactoryPayments.length > 0 || carriedOverDebt !== 0);

                if (netRemaining > 0) {
                  return (
                    <div className="bg-[#FFF5F5] border border-rose-200 p-4.5 rounded-2xl shadow-sm flex flex-col gap-3 animate-fade-in" id="factory-remaining-box">
                      <span className="text-xs font-black text-rose-800 flex items-center gap-1 bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-100 w-max">
                        <AlertCircle className="h-4 w-4 text-rose-600 animate-pulse" />
                        المتبقي للمصنع حالياً
                      </span>
                      <div className="flex flex-col gap-2.5 mt-1">
                        <div className="bg-white border border-rose-150 p-3 rounded-xl text-center">
                          <span className="text-[10px] block font-bold text-slate-500 mb-1">المبلغ المتبقي الملتزم سداده للمورد:</span>
                          <span className="text-xl font-black font-mono text-rose-600">
                            {formatNum(netRemaining)} <span className="text-xs">ج.م</span>
                          </span>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl text-center">
                          <span className="text-[10px] block font-bold text-rose-700">⚠️ لا يمكن الترحيل للأرشيف - يجب سداد كامل المبلغ أولاً</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const remainingAmount = netRemaining;
                            const confirmed = await confirmDialog(`تأكيد السداد بالكامل: سيتم تسجيل دفعة بقيمة ${formatNum(remainingAmount)}ج.م ثم ترحيل الدورة بالكامل للأرشيف.\n\nهل أنت متأكد؟`);
                            if (confirmed) {
                              setIsArchiving(true);
                              try {
                                // 1. Add the final settlement payment to expenses
                                onAddExpense({
                                  amount: remainingAmount,
                                  category: 'سداد للمصنع',
                                  type: 'factory_payment',
                                  date: new Date().toISOString(),
                                  description: JSON.stringify({ notes: 'سداد كامل المبلغ المتبقي وتصفية الحساب', appliedToCarriedDebt: 0 }),
                                  delegateName: selectedDelegatePhone ? (archiveDelegates.find(d => d.phone === selectedDelegatePhone)?.name || 'مجهول') : currentUser?.name || 'مجهول',
                                  delegatePhone: selectedDelegatePhone || currentUser?.phone || ''
                                });

                                // 2. Build archive snapshot — use ALL loads (not filtered by delegate) for full cycle archive
                                const currentLoads = factoryLoads.filter(l => new Date(l.date).getTime() > lastArchiveTimestamp).map(l => {
                                  const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                                  const weights = prod ? getProductWeightsFallback(prod) : [];
                                  const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim());
                                  const unitsPerCarton = weight?.unitsPerCarton || 12;
                                  const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor(l.quantity / unitsPerCarton);
                                  const loose = l.looseUnitsCount !== undefined ? l.looseUnitsCount : (l.quantity % unitsPerCarton);
                                  const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
                                  const unitPrice = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
                                  return {
                                    date: l.date, productName: prod?.name || l.productName || 'غير معروف',
                                    weightSize: weight?.size || (l as any).weightSize || '', cartons, loose,
                                    cartonPrice, subtotal: (cartons * cartonPrice) + (loose * unitPrice),
                                    advanceAmount: l.advanceAmount ?? 0, delegateName: l.delegateName || ''
                                  };
                                });
                                // Build payments list using ALL payments (not filtered by delegate)
                                const existingPayments = totalFactoryPayments.map(p => {
                                  let parsed: any = {};
                                  try { parsed = JSON.parse(p.description || '{}'); } catch {}
                                  return {
                                    id: p.id, amount: p.amount, date: p.date, notes: parsed.notes || '',
                                    recipient: parsed.recipient || '', delegateName: p.delegateName || '',
                                    delegatePhone: p.delegatePhone || '', appliedToCarriedDebt: parsed.appliedToCarriedDebt || 0
                                  };
                                });
                                const settlePayment = {
                                  id: 'settle_' + Date.now(), amount: remainingAmount,
                                  date: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
                                  notes: 'سداد كامل المبلغ المتبقي وتصفية الحساب', recipient: '',
                                  delegateName: selectedDelegatePhone ? (archiveDelegates.find(d => d.phone === selectedDelegatePhone)?.name || 'مجهول') : currentUser?.name || 'مجهول',
                                  delegatePhone: selectedDelegatePhone || currentUser?.phone || '',
                                  appliedToCarriedDebt: 0
                                };
                                const allPayments = [...existingPayments, settlePayment];
                                const rawSum = currentLoads.reduce((s, l) => s + l.subtotal, 0);
                                const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
                                const newCycle = {
                                  id: Date.now().toString(),
                                  settledAt: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
                                  loads: currentLoads,
                                  payments: allPayments,
                                  rawLoadedValue: rawSum,
                                  totalWithdrawnValue: totalFactoryBalanceDetails.totalWithdrawnValue,
                                  totalAdvancePayments: totalPaid,
                                  creditBalance: 0,
                                  carriedOverDebtAtTime: carriedOverDebt,
                                  settledFully: true
                                };
                                setArchiveCycles(prev => [...prev, newCycle]);
                                setCarriedOverDebt(0);
                                setCarriedOverDebtDate('');

                                if (onArchiveFactoryCycle) {
                                  const finalPhone = selectedDelegatePhone || factoryDelegateFilter || currentUser?.phone || '';
                                  const finalName = selectedDelegatePhone ? (archiveDelegates.find(d => d.phone === selectedDelegatePhone)?.name || currentUser?.name || 'مجهول') : (factoryDelegateFilter ? (archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter)?.name || 'مجهول') : 'مجهول');
                                  onArchiveFactoryCycle(finalPhone, finalName);
                                } else {
                                  const loadsToArchive = factoryLoads.filter(l => new Date(l.date).getTime() > lastArchiveTimestamp);
                                  for (const load of loadsToArchive) { onDeleteLoad(load.id); }
                                  const currentExpenses = expenses.filter(e =>
                                    (e.category === 'سداد للمصنع' || e.type === 'factory_payment') && new Date(e.date).getTime() > lastArchiveTimestamp);
                                  for (const exp of currentExpenses) { onDeleteExpense(exp.id); }
                                }
                                showToast("✓ تم تسجيل الدفعة النهائية وترحيل الدورة للأرشيف بنجاح!");
                              } catch (err) {
                                console.error(err);
                                showToast("❌ حدث خطأ أثناء الترحيل!");
                              } finally {
                                setIsArchiving(false);
                              }
                            }
                          }}
                          className="bg-[#10B981] hover:bg-[#10B981] text-white active:scale-95 text-xs font-black py-2 rounded-xl cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-100 shrink-0" />
                          <span>تم السداد بالكامل</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = await confirmDialog(`سماح بالمبلغ المتبقي: سيتم ترحيل الدورة الحالية مع إسقاط المبلغ المتبقي ${formatNum(netRemaining)}ج.م من المديونية (لن يُضاف كدين في الدورة التالية). هل أنت متأكد؟`);
                            if (confirmed) {
                              setIsArchiving(true);
                              try {
                                const currentLoads = factoryLoads.filter(l => new Date(l.date).getTime() > lastArchiveTimestamp).map(l => {
                                  const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                                  const weights = prod ? getProductWeightsFallback(prod) : [];
                                  const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim());
                                  const unitsPerCarton = weight?.unitsPerCarton || 12;
                                  const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor(l.quantity / unitsPerCarton);
                                  const loose = l.looseUnitsCount !== undefined ? l.looseUnitsCount : (l.quantity % unitsPerCarton);
                                  const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
                                  const unitPrice = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
                                  return {
                                    date: l.date, productName: prod?.name || l.productName || 'غير معروف',
                                    weightSize: weight?.size || (l as any).weightSize || '', cartons, loose,
                                    cartonPrice, subtotal: (cartons * cartonPrice) + (loose * unitPrice),
                                    advanceAmount: l.advanceAmount ?? 0, delegateName: l.delegateName || ''
                                  };
                                });
                                const currentPayments = totalFactoryPayments.map(p => {
                                  let parsed: any = {};
                                  try { parsed = JSON.parse(p.description || '{}'); } catch {}
                                  return {
                                    id: p.id, amount: p.amount, date: p.date, notes: parsed.notes || '',
                                    recipient: parsed.recipient || '', delegateName: p.delegateName || '',
                                    delegatePhone: p.delegatePhone || '', appliedToCarriedDebt: parsed.appliedToCarriedDebt || 0
                                  };
                                });
                                const rawSum = currentLoads.reduce((s, l) => s + l.subtotal, 0);
                                const newCycle = {
                                  id: Date.now().toString(),
                                  settledAt: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
                                  loads: currentLoads,
                                  payments: currentPayments,
                                  rawLoadedValue: rawSum,
                                  totalWithdrawnValue: totalFactoryBalanceDetails.totalWithdrawnValue,
                                  totalAdvancePayments: totalFactoryBalanceDetails.totalAdvancePayments,
                                  creditBalance: 0,
                                  carriedOverDebtAtTime: carriedOverDebt,
                                  waivedAmount: netRemaining
                                };
                                setArchiveCycles(prev => [...prev, newCycle]);
                                setCarriedOverDebt(0);
                                setCarriedOverDebtDate('');
                                if (onArchiveFactoryCycle) {
                                  const finalPhone = selectedDelegatePhone || factoryDelegateFilter || currentUser?.phone || '';
                                  const finalName = selectedDelegatePhone ? (archiveDelegates.find(d => d.phone === selectedDelegatePhone)?.name || currentUser?.name || 'مجهول') : (factoryDelegateFilter ? (archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter)?.name || 'مجهول') : 'مجهول');
                                  onArchiveFactoryCycle(finalPhone, finalName);
                                } else {
                                  const loadsToArchive = factoryLoads.filter(l => new Date(l.date).getTime() > lastArchiveTimestamp);
                                  for (const load of loadsToArchive) { onDeleteLoad(load.id); }
                                  const currentExpenses = expenses.filter(e =>
                                    (e.category === 'سداد للمصنع' || e.type === 'factory_payment') && new Date(e.date).getTime() > lastArchiveTimestamp);
                                  for (const exp of currentExpenses) { onDeleteExpense(exp.id); }
                                }
                                showToast("✓ تم ترحيل الدورة مع السماح بالمبلغ المتبقي!");
                              } catch (err) {
                                console.error(err);
                                showToast("❌ حدث خطأ أثناء الترحيل!");
                              } finally {
                                setIsArchiving(false);
                              }
                            }
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-white active:scale-95 text-xs font-black py-2 rounded-xl cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <span>سماح بالمبلغ المتبقي وترحيل</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                // Balance is zero or negative (credit)
                return (
                  <div className="bg-emerald-50 border border-emerald-200 p-4.5 rounded-2xl shadow-sm flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-emerald-950 block">الحساب المالي صفر ومصفّر</span>
                        <p className="text-[10px] text-slate-500 font-bold">ليست هناك أي مبالغ أو استحقاقات متبقية معلقة لصالح المصنع حاليا.</p>
                      </div>
                    </div>

                    {creditBalance > 0 && (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                        <span className="text-[10px] block font-bold text-amber-700 mb-1">رصيد دائن للمصنع (قابل للخصم من العمليات القادمة)</span>
                        <span className="text-xl font-black font-mono text-amber-600">
                          {formatNum(creditBalance)} <span className="text-xs">ج.م</span>
                        </span>
                      </div>
                    )}

                    {isManager && factoryDelegateFilter === 'all' ? (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center text-xs font-bold text-amber-800">
                        ⚠️ يرجى تحديد مندوب معين لتتمكن من ترحيل دورته الماليّة للأرشيف. لا يمكن ترحيل حسابات كل المناديب معاً.
                      </div>
                    ) : (
                      isSettledAndCanArchive && (
                        <button
                          type="button"
                          disabled={isArchiving}
                          onClick={async () => {
                            if (isArchiving) return;
                            const credit = creditBalance;
                            const confirmed = await confirmDialog(credit > 0
                              ? `ترحيل الدورة للأرشيف:\n• سيتم حفظ جميع البيانات الحالية (حمولات + مبيعات + دفعات)\n• سيتم صفراء الشاشات للبدء بدورة جديدة\n• الفائض ${formatNum(credit)}ج.م سيُضاف كرصيد يخصم من الدورة التالية\n\nهل أنت متأكد؟`
                              : `ترحيل الدورة للأرشيف:\n• سيتم حفظ جميع البيانات الحالية (حمولات + مبيعات + دفعات)\n• سيتم صفراء الشاشات للبدء بدورة جديدة\n\nهل أنت متأكد؟`
                            );
                            if (confirmed) {
                              setIsArchiving(true);
                              try {
                                // Build archive snapshot from current data — use ALL loads and ALL payments
                                const currentLoads = factoryLoads.filter(l => new Date(l.date).getTime() > lastArchiveTimestamp).map(l => {
                                  const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                                  const weights = prod ? getProductWeightsFallback(prod) : [];
                                  const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim());
                                  const unitsPerCarton = weight?.unitsPerCarton || 12;
                                  const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor(l.quantity / unitsPerCarton);
                                  const loose = l.looseUnitsCount !== undefined ? l.looseUnitsCount : (l.quantity % unitsPerCarton);
                                  const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
                                  const unitPrice = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
                                  return {
                                    date: l.date, productName: prod?.name || l.productName || 'غير معروف',
                                    weightSize: weight?.size || (l as any).weightSize || '', cartons, loose,
                                    cartonPrice, subtotal: (cartons * cartonPrice) + (loose * unitPrice),
                                    advanceAmount: l.advanceAmount ?? 0, delegateName: l.delegateName || ''
                                  };
                                });
                                const currentPayments = totalFactoryPayments.map(p => {
                                  let parsed: any = {};
                                  try { parsed = JSON.parse(p.description || '{}'); } catch {}
                                  return {
                                    id: p.id, amount: p.amount, date: p.date, notes: parsed.notes || '',
                                    recipient: parsed.recipient || '', delegateName: p.delegateName || '',
                                    delegatePhone: p.delegatePhone || '', appliedToCarriedDebt: parsed.appliedToCarriedDebt || 0
                                  };
                                });
                                const rawSum = currentLoads.reduce((s, l) => s + l.subtotal, 0);
                                const trueCredit = Math.max(0, totalFactoryBalanceDetails.totalAdvancePayments - totalFactoryBalanceDetails.totalWithdrawnValue - carriedOverDebt);
                                const newCycle = {
                                  id: Date.now().toString(),
                                  settledAt: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
                                  loads: currentLoads,
                                  payments: currentPayments,
                                  rawLoadedValue: rawSum,
                                  totalWithdrawnValue: totalFactoryBalanceDetails.totalWithdrawnValue,
                                  totalAdvancePayments: totalFactoryBalanceDetails.totalAdvancePayments,
                                  creditBalance: trueCredit,
                                  carriedOverDebtAtTime: carriedOverDebt
                                };
                                setArchiveCycles(prev => [...prev, newCycle]);
                                setCarriedOverDebt(trueCredit > 0 ? -trueCredit : 0);
                                setCarriedOverDebtDate('');
                                
                                if (onArchiveFactoryCycle) {
                                  const finalPhone = selectedDelegatePhone || factoryDelegateFilter || currentUser?.phone || '';
                                  const finalName = selectedDelegatePhone ? (archiveDelegates.find(d => d.phone === selectedDelegatePhone)?.name || currentUser?.name || 'مجهول') : (factoryDelegateFilter ? (archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter)?.name || 'مجهول') : 'مجهول');
                                  onArchiveFactoryCycle(finalPhone, finalName);
                                } else {
                                  // Mark all current factory loads as archived via parent handler (fallback)
                                  const loadsToArchive = factoryLoads.filter(l => new Date(l.date).getTime() > lastArchiveTimestamp);
                                  for (const load of loadsToArchive) { onDeleteLoad(load.id); }
                                  const currentExpenses = expenses.filter(e =>
                                    (e.category === 'سداد للمصنع' || e.type === 'factory_payment') && new Date(e.date).getTime() > lastArchiveTimestamp);
                                  for (const exp of currentExpenses) { onDeleteExpense(exp.id); }
                                }
                                showToast("✓ تم أرشفة الدورة بنجاح! الشاشات جاهزة لدورة جديدة. يمكنك مراجعة الدورة في تبويب الأرشيف.");
                              } catch (err) {
                                console.error(err);
                                showToast("❌ حدث خطأ أثناء الأرشفة!");
                              } finally {
                                setIsArchiving(false);
                              }
                            }
                          }}
                          className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white active:scale-95 text-xs font-black py-2.5 rounded-xl cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 shadow-md animate-pulse"
                        >
                          <Archive className="h-4 w-4 text-violet-200 shrink-0" />
                          <span>ترحيل للأرشيف</span>
                        </button>
                      )
                    )}
                  </div>
                );
              })()}

            </div>

            {/* List of registered Payments to Factory direct */}
            {currentCycleExtraPayments.length > 0 && (
              <div className="bg-[#FFFFFF] p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <span className="text-xs font-black text-[#1A365D] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <History className="h-4.5 w-4.5 text-emerald-505 animate-pulse" />
                  أرشيف الدفعات النقدية والمسددات المباشرة للمورد
                </span>
                <div className="grid grid-cols-5 bg-slate-50 border border-slate-200 p-1 rounded-xl text-center gap-1">
                  <button type="button" onClick={() => { setCurrentPaymentsFilter('all'); setCurrentPaymentsDayFilters([]); }} className={`py-1 px-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${currentPaymentsFilter === 'all' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>الكل ({currentCycleExtraPayments.length})</button>
                  <button type="button" onClick={() => { setCurrentPaymentsFilter('daily'); setCurrentPaymentsDayFilters([]); }} className={`py-1 px-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${currentPaymentsFilter === 'daily' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>يومي</button>
                  <button type="button" onClick={() => { setCurrentPaymentsFilter('weekly'); setCurrentPaymentsDayFilters([]); }} className={`py-1 px-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${currentPaymentsFilter === 'weekly' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>أسبوعي</button>
                  <button type="button" onClick={() => { setCurrentPaymentsFilter('monthly'); setCurrentPaymentsDayFilters([]); }} className={`py-1 px-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${currentPaymentsFilter === 'monthly' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>شهري</button>
                  <button type="button" onClick={() => { setCurrentPaymentsFilter('custom'); setCurrentPaymentsDayFilters([]); }} className={`py-1 px-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${currentPaymentsFilter === 'custom' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>مخصص</button>
                </div>
                {currentPaymentsFilter === 'weekly' && (
                  <div className="flex flex-wrap gap-1">
                    {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(day => {
                      const arDay = day === 'Sunday' ? 'أحد' : day === 'Monday' ? 'إثنين' : day === 'Tuesday' ? 'ثلاثاء' : day === 'Wednesday' ? 'أربعاء' : day === 'Thursday' ? 'خميس' : day === 'Friday' ? 'جمعة' : 'سبت';
                      const isActive = currentPaymentsDayFilters.includes(day);
                      return (
                        <button key={day} type="button" onClick={() => {
                          setCurrentPaymentsDayFilters(prev => isActive ? prev.filter(d => d !== day) : [...prev, day]);
                        }} className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${isActive ? 'bg-[#DD6B20] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{arDay}</button>
                      );
                    })}
                  </div>
                )}
                {currentPaymentsFilter === 'custom' && (
                  <div className="flex gap-2">
                    <div className="flex-1"><label className="block text-[9px] text-gray-400 font-bold mb-0.5">من تاريخ</label><input type="date" value={currentPaymentsStartDate} onChange={(e) => setCurrentPaymentsStartDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 text-[10px] font-bold text-[#1A365D]" /></div>
                    <div className="flex-1"><label className="block text-[9px] text-gray-400 font-bold mb-0.5">إلى تاريخ</label><input type="date" value={currentPaymentsEndDate} onChange={(e) => setCurrentPaymentsEndDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 text-[10px] font-bold text-[#1A365D]" /></div>
                  </div>
                )}
                {currentPaymentsFilter !== 'all' && filteredCurrentPayments.length > 0 && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => {
                      const filterLabel = currentPaymentsFilter === 'daily' ? 'يومي' : currentPaymentsFilter === 'weekly' ? 'أسبوعي' : currentPaymentsFilter === 'monthly' ? 'شهري' : 'مخصص';
                      const total = filteredCurrentPayments.reduce((s, p) => s + p.amount, 0);
                      let html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
                      <div style="padding:12mm 14mm">
                        <div class="rh">
                          <h1>سجل الدفعات — فلتر: ${filterLabel}</h1>
                          <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
                          <div class="ref">
                            <span>عدد الدفعات: ${filteredCurrentPayments.length}</span>
                            <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</span>
                          </div>
                        </div>
                        <table><thead><tr><th>م</th><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>المندوب</th><th>المستلم</th></tr></thead><tbody>
                        ${filteredCurrentPayments.map((p, i) => `<tr><td style="text-align:center">${i + 1}</td><td style="text-align:center">${p.date}</td><td style="text-align:right">${p.notes || 'تسديد مباشر'}</td><td style="text-align:center;font-weight:bold;color:#059669">${formatNum(p.amount)} ج.م</td><td style="text-align:center">${p.delegateName || '-'}</td><td style="text-align:center">${p.recipient || '-'}</td></tr>`).join('')}
                        </tbody></table>
                        <div class="ts" style="padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:800;font-size:12px;margin-bottom:14px">
                          <span>إجمالي الدفعات</span>
                          <span>${formatNum(total)} ج.م</span>
                        </div>
                        <div class="fs" style="margin-top:30px">
                          <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
                          <div class="sb2"><div class="ti">مندوب المبيعات</div><div class="ln">التوقيع</div></div>
                        </div>
                      </div>
                      </body></html>`;
                      const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
                    }} className="flex-1 bg-indigo-700 hover:bg-indigo-800 text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"><Printer className="h-3 w-3" /> PDF</button>
                    <button type="button" onClick={() => {
                      const filterLabel = currentPaymentsFilter === 'daily' ? 'يومي' : currentPaymentsFilter === 'weekly' ? 'أسبوعي' : currentPaymentsFilter === 'monthly' ? 'شهري' : 'مخصص';
                      const total = filteredCurrentPayments.reduce((s, p) => s + p.amount, 0);
                      const W = 700; const padX = 20; const rowH = 32; const headerH = 80; const footerH = 40;
                      const totalH = headerH + 10 + filteredCurrentPayments.length * rowH + 50 + footerH + 20;
                      const canvas = document.createElement('canvas'); const dpr = window.devicePixelRatio || 1;
                      canvas.width = W * dpr; canvas.height = totalH * dpr; canvas.style.width = W + 'px'; canvas.style.height = totalH + 'px';
                      const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(dpr, dpr);
                      ctx.fillStyle = '#faf8f5'; ctx.fillRect(0, 0, W, totalH); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, W - 12, totalH - 12);
                      ctx.fillStyle = '#1e2a4a'; ctx.fillRect(10, 10, W - 20, headerH); ctx.fillStyle = '#d4a843'; ctx.fillRect(10, 10 + headerH - 3, W - 20, 3);
                      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 18px system-ui, sans-serif';
                      ctx.fillText(`سجل الدفعات — فلتر: ${filterLabel}`, W / 2, 40);
                      ctx.font = '500 11px system-ui, sans-serif'; ctx.fillStyle = '#93c5fd';
                      ctx.fillText(`${filteredCurrentPayments.length} دفعة | إجمالي: ${formatNum(total)} ج.م`, W / 2, 58);
                      ctx.font = '10px system-ui, sans-serif'; ctx.fillStyle = '#cbd5e1';
                      ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}`, W / 2, 72);
                      let y = headerH + 15;
                      ctx.fillStyle = '#1e2a4a'; ctx.fillRect(padX, y, W - padX * 2, 20); ctx.fillStyle = '#ffffff';
                      ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
                      const cols = [padX + 20, padX + 100, padX + 250, padX + 370, padX + 470, padX + 560];
                      ['م', 'التاريخ', 'البيان', 'المبلغ', 'المندوب', 'المستلم'].forEach((h, i) => { ctx.fillText(h, cols[i] + 40, y + 14); });
                      y += 22;
                      filteredCurrentPayments.forEach((p, i) => {
                        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
                        ctx.fillRect(padX, y, W - padX * 2, rowH); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5; ctx.strokeRect(padX, y, W - padX * 2, rowH);
                        ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.font = '10px system-ui, sans-serif';
                        ctx.fillText(String(i + 1), cols[0] + 40, y + 20); ctx.fillText(p.date || '', cols[1] + 40, y + 20);
                        ctx.textAlign = 'right'; ctx.fillText(p.notes || 'تسديد مباشر', cols[2] + 80, y + 20);
                        ctx.fillStyle = '#059669'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
                        ctx.fillText(`${formatNum(p.amount)} ج.م`, cols[3] + 40, y + 20);
                        ctx.fillStyle = '#1a1a1a'; ctx.font = '10px system-ui, sans-serif';
                        ctx.fillText(p.delegateName || '-', cols[4] + 40, y + 20); ctx.fillText(p.recipient || '-', cols[5] + 40, y + 20);
                        y += rowH;
                      });
                      y += 5; ctx.fillStyle = '#1e2a4a'; ctx.fillRect(padX, y, W - padX * 2, 30); ctx.fillStyle = '#ffffff';
                      ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
                      ctx.fillText(`إجمالي الدفعات: ${formatNum(total)} ج.م`, W / 2, y + 20);
                      y += 40; ctx.fillStyle = '#94a3b8'; ctx.font = '10px system-ui, sans-serif';
                      ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);
                      const link = document.createElement('a'); link.download = `دفعات_${filterLabel}_${new Date().toISOString().substring(0, 10)}.png`;
                      link.href = canvas.toDataURL('image/png'); link.click();
                    }} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"><Image className="h-3 w-3" /> صورة</button>
                  </div>
                )}
                <div className="max-h-36 overflow-y-auto custom-scroll flex flex-col gap-2">
                  {filteredCurrentPayments.map(pay => (
                    <div key={pay.id} className="bg-[#F7FAFC] border border-slate-100 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-[#1A365D] shadow-inner">
                      {editingPaymentId === pay.id ? (
                        <div className="flex flex-col gap-2 w-full p-2 bg-indigo-50/40 rounded-lg border border-indigo-100 animate-fade-in text-right">
                          <div className="flex gap-2">
                            <div className="w-1/3 flex flex-col gap-1">
                              <label className="text-[9px] text-slate-500 font-bold">مبلغ السداد:</label>
                              <input
                                type="number"
                                placeholder="مبلغ السداد"
                                value={editingPaymentAmount}
                                onChange={(e) => setEditingPaymentAmount(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="w-2/3 flex flex-col gap-1">
                              <label className="text-[9px] text-slate-500 font-bold">البيان / ملاحظات:</label>
                              <input
                                type="text"
                                placeholder="البيان"
                                value={editingPaymentNotes}
                                onChange={(e) => setEditingPaymentNotes(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="w-1/2 flex flex-col gap-1">
                              <label className="text-[9px] text-slate-500 font-bold">مستلم السداد:</label>
                              <input
                                type="text"
                                placeholder="مستلم السداد"
                                value={editingPaymentRecipient}
                                onChange={(e) => setEditingPaymentRecipient(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="w-1/2 flex flex-col gap-1">
                              <label className="text-[9px] text-slate-500 font-bold">تغيير المندوب المستهدف:</label>
                              {isManager ? (
                                <select
                                  value={editingPaymentDelegate}
                                  onChange={(e) => setEditingPaymentDelegate(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500"
                                >
                                  <option value="">-- اختر المندوب --</option>
                                  <option value="admin">المدير العام (سداد عام مباشر)</option>
                                  {archiveDelegates.map(d => {
                                    const phoneKey = d.phone !== 'مجهول' ? d.phone : d.name;
                                    return (
                                      <React.Fragment key={phoneKey}>
                                        <option value={phoneKey}>
                                          المندوب: {d.name} (سداد مباشر)
                                        </option>
                                        <option value={`gm_on_behalf_${phoneKey}`}>
                                          المدير العام (نيابة عن: {d.name})
                                        </option>
                                      </React.Fragment>
                                    );
                                  })}
                                </select>
                              ) : (
                                <div className="p-1.5 text-slate-500 text-xs font-bold bg-slate-100 rounded border border-slate-200">{pay.delegateName}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => setEditingPaymentId(null)}
                              className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold cursor-pointer transition-all active:scale-95"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const amount = parseFloat(editingPaymentAmount);
                                if (!amount || amount <= 0) {
                                  showToast("⚠️ يرجى إدخال قيمة صحيحة للدفعة المالية!");
                                  return;
                                }

                                if (isManager && !editingPaymentDelegate) {
                                  showToast("⚠️ يرجى اختيار المندوب المستهدف بالسداد!");
                                  return;
                                }

                                if (onEditExpense) {
                                  let finalPhone = '';
                                  let finalName = '';
                                  let noteText = editingPaymentNotes.trim();

                                  if (!isManager) {
                                    finalPhone = pay.delegatePhone || '';
                                    finalName = pay.delegateName || 'مجهول';
                                  } else {
                                    if (editingPaymentDelegate === 'admin') {
                                      finalPhone = 'admin';
                                      finalName = 'المدير العام';
                                    } else if (editingPaymentDelegate.startsWith('gm_on_behalf_')) {
                                      const actualPhone = editingPaymentDelegate.replace('gm_on_behalf_', '');
                                      const targetDel = archiveDelegates.find(d => d.phone === actualPhone || d.name === actualPhone);
                                      finalPhone = targetDel ? targetDel.phone : actualPhone;
                                      finalName = targetDel ? targetDel.name : 'مجهول';
                                      
                                      const baseNote = noteText.replace(/\s*\(سداد بواسطة المدير العام نيابة عن المندوب\)/g, '').trim();
                                      noteText = `${baseNote || 'تسديد مباشر'} (سداد بواسطة المدير العام نيابة عن المندوب)`;
                                    } else {
                                      const targetDel = archiveDelegates.find(d => d.phone === editingPaymentDelegate || d.name === editingPaymentDelegate);
                                      finalPhone = targetDel ? targetDel.phone : editingPaymentDelegate;
                                      finalName = targetDel ? targetDel.name : 'مجهول';
                                      noteText = noteText.replace(/\s*\(سداد بواسطة المدير العام نيابة عن المندوب\)/g, '').trim();
                                    }
                                  }

                                  onEditExpense(pay.id, {
                                    amount,
                                    description: JSON.stringify({
                                      notes: noteText || 'تسديد مباشر',
                                      appliedToCarriedDebt: pay.appliedToCarriedDebt || 0,
                                      recipient: editingPaymentRecipient.trim()
                                    }),
                                    delegateName: finalName,
                                    delegatePhone: finalPhone
                                  });

                                  setEditingPaymentId(null);
                                  showToast("✓ تم تعديل دفعة السداد بنجاح!");
                                } else {
                                  showToast("⚠️ غير مسموح بتعديل الدفعات في هذا الوضع!");
                                }
                              }}
                              className="px-3 py-1 rounded bg-[#DD6B20] hover:bg-[#C05621] text-white text-[10px] font-bold cursor-pointer transition-all active:scale-95"
                            >
                              حفظ التعديل
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col gap-0.5 text-right">
                            <span className="text-[#DD6B20] font-extrabold">{formatNum(pay.amount)}ج.م</span>
                            <span className="text-[10px] text-[#2B6CB0] font-medium">{pay.date}</span>
                            <span className="text-[9.5px] text-slate-600 leading-relaxed">📝 {pay.notes || 'تسديد مباشر'}{pay.delegateName ? ` • 👤 ${pay.delegateName}` : ''}</span>
                            {pay.recipient ? <span className="text-[9px] text-indigo-600">👤 مستلم: السيد / {pay.recipient}</span> : null}
                            {(pay.appliedToCarriedDebt || 0) > 0 && <span className="text-[9px] text-amber-600">🔄 مسدد من المديونية السابقة: {formatNum(pay.appliedToCarriedDebt)}ج.م</span>}
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPaymentId(pay.id);
                                setEditingPaymentAmount(String(pay.amount));
                                setEditingPaymentNotes(pay.notes || '');
                                setEditingPaymentRecipient(pay.recipient || '');
                                
                                const isGmOnBehalf = pay.notes && pay.notes.includes('نيابة عن المندوب');
                                let currentVal = pay.delegatePhone || pay.delegateName || '';
                                if (currentVal === 'admin') {
                                  setEditingPaymentDelegate('admin');
                                } else if (isGmOnBehalf) {
                                  setEditingPaymentDelegate(`gm_on_behalf_${currentVal}`);
                                } else {
                                  setEditingPaymentDelegate(currentVal);
                                }
                              }}
                              className="text-indigo-600 hover:text-indigo-800 bg-[#FFFFFF] hover:bg-indigo-50 p-1.5 rounded-lg border border-slate-200 cursor-pointer transition-all active:scale-95"
                              title="تعديل دفعة السداد"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteExpense(pay.id)}
                              className="text-rose-500 hover:text-rose-700 bg-[#FFFFFF] hover:bg-rose-50 p-1.5 rounded-lg border border-slate-200 cursor-pointer transition-all active:scale-95"
                              title="حذف دفعة السداد"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Print & share Button */}
            <button
              type="button"
              onClick={handleDownloadFactoryLedgerImage}
              className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent active:scale-95 text-white rounded-xl py-3 text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Image className="h-4.5 w-4.5" />
              <span>تنزيل كشف حساب المصنع المالي للإدارة (صورة)</span>
            </button>

            {/* حركة البضاعة - فلتر مشترك + لوحتين */}
            <div className="flex flex-col gap-4 font-sans">
              
              {/* فلتر الفترة الزمنية المشترك */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500">الفترة الزمنية:</span>
                  <div className="grid grid-cols-5 bg-slate-50 border border-slate-200 p-1 rounded-xl text-center gap-1 flex-1">
                    <button type="button" onClick={() => { setAccountLoadsFilter('all'); setAccountLoadsDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${accountLoadsFilter === 'all' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>الكل</button>
                    <button type="button" onClick={() => { setAccountLoadsFilter('daily'); setAccountLoadsDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${accountLoadsFilter === 'daily' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>يومي</button>
                    <button type="button" onClick={() => { setAccountLoadsFilter('weekly'); setAccountLoadsDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${accountLoadsFilter === 'weekly' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>أسبوعي</button>
                    <button type="button" onClick={() => { setAccountLoadsFilter('monthly'); setAccountLoadsDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${accountLoadsFilter === 'monthly' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>شهري</button>
                    <button type="button" onClick={() => { setAccountLoadsFilter('custom'); setAccountLoadsDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${accountLoadsFilter === 'custom' ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>مخصص</button>
                  </div>
                  <div className="flex gap-1.5 mr-auto">
                    <button type="button" onClick={() => exportAccountLoads('png')} className="bg-indigo-50 text-indigo-700 p-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors" title="تنزيل صورة">
                      <Image className="w-3.5 h-3.5"/>
                    </button>
                    <button type="button" onClick={() => exportAccountLoads('pdf')} className="bg-rose-50 text-rose-700 p-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors" title="تنزيل PDF">
                      <FileText className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
                {accountLoadsFilter === 'custom' && (
                  <div className="flex gap-1.5">
                    <input type="date" value={accountLoadsStartDate} onChange={e => setAccountLoadsStartDate(e.target.value)} className="bg-white border border-slate-200 rounded p-1 text-[10px]" />
                    <input type="date" value={accountLoadsEndDate} onChange={e => setAccountLoadsEndDate(e.target.value)} className="bg-white border border-slate-200 rounded p-1 text-[10px]" />
                  </div>
                )}
                {accountLoadsFilter === 'weekly' && (
                  <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden flex-wrap gap-px p-0.5 animate-fade-in" dir="rtl">
                    <button type="button" onClick={() => setAccountLoadsDayFilters([])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${accountLoadsDayFilters.length === 0 ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>الكل</button>
                    {[['Saturday', 'السبت'], ['Sunday', 'الأحد'], ['Monday', 'الإثنين'], ['Tuesday', 'الثلاثاء'], ['Wednesday', 'الأربعاء'], ['Thursday', 'الخميس'], ['Friday', 'الجمعة']].map(([en, ar]) => (
                      <button key={en} type="button" onClick={() => setAccountLoadsDayFilters(prev => prev.includes(en) ? prev.filter(d => d !== en) : [...prev, en])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${accountLoadsDayFilters.includes(en) ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>{ar}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* اللوحات */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
                {/* لوحة 1: حركة البضاعة المسحوبة من المصنع */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                  <h4 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Truck className="h-4.5 w-4.5 text-[#2B6CB0]" />
                    حركة البضاعة المسحوبة من المصنع
                  </h4>

                  <div className="max-h-80 overflow-y-auto custom-scroll flex flex-col gap-2.5">
                    {accountLoadsSummary.length === 0 ? (
                      <p className="text-center text-gray-400 py-6 text-xs font-medium">لا توجد مسحوبات مسجلة.</p>
                    ) : (
                      accountLoadsSummary.map((item, idx) => (
                        <div key={'with_' + item.id + '_' + idx} className="bg-[#F7FAFC] border border-slate-100 rounded-xl p-3.5 flex flex-col gap-2 text-xs">
                          <div className="font-bold text-[#1A365D] text-[11px]">{item.productName} ({item.size})</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full text-[10px] font-bold">مُحمّل: {item.loaded}</span>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold">مُبيعي: {item.sold}</span>
                            <span className={`${item.remaining > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'} px-2 py-0.5 rounded-full text-[10px] font-bold`}>مُتبقي: {item.remaining}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            سعر الكرتونة من المصنع: <strong className="text-[#1A365D]">{formatNum(item.loaded > 0 ? item.loadedValue / item.loaded : 0)} ج.م</strong>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {accountLoadsSummary.length > 0 && (
                    <div className="bg-[#1A365D] text-white rounded-xl p-3 flex justify-between items-center text-xs font-bold">
                      <span>إجمالي قيمة البضاعة المسحوبة</span>
                      <span className="font-mono">{formatNum(accountLoadsSummary.reduce((s, i) => s + i.loadedValue, 0))} ج.م</span>
                    </div>
                  )}
                </div>

                {/* لوحة 2: حركة البضاعة المباعة للعملاء بالسيارة */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                  <h4 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <CirclePercent className="h-4.5 w-4.5 text-emerald-500" />
                    حركة البضاعة المباعة للعملاء بالسيارة
                  </h4>

                  <div className="max-h-80 overflow-y-auto custom-scroll flex flex-col gap-2.5">
                    {Object.keys(filteredSoldCounts).length === 0 ? (
                      <p className="text-center text-gray-400 py-6 text-xs font-medium">لا توجد مبيعات مسجلة في الفواتير حتى الآن.</p>
                    ) : (
                      Object.entries(filteredSoldCounts).map(([weightId, val]) => {
                        const info = val as { cartons: number; units: number; value: number; factoryValue: number };
                        let pName = 'منتج غير محدد';
                        let sizeStr = 'عبوة مجهولة';
                        let unitsPerC = 12;

                        products.forEach(p => {
                          const weights = getProductWeightsFallback(p);
                          const weight = weights.find(w => w.id === weightId);
                          if (weight) {
                            pName = p.name;
                            sizeStr = weight.size;
                            unitsPerC = weight.unitsPerCarton || 12;
                          }
                        });

                        return (
                          <div key={'sold_' + weightId} className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 flex flex-col gap-2 text-xs">
                            <div className="font-bold text-emerald-950 text-[11px]">{pName} ({sizeStr})</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">إجمالي المبيعات: {Math.floor(info.units / unitsPerC)} كرتونة</span>
                              <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full text-[10px] font-bold">المبيع الفردي: {info.units} عبوة</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              تقيئة البيع: الإجمالي <strong className="text-[#DD6B20] font-mono">{formatNum(info.value)} ج.م</strong>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {Object.keys(filteredSoldCounts).length > 0 && (
                    <div className="bg-emerald-600 text-white rounded-xl p-3 flex justify-between items-center text-xs font-bold">
                      <span>إجمالي قيمة المبيعات</span>
                      <span className="font-mono">{formatNum(Object.values(filteredSoldCounts).reduce((s, v) => s + (v as any).value, 0))} ج.م</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* ⭐ قسم جرد السيارة */}
            <div className="bg-gradient-to-br from-[#EBF4FF] to-[#E9F5FE] p-5 rounded-2xl border border-[#BEE3F8] shadow-sm flex flex-col gap-3 mt-5">
              <div className="flex items-center justify-between border-b border-[#BEE3F8] pb-2">
                <h4 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5">
                  <Package className="h-4.5 w-4.5 text-[#2B6CB0]" />
                  جرد البضاعة في السيارة (بالكرتونة)
                </h4>
                <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-[#BEE3F8] text-right">
                  <span className="text-[10px] font-bold text-[#2B6CB0]">الفترة:</span>
                  <select value={inventoryFilter} onChange={e => { setInventoryFilter(e.target.value as any); setInventoryDayFilters([]); }} className="bg-white border border-[#BEE3F8] rounded p-1 text-[11px] font-bold outline-none focus:ring-1 focus:ring-[#2B6CB0]">
                    <option value="all">الكل</option>
                    <option value="daily">اليوم</option>
                    <option value="weekly">الأسبوع</option>
                    <option value="monthly">الشهر</option>
                    <option value="custom">مخصص</option>
                  </select>
                  {inventoryFilter === 'custom' && (
                    <div className="flex gap-1.5">
                      <input type="date" value={inventoryStartDate} onChange={e => setInventoryStartDate(e.target.value)} className="bg-white border border-[#BEE3F8] rounded p-1 text-[10px]" />
                      <input type="date" value={inventoryEndDate} onChange={e => setInventoryEndDate(e.target.value)} className="bg-white border border-[#BEE3F8] rounded p-1 text-[10px]" />
                    </div>
                  )}
                </div>
                {inventoryFilter === 'weekly' && (
                  <div className="flex bg-white border border-[#BEE3F8] rounded-lg overflow-hidden flex-wrap gap-px p-0.5" dir="rtl">
                    <button type="button" onClick={() => setInventoryDayFilters([])} className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${inventoryDayFilters.length === 0 ? 'bg-[#2B6CB0] text-white' : 'bg-white text-[#2B6CB0] hover:bg-[#EBF4FF]'}`}>الكل</button>
                    {[['Saturday', 'السبت'], ['Sunday', 'الأحد'], ['Monday', 'الإثنين'], ['Tuesday', 'الثلاثاء'], ['Wednesday', 'الأربعاء'], ['Thursday', 'الخميس'], ['Friday', 'الجمعة']].map(([en, ar]) => (
                      <button key={en} type="button" onClick={() => setInventoryDayFilters(prev => prev.includes(en) ? prev.filter(d => d !== en) : [...prev, en])} className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${inventoryDayFilters.includes(en) ? 'bg-[#2B6CB0] text-white' : 'bg-white text-[#2B6CB0] hover:bg-[#EBF4FF]'}`}>{ar}</button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const canvas = document.createElement('canvas');
                    const dpr = window.devicePixelRatio || 1;
                    const W = 920;
                    const padX = 30;
                    const tableW = W - padX * 2;
                    const rowH = 38;
                    const headerH = 110;
                    const summaryRowH = 36;
                    const bottomBoxH = 120;
                    const footerH = 50;

                    const visibleRows = Object.entries(weightStocksInCartons).filter(([key, stock]) => {
                      if (stock.loaded === 0 && stock.sold === 0) return false;
                      return true;
                    });
                    const dataRows = visibleRows.length;
                    const totalH = 24 + headerH + 32 + (dataRows * rowH) + summaryRowH + 12 + bottomBoxH + footerH + 24;
                    canvas.width = W * dpr;
                    canvas.height = totalH * dpr;
                    canvas.style.width = W + 'px';
                    canvas.style.height = totalH + 'px';
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    ctx.scale(dpr, dpr);

                    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
                      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
                      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
                      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
                      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
                      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
                    };

                    ctx.fillStyle = '#faf8f5';
                    ctx.fillRect(0, 0, W, totalH);

                    ctx.strokeStyle = '#1a1a1a';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(8, 8, W-16, totalH-16);

                    roundRect(ctx, 12, 12, W-24, headerH, 6);
                    ctx.fillStyle = '#1e2a4a';
                    ctx.fill();
                    ctx.fillStyle = '#d4a843';
                    ctx.fillRect(12, 12 + headerH - 4, W-24, 4);

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 22px system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('جرد البضاعة في السيارة', W/2, 12 + 38);
                    ctx.fillStyle = '#93c5fd';
                    ctx.font = '500 12px system-ui, sans-serif';
                    ctx.fillText('المخزون الحالي بالكرتونة', W/2, 12 + 58);
                    ctx.fillStyle = '#cbd5e1';
                    ctx.font = '12px system-ui, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(`التاريخ: ${new Date().toLocaleDateString('ar-EG')}`, W - padX - 10, 12 + 80);
                    ctx.textAlign = 'left';
                    ctx.fillStyle = '#fbbf24';
                    ctx.font = 'bold 12px system-ui, sans-serif';
                    ctx.fillText(`عدد الأصناف: ${visibleRows.length}`, padX + 10, 12 + 80);

                    const tableY = 24 + headerH;
                    const headers = ['م', 'المنتج', 'الحجم', 'التحميل (كرتونة)', 'المبيع (كرتونة)', 'المتبقي (كرتونة)'];
                    const colXs = [padX + tableW - 35, padX + tableW - 135, padX + tableW - 265, padX + tableW - 420, padX + tableW - 570, padX + tableW - 720];

                    ctx.fillStyle = '#2c3e6b';
                    ctx.fillRect(padX, tableY, tableW, 32);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 12px system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    headers.forEach((h, i) => { ctx.fillText(h, colXs[i], tableY + 21); });

                    let y = tableY + 32;
                    let totalLoaded = 0, totalSold = 0, totalRemaining = 0;
                    visibleRows.forEach(([key, stock], idx) => {
                      const [prodId, weightId] = key.split('_');
                      const prod = products.find(p => p.id === prodId);
                      const weights = prod ? getProductWeightsFallback(prod) : [];
                      const w = weights.find(wt => wt.id === weightId);
                      let displayName = prod ? prod.name : '';
                      let displaySize = w ? w.size : '';
                      if (!displayName || !displaySize) {
                        const refLoad = factoryLoads.find(l => String(l.productId).trim() === prodId && String(l.weightId || '').trim() === weightId);
                        if (!displayName) displayName = refLoad?.productName || 'صنف محذوف';
                        if (!displaySize) displaySize = refLoad?.weightSize || 'افتراضي';
                      }

                      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
                      ctx.fillRect(padX, y, tableW, rowH);
                      ctx.strokeStyle = '#d5d0c8';
                      ctx.lineWidth = 0.5;
                      ctx.strokeRect(padX, y, tableW, rowH);

                      ctx.fillStyle = '#1a1a1a';
                      ctx.font = '11px system-ui, sans-serif';
                      ctx.textAlign = 'center';
                      ctx.fillText(String(idx + 1), colXs[0], y + 23);
                      ctx.textAlign = 'right';
                      ctx.fillText(displayName, colXs[1], y + 23);
                      ctx.textAlign = 'center';
                      ctx.fillText(displaySize, colXs[2], y + 23);
                      ctx.fillText(String(stock.loaded), colXs[3], y + 23);

                      ctx.fillStyle = '#38A169';
                      ctx.font = 'bold 11px system-ui, sans-serif';
                      ctx.fillText(String(stock.sold), colXs[4], y + 23);

                      ctx.fillStyle = stock.remaining > 0 ? '#DD6B20' : '#38A169';
                      ctx.font = 'bold 11px system-ui, sans-serif';
                      ctx.fillText(String(stock.remaining), colXs[5], y + 23);

                      totalLoaded += stock.loaded;
                      totalSold += stock.sold;
                      totalRemaining += stock.remaining;
                      y += rowH;
                    });

                    ctx.fillStyle = '#0d7c5f';
                    ctx.fillRect(padX, y, tableW, summaryRowH);
                    ctx.strokeStyle = '#0a6e54';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(padX, y, tableW, summaryRowH);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 13px system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('الإجمالي', colXs[0], y + 23);
                    ctx.fillText('', colXs[1], y + 23);
                    ctx.fillText('', colXs[2], y + 23);
                    ctx.fillText(String(totalLoaded), colXs[3], y + 23);
                    ctx.fillText(String(totalSold), colXs[4], y + 23);
                    ctx.fillText(String(totalRemaining), colXs[5], y + 23);
                    y += summaryRowH + 12;

                    const boxW = (tableW - 12) / 2;
                    roundRect(ctx, padX, y, boxW, bottomBoxH, 4);
                    ctx.fillStyle = '#fdf6ee';
                    ctx.fill();
                    ctx.strokeStyle = '#d5d0c8';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    ctx.fillStyle = '#2c3e6b';
                    ctx.fillRect(padX, y, boxW, 24);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 11px system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('ملخص الجرد', padX + boxW/2, y + 16);
                    ctx.fillStyle = '#1a1a1a';
                    ctx.font = '12px system-ui, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(`إجمالي التحميل: ${totalLoaded} كرتونة`, padX + boxW - 12, y + 52);
                    ctx.fillText(`إجمالي المبيع: ${totalSold} كرتونة`, padX + boxW - 12, y + 74);
                    ctx.fillStyle = totalRemaining > 0 ? '#DD6B20' : '#38A169';
                    ctx.font = 'bold 12px system-ui, sans-serif';
                    ctx.fillText(`إجمالي المتبقي: ${totalRemaining} كرتونة`, padX + boxW - 12, y + 96);

                    const box2X = padX + boxW + 12;
                    roundRect(ctx, box2X, y, boxW, bottomBoxH, 4);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    ctx.strokeStyle = '#d5d0c8';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    ctx.fillStyle = '#2c3e6b';
                    ctx.fillRect(box2X, y, boxW, 24);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 11px system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('ملاحظات', box2X + boxW/2, y + 16);
                    ctx.fillStyle = '#1a1a1a';
                    ctx.font = '11px system-ui, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText('• الأرقام بالكرتونة (بدون أجزاء)', box2X + boxW - 12, y + 52);
                    ctx.fillText(`• تاريخ الجرد: ${new Date().toLocaleDateString('ar-EG')}`, box2X + boxW - 12, y + 74);
                    ctx.fillText(`• عدد الأصناف: ${visibleRows.length}`, box2X + boxW - 12, y + 96);
                    y += bottomBoxH + 8;

                    ctx.strokeStyle = '#d5d0c8';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(padX, y);
                    ctx.lineTo(padX + tableW, y);
                    ctx.stroke();
                    y += 18;
                    ctx.fillStyle = '#1a1a1a';
                    ctx.font = '11px system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(`نظام إدارة المبيعات | ${new Date().toLocaleString('ar-EG')}`, W/2, y);

                    const link = document.createElement('a');
                    link.download = `جرد_السيارة_${new Date().toISOString().split('T')[0]}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                  }}
                  className="bg-[#2B6CB0] text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-[#1A365D] transition-colors flex items-center gap-1"
                >
                  <Image className="w-3.5 h-3.5" />
                  تحميل صورة الجرد
                </button>
              </div>

              {/* جدول الجرد بالكرتونة */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#2B6CB0] text-white">
                      <th className="p-2 rounded-r-lg text-right">المنتج</th>
                      <th className="p-2 text-center">الحجم</th>
                      <th className="p-2 text-center">التحميل (كرتونة)</th>
                      <th className="p-2 text-center">المبيع (كرتونة)</th>
                      <th className="p-2 text-center rounded-l-lg">المتبقي (كرتونة)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(inventoryFilteredStocks).map(([key, stock]) => {
                      const [prodId, weightId] = key.split('_');
                      const prod = products.find(p => p.id === prodId);
                      if (!prod) return null;
                      const weights = getProductWeightsFallback(prod);
                      const weight = weights.find(w => w.id === weightId);
                      if (!weight) return null;
                      if (stock.loaded === 0 && stock.sold === 0) return null;

                      return (
                        <tr key={key} className="border-b border-[#BEE3F8] hover:bg-[#EBF4FF]">
                          <td className="p-2 font-bold text-[#1A365D]">{prod.name}</td>
                          <td className="p-2 text-center text-[#2B6CB0]">{weight.size}</td>
                          <td className="p-2 text-center font-bold">{stock.loaded}</td>
                          <td className="p-2 text-center text-emerald-700 font-bold">{stock.sold}</td>
                          <td className={`p-2 text-center font-black ${stock.remaining > 0 ? 'text-[#DD6B20]' : 'text-[#38A169]'}`}>
                            {stock.remaining}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0d7c5f] text-white font-black">
                      <td className="p-2 rounded-r-lg">الإجمالي</td>
                      <td className="p-2 text-center"></td>
                      <td className="p-2 text-center">
                        {Object.values(inventoryFilteredStocks).reduce((sum, s) => sum + s.loaded, 0)}
                      </td>
                      <td className="p-2 text-center">
                        {Object.values(inventoryFilteredStocks).reduce((sum, s) => sum + s.sold, 0)}
                      </td>
                      <td className="p-2 text-center rounded-l-lg">
                        {Object.values(inventoryFilteredStocks).reduce((sum, s) => sum + s.remaining, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ملخص الجرد */}
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="bg-white p-3 rounded-xl border border-[#BEE3F8] text-center">
                  <div className="text-[10px] text-[#2B6CB0] font-bold">إجمالي التحميل (كرتونة)</div>
                  <div className="text-lg font-black text-[#1A365D]">{Object.values(inventoryFilteredStocks).reduce((sum, s) => sum + s.loaded, 0)}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center">
                  <div className="text-[10px] text-emerald-600 font-bold">إجمالي المبيع (كرتونة)</div>
                  <div className="text-lg font-black text-emerald-700">{Object.values(inventoryFilteredStocks).reduce((sum, s) => sum + s.sold, 0)}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#DD6B20] text-center">
                  <div className="text-[10px] text-[#DD6B20] font-bold">إجمالي المتبقي (كرتونة)</div>
                  <div className="text-lg font-black text-[#DD6B20]">{Object.values(inventoryFilteredStocks).reduce((sum, s) => sum + s.remaining, 0)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingCycle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setEditingCycle(null); setEditData(null); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <span className="text-sm font-black text-indigo-900">تعديل الدورة المؤرشفة</span>
                <button type="button" onClick={() => { setEditingCycle(null); setEditData(null); }} className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer">✕</button>
              </div>
              {editData && (
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-xs font-extrabold text-slate-600 block mb-2">📦 الحمولات ({editData.loads?.length || 0})</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-[11px] font-bold">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr><th className="p-1.5 text-center w-8">م</th><th className="p-1.5 text-right">الصنف</th><th className="p-1.5 text-center">الكراتين</th><th className="p-1.5 text-center">السعر</th><th className="p-1.5 text-center">المقدم</th></tr>
                        </thead>
                        <tbody>
                          {editData.loads.map((load: any, i: number) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 text-center text-slate-400">{i + 1}</td>
                              <td className="p-1 text-right">{load.productName} ({load.weightSize})</td>
                              <td className="p-1 text-center"><input type="number" value={load.cartons} onChange={e => { const val = +e.target.value; setEditData((prev: any) => ({...prev, loads: prev.loads.map((l: any, j: number) => j === i ? {...l, cartons: val, subtotal: val * l.cartonPrice + l.loose * (l.cartonPrice / (load.unitsPerCarton || 12))} : l)})); }} className="w-16 text-center border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><input type="number" value={load.cartonPrice} onChange={e => { const val = +e.target.value; setEditData((prev: any) => ({...prev, loads: prev.loads.map((l: any, j: number) => j === i ? {...l, cartonPrice: val, subtotal: val * l.cartons + l.loose * (val / (load.unitsPerCarton || 12))} : l)})); }} className="w-16 text-center border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><input type="number" value={load.advanceAmount} onChange={e => setEditData((prev: any) => ({...prev, loads: prev.loads.map((l: any, j: number) => j === i ? {...l, advanceAmount: +e.target.value} : l)}))} className="w-16 text-center border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-600 block mb-2">💳 الدفعات ({editData.payments?.length || 0})</span>
                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-[11px] font-bold">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr><th className="p-1.5 text-center w-8">م</th><th className="p-1.5 text-right">الملاحظات</th><th className="p-1.5 text-center">المبلغ</th><th className="p-1.5 text-center">المستلم</th><th className="p-1.5 text-center w-10">حذف</th></tr>
                        </thead>
                        <tbody>
                          {editData.payments.map((pay: any, i: number) => (
                            <tr key={pay.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 text-center text-slate-400">{i + 1}</td>
                              <td className="p-1 text-right"><input type="text" value={pay.notes || ''} onChange={e => setEditData((prev: any) => ({...prev, payments: prev.payments.map((p: any, j: number) => j === i ? {...p, notes: e.target.value} : p)}))} className="w-full border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><input type="number" value={pay.amount} onChange={e => setEditData((prev: any) => ({...prev, payments: prev.payments.map((p: any, j: number) => j === i ? {...p, amount: +e.target.value} : p)}))} className="w-20 text-center border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><input type="text" value={pay.recipient || ''} onChange={e => setEditData((prev: any) => ({...prev, payments: prev.payments.map((p: any, j: number) => j === i ? {...p, recipient: e.target.value} : p)}))} className="w-full border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><button type="button" onClick={() => setEditData((prev: any) => ({...prev, payments: prev.payments.filter((_: any, j: number) => j !== i)}))} className="text-red-500 hover:text-red-700 text-xs font-black cursor-pointer">✕</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        const rawSum = editData.loads.reduce((s: number, l: any) => s + l.subtotal, 0);
                        const paySum = editData.payments.reduce((s: number, p: any) => s + p.amount, 0);
                        const credit = Math.max(0, paySum - rawSum);
                        const updatedCycle = {
                          ...editData,
                          rawLoadedValue: rawSum,
                          totalWithdrawnValue: rawSum + (editData.carriedOverDebtAtTime || 0),
                          totalAdvancePayments: paySum,
                          creditBalance: credit
                        };
                        setArchiveCycles((prev: any) => prev.map((c: any) => c.id === editData.id ? updatedCycle : c));
                        setEditingCycle(null);
                        setEditData(null);
                        showToast("✓ تم حفظ التعديلات على الدورة المؤرشفة!");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-6 rounded-xl cursor-pointer transition-all"
                    >
                      💾 حفظ التعديلات
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (await confirmDialog(`هل أنت متأكد من حذف هذه الدورة المؤرشفة بالكامل؟ (${editData.loads?.length || 0} حمولة، ${editData.payments?.length || 0} دفعة)`)) {
                          setArchiveCycles((prev: any) => prev.filter((c: any) => c.id !== editData.id));
                          setEditingCycle(null);
                          setEditData(null);
                          showToast("✓ تم حذف الدورة المؤرشفة!");
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-6 rounded-xl cursor-pointer transition-all"
                    >
                      🗑️ حذف الدورة
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingCycle(null); setEditData(null); }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 px-6 rounded-xl cursor-pointer transition-all mr-auto"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

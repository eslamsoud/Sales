// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Invoice, Expense, Product, Customer, Trip, AppSettings, formatNum, FactoryLoad, getProductWeightsFallback, UserAuth, InvoiceItem, getItemFactoryCost, getFactoryCartonPrice } from '../types';
import { ArrowRight, FileSpreadsheet, Send, TrendingUp, TrendingDown, Clock, Search, Eye, Filter, Check, ShieldAlert, MapPin, Printer, ChevronDown, AlertCircle, Activity, Package, Wallet, UserCheck, HandCoins, CircleDollarSign } from 'lucide-react';
import { showToast } from '../utils/toast';
import { confirmDialog } from '../utils/confirm';
import { COMPACT_PRO_CSS, printHTMLInNewWindow } from '../utils/reportStyles';
import { ACTIVE_CUSTOMER_MSG, INACTIVE_CUSTOMER_MSG } from '../utils/messages';
import SecurePhoneDisplay from './SecurePhoneDisplay';
import { nowEgyptISO } from '../utils/storage';

// تطبيع الحروف العربية: ة → ه لتوحيد مقارنة أسماء المناطق
const normalizeArabic = (s: string) => (s || '').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

interface ReportsTabProps {
  invoices: Invoice[];
  expenses: Expense[];
  products: Product[];
  customers: Customer[];
  trips?: Trip[];
  factoryLoads?: FactoryLoad[];
  settings: AppSettings;
  usersList?: UserAuth[];
  onUpdateInvoice?: (updated: Invoice) => void;
  onAddExpense?: (newExpense: Omit<Expense, 'id'>) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onGoBack: () => void;
  permittedSubTabs?: string[];
  currentUser?: UserAuth | null;
  archiveCycles?: any[];
}

const formatCartonsAndPieces = (rawQty: number, unitsPerCarton: number): string => {
  const raw = Number(rawQty) || 0;
  const isNeg = raw < 0;
  const absRaw = Math.abs(raw);
  const units = Number(unitsPerCarton) || 12;
  const cartons = Math.floor(absRaw / units);
  const pieces = absRaw % units;
  
  const parts: string[] = [];
  if (cartons > 0) {
    parts.push(`${cartons} كرتونة`);
  }
  if (pieces > 0) {
    parts.push(`${pieces} عبوة`);
  }
  const res = parts.length > 0 ? parts.join(' و ') : '0 عبوة';
  return isNeg ? `-(${res})` : res;
};

const parseExpenseDescription = (desc: string | undefined): string => {
  if (!desc) return 'أخرى';
  if (desc.startsWith('{')) {
    try {
      const parsed = JSON.parse(desc);
      return parsed.notes || parsed.description || 'مصروف';
    } catch { return desc; }
  }
  return desc;
};

class ReportsErrorBoundary extends React.Component<{children: React.ReactNode}, { hasError: boolean; errorInfo: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorInfo: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.toString() };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("Reports Tab Crash Prevented:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl m-4 shadow-xl flex flex-col items-center gap-4 animate-fade-in" dir="rtl">
          <AlertCircle className="h-12 w-12 text-rose-500" />
          <h2 className="text-xl font-black text-rose-800">حدث خطأ أثناء معالجة بيانات التقارير!</h2>
          <p className="text-sm font-bold text-slate-700">هناك بيانات تالفة (فاتورة أو مصروف قديم) تسببت في هذا العطل، وتم إيقافه لمنع انهيار التطبيق.</p>
          <code className="bg-white p-3 rounded-lg border border-rose-100 text-rose-600 text-xs w-full overflow-x-auto text-left font-mono" dir="ltr">
            {this.state.errorInfo}
          </code>
          <button onClick={() => this.setState({ hasError: false })} className="bg-rose-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-rose-700 active:scale-95 transition-all mt-2">
            محاولة إعادة التحميل 🔄
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ReportsTabComponent({
  invoices: rawInvoices,
  expenses: rawExpenses,
  products: rawProducts,
  customers: rawCustomers,
  trips: rawTrips = [],
  factoryLoads: rawFactoryLoads = [],
  settings,
  usersList = [],
  onUpdateInvoice,
  onAddExpense,
  onDeleteExpense,
  onGoBack,
  permittedSubTabs,
  currentUser,
  archiveCycles = []
}: ReportsTabProps) {
  // 🛡️ تنظيف وتأمين جميع قواعد البيانات من أي نصوص أو عناصر فارغة تالفة لمنع الشاشة البيضاء نهائياً
  const invoices = React.useMemo(() => (rawInvoices || []).filter(i => i && typeof i === 'object'), [rawInvoices]);
  const expenses = React.useMemo(() => (rawExpenses || []).filter(e => e && typeof e === 'object'), [rawExpenses]);
  const products = React.useMemo(() => (rawProducts || []).filter(p => p && typeof p === 'object'), [rawProducts]);
  const customers = React.useMemo(() => (rawCustomers || []).filter(c => c && typeof c === 'object'), [rawCustomers]);
  const trips = React.useMemo(() => (rawTrips || []).filter(t => t && typeof t === 'object'), [rawTrips]);
  const factoryLoads = React.useMemo(() => (rawFactoryLoads || []).filter(l => l && typeof l === 'object'), [rawFactoryLoads]);
  const isManager = currentUser?.role === 'owner';

  const [activeSubTab, setActiveSubTab] = useState<'finance' | 'stats' | 'active_customers' | 'invoices' | 'inventory'>(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('reports_finance')) return 'finance';
      if (permittedSubTabs.includes('reports_stats')) return 'stats';
      if (permittedSubTabs.includes('reports_areas')) return 'active_customers';
      if (permittedSubTabs.includes('reports_invoices')) return 'invoices';
      if (permittedSubTabs.includes('reports_inventory')) return 'inventory';
    }
    return 'finance';
  });
  
  // Debtors interaction state
  const [showDebtorsModal, setShowDebtorsModal] = useState(false);
  const [debtorSearchQuery, setDebtorSearchQuery] = useState('');
  const [activeDetailCard, setActiveDetailCard] = useState<'trips' | 'net' | 'debtors' | null>(null);
  
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeSubTab]);

  // Filter states
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]);
  const [inventoryMatchFilter, setInventoryMatchFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = React.useState<Set<string>>(new Set());
  const toggleGroup = (gKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(gKey)) next.delete(gKey); else next.add(gKey);
      return next;
    });
  };
  const toggleDetail = (productId: string, weightId: string) => {
    const key = `${productId}-${weightId}`;
    setExpandedDetails(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const [delegateFilter, setDelegateFilter] = useState<string>('all');

  // Factory report filter states
  const [factoryReportFilter, setFactoryReportFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');
  const [factoryReportWeekDays, setFactoryReportWeekDays] = useState<number[]>([]);
  const [expandedFactoryCard, setExpandedFactoryCard] = useState<string | null>(null);

  // Activity filter states
  const [custDateFilter, setCustDateFilter] = useState<'all' | 'week' | 'month' | 'custom'>('all');
  const [custStartDate, setCustStartDate] = useState('');
  const [custEndDate, setCustEndDate] = useState('');
  const [custAreaFilter, setCustAreaFilter] = useState('');
  const [custStatusFilter, setCustStatusFilter] = useState<'all' | 'active' | 'inactive'>('all'); // محمي
  const [custDayFilter, setCustDayFilter] = useState<string[]>([]);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [waLoadingId, setWaLoadingId] = useState<string | null>(null);
  
  // Previous search/filter that leaked due to earlier replace
  const [searchInvoice, setSearchInvoice] = useState('');
  const [viewingExpenses, setViewingExpenses] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editPaid, setEditPaid] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editAddProductId, setEditAddProductId] = useState<string>('');
  const [editAddWeightId, setEditAddWeightId] = useState<string>('');
  const [editAddQty, setEditAddQty] = useState<string>('');

  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
    type: 'partial' | 'full';
    amount: string;
    paymentMethod: string;
  }>({ isOpen: false, invoice: null, type: 'full', amount: '', paymentMethod: 'نقدي (كاش)' });

  const [selectedGov, setSelectedGov] = useState('all');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [filterDate, setFilterDate] = useState(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  });

  const uniqueGovs = useMemo(() => Array.from(new Set(customers.map(c => c.governorate).filter(Boolean))), [customers]);
  const uniqueAreas = useMemo(() => Array.from(new Set(customers.map(c => c.area).filter(Boolean))), [customers]);
  const filteredCustomersList = useMemo(() => {
    return customers.filter(c => (selectedArea === 'all' || c.area === selectedArea));
  }, [customers, selectedArea]);

  const delegate = isManager && delegateFilter !== 'all' ? (usersList || []).find(u => u.phone === delegateFilter) : null;
  const cleanDelegateName = delegate ? delegate.name.replace(/\s*\(.*?\)/g, '').trim() : '';

  const filterItemByDelegate = (item: any) => {
    if (!isManager || !delegate) return true;
    return item.delegatePhone === delegate.phone || (item.delegateName && item.delegateName.includes(cleanDelegateName));
  };

  const delFilteredInvoices = React.useMemo(() => invoices.filter(filterItemByDelegate), [invoices, delegate, isManager]);
  const delFilteredExpenses = React.useMemo(() => expenses.filter(filterItemByDelegate), [expenses, delegate, isManager]);
  const delFilteredTrips = React.useMemo(() => trips.filter(filterItemByDelegate), [trips, delegate, isManager]);
  const delFilteredFactoryLoads = React.useMemo(() => factoryLoads.filter(filterItemByDelegate), [factoryLoads, delegate, isManager]);

  const currentFilteredData = React.useMemo(() => {
    const isWithinPeriod = (dateString: string) => {
      if (!dateString || typeof dateString !== 'string') return false;
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return false;
      const now = new Date();
      
      if (periodFilter === 'all') {
        return true;
      }
      if (periodFilter === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (periodFilter === 'week') {
        const msInWeek = 7 * 24 * 60 * 60 * 1000;
        const withinLastWeek = now.getTime() - d.getTime() < msInWeek;
        const jsDay = d.getDay();
        const weekIdx = jsDay === 6 ? 0 : jsDay + 1;
        return withinLastWeek && selectedWeekDays.includes(weekIdx);
      }
      if (periodFilter === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'custom') {
        const dStr = dateString.split('T')[0];
        if (customStartDate && dStr < customStartDate) return false;
        if (customEndDate && dStr > customEndDate) return false;
        return true;
      }
      return true;
    };

    const currentDelegateKey = isManager 
      ? (delegateFilter === 'all' ? 'default' : delegateFilter) 
      : (currentUser?.phone || 'default');

    let carriedOverDebt = parseFloat(localStorage.getItem(`factory_carried_debt_sys_${currentDelegateKey}`) || 'NaN');
    if (isNaN(carriedOverDebt)) {
      carriedOverDebt = parseFloat(localStorage.getItem('factory_carried_debt_sys') || '0');
    }

    const extraPayments = delFilteredExpenses
      .filter(e => e.category === 'سداد للمصنع' || e.type === 'factory_payment')
      .map(e => {
        let notes = e.description;
        let appliedToCarriedDebt = 0;
        if (e.description && e.description.startsWith('{')) {
          try {
            const parsed = JSON.parse(e.description);
            notes = parsed.notes || '';
            appliedToCarriedDebt = parsed.appliedToCarriedDebt || 0;
          } catch (err) {}
        }
        return {
          id: e.id,
          amount: e.amount,
          date: e.date,
          notes,
          appliedToCarriedDebt
        };
      });

    return {
      invoices: delFilteredInvoices.filter(i => isWithinPeriod(i.date)),
      expenses: delFilteredExpenses.filter(e => isWithinPeriod(e.date)),
      trips: delFilteredTrips.filter(t => isWithinPeriod(t.date || new Date().toISOString())),
      factoryLoads: delFilteredFactoryLoads.filter(fl => isWithinPeriod(fl.date)),
      extraPayments: (extraPayments || []).filter((ep: any) => ep && isWithinPeriod(ep.date)),
      allExtraPayments: extraPayments || [], // for cumulative calculation
      carriedOverDebt
    };
  }, [delFilteredInvoices, delFilteredExpenses, delFilteredTrips, delFilteredFactoryLoads, periodFilter, delegateFilter, isManager, currentUser, selectedWeekDays, customStartDate, customEndDate]);

  // 1. Calculations based on period filter
  const salesStats = React.useMemo(() => {
    // True total sales collected
    const trueTotalSales = currentFilteredData.invoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount || 0), 0);
    const totalCollected = currentFilteredData.invoices.reduce((sum, inv) => sum + (inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAfterDiscount || 0)), 0);
    const totalRemaining = currentFilteredData.invoices.reduce((sum, inv) => sum + ((inv.totalAfterDiscount || 0) - (inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAfterDiscount || 0))), 0);
    const totalBeforeDisc = currentFilteredData.invoices.reduce((sum, inv) => sum + (inv.totalBeforeDiscount || 0), 0);
    const totalDiscounts = totalBeforeDisc - trueTotalSales;

    // totalProfit = margin-based profit using correct per-unit factory price from product weights
    const totalProfit = currentFilteredData.invoices.reduce((sum, inv) => {
      const itemsProfit = Array.isArray(inv.items) ? inv.items.reduce((isum, it) => {
        if (!it) return isum;
        const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
        const weights = prod ? getProductWeightsFallback(prod) : [];
        const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
        const fpPerUnit = getItemFactoryCost(it, weight, prod);
        return isum + (((it.finalPrice || 0) - fpPerUnit) * (it.quantity || 0));
      }, 0) : 0;
      return sum + itemsProfit;
    }, 0);

    const totalSpent = currentFilteredData.expenses.filter(e => e.type !== 'revenue' && e.category !== 'سداد للمصنع' && e.type !== 'factory_payment').reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const extraRevenues = currentFilteredData.expenses.filter(e => e.type === 'revenue').reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalTripsCollectedProfit = currentFilteredData.trips.filter(t => t.collected).reduce((sum, t) => sum + (t.price || 0), 0);
    
    // Cost of goods sold (after inventory/jarid) — lookup correct per-unit factory price from product weights
    const factorySoldCost = currentFilteredData.invoices.reduce((sum, inv) => {
      const itemsCost = Array.isArray(inv.items) ? inv.items.reduce((isum, it) => {
        if (!it) return isum;
        const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
        const weights = prod ? getProductWeightsFallback(prod) : [];
        const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
        const fpPerUnit = getItemFactoryCost(it, weight, prod);
        return isum + (fpPerUnit * (it.quantity || 0));
      }, 0) : 0;
      return sum + itemsCost;
    }, 0);

    // Value of goods loaded from factory in this period (matches "ما تم تحميله من المصنع" cards)
    const periodLoadedValue = currentFilteredData.factoryLoads.reduce((sum, l) => {
      const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(l.weightId || '').trim());
      const upc = weight?.unitsPerCarton || 12;
      const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor((l.quantity || 0) / upc);
      const loose = l.looseUnitsCount !== undefined ? l.looseUnitsCount : (l.quantity || 0) % upc;
      const cp = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const up = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      return sum + (cartons * cp) + (loose * up);
    }, 0);

    // Factory stats calculations
    const periodAdvances = currentFilteredData.factoryLoads.reduce((sum, fl) => sum + (fl.advanceAmount ?? 0), 0);
    const periodExtraPayments = currentFilteredData.extraPayments.reduce((sum, ep) => sum + ((ep.amount || 0) - (ep.appliedToCarriedDebt || 0)), 0);
    const totalPaidToFactoryInPeriod = periodAdvances + periodExtraPayments;

    // Cumulative overall remaining debt due to factory (matches FactoryTab: uses LOADED goods value)
    let cumulativeLoadedValue = 0;
    delFilteredFactoryLoads.forEach(l => {
      const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(l.weightId || '').trim()) || weights[0];
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor((l.quantity || 0) / unitsPerCarton);
      const loose = l.looseUnitsCount !== undefined ? l.looseUnitsCount : (l.quantity || 0) % unitsPerCarton;
      const cp = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const up = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      cumulativeLoadedValue += (cartons * cp) + (loose * up);
    });

    const totalWithdrawnValue = cumulativeLoadedValue;
    const currentAdvancesTotal = delFilteredFactoryLoads.reduce((sum, fl) => sum + (fl.advanceAmount ?? 0), 0);
    const manualPaymentsSumTotal = currentFilteredData.allExtraPayments.reduce((sum, p) => sum + ((p.amount || 0) - (p.appliedToCarriedDebt || 0)), 0);
    const totalOverallPaidToFactory = currentAdvancesTotal + manualPaymentsSumTotal;
    const remainingDebtToFactory = Math.max(0, totalWithdrawnValue - totalOverallPaidToFactory + currentFilteredData.carriedOverDebt);

    // صافي الربح = صافي ربح الفواتير + إيرادات + مشاوير - المصروفات التشغيلية
    const operatingNetProfit = trueTotalSales + extraRevenues + totalTripsCollectedProfit - factorySoldCost - totalSpent;
    const netProfit = totalProfit + extraRevenues + totalTripsCollectedProfit - totalSpent;

    // صافي الربح التراكمي = صافي ربح الفواتير + المشاوير + الإيرادات - المصروفات التشغيلية (جميع الدورات)
    const cumulativeProfit = delFilteredInvoices.reduce((sum, inv) => {
      const itemsProfit = Array.isArray(inv.items) ? inv.items.reduce((isum, it) => {
        if (!it) return isum;
        const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
        const weights = prod ? getProductWeightsFallback(prod) : [];
        const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
        const fpPerUnit = getItemFactoryCost(it, weight, prod);
        return isum + (((it.finalPrice || 0) - fpPerUnit) * (it.quantity || 0));
      }, 0) : 0;
      return sum + itemsProfit;
    }, 0);
    const cumulativeExtraRev = delFilteredExpenses.filter(e => e.type === 'revenue').reduce((sum, e) => sum + (e.amount || 0), 0);
    const cumulativeTripProfit = delFilteredTrips.filter(t => t.collected).reduce((sum, t) => sum + (t.price || 0), 0);
    const cumulativeSpent = delFilteredExpenses.filter(e => e.type !== 'revenue' && e.category !== 'سداد للمصنع' && e.type !== 'factory_payment').reduce((sum, e) => sum + (e.amount || 0), 0);
    const cumulativeNetProfit = cumulativeProfit + cumulativeTripProfit + cumulativeExtraRev - cumulativeSpent;

    return {
      totalSales: trueTotalSales,
      totalCollected,
      totalRemaining,
      totalProfit,
      extraRevenues,
      totalDiscounts,
      totalSpent,
      totalTripsCollectedProfit,
      factorySoldCost,
      periodLoadedValue,
      netProfit,
      cumulativeNetProfit,
      operatingNetProfit,
      totalPaidToFactoryInPeriod,
      remainingDebtToFactory
    };
  }, [currentFilteredData, products, factoryLoads, delFilteredInvoices, delFilteredExpenses, delFilteredTrips]);

  // Period quick summary stats (follows selected time period, not just today)
  const periodStats = React.useMemo(() => {
    const periodInvoices = currentFilteredData.invoices;
    const periodExpenses = currentFilteredData.expenses.filter(e => e.type !== 'revenue' && e.category !== 'سداد للمصنع' && e.type !== 'factory_payment');
    const periodTrips = currentFilteredData.trips;
    const periodExtraRevenues = currentFilteredData.expenses.filter(e => e.type === 'revenue').reduce((s, e) => s + (e.amount || 0), 0);
    const periodAdvances = currentFilteredData.factoryLoads.reduce((s, fl) => s + (fl.advanceAmount ?? 0), 0);
    const periodExtraPay = currentFilteredData.extraPayments.reduce((s, ep) => s + ((ep.amount || 0) - (ep.appliedToCarriedDebt || 0)), 0);
    const totalPaidToFactory = periodAdvances + periodExtraPay;
    const totalLoadedValue = currentFilteredData.factoryLoads.reduce((s, l) => {
      const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(l.weightId || '').trim());
      const upc = weight?.unitsPerCarton || 12;
      const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor((l.quantity || 0) / upc);
      const loose = l.looseUnitsCount !== undefined ? l.looseUnitsCount : (l.quantity || 0) % upc;
      const cp = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
      const up = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      return s + (cartons * cp) + (loose * up);
    }, 0);

    // صافي ربح الفواتير للفترة الحالية
    const periodProfit = periodInvoices.reduce((sum, inv) => {
      const itemsProfit = Array.isArray(inv.items) ? inv.items.reduce((isum, it) => {
        if (!it) return isum;
        const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
        const weights = prod ? getProductWeightsFallback(prod) : [];
        const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
        const fpPerUnit = getItemFactoryCost(it, weight, prod);
        return isum + (((it.finalPrice || 0) - fpPerUnit) * (it.quantity || 0));
      }, 0) : 0;
      return sum + itemsProfit;
    }, 0);

    return {
      invoiceCount: periodInvoices.length,
      totalCollected: periodInvoices.reduce((s, inv) => s + (inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAfterDiscount || 0)), 0),
      totalSales: periodInvoices.reduce((s, inv) => s + (inv.totalAfterDiscount || 0), 0),
      totalPaidToFactory,
      totalLoadedValue,
      tripsCount: periodTrips.filter(t => t.collected).length,
      tripsCollected: periodTrips.filter(t => t.collected).reduce((s, t) => s + (t.price || 0), 0),
      extraRevenues: periodExtraRevenues,
      expensesTotal: periodExpenses.reduce((s, e) => s + (e.amount || 0), 0),
      periodProfit,
    };
  }, [currentFilteredData, products]);

  // Calculate unpaid debt / debtor customers list (uses time-filtered invoices like salesStats)
  const debtorCustomers = React.useMemo(() => {
    const unpaidInvoices = currentFilteredData.invoices.filter(inv => {
      if (!inv) return false;
      const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAfterDiscount || 0);
      return ((inv.totalAfterDiscount || 0) - paid) > 0.05; // has outstanding debt
    });

    const customersMap = new Map((customers || []).map(c => [c.id, c]));
    const map: Record<string, { invoices: Invoice[]; totalDebt: number }> = {};
    unpaidInvoices.forEach(inv => {
      if (!map[inv.customerId]) {
        map[inv.customerId] = { invoices: [], totalDebt: 0 };
      }
      const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAfterDiscount || 0);
      const remaining = (inv.totalAfterDiscount || 0) - paid;
      map[inv.customerId].invoices.push(inv);
      map[inv.customerId].totalDebt += remaining;
    });

    return Object.entries(map).map(([custId, data]) => {
      const customer = customersMap.get(custId) || {
        id: custId,
        name: 'عميل غير مسجل',
        phone: '',
        area: 'منطقة غير محددة',
        locationLink: ''
      };
      return {
        customer,
        invoices: [...data.invoices].sort((a, b) => {
          const timeA = a.date ? new Date(a.date).getTime() : 0;
          const timeB = b.date ? new Date(b.date).getTime() : 0;
          return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
        }),
        totalDebt: data.totalDebt
      };
    }).sort((a, b) => b.totalDebt - a.totalDebt);
  }, [currentFilteredData, customers]);

  const handleSettlePartial = async (inv: Invoice, amount: number) => {
    if (!onUpdateInvoice) return;
    const now = new Date();
    const dateStr = `${now.toLocaleDateString('ar-EG')} ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    const newNotes = inv.notes 
      ? `${inv.notes} | سداد جزئي ${amount}ج.م من التقارير (${dateStr})` 
      : `سداد جزئي ${amount}ج.م من التقارير (${dateStr})`;
    const updatedInv = {
      ...inv,
      paidAmount: (inv.paidAmount ?? 0) + amount,
      notes: newNotes
    };
    onUpdateInvoice(updatedInv);
  };

  const handleSettleFull = async (inv: Invoice) => {
    if (!onUpdateInvoice) return;
    const updatedInv = {
      ...inv,
                                      paidAmount: inv.totalAfterDiscount || 0
    };
    onUpdateInvoice(updatedInv);
  };

  const formatCartonsAr = (rawUnits: number, unitsPerCarton: number): string => {
    const isNeg = rawUnits < 0;
    const absRaw = Math.abs(rawUnits);
    const c = Math.floor(absRaw / unitsPerCarton);
    const p = absRaw % unitsPerCarton;
    let txt = '';
    if (c > 0) txt += `${c} كرتونة`;
    if (p > 0) txt += (txt ? ' و ' : '') + `${p} عبوة`;
    if (!txt) txt = '0 عبوة';
    return isNeg ? `-(${txt})` : txt;
  };

  // Helper functions for inventory matching section
  const getNormalizedDateKey = (dateStr: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return 'تاريخ غير محدد';
    try {
      const parts = dateStr.split(/[ T]/);
      if (parts[0]) {
        const dateOnly = parts[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
          return dateOnly;
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          return `${yyyy}-${mm}-${dd}`;
        }
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const getArabicDayName = (date: Date) => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const day = date.getDay();
    return isNaN(day) ? 'يوم غير محدد' : days[day];
  };

  const formatDateString = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const dayName = getArabicDayName(d);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${dayName} - ${year}/${month}/${day}`;
    } catch (e) {
      return dateStr;
    }
  };

  const getWeekRangeLabel = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'أسبوع غير محدد';
      const dayOfWeek = d.getDay();
      const diffToSaturday = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
      const satDate = new Date(d.getTime() + diffToSaturday * 24 * 60 * 60 * 1000);
      const friDate = new Date(satDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      const formatDate = (date: Date) => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${yyyy}/${mm}/${dd}`;
      };
      return `الأسبوع: من ${formatDate(satDate)} إلى ${formatDate(friDate)}`;
    } catch (e) {
      return 'أسبوع غير محدد';
    }
  };

  const getMonthLabel = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'شهر غير محدد';
      const months = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];
      return `شهر ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return 'شهر غير محدد';
    }
  };

  const getGroupKey = (dateStr: string): string => {
    const norm = getNormalizedDateKey(dateStr);
    if (norm === 'تاريخ غير محدد') return norm;
    if (inventoryMatchFilter === 'daily') {
      return norm;
    } else if (inventoryMatchFilter === 'weekly') {
      return getWeekRangeLabel(norm);
    } else {
      return getMonthLabel(norm);
    }
  };

  // Pre-compute inventory matching data to prevent UI freeze
  const inventoryData = React.useMemo(() => {
    const allDates = new Set<string>();
    delFilteredFactoryLoads.forEach(l => {
      if (l && l.date) allDates.add(getNormalizedDateKey(l.date));
    });
    delFilteredInvoices.forEach(inv => {
      if (inv && inv.date) allDates.add(getNormalizedDateKey(inv.date));
    });

    const groupsMap: Record<string, {
      loads: FactoryLoad[];
      invItems: { productId: string; weightId?: string; quantity: number }[];
    }> = {};

    allDates.forEach(dStr => {
      const gKey = getGroupKey(dStr);
      if (!groupsMap[gKey]) {
        groupsMap[gKey] = { loads: [], invItems: [] };
      }
    });

    delFilteredFactoryLoads.forEach(l => {
      if (!l.date) return;
      const gKey = getGroupKey(l.date);
      if (groupsMap[gKey]) {
        groupsMap[gKey].loads.push(l);
      }
    });

    delFilteredInvoices.forEach(inv => {
      if (!inv.date) return;
      const gKey = getGroupKey(inv.date);
      if (groupsMap[gKey]) {
        if (Array.isArray(inv.items)) {
          inv.items.forEach(item => {
            if (item) groupsMap[gKey].invItems.push({
              productId: item.productId,
              weightId: item.weightId,
              quantity: item.quantity
            });
          });
        }
      }
    });

    // Compute cumulative sold per combo across ALL groups
    const cumulativeSoldMap: Record<string, number> = {};
    delFilteredInvoices.forEach(inv => {
      if (!inv || !Array.isArray(inv.items)) return;
      inv.items.forEach(item => {
        if (!item) return;
        const comboKey = `${String(item.productId).trim()}-${String(item.weightId || '').trim()}`;
        cumulativeSoldMap[comboKey] = (cumulativeSoldMap[comboKey] || 0) + (item.quantity || 0);
      });
    });

    // Compute cumulative loaded per combo across ALL groups
    const cumulativeLoadedMap: Record<string, number> = {};
    delFilteredFactoryLoads.forEach(l => {
      if (!l) return;
      const comboKey = `${String(l.productId).trim()}-${String(l.weightId || '').trim()}`;
      cumulativeLoadedMap[comboKey] = (cumulativeLoadedMap[comboKey] || 0) + (l.quantity || 0);
    });

    const sortedGroupKeys = Object.keys(groupsMap).sort((a, b) => b.localeCompare(a));

    const productsMap = new Map(products.map(p => [String(p.id).trim(), p]));

    const processedGroups = sortedGroupKeys.map(gKey => {
      const groupData = groupsMap[gKey];
      const activeCombinations: { productId: string; weightId?: string }[] = [];
      const seen = new Set<string>();

      groupData.loads.forEach(l => {
        const comboKey = `${l.productId}-${l.weightId || ''}`;
        if (!seen.has(comboKey)) {
          seen.add(comboKey);
          activeCombinations.push({ productId: l.productId, weightId: l.weightId });
        }
      });

      groupData.invItems.forEach(item => {
        const comboKey = `${item.productId}-${item.weightId || ''}`;
        if (!seen.has(comboKey)) {
          seen.add(comboKey);
          activeCombinations.push({ productId: item.productId, weightId: item.weightId });
        }
      });

      const visibleCombinations = activeCombinations.filter(combo =>
        productsMap.has(String(combo.productId).trim())
      );

      const groupHeaderLabel = inventoryMatchFilter === 'daily' ? formatDateString(gKey) : gKey;

      return { gKey, groupData, activeCombinations: visibleCombinations, groupHeaderLabel };
    });

    return { processedGroups, productsMap, cumulativeSoldMap, cumulativeLoadedMap };
  }, [delFilteredFactoryLoads, delFilteredInvoices, inventoryMatchFilter, products]);

  const delegateDebtBreakdown = React.useMemo(() => {
    const map: Record<string, number> = {};
    currentFilteredData.invoices.forEach(inv => {
            const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAfterDiscount || 0);
            const remaining = (inv.totalAfterDiscount || 0) - paid;
      if (remaining > 0.05) {
        const del = inv.delegateName || 'مناديب غير محددين';
        map[del] = (map[del] || 0) + remaining;
      }
    });
    return Object.entries(map).map(([name, val]) => ({ name, val })).sort((a,b) => b.val - a.val);
  }, [currentFilteredData]);

  const exportComprehensiveReportAsPDF = () => {
    let periodLabel = periodFilter === 'all' ? 'جميع الفترات' : periodFilter === 'today' ? 'يومي (اليوم الحالي)' : periodFilter === 'week' ? 'أسبوعي (آخر 7 أيام)' : periodFilter === 'month' ? 'شهري (هذا الشهر)' : `مخصص (${customStartDate || '...'} → ${customEndDate || '...'})`;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>${COMPACT_PRO_CSS}</head>
      <body>

        <div class="rh">
          <h1>تقرير العمليات المالية الشامل</h1>
          <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
          <div class="ref">
            <span>الفترة: ${periodLabel}</span>
            <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}</span>
          </div>
        </div>

        <div class="sg">
          <div class="sb gr">
            <div class="l">صافي الربح التشغيلي</div>
            <div class="v">${salesStats.operatingNetProfit.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb bl">
            <div class="l">صافي التدفق النقدي</div>
            <div class="v">${salesStats.netProfit.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb am">
            <div class="l">إجمالي المبيعات</div>
            <div class="v">${salesStats.totalSales.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb gr">
            <div class="l">المحصل كاش</div>
            <div class="v">${salesStats.totalCollected.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb rd">
            <div class="l">باقي ديون العملاء</div>
            <div class="v">${salesStats.totalRemaining.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb bl">
            <div class="l">المسدد للمصنع</div>
            <div class="v">${salesStats.totalPaidToFactoryInPeriod.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb bl">
            <div class="l">المصروفات التشغيلية</div>
            <div class="v">${salesStats.totalSpent.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb gr">
            <div class="l">أرباح المشاوير</div>
            <div class="v">${salesStats.totalTripsCollectedProfit.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb rd">
            <div class="l">مديونية المصنع</div>
            <div class="v">${salesStats.remainingDebtToFactory.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
        </div>
        
        <div class="st"><span class="i">1</span> قائمة فواتير مبيعات العملاء للفترة</div>
        <table>
          <thead>
            <tr>
              <th width="30">م</th>
              <th>رقم الفاتورة</th>
              <th>العميل</th>
              <th>المندوب</th>
              <th>الإجمالي</th>
              <th>المسدد</th>
              <th>المتبقي</th>
            </tr>
          </thead>
          <tbody>
            ${!currentFilteredData.invoices || currentFilteredData.invoices.length === 0 ? '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:16px;">لا توجد فواتير مبيعات في هذه الفترة.</td></tr>' :
              currentFilteredData.invoices.map((inv: any, idx: number) => {
                const cust = (customers || []).find(c => c.id === inv.customerId);
                const totalAfter = inv.totalAfterDiscount || 0;
                const paid = inv.paidAmount !== undefined ? inv.paidAmount : totalAfter;
                const remaining = totalAfter - paid;
                return `
                  <tr>
                    <td style="text-align:center;font-weight:700;color:#94a3b8">${idx + 1}</td>
                    <td style="font-weight:800;color:#1e3a5f">#${inv.invoiceNumber}</td>
                    <td>${cust ? cust.name : 'غير مسجل'}</td>
                    <td>${inv.delegateName?.replace(/ \(.*?\)/g, '').trim() || 'غير محدد'}</td>
                    <td style="text-align:center;font-weight:700">${totalAfter.toLocaleString('ar-EG')}</td>
                    <td style="text-align:center;color:#15803d;font-weight:700">${paid.toLocaleString('ar-EG')}</td>
                    <td style="text-align:center;font-weight:800;color:${remaining > 0 ? '#dc2626' : '#94a3b8'}">${remaining.toLocaleString('ar-EG')}</td>
                  </tr>
                `;
              }).join('')
            }
          </tbody>
        </table>

        <div class="st"><span class="i">2</span> قائمة المصاريف التشغيلية والإيرادات</div>
        <table>
          <thead>
            <tr>
              <th width="30">م</th>
              <th>البيان والتفاصيل</th>
              <th>الفئة</th>
              <th>النوع</th>
              <th>القيمة</th>
            </tr>
          </thead>
          <tbody>
            ${currentFilteredData.expenses.filter(e => e.category !== 'سداد للمصنع' && e.type !== 'factory_payment').length === 0 ? '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:16px;">لا توجد حركة مصروفات مسجلة في هذه الفترة.</td></tr>' :
              currentFilteredData.expenses.filter(e => e.category !== 'سداد للمصنع' && e.type !== 'factory_payment').map((exp, idx) => {
                const isRev = exp.type === 'revenue';
                return `
                  <tr>
                    <td style="text-align:center;font-weight:700;color:#94a3b8">${idx + 1}</td>
                    <td>${exp.description || 'بدون بيان'}</td>
                    <td><span class="bd-b">${exp.category || 'عام'}</span></td>
                    <td><span class="bd-${isRev ? 'g' : 'r'}">${isRev ? 'إيراد' : 'مصروف'}</span></td>
                    <td style="text-align:center;font-weight:800;color:${isRev ? '#15803d' : '#dc2626'};font-family:'Tajawal',monospace">${(exp.amount || 0).toLocaleString('ar-EG')}</td>
                  </tr>
                `;
              }).join('')
            }
          </tbody>
        </table>

        <div class="st"><span class="i">3</span> سجل مشاوير السيارة والنقل</div>
        <table>
          <thead>
            <tr>
              <th width="30">م</th>
              <th>تفاصيل المشوار والوجهة</th>
              <th>المندوب</th>
              <th>المبلغ</th>
              <th>الموقف</th>
            </tr>
          </thead>
          <tbody>
            ${currentFilteredData.trips.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:16px;">لا توجد مشاوير مسجلة للفترة.</td></tr>' :
              currentFilteredData.trips.map((t, idx) => {
                return `
                  <tr>
                    <td style="text-align:center;font-weight:700;color:#94a3b8">${idx + 1}</td>
                    <td>${t.description}</td>
                    <td>${t.delegateName || 'غير محدد'}</td>
                    <td style="text-align:center;font-weight:800;font-family:'Tajawal',monospace">${t.price.toLocaleString('ar-EG')}</td>
                    <td style="text-align:center"><span class="bd-${t.collected ? 'g' : 'b'}">${t.collected ? 'محصل' : 'معلق'}</span></td>
                  </tr>
                `;
              }).join('')
            }
          </tbody>
        </table>

        <div class="fs">
          <div class="sb2"><div class="ti">المسؤول الإداري</div><div class="ln">التوقيع</div></div>
          <div class="sb2"><div class="ti">المندوب الميداني</div><div class="ln">التوقيع</div></div>
        </div>

      </body>
      </html>
    `;
    printHTMLInNewWindow(html);
  };

  // Group invoices by month
  const monthlyBreakdown = React.useMemo(() => {
    const months: Record<string, { sales: number; collected: number; cogs: number; expenses: number; revs: number; trips: number; count: number }> = {};

    currentFilteredData.invoices.forEach(inv => {
      if (!inv || !inv.date) return;
      const parts = String(inv.date).split('-');
      if (parts.length < 2) return;
      const monthYear = parts[0] + '-' + parts[1];
      if (!months[monthYear]) {
        months[monthYear] = { sales: 0, collected: 0, cogs: 0, expenses: 0, revs: 0, trips: 0, count: 0 };
      }
      months[monthYear].sales += (inv.totalAfterDiscount || 0);
      months[monthYear].collected += (inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAfterDiscount || 0));
      months[monthYear].count += 1;

      // Calculate Cost of Goods Sold (COGS) using correct per-unit factory price from product weights
      if (Array.isArray(inv.items)) {
        inv.items.forEach(it => {
          if (!it) return;
          const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
          const weights = prod ? getProductWeightsFallback(prod) : [];
          const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
          const fpPerUnit = getItemFactoryCost(it, weight, prod);
          months[monthYear].cogs += fpPerUnit * (it.quantity || 0);
        });
      }
    });

    currentFilteredData.trips.filter(t => t.collected).forEach(trip => {
      if (!trip || !trip.date) return;
      const parts = String(trip.date).split('-');
      if (parts.length < 2) return;
      const monthYear = parts[0] + '-' + parts[1];
      if (!months[monthYear]) {
        months[monthYear] = { sales: 0, collected: 0, cogs: 0, expenses: 0, revs: 0, trips: 0, count: 0 };
      }
      months[monthYear].trips += (trip.price || 0);
    });

    currentFilteredData.expenses.forEach(exp => {
      if (!exp || !exp.date) return;
      const parts = String(exp.date).split('-');
      if (parts.length < 2) return;
      const monthYear = parts[0] + '-' + parts[1];
      if (!months[monthYear]) {
        months[monthYear] = { sales: 0, collected: 0, cogs: 0, expenses: 0, revs: 0, trips: 0, count: 0 };
      }
      if (exp.type === 'revenue') {
        months[monthYear].revs += (exp.amount || 0);
      } else if (exp.category !== 'سداد للمصنع' && exp.type !== 'factory_payment') {
        months[monthYear].expenses += (exp.amount || 0);
      }
    });

    return Object.entries(months).map(([dateStr, d]) => {
      let displayDate = dateStr;
      try {
        const dateObj = new Date(dateStr + '-01');
        if (!isNaN(dateObj.getTime())) {
          displayDate = dateObj.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
        }
      } catch (e) {}

      // صافي الربح = صافي ربح الفواتير + المشاوير + الإيرادات الاضافية - المصروفات التشغيلية
      const grossMargin = d.sales - d.cogs;
      const trueProfit = grossMargin + d.trips + d.revs - d.expenses;

      return {
        dateStr,
        displayDate,
        sales: d.sales,
        collected: d.collected,
        cogs: d.cogs,
        revs: d.revs,
        expenses: d.expenses,
        trips: d.trips,
        profit: trueProfit,
        count: d.count
      };
    }).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [currentFilteredData, products]);

  // Filter invoices for registry lookup
  const filteredInvoices = delFilteredInvoices.filter(inv => {
    if (!inv) return false;
    const cust = (customers || []).find(c => c.id === inv.customerId);
    const q = searchInvoice.toLowerCase();
    const textMatch = 
      String(inv.invoiceNumber || '').toLowerCase().includes(q) ||
      (cust && (cust.name || '').toLowerCase().includes(q)) ||
      (cust && (cust.area || '').toLowerCase().includes(q));
      
    if (!textMatch) return false;
    
    if (dateFilter === 'all') return true;
    
    const invDate = new Date(inv.date || '');
    if (isNaN(invDate.getTime())) return false;
    const now = new Date();
    
    if (dateFilter === 'today') {
      return invDate.toDateString() === now.toDateString();
    }
    if (dateFilter === 'week') {
      const msInWeek = 7 * 24 * 60 * 60 * 1000;
      return (now.getTime() - invDate.getTime()) < msInWeek;
    }
    if (dateFilter === 'month') {
      return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
    }
    
    return true;
  });

  React.useEffect(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      const permMap: Record<string, string> = {
        'finance': 'reports_finance',
        'stats': 'reports_stats',
        'active_customers': 'reports_areas',
        'invoices': 'reports_invoices',
        'inventory': 'reports_inventory'
      };
      if (!permittedSubTabs.includes(permMap[activeSubTab])) {
        if (permittedSubTabs.includes('reports_finance')) setActiveSubTab('finance');
        else if (permittedSubTabs.includes('reports_stats')) setActiveSubTab('stats');
        else if (permittedSubTabs.includes('reports_areas')) setActiveSubTab('active_customers');
        else if (permittedSubTabs.includes('reports_invoices')) setActiveSubTab('invoices');
        else if (permittedSubTabs.includes('reports_inventory')) setActiveSubTab('inventory');
      }
    }
  }, [permittedSubTabs, activeSubTab]);

  const exportMonthlyReportAsPDF = (monthStr: string, displayDate: string, sales: number, collected: number, revenuesParam: number, expensesParam: number, profit: number) => {
    const mInvoices = delFilteredInvoices.filter(inv => inv && typeof inv.date === 'string' && inv.date.startsWith(monthStr));
    const mExpenses = delFilteredExpenses.filter(exp => exp && typeof exp.date === 'string' && exp.date.startsWith(monthStr));
    
    const mTotalBeforeDisc = mInvoices.reduce((sum, i) => sum + (i.totalBeforeDiscount || 0), 0);
    const mDisc = mInvoices.reduce((sum, i) => sum + ((i.totalBeforeDiscount || 0) - (i.totalAfterDiscount || 0)), 0);
    const remaining = sales - collected;

    const html = `
      <html dir="rtl" lang="ar">
        <head>${COMPACT_PRO_CSS}</head>
        <body>
          <div style="padding:12mm 14mm">
            <div class="rh">
              <h1>تقرير الحسابات الختامية — ${displayDate}</h1>
              <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
              <div class="ref">
                <span>عدد الفواتير: ${mInvoices.length}</span>
                <span>عدد المصروفات: ${mExpenses.length}</span>
              </div>
            </div>

            <div class="sg">
              <div class="sb bl">
                <div class="l">إجمالي المبيعات (قبل الخصم)</div>
                <div class="v">${formatNum(mTotalBeforeDisc)} ج.م</div>
              </div>
              <div class="sb gr">
                <div class="l">الخصم الممنوح</div>
                <div class="v">${formatNum(mDisc)} ج.م</div>
              </div>
              <div class="sb bl">
                <div class="l">المحصل كاش</div>
                <div class="v">${formatNum(collected)} ج.م</div>
              </div>
              <div class="sb am">
                <div class="l">المتبقي (آجل)</div>
                <div class="v">${formatNum(remaining)} ج.م</div>
              </div>
              <div class="sb gr">
                <div class="l">إيرادات إضافية</div>
                <div class="v">${formatNum(revenuesParam)} ج.م</div>
              </div>
              <div class="sb rd">
                <div class="l">المصروفات</div>
                <div class="v">${formatNum(expensesParam)} ج.م</div>
              </div>
            </div>

            <div class="st"><span class="i">1</span> تفاصيل الفواتير والمصروفات</div>
            <table>
              <thead>
                <tr>
                  <th width="30">م</th>
                  <th>البيان</th>
                  <th width="100">النوع</th>
                  <th width="100">القيمة (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                ${mInvoices.map((inv, idx) => {
                  const customer = customers.find(c => c.id === inv.customerId);
                  return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><b>مبيعات ${customer ? customer.name : 'عميل غير مسجل'}</b></td>
                    <td><span class="bd-g">مبيعات واردة</span></td>
                    <td style="font-weight:800">${formatNum(inv.totalAfterDiscount)}</td>
                  </tr>
                `}).join('')}
                ${mExpenses.map((exp, idx) => {
                  const isRev = exp.type === 'revenue';
                  const i = idx + mInvoices.length + 1;
                  return `
                  <tr>
                    <td>${i}</td>
                    <td>${isRev ? 'إيراد' : 'مصروف'}: ${exp.category}</td>
                    <td><span class="bd-${isRev ? 'g' : 'r'}">${isRev ? 'وارد إضافي' : 'منصرف'}</span></td>
                    <td style="font-weight:800">${formatNum(exp.amount)}</td>
                  </tr>
                `}).join('')}
                ${mInvoices.length === 0 && mExpenses.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">لا توجد بيانات لهذه الفترة</td></tr>' : ''}
              </tbody>
            </table>

            <div style="border:2px solid ${profit >= 0 ? '#059669' : '#dc2626'};border-radius:14px;padding:16px;text-align:center;margin-top:14px;background:${profit >= 0 ? 'linear-gradient(180deg,#f0fdf4,#dcfce7)' : 'linear-gradient(180deg,#fff5f5,#fee2e2)'}">
              <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px">صافي الأرباح التشغيلية</div>
              <div style="font-size:28px;font-weight:900;color:${profit >= 0 ? '#059669' : '#dc2626'};font-family:'Tajawal',monospace">${formatNum(profit)} ج.م</div>
            </div>

            <div style="margin-top:30px;border:1px dashed #cbd5e1;height:120px;border-radius:8px;position:relative">
              <span style="position:absolute;top:10px;right:14px;color:#94a3b8;font-size:11px;font-weight:600">مساحة لكتابة ملاحظات للإدارة...</span>
            </div>

            <div class="fs" style="margin-top:20px">
              <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
              <div class="sb2"><div class="ti">مدير المبيعات</div><div class="ln">التوقيع</div></div>
            </div>
          </div>
        </body>
      </html>
    `;
    printHTMLInNewWindow(html);
  };
  
  const handleGenerateAndSendWA = async (customer: any) => {
    setWaLoadingId(customer.id);
    try {
      const delegateName = currentUser?.name || 'المندوب';
      const messageText = customer.isActive ? ACTIVE_CUSTOMER_MSG(delegateName) : INACTIVE_CUSTOMER_MSG(delegateName);

      let phone = customer.phone;
      if (phone.startsWith('0')) {
        phone = '20' + phone.substring(1);
      }

      const url = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
      window.open(url, '_blank');
    } catch (err: any) {
      console.error("WA message error:", err);
    } finally {
      setWaLoadingId(null);
    }
  };

  const filteredArchiveList = filteredInvoices.filter(inv => (inv.totalAfterDiscount || 0) <= (inv.paidAmount ?? (inv.totalAfterDiscount || 0)));
  const filteredDebtorsList = filteredInvoices.filter(inv => (inv.totalAfterDiscount || 0) > (inv.paidAmount ?? (inv.totalAfterDiscount || 0)));

  const exportMonthlyReportAsPNG = (monthStr: string, displayDate: string, sales: number, collected: number, revenuesParam: number, expensesParam: number, profit: number) => {
    const canvas = document.createElement('canvas');
    const rowHeight = 35;
    
    // get this month's invoices and expenses
    const mInvoices = delFilteredInvoices.filter(inv => inv && typeof inv.date === 'string' && inv.date.startsWith(monthStr));
    const mExpenses = delFilteredExpenses.filter(exp => exp && typeof exp.date === 'string' && exp.date.startsWith(monthStr));
    
    const totalLines = mInvoices.length + mExpenses.length;
    const baseHeight = 385;
    const W = 650;
    const TARGET_W = 3840;
    const dpr = Math.max(window.devicePixelRatio || 1, TARGET_W / W);
    canvas.width = W * dpr;
    canvas.height = (baseHeight + totalLines * rowHeight + 150) * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = (baseHeight + totalLines * rowHeight + 150) + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.direction = 'rtl';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, baseHeight + totalLines * rowHeight + 150);

    ctx.fillStyle = '#312e81';
    ctx.fillRect(15, 20, canvas.width - 30, 100);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('تقرير الحسابات الختامية - ' + displayDate, canvas.width / 2, 60);

    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillStyle = '#c7d2fe';
    ctx.fillText('تم التصدير من نظام المستودع والمبيعات', canvas.width / 2, 90);

    // Header values
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`إجمالي المبيعات: ${formatNum(sales)}ج.م`, canvas.width - 40, 160);
    ctx.fillText(`المحصل كاش: ${formatNum(collected)}ج.م`, canvas.width - 40, 185);
    ctx.fillText(`المتبقي (آجل): ${formatNum(sales - collected)}ج.م`, canvas.width - 40, 210);
    ctx.fillText(`الإيرادات الإضافية: ${formatNum(revenuesParam)}ج.م`, canvas.width - 40, 235);
    ctx.fillText(`المصروفات الدقيقة: ${formatNum(expensesParam)}ج.م`, canvas.width - 40, 260);
    ctx.fillStyle = profit >= 0 ? '#047857' : '#be123c';
    ctx.fillText(`صافي أرباح الشهر: ${formatNum(profit)}ج.م`, canvas.width - 40, 285);

    // Accounts section
    let y = 315;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(20, y - 30, canvas.width - 40, 35);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(20, y - 30, canvas.width - 40, 35);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('م', canvas.width - 35, y - 8);
    ctx.fillText('البيان / رقم الاستناد', canvas.width - 80, y - 8);
    ctx.textAlign = 'center';
    ctx.fillText('النوع', canvas.width - 350, y - 8);
    ctx.textAlign = 'left';
    ctx.fillText('القيمة (ج.م)', 40, y - 8);

    ctx.font = 'bold 12px system-ui, sans-serif';
    
    let index = 1;

    mInvoices.forEach(inv => {
      if (index % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(20, y, canvas.width - 40, rowHeight);
      }
      ctx.strokeStyle = '#f1f5f9';
      ctx.strokeRect(20, y, canvas.width - 40, rowHeight);

      const customer = customers.find(c => c.id === inv.customerId);
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'right';
      ctx.fillText(index.toString(), canvas.width - 35, y + 22);
      ctx.fillText(`مبيعات: ${customer ? customer.name : 'عميل غير مسجل'}`, canvas.width - 80, y + 22);
      
      ctx.textAlign = 'center';
      ctx.fillStyle = '#059669';
      ctx.fillText('مبيعات واردة', canvas.width - 350, y + 22);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(formatNum(inv.totalAfterDiscount), 40, y + 22);

      y += rowHeight;
      index++;
    });

    mExpenses.forEach(exp => {
      if (index % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(20, y, canvas.width - 40, rowHeight);
      }
      ctx.strokeStyle = '#f1f5f9';
      ctx.strokeRect(20, y, canvas.width - 40, rowHeight);

      const isRev = exp.type === 'revenue';

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'right';
      ctx.fillText(index.toString(), canvas.width - 35, y + 22);
      ctx.fillText(`${isRev ? 'إيراد' : 'مصروف'}: ${exp.category || 'عام'} - ${(exp.description || 'بدون بيان').substring(0, 30)}`, canvas.width - 80, y + 22);
      
      ctx.textAlign = 'center';
      ctx.fillStyle = isRev ? '#059669' : '#e11d48';
      ctx.fillText(isRev ? 'وارد إضافي' : 'منصرف', canvas.width - 350, y + 22);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(formatNum(exp.amount), 40, y + 22);

      y += rowHeight;
      index++;
    });

    y += 40;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(20, y, canvas.width - 40, 100);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(20, y, canvas.width - 40, 100);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 13px system-ui, sans-serif';
    
    // (الإجمالي - الخصم - المسدد - المتبقي)
    const mTotalBeforeDisc = mInvoices.reduce((sum, i) => sum + i.totalBeforeDiscount, 0);
    const mDisc = mInvoices.reduce((sum, i) => sum + (i.totalBeforeDiscount - i.totalAfterDiscount), 0);
    const mTotalSales = mTotalBeforeDisc - mDisc;
    // Assuming everything sold is paid so Masaddad = totalSales
    const remaining = mTotalSales - sales; // will be 0 just placeholder if later we have debt

    ctx.fillText('الإجمالي:', canvas.width - 40, y + 30);
    ctx.fillText('الخصم:', canvas.width - 40, y + 55);
    ctx.fillText('المسدد:', canvas.width - 40, y + 80);
    ctx.fillText('المتبقي:', canvas.width - 40, y + 105);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(formatNum(mTotalBeforeDisc) + 'ج.م', 40, y + 30);
    
    ctx.fillStyle = '#059669';
    ctx.fillText(formatNum(mDisc) + 'ج.م', 40, y + 55);
    
    ctx.fillStyle = '#4f46e5';
    ctx.fillText(formatNum(sales) + 'ج.م', 40, y + 80);
    
    ctx.fillStyle = '#ea580c';
    ctx.fillText(formatNum(remaining) + 'ج.م', 40, y + 105);

    y += 140;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillText('حسابات ختامية للتقارير - يمكن طباعتها وحفظها للأرشيف', canvas.width / 2, y);

    const downloadLink = document.createElement('a');
    downloadLink.download = `تقرير_شهر_${monthStr}.png`;
    downloadLink.href = canvas.toDataURL('image/png');
    downloadLink.click();
  };

  const downloadInventoryPDF = () => {
    const periodLabel = inventoryMatchFilter === 'daily' ? 'يومي' : inventoryMatchFilter === 'weekly' ? 'أسبوعي' : 'شهري';
    let tableRows = '';
    let totalLoaded = 0, totalSold = 0, totalRemaining = 0;
    let grandTotalValue = 0;

    inventoryData.processedGroups.forEach(({ groupData, activeCombinations }) => {
      activeCombinations.forEach(combo => {
        const product = inventoryData.productsMap.get(String(combo.productId).trim());
        if (!product) return;
        const activeWeights = getProductWeightsFallback(product);
        const weight = activeWeights.find(w => String(w.id).trim() === String(combo.weightId).trim()) || activeWeights[0];
        if (!weight) return;
        const comboKey = `${String(product.id).trim()}-${String(weight.id).trim()}`;
        const loaded = groupData.loads
          .filter(l => String(l.productId).trim() === String(product.id).trim() && String(l.weightId).trim() === String(weight.id).trim())
          .reduce((sum, l) => sum + (l.quantity || 0), 0);
        const sold = groupData.invItems
          .filter(item => String(item.productId).trim() === String(product.id).trim() && String(item.weightId).trim() === String(weight.id).trim())
          .reduce((sum, item) => sum + (item.quantity || 0), 0);
        // Use cumulative sold/loaded across all groups for real quantities
        const cumSold = inventoryData.cumulativeSoldMap[comboKey] || 0;
        const cumLoaded = inventoryData.cumulativeLoadedMap[comboKey] || 0;
        const remaining = cumLoaded - cumSold;
        const price = weight.price || 0;
        const value = cumSold * price;
        totalLoaded += cumLoaded;
        totalSold += cumSold;
        totalRemaining += remaining;
        grandTotalValue += value;
        const unitsPerCarton = weight.unitsPerCarton || 12;
        const formatUnits = (qty: number) => {
          const absQ = Math.abs(qty);
          const c = Math.floor(absQ / unitsPerCarton);
          const u = absQ % unitsPerCarton;
          let txt = '';
          if (c > 0) txt += `${c} كرتونة`;
          if (u > 0) txt += (txt ? ' + ' : '') + `${u} عبوة`;
          if (!txt) txt = '0';
          return qty < 0 ? `-${txt}` : txt;
        };
        tableRows += `<tr>
          <td style="font-weight:800">${product.name}</td>
          <td style="text-align:center">${weight.size}</td>
          <td style="text-align:center;font-family:'Tajawal',monospace">${formatUnits(loaded)}</td>
          <td style="text-align:center;font-family:'Tajawal',monospace">${formatUnits(sold)}</td>
          <td style="text-align:center;font-weight:800;font-family:'Tajawal',monospace;color:${remaining < 0 ? '#dc2626' : remaining === 0 ? '#64748b' : '#059669'}">${formatUnits(remaining)}</td>
          <td style="text-align:right;font-family:'Tajawal',monospace">${price.toLocaleString('ar-EG')}</td>
          <td style="text-align:right;font-weight:800;font-family:'Tajawal',monospace">${value.toLocaleString('ar-EG')} ج.م</td>
        </tr>`;
      });
    });

    const html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
      <div style="padding:12mm 14mm">
        <div class="rh">
          <h1>تقرير مطابقة المخزون</h1>
          <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
          <div class="ref">
            <span>الفترة: ${periodLabel}</span>
            <span>عدد الأصناف: ${inventoryData.processedGroups.reduce((s, g) => s + g.activeCombinations.length, 0)}</span>
          </div>
          <div class="ref" style="margin-top:4px">
            <span>تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}</span>
          </div>
        </div>

        <div class="sg">
          <div class="sb bl">
            <div class="l">إجمالي المحمل</div>
            <div class="v">${totalLoaded.toLocaleString('ar-EG')} <span style="font-size:10px">عبوة</span></div>
          </div>
          <div class="sb gr">
            <div class="l">إجمالي المبيع</div>
            <div class="v">${totalSold.toLocaleString('ar-EG')} <span style="font-size:10px">عبوة</span></div>
          </div>
          <div class="sb ${totalRemaining < 0 ? 'rd' : 'am'}">
            <div class="l">المتبقي</div>
            <div class="v">${totalRemaining.toLocaleString('ar-EG')} <span style="font-size:10px">عبوة</span></div>
          </div>
        </div>

        <div class="st"><span class="i">1</span> تفاصيل المخزون حسب الصنف</div>
        <table>
          <thead>
            <tr>
              <th>الصنف</th>
              <th width="60">الوزن</th>
              <th width="60">المحمل</th>
              <th width="60">المبيع</th>
              <th width="60">المتبقي</th>
              <th width="70">سعر الوحدة</th>
              <th width="90">قيمة المبيع</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
          <tfoot>
            <tr class="tfoot-success">
              <td colspan="2" style="padding:8px;font-size:10px;text-align:right">الإجمالي</td>
              <td style="padding:8px;text-align:center;font-size:10px">${totalLoaded} عبوة</td>
              <td style="padding:8px;text-align:center;font-size:10px">${totalSold} عبوة</td>
              <td style="padding:8px;text-align:center;font-size:10px">${totalRemaining} عبوة</td>
              <td colspan="2" style="padding:8px;text-align:right;font-size:10px">قيمة المبيعات: ${grandTotalValue.toLocaleString('ar-EG')} ج.م</td>
            </tr>
          </tfoot>
        </table>

        <div class="fs" style="margin-top:20px">
          <div class="sb2"><div class="ti">مدير المستودع</div><div class="ln">التوقيع</div></div>
          <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
        </div>
      </div>
    </body></html>`;
    printHTMLInNewWindow(html);
  };

  const downloadInventoryImage = () => {
    const canvas = document.createElement('canvas');
    const W = 1200;
    const TARGET_W = 3840;
    const dpr = Math.max(window.devicePixelRatio || 1, TARGET_W / W);
    canvas.width = W * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const headerH = 130;
    const rowH = 40;
    const groupHeaderH = 36;
    let totalRows = 0;
    let groupCount = 0;
    inventoryData.processedGroups.forEach(({ activeCombinations }) => { totalRows += activeCombinations.length; groupCount++; });
    const totalH = headerH + 50 + groupCount * groupHeaderH + totalRows * rowH + 80;
    canvas.height = totalH * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = totalH + 'px';
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, totalH);

    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e3a5f');
    grad.addColorStop(1, '#1e40af');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(16, 12, W - 32, headerH, 12);
    ctx.fill();

    ctx.fillStyle = '#d4a843';
    ctx.fillRect(16, 12 + headerH - 4, W - 32, 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Cairo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تقرير مطابقة المخزون', W / 2, 44);
    ctx.font = '600 12px Cairo, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('نظام التوزيع والمبيعات المعتمد', W / 2, 64);

    const periodLabel = inventoryMatchFilter === 'daily' ? 'يومي' : inventoryMatchFilter === 'weekly' ? 'أسبوعي' : 'شهري';
    const itemCount = inventoryData.processedGroups.reduce((s, g) => s + g.activeCombinations.length, 0);
    ctx.font = '700 11px Cairo, system-ui, sans-serif';

    // Badges row - centered below subtitle
    const badgesY = 78;
    const periodW = ctx.measureText(`الفترة: ${periodLabel}`).width + 24;
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.roundRect(W / 2 - periodW - 6, badgesY, periodW, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`الفترة: ${periodLabel}`, W / 2 - 6, badgesY + 15);

    const itemW = ctx.measureText(`${itemCount} صنف`).width + 24;
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.roundRect(W / 2 + 6, badgesY, itemW, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${itemCount} صنف`, W / 2 + 6 + itemW / 2, badgesY + 15);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 10px Cairo, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`تصدير: ${new Date().toLocaleDateString('ar-EG')}`, W - 40, badgesY + 15);

    let y = headerH + 24;

    const padX = 30;
    const tableW = W - padX * 2;
    const colM = W - padX - 25;
    const colProduct = W - padX - 70;
    const colWeight = W - padX - 230;
    const colLoaded = W - padX - 330;
    const colSold = W - padX - 440;
    const colRemaining = W - padX - 550;
    const colPrice = W - padX - 680;
    const colValue = W - padX - 810;

    const headerGrad = ctx.createLinearGradient(0, y, 0, y + 32);
    headerGrad.addColorStop(0, '#1e3a5f');
    headerGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = headerGrad;
    ctx.beginPath();
    ctx.roundRect(padX, y, tableW, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Cairo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('م', colM, y + 21);
    ctx.textAlign = 'right';
    ctx.fillText('الصنف', colProduct, y + 21);
    ctx.textAlign = 'center';
    ctx.fillText('الوزن', colWeight, y + 21);
    ctx.fillText('المحمل', colLoaded, y + 21);
    ctx.fillText('المبيع', colSold, y + 21);
    ctx.fillText('المتبقي', colRemaining, y + 21);
    ctx.fillText('سعر الوحدة', colPrice, y + 21);
    ctx.fillText('قيمة المبيع', colValue, y + 21);
    y += 32;

    let rowNum = 0;
    let totalLoaded = 0, totalSold = 0, totalRemaining = 0, grandTotalValue = 0;

    inventoryData.processedGroups.forEach(({ groupHeaderLabel, activeCombinations, groupData }) => {
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.roundRect(padX, y, tableW, groupHeaderH, 6);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#1e3a5f';
      ctx.font = '700 11px Cairo, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`▶ ${groupHeaderLabel} (${activeCombinations.length} أصناف)`, W - padX - 16, y + 23);
      y += groupHeaderH;

      activeCombinations.forEach(combo => {
        const product = inventoryData.productsMap.get(String(combo.productId).trim());
        if (!product) return;
        const activeWeights = getProductWeightsFallback(product);
        const weight = activeWeights.find(w => String(w.id).trim() === String(combo.weightId).trim()) || activeWeights[0];
        if (!weight) return;
        const comboKey = `${String(product.id).trim()}-${String(weight.id).trim()}`;
        const loaded = groupData.loads
          .filter(l => String(l.productId).trim() === String(product.id).trim() && String(l.weightId).trim() === String(weight.id).trim())
          .reduce((sum, l) => sum + (l.quantity || 0), 0);
        const sold = groupData.invItems
          .filter(item => String(item.productId).trim() === String(product.id).trim() && String(item.weightId).trim() === String(weight.id).trim())
          .reduce((sum, item) => sum + (item.quantity || 0), 0);
        const cumSold = inventoryData.cumulativeSoldMap[comboKey] || 0;
        const cumLoaded = inventoryData.cumulativeLoadedMap[comboKey] || 0;
        const remaining = cumLoaded - cumSold;
        const price = weight.price || 0;
        const value = cumSold * price;
        totalLoaded += cumLoaded; totalSold += cumSold; totalRemaining += remaining; grandTotalValue += value;

        if (rowNum % 2 === 0) { ctx.fillStyle = '#ffffff'; }
        else { ctx.fillStyle = '#f8fafc'; }
        ctx.fillRect(padX, y, tableW, rowH);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(padX, y, tableW, rowH);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 10px Tajawal, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(rowNum + 1), colM, y + 25);

        ctx.fillStyle = '#1e3a5f';
        ctx.font = '700 11px Cairo, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(product.name, colProduct, y + 25);

        ctx.fillStyle = '#4a5568';
        ctx.font = '600 10px Cairo, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(weight.size, colWeight, y + 25);

        ctx.fillStyle = '#1e40af';
        ctx.font = '700 11px Tajawal, system-ui, sans-serif';
        ctx.fillText(`${Math.floor(cumLoaded / (weight.unitsPerCarton || 12)).toLocaleString('ar-EG')} كرتونة`, colLoaded, y + 25);

        ctx.fillStyle = '#059669';
        ctx.fillText(`${Math.floor(cumSold / (weight.unitsPerCarton || 12)).toLocaleString('ar-EG')} كرتونة`, colSold, y + 25);

        ctx.fillStyle = remaining < 0 ? '#dc2626' : remaining === 0 ? '#64748b' : '#059669';
        ctx.font = '700 11px Tajawal, system-ui, sans-serif';
        ctx.fillText(`${Math.floor(remaining / (weight.unitsPerCarton || 12)).toLocaleString('ar-EG')} كرتونة`, colRemaining, y + 25);

        ctx.fillStyle = '#4a5568';
        ctx.font = '600 10px Tajawal, system-ui, sans-serif';
        ctx.fillText(`${price.toLocaleString('ar-EG')} ج.م`, colPrice, y + 25);

        ctx.fillStyle = '#1e3a5f';
        ctx.font = '700 11px Tajawal, system-ui, sans-serif';
        ctx.fillText(`${value.toLocaleString('ar-EG')} ج.م`, colValue, y + 25);

        y += rowH;
        rowNum++;
      });
    });

    const summaryGrad = ctx.createLinearGradient(0, y, 0, y + 40);
    summaryGrad.addColorStop(0, '#059669');
    summaryGrad.addColorStop(1, '#047857');
    ctx.fillStyle = summaryGrad;
    ctx.beginPath();
    ctx.roundRect(padX, y, tableW, 40, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px Cairo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`الإجمالي: ${Math.floor(totalLoaded / 12).toLocaleString('ar-EG')} كرتونة محملة | ${Math.floor(totalSold / 12).toLocaleString('ar-EG')} كرتونة مباعة | ${Math.floor(totalRemaining / 12).toLocaleString('ar-EG')} كرتونة متبقية | قيمة المبيعات: ${grandTotalValue.toLocaleString('ar-EG')} ج.م`, W / 2, y + 25);

    y += 56;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 11px Cairo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تم التصدير من نظام تتبع المبيعات', W / 2, y);

    const downloadLink = document.createElement('a');
    downloadLink.download = `تقرير_المخزون_${inventoryMatchFilter}.png`;
    downloadLink.href = canvas.toDataURL('image/png');
    downloadLink.click();
  };

  const filteredCustomerActivity = React.useMemo(() => {
    let list = [...(customers || [])];
    
    // Filter by Area (مطبّع)
    if (custAreaFilter) {
      list = list.filter(c => normalizeArabic(c.area) === custAreaFilter);
    }
    
    const invoicesByCustomer = new Map<string, Invoice[]>();
    delFilteredInvoices.forEach(inv => {
      if (!inv || !inv.date) return;
      const invDate = new Date(inv.date).getTime();
      if (isNaN(invDate)) return;
      const now = new Date().getTime();
      
      let include = true;
      if (custDateFilter === 'week') {
        include = (now - invDate) < 7 * 24 * 60 * 60 * 1000;
        if (custDayFilter.length > 0) {
          const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(inv.date));
          if (!custDayFilter.includes(englishDay)) include = false;
        }
      } else if (custDateFilter === 'month') {
        const mDate = new Date(inv.date);
        const cDate = new Date();
        include = mDate.getMonth() === cDate.getMonth() && mDate.getFullYear() === cDate.getFullYear();
      } else if (custDateFilter === 'custom' && custStartDate && custEndDate) {
        const fromDate = new Date(custStartDate).getTime();
        const toDate = new Date(custEndDate).getTime() + 86400000; // include full day
        include = invDate >= fromDate && invDate <= toDate;
      }

      if (include) {
        if (!invoicesByCustomer.has(inv.customerId)) {
          invoicesByCustomer.set(inv.customerId, []);
        }
        invoicesByCustomer.get(inv.customerId)!.push(inv);
      }
    });

    // Calculate stats based on period
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return list.map(c => {
      const custInvoices = invoicesByCustomer.get(c.id) || [];
      
      const totalPurchases = custInvoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount || 0), 0);
      const invoicesCount = custInvoices.length;
      const recentInvoices = [...custInvoices].sort((a,b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      const lastInvoiceDate = recentInvoices[0]?.date ? new Date(recentInvoices[0].date).getTime() : 0;
      const daysSinceLastInvoice = lastInvoiceDate > 0 ? Math.floor((now - lastInvoiceDate) / (24 * 60 * 60 * 1000)) : 999;
      
      return {
        ...c,
        totalPurchases,
        invoicesCount,
        recentInvoices,
        daysSinceLastInvoice,
        isActive: totalPurchases > 0 && (now - lastInvoiceDate) < TEN_DAYS_MS
      };
    }).filter(c => {
      if (custStatusFilter === 'active') return c.isActive;
      if (custStatusFilter === 'inactive') return !c.isActive;
      return true;
    }).sort((a, b) => b.totalPurchases - a.totalPurchases);
  }, [customers, delFilteredInvoices, custAreaFilter, custDateFilter, custStartDate, custEndDate, custStatusFilter, custDayFilter]);

  // Unique areas
  const areas = Array.from(new Set(customers.map(c => c.area).filter(Boolean)));

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 font-sans text-right animate-fade-in" dir="rtl" id="reports-tab-container">
      {/* Header */}
      <div 
        className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky z-[40] shadow-md flex items-center justify-between"
        style={{ top: 'var(--header-offset, 56px)' }}
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-indigo-200">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 5.07c2.81.42 5.01 2.62 5.43 5.43H13V7.07zM11 7.07v6.43H4.57c.42-2.81 2.62-5.01 5.43-5.43zM4.57 15H11v6.43c-2.81-.42-5.01-2.62-5.43-5.43zm8.43 6.43V15h6.43c-.42 2.81-2.62 5.01-5.43 5.43z" />
          </svg>
          <h1 className="text-xl font-bold">التقارير</h1>
        </div>
        <button
          onClick={onGoBack}
          className="bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 active:scale-95 text-white rounded-lg py-1.5 px-3.5 text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>الرئيسية</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-xl mx-auto p-4 flex flex-col gap-4">
        
        {isManager && (
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <label className="text-xs font-black text-indigo-800 shrink-0">عرض تقارير المندوب:</label>
            <select
              value={delegateFilter}
              onChange={(e) => setDelegateFilter(e.target.value)}
              className="w-full bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-xs font-bold text-indigo-900 focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              <option value="all">الكل (إجمالي الشركة)</option>
              {usersList.filter(u => u.role !== 'owner').map(u => (
                <option key={u.phone} value={u.phone}>{u.name}</option>
              ))}
            </select>
          </div>
        )}

        
        {/* Navigation Tabs inside Reports screen */}
        {(() => {
          const showFinance = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('reports_finance');
          const showStats = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('reports_stats');
          const showActiveCustomers = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('reports_areas');
          const showInvoices = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('reports_invoices');
          const showInventory = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('reports_inventory');
          return (
            <div className="flex flex-wrap bg-[#FFFFFF] p-2 rounded-2xl border border-slate-200 gap-1 sm:gap-2 shadow-sm text-center">
              {showFinance && (
                <button
                  onClick={() => setActiveSubTab('finance')}
                  className={`flex-1 py-1.5 px-1 rounded-xl font-black text-[11px] sm:text-[13px] transition-all cursor-pointer select-none ${
                    activeSubTab === 'finance' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none' : 'text-[#9CA3AF] bg-transparent border-transparent'
                  }`}
                >
                  الإيرادات والمصروفات
                </button>
              )}
              {showStats && (
                <button
                  onClick={() => setActiveSubTab('stats')}
                  className={`flex-1 py-1.5 px-1 rounded-xl font-black text-[11px] sm:text-[13px] transition-all cursor-pointer select-none ${
                    activeSubTab === 'stats' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none' : 'text-[#9CA3AF] bg-transparent border-transparent'
                  }`}
                >
                  الإحصائيات
                </button>
              )}
              {showActiveCustomers && (
                <button
                  onClick={() => setActiveSubTab('active_customers')}
                  className={`flex-1 py-1.5 px-1 rounded-xl font-black text-[11px] sm:text-[13px] transition-all cursor-pointer select-none ${
                    activeSubTab === 'active_customers' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none' : 'text-[#9CA3AF] bg-transparent border-transparent'
                  }`}
                >
                  العملاء النشطين
                </button>
              )}
              {showInvoices && (
                <button
                  onClick={() => setActiveSubTab('invoices')}
                  className={`flex-1 py-1.5 px-1 rounded-xl font-black text-[11px] sm:text-[13px] transition-all cursor-pointer select-none ${
                    activeSubTab === 'invoices' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none' : 'text-[#9CA3AF] bg-transparent border-transparent'
                  }`}
                >
                  تفاصيل الفواتير
                </button>
              )}
              {showInventory && (
                <button
                  onClick={() => setActiveSubTab('inventory')}
                  className={`flex-1 py-1.5 px-1 rounded-xl font-black text-[11px] sm:text-[13px] transition-all cursor-pointer select-none whitespace-nowrap ${
                    activeSubTab === 'inventory' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none' : 'text-[#9CA3AF] bg-transparent border-transparent'
                  }`}
                >
                  مطابقة المخزون
                </button>
              )}
            </div>
          );
        })()}
        
        {/* Date period filters for finance and stats */}
        {(activeSubTab === 'stats' || activeSubTab === 'finance' || activeSubTab === 'invoices') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-5 mb-1 text-right animate-fade-in" dir="rtl">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600 border border-indigo-100">
                  <Filter className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-slate-800 tracking-wide">لوحة الفلترة والبحث المتقدم للفواتير والحسابات</span>
              </div>
              
              <button 
                type="button" 
                onClick={() => {
                  setSelectedGov('all');
                  setSelectedArea('all');
                  setSelectedCustomer('all');
                  setPeriodFilter('all');
                }}
                className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50/60 p-1.5 px-3 rounded-lg border border-indigo-100 transition-all active:scale-95 cursor-pointer"
              >
                إعادة تعيين الفلاتر
              </button>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 items-end">
              
              {/* 1. Governorate */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-xs"></span>
                  المحافظة
                </label>
                <select 
                  value={selectedGov}
                  onChange={(e) => setSelectedGov(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all">كل المحافظات</option>
                  {uniqueGovs.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                </select>
              </div>

              {/* 2. Area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full shadow-xs"></span>
                  المنطقة
                </label>
                <select 
                  value={selectedArea}
                  onChange={(e) => { setSelectedArea(e.target.value); setSelectedCustomer('all'); }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all">كل المناطق</option>
                  {uniqueAreas.map(area => <option key={area} value={area}>{area}</option>)}
                </select>
              </div>

              {/* 3. Customer */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-xs"></span>
                  العميل
                </label>
                <select 
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all">كل العملاء</option>
                  {filteredCustomersList.map(cust => <option key={cust.id} value={cust.id}>{cust.name}</option>)}
                </select>
              </div>

              {/* 4. Delegate */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-violet-500 rounded-full shadow-xs"></span>
                  المندوب
                </label>
                <select 
                  value={delegateFilter}
                  onChange={(e) => setDelegateFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all">كل المناديب</option>
                  {usersList.filter(u => u.role !== 'owner').map(u => (
                    <option key={u.phone} value={u.phone}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* 5. Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shadow-xs"></span>
                  التاريخ
                </label>
                <input 
                  type="date" 
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setPeriodFilter('custom');
                    setCustomStartDate(e.target.value);
                    setCustomEndDate(e.target.value);
                  }}
                  className="w-full bg-amber-50/40 border border-amber-200 rounded-xl p-2.5 text-xs font-bold text-center text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all font-mono cursor-pointer"
                />
              </div>

            </div>
          </div>
        )}
        
        {/* Finance Tab (الإيرادات والمصروفات) */}
        {activeSubTab === 'finance' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Today Quick Summary */}
            <div className="bg-gradient-to-r from-[#1A365D] to-[#2B6CB0] rounded-2xl p-4 text-white flex flex-col gap-2 shadow-md">
              <span className="text-[10px] font-black text-blue-200 flex items-center gap-1">
                <Clock className="h-3 w-3" /> ملخص الفترة — {
                  periodFilter === 'all' ? 'الكل' :
                  periodFilter === 'today' ? 'اليوم' :
                  periodFilter === 'week' ? 'الأسبوع' :
                  periodFilter === 'month' ? 'الشهر' :
                  'مخصص'
                }
              </span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <span className="text-[9px] text-blue-200 font-bold block">الفواتير</span>
                  <span className="text-sm font-black">{periodStats.invoiceCount}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <span className="text-[9px] text-blue-200 font-bold block">المحصل</span>
                  <span className="text-sm font-black">{formatNum(periodStats.totalCollected)}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <span className="text-[9px] text-blue-200 font-bold block">المصروفات</span>
                  <span className="text-sm font-black text-rose-300">{formatNum(periodStats.expensesTotal)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <span className="text-[9px] text-blue-200 font-bold block">صافي الربح</span>
                  <span className="text-xs font-black">{formatNum(periodStats.periodProfit + periodStats.tripsCollected + periodStats.extraRevenues - periodStats.expensesTotal)}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <span className="text-[9px] text-blue-200 font-bold block">المشاوير</span>
                  <span className="text-xs font-black">{periodStats.tripsCount}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <span className="text-[9px] text-blue-200 font-bold block">محصل المشاوير</span>
                  <span className="text-xs font-black">{formatNum(periodStats.tripsCollected)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex flex-col gap-1 text-center justify-between">
                <div>
                  <span className="text-emerald-850 font-black text-xs block">إجمالي الإيرادات</span>
                  <span className="text-emerald-600 font-bold text-[9px] block leading-tight mt-0.5">المحصل + إيرادات إضافية + أرباح المشاوير</span>
                </div>
                <span className="text-xl font-black text-emerald-800 my-1 block">
                  {formatNum((salesStats.totalCollected + salesStats.extraRevenues + salesStats.totalTripsCollectedProfit) - salesStats.totalPaidToFactoryInPeriod - salesStats.totalSpent)}
                  <span className="text-xs mr-0.5">ج.م</span>
                </span>
                <div className="border-t border-emerald-200/50 pt-1 mt-1 text-[8px] text-emerald-700/80 flex flex-col gap-0.5 text-right font-medium">
                  <div className="flex justify-between">
                    <span>المحصل من العملاء:</span>
                    <span>{formatNum(salesStats.totalCollected)}ج</span>
                  </div>
                  {salesStats.extraRevenues > 0 && (
                    <div className="flex justify-between">
                      <span>إيرادات إضافية:</span>
                      <span>{formatNum(salesStats.extraRevenues)}ج</span>
                    </div>
                  )}
                  {salesStats.totalTripsCollectedProfit > 0 && (
                    <div className="flex justify-between">
                      <span>أرباح المشاوير:</span>
                      <span>{formatNum(salesStats.totalTripsCollectedProfit)}ج</span>
                    </div>
                  )}
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>المسدد للمصنع:</span>
                    <span>-{formatNum(salesStats.totalPaidToFactoryInPeriod)}ج</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>المصروفات التشغيلية:</span>
                    <span>-{formatNum(salesStats.totalSpent)}ج</span>
                  </div>
                </div>
              </div>
              <div 
                className="bg-rose-50 rounded-2xl p-4 border border-rose-100 flex flex-col gap-1 text-center cursor-pointer hover:bg-rose-100 transition-colors active:scale-95 justify-between"
                onClick={() => setViewingExpenses(!viewingExpenses)}
              >
                <div>
                  <span className="text-rose-700 font-black text-xs flex items-center justify-center gap-1">إجمالي المصروفات <ChevronDown className={`h-3 w-3 transition-transform ${viewingExpenses ? 'rotate-180' : ''}`} /></span>
                  <span className="text-rose-500 font-bold text-[9px] block mt-0.5">المصروفات النثرية والتشغيلية العامة</span>
                </div>
                <span className="text-xl font-black text-rose-800 my-1 block">{formatNum(salesStats.totalSpent)}<span className="text-xs">ج.م</span></span>
                {salesStats.totalSales > 0 && (
                  <span className="text-[9px] font-black text-rose-600 bg-rose-100 rounded-full px-2 py-0.5 inline-block">
                    نسبة المصروفات: {(salesStats.totalSpent / salesStats.totalSales * 100).toFixed(1)}%
                  </span>
                )}
                <div className="border-t border-rose-200/50 pt-1 mt-1 text-[8px] text-rose-700/80 text-center font-bold">
                  انقر لعرض تفاصيل المصروفات
                </div>
              </div>
            </div>

            {salesStats.remainingDebtToFactory > 0 && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex flex-col gap-1 shadow-xs animate-fade-in text-right">
                <div className="flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                  <span className="font-bold text-xs">تنبيه: دين متبقي للمصنع بذمة السيارة</span>
                </div>
                <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-amber-200/40">
                  <span className="text-[11px] text-amber-700 font-medium">إجمالي المديونية المستحقة للمصنع حالياً:</span>
                  <span className="text-sm font-black text-rose-800">{formatNum(salesStats.remainingDebtToFactory)} ج.م</span>
                </div>
              </div>
            )}

            {salesStats.totalRemaining > 0 && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 flex flex-col gap-2 shadow-xs animate-fade-in text-right">
                <div className="flex items-center gap-1.5 text-blue-800">
                  <AlertCircle className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  <span className="font-bold text-xs">تنبيه: ديون العملاء المدينين بذمة السيارة</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-blue-200/40">
                  <span className="text-[11px] text-blue-700 font-medium">إجمالي المديونية المستحقة من العملاء حالياً:</span>
                  <span className="text-sm font-black text-blue-800">{formatNum(salesStats.totalRemaining)} ج.م</span>
                </div>
                {debtorCustomers.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1 pt-1.5 border-t border-blue-200/30 max-h-[180px] overflow-y-auto">
                    {debtorCustomers.slice(0, 8).map((dc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white/60 rounded-lg px-2.5 py-1.5 text-[10px]">
                        <span className="font-bold text-blue-900">{dc.customer.name}</span>
                        <span className="font-black text-rose-700">{formatNum(dc.totalDebt)} ج.م</span>
                      </div>
                    ))}
                    {debtorCustomers.length > 8 && (
                      <span className="text-[9px] text-blue-500 text-center font-bold">+ {debtorCustomers.length - 8} عملاء آخرين</span>
                    )}
                  </div>
                )}
                {debtorCustomers.length > 0 && (
                  <button
                    onClick={() => { setActiveSubTab('finance'); setShowDebtorsModal(true); }}
                    className="w-full bg-[#1A365D] hover:bg-[#2B6CB0] text-white text-[10px] font-black py-1.5 rounded-lg transition-colors cursor-pointer mt-1"
                  >
                    عرض تفاصيل جميع العملاء المدينين
                  </button>
                )}
              </div>
            )}

            {viewingExpenses && (
              <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col gap-3 animate-fade-in">
                <h3 className="font-bold text-rose-700 text-sm border-b border-slate-100 pb-2">سجل المصروفات للفترة</h3>
                {/* Expense Category Breakdown */}
                {(() => {
                  const periodExpenses = currentFilteredData.expenses.filter(e => e.type !== 'revenue' && e.category !== 'سداد للمصنع' && e.type !== 'factory_payment');
                  if (periodExpenses.length === 0) return null;
                  const byCategory = periodExpenses.reduce((acc, e) => {
                    const cat = parseExpenseDescription(e.description);
                    acc[cat] = (acc[cat] || 0) + (e.amount || 0);
                    return acc;
                  }, {} as Record<string, number>);
                  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
                  const colors = ['bg-rose-100 text-rose-800', 'bg-orange-100 text-orange-800', 'bg-amber-100 text-amber-800', 'bg-yellow-100 text-yellow-800', 'bg-lime-100 text-lime-800'];
                  return (
                    <div className="flex flex-col gap-1.5 mb-2">
                      <span className="text-[10px] font-black text-gray-500">تفصيل حسب النوع:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {sorted.map(([cat, amount], i) => (
                          <span key={cat} className={`text-[9px] font-bold rounded-full px-2.5 py-1 flex items-center gap-1 ${colors[i % colors.length]}`}>
                            {cat}: {formatNum(amount)}ج ({(amount / salesStats.totalSpent * 100).toFixed(1)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div className="flex flex-col gap-2">
                  {currentFilteredData.expenses
                      .filter(e => e.type !== 'revenue' && e.category !== 'سداد للمصنع' && e.type !== 'factory_payment')
                      .sort((a,b) => {
                        const timeA = a.date ? new Date(a.date).getTime() : 0;
                        const timeB = b.date ? new Date(b.date).getTime() : 0;
                        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
                      })
                      .map((exp, idx) => (
                        <div key={idx} className="flex justify-between items-center border border-slate-100 p-2.5 rounded-lg bg-[#F7FAFC]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-bold text-[#DD6B20]">{parseExpenseDescription(exp.description)}</span>
                            <span className="text-[9px] text-gray-400 font-medium">{exp.date && !isNaN(new Date(exp.date).getTime()) ? new Date(exp.date).toLocaleString('ar-EG') : 'بدون تاريخ'}</span>
                          </div>
                          <span className="font-black text-xs text-rose-700">
                            - {exp.amount.toLocaleString('ar-EG')}ج.م
                          </span>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1. Stats and month-by-month analysis */}
        {activeSubTab === 'stats' && (
          <div className="flex flex-col gap-4 animate-fade-in">
              
              {/* Factory dashboard numbers */}
              <div className="grid grid-cols-2 gap-3.5 mt-1">
                
                <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-1 text-right">
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-600 flex items-center gap-1 justify-end">💰 المسدد للمصنع في الفترة</span>
                  <span className="text-xl font-black text-emerald-800" dir="rtl">{salesStats.totalPaidToFactoryInPeriod.toLocaleString('ar-EG')} ج.م</span>
                  <span className="text-[10px] text-emerald-600/90 font-extrabold mt-0.5">
                    شحن ومقدمات سداد مباشرة
                  </span>
                </div>

                <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-1 text-right">
                  <span className="text-[10px] sm:text-xs font-bold text-rose-600 flex items-center gap-1 justify-end">🏭 المتبقي للمصنع (المديونية)</span>
                  <span className="text-xl font-black text-rose-800" dir="rtl">{salesStats.remainingDebtToFactory.toLocaleString('ar-EG')} ج.م</span>
                  <span className="text-[10px] text-rose-500/80 font-extrabold mt-0.5">
                    مستحقات المصنع المعلقة حالياً
                  </span>
                </div>

              </div>

              {/* Tap-Interactive Primary Dashboards Section */}
              <div className="grid grid-cols-1 gap-3 mt-1.5">
                
                {/* 1. أرباح المشاوير */}
                <div 
                  onClick={() => setActiveDetailCard(activeDetailCard === 'trips' ? null : 'trips')}
                  className={`border-2 rounded-2xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:bg-indigo-50/20 active:scale-98 select-none ${
                    activeDetailCard === 'trips' ? 'border-indigo-500 bg-indigo-50/10 shadow-sm ring-2 ring-indigo-200' : 'bg-[#FFFFFF] border-slate-200'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 text-right flex-1">
                    <span className="text-xs font-extrabold text-[#2B6CB0] flex items-center gap-1">
                      🚚 أرباح المشاوير
                      <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-black">تحليل تفاعلي 🔍</span>
                    </span>
                    <span className="text-xl font-black text-[#1A365D]" dir="rtl">{salesStats.totalTripsCollectedProfit.toLocaleString('ar-EG')} ج.م</span>
                    {salesStats.totalSales > 0 && (
                      <span className="text-[9px] font-black text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5 w-fit inline-block">
                        نسبة: {(salesStats.totalTripsCollectedProfit / salesStats.totalSales * 100).toFixed(1)}%
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 font-bold">اضغط لمشاهدة المصروفات والمحصل الصافي</span>
                  </div>
                  <div className="bg-indigo-100 p-2.5 rounded-2xl text-[#1A365D]">
                    <MapPin className={`h-5 w-5 ${activeDetailCard === 'trips' ? 'animate-bounce' : ''}`} />
                  </div>
                </div>

                {/* 2. الصافي */}
                <div 
                  onClick={() => setActiveDetailCard(activeDetailCard === 'net' ? null : 'net')}
                  className={`border-2 rounded-2xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:bg-emerald-50/20 active:scale-98 select-none ${
                    activeDetailCard === 'net' ? 'border-emerald-500 bg-emerald-50/10 shadow-sm ring-2 ring-emerald-200' : 'bg-[#FFFFFF] border-slate-200'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 text-right flex-1">
                    <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                      📊 الصافي
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black">معادلة الأرباح والتكلفة 🔍</span>
                    </span>
                    <span className="text-xl font-black text-emerald-800" dir="rtl">{salesStats.cumulativeNetProfit.toLocaleString('ar-EG')} ج.م</span>
                    <span className="text-[10px] text-gray-400 font-bold">المحصل + المشاوير + الإيرادات الاضافية - المصروفات التشغيلية</span>
                  </div>
                  <div className="bg-emerald-100 p-2.5 rounded-2xl text-emerald-800">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>

                {/* 3. المتبقي المطلوب تحصيله */}
                <div 
                  onClick={() => setActiveDetailCard(activeDetailCard === 'debtors' ? null : 'debtors')}
                  className={`border-2 rounded-2xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:bg-rose-50/20 active:scale-98 select-none ${
                    activeDetailCard === 'debtors' ? 'border-rose-500 bg-rose-50/10 shadow-sm ring-2 ring-rose-200' : 'bg-[#FFFFFF] border-slate-200'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 text-right flex-1">
                    <span className="text-xs font-extrabold text-rose-700 flex items-center gap-1">
                      🎯 المتبقي المطلوب تحصيله
                      <span className="text-[9px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-black">ديون العملاء والمناديب 🔍</span>
                    </span>
                    <span className="text-xl font-black text-rose-800" dir="rtl">{salesStats.totalRemaining.toLocaleString('ar-EG')} ج.م</span>
                    <span className="text-[10px] text-gray-400 font-bold">اضغط لجدولة الديون ومسؤوليات المناديب في الميدان</span>
                  </div>
                  <div className="bg-rose-100 p-2.5 rounded-2xl text-rose-800">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                </div>

              </div>

              {/* Dynamic Interactive Detail Accordions */}
              {activeDetailCard === 'trips' && (
                <div className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-2xl text-right animate-fade-in flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
                    <h4 className="font-extrabold text-indigo-900 text-xs">🔍 حركة وأرباح تفصيلية للمشاوير والخدمات</h4>
                    <button onClick={() => setActiveDetailCard(null)} className="text-indigo-400 hover:text-indigo-900 text-xs font-bold bg-[#FFFFFF] px-2 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">علق ✕</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs font-black">
                    <div className="bg-[#FFFFFF] border border-indigo-100 p-2 rounded-xl flex flex-col">
                      <span className="text-indigo-600 font-bold text-[9px] mb-1">ما تم تحصيله</span>
                      <span className="text-emerald-700" dir="rtl">{(salesStats.totalTripsCollectedProfit).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="bg-[#FFFFFF] border border-indigo-100 p-2 rounded-xl flex flex-col">
                      <span className="text-indigo-600 font-bold text-[9px] mb-1">المستهلك/المصاريف</span>
                      <span className="text-rose-700" dir="rtl">{(currentFilteredData.expenses.filter(e => {
                        if (e.type === 'revenue') return false;
                        const desc = e.description || '';
                        return desc.includes('بنزين') || desc.includes('وقود') || desc.includes('مشوار') || desc.includes('سيارة') || desc.includes('سفر');
                      }).reduce((sum, e) => sum + (e.amount || 0), 0)).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="bg-[#FFFFFF] border border-indigo-100 p-2 rounded-xl flex flex-col">
                      <span className="text-indigo-600 font-bold text-[9px] mb-1">الصافي الفعلي</span>
                      <span className="text-indigo-900" dir="rtl">{((salesStats.totalTripsCollectedProfit) - (currentFilteredData.expenses.filter(e => {
                        if (e.type === 'revenue') return false;
                        const desc = e.description || '';
                        return desc.includes('بنزين') || desc.includes('وقود') || desc.includes('مشوار') || desc.includes('سيارة') || desc.includes('سفر');
                      }).reduce((sum, e) => sum + (e.amount || 0), 0))).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-indigo-700 leading-relaxed font-bold">
                    * ملاحظة: يتم احتساب أرباح النقل والتوصيل (المشاوير) وعرضها بناء على المشاوير المحصلة مع طرح مصاريف الوقود (البنزين) لسيارة التوزيع.
                  </p>
                </div>
              )}

              {activeDetailCard === 'net' && (
                <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl text-right animate-fade-in flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-emerald-200 pb-2">
                    <h4 className="font-extrabold text-emerald-950 text-xs">📊 تفاصيل معادلة صافي الأرباح (الصافي الفعلي)</h4>
                    <button onClick={() => setActiveDetailCard(null)} className="text-emerald-500 hover:text-emerald-900 text-xs font-bold bg-[#FFFFFF] px-2 py-0.5 rounded-lg border border-emerald-200 shadow-2xs">غلق ✕</button>
                  </div>
                  
                  <div className="flex flex-col gap-2 text-xs font-bold">
                    <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5">
                      <span className="text-slate-600">المحصل الفعلي من مبيعات العملاء (كاش)</span>
                      <span className="text-emerald-800" dir="rtl">{(salesStats.totalCollected).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5">
                      <span className="text-slate-600">يضاف: إيرادات إضافية وأرباح مشاوير محصلة</span>
                      <span className="text-emerald-700" dir="rtl">+ {(salesStats.extraRevenues + salesStats.totalTripsCollectedProfit).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5">
                      <span className="text-slate-600">يخصم: تكلفة البضاعة المباعة (COGS)</span>
                      <span className="text-rose-700" dir="rtl">- {(salesStats.factorySoldCost).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5">
                      <span className="text-slate-600">يخصم: إجمالي المصروفات الإدارية والتشغيلية المعتمدة</span>
                      <span className="text-rose-700" dir="rtl">- {(salesStats.totalSpent).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm font-black border-t border-emerald-300 pt-2 text-[#1A365D]">
                      <span>الصافي الفعلي النهائي للربح</span>
                      <span className="text-emerald-800" dir="rtl">{(salesStats.cumulativeNetProfit).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-600 leading-relaxed font-semibold">
                    * يتم احتساب "الصافي" التراكمي (جميع الدورات) = المحصل من العملاء + أرباح المشاوير + الإيرادات الاضافية - المصروفات التشغيلية.
                  </p>
                </div>
              )}

              {activeDetailCard === 'debtors' && (
                <div className="bg-rose-50/70 border border-rose-200 p-4 rounded-2xl text-right animate-fade-in flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-rose-200 pb-2">
                    <h4 className="font-extrabold text-rose-950 text-xs flex items-center gap-1.5">
                      <CircleDollarSign className="h-4 w-4" />
                      المديونيات والمعلقات المالية
                    </h4>
                    <button onClick={() => setActiveDetailCard(null)} className="text-rose-500 hover:text-rose-950 text-xs font-bold bg-[#FFFFFF] px-2 py-0.5 rounded-lg border border-rose-200 shadow-2xs">غلق ✕</button>
                  </div>

                  {/* Delegate Debts Summary */}
                  <div className="flex flex-col gap-1.5 text-right">
                    <span className="text-[11px] font-extrabold text-indigo-900 border-b border-indigo-200/40 pb-1">ديون العملاء والمناديب المعلقة:</span>
                    <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto">
                      {delegateDebtBreakdown.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-2 font-bold">لا توجد مديونيات معلقة حالياً.</p>
                      ) : (
                        delegateDebtBreakdown.map((del, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-[#FFFFFF] p-2 rounded-lg border border-slate-100 text-xs font-bold">
                            <span className="text-[#1A365D]" dir="rtl">{del.name}</span>
                            <span className="text-rose-600" dir="rtl">{del.val.toLocaleString('ar-EG')} ج.م</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-rose-200 pt-2 text-[10px] text-rose-900 font-extrabold">
                    <span>إجمالي المديونيات:</span>
                    <span dir="rtl">{formatNum(salesStats.totalRemaining)} ج.م</span>
                  </div>

                  <button
                    onClick={() => {
                      setActiveDetailCard(null);
                      setShowDebtorsModal(true);
                    }}
                    className="w-full bg-[#1A365D] hover:bg-[#2B6CB0] text-[#FFFFFF] font-black text-xs py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer mt-1 flex items-center justify-center gap-1.5"
                  >
                    <Search className="h-3.5 w-3.5" />
                    فتح سجل العملاء المدينين والتحصيل التفصيلي
                  </button>
                </div>
              )}

              {/* Factory Loaded & Paid Cards */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500">فترة تقارير المصنع:</span>
                  <div className="grid grid-cols-4 bg-slate-50 border border-slate-200 p-1 rounded-xl text-center gap-1 flex-1">
                    {([['all','الكل'],['daily','يومي'],['weekly','أسبوعي'],['monthly','شهري']] as const).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => setFactoryReportFilter(key)} className={`py-1 px-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${factoryReportFilter === key ? 'bg-white text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-100'}`}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* 📅 Days of the Week Selector for Weekly Filter */}
                {factoryReportFilter === 'weekly' && (
                  <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2 text-right animate-fade-in" dir="rtl">
                    <span className="text-[9px] font-black text-slate-400">اختر أيام الأسبوع للفلترة:</span>
                    <div className="flex flex-wrap gap-1 justify-start">
                      {['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((dayName, idx) => {
                        const isSelected = factoryReportWeekDays.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setFactoryReportWeekDays(prev => 
                                isSelected ? prev.filter(d => d !== idx) : [...prev, idx]
                              );
                            }}
                            className={`py-1 px-2.5 rounded-lg text-[10px] font-black transition-all cursor-pointer border ${
                              isSelected 
                                ? 'bg-[#1A365D] text-white border-[#1A365D] shadow-xs' 
                                : 'bg-white text-gray-400 border-gray-200 hover:bg-slate-50'
                            }`}
                          >
                            {dayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const filteredLoads = currentFilteredData.factoryLoads.filter(l => {
                  const d = new Date(l.date);
                  if (isNaN(d.getTime())) return true;
                  const now = new Date();
                  if (factoryReportFilter === 'daily') return d.toDateString() === now.toDateString();
                  if (factoryReportFilter === 'weekly') {
                    const diff = Math.abs(now.getTime() - d.getTime());
                    const withinLastWeek = Math.ceil(diff / 86400000) <= 7;
                    const jsDay = d.getDay();
                    const weekIdx = jsDay === 6 ? 0 : jsDay + 1;
                    return withinLastWeek && factoryReportWeekDays.includes(weekIdx);
                  }
                  if (factoryReportFilter === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  return true;
                });
                const filteredPayments = currentFilteredData.extraPayments.filter(p => {
                  const d = new Date(p.date);
                  if (isNaN(d.getTime())) return true;
                  const now = new Date();
                  if (factoryReportFilter === 'daily') return d.toDateString() === now.toDateString();
                  if (factoryReportFilter === 'weekly') {
                    const diff = Math.abs(now.getTime() - d.getTime());
                    const withinLastWeek = Math.ceil(diff / 86400000) <= 7;
                    const jsDay = d.getDay();
                    const weekIdx = jsDay === 6 ? 0 : jsDay + 1;
                    return withinLastWeek && factoryReportWeekDays.includes(weekIdx);
                  }
                  if (factoryReportFilter === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  return true;
                });
                const oldestLoadDate = filteredLoads.length > 0 
                  ? new Date(Math.min(...filteredLoads.map(l => new Date(l.date).getTime())))
                  : null;

                const getStartOfDay = (dateObj: Date) => {
                  const res = new Date(dateObj);
                  res.setHours(0, 0, 0, 0);
                  return res.getTime();
                };

                const oldestLoadTime = oldestLoadDate ? getStartOfDay(oldestLoadDate) : null;

                const lastArchiveTimestamp = archiveCycles.length > 0
                  ? Math.max(...archiveCycles.map(c => Number(c.id)))
                  : 0;

                const filteredInvoicesForFactory = oldestLoadTime === null
                  ? []
                  : currentFilteredData.invoices.filter(inv => {
                      const invTime = getStartOfDay(new Date(inv.date));
                      if (invTime < oldestLoadTime) return false;
                      
                      const d = new Date(inv.date);
                      if (isNaN(d.getTime())) return true;
                      const now = new Date();
                      if (factoryReportFilter === 'daily') return d.toDateString() === now.toDateString();
                      if (factoryReportFilter === 'weekly') {
                        const diff = Math.abs(now.getTime() - d.getTime());
                        const withinLastWeek = Math.ceil(diff / 86400000) <= 7;
                        const jsDay = d.getDay();
                        const weekIdx = jsDay === 6 ? 0 : jsDay + 1;
                        return withinLastWeek && factoryReportWeekDays.includes(weekIdx);
                      }
                      if (factoryReportFilter === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                      return true;
                    });

                const allLoadsCumulative = currentFilteredData.factoryLoads;

                const allInvoicesSinceCycle = lastArchiveTimestamp === 0
                  ? currentFilteredData.invoices
                  : currentFilteredData.invoices.filter(inv => {
                      const invTime = getStartOfDay(new Date(inv.date));
                      return invTime >= lastArchiveTimestamp;
                    });

                const totalLoadedCartons = filteredLoads.reduce((s, l) => {
                  const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                  const weights = prod ? getProductWeightsFallback(prod) : [];
                  const weight = weights.find(w => String(w.id).trim() === String(l.weightId || '').trim());
                  const upc = weight?.unitsPerCarton || 12;
                  return s + (l.cartonsCount !== undefined ? l.cartonsCount : Math.floor((l.quantity || 0) / upc));
                }, 0);
                const totalLoadedValue = filteredLoads.reduce((s, l) => {
                  const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                  const weights = prod ? getProductWeightsFallback(prod) : [];
                  const weight = weights.find(w => String(w.id).trim() === String(l.weightId || '').trim());
                  const upc = weight?.unitsPerCarton || 12;
                  const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor((l.quantity || 0) / upc);
                  const loose = l.looseUnitsCount !== undefined ? l.looseUnitsCount : (l.quantity || 0) % upc;
                  const cp = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
                  const up = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
                  return s + (cartons * cp) + (loose * up);
                }, 0);
                const totalPaid = filteredPayments.reduce((s, p) => s + (p.amount || 0) - (p.appliedToCarriedDebt || 0), 0);
                const totalPaidAllTime = currentFilteredData.allExtraPayments.reduce((s, p) => s + (p.amount || 0) - (p.appliedToCarriedDebt || 0), 0);

                const factorySoldCostForPeriod = filteredInvoicesForFactory.reduce((sum, inv) => {
                  const itemsCost = Array.isArray(inv.items) ? inv.items.reduce((isum, it) => {
                    if (!it) return isum;
                    const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
                    const weights = prod ? getProductWeightsFallback(prod) : [];
                    const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
                    const fpPerUnit = getItemFactoryCost(it, weight, prod);
                    return isum + (fpPerUnit * (it.quantity || 0));
                  }, 0) : 0;
                  return sum + itemsCost;
                }, 0);

                const factorySoldCartonsForPeriod = filteredInvoicesForFactory.reduce((sum, inv) => {
                  if (!inv.items) return sum;
                  return sum + inv.items.reduce((isum, it) => {
                    if (!it) return isum;
                    const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
                    const weights = prod ? getProductWeightsFallback(prod) : [];
                    const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
                    const upc = weight?.unitsPerCarton || 12;
                    return isum + (it.quantity / upc);
                  }, 0);
                }, 0);

                const factorySoldCostCurrentCycle = allInvoicesSinceCycle.reduce((sum, inv) => {
                  const itemsCost = Array.isArray(inv.items) ? inv.items.reduce((isum, it) => {
                    if (!it) return isum;
                    const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
                    const weights = prod ? getProductWeightsFallback(prod) : [];
                    const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
                    const fpPerUnit = getItemFactoryCost(it, weight, prod);
                    return isum + (fpPerUnit * (it.quantity || 0));
                  }, 0) : 0;
                  return sum + itemsCost;
                }, 0);

                const factorySoldCartonsCurrentCycle = allInvoicesSinceCycle.reduce((sum, inv) => {
                  if (!inv.items) return sum;
                  return sum + inv.items.reduce((isum, it) => {
                    if (!it) return isum;
                    const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
                    const weights = prod ? getProductWeightsFallback(prod) : [];
                    const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
                    const upc = weight?.unitsPerCarton || 12;
                    return isum + (it.quantity / upc);
                  }, 0);
                }, 0);

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                      {/* Card 1: إجمالي المحمل */}
                      <div 
                        onClick={() => setExpandedFactoryCard(expandedFactoryCard === 'loaded' ? null : 'loaded')}
                        className={`bg-[#FFFFFF] border p-4 rounded-2xl shadow-xs transition-all duration-200 cursor-pointer select-none text-right flex flex-col justify-between gap-3 group relative overflow-hidden ${expandedFactoryCard === 'loaded' ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50/20' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'}`}
                      >
                        <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-indigo-50 rounded-full group-hover:scale-125 transition-transform duration-300 opacity-50 z-0"></div>
                        <div className="flex justify-between items-start z-10">
                          <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
                            <Package className="h-6 w-6" />
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-100">المحمل</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 z-10">
                          <span className="text-[11px] text-slate-500 font-bold">إجمالي المحمل</span>
                          <h3 className="text-xl font-black text-slate-800 font-mono tracking-tight" dir="rtl">
                            {allLoadsCumulative.reduce((s, l) => {
                              const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                              const weights = prod ? getProductWeightsFallback(prod) : [];
                              const weight = weights.find(w => String(w.id).trim() === String(l.weightId || '').trim());
                              const upc = weight?.unitsPerCarton || 12;
                              return s + (l.cartonsCount !== undefined ? l.cartonsCount : Math.floor((l.quantity || 0) / upc));
                            }, 0).toLocaleString('ar-EG')} <span className="text-xs font-black text-slate-500 mr-0.5">كرتونة</span>
                          </h3>
                        </div>
                      </div>

                      {/* Card 2: ما تم سداده للمصنع */}
                      <div 
                        onClick={() => setExpandedFactoryCard(expandedFactoryCard === 'paid' ? null : 'paid')}
                        className={`bg-[#FFFFFF] border p-4 rounded-2xl shadow-xs transition-all duration-200 cursor-pointer select-none text-right flex flex-col justify-between gap-3 group relative overflow-hidden ${expandedFactoryCard === 'paid' ? 'ring-2 ring-emerald-500 border-transparent bg-emerald-50/20' : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'}`}
                      >
                        <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-50 rounded-full group-hover:scale-125 transition-transform duration-300 opacity-50 z-0"></div>
                        <div className="flex justify-between items-start z-10">
                          <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
                            <Wallet className="h-6 w-6" />
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-100">المسدد</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 z-10">
                          <span className="text-[11px] text-slate-500 font-bold">إجمالي المسدد لكل الدورات</span>
                          <h3 className="text-xl font-black text-slate-800 font-mono tracking-tight" dir="rtl">
                            {totalPaidAllTime.toLocaleString('ar-EG')} <span className="text-xs font-black text-slate-500 mr-0.5">ج.م</span>
                          </h3>
                          {totalLoadedValue > 0 ? (
                            <span className="text-[10px] text-emerald-600 font-extrabold">
                              نسبة السداد: {((totalPaid / totalLoadedValue) * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">لا يوجد تحميلات للفترة</span>
                          )}
                        </div>
                      </div>

                      {/* Card 3: إجمالي دين المصنع */}
                      <div 
                        onClick={() => setExpandedFactoryCard(expandedFactoryCard === 'debt' ? null : 'debt')}
                        className={`bg-[#FFFFFF] border p-4 rounded-2xl shadow-xs transition-all duration-200 cursor-pointer select-none text-right flex flex-col justify-between gap-3 group relative overflow-hidden ${expandedFactoryCard === 'debt' ? 'ring-2 ring-rose-500 border-transparent bg-rose-50/20' : 'border-slate-200 hover:border-rose-300 hover:shadow-md'}`}
                      >
                        <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-rose-50 rounded-full group-hover:scale-125 transition-transform duration-300 opacity-50 z-0"></div>
                        <div className="flex justify-between items-start z-10">
                          <div className="bg-rose-100 p-2.5 rounded-xl text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors duration-200">
                            <CircleDollarSign className="h-6 w-6" />
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold border border-rose-100">الدين</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 z-10">
                          <span className="text-[11px] text-slate-500 font-bold">المتبقي للمصنع من هذه الفترة</span>
                          <h3 className="text-xl font-black text-slate-800 font-mono tracking-tight" dir="rtl">
                            {(totalLoadedValue - totalPaid).toLocaleString('ar-EG')} <span className="text-xs font-black text-slate-500 mr-0.5">ج.م</span>
                          </h3>
                        </div>
                      </div>

                      {/* Card 4: إجمالي دين المصنع في السيارة */}
                      <div 
                        onClick={() => setExpandedFactoryCard(expandedFactoryCard === 'sold' ? null : 'sold')}
                        className={`bg-[#FFFFFF] border p-4 rounded-2xl shadow-xs transition-all duration-200 cursor-pointer select-none text-right flex flex-col justify-between gap-3 group relative overflow-hidden ${expandedFactoryCard === 'sold' ? 'ring-2 ring-amber-500 border-transparent bg-amber-50/20' : 'border-slate-200 hover:border-amber-300 hover:shadow-md'}`}
                      >
                        <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-amber-50 rounded-full group-hover:scale-125 transition-transform duration-300 opacity-50 z-0"></div>
                        <div className="flex justify-between items-start z-10">
                          <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-200">
                            <Activity className="h-6 w-6" />
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-100">المباع</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 z-10">
                          <span className="text-[11px] text-slate-500 font-bold">دين المصنع في السيارة</span>
                          <h3 className="text-xl font-black text-slate-800 font-mono tracking-tight" dir="rtl">
                            {factorySoldCostCurrentCycle.toLocaleString('ar-EG')} <span className="text-xs font-black text-slate-500 mr-0.5">ج.م</span>
                          </h3>
                          <span className="text-[10px] text-amber-600 font-extrabold" dir="rtl">
                            مباع: {factorySoldCartonsCurrentCycle % 1 === 0 ? Math.round(factorySoldCartonsCurrentCycle) : factorySoldCartonsCurrentCycle.toFixed(1)} كرتونة
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Details Drawer */}
                    {expandedFactoryCard && (
                      <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm animate-fade-in text-right mt-3 flex flex-col gap-3">
                        {expandedFactoryCard === 'loaded' && (
                          <>
                            <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-2 text-sm flex items-center justify-between">
                              <span>إجمالي التحميلات من المصنع (كل الأوقات)</span>
                              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black">
                                {allLoadsCumulative.reduce((s, l) => {
                                  const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                                  const weights = prod ? getProductWeightsFallback(prod) : [];
                                  const weight = weights.find(w => String(w.id).trim() === String(l.weightId || '').trim());
                                  const upc = weight?.unitsPerCarton || 12;
                                  return s + (l.cartonsCount !== undefined ? l.cartonsCount : Math.floor((l.quantity || 0) / upc));
                                }, 0).toLocaleString('ar-EG')} كرتونة
                              </span>
                            </h4>
                            <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scroll pr-1">
                              {(() => {
                                const groups: { [key: string]: { name: string; size: string; cartons: number; upc: number } } = {};
                                allLoadsCumulative.forEach(l => {
                                  const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                                  const weights = prod ? getProductWeightsFallback(prod) : [];
                                  const weight = weights.find(w => String(w.id).trim() === String(l.weightId || '').trim());
                                  const upc = weight?.unitsPerCarton || 12;
                                  const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor((l.quantity || 0) / upc);
                                  const key = `${l.productId}-${l.weightId}`;
                                  if (!groups[key]) {
                                    groups[key] = {
                                      name: prod?.name || l.productName || 'غير معروف',
                                      size: weight?.size || '',
                                      cartons: 0,
                                      upc: upc
                                    };
                                  }
                                  groups[key].cartons += cartons;
                                });
                                const loadList = Object.values(groups);
                                return loadList.map((item, i) => {
                                  const isWhole = item.cartons % 1 === 0;
                                  return (
                                    <div key={i} className="flex justify-between items-center text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 hover:bg-slate-100/50 transition-colors">
                                      <span className="font-bold">{item.name} ({item.size})</span>
                                      <span className="font-black text-indigo-700">
                                        {isWhole ? Math.round(item.cartons) : item.cartons.toFixed(1)} كرتونة
                                      </span>
                                    </div>
                                  );
                                });
                              })()}
                              {allLoadsCumulative.length === 0 && <p className="text-slate-400 text-center text-xs py-4 font-bold">لا توجد حمولات مسجلة</p>}
                            </div>
                          </>
                        )}

                        {expandedFactoryCard === 'paid' && (
                          <>
                            <h4 className="font-bold text-emerald-950 border-b border-slate-100 pb-2 text-sm flex items-center justify-between">
                              <span>سجل الدفعات والمسدد لكل الدورات</span>
                              <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black">
                                الإجمالي: {totalPaidAllTime.toLocaleString('ar-EG')} ج.م
                              </span>
                            </h4>
                            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scroll pr-1">
                              {(() => {
                                const sortedCycles = [...archiveCycles].sort((a, b) => Number(a.id) - Number(b.id));
                                const allPaymentsSorted = [...currentFilteredData.allExtraPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                
                                const cycleGroups: { cycleId: number; cycleIndex: number; payments: typeof allPaymentsSorted; total: number }[] = [];
                                
                                sortedCycles.forEach((cycle, idx) => {
                                  const cycleTime = Number(cycle.id);
                                  const nextCycleTime = idx < sortedCycles.length - 1 ? Number(sortedCycles[idx + 1].id) : Infinity;
                                  const cyclePayments = allPaymentsSorted.filter(p => {
                                    const pTime = new Date(p.date).getTime();
                                    return pTime >= cycleTime && pTime < nextCycleTime;
                                  });
                                  if (cyclePayments.length > 0) {
                                    cycleGroups.push({
                                      cycleId: cycleTime,
                                      cycleIndex: idx + 1,
                                      payments: cyclePayments,
                                      total: cyclePayments.reduce((s, p) => s + (p.amount || 0) - (p.appliedToCarriedDebt || 0), 0)
                                    });
                                  }
                                });
                                
                                const currentPayments = allPaymentsSorted.filter(p => {
                                  const pTime = new Date(p.date).getTime();
                                  const lastCycleTime = sortedCycles.length > 0 ? Number(sortedCycles[sortedCycles.length - 1].id) : 0;
                                  return pTime >= lastCycleTime;
                                });
                                if (currentPayments.length > 0) {
                                  cycleGroups.push({
                                    cycleId: 0,
                                    cycleIndex: sortedCycles.length + 1,
                                    payments: currentPayments,
                                    total: currentPayments.reduce((s, p) => s + (p.amount || 0) - (p.appliedToCarriedDebt || 0), 0)
                                  });
                                }
                                
                                return cycleGroups.length > 0 ? cycleGroups.map(group => (
                                  <div key={group.cycleId} className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
                                      <span className="text-[10px] font-black text-emerald-800">دورة {group.cycleIndex}</span>
                                      <span className="text-[10px] font-black text-emerald-700">الإجمالي: {formatNum(group.total)} ج.م</span>
                                    </div>
                                    {group.payments.map((p, i) => {
                                      const notesParsed = (() => {
                                        if (p.notes && p.notes.startsWith('{')) {
                                          try { return JSON.parse(p.notes); } catch { return { notes: p.notes }; }
                                        }
                                        return { notes: p.notes };
                                      })();
                                      return (
                                        <div key={`${group.cycleId}_${i}`} className="flex justify-between items-center text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 hover:bg-slate-100/50 transition-colors">
                                          <div className="flex flex-col gap-0.5 flex-1">
                                            <span className="font-bold">{notesParsed.notes || 'تسديد نقدي للمصنع'}</span>
                                            <span className="text-[10px] text-slate-400">{p.date ? new Date(p.date).toLocaleDateString('ar-EG') : ''} {p.delegateName ? `— ${p.delegateName}` : ''}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-black text-emerald-700">{formatNum(p.amount)} ج.م</span>
                                            {onDeleteExpense && (
                                              <button onClick={(e) => { e.stopPropagation(); if (confirm('هل أنت متأكد من حذف هذا التسديد؟')) onDeleteExpense(String(p.id)); }} className="text-rose-400 hover:text-rose-600 transition-colors p-0.5" title="حذف">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )) : <p className="text-slate-400 text-center text-xs py-4 font-bold">لا توجد دفعات مسجلة</p>;
                              })()}
                            </div>
                          </>
                        )}

                        {expandedFactoryCard === 'debt' && (
                          <>
                            <h4 className="font-bold text-rose-950 border-b border-slate-100 pb-2 text-sm flex items-center justify-between">
                              <span>تحليل ديون المصنع والمديونية</span>
                              <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-black">
                                الدين الإجمالي
                              </span>
                            </h4>
                            <div className="flex flex-col gap-3 p-3 bg-rose-50/20 border border-rose-100 rounded-2xl text-xs font-bold text-slate-700">
                              <div className="flex justify-between items-center pb-2 border-b border-rose-100/40">
                                <span>قيمة البضائع المحملة من المصنع (الدين الأساسي):</span>
                                <span className="font-mono text-slate-800">{totalLoadedValue.toLocaleString('ar-EG')} ج.م</span>
                              </div>
                              <div className="flex justify-between items-center pb-2 border-b border-rose-100/40">
                                <span>إجمالي المبالغ المسددة للمصنع في هذه الفترة:</span>
                                <span className="font-mono text-emerald-600">- {totalPaid.toLocaleString('ar-EG')} ج.م</span>
                              </div>
                              <div className="flex justify-between items-center text-sm font-black text-rose-700 pt-1">
                                <span>صافي دين المصنع المتبقي لهذه الفترة:</span>
                                <span className="font-mono">{(totalLoadedValue - totalPaid).toLocaleString('ar-EG')} ج.م</span>
                              </div>
                            </div>
                          </>
                        )}

                        {expandedFactoryCard === 'sold' && (
                          <>
                            <h4 className="font-bold text-amber-950 border-b border-slate-100 pb-2 text-sm flex items-center justify-between">
                              <span>إجمالي مبيعات هذه الدورة (بسعر المصنع)</span>
                              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black">
                                القيمة: {factorySoldCostCurrentCycle.toLocaleString('ar-EG')} ج.م
                              </span>
                            </h4>
                            <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scroll pr-1">
                              {(() => {
                                const groups: { [key: string]: { name: string; size: string; quantity: number; cost: number; upc: number } } = {};
                                allInvoicesSinceCycle.forEach(inv => {
                                  if (!inv.items) return;
                                  inv.items.forEach(it => {
                                    if (!it) return;
                                    const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
                                    const weights = prod ? getProductWeightsFallback(prod) : [];
                                    const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
                                    const key = `${it.productId}-${it.weightId}`;
                                    const fpPerUnit = getItemFactoryCost(it, weight, prod);
                                    const itemCost = fpPerUnit * (it.quantity || 0);
                                    const upc = weight?.unitsPerCarton || 12;
                                    
                                    if (!groups[key]) {
                                      groups[key] = {
                                        name: prod?.name || it.productName || 'غير معروف',
                                        size: weight?.size || '',
                                        quantity: 0,
                                        cost: 0,
                                        upc: upc
                                      };
                                    }
                                    groups[key].quantity += it.quantity || 0;
                                    groups[key].cost += itemCost;
                                  });
                                });
                                const soldList = Object.values(groups);
                                return (
                                  <>
                                    {soldList.map((item, i) => {
                                      const cartons = item.quantity / item.upc;
                                      const isWhole = cartons % 1 === 0;
                                      return (
                                        <div key={i} className="flex justify-between items-center text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 hover:bg-slate-100/50 transition-colors">
                                          <span className="font-bold">{item.name} ({item.size})</span>
                                          <span className="font-black text-amber-700">
                                            {isWhole ? Math.round(cartons) : cartons.toFixed(1)} كرتونة — {item.cost.toLocaleString('ar-EG')} ج.م
                                          </span>
                                        </div>
                                      );
                                    })}
                                    {soldList.length === 0 && <p className="text-slate-400 text-center text-xs py-4 font-bold">لا توجد مبيعات مسجلة في هذه الفترة</p>}
                                  </>
                                );
                              })()}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Period Reports Table */}
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <h3 className="font-bold text-[#1A365D] text-sm border-b border-slate-100 pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 pb-1">
                    <Clock className="h-4.5 w-4.5 text-[#2B6CB0]" />
                    تحليل الفترة
                  </span>
                  
                  <button 
                    onClick={exportComprehensiveReportAsPDF}
                    className="flex items-center gap-1.5 bg-[#1F2937] hover:bg-[#374151] text-[#FFFFFF] text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer select-none"
                    dir="rtl"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    تحميل التقرير الشامل (PDF)
                  </button>
                </h3>

                <div className="flex flex-row flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-[#2B6CB0] ml-1 shrink-0">فترة التحليل:</span>
                  <div className="flex flex-wrap items-center gap-1.5 flex-1 select-none">
                    {(['all', 'today', 'week', 'month', 'custom'] as const).map((f) => (
                      <button key={f} onClick={() => setPeriodFilter(f)} className={`py-1 px-3 rounded-lg text-[10px] font-black transition-colors cursor-pointer shrink-0 ${periodFilter === f ? 'bg-[#1A365D] text-white shadow-xs' : 'bg-[#F7FAFC] text-[#2B6CB0] border border-slate-200 hover:bg-slate-50'}`}>
                        {f === 'all' ? 'الكل' : f === 'today' ? 'يومي' : f === 'week' ? 'أسبوعي' : f === 'month' ? 'شهري' : 'مخصص'}
                      </button>
                    ))}
                  </div>
                </div>
                {periodFilter === 'week' && (
                  <div className="flex flex-wrap gap-1.5 mt-1 animate-fade-in">
                    {(['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] as const).map((dayName, idx) => {
                      const isSelected = selectedWeekDays.includes(idx);
                      return (
                        <button key={idx} onClick={() => { setSelectedWeekDays(prev => isSelected ? prev.filter(d => d !== idx) : [...prev, idx]); }} className={`py-1 px-2.5 rounded-lg text-[10px] font-black transition-all cursor-pointer border ${isSelected ? 'bg-[#1A365D] text-white border-[#1A365D] shadow-xs' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
                          {dayName}
                        </button>
                      );
                    })}
                  </div>
                )}
                {periodFilter === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mt-1 animate-fade-in">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">من تاريخ</label>
                      <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-1.5 px-2 text-[11px] font-bold text-[#1A365D]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">إلى تاريخ</label>
                      <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-1.5 px-2 text-[11px] font-bold text-[#1A365D]" />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3.5 mt-1">
                  {monthlyBreakdown.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-xs">لم يتم تسجيل حركات مبيعات أو مصاريف شهرية مضافة بعد.</p>
                  ) : (
                    monthlyBreakdown.map(month => (
                      <div key={month.dateStr} className="border border-slate-150 rounded-xl p-3.5 bg-[#F7FAFC] text-xs flex flex-col gap-2">
                        <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5 font-bold text-[#1A365D] text-sm">
                          <div className="flex items-center gap-2">
                            <span>{month.displayDate}</span>
                            <button
                              onClick={() => exportMonthlyReportAsPNG(month.dateStr, month.displayDate, month.sales, month.collected, month.revs, month.expenses, month.profit)}
                              className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent text-white rounded p-1 shadow-xs transition-colors cursor-pointer"
                              title="تنزيل كصورة"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 11.586V4a1 1 0 011-1zM5 13a1 1 0 012 0v2h6v-2a1 1 0 112 0v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              onClick={() => exportMonthlyReportAsPDF(month.dateStr, month.displayDate, month.sales, month.collected, month.revs, month.expenses, month.profit)}
                              className="bg-[#DD6B20] text-white hover:bg-[#C05621] text-white rounded p-1 shadow-xs transition-colors cursor-pointer"
                              title="طباعة تقرير PDF للتحليل"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="bg-indigo-100 text-[#1A365D] font-extrabold px-2 py-0.5 rounded text-[10px]">
                            فواتير: {month.count}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 text-center gap-2 mt-1">
                          <div className="bg-[#FFFFFF] p-2 rounded-lg border border-slate-100">
                            <span className="block text-[10px] text-[#2B6CB0] font-semibold mb-0.5">المبيعات</span>
                            <strong className="text-[#DD6B20] font-black">{formatNum(month.sales)}</strong>
                          </div>
                          <div className="bg-[#FFFFFF] p-2 rounded-lg border border-slate-100">
                            <span className="block text-[10px] text-[#2B6CB0] font-semibold mb-0.5">المصروفات</span>
                            <strong className="text-[#DD6B20] font-black">{formatNum(month.expenses)}</strong>
                          </div>
                          <div className={`p-2 rounded-lg border ${
                            month.profit >= 0 ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' : 'bg-rose-50/50 border-rose-100 text-rose-800'
                          }`}>
                            <span className="block text-[10px] font-semibold mb-0.5">صافي الشهر</span>
                            <strong className="font-black">{formatNum(month.profit)}</strong>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 text-center gap-2">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="block text-[10px] text-slate-500 font-semibold mb-0.5">تكلفة البضاعة</span>
                            <strong className="text-slate-700 font-black">{formatNum(month.cogs)}</strong>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="block text-[10px] text-slate-500 font-semibold mb-0.5">هامش الإجمالي</span>
                            <strong className={`font-black ${month.sales > 0 && (month.sales - month.cogs) / month.sales * 100 >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {month.sales > 0 ? ((month.sales - month.cogs) / month.sales * 100).toFixed(1) : 0}%
                            </strong>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="block text-[10px] text-slate-500 font-semibold mb-0.5">هامش الربح</span>
                            <strong className={`font-black ${month.sales > 0 && month.profit / month.sales * 100 >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {month.sales > 0 ? (month.profit / month.sales * 100).toFixed(1) : 0}%
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

          </div>
        )}

        {/* 2. Customer Activity & Analytics (Areas) */}
        
        {activeSubTab === 'invoices' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {selectedInvoice && (() => {
              const customer = customers.find(c => c.id === selectedInvoice.customerId);
              const itemsList = Array.isArray(selectedInvoice.items) ? selectedInvoice.items.filter(it => it) : [];
              const invoiceProfit = itemsList.reduce((sum, it) => {
                const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
                const weights = prod ? getProductWeightsFallback(prod) : [];
                const weight = weights.find(w => String(w.id).trim() === String(it.weightId).trim()) || weights[0];
                const fpPerUnit = getItemFactoryCost(it, weight, prod);
                return sum + (((it.finalPrice || 0) - fpPerUnit) * (it.quantity || 0));
              }, 0);
              const invoiceDate = selectedInvoice.date ? new Date(selectedInvoice.date) : new Date();
              
              return (
              <div className="bg-[#FFFFFF] p-4 rounded-xl shadow-md border-r-4 border-r-[#DD6B20] mb-2 flex flex-col gap-3 relative animate-fade-in">
                <button onClick={() => setSelectedInvoice(null)} className="absolute top-2 left-2 text-[#9CA3AF] hover:text-[#1A365D] bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center cursor-pointer">✕</button>
                
                <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5">
                    العميل: <span className="text-[#DD6B20]">{customer ? customer.name : 'عميل غير مسجل'}</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-semibold">{!isNaN(invoiceDate.getTime()) ? invoiceDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'تاريخ غير صالح'}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100 flex flex-col">
                    <span className="text-[10px] font-bold text-emerald-800 opacity-80">المحصل</span>
                    <span className="text-sm font-black text-emerald-700">{formatNum(selectedInvoice.paidAmount !== undefined ? selectedInvoice.paidAmount : selectedInvoice.totalAfterDiscount)}ج.م</span>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-2 border border-indigo-100 flex flex-col">
                    <span className="text-[10px] font-bold text-indigo-800 opacity-80">صافي الربح الفعلي</span>
                    <span className="text-sm font-black text-indigo-700">{formatNum(invoiceProfit)}ج.م</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 mt-1 border-slate-100 max-h-40 overflow-y-auto">
                  <span className="text-[10px] font-bold text-slate-400 mb-1">تفاصيل البضاعة المباعة:</span>
                  {itemsList.map((it, i) => {
                    const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
                    const ws = prod ? getProductWeightsFallback(prod) : [];
                    const weight = ws.find(w => String(w.id).trim() === String(it.weightId).trim()) || ws[0];
                    const multiplier = weight?.unitsPerCarton || 12;
                    const cartonsText = formatCartonsAndPieces(it.quantity, multiplier);
                    const cartonPrice = Number(((it.finalPrice || 0) * multiplier).toFixed(2));
                    return (
                      <div key={i} className="flex justify-between items-center bg-[#F7FAFC] border border-slate-100 p-2 rounded-lg text-right">
                         <div className="flex flex-col">
                          <span className="font-bold text-xs text-[#1A365D]">{prod?.name || 'منتج محذوف'} (حجم {weight?.size || 'مجهول'})</span>
                          <span className="text-[10px] text-slate-500 font-extrabold" dir="rtl">{cartonsText} {formatNum(cartonPrice)} ج.م</span>
                        </div>
                        <span className="text-xs font-black text-[#DD6B20]">+ {formatNum(((it.finalPrice || 0) - getItemFactoryCost(it, weight, prod)) * (it.quantity || 0))} ج</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2.5 mt-3 border-t border-slate-100 pt-3">
                  {isManager && (
                  <button
                    onClick={() => {
                      setEditingInvoice(selectedInvoice);
                      setEditItems([...itemsList]);
                      setEditPaid(selectedInvoice.paidAmount !== undefined ? selectedInvoice.paidAmount : selectedInvoice.totalAfterDiscount);
                    
                    let safeDateStr = '';
                    if (selectedInvoice.date) {
                      const parsed = new Date(selectedInvoice.date);
                      if (!isNaN(parsed.getTime())) {
                        safeDateStr = parsed.toISOString().substring(0, 16);
                      }
                    }
                    setEditDate(safeDateStr);
                      setEditNotes(selectedInvoice.notes || '');
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-3 rounded-lg text-xs transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm"
                  >
                    ✍️ تعديل الفاتورة المؤرشفة
                  </button>
                  )}
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-2 px-3 rounded-lg text-xs transition-all cursor-pointer text-center"
                  >
                    إغلاق التفاصيل
                  </button>
                </div>
              </div>
              );
            })()}
            
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <h3 className="font-bold text-[#1A365D] text-sm border-b border-slate-100 pb-2">سجل الفواتير التحليلية</h3>
              {currentFilteredData.invoices.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">لا توجد فواتير لهذه الفترة.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse bg-[#FFFFFF] shadow-sm text-xs rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-[#1A365D] text-white">
                        <th className="border border-slate-300 p-2 text-right">رقم الفاتورة</th>
                        <th className="border border-slate-300 p-2 text-right">تاريخ</th>
                        <th className="border border-slate-300 p-2 text-right">العميل</th>
                        <th className="border border-slate-300 p-2 text-center">الخصم %</th>
                        <th className="border border-slate-300 p-2 text-center">المبلغ المحصل</th>
                        <th className="border border-slate-300 p-2 text-center">صافي الربح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...currentFilteredData.invoices].sort((a,b)=> {
                         const timeA = a.date ? new Date(a.date).getTime() : 0;
                         const timeB = b.date ? new Date(b.date).getTime() : 0;
                         return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
                      }).map(inv => {
                        const customer = customers.find(c => c.id === inv.customerId);
                        const discountValue = (inv.totalBeforeDiscount || 0) - (inv.totalAfterDiscount || 0);
                        const discountPerc = (inv.totalBeforeDiscount || 0) > 0 ? (discountValue / (inv.totalBeforeDiscount || 0)) * 100 : 0;
                        const invItems = Array.isArray(inv.items) ? inv.items.filter(it => it) : [];
                        const profit = invItems.reduce((sum, item) => {
                          const p = products.find(pp => String(pp.id).trim() === String(item.productId).trim());
                          const ws = p ? getProductWeightsFallback(p) : [];
                          const w = ws.find(ww => String(ww.id).trim() === String(item.weightId).trim()) || ws[0];
                          const fpPerUnit = getItemFactoryCost(item, w, p);
                          const fp = fpPerUnit || 0;
                          return sum + (((item.finalPrice || 0) - fp) * (item.quantity || 0));
                        }, 0);
                        return (
                          <tr key={inv.id} onClick={() => setSelectedInvoice(inv)} className="hover:bg-indigo-50 cursor-pointer transition-colors border-b border-slate-200">
                            <td className="p-2 font-bold text-[#1A365D]">#{inv.invoiceNumber}</td>
                            <td className="p-2 font-mono text-gray-500">{inv.date && !isNaN(new Date(inv.date).getTime()) ? new Date(inv.date).toLocaleDateString('ar-EG') : 'بدون تاريخ'}</td>
                            <td className="p-2">{customer ? customer.name : 'مجهول'}</td>
                            <td className="p-2 text-center font-bold text-rose-600">{discountPerc > 0 ? formatNum(discountPerc) + '%' : '-'}</td>
                            <td className="p-2 text-center font-black text-[#1A365D]">{formatNum(inv.totalAfterDiscount)}</td>
                            <td className="p-2 text-center font-black text-[#DD6B20]">{formatNum(profit)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === "active_customers" && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Control Panel: Date and Area Filters */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <h3 className="font-bold text-[#1A365D] text-sm border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Activity className="h-4.5 w-4.5 text-[#2B6CB0]" />
                سجل نشاط العملاء وإعادة الاستهداف
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#2B6CB0]">حالة التفاعل</label>
                  <select
                    value={custStatusFilter}
                    onChange={(e) => setCustStatusFilter(e.target.value as any)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="all">الكل (نشط وخامل)</option>
                    <option value="active">النشطين (اشتروا في الفترة)</option>
                    <option value="inactive">الخاملين (لم يشتروا)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#2B6CB0]">الفترة الزمنية</label>
                  <select
                    value={custDateFilter}
                    onChange={(e) => setCustDateFilter(e.target.value as any)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="all">كل الفترات (سجل العميل بالكامل)</option>
                    <option value="week">هذا الأسبوع</option>
                    <option value="month">هذا الشهر</option>
                    <option value="custom">تحديد فترة مخصصة من وإلى</option>
                  </select>
                </div>

                {custDateFilter === 'week' && (
                  <div className="flex bg-[#F7FAFC] border border-slate-200 rounded-lg overflow-hidden flex-wrap gap-px p-0.5 animate-fade-in" dir="rtl">
                    <button onClick={() => setCustDayFilter([])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${custDayFilter.length === 0 ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>الكل</button>
                    {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                      const arabicDays: Record<string, string> = { 'Saturday':'السبت', 'Sunday':'الأحد', 'Monday':'الإثنين', 'Tuesday':'الثلاثاء', 'Wednesday':'الأربعاء', 'Thursday':'الخميس', 'Friday':'الجمعة' };
                      return (
                        <button key={day} onClick={() => setCustDayFilter(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${custDayFilter.includes(day) ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>{arabicDays[day]}</button>
                      )
                    })}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#2B6CB0]">المنطقة الجغرافية</label>
                  <select
                    value={custAreaFilter}
                    onChange={(e) => setCustAreaFilter(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">كل المناطق</option>
                    {areas.map(ar => (
                      <option key={ar} value={ar}>{ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              {custDateFilter === 'custom' && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-[#2B6CB0]">من تاريخ</label>
                    <input 
                      type="date" 
                      value={custStartDate}
                      onChange={(e) => setCustStartDate(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-[#2B6CB0]">إلى تاريخ</label>
                    <input 
                      type="date" 
                      value={custEndDate}
                      onChange={(e) => setCustEndDate(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold" />
                  </div>
                </div>
              )}
            </div>

            {/* Customers List Data */}
            <div className="flex flex-col gap-3">
              {filteredCustomerActivity.length === 0 ? (
                <div className="bg-[#FFFFFF] p-8 rounded-2xl border border-slate-200 text-center text-gray-400 text-xs font-medium">
                  لا توجد سجلات مطابقة.
                </div>
              ) : (
                filteredCustomerActivity.map((c) => {
                  const isExpanded = expandedCustomerId === c.id;
                  
                  return (
                    <div key={c.id} className="bg-[#FFFFFF] border text-sm border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all">
                      {/* Accordion Trigger */}
                      <button 
                        onClick={() => setExpandedCustomerId(isExpanded ? null : c.id)}
                        className={`w-full flex items-center justify-between p-3.5 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/50 border-b border-indigo-100' : 'hover:bg-[#F7FAFC]'}`}
                      >
                        <div className="flex flex-col gap-1 items-start text-right">
                          <span className="font-extrabold text-[#1A365D] flex items-center gap-1.5 text-[13px]">
                            <span className={`h-2.5 w-2.5 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {c.name}
                          </span>
                          <span className="text-[10px] text-[#2B6CB0] font-medium">
                            {c.governorate || 'محافظة غير محددة'} - {c.area} • مسحوبات: <strong className="text-[#1A365D]">{formatNum(c.totalPurchases)}ج.م</strong>
                            {c.invoicesCount > 0 && c.daysSinceLastInvoice !== undefined && (
                              <span className={`ml-1 ${c.daysSinceLastInvoice > 10 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                ({c.daysSinceLastInvoice === 0 ? 'اليوم' : `منذ ${c.daysSinceLastInvoice} يوم`})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="bg-[#FFFFFF] border border-slate-200 min-w-8 text-center py-1 px-2 rounded-lg text-[10px] shadow-sm font-black text-[#2B6CB0]">
                          {c.invoicesCount} <span className="font-normal text-[9px]">طلبات</span>
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="p-3.5 bg-[#F7FAFC] flex flex-col gap-3 animate-in slide-in-from-top-1 fade-in duration-200">
                          <button
                            onClick={() => handleGenerateAndSendWA(c)}
                            disabled={waLoadingId === c.id}
                            className="bg-[#DD6B20] text-white hover:bg-[#C05621] disabled:bg-slate-300 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Send className="h-4 w-4" />
                            {waLoadingId === c.id ? 'جاري صياغة الرسالة...' : 'توليد وإرسال رسالة تحفيزية عبر واتساب '}
                          </button>
                          
                          <h4 className="text-xs font-bold text-[#1A365D] mt-2">تفاصيل فواتير العميل المدفوعة (الفترة المحددة)</h4>
                          {c.recentInvoices.length === 0 ? (
                            <p className="text-[10px] text-[#2B6CB0] text-center bg-[#FFFFFF] border border-slate-100 rounded-lg p-3">لم يسجل العميل أي مشتريات خلال هذه الفترة.</p>
                          ) : (
                            c.recentInvoices.map((inv) => (
                              <div key={inv.id} className="bg-[#FFFFFF] border border-slate-200 p-2.5 rounded-xl flex items-center justify-between shadow-xs">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[11px] font-black text-[#1A365D]">{inv.invoiceNumber}</span>
                                  <span className="text-[10px] text-[#2B6CB0]">{inv.date && !isNaN(new Date(inv.date).getTime()) ? new Date(inv.date).toLocaleDateString('ar-EG') : 'بدون تاريخ'}</span>
                                </div>
                                <div className="text-[11px] font-black text-[#1A365D]">
                                  {formatNum(inv.totalAfterDiscount)}ج.م
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}



        {activeSubTab === "inventory" && (
          <div className="flex flex-col gap-4 animate-fade-in text-right" dir="rtl">
            {/* Header card */}
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-black text-[#1A365D] text-sm">
                    مراجعة ومطابقة المخزون مع المندوب
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadInventoryImage}
                    className="flex items-center gap-1.5 bg-[#1A365D] hover:bg-[#2B6CB0] text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    dir="rtl"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 11.586V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    صورة
                  </button>
                  <button
                    onClick={downloadInventoryPDF}
                    className="flex items-center gap-1.5 bg-[#1F2937] hover:bg-[#374151] text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    dir="rtl"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    PDF
                  </button>
                </div>

                {/* Switch filter */}
                <div className="flex bg-[#F1F5F9] p-1 rounded-xl self-start sm:self-auto select-none">
                  <button
                    onClick={() => setInventoryMatchFilter('daily')}
                    className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${inventoryMatchFilter === 'daily' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    يومي
                  </button>
                  <button
                    onClick={() => setInventoryMatchFilter('weekly')}
                    className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${inventoryMatchFilter === 'weekly' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    أسبوعي
                  </button>
                  <button
                    onClick={() => setInventoryMatchFilter('monthly')}
                    className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${inventoryMatchFilter === 'monthly' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    شهري
                  </button>
                </div>
              </div>

              {/* Subtitle / label */}
              <div className="text-xs text-[#2B6CB0] font-black bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50 flex items-center gap-1.5 self-start">
                <Activity className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>طريقة العرض الحالية للمطابقة: {inventoryMatchFilter === 'daily' ? 'المطابقة اليومية التفصيلية' : inventoryMatchFilter === 'weekly' ? 'المطابقة الأسبوعية المجمعة' : 'المطابقة الشهرية الشاملة'}</span>
              </div>

              <div className="flex flex-col gap-6 max-h-[75vh] overflow-y-auto pr-1 mt-2">
                {inventoryData.processedGroups.length === 0 ? (
                  <div className="text-center text-slate-400 py-12 text-xs">لا توجد أي حمولات أو مبيعات مسجلة في النظام بعد.</div>
                ) : (
                  inventoryData.processedGroups.map(({ gKey, groupData, activeCombinations, groupHeaderLabel }) => {
                    if (activeCombinations.length === 0) return null;

                    return (
                      <div key={gKey} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                        {/* Group header bar — clickable to toggle */}
                        <button
                          onClick={() => toggleGroup(gKey)}
                          className="w-full bg-slate-100 px-4 py-2.5 border-b border-slate-200 text-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-200 transition-colors"
                        >
                          <span className="font-extrabold text-xs text-[#1A365D] flex items-center gap-2">
                            {expandedGroups.has(gKey) ? '🔽' : '▶️'} {groupHeaderLabel}
                          </span>
                          <span className="bg-[#1A365D] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                            {activeCombinations.length} أصناف نشطة
                          </span>
                        </button>

                        {expandedGroups.has(gKey) && (
                          <div className="p-3 flex flex-col gap-4 bg-slate-50/50">
                            {activeCombinations.map(combo => {
                              const product = inventoryData.productsMap.get(String(combo.productId).trim());
                              if (!product) return null;

                              const activeWeights = getProductWeightsFallback(product);
                              const weight = activeWeights.find(w => String(w.id).trim() === String(combo.weightId).trim()) || activeWeights[0];
                              if (!weight) return null;

                              // Use cumulative sold/loaded across ALL groups for real quantities
                              const comboKey = `${String(product.id).trim()}-${String(weight.id).trim()}`;
                              const groupLoaded = groupData.loads
                                ?.filter(l => String(l.productId).trim() === String(product.id).trim() && String(l.weightId).trim() === String(weight.id).trim())
                                .reduce((sum, l) => sum + (l.quantity || 0), 0) || 0;

                              const groupSold = groupData.invItems
                                ?.filter(item => String(item.productId).trim() === String(product.id).trim() && String(item.weightId).trim() === String(weight.id).trim())
                                .reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

                              // Cumulative (real) sold and loaded across all days
                              const cumSold = inventoryData.cumulativeSoldMap[comboKey] || 0;
                              const cumLoaded = inventoryData.cumulativeLoadedMap[comboKey] || 0;
                              const remainingUnits = cumLoaded - cumSold;
                              const unitsPerCarton = weight.unitsPerCarton || 12;

                              const detailKey = `${product.id}-${weight.id}`;
                              const isDetailOpen = expandedDetails.has(detailKey);

                              // Filtered loads/invoices for this combo
                              const detailLoads = groupData.loads.filter(l =>
                                String(l.productId).trim() === String(product.id).trim() &&
                                String(l.weightId).trim() === String(weight.id).trim()
                              );
                              const detailInvItems = groupData.invItems.filter(item =>
                                String(item.productId).trim() === String(product.id).trim() &&
                                String(item.weightId).trim() === String(weight.id).trim()
                              );

                              return (
                                <div key={detailKey}>
                                  <div
                                    onClick={() => toggleDetail(product.id, weight.id)}
                                    className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col gap-2.5 transition-all shadow-xs hover:border-slate-350 cursor-pointer"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-extrabold text-emerald-800 text-xs">
                                          {isDetailOpen ? '🔽' : '▶️'} {product.name}
                                        </span>
                                        <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-md text-[9px] font-black border border-emerald-100 whitespace-nowrap">
                                          {weight.size}
                                        </span>
                                      </div>
                                      
                                      <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black border flex items-center justify-center gap-1 flex-wrap text-center ${
                                        remainingUnits < 0 
                                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                          : remainingUnits === 0
                                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      }`}>
                                        <span>الرصيد المتبقي:</span>
                                        <span dir="rtl" className="font-bold">
                                          {formatCartonsAr(remainingUnits, unitsPerCarton)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg py-1.5 px-2 flex flex-col gap-0.5">
                                        <span className="font-semibold text-indigo-900">المحمل</span>
                                        <span className="font-black text-indigo-700 font-mono text-xs" dir="rtl">
                                          {formatCartonsAr(groupLoaded, unitsPerCarton)}
                                        </span>
                                      </div>
                                      <div className="bg-teal-50/50 border border-teal-100 rounded-lg py-1.5 px-2 flex flex-col gap-0.5">
                                        <span className="font-semibold text-teal-900">المبيعات</span>
                                        <span className="font-black text-teal-700 font-mono text-xs" dir="rtl">
                                          {formatCartonsAr(cumSold, unitsPerCarton)}
                                        </span>
                                      </div>
                                      <div className={`rounded-lg py-1.5 px-2 flex flex-col gap-0.5 border ${
                                        remainingUnits < 0 
                                          ? 'bg-rose-50 border-rose-200 text-rose-800' 
                                          : remainingUnits === 0
                                            ? 'bg-slate-100 border-slate-200 text-slate-700'
                                            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                                      }`}>
                                        <span className="font-semibold">المتبقي</span>
                                        <span className="font-black font-mono text-xs" dir="rtl">
                                          {formatCartonsAr(remainingUnits, unitsPerCarton)}
                                        </span>
                                      </div>
                                    </div>

                                    {remainingUnits < 0 && (
                                      <div className="flex items-center justify-center gap-1.5 p-1 bg-rose-50 text-rose-700 rounded-lg border border-rose-100 text-[9px] font-black">
                                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                        <span>عجز: المبيعات المسجلة تتجاوز الرصيد المحُمل للمندوب!</span>
                                      </div>
                                    )}

                                    {/* Expanded Details */}
                                    {isDetailOpen && (
                                      <div className="border-t border-slate-200 pt-2.5 mt-1 flex flex-col gap-2">
                                        {/* Loads details */}
                                        <span className="text-[10px] font-black text-indigo-700 flex items-center gap-1">
                                          📦 التحميلات ({detailLoads.length})
                                        </span>
                                        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                          {detailLoads.length === 0 ? (
                                            <span className="text-[9px] text-slate-400 px-1">لا توجد تحميلات</span>
                                          ) : (
                                            detailLoads.map((l, li) => (
                                              <div key={li} className="bg-indigo-50 p-1.5 rounded text-[9px] flex justify-between items-center">
                                                <span className="text-slate-600">{new Date(l.date).toLocaleDateString('ar-EG')}</span>
                                                <span className="font-bold text-indigo-800">{formatCartonsAr(l.quantity || 0, unitsPerCarton)}</span>
                                              </div>
                                            ))
                                          )}
                                        </div>

                                        {/* Invoice details */}
                                        <span className="text-[10px] font-black text-teal-700 flex items-center gap-1 mt-1">
                                          🧾 المبيعات ({detailInvItems.length})
                                        </span>
                                        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                          {detailInvItems.length === 0 ? (
                                            <span className="text-[9px] text-slate-400 px-1">لا توجد مبيعات</span>
                                          ) : (
                                            detailInvItems.map((item, ii) => (
                                              <div key={ii} className="bg-teal-50 p-1.5 rounded text-[9px] flex justify-between items-center">
                                                <span className="font-bold text-teal-800">{formatCartonsAr(item.quantity || 0, unitsPerCarton)}</span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}



      </div>

      {/* Debtor Customers Modal */}
      {showDebtorsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh] text-right" dir="rtl">
            
            {/* Modal Header */}
            <div className="bg-[#1A365D] text-white p-4 flex justify-between items-center header-gradient">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-400">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14H11v-2h2v2zm0-4H11V7h2v5z" />
                </svg>
                <h3 className="text-base font-bold">العملاء المدينين والديون المستحقة</h3>
              </div>
              <button 
                onClick={() => setShowDebtorsModal(false)}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
              
              {/* Summary of Total Unpaid Debt */}
              <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-center">
                <span className="text-xs text-rose-800 font-bold block mb-1">إجمالي المتبقي المطلوب تحصيله طرف العملاء</span>
                <strong className="text-2xl font-black text-rose-600">
                  {salesStats.totalRemaining.toLocaleString('ar-EG')}ج.م
                </strong>
              </div>

              {/* General Settlement Buttons */}
              {onAddExpense && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-3 rounded-xl flex flex-col gap-2">
                  <span className="text-[10px] font-extrabold text-emerald-900 text-right">التحصيل والتسوية السريعة:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        const amount = prompt('أدخل مبلغ التحصيل (كإيراد):');
                        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
                        const name = prompt('اسم العميل أو المندوب (اختياري):') || 'غير محدد';
                        const confirmed = await confirmDialog(`تأكيد تحصيل ${formatNum(Number(amount))} ج.م من "${name}" كإيراد؟`);
                        if (!confirmed) return;
                        onAddExpense({
                          amount: Number(amount),
                          category: 'تحصيل من عميل',
                          type: 'revenue',
                          date: nowEgyptISO(),
                          description: JSON.stringify({ notes: `تحصيل عام: ${name}`, customerName: name, isGeneralSettlement: true }),
                          delegateName: name,
                          delegatePhone: ''
                        });
                        showToast(`✓ تم تسجيل تحصيل ${formatNum(Number(amount))} ج.م كإيراد`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] py-2 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <CircleDollarSign className="h-3 w-3" />
                      تحصيل كإيراد
                    </button>
                    <button
                      onClick={async () => {
                        const amount = prompt('أدخل مبلغ التنازل (يُخصم من الإيرادات):');
                        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
                        const name = prompt('اسم العميل أو المندوب (اختياري):') || 'غير محدد';
                        const confirmed = await confirmDialog(`تأكيد التنازل عن ${formatNum(Number(amount))} ج.م من "${name}"؟\n⚠️ سيتم خصم هذا المبلغ من الإيرادات.`);
                        if (!confirmed) return;
                        onAddExpense({
                          amount: Number(amount),
                          category: 'تنازل عن ديون',
                          type: 'expense',
                          date: nowEgyptISO(),
                          description: JSON.stringify({ notes: `تنازل عام: ${name}`, customerName: name, isWriteOff: true, isGeneralSettlement: true }),
                          delegateName: name,
                          delegatePhone: ''
                        });
                        showToast(`✓ تم تنازل ${formatNum(Number(amount))} ج.م من "${name}" (يُخصم من الإيرادات)`);
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] py-2 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <HandCoins className="h-3 w-3" />
                      تنازل (خصم من الإيرادات)
                    </button>
                  </div>
                </div>
              )}

              {/* Search Bar for Debtors */}
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم العميل المدين..."
                  value={debtorSearchQuery}
                  onChange={(e) => setDebtorSearchQuery(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[#1A365D] text-right"
                />
              </div>

              {/* Debtors List */}
              <div className="flex flex-col gap-3">
                {debtorCustomers.filter(d => {
                  try {
                    return (d.customer?.name || '').toLowerCase().includes((debtorSearchQuery || '').toLowerCase());
                  } catch {
                    return false;
                  }
                }).length === 0 ? (
                  <p className="text-center text-slate-400 py-12 text-xs">لا يوجد عملاء مدينين حالياً تطابق البحث.</p>
                ) : (
                  debtorCustomers
                    .filter(d => {
                      try {
                        return (d.customer?.name || '').toLowerCase().includes((debtorSearchQuery || '').toLowerCase());
                      } catch {
                        return false;
                      }
                    })
                    .map(({ customer, invoices: unpaidInvs, totalDebt }, cIdx) => (
                      <div key={`${customer.id}_${cIdx}`} className="border border-slate-200 rounded-xl bg-slate-50/50 p-3 flex flex-col gap-2.5">
                        
                        {/* Customer title bar */}
                        <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                          <div className="flex flex-col text-right">
                            <span className="font-bold text-[#1A365D] text-xs">{customer.name}</span>
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-500 font-bold">
                              <span>المنطقة: {customer.area || 'غير محدد'}</span>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <span>هاتف:</span>
                                {customer.phone ? (
                                  <SecurePhoneDisplay phone={customer.phone} enableWhatsApp={false} className="inline font-bold" />
                                ) : (
                                  <span>بدون هاتف</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="bg-rose-100 text-rose-700 font-black px-2.5 py-1 rounded-lg text-xs">
                            {formatNum(totalDebt)}ج.م
                          </span>
                        </div>

                        {/* Unpaid invoices detail list for this customer */}
                        <div className="flex flex-col gap-2">
                          {unpaidInvs.map((inv, iIdx) => {
                            const remaining = (inv.totalAfterDiscount || 0) - (inv.paidAmount ?? 0);
                            return (
                              <div key={`${inv.id}_${iIdx}`} className="bg-[#FFFFFF] border border-slate-150 p-2.5 rounded-lg flex items-center justify-between shadow-xs">
                                <div className="flex flex-col gap-1 text-right">
                                  <div className="flex items-center gap-1.5 flex-row-reverse justify-end">
                                    <span className="text-[11px] font-bold text-[#1A365D]">فاتورة #{inv.invoiceNumber}</span>
                                    <span className="text-[9px] bg-slate-100 text-slate-650 font-bold px-1 rounded">
                                      {inv.date && !isNaN(new Date(inv.date).getTime()) ? new Date(inv.date).toLocaleDateString('ar-EG') : 'تاريخ مجهول'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    إجمالي: {formatNum(inv.totalAfterDiscount)} ج | المسدد: {formatNum(inv.paidAmount ?? 0)} ج
                                  </span>
                                </div>
                                
                                {/* Quick payments buttons */}
                                <div className="flex items-center gap-1.5 flex-row-reverse">
                                  {/* Pay partial */}
                                  <button
                                    onClick={() => {
                                      setPaymentModal({
                                        isOpen: true,
                                        invoice: inv,
                                        type: 'partial',
                                        amount: '',
                                        paymentMethod: 'نقدي (كاش)'
                                      });
                                    }}
                                    className="bg-amber-100 hover:bg-amber-150 border border-amber-250 text-amber-800 px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                                  >
                                    سداد جزئي
                                  </button>
                                  {/* Pay full */}
                                  <button
                                    onClick={() => {
                                      setPaymentModal({
                                        isOpen: true,
                                        invoice: inv,
                                        type: 'full',
                                        amount: String(remaining),
                                        paymentMethod: 'نقدي (كاش)'
                                      });
                                    }}
                                    className="bg-emerald-100 hover:bg-emerald-150 border border-emerald-250 text-emerald-800 p-1 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                                    title="سداد بالكامل"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  {/* Collection - adds to revenue */}
                                  <button
                                    onClick={async () => {
                                      const confirmed = await confirmDialog(`تأكيد التحصيل: سيتم تسجيل مبلغ ${formatNum(remaining)} ج.م كتحصيل من العميل "${customer.name}" وإضافته للإيرادات.\n\nهل أنت متأكد؟`);
                                      if (!confirmed) return;
                                      if (onAddExpense) {
                                        onAddExpense({
                                          amount: remaining,
                                          category: 'تحصيل من عميل',
                                          type: 'revenue',
                                          date: nowEgyptISO(),
                                          description: JSON.stringify({ notes: `تحصيل كامل المتبقي من العميل: ${customer.name} — فاتورة #${inv.invoiceNumber}`, invoiceId: inv.id, customerName: customer.name }),
                                          delegateName: customer.name,
                                          delegatePhone: customer.phone || ''
                                        });
                                        showToast(`✓ تم تسجيل تحصيل ${formatNum(remaining)} ج.م من "${customer.name}" كإيراد!`);
                                      }
                                    }}
                                    className="bg-blue-100 hover:bg-blue-150 border border-blue-250 text-blue-800 px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                                    title="تم التحصيل — يُضاف للإيرادات"
                                  >
                                    تم التحصيل
                                  </button>
                                  {/* Write-off / Settlement - deducts from revenue */}
                                  <button
                                    onClick={async () => {
                                      const confirmed = await confirmDialog(`تأكيد التنازل: سيتم تسوية مبلغ ${formatNum(remaining)} ج.م المتبقي من "${customer.name}" كتنازل/خصم.\n⚠️ هذا المبلغ سيُخصم من الإيرادات (لا يُضاف كإيراد).\n\nهل أنت متأكد؟`);
                                      if (!confirmed) return;
                                      if (onAddExpense) {
                                        onAddExpense({
                                          amount: remaining,
                                          category: 'تنازل عن ديون',
                                          type: 'expense',
                                          date: nowEgyptISO(),
                                          description: JSON.stringify({ notes: `تنازل/تسوية عن المتبقي: ${customer.name} — فاتورة #${inv.invoiceNumber}`, invoiceId: inv.id, customerName: customer.name, isWriteOff: true }),
                                          delegateName: customer.name,
                                          delegatePhone: customer.phone || ''
                                        });
                                        showToast(`✓ تم تسوية ${formatNum(remaining)} ج.م كتنازل من "${customer.name}" (يُخصم من الإيرادات)`);
                                      }
                                    }}
                                    className="bg-rose-100 hover:bg-rose-150 border border-rose-250 text-rose-800 px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                                    title="تم التسوية — يُخصم من الإيرادات"
                                  >
                                    تنازل
                                  </button>
                                  {/* Edit invoice (manager only) */}
                                  {isManager && (
                                  <button
                                    onClick={() => {
                                      setShowDebtorsModal(false);
                                      setEditingInvoice(inv);
                                      setEditItems([...(inv.items || [])]);
                                      setEditPaid(inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount);
                                      let safeDateStr = '';
                                      if (inv.date) {
                                        const parsed = new Date(inv.date);
                                        if (!isNaN(parsed.getTime())) {
                                          safeDateStr = parsed.toISOString().substring(0, 16);
                                        }
                                      }
                                      setEditDate(safeDateStr);
                                      setEditNotes(inv.notes || '');
                                    }}
                                    className="bg-sky-100 hover:bg-sky-150 border border-sky-250 text-sky-800 px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                                    title="تعديل الفاتورة"
                                  >
                                    تعديل ✍️
                                  </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    ))
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-3 border-t border-slate-150 text-center">
              <span className="text-[10px] text-slate-400 font-bold">
                تحصيل المديونية يرحل الفاتورة تلقائياً ويحدث صافي النقدية بالصندوق بالتبويب
              </span>
            </div>

          </div>
        </div>
      )}

      {/* Interactive Modal to Edit Archived Invoices */}
      {editingInvoice && (() => {
        const totalBeforeDisc = editItems.reduce((sum, item) => sum + (item.originalPrice * item.quantity), 0);
        const totalAfterDisc = editItems.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
        
        const handleSaveArchiveEdit = () => {
          if (editItems.length === 0) {
            alert('يجب إضافة صنف واحد على الأقل للفاتورة!');
            return;
          }
          
          const updatedInvoice: Invoice = {
            ...editingInvoice,
            date: new Date(editDate).toISOString(),
            items: editItems,
            totalBeforeDiscount: Number(totalBeforeDisc.toFixed(2)),
            totalAfterDiscount: Number(totalAfterDisc.toFixed(2)),
            paidAmount: Number(editPaid.toFixed(2)),
            notes: editNotes.trim()
          };
          
          onUpdateInvoice(updatedInvoice);
          setEditingInvoice(null);
          setSelectedInvoice(updatedInvoice); // Update selected preview card as well!
        };

        const handleAddEditItem = () => {
          if (!editAddProductId || !editAddWeightId || !editAddQty) {
            alert('يرجى تحديد المنتج، الحجم، والكمية!');
            return;
          }
          const prod = products.find(p => p.id === editAddProductId);
          const ws = prod ? getProductWeightsFallback(prod) : [];
          const weight = ws.find(w => w.id === editAddWeightId);
          if (!prod || !weight) return;
          
          const multiplier = weight.unitsPerCarton || 12;
          const pieces = Math.round(parseFloat(editAddQty) * multiplier);
          if (isNaN(pieces) || pieces <= 0) {
            alert('يرجى إدخال كمية صحيحة!');
            return;
          }
          
          const retailCartonPrice = (weight.cartonPriceFromFactory || 0) + (weight.addedValue || 0);
          const perPiecePrice = retailCartonPrice / multiplier;
          
          // Check if item is already present, if so, merge quantities
          const existingIdx = editItems.findIndex(it => it.productId === prod.id && it.weightId === weight.id);
          if (existingIdx > -1) {
            const updated = [...editItems];
            updated[existingIdx].quantity += pieces;
            setEditItems(updated);
          } else {
            const newItem: InvoiceItem = {
              productId: prod.id,
              weightId: weight.id,
              quantity: pieces,
              originalPrice: perPiecePrice || 100,
              discountPercent: 0,
              finalPrice: perPiecePrice || 100,
              factoryPrice: weight.factoryPricePerUnit || (weight.retailPricePerUnit ? weight.retailPricePerUnit * 0.9 : 90)
            };
            setEditItems([...editItems, newItem]);
          }
          
          // Reset add inputs
          setEditAddQty('');
        };

        const targetProd = editAddProductId ? products.find(p => p.id === editAddProductId) : null;
        const availableWeights = targetProd ? getProductWeightsFallback(targetProd) : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 text-right" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-fade-in text-xs font-semibold text-slate-800">
              
              {/* Header */}
              <div className="bg-[#1A365D] text-white p-4 flex justify-between items-center shrink-0">
                <span className="font-bold text-sm">✍️ تعديل بيانات الفاتورة المؤرشفة (#{editingInvoice.invoiceNumber})</span>
                <button 
                  onClick={() => setEditingInvoice(null)} 
                  className="text-white hover:text-amber-500 bg-white/10 rounded-full w-6 h-6 flex items-center justify-center cursor-pointer text-xs font-black border-transparent"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4 custom-scroll">
                
                {/* 1. Date & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex flex-col gap-1 text-right">
                    <label className="text-[10px] font-bold text-indigo-900 block">تاريخ الفاتورة</label>
                    <input 
                      type="datetime-local" 
                      value={editDate} 
                      onChange={(e) => setEditDate(e.target.value)}
                      className="bg-white border border-slate-200 rounded p-1 text-center font-bold text-[#1A365D] w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-right font-bold text-indigo-900">
                    <label className="text-[10px] font-bold block">ملاحظات الفاتورة</label>
                    <input 
                      type="text" 
                      value={editNotes} 
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="bg-white border border-slate-200 rounded p-1 text-right font-medium text-[#1A365D] w-full"
                      placeholder="ملاحظات توضيحية..."
                    />
                  </div>
                </div>

                {/* 2. Items List */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-extrabold text-[#1A365D]">📦 المنتجات المسجلة بالفاتورة:</span>
                  {editItems.length === 0 ? (
                    <p className="text-center text-gray-400 py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">لا توجد منتجات مسجلة بالفاتورة الحالية!</p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                      {editItems.map((it, idx) => {
                        const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
                        const ws = prod ? getProductWeightsFallback(prod) : [];
                        const weight = ws.find(w => String(w.id).trim() === String(it.weightId).trim()) || ws[0];
                        const multiplier = weight?.unitsPerCarton || 12;
                        const totalPieces = it.quantity;
                        const cartons = Math.floor(totalPieces / multiplier);
                        const pieces = totalPieces % multiplier;
                        
                        return (
                          <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col gap-2 relative">
                            <button 
                              type="button"
                              onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                              className="absolute top-1.5 left-2 text-red-500 hover:text-red-700 bg-red-55 border-transparent hover:bg-red-100 rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] cursor-pointer"
                              title="حذف هذا الصنف من الفاتورة"
                            >
                              ✕
                            </button>
                            
                            <div className="flex justify-between items-center text-xs font-bold text-[#1A365D] pl-8">
                              <span>{prod?.name || 'صنف محذوف'} (حجم {weight?.size || 'مجهول'})</span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-[10px]">
                              {/* Carton Qty Input */}
                              <div className="flex flex-col gap-0.5">
                                <label className="text-[9px] text-gray-500 font-bold">كراتين 📦</label>
                                <input 
                                  type="number" 
                                  min="0"
                                  value={cartons}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const updated = [...editItems];
                                    updated[idx].quantity = (val * multiplier) + pieces;
                                    setEditItems(updated);
                                  }}
                                  className="bg-white border border-slate-200 rounded p-1 text-center font-bold text-indigo-900"
                                />
                              </div>

                              {/* Loose Pieces Qty Input */}
                              <div className="flex flex-col gap-0.5">
                                <label className="text-[9px] text-gray-400 font-bold">قطع 🥛</label>
                                <input 
                                  type="number" 
                                  min="0"
                                  max={multiplier - 1}
                                  value={pieces}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const updated = [...editItems];
                                    updated[idx].quantity = (cartons * multiplier) + val;
                                    setEditItems(updated);
                                  }}
                                  className="bg-white border border-slate-200 rounded p-1 text-center font-bold text-blue-900"
                                />
                              </div>

                              {/* Discount input */}
                              <div className="flex flex-col gap-0.5">
                                <label className="text-[9px] text-gray-500 font-bold">خصم الصنف %</label>
                                <input 
                                  type="number" 
                                  min="0"
                                  max="100"
                                  value={it.discountPercent}
                                  onChange={(e) => {
                                    const disc = parseFloat(e.target.value) || 0;
                                    const updated = [...editItems];
                                    updated[idx].discountPercent = disc;
                                    updated[idx].finalPrice = it.originalPrice * (1 - disc / 100);
                                    setEditItems(updated);
                                  }}
                                  className="bg-white border border-slate-200 rounded p-1 text-center font-bold text-rose-600"
                                />
                              </div>

                              {/* Total item cost view */}
                              <div className="flex flex-col justify-end text-left pr-2">
                                <span className="text-[9px] text-gray-400">إجمالي البند</span>
                                <span className="font-extrabold text-emerald-700">{formatNum(it.finalPrice * it.quantity)}ج.م</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Add New Item Inline */}
                <div className="border-t border-slate-200 pt-3 flex flex-col gap-2">
                  <span className="text-[11px] font-extrabold text-[#1A365D]">➕ إضافة صنف جديد للفاتورة:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-right">
                    <div>
                      <label className="text-[9px] text-gray-500 block mb-0.5 font-bold">المنتج</label>
                      <select 
                        value={editAddProductId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setEditAddProductId(pid);
                          const pObj = products.find(p => String(p.id).trim() === String(pid).trim());
                          if (pObj && pObj.weights?.length > 0) {
                            setEditAddWeightId(pObj.weights[0].id);
                          } else {
                            setEditAddWeightId('');
                          }
                        }}
                        className="bg-slate-50 border border-slate-200 rounded p-1.5 w-full font-semibold text-slate-800"
                      >
                        <option value="">-- اختر المنتج --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {editAddProductId && (
                      <div>
                        <label className="text-[9px] text-gray-500 block mb-0.5 font-bold">الحجم {" / "} السعة</label>
                        <select 
                          value={editAddWeightId}
                          onChange={(e) => setEditAddWeightId(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded p-1.5 w-full font-bold text-slate-800"
                        >
                          {availableWeights.map(w => (
                            <option key={w.id} value={w.id}>{w.size}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {editAddProductId && (
                    <div className="flex items-end gap-2 mt-1.5 text-right">
                      <div className="flex-1">
                        <label className="text-[9px] text-gray-500 block mb-0.5 font-bold">الكمية المطلوبة (كرتونة)</label>
                        <input 
                          type="number" 
                          step="0.1" 
                          min="0.1"
                          placeholder="مثال: 5"
                          value={editAddQty}
                          onChange={(e) => setEditAddQty(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded p-1.5 w-full text-center font-bold text-indigo-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddEditItem}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 px-4 rounded-lg cursor-pointer whitespace-nowrap active:scale-95 transition-all text-xs border-transparent"
                      >
                        ➕ إدراج للفاتورة
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Calculations Overview */}
                <div className="border-t border-slate-200 pt-3 grid grid-cols-2 gap-3 text-xs bg-indigo-50/50 p-3 rounded-xl">
                  <div className="flex flex-col gap-1.5 text-right">
                    <span className="text-slate-500 font-bold block text-[10px]">إجمالي القيمة بعد الخصم:</span>
                    <strong className="text-indigo-950 font-black text-sm">{formatNum(totalAfterDisc)} ج.م</strong>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <label className="text-slate-500 font-bold block text-[10px]">المبلغ المحصل والمسدد:</label>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded p-1">
                      <input 
                        type="number" 
                        value={editPaid}
                        onChange={(e) => setEditPaid(parseFloat(e.target.value) || 0)}
                        className="bg-transparent border-transparent w-full text-center font-black text-emerald-700 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-center text-amber-700 font-bold border-t border-slate-200/50 pt-2 text-[10px]">
                    المتبقي ديناً على العميل: <span className="text-red-600 font-black">{formatNum(Math.max(0, totalAfterDisc - editPaid))} ج.م</span>
                  </div>
                </div>

              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 p-3 border-t border-slate-200 flex gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveArchiveEdit}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl transition-all cursor-pointer active:scale-95 shadow-md flex items-center justify-center gap-1 border-transparent"
                >
                  💾 اعتماد وحفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold py-2.5 rounded-xl transition-all cursor-pointer border-transparent"
                >
                  إلغاء وتجاهل
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Payment Modal */}
      {paymentModal.isOpen && paymentModal.invoice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 text-center border border-slate-100">
            <div className="mx-auto w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-2 shadow-inner">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <h3 className="text-[#1A365D] font-black text-base leading-relaxed">
              {paymentModal.type === 'full' ? 'تسديد الفاتورة بالكامل وتحويلها للأرشيف' : 'تسديد دفعة جزئية من الفاتورة'}
              <br/>
              <span className="text-xs text-slate-500">#{paymentModal.invoice.invoiceNumber}</span>
            </h3>
            
            <div className="flex flex-col gap-3 mt-2 text-right">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">المبلغ المسدد (ج.م):</label>
                <input 
                  type="number" 
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({...paymentModal, amount: e.target.value})}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-xl py-2 px-3 text-[#1A365D] font-bold text-center outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="أدخل المبلغ..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">نوع وطريقة السداد:</label>
                <select
                  value={paymentModal.paymentMethod}
                  onChange={(e) => setPaymentModal({...paymentModal, paymentMethod: e.target.value})}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-xl py-2 px-3 text-[#1A365D] font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="نقدي (كاش)">نقدي (كاش)</option>
                  <option value="تحويل محفظة (فودافون كاش الخ)">تحويل محفظة (فودافون كاش الخ)</option>
                  <option value="تحويل بنكي / انستا باي">تحويل بنكي / انستا باي</option>
                  <option value="شيك">شيك</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  const amountToPay = parseFloat(paymentModal.amount);
                  const remaining = (paymentModal.invoice!.totalAfterDiscount || 0) - (paymentModal.invoice!.paidAmount ?? 0);

                  if (isNaN(amountToPay) || amountToPay <= 0 || amountToPay > remaining) {
                    showToast('⚠️ مبلغ غير صالح! يجب أن يكون أكبر من صفر ولا يتجاوز المتبقي.');
                    return;
                  }

                  const now = new Date();
                  const dateStr = `${now.toLocaleDateString('ar-EG')} ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

                  let actionText = paymentModal.type === 'full' ? 'سداد كلي' : 'سداد جزئي';
                  if (amountToPay === remaining) actionText = 'سداد كلي';

                  const newNotes = paymentModal.invoice!.notes 
                    ? `${paymentModal.invoice!.notes} | ${actionText} ${amountToPay}ج.م (${paymentModal.paymentMethod}) بتاريخ ${dateStr}`
                    : `${actionText} ${amountToPay}ج.م (${paymentModal.paymentMethod}) بتاريخ ${dateStr}`;

                  const updatedInv = {
                    ...paymentModal.invoice!,
                    paidAmount: (paymentModal.invoice!.paidAmount ?? 0) + amountToPay,
                    notes: newNotes
                  };

                  if (onUpdateInvoice) {
                    onUpdateInvoice(updatedInv);
                  }

                  showToast('✓ تم تأكيد السداد وتحديث الفاتورة بنجاح!');
                  setPaymentModal({...paymentModal, isOpen: false});
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold active:scale-95 transition-all shadow-md text-sm cursor-pointer"
              >
                تأكيد السداد ✅
              </button>
              <button
                onClick={() => setPaymentModal({...paymentModal, isOpen: false})}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold active:scale-95 transition-all shadow-sm text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsTab(props: ReportsTabProps) {
  return (
    <ReportsErrorBoundary>
      <ReportsTabComponent {...props} />
    </ReportsErrorBoundary>
  );
}
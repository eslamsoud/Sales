// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Invoice, Expense, Product, Customer, Trip, AppSettings, formatNum, FactoryLoad, getProductWeightsFallback, UserAuth, InvoiceItem } from '../types';
import { ArrowRight, FileSpreadsheet, Send, TrendingUp, TrendingDown, Clock, Search, Eye, Filter, Check, ShieldAlert, MapPin, Printer, ChevronDown, AlertCircle, Activity } from 'lucide-react';
import SecurePhoneDisplay from './SecurePhoneDisplay';

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
  onGoBack: () => void;
  permittedSubTabs?: string[];
}

const formatCartonsAndPieces = (rawQty: number, unitsPerCarton: number): string => {
  const cartons = Math.floor(rawQty / unitsPerCarton);
  const pieces = rawQty % unitsPerCarton;
  
  const parts: string[] = [];
  if (cartons > 0) {
    parts.push(`${cartons} كرتونة`);
  }
  if (pieces > 0) {
    parts.push(`${pieces} قطعة`);
  }
  return parts.length > 0 ? parts.join(' و ') : '0 قطعة';
};

export default function ReportsTab({
  invoices,
  expenses,
  products,
  customers,
  trips = [],
  factoryLoads = [],
  settings,
  usersList = [],
  onUpdateInvoice,
  onGoBack,
  permittedSubTabs
}: ReportsTabProps) {
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
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week'>('today');
  const [inventoryMatchFilter, setInventoryMatchFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Activity filter states
  const [custDateFilter, setCustDateFilter] = useState<'all' | 'week' | 'month' | 'custom'>('all');
  const [custStartDate, setCustStartDate] = useState('');
  const [custEndDate, setCustEndDate] = useState('');
  const [custAreaFilter, setCustAreaFilter] = useState('');
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

  const currentFilteredData = React.useMemo(() => {
    const isWithinPeriod = (dateString: string) => {
      const d = new Date(dateString);
      const now = new Date();
      if (periodFilter === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (periodFilter === 'week') {
        const msInWeek = 7 * 24 * 60 * 60 * 1000;
        return (now.getTime() - d.getTime()) < msInWeek;
      }
      return true;
    };

    const { carriedOverDebt, extraPayments } = (() => {
      try {
        const cod = parseFloat(localStorage.getItem('factory_carried_debt_sys') || '0');
        const ep = JSON.parse(localStorage.getItem('factory_extra_payments_sys') || '[]');
        return { carriedOverDebt: cod, extraPayments: ep };
      } catch {
        return { carriedOverDebt: 0, extraPayments: [] as any[] };
      }
    })();

    return {
      invoices: invoices.filter(i => isWithinPeriod(i.date)),
      expenses: expenses.filter(e => isWithinPeriod(e.date)),
      trips: trips.filter(t => isWithinPeriod(t.date || new Date().toISOString())),
      factoryLoads: (factoryLoads || []).filter(fl => isWithinPeriod(fl.date)),
      extraPayments: extraPayments.filter((ep: any) => isWithinPeriod(ep.date)),
      allExtraPayments: extraPayments, // for cumulative calculation
      carriedOverDebt
    };
  }, [invoices, expenses, trips, factoryLoads, periodFilter]);

  // 1. Calculations based on period filter
  const salesStats = React.useMemo(() => {
    // True total sales collected
    const trueTotalSales = currentFilteredData.invoices.reduce((sum, inv) => sum + inv.totalAfterDiscount, 0);
    const totalCollected = currentFilteredData.invoices.reduce((sum, inv) => sum + (inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount), 0);
    const totalRemaining = currentFilteredData.invoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount - (inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount)), 0);
    const totalBeforeDisc = currentFilteredData.invoices.reduce((sum, inv) => sum + inv.totalBeforeDiscount, 0);
    const totalDiscounts = totalBeforeDisc - trueTotalSales;

    // totalProfit is the Net Profit of invoices
    const totalProfit = currentFilteredData.invoices.reduce((sum, inv) => sum + inv.items.reduce((isum, it) => isum + ((it.finalPrice - (it.factoryPrice || it.originalPrice * 0.9)) * it.quantity), 0), 0);

    const totalSpent = currentFilteredData.expenses.filter(e => e.type !== 'revenue').reduce((sum, exp) => sum + exp.amount, 0);
    const extraRevenues = currentFilteredData.expenses.filter(e => e.type === 'revenue').reduce((sum, exp) => sum + exp.amount, 0);
    const totalTripsCollectedProfit = currentFilteredData.trips.filter(t => t.collected).reduce((sum, t) => sum + t.price, 0);
    
    // final netProfit = product profits + extraRevenues - totalSpent + trips
    const netProfit = totalProfit + extraRevenues - totalSpent + totalTripsCollectedProfit;

    // Factory stats calculations
    const periodAdvances = currentFilteredData.factoryLoads.reduce((sum, fl) => sum + (fl.advanceAmount ?? 0), 0);
    const periodExtraPayments = currentFilteredData.extraPayments.reduce((sum, ep) => sum + (ep.amount - (ep.appliedToCarriedDebt || 0)), 0);
    const totalPaidToFactoryInPeriod = periodAdvances + periodExtraPayments;

    // Cumulative overall remaining debt due to factory
    let rawAllLoadedValue = 0;
    (factoryLoads || []).forEach(load => {
      const prod = products.find(p => p.id === load.productId);
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => w.id === load.weightId);
      if (weight) {
        const unitsPerCarton = weight.unitsPerCarton || 12;
        const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
        const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
        const cartonPrice = weight.cartonPriceFromFactory || 0;
        const unitPrice = weight.factoryPricePerUnit || 0;
        rawAllLoadedValue += (cartons * cartonPrice) + (loose * unitPrice);
      }
    });

    const totalWithdrawnValue = rawAllLoadedValue + currentFilteredData.carriedOverDebt;
    const currentAdvancesTotal = (factoryLoads || []).reduce((sum, fl) => sum + (fl.advanceAmount ?? 0), 0);
    const manualPaymentsSumTotal = currentFilteredData.allExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
    const totalOverallPaidToFactory = currentAdvancesTotal + manualPaymentsSumTotal;
    const remainingDebtToFactory = Math.max(0, totalWithdrawnValue - totalOverallPaidToFactory);

    return {
      totalSales: trueTotalSales,
      totalCollected,
      totalRemaining,
      totalProfit,
      extraRevenues,
      totalDiscounts,
      totalSpent,
      totalTripsCollectedProfit,
      netProfit,
      totalPaidToFactoryInPeriod,
      remainingDebtToFactory
    };
  }, [currentFilteredData, products, factoryLoads]);

  // Calculate unpaid debt / debtor customers list 
  const debtorCustomers = React.useMemo(() => {
    const unpaidInvoices = invoices.filter(inv => {
      const paid = inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount;
      return (inv.totalAfterDiscount - paid) > 0.05; // has outstanding debt
    });

    const customersMap = new Map(customers.map(c => [c.id, c]));
    const map: Record<string, { invoices: Invoice[]; totalDebt: number }> = {};
    unpaidInvoices.forEach(inv => {
      if (!map[inv.customerId]) {
        map[inv.customerId] = { invoices: [], totalDebt: 0 };
      }
      const paid = inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount;
      const remaining = inv.totalAfterDiscount - paid;
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
        invoices: data.invoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        totalDebt: data.totalDebt
      };
    }).sort((a, b) => b.totalDebt - a.totalDebt);
  }, [invoices, customers]);

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
      paidAmount: inv.totalAfterDiscount
    };
    onUpdateInvoice(updatedInv);
  };

  const formatCartonsAr = (rawUnits: number, unitsPerCarton: number): string => {
    const c = rawUnits / unitsPerCarton;
    const formattedVal = Number(c.toFixed(2)).toLocaleString('ar-EG');
    return `${formattedVal} كرتونة`;
  };

  const delegateDebtBreakdown = React.useMemo(() => {
    const map: Record<string, number> = {};
    currentFilteredData.invoices.forEach(inv => {
      const paid = inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount;
      const remaining = inv.totalAfterDiscount - paid;
      if (remaining > 0.05) {
        const del = inv.delegateName || 'مناديب غير محددين';
        map[del] = (map[del] || 0) + remaining;
      }
    });
    return Object.entries(map).map(([name, val]) => ({ name, val })).sort((a,b) => b.val - a.val);
  }, [currentFilteredData]);

  const exportComprehensiveReportAsPDF = () => {
    // 1. Create iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-1000px';
    iframe.style.left = '-1000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    // Filter displays
    let periodLabel = periodFilter === 'today' ? 'اليوم (يومي)' : 'آخر ٧ أيام (أسبوعي)';

    // compute cost of sold goods
    const soldGoodsFactoryCost = currentFilteredData.invoices.reduce((sum, inv) => 
      sum + inv.items.reduce((isum, it) => isum + ((it.factoryPrice || it.originalPrice * 0.9) * it.quantity), 0), 0);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html dir="rtl" lang="ar">
        <head>
          <style>
            @media print {
              @page { size: A4; margin: 12mm; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.4; padding: 15px; background: #fff; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #1a365d; padding-bottom: 12px; }
            .header h1 { color: #1a365d; margin: 0 0 4px 0; font-size: 22px; font-weight: 900; }
            .header p { margin: 0; color: #475569; font-size: 13px; font-weight: bold; }
            
            .meta-flex { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; color: #334155; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
            
            .grid-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .stat-box { border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; text-align: center; background: #f8fafc; }
            .stat-box.highlight { background: #f0fdf4; border-color: #bbf7d0; }
            .stat-box.alert { background: #fef2f2; border-color: #fca5a5; }
            .stat-box span { display: block; font-size: 9px; color: #64748b; font-weight: bold; margin-bottom: 4px; }
            .stat-box strong { font-size: 12px; color: #0f172a; font-weight: 900; }
            
            h2 { font-size: 12px; color: #1a365d; margin: 15px 0 8px 0; border-right: 3px solid #dd6b20; padding-right: 8px; font-weight: 850; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: right; }
            th { background: #f1f5f9; color: #334155; font-weight: 900; }
            
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
            .badge-success { background: #dcfce7; color: #15803d; }
            .badge-warn { background: #fef3c7; color: #b45309; }
            .badge-danger { background: #fee2e2; color: #b91c1c; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير العمليات والحسابات المالي الشامل</h1>
            <p>مصنع سمن وزيت سوفانا الفاخر للأغذية المتحدون</p>
          </div>
          
          <div class="meta-flex">
            <div>الفترة المحددة المفلترة: <span style="color: #dd6b20;">${periodLabel}</span></div>
            <div>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          
          <div class="grid-stats">
            <div class="stat-box">
              <span>إجمالي المبيعات</span>
              <strong>${salesStats.totalSales.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="stat-box highlight">
              <span>المحصل من العملاء</span>
              <strong>${salesStats.totalCollected.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="stat-box alert">
              <span>باقي ديون العملاء</span>
              <strong>${salesStats.totalRemaining.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="stat-box">
              <span>المصروفات التشغيلية</span>
              <strong>${salesStats.totalSpent.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="stat-box">
              <span>أرباح المشاوير</span>
              <strong>${salesStats.totalTripsCollectedProfit.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="stat-box highlight">
              <span>المسدد للمصنع</span>
              <strong>${salesStats.totalPaidToFactoryInPeriod.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="stat-box alert">
              <span>مديونية المصنع الحالية</span>
              <strong>${salesStats.remainingDebtToFactory.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="stat-box highlight" style="background: #e0f2fe; border-color: #bae6fd;">
              <span>الصافي النهائي للربح</span>
              <strong style="color: #0369a1;">${salesStats.netProfit.toLocaleString('ar-EG')} ج.م</strong>
            </div>
          </div>
          
          <h2>١. قائمة فواتير مبيعات العملاء للفترة</h2>
          <table>
            <thead>
              <tr>
                <th width="40">م</th>
                <th>رقم الفاتورة</th>
                <th>العميل</th>
                <th>المندوب</th>
                <th>الإجمالي</th>
                <th>المسدد</th>
                <th>المتبقي</th>
              </tr>
            </thead>
            <tbody>
              ${currentFilteredData.invoices.length === 0 ? '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">لا توجد فواتير مبيعات في هذه الفترة.</td></tr>' : 
                currentFilteredData.invoices.map((inv, idx) => {
                  const cust = customers.find(c => c.id === inv.customerId);
                  const paid = inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount;
                  const remaining = inv.totalAfterDiscount - paid;
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><b>#${inv.invoiceNumber}</b></td>
                      <td>${cust ? cust.name : 'عميل غير مسجل'}</td>
                      <td>${inv.delegateName || 'غير محدد'}</td>
                      <td><b>${inv.totalAfterDiscount.toLocaleString('ar-EG')} ج.م</b></td>
                      <td style="color: #16a34a;">${paid.toLocaleString('ar-EG')} ج.م</td>
                      <td style="color: ${remaining > 0 ? '#dc2626' : '#64748b'}; font-weight: ${remaining > 0 ? 'bold' : 'normal'}">${remaining.toLocaleString('ar-EG')} ج.م</td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>

          <h2>٢. قائمة المصاريف التشغيلية والإيرادات</h2>
          <table>
            <thead>
              <tr>
                <th width="40">م</th>
                <th>البيان والتفاصيل</th>
                <th>الفئة</th>
                <th>النوع</th>
                <th>القيمة</th>
              </tr>
            </thead>
            <tbody>
              ${currentFilteredData.expenses.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">لا توجد حركة مصروفات مسجلة في هذه الفترة.</td></tr>' : 
                currentFilteredData.expenses.map((exp, idx) => {
                  const isRev = exp.type === 'revenue';
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${exp.description}</td>
                      <td>${exp.category || 'عام'}</td>
                      <td><span class="badge ${isRev ? 'badge-success' : 'badge-danger'}">${isRev ? 'إيراد وارد' : 'مصروف منصرف'}</span></td>
                      <td style="font-weight: bold; color: ${isRev ? '#16a34a' : '#b91c1c'}">${exp.amount.toLocaleString('ar-EG')} ج.م</td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>

          <h2>٣. سجل مشاوير السيارة والنقل</h2>
          <table>
            <thead>
              <tr>
                <th width="40">م</th>
                <th>تفاصيل المشوار والوجهة</th>
                <th>المندوب</th>
                <th>المبلغ</th>
                <th>الموقف</th>
              </tr>
            </thead>
            <tbody>
              ${currentFilteredData.trips.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">لا توجد مشاوير مسجلة للفترة.</td></tr>' : 
                currentFilteredData.trips.map((t, idx) => {
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${t.description}</td>
                      <td>${t.delegateName || 'غير محدد'}</td>
                      <td><b>${t.price.toLocaleString('ar-EG')} ج.م</b></td>
                      <td><span class="badge ${t.collected ? 'badge-success' : 'badge-warn'}">${t.collected ? 'تم التحصيل نقداً' : 'معلق آجل'}</span></td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>

          <div style="margin-top: 35px; border-top: 1px solid #cbd5e1; padding-top: 15px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #475569;">
            <div>اعتماد المسؤول الإداري: ................................</div>
            <div>توقيع المندوب الميداني: ................................</div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    // 3. Print and remove
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 500);
    }, 500);
  };

  // Group invoices by month
  const monthlyBreakdown = React.useMemo(() => {
    const months: Record<string, { sales: number; expenses: number; revs: number; count: number }> = {};

    invoices.forEach(inv => {
      const parts = inv.date.split('-');
      const monthYear = parts[0] + '-' + parts[1]; // YYYY-MM
      if (!months[monthYear]) {
        months[monthYear] = { sales: 0, expenses: 0, revs: 0, count: 0 };
      }
      months[monthYear].sales += inv.totalAfterDiscount;
      months[monthYear].count += 1;
    });

    expenses.forEach(exp => {
      const parts = exp.date.split('-');
      const monthYear = parts[0] + '-' + parts[1]; // YYYY-MM
      if (!months[monthYear]) {
        months[monthYear] = { sales: 0, expenses: 0, revs: 0, count: 0 };
      }
      if (exp.type === 'revenue') {
        months[monthYear].revs += exp.amount;
      } else {
        months[monthYear].expenses += exp.amount;
      }
    });

    return Object.entries(months).map(([dateStr, d]) => {
      const displayDate = new Date(dateStr + '-01').toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
      return {
        dateStr,
        displayDate,
        sales: d.sales,
        revs: d.revs,
        expenses: d.expenses,
        profit: (d.sales + d.revs) - d.expenses,
        count: d.count
      };
    }).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [invoices, expenses]);

  // Filter invoices for registry lookup
  const filteredInvoices = invoices.filter(inv => {
    const cust = customers.find(c => c.id === inv.customerId);
    const q = searchInvoice.toLowerCase();
    const textMatch = 
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (cust && cust.name.toLowerCase().includes(q)) ||
      (cust && cust.area.toLowerCase().includes(q));
      
    if (!textMatch) return false;
    
    if (dateFilter === 'all') return true;
    
    const invDate = new Date(inv.date);
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

  const exportMonthlyReportAsPDF = (monthStr: string, displayDate: string, sales: number, revenuesParam: number, expensesParam: number, profit: number) => {
    // 1. Create iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-1000px';
    iframe.style.left = '-1000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    // 2. Prepare content
    const mInvoices = invoices.filter(inv => inv.date.startsWith(monthStr));
    const mExpenses = expenses.filter(exp => exp.date.startsWith(monthStr));
    
    const mTotalBeforeDisc = mInvoices.reduce((sum, i) => sum + i.totalBeforeDiscount, 0);
    const mDisc = mInvoices.reduce((sum, i) => sum + (i.totalBeforeDiscount - i.totalAfterDiscount), 0);
    const mTotalSales = mTotalBeforeDisc - mDisc;
    const remaining = mTotalSales - sales;

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html dir="rtl" lang="ar">
        <head>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; line-height: 1.5; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #312e81; padding-bottom: 10px; }
            .header h1 { color: #312e81; margin: 0 0 5px 0; font-size: 24px; }
            .header p { margin: 0; color: #64748b; font-size: 14px; }
            .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: right; }
            th { background: #f1f5f9; color: #475569; font-weight: bold; }
            .profit { color: ${profit >= 0 ? '#047857' : '#be123c'}; font-weight: bold; font-size: 16px; }
            .notes-section { margin-top: 30px; border: 1px dashed #cbd5e1; height: 150px; border-radius: 8px; position: relative; }
            .notes-section::before { content: "مساحة لكتابة ملاحظات للإدارة..."; position: absolute; top: 15px; right: 15px; color: #94a3b8; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير الحسابات الختامية - ${displayDate}</h1>
            <p>تم التصدير من نظام المستودع والمبيعات</p>
          </div>
          <div class="summary">
            <div class="summary-box">
              <strong>الإجمالي:</strong> ${formatNum(mTotalBeforeDisc)}ج.م<br/>
              <strong style="color: #059669;">الخصم:</strong> ${formatNum(mDisc)}ج.م<br/>
              <strong style="color: #4f46e5;">المسدد:</strong> ${formatNum(sales)}ج.م<br/>
              <strong style="color: #ea580c;">المتبقي:</strong> ${formatNum(remaining)}ج.م
            </div>
            <div class="summary-box" style="text-align: left;">
              <strong>الإيرادات الإضافية:</strong> ${formatNum(revenuesParam)}ج.م<br/>
              <strong>المصروفات:</strong> ${formatNum(expensesParam)}ج.م<br/>
              <div class="profit" style="margin-top: 10px;">صافي الربح: ${formatNum(profit)}ج.م</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th width="50">م</th>
                <th>البيان / رقم الاستناد</th>
                <th width="150">النوع</th>
                <th width="120">القيمة (ج.م)</th>
              </tr>
            </thead>
            <tbody>
              ${mInvoices.map((inv, idx) => {
                const customer = customers.find(c => c.id === inv.customerId);
                return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>مبيعات ${customer ? customer.name : 'عميل غير مسجل'}</td>
                  <td style="color: #059669;">مبيعات واردة</td>
                  <td>${formatNum(inv.totalAfterDiscount)}</td>
                </tr>
              `}).join('')}
              ${mExpenses.map((exp, idx) => {
                const isRev = exp.type === 'revenue';
                const i = idx + mInvoices.length + 1;
                return `
                <tr>
                  <td>${i}</td>
                  <td>${isRev ? 'إيراد' : 'مصروف'}: ${exp.category}</td>
                  <td style="color: ${isRev ? '#059669' : '#e11d48'}">${isRev ? 'وارد إضافي' : 'منصرف'}</td>
                  <td>${formatNum(exp.amount)}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
          <div class="notes-section"></div>
        </body>
      </html>
    `);
    doc.close();

    // 3. Print and remove
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 500);
    }, 500);
  };
  
  const handleGenerateAndSendWA = async (customer: any) => {
    setWaLoadingId(customer.id);
    try {
      const isInactive = customer.invoicesCount === 0 || !customer.isActive;
      const statusText = isInactive ? "خامل / توقف عن الشراء" : "نشط / يقوم بمسحوبات";
      const userMessage = `قم بصياغة رسالة واتساب لعميل اسمه: ${customer.name} (حالة العميل في الفترة المحددة: ${statusText}، إجمالي مسحوباته في الفترة: ${customer.totalPurchases}ج.م ومحله في منطقة: ${customer.area}).
التعليمات والخطوط العريضة الخاصة بمدير المبيعات:
"${settings.aiRetentionGuidelines || 'قدم رسالة ترحيبية تشجعه على استمرار التعامل معنا، مع توضيح أننا نهتم بوجوده معنا كشريك نجاح.'}"
أريد فقط نص الرسالة بدون أي مقدمات أخرى لتكون جاهزة للإرسال.`;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: 'أنت مساعد مبيعات احترافي.',
          history: [],
          message: userMessage
        })
      });

      if (!response.ok) {
        throw new Error('الخادم الخارجي للذكاء الاصطناعي معطل حالياً.');
      }

      const data = await response.json();
      const messageText = encodeURIComponent(data.text);
      let phone = customer.phone;
      if (phone.startsWith('0')) {
        phone = '20' + phone.substring(1);
      }
      window.open(`https://wa.me/${phone}?text=${messageText}`, '_blank');
    } catch (err: any) {
      console.warn("Using local fallback WA message builder in ReportsTab:", err.message);
      
      const guidelines = settings.aiRetentionGuidelines || 'تقديم رسالة ترحيبية تشجعه على استمرار التعامل معنا، مع توضيح أننا نهتم بوجوده معنا';
      const fallbackMsg = `السلام عليكم ورحمة الله وبركاته يا فندم 🌹\nمعكم مندوب مبيعات مصنع زيوت وسمن "سوفانا" الفاخرة.\n\nنتشرف بالتعاون الدائم والمثمر معكم في [ ${customer.name} ] بمنطقتكم الكريمة [ ${customer.area} ]. نود في مصعد الإخوة المتحدون الإعراب عن عظيم تقديرنا لثقتكم الغالية بمنتجاتنا وزيت وسمن سوفانا ذو الجودة الفائقة.\n\n(✨ سياستنا المعتمدة: ${guidelines})\n\nهل نتشرف بتسليم طلبية جديدة لسيادتكم بأسعار بورصة اليوم الممتازة؟ نحن في خدمتكم دائماً وبالموعد!`;
      
      const messageText = encodeURIComponent(fallbackMsg);
      let phone = customer.phone;
      if (phone.startsWith('0')) {
        phone = '20' + phone.substring(1);
      }
      window.open(`https://wa.me/${phone}?text=${messageText}`, '_blank');
    } finally {
      setWaLoadingId(null);
    }
  };

  const filteredArchiveList = filteredInvoices.filter(inv => inv.totalAfterDiscount <= (inv.paidAmount ?? inv.totalAfterDiscount));
  const filteredDebtorsList = filteredInvoices.filter(inv => inv.totalAfterDiscount > (inv.paidAmount ?? inv.totalAfterDiscount));

  const exportMonthlyReportAsPNG = (monthStr: string, displayDate: string, sales: number, revenuesParam: number, expensesParam: number, profit: number) => {
    const canvas = document.createElement('canvas');
    const rowHeight = 35;
    
    // get this month's invoices and expenses
    const mInvoices = invoices.filter(inv => inv.date.startsWith(monthStr));
    const mExpenses = expenses.filter(exp => exp.date.startsWith(monthStr));
    
    const totalLines = mInvoices.length + mExpenses.length;
    const baseHeight = 350;
    canvas.width = 650;
    canvas.height = baseHeight + totalLines * rowHeight + 150;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    ctx.fillText(`الإيرادات الإضافية: ${formatNum(revenuesParam)}ج.م`, canvas.width - 40, 190);
    ctx.fillText(`المصروفات الدقيقة: ${formatNum(expensesParam)}ج.م`, canvas.width - 40, 220);
    ctx.fillStyle = profit >= 0 ? '#047857' : '#be123c';
    ctx.fillText(`صافي أرباح الشهر: ${formatNum(profit)}ج.م`, canvas.width - 40, 250);

    // Accounts section
    let y = 280;
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
      ctx.fillText(`${isRev ? 'إيراد' : 'مصروف'}: ${exp.category} - ${exp.description.substring(0, 30)}`, canvas.width - 80, y + 22);
      
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

  const filteredCustomerActivity = React.useMemo(() => {
    let list = [...customers];
    
    // Filter by Area
    if (custAreaFilter) {
      list = list.filter(c => c.area === custAreaFilter);
    }
    
    const invoicesByCustomer = new Map<string, Invoice[]>();
    invoices.forEach(inv => {
      const invDate = new Date(inv.date).getTime();
      const now = new Date().getTime();
      
      let include = true;
      if (custDateFilter === 'week') {
        include = (now - invDate) < 7 * 24 * 60 * 60 * 1000;
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
    return list.map(c => {
      const custInvoices = invoicesByCustomer.get(c.id) || [];
      
      const totalPurchases = custInvoices.reduce((sum, inv) => sum + inv.totalAfterDiscount, 0);
      const invoicesCount = custInvoices.length;
      
      return {
        ...c,
        totalPurchases,
        invoicesCount,
        recentInvoices: custInvoices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        isActive: totalPurchases > 0
      };
    }).sort((a, b) => b.totalPurchases - a.totalPurchases);
  }, [customers, invoices, custAreaFilter, custDateFilter, custStartDate, custEndDate]);

  // Unique areas
  const areas = Array.from(new Set(customers.map(c => c.area).filter(Boolean)));

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 font-sans text-right animate-fade-in" dir="rtl" id="reports-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
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
          <div className="bg-[#FFFFFF] p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <div className="flex flex-row flex-wrap items-center gap-2">
              <span className="text-xs font-black text-[#2B6CB0] ml-1 shrink-0">تحديد فترة:</span>
              <div className="flex flex-wrap items-center gap-1.5 flex-1 select-none">
                <button 
                  onClick={() => setPeriodFilter('today')}
                  className={`py-1 px-3.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer shrink-0 ${periodFilter === 'today' ? 'bg-indigo-100 text-[#1A365D] border border-indigo-200 shadow-sm' : 'bg-[#F7FAFC] text-[#2B6CB0] border border-slate-200 hover:bg-[#F7FAFC]'}`}
                >
                  يومي
                </button>
                <button 
                  onClick={() => setPeriodFilter('week')}
                  className={`py-1 px-3.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer shrink-0 ${periodFilter === 'week' ? 'bg-indigo-100 text-[#1A365D] border border-indigo-200 shadow-sm' : 'bg-[#F7FAFC] text-[#2B6CB0] border border-slate-200 hover:bg-[#F7FAFC]'}`}
                >
                  أسبوعي
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Finance Tab (الإيرادات والمصروفات) */}
        {activeSubTab === 'finance' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex flex-col gap-1 text-center justify-between">
                <div>
                  <span className="text-emerald-850 font-black text-xs block">إجمالي الإيرادات</span>
                  <span className="text-emerald-600 font-bold text-[9px] block leading-tight mt-0.5">ما تم تحصيله بعد خصم المسدد للمصنع</span>
                </div>
                <span className="text-xl font-black text-emerald-800 my-1 block">
                  {formatNum((salesStats.totalCollected + salesStats.extraRevenues) - salesStats.totalPaidToFactoryInPeriod)}
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
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>خصم المسدد للمصنع:</span>
                    <span>-{formatNum(salesStats.totalPaidToFactoryInPeriod)}ج</span>
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

            {viewingExpenses && (
              <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col gap-3 animate-fade-in">
                <h3 className="font-bold text-rose-700 text-sm border-b border-slate-100 pb-2">سجل المصروفات للفترة</h3>
                <div className="flex flex-col gap-2">
                  {currentFilteredData.expenses.filter(e => e.type !== 'revenue').length === 0 ? (
                    <p className="text-center text-gray-400 py-6 text-xs">لا توجد مصروفات لهذه الفترة.</p>
                  ) : (
                    currentFilteredData.expenses
                      .filter(e => e.type !== 'revenue')
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((exp, idx) => (
                        <div key={idx} className="flex justify-between items-center border border-slate-100 p-2.5 rounded-lg bg-[#F7FAFC]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-bold text-[#DD6B20]">{exp.description}</span>
                            <span className="text-[9px] text-gray-400 font-medium">{new Date(exp.date).toLocaleString('ar-EG')}</span>
                          </div>
                          <span className="font-black text-xs text-rose-700">
                            - {exp.amount.toLocaleString('ar-EG')}ج.م
                          </span>
                        </div>
                      ))
                  )}
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
                    <span className="text-xl font-black text-emerald-800" dir="rtl">{salesStats.netProfit.toLocaleString('ar-EG')} ج.م</span>
                    <span className="text-[10px] text-gray-400 font-bold">ناتج عملية البيع والمشاوير بعد خصم المصنع والمصروفات</span>
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
                      <span className="text-rose-700" dir="rtl">{(currentFilteredData.expenses.filter(e => e.type !== 'revenue' && (e.description.includes('بنزين') || e.description.includes('وقود') || e.description.includes('مشوار') || e.description.includes('سيارة') || e.description.includes('سفر'))).reduce((sum, e) => sum + e.amount, 0)).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="bg-[#FFFFFF] border border-indigo-100 p-2 rounded-xl flex flex-col">
                      <span className="text-indigo-600 font-bold text-[9px] mb-1">الصافي الفعلي</span>
                      <span className="text-indigo-900" dir="rtl">{((salesStats.totalTripsCollectedProfit) - (currentFilteredData.expenses.filter(e => e.type !== 'revenue' && (e.description.includes('بنزين') || e.description.includes('وقود') || e.description.includes('مشوار') || e.description.includes('سيارة') || e.description.includes('سفر'))).reduce((sum, e) => sum + e.amount, 0))).toLocaleString('ar-EG')} ج.م</span>
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
                      <span className="text-slate-600">إجمالي قيمة فواتير المبيعات (العملاء)</span>
                      <span className="text-emerald-800" dir="rtl">{(salesStats.totalSales).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5">
                      <span className="text-slate-600">يخصم: تكلفة البضاعة المباعة للمصنع</span>
                      <span className="text-rose-700" dir="rtl">- {(currentFilteredData.invoices.reduce((sum, inv) => sum + inv.items.reduce((isum, it) => isum + ((it.factoryPrice || it.originalPrice * 0.9) * it.quantity), 0), 0)).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5">
                      <span className="text-slate-600">يخصم: إجمالي المصروفات الإدارية والتشغيلية المعتمدة</span>
                      <span className="text-rose-700" dir="rtl">- {(salesStats.totalSpent).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5">
                      <span className="text-slate-600">يضاف: أرباح المشاوير اللوجستية التي تم تحصيلها</span>
                      <span className="text-emerald-700" dir="rtl">+ {(salesStats.totalTripsCollectedProfit).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm font-black border-t border-emerald-300 pt-2 text-[#1A365D]">
                      <span>الصافي الفعلي النهائي للربح</span>
                      <span className="text-emerald-800" dir="rtl">{(salesStats.netProfit).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-600 leading-relaxed font-semibold">
                    * يتم احتساب "الصافي" بدقة متناهية بناءً على الفرق الحقيقي بين تسعيرة التوزيع للعملاء والتكلفة الثابتة للمصنع (سعر المصنع للكرتونة) مضافاً إليها إيرادات السيارة ومطروحاً منها كافة المصاريف.
                  </p>
                </div>
              )}

              {activeDetailCard === 'debtors' && (
                <div className="bg-rose-50/70 border border-rose-200 p-4 rounded-2xl text-right animate-fade-in flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-rose-200 pb-2">
                    <h4 className="font-extrabold text-rose-950 text-xs">🏭 كشف وتحليل المديونيات والمعلقات المالية</h4>
                    <button onClick={() => setActiveDetailCard(null)} className="text-rose-500 hover:text-rose-950 text-xs font-bold bg-[#FFFFFF] px-2 py-0.5 rounded-lg border border-rose-200 shadow-2xs font-bold">غلق ✕</button>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 text-right">
                    <span className="text-[11px] font-extrabold text-rose-900 border-b border-rose-200/50 pb-1">١. مديونية المصنع الكلية المتبقية حالياً (للمصنع):</span>
                    <div className="flex justify-between items-center bg-[#FFFFFF] p-2.5 rounded-xl border border-rose-100 text-xs">
                      <span className="text-[#1A365D] font-extrabold">الذمة المالية المترتبة للمصنع الأساسي</span>
                      <span className="text-sm font-black text-rose-800" dir="rtl">{(salesStats.remainingDebtToFactory).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1 text-right">
                    <span className="text-[11px] font-extrabold text-indigo-900 border-b border-indigo-200/40 pb-1">٢. مديونيات التحصيل المعلقة علي المناديب (أمانة التحصيل):</span>
                    <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto">
                      {delegateDebtBreakdown.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-2 font-bold">لا توجد مديونيات معلقة على المناديب للفترة الحالية.</p>
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
                    <span>إجمالي مديونيات العملاء الميدانية:</span>
                    <span dir="rtl">{(salesStats.totalRemaining).toLocaleString('ar-EG')} ج.م</span>
                  </div>

                  <button 
                    onClick={() => {
                      setActiveDetailCard(null);
                      setShowDebtorsModal(true);
                    }}
                    className="w-full bg-[#1A365D] hover:bg-[#2B6CB0] text-[#FFFFFF] font-black text-xs py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer mt-1"
                  >
                    🔍 فتح سجل العملاء المدينين والتحصيل التفصيلي
                  </button>
                </div>
              )}

              {/* Total Balance / Net Profit */}
              <div className={`rounded-2xl p-5 text-white shadow-md flex items-center justify-between relative overflow-hidden ${
                salesStats.netProfit >= 0 ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm' : 'bg-rose-600'
              }`}>
                <div className="flex flex-col gap-0.5 z-10">
                  <span className="text-xs text-white/90 font-bold">صافي الأرباح</span>
                  <span className="text-3xl font-black">
                    {salesStats.netProfit.toLocaleString('ar-EG')}<span className="text-xs font-bold">ج.م</span>
                  </span>
                </div>
                
                <div className="bg-[#FFFFFF]/15 p-2.5 rounded-2xl z-10">
                  {salesStats.netProfit >= 0 ? <TrendingUp className="h-10 w-10 text-white" /> : <TrendingDown className="h-10 w-10 text-white" />}
                </div>
                <div className="absolute -right-6 -bottom-6 h-24 w-24 bg-[#FFFFFF]/5 rounded-full blur-xl pointer-events-none"></div>
              </div>

              {/* Monthly Reports Table */}
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <h3 className="font-bold text-[#1A365D] text-sm border-b border-slate-100 pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 pb-1">
                    <Clock className="h-4.5 w-4.5 text-[#2B6CB0]" />
                    تحليل شهري للفترة المحددة
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
                              onClick={() => exportMonthlyReportAsPNG(month.dateStr, month.displayDate, month.sales, month.revs, month.expenses, month.profit)}
                              className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent text-white rounded p-1 shadow-xs transition-colors cursor-pointer"
                              title="تنزيل كصورة"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 11.586V4a1 1 0 011-1zM5 13a1 1 0 012 0v2h6v-2a1 1 0 112 0v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              onClick={() => exportMonthlyReportAsPDF(month.dateStr, month.displayDate, month.sales, month.revs, month.expenses, month.profit)}
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
              const invoiceProfit = selectedInvoice.items.reduce((sum, it) => sum + ((it.finalPrice - (it.factoryPrice || it.originalPrice * 0.9)) * it.quantity), 0);
              const invoiceDate = new Date(selectedInvoice.date);
              
              return (
              <div className="bg-[#FFFFFF] p-4 rounded-xl shadow-md border-r-4 border-r-[#DD6B20] mb-2 flex flex-col gap-3 relative animate-fade-in">
                <button onClick={() => setSelectedInvoice(null)} className="absolute top-2 left-2 text-[#9CA3AF] hover:text-[#1A365D] bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center cursor-pointer">✕</button>
                
                <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5">
                    العميل: <span className="text-[#DD6B20]">{customer ? customer.name : 'عميل غير مسجل'}</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-semibold">{invoiceDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
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
                  {selectedInvoice.items.map((it, i) => {
                    const prod = products.find(p => p.id === it.productId);
                    const weight = prod?.weights?.find(w => w.id === it.weightId);
                    const multiplier = weight?.unitsPerCarton || 12;
                    const cartonsText = formatCartonsAndPieces(it.quantity, multiplier);
                    const cartonPrice = Number((it.finalPrice * multiplier).toFixed(2));
                    return (
                      <div key={i} className="flex justify-between items-center bg-[#F7FAFC] border border-slate-100 p-2 rounded-lg text-right">
                         <div className="flex flex-col">
                          <span className="font-bold text-xs text-[#1A365D]">{prod?.name || 'منتج محذوف'} (حجم {weight?.size || 'مجهول'})</span>
                          <span className="text-[10px] text-slate-500 font-extrabold" dir="rtl">{cartonsText} {formatNum(cartonPrice)} ج.م</span>
                        </div>
                        <span className="text-xs font-black text-[#DD6B20]">+ {formatNum((it.finalPrice - (it.factoryPrice || it.originalPrice * 0.9)) * it.quantity)} ج</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2.5 mt-3 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => {
                      setEditingInvoice(selectedInvoice);
                      setEditItems([...selectedInvoice.items]);
                      setEditPaid(selectedInvoice.paidAmount !== undefined ? selectedInvoice.paidAmount : selectedInvoice.totalAfterDiscount);
                      setEditDate(selectedInvoice.date.substring(0, 16));
                      setEditNotes(selectedInvoice.notes || '');
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-3 rounded-lg text-xs transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm"
                  >
                    ✍️ تعديل الفاتورة المؤرشفة
                  </button>
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
                      {currentFilteredData.invoices.sort((a,b)=>new Date(b.date).getTime() - new Date(a.date).getTime()).map(inv => {
                        const customer = customers.find(c => c.id === inv.customerId);
                        const discountValue = inv.totalBeforeDiscount - inv.totalAfterDiscount;
                        const discountPerc = inv.totalBeforeDiscount > 0 ? (discountValue / inv.totalBeforeDiscount) * 100 : 0;
                        const profit = inv.items.reduce((sum, item) => sum + ((item.finalPrice - (item.factoryPrice || item.originalPrice * 0.9)) * item.quantity), 0);
                        return (
                          <tr key={inv.id} onClick={() => setSelectedInvoice(inv)} className="hover:bg-indigo-50 cursor-pointer transition-colors border-b border-slate-200">
                            <td className="p-2 font-bold text-[#1A365D]">#{inv.invoiceNumber}</td>
                            <td className="p-2 font-mono text-gray-500">{new Date(inv.date).toLocaleDateString('ar-EG')}</td>
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
                العملاء الأكثر نشاطاً في التوزيع
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
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
                            {c.area} • مسحوبات: <strong className="text-[#1A365D]">{formatNum(c.totalPurchases)}ج.م</strong>
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
                                  <span className="text-[10px] text-[#2B6CB0]">{new Date(inv.date).toLocaleDateString('ar-EG')}</span>
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



        {activeSubTab === "inventory" && (() => {
          // Helper lists and functions for date calculation
          const getNormalizedDateKey = (dateStr: string): string => {
            if (!dateStr) return 'تاريخ غير محدد';
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
            return days[date.getDay()];
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
              const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
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

          // 1. Gather all activity dates
          const allDates = new Set<string>();
          factoryLoads.forEach(l => {
            if (l.date) allDates.add(getNormalizedDateKey(l.date));
          });
          invoices.forEach(inv => {
            if (inv.date) allDates.add(getNormalizedDateKey(inv.date));
          });

          // 2. Map group values
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

          factoryLoads.forEach(l => {
            if (!l.date) return;
            const gKey = getGroupKey(l.date);
            if (groupsMap[gKey]) {
              groupsMap[gKey].loads.push(l);
            }
          });

          invoices.forEach(inv => {
            if (!inv.date) return;
            const gKey = getGroupKey(inv.date);
            if (groupsMap[gKey]) {
              inv.items.forEach(item => {
                groupsMap[gKey].invItems.push({
                  productId: item.productId,
                  weightId: item.weightId,
                  quantity: item.quantity
                });
              });
            }
          });

          // Sort descending newest first
          const sortedGroupKeys = Object.keys(groupsMap).sort((a, b) => {
            return b.localeCompare(a);
          });

          return (
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
                  {sortedGroupKeys.length === 0 ? (
                    <div className="text-center text-slate-400 py-12 text-xs">لا توجد أي حمولات أو مبيعات مسجلة في النظام بعد.</div>
                  ) : (
                    sortedGroupKeys.map(gKey => {
                      const groupData = groupsMap[gKey];
                      
                      // 1. Gather all product+weight combinations in this group
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

                      if (activeCombinations.length === 0) return null;

                      // Display header
                      const groupHeaderLabel = inventoryMatchFilter === 'daily' ? formatDateString(gKey) : gKey;

                      return (
                        <div key={gKey} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                          {/* Group header bar */}
                          <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2.5 border-b border-slate-200 text-slate-800 dark:text-slate-100 flex justify-between items-center">
                            <span className="font-extrabold text-xs text-[#1A365D] dark:text-indigo-300">
                              {groupHeaderLabel}
                            </span>
                            <span className="bg-[#1A365D] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                              {activeCombinations.length} أصناف نشطة
                            </span>
                          </div>

                          <div className="p-3 flex flex-col gap-4 bg-slate-50/50">
                            {activeCombinations.map(combo => {
                              const product = products.find(p => p.id === combo.productId);
                              if (!product) return null;

                              const activeWeights = getProductWeightsFallback(product);
                              const weight = activeWeights.find(w => w.id === combo.weightId) || activeWeights[0];
                              if (!weight) return null;

                              // Recalculate local quantities under this group
                              const groupLoaded = groupData.loads
                                ?.filter(l => l.productId === product.id && l.weightId === weight.id)
                                .reduce((sum, l) => sum + (l.quantity || 0), 0) || 0;

                              const groupSold = groupData.invItems
                                ?.filter(item => item.productId === product.id && item.weightId === weight.id)
                                .reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

                              const remainingUnits = groupLoaded - groupSold;
                              const unitsPerCarton = weight.unitsPerCarton || 12;

                              return (
                                <div key={`${product.id}-${weight.id}`} className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col gap-2.5 transition-all shadow-xs hover:border-slate-350">
                                  {/* Item metadata with custom color */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-extrabold text-emerald-600 text-xs text-emerald-800">
                                        {product.name}
                                      </span>
                                      <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-md text-[9px] font-black border border-emerald-100">
                                        {weight.size}
                                      </span>
                                    </div>
                                    
                                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black border flex items-center justify-center gap-1 ${
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

                                  {/* Quantities columns */}
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
                                        {formatCartonsAr(groupSold, unitsPerCarton)}
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
          );
        })()}



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
                {debtorCustomers.filter(d => d.customer.name.toLowerCase().includes(debtorSearchQuery.toLowerCase())).length === 0 ? (
                  <p className="text-center text-slate-400 py-12 text-xs">لا يوجد عملاء مدينين حالياً تطابق البحث.</p>
                ) : (
                  debtorCustomers
                    .filter(d => d.customer.name.toLowerCase().includes(debtorSearchQuery.toLowerCase()))
                    .map(({ customer, invoices: unpaidInvs, totalDebt }) => (
                      <div key={customer.id} className="border border-slate-200 rounded-xl bg-slate-50/50 p-3 flex flex-col gap-2.5">
                        
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
                          {unpaidInvs.map(inv => {
                            const remaining = inv.totalAfterDiscount - (inv.paidAmount ?? 0);
                            return (
                              <div key={inv.id} className="bg-[#FFFFFF] border border-slate-150 p-2.5 rounded-lg flex items-center justify-between shadow-xs">
                                <div className="flex flex-col gap-1 text-right">
                                  <div className="flex items-center gap-1.5 flex-row-reverse justify-end">
                                    <span className="text-[11px] font-bold text-[#1A365D]">فاتورة #{inv.invoiceNumber}</span>
                                    <span className="text-[9px] bg-slate-100 text-slate-650 font-bold px-1 rounded">
                                      {new Date(inv.date).toLocaleDateString('ar-EG')}
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
                                    onClick={async () => {
                                      const partialInput = prompt(`ما هو المبلغ المسدد الآن للفاتورة #${inv.invoiceNumber}؟ (المبلغ المتبقي: ${formatNum(remaining)}ج.م)`);
                                      if (partialInput) {
                                        const amount = parseFloat(partialInput);
                                        if (isNaN(amount) || amount <= 0 || amount > remaining) {
                                          alert('مبلغ غير صالح!');
                                        } else {
                                          await handleSettlePartial(inv, amount);
                                        }
                                      }
                                    }}
                                    className="bg-amber-100 hover:bg-amber-150 border border-amber-250 text-amber-800 px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                                  >
                                    سداد جزئي 🪙
                                  </button>
                                  {/* Pay full */}
                                  <button
                                    onClick={async () => {
                                      if (confirm(`هل أنت متأكد من سداد الفاتورة #${inv.invoiceNumber} بالكامل بقيمة ${formatNum(remaining)}ج.م؟`)) {
                                        await handleSettleFull(inv);
                                      }
                                    }}
                                    className="bg-emerald-100 hover:bg-emerald-150 border border-emerald-250 text-emerald-800 p-1 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                                    title="سداد بالكامل"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
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
          const weight = prod?.weights?.find(w => w.id === editAddWeightId);
          if (!prod || !weight) return;
          
          const multiplier = weight.unitsPerCarton || 12;
          const pieces = Math.round(parseFloat(editAddQty) * multiplier);
          if (isNaN(pieces) || pieces <= 0) {
            alert('يرجى إدخال كمية صحيحة بالكرتونة!');
            return;
          }
          
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
              originalPrice: weight.retailPricePerUnit || 100,
              discountPercent: 0,
              finalPrice: weight.retailPricePerUnit || 100,
              factoryPrice: weight.factoryPricePerUnit || (weight.retailPricePerUnit ? weight.retailPricePerUnit * 0.9 : 90)
            };
            setEditItems([...editItems, newItem]);
          }
          
          // Reset add inputs
          setEditAddQty('');
        };

        const availableWeights = editAddProductId ? (products.find(p => p.id === editAddProductId)?.weights || []) : [];

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
                        const prod = products.find(p => p.id === it.productId);
                        const weight = prod?.weights?.find(w => w.id === it.weightId);
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

                              {/* Price per unit input */}
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
                          const pObj = products.find(p => p.id === pid);
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
    </div>
  );
}
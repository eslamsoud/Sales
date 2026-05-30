/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Invoice, Expense, Product, Customer, Trip, AppSettings, formatNum } from '../types';
import { ArrowRight, FileSpreadsheet, Send, TrendingUp, TrendingDown, Clock, Search, Eye, Filter, Check, ShieldAlert, MapPin, Printer, ChevronDown, AlertCircle } from 'lucide-react';
import SecurePhoneDisplay from './SecurePhoneDisplay';

interface ReportsTabProps {
  invoices: Invoice[];
  expenses: Expense[];
  products: Product[];
  customers: Customer[];
  trips?: Trip[];
  settings: AppSettings;
  onUpdateInvoice?: (updated: Invoice) => void;
  onGoBack: () => void;
  permittedSubTabs?: string[];
}

export default function ReportsTab({
  invoices,
  expenses,
  products,
  customers,
  trips = [],
  settings,
  onUpdateInvoice,
  onGoBack,
  permittedSubTabs
}: ReportsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'finance' | 'stats' | 'areas' | 'invoices'>(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('reports_finance')) return 'finance';
      if (permittedSubTabs.includes('reports_stats')) return 'stats';
      if (permittedSubTabs.includes('reports_areas')) return 'areas';
      if (permittedSubTabs.includes('reports_invoices')) return 'invoices';
    }
    return 'finance';
  });
  
  // Debtors interaction state
  const [showDebtorsModal, setShowDebtorsModal] = useState(false);
  const [debtorSearchQuery, setDebtorSearchQuery] = useState('');
  
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeSubTab]);

  // Filter states
  const [periodFilter, setPeriodFilter] = useState<'all' | 'week' | 'month' | 'custom'>('month');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');

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

  const currentFilteredData = React.useMemo(() => {
    const isWithinPeriod = (dateString: string) => {
      if (periodFilter === 'all') return true;
      const d = new Date(dateString);
      const now = new Date();
      if (periodFilter === 'week') {
        const msInWeek = 7 * 24 * 60 * 60 * 1000;
        return (now.getTime() - d.getTime()) < msInWeek;
      }
      if (periodFilter === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'custom') {
        if (periodStartDate && periodEndDate) {
          const sd = new Date(periodStartDate);
          const ed = new Date(periodEndDate);
          ed.setHours(23, 59, 59, 999);
          return d.getTime() >= sd.getTime() && d.getTime() <= ed.getTime();
        }
      }
      return true;
    };

    return {
      invoices: invoices.filter(i => isWithinPeriod(i.date)),
      expenses: expenses.filter(e => isWithinPeriod(e.date)),
      trips: trips.filter(t => isWithinPeriod(t.date || new Date().toISOString()))
    };
  }, [invoices, expenses, trips, periodFilter, periodStartDate, periodEndDate]);

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
    };
  }, [currentFilteredData]);

  // Calculate unpaid debt / debtor customers list 
  const debtorCustomers = React.useMemo(() => {
    const unpaidInvoices = invoices.filter(inv => {
      const paid = inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount;
      return (inv.totalAfterDiscount - paid) > 0.05; // has outstanding debt
    });

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
      const customer = customers.find(c => c.id === custId) || {
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
    const dateStr = new Date().toLocaleDateString('ar-EG');
    const newNotes = inv.notes 
      ? `${inv.notes} | تم سداد جزء ${amount} ج.م من التقارير بتاريخ ${dateStr}` 
      : `تم سداد جزء ${amount} ج.م من التقارير بتاريخ ${dateStr}`;
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
              body { margin: 0; }
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
              <strong>الإجمالي:</strong> ${formatNum(mTotalBeforeDisc)} ج.م<br/>
              <strong style="color: #059669;">الخصم:</strong> ${formatNum(mDisc)} ج.م<br/>
              <strong style="color: #4f46e5;">المسدد:</strong> ${formatNum(sales)} ج.م<br/>
              <strong style="color: #ea580c;">المتبقي:</strong> ${formatNum(remaining)} ج.م
            </div>
            <div class="summary-box" style="text-align: left;">
              <strong>الإيرادات الإضافية:</strong> ${formatNum(revenuesParam)} ج.م<br/>
              <strong>المصروفات:</strong> ${formatNum(expensesParam)} ج.م<br/>
              <div class="profit" style="margin-top: 10px;">صافي الربح: ${formatNum(profit)} ج.م</div>
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
      const userMessage = `قم بصياغة رسالة واتساب لعميل اسمه: ${customer.name} (حالة العميل في الفترة المحددة: ${statusText}، إجمالي مسحوباته في الفترة: ${customer.totalPurchases} ج.م ومحله في منطقة: ${customer.area}).
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
        throw new Error('فشل في الاتصال بمساعد الذكاء الاصطناعي');
      }

      const data = await response.json();
      const messageText = encodeURIComponent(data.text);
      let phone = customer.phone;
      if (phone.startsWith('0')) {
        phone = '20' + phone.substring(1);
      }
      window.open(`https://wa.me/${phone}?text=${messageText}`, '_blank');
    } catch (err: any) {
      alert("حدث خطأ أثناء صياغة رسالة الواتساب عبر الذكاء الاصطناعي: " + err.message);
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

    // إعداد اتجاه الكانفاس لتلافي تقطع الكلمات العربية
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
    ctx.fillText(`إجمالي المبيعات: ${formatNum(sales)} ج.م`, canvas.width - 40, 160);
    ctx.fillText(`الإيرادات الإضافية: ${formatNum(revenuesParam)} ج.م`, canvas.width - 40, 190);
    ctx.fillText(`المصروفات الدقيقة: ${formatNum(expensesParam)} ج.م`, canvas.width - 40, 220);
    ctx.fillStyle = profit >= 0 ? '#047857' : '#be123c';
    ctx.fillText(`صافي أرباح الشهر: ${formatNum(profit)} ج.م`, canvas.width - 40, 250);

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
    ctx.fillText(formatNum(mTotalBeforeDisc) + ' ج.م', 40, y + 30);
    
    ctx.fillStyle = '#059669';
    ctx.fillText(formatNum(mDisc) + ' ج.م', 40, y + 55);
    
    ctx.fillStyle = '#4f46e5';
    ctx.fillText(formatNum(sales) + ' ج.م', 40, y + 80);
    
    ctx.fillStyle = '#ea580c';
    ctx.fillText(formatNum(remaining) + ' ج.م', 40, y + 105);

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
    
    // Calculate stats based on period
    return list.map(c => {
      const custInvoices = invoices.filter(inv => {
        if (inv.customerId !== c.id) return false;
        
        const invDate = new Date(inv.date).getTime();
        const now = new Date().getTime();
        
        if (custDateFilter === 'week') {
          return (now - invDate) < 7 * 24 * 60 * 60 * 1000;
        }
        if (custDateFilter === 'month') {
          const mDate = new Date(inv.date);
          const cDate = new Date();
          return mDate.getMonth() === cDate.getMonth() && mDate.getFullYear() === cDate.getFullYear();
        }
        if (custDateFilter === 'custom' && custStartDate && custEndDate) {
          const fromDate = new Date(custStartDate).getTime();
          const toDate = new Date(custEndDate).getTime() + 86400000; // include full day
          return invDate >= fromDate && invDate <= toDate;
        }
        return true; // 'all' or default
      });
      
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
    <div className="bg-[#F7FAFC] min-h-screen pb-12 font-sans" id="reports-tab-container">
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
          const showAreas = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('reports_areas');
          const showInvoices = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('reports_invoices');
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
                  الإحصائيات والأرباح
                </button>
              )}
              {showAreas && (
                <button
                  onClick={() => setActiveSubTab('areas')}
                  className={`flex-1 py-1.5 px-1 rounded-xl font-black text-[11px] sm:text-[13px] transition-all cursor-pointer select-none ${
                    activeSubTab === 'areas' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none' : 'text-[#9CA3AF] bg-transparent border-transparent'
                  }`}
                >
                  المناطق ونشاط العملاء
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
                  onClick={() => setPeriodFilter('week')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer shrink-0 ${periodFilter === 'week' ? 'bg-indigo-100 text-[#1A365D] border border-indigo-200' : 'bg-[#F7FAFC] text-[#2B6CB0] border border-slate-200 hover:bg-[#F7FAFC]'}`}
                >
                  أسبوعي
                </button>
                <button 
                  onClick={() => setPeriodFilter('month')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer shrink-0 ${periodFilter === 'month' ? 'bg-indigo-100 text-[#1A365D] border border-indigo-200' : 'bg-[#F7FAFC] text-[#2B6CB0] border border-slate-200 hover:bg-[#F7FAFC]'}`}
                >
                  الشهري الأساسي
                </button>
                <button 
                  onClick={() => setPeriodFilter('custom')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer shrink-0 ${periodFilter === 'custom' ? 'bg-indigo-100 text-[#1A365D] border border-indigo-200' : 'bg-[#F7FAFC] text-[#2B6CB0] border border-slate-200 hover:bg-[#F7FAFC]'}`}
                >
                  الفترة من / إلى
                </button>
                <button 
                  onClick={() => setPeriodFilter('all')}
                  className={`py-1 px-2.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer shrink-0 ${periodFilter === 'all' ? 'bg-indigo-100 text-[#1A365D] border border-indigo-200' : 'bg-[#F7FAFC] text-[#2B6CB0] border border-slate-200 hover:bg-[#F7FAFC]'}`}
                >
                  كل الفترات
                </button>
              </div>
            </div>
            
            {periodFilter === 'custom' && (
              <div className="flex items-center gap-2 bg-[#F7FAFC] p-2 rounded-lg border border-slate-100 animate-fade-in">
                <input 
                  type="date"
                  value={periodStartDate}
                  onChange={(e) => setPeriodStartDate(e.target.value)}
                  className="bg-[#FFFFFF] border flex-1 border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <span className="text-xs text-gray-400">إلى</span>
                <input 
                  type="date"
                  value={periodEndDate}
                  onChange={(e) => setPeriodEndDate(e.target.value)}
                  className="bg-[#FFFFFF] border flex-1 border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            )}
          </div>
        )}
        
        {/* Finance Tab (الإيرادات والمصروفات) */}
        {activeSubTab === 'finance' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex flex-col gap-1 text-center">
                <span className="text-[#DD6B20] font-bold text-xs">إجمالي الإيرادات في الفترة</span>
                <span className="text-xl font-black text-emerald-800">{formatNum(salesStats.totalSales + salesStats.extraRevenues)} <span className="text-xs">ج.م</span></span>
              </div>
              <div 
                className="bg-rose-50 rounded-2xl p-4 border border-rose-100 flex flex-col gap-1 text-center cursor-pointer hover:bg-rose-100 transition-colors active:scale-95"
                onClick={() => setViewingExpenses(!viewingExpenses)}
              >
                <span className="text-rose-700 font-bold text-xs flex items-center justify-center gap-1">إجمالي المصروفات <ChevronDown className={`h-3 w-3 transition-transform ${viewingExpenses ? 'rotate-180' : ''}`} /></span>
                <span className="text-xl font-black text-rose-800">{formatNum(salesStats.totalSpent)} <span className="text-xs">ج.م</span></span>
              </div>
            </div>

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
                            - {exp.amount.toLocaleString('ar-EG')} ج.م
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
              
              {/* Quick dashboard numbers */}
              <div className="grid grid-cols-2 gap-3.5">
                
                <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-1">
                  <span className="text-[10px] sm:text-xs font-bold text-[#2B6CB0]">المبيعات</span>
                  <span className="text-xl font-black text-[#1A365D]">{salesStats.totalSales.toLocaleString('ar-EG')} ج.م</span>
                  <span className="text-[10px] text-[#DD6B20] font-bold flex items-center gap-0.5 mt-0.5">
                    <TrendingUp className="h-3 w-3 inline" /> الخصومات: {formatNum(salesStats.totalDiscounts)} ج.م
                  </span>
                </div>

                <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-1">
                  <span className="text-[10px] sm:text-xs font-bold text-[#2B6CB0]">المصروفات</span>
                  <span className="text-xl font-black text-[#DD6B20]">{salesStats.totalSpent.toLocaleString('ar-EG')} ج.م</span>
                  <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-0.5 mt-0.5">
                    <TrendingDown className="h-3 w-3 inline" /> صيانة وتشغيل
                  </span>
                </div>

              </div>

              {/* Trip Revenues Card */}
              <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] sm:text-xs font-bold text-[#2B6CB0]">أرباح المشاوير</span>
                  <span className="text-xl font-black text-[#1A365D]">{salesStats.totalTripsCollectedProfit.toLocaleString('ar-EG')} ج.م</span>
                  <span className="text-[10px] text-gray-400 font-bold">تضاف لصافي الأرباح</span>
                </div>
                <div className="bg-indigo-50 p-2.5 rounded-2xl text-[#1A365D]">
                  <MapPin className="h-6 w-6 animate-bounce" />
                </div>
              </div>

              {/* Enhanced Summary Footer (Relocated under Trips card and made interactive!) */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className={`p-4 rounded-2xl border shadow-sm flex flex-col gap-1 items-center text-center ${salesStats.netProfit >= 0 ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-emerald-500' : 'bg-rose-50 border-rose-150 text-rose-800'}`}>
                  <span className="text-xs font-bold text-slate-500">صافي الربح الفعلي (النقدية)</span>
                  <span className="text-xl font-black text-emerald-600">{salesStats.netProfit.toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span></span>
                </div>
                <div 
                  onClick={() => setShowDebtorsModal(true)}
                  className="bg-[#FFFFFF] p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1 items-center text-center text-indigo-900 justify-center select-none cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all active:scale-95 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-8 h-8 opacity-10"><AlertCircle className="w-8 h-8" /></div>
                  <span className="text-xs font-bold text-slate-500">المتبقي المطلوب تحصيله</span>
                  <span className="text-xl font-black text-rose-600">{salesStats.totalRemaining.toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span></span>
                  <span className="text-[9px] text-[#2B6CB0] font-black mt-1">اضغط للتسديد والعملاء المدينين 🔍</span>
                </div>
              </div>

              {/* Total Balance / Net Profit */}
              <div className={`rounded-2xl p-5 text-white shadow-md flex items-center justify-between relative overflow-hidden ${
                salesStats.netProfit >= 0 ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm' : 'bg-rose-600'
              }`}>
                <div className="flex flex-col gap-0.5 z-10">
                  <span className="text-xs text-white/90 font-bold">صافي الأرباح</span>
                  <span className="text-3xl font-black">
                    {salesStats.netProfit.toLocaleString('ar-EG')} <span className="text-xs font-bold">ج.م</span>
                  </span>
                </div>
                
                <div className="bg-[#FFFFFF]/15 p-2.5 rounded-2xl z-10">
                  {salesStats.netProfit >= 0 ? <TrendingUp className="h-10 w-10 text-white" /> : <TrendingDown className="h-10 w-10 text-white" />}
                </div>
                <div className="absolute -right-6 -bottom-6 h-24 w-24 bg-[#FFFFFF]/5 rounded-full blur-xl pointer-events-none"></div>
              </div>

              {/* Monthly Reports Table */}
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <h3 className="font-bold text-[#1A365D] text-sm border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Clock className="h-4.5 w-4.5 text-[#2B6CB0]" />
                  تحليل شهري
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
                    <span className="text-sm font-black text-emerald-700">{formatNum(selectedInvoice.paidAmount !== undefined ? selectedInvoice.paidAmount : selectedInvoice.totalAfterDiscount)} ج.م</span>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-2 border border-indigo-100 flex flex-col">
                    <span className="text-[10px] font-bold text-indigo-800 opacity-80">صافي الربح الفعلي</span>
                    <span className="text-sm font-black text-indigo-700">{formatNum(invoiceProfit)} ج.م</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 mt-1 border-slate-100 max-h-40 overflow-y-auto">
                  <span className="text-[10px] font-bold text-slate-400 mb-1">تفاصيل البضاعة المباعة:</span>
                  {selectedInvoice.items.map((it, i) => (
                    <div key={i} className="flex justify-between items-center bg-[#F7FAFC] border border-slate-100 p-2 rounded-lg">
                       <div className="flex flex-col">
                        <span className="font-bold text-xs text-[#1A365D]">{products.find(p => p.id === it.productId)?.name || 'منتج محذوف'}</span>
                        <span className="text-[10px] text-slate-500">{it.quantity} عبوة × {it.finalPrice} ج.م</span>
                      </div>
                      <span className="text-xs font-black text-[#DD6B20]">+ {formatNum((it.finalPrice - (it.factoryPrice || it.originalPrice * 0.9)) * it.quantity)} ج</span>
                    </div>
                  ))}
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

        {activeSubTab === "areas" && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Control Panel: Date and Area Filters */}
            <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <h3 className="font-bold text-[#1A365D] text-sm border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Filter className="h-4.5 w-4.5 text-[#2B6CB0]" />
                تحديد نطاق المتابعة والمكافآت
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
                            {c.area} • مسحوبات: <strong className="text-[#1A365D]">{formatNum(c.totalPurchases)} ج.م</strong>
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
                                  {formatNum(inv.totalAfterDiscount)} ج.م
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
                  {salesStats.totalRemaining.toLocaleString('ar-EG')} ج.م
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
                            {formatNum(totalDebt)} ج.م
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
                                      const partialInput = prompt(`ما هو المبلغ المسدد الآن للفاتورة #${inv.invoiceNumber}؟ (المبلغ المتبقي: ${formatNum(remaining)} ج.م)`);
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
                                      if (confirm(`هل أنت متأكد من سداد الفاتورة #${inv.invoiceNumber} بالكامل بقيمة ${formatNum(remaining)} ج.م؟`)) {
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
    </div>
  );
}
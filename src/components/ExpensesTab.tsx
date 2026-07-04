// @ts-nocheck
import { confirmDialog } from '../utils/confirm';
import { COMPACT_PRO_CSS } from '../utils/reportStyles';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Expense } from '../types';
import { Wallet, Plus, Trash2, ArrowRight, HelpCircle, BadgeAlert, Printer, Download, Image } from 'lucide-react';

interface FinancialSummary {
  totalInvoiceAmount: number;
  totalPaidAmount: number;
  totalLoadCost: number;
  totalExpenseAmount: number;
  totalRevenueAmount: number;
  totalTripAmount: number;
  factorySoldCost: number;
}

interface ExpensesTabProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onGoBack: () => void;
  initialSubTab?: 'expense' | 'revenue';
  summaryData?: FinancialSummary;
}

const EXPENSE_CATEGORIES = ['وقود السيارة', 'غيار زيت', 'قهوة', 'شاي', 'صيانة', 'غسيل سيارة', 'طعام', 'رسوم عبور (كارتات)', 'غير ذلك'];

const parseExpenseDescription = (desc: string | undefined): string => {
  if (!desc) return '';
  if (desc.startsWith('{')) {
    try {
      const parsed = JSON.parse(desc);
      return parsed.notes || parsed.description || '';
    } catch { return desc; }
  }
  return desc;
};

const isWithinPeriod = (dateString: string, periodFilter: string, selectedWeekDays: number[]): boolean => {
  if (!dateString || typeof dateString !== 'string') return false;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return false;
  const now = new Date();

  if (periodFilter === 'all') return true;
  if (periodFilter === 'today') return d.toDateString() === now.toDateString();
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
  return true;
};

export default function ExpensesTab({ expenses, onAddExpense, onDeleteExpense, onGoBack, initialSubTab, summaryData }: ExpensesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'expense' | 'revenue'>(initialSubTab || 'expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeSubTab]);
  const getLocalDateString = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().substring(0, 16);
  };

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(getLocalDateString());

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount) || 0;
    const isDescriptionRequired = category === 'غير ذلك';
    if (amountNum <= 0 || (isDescriptionRequired && !description.trim())) return;

    const actionName = activeSubTab === 'expense' ? 'مصروف' : 'إيراد';
    const msg = `تأكيد حفظ ${actionName}:\n\nالمبلغ: ${amountNum}ج.م\nالوصف: ${description.trim() || '(بدون بيان)'}${activeSubTab === 'expense' ? `\nالفئة: ${category}` : ''}\n\nهل تريد المتابعة وحفظ السجل؟`;

    if (!(await confirmDialog(msg))) {
      return;
    }

    onAddExpense({
      amount: amountNum,
      description: description.trim(),
      category: activeSubTab === 'expense' ? category : 'إيراد إضافي',
      date: new Date(date).toISOString(),
      type: activeSubTab
    });

    setAmount('');
    setDescription('');
    setCategory(EXPENSE_CATEGORIES[0]);
    setDate(getLocalDateString());
  };

  const currentRecords = React.useMemo(() => {
    return expenses
      .filter(e => (e.type || 'expense') === activeSubTab)
      .filter(e => e.category !== 'سداد للمصنع' && e.type !== 'factory_payment')
      .filter(e => isWithinPeriod(e.date, periodFilter, selectedWeekDays))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, activeSubTab, periodFilter, selectedWeekDays]);

  const totalCurrent = React.useMemo(() => {
    return currentRecords.reduce((sum, e) => sum + e.amount, 0);
  }, [currentRecords]);

  const avgAmount = React.useMemo(() => {
    return currentRecords.length > 0 ? totalCurrent / currentRecords.length : 0;
  }, [currentRecords, totalCurrent]);

  const isExpense = activeSubTab === 'expense';
  const title = isExpense ? 'المصروفات' : 'الإيرادات';

  const periodLabel = periodFilter === 'all' ? 'الكل' : periodFilter === 'today' ? 'يومي' : periodFilter === 'week' ? 'أسبوعي' : 'شهري';

  const printFinancialReportHTMLDirectly = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-1000px';
    iframe.style.left = '-1000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const formattedDate = new Date().toLocaleDateString('ar-EG', { dateStyle: 'long' });

    const storedSetStr = localStorage.getItem('app_settings_sys');
    let invoiceAppName = 'سمن وزيت سوفانا الفاخر';
    if (storedSetStr) {
      try {
        const parsed = JSON.parse(storedSetStr);
        if (parsed.appName) invoiceAppName = parsed.appName;
      } catch (e) {
        console.error(e);
      }
    }

    const catTotals: Record<string, number> = {};
    currentRecords.forEach(e => {
      const cat = e.category || 'أخرى';
      catTotals[cat] = (catTotals[cat] || 0) + e.amount;
    });

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>${COMPACT_PRO_CSS}</head>
      <body>
        <div class="rh">
          <h1>تقرير ${title} بالتفصيل</h1>
          <div class="sub">${invoiceAppName}</div>
          <div class="ref">
            <span>الفترة: ${periodLabel}</span>
            <span>${formattedDate}</span>
          </div>
        </div>

        <div class="sg">
          <div class="sb bl">
            <div class="l">عدد السجلات</div>
            <div class="v">${currentRecords.length} <span style="font-size:10px">سجل</span></div>
          </div>
          <div class="sb rd">
            <div class="l">الإجمالي</div>
            <div class="v">${totalCurrent.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
          <div class="sb gr">
            <div class="l">المتوسط</div>
            <div class="v">${avgAmount.toLocaleString('ar-EG')} <span style="font-size:10px">ج.م</span></div>
          </div>
        </div>

        <div class="st"><span class="i">1</span> تفاصيل السجلات (${currentRecords.length} مستند)</div>
        <table>
          <thead>
            <tr>
              <th width="30">م</th>
              <th>البيان</th>
              ${isExpense ? '<th>الفئة</th>' : ''}
              <th>المبلغ</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            ${currentRecords.length === 0 ? `<tr><td colspan="${isExpense ? 5 : 4}" style="text-align:center; color:#94a3b8; padding:20px;">لا توجد أي سجلات حالياً.</td></tr>` :
              currentRecords.map((item, idx) => `
                <tr>
                  <td style="text-align:center;font-weight:700;color:#94a3b8">${idx + 1}</td>
                  <td><b style="color:#1e3a5f">${parseExpenseDescription(item.description) || '(بدون بيان)'}</b></td>
                  ${isExpense ? `<td><span class="bd-b">${item.category}</span></td>` : ''}
                  <td style="text-align:center;font-weight:800;color:#1e3a5f;font-family:'Tajawal',monospace">${item.amount.toLocaleString('ar-EG')}</td>
                  <td style="font-size:9px">${new Date(item.date).toLocaleString('ar-EG')}</td>
                </tr>
              `).join('')}
            <tr class="ts">
              <td colspan="${isExpense ? 2 : 1}" style="text-align:right">الإجمالي</td>
              ${isExpense ? '<td></td>' : ''}
              <td style="text-align:center;font-size:12px">${totalCurrent.toLocaleString('ar-EG')} ج.م</td>
              <td style="text-align:center">${currentRecords.length} سجل</td>
            </tr>
          </tbody>
        </table>

        ${isExpense && Object.keys(catTotals).length > 0 ? `
        <div class="st"><span class="i">2</span> الملخص حسب الفئة</div>
        <table>
          <thead>
            <tr>
              <th width="30">م</th>
              <th>الفئة</th>
              <th>الإجمالي</th>
              <th>النسبة</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, total], idx) => `
              <tr>
                <td style="text-align:center;font-weight:700;color:#94a3b8">${idx + 1}</td>
                <td><span class="bd-b">${cat}</span></td>
                <td style="text-align:center;font-weight:800;font-family:'Tajawal',monospace">${total.toLocaleString('ar-EG')} ج.م</td>
                <td style="text-align:center;font-weight:700;color:#1e3a5f">${totalCurrent > 0 ? ((total / totalCurrent) * 100).toFixed(1) : 0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        <div class="fs">
          <div class="sb2"><div class="ti">التوقيع والاعتماد النهائي</div><div class="ln">التوقيع</div></div>
          <div class="sb2"><div class="ti">إعداد المسؤول الحسابي</div><div class="ln">التوقيع</div></div>
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
    }, 500);
  };

  const downloadExpensesImage = () => {
    const catTotals: Record<string, number> = {};
    currentRecords.forEach(e => {
      const cat = e.category || 'أخرى';
      catTotals[cat] = (catTotals[cat] || 0) + e.amount;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    const rowH = 38;
    const headerH = 100;
    const summaryCardH = 80;
    const catSummaryH = isExpense && Object.keys(catTotals).length > 0 ? 60 + Object.keys(catTotals).length * 36 : 0;
    const totalH = headerH + 30 + summaryCardH + 30 + currentRecords.length * rowH + 60 + catSummaryH + 80;
    canvas.height = totalH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const formatNum = (n: number) => n.toLocaleString('ar-EG');

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#1e2a4a');
    grad.addColorStop(1, '#2b3a5c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, headerH);

    ctx.fillStyle = '#d4a843';
    ctx.fillRect(0, headerH, canvas.width, 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`تقرير ${title} بالتفصيل`, canvas.width - 40, 40);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#d4a843';
    ctx.fillText(`الفترة: ${periodLabel}`, canvas.width - 40, 62);

    ctx.fillStyle = '#0d7c5f';
    ctx.beginPath();
    ctx.roundRect(canvas.width - 200, 20, 160, 50, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${currentRecords.length} سجل`, canvas.width - 120, 52);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillText(`تصدير: ${new Date().toLocaleDateString('ar-EG')}`, 40, 40);

    let y = headerH + 20;

    const cardW = (canvas.width - 80) / 3;
    const cards = [
      { label: 'عدد السجلات', value: `${currentRecords.length} سجل`, color: '#eff6ff', textColor: '#1e40af' },
      { label: 'الإجمالي', value: `${formatNum(totalCurrent)} ج.م`, color: '#fff5f5', textColor: '#dc2626' },
      { label: 'المتوسط', value: `${formatNum(avgAmount)} ج.م`, color: '#f0fdf4', textColor: '#16a34a' }
    ];
    cards.forEach((card, i) => {
      const cx = 30 + i * (cardW + 10);
      ctx.fillStyle = card.color;
      ctx.beginPath();
      ctx.roundRect(cx, y, cardW, summaryCardH, 10);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.label, cx + cardW / 2, y + 28);
      ctx.fillStyle = card.textColor;
      ctx.font = '900 16px system-ui, sans-serif';
      ctx.fillText(card.value, cx + cardW / 2, y + 55);
    });
    y += summaryCardH + 20;

    const tableX = 30;
    const tableW = canvas.width - 60;
    const cols = isExpense
      ? [tableX, tableX + 50, tableX + 250, tableX + 450, tableX + 600]
      : [tableX, tableX + 50, tableX + 350, tableX + 600];
    const headers = isExpense
      ? ['م', 'البيان', 'الفئة', 'المبلغ', 'التاريخ']
      : ['م', 'البيان', 'المبلغ', 'التاريخ'];

    ctx.fillStyle = '#1e2a4a';
    ctx.fillRect(tableX, y, tableW, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    headers.forEach((h, i) => {
      ctx.textAlign = i === 0 ? 'center' : 'right';
      ctx.fillText(h, cols[i] + (i === 0 ? 20 : 10), y + 22);
    });
    y += 32;

    currentRecords.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(tableX, y, tableW, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(tableX, y, tableW, rowH);

      ctx.fillStyle = '#4a5568';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1), cols[0] + 20, y + 24);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1e2a4a';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText(parseExpenseDescription(item.description) || '(بدون بيان)', cols[1] + 10, y + 24);

      let amountColIdx = 2;
      if (isExpense) {
        ctx.fillStyle = '#1e40af';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.fillText(item.category, cols[2] + 10, y + 24);
        amountColIdx = 3;
      }

      ctx.fillStyle = '#1e2a4a';
      ctx.font = '900 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${formatNum(item.amount)} ج.م`, cols[amountColIdx] + 10, y + 24);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(new Date(item.date).toLocaleDateString('ar-EG'), cols[amountColIdx + 1] + 10, y + 24);

      y += rowH;
    });

    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(tableX, y, tableW, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`الإجمالي: ${formatNum(totalCurrent)} ج.م`, tableX + tableW - 20, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${currentRecords.length} سجل`, tableX + tableW / 2, y + 24);
    y += 50;

    if (isExpense && Object.keys(catTotals).length > 0) {
      ctx.fillStyle = '#1e2a4a';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('الملخص حسب الفئة', tableX + tableW - 10, y + 16);
      y += 30;

      ctx.fillStyle = '#1e2a4a';
      ctx.fillRect(tableX, y, tableW, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('م', tableX + 25, y + 20);
      ctx.textAlign = 'right';
      ctx.fillText('الفئة', tableX + 80, y + 20);
      ctx.fillText('الإجمالي', tableX + tableW / 2, y + 20);
      ctx.textAlign = 'left';
      ctx.fillText('النسبة', tableX + tableW - 40, y + 20);
      y += 30;

      Object.entries(catTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, total], idx) => {
        ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        ctx.fillRect(tableX, y, tableW, 34);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(tableX, y, tableW, 34);

        ctx.fillStyle = '#4a5568';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1), tableX + 25, y + 22);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#1e40af';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillText(cat, tableX + 80, y + 22);
        ctx.fillStyle = '#1e2a4a';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.fillText(`${formatNum(total)} ج.م`, tableX + tableW / 2, y + 22);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${totalCurrent > 0 ? ((total / totalCurrent) * 100).toFixed(1) : 0}%`, tableX + tableW - 40, y + 22);

        y += 34;
      });
    }

    y += 20;
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(canvas.width - 30, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, canvas.width / 2, y);

    const link = document.createElement('a');
    link.download = `تقرير_${title}_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 text-right animate-fade-in" dir="rtl" id="expenses-tab-container">
      {/* Header */}
      <div className={`text-white px-4 py-4 sticky top-0 z-10 flex items-center justify-between ${isExpense ? 'bg-[#1A365D]' : 'bg-[#DD6B20]'}`}>
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-white/80" />
          <h1 className="text-xl font-bold">الماليات</h1>
        </div>
        <button
          onClick={onGoBack}
          className="bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 text-white rounded-lg py-1.5 px-3.5 text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>الرئيسية</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-xl mx-auto p-4 flex flex-col gap-5">

        {summaryData && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-l from-[#1A365D] to-[#2B6CB0] text-white px-4 py-3">
              <h3 className="text-xs font-black">ملخص المالية</h3>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100">
                <span className="text-emerald-600 font-bold block">المحصل</span>
                <span className="text-emerald-800 font-black text-sm">{summaryData.totalPaidAmount.toLocaleString()} ج</span>
              </div>
              <div className="bg-sky-50 rounded-xl p-2.5 border border-sky-100">
                <span className="text-sky-600 font-bold block">المبيعات</span>
                <span className="text-sky-800 font-black text-sm">{summaryData.totalInvoiceAmount.toLocaleString()} ج</span>
              </div>
              <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100">
                <span className="text-amber-600 font-bold block">المديونية</span>
                <span className="text-amber-800 font-black text-sm">{(summaryData.totalInvoiceAmount - summaryData.totalPaidAmount).toLocaleString()} ج</span>
              </div>
              <div className="bg-indigo-50 rounded-xl p-2.5 border border-indigo-100">
                <span className="text-indigo-600 font-bold block">هامش الربح</span>
                <span className="text-indigo-800 font-black text-sm">
                  {(() => {
                    const profit = summaryData.totalInvoiceAmount + summaryData.totalRevenueAmount + summaryData.totalTripAmount - summaryData.factorySoldCost - summaryData.totalExpenseAmount;
                    const pct = summaryData.totalInvoiceAmount > 0 ? (profit / summaryData.totalInvoiceAmount * 100) : 0;
                    return `${profit.toLocaleString()} ج (${pct.toFixed(1)}%)`;
                  })()}
                </span>
              </div>
              <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-100">
                <span className="text-rose-600 font-bold block">المصروفات</span>
                <span className="text-rose-800 font-black text-sm">{summaryData.totalExpenseAmount.toLocaleString()} ج</span>
              </div>
              <div className="bg-teal-50 rounded-xl p-2.5 border border-teal-100">
                <span className="text-teal-600 font-bold block">الإيرادات</span>
                <span className="text-teal-800 font-black text-sm">{summaryData.totalRevenueAmount.toLocaleString()} ج</span>
              </div>
            </div>
          </div>
        )}

        {/* Subtabs toggle */}
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('expense')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${isExpense ? 'bg-[#FFFFFF] shadow-sm text-[#1A365D]' : 'text-[#9CA3AF]'}`}
          >
            المصروفات
          </button>
          <button
            onClick={() => setActiveSubTab('revenue')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${!isExpense ? 'bg-[#FFFFFF] shadow-sm text-[#DD6B20]' : 'text-[#9CA3AF]'}`}
          >
            الإيرادات الإضافية
          </button>
        </div>

        {/* Total Stat widget */}
        <div className={`${isExpense ? 'bg-[#1A365D] text-white' : 'bg-[#DD6B20] text-white'} rounded-2xl p-5 shadow flex justify-between items-center relative overflow-hidden`}>
          <div className="flex flex-col gap-1.5 z-10">
            <span className="text-white/80 text-xs font-bold">إجمالي {title} — {periodLabel}</span>
            <span className="text-3xl font-black">{totalCurrent.toLocaleString('ar-EG')} <span className="text-white/70 text-base font-bold">ج.م</span></span>
            <span className="text-white/60 text-[11px] font-semibold">{currentRecords.length} سجل | متوسط: {avgAmount.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div className="p-3 bg-[#FFFFFF]/15 rounded-2xl z-10">
            <Wallet className="h-10 w-10 text-white" />
          </div>
          <div className="absolute -bottom-6 -right-6 h-28 w-28 bg-[#FFFFFF]/5 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Add Form */}
        <form onSubmit={handleAddSubmit} className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-150 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-[#1A365D] text-base flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <Plus className={`h-5 w-5 ${isExpense ? 'text-[#1A365D]' : 'text-[#DD6B20]'}`} />
            إضافة {isExpense ? 'مصروف' : 'إيراد'}
          </h3>

          <div className="grid grid-cols-1 gap-3">
            <div className={`grid ${isExpense ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              <div>
                <label className="block text-xs font-bold text-[#2B6CB0] mb-1">المبلغ</label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.01"
                  placeholder="المبلغ نقداً"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {isExpense && (
                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">الفئة</label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2B6CB0] mb-1">التاريخ</label>
              <input
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2B6CB0] mb-1">الوصف / البيان</label>
              <input
                type="text"
                required={category === 'غير ذلك'}
                placeholder={isExpense ? "مثال: غيار زيت للسيارة" : "مثال: مكافأة أو عمولة توصيل إضافية"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className={`w-full text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-1 ${isExpense ? 'bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent' : 'bg-[#DD6B20] text-white hover:bg-[#C05621]'}`}
          >
            <span>حفظ الـ{isExpense ? 'مصروف' : 'إيراد'}</span>
          </button>
        </form>

        {/* List */}
        <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-150 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
            <h3 className="font-bold text-[#1A365D] text-base">سجل {title}</h3>
            {currentRecords.length > 0 && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={printFinancialReportHTMLDirectly}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] py-1.5 px-3 rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer border-none"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>طباعة PDF</span>
                </button>
                <button
                  type="button"
                  onClick={downloadExpensesImage}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] py-1.5 px-3 rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer border-none"
                >
                  <Image className="h-3.5 w-3.5" />
                  <span>تنزيل صورة</span>
                </button>
              </div>
            )}
          </div>

          {/* Period Filter */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: 'all', label: 'الكل' },
                { key: 'today', label: 'يومي' },
                { key: 'week', label: 'أسبوعي' },
                { key: 'month', label: 'شهري' }
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setPeriodFilter(f.key)}
                  className={`py-1 px-3.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer shrink-0 border ${periodFilter === f.key ? 'bg-indigo-100 text-[#1A365D] border-indigo-200 shadow-sm' : 'bg-[#F7FAFC] text-[#2B6CB0] border-slate-200 hover:bg-[#F7FAFC]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {periodFilter === 'week' && (
              <div className="flex flex-wrap gap-1.5 animate-fade-in">
                {(['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] as const).map((dayName, idx) => {
                  const isSelected = selectedWeekDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedWeekDays(prev =>
                          isSelected ? prev.filter(d => d !== idx) : [...prev, idx]
                        );
                      }}
                      className={`py-1 px-2.5 rounded-lg text-[10px] font-black transition-all cursor-pointer border ${isSelected ? 'bg-indigo-500 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}
                    >
                      {dayName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {currentRecords.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">لم تسجل أي {title} في هذه الفترة.</p>
            ) : (
              currentRecords.map(item => (
                <div key={item.id} className="border border-slate-150 rounded-xl p-3.5 bg-[#F7FAFC]/50 flex items-center justify-between gap-3 shadow-inner hover:bg-[#F7FAFC] transition-colors">
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-bold text-[#1A365D]">{parseExpenseDescription(item.description) || '(بدون بيان)'}</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#2B6CB0] mt-1.5 font-medium">
                      {isExpense && <span className="bg-indigo-50 text-[#1A365D] px-2 py-0.5 rounded-md font-semibold">{item.category}</span>}
                      {isExpense && <span>•</span>}
                      <span>المبلغ: <strong className={`${isExpense ? 'text-[#1A365D]' : 'text-[#9CA3AF]'} font-extrabold`}>{item.amount}ج.م</strong></span>
                      <span>•</span>
                      <span>{new Date(item.date).toLocaleString('ar-EG')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onDeleteExpense(item.id);
                    }}
                    className="p-1 px-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="حذف السجل"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

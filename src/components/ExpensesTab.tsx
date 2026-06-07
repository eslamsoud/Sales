// @ts-nocheck
import { confirmDialog } from '../utils/confirm';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Expense } from '../types';
import { Wallet, Plus, Trash2, ArrowRight, HelpCircle, BadgeAlert, Printer } from 'lucide-react';

interface ExpensesTabProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onGoBack: () => void;
}

const EXPENSE_CATEGORIES = ['وقود ومركبة', 'طعام وضيافة', 'أعطال وصيانة', 'رسوم ومصاريف نثرية', 'عمولات وهدايا', 'أخرى'];

export default function ExpensesTab({ expenses, onAddExpense, onDeleteExpense, onGoBack }: ExpensesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'expense' | 'revenue'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeSubTab]);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().substring(0, 16));

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0 || !description.trim()) return;

    const actionName = activeSubTab === 'expense' ? 'مصروف' : 'إيراد';
    const msg = `تأكيد حفظ ${actionName}:\n\nالمبلغ: ${amountNum}ج.م\nالوصف: ${description.trim()}${activeSubTab === 'expense' ? `\nالفئة: ${category}` : ''}\n\nهل تريد المتابعة وحفظ السجل؟`;

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
    setDate(new Date().toISOString().substring(0, 16));
  };

  const currentRecords = React.useMemo(() => {
    return expenses.filter(e => (e.type || 'expense') === activeSubTab).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, activeSubTab]);

  const totalCurrent = React.useMemo(() => {
    return currentRecords.reduce((sum, e) => sum + e.amount, 0);
  }, [currentRecords]);

  const isExpense = activeSubTab === 'expense';
  const title = isExpense ? 'المصروفات' : 'الإيرادات';

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

    // Retrieve settings if available
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

    doc.open();
    doc.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>تقرير ${title} المالي</title>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
              body { margin: 0; }
            }
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; line-height: 1.5; padding: 20px; text-align: right; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 3px double ${isExpense ? '#1e3a8a' : '#dd6b20'}; padding-bottom: 12px; }
            .header h1 { color: ${isExpense ? '#1e3a8a' : '#dd6b20'}; margin: 0 0 5px 0; font-size: 24px; font-weight: 900; text-align: center; }
            .header p { margin: 0; color: #64748b; font-size: 13px; font-weight: bold; text-align: center; }
            
            .meta-box { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 11px; color: #334155; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
            
            h2 { font-size: 13px; color: ${isExpense ? '#1e3a8a' : '#dd6b20'}; margin: 25px 0 10px 0; border-right: 4px solid #dd6b20; padding-right: 8px; font-weight: bold; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; text-align: right; }
            th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; }
            th { background: #f1f5f9; color: #334155; font-weight: 900; }
            
            .footer-notes { margin-top: 50px; border-top: 1px solid #cbd5e1; padding-top: 15px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير ${title} بالتفصيل</h1>
            <p>${invoiceAppName}</p>
          </div>
          
          <div class="meta-box">
            <div>تاريخ الاستخراج والطباعة: ${formattedDate}</div>
            <div>إجمالي بند ${title}: <span style="font-weight: 900; color: ${isExpense ? '#1e3a8a' : '#dd6b20'};">${totalCurrent.toLocaleString('ar-EG')} ج.م</span></div>
          </div>
          
          <h2>البيانات والبنود المسجلة (${currentRecords.length} مستند)</h2>
          <table>
            <thead>
              <tr>
                <th width="40">م</th>
                <th>بيان البند والوصف</th>
                <th>المبلغ تفصيلاً</th>
                ${isExpense ? '<th>تصنيف وفئة المصروف</th>' : ''}
                <th>تاريخ الفعالية والجيل</th>
              </tr>
            </thead>
            <tbody>
              ${currentRecords.length === 0 ? `<tr><td colspan="${isExpense ? 5 : 4}" style="text-align:center; color:#94a3b8;">لا توجد أي سجلات حالياً في هذا القسم.</td></tr>` : 
                currentRecords.map((item, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><b>${item.description}</b></td>
                    <td><b>${item.amount.toLocaleString('ar-EG')} ج.م</b></td>
                    ${isExpense ? `<td><span style="background:#eff6ff; color:#1e40af; padding: 2px 6px; border-radius: 4px; font-weight:bold;">${item.category}</span></td>` : ''}
                    <td>${new Date(item.date).toLocaleString('ar-EG')}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
          
          <div class="footer-notes">
            <div>إعداد المسؤول الحسابي المعتمد: ............................</div>
            <div>التوقيع والاعتماد النهائي: ............................</div>
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
            <span className="text-white/80 text-xs font-bold">إجمالي {title}</span>
            <span className="text-3xl font-black">{totalCurrent.toLocaleString('ar-EG')} <span className="text-white/70 text-base font-bold">ج.م</span></span>
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
                required
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
              <button
                type="button"
                onClick={printFinancialReportHTMLDirectly}
                className="bg-indigo-600 hover:bg-indigo-700 text-[#ffffff] font-extrabold text-[11px] py-1.5 px-3 rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer border-none"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>طباعة التقرير بالكامل ({title}) 🖨️</span>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {currentRecords.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">لم تسجل أي {title} حتى الآن.</p>
            ) : (
              currentRecords.map(item => (
                <div key={item.id} className="border border-slate-150 rounded-xl p-3.5 bg-[#F7FAFC]/50 flex items-center justify-between gap-3 shadow-inner hover:bg-[#F7FAFC] transition-colors">
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-bold text-[#1A365D]">{item.description}</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#2B6CB0] mt-1.5 font-medium">
                      {isExpense && <span className="bg-indigo-50 text-[#1A365D] px-2 py-0.5 rounded-md font-semibold">{item.category}</span>}
                      {isExpense && <span>•</span>}
                      <span>المبلغ: <strong className={`${isExpense ? 'text-[#1A365D]' : 'text-[#9CA3AF]'} font-extrabold`}>{item.amount}ج.م</strong></span>
                      <span>•</span>
                      <span>{new Date(item.date).toLocaleString('ar-EG')}</span>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (await confirmDialog(`هل أنت متأكد من حذف الـ${isExpense ? 'مصروف' : 'إيراد'}؟`)) {
                        onDeleteExpense(item.id);
                      }
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

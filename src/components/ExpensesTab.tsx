import { confirmDialog } from '../utils/confirm';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Expense } from '../types';
import { Wallet, Plus, Trash2, ArrowRight, HelpCircle, BadgeAlert } from 'lucide-react';

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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0 || !description.trim()) return;

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

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12" id="expenses-tab-container">
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
          <h3 className="font-bold text-[#1A365D] text-base border-b border-slate-100 pb-3">سجل {title}</h3>

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
                      <span>المبلغ: <strong className={`${isExpense ? 'text-[#1A365D]' : 'text-[#9CA3AF]'} font-extrabold`}>{item.amount} ج.م</strong></span>
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

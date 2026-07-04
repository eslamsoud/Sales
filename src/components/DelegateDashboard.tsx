// @ts-nocheck
import React from 'react';
import { FactoryLoad, Invoice, Expense, Trip, UserAuth } from '../types';
import { Package, Receipt, Wallet, MapPin, Users, ArrowRight, X, Clock, DollarSign } from 'lucide-react';

interface DelegateDashboardProps {
  delegate: UserAuth;
  factoryLoads: FactoryLoad[];
  invoices: Invoice[];
  expenses: Expense[];
  trips: Trip[];
  onNavigate: (tab: string) => void;
  onExit: () => void;
  onViewLoads: () => void;
  onViewInvoices: () => void;
  onViewExpenses: () => void;
  onViewTrips: () => void;
  onViewCustomers: () => void;
}

interface TimelineItem {
  id: string;
  date: string;
  type: 'load' | 'invoice' | 'expense' | 'trip';
  description: string;
  amount?: number;
}

export default function DelegateDashboard({
  delegate, factoryLoads, invoices, expenses, trips,
  onNavigate, onExit, onViewLoads, onViewInvoices, onViewExpenses, onViewTrips, onViewCustomers
}: DelegateDashboardProps) {
  const uniqueCustomers = React.useMemo(() => {
    const names = new Set(invoices.map(i => i.customerName).filter(Boolean));
    return names.size;
  }, [invoices]);

  const totalInvoiceAmount = React.useMemo(() =>
    invoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount || 0), 0), [invoices]);

  const totalPaidAmount = React.useMemo(() =>
    invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0), [invoices]);

  const totalExpenseAmount = React.useMemo(() =>
    expenses.filter(e => e.type !== 'revenue').reduce((sum, exp) => sum + (exp.amount || 0), 0), [expenses]);

  const totalRevenueAmount = React.useMemo(() =>
    expenses.filter(e => e.type === 'revenue').reduce((sum, exp) => sum + (exp.amount || 0), 0), [expenses]);

  const totalTripAmount = React.useMemo(() =>
    trips.reduce((sum, t) => sum + (t.price || 0), 0), [trips]);

  const totalLoadCost = React.useMemo(() =>
    factoryLoads.reduce((sum, load) => {
      const pieceCost = (load.unitPrice || 0) * (load.quantity || 0);
      const cartonCost = (load.cartonPrice || 0) * (load.cartonsCount || 0);
      return sum + pieceCost + cartonCost;
    }, 0), [factoryLoads]);

  const profitMargin = React.useMemo(() =>
    totalInvoiceAmount - totalLoadCost, [totalInvoiceAmount, totalLoadCost]);

  const profitPercent = React.useMemo(() =>
    totalInvoiceAmount > 0 ? (profitMargin / totalInvoiceAmount) * 100 : 0, [profitMargin, totalInvoiceAmount]);

  const [timelineTypeFilter, setTimelineTypeFilter] = React.useState<'all' | 'invoice' | 'load' | 'expense' | 'trip'>('all');
  const [timelinePeriod, setTimelinePeriod] = React.useState<'all' | 'today' | 'week' | 'month'>('all');

  const timelineItems: TimelineItem[] = React.useMemo(() => {
    const items: TimelineItem[] = [];
    factoryLoads.forEach(l => {
      items.push({
        id: 'load-' + l.id,
        date: l.date,
        type: 'load',
        description: `تحميل ${l.quantity || 0} عبوة من ${l.productName || 'منتج'}`,
        amount: l.advanceAmount
      });
    });
    invoices.forEach(inv => {
      items.push({
        id: 'inv-' + inv.id,
        date: inv.date,
        type: 'invoice',
        description: `فاتورة #${inv.invoiceNumber} - ${inv.customerName || 'عميل'}`,
        amount: inv.totalAfterDiscount
      });
    });
    expenses.forEach(exp => {
      items.push({
        id: 'exp-' + exp.id,
        date: exp.date,
        type: exp.type === 'revenue' ? 'expense' : 'expense',
        description: `${exp.type === 'revenue' ? 'إيراد' : 'مصروف'}: ${exp.description}`,
        amount: exp.amount
      });
    });
    trips.forEach(t => {
      items.push({
        id: 'trip-' + t.id,
        date: t.date,
        type: 'trip',
        description: `مشوار: ${t.description}${t.collected ? ' (محصل)' : ' (معلق)'}`,
        amount: t.price
      });
    });
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [factoryLoads, invoices, expenses, trips]);

  const filteredTimeline = React.useMemo(() => {
    let items = timelineItems;
    if (timelineTypeFilter !== 'all') {
      items = items.filter(item => item.type === timelineTypeFilter);
    }
    if (timelinePeriod !== 'all') {
      const now = new Date();
      let cutoff: Date;
      if (timelinePeriod === 'today') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (timelinePeriod === 'week') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      items = items.filter(item => new Date(item.date).getTime() >= cutoff.getTime());
    }
    return items;
  }, [timelineItems, timelineTypeFilter, timelinePeriod]);

  const recentItems = filteredTimeline.slice(0, 20);

  const cardData = [
    { label: 'الحمولة', icon: Package, value: `${factoryLoads.length} تحميلة`, color: 'bg-indigo-50 border-indigo-200 text-indigo-800', onClick: onViewLoads },
    { label: 'الفواتير', icon: Receipt, value: `${invoices.length} فاتورة - ${totalInvoiceAmount.toLocaleString()} ج`, color: 'bg-emerald-50 border-emerald-200 text-emerald-800', onClick: onViewInvoices },
    { label: 'المالية', icon: Wallet, value: `محصل ${totalPaidAmount.toLocaleString()} ج - ربح ${profitMargin.toLocaleString()} ج`, color: 'bg-amber-50 border-amber-200 text-amber-800', onClick: onViewExpenses },
    { label: 'المشاوير', icon: MapPin, value: `${trips.length} مشوار - ${totalTripAmount.toLocaleString()} ج`, color: 'bg-rose-50 border-rose-200 text-rose-800', onClick: onViewTrips },
    { label: 'العملاء', icon: Users, value: `${uniqueCustomers} عميل`, color: 'bg-cyan-50 border-cyan-200 text-cyan-800', onClick: onViewCustomers },
  ];

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'load': return { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: '📦' };
      case 'invoice': return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '🧾' };
      case 'expense': return { bg: 'bg-amber-100', text: 'text-amber-700', icon: '💸' };
      case 'trip': return { bg: 'bg-rose-100', text: 'text-rose-700', icon: '🚗' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-700', icon: '📋' };
    }
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }) + ' ' + dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 max-w-4xl mx-auto text-right" dir="rtl">
      {/* Header */}
      <div className="bg-[#1A365D] text-white p-4 rounded-2xl shadow-md mb-5 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-black flex items-center gap-2">
            <span>🛡️</span>
            <span>متابعة حية: {delegate.name}</span>
          </h2>
          <span className="text-[10px] text-cyan-300 font-bold">هاتف: {delegate.phone}</span>
        </div>
        <button
          onClick={onExit}
          className="bg-red-500 hover:bg-red-600 text-white font-black text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center gap-1"
        >
          <X className="h-3.5 w-3.5" />
          <span>خروج</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {cardData.map((card, idx) => (
          <button
            key={idx}
            onClick={card.onClick}
            className={`${card.color} border rounded-2xl p-3.5 text-right transition-all hover:shadow-md active:scale-[0.97] cursor-pointer flex flex-col gap-1`}
          >
            <div className="flex items-center justify-between">
              <card.icon className="h-4 w-4 opacity-60" />
              <ArrowRight className="h-3.5 w-3.5 opacity-40" />
            </div>
            <span className="text-[10px] font-bold opacity-70">{card.label}</span>
            <span className="text-xs font-black leading-tight">{card.value}</span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-black text-slate-700">آخر النشاطات (الأحدث)</span>
        </div>

        {/* Type Filter */}
        <div className="px-4 pt-3 pb-1.5 flex gap-1.5 flex-wrap">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'invoice', label: 'فواتير' },
            { key: 'load', label: 'تحميل' },
            { key: 'expense', label: 'تحصيل' },
            { key: 'trip', label: 'مشاوير' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setTimelineTypeFilter(f.key as typeof timelineTypeFilter)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                timelineTypeFilter === f.key
                  ? 'bg-[#1A365D] text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Period Filter */}
        <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'today', label: 'اليوم' },
            { key: 'week', label: 'أسبوع' },
            { key: 'month', label: 'شهر' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setTimelinePeriod(f.key as typeof timelinePeriod)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                timelinePeriod === f.key
                  ? 'bg-[#2B6CB0] text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {recentItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-bold">لا توجد نشاطات مسجلة بعد</div>
          ) : (
            recentItems.map((item) => {
              const styles = getTypeStyles(item.type);
              return (
                <div key={item.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50 transition-all">
                  <span className="text-sm mt-0.5">{styles.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 truncate">{item.description}</p>
                    <span className="text-[9px] text-slate-400 font-bold">{formatDate(item.date)}</span>
                  </div>
                  {item.amount !== undefined && (
                    <span className="text-[11px] font-black text-slate-700 shrink-0">{item.amount.toLocaleString()} ج</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button onClick={onViewLoads} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-black text-[11px] p-3 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5">
          <Package className="h-4 w-4" />
          <span>الحمولة</span>
        </button>
        <button onClick={onViewInvoices} className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-black text-[11px] p-3 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5">
          <Receipt className="h-4 w-4" />
          <span>الفواتير</span>
        </button>
        <button onClick={onViewExpenses} className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-black text-[11px] p-3 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5">
          <Wallet className="h-4 w-4" />
          <span>المالية</span>
        </button>
        <button onClick={onViewTrips} className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-black text-[11px] p-3 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5">
          <MapPin className="h-4 w-4" />
          <span>المشاوير</span>
        </button>
        <button onClick={onViewCustomers} className="bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 font-black text-[11px] p-3 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5">
          <Users className="h-4 w-4" />
          <span>العملاء</span>
        </button>
      </div>
    </div>
  );
}

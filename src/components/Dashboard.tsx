// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Product, FactoryLoad, Invoice, CarBalance, getProductWeightsFallback } from '../types';
import { Truck, Users, Receipt, Tags, Wallet, Settings as SettingsIcon, AlertCircle, ArrowLeft, MapPin, Target, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface DashboardProps {
  products: Product[];
  factoryLoads: FactoryLoad[];
  invoices: Invoice[];
  permittedTabs: string[];
  onNavigate: (tab: string) => void;
  currentUserPhone?: string;
  setIsChatOpen: (val: boolean) => void;
  lastArchiveTimestamp?: number;
}

export default function Dashboard({ products, factoryLoads, invoices, permittedTabs, onNavigate, currentUserPhone, setIsChatOpen, lastArchiveTimestamp = 0 }: DashboardProps) {
  const parseCairoTime = (dateStr: string): number => new Date(dateStr.replace('Z', '')).getTime();

  const carBalances = React.useMemo(() => {
    const balancesList: Array<{
      productId: string;
      weightId: string;
      productName: string;
      size: string;
      loaded: number;
      sold: number;
      remaining: number;
      minAlert: number;
      unitsPerCarton: number;
    }> = [];

    const activeLoads = factoryLoads.filter(l => parseCairoTime(l.date) > lastArchiveTimestamp);
    const activeInvoices = invoices.filter(inv => parseCairoTime(inv.date) > lastArchiveTimestamp);

    products.forEach(product => {
      const weights = getProductWeightsFallback(product);
      weights.forEach(w => {
        const loaded = activeLoads
          .filter(load => String(load.productId).trim() === String(product.id).trim() && String(load.weightId || '').trim() === String(w.id).trim())
          .reduce((sum, load) => sum + load.quantity, 0);

        let sold = 0;
        activeInvoices.forEach(invoice => {
          invoice.items.forEach(item => {
            if (String(item.productId).trim() === String(product.id).trim() && String(item.weightId || '').trim() === String(w.id).trim()) {
              sold += item.quantity;
            }
          });
        });

        const remaining = loaded - sold;

        balancesList.push({
          productId: product.id,
          weightId: w.id,
          productName: product.name,
          size: w.size,
          loaded,
          sold,
          remaining,
          minAlert: product.minStockAlert,
          unitsPerCarton: w.unitsPerCarton || 12
        });
      });
    });

    return balancesList;
  }, [products, factoryLoads, invoices, lastArchiveTimestamp]);

  const hasAlerts = carBalances.some(bal => bal.remaining <= bal.minAlert);

  const activeBalances = React.useMemo(() => {
    return carBalances.filter(item => item.remaining > 0);
  }, [carBalances]);

  const [showCarStock, setShowCarStock] = React.useState(true);

  const dynamicAITip = React.useMemo(() => {
    const lowItem = carBalances.find(bal => bal.loaded > 0 && bal.remaining <= bal.minAlert);
    if (lowItem) {
      return `⚠️ رصيد صنف "${lowItem.productName} (${lowItem.size})" منخفض بالسيارة (${Math.floor(lowItem.remaining / lowItem.unitsPerCarton)} كرتونة). يُنصح بطلب دفعة جديدة من المصنع الآن.`;
    }

    const unpaidInvoice = invoices.find(inv => inv.totalAfterDiscount > inv.paidAmount);
    if (unpaidInvoice) {
      const debtAmount = unpaidInvoice.totalAfterDiscount - unpaidInvoice.paidAmount;
      return `💸 توجد فواتير آجلة معلقة بقيمة (بقيمة متبقية ${debtAmount} ج). اضغط للحصول على خطة جدولة وتفاوض مع التاجر.`;
    }

    return `🎯 جرد السيارة مستقر وممتاز! اضغط هنا لبدء محادثة تكتيكية مع المستشار للحصول على خطة تسويق ممتازة اليوم.`;
  }, [carBalances, invoices]);

  return (
    <div className="flex flex-col gap-4 px-2 py-4 w-full max-w-lg mx-auto min-h-screen bg-slate-50 text-right animate-fade-in" dir="rtl" id="dashboard-container">
      
      {/* Car Stock Widget */}
      {activeBalances.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setShowCarStock(!showCarStock)}
            className="bg-indigo-700 rounded-xl p-3 shadow-md border border-indigo-600 flex items-center justify-between transition-all text-right group hover:bg-indigo-800 cursor-pointer text-white mx-1"
          >
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg text-indigo-100">
                <Truck className="h-5 w-5 animate-pulse" />
              </div>
              <span className="font-extrabold text-sm text-white flex items-center gap-2">
                الجرد الحالي للسيارة
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-inner">{activeBalances.length} أصناف</span>
              </span>
            </div>
            <svg className={`w-5 h-5 text-indigo-300 transition-transform ${showCarStock ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showCarStock && (
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 animate-fade-in mx-1 mt-1">
              <div className="grid grid-cols-12 gap-1 border-b border-slate-200 pb-2 text-center text-[11px] font-black tracking-wider text-slate-500 uppercase">
                <span className="col-span-6 text-right">الصنف</span>
                <span className="col-span-3 text-emerald-600">التحميل</span>
                <span className="col-span-3 text-rose-600">الباقي</span>
              </div>

              <div className="max-h-48 overflow-y-auto custom-scroll divide-y divide-slate-100 mt-1 pb-1">
                {activeBalances.map(item => {
                  const isLow = item.remaining <= item.minAlert;
                  const loadedCartons = Math.floor(item.loaded / item.unitsPerCarton);
                  const remainingCartons = Math.floor(item.remaining / item.unitsPerCarton);
                  const looseUnits = item.remaining % item.unitsPerCarton;
                  
                  const remainingText = `${remainingCartons} ك ${looseUnits > 0 ? `و ${looseUnits} ع` : ''}`;
                  const loadedText = `${loadedCartons} ك`;

                  return (
                    <div key={`${item.productId}_${item.weightId}`} className="grid grid-cols-12 gap-1 py-2 items-center text-center text-xs hover:bg-slate-50 transition-colors">
                      <div className="col-span-6 text-right font-black text-slate-800 pr-1 flex flex-col justify-center">
                        <span className="truncate">{item.productName} <span className="font-bold text-[10px] text-indigo-500 ml-1">({item.size})</span></span>
                        {isLow && item.remaining > 0 && (
                          <span className="text-[10px] text-rose-600 font-extrabold flex items-center gap-1 mt-0.5 bg-rose-50 w-max px-1.5 py-0.5 rounded">
                            <AlertCircle className="h-3 w-3 inline" /> نقص
                          </span>
                        )}
                      </div>
                      <span className="col-span-3 font-bold text-slate-700 bg-slate-100 py-1 rounded-md text-[11px]">{loadedText}</span>
                      <span className={`col-span-3 font-black py-1 rounded-md text-[11px] flex flex-col justify-center items-center ${
                        isLow ? 'bg-rose-100 text-rose-700 shadow-inner border border-rose-200' : 'bg-emerald-100 text-emerald-700 shadow-inner border border-emerald-200'
                      }`}>
                        {remainingText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid Menu */}
      <h3 className="text-sm font-black text-slate-500 mt-2 px-1">القائمة الرئيسية</h3>
      <div className="grid grid-cols-2 gap-3" id="grid-menu">
        {permittedTabs.includes('factory') && (
          <button
            onClick={() => onNavigate('factory')}
            className="bg-emerald-50 rounded-2xl p-4 shadow-sm border border-emerald-200 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all text-center group hover:shadow-md cursor-pointer"
          >
            <div className="h-14 w-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:-translate-y-1 transition-transform border border-emerald-300">
              <Truck className="h-7 w-7" />
            </div>
            <div>
              <span className="block text-emerald-900 font-extrabold text-base mb-0.5">المصنع</span>
              <span className="block text-[11px] font-bold text-emerald-700">إدارة الحمولات</span>
            </div>
          </button>
        )}

        {permittedTabs.includes('customers') && (
          <button
            onClick={() => onNavigate('customers')}
            className="bg-sky-50 rounded-2xl p-4 shadow-sm border border-sky-200 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all text-center group hover:shadow-md cursor-pointer"
          >
            <div className="h-14 w-14 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-600 group-hover:-translate-y-1 transition-transform border border-sky-300">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <span className="block text-sky-900 font-extrabold text-base mb-0.5">العملاء</span>
              <span className="block text-[11px] font-bold text-sky-700">دليل التجار</span>
            </div>
          </button>
        )}

        {permittedTabs.includes('invoice') && (
          <button
            onClick={() => onNavigate('invoice')}
            className="bg-indigo-50 rounded-2xl p-4 shadow-sm border border-indigo-200 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all text-center group hover:shadow-md cursor-pointer"
          >
            <div className="h-14 w-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:-translate-y-1 transition-transform border border-indigo-300">
              <Receipt className="h-7 w-7" />
            </div>
            <div>
              <span className="block text-indigo-900 font-extrabold text-base mb-0.5">الفواتير</span>
              <span className="block text-[11px] font-bold text-indigo-700">المبيعات</span>
            </div>
          </button>
        )}

        {permittedTabs.includes('prices') && (
          <button
            onClick={() => onNavigate('prices')}
            className="bg-rose-50 rounded-2xl p-4 shadow-sm border border-rose-200 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all text-center group hover:shadow-md cursor-pointer"
          >
            <div className="h-14 w-14 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 group-hover:-translate-y-1 transition-transform border border-rose-300">
              <Tags className="h-7 w-7" />
            </div>
            <div>
              <span className="block text-rose-900 font-extrabold text-base mb-0.5">الأسعار</span>
              <span className="block text-[11px] font-bold text-rose-700">المنتجات</span>
            </div>
          </button>
        )}

        {permittedTabs.includes('expenses') && (
          <button
            onClick={() => onNavigate('expenses')}
            className="bg-cyan-50 rounded-2xl p-4 shadow-sm border border-cyan-200 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all text-center group hover:shadow-md cursor-pointer"
          >
            <div className="h-14 w-14 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600 group-hover:-translate-y-1 transition-transform border border-cyan-300">
              <Wallet className="h-7 w-7" />
            </div>
            <div>
              <span className="block text-cyan-900 font-extrabold text-base mb-0.5">النفقات</span>
              <span className="block text-[11px] font-bold text-cyan-700">المصاريف</span>
            </div>
          </button>
        )}

        {permittedTabs.includes('administrative') && (
          <button
            onClick={() => onNavigate('administrative')}
            className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-amber-200 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all text-center group hover:shadow-md cursor-pointer"
          >
            <div className="h-14 w-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 group-hover:-translate-y-1 transition-transform border border-amber-300">
              <SettingsIcon className="h-7 w-7" />
            </div>
            <div>
              <span className="block text-amber-900 font-extrabold text-base mb-0.5">الإدارة</span>
              <span className="block text-[11px] font-bold text-amber-700">التحكم والمناديب</span>
            </div>
          </button>
        )}
      </div>

      {/* Footer bar */}
      {permittedTabs.includes('reports') && (
        <button
          onClick={() => onNavigate('reports')}
          className="mt-3 bg-slate-800 border border-slate-700 text-white rounded-2xl py-4 px-5 flex items-center justify-between shadow-md active:scale-95 transition-all hover:bg-slate-700 cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/30 border border-indigo-400/30 p-2 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-indigo-400">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 5.07c2.81.42 5.01 2.62 5.43 5.43H13V7.07zM11 7.07v6.43H4.57c.42-2.81 2.62-5.01 5.43-5.43zM4.57 15H11v6.43c-2.81-.42-5.01-2.62-5.43-5.43zm8.43 6.43V15h6.43c-.42 2.81-2.62 5.01-5.43 5.43z" />
              </svg>
            </div>
            <div className="flex flex-col items-start">
              <span className="font-extrabold text-sm text-slate-100">التقارير</span>
              <span className="text-[10px] font-medium text-slate-400">الأرباح والمبيعات</span>
            </div>
          </div>
          <ArrowLeft className="h-5 w-5 text-indigo-400 group-hover:-translate-x-1 transition-transform" />
        </button>
      )}
    </div>
  );
}

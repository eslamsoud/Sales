/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product, FactoryLoad, Invoice, CarBalance, getProductWeightsFallback } from '../types';
import { Truck, Users, Receipt, Tags, Wallet, Settings as SettingsIcon, AlertCircle, ArrowLeft, MapPin } from 'lucide-react';

interface DashboardProps {
  products: Product[];
  factoryLoads: FactoryLoad[];
  invoices: Invoice[];
  permittedTabs: string[];
  onNavigate: (tab: string) => void;
  currentUserPhone?: string;
}

export default function Dashboard({ products, factoryLoads, invoices, permittedTabs, onNavigate, currentUserPhone }: DashboardProps) {
  // Compute loaded and remaining for each product size variant
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

    products.forEach(product => {
      const weights = getProductWeightsFallback(product);
      weights.forEach(w => {
        // Sum loads of this specific product + weight option
        const loaded = factoryLoads
          .filter(load => load.productId === product.id && load.weightId === w.id)
          .reduce((sum, load) => sum + load.quantity, 0);

        // Sum sales of this specific product + weight option
        let sold = 0;
        invoices.forEach(invoice => {
          invoice.items.forEach(item => {
            if (item.productId === product.id && item.weightId === w.id) {
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
  }, [products, factoryLoads, invoices]);

  // Is there any warehouse alert?
  const hasAlerts = carBalances.some(bal => bal.remaining <= bal.minAlert);

  const activeBalances = React.useMemo(() => {
    return carBalances.filter(item => item.loaded > 0);
  }, [carBalances]);

  return (
    <div className="flex flex-col gap-4 px-2 py-4 w-full max-w-lg mx-auto min-h-screen bg-slate-50" id="dashboard-container">
      {/* Car Stock Widget (رصيد السيارة) */}
      {activeBalances.length > 0 && (
        <div 
          className="bg-indigo-700 rounded-2xl overflow-hidden shadow-lg border border-indigo-600" 
          id="car-balance-widget"
        >
          <div className="bg-white/10 py-3 text-center backdrop-blur-sm shadow-sm">
            <h2 className="text-white text-base font-extrabold tracking-wide flex items-center justify-center gap-2">
              <Truck className="h-6 w-6 text-amber-300 animate-pulse" />
              الجرد الحالي
            </h2>
          </div>
          
          <div className="bg-white/95 p-3 m-2 rounded-xl border border-white/20 shadow-inner">
            {/* Header of Table */}
            <div className="grid grid-cols-12 gap-1 border-b border-slate-200 pb-2 text-center text-[11px] font-black tracking-wider text-slate-500 uppercase">
              <span className="col-span-6 text-right">الصنف</span>
              <span className="col-span-3 text-emerald-600">التحميل</span>
              <span className="col-span-3 text-rose-600">الباقي</span>
            </div>

            {/* List of Products */}
            <div className="max-h-48 overflow-y-auto custom-scroll divide-y divide-slate-100 mt-1">
              {activeBalances.map(item => {
                const isLow = item.remaining <= item.minAlert;
                const loadedCartons = Math.floor(item.loaded / item.unitsPerCarton);
                const remainingCartons = Math.floor(item.remaining / item.unitsPerCarton);
                return (
                  <div key={`${item.productId}_${item.weightId}`} className="grid grid-cols-12 gap-1 py-2 items-center text-center text-xs hover:bg-indigo-50/50 transition-colors">
                    <div className="col-span-6 text-right font-black text-slate-800 pr-1 flex flex-col justify-center">
                      <span className="truncate">{item.productName} <span className="font-bold text-[10px] text-indigo-500 ml-1">({item.size})</span></span>
                      {isLow && item.loaded > 0 && (
                        <span className="text-[10px] text-rose-600 font-extrabold flex items-center gap-1 mt-0.5 bg-rose-50 w-max px-1.5 py-0.5 rounded">
                          <AlertCircle className="h-3 w-3 inline" /> نقص
                        </span>
                      )}
                    </div>
                    <span className="col-span-3 font-bold text-slate-700 bg-slate-100 py-1 rounded-md text-[11px]">{loadedCartons} ك</span>
                    <span className={`col-span-3 font-black py-1 rounded-md text-[11px] flex flex-col justify-center items-center ${
                      isLow ? 'bg-rose-100 text-rose-700 shadow-inner border border-rose-200' : 'bg-emerald-100 text-emerald-700 shadow-inner border border-emerald-200'
                    }`}>
                      {remainingCartons} ك
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grid Menu of Options mapped precisely to user mockup */}
      <h3 className="text-sm font-black text-slate-500 mt-2 px-1">القائمة الرئيسية</h3>
      <div className="grid grid-cols-2 gap-3" id="grid-menu">
        {/* 1. المصنع (Factory Load) */}
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

        {/* 2. العملاء (Customers) */}
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

        {/* 3. فاتورة (New Invoice) */}
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

        {/* 4. قائمة الأسعار (Price List) */}
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

        {/* 5. المصروفات (Expenses) */}
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

        {/* 6. الإدارة (Administration / Core Control) */}
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

      {/* Footer bar exactly as visually matching */}
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

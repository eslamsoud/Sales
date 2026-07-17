// @ts-nocheck
import React from 'react';
import { Archive, Printer, Download, Clock, Trash2 } from 'lucide-react';
import { Product, FactoryLoad, getProductWeightsFallback, formatNum } from '../../types';

export interface LoadsArchiveSectionProps {
  filteredLoads: FactoryLoad[];
  groupedLoadsByYearMonth: [string, [string, [string, FactoryLoad[]][]][]][];
  openArchiveSection: string | null;
  setOpenArchiveSection: (val: string | null) => void;
  openLoadYear: string | null;
  setOpenLoadYear: (val: string | null) => void;
  openLoadMonth: string | null;
  setOpenLoadMonth: (val: string | null) => void;
  openArchiveDay: string | null;
  setOpenArchiveDay: (val: string | null) => void;
  monthNames: string[];
  products: Product[];
  onDeleteLoad: (id: string) => void;
  downloadFilteredLoadsPDF: () => void;
  downloadFilteredLoadsImage: () => void;
  downloadLoadMonthPDF: (year: string, month: string) => void;
}

export default function LoadsArchiveSection({
  filteredLoads,
  groupedLoadsByYearMonth,
  openArchiveSection,
  setOpenArchiveSection,
  openLoadYear,
  setOpenLoadYear,
  openLoadMonth,
  setOpenLoadMonth,
  openArchiveDay,
  setOpenArchiveDay,
  monthNames,
  products,
  onDeleteLoad,
  downloadFilteredLoadsPDF,
  downloadFilteredLoadsImage,
  downloadLoadMonthPDF,
}: LoadsArchiveSectionProps) {
  return (
    <div className="bg-amber-50/30 border border-amber-200 rounded-xl p-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => { setOpenArchiveSection(openArchiveSection === 'loads' ? null : 'loads'); setOpenLoadYear(null); setOpenLoadMonth(null); }}
        className={`w-full text-right flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
          openArchiveSection === 'loads' ? 'bg-orange-100 text-orange-800 shadow-sm' : 'bg-orange-50/50 text-orange-600 hover:bg-orange-100/50'
        }`}
      >
        <span>{openArchiveSection === 'loads' ? '📂' : '📁'}</span>
        <Archive className="h-4 w-4" />
        <span>أرشيف الحمولات</span>
      </button>

    {openArchiveSection === 'loads' && (
    <>

    {filteredLoads.length > 0 && (
      <div className="flex gap-3 w-full mt-1 mb-3">
        <button
          type="button"
          onClick={downloadFilteredLoadsPDF}
          className="flex-1 bg-[#1e293b] hover:bg-[#334155] text-white py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          <span>تنزيل بيان المبيعات والتحميل المعتمد (PDF)</span>
        </button>
        <button
          type="button"
          onClick={downloadFilteredLoadsImage}
          className="flex-1 bg-[#DD6B20] hover:bg-[#C05621] text-white py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          <Download className="h-4 w-4" /> تنزيل صورة الفاتورة المعتمدة
        </button>
      </div>
    )}

    {filteredLoads.length === 0 ? (
      <div className="text-center py-10 bg-[#F7FAFC] rounded-2xl border border-dashed border-slate-200">
        <p className="text-sm text-gray-400 font-bold">لا توجد شحنات تحميل سابقة مطابقة لهذه الفترة.</p>
        <p className="text-xs text-gray-400 mt-1">جرب تغيير محدد الفترة أو تسجيل شحنات جديدة.</p>
      </div>
    ) : (
      groupedLoadsByYearMonth.map(([year, months]) => (
        <div key={year} className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOpenLoadYear(openLoadYear === year ? null : year)}
            className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
              openLoadYear === year
                ? 'bg-amber-100 text-amber-800 shadow-sm'
                : 'bg-amber-50/50 text-amber-600 hover:bg-amber-100/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{openLoadYear === year ? '📂' : '📁'}</span>
              <span>حمولات سنة {year}</span>
            </div>
            <span className="text-[10px] bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              {months.reduce((sum, [, days]) => sum + days.length, 0)} يوم
            </span>
          </button>
          {openLoadYear === year && (
            <div className="flex flex-col gap-2 pr-4 border-r-2 border-amber-100 mr-2">
              {months.map(([month, days]) => (
                <div key={month} className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOpenLoadMonth(openLoadMonth === year + month ? null : year + month)}
                    className={`flex-1 w-full text-right px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
                      openLoadMonth === year + month
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-orange-50/50 text-orange-600 hover:bg-orange-100/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{openLoadMonth === year + month ? '🔽' : '▶️'}</span>
                      <span>شهر {monthNames[parseInt(month) - 1]}</span>
                    </div>
                    <span className="text-[10px] bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full font-bold">{days.length} أيام</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadLoadMonthPDF(year, month)}
                    title={`تنزيل PDF — شهر ${monthNames[parseInt(month) - 1]} ${year}`}
                    className="shrink-0 bg-[#DD6B20] hover:bg-[#C05621] text-white p-1.5 rounded-lg transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </button>
                  </div>
                  {openLoadMonth === year + month && (
                    <div className="flex flex-col gap-2 pr-2">
                      <button
                        type="button"
                        onClick={() => downloadLoadMonthPDF(year, month)}
                        className="w-full bg-[#DD6B20] hover:bg-[#C05621] text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        <Printer className="h-3 w-3" /> تنزيل PDF — شهر {monthNames[parseInt(month) - 1]} {year}
                      </button>
                      {days.map(([dateKey, loadsForDay]) => {
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
                              <div className="w-full overflow-x-auto whitespace-nowrap scrollbar-thin border border-slate-200 rounded-xl">
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
                                            <div>{pName} {(load.archived || load.isArchived || load.archivedAt) && <span className="text-emerald-600 text-[9px] font-bold">[مؤرشفة]</span>}</div>
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
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))
    )}
    </>
    )}
    </div>
  );
}

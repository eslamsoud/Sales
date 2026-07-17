// @ts-nocheck
import React from 'react';
import { Archive, Printer, Download, Image, CheckCircle2, Edit, RefreshCw } from 'lucide-react';
import { formatNum } from '../../types';
import { confirmDialog } from '../../utils/confirm';
import { showToast } from '../../utils/toast';

export interface CyclesArchiveSectionProps {
  archiveCycles: any[];
  openArchiveSection: string | null;
  setOpenArchiveSection: (val: string | null) => void;
  openCycleYear: string | null;
  setOpenCycleYear: (val: string | null) => void;
  openCycleMonth: string | null;
  setOpenCycleMonth: (val: string | null) => void;
  archiveFilter: string;
  editingCycle: any;
  setEditingCycle: (val: any) => void;
  editData: any;
  setEditData: (val: any) => void;
  setArchiveCycles: (updater: any[] | ((prev: any[]) => any[])) => void;
  groupedCyclesByYearMonth: [string, [string, any[]][]][];
  monthNames: string[];
  downloadAllArchivedCyclesPDF: () => void;
  downloadAllArchivedCyclesImage: () => void;
  downloadFilteredArchivePDF: () => void;
  downloadFilteredArchiveImage: () => void;
  downloadCycleMonthPDF: (monthCycles: any[], year: string, month: string) => void;
  downloadArchivedCyclePDF: (cycle: any) => void;
  downloadArchivedCycleImage: (cycle: any) => void;
}

export default function CyclesArchiveSection({
  archiveCycles,
  openArchiveSection,
  setOpenArchiveSection,
  openCycleYear,
  setOpenCycleYear,
  openCycleMonth,
  setOpenCycleMonth,
  archiveFilter,
  editingCycle,
  setEditingCycle,
  editData,
  setEditData,
  setArchiveCycles,
  groupedCyclesByYearMonth,
  monthNames,
  downloadAllArchivedCyclesPDF,
  downloadAllArchivedCyclesImage,
  downloadFilteredArchivePDF,
  downloadFilteredArchiveImage,
  downloadCycleMonthPDF,
  downloadArchivedCyclePDF,
  downloadArchivedCycleImage,
}: CyclesArchiveSectionProps) {
  return (
    <div className="bg-blue-50/30 border border-blue-200 rounded-xl p-4">
      <button
        type="button"
        onClick={() => { setOpenArchiveSection(openArchiveSection === 'cycles' ? null : 'cycles'); setOpenCycleYear(null); setOpenCycleMonth(null); }}
        className={`w-full text-right flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
          openArchiveSection === 'cycles' ? 'bg-blue-100 text-blue-800 shadow-sm' : 'bg-blue-50/50 text-blue-600 hover:bg-blue-100/50'
        }`}
      >
        <span>{openArchiveSection === 'cycles' ? '📂' : '📁'}</span>
        <Archive className="h-4 w-4" />
        <span>الدورات المؤرشفة ({archiveCycles.length} دورة)</span>
      </button>

    {openArchiveSection === 'cycles' && (
      <div className="flex flex-col gap-3 animate-fade-in mt-3">

        {archiveCycles.length > 1 && (
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={downloadAllArchivedCyclesPDF}
              className="flex-1 bg-[#1A365D] hover:bg-[#2B6CB0] text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>تنزيل كل الدورات المؤرشفة (PDF)</span>
            </button>
            <button
              type="button"
              onClick={downloadAllArchivedCyclesImage}
              className="flex-1 bg-[#DD6B20] hover:bg-[#C05621] text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>تنزيل صورة كل الدورات المؤرشفة</span>
            </button>
          </div>
        )}
        {archiveFilter !== 'all' && (
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={downloadFilteredArchivePDF}
              className="flex-1 bg-indigo-700 hover:bg-indigo-800 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>تنزيل الدورات المفلترة (PDF)</span>
            </button>
            <button
              type="button"
              onClick={downloadFilteredArchiveImage}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Image className="h-4 w-4" />
              <span>تنزيل صورة الدورات المفلترة</span>
            </button>
          </div>
        )}
        {groupedCyclesByYearMonth.map(([year, months]) => (
          <div key={year} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setOpenCycleYear(openCycleYear === year ? null : year)}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
                openCycleYear === year
                  ? 'bg-blue-100 text-blue-800 shadow-sm'
                  : 'bg-blue-50/50 text-blue-600 hover:bg-blue-100/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{openCycleYear === year ? '📂' : '📁'}</span>
                <span>دورات سنة {year}</span>
              </div>
              <span className="text-[10px] bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                {months.reduce((sum, [, cycles]) => sum + cycles.length, 0)} دورات
              </span>
            </button>
            {openCycleYear === year && (
              <div className="flex flex-col gap-2 pr-4 border-r-2 border-blue-100 mr-2">
                {months.map(([month, cycles]) => (
                  <div key={month} className="flex flex-col gap-2">
                    <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOpenCycleMonth(openCycleMonth === year + month ? null : year + month)}
                      className={`flex-1 w-full text-right px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
                        openCycleMonth === year + month
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-indigo-50/50 text-indigo-600 hover:bg-indigo-100/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{openCycleMonth === year + month ? '🔽' : '▶️'}</span>
                        <span>شهر {monthNames[parseInt(month) - 1]}</span>
                      </div>
                      <span className="text-[10px] bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{cycles.length} دورات</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadCycleMonthPDF(cycles, year, month)}
                      title={`تنزيل PDF — شهر ${monthNames[parseInt(month) - 1]} ${year}`}
                      className="shrink-0 bg-[#1A365D] hover:bg-[#2B6CB0] text-white p-1.5 rounded-lg transition-all cursor-pointer active:scale-95 shadow-xs"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    </div>
                    {openCycleMonth === year + month && (
                      <div className="flex flex-col gap-2 pr-2">
                        <button
                          type="button"
                          onClick={() => downloadCycleMonthPDF(cycles, year, month)}
                          className="w-full bg-[#1A365D] hover:bg-[#2B6CB0] text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer"
                        >
                          <Printer className="h-3 w-3" /> تنزيل PDF — شهر {monthNames[parseInt(month) - 1]} {year}
                        </button>
                        {cycles.map((cycle, cycleIdx) => {
                          const cycleNumber = cycles.length - cycleIdx;
                          return (
                          <details key={cycle.id} className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                            <summary className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-indigo-100/50 transition-colors select-none">
                              <div className="flex items-center gap-2 text-xs font-bold">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black ml-1">دورة {cycleNumber}</span>
                                <span className="text-indigo-900">{cycle.settledAt}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px]">
                                <span className="text-slate-600">{cycle.loads?.length || 0} حمولة</span>
                                <span className="text-slate-600">{cycle.payments?.length || 0} دفعة</span>
                                {cycle.creditBalance > 0 && <span className="text-amber-600 font-extrabold">رصيد دائن: {formatNum(cycle.creditBalance)} ج.م</span>}
                                {(cycle as any).waivedAmount > 0 && <span className="text-rose-600 font-extrabold">مبلغ مسموح: {formatNum((cycle as any).waivedAmount)} ج.م</span>}
                              </div>
                            </summary>
                            <div className="px-4 pb-4 pt-2 border-t border-indigo-100 flex flex-col gap-3">
                              <div className="flex gap-2">
                                <button type="button" onClick={() => downloadArchivedCyclePDF(cycle)} className="bg-[#1A365D] hover:bg-[#2B6CB0] text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"><Printer className="h-3 w-3" /> PDF</button>
                                <button type="button" onClick={() => downloadArchivedCycleImage(cycle)} className="bg-[#DD6B20] hover:bg-[#C05621] text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"><Image className="h-3 w-3" /> صورة</button>
                                <button type="button" onClick={() => { setEditingCycle(cycle); setEditData(JSON.parse(JSON.stringify(cycle))); }} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"><Edit className="h-3 w-3" /> تعديل</button>
                                <button type="button" onClick={async () => {
                                  const confirmed = await confirmDialog(`هل تريد رجوع الدورة رقم ${cycles.length - cycleIdx} للدورة الحالية؟\n⚠️ سيتم حذف هذه الدورة من الأرشيف. الحمولات والدفعات ستظهر مجدداً في الحساب.`);
                                  if (confirmed) {
                                    try { const deletedIds = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]'); deletedIds.push(cycle.id); localStorage.setItem('deleted_records_sys', JSON.stringify(deletedIds)); } catch {}
                                    setArchiveCycles(prev => { const next = prev.filter(c => c.id !== cycle.id); return next; });
                                    showToast('✓ تم رجوع الدورة من الأرشيف! الحمولات والدفعات ستظهر في الحساب.');
                                  }
                                }} className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> رجوع</button>
                              </div>
                              {cycle.loads && cycle.loads.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-extrabold text-slate-500 block mb-2">📦 الحمولات</span>
                                  <div className="max-h-40 overflow-y-auto custom-scroll border border-slate-200 rounded-lg">
                                    <table className="w-full text-[10px] font-bold">
                                      <thead className="bg-slate-100 sticky top-0"><tr><th className="p-1.5 text-center w-8">م</th><th className="p-1.5 text-right">الصنف</th><th className="p-1.5 text-center">الكمية</th><th className="p-1.5 text-center">السعر</th><th className="p-1.5 text-center">القيمة</th><th className="p-1.5 text-center">المقدم</th></tr></thead>
                                      <tbody>{cycle.loads.map((load: any, i: number) => {
                                        const cartons = Math.floor((load.quantity || 0) / (load.unitsPerCarton || 12));
                                        const loose = (load.quantity || 0) % (load.unitsPerCarton || 12);
                                        return (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                          <td className="p-1.5 text-center text-slate-400">{i + 1}</td>
                                          <td className="p-1.5 text-right">{load.productName} ({load.weightSize})</td>
                                          <td className="p-1.5 text-center">{cartons} كرتونة{loose > 0 ? ` + ${loose} وحدة` : ''}</td>
                                          <td className="p-1.5 text-center">{formatNum(load.cartonPrice)} ج.م</td>
                                          <td className="p-1.5 text-center font-extrabold">{formatNum(load.subtotal)} ج.م</td>
                                          <td className="p-1.5 text-center text-amber-700">{formatNum(load.advanceAmount)} ج.م</td>
                                        </tr>
                                        );
                                      })}</tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              {cycle.payments && cycle.payments.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-extrabold text-slate-500 block mb-2">💳 الدفعات المباشرة</span>
                                  <div className="max-h-32 overflow-y-auto custom-scroll border border-slate-200 rounded-lg">
                                    <table className="w-full text-[10px] font-bold">
                                      <thead className="bg-slate-100 sticky top-0"><tr><th className="p-1.5 text-center w-8">م</th><th className="p-1.5 text-right">البيان</th><th className="p-1.5 text-center">المبلغ</th><th className="p-1.5 text-center">المندوب</th><th className="p-1.5 text-center">المستلم</th><th className="p-1.5 text-center w-10">تعديل</th></tr></thead>
                                      <tbody>{cycle.payments.map((pay: any, i: number) => (
                                        <tr key={pay.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                          <td className="p-1.5 text-center text-slate-400">{i + 1}</td>
                                          <td className="p-1.5 text-right">{pay.notes || 'تسديد مباشر'}</td>
                                          <td className="p-1.5 text-center font-extrabold text-emerald-700">{formatNum(pay.amount)} ج.م</td>
                                          <td className="p-1.5 text-center">{pay.delegateName || '-'}</td>
                                          <td className="p-1.5 text-center">{pay.recipient ? `السيد / ${pay.recipient}` : '-'}</td>
                                          <td className="p-1.5 text-center">
                                            <button type="button" onClick={() => {
                                              const newAmount = prompt('تعديل مبلغ السداد:', pay.amount);
                                              if (newAmount === null) return;
                                              const parsed = parseFloat(newAmount);
                                              if (isNaN(parsed) || parsed < 0) { showToast('⚠️ مبلغ غير صحيح!'); return; }
                                              const newNotes = prompt('تعديل البيان:', pay.notes || '') || pay.notes;
                                              const newRecipient = prompt('تعديل المستلم:', pay.recipient || '') || pay.recipient;
                                              setArchiveCycles(prev => { const next = prev.map(c => { if (c.id !== cycle.id) return c; const updatedPayments = [...(c.payments || [])]; updatedPayments[i] = { ...updatedPayments[i], amount: parsed, notes: newNotes, recipient: newRecipient }; const totalPayments = updatedPayments.reduce((s: number, p: any) => s + ((p.amount || 0) - ((p as any).appliedToCarriedDebt || 0)), 0); return { ...c, payments: updatedPayments, totalAdvancePayments: totalPayments }; }); return next; });
                                              showToast('✓ تم تعديل الدفعة في الدورة المؤرشفة!');
                                            }} className="text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 p-1 rounded border border-slate-200 cursor-pointer transition-all active:scale-95" title="تعديل هذه الدفعة"><Edit className="h-3 w-3" /></button>
                                          </td>
                                        </tr>
                                      ))}</tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              <div className="bg-indigo-100/50 rounded-lg p-3 flex flex-col gap-2 text-xs font-bold">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600">قيمة المحمل من المصنع: {formatNum(cycle.rawLoadedValue || cycle.loads?.reduce?.((s: number, l: any) => s + l.subtotal, 0) || 0)} ج.م</span>
                                  <span className="text-emerald-700">مسدد: {formatNum(cycle.totalAdvancePayments)} ج.م</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  {cycle.creditBalance > 0 ? (<span className="text-amber-600">رصيد دائن منقول للدورة التالية: {formatNum(cycle.creditBalance)} ج.م</span>)
                                  : (cycle as any).waivedAmount > 0 ? (<span className="text-rose-600">مبلغ مسموح به (أسقط من المديونية): {formatNum((cycle as any).waivedAmount)} ج.م</span>)
                                  : (<span className="text-green-700">✅ تم التسوية بالكامل</span>)}
                                </div>
                              </div>
                            </div>
                          </details>
                        );})}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
      </div>
  );
}

// @ts-nocheck
import React from 'react';
import { History, Printer, Image, Edit, Trash2 } from 'lucide-react';
import { Product, FactoryLoad, getProductWeightsFallback, formatNum } from '../../types';
import { COMPACT_PRO_CSS } from '../../utils/reportStyles';
import { confirmDialog } from '../../utils/confirm';
import { showToast } from '../../utils/toast';

export interface PaymentsArchiveSectionProps {
  openArchiveSection: string | null;
  setOpenArchiveSection: (val: string | null) => void;
  archiveFilter: string;
  setArchiveFilter: (val: 'all' | 'daily' | 'weekly' | 'monthly' | 'custom') => void;
  archiveDayFilters: string[];
  setArchiveDayFilters: React.Dispatch<React.SetStateAction<string[]>>;
  archiveStartDate: string;
  setArchiveStartDate: (val: string) => void;
  archiveEndDate: string;
  setArchiveEndDate: (val: string) => void;
  filteredArchiveExtraPayments: any[];
  filteredLoads: FactoryLoad[];
  weightStocks: Record<string, { loaded: number; sold: number; remaining: number }>;
  products: Product[];
  editingPaymentId: string | null;
  setEditingPaymentId: (val: string | null) => void;
  editingPaymentAmount: string;
  setEditingPaymentAmount: (val: string) => void;
  editingPaymentNotes: string;
  setEditingPaymentNotes: (val: string) => void;
  editingPaymentRecipient: string;
  setEditingPaymentRecipient: (val: string) => void;
  setArchiveCycles: (updater: any[] | ((prev: any[]) => any[])) => void;
}

export default function PaymentsArchiveSection({
  openArchiveSection,
  setOpenArchiveSection,
  archiveFilter,
  setArchiveFilter,
  archiveDayFilters,
  setArchiveDayFilters,
  archiveStartDate,
  setArchiveStartDate,
  archiveEndDate,
  setArchiveEndDate,
  filteredArchiveExtraPayments,
  filteredLoads,
  weightStocks,
  products,
  editingPaymentId,
  setEditingPaymentId,
  editingPaymentAmount,
  setEditingPaymentAmount,
  editingPaymentNotes,
  setEditingPaymentNotes,
  editingPaymentRecipient,
  setEditingPaymentRecipient,
  setArchiveCycles,
}: PaymentsArchiveSectionProps) {
  return (
    <div className="bg-emerald-50/30 border border-emerald-200 rounded-xl p-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpenArchiveSection(openArchiveSection === 'payments' ? null : 'payments')}
        className={`w-full text-right flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
          openArchiveSection === 'payments' ? 'bg-green-100 text-green-800 shadow-sm' : 'bg-green-50/50 text-green-600 hover:bg-green-100/50'
        }`}
      >
        <span>{openArchiveSection === 'payments' ? '📂' : '📁'}</span>
        <History className="h-4 w-4" />
        <span>أرشيف الدفعات النقدية والمسددات المباشرة للمورد</span>
      </button>

    {openArchiveSection === 'payments' && (
    <div className="flex flex-col gap-3">
        <div className="grid grid-cols-5 bg-[#F7FAFC] border border-slate-200 p-1 rounded-xl text-center gap-1">
          <button type="button" onClick={() => { setArchiveFilter('all'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'all' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>الكل</button>
          <button type="button" onClick={() => { setArchiveFilter('daily'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'daily' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>يومي</button>
          <button type="button" onClick={() => { setArchiveFilter('weekly'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'weekly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>أسبوعي</button>
          <button type="button" onClick={() => { setArchiveFilter('monthly'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'monthly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>شهري</button>
          <button type="button" onClick={() => { setArchiveFilter('custom'); setArchiveDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${archiveFilter === 'custom' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>مخصص</button>
        </div>
        {archiveFilter === 'weekly' && (
          <div className="flex bg-[#F7FAFC] border border-slate-200 rounded-lg overflow-hidden flex-wrap gap-px p-0.5 animate-fade-in" dir="rtl">
            <button onClick={() => setArchiveDayFilters([])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${archiveDayFilters.length === 0 ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>الكل</button>
            {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
               const arabicDays: Record<string, string> = { 'Saturday':'السبت', 'Sunday':'الأحد', 'Monday':'الإثنين', 'Tuesday':'الثلاثاء', 'Wednesday':'الأربعاء', 'Thursday':'الخميس', 'Friday':'الجمعة' };
               return (
                 <button key={day} onClick={() => setArchiveDayFilters(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${archiveDayFilters.includes(day) ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>{arabicDays[day]}</button>
               )
            })}
          </div>
        )}
        {archiveFilter === 'custom' && (
          <div className="grid grid-cols-2 gap-2 animate-fade-in">
            <div><label className="block text-[10px] text-gray-400 font-bold mb-0.5">من تاريخ</label><input type="date" value={archiveStartDate} onChange={(e) => setArchiveStartDate(e.target.value)} className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]" /></div>
            <div><label className="block text-[10px] text-gray-400 font-bold mb-0.5">إلى تاريخ</label><input type="date" value={archiveEndDate} onChange={(e) => setArchiveEndDate(e.target.value)} className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]" /></div>
          </div>
        )}
        {archiveFilter !== 'all' && (
          <div className="flex gap-2">
            <button type="button" onClick={() => {
              const filterLabel = archiveFilter === 'daily' ? 'يومي' : archiveFilter === 'weekly' ? 'أسبوعي' : archiveFilter === 'monthly' ? 'شهري' : 'مخصص';
              const total = filteredArchiveExtraPayments.reduce((s, p) => s + p.amount, 0);
              let html = `<html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body>
              <div style="padding:12mm 14mm">
                <div class="rh">
                  <h1>سجل الدفعات المؤرشفة — فلتر: ${filterLabel}</h1>
                  <div class="sub">نظام التوزيع والمبيعات المعتمد</div>
                  <div class="ref">
                    <span>عدد الدفعات: ${filteredArchiveExtraPayments.length}</span>
                    <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
                <table><thead><tr><th>م</th><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>المندوب</th><th>المستلم</th></tr></thead><tbody>
                ${filteredArchiveExtraPayments.map((p, i) => `<tr><td style="text-align:center">${i + 1}</td><td style="text-align:center">${p.date}</td><td style="text-align:right">${p.notes || 'تسديد مباشر'}</td><td style="text-align:center;font-weight:bold;color:#059669">${formatNum(p.amount)} ج.م</td><td style="text-align:center">${p.delegateName || '-'}</td><td style="text-align:center">${p.recipient || '-'}</td></tr>`).join('')}
                </tbody></table>
                <div class="ts" style="padding:10px 12px;border-radius:8px;display:flex;justify-content:space-between;font-weight:800;font-size:12px;margin-bottom:14px">
                  <span>إجمالي الدفعات</span>
                  <span>${formatNum(total)} ج.م</span>
                </div>
                <div class="fs" style="margin-top:30px">
                  <div class="sb2"><div class="ti">المدير المالي</div><div class="ln">التوقيع</div></div>
                  <div class="sb2"><div class="ti">مندوب المبيعات</div><div class="ln">التوقيع</div></div>
                </div>
              </div>
              </body></html>`;
              const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
            }} className="flex-1 bg-indigo-700 hover:bg-indigo-800 text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"><Printer className="h-3 w-3" /> PDF</button>
            <button type="button" onClick={() => {
              const filterLabel = archiveFilter === 'daily' ? 'يومي' : archiveFilter === 'weekly' ? 'أسبوعي' : archiveFilter === 'monthly' ? 'شهري' : 'مخصص';
              const total = filteredArchiveExtraPayments.reduce((s, p) => s + p.amount, 0);
              const W = 700; const padX = 20; const rowH = 32; const headerH = 80; const footerH = 40;
              const totalH = headerH + 10 + filteredArchiveExtraPayments.length * rowH + 50 + footerH + 20;
              const canvas = document.createElement('canvas'); const TARGET_W = 3840; const dpr = Math.max(window.devicePixelRatio || 1, TARGET_W / W);
              canvas.width = W * dpr; canvas.height = totalH * dpr; canvas.style.width = W + 'px'; canvas.style.height = totalH + 'px';
              const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(dpr, dpr);
              ctx.fillStyle = '#faf8f5'; ctx.fillRect(0, 0, W, totalH); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, W - 12, totalH - 12);
              ctx.fillStyle = '#1e2a4a'; ctx.fillRect(10, 10, W - 20, headerH); ctx.fillStyle = '#d4a843'; ctx.fillRect(10, 10 + headerH - 3, W - 20, 3);
              ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 18px system-ui, sans-serif';
              ctx.fillText(`سجل الدفعات المؤرشفة — فلتر: ${filterLabel}`, W / 2, 40);
              ctx.font = '500 11px system-ui, sans-serif'; ctx.fillStyle = '#93c5fd';
              ctx.fillText(`${filteredArchiveExtraPayments.length} دفعة | إجمالي: ${formatNum(total)} ج.م`, W / 2, 58);
              ctx.font = '10px system-ui, sans-serif'; ctx.fillStyle = '#cbd5e1';
              ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}`, W / 2, 72);
              let y = headerH + 15;
              ctx.fillStyle = '#1e2a4a'; ctx.fillRect(padX, y, W - padX * 2, 20); ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
              const cols = [padX + 20, padX + 100, padX + 250, padX + 370, padX + 470, padX + 560];
              ['م', 'التاريخ', 'البيان', 'المبلغ', 'المندوب', 'المستلم'].forEach((h, i) => { ctx.fillText(h, cols[i] + 40, y + 14); });
              y += 22;
              filteredArchiveExtraPayments.forEach((p, i) => {
                ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
                ctx.fillRect(padX, y, W - padX * 2, rowH); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5; ctx.strokeRect(padX, y, W - padX * 2, rowH);
                ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.font = '10px system-ui, sans-serif';
                ctx.fillText(String(i + 1), cols[0] + 40, y + 20); ctx.fillText(p.date || '', cols[1] + 40, y + 20);
                ctx.textAlign = 'right'; ctx.fillText(p.notes || 'تسديد مباشر', cols[2] + 80, y + 20);
                ctx.fillStyle = '#059669'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(`${formatNum(p.amount)} ج.م`, cols[3] + 40, y + 20);
                ctx.fillStyle = '#1a1a1a'; ctx.font = '10px system-ui, sans-serif';
                ctx.fillText(p.delegateName || '-', cols[4] + 40, y + 20); ctx.fillText(p.recipient || '-', cols[5] + 40, y + 20);
                y += rowH;
              });
              y += 5; ctx.fillStyle = '#1e2a4a'; ctx.fillRect(padX, y, W - padX * 2, 30); ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
              ctx.fillText(`إجمالي الدفعات: ${formatNum(total)} ج.م`, W / 2, y + 20);
              y += 40; ctx.fillStyle = '#94a3b8'; ctx.font = '10px system-ui, sans-serif';
              ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);
              const link = document.createElement('a'); link.download = `دفعات_مؤرشفة_${filterLabel}_${new Date().toISOString().substring(0, 10)}.png`;
              link.href = canvas.toDataURL('image/png'); link.click();
            }} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"><Image className="h-3 w-3" /> صورة</button>
          </div>
        )}
        <div className="max-h-40 overflow-y-auto custom-scroll flex flex-col gap-2">
          {filteredArchiveExtraPayments.map(pay => (
            <div key={pay.id} className="bg-[#F7FAFC] border border-slate-100 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-[#1A365D] shadow-inner">
              {editingPaymentId === pay.id ? (
                <div className="flex flex-col gap-2 w-full p-2 bg-indigo-50/40 rounded-lg border border-indigo-100 animate-fade-in text-right">
                  <div className="flex gap-2">
                    <div className="w-1/3 flex flex-col gap-1">
                      <label className="text-[9px] text-slate-500 font-bold">مبلغ السداد:</label>
                      <input type="number" placeholder="المبلغ" value={editingPaymentAmount} onChange={(e) => setEditingPaymentAmount(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div className="w-2/3 flex flex-col gap-1">
                      <label className="text-[9px] text-slate-500 font-bold">البيان / ملاحظات:</label>
                      <input type="text" placeholder="البيان" value={editingPaymentNotes} onChange={(e) => setEditingPaymentNotes(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-1">
                    <button type="button" onClick={() => setEditingPaymentId(null)} className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold cursor-pointer transition-all active:scale-95">إلغاء</button>
                    <button type="button" onClick={() => {
                      const newAmount = parseFloat(editingPaymentAmount);
                      if (!newAmount || newAmount <= 0) { showToast("⚠️ يرجى إدخال قيمة صحيحة!"); return; }
                      const oldAmount = pay.amount;
                      const diff = newAmount - oldAmount;
                      setArchiveCycles(prev => {
                        const next = prev.map(c => {
                          const updatedPayments = (c.payments || []).map((p: any) => p.id === pay.id ? { ...p, amount: newAmount, notes: editingPaymentNotes || p.notes } : p);
                          const totalPayments = updatedPayments.reduce((s: number, p: any) => s + ((p.amount || 0) - ((p as any).appliedToCarriedDebt || 0)), 0);
                          return { ...c, payments: updatedPayments, totalAdvancePayments: totalPayments };
                        });
                        return next;
                      });
                      setEditingPaymentId(null);
                      showToast(diff > 0 ? `✓ تم تعديل الدفعة. المصنع مدين بـ ${formatNum(diff)} ج.م إضافية` : diff < 0 ? `✓ تم تعديل الدفعة. تم خصم ${formatNum(Math.abs(diff))} ج.م من المصنع` : '✓ تم تعديل الدفعة!');
                    }} className="px-3 py-1 rounded bg-[#DD6B20] hover:bg-[#C05621] text-white text-[10px] font-bold cursor-pointer transition-all active:scale-95">حفظ</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#DD6B20] font-extrabold">{Number(pay.amount).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    <span className="text-[10px] text-[#2B6CB0] font-medium">{pay.date}</span>
                    <span className="text-[9.5px] text-slate-600 leading-relaxed">📝 {pay.notes || 'تسديد مباشر'}{pay.delegateName ? ` • 👤 ${pay.delegateName}` : ''}</span>
                    {pay.recipient ? <span className="text-[9px] text-indigo-600">👤 مستلم: السيد / {pay.recipient}</span> : null}
                    {(pay.appliedToCarriedDebt || 0) > 0 && <span className="text-[9px] text-amber-600">🔄 مسدد من المديونية السابقة: {Number(pay.appliedToCarriedDebt).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => { setEditingPaymentId(pay.id); setEditingPaymentAmount(String(pay.amount)); setEditingPaymentNotes(pay.notes || ''); setEditingPaymentRecipient(pay.recipient || ''); }} className="text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 p-1.5 rounded-lg border border-slate-200 cursor-pointer transition-all active:scale-95" title="تعديل"><Edit className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={async () => {
                      const confirmed = await confirmDialog(`هل تريد حذف هذه الدفعة بقيمة ${formatNum(pay.amount)}ج.م؟\n⚠️ سيتم خصم هذا المبلغ من إجمالي الدفعات (الم_factory سيصبح مديناً بهذا المبلغ).`);
                      if (!confirmed) return;
                      setArchiveCycles(prev => {
                        const next = prev.map(c => {
                          const updatedPayments = (c.payments || []).filter((p: any) => p.id !== pay.id);
                          const totalPayments = updatedPayments.reduce((s: number, p: any) => s + ((p.amount || 0) - ((p as any).appliedToCarriedDebt || 0)), 0);
                          return { ...c, payments: updatedPayments, totalAdvancePayments: totalPayments };
                        });
                        return next;
                      });
                      showToast(`✓ تم حذف الدفعة. الم_factory مدين بـ ${formatNum(pay.amount)} ج.م`);
                    }} className="text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 p-1.5 rounded-lg border border-slate-200 cursor-pointer transition-all active:scale-95" title="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
    
    {/* Invoice-like summary for Factory Archive */}
    {filteredLoads.length > 0 && (() => {
      let totalLoadedCrates = 0;
      let totalSoldCrates = 0;
      let totalRemainingCrates = 0;
      let totalSoldValue = 0;
      filteredLoads.forEach(l => {
        const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
        const weights = prod ? getProductWeightsFallback(prod) : [];
        const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim()) || weights[0];
        const unitsPerCarton = weight?.unitsPerCarton || 12;
        const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor(l.quantity / unitsPerCarton);
        const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) : 0) || 0);
        const key = `${l.productId}_${l.weightId || (weight ? weight.id : '')}`;
        const stock = weightStocks[key] || { loaded: 0, sold: 0, remaining: 0 };
        const soldCartons = Math.floor(stock.sold / unitsPerCarton);
        const remainingCartons = Math.max(0, cartons - soldCartons);
        totalLoadedCrates += cartons;
        totalSoldCrates += soldCartons;
        totalRemainingCrates += remainingCartons;
        totalSoldValue += soldCartons * cartonPrice;
      });
      const totalAdvance = filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0);
      const totalDirectPayments = filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
      const totalPaid = totalAdvance + totalDirectPayments;
      const remainingDue = Math.max(0, totalSoldValue - totalPaid);
      return (
      <div className="mt-4 bg-[#1A365D] text-white border-transparent text-white p-5 rounded-2xl flex flex-col gap-3 shadow-md">
        <h3 className="text-center font-bold text-sm border-b border-slate-700 pb-2 mb-1">ملخص حساب الأرشيف المفلتر</h3>
        
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/10 rounded-xl p-2">
            <span className="text-[9px] text-blue-200 font-bold block">المحمل</span>
            <span className="text-sm font-black">{totalLoadedCrates.toLocaleString('ar-EG')}</span>
            <span className="text-[8px] text-blue-300">كرتونة</span>
          </div>
          <div className="bg-white/10 rounded-xl p-2">
            <span className="text-[9px] text-blue-200 font-bold block">المبيع</span>
            <span className="text-sm font-black text-emerald-300">{totalSoldCrates.toLocaleString('ar-EG')}</span>
            <span className="text-[8px] text-blue-300">كرتونة</span>
          </div>
          <div className="bg-white/10 rounded-xl p-2">
            <span className="text-[9px] text-blue-200 font-bold block">المتبقي</span>
            <span className="text-sm font-black text-amber-300">{totalRemainingCrates.toLocaleString('ar-EG')}</span>
            <span className="text-[8px] text-blue-300">كرتونة</span>
          </div>
        </div>
        
        <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
          <span className="text-slate-300">قيمة المبيع (بعد الجرد):</span>
          <span className="font-bold font-mono">{totalSoldValue.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
        </div>
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-300">المسدد المباشر للمورد:</span>
          <span className="font-bold font-mono text-emerald-400">{totalDirectPayments.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
        </div>
        
        <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
          <span className="text-slate-300">إجمالي المسدد (مقدم + مباشر):</span>
          <span className="font-bold font-mono text-emerald-400">{totalPaid.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
        </div>
        
        <div className="flex justify-between items-center pt-1">
          <span className="font-black text-slate-100">المتبقي للمصنع:</span>
          <span className="text-lg font-black font-mono text-amber-400">{remainingDue.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
        </div>
      </div>
      );
    })()}
    </div>
    )}
    </div>
  );
}

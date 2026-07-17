import React, { useMemo, useState } from 'react';
import { SoftDeletedItem, DeletedItemType, Product, getProductWeightsFallback } from '../types';
import { Trash2, Undo2, Search, Archive, Package, Receipt, User, DollarSign, Truck, RotateCcw, Calendar, MapPin } from 'lucide-react';

interface Props {
  items: SoftDeletedItem[];
  products: Product[];
  onRestore: (item: SoftDeletedItem) => void;
  onPermanentDelete: (item: SoftDeletedItem) => void;
}

const typeLabels: Record<DeletedItemType, { label: string; icon: React.ReactNode; color: string }> = {
  factoryLoad: { label: 'حمولة', icon: <Package size={16} />, color: 'text-blue-600 bg-blue-50' },
  invoice: { label: 'فاتورة', icon: <Receipt size={16} />, color: 'text-green-600 bg-green-50' },
  expense: { label: 'مصروف/إيراد', icon: <DollarSign size={16} />, color: 'text-red-600 bg-red-50' },
  trip: { label: 'مشوار', icon: <Truck size={16} />, color: 'text-orange-600 bg-orange-50' },
  customer: { label: 'عميل', icon: <User size={16} />, color: 'text-purple-600 bg-purple-50' },
  product: { label: 'صنف', icon: <Archive size={16} />, color: 'text-teal-600 bg-teal-50' },
  archiveCycle: { label: 'دورة أرشيف', icon: <RotateCcw size={16} />, color: 'text-amber-600 bg-amber-50' },
};

export default function SoftDeletedArchive({ items, products, onRestore, onPermanentDelete }: Props) {
  const [filterType, setFilterType] = useState<DeletedItemType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getLoadCartonsCount = (load: any) => {
    if (!load) return 0;
    const qty = Number(load.quantity || 0);
    const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
    if (!prod) return Number((qty / 12).toFixed(3));
    const weights = getProductWeightsFallback(prod);
    const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
    const upc = weight?.unitsPerCarton || 12;
    return Number((qty / upc).toFixed(3));
  };

  const getCleanExpenseLabel = (item: SoftDeletedItem) => {
    const rawLabel = item.label || '';
    if (rawLabel.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawLabel);
        return parsed.notes || parsed.description || parsed.reason || 'سداد للمصنع';
      } catch (e) {
        // ignore
      }
    }
    const desc = item.data?.description || '';
    if (desc.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(desc);
        return parsed.notes || parsed.description || parsed.reason || 'سداد للمصنع';
      } catch (e) {
        // ignore
      }
    }
    return rawLabel;
  };

  const getCleanLabel = (item: SoftDeletedItem) => {
    if (item.type === 'factoryLoad') {
      const load = item.data;
      if (load) {
        const cartons = getLoadCartonsCount(load);
        const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
        const weights = prod ? getProductWeightsFallback(prod) : [];
        const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
        const wSize = weight?.size || load.weightSize || '';
        return `حمولة ${load.productName || prod?.name || 'غير معروفة'} (${wSize}) - ${cartons} كرتونة`;
      }
    }
    if (item.type === 'expense') {
      return getCleanExpenseLabel(item);
    }
    return item.label || `عنصر محذوف (${item.originalId})`;
  };

  const filtered = useMemo(() => {
    let filtered = items;
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(item => {
        const cleanLabel = getCleanLabel(item).toLowerCase();
        return cleanLabel.includes(q) || item.originalId.toLowerCase().includes(q);
      });
    }
    return filtered;
  }, [items, filterType, searchQuery, products]);

  const grouped = useMemo(() => {
    const grouped = new Map<DeletedItemType, SoftDeletedItem[]>();
    filtered.forEach(item => {
      if (!grouped.has(item.type)) grouped.set(item.type, []);
      grouped.get(item.type)!.push(item);
    });
    return grouped;
  }, [filtered]);

  return (
    <div className="w-full max-w-5xl mx-auto p-2 sm:p-4 touch-pan-y scroll-smooth">
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 size={22} className="text-red-500" />
          <h2 className="text-base sm:text-lg font-black text-slate-800">الأرشيف الممسوح</h2>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">{items.length}</span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Trash2 size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold text-sm">لا توجد عناصر في سلة المحذوفات</p>
            <p className="text-xs mt-1">عند حذف أي عنصر سيظهر هنا، يمكنك استعادته أو حذفه نهائياً</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث في المحذوفات..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200 text-right"
                  dir="rtl"
                />
              </div>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as DeletedItemType | 'all')}
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200 bg-white cursor-pointer text-right"
                dir="rtl"
              >
                <option value="all">جميع الأنواع</option>
                {Object.entries(typeLabels).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([type, typeItems]) => (
                <div key={type} className="border border-slate-100 rounded-2xl p-3 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 mb-3 px-1">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${typeLabels[type]?.color || 'text-slate-600 bg-slate-50'}`}>
                      {typeLabels[type]?.icon}
                      {typeLabels[type]?.label}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">({typeItems.length})</span>
                  </div>
                  <div className="space-y-2.5">
                    {typeItems.map(item => {
                      const cleanLabel = getCleanLabel(item);
                      let parsedDetails: any = {};
                      try {
                        if (item.type === 'expense' && (item.data?.description || '').trim().startsWith('{')) {
                          parsedDetails = JSON.parse(item.data.description);
                        }
                      } catch {}

                      return (
                        <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white rounded-xl p-4 border border-slate-200 hover:border-red-200 transition-colors shadow-xs">
                          <div className="flex-1 min-w-0 text-right" dir="rtl">
                            <p className="text-sm font-black text-indigo-950 mb-1 leading-relaxed">
                              {cleanLabel}
                            </p>
                            
                            {/* Metadata details rendering */}
                            {item.type === 'factoryLoad' && item.data && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10.5px] font-bold text-slate-500 border-t border-slate-100 pt-2">
                                <span className="flex items-center gap-1">
                                  <Calendar size={13} className="text-slate-400" />
                                  التاريخ الأصلي: {new Date(item.data.date).toLocaleDateString('ar-EG')}
                                </span>
                                {item.data.delegateName && (
                                  <span className="flex items-center gap-1">
                                    <User size={13} className="text-slate-400" />
                                    المندوب: {item.data.delegateName.replace(/ \(.*?\)/g, '').trim()}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Package size={13} className="text-slate-400" />
                                  الكمية الدقيقة: {getLoadCartonsCount(item.data)} كرتونة
                                </span>
                              </div>
                            )}

                            {item.type === 'expense' && item.data && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10.5px] font-bold text-slate-500 border-t border-slate-100 pt-2">
                                <span className="flex items-center gap-1">
                                  <Calendar size={13} className="text-slate-400" />
                                  تاريخ المصروف: {new Date(item.data.date).toLocaleDateString('ar-EG')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Archive size={13} className="text-slate-400" />
                                  التصنيف: {item.data.category}
                                </span>
                                <span className="flex items-center gap-1 text-rose-600 font-extrabold">
                                  <DollarSign size={13} className="text-rose-500" />
                                  القيمة: {Number(item.data.amount).toLocaleString('ar-EG')} ج.م
                                </span>
                                <span className="flex items-center gap-1">
                                  <User size={13} className="text-slate-400" />
                                  اسم المسجل: {item.data.delegateName?.replace(/ \(.*?\)/g, '').trim() || 'المدير العام'}
                                </span>
                                {parsedDetails.location && (
                                  <span className="flex items-center gap-1 text-indigo-600">
                                    <MapPin size={13} className="text-indigo-400" />
                                    📍 مكان الاستلام: {parsedDetails.location}
                                  </span>
                                )}
                              </div>
                            )}

                            {item.type !== 'factoryLoad' && item.type !== 'expense' && (
                              <p className="text-[10px] text-slate-400 font-medium mt-1">
                                تاريخ الحذف: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString('ar-EG') : 'غير معروف'}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0 justify-end mt-1 md:mt-0">
                            <button
                              type="button"
                              onClick={() => onRestore(item)}
                              className="flex-1 md:flex-initial flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer active:scale-95"
                            >
                              <Undo2 size={14} />
                              استعادة
                            </button>
                            <button
                              type="button"
                              onClick={() => onPermanentDelete(item)}
                              className="flex-1 md:flex-initial flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-black bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-all cursor-pointer active:scale-95"
                            >
                              <Trash2 size={14} />
                              حذف نهائي
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

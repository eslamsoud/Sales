import React, { useMemo, useState } from 'react';
import { SoftDeletedItem, DeletedItemType } from '../types';
import { Trash2, Undo2, Search, Archive, Package, Receipt, User, DollarSign, Truck, RotateCcw, AlertTriangle, Filter } from 'lucide-react';

interface Props {
  items: SoftDeletedItem[];
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

export default function SoftDeletedArchive({ items, onRestore, onPermanentDelete }: Props) {
  const [filterType, setFilterType] = useState<DeletedItemType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const grouped = useMemo(() => {
    let filtered = items;
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(item =>
        (item.label || '').toLowerCase().includes(q) ||
        item.originalId.toLowerCase().includes(q)
      );
    }
    const grouped = new Map<DeletedItemType, SoftDeletedItem[]>();
    filtered.forEach(item => {
      if (!grouped.has(item.type)) grouped.set(item.type, []);
      grouped.get(item.type)!.push(item);
    });
    return grouped;
  }, [items, filterType, searchQuery]);

  return (
    <div className="w-full max-w-5xl mx-auto p-2 sm:p-4">
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
                  className="w-full pr-9 pl-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as DeletedItemType | 'all')}
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
              >
                <option value="all">جميع الأنواع</option>
                {Object.entries(typeLabels).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {Array.from(grouped.entries()).map(([type, typeItems]) => (
                <div key={type}>
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${typeLabels[type]?.color || 'text-slate-600 bg-slate-50'}`}>
                      {typeLabels[type]?.icon}
                      {typeLabels[type]?.label}
                    </span>
                    <span className="text-xs text-slate-400">({typeItems.length})</span>
                  </div>
                  <div className="space-y-2">
                    {typeItems.map(item => (
                      <div key={item.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100 hover:border-red-200 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">
                            {item.label || `عنصر محذوف (${item.originalId})`}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            تاريخ الحذف: {item.deletedAt ? new Date(item.deletedAt).toLocaleString('ar-EG') : 'غير معروف'}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onRestore(item)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                          >
                            <Undo2 size={14} />
                            استعادة
                          </button>
                          <button
                            type="button"
                            onClick={() => onPermanentDelete(item)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                            حذف نهائي
                          </button>
                        </div>
                      </div>
                    ))}
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

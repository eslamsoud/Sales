import React from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle } from 'lucide-react';

export const confirmDialog = (message: string, isDestructive = true): Promise<boolean> => {
  return new Promise((resolve) => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);

    const cleanup = () => {
      root.unmount();
      if (div.parentNode) {
        div.parentNode.removeChild(div);
      }
    };

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    root.render(
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
        <div className="bg-[#FFFFFF] rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden scale-in duration-200">
          <div className="p-5 flex flex-col gap-3">
            <div className={`flex items-center gap-3 ${isDestructive ? 'text-rose-600' : 'text-[#DD6B20]'}`}>
              <AlertCircle className="h-6 w-6" />
              <h3 className="font-extrabold text-lg">تأكيد الإجراء</h3>
            </div>
            <p className="text-[#1A365D] text-sm font-bold pr-9">{message}</p>
          </div>
          <div className="bg-[#F7FAFC] px-5 py-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-[#1A365D] hover:bg-slate-200 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all cursor-pointer ${isDestructive ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-[#1A365D] hover:bg-indigo-900 text-white'}`}
            >
              موافق
            </button>
          </div>
        </div>
      </div>
    );
  });
};

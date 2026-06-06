// @ts-nocheck
import React, { useState } from 'react';
import { ArrowRight, Moon, Sun, Globe } from 'lucide-react';
import { showToast } from '../utils/toast';

interface PersonalSettingsProps {
  onGoBack: () => void;
}

export default function PersonalSettingsTab({ onGoBack }: PersonalSettingsProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const [lang, setLang] = useState<'ar' | 'en'>(() => document.documentElement.dir === 'ltr' ? 'en' : 'ar');

  const toggleTheme = (selectedTheme: 'light' | 'dark') => {
    setTheme(selectedTheme);
    if (selectedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('app_theme', 'dark');
      showToast('✓ تم تفعيل الوضع الداكن بنجاح');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('app_theme', 'light');
      showToast('✓ تم تفعيل الوضع الفاتح بنجاح');
    }
  };

  const handleLanguageChange = (selectedLang: 'ar' | 'en') => {
    setLang(selectedLang);
    if (selectedLang === 'en') {
      document.documentElement.dir = 'ltr';
      localStorage.setItem('app_lang', 'en');
      showToast('✓ Language updated to English');
    } else {
      document.documentElement.dir = 'rtl';
      localStorage.setItem('app_lang', 'ar');
      showToast('✓ تم تحديث اللغة إلى العربية بنجاح');
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in text-right" dir={document.documentElement.dir || "rtl"}>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onGoBack}
          className="bg-white text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-black text-[#1A365D]">الإعدادات الشخصية</h2>
      </div>

      <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 dark:bg-slate-800 dark:border-slate-700">
        <h3 className="font-bold text-[#1A365D] text-sm border-b border-slate-100 pb-2 flex items-center gap-1.5 dark:text-indigo-400 dark:border-slate-700">
          <Moon className="h-4.5 w-4.5 text-[#2B6CB0] dark:text-indigo-400" />
          مظهر التطبيق
        </h3>
        <p className="text-xs text-slate-500 mb-2 leading-relaxed dark:text-slate-400">
          اختر وضع العرض المناسب لظروف الإضاءة أثناء عملك الميداني (يتم التطبيق فوراً عند الضغط):
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => toggleTheme('light')}
            className={`py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
              theme === 'light' ? 'bg-indigo-50 border-[#1A365D] text-[#1A365D]' : 'bg-transparent border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-400'
            }`}
          >
            <Sun className="h-5 w-5" />
            الوضع الفاتح
          </button>
          
          <button
            onClick={() => toggleTheme('dark')}
            className={`py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
              theme === 'dark' ? 'bg-indigo-800 border-indigo-400 text-white' : 'bg-transparent border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-400'
            }`}
          >
            <Moon className="h-5 w-5" />
            الوضع الداكن
          </button>
        </div>
      </div>

      <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 dark:bg-slate-800 dark:border-slate-700">
        <h3 className="font-bold text-[#1A365D] text-sm border-b border-slate-100 pb-2 flex items-center gap-1.5 dark:text-indigo-400 dark:border-slate-700">
          <Globe className="h-4.5 w-4.5 text-[#2B6CB0] dark:text-indigo-400" />
          لغة العرض
        </h3>
        
        <p className="text-xs text-slate-500 mb-2 leading-relaxed dark:text-slate-400">
          اختر لغة واجهة المستخدم المفضلة لديك (يتم التطبيق فوراً عند الاختيار):
        </p>
        
        <select
          value={lang}
          onChange={(e) => handleLanguageChange(e.target.value as any)}
          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-3 px-3 text-sm font-bold text-[#1A365D] focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
        >
          <option value="ar">العربية (Arabic)</option>
          <option value="en">English (الإنجليزية)</option>
        </select>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Customer, Invoice, Expense, FactoryLoad, AppSettings, Trip, UserAuth } from './types';
import { AnimatePresence, motion } from 'motion/react';
import { showToast, toastEvent } from './utils/toast';
import {
  getStoredData,
  setStoredData,
  DEFAULT_PRODUCTS,
  DEFAULT_CUSTOMERS,
  DEFAULT_FACTORY_LOADS,
  DEFAULT_INVOICES,
  DEFAULT_EXPENSES,
  DEFAULT_SETTINGS
} from './utils/storage';

// Import newly created tab components
import Dashboard from './components/Dashboard';
import FactoryTab from './components/FactoryTab';
import CustomersTab from './components/CustomersTab';
import PricesTab from './components/PricesTab';
import ExpensesTab from './components/ExpensesTab';
import ManageTab from './components/ManageTab';
import ReportsTab from './components/ReportsTab';
import InvoiceTab from './components/InvoiceTab';
import AuthGate from './components/AuthGate';
import AiChatAssistant from './components/AiChatAssistant';
import { Lock, Fingerprint, Key, ShieldAlert, CheckCircle, RefreshCw, Save, LogOut, MessageCircle, Bell, Moon, Sun } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [customToast, setCustomToast] = useState<{message: string, id: number} | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark-theme');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleShowToast = (e: any) => {
      setCustomToast({ message: e.detail, id: Date.now() });
      setTimeout(() => setCustomToast(null), 5000);
    };
    toastEvent.addEventListener('show-toast', handleShowToast);
    return () => toastEvent.removeEventListener('show-toast', handleShowToast);
  }, []);

  // Inactivity and Timeout states (5 min)
  const [isLockedByTimeout, setIsLockedByTimeout] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [lockPassword, setLockPassword] = useState('');
  const [lockError, setLockError] = useState('');
  const [isHeaderSyncing, setIsHeaderSyncing] = useState(false);
  const [pendingAutoSync, setPendingAutoSync] = useState(false);

  const handleUnlockWithPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLockError('');

    if (!currentUser) return;

    // Check if user is a guest visitor with direct access (no password)
    const isCustomer = currentUser.phone === 'guest_visitor';
    if (isCustomer) {
      setIsLockedByTimeout(false);
      setLockPassword('');
      setLastActivity(Date.now());
      alert(`مرحباً بك يا ${currentUser.name}`);
      return;
    }

    const entered = lockPassword.trim();
    const correct = currentUser.phone === '01228466613'
      ? (localStorage.getItem('owner_passcode_sys') || '1987')
      : (currentUser.password || '1234');

    if (entered === correct) {
      setIsLockedByTimeout(false);
      setLockPassword('');
      setLastActivity(Date.now());
      alert(`مرحباً بك يا ${currentUser.name}`);
    } else {
      setLockError('رمز المرور الشخصي غير صحيح!');
    }
  };

  // Authentication & Security State
  const [usersList, setUsersList] = useState<UserAuth[]>(() => {
    const raw = localStorage.getItem('users_permissions_sys');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [currentUser, setCurrentUser] = useState<UserAuth | null>(() => {
    const loggedPhone = localStorage.getItem('authed_user_phone');
    if (loggedPhone) {
      const raw = localStorage.getItem('users_permissions_sys');
      if (raw) {
        try {
          const list: UserAuth[] = JSON.parse(raw);
          return list.find(u => u.phone === loggedPhone && u.status === 'active') || null;
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  const handleUpdateUsersList = (newUsers: UserAuth[]) => {
    setUsersList(newUsers);
    localStorage.setItem('users_permissions_sys', JSON.stringify(newUsers));
    
    // Manage real-time active session reflecting any administrative toggles
    const loggedPhone = localStorage.getItem('authed_user_phone');
    if (loggedPhone) {
      const found = newUsers.find(u => u.phone === loggedPhone);
      if (found) {
        if (found.status !== 'active') {
          // If deactivated, they slide out immediately
          setCurrentUser(null);
        } else {
          setCurrentUser(found);
        }
      } else {
        setCurrentUser(null);
      }
    }
  };

  // CORE STATE
  const [products, setProducts] = useState<Product[]>(() => getStoredData('products_sys', DEFAULT_PRODUCTS));
  const [factoryLoads, setFactoryLoads] = useState<FactoryLoad[]>(() => getStoredData('factory_sys', DEFAULT_FACTORY_LOADS));
  const [customers, setCustomers] = useState<Customer[]>(() => getStoredData('customers_sys', DEFAULT_CUSTOMERS));
  const [invoices, setInvoices] = useState<Invoice[]>(() => getStoredData('invoices_sys', DEFAULT_INVOICES));
  const [expenses, setExpenses] = useState<Expense[]>(() => getStoredData('expenses_sys', DEFAULT_EXPENSES));
  const [trips, setTrips] = useState<Trip[]>(() => getStoredData('trips_sys', []));
  const [settings, setSettings] = useState<AppSettings>(() => getStoredData('settings_sys', DEFAULT_SETTINGS));

  const [showScrollTop, setShowScrollTop] = useState(false);

  // Inactivity tracking (Auto-lock after 5 minutes of no keyboard/mouse/touch)
  useEffect(() => {
    if (!currentUser) return;

    const handleUserActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    const interval = setInterval(() => {
      const inactiveDelta = Date.now() - lastActivity;
      if (inactiveDelta >= 5 * 60 * 1000) { // 5 minutes 
        setIsLockedByTimeout(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      clearInterval(interval);
    };
  }, [currentUser, lastActivity]);

  // --- REAL LIVE GPS TRACKING (تتبع حقيقي للمندوب) ---
  useEffect(() => {
    // لا نتتبع المدير العام، نتتبع المندوبين فقط
    if (!currentUser || currentUser.role === 'owner' || currentUser.phone === 'guest_visitor') return;

    let watchId: number;
    const sendLiveLocation = async (pos: GeolocationPosition) => {
      let batteryLevel = 'غير متوفر';
      try {
        const nav = navigator as any;
        if (nav.getBattery) {
          const battery = await nav.getBattery();
          batteryLevel = Math.round(battery.level * 100) + '%';
        }
      } catch (e) {}

      const speedKmH = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;

      const newPoint = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed: speedKmH,
        battery: batteryLevel,
        timestamp: new Date().toISOString()
      };

      // Load offline points from Black Box
      let offlinePoints = [];
      try { offlinePoints = JSON.parse(localStorage.getItem('offline_gps_route_sys') || '[]'); } catch(e) {}
      offlinePoints.push(newPoint);
      // Limit local storage to last 500 points to save space offline
      if (offlinePoints.length > 500) offlinePoints = offlinePoints.slice(-500);

      if (navigator.onLine) {
        try {
          await fetch('/api/tracking/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: currentUser.phone,
              points: offlinePoints // Send bulk points
            })
          });
          // Clear black box if synced successfully
          localStorage.setItem('offline_gps_route_sys', '[]');
        } catch (e) {
          localStorage.setItem('offline_gps_route_sys', JSON.stringify(offlinePoints));
        }
      } else {
        // Just save locally if offline
        localStorage.setItem('offline_gps_route_sys', JSON.stringify(offlinePoints));
      }
    };

    if (navigator.geolocation) {
       watchId = navigator.geolocation.watchPosition(sendLiveLocation, () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 });
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [currentUser]);

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync state changes with localStorage
  useEffect(() => {
    setStoredData('products_sys', products);
  }, [products]);

  useEffect(() => {
    setStoredData('factory_sys', factoryLoads);
  }, [factoryLoads]);

  useEffect(() => {
    setStoredData('customers_sys', customers);
  }, [customers]);

  useEffect(() => {
    setStoredData('invoices_sys', invoices);
  }, [invoices]);

  useEffect(() => {
    setStoredData('expenses_sys', expenses);
  }, [expenses]);

  useEffect(() => {
    setStoredData('trips_sys', trips);
  }, [trips]);

  useEffect(() => {
    setStoredData('settings_sys', settings);
  }, [settings]);

  // Operations handlers
  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    const id = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setProducts(prev => [{ ...newProd, id }, ...prev]);
  };

  const handleEditProduct = (updatedProd: Product) => {
    setProducts(products.map(p => p.id === updatedProd.id ? updatedProd : p));
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
    // Also delete loads corresponding to it to preserve data honesty
    setFactoryLoads(factoryLoads.filter(load => load.productId !== id));
  };

  const handleDeleteAllProducts = () => {
    setProducts([]);
    setFactoryLoads([]);
  };

  const handleAddLoad = (newLoad: Omit<FactoryLoad, 'id'>) => {
    const id = `load-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setFactoryLoads(prev => [...prev, { ...newLoad, id }]);
  };

  const handleDeleteLoad = (id: string) => {
    setFactoryLoads(factoryLoads.filter(load => load.id !== id));
  };

  const handleAddCustomer = (newCustomer: Omit<Customer, 'id'>) => {
    const id = `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setCustomers(prev => [...prev, { ...newCustomer, id }]);
  };

  const handleEditCustomer = (editedCustomer: Customer) => {
    setCustomers(customers.map(c => c.id === editedCustomer.id ? editedCustomer : c));
  };

  const handleDeleteCustomer = (id: string) => {
    setCustomers(customers.filter(c => c.id !== id));
  };

  // مراقبة العمليات الجديدة لرفع نسخة سحابية صامتة في الخلفية
  useEffect(() => {
    if (pendingAutoSync) {
      syncAllDataToGoogle(true).catch(e => console.error('Silent auto-sync failed:', e));
      setPendingAutoSync(false);
    }
  }, [invoices, expenses, pendingAutoSync]);

  const handleAddInvoice = (newInvoice: Omit<Invoice, 'id'>) => {
    const id = `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setInvoices(prev => [...prev, { ...newInvoice, id }]);
    setPendingAutoSync(true); // تفعيل الحفظ التلقائي
  };

  const handleAddExpense = (newExpense: Omit<Expense, 'id'>) => {
    const id = `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setExpenses(prev => [...prev, { ...newExpense, id }]);
    setPendingAutoSync(true); // تفعيل الحفظ التلقائي
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const handleAddTrip = (newTrip: Omit<Trip, 'id'>) => {
    const id = `trip-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setTrips(prev => [...prev, { ...newTrip, id }]);
  };

  const handleToggleCollected = (id: string) => {
    setTrips(trips.map(t => t.id === id ? { ...t, collected: !t.collected } : t));
  };

  const handleEditTrip = (id: string, updates: Partial<Omit<Trip, 'id'>>) => {
    setTrips(trips.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleDeleteTrip = (id: string) => {
    setTrips(trips.filter(t => t.id !== id));
  };

  const handleResetDatabase = (demoMode: boolean) => {
    if (demoMode) {
      setProducts(DEFAULT_PRODUCTS);
      setFactoryLoads(DEFAULT_FACTORY_LOADS);
      setCustomers(DEFAULT_CUSTOMERS);
      setInvoices(DEFAULT_INVOICES);
      setExpenses(DEFAULT_EXPENSES);
      setTrips([]);
      setSettings(DEFAULT_SETTINGS);
    } else {
      setProducts([]);
      setFactoryLoads([]);
      setCustomers([]);
      setInvoices([]);
      setExpenses([]);
      setTrips([]);
      // keep settings intact when resetting to start from scratch unless we want to reset URLs too.
      // But user wants to keep the Google Web App URL, so we don't clear settings here.
    }
    setActiveTab('dashboard');
  };

  async function syncAllDataToGoogle(silent = false): Promise<boolean> {
    if (!settings.googleSheetsUrl) {
      if (!silent) alert('تنبيه: لم يتم وضع رابط مزامنة جوجل شيت في إعدادات النظام.');
      return false;
    }

    try {
      setIsHeaderSyncing(true);

      const totalSales = invoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount || 0), 0);
      const totalSpent = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const extraRevenues = 0; 
      const netProfit = totalSales + extraRevenues - totalSpent;

      const payload = {
        type: 'تقرير_كامل',
        metadata: {
          syncedAt: new Date().toISOString(),
          app: 'نظام المبيعات والمخزون للسيارة',
          totalSales,
          totalExpenses: totalSpent,
          netProfit
        },
        invoices: invoices.map(inv => {
          const cust = customers.find(c => c.id === inv.customerId);
          return {
            invNum: inv.invoiceNumber,
            customerName: cust ? cust.name : 'عميل مجهول',
            area: cust ? cust.area : 'منطقة مجهولة',
            date: inv.date,
            total: inv.totalAfterDiscount,
            notes: inv.notes
          };
        }),
        expenses: (expenses || []).map(e => ({
          date: e.date,
          amount: e.amount,
          category: e.category,
          description: e.description
        })),
        trips: (trips || []).map(t => ({
          description: t.description,
          price: t.price,
          status: t.collected ? 'محصلة' : 'غير محصلة',
          date: t.date || new Date().toISOString()
        })),
        products: products.map(p => ({
          name: p.name,
          price: p.price,
          count: p.weights ? p.weights.length : 0
        })),
        customers: customers.map(c => ({
          name: c.name,
          phone: c.phone,
          area: c.area
        })),
        rawDatabase: {
          products,
          factoryLoads,
          customers,
          invoices,
          expenses,
          trips,
          settings,
          usersList
        }
      };

      await fetch(settings.googleSheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      setIsHeaderSyncing(false);
      return true;
    } catch (err: any) {
      console.error('Error syncing to Google Sheets from header:', err);
      setIsHeaderSyncing(false);
      return false;
    }
  }

  // Mobile Back Button interception & safe double-press EXIT logic
  const [lastBackPress, setLastBackPress] = useState<number>(0);

  useEffect(() => {
    // Keep a persistent trap state in browser history to prevent default back-button app closing
    window.history.pushState({ preventExit: true }, '');

    const handlePopState = (event: PopStateEvent) => {
      // Immediately restore the trap state to stay in control
      window.history.pushState({ preventExit: true }, '');

      if (activeTab !== 'dashboard') {
        // If they are on any other sub-tab, safely redirect back to main dashboard
        setActiveTab('dashboard');
      } else {
        // They are already on the home screen; handle sequential double-press exit confirmation
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          handleSecureExit();
        } else {
          setLastBackPress(now);
          // Show a beautiful, elegant Arabic toast notification at the bottom instead of blocking alert()
          const existingToast = document.getElementById('safe-exit-toast');
          if (existingToast) existingToast.remove();

          const toast = document.createElement('div');
          toast.id = 'safe-exit-toast';
          toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A365D] border border-[#2B4C7E] text-amber-200 font-extrabold py-3 px-6 rounded-2xl shadow-2xl text-center text-xs tracking-wide animate-bounce z-[9999] opacity-95 flex items-center justify-center gap-2 max-w-[90%]';
          toast.dir = 'rtl';
          toast.innerHTML = `⚠️ اضغط زر الرجوع مرة أخرى لتأكيد الخروج الآمن ومزامنة البيانات!`;
          
          document.body.appendChild(toast);
          setTimeout(() => {
            const el = document.getElementById('safe-exit-toast');
            if (el) el.remove();
          }, 2000);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab, lastBackPress]);

  // If the user is not authenticated or deactivated, enforce the AuthGate screen
  if (!currentUser) {
    return (
      <AuthGate
        usersList={usersList}
        customersList={customers}
        onUpdateUsers={handleUpdateUsersList}
        onSuccess={(user) => {
          setCurrentUser(user);
          setLastActivity(Date.now());
          setIsLockedByTimeout(false);
          setLockPassword('');
          setLockError('');
        }}
      />
    );
  }

  if (isLockedByTimeout) {
    const isCustomer = currentUser.phone === 'guest_visitor';

    return (
      <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-4 text-right" dir="rtl" id="timeout-lock-gate">
        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 relative overflow-hidden flex flex-col gap-4">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-[#1A365D]"></div>
          
          <div className="text-center py-1">
            <h2 className="text-[#1A365D] text-base font-black tracking-tight">تأكيد الدخول</h2>
          </div>

          <form onSubmit={handleUnlockWithPassword} className="flex flex-col gap-3.5">
            {lockError && (
              <div className="bg-red-50 border border-red-150 text-red-700 p-2 rounded-xl text-center font-bold text-xs">
                ⚠️ {lockError}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500">رقم الهاتف (الكود):</label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  dir="ltr"
                  value={currentUser.phone}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2.5 text-[#1A365D] text-center font-bold tracking-wider text-base"
                />
              </div>
            </div>

            {!isCustomer && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">الرمز السري الشخصي لفتح الحساب (الباسورد):</label>
                <div className="relative">
                  <Key className="absolute top-3 right-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="أدخل الرمز السري الشخصي الخاص بك"
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2.5 pr-10 pl-4 text-center font-bold tracking-widest text-[#1A365D] focus:outline-none focus:ring-2 focus:ring-[#1A365D] font-mono text-base"
                  />
                </div>
              </div>
            )}

            {isCustomer && (
              <div className="text-center p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-[10px] text-emerald-800 font-extrabold">✓ دخول زائر معتمد بدون رمز سري</p>
              </div>
            )}

            <div className="flex flex-col gap-2 mt-2">
              <button
                type="submit"
                className="w-full bg-[#1A365D] hover:bg-slate-800 text-white py-3 rounded-2xl text-xs font-black transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
              >
                <span>تأكيد الدخول والنشاط 🔓</span>
              </button>
            </div>
          </form>

          <div className="border-t border-slate-100 pt-2 text-center">
            <button
              onClick={() => {
                localStorage.removeItem('authed_user_phone');
                setCurrentUser(null);
                setIsLockedByTimeout(false);
                setLockPassword('');
                setLockError('');
              }}
              className="text-red-500 hover:text-red-700 hover:underline text-xs font-black cursor-pointer transition-colors"
            >
              تسجيل خروج بالكامل أو تبديل الحساب
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSecureExit() {
    const confirm = window.confirm("هل تريد تسجيل الخروج الآمن؟ سيتم مزامنة وحفظ كافة البيانات المبيعات والمنتجات والعملاء إلى جوجل شيت السحابي لضمان عدم ضياع التعديلات.");
    if (!confirm) return;

    const success = await syncAllDataToGoogle(true);
    if (success) {
      alert("تم حفظ البيانات سحابياً بنجاح! جاري الخروج الآمن...");
    } else {
      alert("تنبيه: تعذر إرسال النسخة السحابية لعدم تكوين الرابط، سيتم الخروج وحفظ البيانات محلياً.");
    }

    localStorage.removeItem('authed_user_phone');
    setCurrentUser(null);
    setIsLockedByTimeout(false);
    setLockPassword('');
    setLockError('');
  }

  async function handleManualSave() {
    const confirm = window.confirm("هل تأمل في تأكيد حفظ وترحيل كامل قاعدة البيانات الحالية لـ Google Sheets السحابي منعاً للفقدان؟");
    if (!confirm) return;

    const success = await syncAllDataToGoogle(false);
    if (success) {
      alert("✓ تم حفظ وتصدير البيانات السحابية بنجاح تام لمنع فقدان العمل.");
    } else {
      alert("❌ تعذر حفظ البيانات؛ يرجى التحقق من توفر الإنترنت أو صحة إعدادات رابط مزامنة جوجل شيت.");
    }
  }

  function handleUpdateData() {
    showToast("جاري تحديث وإعادة تهيئة التطبيق لجلب البيانات وحل أي تعليق...");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }

  return (
    <div className="bg-[#F7FAFC] min-h-screen text-[#1A365D] transition-all font-sans antialiased flex flex-col justify-between animate-fade-in" id="app-root-wrapper">
      {/* 🛡️ Secure Header Bar */}
      <header className="bg-[#1A365D] text-white py-3 px-4 shadow-md flex justify-between items-center sm:px-6" dir="rtl">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs font-black">
            {currentUser.phone === '01228466613' ? (
              <span className="text-amber-300 font-extrabold">المدير العام 👑</span>
            ) : (
              <span>
                {currentUser.phone === '01281391552' ? 'نائب المدير: ' : 'المندوب: '}
                <span className="text-amber-200">{currentUser.name}</span>
              </span>
            )}
          </span>
        </div>

        {/* Actions Button Container (Left Side in RTL due to justify-between) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            title="المستشار الميداني الذكي"
            className={`flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer shadow-sm ${
              isChatOpen ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <MessageCircle className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden sm:inline mr-1 text-[10.5px] font-black">المستشار</span>
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? "الوضع النهاري" : "الوضع الليلي"}
            className="flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer shadow-sm bg-white/10 hover:bg-white/20"
          >
            {darkMode ? <Sun className="h-4.5 w-4.5 shrink-0 text-amber-300" /> : <Moon className="h-4.5 w-4.5 shrink-0 text-slate-200" />}
          </button>

          <button
            onClick={handleUpdateData}
            title="تحديث وإعادة تشغيل في حالة التعليق"
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white px-2 py-1.5 rounded-xl text-[10.5px] font-black border border-white/5 cursor-pointer"
            style={{ fontSize: '13.5px', width: '36px', height: '33px', textAlign: 'center' }}
          >
            <RefreshCw className="shrink-0" style={{ textAlign: 'center', fontSize: '16.5px', lineHeight: '18.25px', width: '16px', height: '16px' }} />
            <span className="hidden sm:inline">تحديث</span>
          </button>

          <button
            onClick={handleManualSave}
            disabled={isHeaderSyncing}
            title="النسخ الاحتياطي وحفظ البيانات سحابياً"
            className="flex items-center justify-center bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-white p-2 rounded-xl cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Save className={`h-4.5 w-4.5 shrink-0 ${isHeaderSyncing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSecureExit}
            title="حفظ الخروج الآمن للجلسة"
            className="flex items-center justify-center bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all text-white p-2 rounded-xl cursor-pointer shadow-sm"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
          </button>
        </div>
      </header>

      <main className="flex-grow w-full">
        {activeTab === 'dashboard' && (
          <Dashboard
            products={products}
            factoryLoads={factoryLoads}
            invoices={invoices}
            permittedTabs={currentUser.permittedTabs}
            onNavigate={setActiveTab}
            currentUserPhone={currentUser.phone}
          />
        )}

        {activeTab === 'factory' && currentUser.permittedTabs.includes('factory') && (
          <FactoryTab
            products={products}
            factoryLoads={factoryLoads}
            invoices={invoices}
            trips={trips}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onDeleteAllProducts={handleDeleteAllProducts}
            onAddLoad={handleAddLoad}
            onDeleteLoad={handleDeleteLoad}
            onAddTrip={handleAddTrip}
            onEditTrip={handleEditTrip}
            onToggleTripCollected={handleToggleCollected}
            onDeleteTrip={handleDeleteTrip}
            onClearAllData={() => {
              handleResetDatabase(false);
            }}
            onGoBack={() => setActiveTab('dashboard')}
            permittedSubTabs={currentUser.permittedSubTabs}
          />
        )}

        {activeTab === 'customers' && currentUser.permittedTabs.includes('customers') && (
          <CustomersTab
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onEditCustomer={handleEditCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onGoBack={() => setActiveTab('dashboard')}
            settings={settings}
            permittedSubTabs={currentUser.permittedSubTabs}
          />
        )}

        {activeTab === 'invoice' && currentUser.permittedTabs.includes('invoice') && (
          <InvoiceTab
            customers={customers}
            products={products}
            factoryLoads={factoryLoads}
            invoices={invoices}
            onAddInvoice={handleAddInvoice}
            onUpdateInvoice={(updated) => {
              setInvoices(invoices.map(inv => inv.id === updated.id ? updated : inv));
            }}
            onGoBack={() => setActiveTab('dashboard')}
            permittedSubTabs={currentUser.permittedSubTabs}
          />
        )}

        {activeTab === 'prices' && currentUser.permittedTabs.includes('prices') && (
          <PricesTab
            products={products}
            onGoBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'expenses' && currentUser.permittedTabs.includes('expenses') && (
          <ExpensesTab
            expenses={expenses}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onGoBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'administrative' && currentUser.permittedTabs.includes('administrative') && (
          <ManageTab
            products={products}
            customers={customers}
            invoices={invoices}
            expenses={expenses}
            trips={trips}
            settings={settings}
            usersList={usersList}
            onUpdateUsersList={handleUpdateUsersList}
            currentUser={currentUser}
            onEditProduct={handleEditProduct}
            onUpdateSettings={setSettings}
            onResetDatabase={handleResetDatabase}
            onGoBack={() => setActiveTab('dashboard')}
            onRestoreData={(cloudData) => {
              if (cloudData.products) setProducts(cloudData.products);
              if (cloudData.factoryLoads) setFactoryLoads(cloudData.factoryLoads);
              if (cloudData.customers) setCustomers(cloudData.customers);
              if (cloudData.invoices) setInvoices(cloudData.invoices);
              if (cloudData.expenses) setExpenses(cloudData.expenses);
              if (cloudData.trips) setTrips(cloudData.trips);
              if (cloudData.settings) setSettings(cloudData.settings);
              if (cloudData.usersList) handleUpdateUsersList(cloudData.usersList);
            }}
          />
        )}

        {activeTab === 'reports' && currentUser.permittedTabs.includes('reports') && (
          <ReportsTab
            invoices={invoices}
            expenses={expenses}
            products={products}
            customers={customers}
            trips={trips}
            settings={settings}
            onUpdateInvoice={(updated) => {
              setInvoices(invoices.map(inv => inv.id === updated.id ? updated : inv));
            }}
            onGoBack={() => setActiveTab('dashboard')}
            permittedSubTabs={currentUser.permittedSubTabs}
          />
        )}

      </main>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-4 bg-[#DD6B20] text-white p-3 rounded-full shadow-lg z-50 hover:bg-[#C05621] transition-all transform hover:scale-110 flex items-center justify-center cursor-pointer"
          title="أعلى الصفحة"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* Humble Footer brand */}
      <footer className="text-center text-[10px] text-gray-400 py-3 mt-4 border-t border-slate-200">
        نظام إدارة المبيعات والمخزون © {new Date().getFullYear()} ملك EAGS Group
      </footer>

      <AiChatAssistant isOpen={isChatOpen} setIsOpen={setIsChatOpen} settings={settings} />

      {/* Global Custom Toast / App Alerts */}
      <AnimatePresence>
        {customToast && (
          <motion.div
            key={customToast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A365D] text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] max-w-sm w-[90%] text-center border border-slate-700 font-semibold flex items-center justify-center gap-3"
            dir="rtl"
          >
            <Bell className="w-6 h-6 text-amber-400 shrink-0 animate-pulse" />
            <span className="text-sm leading-relaxed whitespace-pre-line text-right w-full">{customToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

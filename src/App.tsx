/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Customer, Invoice, Expense, FactoryLoad, AppSettings, Trip, UserAuth } from './types';
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
import { Lock, Fingerprint, Key, ShieldAlert, CheckCircle, LogOut, RefreshCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Inactivity and Timeout states (5 min)
  const [isLockedByTimeout, setIsLockedByTimeout] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [lockPassword, setLockPassword] = useState('');
  const [lockError, setLockError] = useState('');
  
  // States for biometric scan simulation on lock screen
  const [isLockScanning, setIsLockScanning] = useState(false);
  const [lockScanStatus, setLockScanStatus] = useState('');
  const [lockScanSuccess, setLockScanSuccess] = useState(false);

  const handleUnlockWithPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLockError('');

    if (!currentUser) return;

    const entered = lockPassword.trim();
    const correct = currentUser.phone === '01228466613'
      ? (localStorage.getItem('owner_passcode_sys') || '1987')
      : (currentUser.password || '1234');

    if (entered === correct) {
      setIsLockedByTimeout(false);
      setLockPassword('');
      setLastActivity(Date.now());
    } else {
      setLockError('رمز المرور الشخصي غير صحيح!');
    }
  };

  const handleUnlockWithBiometrics = async () => {
    if (!currentUser) return;
    setLockError('');
    
    if (window.PublicKeyCredential) {
      const savedIdBase64 = localStorage.getItem(`passkey_id_${currentUser.phone}`);
      if (savedIdBase64) {
        setIsLockScanning(true);
        setLockScanStatus('ضع إصبعك على حساس قارئ البصمة الحيوية... 🖲️');

        try {
          const rawId = Uint8Array.from(atob(savedIdBase64), c => c.charCodeAt(0));
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              allowCredentials: [{ id: rawId, type: 'public-key' }],
              userVerification: "required",
              timeout: 60000
            }
          });
          
          if (assertion) {
            setLockScanSuccess(true);
            setLockScanStatus(`تم التعرف بنجاح على بصمة: ${currentUser.name} ✓`);

            setTimeout(() => {
              setIsLockScanning(false);
              setLockScanSuccess(false);
              setIsLockedByTimeout(false);
              setLastActivity(Date.now());
            }, 1000);
          }
        } catch (e) {
          console.error("Biometric verification failed:", e);
          setIsLockScanning(false);
          setLockError('تم إلغاء التحقق أو فشل قراءة البصمة.');
        }
      } else {
        setLockError('لم يتم تسجيل البصمة لهذا الحساب. يرجى الدخول بكلمة المرور لتفعيلها.');
      }
    } else {
       setLockError('جهازك لا يدعم التحقق بالبصمة.');
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
    // حماية الأرشيف: منع الحذف إذا كان الصنف مستخدماً في فواتير سابقة
    const isInUse = invoices.some(inv => inv.items.some(item => item.productId === id));
    if (isInUse) {
      alert('عذراً، لا يمكن حذف هذا المنتج نهائياً لارتباطه بفواتير مبيعات سابقة. يمكنك تعديل اسمه وتصفير كمياته بدلاً من الحذف للحفاظ على أرشيف المبيعات والتقارير.');
      return;
    }
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
    const loadToDelete = factoryLoads.find(l => l.id === id);
    if (loadToDelete) {
      const totalLoaded = factoryLoads.filter(l => l.productId === loadToDelete.productId && l.weightId === loadToDelete.weightId).reduce((sum, l) => sum + l.quantity, 0);
      let totalSold = 0;
      invoices.forEach(inv => {
        inv.items.forEach(it => {
          if (it.productId === loadToDelete.productId && it.weightId === loadToDelete.weightId) totalSold += it.quantity;
        });
      });
      // حماية جرد السيارة من الرصيد السالب
      if ((totalLoaded - loadToDelete.quantity) < totalSold) {
        alert('عذراً، لا يمكن حذف هذه الشحنة لأن الكمية المباعة منها في الفواتير تتجاوز الرصيد المتبقي بعد الحذف. سيؤدي هذا لخلل في جرد السيارة (رصيد سالب).');
        return;
      }
    }
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
    const isInUse = invoices.some(inv => inv.customerId === id);
    if (isInUse) {
      alert('عذراً، لا يمكن حذف هذا العميل لارتباطه بفواتير ومديونيات سابقة. يمكنك تعديل بياناته (مثل كتابة عميل موقوف) بدلاً من الحذف للحفاظ على الأرشيف المالي.');
      return;
    }
    setCustomers(customers.filter(c => c.id !== id));
  };

  const handleAddInvoice = (newInvoice: Omit<Invoice, 'id'>) => {
    const id = `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setInvoices(prev => [...prev, { ...newInvoice, id }]);

    // Trigger optional Google Sheets inline sync if configured and online!
    if (settings.googleSheetsUrl && navigator.onLine) {
      const customerObj = customers.find(c => c.id === newInvoice.customerId);
      const payload = {
        type: 'الفواتير',
        invoiceNumber: newInvoice.invoiceNumber,
        customerName: customerObj ? customerObj.name : 'عميل غير محدد',
        date: newInvoice.date,
        total: newInvoice.totalAfterDiscount,
        notes: newInvoice.notes || 'تلقائي من نظام السيارة'
      };

      fetch(settings.googleSheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(err => console.error('Interactive Google Sheet inline sync failed:', err));
    }
  };

  const handleAddExpense = (newExpense: Omit<Expense, 'id'>) => {
    const id = `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setExpenses(prev => [...prev, { ...newExpense, id }]);

    // Trigger optional Google Sheets inline sync if configured and online!
    if (settings.googleSheetsUrl && navigator.onLine) {
      const payload = {
        type: newExpense.type === 'revenue' ? 'إيراد إضافي' : 'المصروفات',
        date: newExpense.date,
        amount: newExpense.amount,
        category: newExpense.category,
        description: newExpense.description
      };

      fetch(settings.googleSheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(err => console.error('Interactive Google Sheet expense inline sync failed:', err));
    }
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

  // --- عمليات المزامنة والخروج الآمن ---
  const [isSyncing, setIsSyncing] = useState(false);

  const handleCloudSync = async (silent = false): Promise<boolean> => {
    if (!settings.googleSheetsUrl) {
      if (!silent) alert('يرجى ربط جوجل شيت أولاً من لوحة الإدارة لتمكين المزامنة.');
      return false;
    }
    if (!navigator.onLine) {
      if (!silent) alert('أنت غير متصل بالإنترنت حالياً. يرجى الاتصال ثم المحاولة.');
      return false;
    }

    setIsSyncing(true);
    try {
      const totalSales = invoices.reduce((sum, inv) => sum + inv.totalAfterDiscount, 0);
      const totalSpent = (expenses || []).filter(e => e.type !== 'revenue').reduce((sum, exp) => sum + exp.amount, 0);
      const extraRevenues = (expenses || []).filter(e => e.type === 'revenue').reduce((sum, exp) => sum + exp.amount, 0);
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
        expenses: (expenses || []).map(e => ({ date: e.date, amount: e.amount, category: e.category, description: e.description })),
        trips: (trips || []).map(t => ({ description: t.description, price: t.price, status: t.collected ? 'محصلة' : 'غير محصلة', date: t.date || new Date().toISOString() })),
        products: products.map(p => ({ name: p.name, price: p.price, count: p.weights ? p.weights.length : 0 })),
        customers: customers.map(c => ({ name: c.name, phone: c.phone, area: c.area }))
      };

      const resp = await fetch(settings.googleSheetsUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      const result = await resp.json();
      
      if (result && result.status === 'success') {
        if (!silent) alert('تم المزامنة السحابية بنجاح! تم رفع كافة الفواتير والماليات الجديدة لـ جوجل شيت ✓');
        return true;
      } else {
        throw new Error(result?.error || 'استجابة غير متوقعة من الخادم.');
      }
    } catch (err: any) {
      console.error('Cloud sync failed:', err);
      if (!silent) alert(`فشل الاتصال السحابي: ${err.message}`);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSafeLogout = async () => {
    const confirmLogout = window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج الآمن؟ سيتم مزامنة وتأمين الفواتير والبيانات أولاً.');
    if (!confirmLogout) return;
    if (settings.googleSheetsUrl) {
      const syncSuccess = await handleCloudSync(true);
      if (!syncSuccess) {
        const forceLogout = window.confirm('فشلت المزامنة مع جوجل شيت بسبب مشكلة في الاتصال بالإنترنت. هل تريد الخروج على أية حال؟ (بياناتك محفوظة محلياً بجهازك ولن تضيع)');
        if (!forceLogout) return;
      }
    }
    localStorage.removeItem('authed_user_phone');
    setCurrentUser(null);
    window.location.hash = ''; 
  };

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
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-right select-none relative overflow-hidden" dir="rtl" id="timeout-lock-gate">
        
        {/* Immersive scan simulation overlay screen */}
        {isLockScanning && (
          <div className="fixed inset-0 bg-[#0f172a]/95 z-50 flex flex-col items-center justify-center p-6 text-center text-white animate-fade-in" id="lock-biometric-scanner">
            <div className="relative mb-8">
              <div className={`absolute -inset-8 bg-indigo-500/10 rounded-full ${lockScanSuccess ? 'scale-150 opacity-0' : 'animate-ping'}`} />
              <div className={`absolute -inset-4 bg-indigo-500/20 rounded-full ${lockScanSuccess ? 'scale-150 opacity-0' : 'animate-pulse'}`} />
              
              <div className={`h-24 w-24 rounded-full border-2 ${
                lockScanSuccess ? 'border-emerald-500 bg-emerald-950/50 text-emerald-400' : 'border-indigo-500 bg-slate-900 text-indigo-400'
              } flex items-center justify-center transition-colors duration-500 shadow-2xl`}>
                {lockScanSuccess ? (
                  <CheckCircle className="h-12 w-12 text-emerald-400 animate-bounce" />
                ) : (
                  <Fingerprint className="h-12 w-12 animate-pulse text-indigo-400" />
                )}
              </div>
            </div>

            <h3 className={`text-lg font-black mb-3 ${lockScanSuccess ? 'text-emerald-400' : 'text-slate-100'}`}>
              {lockScanSuccess ? 'تم مطابقة البصمة الحيوية ✓' : 'البصمة البيومترية مفعّلة'}
            </h3>
            <p className="text-xs text-slate-400 font-bold max-w-xs leading-relaxed">
              {lockScanStatus}
            </p>

            {!lockScanSuccess && (
              <button
                onClick={() => setIsLockScanning(false)}
                className="mt-8 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 font-bold rounded-xl px-5 py-2 text-xs border border-slate-700 cursor-pointer transition-all"
              >
                إلغاء وقفل المستشعر
              </button>
            )}
          </div>
        )}

        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 relative overflow-hidden flex flex-col gap-6">
          <div className="absolute top-0 right-0 left-0 h-2 bg-red-600 animate-pulse"></div>
          
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4 border border-red-100 shadow-sm">
              <Lock className="h-8 w-8 animate-pulse" />
            </div>
            <h2 className="text-[#1A365D] text-lg font-black tracking-tight mb-1">قفل الخمول التلقائي مفعّل 🔒</h2>
            <p className="text-xs text-indigo-600 font-bold">بوابة حماية الأخوة المتحدون EAG للأمان الميداني</p>
          </div>

          <div className="bg-[#FFF5F5] border border-red-100 p-4 rounded-2xl text-xs space-y-2.5 text-slate-700 leading-normal font-bold">
            <span className="block text-red-900 border-b border-red-100 pb-1.5 font-black text-xs flex items-center gap-1.5">
              <ShieldAlert className="h-4.5 w-4.5 text-red-600 shrink-0 animate-bounce" />
              تأمين الجلسة التلقائي (بعد 5 دقائق عدم استخدام)
            </span>
            <p>مرحباً بك مجدداً يا زميلنا الغالي: <span className="text-[#1A365D] font-black text-sm">{currentUser.name}</span></p>
            <p className="text-[11.5px] text-slate-500 font-medium">لحمايتك من اختراق التطبيق والوصول غير المستند إلى فواتير عملائك من الغرباء، يرجى تقديم هويتك بمطابقتها:</p>
          </div>

          <form onSubmit={handleUnlockWithPassword} className="flex flex-col gap-4">
            {lockError && (
              <div className="bg-red-50 border border-red-150 text-red-700 p-2.5 rounded-xl text-center font-extrabold text-xs">
                ⚠️ {lockError}
              </div>
            )}

            <div className="space-y-1 text-right">
              <label className="block text-[11px] font-black text-slate-600">رقم الهاتف لتأكيد الدخول:</label>
              <input
                type="text"
                disabled
                dir="ltr"
                value={currentUser.phone}
                className="w-full bg-slate-100 border border-slate-200 rounded-2xl py-2.5 text-center font-black tracking-wider text-base text-slate-500 font-mono"
              />
            </div>

            <div className="space-y-1 text-right">
              <label className="block text-[11px] font-black text-slate-600">الرمز السري الشخصي لفك القفل (PIN/Password):</label>
              <div className="relative">
                <Key className="absolute top-3 right-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  placeholder="أدخل الرمز السري الشخصي لفتح الحساب"
                  value={lockPassword}
                  onChange={(e) => setLockPassword(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2.5 pr-10 pl-4 text-center font-black tracking-widest text-[#1A365D] focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                className="w-full bg-[#1A365D] hover:bg-[#2B6CB0] text-white py-3 rounded-2xl text-xs font-black transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>فتح وتنشيط الاتصال 🔓</span>
              </button>

              <button
                type="button"
                onClick={handleUnlockWithBiometrics}
                className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 py-3 rounded-2xl text-xs font-black transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Fingerprint className="h-4.5 w-4.5 text-emerald-600 animate-pulse" />
                <span>الفتح السريع بيومترياً (بصمة اليد) 🖲️</span>
              </button>
            </div>
          </form>

          <div className="border-t border-slate-100 pt-3 text-center">
            <button
              onClick={() => {
                // Logout and return to main logic
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

  return (
    <div className="bg-[#F7FAFC] min-h-screen text-[#1A365D] transition-all font-sans antialiased flex flex-col justify-between animate-fade-in" id="app-root-wrapper">
      {/* 🛡️ Secure Header Bar */}
      <header className="bg-[#1A365D] text-white py-3 px-4 shadow-md flex flex-wrap justify-between items-center sm:px-6 gap-2" dir="rtl">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs font-black">
            المستخدم: {currentUser.name} <span className="text-amber-300 font-extrabold mr-1">({currentUser.customRoleName || (currentUser.phone === '01228466613' ? 'المدير العام 👑' : currentUser.phone === '01281391552' ? 'نائب المدير والاشراف 💼' : 'مندوب مبيعات 💼')})</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCloudSync(false)}
            disabled={isSyncing}
            className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-100 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            title="تحديث ومزامنة البيانات مع جوجل شيت"
          >
            <span>{isSyncing ? 'جاري الترحيل..' : 'تحديث'}</span>
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSafeLogout}
            className="bg-rose-500/20 hover:bg-rose-500 text-rose-100 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            title="خروج آمن (مع مزامنة سجلات الفواتير)"
          >
            <span>خروج آمن</span>
            <LogOut className="h-4 w-4" />
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
    </div>
  );
}

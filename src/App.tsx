// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import PersonalSettingsTab from './components/PersonalSettingsTab';
import { Product, Customer, Invoice, Expense, FactoryLoad, AppSettings, Trip, UserAuth, SyncLog, getProductWeightsFallback } from './types';
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
import { Lock, Fingerprint, Key, ShieldAlert, CheckCircle, RefreshCw, Save, LogOut, MessageCircle, Bell, Settings as SettingsIcon, HelpCircle, AlertCircle } from 'lucide-react';
import { confirmEvents, confirmDialog } from './utils/confirm';
import { idbGet, idbSet } from './utils/idb';

// 🌐 رابط جوجل شيت الموحد والمدمج في التطبيق مباشرة
const APP_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEETS_URL || "https://script.google.com/macros/s/AKfycbyJnhlgJNJ4ggzet0h5z6n2oplDP4VVWy1tI52lgYpHqFqjl2FDJu3ZdaTCU0lxgjmy/exec";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [customToast, setCustomToast] = useState<{message: string, id: number} | null>(null);
  const [confirmState, setConfirmState] = useState<{message: string, isAlert: boolean, resolve: (val: boolean)=>void} | null>(null);

  useEffect(() => {
    const handleShowConfirm = (e: any) => {
      setConfirmState(e.detail);
    };
    confirmEvents.addEventListener('show-confirm', handleShowConfirm);
    return () => confirmEvents.removeEventListener('show-confirm', handleShowConfirm);
  }, []);

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

  const handleUnlockWithPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLockError('');

    if (!currentUser) return;

    // Check if user is a customer with direct visitor access (no password)
    const isCustomer = customers.some(c => c.phone.trim() === currentUser.phone.trim());
    if (isCustomer) {
      setIsLockedByTimeout(false);
      setLockPassword('');
      setLastActivity(Date.now());
      showToast(`مرحباً بك يا ${currentUser.name}`);
      return;
    }

    const entered = lockPassword.trim();
    const correct = currentUser.phone === '01228466613'
      ? (localStorage.getItem('owner_passcode_sys') || '1987')
      : (() => {
          try { return decodeURIComponent(atob(currentUser.password || '')); }
          catch(e) { return currentUser.password || '1234'; }
        })();

    if (entered === correct) {
      setIsLockedByTimeout(false);
      setLockPassword('');
      setLastActivity(Date.now());
      showToast(`مرحباً بك يا ${currentUser.name}`);
    } else {
      setLockError('رمز المرور الشخصي غير صحيح!');
    }
  };

  // Authentication & Security State
  const [usersList, setUsersList] = useState<UserAuth[]>(() => {
    const defaultOwner: UserAuth = {
      phone: '01228466613',
      name: 'المدير العام',
      role: 'owner',
      status: 'active',
      permittedTabs: ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'administrative', 'reports'],
      permittedSubTabs: [
        'loads', 'products', 'previous_loads', 'factory_account', 'trips',
        'customers_list', 'customers_maps_finder', 'invoice_create', 'invoice_balance',
        'expenses_list', 'reports_finance', 'reports_stats', 'reports_areas', 'reports_invoices', 'reports_inventory',
        'prices_list', 'prices_calc', 'prices_bot'
      ],
      canEditPrices: true,
      password: btoa(encodeURIComponent(localStorage.getItem('owner_passcode_sys') || '1987')),
      customRoleName: 'المدير العام 👑',
      createdAt: new Date().toISOString()
    };

    const raw = localStorage.getItem('users_permissions_sys');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const unique = new Map();
        parsed.forEach((u: UserAuth) => {
          let p = String(u.phone).replace(/^'/, '').replace(/\s+/g, '').trim();
          if (p.length === 10 && p.startsWith('1')) p = '0' + p;
          u.phone = p;
          if (!unique.has(u.phone) || u.role === 'owner') {
            unique.set(u.phone, u);
          }
        });
        const cleanList = Array.from(unique.values()) as UserAuth[];
        if (!cleanList.some(u => u.phone === '01228466613')) {
          cleanList.unshift(defaultOwner);
        }
        if (cleanList.length !== parsed.length) {
          localStorage.setItem('users_permissions_sys', JSON.stringify(cleanList));
        }
        return cleanList;
      } catch (e) {
        return [defaultOwner];
      }
    }
    return [defaultOwner];
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

  const [simulatedDelegate, setSimulatedDelegate] = useState<UserAuth | null>(null);
  const [isDelegateSelectorOpen, setIsDelegateSelectorOpen] = useState<boolean>(false);
  const [simulationSearchQuery, setSimulationSearchQuery] = useState<string>('');

  const checkSimulationGuard = (): boolean => {
    if (simulatedDelegate) {
      showToast("⚠️ وضع المعاينة مخصص للمشاهدة فقط لمنع تعارض البيانات.");
      return true;
    }
    return false;
  };

  const effectiveUser = simulatedDelegate || currentUser;

  const selectableDelegates = usersList.filter(u => u.phone !== '01228466613');
  const filteredDelegates = selectableDelegates.filter(u => 
    u.name.toLowerCase().includes(simulationSearchQuery.toLowerCase()) ||
    u.phone.includes(simulationSearchQuery)
  );

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

  useEffect(() => {
    if (!currentUser) return;
    const bumpActive = () => {
      if (navigator.geolocation && currentUser.role !== 'owner') {
        navigator.geolocation.getCurrentPosition((pos) => {
          setUsersList(prev => {
            const updated = prev.map(u => u.phone === currentUser.phone ? { ...u, lastActive: new Date().toISOString(), lastLat: pos.coords.latitude, lastLng: pos.coords.longitude } : u);
            localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
            return updated;
          });
        }, () => {
          setUsersList(prev => {
            const updated = prev.map(u => u.phone === currentUser.phone ? { ...u, lastActive: new Date().toISOString() } : u);
            localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
            return updated;
          });
        }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 });
      } else {
        setUsersList(prev => {
          const updated = prev.map(u => u.phone === currentUser.phone ? { ...u, lastActive: new Date().toISOString() } : u);
          localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
          return updated;
        });
      }
    };
    bumpActive();
    const interval = setInterval(bumpActive, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser?.phone]);

  // CORE STATE
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [factoryLoads, setFactoryLoads] = useState<FactoryLoad[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

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

  // IndexedDB Loading and Auto-Cleanup
  useEffect(() => {
    async function loadData() {
      try {
        const [ prod, fact, cust, inv, exp, tr, logs, set ] = await Promise.all([
          idbGet('products_sys'), idbGet('factory_sys'), idbGet('customers_sys'),
          idbGet('invoices_sys'), idbGet('expenses_sys'), idbGet('trips_sys'),
          idbGet('sync_logs_sys'), idbGet('settings_sys')
        ]);

        const migrate = (idbData: any, localKey: string, defaultData: any) => {
          const local = localStorage.getItem(localKey);
          if (local) {
            localStorage.removeItem(localKey); // مسح الذاكرة القديمة فوراً لتوفير مساحة الهاتف
          }
          if (idbData) return idbData;
          return local ? JSON.parse(local) : defaultData;
        };

        setProducts(migrate(prod, 'products_sys', DEFAULT_PRODUCTS));
        setFactoryLoads(migrate(fact, 'factory_sys', DEFAULT_FACTORY_LOADS));
        setCustomers(migrate(cust, 'customers_sys', DEFAULT_CUSTOMERS));
        
        const rawInvoices = migrate(inv, 'invoices_sys', DEFAULT_INVOICES);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cleanedInvoices = rawInvoices.filter((i: any) => {
          const invDate = new Date(i.date);
          const isPaid = (i.paidAmount ?? i.totalAfterDiscount) >= i.totalAfterDiscount;
          return !(invDate < thirtyDaysAgo && isPaid);
        });

        setInvoices(cleanedInvoices);
        
        let rawExpenses = migrate(exp, 'expenses_sys', DEFAULT_EXPENSES);
        // 🚨 نظام التنظيف الذاتي والإصلاح المحلي (Auto-Healing) للبيانات المرحلة بشكل خاطئ قديماً
        const cleanedExpenses = rawExpenses.map((e: any) => {
          const isShifted = e.date === 'مصروف' || e.date === 'إيراد' || e.date === 'expense' || e.date === 'revenue' || !e.date || !String(e.date).includes('-');
          if (isShifted) {
            return {
              id: `exp-fix-${Math.floor(Math.random() * 10000)}`,
              date: (e.id && String(e.id).includes('-')) ? e.id : new Date().toISOString(), // استعادة التاريخ الحقيقي
              category: (e.category && e.category !== 'expense' && e.category !== 'revenue') ? e.category : (e.date !== 'مصروف' && e.date !== 'إيراد' && e.date ? e.date : 'أخرى'),
              type: (e.type === 'revenue' || e.date === 'إيراد') ? 'revenue' : 'expense',
              amount: Number(e.amount) || 0,
              description: e.description || 'مصروف مسترد',
              delegateName: e.delegateName || 'مجهول',
              delegatePhone: e.delegatePhone || ''
            };
          }
          return e;
        }).filter((e: any) => e.amount > 0 && e.description);
        setExpenses(cleanedExpenses);

        setTrips(migrate(tr, 'trips_sys', []));
        setSyncLogs(migrate(logs, 'sync_logs_sys', []));
        setSettings(migrate(set, 'settings_sys', DEFAULT_SETTINGS));
      } catch (e) { console.error("DB Load Error", e); } finally { setIsDbLoaded(true); }
    }
    loadData();
  }, []);

  // Auto daily backup (Background System)
  const hasAutoBackedUpToday = useRef(false);
  useEffect(() => {
    if (!isDbLoaded || !currentUser || currentUser.role !== 'owner') return;
    if (hasAutoBackedUpToday.current) return;
    
    const lastBackup = localStorage.getItem('last_auto_backup_date_sys');
    const today = new Date().toLocaleDateString('en-CA');
    
    if (lastBackup !== today) {
      hasAutoBackedUpToday.current = true;
      const timer = setTimeout(() => {
        try {
          const exportData = { products, customers, invoices, expenses, trips, factoryLoads, settings, usersList, syncLogs, exportDate: new Date().toISOString() };
          idbSet('last_auto_backup_sys', exportData);
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
          const downloadNode = document.createElement('a');
          downloadNode.setAttribute("href", dataStr);
          downloadNode.setAttribute("download", `auto_backup_eags_${today}.json`);
          document.body.appendChild(downloadNode);
          downloadNode.click();
          downloadNode.remove();
          localStorage.setItem('last_auto_backup_date_sys', today);
          showToast('📥 تم حفظ وتنزيل النسخة الاحتياطية التلقائية لليوم بالخلفية.');
        } catch (e) {
          console.error("Auto backup failed", e);
        }
      }, 8000); // يعمل بهدوء بعد 8 ثواني من فتح التطبيق
      return () => clearTimeout(timer);
    }
  }, [isDbLoaded, currentUser, products, customers, invoices, expenses, trips, factoryLoads, settings, usersList, syncLogs]);

  // التهيئة الصامتة (Silent Provisioning) من السيرفر للأجهزة الجديدة بدون تدخل المستخدم
  useEffect(() => {
    if (APP_SCRIPT_URL && usersList.length <= 1) {
      handleUpdateData(true); // جلب البيانات صامتاً في الخلفية
    }
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync state changes with localStorage
  useEffect(() => {
    if (isDbLoaded) idbSet('products_sys', products);
  }, [products, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) idbSet('factory_sys', factoryLoads); }, [factoryLoads, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) idbSet('customers_sys', customers); }, [customers, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) idbSet('invoices_sys', invoices); }, [invoices, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) idbSet('expenses_sys', expenses); }, [expenses, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) idbSet('trips_sys', trips); }, [trips, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) idbSet('sync_logs_sys', syncLogs); }, [syncLogs, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) idbSet('settings_sys', settings); }, [settings, isDbLoaded]);

  const [hasShownInactiveAlert, setHasShownInactiveAlert] = useState(false);
  useEffect(() => {
    if (activeTab === 'dashboard' && effectiveUser && effectiveUser.role !== 'owner' && !hasShownInactiveAlert) {
      const now = new Date().getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      
      const delegateInvoices = invoices.filter(inv => inv.delegatePhone === effectiveUser.phone);
      if (delegateInvoices.length > 0) {
        const latestInvoiceByCustomer = new Map<string, number>();
        delegateInvoices.forEach(inv => {
           const dTime = new Date(inv.date).getTime();
           if (!isNaN(dTime)) {
              const current = latestInvoiceByCustomer.get(inv.customerId) || 0;
              if (dTime > current) {
                 latestInvoiceByCustomer.set(inv.customerId, dTime);
              }
           }
        });

        let inactiveCount = 0;
        latestInvoiceByCustomer.forEach((lastTime) => {
           if (now - lastTime > sevenDaysMs) {
              inactiveCount++;
           }
        });

        if (inactiveCount > 0) {
          setTimeout(() => {
            showToast(`⚠️ تنبيه الميدان: لديك ${inactiveCount} عملاء خاملين لم يسجلوا مشتريات منذ أكثر من أسبوع! راجع التقارير لإعادة استهدافهم.`);
          }, 1500);
          setHasShownInactiveAlert(true);
        }
      }
    }
  }, [activeTab, effectiveUser, invoices, hasShownInactiveAlert]);

  // Operations handlers
  const promptForSync = (actionDesc: string) => {
    if (!APP_SCRIPT_URL) return;
    setTimeout(async () => {
      showToast(`☁️ جاري الحفظ السحابي...`);
      const success = await syncAllDataToGoogle(true);
      if (success) {
        showToast(`✓ تم الحفظ السحابي بنجاح!`);
      } else {
        showToast(`⚠️ فشل الحفظ السحابي، تأكد من اتصالك بالإنترنت.`);
      }
    }, 300);
  };

  const markAsDeleted = (id: string) => {
    const deleted = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem('deleted_records_sys', JSON.stringify(deleted));
    }
  };

  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    if (checkSimulationGuard()) return;
    const id = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setProducts(prev => [{ ...newProd, id }, ...prev]);
    promptForSync('إضافة صنف جديد');
  };

  const handleEditProduct = (updatedProd: Product) => {
    if (checkSimulationGuard()) return;
    setProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
    promptForSync('تعديل صنف وتحديث السعر');
  };

  const handleDeleteProduct = (id: string) => {
    if (checkSimulationGuard()) return;
    setProducts(products.filter(p => p.id !== id));
    // Also delete loads corresponding to it to preserve data honesty
    setFactoryLoads(factoryLoads.filter(load => load.productId !== id));
    promptForSync('حذف صنف من المصنع');
  };

  const handleDeleteAllProducts = () => {
    if (checkSimulationGuard()) return;
    setProducts([]);
    setFactoryLoads([]);
    promptForSync('مسح جميع الأصناف');
  };

  const handleAddLoad = (newLoad: Omit<FactoryLoad, 'id'>) => {
    if (checkSimulationGuard()) return;
    const id = `load-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setFactoryLoads(prev => [...prev, { 
      ...newLoad, 
      id,
      delegateName: currentUser?.name || 'مجهول',
      delegatePhone: currentUser?.phone || ''
    }]);
    promptForSync('سحب/تنزيل حمولة مصنع');
  };

  const handleDeleteLoad = (id: string) => {
    if (checkSimulationGuard()) return;
    setFactoryLoads(factoryLoads.filter(load => load.id !== id));
    markAsDeleted(id);
    promptForSync('حذف حمولة من السيارة');
  };

  const handleAddCustomer = (newCustomer: Omit<Customer, 'id'>) => {
    if (checkSimulationGuard()) return;
    const id = `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setCustomers(prev => [...prev, { ...newCustomer, id }]);

    // Auto register Work Area if not exists
    const gov = (newCustomer.governorate || 'أخرى').trim();
    const area = (newCustomer.area || '').trim();
    if (area) {
      const exists = (settings.workAreas || []).some(
        w => w.governorate.toLowerCase() === gov.toLowerCase() && w.area.toLowerCase() === area.toLowerCase()
      );
      if (!exists) {
        setSettings(prev => ({
          ...prev,
          workAreas: [...(prev.workAreas || []), { governorate: gov, area }]
        }));
      }
    }

    promptForSync('إضافة عميل جديد');
  };

  const handleEditCustomer = (editedCustomer: Customer) => {
    if (checkSimulationGuard()) return;
    setCustomers(customers.map(c => c.id === editedCustomer.id ? editedCustomer : c));

    // Auto register Work Area if not exists
    const gov = (editedCustomer.governorate || 'أخرى').trim();
    const area = (editedCustomer.area || '').trim();
    if (area) {
      const exists = (settings.workAreas || []).some(
        w => w.governorate.toLowerCase() === gov.toLowerCase() && w.area.toLowerCase() === area.toLowerCase()
      );
      if (!exists) {
        setSettings(prev => ({
          ...prev,
          workAreas: [...(prev.workAreas || []), { governorate: gov, area }]
        }));
      }
    }
    promptForSync('تعديل بيانات عميل');
  };

  const handleDeleteCustomer = (id: string) => {
    if (checkSimulationGuard()) return;
    setCustomers(customers.filter(c => c.id !== id));
    markAsDeleted(id);
    promptForSync('حذف عميل من الدليل');
  };

  const handleAddInvoice = (newInvoice: Omit<Invoice, 'id'>) => {
    if (checkSimulationGuard()) return;
    const id = `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setInvoices(prev => [...prev, { 
      ...newInvoice, 
      id,
      delegateName: currentUser?.name || 'مجهول',
      delegatePhone: currentUser?.phone || ''
    }]);

    setCustomers(prev => prev.map(c => 
      c.id === newInvoice.customerId 
        ? { 
            ...c, 
            totalSpent: (c.totalSpent || 0) + newInvoice.totalAfterDiscount,
            purchasesCount: (c.purchasesCount || 0) + 1,
            lastPurchaseDate: newInvoice.date.split('T')[0]
          }
        : c
    ));

    promptForSync('إصدار فاتورة بيع');
  };

  const handleUpdateInvoice = (updated: Invoice) => {
    if (checkSimulationGuard()) return;
    const oldInv = invoices.find(i => i.id === updated.id);
    if (oldInv && oldInv.totalAfterDiscount !== updated.totalAfterDiscount) {
      const diff = updated.totalAfterDiscount - oldInv.totalAfterDiscount;
      setCustomers(prev => prev.map(c => 
        c.id === updated.customerId
          ? { ...c, totalSpent: Math.max(0, (c.totalSpent || 0) + diff) }
          : c
      ));
    }
    setInvoices(invoices.map(inv => inv.id === updated.id ? updated : inv));
    promptForSync('تحديث فاتورة بيع');
  };

  const handleDeleteInvoice = (id: string) => {
    if (checkSimulationGuard()) return;
    const invToDelete = invoices.find(i => i.id === id);
    if (invToDelete) {
      setCustomers(prev => prev.map(c => 
        c.id === invToDelete.customerId
          ? { 
              ...c, 
              totalSpent: Math.max(0, (c.totalSpent || 0) - invToDelete.totalAfterDiscount),
              purchasesCount: Math.max(0, (c.purchasesCount || 0) - 1)
            }
          : c
      ));
    }
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    markAsDeleted(id);
    promptForSync('حذف فاتورة بيع');
  };

  const handleAddExpense = (newExpense: Omit<Expense, 'id'>) => {
    if (checkSimulationGuard()) return;
    const id = `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setExpenses(prev => [...prev, { 
      ...newExpense, 
      id,
      delegateName: currentUser?.name || 'مجهول',
      delegatePhone: currentUser?.phone || ''
    }]);

    promptForSync(newExpense.type === 'revenue' ? 'إضافة إيراد/تحصيل' : 'حفظ مصروف');
  };

  const handleDeleteExpense = (id: string) => {
    if (checkSimulationGuard()) return;
    setExpenses(expenses.filter(e => e.id !== id));
    markAsDeleted(id);
    promptForSync('حذف مصروف/إيراد');
  };

  const handleAddTrip = (newTrip: Omit<Trip, 'id'>) => {
    if (checkSimulationGuard()) return;
    const id = `trip-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setTrips(prev => [...prev, { 
      ...newTrip, 
      id,
      delegateName: currentUser?.name || 'مجهول',
      delegatePhone: currentUser?.phone || ''
    }]);

    promptForSync('تسجيل مشوار/نقلية');
  };

  const handleToggleCollected = (id: string) => {
    if (checkSimulationGuard()) return;
    setTrips(trips.map(t => t.id === id ? { ...t, collected: !t.collected } : t));
    promptForSync('تعديل حالة تحصيل المشوار');
  };

  const handleEditTrip = (id: string, updates: Partial<Omit<Trip, 'id'>>) => {
    if (checkSimulationGuard()) return;
    setTrips(trips.map(t => t.id === id ? { ...t, ...updates } : t));
    promptForSync('تعديل بيانات مشوار');
  };

  const handleDeleteTrip = (id: string) => {
    if (checkSimulationGuard()) return;
    setTrips(trips.filter(t => t.id !== id));
    markAsDeleted(id);
    promptForSync('حذف مشوار أو تحرك');
  };

  const handleResetDatabase = (demoMode: boolean) => {
    if (checkSimulationGuard()) return;
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
    if (!APP_SCRIPT_URL || APP_SCRIPT_URL === "ضع_رابط_الاسكريبت_الخاص_بك_هنا") {
      if (!silent) alert('تنبيه: لم يتم تضمين رابط مزامنة جوجل شيت في ملفات النظام.');
      return false;
    }

    try {
      setIsHeaderSyncing(true);
      
      // 🚨 تعريف متغير مدير المزامنة الذي كان مفقوداً ويسبب انهيار صامت أثناء الرفع
      const isSyncManager = currentUser?.role === 'owner' || currentUser?.phone === '01228466613';

      const totalSales = invoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount || 0), 0);
      const totalSpent = expenses.filter(e => e.type !== 'revenue').reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const extraRevenues = expenses.filter(e => e.type === 'revenue').reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const netProfit = totalSales + extraRevenues - totalSpent;

      let deletedIds: string[] = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
      } catch(e) {}

      const customersMap = new Map(customers.map(c => [c.id, c]));
      const productsMap = new Map(products.map(p => [p.id, p]));

      let discoveredLeads: any[] = [];
      try {
        const googleLeadsRaw = localStorage.getItem('google_leads_staging_sys');
        discoveredLeads = googleLeadsRaw ? JSON.parse(googleLeadsRaw) : [];
      } catch (e) {}

      const invoicesByCustomer = new Map();
      invoices.forEach(inv => {
        if (!invoicesByCustomer.has(inv.customerId)) invoicesByCustomer.set(inv.customerId, []);
        invoicesByCustomer.get(inv.customerId).push(inv);
      });

      // جلب أحدث قائمة مناديب من الذاكرة مباشرة لتجنب تأخير حالة React وعدم رفعهم
      let freshUsersList = usersList;
      try {
        const localUsers = JSON.parse(localStorage.getItem('users_permissions_sys') || '[]');
        if (localUsers && localUsers.length > 0) freshUsersList = localUsers;
      } catch(e) {}

      const payload = {
        type: 'تقرير_كامل',
        syncPhone: currentUser?.phone || '01228466613',
        syncRole: currentUser?.role || 'owner',
        deletedIds: deletedIds,
        metadata: {
          syncedAt: new Date().toISOString(),
          app: 'نظام المبيعات والمخزون للسيارة',
          totalSales: Number(totalSales) || 0,
          totalExpenses: Number(totalSpent) || 0,
          netProfit: Number(netProfit) || 0
        },
        invoices: invoices.map(inv => {
          const cust = customersMap.get(inv.customerId);
          return {
            id: inv.id,
            invNum: inv.invoiceNumber,
            customerName: cust ? cust.name : 'عميل مجهول',
            customerId: inv.customerId,
            area: cust ? cust.area : 'منطقة مجهولة',
            date: inv.date,
            totalBeforeDiscount: inv.totalBeforeDiscount,
            total: inv.totalAfterDiscount,
            paidAmount: inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount,
            delegateName: inv.delegateName || 'مجهول',
            delegatePhone: inv.delegatePhone || '',
            notes: inv.notes,
            items: inv.items || [],
            isDelivered: inv.isDelivered || false
          };
        }),
        expenses: (expenses || []).filter(e => e.amount > 0).map(e => ({
          id: e.id,
          date: e.date,
          amount: e.amount,
          category: e.category,
          type: e.type || 'expense',
          description: e.description,
          delegateName: e.delegateName || 'مجهول',
          delegatePhone: e.delegatePhone || ''
        })),
        trips: (trips || []).map(t => ({
          id: t.id,
          description: t.description,
          price: t.price,
          status: t.collected ? 'محصلة' : 'غير محصلة',
          date: t.date || new Date().toISOString(),
          delegateName: t.delegateName || 'مجهول',
          delegatePhone: t.delegatePhone || '',
          odometerStart: t.odometerStart || '',
          odometerEnd: t.odometerEnd || ''
        })),
        products: isSyncManager ? products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          count: p.weights ? p.weights.length : 0,
          weights: p.weights || []
        })) : [],
        customers: customers.map(c => {
          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            governorate: c.governorate || 'القاهرة',
            area: c.area,
            detailedAddress: c.detailedAddress || '',
            locationLink: c.locationLink || '',
            purchasesCount: c.purchasesCount || 0,
            salesManager: c.salesManager || '',
            totalSpent: c.totalSpent || 0,
            lastPurchaseDate: c.lastPurchaseDate || ''
          }
        }),
        users: isSyncManager ? freshUsersList.map(u => ({
          name: u.name,
          phone: u.phone,
          role: u.role,
          status: u.status,
          password: (() => {
            try { return decodeURIComponent(atob(u.password || '')); }
            catch(e) { return u.password || '1234'; }
          })(),
          customRoleName: u.customRoleName || '',
          permittedTabs: (u.permittedTabs || []).join(','),
          permittedSubTabs: (u.permittedSubTabs || []).join(','),
            canEditPrices: u.canEditPrices !== false,
            lastActive: u.lastActive || '',
            lastLat: u.lastLat || '',
            lastLng: u.lastLng || ''
        })) : [],
        factoryLoads: (factoryLoads || []).map(fl => {
          const prod = productsMap.get(fl.productId);
          const activeWeights = prod ? (prod.weights && prod.weights.length > 0 ? prod.weights : getProductWeightsFallback(prod)) : [];
          const wt = activeWeights.find(w => w.id === fl.weightId);
          return {
            id: fl.id,
            date: fl.date,
            productId: fl.productId,
            weightId: fl.weightId,
            productName: prod?.name || 'صنف مجهول',
            weightSize: wt?.size || 'عبوة',
            cartonsCount: fl.cartonsCount || 0,
            quantity: fl.quantity || 0,
            advanceAmount: fl.advanceAmount || 0,
            warehouseKeeper: fl.warehouseKeeper || '',
            delegateName: fl.delegateName || 'مجهول',
            delegatePhone: fl.delegatePhone || ''
          };
        }),
        discoveredLeads: discoveredLeads.map((l: any) => ({
          id: l.id,
          governorate: l.governorate || 'القاهرة',
          area: l.area,
          name: l.name,
          phone: l.phone,
          detailedAddress: l.detailedAddress,
          locationLink: l.locationLink,
          type: l.type || '',
          dateAdded: l.dateAdded || ''
        }))
      };

      await fetch(APP_SCRIPT_URL.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });

      setSyncLogs(prev => [{
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        delegateName: currentUser?.name || 'مجهول',
        status: 'success',
        actionDesc: 'مزامنة شاملة للبيانات'
      }, ...prev]);

      // 🚨 الحل الجذري لتراكم المحذوفات: تفريغ سلة المحذوفات بعد كل رفع ناجح لضمان عدم مسح ملفات جديدة بالخطأ
      localStorage.removeItem('deleted_records_sys');

      setIsHeaderSyncing(false);
      return true;
    } catch (err: any) {
      console.error('Error syncing to Google Sheets from header:', err);
      
      setSyncLogs(prev => [{
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        delegateName: currentUser?.name || 'مجهول',
        status: 'fail',
        actionDesc: 'فشل مزامنة شاملة',
        details: err.message
      }, ...prev]);

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
  if (!isDbLoaded) {
    return (
      <div className="min-h-screen bg-[#F0F4F8] flex flex-col items-center justify-center p-4 text-center" dir="rtl">
        <div className="animate-spin h-12 w-12 border-4 border-[#1A365D] border-t-transparent rounded-full mb-4 mx-auto"></div>
        <h2 className="text-[#1A365D] font-black text-lg">جاري تحميل قاعدة البيانات...</h2>
        <p className="text-xs text-slate-500 font-bold mt-2">يتم الآن تجهيز مساحة التخزين اللامحدودة (IndexedDB)</p>
      </div>
    );
  }

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
    const isCustomer = customers.some(c => c.phone.trim() === currentUser.phone.trim());

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
              onClick={async () => {
                if (await confirmDialog("هل أنت متأكد من تسجيل الخروج وتبديل الحساب؟", false)) {
                  localStorage.removeItem('authed_user_phone');
                  setCurrentUser(null);
                  setIsLockedByTimeout(false);
                  setLockPassword('');
                  setLockError('');
                }
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
    const proceed = await confirmDialog("هل أنت متأكد من رغبتك في الخروج من النظام؟\nسيتم مزامنة وحفظ بياناتك سحابياً قبل الخروج للحفاظ عليها.", false);
    if (!proceed) return;

    showToast("جاري الخروج الآمن والمزامنة السحابية...");
    const success = await syncAllDataToGoogle(true);
    if (success) {
      showToast("✓ تم حفظ البيانات سحابياً بنجاح!");
    } else {
      showToast("⚠️ تعذر الرفع السحابي، تم الحفظ محلياً فقط.");
    }

    localStorage.removeItem('authed_user_phone');
    setCurrentUser(null);
    setIsLockedByTimeout(false);
    setLockPassword('');
    setLockError('');
  }

  async function handleManualSave() {
    setIsHeaderSyncing(true);
    const success = await syncAllDataToGoogle(false);
    if (success) {
      showToast("✓ تم الحفظ السحابي بنجاح");
    } else {
      showToast("❌ تعذر الحفظ السحابي، تحقق من الاتصال.");
    }
    setIsHeaderSyncing(false);
  }

  async function handleUpdateData(isSilent = false) {
    if (!APP_SCRIPT_URL || APP_SCRIPT_URL === "ضع_رابط_الاسكريبت_الخاص_بك_هنا") {
      if (!isSilent) showToast("تنبيه: لم يتم إعداد رابط جوجل شيت في ملفات النظام. جاري إعادة تشغيل عادية...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return;
    }

    let shouldReplace = false;
    if (!isSilent) {
      const proceed = await confirmDialog("هل أنت متأكد من رغبتك في استدعاء وتحديث البيانات من السحابة (جوجل شيت)؟", false);
      if (!proceed) return;

      shouldReplace = await confirmDialog("كيف تريد تحديث البيانات؟\n\n[موافق]: مسح البيانات المحلية بالكامل واستبدالها ببيانات السحابة.\n[إلغاء]: دمج البيانات السحابية مع الموجودة (إضافة).", true);
      showToast("☁️ جاري استدعاء البيانات من السحابة...");
    }

    try {
      // إضافة المتغير العشوائي وتفعيل منع الكاش لضمان سحب أحدث بيانات من جوجل شيت
      const urlSeparator = APP_SCRIPT_URL.includes('?') ? '&' : '?';
      const fetchUrl = APP_SCRIPT_URL + urlSeparator + 't=' + Date.now();
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      });
      if (!response.ok) {
        throw new Error(`استجابة غير صالحة من السيرفر: ${response.status}`);
      }
      const data = await response.json();

      if (data && (data.users || data.products || data.customers)) {
        // 1. Update users permissions list (highly sensitive, managed by general manager)
        if (data.users && Array.isArray(data.users)) {
          const mappedUsers = data.users.map((u: any) => ({
            phone: (() => {
              let p = String(u.phone).replace(/^'/, '').replace(/\s+/g, '').trim();
              if (p.length === 10 && p.startsWith('1')) return '0' + p;
              return p;
            })(),
            name: String(u.name || ''),
            role: (u.role === 'owner' ? 'owner' : 'employee') as 'owner' | 'employee',
            status: (u.status === 'active' || u.status === 'pending' ? u.status : 'active') as 'active' | 'pending',
            permittedTabs: typeof u.permittedTabs === 'string' 
              ? u.permittedTabs.split(',').map((t: string) => t.trim()).filter(Boolean)
              : Array.isArray(u.permittedTabs) ? u.permittedTabs : ['dashboard'],
            permittedSubTabs: typeof u.permittedSubTabs === 'string' 
              ? u.permittedSubTabs.split(',').map((t: string) => t.trim()).filter(Boolean)
              : Array.isArray(u.permittedSubTabs) ? u.permittedSubTabs : [],
            canEditPrices: u.canEditPrices !== false,
            password: (() => {
              const p = String(u.password || '').replace(/^'/, '');
              try { if (btoa(atob(p)) === p || btoa(decodeURIComponent(atob(p))) === p) return p; } catch(e) {}
              return btoa(encodeURIComponent(p));
            })(),
            customRoleName: String(u.customRoleName || ''),
            lastActive: u.lastActive || undefined,
            lastLat: Number(u.lastLat) || undefined,
            lastLng: Number(u.lastLng) || undefined,
            createdAt: u.createdAt || new Date().toISOString()
          }));

          // فلتر ذكي لمنع التكرار ودمج الحسابات المكررة برقم الهاتف
          const uniqueUsersMap = new Map();
          mappedUsers.forEach((u: any) => {
            if (!uniqueUsersMap.has(u.phone) || u.role === 'owner') {
              uniqueUsersMap.set(u.phone, u);
            }
          });
          const uniqueMappedUsers = Array.from(uniqueUsersMap.values());

          // Ensure general manager (01228466613) remains correctly typed and authed at index if missing
          const ownerExists = uniqueMappedUsers.some((u: any) => u.phone === '01228466613');
          if (!ownerExists && usersList.some(u => u.phone === '01228466613')) {
            const currentOwner = usersList.find(u => u.phone === '01228466613')!;
            uniqueMappedUsers.unshift(currentOwner);
          }
          
          if (shouldReplace) {
            handleUpdateUsersList(uniqueMappedUsers);
          } else {
            const merged = [...usersList];
            uniqueMappedUsers.forEach((nu: any) => {
              const idx = merged.findIndex(u => u.phone === nu.phone);
              if (idx > -1) merged[idx] = nu;
              else merged.push(nu);
            });
            handleUpdateUsersList(merged);
          }
        }

        // 2. Update products and categories (النسخة المسطحة الجديدة المتوافقة مع التعديل اليدوي)
        if (data.flatProducts && Array.isArray(data.flatProducts) && data.flatProducts.length > 0) {
          const productGroups: Record<string, Product> = {};
          const nameToIdMap: Record<string, string> = {};
          
          data.flatProducts.forEach((fp: any) => {
            const pName = String(fp.productName || 'صنف جديد').trim();
            let pid = fp.productId ? String(fp.productId).trim() : '';
            
            // ذكاء اصطناعي: لو ضفت الصنف يدويا في الشيت ونسيت الـ ID، التطبيق هيجمعه بالاسم ويديله ID لوحده!
            if (!pid) {
              if (nameToIdMap[pName]) {
                pid = nameToIdMap[pName];
              } else {
                pid = 'prod-' + Math.random().toString(36).substr(2, 9);
                nameToIdMap[pName] = pid;
              }
            }
            
            if (!productGroups[pid]) {
              productGroups[pid] = {
                id: pid,
                name: pName,
                price: Number(fp.retailPricePerUnit || 0),
                minStockAlert: 20,
                accountingUnit: 'كرتونة',
                weights: []
              };
            }
            
            productGroups[pid].weights!.push({
              id: String(fp.weightId || 'w-' + Math.random().toString(36).substr(2, 9)),
              size: String(fp.size || 'كرتونة'),
              cartonPriceFromFactory: Number(fp.cartonPriceFromFactory || 0),
              unitsPerCarton: Number(fp.unitsPerCarton || 12),
              factoryPricePerUnit: Number(fp.factoryPricePerUnit || 0),
              profitMarginPercent: 0,
              addedValue: Number(fp.addedValue || 0),
              retailPricePerUnit: Number(fp.retailPricePerUnit || 0)
            });
          });
          
          const mappedProducts = Object.values(productGroups);
          if (shouldReplace) {
            setProducts(mappedProducts);
          } else {
            setProducts(prev => {
              const merged = [...prev];
              mappedProducts.forEach(np => {
                const idx = merged.findIndex(p => p.id === np.id);
                if (idx > -1) merged[idx] = np;
                else merged.push(np as Product);
              });
              return merged;
            });
          }
        } else if (data.products && Array.isArray(data.products)) {
          // التوافق الرجعي لو السيرفر لسه مبعتش النسخة المسطحة
          const mappedProducts = data.products.map((p: any) => ({
            id: p.id || p.name,
            name: p.name,
            price: Number(p.price || p.purchasingPrice || 0),
            purchasingPrice: Number(p.purchasingPrice || p.price || 0),
            count: Number(p.count || 0),
            category: p.category || 'عام',
            weights: Array.isArray(p.weights) && p.weights.length > 0 ? p.weights : [{ id: '1', size: 'كرتونة', cartonPriceFromFactory: Number(p.price || 0)*12, unitsPerCarton: 12, factoryPricePerUnit: Number(p.price || 0), profitMarginPercent: 0, retailPricePerUnit: Number(p.price || 0) }]
          }));
          if (shouldReplace) {
            setProducts(mappedProducts);
          } else {
            setProducts(prev => {
              const merged = [...prev];
              mappedProducts.forEach((np: any) => {
                const idx = merged.findIndex(p => p.id === np.id);
                if (idx > -1) merged[idx] = np;
                else merged.push(np);
              });
              return merged;
            });
          }
        }

        // 3. Update customers list
        if (data.customers && Array.isArray(data.customers)) {
          const mappedCustomers = data.customers.map((c: any) => ({
            id: c.id || c.phone || String(Math.random()),
            name: c.name,
            phone: c.phone,
            area: c.area || 'غير محدد',
            governorate: c.governorate || 'القاهرة',
            detailedAddress: c.detailedAddress || '',
            locationLink: c.locationLink || '',
            purchasesCount: Number(c.purchasesCount || 0),
            salesManager: c.salesManager || '',
            totalSpent: Number(c.totalSpent || 0),
            lastPurchaseDate: c.lastPurchaseDate || ''
          }));
          if (shouldReplace) {
            setCustomers(mappedCustomers);
          } else {
            setCustomers(prev => {
              const merged = [...prev];
              mappedCustomers.forEach((nc: any) => {
                const idx = merged.findIndex(c => c.id === nc.id || (c.phone && c.phone === nc.phone));
                if (idx > -1) {
                  merged[idx] = { ...merged[idx], ...nc };
                } else {
                  merged.push(nc);
                }
              });
              return merged;
            });
          }
        }

        // 4. Update operational tables (Invoices, Expenses, Trips, Factory loads)
        if (data.invoices && Array.isArray(data.invoices)) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const mappedInvoices = data.invoices.map((inv: any) => {
            const cust = customers.find(c => c.id === inv.customerId || c.name === inv.customerName);
            return {
              id: inv.id || inv.invNum || inv.invoiceNumber || String(Math.random()),
              invoiceNumber: inv.invNum || inv.invoiceNumber,
              customerId: cust ? cust.id : (inv.customerId || 'cust_' + Date.now()),
              date: inv.date || new Date().toISOString(),
              items: Array.isArray(inv.items) ? inv.items : [],
              discount: inv.discount || 0,
              totalBeforeDiscount: Number(inv.totalBeforeDiscount) || Number(inv.total) || 0,
              totalAfterDiscount: Number(inv.total) || Number(inv.totalAfterDiscount) || 0,
              paidAmount: inv.paidAmount !== undefined ? Number(inv.paidAmount) : Number(inv.total || 0),
              remainingAmount: inv.remainingAmount || 0,
              notes: inv.notes || '',
              delegateName: inv.delegateName || 'مجهول',
              delegatePhone: inv.delegatePhone || '',
              isDelivered: inv.isDelivered === 'true' || inv.isDelivered === true
            };
          }).filter((inv: any) => {
            // تصفية الفواتير القديمة (أكثر من 30 يوم ومسددة بالكامل) لتوفير المساحة
            const invDate = new Date(inv.date);
            const isPaid = (inv.paidAmount ?? inv.totalAfterDiscount) >= inv.totalAfterDiscount;
            return !(invDate < thirtyDaysAgo && isPaid);
          });
          
          if (shouldReplace) {
            setInvoices(mappedInvoices);
          } else {
            setInvoices(prev => {
              const merged = [...prev];
              mappedInvoices.forEach((ni: any) => {
                const idx = merged.findIndex(i => i.id === ni.id);
                if (idx > -1) merged[idx] = ni;
                else merged.push(ni);
              });
              return merged;
            });
          }
        }

        if (data.discoveredLeads && Array.isArray(data.discoveredLeads)) {
          const mappedLeads = data.discoveredLeads.map((l: any) => ({
            id: String(l.id || Math.random()).replace(/^'/, ''),
            governorate: l.governorate || 'القاهرة',
            area: l.area || '',
            name: l.name || '',
            phone: String(l.phone || '').replace(/^'/, ''),
            detailedAddress: l.detailedAddress || '',
            locationLink: l.locationLink || '',
            type: l.type || '',
            dateAdded: l.dateAdded || ''
          }));
          let localLeadsRaw = localStorage.getItem('google_leads_staging_sys');
          let localLeads = localLeadsRaw ? JSON.parse(localLeadsRaw) : [];
          if (shouldReplace) {
            localStorage.setItem('google_leads_staging_sys', JSON.stringify(mappedLeads));
          } else {
            const merged = [...localLeads];
            mappedLeads.forEach((nl: any) => {
              const idx = merged.findIndex((l: any) => l.id === nl.id);
              if (idx > -1) merged[idx] = nl;
              else merged.push(nl);
            });
            localStorage.setItem('google_leads_staging_sys', JSON.stringify(merged));
          }
        }

        if (data.expenses && Array.isArray(data.expenses)) {
          const mappedExpenses = data.expenses.map((e: any) => {
            const isShifted = e.date === 'مصروف' || e.date === 'إيراد' || e.date === 'expense' || e.date === 'revenue' || !e.date || !String(e.date).includes('-');
            if (isShifted) {
              return {
                id: `exp-fix-${Math.floor(Math.random() * 10000)}`,
                date: (e.id && String(e.id).includes('-')) ? e.id : new Date().toISOString(),
                category: (e.category && e.category !== 'expense' && e.category !== 'revenue') ? e.category : (e.date !== 'مصروف' && e.date !== 'إيراد' && e.date ? e.date : 'أخرى'),
                type: (e.type === 'revenue' || e.date === 'إيراد') ? 'revenue' : 'expense',
                amount: Number(e.amount) || 0,
                description: e.description || 'مصروف مسترد',
                delegateName: e.delegateName || 'مجهول',
                delegatePhone: e.delegatePhone || ''
              };
            }
            return {
              id: String(e.id || e.date + '-' + e.amount || Math.random()).replace(/^'/, ''),
              date: e.date,
              amount: Number(e.amount || 0),
              category: e.category,
              type: e.type === 'revenue' ? 'revenue' : 'expense',
              description: e.description || '',
              delegateName: e.delegateName || 'مجهول',
              delegatePhone: e.delegatePhone || ''
            };
          }).filter((e: any) => e.amount > 0 && e.description);
          if (shouldReplace) {
            setExpenses(mappedExpenses);
          } else {
            setExpenses(prev => {
              const merged = [...prev];
              mappedExpenses.forEach((ne: any) => {
                const idx = merged.findIndex(e => e.id === ne.id);
                if (idx > -1) merged[idx] = ne;
                else merged.push(ne);
              });
              return merged;
            });
          }
        }

        if (data.trips && Array.isArray(data.trips)) {
          const mappedTrips = data.trips.map((t: any) => ({
            id: t.id || t.date + '-' + t.description || String(Math.random()),
            date: t.date,
            description: t.description || t.area || '',
            price: Number(t.price || 0),
            collected: t.status === 'محصلة' || t.status === 'true' || t.collected === true,
            delegateName: t.delegateName || 'مجهول',
            delegatePhone: t.delegatePhone || '',
            odometerStart: t.odometerStart ? Number(t.odometerStart) : undefined,
            odometerEnd: t.odometerEnd ? Number(t.odometerEnd) : undefined
          }));
          if (shouldReplace) {
            setTrips(mappedTrips);
          } else {
            setTrips(prev => {
              const merged = [...prev];
              mappedTrips.forEach((nt: any) => {
                const idx = merged.findIndex(t => t.id === nt.id);
                if (idx > -1) merged[idx] = nt;
                else merged.push(nt);
              });
              return merged;
            });
          }
        }

        if (data.factoryLoads && Array.isArray(data.factoryLoads)) {
          const mappedLoads = data.factoryLoads.map((fl: any) => ({
            id: fl.id || fl.date + '-' + fl.productId || String(Math.random()),
            date: fl.date,
            productName: fl.productName,
            weightSize: fl.weightSize || 'كرتونة',
            cartonsCount: Number(fl.cartonsCount || 0),
            quantity: Number(fl.quantity || 0),
            advanceAmount: Number(fl.advanceAmount || 0),
            warehouseKeeper: fl.warehouseKeeper || '',
            delegateName: fl.delegateName || '',
            delegatePhone: fl.delegatePhone || ''
          }));
          if (shouldReplace) {
            setFactoryLoads(mappedLoads);
          } else {
            setFactoryLoads(prev => {
              const merged = [...prev];
              mappedLoads.forEach((nl: any) => {
                const idx = merged.findIndex(l => l.id === nl.id);
                if (idx > -1) merged[idx] = nl;
                else merged.push(nl);
              });
              return merged;
            });
          }
        }

        if (!isSilent) {
          showToast("✓ تم التحديث بنجاح! جاري تنشيط الواجهة...");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
        localStorage.removeItem('deleted_records_sys');
      } else {
        if (!isSilent) showToast("تنبيه: تم إرجاع بيانات فارغة ومخالفة للنموذج. جاري التحميل العادي...");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Refresh GET error from Google Sheets App:", err);
      if (!isSilent) showToast("تعذر جلب البيانات السحابية. تعمل الآن على الذاكرة المحلية للتطبيق ✓");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

  // Data Isolation Logic (عزل بيانات المناديب ما لم يكن المدير العام)
  const isManager = effectiveUser?.role === 'owner' || effectiveUser?.phone === '01228466613';
  const filteredFactoryLoads = isManager ? factoryLoads : factoryLoads.filter(l => l.delegatePhone === effectiveUser?.phone || (l.delegateName && effectiveUser?.name && l.delegateName.includes(effectiveUser.name.replace(/ \(.*?\)/, '').trim())));
  const filteredInvoices = isManager ? invoices : invoices.filter(i => i.delegatePhone === effectiveUser?.phone || (i.delegateName && effectiveUser?.name && i.delegateName.includes(effectiveUser.name.replace(/ \(.*?\)/, '').trim())));
  const filteredExpenses = isManager ? expenses : expenses.filter(e => e.delegatePhone === effectiveUser?.phone || (e.delegateName && effectiveUser?.name && e.delegateName.includes(effectiveUser.name.replace(/ \(.*?\)/, '').trim())));
  const filteredTrips = isManager ? trips : trips.filter(t => t.delegatePhone === effectiveUser?.phone || (t.delegateName && effectiveUser?.name && t.delegateName.includes(effectiveUser.name.replace(/ \(.*?\)/, '').trim())));

  return (
    <div className="bg-[#F7FAFC] min-h-screen text-[#1A365D] transition-all font-sans antialiased flex flex-col justify-between animate-fade-in" id="app-root-wrapper">
      {/* 🛡️ Secure Header Bar */}
      <header className="bg-[#1A365D] text-white py-3 px-4 shadow-md flex justify-between items-center sm:px-6" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs font-black">
            {currentUser.phone === '01228466613' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDelegateSelectorOpen(true)}
                  title="متابعة مندوب ومراقبة الحسابات 👁️"
                  className="bg-amber-400 text-[#1A365D] hover:bg-amber-500 font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-md text-xs"
                >
                  <span>المدير العام</span>
                </button>
                {simulatedDelegate && (
                  <span className="bg-amber-500/15 text-amber-300 text-[10.5px] font-black px-2 py-1 rounded-xl border border-amber-500/30">
                    مراقبة حية: {simulatedDelegate.name} 👀
                  </span>
                )}
              </div>
            ) : (
              <span>
                {currentUser.phone === '01281391552' ? 'نائب المدير: ' : 'المندوب: '}
                <span className="text-amber-200">{currentUser.name}</span>
              </span>
            )}
          </span>
        </div>

        {/* Actions Button Container (Left Side in RTL due to justify-between) */}
        <div className="flex items-center gap-2 mt-2.5 mb-0 pb-0 mr-0">
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
            onClick={handleUpdateData}
            title="جلب وتحديث البيانات من السحابة ⬇️"
            className="flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white p-2 rounded-xl border border-white/5 cursor-pointer shadow-sm"
            style={{ width: '36px', height: '33px' }}
          >
            <RefreshCw className="h-4.5 w-4.5 shrink-0" />
          </button>

          <button
            onClick={handleManualSave}
            disabled={isHeaderSyncing}
            title="صب وترحيل بيانات المندوب للسحابة ☁️"
            className="flex items-center justify-center bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-white p-2 rounded-xl cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Save className={`h-4.5 w-4.5 shrink-0 ${isHeaderSyncing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setActiveTab('personal_settings')}
            title="الإعدادات الشخصية"
            className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-700 p-2 rounded-xl cursor-pointer shadow-sm border border-slate-200"
          >
            <SettingsIcon className="h-4.5 w-4.5 shrink-0" />
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

      {/* 📡 Simulation Mode Banner */}
      {simulatedDelegate && (
        <div className="bg-amber-500 text-[#1A365D] py-2.5 px-4 shadow-sm flex flex-wrap justify-between items-center gap-2 border-b border-amber-600 animate-slide-down text-right sm:px-6" dir="rtl">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <span className="text-xs font-black">
              جاري الآن تتبع ومراقبة العمليات الحية للمندوب: <span className="underline font-extrabold">{simulatedDelegate.name}</span> ({simulatedDelegate.phone})
            </span>
            <span className="hidden md:inline bg-amber-600/30 text-[#1A365D] text-[10px] font-black px-2 mt-0.5 py-0.5 rounded-full">
              وضع المعاينة الحية النشط (مشاهدة دون تعديل) 👀
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDelegateSelectorOpen(true)}
              className="bg-white hover:bg-slate-50 text-[#1A365D] font-black text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1 border border-slate-200"
            >
              <span>🔄</span>
              <span>تغيير المندوب</span>
            </button>
            <button
              onClick={() => {
                setSimulatedDelegate(null);
                showToast("تم الخروج والرجوع لصلاحيات المدير العام.");
              }}
              className="bg-[#1A365D] hover:bg-[#142A4A] text-white font-black text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>❌</span>
              <span>إنهاء المعاينة والرجوع للمدير</span>
            </button>
          </div>
        </div>
      )}

      {/* 📡 Delegates Selector Modal / Portal */}
      <AnimatePresence>
        {isDelegateSelectorOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs text-right animate-fade-in" dir="rtl" id="delegate-simulation-selector-modal">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="bg-[#1A365D] text-white p-5 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                      <span>📡</span>
                      <span>متابعة مندوب</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsDelegateSelectorOpen(false)}
                    className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer font-black"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-150">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 ابحث باسم المندوب أو رقم الهاتف (الكود)..."
                    value={simulationSearchQuery}
                    onChange={(e) => setSimulationSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-[#1A365D] font-bold text-xs focus:ring-1 focus:ring-amber-500 text-right pr-9"
                  />
                </div>
              </div>

              {/* Delegates list */}
              <div className="p-4 overflow-y-auto flex-grow flex flex-col gap-2.5" style={{ minHeight: '180px' }}>
                {filteredDelegates.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-bold">
                    {simulationSearchQuery ? 'لا يوجد أي مندوب يطابق هذا البحث 🔍' : 'لا يوجد مناديب مسجلين بالنظام حالياً تفيد لوحة التتبع.'}
                  </div>
                ) : (
                  filteredDelegates.map((u) => {
                    const cleanUserName = u.name.replace(/ \(.*?\)/, '').trim();
                    const uInvoices = invoices.filter(inv => 
                      inv.delegatePhone === u.phone || 
                      inv.delegateName === u.name ||
                      (inv.delegateName && inv.delegateName.includes(cleanUserName))
                    );
                    const uExpenses = expenses.filter(exp => 
                      exp.delegatePhone === u.phone || 
                      (exp.delegateName && exp.delegateName.includes(cleanUserName))
                    );
                    const totalSalesOfUser = uInvoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount || 0), 0);
                    const totalCashCollectedOfUser = uInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
                    const totalRevenuesOfUser = uExpenses.filter(e => e.type === 'revenue').reduce((sum, exp) => sum + (exp.amount || 0), 0);
                    const totalExpensesOfUser = uExpenses.filter(e => e.type !== 'revenue').reduce((sum, exp) => sum + (exp.amount || 0), 0);
                    const expectedWalletOfUser = totalCashCollectedOfUser + totalRevenuesOfUser - totalExpensesOfUser;

                    const isSimulated = simulatedDelegate?.phone === u.phone;

                    return (
                      <div
                        key={u.phone}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isSimulated
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-white border-slate-150 hover:bg-slate-50'
                        } flex flex-col gap-2`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-[#1A365D] tracking-tight">{u.name}</h4>
                            <span className="text-[10px] text-slate-500 font-bold tracking-tight">رقم الهاتف (الكود): {u.phone}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full ${
                              u.role === 'owner' 
                                ? 'bg-[#1D4ED8]/10 text-[#1D4ED8]' 
                                : 'bg-teal-100 text-teal-800'
                            }`}>
                              {u.customRoleName || (u.role === 'owner' ? 'نائب المدير' : 'مندوب مبيعات')}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold block mt-1">
                              آخر فعال: {u.lastActive && !isNaN(new Date(u.lastActive).getTime()) ? new Date(u.lastActive).toLocaleDateString('ar-EG') : 'لا يوجد'}
                            </span>
                          </div>
                        </div>

                        {/* 💰 Quick state overview */}
                        <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded-xl text-center text-[9px] font-bold border border-slate-100">
                          <div>
                            <span className="block text-slate-400 text-[8px]">مبيعات المندوب</span>
                            <span className="text-[#1A365D] font-extrabold">{totalSalesOfUser.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[8px]">كاش محصل</span>
                            <span className="text-[#1A365D] font-extrabold">{totalCashCollectedOfUser.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[8px]">العهدة المتوقعة</span>
                            <span className="text-[#DD6B20] font-black">{expectedWalletOfUser.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-between items-center mt-1">
                          <span className="flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                            <span className="text-[8.5px] text-slate-400 font-bold">الحساب {u.status === 'active' ? 'نشط ميدانياً' : 'موقف'}</span>
                          </span>
                          
                          {isSimulated ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSimulatedDelegate(null);
                                showToast("تم الخروج والرجوع لصلاحيات المدير العام.");
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white font-black text-[10px] px-3.5 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <span>❌</span>
                              <span>إنهاء التتبع</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSimulatedDelegate(u);
                                setIsDelegateSelectorOpen(false);
                                setActiveTab('dashboard'); // Always go to dashboard
                                showToast(`📡 تم الدخول في وضع التتبع الحي باسم المندوب: ${u.name}`);
                              }}
                              className="bg-[#1A365D] hover:bg-[#142A4A] text-white font-black text-[10px] px-3.5 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1 active:scale-95 hover:shadow-md"
                            >
                              <span>👁️</span>
                              <span>معاينة حية وتتبع</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-grow w-full">
        {activeTab === 'dashboard' && effectiveUser && (
          <Dashboard
            products={products}
            factoryLoads={filteredFactoryLoads}
            invoices={filteredInvoices}
            permittedTabs={effectiveUser.permittedTabs}
            onNavigate={setActiveTab}
            currentUserPhone={effectiveUser.phone}
            setIsChatOpen={setIsChatOpen}
          />
        )}

        {activeTab === 'factory' && effectiveUser && effectiveUser.permittedTabs.includes('factory') && (
          <FactoryTab
            products={products}
            factoryLoads={filteredFactoryLoads}
            invoices={filteredInvoices}
            trips={filteredTrips}
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
            permittedSubTabs={effectiveUser.permittedSubTabs}
            canEditPrices={effectiveUser.canEditPrices !== false}
          />
        )}

        {activeTab === 'customers' && effectiveUser && effectiveUser.permittedTabs.includes('customers') && (
          <CustomersTab
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onEditCustomer={handleEditCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onGoBack={() => setActiveTab('dashboard')}
            settings={settings}
            permittedSubTabs={effectiveUser.permittedSubTabs}
            currentUser={effectiveUser}
          />
        )}

        {activeTab === 'invoice' && effectiveUser && effectiveUser.permittedTabs.includes('invoice') && (
          <InvoiceTab
            customers={customers}
            products={products}
            factoryLoads={filteredFactoryLoads}
            invoices={filteredInvoices}
            onAddInvoice={handleAddInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onGoBack={() => setActiveTab('dashboard')}
            permittedSubTabs={effectiveUser.permittedSubTabs}
          />
        )}

        {activeTab === 'prices' && effectiveUser && effectiveUser.permittedTabs.includes('prices') && (
          <PricesTab
            products={products}
            onGoBack={() => setActiveTab('dashboard')}
            permittedSubTabs={effectiveUser.permittedSubTabs}
          />
        )}

        {activeTab === 'expenses' && effectiveUser && effectiveUser.permittedTabs.includes('expenses') && (
          <ExpensesTab
            expenses={filteredExpenses}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onGoBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'administrative' && effectiveUser && effectiveUser.permittedTabs.includes('administrative') && (
          <ManageTab
            products={products}
            customers={customers}
            invoices={invoices}
            expenses={expenses}
            trips={trips}
            factoryLoads={factoryLoads}
            settings={settings}
            usersList={usersList}
            syncLogs={syncLogs}
            onAddSyncLog={(newLog) => {
              setSyncLogs(prev => [{ ...newLog, id: Date.now().toString(), timestamp: new Date().toISOString() }, ...prev]);
              if (newLog.status === 'success' && currentUser) {
                setUsersList(prev => {
                  const updated = prev.map(u => u.phone === currentUser.phone ? { ...u, lastSync: new Date().toISOString() } : u);
                  localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                  return updated;
                });
              }
            }}
            onUpdateUsersList={handleUpdateUsersList}
          currentUser={effectiveUser}
            onEditProduct={handleEditProduct}
            onEditMultipleProducts={(updatedProducts) => {
               if (checkSimulationGuard()) return;
               setProducts(updatedProducts);
               promptForSync('تحديث أسعار الأصناف المتعددة');
            }}
            onUpdateSettings={setSettings}
            onResetDatabase={handleResetDatabase}
            onGoBack={() => setActiveTab('dashboard')}
            onTriggerSync={promptForSync}
            onRefreshData={() => handleUpdateData(true)}
          />
        )}

        {activeTab === 'reports' && effectiveUser && effectiveUser.permittedTabs.includes('reports') && (
          <ReportsTab
            invoices={filteredInvoices}
            expenses={filteredExpenses}
            products={products}
            customers={customers}
            trips={filteredTrips}
            factoryLoads={filteredFactoryLoads}
            settings={settings}
            usersList={usersList}
            onUpdateInvoice={handleUpdateInvoice}
            onGoBack={() => setActiveTab('dashboard')}
            currentUser={effectiveUser}
            permittedSubTabs={effectiveUser.permittedSubTabs}
          />
        )}

        {activeTab === 'personal_settings' && (
          <PersonalSettingsTab
            onGoBack={() => setActiveTab('dashboard')}
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

      <AiChatAssistant 
        isOpen={isChatOpen} 
        setIsOpen={setIsChatOpen}
        products={products}
        factoryLoads={filteredFactoryLoads}
        customers={customers}
        invoices={filteredInvoices}
        expenses={filteredExpenses}
        trips={filteredTrips}
        currentUser={effectiveUser}
      />

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

      {/* Global Elegant Confirm Dialog */}
      <AnimatePresence>
        {confirmState && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" dir="rtl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 text-center border border-slate-100"
            >
              <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-2 shadow-inner">
                {confirmState.isAlert ? <AlertCircle className="h-8 w-8 text-amber-500" /> : <HelpCircle className="h-8 w-8 text-indigo-500" />}
              </div>
              <h3 className="text-[#1A365D] font-black text-base whitespace-pre-wrap leading-relaxed">
                {confirmState.message}
              </h3>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { confirmState.resolve(true); setConfirmState(null); }}
                  className="flex-1 bg-[#1A365D] hover:bg-indigo-900 text-white py-3 rounded-xl font-bold active:scale-95 transition-all shadow-md text-sm cursor-pointer"
                >
                  {confirmState.isAlert ? 'حسناً' : 'تأكيد ومتابعة'}
                </button>
                {!confirmState.isAlert && (
                  <button
                    onClick={() => { confirmState.resolve(false); setConfirmState(null); }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold active:scale-95 transition-all shadow-sm text-sm cursor-pointer"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

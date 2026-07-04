// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import PersonalSettingsTab from './components/PersonalSettingsTab';
import { Product, Customer, Invoice, Expense, FactoryLoad, AppSettings, Trip, UserAuth, SyncLog, getProductWeightsFallback, getItemFactoryCost } from './types';
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
import DelegateDashboard from './components/DelegateDashboard';
import AuthGate from './components/AuthGate';
import AiChatAssistant from './components/AiChatAssistant';
import Adduaa from './components/Adduaa';
import { Lock, Fingerprint, Key, ShieldAlert, CheckCircle, RefreshCw, Save, LogOut, MessageCircle, Bell, Settings as SettingsIcon, HelpCircle, AlertCircle } from 'lucide-react';
import { confirmDialog } from './utils/confirm';
import { idbGet, idbSet } from './utils/idb';

const getSafeScriptUrl = (overrideUrl?: string) => {
  try {
    if (overrideUrl && overrideUrl.trim().startsWith('http')) return overrideUrl.trim();
  } catch(e) {}
  try {
    const envUrl = import.meta.env.VITE_GOOGLE_SHEETS_URL?.trim();
    if (envUrl && envUrl.startsWith('http')) return envUrl;
  } catch(e) {}
  return "https://script.google.com/macros/s/AKfycbyGO8Af8bOs75_F-ttOFqR8WjVj4l9IW1IJGgDqLEu1rGdbky3balgRpZUdo03r6Kla/exec";
};

async function fetchWithTimeout(resource: string, options: any = {}, timeout = 35000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [customToast, setCustomToast] = useState<{message: string, id: number} | null>(null);

  useEffect(() => {
    window.gm_authFailure = () => {
      console.error("Google Maps auth failure detected globally.");
      const style = document.createElement('style');
      style.innerHTML = `
        .gm-err-container, .gm-err-content, .gm-err-title { display: none !important; opacity: 0 !important; visibility: hidden !important; }
        .gm-style-bg { display: none !important; }
        div[style*="background-color: rgba(15, 15, 15, 0.6)"] { display: none !important; }
        div[style*="z-index: 1000000"] { display: none !important; }
      `;
      document.head.appendChild(style);
    };
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
  const [lockPassword, setLockPassword] = useState('');
  const [lockError, setLockError] = useState('');
  const [lockFailedAttempts, setLockFailedAttempts] = useState(0);
  const [isHeaderSyncing, setIsHeaderSyncing] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<string>('');
  const [lastSyncFailed, setLastSyncFailed] = useState(false);

  const handleUnlockWithPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLockError('');

    if (!currentUser) return;

    // Check if user is a customer with direct visitor access (no password)
    const isCustomer = currentUser.customRoleName === 'عميل زائر للعرض 👀';
    if (isCustomer) {
      setIsLockedByTimeout(false);
      setLockPassword('');
      lastActivityRef.current = Date.now();
      showToast(`مرحباً بك يا ${currentUser.name}`);
      return;
    }

    const entered = lockPassword.replace(/[\s\u200B-\u200D\uFEFF\u200E\u200F]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    let correct = '';
    try { correct = decodeURIComponent(atob(currentUser.password || '')).replace(/[\s\u200B-\u200D\uFEFF\u200E\u200F]/g, ''); }
    catch(e) { correct = String(currentUser.password || '1234').replace(/[\s\u200B-\u200D\uFEFF\u200E\u200F]/g, ''); }

    if (currentUser.phone === '01228466613' || currentUser.role === 'owner') {
       const adminPass = (localStorage.getItem('owner_passcode_sys') || '1987').replace(/[\s\u200B-\u200D\uFEFF\u200E\u200F]/g, '');
       let ownerPass = '';
       try {
         const raw = localStorage.getItem('users_permissions_sys');
         if (raw) {
           const list = JSON.parse(raw);
           const ownerUser = list.find((u: any) => u.role === 'owner' || u.phone === '01228466613');
           if (ownerUser) {
             try { ownerPass = decodeURIComponent(atob(ownerUser.password || '')).replace(/[\s\u200B-\u200D\uFEFF\u200E\u200F]/g, ''); } catch(e) { ownerPass = String(ownerUser.password || '').replace(/[\s\u200B-\u200D\uFEFF\u200E\u200F]/g, ''); }
           }
         }
       } catch(e) {}
       if (entered === adminPass || (ownerPass && entered === ownerPass) || entered === '1987' || entered === '31101987') {
           correct = entered;
       }
    }

    if (entered === correct) {
      setIsLockedByTimeout(false);
      setLockPassword('');
      lastActivityRef.current = Date.now();
    setLockFailedAttempts(0);
      showToast(`مرحباً بك يا ${currentUser.name}`);
    } else {
    const fails = lockFailedAttempts + 1;
    setLockFailedAttempts(fails);
    if (fails >= 5) {
      setLockError('برجاء كتابة رقم الطواريء');
    } else {
      setLockError('رمز المرور الشخصي غير صحيح!');
    }
    }
  };

  const ENSURE_OWNER_PERMS = (u: UserAuth) => {
    if (u.phone === '01228466613' || u.role === 'owner') {
      u.permittedTabs = ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'administrative', 'reports'];
      u.permittedSubTabs = [
        'loads', 'products', 'previous_loads', 'factory_account', 'trips',
        'customers_list', 'customers_maps_finder', 'invoice_create', 'invoice_balance',
        'expenses_list', 'reports_finance', 'reports_stats', 'reports_areas', 'reports_invoices', 'reports_inventory',
        'admin_products', 'admin_ai', 'admin_areas', 'prices_list', 'prices_calc', 'prices_bot'
      ];
      u.canEditPrices = true;
      u.canUseAiAssistant = true;
      u.canApplyDiscount = true;
      u.maxDiscountPercentOfProfit = 100;
      u.maxExtraDiscountAmount = 1000000;
    }
    return u;
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
      canUseAiAssistant: true,
      canApplyDiscount: true,
      maxDiscountPercentOfProfit: 100,
      maxExtraDiscountAmount: 1000000,
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
          unique.set(u.phone, ENSURE_OWNER_PERMS(u));
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
          const found = list.find(u => u.phone === loggedPhone && u.status === 'active');
          return found ? ENSURE_OWNER_PERMS(found) : null;
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
  const [delegateMonitorTab, setDelegateMonitorTab] = useState<string | null>(null);

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
    const removedUsers = usersList.filter(u => !newUsers.find(nu => nu.phone === u.phone));
    removedUsers.forEach(u => markAsDeleted(`user_${u.phone}`));
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
          setCurrentUser(ENSURE_OWNER_PERMS(found));
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
          // Silent background sync of GPS coordinates and last seen to Google Sheets
          setTimeout(() => {
            syncAllDataToGoogle(true);
          }, 800);
        }, () => {
          setUsersList(prev => {
            const updated = prev.map(u => u.phone === currentUser.phone ? { ...u, lastActive: new Date().toISOString() } : u);
            localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
            return updated;
          });
          setTimeout(() => {
            syncAllDataToGoogle(true);
          }, 800);
        }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 });
      } else {
        setUsersList(prev => {
          const updated = prev.map(u => u.phone === currentUser.phone ? { ...u, lastActive: new Date().toISOString() } : u);
          localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
          return updated;
        });
        // Owner active bump triggers silent sync to keep lastActive updated in Google Sheets
        setTimeout(() => {
          syncAllDataToGoogle(true);
        }, 800);
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
  const [googleLeads, setGoogleLeads] = useState<any[]>([]);
  const [potentialLeads, setPotentialLeads] = useState<any[]>([]);
  const [archiveCycles, setArchiveCycles] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem('google_leads_staging_sys', JSON.stringify(googleLeads));
  }, [googleLeads]);

  useEffect(() => {
    localStorage.setItem('potential_leads_sys', JSON.stringify(potentialLeads));
  }, [potentialLeads]);
  const [dbVersion, setDbVersion] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('app_db_version_sys');
      return stored ? parseInt(stored, 10) : 0;
    } catch (e) { return 0; }
  });

  const [showSimulatedInventory, setShowSimulatedInventory] = useState(false);
  const simulatedInventory = React.useMemo(() => {
    if (!simulatedDelegate) return [];
    
    const delPhone = (simulatedDelegate.phone || '').trim();
    const cleanName = (simulatedDelegate.name || '').replace(/\s*\(.*?\)/g, '').trim();
    
    const delLoads = factoryLoads.filter(l => {
      const lPhone = (l.delegatePhone || '').trim();
      const lName = (l.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
      return (lPhone && lPhone === delPhone) || (lName && lName === cleanName);
    });
    const delInvoices = invoices.filter(i => {
      const iPhone = (i.delegatePhone || '').trim();
      const iName = (i.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
      return (iPhone && iPhone === delPhone) || (iName && iName === cleanName);
    });
    
    const stocks: any[] = [];
    
    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        const loaded = delLoads
          .filter(l => {
            const targetWeightId = l.weightId || w.id;
            return String(l.productId).trim() === String(p.id).trim() && String(targetWeightId).trim() === String(w.id).trim();
          })
          .reduce((sum, l) => sum + (l.quantity || 0), 0);

        let sold = 0;
        delInvoices.forEach(inv => {
          (inv.items || []).forEach(item => {
            const targetWeightId = item.weightId || w.id;
            if (String(item.productId).trim() === String(p.id).trim() && String(targetWeightId).trim() === String(w.id).trim()) {
              sold += (item.quantity || 0);
            }
          });
        });

        const remaining = loaded - sold;
        if (loaded > 0 || sold > 0) {
          if (remaining > 0) {
            stocks.push({
              product: p,
              weight: w,
              loaded,
              sold,
              remaining
            });
          }
        }
      });
    });
    
    return stocks;
  }, [simulatedDelegate, factoryLoads, invoices, products]);

  // مرجع لتخزين أحدث حالة للبيانات لمنع مشكلة (Stale Closure) أثناء المزامنة التلقائية
  const latestDataRef = useRef({ products, factoryLoads, customers, invoices, expenses, trips, usersList, googleLeads, potentialLeads, settings, dbVersion, currentUser });
  useEffect(() => {
    latestDataRef.current = { products, factoryLoads, customers, invoices, expenses, trips, usersList, googleLeads, potentialLeads, settings, dbVersion, currentUser, archiveCycles };
  }, [products, factoryLoads, customers, invoices, expenses, trips, usersList, googleLeads, potentialLeads, settings, dbVersion, currentUser, archiveCycles]);

  // ☁️ مزامنة تلقائية صامتة عند بدء تشغيل التطبيق لضمان سحب أحدث بيانات المناديب والأسعار من السحاب
  useEffect(() => {
    if (isDbLoaded && currentUser) {
      const timer = setTimeout(() => {
        handleUpdateData(true); // سحب صامت لدمج البيانات الجديدة دون مسح البيانات الحالية
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDbLoaded, currentUser?.phone]);

  const [showScrollTop, setShowScrollTop] = useState(false);

  // Inactivity tracking (Auto-lock after 5 minutes of no keyboard/mouse/touch)
  const lastActivityRef = React.useRef(Date.now());
  useEffect(() => {
    if (!currentUser) return;

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    const interval = setInterval(() => {
      const inactiveDelta = Date.now() - lastActivityRef.current;
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

  // IndexedDB Loading and Auto-Cleanup
  useEffect(() => {
    async function loadData() {
      try {
        const [ prod, fact, cust, inv, exp, tr, logs, set, archive ] = await Promise.all([
          idbGet('products_sys'), idbGet('factory_sys'), idbGet('customers_sys'),
          idbGet('invoices_sys'), idbGet('expenses_sys'), idbGet('trips_sys'),
          idbGet('sync_logs_sys'), idbGet('settings_sys'), idbGet('factory_archive_cycles_sys')
        ]);

        const migrate = (idbData: any, localKey: string, defaultData: any) => {
          const local = localStorage.getItem(localKey);
          if (local) {
            localStorage.removeItem(localKey); // مسح الذاكرة القديمة فوراً لتوفير مساحة الهاتف
          }
          if (idbData) return idbData;
          return local ? JSON.parse(local) : defaultData;
        };

        let rawProducts = migrate(prod, 'products_sys', DEFAULT_PRODUCTS);
        // 🚨 تنظيف وإزالة التكرار من قاعدة البيانات المحلية للأصناف
        const uniqueProductsMap = new Map();
        rawProducts.forEach((p: any) => {
          const nameKey = p.name.trim().toLowerCase();
          if (!uniqueProductsMap.has(nameKey)) {
            uniqueProductsMap.set(nameKey, { ...p });
          } else {
            // دمج الأوزان لو الصنف مكرر لتجنب فقدان أي بيانات
            const existing = uniqueProductsMap.get(nameKey);
            if (p.weights && Array.isArray(p.weights)) {
              existing.weights = existing.weights || [];
              p.weights.forEach((w: any) => {
                if (!existing.weights.find((ew: any) => ew.size === w.size || ew.id === w.id)) {
                  existing.weights.push(w);
                }
              });
            }
          }
        });
        setProducts(Array.from(uniqueProductsMap.values()));
        setFactoryLoads(migrate(fact, 'factory_sys', DEFAULT_FACTORY_LOADS));
        setCustomers(migrate(cust, 'customers_sys', DEFAULT_CUSTOMERS));
        
        const rawInvoices = migrate(inv, 'invoices_sys', DEFAULT_INVOICES);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cleanedInvoices = rawInvoices.map((i: any) => ({
          ...i,
          isDelivered: i.isDelivered === undefined ? true : i.isDelivered
        })).filter((i: any) => {
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
            // 🚨 منع استخدام Math.random() هنا نهائياً لمنع التكرار اللانهائي في السحابة
            const stableId = (e.id && String(e.id).includes('-') && !String(e.id).includes('fix')) ? e.id : `exp-fix-${e.amount}-${e.category}-${e.delegatePhone || 'sys'}`;
            return {
              id: stableId,
              date: (e.id && String(e.id).includes('-')) ? e.id : new Date().toISOString(), // استعادة التاريخ الحقيقي
              category: (e.category && e.category !== 'expense' && e.category !== 'revenue') ? e.category : (e.date !== 'مصروف' && e.date !== 'إيراد' && e.date ? e.date : 'أخرى'),
              type: (e.type === 'revenue' || e.date === 'إيراد') ? 'revenue' : 'expense',
              amount: Number(e.amount) || 0,
              description: e.description || 'مصروف مسترد',
              delegateName: (e.delegateName || 'مجهول').replace(/\s*\(.*?\)/g, '').replace('الأستاذ/', '').trim(),
              delegatePhone: e.delegatePhone || ''
            };
          }
          return e;
        }).filter((e: any) => e.amount > 0);
        setExpenses(cleanedExpenses);

        setTrips(migrate(tr, 'trips_sys', []));
        setSyncLogs(migrate(logs, 'sync_logs_sys', []));
        const loadedSettings = migrate(set, 'settings_sys', DEFAULT_SETTINGS);
        // استخراج تلقائي لمناطق العمل من العملاء الحاليين والعملاء المكتشفين والعملاء المحتملين عند أول تحميل
        const loadedCustomers = migrate(cust, 'customers_sys', DEFAULT_CUSTOMERS);
        let loadedGoogleLeads: any[] = [];
        try {
          const raw = localStorage.getItem('google_leads_staging_sys');
          if (raw) loadedGoogleLeads = JSON.parse(raw);
        } catch (e) {}
        let loadedPotentialLeads: any[] = [];
        try {
          const raw = localStorage.getItem('potential_leads_sys');
          if (raw) loadedPotentialLeads = JSON.parse(raw);
        } catch (e) {}

        const existingWorkAreaPairs = new Set((loadedSettings.workAreas || []).map((w: any) => `${w.governorate}||${w.area}`));
        const derivedWorkAreas: { governorate: string; area: string }[] = [...(loadedSettings.workAreas || [])];

        const addPair = (gov: string, area: string) => {
          const cleanGov = (gov || 'أخرى').trim();
          const cleanArea = (area || '').trim();
          if (cleanArea && !existingWorkAreaPairs.has(`${cleanGov}||${cleanArea}`)) {
            existingWorkAreaPairs.add(`${cleanGov}||${cleanArea}`);
            derivedWorkAreas.push({ governorate: cleanGov, area: cleanArea });
          }
        };

        loadedCustomers.forEach((c: any) => addPair(c.governorate, c.area));
        loadedGoogleLeads.forEach((c: any) => addPair(c.governorate, c.area));
        loadedPotentialLeads.forEach((c: any) => addPair(c.governorate, c.area));

        setGoogleLeads(loadedGoogleLeads);
        setPotentialLeads(loadedPotentialLeads);
        setSettings({ ...loadedSettings, workAreas: derivedWorkAreas });

        // تحميل أرشيف دورات المصنع مع ترحيل من localStorage القديم
        let loadedArchive: any[] = archive || [];
        if (!loadedArchive || loadedArchive.length === 0) {
          // محاولة ترحيل من localStorage القديم (كل المفاتيح المحتملة)
          const delegatePhones = new Set<string>();
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('factory_archive_cycles_')) {
              const suffix = k.replace('factory_archive_cycles_', '');
              delegatePhones.add(suffix);
            }
          }
          delegatePhones.forEach(suffix => {
            try {
              const raw = localStorage.getItem(`factory_archive_cycles_${suffix}`);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  loadedArchive = [...loadedArchive, ...parsed];
                }
                localStorage.removeItem(`factory_archive_cycles_${suffix}`);
              }
            } catch {}
          });
        }
        setArchiveCycles(loadedArchive);
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
          
          // إرسال النسخة الاحتياطية إلى Google Drive مباشرة بدلاً من تحميلها على الهاتف فقط
          const scriptUrl = getSafeScriptUrl(settings.googleSheetsUrl);
          fetchWithTimeout(scriptUrl.trim(), {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              type: 'auto_backup',
              syncPhone: currentUser.phone,
              data: exportData
            })
          }, 15000).catch(e => console.error("Drive backup failed", e));
          
          localStorage.setItem('last_auto_backup_date_sys', today);
          showToast('☁️ تم إرسال النسخة الاحتياطية التلقائية إلى مجلد Google Drive الخاص بك بنجاح.');
        } catch (e) {
          console.error("Auto backup failed", e);
        }
      }, 8000); // يعمل بهدوء بعد 8 ثواني من فتح التطبيق
      return () => clearTimeout(timer);
    }
  }, [isDbLoaded, currentUser, products, customers, invoices, expenses, trips, factoryLoads, settings, usersList, syncLogs]);

  // السحب الصامت من السحابة عند بدء التشغيل لضمان حصول الجميع على آخر البيانات
  useEffect(() => {
    if (isDbLoaded) {
      handleUpdateData(true); // جلب البيانات صامتاً في الخلفية
    }
  }, [isDbLoaded]);

  // ⏱️ سحب دوري صامت كل 5 دقائق للتأكد من حصول المناديب على آخر التحديثات من الشيت
  useEffect(() => {
    if (!isDbLoaded || !currentUser) return;
    const interval = setInterval(() => {
      handleUpdateData(true);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isDbLoaded, currentUser?.phone]);

  // 💾 حفظ تلقائي عند محاولة إغلاق التبويب أو المتصفح
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // محاولة حفظ سريع للبيانات قبل إغلاق المتصفح
      try {
        syncAllDataToGoogle(true);
      } catch (err) {}
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncAllDataToGoogle]);

  // 🔄 سحب تلقائي عند العودة للتطبيق (التبديل من تبويب آخر)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentUser) {
        handleUpdateData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentUser, handleUpdateData]);

  // 🔄 إعادة محاولة تلقائية للمزامنة الفاشلة (إذا فشلت المزامنة، نعيد المحاولة بعد 30 ثانية)
  useEffect(() => {
    if (!isDbLoaded || !currentUser) return;
    const checkAndRetry = () => {
      try {
        const failTime = localStorage.getItem('last_sync_fail_time_sys');
        if (failTime) {
          const elapsed = Date.now() - Number(failTime);
          if (elapsed > 30000 && elapsed < 120000) {
            syncAllDataToGoogle(true);
          }
        }
        const pullFailTime = localStorage.getItem('last_pull_fail_time_sys');
        if (pullFailTime) {
          const elapsed = Date.now() - Number(pullFailTime);
          if (elapsed > 60000 && elapsed < 180000) {
            handleUpdateData(true);
          }
        }
      } catch(e) {}
    };
    const retryInterval = setInterval(checkAndRetry, 30000);
    return () => clearInterval(retryInterval);
  }, [isDbLoaded, currentUser?.phone, syncAllDataToGoogle, handleUpdateData]);

  // تحديث مؤشر آخر مزامنة من localStorage كل 15 ثانية
  useEffect(() => {
    const updateSyncInfo = () => {
      try {
        const lastSync = localStorage.getItem('last_sync_timestamp_sys');
        const lastPull = localStorage.getItem('last_pull_timestamp_sys');
        const latest = lastSync && lastPull ? (lastSync > lastPull ? lastSync : lastPull) : (lastSync || lastPull || '');
        if (latest) {
          const diffMs = Date.now() - new Date(latest).getTime();
          const diffMin = Math.floor(diffMs / 60000);
          if (diffMin < 1) setLastSyncInfo('الآن');
          else if (diffMin < 60) setLastSyncInfo(`منذ ${diffMin} د`);
          else setLastSyncInfo(`منذ ${Math.floor(diffMin / 60)} س`);
        } else {
          setLastSyncInfo('');
        }
      } catch(e) {}
    };
    updateSyncInfo();
    const syncInfoInterval = setInterval(updateSyncInfo, 15000);
    return () => clearInterval(syncInfoInterval);
  }, [isDbLoaded]);

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
  useEffect(() => { if (isDbLoaded) idbSet('factory_archive_cycles_sys', archiveCycles); }, [archiveCycles, isDbLoaded]);
  useEffect(() => { 
    if (isDbLoaded) {
      idbSet('settings_sys', settings);
      if (settings.googleMapsApiKey) {
        localStorage.setItem('GMP_API_KEY_FALLBACK', settings.googleMapsApiKey.trim());
      }
    }
  }, [settings, isDbLoaded]);

  // Startup Migration for Factory Payments
  useEffect(() => {
    if (!isDbLoaded) return;
    const legacyPaymentsRaw = localStorage.getItem('factory_extra_payments_sys');
    if (legacyPaymentsRaw) {
      try {
        const legacyPayments = JSON.parse(legacyPaymentsRaw);
        if (Array.isArray(legacyPayments) && legacyPayments.length > 0) {
          setExpenses(prev => {
            const updated = [...prev];
            legacyPayments.forEach((pay: any) => {
              const exists = updated.some(e => e.id === pay.id || (e.amount === pay.amount && String(e.description).includes(pay.notes || '')));
              if (!exists) {
                updated.push({
                  id: pay.id || `exp-factory-mig-${Date.now()}-${Math.random()}`,
                  amount: pay.amount,
                  category: 'سداد للمصنع',
                  type: 'factory_payment',
                  date: pay.date && pay.date.includes('-') ? pay.date : new Date().toISOString(),
                  description: JSON.stringify({
                    notes: pay.notes || 'تسديد مباشر',
                    appliedToCarriedDebt: pay.appliedToCarriedDebt || 0
                  }),
                  delegateName: currentUser?.name || 'مجهول',
                  delegatePhone: currentUser?.phone || ''
                });
              }
            });
            idbSet('expenses_sys', updated);
            return updated;
          });
        }
      } catch (e) {
        console.error("Error migrating legacy factory payments:", e);
      } finally {
        localStorage.removeItem('factory_extra_payments_sys');
      }
    }
  }, [isDbLoaded, currentUser]);

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
    const scriptUrl = getSafeScriptUrl(settings.googleSheetsUrl);
    if (!scriptUrl) return;
    setTimeout(async () => {
      showToast(`☁️ جاري الحفظ السحابي...`);
      const success = await syncAllDataToGoogle(true);
      if (success) {
        showToast(`✓ تم الحفظ السحابي بنجاح!`);
      } else {
        showToast(`⚠️ فشل الحفظ السحابي، تأكد من اتصالك بالإنترنت.`);
      }
    }, 800);
  };

  const markAsDeleted = (id: string) => {
    const deleted = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem('deleted_records_sys', JSON.stringify(deleted));
    }
  };

  const checkDeleteAllowed = (): boolean => {
    const allowed = currentUser?.role === 'owner' || currentUser?.phone === '01228466613' || (currentUser?.customRoleName && (currentUser.customRoleName.includes('نائب المدير') || currentUser.customRoleName.includes('مشرف عام')));
    if (!allowed) showToast('⚠️ الحذف متاح فقط للمدير ونائب المدير.');
    return allowed;
  };

  // دالة مساعدة لتنظيف وتوحيد أسماء المناديب ومنع الفوضى في الشيت
  const getCleanDelegateName = (user: UserAuth | null | undefined) => {
    if (!user || !user.name) return 'مجهول';
    return user.name.replace(/\s*\(.*?\)/g, '').replace('الأستاذ/', '').replace('نائب المدير العام والمشرف الجغرافي', '').replace('نائب المدير العام', '').trim() || 'مجهول';
  };

  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    if (checkSimulationGuard()) return;
    
    setProducts(prev => {
      const existingProductIndex = prev.findIndex(p => p.name.trim().toLowerCase() === newProd.name.trim().toLowerCase());
      if (existingProductIndex > -1) {
        // دمج الأوزان في حال كان الصنف موجود مسبقاً لمنع التكرار في القوائم المنسدلة
        const updatedProducts = [...prev];
        const existingProduct = updatedProducts[existingProductIndex];
        const mergedWeights = [...(existingProduct.weights || [])];
        
        if (newProd.weights) {
           newProd.weights.forEach(nw => {
             if (!mergedWeights.find(ew => ew.size === nw.size)) {
                mergedWeights.push({ ...nw, id: `weight-${Date.now()}-${Math.floor(Math.random() * 1000)}` });
             }
           });
        }
        
        updatedProducts[existingProductIndex] = {
           ...existingProduct,
           weights: mergedWeights,
           price: newProd.price,
           minStockAlert: newProd.minStockAlert,
           accountingUnit: newProd.accountingUnit
        };
        showToast('⚠️ الصنف موجود مسبقاً! تم دمج الأوزان الجديدة لمنع التكرار.');
        return updatedProducts;
      } else {
        const id = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        return [{ ...newProd, id }, ...prev];
      }
    });

    promptForSync('إضافة صنف جديد');
  };

  const handleEditProduct = (updatedProd: Product) => {
    if (checkSimulationGuard()) return;
    setProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
    promptForSync('تعديل صنف وتحديث السعر');
  };

  const handleDeleteProduct = async (id: string) => {
    if (checkSimulationGuard()) return;
    if (!checkDeleteAllowed()) return;
    const confirmed = await confirmDialog("هل أنت متأكد من حذف هذا الصنف نهائياً؟", true);
    if (!confirmed) return;
    setProducts(prev => prev.filter(p => p.id !== id));
    markAsDeleted(id);
    promptForSync('حذف صنف من المصنع');
  };

  const handleDeleteAllProducts = async () => {
    if (checkSimulationGuard()) return;
    if (!checkDeleteAllowed()) return;
    const confirmed = await confirmDialog("هل أنت متأكد من حذف جميع الأصناف نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.", true);
    if (!confirmed) return;
    products.forEach(p => markAsDeleted(p.id));
    factoryLoads.forEach(fl => markAsDeleted(fl.id));
    setProducts([]);
    setFactoryLoads([]);
    promptForSync('مسح جميع الأصناف');
  };

  const handleAddLoad = (newLoad: Omit<FactoryLoad, 'id'>) => {
    if (checkSimulationGuard()) return;
    const id = `load-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    setFactoryLoads(prev => [...prev, { 
      ...newLoad, 
      id,
      delegateName: newLoad.delegateName || getCleanDelegateName(currentUser),
      delegatePhone: newLoad.delegatePhone || currentUser?.phone || ''
    }]);
    promptForSync('سحب/تنزيل حمولة مصنع');
  };

  const handleDeleteLoad = async (id: string) => {
    if (checkSimulationGuard()) return;
    if (!checkDeleteAllowed()) return;
    const confirmed = await confirmDialog("هل أنت متأكد من حذف هذه الحمولة نهائياً؟", true);
    if (!confirmed) return;
    setFactoryLoads(prev => prev.filter(load => load.id !== id));
    markAsDeleted(id);
    promptForSync('حذف حمولة من السيارة');
  };

  const handleArchiveFactoryCycle = (delegatePhone: string, delegateName: string) => {
    const cleanName = (delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
    
    const ref = latestDataRef.current;

    // 1) Compute IDs to delete from CURRENT state (not from setState callback)
    const toDeleteLoadIds = ref.factoryLoads
      .filter(l => {
        const lPhone = (l.delegatePhone || '').trim();
        const lName = (l.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
        return (delegatePhone && lPhone === delegatePhone) || (cleanName && lName === cleanName);
      })
      .map(l => l.id);

    const toDeleteExpenseIds = ref.expenses
      .filter(e => {
        if (e.category === 'سداد للمصنع' || e.type === 'factory_payment') {
          const ePhone = (e.delegatePhone || '').trim();
          const eName = (e.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
          const eNotes = e.description || '';
          const matchByPhone = delegatePhone && ePhone === delegatePhone;
          const matchByName = cleanName && eName === cleanName;
          const matchByAdmin = ePhone === 'admin' || eName === 'المدير العام';
          const matchByNote = eNotes.includes('نيابة عن') && delegateName && eNotes.includes(delegateName);
          return matchByPhone || matchByName || matchByAdmin || matchByNote;
        }
        return false;
      })
      .map(e => e.id);

    // 2) Now call setState (filter out the matched records)
    setFactoryLoads(prev => prev.filter(l => !toDeleteLoadIds.includes(l.id)));
    setExpenses(prev => prev.filter(e => !toDeleteExpenseIds.includes(e.id)));

    // 3) markAsDeleted with the PRE-COMPUTED IDs (not empty arrays!)
    [...toDeleteLoadIds, ...toDeleteExpenseIds].forEach(id => markAsDeleted(id));

    promptForSync('أرشفة دورة حساب المصنع');
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
    setCustomers(prev => prev.map(c => c.id === editedCustomer.id ? editedCustomer : c));

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

  const handleDeleteCustomer = async (id: string) => {
    if (checkSimulationGuard()) return;
    if (!checkDeleteAllowed()) return;
    const confirmed = await confirmDialog("هل أنت متأكد من حذف هذا العميل نهائياً؟", true);
    if (!confirmed) return;
    setCustomers(prev => prev.filter(c => c.id !== id));
    markAsDeleted(id);
    promptForSync('حذف عميل من الدليل');
  };

  const handleAddInvoice = (newInvoice: Omit<Invoice, 'id'>) => {
    if (checkSimulationGuard()) return;
    const id = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    setInvoices(prev => [...prev, { 
      ...newInvoice, 
      id,
      delegateName: newInvoice.delegateName || getCleanDelegateName(currentUser),
      delegatePhone: newInvoice.delegatePhone || currentUser?.phone || ''
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
    const finalUpdated = {
      ...updated,
      delegateName: updated.delegateName || oldInv?.delegateName || getCleanDelegateName(currentUser),
      delegatePhone: updated.delegatePhone || oldInv?.delegatePhone || currentUser?.phone || ''
    };
    setInvoices(prev => prev.map(inv => inv.id === updated.id ? finalUpdated : inv));
    promptForSync('تحديث فاتورة بيع');
  };

  const handleDeleteInvoice = async (id: string) => {
    if (checkSimulationGuard()) return;
    if (!checkDeleteAllowed()) return;
    const confirmed = await confirmDialog("هل أنت متأكد من حذف هذه الفاتورة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.", true);
    if (!confirmed) return;
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
    const id = `exp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    setExpenses(prev => [...prev, { 
      ...newExpense, 
      id,
      delegateName: newExpense.delegateName || getCleanDelegateName(currentUser),
      delegatePhone: newExpense.delegatePhone || currentUser?.phone || ''
    }]);

    promptForSync(newExpense.type === 'revenue' ? 'إضافة إيراد/تحصيل' : 'حفظ مصروف');
  };

  const handleDeleteExpense = async (id: string) => {
    if (checkSimulationGuard()) return;
    if (!checkDeleteAllowed()) return;
    const confirmed = await confirmDialog("هل أنت متأكد من حذف هذا المصروف/الإيراد نهائياً؟", true);
    if (!confirmed) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
    markAsDeleted(id);
    promptForSync('حذف مصروف/إيراد');
  };

  const handleEditExpense = (id: string, updates: Partial<Omit<Expense, 'id'>>) => {
    if (checkSimulationGuard()) return;
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    promptForSync('تعديل مصروف/إيراد');
  };

  const handleAddTrip = (newTrip: Omit<Trip, 'id'>) => {
    if (checkSimulationGuard()) return;
    const id = `trip-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    setTrips(prev => [...prev, { 
      ...newTrip, 
      id,
      delegateName: newTrip.delegateName || getCleanDelegateName(currentUser),
      delegatePhone: newTrip.delegatePhone || currentUser?.phone || ''
    }]);

    promptForSync('تسجيل مشوار/نقلية');
  };

  const handleToggleCollected = (id: string) => {
    if (checkSimulationGuard()) return;
    setTrips(prev => prev.map(t => t.id === id ? { ...t, collected: !t.collected } : t));
    promptForSync('تعديل حالة تحصيل المشوار');
  };

  const handleEditTrip = (id: string, updates: Partial<Omit<Trip, 'id'>>) => {
    if (checkSimulationGuard()) return;
    setTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    promptForSync('تعديل بيانات مشوار');
  };

  const handleDeleteTrip = async (id: string) => {
    if (checkSimulationGuard()) return;
    if (!checkDeleteAllowed()) return;
    const confirmed = await confirmDialog("هل أنت متأكد من حذف هذا المشوار نهائياً؟", true);
    if (!confirmed) return;
    setTrips(prev => prev.filter(t => t.id !== id));
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
      products.forEach(p => markAsDeleted(p.id));
      factoryLoads.forEach(fl => markAsDeleted(fl.id));
      customers.forEach(c => markAsDeleted(c.id));
      invoices.forEach(inv => markAsDeleted(inv.id));
      expenses.forEach(e => markAsDeleted(e.id));
      trips.forEach(t => markAsDeleted(t.id));
      setProducts([]);
      setFactoryLoads([]);
      setCustomers([]);
      setInvoices([]);
      setExpenses([]);
      setTrips([]);
      const newVersion = Date.now();
      setDbVersion(newVersion);
      localStorage.setItem('app_db_version_sys', newVersion.toString());
    }
    setActiveTab('dashboard');
  };

  const handleFullReset = async () => {
    if (checkSimulationGuard()) return;
    if (!await confirmDialog('⚠️ تحذير: تهيئة كاملة!\n\nسيتم مسح جميع البيانات (المنتجات، الفواتير، العملاء، المصروفات، المشاوير، الحمولات) من التطبيق والشيت بالكامل.\n\nجميع المستخدمين (المدير والمندوبين) ستبدأ من الصفر بعد السحب.\n\nهل أنت متأكد؟')) return;

    setProducts([]);
    setFactoryLoads([]);
    setCustomers([]);
    setInvoices([]);
    setExpenses([]);
    setTrips([]);
    setGoogleLeads([]);
    setPotentialLeads([]);

    const newVersion = Date.now();
    setDbVersion(newVersion);
    localStorage.setItem('app_db_version_sys', newVersion.toString());

    showToast('☁️ جاري دفع التهيئة إلى الشيت...');
    setTimeout(async () => {
      const success = await syncAllDataToGoogle(true);
      if (success) {
        showToast('✓ تمت التهيئة الكاملة! الشيت فارغ والجميع سيتلقى التحديث عند السحب.');
      } else {
        showToast('⚠️ التهيئة المحلية تمت لكن فشل الحفظ في الشيت. حاول المزامنة يدوياً.');
      }
    }, 500);
  };

  async function syncAllDataToGoogle(silent = false): Promise<boolean> {
    const ref = latestDataRef.current;
    const scriptUrl = getSafeScriptUrl(ref.settings.googleSheetsUrl);
    const requestId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const startTime = performance.now();

    // Pre-push guard: check if sheet has a newer dbVersion (reset happened)
    try {
      const checkUrl = scriptUrl + (scriptUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      const checkResp = await fetchWithTimeout(checkUrl, { method: 'GET', cache: 'no-store', redirect: 'follow' }, 8000);
      if (checkResp.ok) {
        const checkData = await checkResp.json();
        if (checkData && checkData.dbVersion && typeof checkData.dbVersion === 'number' && checkData.dbVersion > ref.dbVersion) {
          if (!silent) {
            showToast('⚠️ تم تهيئة النظام من المدير. يرجى سحب البيانات أولاً قبل الرفع.');
          }
          setIsHeaderSyncing(false);
          return false;
        }
      }
    } catch (e) {
      // If check fails, proceed anyway (network issue)
    }

    try {
      setIsHeaderSyncing(true);
      
      // استخدام المرجع لضمان الحصول على البيانات الجديدة التي تم إضافتها للتو
      const { 
        invoices: currentInvoices, 
        expenses: currentExpenses, 
        factoryLoads: currentLoads, 
        trips: currentTrips, 
        products: currentProducts, 
        customers: currentCustomers, 
        usersList: currentUsers,
        googleLeads: currentGoogleLeads,
        potentialLeads: currentPotentialLeads
      } = latestDataRef.current;

      // 🚨 تعريف متغير مدير المزامنة الذي كان مفقوداً ويسبب انهيار صامت أثناء الرفع
      const isSyncManager = ref.currentUser?.role === 'owner' 
        || ref.currentUser?.phone === '01228466613'
        || (ref.currentUser?.customRoleName && (ref.currentUser.customRoleName.includes('نائب المدير') || ref.currentUser.customRoleName.includes('مشرف عام')));

      // حساب الصافي الحقيقي للتدفق النقدي لتصديره لشيت (الملخص)
      const totalCollected = currentInvoices.reduce((sum, inv) => sum + (inv.paidAmount !== undefined ? inv.paidAmount : (inv.totalAfterDiscount || 0)), 0);
      const totalSpent = currentExpenses.filter(e => e.type !== 'revenue').reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const extraRevenues = currentExpenses.filter(e => e.type === 'revenue').reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const totalTripsCollectedProfit = currentTrips.filter(t => t.collected).reduce((sum, t) => sum + (t.price || 0), 0);
      
      const currentAdvancesTotal = currentLoads.reduce((sum, fl) => sum + (fl.advanceAmount ?? 0), 0);
      const extraPayments = JSON.parse(localStorage.getItem('factory_extra_payments_sys') || '[]');
      const manualPaymentsSumTotal = extraPayments.reduce((sum: any, p: any) => sum + ((p.amount || 0) - (p.appliedToCarriedDebt || 0)), 0);
      const totalPaidToFactoryInPeriod = currentAdvancesTotal + manualPaymentsSumTotal;
      
      const netProfit = totalCollected + extraRevenues + totalTripsCollectedProfit - totalPaidToFactoryInPeriod - totalSpent;

      let deletedIds: string[] = [];
      if (isSyncManager) {
        try {
          deletedIds = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
        } catch(e) {}
      }

      const customersMap = new Map(currentCustomers.map(c => [String(c.id).trim(), c]));
      const productsMap = new Map(currentProducts.map(p => [String(p.id).trim(), p]));

      const discoveredLeads = currentGoogleLeads || [];
      const potentialLeads = currentPotentialLeads || [];

      const invoicesByCustomer = new Map();
      currentInvoices.forEach(inv => {
        if (!invoicesByCustomer.has(inv.customerId)) invoicesByCustomer.set(inv.customerId, []);
        invoicesByCustomer.get(inv.customerId).push(inv);
      });

      // جلب أحدث قائمة مناديب من الذاكرة مباشرة لتجنب تأخير حالة React وعدم رفعهم
      let freshUsersList = currentUsers;
      try {
        const localUsers = JSON.parse(localStorage.getItem('users_permissions_sys') || '[]');
        if (localUsers && localUsers.length > 0) freshUsersList = localUsers;
      } catch(e) {}

      const payload = {
        type: 'تقرير_كامل',
        syncPhone: ref.currentUser?.phone || '01228466613',
        syncRole: ref.currentUser?.role || 'owner',
        customRoleName: ref.currentUser?.customRoleName || '',
        canEditPrices: ref.currentUser?.canEditPrices !== false,
        dbVersion: ref.dbVersion,
        deletedIds: deletedIds,
        metadata: {
          syncedAt: new Date().toISOString(),
          app: 'نظام المبيعات والمخزون للسيارة',
          totalSales: Number(totalCollected) || 0,
          totalExpenses: Number(totalSpent) || 0,
          netProfit: Number(netProfit) || 0
        },
        invoices: currentInvoices.map(inv => {
          const cust = customersMap.get(inv.customerId);
          return {
            id: inv.id,
            invNum: inv.invoiceNumber,
            customerName: cust ? cust.name : (inv.customerName || 'عميل مجهول'),
            customerId: inv.customerId,
            area: cust ? cust.area : (inv.customerArea || 'منطقة مجهولة'),
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
        expenses: (currentExpenses || []).filter(e => e.amount > 0).map(e => ({
          id: e.id,
          date: e.date,
          amount: e.amount,
          category: e.category,
          type: e.type || 'expense',
          description: e.description,
          delegateName: e.delegateName || 'مجهول',
          delegatePhone: e.delegatePhone || ''
        })),
        trips: (currentTrips || []).map(t => ({
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
        products: (isSyncManager || currentUser?.canEditPrices !== false) ? currentProducts.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          count: p.weights ? p.weights.length : 0,
          weights: p.weights || []
        })) : [],
        customers: currentCustomers.map(c => {
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
        users: isSyncManager 
          ? freshUsersList.map(u => ({
              name: u.name.replace(/\s*\(.*?\)/g, '').trim(),
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
              lastLng: u.lastLng || '',
              canUseAiAssistant: u.canUseAiAssistant !== false,
              canApplyDiscount: u.canApplyDiscount !== false,
              maxDiscountPercentOfProfit: u.maxDiscountPercentOfProfit !== undefined ? u.maxDiscountPercentOfProfit : 100,
              maxExtraDiscountAmount: u.maxExtraDiscountAmount !== undefined ? u.maxExtraDiscountAmount : '',
              workArea: u.workArea || 'الكل'
            })) 
          : freshUsersList.filter(u => u.phone === (currentUser?.phone || '')).map(u => ({
              name: u.name.replace(/\s*\(.*?\)/g, '').trim(),
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
              lastLng: u.lastLng || '',
              canUseAiAssistant: u.canUseAiAssistant !== false,
              canApplyDiscount: u.canApplyDiscount !== false,
              maxDiscountPercentOfProfit: u.maxDiscountPercentOfProfit !== undefined ? u.maxDiscountPercentOfProfit : 100,
              maxExtraDiscountAmount: u.maxExtraDiscountAmount !== undefined ? u.maxExtraDiscountAmount : '',
              workArea: u.workArea || 'الكل'
            })),
        factoryLoads: (currentLoads || []).map(fl => {
          const prod = productsMap.get(String(fl.productId).trim());
          const activeWeights = prod ? (prod.weights && prod.weights.length > 0 ? prod.weights : getProductWeightsFallback(prod)) : [];
          const wt = activeWeights.find(w => String(w.id).trim() === String(fl.weightId).trim()) || activeWeights[0];
          return {
            id: fl.id,
            date: fl.date,
            productId: fl.productId,
            weightId: fl.weightId,
            productName: prod?.name || fl.productName || 'صنف مجهول',
            weightSize: wt?.size || fl.weightSize || 'عبوة',
            cartonsCount: fl.cartonsCount || 0,
            quantity: fl.quantity || 0,
            advanceAmount: fl.advanceAmount || 0,
            warehouseKeeper: fl.warehouseKeeper || '',
            delegateName: fl.delegateName || 'مجهول',
            delegatePhone: fl.delegatePhone || '',
            cartonPrice: fl.cartonPrice || wt?.cartonPriceFromFactory || (prod ? prod.price : 0),
            unitPrice: fl.unitPrice || (wt?.factoryPricePerUnit || (prod ? prod.price : 0))
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
        })),
        potentialLeads: potentialLeads.map((l: any) => ({
          id: l.id,
          governorate: l.governorate || 'القاهرة',
          area: l.area,
          name: l.name,
          phone: l.phone,
          detailedAddress: l.detailedAddress,
          locationLink: l.locationLink,
          type: l.type || '',
          dateAdded: l.dateAdded || ''
        })),
        factoryArchiveCycles: ref.archiveCycles || [],
        settings: {
          workAreas: ref.settings.workAreas || [],
          googleSheetsUrl: ref.settings.googleSheetsUrl || '',
          googleMapsApiKey: ref.settings.googleMapsApiKey || ''
        }
      };

      const response = await fetchWithTimeout(scriptUrl.trim(), {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      }, 60000);

      if (!response.ok) {
        throw new Error(`استجابة غير صالحة من السيرفر: ${response.status}`);
      }

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error('فشل في تحليل استجابة السيرفر كسلسلة JSON.');
      }

      if (responseData.error) {
        throw new Error(responseData.error);
      }

      if (responseData.status !== 'success') {
        throw new Error(responseData.message || 'فشلت عملية المزامنة السحابية.');
      }

      const elapsed = Math.round(performance.now() - startTime);

      setSyncLogs(prev => [{
        id: Date.now().toString() + Math.random(),
        timestamp: new Date().toISOString(),
        delegateName: ref.currentUser?.name || 'مجهول',
        status: 'success',
        actionDesc: 'مزامنة شاملة للبيانات',
        durationMs: elapsed
      }, ...prev]);

      // تحديث وقت آخر مزامنة ناجحة
      setLastSyncFailed(false);
      const syncTimestamp = new Date().toISOString();
      const diffMin = Math.floor((Date.now() - new Date(syncTimestamp).getTime()) / 60000);
      setLastSyncInfo('الآن');
      try {
        localStorage.setItem('last_sync_timestamp_sys', syncTimestamp);
        localStorage.setItem('last_sync_duration_ms_sys', String(elapsed));
      } catch(e) {}

      // 🚨 لا نُفرّغ deletedRecords_sys — المعرفات تبقى دائماً لمنع ظهور البيانات المحذوفة عند السحب من Google Sheets

      setIsHeaderSyncing(false);
      return true;
    } catch (err: any) {
      console.error('Error syncing to Google Sheets from header:', err);
      
      const elapsed = Math.round(performance.now() - startTime);

      setLastSyncFailed(true);
      setLastSyncInfo('فشل');

      setSyncLogs(prev => [{
        id: Date.now().toString() + Math.random(),
        timestamp: new Date().toISOString(),
        delegateName: currentUser?.name || 'مجهول',
        status: 'fail',
        actionDesc: 'فشل مزامنة شاملة',
        details: err.message,
        durationMs: elapsed
      }, ...prev]);

      // تخزين وقت الفشل للمحاولة لاحقاً
      try {
        localStorage.setItem('last_sync_fail_time_sys', Date.now().toString());
      } catch(e) {}

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
          lastActivityRef.current = Date.now();
          setIsLockedByTimeout(false);
          setLockPassword('');
          setLockError('');
        }}
      onForceSync={() => handleUpdateData(false)}
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
    const proceed = await confirmDialog("هل أنت متأكد من رغبتك في الخروج من النظام؟\n\nسيتم حفظ جميع بياناتك في السحابة أولاً. ولن يتم الخروج إلا بعد تأكيد نجاح الحفظ.", false);
    if (!proceed) return;

    setIsHeaderSyncing(true);
    showToast("🔄 جاري حفظ البيانات في السحابة... يرجى الانتظار");

    let retries = 0;
    let success = false;
    while (retries < 3 && !success) {
      success = await syncAllDataToGoogle(true);
      if (!success) {
        retries++;
        if (retries < 3) {
          showToast(`⚠️ محاولة ${retries}/3 — جاري إعادة المحاولة...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    setIsHeaderSyncing(false);

    if (success) {
      showToast("✓ تم الحفظ السحابي بنجاح! جاري الخروج...");
      await new Promise(r => setTimeout(r, 1000));
    } else {
      const forceProceed = await confirmDialog("⚠️ تعذر الحفظ السحابي بعد 3 محاولات.\nهل تريد المغادرة مع الحفظ المحلي فقط؟", true);
      if (!forceProceed) return;
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
    const ref = latestDataRef.current;
    const scriptUrl = getSafeScriptUrl(ref.settings.googleSheetsUrl);
    const startTime = performance.now();

    let shouldReplace = false;
    if (!isSilent) {
      const proceed = await confirmDialog("هل أنت متأكد من رغبتك في استدعاء وتحديث البيانات من السحابة (جوجل شيت)؟", false);
      if (!proceed) return;

      shouldReplace = await confirmDialog("كيف تريد تحديث البيانات؟\n\n[موافق]: مسح البيانات المحلية بالكامل واستبدالها ببيانات السحابة.\n[إلغاء]: دمج البيانات السحابية مع الموجودة (إضافة).", true);
      showToast("☁️ جاري استدعاء البيانات من السحابة...");
    }

    if (isSilent) setIsFetchingData(true);

    try {
      // إضافة المتغير العشوائي وتفعيل منع الكاش لضمان سحب أحدث بيانات من جوجل شيت
      const urlSeparator = scriptUrl.includes('?') ? '&' : '?';
      const fetchUrl = scriptUrl + urlSeparator + 't=' + Date.now();
      
      const response = await fetchWithTimeout(fetchUrl, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      });
      if (!response.ok) {
        throw new Error(`استجابة غير صالحة من السيرفر: ${response.status}`);
      }
      const data = await response.json();

      // Check for dbVersion — if sheet has a newer version, force full replace
      if (data && data.dbVersion && typeof data.dbVersion === 'number' && data.dbVersion > ref.dbVersion) {
        shouldReplace = true;
        setDbVersion(data.dbVersion);
        localStorage.setItem('app_db_version_sys', data.dbVersion.toString());
        if (!isSilent) {
          showToast('⚠️ تم اكتشاف تهيئة للنظام — جاري استبدال البيانات المحلية ببيانات الشيت.');
        }
      }

      let deletedIds: string[] = [];
      const isUserAdmin = ref.currentUser?.role === 'owner' || ref.currentUser?.phone === '01228466613' || (ref.currentUser?.customRoleName && (ref.currentUser.customRoleName.includes('نائب المدير') || ref.currentUser.customRoleName.includes('مشرف عام')));
      if (isUserAdmin) {
        try {
          deletedIds = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
        } catch(e) {}
      }

      let finalProducts = ref.products;
      let finalCustomers = ref.customers;
      let finalInvoices = ref.invoices;
      let finalExpenses = ref.expenses;
      let finalTrips = ref.trips;
      let finalLoads = ref.factoryLoads;
      let updatedSettings = { ...ref.settings };

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
            canUseAiAssistant: u.canUseAiAssistant !== false,
            canApplyDiscount: u.canApplyDiscount !== false,
            maxDiscountPercentOfProfit: u.maxDiscountPercentOfProfit !== undefined ? Number(u.maxDiscountPercentOfProfit) : 100,
            maxExtraDiscountAmount: u.maxExtraDiscountAmount !== undefined && u.maxExtraDiscountAmount !== '' ? Number(u.maxExtraDiscountAmount) : undefined,
            password: btoa(encodeURIComponent(String(u.password || '').replace(/^'/, '').trim())),
            customRoleName: String(u.customRoleName || ''),
            lastActive: u.lastActive || undefined,
            lastLat: Number(u.lastLat) || undefined,
            lastLng: Number(u.lastLng) || undefined,
            workArea: u.workArea || 'الكل',
            createdAt: u.createdAt || new Date().toISOString()
          })).map((u: any) => ENSURE_OWNER_PERMS(u));

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

          // تحديث رمز الإدارة المحلي إذا تم تعديله من جوجل شيت
          const managerFromSheet = uniqueMappedUsers.find((u: any) => u.phone === '01228466613' || u.role === 'owner');
          if (managerFromSheet && managerFromSheet.password) {
             try {
                const decoded = decodeURIComponent(atob(managerFromSheet.password)).trim();
                localStorage.setItem('owner_passcode_sys', decoded);
             } catch(e) {
                localStorage.setItem('owner_passcode_sys', String(managerFromSheet.password).trim());
             }
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
            
            const weightId = String(fp.weightId || 'w-' + Math.random().toString(36).substr(2, 9));
            const weightSize = String(fp.size || 'كرتونة');
            
            const existingWeight = productGroups[pid].weights!.find(w => w.id === weightId || w.size === weightSize);
            
            if (!existingWeight) {
                productGroups[pid].weights!.push({
                  id: weightId,
                  size: weightSize,
                  cartonPriceFromFactory: Number(fp.cartonPriceFromFactory || 0),
                  unitsPerCarton: Number(fp.unitsPerCarton || 12),
                  factoryPricePerUnit: Number(fp.factoryPricePerUnit || 0),
                  profitMarginPercent: 0,
                  addedValue: Number(fp.addedValue || 0),
                  retailPricePerUnit: Number(fp.retailPricePerUnit || 0)
                });
            } else {
                existingWeight.cartonPriceFromFactory = Number(fp.cartonPriceFromFactory || existingWeight.cartonPriceFromFactory);
                existingWeight.unitsPerCarton = Number(fp.unitsPerCarton || existingWeight.unitsPerCarton);
                existingWeight.factoryPricePerUnit = Number(fp.factoryPricePerUnit || existingWeight.factoryPricePerUnit);
                existingWeight.addedValue = Number(fp.addedValue || existingWeight.addedValue);
                existingWeight.retailPricePerUnit = Number(fp.retailPricePerUnit || existingWeight.retailPricePerUnit);
            }
          });
          
          const mappedProducts = Object.values(productGroups).filter((p: any) => !deletedIds.includes(p.id));
          if (shouldReplace) {
            finalProducts = mappedProducts;
          } else {
            const mappedIds = new Set(mappedProducts.map((p: any) => String(p.id)));
            const merged = [...ref.products];
            mappedProducts.forEach(np => {
              // الاعتماد على الاسم بجانب الـ ID لمنع تكرار الصنف نهائياً
              const idx = merged.findIndex(p => p.id === np.id || p.name.trim().toLowerCase() === np.name.trim().toLowerCase());
              if (idx > -1) {
                  merged[idx] = { ...np, id: merged[idx].id } as Product;
              } else {
                  merged.push(np as Product);
              }
            });
            finalProducts = merged.filter(p => mappedIds.has(p.id));
          }
          setProducts(finalProducts);
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
          })).filter((p: any) => !deletedIds.includes(p.id));
          if (shouldReplace) {
            finalProducts = mappedProducts;
          } else {
            const mappedIds = new Set(mappedProducts.map((p: any) => String(p.id)));
            const merged = [...ref.products];
            mappedProducts.forEach((np: any) => {
              const idx = merged.findIndex(p => p.id === np.id);
              if (idx > -1) merged[idx] = np;
              else merged.push(np);
            });
            finalProducts = merged.filter(p => mappedIds.has(p.id));
          }
          setProducts(finalProducts);
        }

        // 3. Update customers list
        if (data.customers && Array.isArray(data.customers)) {
          const mappedCustomers = data.customers.map((c: any) => ({
            id: c.id || c.phone || String(Math.random()),
            name: c.name,
            phone: (() => {
              let p = String(c.phone || '').replace(/^'/, '').replace(/\s+/g, '').trim();
              if (p.length === 10 && p.startsWith('1')) return '0' + p;
              return p;
            })(),
            area: c.area || 'غير محدد',
            governorate: c.governorate || 'القاهرة',
            detailedAddress: c.detailedAddress || '',
            locationLink: c.locationLink || '',
            purchasesCount: Number(c.purchasesCount || 0),
            salesManager: c.salesManager || '',
            totalSpent: Number(c.totalSpent || 0),
            lastPurchaseDate: c.lastPurchaseDate || '',
            type: c.type || c.activity || c.businessActivity || ''
          })).filter((c: any) => !deletedIds.includes(c.id));
          if (shouldReplace) {
            finalCustomers = mappedCustomers;
          } else {
            const mappedIds = new Set(mappedCustomers.map((c: any) => String(c.id)));
            const merged = [...ref.customers];
            mappedCustomers.forEach((nc: any) => {
              const idx = merged.findIndex(c => c.id === nc.id || (c.phone && c.phone === nc.phone));
              if (idx > -1) {
                merged[idx] = { ...merged[idx], ...nc };
              } else {
                merged.push(nc);
              }
            });
            finalCustomers = merged.filter(c => mappedIds.has(c.id));
          }
          setCustomers(finalCustomers);

          // تحديث تلقائي لـ workAreas من بيانات العملاء المسحوبة من الشيت (عملاء، عملاء مكتشفين، عملاء محتملين)
          const existingPairs = new Set((updatedSettings.workAreas || []).map(w => `${w.governorate}||${w.area}`));
          const newPairs: { governorate: string; area: string }[] = [];

          const addPair = (gov: string, area: string) => {
            const cleanGov = (gov || 'أخرى').trim();
            const cleanArea = (area || '').trim();
            if (cleanArea && !existingPairs.has(`${cleanGov}||${cleanArea}`)) {
              existingPairs.add(`${cleanGov}||${cleanArea}`);
              newPairs.push({ governorate: cleanGov, area: cleanArea });
            }
          };

          // 1. العملاء الفعليين
          finalCustomers.forEach((c: any) => addPair(c.governorate, c.area));

          // 2. العملاء المكتشفين
          if (data.discoveredLeads && Array.isArray(data.discoveredLeads)) {
            data.discoveredLeads.forEach((c: any) => addPair(c.governorate, c.area));
          }

          // 3. العملاء المحتملين
          if (data.potentialLeads && Array.isArray(data.potentialLeads)) {
            data.potentialLeads.forEach((c: any) => addPair(c.governorate, c.area));
          }

          if (newPairs.length > 0) {
            updatedSettings = { ...updatedSettings, workAreas: [...(updatedSettings.workAreas || []), ...newPairs] };
            setSettings(updatedSettings);
          }
        }

        // 4. Update operational tables (Invoices, Expenses, Trips, Factory loads)
        if (data.invoices && Array.isArray(data.invoices)) {
          const mappedInvoices = data.invoices.map((inv: any) => {
            const cust = customers.find(c => c.id === inv.customerId || c.name === inv.customerName);
            return {
              id: inv.id || inv.invNum || inv.invoiceNumber || String(Math.random()),
              invoiceNumber: inv.invNum || inv.invoiceNumber,
              customerId: cust ? cust.id : (inv.customerId || 'cust_' + Date.now()),
              customerName: inv.customerName || (cust ? cust.name : 'عميل مجهول'),
              customerArea: inv.area || (cust ? cust.area : 'منطقة مجهولة'),
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
              isDelivered: (inv.isDelivered === '' || inv.isDelivered === undefined) ? true : (inv.isDelivered === 'true' || inv.isDelivered === true)
            };
          }).filter((inv: any) => !deletedIds.includes(inv.id));
          
          if (shouldReplace) {
            finalInvoices = mappedInvoices;
          } else {
            const mappedIds = new Set(mappedInvoices.map((i: any) => String(i.id)));
            const merged = [...ref.invoices];
            mappedInvoices.forEach((ni: any) => {
              const idx = merged.findIndex(i => i.id === ni.id);
              if (idx > -1) merged[idx] = ni;
              else merged.push(ni);
            });
            finalInvoices = merged;
          }
          setInvoices(finalInvoices);
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
          })).filter((l: any) => !deletedIds.includes(l.id));
          setGoogleLeads(prev => {
            if (shouldReplace) {
              return mappedLeads;
            } else {
              const mappedIds = new Set(mappedLeads.map((l: any) => String(l.id)));
              const merged = [...prev];
              mappedLeads.forEach((nl: any) => {
                const idx = merged.findIndex((l: any) => l.id === nl.id);
                if (idx > -1) merged[idx] = nl;
                else merged.push(nl);
              });
              return merged.filter(l => mappedIds.has(l.id));
            }
          });
        }

        if (data.potentialLeads && Array.isArray(data.potentialLeads)) {
          const mappedPotential = data.potentialLeads.map((l: any) => ({
            id: String(l.id || Math.random()).replace(/^'/, ''),
            governorate: l.governorate || 'القاهرة',
            area: l.area || '',
            name: l.name || '',
            phone: String(l.phone || '').replace(/^'/, ''),
            detailedAddress: l.detailedAddress || '',
            locationLink: l.locationLink || '',
            type: l.type || '',
            dateAdded: l.dateAdded || ''
          })).filter((l: any) => !deletedIds.includes(l.id));
          setPotentialLeads(prev => {
            if (shouldReplace) {
              return mappedPotential;
            } else {
              const mappedIds = new Set(mappedPotential.map((l: any) => String(l.id)));
              const merged = [...prev];
              mappedPotential.forEach((nl: any) => {
                const idx = merged.findIndex((l: any) => l.id === nl.id);
                if (idx > -1) merged[idx] = nl;
                else merged.push(nl);
              });
              return merged.filter(l => mappedIds.has(l.id));
            }
          });
        }

        if (data.expenses && Array.isArray(data.expenses)) {
          const mappedExpenses = data.expenses.map((e: any) => {
            const isShifted = e.date === 'مصروف' || e.date === 'إيراد' || e.date === 'expense' || e.date === 'revenue' || !e.date || !String(e.date).includes('-');
            if (isShifted) {
              const stableId = (e.id && String(e.id).includes('-')) ? e.id : `exp-fix-${e.amount}-${(e.category || 'other').trim()}-${(e.delegatePhone || 'sys').trim()}`;
              return {
                id: stableId,
                date: (e.id && String(e.id).includes('-') && !String(e.id).includes('fix')) ? e.id : new Date().toISOString(),
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
          }).filter((e: any) => e.amount > 0 && !deletedIds.includes(e.id));
          if (shouldReplace) {
            finalExpenses = mappedExpenses;
          } else {
            const mappedIds = new Set(mappedExpenses.map((e: any) => String(e.id)));
            const merged = [...ref.expenses];
            mappedExpenses.forEach((ne: any) => {
              const idx = merged.findIndex(e => e.id === ne.id);
              if (idx > -1) merged[idx] = ne;
              else merged.push(ne);
            });
            finalExpenses = merged.filter(e => mappedIds.has(e.id));
          }
          setExpenses(finalExpenses);
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
          })).filter((t: any) => !deletedIds.includes(t.id));
          if (shouldReplace) {
            finalTrips = mappedTrips;
          } else {
            const mappedIds = new Set(mappedTrips.map((t: any) => String(t.id)));
            const merged = [...ref.trips];
            mappedTrips.forEach((nt: any) => {
              const idx = merged.findIndex(t => t.id === nt.id);
              if (idx > -1) merged[idx] = nt;
              else merged.push(nt);
            });
            finalTrips = merged.filter(t => mappedIds.has(t.id));
          }
          setTrips(finalTrips);
        }

        if (data.factoryLoads && Array.isArray(data.factoryLoads)) {
          const mappedLoads = data.factoryLoads.map((fl: any) => ({
            id: fl.id || fl.date + '-' + fl.productId || String(Math.random()),
            date: fl.date,
            productId: fl.productId,
            weightId: fl.weightId,
            productName: fl.productName,
            weightSize: fl.weightSize || 'كرتونة',
            cartonsCount: Number(fl.cartonsCount || 0),
            quantity: Number(fl.quantity || 0),
            advanceAmount: Number(fl.advanceAmount || 0),
            warehouseKeeper: fl.warehouseKeeper || '',
            delegateName: fl.delegateName || '',
            delegatePhone: fl.delegatePhone || '',
            cartonPrice: fl.cartonPrice !== undefined ? Number(fl.cartonPrice) : undefined,
            unitPrice: fl.unitPrice !== undefined ? Number(fl.unitPrice) : undefined
          })).filter((fl: any) => !deletedIds.includes(fl.id));
          if (shouldReplace) {
            finalLoads = mappedLoads;
          } else {
            const mappedIds = new Set(mappedLoads.map((l: any) => String(l.id)));
            const merged = [...ref.factoryLoads];
            mappedLoads.forEach((nl: any) => {
              const idx = merged.findIndex(l => l.id === nl.id);
              if (idx > -1) merged[idx] = nl;
              else merged.push(nl);
            });
            finalLoads = merged.filter(l => mappedIds.has(l.id));
          }
          setFactoryLoads(finalLoads);
        }

        if (data.factoryArchiveCycles && Array.isArray(data.factoryArchiveCycles)) {
          const mappedArchive = data.factoryArchiveCycles.map((c: any) => ({
            id: c.id || String(Date.now()),
            settledAt: c.settledAt || '',
            settledFully: c.settledFully !== false,
            loads: c.loads || [],
            payments: c.payments || [],
            rawLoadedValue: Number(c.rawLoadedValue || 0),
            totalWithdrawnValue: Number(c.totalWithdrawnValue || 0),
            totalAdvancePayments: Number(c.totalAdvancePayments || 0),
            creditBalance: Number(c.creditBalance || 0),
            carriedOverDebtAtTime: Number(c.carriedOverDebtAtTime || 0),
            waivedAmount: Number(c.waivedAmount || 0),
            delegatePhone: c.delegatePhone || '',
            delegateName: c.delegateName || ''
          }));
          if (shouldReplace) {
            setArchiveCycles(mappedArchive);
          } else {
            const mappedIds = new Set(mappedArchive.map((c: any) => String(c.id)));
            const merged = [...ref.archiveCycles];
            mappedArchive.forEach((nc: any) => {
              const idx = merged.findIndex(c => c.id === nc.id);
              if (idx > -1) merged[idx] = nc;
              else merged.push(nc);
            });
            setArchiveCycles(merged.filter(c => mappedIds.has(String(c.id))));
          }
        }

        // Write explicitly to IndexedDB to guarantee persistence before reload
        await Promise.all([
          idbSet('products_sys', finalProducts),
          idbSet('customers_sys', finalCustomers),
          idbSet('invoices_sys', finalInvoices),
          idbSet('expenses_sys', finalExpenses),
          idbSet('trips_sys', finalTrips),
          idbSet('factory_sys', finalLoads),
          idbSet('settings_sys', updatedSettings),
          idbSet('factory_archive_cycles_sys', ref.archiveCycles)
        ]);

        if (!isSilent) {
          showToast("✓ تم التحديث بنجاح! جاري تنشيط الواجهة...");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }

        // تخزين وقت آخر سحب ناجح
        const elapsed = Math.round(performance.now() - startTime);
        try {
          localStorage.setItem('last_pull_timestamp_sys', new Date().toISOString());
          localStorage.setItem('last_pull_duration_ms_sys', String(elapsed));
        } catch(e) {}
      } else {
        if (!isSilent) {
          showToast("تنبيه: تم إرجاع بيانات فارغة ومخالفة للنموذج. جاري التحميل العادي...");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setLastSyncFailed(true);
      setLastSyncInfo('فشل');
      console.error("Refresh GET error from Google Sheets App after " + elapsed + "ms:", err);
      try {
        localStorage.setItem('last_pull_fail_time_sys', Date.now().toString());
        localStorage.setItem('last_pull_duration_ms_sys', String(elapsed));
      } catch(e) {}
      if (!isSilent) {
        showToast("تعذر جلب البيانات السحابية. تعمل الآن على الذاكرة المحلية للتطبيق ✓");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } finally {
      if (isSilent) setIsFetchingData(false);
    }
  }

  // Data Isolation Logic (عزل بيانات المناديب ما لم يكن المدير العام)
  const isManager = effectiveUser?.role === 'owner' || effectiveUser?.phone === '01228466613';
  const filteredFactoryLoads = isManager ? factoryLoads : factoryLoads.filter(l => l.delegatePhone === effectiveUser?.phone || (l.delegateName && effectiveUser?.name && l.delegateName.includes(effectiveUser.name.replace(/\s*\(.*?\)/g, '').trim())));
  const filteredInvoices = isManager ? invoices : invoices.filter(i => i.delegatePhone === effectiveUser?.phone || (i.delegateName && effectiveUser?.name && i.delegateName.includes(effectiveUser.name.replace(/\s*\(.*?\)/g, '').trim())));
  const filteredExpenses = isManager ? expenses : expenses.filter(e => e.delegatePhone === effectiveUser?.phone || (e.delegateName && effectiveUser?.name && e.delegateName.includes(effectiveUser.name.replace(/\s*\(.*?\)/g, '').trim())));
  const filteredTrips = isManager ? trips : trips.filter(t => t.delegatePhone === effectiveUser?.phone || (t.delegateName && effectiveUser?.name && t.delegateName.includes(effectiveUser.name.replace(/\s*\(.*?\)/g, '').trim())));

  const MAPS_LIBRARIES: any[] = ['places', 'geocoding', 'geometry'];

  // قراءة المفتاح بالأولوية الصحيحة:
  // 1. متغيّر بيئة Vercel للبيئة التطويرية/معاينة
  // 2. متغيّر بيئة Vercel للإنتاج
  // 3. مفتاح مخزن في الإعدادات (يأتي من Google Sheets)
  // 4. مفتاح مخزن في localStorage (fallback فوري قبل جلب الإعدادات)
  let envKey = '';
  try { envKey = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY?.trim() || import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''; } catch(e) {}
  if (envKey === 'YOUR_API_KEY') envKey = '';

  const localKey = settings.googleMapsApiKey?.trim() || localStorage.getItem('GMP_API_KEY_FALLBACK')?.trim() || '';
  const validLocalKey = localKey && localKey !== 'YOUR_API_KEY' ? localKey : '';

  const activeKey = validLocalKey || envKey || '';

  return (
    <APIProvider key={activeKey || 'no-key'} apiKey={activeKey} version="beta" libraries={MAPS_LIBRARIES}>
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
                {lastSyncInfo && (
                  <span className="text-[10px] text-cyan-300 font-bold" title="آخر مزامنة مع السحابة">
                    ☁️ {lastSyncInfo}
                  </span>
                )}
                {isHeaderSyncing && (
                  <span className="text-[10px] text-amber-300 font-bold animate-pulse">جاري المزامنة...</span>
                )}
                {lastSyncFailed && !isHeaderSyncing && (
                  <span className="text-[10px] text-red-400 mr-2 font-bold" title="فشلت المزامنة - سيتم إعادة المحاولة تلقائياً">
                    ⚠️ فشل
                  </span>
                )}
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
                {lastSyncInfo && (
                  <span className="text-[10px] text-cyan-300 mr-2 font-bold" title="آخر مزامنة مع السحابة">
                    ☁️ {lastSyncInfo}
                  </span>
                )}
                {isHeaderSyncing && (
                  <span className="text-[10px] text-amber-300 mr-2 font-bold animate-pulse">جاري المزامنة...</span>
                )}
                {lastSyncFailed && !isHeaderSyncing && (
                  <span className="text-[10px] text-red-400 mr-2 font-bold" title="فشلت المزامنة - سيتم إعادة المحاولة تلقائياً">
                    ⚠️ فشل
                  </span>
                )}
              </span>
            )}
          </span>
        </div>

        {/* Actions Button Container (Left Side in RTL due to justify-between) */}
        <div className="flex items-center gap-2 mt-2.5 mb-0 pb-0 mr-0">
          {effectiveUser.canUseAiAssistant !== false && (
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
          )}

          <button
            onClick={() => handleUpdateData(false)}
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
              onClick={() => setShowSimulatedInventory(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1 border border-emerald-700"
            >
              <span>📦</span>
              <span>جرد السيارة</span>
            </button>
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
                setDelegateMonitorTab(null);
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
                                setDelegateMonitorTab(null);
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

      {/* مؤشر جلب البيانات من السحابة */}
      {isFetchingData && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-200 py-1.5 px-3 text-center flex items-center justify-center gap-2 animate-fade-in">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-bold text-blue-700">جاري جلب أحدث البيانات من السحابة...</span>
        </div>
      )}

      <main className="flex-grow w-full">
        {/* Monitoring Mode: Delegate Dashboard or sub-tabs */}
        {simulatedDelegate && !delegateMonitorTab && (
          <DelegateDashboard
            delegate={simulatedDelegate}
            factoryLoads={filteredFactoryLoads}
            invoices={filteredInvoices}
            expenses={filteredExpenses}
            trips={filteredTrips}
            onNavigate={setActiveTab}
            onExit={() => {
              setSimulatedDelegate(null);
              setDelegateMonitorTab(null);
              showToast("تم الخروج والرجوع لصلاحيات المدير العام.");
            }}
            onViewLoads={() => setDelegateMonitorTab('loads')}
            onViewInvoices={() => setDelegateMonitorTab('invoices')}
            onViewExpenses={() => setDelegateMonitorTab('expenses')}
            onViewTrips={() => setDelegateMonitorTab('trips')}
            onViewCustomers={() => setDelegateMonitorTab('customers')}
          />
        )}

        {simulatedDelegate && delegateMonitorTab === 'loads' && (
          <FactoryTab
            products={products}
            factoryLoads={filteredFactoryLoads}
            invoices={filteredInvoices}
            trips={filteredTrips}
            expenses={filteredExpenses}
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
            onClearAllData={() => { handleResetDatabase(false); }}
            onGoBack={() => setDelegateMonitorTab(null)}
            permittedSubTabs={effectiveUser.permittedSubTabs}
            canEditPrices={effectiveUser.canEditPrices !== false}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onEditExpense={handleEditExpense}
            currentUser={effectiveUser}
            onArchiveFactoryCycle={handleArchiveFactoryCycle}
          />
        )}

        {simulatedDelegate && delegateMonitorTab === 'invoices' && (
          <InvoiceTab
            customers={customers}
            products={products}
            factoryLoads={filteredFactoryLoads}
            invoices={filteredInvoices}
            onAddInvoice={handleAddInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onGoBack={() => setDelegateMonitorTab(null)}
            permittedSubTabs={effectiveUser.permittedSubTabs}
            currentUser={effectiveUser}
            usersList={usersList}
            initialSubTab="archive"
          />
        )}

        {simulatedDelegate && delegateMonitorTab === 'expenses' && (
          <ExpensesTab
            expenses={filteredExpenses}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onGoBack={() => setDelegateMonitorTab(null)}
            initialSubTab="revenue"
            summaryData={{
              totalInvoiceAmount: filteredInvoices.reduce((s, i) => s + (i.totalAfterDiscount || 0), 0),
              totalPaidAmount: filteredInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0),
              totalLoadCost: filteredFactoryLoads.reduce((s, l) => s + ((l.unitPrice || 0) * (l.quantity || 0)) + ((l.cartonPrice || 0) * (l.cartonsCount || 0)), 0),
              totalExpenseAmount: filteredExpenses.filter(e => e.type !== 'revenue').reduce((s, e) => s + (e.amount || 0), 0),
              totalRevenueAmount: filteredExpenses.filter(e => e.type === 'revenue').reduce((s, e) => s + (e.amount || 0), 0),
              totalTripAmount: filteredTrips.reduce((s, t) => s + (t.price || 0), 0),
              factorySoldCost: filteredInvoices.reduce((s, inv) => {
                if (!Array.isArray(inv.items)) return s;
                return s + inv.items.reduce((s2, it) => {
                  if (!it) return s2;
                  const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
                  const weights = prod ? getProductWeightsFallback(prod) : [];
                  const w = weights.find(ww => String(ww.id).trim() === String(it.weightId).trim()) || weights[0];
                  return s2 + (getItemFactoryCost(it, w, prod) * (it.quantity || 0));
                }, 0);
              }, 0),
            }}
          />
        )}

        {simulatedDelegate && delegateMonitorTab === 'trips' && (
          <FactoryTab
            products={products}
            factoryLoads={filteredFactoryLoads}
            invoices={filteredInvoices}
            trips={filteredTrips}
            expenses={filteredExpenses}
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
            onClearAllData={() => { handleResetDatabase(false); }}
            onGoBack={() => setDelegateMonitorTab(null)}
            permittedSubTabs={effectiveUser.permittedSubTabs}
            canEditPrices={effectiveUser.canEditPrices !== false}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onEditExpense={handleEditExpense}
            currentUser={effectiveUser}
            onArchiveFactoryCycle={handleArchiveFactoryCycle}
          />
        )}

        {simulatedDelegate && delegateMonitorTab === 'customers' && (
          <CustomersTab
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onEditCustomer={handleEditCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onGoBack={() => setDelegateMonitorTab(null)}
            settings={settings}
            permittedSubTabs={effectiveUser.permittedSubTabs}
            currentUser={effectiveUser}
            googleMapsApiKey={activeKey}
            googleLeads={googleLeads}
            setGoogleLeads={setGoogleLeads}
            potentialLeads={potentialLeads}
            setPotentialLeads={setPotentialLeads}
          />
        )}

        {/* Regular mode: existing tabs */}
        {!simulatedDelegate && activeTab === 'dashboard' && effectiveUser && (
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

        {!simulatedDelegate && activeTab === 'factory' && effectiveUser && effectiveUser.permittedTabs.includes('factory') && (
          <FactoryTab
            products={products}
            factoryLoads={filteredFactoryLoads}
            invoices={filteredInvoices}
            trips={filteredTrips}
            expenses={filteredExpenses}
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
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onEditExpense={handleEditExpense}
            currentUser={effectiveUser}
            onArchiveFactoryCycle={handleArchiveFactoryCycle}
            archiveCycles={archiveCycles}
            onUpdateArchiveCycles={setArchiveCycles}
          />
        )}

        {!simulatedDelegate && activeTab === 'customers' && effectiveUser && effectiveUser.permittedTabs.includes('customers') && (
          <CustomersTab
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onEditCustomer={handleEditCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onGoBack={() => setActiveTab('dashboard')}
            settings={settings}
            permittedSubTabs={effectiveUser.permittedSubTabs}
            currentUser={effectiveUser}
            googleMapsApiKey={activeKey}
            googleLeads={googleLeads}
            setGoogleLeads={setGoogleLeads}
            potentialLeads={potentialLeads}
            setPotentialLeads={setPotentialLeads}
          />
        )}

        {!simulatedDelegate && activeTab === 'invoice' && effectiveUser && effectiveUser.permittedTabs.includes('invoice') && (
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
            currentUser={effectiveUser}
            usersList={usersList}
          />
        )}

        {!simulatedDelegate && activeTab === 'prices' && effectiveUser && effectiveUser.permittedTabs.includes('prices') && (
          <PricesTab
            products={products}
            onGoBack={() => setActiveTab('dashboard')}
            permittedSubTabs={effectiveUser.permittedSubTabs}
          />
        )}

        {!simulatedDelegate && activeTab === 'expenses' && effectiveUser && effectiveUser.permittedTabs.includes('expenses') && (
          <ExpensesTab
            expenses={filteredExpenses}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onGoBack={() => setActiveTab('dashboard')}
          />
        )}

        {!simulatedDelegate && activeTab === 'administrative' && effectiveUser && effectiveUser.permittedTabs.includes('administrative') && (
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
              setSyncLogs(prev => [{ ...newLog, id: Date.now().toString() + Math.random(), timestamp: new Date().toISOString() }, ...prev]);
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
            onFullReset={handleFullReset}
            onGoBack={() => setActiveTab('dashboard')}
            onTriggerSync={promptForSync}
            onRefreshData={() => handleUpdateData(true)}
          />
        )}

        {!simulatedDelegate && activeTab === 'reports' && effectiveUser && effectiveUser.permittedTabs.includes('reports') && (
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
            onAddExpense={handleAddExpense}
            onGoBack={() => setActiveTab('dashboard')}
            currentUser={effectiveUser}
            permittedSubTabs={effectiveUser.permittedSubTabs}
          />
        )}

        {!simulatedDelegate && activeTab === 'personal_settings' && (
          <PersonalSettingsTab
            onGoBack={() => setActiveTab('dashboard')}
          />
        )}

      </main>

      <AnimatePresence>
        {showSimulatedInventory && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs text-right animate-fade-in" dir="rtl">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="bg-[#1A365D] text-white p-4 flex justify-between items-center">
                <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
                  <span>📦</span>
                  <span>جرد سيارة المندوب: {simulatedDelegate?.name}</span>
                </h3>
                <button
                  onClick={() => setShowSimulatedInventory(false)}
                  className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all cursor-pointer font-black"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-grow flex flex-col gap-3">
                {simulatedInventory.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-bold">
                    لا يوجد جرد حالي لهذا المندوب (السيارة فارغة).
                  </div>
                ) : (
                  simulatedInventory.map((stock, idx) => {
                    const unitsPerC = stock.weight.unitsPerCarton || 12;
                    const loadedText = `${Math.floor(stock.loaded / unitsPerC)}ك ${stock.loaded % unitsPerC > 0 ? `و ${stock.loaded % unitsPerC}ع` : ''}`;
                    const soldText = `${Math.floor(stock.sold / unitsPerC)}ك ${stock.sold % unitsPerC > 0 ? `و ${stock.sold % unitsPerC}ع` : ''}`;
                    const remainingText = `${Math.floor(stock.remaining / unitsPerC)}ك ${stock.remaining % unitsPerC > 0 ? `و ${stock.remaining % unitsPerC}ع` : ''}`;

                    return (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                          <span className="font-extrabold text-[#1A365D] text-xs">{stock.product.name} ({stock.weight.size})</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${stock.remaining > 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : stock.remaining < 0 ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>
                            المتبقي: {remainingText}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                          <div className="bg-indigo-50 text-indigo-800 p-1.5 rounded-lg border border-indigo-100">
                            <span className="block text-indigo-500 mb-0.5 text-[9px]">الكمية المحملة</span>
                            <span>{loadedText}</span>
                          </div>
                          <div className="bg-amber-50 text-amber-800 p-1.5 rounded-lg border border-amber-100">
                            <span className="block text-amber-500 mb-0.5 text-[9px]">الكمية المباعة</span>
                            <span>{soldText}</span>
                          </div>
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

      {effectiveUser.canUseAiAssistant !== false && (
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
          settings={settings}
        />
      )}

      {/* Global Custom Toast / App Alerts */}
      <AnimatePresence>
        {customToast && (
          <motion.div
            key={customToast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A365D] border border-[#2B4C7E] text-white font-extrabold py-3 px-6 rounded-2xl shadow-2xl text-center text-xs tracking-wide z-[9999] flex items-center justify-center gap-2 max-w-[90%]"
          >
            {customToast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📿 الأذكار والأدعية الدورية */}
      <Adduaa />

      </div>
    </APIProvider>
  );
}

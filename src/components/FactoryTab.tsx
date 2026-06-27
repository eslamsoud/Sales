// @ts-nocheck
import { confirmDialog, duaConfirmDialog } from '../utils/confirm';
import { jsPDF } from 'jspdf';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Product, FactoryLoad, CarBalance, ProductWeight, getProductWeightsFallback, Invoice, Trip, formatNum, Expense, UserAuth } from '../types';
import { Truck, Plus, PackagePlus, ArrowRight, History, Trash2, AlertCircle, Edit, Save, HelpCircle, FileText, Image, Scale, CirclePercent, DollarSign, Box, Clock, CheckCircle2, ShieldMinus, Wallet, Printer, Calendar, MapPin, Download, ScanLine, Archive, Landmark } from 'lucide-react';
import { showToast } from '../utils/toast';

interface FactoryTabProps {
  products: Product[];
  factoryLoads: FactoryLoad[];
  invoices: Invoice[];
  trips: Trip[];
  expenses: Expense[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onDeleteAllProducts?: () => void;
  onAddLoad: (load: Omit<FactoryLoad, 'id'>) => void;
  onDeleteLoad: (id: string) => void;
  onAddTrip: (trip: Omit<Trip, 'id'>) => void;
  onEditTrip: (id: string, updates: Partial<Omit<Trip, 'id'>>) => void;
  onToggleTripCollected: (id: string) => void;
  onDeleteTrip: (id: string) => void;
  onClearAllData?: () => void;
  onGoBack: () => void;
  permittedSubTabs?: string[];
  canEditPrices?: boolean;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  currentUser?: UserAuth | null;
}

export default function FactoryTab({
  products,
  factoryLoads,
  invoices,
  trips,
  expenses,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onDeleteAllProducts,
  onAddLoad,
  onDeleteLoad,
  onAddTrip,
  onEditTrip,
  onToggleTripCollected,
  onDeleteTrip,
  onClearAllData,
  onGoBack,
  permittedSubTabs,
  canEditPrices = true,
  onAddExpense,
  onDeleteExpense,
  currentUser
}: FactoryTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'loads' | 'products' | 'previous_loads' | 'factory_account' | 'trips'>(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('loads')) return 'loads';
      if (permittedSubTabs.includes('products')) return 'products';
      if (permittedSubTabs.includes('factory_account')) return 'factory_account';
      if (permittedSubTabs.includes('trips')) return 'trips';
      if (permittedSubTabs.includes('previous_loads')) return 'previous_loads';
    }
    return 'loads';
  });
  const [reportTimeframe, setReportTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0 && !permittedSubTabs.includes(activeSubTab)) {
      if (permittedSubTabs.includes('loads')) setActiveSubTab('loads');
      else if (permittedSubTabs.includes('products')) setActiveSubTab('products');
      else if (permittedSubTabs.includes('factory_account')) setActiveSubTab('factory_account');
      else if (permittedSubTabs.includes('trips')) setActiveSubTab('trips');
      else if (permittedSubTabs.includes('previous_loads')) setActiveSubTab('previous_loads');
    }
  }, [permittedSubTabs, activeSubTab]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeSubTab]);

  // Filtering states for the previous loads archive tab
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('all');
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');
  const [archiveSection, setArchiveSection] = useState<'factory' | 'trips'>('factory');

  const [archiveDelegateFilter, setArchiveDelegateFilter] = useState<string>('all');
  const [archiveDayFilters, setArchiveDayFilters] = useState<string[]>([]);

  // States for live load filtering
  const [liveLoadFilter, setLiveLoadFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [liveLoadStartDate, setLiveLoadStartDate] = useState('');
  const [liveLoadEndDate, setLiveLoadEndDate] = useState('');
  const [liveLoadDelegateFilter, setLiveLoadDelegateFilter] = useState<string>('all');
  const [liveLoadDayFilters, setLiveLoadDayFilters] = useState<string[]>([]);

  const archiveDelegates = React.useMemo(() => {
    const delegatesMap = new Map<string, { phone: string, name: string }>();
    
    const addDelegate = (phone: string, name: string) => {
      const cleanPhone = phone ? phone.trim() : '';
      const cleanName = name ? name.replace(/\s*\(.*?\)/g, '').trim() : 'مجهول';
      if (!cleanPhone && cleanName === 'مجهول') return;
      const key = cleanPhone || cleanName;
      if (!delegatesMap.has(key)) {
        delegatesMap.set(key, { phone: cleanPhone || 'مجهول', name: cleanName });
      }
    };

    factoryLoads.forEach(l => { 
      addDelegate(l.delegatePhone || '', l.delegateName || '');
    });
    trips.forEach(t => { 
      addDelegate(t.delegatePhone || '', t.delegateName || '');
    });
    return Array.from(delegatesMap.values());
  }, [factoryLoads, trips]);

  const filteredLiveLoads = React.useMemo(() => {
    return factoryLoads.filter(load => {
      if (liveLoadDelegateFilter !== 'all') {
        const lPhone = (load.delegatePhone || '').trim();
        const lName = (load.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
        const selectedDel = archiveDelegates.find(d => d.phone === liveLoadDelegateFilter || d.name === liveLoadDelegateFilter);
        if (selectedDel) {
          const matchPhone = selectedDel.phone !== 'مجهول' && lPhone === selectedDel.phone;
          const matchName = lName === selectedDel.name;
          if (!matchPhone && !matchName) return false;
        } else {
          return false;
        }
      }

      const loadDateObj = new Date(load.date);
      if (isNaN(loadDateObj.getTime())) return false;

      const now = new Date();
      if (liveLoadFilter === 'daily') return loadDateObj.getDate() === now.getDate() && loadDateObj.getMonth() === now.getMonth() && loadDateObj.getFullYear() === now.getFullYear();
      if (liveLoadFilter === 'weekly') {
        if (Math.abs(new Date().getTime() - loadDateObj.getTime()) / (1000 * 60 * 60 * 24) > 7) return false;
        if (liveLoadDayFilters.length > 0) return liveLoadDayFilters.includes(new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(loadDateObj));
        return true;
      }
      if (liveLoadFilter === 'monthly') return loadDateObj.getMonth() === new Date().getMonth() && loadDateObj.getFullYear() === new Date().getFullYear();
      if (liveLoadFilter === 'custom') return (!liveLoadStartDate || load.date >= liveLoadStartDate) && (!liveLoadEndDate || load.date <= liveLoadEndDate + 'T23:59:59');
      return true;
    });
  }, [factoryLoads, liveLoadFilter, liveLoadStartDate, liveLoadEndDate, liveLoadDelegateFilter, liveLoadDayFilters]);

  // States for Trips
  const [tripDescription, setTripDescription] = useState('');
  const [tripPrice, setTripPrice] = useState('');
  const [tripDate, setTripDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [tripFilter, setTripFilter] = useState<'all' | 'collected' | 'pending'>('all');
  const [tripDelegatePhone, setTripDelegatePhone] = useState('');

  const isManager = currentUser?.role === 'owner' || currentUser?.phone === '01228466613';

  // Delegate filtering state for factory account
  const [factoryDelegateFilter, setFactoryDelegateFilter] = useState<string>('all');

  const selectedDelegatePhone = useMemo(() => {
    if (!isManager) return currentUser?.phone || '';
    return factoryDelegateFilter === 'all' ? '' : factoryDelegateFilter;
  }, [isManager, currentUser, factoryDelegateFilter]);

  const currentDelegateKey = useMemo(() => {
    return selectedDelegatePhone || 'default';
  }, [selectedDelegatePhone]);

  // Helper to check if a record belongs to the selected delegate
  const filterByFactoryDelegate = (item: any) => {
    if (!isManager) return true; // Already filtered at app level
    if (factoryDelegateFilter === 'all') return true;
    
    const itemPhone = (item.delegatePhone || '').trim();
    const itemName = (item.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
    const selectedDel = archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter);
    if (!selectedDel) return false;
    
    const matchPhone = selectedDel.phone !== 'مجهول' && itemPhone === selectedDel.phone;
    const matchName = itemName === selectedDel.name;
    return matchPhone || matchName;
  };

  // Persistent carried over debt for the factory, keyed per delegate
  const [carriedOverDebt, setCarriedOverDebt] = useState<number>(0);
  const [carriedOverDebtDate, setCarriedOverDebtDate] = useState<string>('');

  useEffect(() => {
    const key = `factory_carried_debt_sys_${currentDelegateKey}`;
    const dateKey = `factory_carried_debt_date_sys_${currentDelegateKey}`;
    let val = parseFloat(localStorage.getItem(key) || 'NaN');
    if (isNaN(val)) {
      val = parseFloat(localStorage.getItem('factory_carried_debt_sys') || '0');
    }
    let dateVal = localStorage.getItem(dateKey);
    if (dateVal === null) {
      dateVal = localStorage.getItem('factory_carried_debt_date_sys') || '';
    }
    setCarriedOverDebt(val);
    setCarriedOverDebtDate(dateVal);
  }, [currentDelegateKey]);

  useEffect(() => {
    if (currentDelegateKey) {
      localStorage.setItem(`factory_carried_debt_sys_${currentDelegateKey}`, carriedOverDebt.toString());
    }
  }, [carriedOverDebt, currentDelegateKey]);

  useEffect(() => {
    if (currentDelegateKey) {
      localStorage.setItem(`factory_carried_debt_date_sys_${currentDelegateKey}`, carriedOverDebtDate);
    }
  }, [carriedOverDebtDate, currentDelegateKey]);

  // Archived cycles (settled zero-balance snapshots)
  const [archiveCycles, setArchiveCycles] = useState<any[]>(() => {
    if (currentDelegateKey) {
      try { return JSON.parse(localStorage.getItem(`factory_archive_cycles_${currentDelegateKey}`) || '[]'); } catch (_) {}
    }
    return [];
  });
  useEffect(() => {
    if (currentDelegateKey) {
      localStorage.setItem(`factory_archive_cycles_${currentDelegateKey}`, JSON.stringify(archiveCycles));
    }
  }, [archiveCycles, currentDelegateKey]);

  const [editingCycle, setEditingCycle] = useState<any>(null);
  const [editData, setEditData] = useState<any>(null);

  // Extra manual payments computed directly from synced expenses
  const extraPayments = useMemo(() => {
    return expenses
      .filter(e => e.category === 'سداد للمصنع' || e.type === 'factory_payment')
      .filter(filterByFactoryDelegate)
      .map(e => {
        let notes = e.description;
        let appliedToCarriedDebt = 0;
        let recipient = '';
        if (e.description && e.description.startsWith('{')) {
          try {
            const parsed = JSON.parse(e.description);
            notes = parsed.notes || '';
            appliedToCarriedDebt = parsed.appliedToCarriedDebt || 0;
            recipient = parsed.recipient || '';
          } catch (err) {}
        }
        return {
          id: e.id,
          amount: e.amount,
          date: e.date && e.date.includes('-') && !isNaN(new Date(e.date).getTime())
            ? new Date(e.date).toLocaleDateString('ar-EG') + ' ' + new Date(e.date).toLocaleTimeString('ar-EG')
            : e.date || '',
          notes,
          appliedToCarriedDebt,
          recipient,
          delegatePhone: e.delegatePhone,
          delegateName: e.delegateName
        };
      });
  }, [expenses, factoryDelegateFilter, isManager, currentUser, archiveDelegates]);

  // حساب الأرصدة الحالية في السيارة لكل صنف ووزن لعرضها في شاشة التحميل
  const weightStocks = useMemo(() => {
    const stocks: Record<string, { loaded: number; sold: number; remaining: number }> = {};
    
    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        const key = `${p.id}_${w.id}`;
        const loaded = factoryLoads
          .filter(l => String(l.productId).trim() === String(p.id).trim() && String(l.weightId || w.id).trim() === String(w.id).trim())
          .reduce((sum, l) => sum + l.quantity, 0);
        let sold = 0;
        invoices.forEach(inv => {
          inv.items.forEach(item => {
            if (String(item.productId).trim() === String(p.id).trim() && String(item.weightId || w.id).trim() === String(w.id).trim()) {
              sold += item.quantity;
            }
          });
        });
        stocks[key] = {
          loaded,
          sold,
          remaining: loaded - sold
        };
      });
    });
    return stocks;
  }, [products, factoryLoads, invoices]);

  const filteredLoads = React.useMemo(() => {
    return factoryLoads.filter(load => {
      if (archiveDelegateFilter !== 'all') {
        const lPhone = (load.delegatePhone || '').trim();
        const lName = (load.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
        const selectedDel = archiveDelegates.find(d => d.phone === archiveDelegateFilter || d.name === archiveDelegateFilter);
        if (selectedDel) {
           const matchPhone = selectedDel.phone !== 'مجهول' && lPhone === selectedDel.phone;
           const matchName = lName === selectedDel.name;
           if (!matchPhone && !matchName) return false;
        } else {
           return false;
        }
      }

      const loadDateObj = new Date(load.date);
      if (isNaN(loadDateObj.getTime())) return false;

      const now = new Date();
      
      if (archiveFilter === 'daily') {
        return loadDateObj.getDate() === now.getDate() && loadDateObj.getMonth() === now.getMonth() && loadDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'weekly') {
        const diffTime = Math.abs(now.getTime() - loadDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
        if (archiveDayFilters.length > 0) {
          const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(loadDateObj);
          return archiveDayFilters.includes(englishDay);
        }
        return true;
      }
      if (archiveFilter === 'monthly') {
        return loadDateObj.getMonth() === now.getMonth() && loadDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'custom') {
        const dStr = load.date.split('T')[0]; // "YYYY-MM-DD" or similar
        if (archiveStartDate && dStr < archiveStartDate) return false;
        if (archiveEndDate && dStr > archiveEndDate) return false;
        return true;
      }
      return true;
    });
  }, [factoryLoads, archiveFilter, archiveStartDate, archiveEndDate, archiveDelegateFilter, archiveDayFilters]);

  const filteredArchiveExtraPayments = useMemo(() => {
    return extraPayments.filter(pay => {
      const payDateObj = new Date(pay.date);
      if (isNaN(payDateObj.getTime())) return true;
      const now = new Date();
      if (archiveFilter === 'daily') {
        return payDateObj.getDate() === now.getDate() && payDateObj.getMonth() === now.getMonth() && payDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'weekly') {
        const diffTime = Math.abs(now.getTime() - payDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
        if (archiveDayFilters.length > 0) {
          const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(payDateObj);
          return archiveDayFilters.includes(englishDay);
        }
        return true;
      }
      if (archiveFilter === 'monthly') {
        return payDateObj.getMonth() === now.getMonth() && payDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'custom') {
        const dStr = pay.date.split('T')[0];
        if (archiveStartDate && dStr < archiveStartDate) return false;
        if (archiveEndDate && dStr > archiveEndDate) return false;
        return true;
      }
      return true;
    });
  }, [extraPayments, archiveFilter, archiveStartDate, archiveEndDate, archiveDayFilters]);

  const filteredArchiveTrips = React.useMemo(() => {
    if (!trips) return [];
    return trips.filter(trip => {
      if (!trip.collected) return false; // Only show collected (paid) trips in this archive
      
      if (archiveDelegateFilter !== 'all') {
        const lPhone = (trip.delegatePhone || '').trim();
        const lName = (trip.delegateName || '').replace(/\s*\(.*?\)/g, '').trim();
        const selectedDel = archiveDelegates.find(d => d.phone === archiveDelegateFilter || d.name === archiveDelegateFilter);
        if (selectedDel) {
           const matchPhone = selectedDel.phone !== 'مجهول' && lPhone === selectedDel.phone;
           const matchName = lName === selectedDel.name;
           if (!matchPhone && !matchName) return false;
        } else {
           return false;
        }
      }

      // Parse trip.date. It's usually "YYYY-MM-DD" from info input, but fallback is fine
      let tripDateObj = new Date(trip.date);
      if (isNaN(tripDateObj.getTime())) tripDateObj = new Date(); // fallback
      
      const now = new Date();
      
      if (archiveFilter === 'daily') {
        return tripDateObj.toDateString() === now.toDateString();
      }
      if (archiveFilter === 'weekly') {
        const diffTime = Math.abs(now.getTime() - tripDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
        if (archiveDayFilters.length > 0) {
          const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(tripDateObj);
          return archiveDayFilters.includes(englishDay);
        }
        return true;
      }
      if (archiveFilter === 'monthly') {
        return tripDateObj.getMonth() === now.getMonth() && tripDateObj.getFullYear() === now.getFullYear();
      }
      if (archiveFilter === 'custom') {
        const dStr = trip.date; // assuming formatting is YYYY-MM-DD
        if (archiveStartDate && dStr < archiveStartDate) return false;
        if (archiveEndDate && dStr > archiveEndDate) return false;
        return true;
      }
      return true;
    });
  }, [trips, archiveFilter, archiveStartDate, archiveEndDate, archiveDelegateFilter, archiveDayFilters]);

  // Register extra factory payment form
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentNotes, setNewPaymentNotes] = useState('');
  const [newPaymentRecipient, setNewPaymentRecipient] = useState('');
  
  // Product form states
  const [isAddingProduct, setIsAddingProduct] = useState(false); // Controls visibility of the add form
  const [prodName, setProdName] = useState('');
  const [accountingUnit, setAccountingUnit] = useState('كرتونة'); // كرتونة، صندوق، رابطة، علبة، الخ
  const [prodPrice, setProdPrice] = useState('0'); // Default baseline price for old/compatibility compatibility
  const [prodMinAlert, setProdMinAlert] = useState('20');
  const [editingProdId, setEditingProdId] = useState<string | null>(null);

  // Nested weights/variants under the product being created/edited
  const [prodWeights, setProdWeights] = useState<ProductWeight[]>([]);

  // Sub-form states to build weight/size items
  const [weightSize, setWeightSize] = useState(''); // e.g., "1 لتر", "750 مل", "5 لتر"
  const [weightCartonPrice, setWeightCartonPrice] = useState(''); // سعر كرتونة المصنع
  const [weightUnitsPerCarton, setWeightUnitsPerCarton] = useState('12'); // عبوات في الكرتونة
  const [weightAddedValue, setWeightAddedValue] = useState(''); // القيمة المضافة بالجنيه مباشرة على سعر العبوة من المصنع
  const [weightRetailPrice, setWeightRetailPrice] = useState(''); // سعر بيع العبوة الصافي للجمهور
  const [weightBarcode, setWeightBarcode] = useState(''); // الباركود

  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);

  // Auto calculate retail price from flat added value and factory costs
  useEffect(() => {
    const cartonP = parseFloat(weightCartonPrice) || 0;
    const unitsPerC = parseInt(weightUnitsPerCarton) || 12;
    const addedV = parseFloat(weightAddedValue) || 0;

    if (cartonP > 0 && unitsPerC > 0) {
      const retailCarton = cartonP + addedV;
      const computedRetail = retailCarton / unitsPerC;
      setWeightRetailPrice(computedRetail.toString()); // الحفاظ على الدقة العشرية لضمان تطابق حسابات الجملة
    } else {
      setWeightRetailPrice('');
    }
  }, [weightCartonPrice, weightUnitsPerCarton, weightAddedValue]);

  // Load state
  const [loadProductId, setLoadProductId] = useState('');
  const [loadDate, setLoadDate] = useState(() => {
    const now = new Date();
    // Egyptian local datetime format alignment (YYYY-MM-DDTHH:MM)
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().substring(0, 16);
  });
  const [loadNotes, setLoadNotes] = useState('');
  const [warehouseKeeper, setWarehouseKeeper] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [showAdvanceInput, setShowAdvanceInput] = useState(false);
  const [loadDelegatePhone, setLoadDelegatePhone] = useState<string>('');

  // Quantities recorded per-weight of the currently selected loadProductId
  // Record<weightId, { cartons: string, units: string }>
  const [loadWeightsQty, setLoadWeightsQty] = useState<Record<string, { cartons: string, units: string }>>({});
  const [selectedLoadWeightId, setSelectedLoadWeightId] = useState('');
  const [loadQtyCartons, setLoadQtyCartons] = useState('');

  // Reset loading quantities when changing target product to load
  useEffect(() => {
    setSelectedLoadWeightId('');
    setLoadQtyCartons('');
  }, [loadProductId]);

  const handleAddWeightQtyToDraft = () => {
    if (!selectedLoadWeightId) {
      showToast('⚠️ يرجى اختيار الوزن أو الحجم من القائمة أولاً.');
      return;
    }
    const q = parseInt(loadQtyCartons) || 0;
    if (q <= 0) {
      showToast('⚠️ يرجى تحديد كمية تحميل صحيحة أكبر من الصفر.');
      return;
    }

    setLoadWeightsQty(prev => {
      const existing = prev[selectedLoadWeightId] || { cartons: '0', units: '0' };
      const currentCartons = parseInt(existing.cartons) || 0;
      return {
        ...prev,
        [selectedLoadWeightId]: {
          cartons: (currentCartons + q).toString(),
          units: '0'
        }
      };
    });

    setSelectedLoadWeightId('');
    setLoadQtyCartons('');
  };

  const handleRemoveWeightQtyFromDraft = (weightId: string) => {
    setLoadWeightsQty(prev => {
      const copy = { ...prev };
      delete copy[weightId];
      return copy;
    });
  };

  // Auto-select oil (or first product) by default for loading
  useEffect(() => {
    if (!loadProductId && products.length > 0) {
      const oilProduct = products.find(p => p.name.includes('زيت') || p.name.includes('الزيت'));
      if (oilProduct) {
        setLoadProductId(oilProduct.id);
      } else {
        setLoadProductId(products[0].id);
      }
    }
  }, [products, loadProductId]);

  // Retrieve current active product's weights or fallback
  const activeProductObj = useMemo(() => {
    return products.find(p => p.id === loadProductId);
  }, [loadProductId, products]);

  const activeWeights = useMemo(() => {
    if (!activeProductObj) return [];
    return getProductWeightsFallback(activeProductObj);
  }, [activeProductObj]);

  const groupedDraftItems = useMemo(() => {
    const groups: Record<string, { product: Product; items: { weight: ProductWeight; cartons: number }[] }> = {};

    Object.entries(loadWeightsQty).forEach(([weightId, wState]) => {
      const cartonsNum = parseInt((wState as { cartons: string }).cartons) || 0;
      if (cartonsNum <= 0) return;

      let foundProduct: Product | undefined;
      let foundWeight: ProductWeight | undefined;

      for (const p of products) {
        const weights = getProductWeightsFallback(p);
        const w = weights.find(wt => wt.id === weightId);
        if (w) {
          foundProduct = p;
          foundWeight = w;
          break;
        }
      }

      if (foundProduct && foundWeight) {
        if (!groups[foundProduct.id]) {
          groups[foundProduct.id] = {
            product: foundProduct,
            items: []
          };
        }
        groups[foundProduct.id].items.push({
          weight: foundWeight,
          cartons: cartonsNum
        });
      }
    });

    return Object.values(groups);
  }, [loadWeightsQty, products]);

  const handleAddWeightToList = () => {
    if (!weightSize.trim()) {
      showToast('⚠️ يرجى التوضيح أولاً الصنف الفرعي (سعة لترية / وزن / عدد).');
      return;
    }
    const cartonPriceNum = parseFloat(weightCartonPrice) || 0;
    const unitsCountNum = parseInt(weightUnitsPerCarton) || 12;
    const addedValueNum = parseFloat(weightAddedValue) || 0;
    const retailPriceNum = parseFloat(weightRetailPrice) || 0;

    if (cartonPriceNum <= 0) {
      showToast('⚠️ الرجاء تعبئة السعر من المصنع بشكل صحيح.');
      return;
    }
    if (unitsCountNum <= 0) {
      showToast('⚠️ الرجاء إدخال عدد العبوات بشكل صحيح.');
      return;
    }

    const newWeight: ProductWeight = {
      id: editingWeightId || `weight-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      size: weightSize.trim(),
      cartonPriceFromFactory: cartonPriceNum,
      unitsPerCarton: unitsCountNum,
      factoryPricePerUnit: Number((cartonPriceNum / unitsCountNum).toFixed(3)),
      profitMarginPercent: 0, // Using flat added value instead
      addedValue: addedValueNum,
      retailPricePerUnit: retailPriceNum,
      barcode: weightBarcode.trim()
    };

    if (editingWeightId) {
      setProdWeights(prev => prev.map(w => w.id === editingWeightId ? newWeight : w));
      setEditingWeightId(null);
    } else {
      setProdWeights(prev => [...prev, newWeight]);
    }

    // Reset subform
    setWeightSize('');
    setWeightCartonPrice('');
    setWeightUnitsPerCarton('12');
    setWeightAddedValue('');
    setWeightRetailPrice('');
    setWeightBarcode('');
  };

  const handleEditWeightInList = (id: string) => {
    const w = prodWeights.find(w => w.id === id);
    if (!w) return;
    setWeightSize(w.size);
    setWeightCartonPrice(w.cartonPriceFromFactory.toString());
    setWeightUnitsPerCarton(w.unitsPerCarton.toString());
    setWeightAddedValue((w as any).addedValuePerCarton?.toString() || w.addedValue?.toString() || '');
    setWeightRetailPrice(w.retailPricePerUnit.toString());
    setWeightBarcode(w.barcode || '');
    setEditingWeightId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveWeightFromList = (id: string) => {
    setProdWeights(prev => prev.filter(w => w.id !== id));
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;

    if (prodWeights.length === 0) {
      showToast('⚠️ يجب إضافة وزن/سعة واحدة على الأقل لهذا المنتج!');
      return;
    }

    // Baseline fallback price is the first weight's retail price
    const fallbackPriceNum = prodWeights[0]?.retailPricePerUnit || parseFloat(prodPrice) || 90;
    const minAlertNum = parseInt(prodMinAlert) || 20;

    if (editingProdId) {
      onEditProduct({
        id: editingProdId,
        name: prodName.trim(),
        price: fallbackPriceNum,
        minStockAlert: minAlertNum,
        accountingUnit: accountingUnit.trim() || 'كرتونة',
        weights: prodWeights
      });
      setEditingProdId(null);
      setIsAddingProduct(false);
      showToast('✓ تم تحديث الصنف بنجاح!');
    } else {
      onAddProduct({
        name: prodName.trim(),
        price: fallbackPriceNum,
        minStockAlert: minAlertNum,
        accountingUnit: accountingUnit.trim() || 'كرتونة',
        weights: prodWeights
      });
      setIsAddingProduct(false);
      showToast('✓ تم تسجيل المنتج الجديد بنجاح!');
    }

    // Reset fields
    setProdName('');
    setAccountingUnit('كرتونة');
    setProdPrice('0');
    setProdMinAlert('20');
    setProdWeights([]);
  };

  const startEditProduct = (prod: Product) => {
    setEditingProdId(prod.id);
    setProdName(prod.name);
    setAccountingUnit(prod.accountingUnit || 'كرتونة');
    setProdPrice(prod.price.toString());
    setProdMinAlert(prod.minStockAlert.toString());
    setProdWeights(prod.weights || getProductWeightsFallback(prod));
    setIsAddingProduct(true);
    setActiveSubTab('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit all loaded weights quantities
  const handleAddLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (groupedDraftItems.length === 0) {
      showToast('⚠️ الرجاء إضافة كمية تحميل واحدة على الأقل.');
      return;
    }

    const duaMsg = "اللهم إني أسألك خير هذا العمل وخير ما فيه، وأعوذ بك من شره وشر ما فيه. اللهم ارزقني فيه التوفيق، وبارك لي في وقتي وجهدي ورزقي";
    const confirmed = await duaConfirmDialog("تأكيد تسجيل الحمولة: هل ترغب في ترحيل وحفظ حمولة السيارة المؤقتة الحالية؟", duaMsg, "توكلت على الله");
    if (!confirmed) return;

    const selectedDelegate = isManager && loadDelegatePhone
      ? archiveDelegates.find(d => d.phone === loadDelegatePhone)
      : null;

    let hasAddedAny = false;

    groupedDraftItems.forEach(group => {
      group.items.forEach(item => {
        const totalUnits = item.cartons * item.weight.unitsPerCarton;
        if (totalUnits > 0) {
          onAddLoad({
            productId: group.product.id,
            weightId: item.weight.id,
            productName: group.product.name,
            weightSize: item.weight.size,
            quantity: totalUnits,
            cartonsCount: item.cartons,
            looseUnitsCount: 0,
            cartonPrice: item.weight.cartonPriceFromFactory || 0,
            unitPrice: item.weight.factoryPricePerUnit || 0,
            notes: loadNotes.trim() || `شحنة محملة [${group.product.name} - وزن ${item.weight.size}]`,
            warehouseKeeper: warehouseKeeper.trim() || undefined,
            advanceAmount: showAdvanceInput ? (parseFloat(advanceAmount) || undefined) : undefined,
            date: new Date(loadDate).toISOString(),
            delegateName: selectedDelegate?.name || currentUser?.name || '',
            delegatePhone: selectedDelegate?.phone || currentUser?.phone || ''
          });
          hasAddedAny = true;
        }
      });
    });

    if (!hasAddedAny) {
      showToast('⚠️ الرجاء إدخال كمية تحميل واحدة على الأقل.');
      return;
    }

    showToast('✓ تم حفظ حمولة السيارة بنجاح!');
    // Reset loading states
    setLoadProductId('');
    setLoadWeightsQty({});
    setLoadNotes('');
    setWarehouseKeeper('');
    setAdvanceAmount('');
    setShowAdvanceInput(false);
    if (isManager) setLoadDelegatePhone('');
  };

  // Compute live cumulative totals of the current total factory load invoice (حساب المصنع والكميات المحملة)
  const factoryInvoiceSummary = useMemo(() => {
    let grandFactoryCost = 0;
    let totalCrates = 0;
    let totalIndividualItems = 0;

    const itemsList = factoryLoads.map(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];

      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / (weight?.unitsPerCarton || 12));
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % (weight?.unitsPerCarton || 12));
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
      const factoryPricePerUnit = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);

      const subtotal = (cartons * cartonPrice) + (loose * factoryPricePerUnit);

      grandFactoryCost += subtotal;
      totalCrates += cartons;
      totalIndividualItems += load.quantity;

      return {
        id: load.id,
        productName: prod ? prod.name : ((load as any).productName || 'صنف مجهول'),
        size: weight ? weight.size : ((load as any).weightSize || 'حجم عادي'),
        cartons,
        loose,
        cartonPrice,
        subtotal,
        date: load.date,
        warehouseKeeper: load.warehouseKeeper,
        advanceAmount: load.advanceAmount,
        delegateName: load.delegateName
      };
    });

    return {
      itemsList,
      grandFactoryCost,
      totalCrates,
      totalIndividualItems
    };
  }, [factoryLoads, products]);

  const filteredLiveLoadsSummary = useMemo(() => {
    let grandFactoryCost = 0;
    let totalCrates = 0;
    let totalIndividualItems = 0;

    const itemsList = filteredLiveLoads.map(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];

      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / (weight?.unitsPerCarton || 12));
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % (weight?.unitsPerCarton || 12));
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
      const factoryPricePerUnit = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);

      const subtotal = (cartons * cartonPrice) + (loose * factoryPricePerUnit);

      grandFactoryCost += subtotal;
      totalCrates += cartons;
      totalIndividualItems += load.quantity;

      return {
        id: load.id,
        productName: prod ? prod.name : ((load as any).productName || 'صنف مجهول'),
        size: weight ? weight.size : ((load as any).weightSize || 'حجم عادي'),
        cartons,
        loose,
        cartonPrice,
        subtotal,
        date: load.date,
        warehouseKeeper: load.warehouseKeeper,
        advanceAmount: load.advanceAmount,
        delegateName: load.delegateName
      };
    });

    return {
      itemsList, grandFactoryCost, totalCrates, totalIndividualItems
    };
  }, [filteredLiveLoads, products]);

  // Group load items by product so they are listed with each product name written only once
  const groupedFactoryLoads = useMemo(() => {
    const groups: Record<string, {
      productId: string;
      productName: string;
      accountingUnit: string;
      weights: Array<{
        loadId: string;
        weightId: string;
        size: string;
        cartons: number;
        loose: number;
        cartonPrice: number;
        subtotal: number;
        quantity: number;
        date: string;
        warehouseKeeper?: string;
        advanceAmount?: number;
      }>
    }> = {};

    factoryLoads.forEach(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];

      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / (weight?.unitsPerCarton || 12));
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % (weight?.unitsPerCarton || 12));
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
      const factoryPricePerUnit = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * factoryPricePerUnit);

      const pId = load.productId;
      if (!groups[pId]) {
        groups[pId] = {
          productId: pId,
          productName: prod ? prod.name : ((load as any).productName || 'صنف مجهول'),
          accountingUnit: prod?.accountingUnit || 'كرتونة',
          weights: []
        };
      }

      groups[pId].weights.push({
        loadId: load.id,
        weightId: load.weightId || '',
        size: weight ? weight.size : 'حجم عادي',
        cartons,
        loose,
        cartonPrice,
        subtotal,
        quantity: load.quantity,
        date: load.date,
        warehouseKeeper: load.warehouseKeeper,
        advanceAmount: load.advanceAmount
      });
    });

    return Object.values(groups);
  }, [factoryLoads, products]);

  // DRAW AND DOWNLOAD DYNAMIC STATEMENT OF SELLING LOADS AS HIGH-FIDELITY PDF
  const handlePrintCurrentLoads = () => {
    const list = filteredLiveLoadsSummary.itemsList;
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات تحميل سابقة لتنزيل البيان.');
      return;
    }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;

    const headerH = 110;
    const loadsTableH = 36 + list.length * loadRowH + 36;
    const summaryRowH = 36;
    const bottomBoxH = 120;
    const footerH = 50;
    const totalH = headerH + 10 + loadsTableH + summaryRowH + 15 + bottomBoxH + footerH + 30;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // Outer frame
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // Header
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('بيان حمولة السيارة', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('مستند جرد وتفريغ كميات أصناف السيارة المعتمد للتحميل والمطابقة', W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ ووقت البيان: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`عدد الأصناف: ${list.length}`, 55, 92);

    let y = 12 + headerH + 12;

    // ── Loads Table (5 columns) ──
    const colX = padX;
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('البيان / المرحلة', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('العدد', colQty, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الإجمالي', colTotal, y + 22);
    y += 32;

    let grandTotal = 0;

    list.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);

      const subtotal = item.subtotal || 0;
      grandTotal += subtotal;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(`${item.productName} (${item.size})`, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(`${item.cartons} كرتونة${item.loose > 0 ? ` + ${item.loose}` : ''}`, colQty, y + 24);
      ctx.fillText(`${item.cartonPrice?.toFixed(0) || '0'} ج.م`, colPrice, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${subtotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);

      y += loadRowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المسحوبات (المطلوب)', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${grandTotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);
    y += summaryRowH + 15;

    // ── Bottom two boxes ──
    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;
    const leftBoxW = (tableW - boxGap) * 0.45;
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    // Right Box: ملخص الشحنات
    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص الشحنات', rightBoxX + rightBoxW / 2, y + 21);

    let infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد الأصناف: ${list.length}`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي الإجمالي: ${grandTotal.toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي الكرتونات: ${filteredLiveLoadsSummary.totalCrates} كرتونة`, rightBoxX + rightBoxW - 20, infoY);

    // Left Box: تم التصدير
    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('بيانات المستند', leftBoxX + leftBoxW / 2, y + 21);

    infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ البيان: ${new Date().toLocaleDateString('ar-EG')}`, leftBoxX + leftBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`وقت الطباعة: ${new Date().toLocaleTimeString('ar-EG')}`, leftBoxX + leftBoxW - 20, infoY);

    y += bottomBoxH + 20;

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    // Save as PDF
    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, Math.max(297, pdfHeight + 10)]
    });
    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    doc.save(`بيان_حمولة_السيارة_${new Date().toISOString().substring(0, 10)}.pdf`);
  };

  const handleDownloadInvoiceImage = () => {
    const list = filteredLiveLoadsSummary.itemsList;
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات تحميل سابقة لتنزيل البيان.');
      return;
    }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;

    const headerH = 110;
    const loadsTableH = 36 + list.length * loadRowH + 36;
    const summaryRowH = 36;
    const bottomBoxH = 120;
    const footerH = 50;
    const totalH = headerH + 10 + loadsTableH + summaryRowH + 15 + bottomBoxH + footerH + 30;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // Outer frame
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // Header
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('بيان حمولة السيارة', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('مستند جرد وتفريغ كميات أصناف السيارة المعتمد للتحميل والمطابقة', W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ ووقت البيان: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`عدد الأصناف: ${list.length}`, 55, 92);

    let y = 12 + headerH + 12;

    // ── Loads Table (5 columns) ──
    const colX = padX;
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('البيان / المرحلة', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('العدد', colQty, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الإجمالي', colTotal, y + 22);
    y += 32;

    let grandTotal = 0;

    list.forEach((item, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);

      const subtotal = item.subtotal || 0;
      grandTotal += subtotal;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(`${item.productName} (${item.size})`, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(`${item.cartons} كرتونة${item.loose > 0 ? ` + ${item.loose}` : ''}`, colQty, y + 24);
      ctx.fillText(`${item.cartonPrice?.toFixed(0) || '0'} ج.م`, colPrice, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${subtotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);

      y += loadRowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المسحوبات (المطلوب)', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${grandTotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);
    y += summaryRowH + 15;

    // ── Bottom two boxes ──
    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;
    const leftBoxW = (tableW - boxGap) * 0.45;
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    // Right Box: ملخص الشحنات
    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص الشحنات', rightBoxX + rightBoxW / 2, y + 21);

    let infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد الأصناف: ${list.length}`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي الإجمالي: ${grandTotal.toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي الكرتونات: ${filteredLiveLoadsSummary.totalCrates} كرتونة`, rightBoxX + rightBoxW - 20, infoY);

    // Left Box: بيانات المستند
    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('بيانات المستند', leftBoxX + leftBoxW / 2, y + 21);

    infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ البيان: ${new Date().toLocaleDateString('ar-EG')}`, leftBoxX + leftBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`وقت الطباعة: ${new Date().toLocaleTimeString('ar-EG')}`, leftBoxX + leftBoxW - 20, infoY);

    y += bottomBoxH + 20;

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    // Download as image
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `بيان_حمولة_السيارة_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  };

  const exportFactoryLedgerAsPDF = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-1000px';
    iframe.style.left = '-1000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const filteredLoads = factoryLoads.filter(filterByFactoryDelegate).filter(l => !l.archivedAt);
    const selectedDel = archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter);
    const delegateHeader = selectedDel ? `<p style="font-size: 14px; margin-top: 5px; color: #1e3a8a; font-weight: bold;">المندوب: ${selectedDel.name} ${selectedDel.phone !== 'مجهول' ? `(${selectedDel.phone})` : ''}</p>` : '';

    doc.open();
    doc.write(`
      <html dir="rtl" lang="ar">
        <head>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; line-height: 1.5; padding: 20px; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 3px double #1e3a8a; padding-bottom: 12px; }
            .header h1 { color: #1e3a8a; margin: 0 0 5px 0; font-size: 24px; font-weight: 900; }
            .header p { margin: 0; color: #64748b; font-size: 13px; font-weight: bold; }
            
            .meta-box { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 11px; color: #334155; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
            
            .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; text-align: center; }
            .card.danger { background: #fff5f5; border-color: #fee2e2; }
            .card.success { background: #f0fdf4; border-color: #dcfce7; }
            .card span { display: block; font-size: 10px; color: #64748b; font-weight: bold; margin-bottom: 5px; }
            .card strong { font-size: 15px; color: #0f172a; font-weight: 900; }
            
            h2 { font-size: 13px; color: #1e3a8a; margin: 25px 0 10px 0; border-right: 4px solid #dd6b20; padding-right: 8px; font-weight: bold; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: right; }
            th { background: #f1f5f9; color: #334155; font-weight: 900; }
            
            .footer-notes { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 15px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>كشف حساب المالي للمصنع والموردين</h1>
            <p>نظام التوزيع والمبيعات المعتمد للأغذية والمستودع</p>
            ${delegateHeader}
          </div>
          
          <div class="meta-box">
            <div>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
            <div>رقم الحساب أو العملية: FACT-${Date.now().toString().slice(-6)}</div>
          </div>
          
          <div class="summary-cards">
            <div class="card">
              <span>حساب المصنع</span>
              <strong>${factoryBalanceDetails.totalWithdrawnValue.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="card success">
              <span>إجمالي المسدد والمقدمات</span>
              <strong style="color: #16a34a;">${factoryBalanceDetails.totalAdvancePayments.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            ${factoryBalanceDetails.netRemainingDueToFactory > 0 ? `
            <div class="card danger">
              <span>صافي المتبقي للمصنع</span>
              <strong style="color: #dc2626;">${factoryBalanceDetails.netRemainingDueToFactory.toLocaleString('ar-EG')} ج.م</strong>
            </div>` : factoryBalanceDetails.netRemainingDueToFactory === 0 ? `
            <div class="card success">
              <span>صافي المتبقي للمصنع</span>
              <strong style="color: #16a34a;">مسوى ✔️</strong>
            </div>` : `
            <div class="card" style="border-color:#c7d2fe; background:#eef2ff;">
              <span>رصيد دائن لصالح المصنع</span>
              <strong style="color: #4f46e5;">${Math.abs(factoryBalanceDetails.netRemainingDueToFactory).toLocaleString('ar-EG')} ج.م</strong>
            </div>`}
          </div>
          
          <h2>تفاصيل حمولات البضاعة المسحوبة ومقدماتها</h2>
          <table>
            <thead>
              <tr>
                <th width="40">م</th>
                <th>الصنف وتفاصيل الوزن</th>
                <th>الكمية وحالة الشحن</th>
                <th>سعر المورد للكرتونة</th>
                <th>إجمالي القيمة المسحوبة</th>
                <th>مقدم السداد المدفوع</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLoads.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">لا توجد حمولات بضاعة مسجلة.</td></tr>' : 
                filteredLoads.map((load, idx) => {
                  const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                  const weights = prod ? getProductWeightsFallback(prod) : [];
                  const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim());
                  const unitsPerCarton = weight?.unitsPerCarton || 12;
                  const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
                  const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
                  const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * unitsPerCarton : 0) || 0);
                  const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
                  const subtotal = (cartons * cartonPrice) + (loose * unitPrice);

                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><b>${prod ? prod.name : ((load as any).productName || 'صنف غير معروف')}</b> (وزن: ${weight ? weight.size : ((load as any).weightSize || 'افتراضي')})</td>
                      <td>${cartons} كرتونة ${loose > 0 ? ` + ${loose} عبوة` : ''}</td>
                      <td>${cartonPrice.toLocaleString('ar-EG')} ج.م</td>
                      <td><b>${subtotal.toLocaleString('ar-EG')} ج.م</b></td>
                      <td>${(load.advanceAmount || 0).toLocaleString('ar-EG')} ج.م</td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>
          
          <h2>تفاصيل دفعات السداد المباشرة للمورد</h2>
          <table>
            <thead>
              <tr>
                <th width="35">م</th>
                <th>التاريخ والوقت</th>
                <th>البيان (وسيلة الدفع)</th>
                <th>المبلغ</th>
                <th>المندوب المسدد</th>
                <th>المتبقي للمديونية</th>
              </tr>
            </thead>
            <tbody>
              ${extraPayments.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">لم يتم تسجيل دفعات مباشرة إضافية.</td></tr>' : 
                extraPayments.map((pay, idx) => {
                  const cumPaymentsBefore = extraPayments.slice(0, idx).reduce((s, p) => s + p.amount, 0);
                  const remainingAfterPayment = factoryBalanceDetails.totalWithdrawnValue - factoryBalanceDetails.currentAdvances - cumPaymentsBefore - pay.amount;
                  return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${pay.date}</td>
                    <td>${pay.notes || 'تسديد مباشر للمصنع'}</td>
                    <td><b>${pay.amount.toLocaleString('ar-EG')} ج.م</b></td>
                    <td>${pay.delegateName || '-'}</td>
                    <td>${remainingAfterPayment > 0 ? remainingAfterPayment.toLocaleString('ar-EG') + ' ج.م' : remainingAfterPayment < 0 ? 'رصيد دائن ' + Math.abs(remainingAfterPayment).toLocaleString('ar-EG') + ' ج.م' : '— مسوى'}</td>
                  </tr>
                `}).join('')
              }
            </tbody>
          </table>
          
          <div class="footer-notes">
            <div>توقيع المدير المالي للشركة: ............................</div>
            <div>اعتماد مندوب مبيعات المصنع المستلم: ............................</div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 500);
    }, 500);
  };

  // Compute comprehensive factory account statement: withdrawn vs sold vs remaining financial balance
  const factoryBalanceDetails = useMemo(() => {
    let rawLoadedValue = 0; // إجمالي قيمة البضاعة المحملة فعلياً بسعر المصنع في الحمولة الحالية
    let currentAdvances = 0; // إجمالي مقدمات البضاعة المدفوعة للمصنع المرتبطة بالتحميل
    
    const filteredLoads = factoryLoads.filter(filterByFactoryDelegate).filter(l => !l.archivedAt);
    const filteredInvoices = invoices.filter(filterByFactoryDelegate);

    // Calculate total loaded costs from factoryLoads
    filteredLoads.forEach(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * unitsPerCarton : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * unitPrice);
      rawLoadedValue += subtotal;
      currentAdvances += load.advanceAmount ?? 0;
    });

    // المدين = إجمالي قيمة البضاعة المحملة (بدون المديونية السابقة)
    const totalWithdrawnValue = rawLoadedValue;

    // إجمالي الدفعات المسجلة - مع خصم ما تم تسديده من المديونية القديمة لتجنب ازدواج الخصم
    const manualPaymentsSum = extraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);

    // المسدد = مقدمات الشحن بالسيارة + دفعات ميزان المصنع المباشرة
    const totalAdvancePayments = currentAdvances + manualPaymentsSum;

    // Calculate total sold items from invoices matching our products list
    let totalSoldValue = 0; // إجمالي قيمة المبيعات للعملاء
    const soldCounts: Record<string, { cartons: number, units: number, value: number }> = {}; // weightId -> counts

    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const prod = products.find(p => String(p.id).trim() === String(item.productId).trim());
        if (!prod) return;
        const weights = getProductWeightsFallback(prod);
        const weight = weights.find(w => String(w.id).trim() === String(item.weightId).trim());
        if (!weight) return;

        const key = item.weightId || 'raw_' + item.productId;
        const current = soldCounts[key] || { cartons: 0, units: 0, value: 0 };
        current.units += item.quantity;
        current.cartons += (item.quantity / weight.unitsPerCarton);
        current.value += item.finalPrice * item.quantity;
        soldCounts[key] = current;

        totalSoldValue += item.finalPrice * item.quantity;
      });
    });

    const netRemainingDueToFactory = totalWithdrawnValue - totalAdvancePayments + carriedOverDebt;

    return {
      rawLoadedValue,
      totalWithdrawnValue,
      totalAdvancePayments,
      totalSoldValue,
      netRemainingDueToFactory,
      soldCounts,
      manualPaymentsSum,
      currentAdvances
    };
  }, [factoryLoads, products, invoices, carriedOverDebt, extraPayments, factoryDelegateFilter, isManager]);

  // Filters for the withdrawn goods visual component (Box 1 in Factory Account)
  const [accountLoadsFilter, setAccountLoadsFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('all');
  const [accountLoadsStartDate, setAccountLoadsStartDate] = useState('');
  const [accountLoadsEndDate, setAccountLoadsEndDate] = useState('');

  const filteredAccountLoads = React.useMemo(() => {
    return factoryLoads.filter(load => {
      if (!filterByFactoryDelegate(load)) return false;
      const loadDateObj = new Date(load.date);
      if (isNaN(loadDateObj.getTime())) return false;
      const now = new Date();
      if (accountLoadsFilter === 'daily') return loadDateObj.toDateString() === now.toDateString();
      if (accountLoadsFilter === 'weekly') return (now.getTime() - loadDateObj.getTime()) <= 7 * 24 * 60 * 60 * 1000;
      if (accountLoadsFilter === 'monthly') return loadDateObj.getMonth() === now.getMonth() && loadDateObj.getFullYear() === now.getFullYear();
      if (accountLoadsFilter === 'custom') {
        const dStr = load.date.split('T')[0];
        if (accountLoadsStartDate && dStr < accountLoadsStartDate) return false;
        if (accountLoadsEndDate && dStr > accountLoadsEndDate) return false;
      }
      return true;
    });
  }, [factoryLoads, accountLoadsFilter, accountLoadsStartDate, accountLoadsEndDate, factoryDelegateFilter, isManager]);

  const accountLoadsSummary = useMemo(() => {
    return filteredAccountLoads.map(load => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];

      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * unitsPerCarton : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);

      const subtotal = (cartons * cartonPrice) + (loose * unitPrice);

      return {
        id: load.id,
        productName: prod ? prod.name : (load.productName || 'صنف محذوف'),
        size: weight ? weight.size : (load.weightSize || 'محتوى موجود'),
        cartons,
        loose,
        cartonPrice,
        subtotal,
        date: load.date,
        warehouseKeeper: load.warehouseKeeper,
        advanceAmount: load.advanceAmount,
        delegateName: load.delegateName
      };
    });
  }, [filteredAccountLoads, products]);

  const exportAccountLoads = (format: 'png' | 'pdf') => {
    const list = accountLoadsSummary;
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات تحميل مسجلة لهذه الفترة.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 240 + list.length * 50 + 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 15, canvas.width - 30, canvas.height - 30);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(15, 15, canvas.width - 30, 8);

    const headerGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    headerGrad.addColorStop(0, '#0f172a');
    headerGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(15, 23, canvas.width - 30, 115);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('بيان حركة البضاعة المسحوبة', canvas.width - 45, 70);
    
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('حركة سحب البضائع من المصنع للفترة المحددة', canvas.width - 45, 105);
    
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}`, 45, 70);

    let y = 190;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(35, y - 25, canvas.width - 70, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('الصنف وحجم الوزن المحمل', canvas.width - 55, y + 2);
    ctx.textAlign = 'left';
    ctx.fillText('القيمة', 65, y + 2);
    ctx.fillText('الكمية (بالكرتونة)', 180, y + 2);

    y += 25;

    let totalVal = 0;
    let totalCrates = 0;

    list.forEach((item, idx) => {
      totalVal += item.subtotal;
      totalCrates += item.cartons;

      if (idx % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(35, y - 5, canvas.width - 70, 45);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(35, y - 5, canvas.width - 70, 45);
      }

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(35, y - 5, canvas.width - 70, 45);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${item.productName} (${item.size})`, canvas.width - 55, y + 20);

      if (item.delegateName) {
        const cleanDelName = item.delegateName.replace(/ \(.*?\)/g, '').trim();
        ctx.fillStyle = '#64748b';
        ctx.font = '500 11px system-ui, sans-serif';
        ctx.fillText(`المندوب: ${cleanDelName}`, canvas.width - 55, y + 36);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`${item.cartons} كرتونة`, 180, y + 23);
      
      ctx.fillStyle = '#4f46e5';
      ctx.fillText(`${formatNum(item.subtotal)} ج.م`, 65, y + 23);

      y += 45;
    });

    y += 15;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(35, y - 20, canvas.width - 70, 50);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(35, y - 20, canvas.width - 70, 50);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`إجمالي الكراتين: ${totalCrates}`, canvas.width - 55, y + 10);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`الإجمالي: ${formatNum(totalVal)} ج.م`, 65, y + 10);

    if (format === 'png') {
      const link = document.createElement('a');
      link.download = `بيان_سحب_${new Date().toISOString().substring(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, Math.max(297, pdfHeight + 10)]
      });
      doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      doc.save(`بيان_سحب_${new Date().toISOString().substring(0, 10)}.pdf`);
    }
  };

  // Hook to handle active debt date tracking
  useEffect(() => {
    const activeDebt = factoryBalanceDetails.netRemainingDueToFactory;
    if (activeDebt <= 0) {
      if (carriedOverDebt > 0) {
        setCarriedOverDebt(0);
      }
      // Keep negative carriedOverDebt (credit balance) — don't clear it
      if (carriedOverDebtDate) {
        setCarriedOverDebtDate('');
      }
    } else {
      if (!carriedOverDebtDate) {
        setCarriedOverDebtDate(new Date().toLocaleDateString('ar-EG'));
      }
    }
  }, [factoryBalanceDetails.netRemainingDueToFactory, carriedOverDebtDate, carriedOverDebt]);

  // Draw and download factory account statement image — clean professional invoice style
  const handleDownloadFactoryLedgerImage = () => {
    const { totalWithdrawnValue, totalAdvancePayments, netRemainingDueToFactory, currentAdvances } = factoryBalanceDetails;
    const list = extraPayments;
    const filteredLoads = factoryLoads.filter(filterByFactoryDelegate).filter(l => !l.archivedAt);

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;
    const payRowH = 34;

    // Pre-calc height
    const headerH = 110;
    const loadsTableH = filteredLoads.length > 0 ? 36 + filteredLoads.length * loadRowH + 36 : 50;
    const summaryRowH = 36;
    const bottomBoxH = Math.max(list.length * payRowH + 100, 180);
    const footerH = 70;
    const totalH = headerH + 10 + loadsTableH + summaryRowH + 15 + bottomBoxH + footerH + 40;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    // Rounded rect helper
    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // ── Background (clean cream) ──
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // ── Outer frame (black thin) ──
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // ── Header (dark navy solid) ──
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();

    // Gold accent line under header
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('كشف حساب مالي للمصنع وامودعين', W / 2, 48);

    // Subtitle
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('نظام التوزيع والمبيعات المعتمد للأغذية والمستودع', W / 2, 68);

    // Date and operation number
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الكشف: ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`رقم العملية: FACT-${Date.now().toString().slice(-6)}`, 55, 92);

    // Delegate name if filtered
    if (factoryDelegateFilter !== 'all') {
      const delName = archiveDelegates.find(d => d.phone === factoryDelegateFilter || d.name === factoryDelegateFilter)?.name || factoryDelegateFilter;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText(`المندوب: ${delName}`, 55, 110);
    }

    let y = 12 + headerH + 12;

    // ── Loads Table ──
    const colX = padX;
    // Table header
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    // RTL columns: م | البيان / المرحلة | العدد | السعر | الإجمالي
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('البيان / المرحلة', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('العدد', colQty, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الإجمالي', colTotal, y + 22);
    y += 32;

    let totalLoadValue = 0;

    filteredLoads.forEach((load, idx) => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim());
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * unitsPerCarton : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * unitPrice);

      // Row bg
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);

      // Bottom line
      ctx.beginPath();
      ctx.moveTo(colX, y + loadRowH);
      ctx.lineTo(colX + tableW, y + loadRowH);
      ctx.stroke();

      const prodName = prod ? prod.name : (load.productName || 'غير معروف');
      const weightSize = weight ? weight.size : (load as any).weightSize || '';

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';

      // Serial (Arabic-Indic numeral)
      const arabicNum = String(idx + 1).padStart(2, '0');
      ctx.textAlign = 'center';
      ctx.fillText(arabicNum, colSerial, y + 24);

      // Description
      ctx.textAlign = 'right';
      ctx.fillText(`${prodName} (${weightSize})`, colDesc, y + 24);

      // Quantity
      ctx.textAlign = 'center';
      ctx.fillText(`${cartons} كرتونة${loose > 0 ? ` + ${loose}` : ''}`, colQty, y + 24);

      // Price
      ctx.fillText(`${cartonPrice.toFixed(0)} ج.م`, colPrice, y + 24);

      // Total
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${subtotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);

      totalLoadValue += subtotal;
      y += loadRowH;
    });

    // Summary row (teal/green)
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المسحوبات (المطلوب)', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${totalLoadValue.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);
    y += summaryRowH + 15;

    // ── Bottom two boxes side by side ──
    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;  // payments box (larger)
    const leftBoxW = (tableW - boxGap) * 0.45;   // net remaining box
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    // ── Right Box: سجل الدفعات المستلمة ──
    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Box header
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('سجل الدفعات المستلمة', rightBoxX + rightBoxW / 2, y + 21);

    let payY = y + 38;
    let totalPayments = 0;

    if (list.length > 0) {
      list.forEach((pay, idx) => {
        // Dashed separator
        if (idx > 0) {
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = '#c5b89a';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(rightBoxX + 15, payY - 4);
          ctx.lineTo(rightBoxX + rightBoxW - 15, payY - 4);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Payment entry: bullet + description + amount
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        const desc = pay.notes || 'تسديد مباشر';
        const dateStr = pay.date || '';
        ctx.fillText(`• ${desc} - ${dateStr}`, rightBoxX + rightBoxW - 20, payY + 14);

        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = '#0d7c5f';
        ctx.textAlign = 'left';
        ctx.fillText(`${pay.amount.toLocaleString('ar-EG')} ج.م`, rightBoxX + 20, payY + 14);

        totalPayments += pay.amount;
        payY += payRowH;
      });

      // Total line
      payY += 4;
      ctx.strokeStyle = '#2c3e6b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rightBoxX + 15, payY);
      ctx.lineTo(rightBoxX + rightBoxW - 15, payY);
      ctx.stroke();

      payY += 18;
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`إجمالي المسدد: ${totalPayments.toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, payY);

      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`عدد الدفعات: ${list.length}`, rightBoxX + 20, payY);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('لا توجد دفعات مسجلة', rightBoxX + rightBoxW / 2, payY + 30);
    }

    // ── Left Box: صافي المستحق (المتبقي) ──
    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Box header
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('صافي المستحق (المتبقي)', leftBoxX + leftBoxW / 2, y + 21);

    // Net amount — centered vertically in the box
    const netCenterY = y + 30 + (bottomBoxH - 30) / 2;

    if (netRemainingDueToFactory > 0) {
      // Debt — red
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${netRemainingDueToFactory.toLocaleString('ar-EG')} ج.م`, leftBoxX + leftBoxW / 2, netCenterY);

      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#dc2626';
      ctx.fillText('يجب سداد المبلغ أعلاه', leftBoxX + leftBoxW / 2, netCenterY + 28);
    } else if (netRemainingDueToFactory === 0) {
      // Settled — emerald green
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('٠.٠٠ ج.م', leftBoxX + leftBoxW / 2, netCenterY);

      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#059669';
      ctx.fillText('*تم تسوية الحساب بالكامل*', leftBoxX + leftBoxW / 2, netCenterY + 30);
    } else {
      // Credit — indigo
      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.abs(netRemainingDueToFactory).toLocaleString('ar-EG')} ج.م`, leftBoxX + leftBoxW / 2, netCenterY);

      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#4f46e5';
      ctx.fillText('رصيد دائن لصالح المصنع', leftBoxX + leftBoxW / 2, netCenterY + 30);
    }

    y += bottomBoxH + 20;

    // ── Footer / Signatures ──
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();

    y += 22;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تم التصدير من نظام تتبع المبيعات — ' + new Date().toLocaleDateString('ar-EG'), W / 2, y);

    y += 30;
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();

    // Download
    const dataUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.download = `كشف_حساب_المصنع_${new Date().toISOString().substring(0, 10)}.png`;
    downloadLink.href = dataUrl;
    downloadLink.click();
  };

  // ── Archived cycle image export (professional invoice style) ──
  const downloadArchivedCycleImage = (cycle: any) => {
    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;
    const payRowH = 34;
    const loads = cycle.loads || [];
    const pays = cycle.payments || [];

    const headerH = 110;
    const loadsTableH = loads.length > 0 ? 36 + loads.length * loadRowH + 36 : 50;
    const summaryRowH = 36;
    const bottomBoxH = Math.max(pays.length * payRowH + 100, 180);
    const footerH = 70;
    const totalH = headerH + 10 + loadsTableH + summaryRowH + 15 + bottomBoxH + footerH + 40;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // Outer frame
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // Header
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();

    // Gold accent line
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('دورة مؤرشفة — كشف حساب المصنع', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('نظام التوزيع والمبيعات المعتمد للأغذية والمستودع', W / 2, 68);

    // Date
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الإقفال: ${cycle.settledAt || '—'}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`رقم الدورة: ${cycle.id?.slice(-6) || '—'}`, 55, 92);

    let y = 12 + headerH + 12;

    // ── Loads Table ──
    const colX = padX;
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('البيان / المرحلة', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('العدد', colQty, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الإجمالي', colTotal, y + 22);
    y += 32;

    let totalLoadValue = 0;
    loads.forEach((l: any, idx: number) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);
      ctx.beginPath();
      ctx.moveTo(colX, y + loadRowH);
      ctx.lineTo(colX + tableW, y + loadRowH);
      ctx.stroke();

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';

      const arabicNum = String(idx + 1).padStart(2, '0');
      ctx.textAlign = 'center';
      ctx.fillText(arabicNum, colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(`${l.productName} (${l.weightSize})`, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(`${l.cartons} كرتونة${l.loose > 0 ? ` + ${l.loose}` : ''}`, colQty, y + 24);
      ctx.fillText(`${formatNum(l.cartonPrice)} ج.م`, colPrice, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${formatNum(l.subtotal)} ج.م`, colTotal, y + 24);

      totalLoadValue += l.subtotal || 0;
      y += loadRowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المسحوبات (المطلوب)', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${formatNum(totalLoadValue)} ج.م`, colTotal, y + 24);
    y += summaryRowH + 15;

    // ── Bottom two boxes ──
    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;
    const leftBoxW = (tableW - boxGap) * 0.45;
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    // Right Box: سجل الدفعات المستلمة
    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('سجل الدفعات المستلمة', rightBoxX + rightBoxW / 2, y + 21);

    let payY = y + 38;
    let totalPayments = 0;

    if (pays.length > 0) {
      pays.forEach((p: any, idx: number) => {
        if (idx > 0) {
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = '#c5b89a';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(rightBoxX + 15, payY - 4);
          ctx.lineTo(rightBoxX + rightBoxW - 15, payY - 4);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`• ${p.notes || 'تسديد'} - ${p.date || ''}`, rightBoxX + rightBoxW - 20, payY + 14);
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = '#0d7c5f';
        ctx.textAlign = 'left';
        ctx.fillText(`${formatNum(p.amount)} ج.م`, rightBoxX + 20, payY + 14);
        totalPayments += p.amount || 0;
        payY += payRowH;
      });

      payY += 4;
      ctx.strokeStyle = '#2c3e6b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rightBoxX + 15, payY);
      ctx.lineTo(rightBoxX + rightBoxW - 15, payY);
      ctx.stroke();

      payY += 18;
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`إجمالي المسدد: ${formatNum(totalPayments)} ج.م`, rightBoxX + rightBoxW - 20, payY);
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`عدد الدفعات: ${pays.length}`, rightBoxX + 20, payY);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('لا توجد دفعات مسجلة', rightBoxX + rightBoxW / 2, payY + 30);
    }

    // Left Box: صافي المستحق (المتبقي)
    const netRemaining = (cycle.totalWithdrawnValue || 0) - (cycle.totalAdvancePayments || 0);
    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('صافي المستحق (المتبقي)', leftBoxX + leftBoxW / 2, y + 21);

    const netCenterY = y + 30 + (bottomBoxH - 30) / 2;
    if (netRemaining > 0) {
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${formatNum(netRemaining)} ج.م`, leftBoxX + leftBoxW / 2, netCenterY);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('يجب سداد المبلغ أعلاه', leftBoxX + leftBoxW / 2, netCenterY + 28);
    } else if (netRemaining === 0) {
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('٠.٠٠ ج.م', leftBoxX + leftBoxW / 2, netCenterY);
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('*تم تسوية الحساب بالكامل*', leftBoxX + leftBoxW / 2, netCenterY + 30);
    } else {
      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${formatNum(Math.abs(netRemaining))} ج.م`, leftBoxX + leftBoxW / 2, netCenterY);
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('رصيد دائن لصالح المصنع', leftBoxX + leftBoxW / 2, netCenterY + 30);
    }

    y += bottomBoxH + 20;

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 22;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تم التصدير من نظام تتبع المبيعات — ' + new Date().toLocaleDateString('ar-EG'), W / 2, y);

    // Download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `دورة_مؤرشفة_${(cycle.settledAt || '').replace(/[/:]/g, '-')}.png`;
    link.href = dataUrl;
    link.click();
  };

  // ── Archived cycle PDF export (professional invoice style) ──
  const downloadArchivedCyclePDF = (cycle: any) => {
    const loads = cycle.loads || [];
    const pays = cycle.payments || [];
    const totalLoadValue = loads.reduce((s: number, l: any) => s + (l.subtotal || 0), 0);
    const totalPayments = pays.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const netRemaining = (cycle.totalWithdrawnValue || 0) - (cycle.totalAdvancePayments || 0);

    const loadsRows = loads.map((l: any, i: number) => `
      <tr>
        <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
        <td style="text-align:right">${l.productName} (${l.weightSize})</td>
        <td style="text-align:center">${l.cartons} كرتونة${l.loose > 0 ? ` + ${l.loose}` : ''}</td>
        <td style="text-align:center">${formatNum(l.cartonPrice)} ج.م</td>
        <td style="text-align:center;font-weight:bold">${formatNum(l.subtotal)} ج.م</td>
      </tr>
    `).join('');

    const payRows = pays.map((p: any, i: number) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="text-align:right">${p.notes || 'تسديد'} - ${p.date || ''}</td>
        <td style="text-align:center;font-weight:bold;color:#0d7c5f">${formatNum(p.amount)} ج.م</td>
        <td style="text-align:right">${p.delegateName || '-'}</td>
      </tr>
    `).join('');

    const netColor = netRemaining > 0 ? '#dc2626' : netRemaining === 0 ? '#059669' : '#4f46e5';
    const netText = netRemaining > 0 ? `${formatNum(netRemaining)} ج.م` : netRemaining === 0 ? '٠.٠٠ ج.م — *تم تسوية الحساب بالكامل*' : `${formatNum(Math.abs(netRemaining))} ج.م — رصيد دائن لصالح المصنع`;
    const settleNote = netRemaining === 0 ? '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:8px 12px;color:#059669;font-weight:bold;font-size:13px;text-align:center;margin-top:8px">*تم تسوية الحساب بالكامل*</div>' : '';

    const html = `<html dir="rtl" lang="ar"><head><style>
      @media print{@page{size:A4;margin:10mm}body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      body{font-family:system-ui,sans-serif;padding:0;margin:0;color:#1a1a1a;background:#faf8f5}
      .page{padding:20px;max-width:210mm;margin:0 auto}
      .header{background:#1e2a4a;color:#fff;padding:20px;border-radius:6px;text-align:center;margin-bottom:16px;border-bottom:4px solid #d4a843}
      .header h1{margin:0 0 6px;font-size:22px}
      .header .sub{color:#93c5fd;font-size:11px;margin:0 0 4px}
      .header .meta{display:flex;justify-content:space-between;font-size:11px;color:#cbd5e1;padding:0 10px}
      .header .meta .gold{color:#fbbf24;font-weight:bold}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
      th{background:#2c3e6b;color:#fff;padding:8px 6px;font-weight:bold;text-align:center}
      td{padding:7px 6px;border-bottom:1px solid #e8e4dc;text-align:right}
      tr:nth-child(even) td{background:#f5f3ee}
      .summary-row{background:#0d7c5f;color:#fff;font-weight:bold}
      .summary-row td{border:none;padding:10px 6px}
      .boxes{display:flex;gap:15px;margin-top:12px}
      .box{flex:1;border:2px solid #2c3e6b;border-radius:6px;overflow:hidden}
      .box-header{background:#2c3e6b;color:#fff;padding:8px 12px;font-weight:bold;font-size:13px;text-align:center}
      .box-body{padding:12px;min-height:120px;background:#fdf6ee}
      .pay-entry{border-bottom:1px dashed #c5b89a;padding:8px 0;font-size:12px;display:flex;justify-content:space-between}
      .pay-entry:last-child{border-bottom:none}
      .pay-amount{color:#0d7c5f;font-weight:bold;font-size:13px}
      .pay-total{border-top:2px solid #2c3e6b;padding-top:10px;margin-top:10px;display:flex;justify-content:space-between;font-weight:bold;font-size:13px}
      .net-box{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%}
      .net-amount{font-size:32px;font-weight:bold;margin:12px 0}
      .net-note{font-size:13px;font-weight:bold}
      .net-settled{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:8px 12px;color:#059669;font-weight:bold;font-size:13px;text-align:center;margin-top:8px}
      .footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;border-top:1px solid #d5d0c8;padding-top:12px}
      .sig{display:flex;justify-content:space-between;margin-top:20px;font-size:11px;color:#1a1a1a}
    </style></head><body>
      <div class="page">
        <div class="header">
          <h1>دورة مؤرشفة — كشف حساب المصنع</h1>
          <p class="sub">نظام التوزيع والمبيعات المعتمد للأغذية وال المستودع</p>
          <div class="meta">
            <span>تاريخ الإقفال: ${cycle.settledAt || '—'}</span>
            <span class="gold">رقم الدورة: ${cycle.id?.slice(-6) || '—'}</span>
          </div>
        </div>

        <h3 style="color:#2c3e6b;margin-bottom:8px">📦 الحمولات (${loads.length})</h3>
        <table>
          <thead><tr><th width="40">م</th><th>البيان / المرحلة</th><th>العدد</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>${loadsRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">لا توجد حمولات</td></tr>'}</tbody>
        </table>
        <div style="background:#0d7c5f;color:#fff;padding:10px 12px;border-radius:6px;display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-bottom:12px">
          <span>إجمالي المسحوبات (المطلوب)</span>
          <span>${formatNum(totalLoadValue)} ج.م</span>
        </div>

        <div class="boxes">
          <div class="box">
            <div class="box-header">سجل الدفعات المستلمة</div>
            <div class="box-body">
              ${pays.length > 0 ? pays.map((p: any) => `
                <div class="pay-entry">
                  <span>${p.notes || 'تسديد'} - ${p.date || ''}</span>
                  <span class="pay-amount">${formatNum(p.amount)} ج.م</span>
                </div>
              `).join('') : '<div style="text-align:center;color:#94a3b8;padding:20px">لا توجد دفعات مسجلة</div>'}
              ${pays.length > 0 ? `
              <div class="pay-total">
                <span>إجمالي المسدد: ${formatNum(totalPayments)} ج.م</span>
                <span>عدد الدفعات: ${pays.length}</span>
              </div>` : ''}
            </div>
          </div>
          <div class="box">
            <div class="box-header">صافي المستحق (المتبقي)</div>
            <div class="box-body">
              <div class="net-box">
                <div class="net-amount" style="color:${netColor}">${netRemaining === 0 ? '٠.٠٠ ج.م' : `${formatNum(Math.abs(netRemaining))} ج.م`}</div>
                <div class="net-note" style="color:${netColor}">${netRemaining > 0 ? 'يجب سداد المبلغ أعلاه' : netRemaining === 0 ? '*تم تسوية الحساب بالكامل*' : 'رصيد دائن لصالح المصنع'}</div>
                ${settleNote}
              </div>
            </div>
          </div>
        </div>

        <div class="footer">تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    }
  };

  // Combined PDF export for ALL archived cycles
  const downloadAllArchivedCyclesPDF = () => {
    if (archiveCycles.length === 0) { showToast('⚠️ لا توجد دورات مؤرشفة!'); return; }

    let allLoadsHtml = '';
    let allPaymentsHtml = '';
    let cycleIndex = 0;
    let grandTotalLoad = 0;
    let grandTotalPayments = 0;

    archiveCycles.forEach((cycle) => {
      cycleIndex++;
      const loads = cycle.loads || [];
      const pays = cycle.payments || [];
      const totalLoadValue = loads.reduce((s: number, l: any) => s + (l.subtotal || 0), 0);
      const totalPayments = pays.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      grandTotalLoad += totalLoadValue;
      grandTotalPayments += totalPayments;

      const loadsRows = loads.map((l: any, i: number) => `
        <tr>
          <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
          <td style="text-align:right">${l.productName} (${l.weightSize})</td>
          <td style="text-align:center">${l.cartons} كرتونة${l.loose > 0 ? ` + ${l.loose}` : ''}</td>
          <td style="text-align:center">${formatNum(l.cartonPrice)} ج.م</td>
          <td style="text-align:center;font-weight:bold">${formatNum(l.subtotal)} ج.م</td>
        </tr>
      `).join('');

      const payRows = pays.map((p: any, i: number) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td style="text-align:right">${p.notes || 'تسديد'} - ${p.date || ''}</td>
          <td style="text-align:center;font-weight:bold;color:#0d7c5f">${formatNum(p.amount)} ج.م</td>
          <td style="text-align:right">${p.delegateName || '-'}</td>
          <td style="text-align:right">${p.recipient ? 'السيد / ' + p.recipient : '-'}</td>
        </tr>
      `).join('');

      allLoadsHtml += `
        <div style="margin-bottom:30px;page-break-inside:avoid">
          <h3 style="color:#2c3e6b;margin-bottom:8px;border-bottom:2px solid #2c3e6b;padding-bottom:6px">الدورة ${cycleIndex} — ${cycle.settledAt || '—'} (${loads.length} حمولة)</h3>
          <table>
            <thead><tr><th width="40">م</th><th>البيان / المرحلة</th><th>العدد</th><th>السعر</th><th>الإجمالي</th></tr></thead>
            <tbody>${loadsRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">لا توجد حمولات</td></tr>'}</tbody>
          </table>
          <div style="background:#0d7c5f;color:#fff;padding:8px 12px;border-radius:6px;display:flex;justify-content:space-between;font-weight:bold;font-size:12px;margin-bottom:8px">
            <span>إجمالي المسحوبات</span>
            <span>${formatNum(totalLoadValue)} ج.م</span>
          </div>
          ${cycle.creditBalance > 0 ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:6px;color:#92400e;font-weight:bold;font-size:11px;text-align:center">رصيد دائن: ${formatNum(cycle.creditBalance)} ج.م</div>` : ''}
        </div>`;

      allPaymentsHtml += `
        <div style="margin-bottom:20px;page-break-inside:avoid">
          <h4 style="color:#2c3e6b;margin-bottom:6px">الدورة ${cycleIndex} — الدفعات (${pays.length} دفعة)</h4>
          ${pays.length > 0 ? `<table>
            <thead><tr><th>م</th><th>البيان</th><th>المبلغ</th><th>المندوب</th><th>المستلم</th></tr></thead>
            <tbody>${payRows}</tbody>
          </table>
          <div style="background:#065f46;color:#fff;padding:6px 10px;border-radius:6px;display:flex;justify-content:space-between;font-weight:bold;font-size:11px;margin-top:4px">
            <span>إجمالي المسدد: ${formatNum(totalPayments)} ج.م</span>
            <span>عدد الدفعات: ${pays.length}</span>
          </div>` : '<p style="color:#94a3b8;text-align:center;font-size:11px">لا توجد دفعات</p>'}
        </div>`;
    });

    const netGrand = grandTotalLoad - grandTotalPayments;

    const html = `<html dir="rtl" lang="ar"><head><style>
      @media print{@page{size:A4;margin:8mm}body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      body{font-family:system-ui,sans-serif;padding:0;margin:0;color:#1a1a1a;background:#faf8f5}
      .page{padding:15px;max-width:210mm;margin:0 auto}
      .header{background:#1e2a4a;color:#fff;padding:18px;border-radius:6px;text-align:center;margin-bottom:14px;border-bottom:4px solid #d4a843}
      .header h1{margin:0 0 4px;font-size:20px}
      .header .sub{color:#93c5fd;font-size:11px;margin:0 0 4px}
      .header .meta{display:flex;justify-content:space-between;font-size:11px;color:#cbd5e1;padding:0 10px}
      .header .meta .gold{color:#fbbf24;font-weight:bold}
      table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:10px}
      th{background:#2c3e6b;color:#fff;padding:6px 4px;font-weight:bold;text-align:center}
      td{padding:5px 4px;border-bottom:1px solid #e8e4dc;text-align:right}
      tr:nth-child(even) td{background:#f5f3ee}
      .footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:20px;border-top:1px solid #d5d0c8;padding-top:10px}
    </style></head><body>
      <div class="page">
        <div class="header">
          <h1>جميع الدورات المؤرشفة — كشف حساب المصنع</h1>
          <p class="sub">نظام التوزيع والمبيعات المعتمد للأغذية والمستودع</p>
          <div class="meta">
            <span>عدد الدورات: ${archiveCycles.length}</span>
            <span class="gold">إجمالي المسحوبات: ${formatNum(grandTotalLoad)} ج.م</span>
          </div>
          <div class="meta" style="margin-top:4px">
            <span>إجمالي المسدد: ${formatNum(grandTotalPayments)} ج.م</span>
            <span style="color:${netGrand > 0 ? '#f87171' : '#4ade80'};font-weight:bold">الصافي: ${formatNum(Math.abs(netGrand))} ج.م ${netGrand > 0 ? 'مدين' : netGrand === 0 ? 'مسوى' : 'دائن'}</span>
          </div>
        </div>
        ${allLoadsHtml}
        <h3 style="color:#2c3e6b;margin-top:20px;border-bottom:2px solid #065f46;padding-bottom:6px">💳 الدفعات المباشرة لجميع الدورات</h3>
        ${allPaymentsHtml}
        <div class="footer">تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    }
  };

  // Combined Image export for ALL archived cycles
  const downloadAllArchivedCyclesImage = () => {
    if (archiveCycles.length === 0) { showToast('⚠️ لا توجد دورات مؤرشفة!'); return; }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const headerH = 110;
    const rowH = 34;
    const footerH = 50;

    // Pre-calculate total height
    let totalContentH = 0;
    archiveCycles.forEach(cycle => {
      const loads = cycle.loads || [];
      totalContentH += 40; // cycle title
      totalContentH += 32; // table header
      totalContentH += loads.length * rowH; // load rows
      totalContentH += 36; // summary row
      totalContentH += 30; // gap
    });
    const totalH = headerH + 10 + totalContentH + footerH + 40;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // Outer frame
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // Header
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('جميع الدورات المؤرشفة — كشف حساب المصنع', W / 2, 45);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`عدد الدورات: ${archiveCycles.length} — تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`, W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`الدورات: ${archiveCycles.length}`, 55, 92);

    let y = 12 + headerH + 12;

    // Column positions
    const colX = padX;
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    archiveCycles.forEach((cycle, cycleIdx) => {
      const loads = cycle.loads || [];
      const totalLoadValue = loads.reduce((s: number, l: any) => s + (l.subtotal || 0), 0);

      // Cycle title
      ctx.fillStyle = '#2c3e6b';
      ctx.fillRect(colX, y, tableW, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`الدورة ${cycleIdx + 1} — ${cycle.settledAt || '—'} (${loads.length} حمولة)`, colX + tableW - 10, y + 21);
      y += 30;

      // Table header
      ctx.fillStyle = '#374151';
      ctx.fillRect(colX, y, tableW, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('م', colSerial, y + 22);
      ctx.textAlign = 'right';
      ctx.fillText('البيان / المرحلة', colDesc, y + 22);
      ctx.textAlign = 'center';
      ctx.fillText('العدد', colQty, y + 22);
      ctx.fillText('السعر', colPrice, y + 22);
      ctx.fillText('الإجمالي', colTotal, y + 22);
      y += 32;

      // Load rows
      loads.forEach((load: any, idx: number) => {
        ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
        ctx.fillRect(colX, y, tableW, rowH);
        ctx.strokeStyle = '#d5d0c8';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(colX, y, tableW, rowH);

        ctx.fillStyle = '#1a1a1a';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 22);
        ctx.textAlign = 'right';
        ctx.fillText(`${load.productName} (${load.weightSize})`, colDesc, y + 22);
        ctx.textAlign = 'center';
        ctx.fillText(`${load.cartons} كرتونة${load.loose > 0 ? ` + ${load.loose}` : ''}`, colQty, y + 22);
        ctx.fillText(`${formatNum(load.cartonPrice)} ج.م`, colPrice, y + 22);
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText(`${formatNum(load.subtotal)} ج.م`, colTotal, y + 22);
        y += rowH;
      });

      // Summary row
      ctx.fillStyle = '#0d7c5f';
      ctx.fillRect(colX, y, tableW, 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('إجمالي المسحوبات', colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(`${formatNum(totalLoadValue)} ج.م`, colTotal, y + 24);
      y += 36 + 30;
    });

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    const link = document.createElement('a');
    link.download = `جميع_الدورات_المؤرشفة_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // ── Professional trips exports (pending) ──
  const downloadPendingTripsImage = () => {
    const pendingTrips = (trips || []).filter(t => !t.collected);
    if (pendingTrips.length === 0) { showToast('⚠️ لا توجد مشاوير معلقة!'); return; }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const rowH = 38;
    const headerH = 110;
    const summaryRowH = 36;
    const footerH = 50;
    const totalH = headerH + 10 + 32 + pendingTrips.length * rowH + summaryRowH + 15 + 120 + footerH + 30;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('كشف المشاوير المعلقة (غير المحصلة)', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`عدد المشاوير: ${pendingTrips.length}`, W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);

    let y = 12 + headerH + 12;
    const colX = padX;

    // Table header
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 200;
    const colDate = colX + tableW - 420;
    const colPrice = colX + tableW - 580;
    const colStatus = colX + tableW - 750;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('الجهة / الوصف', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('التاريخ', colDate, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الحالة', colStatus, y + 22);
    y += 32;

    let totalPrice = 0;
    [...pendingTrips].reverse().forEach((trip, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, rowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, rowH);

      totalPrice += trip.price || 0;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(trip.description, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(trip.date || '-', colDate, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = trip.price > 0 ? '#1a1a1a' : '#dc2626';
      ctx.fillText(trip.price > 0 ? `${formatNum(trip.price)} ج.م` : 'غير مسعر', colPrice, y + 24);
      ctx.fillStyle = '#f59e0b';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('معلق', colStatus, y + 24);
      y += rowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المشاوير المعلقة', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${formatNum(totalPrice)} ج.م`, colPrice, y + 24);
    y += summaryRowH + 15;

    // Bottom box
    roundRect(ctx, colX, y, tableW, 120, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص المشاوير المعلقة', colX + tableW / 2, y + 21);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد المشاوير: ${pendingTrips.length}`, colX + tableW - 20, y + 55);
    ctx.fillText(`إجمالي السعر: ${formatNum(totalPrice)} ج.م`, colX + tableW - 20, y + 78);

    y += 120 + 20;

    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    const link = document.createElement('a');
    link.download = `مشاوير_معلقة_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadPendingTripsPDF = () => {
    const pendingTrips = (trips || []).filter(t => !t.collected);
    if (pendingTrips.length === 0) { showToast('⚠️ لا توجد مشاوير معلقة!'); return; }

    const reversedTrips = [...pendingTrips].reverse();
    let totalPrice = 0;
    const rowsHtml = reversedTrips.map((trip, i) => {
      totalPrice += trip.price || 0;
      return `<tr>
        <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
        <td style="text-align:right">${trip.description}</td>
        <td style="text-align:center">${trip.date || '-'}</td>
        <td style="text-align:center;font-weight:bold;color:${trip.price > 0 ? '#1a1a1a' : '#dc2626'}">${trip.price > 0 ? formatNum(trip.price) + ' ج.م' : 'غير مسعر'}</td>
        <td style="text-align:center;color:#f59e0b;font-weight:bold">معلق</td>
      </tr>`;
    }).join('');

    const html = `<html dir="rtl" lang="ar"><head><style>
      @media print{@page{size:A4;margin:10mm}body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      body{font-family:system-ui,sans-serif;padding:0;margin:0;color:#1a1a1a;background:#faf8f5}
      .page{padding:20px;max-width:210mm;margin:0 auto}
      .header{background:#1e2a4a;color:#fff;padding:20px;border-radius:6px;text-align:center;margin-bottom:16px;border-bottom:4px solid #d4a843}
      .header h1{margin:0 0 6px;font-size:22px}
      .header .sub{color:#93c5fd;font-size:11px;margin:0 0 4px}
      .header .meta{display:flex;justify-content:space-between;font-size:11px;color:#cbd5e1;padding:0 10px}
      .header .meta .gold{color:#fbbf24;font-weight:bold}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
      th{background:#2c3e6b;color:#fff;padding:8px 6px;font-weight:bold;text-align:center}
      td{padding:7px 6px;border-bottom:1px solid #e8e4dc;text-align:right}
      tr:nth-child(even) td{background:#f5f3ee}
      .summary-row{background:#0d7c5f;color:#fff;font-weight:bold}
      .summary-row td{border:none;padding:10px 6px}
      .footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;border-top:1px solid #d5d0c8;padding-top:12px}
    </style></head><body>
      <div class="page">
        <div class="header">
          <h1>كشف المشاوير المعلقة (غير المحصلة)</h1>
          <p class="sub">نظام التوزيع والمبيعات المعتمد للأغذية والمستودع</p>
          <div class="meta">
            <span>عدد المشاوير: ${pendingTrips.length}</span>
            <span class="gold">إجمالي السعر: ${formatNum(totalPrice)} ج.م</span>
          </div>
          <div class="meta" style="margin-top:4px">
            <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}</span>
          </div>
        </div>
        <table>
          <thead><tr><th width="40">م</th><th>الجهة / الوصف</th><th>التاريخ</th><th>السعر</th><th>الحالة</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="background:#0d7c5f;color:#fff;padding:10px 12px;border-radius:6px;display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-bottom:12px">
          <span>إجمالي المشاوير المعلقة</span>
          <span>${formatNum(totalPrice)} ج.م</span>
        </div>
        <div class="footer">تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400); }
  };

  // ── Professional trips archive exports (collected) ──
  const downloadCollectedTripsImage = () => {
    if (filteredArchiveTrips.length === 0) { showToast('⚠️ لا توجد مشاوير مسددة!'); return; }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const rowH = 38;
    const headerH = 110;
    const summaryRowH = 36;
    const footerH = 50;
    const totalH = headerH + 10 + 32 + filteredArchiveTrips.length * rowH + summaryRowH + 15 + 120 + footerH + 30;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('كشف المشاوير المسددة (المحصلة)', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`عدد المشاوير: ${filteredArchiveTrips.length} — جميعها مسددة`, W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);

    let y = 12 + headerH + 12;
    const colX = padX;

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 200;
    const colDate = colX + tableW - 420;
    const colPrice = colX + tableW - 580;
    const colStatus = colX + tableW - 750;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('الجهة / الوصف', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('التاريخ', colDate, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الحالة', colStatus, y + 22);
    y += 32;

    let totalPrice = 0;
    [...filteredArchiveTrips].reverse().forEach((trip, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, rowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, rowH);

      totalPrice += trip.price || 0;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(trip.description, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(trip.date || '-', colDate, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#059669';
      ctx.fillText(`${formatNum(trip.price)} ج.م`, colPrice, y + 24);
      ctx.fillStyle = '#059669';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('مسدد ✓', colStatus, y + 24);
      y += rowH;
    });

    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المشاوير المحصلة', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${formatNum(totalPrice)} ج.م`, colPrice, y + 24);
    y += summaryRowH + 15;

    roundRect(ctx, colX, y, tableW, 120, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص المشاوير المحصلة', colX + tableW / 2, y + 21);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد المشاوير: ${filteredArchiveTrips.length}`, colX + tableW - 20, y + 55);
    ctx.fillText(`إجمالي المحصل: ${formatNum(totalPrice)} ج.م`, colX + tableW - 20, y + 78);

    y += 120 + 20;

    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    const link = document.createElement('a');
    link.download = `مشاوير_مسددة_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadCollectedTripsPDF = () => {
    if (filteredArchiveTrips.length === 0) { showToast('⚠️ لا توجد مشاوير مسددة!'); return; }

    let totalPrice = 0;
    const rowsHtml = [...filteredArchiveTrips].reverse().map((trip, i) => {
      totalPrice += trip.price || 0;
      return `<tr>
        <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
        <td style="text-align:right">${trip.description}</td>
        <td style="text-align:center">${trip.date || '-'}</td>
        <td style="text-align:center;font-weight:bold;color:#059669">${formatNum(trip.price)} ج.م</td>
        <td style="text-align:center;color:#059669;font-weight:bold">مسدد ✓</td>
      </tr>`;
    }).join('');

    const html = `<html dir="rtl" lang="ar"><head><style>
      @media print{@page{size:A4;margin:10mm}body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      body{font-family:system-ui,sans-serif;padding:0;margin:0;color:#1a1a1a;background:#faf8f5}
      .page{padding:20px;max-width:210mm;margin:0 auto}
      .header{background:#1e2a4a;color:#fff;padding:20px;border-radius:6px;text-align:center;margin-bottom:16px;border-bottom:4px solid #d4a843}
      .header h1{margin:0 0 6px;font-size:22px}
      .header .sub{color:#93c5fd;font-size:11px;margin:0 0 4px}
      .header .meta{display:flex;justify-content:space-between;font-size:11px;color:#cbd5e1;padding:0 10px}
      .header .meta .gold{color:#fbbf24;font-weight:bold}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
      th{background:#2c3e6b;color:#fff;padding:8px 6px;font-weight:bold;text-align:center}
      td{padding:7px 6px;border-bottom:1px solid #e8e4dc;text-align:right}
      tr:nth-child(even) td{background:#f5f3ee}
      .footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;border-top:1px solid #d5d0c8;padding-top:12px}
    </style></head><body>
      <div class="page">
        <div class="header">
          <h1>كشف المشاوير المسددة (المحصلة)</h1>
          <p class="sub">نظام التوزيع والمبيعات المعتمد للأغذية والمستودع</p>
          <div class="meta">
            <span>عدد المشاوير: ${filteredArchiveTrips.length}</span>
            <span class="gold">إجمالي المحصل: ${formatNum(totalPrice)} ج.م</span>
          </div>
          <div class="meta" style="margin-top:4px">
            <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} — ${new Date().toLocaleTimeString('ar-EG')}</span>
          </div>
        </div>
        <table>
          <thead><tr><th width="40">م</th><th>الجهة / الوصف</th><th>التاريخ</th><th>السعر</th><th>الحالة</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="background:#0d7c5f;color:#fff;padding:10px 12px;border-radius:6px;display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-bottom:12px">
          <span>إجمالي المشاوير المحصلة</span>
          <span>${formatNum(totalPrice)} ج.م</span>
        </div>
        <div class="footer">تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400); }
  };

  const getFilteredLoads = () => {
    const now = new Date();
    return factoryLoads.filter(load => {
      const loadDateObj = new Date(load.date);
      if (reportTimeframe === 'daily') {
        return loadDateObj.toDateString() === now.toDateString();
      }
      const diffTime = now.getTime() - loadDateObj.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (reportTimeframe === 'weekly') {
        return diffDays <= 7;
      } else if (reportTimeframe === 'monthly') {
        return diffDays <= 30;
      }
      return true;
    });
  };

  const exportPreviousLoadsToCanvas = (timeframe: 'daily' | 'weekly' | 'monthly') => {
    const list = getFilteredLoads();
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات مسجلة للتقرير في هذه الفترة!');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 250 + list.length * 60 + 200; // Dynamic height with stable margins
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    // Build solid background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border Frame for a document look
    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);

    // Header block
    const headerGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    headerGrad.addColorStop(0, '#1e1b4b');
    headerGrad.addColorStop(0.5, '#312e81');
    headerGrad.addColorStop(1, '#4f46e5');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(14, 14, canvas.width - 28, 120);

    // Header texts
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('تقرير حركة شحن وتوزيع مبيعات المصنع', canvas.width - 45, 60);

    const timeframeLabel = timeframe === 'daily' ? 'يومي (اليوم الحالي)' : timeframe === 'weekly' ? 'أسبوعي (آخر 7 أيام)' : 'شهري (آخر 30 يوم)';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillStyle = '#e0e7ff';
    ctx.fillText(`فترة التقرير المالي والكمي للوكيل: ${timeframeLabel}`, canvas.width - 45, 95);

    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`, 45, 60);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('إدارة حركة مبيعات زيت وسمن سوفانا', 45, 90);

    // Draw Column Headers
    let y = 180;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(35, y - 25, canvas.width - 70, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('الصنف والحجم التاريخ', canvas.width - 55, y + 2);

    ctx.textAlign = 'center';
    ctx.fillText('العدد المسحوب', canvas.width - 325, y + 2);
    ctx.fillText('قيمة الشحنة', canvas.width - 465, y + 2);
    ctx.fillText('المباع بالسيارة', canvas.width - 605, y + 2);
    ctx.fillText('المتبقي بالسيارة', canvas.width - 725, y + 2);

    ctx.textAlign = 'left';
    ctx.fillText('الدفعة المسددة', 85, y + 2);

    y += 25;

    let grandTotalCartons = 0;
    let grandTotalValue = 0;
    let grandTotalSoldUnits = 0;
    let grandTotalAdvances = 0;

    list.forEach((load, idx) => {
      const prod = products.find(p => p.id === load.productId);
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => w.id === load.weightId) || weights[0];
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
      const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
      const totalLoadedValue = loadedCartons * cartonPrice;

      // Calculate total quantity sold for this specific product + weight variant in all client invoices
      let totalUnitsSold = 0;
      invoices.forEach(inv => {
        inv.items.forEach(item => {
          if (item.productId === load.productId && item.weightId === load.weightId) {
            totalUnitsSold += item.quantity;
          }
        });
      });

      // Summing totals
      grandTotalCartons += loadedCartons;
      grandTotalValue += totalLoadedValue;
      grandTotalSoldUnits += totalUnitsSold;
      grandTotalAdvances += load.advanceAmount || 0;

      const daysOfWeek = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const loadDateObj = new Date(load.date);
      const dayName = daysOfWeek[loadDateObj.getDay()];
      const dateStr = `${dayName} ${loadDateObj.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' })}`;

      // Row alternate background colors
      if (idx % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(35, y - 5, canvas.width - 70, 50);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(35, y - 5, canvas.width - 70, 50);
      }

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(35, y - 5, canvas.width - 70, 50);

      // Drawer columns text
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(prod ? prod.name : ((load as any).productName || 'صنف مجهول'), canvas.width - 55, y + 17);
      ctx.fillStyle = '#64748b';
      ctx.font = '500 10px system-ui, sans-serif';
      ctx.fillText(`${weight ? weight.size : ((load as any).weightSize || '')} • (${dateStr})`, canvas.width - 55, y + 34);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${loadedCartons} كرتونة`, canvas.width - 325, y + 25);
      
      ctx.fillStyle = '#4f46e5';
      ctx.fillText(`${totalLoadedValue.toFixed(2)}ج.م`, canvas.width - 465, y + 25);

      const cartonsSoldNum = Number((totalUnitsSold / (weight?.unitsPerCarton || 12)).toFixed(3));
      ctx.fillStyle = '#059669';
      ctx.fillText(`${cartonsSoldNum} كرتونة`, canvas.width - 605, y + 25);

      const remUnits = load.quantity - totalUnitsSold;
      const remCartons = Number((remUnits / (weight?.unitsPerCarton || 12)).toFixed(3));
      ctx.fillStyle = remUnits < 0 ? '#dc2626' : '#2563eb';
      ctx.fillText(`${remCartons} كرتونة`, canvas.width - 725, y + 25);

      ctx.fillStyle = '#b45309';
      ctx.textAlign = 'left';
      ctx.fillText(load.advanceAmount && load.advanceAmount > 0 ? `${load.advanceAmount.toFixed(2)}ج.م` : '0.00', 85, y + 25);

      y += 50;
    });

    // Summary block (Bottom calculations)
    y += 20;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(35, y - 10, canvas.width - 70, 85);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(35, y - 10, canvas.width - 70, 85);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('الملخص المالي الشامل للفترة المحددة في التقرير:', canvas.width - 55, y + 15);

    ctx.font = 'bold 12.5px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`إجمالي الشحن: ${grandTotalCartons} كرتونة بقيمة ${grandTotalValue.toFixed(2)}ج.م`, canvas.width - 55, y + 42);
    ctx.fillText(`إجمالي قيمة البضائع المحملة: ${grandTotalValue.toFixed(2)}ج.م`, canvas.width - 55, y + 63);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`المُسدد للمصنع: ${grandTotalAdvances.toFixed(2)}ج.م`, 85, y + 42);

    // Footer copyright lines
    y += 115;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, y - 15);
    ctx.lineTo(canvas.width - 35, y - 15);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تم التصدير تلقائياً من تطبيق تتبع الشحنات وحسابات المصنع • مراجعة حركة البيع والسداد للمصنع', canvas.width / 2, y - 2);

    // Trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.download = `تقرير_حركة_المصنع_${timeframe}_${new Date().toISOString().substring(0, 10)}.png`;
    downloadLink.href = dataUrl;
    downloadLink.click();
  };

  // ── Filtered loads image export (professional invoice style) ──
  const downloadFilteredLoadsImage = () => {
    if (filteredLoads.length === 0) { showToast('⚠️ لا توجد شحنات مسجلة لهذه الفترة!'); return; }

    const W = 920;
    const padX = 30;
    const tableW = W - padX * 2;
    const loadRowH = 38;

    const headerH = 110;
    const loadsTableH = 36 + filteredLoads.length * loadRowH + 36;
    const summaryRowH = 36;
    const bottomBoxH = 160;
    const footerH = 50;
    const totalH = headerH + 10 + loadsTableH + summaryRowH + 15 + bottomBoxH + footerH + 30;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
      c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
      c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
      c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
      c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    };

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, totalH);

    // Outer frame
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, totalH - 16);

    // Header
    ctx.fillStyle = '#1e2a4a';
    roundRect(ctx, 12, 12, W - 24, headerH, 6);
    ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(12, 12 + headerH - 4, W - 24, 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('بيان شحنات المصنع', W / 2, 48);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    const filterLabel = archiveFilter === 'all' ? 'جميع الفترات' : archiveFilter === 'daily' ? 'يومي (اليوم الحالي)' : archiveFilter === 'weekly' ? 'أسبوعي (آخر 7 أيام)' : archiveFilter === 'monthly' ? 'شهري (آخر 30 يوم)' : 'مخصص';
    ctx.fillText(`الفترة: ${filterLabel}`, W / 2, 68);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}`, W - 55, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`عدد الشحنات: ${filteredLoads.length}`, 55, 92);

    let y = 12 + headerH + 12;

    // ── Loads Table ──
    const colX = padX;
    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(colX, y, tableW, 32);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const colSerial = colX + tableW - 35;
    const colDesc = colX + tableW - 150;
    const colQty = colX + tableW - 370;
    const colPrice = colX + tableW - 530;
    const colTotal = colX + tableW - 700;

    ctx.textAlign = 'center';
    ctx.fillText('م', colSerial, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText('البيان / المرحلة', colDesc, y + 22);
    ctx.textAlign = 'center';
    ctx.fillText('العدد', colQty, y + 22);
    ctx.fillText('السعر', colPrice, y + 22);
    ctx.fillText('الإجمالي', colTotal, y + 22);
    y += 32;

    let totalLoadValue = 0;
    let totalAdvanceAmounts = 0;

    filteredLoads.forEach((load, idx) => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim());
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * unitsPerCarton : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * unitPrice);

      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f5f3ee';
      ctx.fillRect(colX, y, tableW, loadRowH);
      ctx.strokeStyle = '#d5d0c8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(colX, y, tableW, loadRowH);
      ctx.beginPath();
      ctx.moveTo(colX, y + loadRowH);
      ctx.lineTo(colX + tableW, y + loadRowH);
      ctx.stroke();

      const prodName = prod ? prod.name : (load.productName || 'غير معروف');
      const weightSize = weight ? weight.size : (load as any).weightSize || '';

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colSerial, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(`${prodName} (${weightSize})`, colDesc, y + 24);
      ctx.textAlign = 'center';
      ctx.fillText(`${cartons} كرتونة${loose > 0 ? ` + ${loose}` : ''}`, colQty, y + 24);
      ctx.fillText(`${cartonPrice.toFixed(0)} ج.م`, colPrice, y + 24);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${subtotal.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);

      totalLoadValue += subtotal;
      totalAdvanceAmounts += (load.advanceAmount || 0);
      y += loadRowH;
    });

    // Summary row
    ctx.fillStyle = '#0d7c5f';
    ctx.fillRect(colX, y, tableW, summaryRowH);
    ctx.strokeStyle = '#0a6e54';
    ctx.lineWidth = 1;
    ctx.strokeRect(colX, y, tableW, summaryRowH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي المسحوبات (المطلوب)', colDesc, y + 24);
    ctx.textAlign = 'center';
    ctx.fillText(`${totalLoadValue.toLocaleString('ar-EG')} ج.م`, colTotal, y + 24);
    y += summaryRowH + 15;

    // ── Bottom two boxes ──
    const boxGap = 15;
    const rightBoxW = (tableW - boxGap) * 0.55;
    const leftBoxW = (tableW - boxGap) * 0.45;
    const rightBoxX = colX;
    const leftBoxX = colX + rightBoxW + boxGap;

    // Right Box: ملخص الشحنات
    roundRect(ctx, rightBoxX, y, rightBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#fdf6ee';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(rightBoxX, y, rightBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص الشحنات', rightBoxX + rightBoxW / 2, y + 21);

    let infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`عدد الشحنات: ${filteredLoads.length}`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي القيمة: ${totalLoadValue.toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.fillText(`إجمالي المقدمات: ${totalAdvanceAmounts.toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, infoY);
    infoY += 22;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#0d7c5f';
    ctx.fillText(`المتبقي: ${(totalLoadValue - totalAdvanceAmounts).toLocaleString('ar-EG')} ج.م`, rightBoxX + rightBoxW - 20, infoY);

    // Left Box: إجمالي المبيعات
    const totalSoldValue = filteredLoads.reduce((sum, l) => {
      let totalUnitsSold = 0;
      invoices.forEach(inv => { inv.items.forEach(item => { if (item.productId === l.productId && item.weightId === l.weightId) totalUnitsSold += item.quantity; }); });
      const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim());
      const unitPrice = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      return sum + (totalUnitsSold * unitPrice);
    }, 0);

    roundRect(ctx, leftBoxX, y, leftBoxW, bottomBoxH, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e6b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e6b';
    ctx.fillRect(leftBoxX, y, leftBoxW, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ملخص المبيعات', leftBoxX + leftBoxW / 2, y + 21);

    infoY = y + 50;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`إجمالي المباع: ${totalSoldValue.toLocaleString('ar-EG')} ج.م`, leftBoxX + leftBoxW - 20, infoY);
    infoY += 22;
    const totalDirectPayments = filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
    const netDue = totalLoadValue - totalAdvanceAmounts - totalDirectPayments;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = netDue > 0 ? '#dc2626' : '#059669';
    ctx.fillText(`${netDue > 0 ? 'المتبقي للمصنع' : netDue === 0 ? 'مسوى' : 'رصيد دائن'}: ${Math.abs(netDue).toLocaleString('ar-EG')} ج.م`, leftBoxX + leftBoxW - 20, infoY);

    y += bottomBoxH + 20;

    // Footer
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 18;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}`, W / 2, y);

    // Download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `بيان_شحنات_المصنع_${filterLabel}_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  };

  // ── Filtered loads PDF export (professional invoice style) ──
  const downloadFilteredLoadsPDF = () => {
    if (filteredLoads.length === 0) { showToast('⚠️ لا توجد شحنات مسجلة لهذه الفترة!'); return; }

    const filterLabel = archiveFilter === 'all' ? 'جميع الفترات' : archiveFilter === 'daily' ? 'يومي (اليوم الحالي)' : archiveFilter === 'weekly' ? 'أسبوعي (آخر 7 أيام)' : archiveFilter === 'monthly' ? 'شهري (آخر 30 يوم)' : 'مخصص';

    let totalLoadValue = 0;
    let totalAdvanceAmounts = 0;

    const loadsRows = filteredLoads.map((load, i) => {
      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim());
      const unitsPerCarton = weight?.unitsPerCarton || 12;
      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
      const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * unitsPerCarton : 0) || 0);
      const unitPrice = load.unitPrice !== undefined ? Number(load.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
      const subtotal = (cartons * cartonPrice) + (loose * unitPrice);
      const prodName = prod ? prod.name : (load.productName || 'غير معروف');
      const weightSize = weight ? weight.size : (load as any).weightSize || '';
      totalLoadValue += subtotal;
      totalAdvanceAmounts += (load.advanceAmount || 0);
      return `<tr>
        <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
        <td style="text-align:right">${prodName} (${weightSize})</td>
        <td style="text-align:center">${cartons} كرتونة${loose > 0 ? ` + ${loose}` : ''}</td>
        <td style="text-align:center">${cartonPrice.toFixed(0)} ج.م</td>
        <td style="text-align:center;font-weight:bold">${subtotal.toLocaleString('ar-EG')} ج.م</td>
      </tr>`;
    }).join('');

    const totalDirectPayments = filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
    const netDue = totalLoadValue - totalAdvanceAmounts - totalDirectPayments;
    const netColor = netDue > 0 ? '#dc2626' : netDue === 0 ? '#059669' : '#4f46e5';
    const netText = netDue > 0 ? `${netDue.toLocaleString('ar-EG')} ج.م — يجب سداد المبلغ` : netDue === 0 ? '٠.٠٠ ج.م — *تم تسوية الحساب بالكامل*' : `${Math.abs(netDue).toLocaleString('ar-EG')} ج.م — رصيد دائن لصالح المصنع`;

    const html = `<html dir="rtl" lang="ar"><head><style>
      @media print{@page{size:A4;margin:10mm}body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      body{font-family:system-ui,sans-serif;padding:0;margin:0;color:#1a1a1a;background:#faf8f5}
      .page{padding:20px;max-width:210mm;margin:0 auto}
      .header{background:#1e2a4a;color:#fff;padding:20px;border-radius:6px;text-align:center;margin-bottom:16px;border-bottom:4px solid #d4a843}
      .header h1{margin:0 0 6px;font-size:22px}
      .header .sub{color:#93c5fd;font-size:11px;margin:0 0 4px}
      .header .meta{display:flex;justify-content:space-between;font-size:11px;color:#cbd5e1;padding:0 10px}
      .header .meta .gold{color:#fbbf24;font-weight:bold}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
      th{background:#2c3e6b;color:#fff;padding:8px 6px;font-weight:bold;text-align:center}
      td{padding:7px 6px;border-bottom:1px solid #e8e4dc;text-align:right}
      tr:nth-child(even) td{background:#f5f3ee}
      .summary-row{background:#0d7c5f;color:#fff;font-weight:bold}
      .summary-row td{border:none;padding:10px 6px}
      .boxes{display:flex;gap:15px;margin-top:12px}
      .box{flex:1;border:2px solid #2c3e6b;border-radius:6px;overflow:hidden}
      .box-header{background:#2c3e6b;color:#fff;padding:8px 12px;font-weight:bold;font-size:13px;text-align:center}
      .box-body{padding:12px;min-height:100px;background:#fdf6ee}
      .box-body-white{padding:12px;min-height:100px;background:#ffffff}
      .info-line{font-size:12px;margin:6px 0;display:flex;justify-content:space-between}
      .info-bold{font-weight:bold;font-size:13px}
      .footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;border-top:1px solid #d5d0c8;padding-top:12px}
    </style></head><body>
      <div class="page">
        <div class="header">
          <h1>بيان شحنات المصنع</h1>
          <p class="sub">نظام التوزيع والمبيعات المعتمد للأغذية والمستودع</p>
          <div class="meta">
            <span>الفترة: ${filterLabel}</span>
            <span class="gold">عدد الشحنات: ${filteredLoads.length}</span>
          </div>
          <div class="meta" style="margin-top:4px">
            <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}</span>
          </div>
        </div>

        <table>
          <thead><tr><th width="40">م</th><th>البيان / المرحلة</th><th>العدد</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>${loadsRows}</tbody>
        </table>
        <div style="background:#0d7c5f;color:#fff;padding:10px 12px;border-radius:6px;display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-bottom:12px">
          <span>إجمالي المسحوبات (المطلوب)</span>
          <span>${totalLoadValue.toLocaleString('ar-EG')} ج.م</span>
        </div>

        <div class="boxes">
          <div class="box">
            <div class="box-header">ملخص الشحنات</div>
            <div class="box-body">
              <div class="info-line"><span>عدد الشحنات:</span><span class="info-bold">${filteredLoads.length}</span></div>
              <div class="info-line"><span>إجمالي القيمة:</span><span class="info-bold">${totalLoadValue.toLocaleString('ar-EG')} ج.م</span></div>
              <div class="info-line"><span>إجمالي المقدمات:</span><span class="info-bold">${totalAdvanceAmounts.toLocaleString('ar-EG')} ج.م</span></div>
              <div class="info-line" style="border-top:1px solid #d5d0c8;padding-top:6px;margin-top:6px"><span style="font-weight:bold;color:#0d7c5f">المتبقي:</span><span class="info-bold" style="color:#0d7c5f">${(totalLoadValue - totalAdvanceAmounts).toLocaleString('ar-EG')} ج.م</span></div>
            </div>
          </div>
          <div class="box">
            <div class="box-header">صافي المستحق (المتبقي)</div>
            <div class="box-body-white" style="display:flex;flex-direction:column;align-items:center;justify-content:center">
              <div style="font-size:32px;font-weight:bold;color:${netColor};margin:8px 0">${Math.abs(netDue).toLocaleString('ar-EG')} ج.م</div>
              <div style="font-size:13px;font-weight:bold;color:${netColor}">${netDue > 0 ? 'يجب سداد المبلغ أعلاه' : netDue === 0 ? '*تم تسوية الحساب بالكامل*' : 'رصيد دائن لصالح المصنع'}</div>
            </div>
          </div>
        </div>

        <div class="footer">تم التصدير من نظام تتبع المبيعات — ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    }
  };

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 text-right animate-fade-in" dir="rtl" id="factory-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-[60] shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-emerald-300" />
          <h1 className="text-xl font-bold">حمولة السيارة</h1>
        </div>
        <button
          onClick={onGoBack}
          className="bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 active:scale-95 text-white rounded-lg py-1.5 px-3.5 text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>الرئيسية</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="w-full max-w-xl mx-auto p-2 md:p-4 flex flex-col gap-4 bg-[#F7FAFC] min-h-screen">
        {/* Tab selector */}
        {(() => {
          const showLoads = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('loads');
          const showProducts = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('products');
          const showPreviousLoads = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('previous_loads');
          const showFactoryAccount = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('factory_account');
          const showTrips = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('trips');
          return (
            <div className="flex flex-wrap bg-[#FFFFFF] p-2 rounded-2xl border border-slate-200 gap-1 sm:gap-2 shadow-sm text-center">
              {showLoads && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('loads')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'loads'
                      ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm'
                      : 'text-[#9CA3AF] hover:bg-emerald-50 hover:text-[#DD6B20] select-none'
                  }`}
                >
                  الحمولة
                </button>
              )}
              {showProducts && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('products')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'products'
                      ? 'bg-sky-600 text-white shadow-md select-none'
                      : 'text-[#9CA3AF] hover:bg-sky-50 hover:text-sky-700 select-none'
                  }`}
                >
                  الأصناف
                </button>
              )}
              {showFactoryAccount && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('factory_account')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'factory_account'
                      ? 'bg-violet-600 text-white shadow-md select-none'
                      : 'text-[#9CA3AF] hover:bg-violet-50 hover:text-violet-700 select-none'
                  }`}
                >
                  الحساب
                </button>
              )}
              {showTrips && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('trips')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'trips'
                      ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm'
                      : 'text-[#9CA3AF] hover:bg-[#1A365D] hover:text-white hover:text-[#1A365D] select-none'
                  }`}
                >
                  المشاوير
                </button>
              )}
              {showPreviousLoads && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('previous_loads')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[10px] sm:text-[11px] transition-all focus:outline-none cursor-pointer border border-[#cfd3d9] ${
                    activeSubTab === 'previous_loads'
                      ? 'bg-amber-600 text-white shadow-md select-none'
                      : 'text-[#9CA3AF] hover:bg-amber-50 hover:text-amber-700 select-none'
                  }`}
                >
                  الأرشيف
                </button>
              )}
            </div>
          );
        })()}

        {/* 1. حمولة السيارة */}
        {activeSubTab === 'loads' && (
          <div className="flex flex-col gap-5">
            {/* Create Load Form as requested */}
            <form onSubmit={handleAddLoadSubmit} className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <h3 className="font-bold text-[#1A365D] text-base flex items-center gap-1.5">
                  <PackagePlus className="h-5 w-5 text-[#2B6CB0]" />
                  حمولة السيارة
                </h3>
                
                {/* Date & Time controls colocated adjacent to Title */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-400 bg-[#F7FAFC]/80 p-1 px-2 rounded-md shrink-0">تاريخ ووقت التحميل:</span>
                  <input
                    type="datetime-local"
                    required
                    value={loadDate}
                    onChange={(e) => setLoadDate(e.target.value)}
                    className="bg-indigo-50 border border-indigo-100 rounded-md p-1 px-2 text-[11px] font-mono text-[#1A365D] focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                <div>
                  <label className="inline-block bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">المنتج</label>
                  <select
                    required
                    value={loadProductId}
                    onChange={(e) => setLoadProductId(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#1A365D]"
                  >
                    <option value="">-- اختر الصنف من المصنع --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {isManager && (
                  <div>
                    <label className="inline-block bg-violet-100 text-violet-950 border border-violet-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">المندوب</label>
                    <select
                      value={loadDelegatePhone}
                      onChange={(e) => setLoadDelegatePhone(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#1A365D]"
                    >
                      <option value="">-- اختر المندوب المستلم --</option>
                      {archiveDelegates.filter(d => d.phone !== 'مجهول').map(d => (
                        <option key={d.phone} value={d.phone}>{d.name} ({d.phone})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Weights selection & input via dropdown as requested */}
                {loadProductId && (
                  <div className="bg-[#F7FAFC] p-4 rounded-xl border border-slate-150 flex flex-col gap-4">
                    <span className="text-xs font-black text-indigo-950 flex items-center gap-1 border-b border-indigo-100/50 pb-1.5">
                      <Scale className="h-4 w-4 text-[#2B6CB0]" />
                      المنتجات المحملة
                    </span>
                    
                    {activeWeights.length === 0 ? (
                      <p className="text-center text-gray-400 py-4 text-xs">لا توجد أوزان مضافة لهذا المنتج بعد. يرجى إضافتها في تبويب (المنتجات)</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {/* لوحة جرد السيارة الحية للصنف المختار */}
                        <div className="flex flex-col gap-2 mb-1 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                          <span className="text-[10px] font-bold text-indigo-800">📊 جرد السيارة الحالي لهذا الصنف:</span>
                          <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                            {activeWeights.map(w => {
                              const stock = weightStocks[`${activeProductObj?.id}_${w.id}`] || { loaded: 0, remaining: 0 };
                              const unitsPerC = w.unitsPerCarton || 12;
                              const loadedC = Math.floor(stock.loaded / unitsPerC);
                              const remC = Math.floor(stock.remaining / unitsPerC);
                              const remP = stock.remaining % unitsPerC;
                              const remText = remP > 0 ? `${remC}ك و ${remP}ع` : `${remC}ك`;
                              return (
                                <div key={w.id} className="bg-white border border-indigo-100/60 p-1.5 rounded-md flex flex-col shadow-xs">
                                  <span className="font-extrabold text-[#1A365D] mb-0.5">{w.size}</span>
                                  <div className="flex justify-between px-1 text-slate-500 font-bold">
                                    <span>مُحمل: <strong className="text-[#1A365D]">{loadedC}ك</strong></span>
                                    <span>متبقي: <strong className={stock.remaining > 0 ? 'text-emerald-600' : 'text-rose-600'}>{remText}</strong></span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {/* Dropdown for weight selection */}
                          <div>
                            <label className="inline-block bg-sky-100 text-sky-950 border border-sky-200 text-[11px] font-black px-2 py-0.5 rounded-md mb-1.5 shadow-sm">الوزن</label>
                            <select
                              value={selectedLoadWeightId}
                              onChange={(e) => setSelectedLoadWeightId(e.target.value)}
                              className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-indigo-500 text-[#1A365D] focus:outline-none shrink-0"
                            >
                              <option value="">-- اضغط للاختيار --</option>
                              {activeWeights.map(w => {
                                const stock = weightStocks[`${activeProductObj?.id}_${w.id}`] || { loaded: 0, remaining: 0 };
                                const remC = Math.floor(stock.remaining / (w.unitsPerCarton || 12));
                                const remP = stock.remaining % (w.unitsPerCarton || 12);
                                const remText = remP > 0 ? `${remC}ك و ${remP}ع` : `${remC}ك`;
                                return (
                                  <option key={w.id} value={w.id}>
                                    {w.size} (متبقي بالسيارة: {remText})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Input for loading quantity (Cartons count) */}
                          <div>
                            <label className="inline-block bg-amber-100 text-amber-950 border border-amber-200 text-[11px] font-black px-2 py-0.5 rounded-md mb-1.5 shadow-sm">
                              الكمية للحمولة ({activeProductObj?.accountingUnit || 'كرتونة'})
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="number"
                                min="1"
                                placeholder="مثال: 50"
                                value={loadQtyCartons}
                                onChange={(e) => setLoadQtyCartons(e.target.value)}
                                className="flex-1 bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold text-center text-[#1A365D] focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                              />
                              <button
                                type="button"
                                onClick={handleAddWeightQtyToDraft}
                                className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition-all active:scale-95 duration-75 text-center flex items-center justify-center shrink-0"
                              >
                                إضافة للحمولة
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* List items with the product name displayed ONLY ONCE and details below it */}
                        {groupedDraftItems.length > 0 && (
                          <div className="mt-2.5 bg-[#FFFFFF] border border-slate-200 rounded-xl p-3 shadow-inner flex flex-col gap-3">
                            <span className="block text-xs font-extrabold text-indigo-950 border-b border-slate-100 pb-1.5 flex items-center gap-1">
                              <span className="h-2 w-2 bg-indigo-500 rounded-full"></span>
                              بيان حمولة السيارة المؤقتة الحالية لتسجيل الدفعة:
                            </span>

                            <div className="flex flex-col gap-3">
                              {groupedDraftItems.map(group => (
                                <div key={group.product.id} className="border border-slate-150 rounded-xl p-2.5 bg-[#F7FAFC]/50 flex flex-col">
                                  {/* Product Name appears ONLY ONCE */}
                                  <span className="block text-xs font-black text-[#1A365D] bg-indigo-50 border border-indigo-100/50 py-1 px-2.5 rounded mb-1.5 self-start inline-block">
                                    {group.product.name}
                                  </span>

                                  <div className="flex flex-col gap-1.5">
                                    {group.items.map(item => (
                                      <div key={item.weight.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-[#FFFFFF] rounded-lg border border-slate-150/60">
                                        <div className="flex flex-col">
                                          <span className="font-bold text-slate-850 font-sans text-xs">{item.weight.size}</span>
                                          <span className="text-[10px] text-[#2B6CB0] mt-0.5 font-semibold">
                                            الكمية: {item.cartons} {group.product.accountingUnit || 'كرتونة'}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveWeightQtyFromDraft(item.weight.id)}
                                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer active:scale-90 transition-all shrink-0"
                                          title="حذف"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#2B6CB0] mb-1">أمين المخزن</label>
                    <input
                      type="text"
                      placeholder="اسم أمين المخزن المسؤول"
                      value={warehouseKeeper}
                      onChange={(e) => setWarehouseKeeper(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 font-semibold"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    {!showAdvanceInput ? (
                      <button
                        type="button"
                        onClick={() => setShowAdvanceInput(true)}
                        className="w-full bg-[#F7FAFC] hover:bg-[#F7FAFC] text-[#1A365D] hover:text-[#1A365D] border border-slate-200 rounded-lg p-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[42px] mt-auto"
                      >
                        <Plus className="h-4 w-4 text-indigo-550" />
                        <span>إضافة مقدم بضاعة للمصنع</span>
                      </button>
                    ) : (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-bold text-[#2B6CB0]">المقدم (ج.م)</label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAdvanceInput(false);
                              setAdvanceAmount('');
                            }}
                            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                          >
                            × إلغاء الخصم
                          </button>
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder="0.00"
                          value={advanceAmount}
                          onChange={(e) => setAdvanceAmount(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 font-bold font-mono text-[#1A365D]"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">ملاحظات</label>
                  <input
                    type="text"
                    placeholder="مثال: رقم لوحة السيارة أو ملاحظات عامة"
                    value={loadNotes}
                    onChange={(e) => setLoadNotes(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!loadProductId}
                className="w-full bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent disabled:bg-slate-300 text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Plus className="h-5 w-5" />
                <span>حفظ تحديد حمولة السيارة</span>
              </button>
            </form>

            {/* STATEMENT OF LOADS AS REQUESTED - QUANTITY ONLY */}
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5">
                  <FileText className="h-4.5 w-4.5 text-[#1A365D]" />
                  بيان الكميات المحملة بالسيارة
                </h3>
              </div>
              
              <div className="bg-[#F7FAFC] border border-slate-250/50 p-3 rounded-2xl flex flex-col gap-3">
                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[#2B6CB0]" />
                  فلترة وتحديد فترة عرض الحمولة
                </span>

                {archiveDelegates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-gray-500">المندوب:</label>
                    <select
                      value={liveLoadDelegateFilter}
                      onChange={(e) => setLiveLoadDelegateFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-[#1A365D] focus:outline-none flex-1"
                    >
                      <option value="all">الكل (جميع المناديب)</option>
                      {archiveDelegates.map(del => (
                  <option key={del.phone} value={del.phone}>{del.name} {del.phone !== 'مجهول' && del.phone !== del.name ? `(${del.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-5 bg-[#FFFFFF] border border-slate-205 p-1 rounded-xl text-center gap-1">
                  <button type="button" onClick={() => { setLiveLoadFilter('all'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'all' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>الكل</button>
                  <button type="button" onClick={() => { setLiveLoadFilter('daily'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'daily' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>يومي</button>
                  <button type="button" onClick={() => { setLiveLoadFilter('weekly'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'weekly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>أسبوعي</button>
                  <button type="button" onClick={() => { setLiveLoadFilter('monthly'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'monthly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>شهري</button>
                  <button type="button" onClick={() => { setLiveLoadFilter('custom'); setLiveLoadDayFilters([]); }} className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${liveLoadFilter === 'custom' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'}`}>مخصص</button>
                </div>

                {liveLoadFilter === 'weekly' && (
                  <div className="flex bg-[#FFFFFF] border border-slate-200 rounded-lg overflow-hidden flex-wrap gap-px p-0.5 animate-fade-in" dir="rtl">
                    <button onClick={() => setLiveLoadDayFilters([])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${liveLoadDayFilters.length === 0 ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>الكل</button>
                    {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                       const arabicDays: Record<string, string> = { 'Saturday':'السبت', 'Sunday':'الأحد', 'Monday':'الإثنين', 'Tuesday':'الثلاثاء', 'Wednesday':'الأربعاء', 'Thursday':'الخميس', 'Friday':'الجمعة' };
                       return (
                         <button key={day} onClick={() => setLiveLoadDayFilters(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${liveLoadDayFilters.includes(day) ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>{arabicDays[day]}</button>
                       )
                    })}
                  </div>
                )}

                {liveLoadFilter === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 animate-fade-in">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">من تاريخ</label>
                      <input type="date" value={liveLoadStartDate} onChange={(e) => setLiveLoadStartDate(e.target.value)} className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">إلى تاريخ</label>
                      <input type="date" value={liveLoadEndDate} onChange={(e) => setLiveLoadEndDate(e.target.value)} className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]" />
                    </div>
                  </div>
                )}
              </div>

              {filteredLiveLoads.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-xs">لا توجد تحميلات مسجلة تطابق الفلتر.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="max-h-64 overflow-y-auto custom-scroll border border-slate-100 rounded-xl p-2.5 bg-[#F7FAFC]/50 divide-y divide-slate-150 flex flex-col gap-2.5">
                    {filteredLiveLoads.map((load) => {
                      const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                      const weights = prod ? getProductWeightsFallback(prod) : [];
                      const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
                      const pName = prod ? prod.name : ((load as any).productName || 'الصنف مجهول');
                      const wSize = weight ? weight.size : ((load as any).weightSize || 'وزن غير مسجل');
                      const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                      const loadDateObj = new Date(load.date);
                      const formattedDateStr = loadDateObj.toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) + ` - ` + loadDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div key={load.id} className="pt-2 pb-2 mr-1 flex flex-col gap-1.5 first:pt-0 last:pb-0">
                          {/* Product details in one line */}
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-black text-[#1A365D] text-xs flex-1 leading-relaxed">
                              {pName} ({wSize})
                            </span>
                            <span className="text-xs text-[#DD6B20] font-extrabold shrink-0" dir="rtl">
                              {loadedCartons} {prod?.accountingUnit || 'كرتونة'}
                            </span>
                          </div>

                          {/* Extra info */}
                          <div className="flex justify-between items-center text-[10px]">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 font-bold font-mono">
                                {formattedDateStr}
                              </span>
                              {load.delegateName && (
                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold">
                          المندوب: {load.delegateName.replace(/ \(.*?\)/g, '').trim()} {load.delegatePhone ? `(${load.delegatePhone})` : ''}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteLoad(load.id);
                              }}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer active:scale-90 transition-all font-bold"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions Below the list */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadInvoiceImage}
                      disabled={filteredLiveLoads.length === 0}
                      className="w-full bg-indigo-50 text-[#1A365D] hover:bg-indigo-100 disabled:bg-[#F7FAFC] disabled:text-gray-400 py-3 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-indigo-200/50"
                    >
                      <Image className="h-4 w-4" />
                      <span>تنزيل بيان حمولة اليوم كصورة</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintCurrentLoads}
                      disabled={filteredLiveLoads.length === 0}
                      className="w-full bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:bg-[#F7FAFC] disabled:text-gray-400 py-3 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-rose-200/50"
                    >
                      <Printer className="h-4 w-4" />
                      <span>طباعة مستند الحمولة PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Print-Only Hidden Document Container for factoryLoads */}
            <div id="print-archive-view" className="hidden text-black bg-[#FFFFFF]">
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body * { visibility: hidden !important; }
                  #print-archive-view, #print-archive-view * { visibility: visible !important; }
                  #print-archive-view {
                    position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important;
                    display: block !important; background-color: white !important; color: black !important;
                    direction: rtl !important; padding: 25px !important; margin: 0 !important;
                    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
                  }
                  .no-print { display: none !important; }
                  @page { margin: 1cm; size: A4 portrait; }
                }
              `}} />
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-5">
                <h1 className="text-xl font-bold tracking-tight">شحنات المصنع الحالية</h1>
                <p className="text-xs mt-1 font-bold">للمسحوبات الحالية والدفعات المقدمة</p>
                <div className="flex justify-between text-[11px] mt-4 font-bold mx-auto">
                  <span>تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</span>
                </div>
              </div>

              {filteredLiveLoads.length === 0 ? (
                <p className="text-center py-5">لا توجد شحنات محملة حالياً.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  <table className="w-full text-right text-[11px] border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-[#F7FAFC] border-b border-slate-800">
                        <th className="border border-slate-800 p-2 font-bold text-center">#</th>
                        <th className="border border-slate-800 p-2 font-bold">التاريخ والوقت</th>
                        <th className="border border-slate-800 p-2 font-bold">اسم المنتج وتفاصيله</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الكمية المسحوبة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">سعر الكرتونة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">إجمالي القيمة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الدفعة المقدمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLiveLoads.map((load, index) => {
                        const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                        const weights = prod ? getProductWeightsFallback(prod) : [];
                        const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
                        const pName = prod ? prod.name : ((load as any).productName || 'صنف غير معرف');
                        const wSize = weight ? weight.size : ((load as any).weightSize || 'وزن مجهول');
                        const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
                        const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                        const totalLoadedValue = loadedCartons * cartonPrice;

                        const loadDateObj = new Date(load.date);
                        const formattedDateStr = loadDateObj.toLocaleDateString('ar-EG') + ` • ` + loadDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <tr key={'print_load_' + load.id} className="border-b border-slate-600">
                            <td className="border border-slate-800 p-1.5 text-center">{index + 1}</td>
                            <td className="border border-slate-800 p-1.5">{formattedDateStr}</td>
                            <td className="border border-slate-800 p-1.5 font-bold">
                              <div>{pName} - ({wSize})</div>
                        <div className="text-gray-500 font-normal mt-0.5 text-[10px]">المندوب: {load.delegateName?.replace(/ \(.*?\)/g, '').trim() || 'مجهول'} {load.delegatePhone ? `(${load.delegatePhone})` : ''}</div>
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold" dir="rtl">
                              {loadedCartons} كرتونة
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center">{formatNum(cartonPrice)}ج.م</td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">{formatNum(totalLoadedValue)}ج.م</td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">
                              {load.advanceAmount && load.advanceAmount > 0 ? `${formatNum(load.advanceAmount)}ج.م` : '0'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Cumulative financial block */}
                  <div className="border border-slate-800 p-3 rounded mt-3 text-[11.5px] font-bold bg-[#F7FAFC] flex flex-col gap-2 w-full ml-auto">
                    <div className="flex justify-between">
                      <span>إجمالي عدد شحنات السحب:</span>
                      <span>{filteredLiveLoads.length} شحنة تحميل</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1">
                      <span>إجمالي قيم البضائع المسحوبة من المصنع الحالية:</span>
                      <span className="text-md">
                        {formatNum(filteredLiveLoadsSummary.grandFactoryCost)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-emerald-800">
                      <span>إجمالي الدفعات المقدمة والمباشرة:</span>
                      <span>
                        {formatNum(filteredLiveLoads.reduce((s, l) => s + (l.advanceAmount || 0), 0))}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-rose-800 text-sm">
                      <span>المتبقي للمصنع (المدين الباقي):</span>
                      <span>
                        {formatNum(filteredLiveLoadsSummary.grandFactoryCost - filteredLiveLoads.reduce((s, l) => s + (l.advanceAmount || 0), 0))}ج.م
                      </span>
                    </div>
                  </div>

                  {/* Legal Signatures slot */}
                  <div className="grid grid-cols-3 gap-4 text-center text-[10.5px] font-bold mt-12 pt-5 border-t border-dashed border-slate-400">
                    <div className="flex flex-col gap-8">
                      <span>توقيع أمين مستودع المصنع</span>
                      <span className="text-gray-400">.................................</span>
                    </div>
                    <div className="flex flex-col gap-8">
                      <span>توقيع السائق (المستلم)</span>
                      <span className="text-gray-400">.................................</span>
                    </div>
                    <div className="flex flex-col gap-8">
                      <span>الإدارة المـالية</span>
                      <span className="text-gray-400">.................................</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. سجل الشحنات السابقة */}
        {activeSubTab === 'previous_loads' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex bg-slate-200 p-1.5 rounded-xl border border-slate-300 shadow-inner gap-1 mb-2">
                <button
                  type="button"
                  onClick={() => setArchiveSection('factory')}
                  className={`flex-1 text-center py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                    archiveSection === 'factory' ? 'bg-amber-600 text-white shadow-md' : 'text-[#9CA3AF] hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>أرشيف المصنع</span>
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveSection('trips')}
                  className={`flex-1 text-center py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                    archiveSection === 'trips' ? 'bg-amber-600 text-white shadow-md' : 'text-[#9CA3AF] hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  <span>المشاوير المسددة</span>
                </button>
              </div>

              {/* Timeframe Filters Section */}
              <div className="bg-[#F7FAFC] border border-slate-250/50 p-3 rounded-2xl flex flex-col gap-3">
                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[#2B6CB0]" />
                  فلترة وتحديد فترة الأرشيف للتصفح والطباعة
                </span>

                {archiveDelegates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-gray-500">المندوب:</label>
                    <select
                      value={archiveDelegateFilter}
                      onChange={(e) => setArchiveDelegateFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-[#1A365D] focus:outline-none flex-1"
                    >
                      <option value="all">الكل (جميع المناديب)</option>
                      {archiveDelegates.map(del => (
                  <option key={del.phone} value={del.phone}>{del.name} {del.phone !== 'مجهول' && del.phone !== del.name ? `(${del.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-5 bg-[#FFFFFF] border border-slate-205 p-1 rounded-xl text-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setArchiveFilter('all'); setArchiveDayFilters([]); }}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'all' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => { setArchiveFilter('daily'); setArchiveDayFilters([]); }}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'daily' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    يومي
                  </button>
                  <button
                    type="button"
                    onClick={() => { setArchiveFilter('weekly'); setArchiveDayFilters([]); }}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'weekly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    أسبوعي
                  </button>
                  <button
                    type="button"
                    onClick={() => { setArchiveFilter('monthly'); setArchiveDayFilters([]); }}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'monthly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    شهري
                  </button>
                  <button
                    type="button"
                    onClick={() => { setArchiveFilter('custom'); setArchiveDayFilters([]); }}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'custom' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    مخصص
                  </button>
                </div>

                {archiveFilter === 'weekly' && (
                  <div className="flex bg-[#FFFFFF] border border-slate-200 rounded-lg overflow-hidden flex-wrap gap-px p-0.5 animate-fade-in" dir="rtl">
                    <button onClick={() => setArchiveDayFilters([])} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${archiveDayFilters.length === 0 ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}>الكل</button>
                    {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                       const arabicDays: Record<string, string> = { 'Saturday':'السبت', 'Sunday':'الأحد', 'Monday':'الإثنين', 'Tuesday':'الثلاثاء', 'Wednesday':'الأربعاء', 'Thursday':'الخميس', 'Friday':'الجمعة' };
                       return (
                         <button
                           key={day}
                           onClick={() => setArchiveDayFilters(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                           className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${archiveDayFilters.includes(day) ? 'bg-[#1A365D] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 bg-white'}`}
                         >
                           {arabicDays[day]}
                         </button>
                       )
                    })}
                  </div>
                )}

                {/* Date Inputs if Custom is selected */}
                {archiveFilter === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 animate-fade-in">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">من تاريخ</label>
                      <input
                        type="date"
                        value={archiveStartDate}
                        onChange={(e) => setArchiveStartDate(e.target.value)}
                        className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold mb-0.5">إلى تاريخ</label>
                      <input
                        type="date"
                        value={archiveEndDate}
                        onChange={(e) => setArchiveEndDate(e.target.value)}
                        className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-[#1A365D]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Archived cycles from localStorage (settled zero-balance snapshots) */}
              {archiveSection === 'factory' && archiveCycles.length > 0 && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <span className="text-xs font-black text-indigo-800 flex items-center gap-1.5 border-b border-indigo-100 pb-2">
                    <Archive className="h-4 w-4 text-indigo-500" />
                    الدورات المؤرشفة (تمت تسويتها بالكامل)
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 block">بيانات التحميل والبيع</span>
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
                  {archiveCycles.map(cycle => (
                    <details key={cycle.id} className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                      <summary className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-indigo-100/50 transition-colors select-none">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-indigo-900">دورة مؤرشفة — {cycle.settledAt}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-slate-600">{cycle.loads?.length || 0} حمولة</span>
                          <span className="text-slate-600">{cycle.payments?.length || 0} دفعة</span>
                          {cycle.creditBalance > 0 && <span className="text-amber-600 font-extrabold">رصيد دائن: {formatNum(cycle.creditBalance)} ج.م</span>}
                        </div>
                      </summary>
                      <div className="px-4 pb-4 pt-2 border-t border-indigo-100 flex flex-col gap-3">
                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => downloadArchivedCyclePDF(cycle)}
                            className="bg-[#1A365D] hover:bg-[#2B6CB0] text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Printer className="h-3 w-3" /> PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadArchivedCycleImage(cycle)}
                            className="bg-[#DD6B20] hover:bg-[#C05621] text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Image className="h-3 w-3" /> صورة
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingCycle(cycle); setEditData(JSON.parse(JSON.stringify(cycle))); }}
                            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" /> تعديل
                          </button>
                        </div>
                        {/* Loads in this cycle */}
                        {cycle.loads && cycle.loads.length > 0 && (
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-500 block mb-2">📦 الحمولات</span>
                            <div className="max-h-40 overflow-y-auto custom-scroll border border-slate-200 rounded-lg">
                              <table className="w-full text-[10px] font-bold">
                                <thead className="bg-slate-100 sticky top-0">
                                  <tr>
                                    <th className="p-1.5 text-center w-8">م</th>
                                    <th className="p-1.5 text-right">الصنف</th>
                                    <th className="p-1.5 text-center">الكمية</th>
                                    <th className="p-1.5 text-center">السعر</th>
                                    <th className="p-1.5 text-center">القيمة</th>
                                    <th className="p-1.5 text-center">المقدم</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cycle.loads.map((load: any, i: number) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                      <td className="p-1.5 text-center text-slate-400">{i + 1}</td>
                                      <td className="p-1.5 text-right">{load.productName} ({load.weightSize})</td>
                                      <td className="p-1.5 text-center">{load.cartons} كرتونة{load.loose > 0 ? ` + ${load.loose} وحدة` : ''}</td>
                                      <td className="p-1.5 text-center">{formatNum(load.cartonPrice)} ج.م</td>
                                      <td className="p-1.5 text-center font-extrabold">{formatNum(load.subtotal)} ج.م</td>
                                      <td className="p-1.5 text-center text-amber-700">{formatNum(load.advanceAmount)} ج.م</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {/* Payments in this cycle */}
                        {cycle.payments && cycle.payments.length > 0 && (
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-500 block mb-2">💳 الدفعات المباشرة</span>
                            <div className="max-h-32 overflow-y-auto custom-scroll border border-slate-200 rounded-lg">
                              <table className="w-full text-[10px] font-bold">
                                <thead className="bg-slate-100 sticky top-0">
                                  <tr>
                                    <th className="p-1.5 text-center w-8">م</th>
                                    <th className="p-1.5 text-right">البيان</th>
                                    <th className="p-1.5 text-center">المبلغ</th>
                                    <th className="p-1.5 text-center">المندوب</th>
                                    <th className="p-1.5 text-center">المستلم</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cycle.payments.map((pay: any, i: number) => (
                                    <tr key={pay.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                      <td className="p-1.5 text-center text-slate-400">{i + 1}</td>
                                      <td className="p-1.5 text-right">{pay.notes || 'تسديد مباشر'}</td>
                                      <td className="p-1.5 text-center font-extrabold text-emerald-700">{formatNum(pay.amount)} ج.م</td>
                                      <td className="p-1.5 text-center">{pay.delegateName || '-'}</td>
                                      <td className="p-1.5 text-center">{pay.recipient ? `السيد / ${pay.recipient}` : '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {/* Cycle summary */}
                        <div className="bg-indigo-100/50 rounded-lg p-3 flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-600">مسحوبات خام: {formatNum(cycle.rawLoadedValue || cycle.loads?.reduce?.((s: number, l: any) => s + l.subtotal, 0) || 0)} ج.م</span>
                          <span className="text-emerald-700">مسدد: {formatNum(cycle.totalAdvancePayments)} ج.م</span>
                          {cycle.creditBalance > 0 ? (
                            <span className="text-amber-600">رصيد دائن: {formatNum(cycle.creditBalance)} ج.م</span>
                          ) : (
                            <span className="text-green-700">✅ مصفاة</span>
                          )}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}

              {archiveSection === 'factory' && (
                <>
                {filteredLoads.length > 0 && (
                  <div className="flex gap-2 w-full mt-1 mb-3">
                    <button
                      type="button"
                      onClick={downloadFilteredLoadsPDF}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      <Printer className="h-4 w-4" />
                      <span>تنزيل بيان المبيعات والتحميل المعتمد (PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadFilteredLoadsImage}
                      className="flex-1 text-xs bg-[#FFFFFF] hover:bg-slate-50 text-[#1A365D] py-2 rounded-xl border border-slate-200 cursor-pointer font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="h-4 w-4 text-indigo-600" /> تنزيل صورة الفاتورة المعتمدة
                    </button>
                  </div>
                )}

              {/* Records Loop */}
              <div className="flex flex-col gap-4">
                {filteredLoads.length === 0 ? (
                  <div className="text-center py-10 bg-[#F7FAFC] rounded-2xl border border-dashed border-slate-200">
                    <p className="text-sm text-gray-400 font-bold">لا توجد شحنات تحميل سابقة مطابقة لهذه الفترة.</p>
                    <p className="text-xs text-gray-400 mt-1">جرب تغيير محدد الفترة أو تسجيل شحنات جديدة.</p>
                  </div>
                ) : (
                  [...filteredLoads].map((load) => {
                    const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                    const weights = prod ? getProductWeightsFallback(prod) : [];
                    const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
                    const pName = prod ? prod.name : ((load as any).productName || 'صنف مجهول');
                    const wSize = weight ? weight.size : ((load as any).weightSize || 'حجم مبدئي');
                    const accountingUnitLabel = prod?.accountingUnit || 'كرتونة';

                    const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
                    const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                    const totalLoadedValue = loadedCartons * cartonPrice;

                    // Calculate total quantity sold for this specific product + weight variant in all client invoices
                    let totalUnitsSold = 0;
                    invoices.forEach(inv => {
                      inv.items.forEach(item => {
                        if (item.productId === load.productId && item.weightId === load.weightId) {
                          totalUnitsSold += item.quantity;
                        }
                      });
                    });

                    // Format sold quantity in the configured unit format (cartons)
                    const cartonsSold = Number((totalUnitsSold / (weight?.unitsPerCarton || 12)).toFixed(3));
                    const soldStr = cartonsSold > 0
                      ? `${cartonsSold} ${accountingUnitLabel}`
                      : 'لم يتم بيع شيء بعد';

                    const daysOfWeek = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
                    const loadDateObj = new Date(load.date);
                    const dayName = daysOfWeek[loadDateObj.getDay()];
                    const formattedDate = loadDateObj.toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                    const formattedTime = loadDateObj.toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div key={'prev_load_' + load.id} className="bg-[#F7FAFC] hover:bg-[#F7FAFC]/50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm transition-all md:p-5">
                        {/* Day and Date header */}
                        <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                          <span className="text-[11px] font-black text-indigo-950 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full"></span>
                            {dayName}، {formattedDate} • {formattedTime}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteLoad(load.id);
                            }}
                            title="حذف الشحنة من الأرشيف"
                            className="bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer border border-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Product info description */}
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="block font-black text-[#1A365D] text-sm">{pName}</span>
                            <span className="block text-[11px] text-[#2B6CB0] font-bold mt-0.5">الوزن / الحجم: {wSize}</span>
                            {load.delegateName && (
                              <span className="inline-block text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold mt-1 border border-indigo-100">
                          المندوب: {load.delegateName.replace(/ \(.*?\)/g, '').trim()} {load.delegatePhone ? `(${load.delegatePhone})` : ''}
                              </span>
                            )}
                          </div>
                          <span className="text-xs bg-indigo-100/60 text-indigo-950 px-2.5 py-1 rounded-md font-extrabold border border-indigo-200/55 font-mono">
                            سعر المصنع للكرتونة: {cartonPrice}ج.م
                          </span>
                        </div>

                        {/* Cargo analysis matrix: Drawn, Sold, Paid */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mt-1 border-t border-slate-100 pt-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[#2B6CB0] font-bold">الكمية المحملة</span>
                            <span className="text-sm font-black text-[#1A365D]">{loadedCartons} {accountingUnitLabel}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-[#2B6CB0] font-bold">إجمالي السعر</span>
                            <span className="text-sm font-black text-[#1A365D]">{totalLoadedValue.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-[#2B6CB0] font-bold">المسدد (مقدم)</span>
                            <span className="text-sm font-black text-[#DD6B20]">{(load.advanceAmount || 0).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                          </div>
                        </div>
                      </div>
                    );
                  }                  )
                )}

                {filteredArchiveExtraPayments.length > 0 && (
                  <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <span className="text-xs font-black text-[#1A365D] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <History className="h-4 w-4 text-emerald-500" />
                      أرشيف الدفعات النقدية والمسددات المباشرة للمورد
                    </span>
                    <div className="max-h-40 overflow-y-auto custom-scroll flex flex-col gap-2">
                      {filteredArchiveExtraPayments.map(pay => (
                        <div key={pay.id} className="bg-[#F7FAFC] border border-slate-100 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-[#1A365D] shadow-inner">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[#DD6B20] font-extrabold">{Number(pay.amount).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                            <span className="text-[10px] text-[#2B6CB0] font-medium">{pay.date}</span>
                            <span className="text-[9.5px] text-slate-600 leading-relaxed">📝 {pay.notes || 'تسديد مباشر'}{pay.delegateName ? ` • 👤 ${pay.delegateName}` : ''}</span>
                            {pay.recipient ? <span className="text-[9px] text-indigo-600">👤 مستلم: السيد / {pay.recipient}</span> : null}
                            {(pay.appliedToCarriedDebt || 0) > 0 && <span className="text-[9px] text-amber-600">🔄 مسدد من المديونية السابقة: {Number(pay.appliedToCarriedDebt).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Invoice-like summary for Factory Archive */}
                {filteredLoads.length > 0 && (
                  <div className="mt-4 bg-[#1A365D] text-white border-transparent text-white p-5 rounded-2xl flex flex-col gap-3 shadow-md">
                    <h3 className="text-center font-bold text-sm border-b border-slate-700 pb-2 mb-1">ملخص حساب الأرشيف المفلتر</h3>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">إجمالي قيمة المحمل:</span>
                      <span className="font-bold font-mono">{filteredLoads.reduce((sum, l) => {
                          const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                          const weights = prod ? getProductWeightsFallback(prod) : [];
                          const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim()) || weights[0];
                          const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
                          const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                          return sum + (loadedCartons * cartonPrice);
                        }, 0).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">المسدد المباشر للمورد:</span>
                      <span className="font-bold font-mono text-emerald-400">{filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
                      <span className="text-slate-300">إجمالي المسدد (مقدم + مباشر):</span>
                      <span className="font-bold font-mono text-emerald-400">{(filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0) + filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0)).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-black text-slate-100">المتبقي للمصنع:</span>
                      <span className="text-lg font-black font-mono text-amber-400">{Math.max(0, filteredLoads.reduce((sum, l) => {
                        const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                        const weights = prod ? getProductWeightsFallback(prod) : [];
                        const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim()) || weights[0];
                        const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
                        const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                        return sum + (loadedCartons * cartonPrice);
                      }, 0) - filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0) - filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0)).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}

            {archiveSection === 'trips' && (
              <div className="flex flex-col gap-3 mt-2">
                {filteredArchiveTrips.length > 0 && (
                  <div className="flex gap-2 w-full">
                    <button type="button" onClick={downloadCollectedTripsPDF} className="flex-1 bg-[#1A365D] hover:bg-[#2B6CB0] text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer">
                      <Printer className="h-4 w-4" /> تنزيل المشاوير المحصلة (PDF)
                    </button>
                    <button type="button" onClick={downloadCollectedTripsImage} className="flex-1 bg-[#DD6B20] hover:bg-[#C05621] text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer">
                      <Download className="h-4 w-4" /> تنزيل صورة المشاوير المحصلة
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto">
                  {filteredArchiveTrips.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-xs font-bold">لا يوجد مشاوير مسددة (محصلة) مطابقة لهذه الفترة.</p>
                  ) : (
                    [...filteredArchiveTrips].reverse().map(trip => (
                      <div key={trip.id} className="border rounded-xl p-3.5 flex flex-col gap-3 text-xs shadow-xs transition-all bg-emerald-50/40 border-emerald-100">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-[#1A365D] text-sm">{trip.description}</span>
                              <span className="text-[10px] bg-[#F7FAFC] border border-slate-200 text-[#2B6CB0] font-bold font-mono p-0.5 px-1.5 rounded">{trip.date}</span>
                            </div>
                            <span className="font-mono text-[#1A365D] font-bold block mt-0.5">السعر المسدد: {trip.price}ج.م</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-[#DD6B20]" />
                            <span className="text-emerald-800 font-bold">مسددة</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            </div>

            {/* Print-Only Hidden Document Container */}
            <div id="print-previous-archive-view" className="hidden text-black bg-[#FFFFFF]">
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body * { visibility: hidden !important; }
                  #print-previous-archive-view, #print-previous-archive-view * { visibility: visible !important; }
                  #print-previous-archive-view {
                    position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important;
                    display: block !important; background-color: white !important; color: black !important;
                    direction: rtl !important; padding: 25px !important; margin: 0 !important;
                    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
                  }
                  .no-print { display: none !important; }
                  @page { margin: 1cm; size: A4 portrait; }
                }
              `}} />
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-5">
                <h1 className="text-xl font-bold tracking-tight">سجل الشحنات</h1>
                <div className="flex justify-between text-[11px] mt-4 font-bold max-w-md mx-auto">
                  <span>
                    الفترة المحددة للكشف: {
                      archiveFilter === 'all' ? 'كافة الشحنات التاريخية' :
                      archiveFilter === 'daily' ? 'حركة اليوم الحالي' :
                      archiveFilter === 'weekly' ? 'الأسبوع الأخير' :
                      archiveFilter === 'monthly' ? 'الشهر الأخير' :
                      `مخصص من ${archiveStartDate || 'مفتوح'} إلى ${archiveEndDate || 'مفتوح'}`
                    }
                  </span>
                  <span>تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</span>
                </div>
              </div>

              {filteredLoads.length === 0 ? (
                <p className="text-center py-5">لا توجد شحنات مطابقة للفترة المحددة في هذا التقرير.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  <table className="w-full text-right text-[11px] border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-[#F7FAFC] border-b border-slate-800">
                        <th className="border border-slate-800 p-2 font-bold text-center">#</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">التاريخ واليوم</th>
                        <th className="border border-slate-800 p-2 font-bold">اسم المنتج وتفاصيله</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الكمية المسحوبة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">سعر الكرتونة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الإجمالي</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">المباع بالسيارة</th>
                        <th className="border border-slate-800 p-2 font-bold text-center">الدفعة المقدمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLoads.map((load, index) => {
                        const prod = products.find(p => String(p.id).trim() === String(load.productId).trim());
                        const weights = prod ? getProductWeightsFallback(prod) : [];
                        const weight = weights.find(w => String(w.id).trim() === String(load.weightId).trim()) || weights[0];
                        const pName = prod ? prod.name : ((load as any).productName || 'مجهول');
                        const wSize = weight ? weight.size : ((load as any).weightSize || '');
                        const cartonPrice = load.cartonPrice !== undefined ? Number(load.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
                        const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                        const totalLoadedValue = loadedCartons * cartonPrice;

                        // Quantity sold
                        let totalUnitsSold = 0;
                        invoices.forEach(inv => {
                          inv.items.forEach(item => {
                            if (item.productId === load.productId && item.weightId === load.weightId) {
                              totalUnitsSold += item.quantity;
                            }
                          });
                        });
                        const cartonsSold = Number((totalUnitsSold / (weight?.unitsPerCarton || 12)).toFixed(3));

                        const loadDateObj = new Date(load.date);
                        const formattedDateStr = loadDateObj.toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric'
                        }) + ` • ` + loadDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <tr key={'print_prev_load_' + load.id} className="border-b border-slate-600">
                            <td className="border border-slate-800 p-1.5 text-center">{index + 1}</td>
                            <td className="border border-slate-800 p-1.5 text-center" dir="rtl">{formattedDateStr}</td>
                            <td className="border border-slate-800 p-1.5">
                              <div>{pName} <span className="text-[9px] text-[#2B6CB0]">({wSize})</span></div>
                        <div className="text-gray-500 text-[10px] mt-0.5">المندوب: {load.delegateName?.replace(/ \(.*?\)/g, '').trim() || 'مجهول'} {load.delegatePhone ? `(${load.delegatePhone})` : ''}</div>
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">
                              {loadedCartons}
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center">{cartonPrice.toFixed(2)}ج.م</td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">{(totalLoadedValue).toFixed(2)}ج.م</td>
                            <td className="border border-slate-800 p-1.5 text-center">
                              {cartonsSold}
                            </td>
                            <td className="border border-slate-800 p-1.5 text-center font-bold">
                              {load.advanceAmount && load.advanceAmount > 0 ? `${load.advanceAmount.toFixed(2)}ج.م` : '0.00'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {/* Cumulative block for print */}
                  <div className="border border-slate-800 p-3 rounded mt-3 text-[11.5px] font-bold bg-[#F7FAFC] flex flex-col gap-2 w-full ml-auto">
                    <div className="flex justify-between">
                      <span>إجمالي عدد شحنات السحب المفلترة:</span>
                      <span>{filteredLoads.length} شحنة تحميل</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1">
                      <span>استحقاق البضائع المسحوبة من المصنع المفلترة (المدين):</span>
                      <span className="text-md">
                        {filteredLoads.reduce((sum, l) => {
                          const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                          const weights = prod ? getProductWeightsFallback(prod) : [];
                          const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim()) || weights[0];
                          const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
                          const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                          return sum + (loadedCartons * cartonPrice);
                        }, 0).toFixed(2)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-emerald-800">
                      <span>إجمالي الدفعات المقدمة والمباشرة المفلترة:</span>
                      <span>
                        {(filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0) + filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0)).toFixed(2)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-rose-800 text-sm">
                       <span>المتبقي للمصنع (المبلغ المدين الباقي):</span>
                       <span>
                          {(() => {
                            const totalLoadVal = filteredLoads.reduce((sum, l) => {
                              const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                              const weights = prod ? getProductWeightsFallback(prod) : [];
                              const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim()) || weights[0];
                              const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * (weight?.unitsPerCarton || 12) : 0) || 0);
                              const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                              return sum + (loadedCartons * cartonPrice);
                            }, 0);
                            const totalAdvance = filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0);
                            const totalDirect = filteredArchiveExtraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);
                            const remaining = totalLoadVal - totalAdvance - totalDirect;
                            return remaining > 0 ? remaining.toFixed(2) : '0.00';
                          })()}ج.م
                       </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        )}

        {/* 2.5 سجل المشاوير */}
        {activeSubTab === 'trips' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1A365D] text-white border-transparent text-white p-3 rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] text-indigo-100 font-bold">إجمالي المشاوير</span>
                <span className="text-sm font-black mt-2 font-mono">{(trips?.reduce((sum, t) => sum + t.price, 0) || 0).toFixed(1)}ج.م</span>
              </div>
              <div className="bg-[#DD6B20] text-white text-white p-3 rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] text-emerald-100 font-bold">المحصل</span>
                <span className="text-sm font-black mt-2 font-mono">{(trips?.filter(t => t.collected).reduce((sum, t) => sum + t.price, 0) || 0).toFixed(1)}ج.م</span>
              </div>
              <div className="bg-amber-600 text-white p-3 rounded-2xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] text-amber-100 font-bold">المتبقي</span>
                <span className="text-sm font-black mt-2 font-mono">{((trips?.reduce((sum, t) => sum + t.price, 0) || 0) - (trips?.filter(t => t.collected).reduce((sum, t) => sum + t.price, 0) || 0)).toFixed(1)}ج.م</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsedPrice = tripPrice ? parseFloat(tripPrice) : 0;
                if (!tripDescription.trim()) return showToast('⚠️ يرجى إدخال وصف المشوار!');
                if (tripPrice && (isNaN(parsedPrice) || parsedPrice < 0)) return showToast('⚠️ يرجى إدخال سعر صحيح للمشوار!');
                const selectedTripDel = isManager && tripDelegatePhone
                  ? archiveDelegates.find(d => d.phone === tripDelegatePhone)
                  : null;
                onAddTrip({
                  description: tripDescription.trim(),
                  price: parsedPrice,
                  date: tripDate,
                  collected: false,
                  delegateName: selectedTripDel?.name || currentUser?.name || '',
                  delegatePhone: selectedTripDel?.phone || currentUser?.phone || ''
                });
                setTripDescription('');
                setTripPrice('');
                if (isManager) setTripDelegatePhone('');
                showToast('✓ تم تسجيل المشوار بنجاح!');
              }}
              className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3.5"
            >
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1 bg-[#F7FAFC] px-2 py-1.5 rounded-lg border border-slate-250 w-max">
                <Plus className="h-4 w-4" />
                تسجيل مشوار
              </span>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#1A365D] mb-1">وصف أو جهة المشوار</label>
                  <input type="text" required placeholder="مثال: دمياط، بلقاس، توصيل طلبية خاصة" value={tripDescription} onChange={(e) => setTripDescription(e.target.value)} className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-[#1A365D]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#DD6B20] mb-1">سعر المشوار</label>
                    <input type="number" min="0" placeholder="يمكن تركه فارغاً" value={tripPrice} onChange={(e) => setTripPrice(e.target.value)} className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-center text-[#1A365D] font-mono" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-700 mb-1">التاريخ</label>
                    <input type="date" required value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-center text-[#1A365D]" />
                  </div>
                </div>
                {isManager && (
                  <div>
                    <label className="block text-[11px] font-bold text-violet-700 mb-1">المندوب</label>
                    <select
                      value={tripDelegatePhone}
                      onChange={(e) => setTripDelegatePhone(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-[#1A365D]"
                    >
                      <option value="">-- اختر المندوب --</option>
                      {archiveDelegates.filter(d => d.phone !== 'مجهول').map(d => (
                        <option key={d.phone} value={d.phone}>{d.name} ({d.phone})</option>
                      ))}
                    </select>
                  </div>
                )}
                <button type="submit" className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer">
                  تسجيل المشوار بالسيستم
                </button>
              </div>
            </form>

            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <MapPin className="h-4.5 w-4.5 text-[#2B6CB0]" />
                    المشاوير المعلقة (غير محصلة)
                  </span>
                </div>
                <div className="flex gap-2">
                  {trips && trips.filter(t => !t.collected).length > 0 && (
                    <>
                      <button type="button" onClick={downloadPendingTripsPDF} className="text-[10px] bg-[#1A365D] hover:bg-[#2B6CB0] text-white px-2 py-1.5 rounded-lg cursor-pointer font-bold flex items-center gap-1 transition-colors">
                        <Printer className="h-3 w-3" /> PDF
                      </button>
                      <button type="button" onClick={downloadPendingTripsImage} className="text-[10px] bg-[#DD6B20] hover:bg-[#C05621] text-white px-2 py-1.5 rounded-lg cursor-pointer font-bold flex items-center gap-1 transition-colors">
                        <Download className="h-3 w-3" /> صورة
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto">
                {(!trips || trips.filter(t => !t.collected).length === 0) ? (
                  <p className="text-center text-gray-400 py-8 text-xs font-bold">لا يوجد مشاوير معلقة مسجلة.</p>
                ) : (
                  [...trips].filter(t => !t.collected).reverse().map((trip) => (
                    <div key={trip.id} className="border rounded-xl p-3.5 flex flex-col gap-3 text-xs shadow-xs transition-all bg-amber-50/20 border-amber-100">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#1A365D] text-sm">{trip.description}</span>
                            <span className="text-[10px] bg-[#F7FAFC] border border-slate-200 text-[#2B6CB0] font-bold font-mono p-0.5 px-1.5 rounded">{trip.date}</span>
                          </div>
                          {trip.price > 0 ? (
                            <span className="font-mono text-[#1A365D] font-bold block mt-0.5">السعر: {trip.price}ج.م</span>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-rose-500 font-bold">لم يتم تسعير المشوار بعد</span>
                              <button type="button" onClick={() => {
                                const newPriceStr = prompt('أدخل قيمة هذا المشوار (ج.م):');
                                if (newPriceStr) {
                                  const pr = parseFloat(newPriceStr);
                                  if (!isNaN(pr) && pr > 0) onEditTrip(trip.id, { price: pr });
                                }
                              }} className="bg-indigo-50 text-[#1A365D] px-2 py-1 rounded text-[10px] font-bold border border-indigo-200 cursor-pointer">إضافة القيمة</button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-start gap-1.5 shrink-0 h-full pt-1">
                          {trip.price > 0 && (
                            <button type="button" onClick={() => onToggleTripCollected(trip.id)} className="bg-[#1A365D] text-white border-transparent text-white hover:bg-[#1A365D] text-white border-transparent shadow-xs px-3 py-1.5 rounded-lg text-[10.5px] font-black cursor-pointer flex items-center gap-1">
                              <span>تسجيل تم تحصيل</span>
                            </button>
                          )}
                          <button type="button" onClick={() => { onDeleteTrip(trip.id); }} className="p-1.5 text-gray-400 hover:text-[#DD6B20] hover:bg-rose-50 rounded-lg cursor-pointer border border-transparent hover:border-rose-100">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Odometer Section inside Trip */}
                      <div className="border-t border-slate-200/60 pt-2 flex items-center justify-between gap-2 mt-1">
                        <div className="flex gap-2">
                          {trip.odometerStart ? (
                            <span className="text-[10px] font-bold text-[#2B6CB0] bg-[#FFFFFF] px-2 py-1 rounded border border-slate-200">
                              بداية العداد: <span className="font-mono text-[#1A365D]">{trip.odometerStart}</span>
                            </span>
                          ) : (
                            <button type="button" onClick={() => {
                              const odo = prompt('أدخل قراءة العداد الحالية لبدء الرحلة:');
                              if (odo && !isNaN(parseFloat(odo))) onEditTrip(trip.id, { odometerStart: parseFloat(odo) });
                            }} className="text-[10px] font-bold text-[#2B6CB0] bg-[#F7FAFC] hover:bg-slate-200 px-2 py-1 border border-slate-300 rounded cursor-pointer transition-colors flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> بدأ الرحلة (العداد)
                            </button>
                          )}
                          
                          {trip.odometerStart && !trip.odometerEnd && (
                            <button type="button" onClick={() => {
                              const odo = prompt('أدخل قراءة العداد الحالية لإنهاء الرحلة والتسعير المبدئي:');
                              if (odo && !isNaN(parseFloat(odo))) {
                                const endOdo = parseFloat(odo);
                                if (endOdo >= trip.odometerStart!) {
                                  onEditTrip(trip.id, { odometerEnd: endOdo });
                                } else {
                                  showToast('⚠️ قراءة النهاية يجب أن تكون أكبر من البداية!');
                                }
                              }
                            }} className="text-[10px] font-bold text-[#1A365D] bg-indigo-50 hover:bg-indigo-100 px-2 py-1 border border-indigo-200 rounded cursor-pointer transition-colors flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> إنهاء الرحلة
                            </button>
                          )}

                          {trip.odometerStart && trip.odometerEnd && (
                            <span className="text-[10px] font-bold text-[#2B6CB0] bg-[#FFFFFF] px-2 py-1 rounded border border-slate-200">
                              نهاية العداد: <span className="font-mono text-[#1A365D]">{trip.odometerEnd}</span>
                            </span>
                          )}
                        </div>
                        
                        {trip.odometerStart && trip.odometerEnd && (
                          <div className="bg-amber-100/50 border border-amber-200 text-[#1A365D] px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide">
                            المسافة: <span className="font-mono">{trip.odometerEnd - trip.odometerStart}</span> كم
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3/3. المنتجات (إضافة وتعديل المنتجات) */}
        {activeSubTab === 'products' && (
          <div className="flex flex-col gap-5">
            {/* Elegant Add Product Button */}
            {!isAddingProduct && !editingProdId && canEditPrices && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProduct(true);
                    // Reset states for a fresh add
                    setProdName('');
                    setAccountingUnit('كرتونة');
                    setProdPrice('0');
                    setProdMinAlert('20');
                    setProdWeights([]);
                  }}
                  className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent active:scale-95 text-white font-bold py-3.5 px-5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <Plus className="h-5 w-5 text-emerald-300" />
                  <span>اضافة منتج جديد</span>
                </button>
                {onDeleteAllProducts && (
                  <button
                    type="button"
                    onClick={async () => { if (await confirmDialog("هل أنت متأكد من تفريغ كافة المنتجات؟ سيتم مسح قائمة المنتجات بالكامل.")) {
                        onDeleteAllProducts();
                        showToast("✓ تم تفريغ قائمة المنتجات بنجاح!");
                      }
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3.5 px-5 rounded-2xl border border-rose-200 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-sm font-sans"
                  >
                    <Trash2 className="h-5 w-5 text-rose-500 animate-pulse" />
                    <span>تفريغ المنتجات</span>
                  </button>
                )}
              </div>
            )}

            {/* Create / Edit Product Form (shows on toggle or edit) */}
            {(isAddingProduct || editingProdId) && (
              <form onSubmit={handleCreateProduct} className="bg-[#FFFFFF] p-5 rounded-2xl border-2 border-indigo-100 shadow-md flex flex-col gap-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                  <h3 className="font-bold text-indigo-950 text-base flex items-center gap-1.5">
                    <PackagePlus className="h-5 w-5 text-[#1A365D]" />
                    {editingProdId ? 'تعديل بيانات الصنف وحساباته' : 'تسجيل منتج جديد'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingProduct(false);
                      setEditingProdId(null);
                    }}
                    className="text-gray-400 hover:text-[#2B6CB0] text-xs font-bold bg-[#F7FAFC] p-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  <div>
                    <label className="inline-block bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">المنتج</label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="مثال: زيت طعام عافية"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-[#cfd3d9] rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-[#1A365D]"
                    />
                  </div>

                  {/* Accounting Unit Option as requested */}
                  <div>
                    <label className="inline-block bg-amber-100 text-amber-950 border border-amber-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">الوحدة</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: كرتونة، صندوق، رابطة..."
                      value={accountingUnit}
                      onChange={(e) => setAccountingUnit(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-[#cfd3d9] rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-[#1A365D]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="inline-block bg-sky-100 text-sky-950 border border-sky-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">تنبيه المخزون</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="مثال: 20"
                        value={prodMinAlert}
                        onChange={(e) => setProdMinAlert(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-[#cfd3d9] rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-[#1A365D] text-center"
                      />
                    </div>
                  </div>

                  {/* Sub-table Weights Configuration matching perfectly the manual pricing, factory cost, and margins */}
                  <div className="border border-indigo-100 rounded-xl p-3.5 bg-indigo-50/30 flex flex-col gap-3">
                    <span className="text-xs font-extrabold text-emerald-950 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg flex items-center gap-1.5 self-start shadow-sm">
                      <Scale className="h-4 w-4 text-[#DD6B20]" />
                      المنتج
                    </span>

                    <div className="bg-[#FFFFFF] p-3 rounded-lg border border-slate-150 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="col-span-2">
                        <label className="inline-block bg-[#d5f7f0] text-[#1A365D] border border-slate-200 text-[10px] font-black px-1.5 py-0.5 rounded mb-1">الحجم</label>
                        <input
                          type="text"
                          placeholder="مثال: 1 لتر، 750 مل..."
                          value={weightSize}
                          onChange={(e) => setWeightSize(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-md p-1.5 text-xs text-[#1A365D] font-bold"
                        />
                      </div>

                      <div>
                        <label className="inline-block bg-[#d5f7f0] text-[#1A365D] border border-slate-200 text-[10px] font-black px-1.5 py-0.5 rounded mb-1">سعر الكرتونة</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="مثال: 1000"
                          value={weightCartonPrice}
                          onChange={(e) => setWeightCartonPrice(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-md p-1.5 text-xs text-[#1A365D] text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="inline-block bg-[#d5f7f0] text-[#1A365D] border border-[#edf0e2] text-[10px] font-black px-1.5 py-0.5 rounded mb-1">العدد</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="12"
                          value={weightUnitsPerCarton}
                          onChange={(e) => setWeightUnitsPerCarton(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-md p-1.5 text-xs text-[#1A365D] text-center font-bold"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="inline-block bg-[#fce4e4] text-[#1A365D] border border-rose-200 text-[10px] font-black px-1.5 py-0.5 rounded mb-1 flex items-center gap-1 w-max"><ScanLine className="h-3 w-3"/> الباركود (اختياري)</label>
                        <input
                          type="text"
                          placeholder="امسح او اكتب الباركود..."
                          value={weightBarcode}
                          onChange={(e) => setWeightBarcode(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-md p-1.5 text-xs text-[#1A365D] font-mono font-bold text-left"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddWeightToList}
                        className={`col-span-2 sm:col-span-4 bg-[#1b090f] hover:bg-opacity-80 text-white font-bold py-1.5 px-3 rounded-md text-xs border border-indigo-200 active:scale-95 transition-all text-center flex items-center justify-center gap-1 cursor-pointer mt-1`}
                      >
                        <Plus className="h-4 w-4" />
                        {editingWeightId ? 'تحديث الصنف' : 'إضافة'}
                      </button>
                    </div>

                    {/* Registered weights list table */}
                    <div className="flex flex-col gap-1.5 mt-2">
                      <span className="text-[11px] font-bold text-gray-400">قائمة الأصناف الفرعية (الأوزان / المقاسات / السعات):</span>
                      {prodWeights.length === 0 ? (
                        <p className="text-center text-gray-400 py-3 text-[10px] bg-[#F7FAFC] rounded border border-slate-200 border-dashed">لم تقم بإضافة أي عبوة فرعية لهذا المنتج بعد.</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {prodWeights.map((w, index) => (
                            <div key={w.id || index} className="bg-white border border-slate-200 p-2 rounded-lg flex items-center justify-between text-xs">
                              <div className="flex flex-col">
                                <span className="font-bold text-[#1A365D]">{w.size}</span>
                                <span className="text-[10px] text-gray-500 font-medium">سعر الكرتونة من المصنع: {w.cartonPriceFromFactory}ج.م • العدد بالكرتونة: {w.unitsPerCarton}</span>
                                {w.barcode && (
                                  <span className="text-[9px] text-emerald-600 font-mono font-bold mt-0.5">باركود: {w.barcode}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditWeightInList(w.id || '')}
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveWeightFromList(w.id || '')}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save button for the product form */}
                  <button
                    type="submit"
                    className="w-full bg-[#1A365D] text-white border-transparent hover:bg-indigo-900 font-bold py-3 px-4 rounded-xl text-xs cursor-pointer transition-all active:scale-95 text-center flex items-center justify-center gap-1.5 shadow-md mt-2"
                  >
                    <Save className="h-4 w-4 text-emerald-300" />
                    <span>حفظ بيانات المنتج والتسعير</span>
                  </button>
                </div>
              </form>
            )}

            {/* List existing products (المنتجات الحالية) */}
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <PackagePlus className="h-4.5 w-4.5 text-[#2B6CB0]" />
                قائمة المنتجات وجدول التسعير المسجلة بالمصنع
              </span>

              <div className="flex flex-col gap-3.5">
                {products.length === 0 ? (
                  <p className="text-center text-gray-400 py-6 text-xs">لم تقم بإضافة منتجات بعد.</p>
                ) : (
                  products.map((p) => {
                    const ws = getProductWeightsFallback(p);
                    const labelUnit = p.accountingUnit || 'كرتونة';
                    return (
                      <div key={p.id} className="bg-[#F7FAFC] border border-slate-200 rounded-xl p-3 flex flex-col gap-2 shadow-xs">
                        <div className="flex justify-between items-start gap-2 border-[3px] rounded-[3px] border-[#a3c2eb]">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-[#1A365D] text-sm">{p.name}</span>
                            <span className="text-[10px] text-gray-400 font-bold">طريقة المحاسبة: {labelUnit}</span>
                          </div>

                          {canEditPrices && (
                            <div className="flex items-center gap-1.5 self-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProdId(p.id);
                                  setProdName(p.name);
                                  setAccountingUnit(p.accountingUnit || 'كرتونة');
                                  setProdMinAlert(p.minStockAlert ? p.minStockAlert.toString() : '20');
                                  setProdWeights(ws);
                                  setIsAddingProduct(false);
                                }}
                                className="p-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-[#1A365D] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="تعديل هذا المنتج"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteProduct(p.id);
                                }}
                                className="p-1 px-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* List nested weights of this category */}
                        <div className="bg-[#FFFFFF] rounded-lg border border-slate-100 p-2 text-xs flex flex-col gap-1.5 divide-y divide-slate-100">
                          {ws.map((w, index) => {
                            const retailPrice = w.cartonPriceFromFactory + (w.addedValue || 0);
                            return (
                              <div key={w.id || index} className="pt-1.5 first:pt-0 flex flex-wrap justify-between items-center text-[11px] text-[#2B6CB0] font-medium border-b-0 pb-1 mb-1 border-b border-b-slate-100/50 gap-2">
                                <span>الوزن/الحجم: <strong className="text-slate-850 font-bold">{w.size}</strong></span>
                                <span>سعر المصنع للـ {labelUnit}: <strong className="text-blue-750 font-bold">{w.cartonPriceFromFactory}ج.م</strong></span>
                                <span>قيمة مضافة: <strong className="text-orange-700 font-bold">{w.addedValue || 0}ج.م</strong></span>
                                <span>التجزئة (التسليم): <strong className="text-emerald-700 font-bold">{retailPrice}ج.م</strong></span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. الحساب المالي للمصنع */}
        {activeSubTab === 'factory_account' && (
          <div className="flex flex-col gap-5 animate-fade-in" id="factory-account-tab">
            
            <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-black text-[#1A365D] flex items-center gap-1.5">
                  <FileText className="h-4.5 w-4.5 text-[#2B6CB0]" />
                  كشف الحساب والمديونية المفتوحة للمصنع
                </span>
                <span className="text-[10px] text-gray-400 font-bold">مراجعة ميزان المسحوبات والمقدمات الحالية للموردين</span>
              </div>
              <button
                type="button"
                onClick={exportFactoryLedgerAsPDF}
                className="bg-[#1A365D] hover:bg-[#2B6CB0] text-white font-extrabold text-[#ffffff] text-xs py-2 px-3.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 border-0"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة كشف ميزانية المصنع (PDF)</span>
              </button>
            </div>

            {isManager && (
              <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2">
                <span className="text-xs font-black text-[#1A365D]">تصفية حساب المصنع حسب المندوب:</span>
                <select
                  value={factoryDelegateFilter}
                  onChange={(e) => setFactoryDelegateFilter(e.target.value)}
                  className="bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D]"
                >
                  <option value="all">كل المناديب (تجميعي)</option>
                  {archiveDelegates.map(d => (
                    <option key={d.phone || d.name} value={d.phone !== 'مجهول' ? d.phone : d.name}>
                      {d.name} {d.phone !== 'مجهول' ? `(${d.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Top Grid of Balance sheet */}
            <div className="grid grid-cols-3 gap-2 font-sans">
              <div className="bg-[#1A365D] text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                <span className="text-[10px] text-indigo-205 font-bold">حساب المصنع</span>
                <span className="text-sm font-black mt-2 font-mono">
                  {formatNum(factoryBalanceDetails.totalWithdrawnValue)} <span className="text-[10px]">ج.م</span>
                </span>
              </div>
              <div className="bg-[#10B981] text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                <span className="text-[10px] text-emerald-100 font-bold">المسدد للمصنع</span>
                <span className="text-sm font-black mt-2 font-mono">
                  {formatNum(factoryBalanceDetails.totalAdvancePayments)} <span className="text-[10px]">ج.م</span>
                </span>
              </div>
              {factoryBalanceDetails.netRemainingDueToFactory > 0 ? (
                <div className="bg-rose-600 text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-rose-100 font-bold">المتبقي للمصنع</span>
                  <span className="text-sm font-black mt-2 font-mono">
                    {formatNum(factoryBalanceDetails.netRemainingDueToFactory)} <span className="text-[10px]">ج.م</span>
                  </span>
                </div>
              ) : factoryBalanceDetails.netRemainingDueToFactory === 0 ? (
                <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-emerald-100 font-bold">المتبقي للمصنع</span>
                  <span className="text-sm font-black mt-2 font-mono">
                    مسوى <span className="text-[10px]">✔️</span>
                  </span>
                </div>
              ) : (
                <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] text-indigo-100 font-bold">رصيد دائن لصالح المصنع</span>
                  <span className="text-sm font-black mt-2 font-mono">
                    {formatNum(Math.abs(factoryBalanceDetails.netRemainingDueToFactory))} <span className="text-[10px]">ج.م</span>
                  </span>
                </div>
              )}
            </div>

            {/* Direct Multi-Panel configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Panel A: تسجيل دفعة سداد للمصنع */}
              <div className="bg-[#FFFFFF] p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <span className="text-xs font-black text-[#1A365D] flex items-center gap-1 bg-[#F7FAFC] px-2 py-1.5 rounded-lg border border-slate-200 w-max">
                  <Wallet className="h-4 w-4 text-[#DD6B20]" />
                  تسجيل دفعة مسددة للمورد
                </span>

                <div className="flex flex-col gap-3 mt-1.5">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="مبلغ السداد (ج.م)"
                      value={newPaymentAmount}
                      onChange={(e) => setNewPaymentAmount(e.target.value)}
                      className="w-1/2 bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-bold text-center text-[#1A365D]"
                    />
                    <input
                      type="text"
                      placeholder="البيان (مثال: شيك، نقدي مندوب)"
                      value={newPaymentNotes}
                      onChange={(e) => setNewPaymentNotes(e.target.value)}
                      className="w-1/2 bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D] flex items-center gap-1">
                      <span className="text-slate-500 shrink-0">السيد /</span>
                      <input
                        type="text"
                        placeholder="مستلم السداد"
                        value={newPaymentRecipient}
                        onChange={(e) => setNewPaymentRecipient(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-xs font-bold text-[#1A365D]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const amount = parseFloat(newPaymentAmount);
                      if (!amount || amount <= 0) {
                        showToast("⚠️ يرجى إدخال قيمة صحيحة للدفعة المالية!");
                        return;
                      }
                      
                      let appliedToCarriedDebt = 0;
                      let newCarried = carriedOverDebt;
                      if (newCarried > 0) {
                        if (amount >= newCarried) {
                          appliedToCarriedDebt = newCarried;
                          setCarriedOverDebt(0);
                          setCarriedOverDebtDate('');
                        } else {
                          appliedToCarriedDebt = amount;
                          setCarriedOverDebt(newCarried - amount);
                        }
                      }

                      onAddExpense({
                        amount,
                        category: 'سداد للمصنع',
                        type: 'factory_payment',
                        date: new Date().toISOString(),
                        description: JSON.stringify({
                          notes: newPaymentNotes.trim() || 'تسديد مباشر',
                          appliedToCarriedDebt,
                          recipient: newPaymentRecipient.trim()
                        }),
                        delegateName: selectedDelegatePhone 
                          ? (archiveDelegates.find(d => d.phone === selectedDelegatePhone)?.name || 'مجهول')
                          : currentUser?.name || 'مجهول',
                        delegatePhone: selectedDelegatePhone || currentUser?.phone || ''
                      });
                      setNewPaymentAmount('');
                      setNewPaymentNotes('');
                      setNewPaymentRecipient('');
                      showToast(`✓ تم تسجيل دفعة مالية للمصنع بقيمة ${amount}ج.م بنجاح!`);
                    }}
                    className="bg-[#DD6B20] text-white hover:bg-[#C05621] text-white font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer transition-all active:scale-95 text-center mt-1"
                  >
                    اعتماد السداد
                  </button>
                </div>
              </div>

              {/* Panel B: خانة المتبقي للمصنع / الرصيد الدائن / زر الأرشفة */}
              {(() => {
                const netRemaining = factoryBalanceDetails.netRemainingDueToFactory;
                const rawValue = factoryBalanceDetails.rawLoadedValue;
                const creditBalance = Math.max(0, factoryBalanceDetails.totalAdvancePayments - factoryBalanceDetails.totalWithdrawnValue - carriedOverDebt);
                const isSettledAndCanArchive = (netRemaining <= 0) && (factoryLoads.length > 0 || extraPayments.length > 0 || carriedOverDebt !== 0);

                if (netRemaining > 0) {
                  return (
                    <div className="bg-[#FFF5F5] border border-rose-200 p-4.5 rounded-2xl shadow-sm flex flex-col gap-3 animate-fade-in" id="factory-remaining-box">
                      <span className="text-xs font-black text-rose-800 flex items-center gap-1 bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-100 w-max">
                        <AlertCircle className="h-4 w-4 text-rose-600 animate-pulse" />
                        المتبقي للمصنع حالياً
                      </span>
                      <div className="flex flex-col gap-2.5 mt-1">
                        <div className="bg-white border border-rose-150 p-3 rounded-xl text-center">
                          <span className="text-[10px] block font-bold text-slate-500 mb-1">المبلغ المتبقي الملتزم سداده للمورد:</span>
                          <span className="text-xl font-black font-mono text-rose-600">
                            {formatNum(netRemaining)} <span className="text-xs">ج.م</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const remainingAmount = netRemaining;
                            const confirmed = await confirmDialog(`تأكيد السداد: هل تم بالفعل سداد كامل المبلغ الملاحظ للمصنع وهو بقيمة ${formatNum(remainingAmount)}ج.م، تمهيداً لترحيل وتصفير العملية كاملة للأرشيف المغلق؟`);
                            if (confirmed) {
                              onAddExpense({
                                amount: remainingAmount,
                                category: 'سداد للمصنع',
                                type: 'factory_payment',
                                date: new Date().toISOString(),
                                description: JSON.stringify({ notes: 'سداد كامل المبلغ المتبقي وتصفية الحساب', appliedToCarriedDebt: 0 }),
                                delegateName: selectedDelegatePhone ? (archiveDelegates.find(d => d.phone === selectedDelegatePhone)?.name || 'مجهول') : currentUser?.name || 'مجهول',
                                delegatePhone: selectedDelegatePhone || currentUser?.phone || ''
                              });
                              showToast("✓ تم تسجيل دفعة تسوية الحساب بنجاح!");
                            }
                          }}
                          className="bg-[#10B981] hover:bg-[#10B981] text-white active:scale-95 text-xs font-black py-2 rounded-xl cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-100 shrink-0" />
                          <span>تم السداد بالكامل</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                // Balance is zero or negative (credit)
                return (
                  <div className="bg-emerald-50 border border-emerald-200 p-4.5 rounded-2xl shadow-sm flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-emerald-950 block">الحساب المالي صفر ومصفّر</span>
                        <p className="text-[10px] text-slate-500 font-bold">ليست هناك أي مبالغ أو استحقاقات متبقية معلقة لصالح المصنع حاليا.</p>
                      </div>
                    </div>

                    {creditBalance > 0 && (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                        <span className="text-[10px] block font-bold text-amber-700 mb-1">رصيد دائن للمصنع (قابل للخصم من العمليات القادمة)</span>
                        <span className="text-xl font-black font-mono text-amber-600">
                          {formatNum(creditBalance)} <span className="text-xs">ج.م</span>
                        </span>
                      </div>
                    )}

                    {isSettledAndCanArchive && (
                      <button
                        type="button"
                        onClick={async () => {
                          const credit = creditBalance;
                          const confirmed = await confirmDialog(credit > 0
                            ? `حساب المصنع صفر ويوجد رصيد دائن ${formatNum(credit)}ج.م. هل أنت متأكد من الترحيل للأرشيف؟ سيتم حفظ الدورة الحالية كاملة ومسح الشاشات للبدء بدورة جديدة.`
                            : `حساب المصنع صفر. هل أنت متأكد من الترحيل للأرشيف؟ سيتم حفظ الدورة الحالية كاملة ومسح الشاشات للبدء بدورة جديدة.`
                          );
                          if (confirmed) {
                            // Build archive snapshot from current data
                            const currentLoads = factoryLoads.filter(filterByFactoryDelegate).map(l => {
                              const prod = products.find(p => String(p.id).trim() === String(l.productId).trim());
                              const weights = prod ? getProductWeightsFallback(prod) : [];
                              const weight = weights.find(w => String(w.id).trim() === String(l.weightId).trim());
                              const unitsPerCarton = weight?.unitsPerCarton || 12;
                              const cartons = l.cartonsCount !== undefined ? l.cartonsCount : Math.floor(l.quantity / unitsPerCarton);
                              const loose = l.looseUnitsCount !== undefined ? l.looseUnitsCount : (l.quantity % unitsPerCarton);
                              const cartonPrice = l.cartonPrice !== undefined ? Number(l.cartonPrice) : (Number(weight?.cartonPriceFromFactory) || (prod ? Number(prod.price) * unitsPerCarton : 0) || 0);
                              const unitPrice = l.unitPrice !== undefined ? Number(l.unitPrice) : (Number(weight?.factoryPricePerUnit) || (prod ? Number(prod.price) : 0) || 0);
                              return {
                                date: l.date, productName: prod?.name || l.productName || 'غير معروف',
                                weightSize: weight?.size || (l as any).weightSize || '', cartons, loose,
                                cartonPrice, subtotal: (cartons * cartonPrice) + (loose * unitPrice),
                                advanceAmount: l.advanceAmount ?? 0, delegateName: l.delegateName || ''
                              };
                            });
                            const currentPayments = extraPayments.map(p => ({
                              id: p.id, amount: p.amount, date: p.date, notes: p.notes,
                              recipient: p.recipient, delegateName: p.delegateName,
                              delegatePhone: p.delegatePhone, appliedToCarriedDebt: p.appliedToCarriedDebt
                            }));
                            const rawSum = currentLoads.reduce((s, l) => s + l.subtotal, 0);
                            const trueCredit = Math.max(0, factoryBalanceDetails.totalAdvancePayments - factoryBalanceDetails.totalWithdrawnValue - carriedOverDebt);
                            const newCycle = {
                              id: Date.now().toString(),
                              settledAt: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
                              loads: currentLoads,
                              payments: currentPayments,
                              rawLoadedValue: rawSum,
                              totalWithdrawnValue: factoryBalanceDetails.totalWithdrawnValue,
                              totalAdvancePayments: factoryBalanceDetails.totalAdvancePayments,
                              creditBalance: trueCredit,
                              carriedOverDebtAtTime: carriedOverDebt
                            };
                            setArchiveCycles(prev => [...prev, newCycle]);
                            setCarriedOverDebt(trueCredit > 0 ? -trueCredit : 0);
                            setCarriedOverDebtDate('');
                            // Mark all current factory loads as archived via parent handler
                            const nowArchiveTs = new Date().toISOString();
                            const loadsToArchive = factoryLoads.filter(filterByFactoryDelegate);
                            for (const load of loadsToArchive) { onDeleteLoad(load.id); }
                            // Delete current extra payment expenses
                            const currentExpenses = expenses.filter(e =>
                              (e.category === 'سداد للمصنع' || e.type === 'factory_payment') && filterByFactoryDelegate(e));
                            for (const exp of currentExpenses) { onDeleteExpense(exp.id); }
                            showToast("✓ تم أرشفة دورة المصنع بنجاح! الشاشات جاهزة لدورة جديدة.");
                          }
                        }}
                        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white active:scale-95 text-xs font-black py-2.5 rounded-xl cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <Archive className="h-4 w-4 text-violet-200 shrink-0" />
                        <span>ترحيل للأرشيف</span>
                      </button>
                    )}
                  </div>
                );
              })()}

            </div>

            {/* List of registered Payments to Factory direct */}
            {extraPayments.length > 0 && (
              <div className="bg-[#FFFFFF] p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <span className="text-xs font-black text-[#1A365D] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <History className="h-4.5 w-4.5 text-emerald-505 animate-pulse" />
                  أرشيف الدفعات النقدية والمسددات المباشرة للمورد
                </span>
                <div className="max-h-36 overflow-y-auto custom-scroll flex flex-col gap-2">
                  {extraPayments.map(pay => (
                    <div key={pay.id} className="bg-[#F7FAFC] border border-slate-100 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-[#1A365D] shadow-inner">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[#DD6B20] font-extrabold">{formatNum(pay.amount)}ج.م</span>
                        <span className="text-[10px] text-[#2B6CB0] font-medium">{pay.date}</span>
                        <span className="text-[9.5px] text-slate-600 leading-relaxed">📝 {pay.notes || 'تسديد مباشر'}{pay.delegateName ? ` • 👤 ${pay.delegateName}` : ''}</span>
                        {pay.recipient ? <span className="text-[9px] text-indigo-600">👤 مستلم: السيد / {pay.recipient}</span> : null}
                        {(pay.appliedToCarriedDebt || 0) > 0 && <span className="text-[9px] text-amber-600">🔄 مسدد من المديونية السابقة: {formatNum(pay.appliedToCarriedDebt)}ج.م</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteExpense(pay.id);
                        }}
                        className="text-rose-500 hover:text-rose-700 bg-[#FFFFFF] hover:bg-rose-50 p-1.5 rounded-lg border border-slate-200"
                        title="حذف دفعة السداد"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Print & share Button */}
            <button
              type="button"
              onClick={handleDownloadFactoryLedgerImage}
              className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent active:scale-95 text-white rounded-xl py-3 text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Image className="h-4.5 w-4.5" />
              <span>تنزيل كشف حساب المصنع المالي للإدارة (صورة)</span>
            </button>

            {/* Withdrawn vs Sold Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-sans">
              
              {/* Box 1: Detailed Loads / Withdrawals */}
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <h4 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Truck className="h-4.5 w-4.5 text-[#2B6CB0]" />
                  حركة البضاعة المسحوبة من المصنع
                </h4>
                
                <div className="flex flex-wrap items-center gap-2 mb-2 bg-slate-50 p-2 rounded-xl border border-slate-150 text-right">
                  <span className="text-[10px] font-bold text-slate-500">الفترة:</span>
                  <select value={accountLoadsFilter} onChange={e => setAccountLoadsFilter(e.target.value as any)} className="bg-white border border-slate-200 rounded p-1 text-[11px] font-bold outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="all">الكل</option>
                    <option value="daily">اليوم</option>
                    <option value="weekly">الأسبوع</option>
                    <option value="monthly">الشهر</option>
                    <option value="custom">مخصص</option>
                  </select>
                  {accountLoadsFilter === 'custom' && (
                    <div className="flex gap-1.5">
                      <input type="date" value={accountLoadsStartDate} onChange={e => setAccountLoadsStartDate(e.target.value)} className="bg-white border border-slate-200 rounded p-1 text-[10px]" />
                      <input type="date" value={accountLoadsEndDate} onChange={e => setAccountLoadsEndDate(e.target.value)} className="bg-white border border-slate-200 rounded p-1 text-[10px]" />
                    </div>
                  )}
                  <div className="flex gap-1.5 mr-auto">
                    <button type="button" onClick={() => exportAccountLoads('png')} className="bg-indigo-50 text-indigo-700 p-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors" title="تنزيل صورة">
                      <Image className="w-3.5 h-3.5"/>
                    </button>
                    <button type="button" onClick={() => exportAccountLoads('pdf')} className="bg-rose-50 text-rose-700 p-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors" title="تنزيل PDF">
                      <FileText className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto custom-scroll flex flex-col gap-2.5">
                  {accountLoadsSummary.length === 0 ? (
                    <p className="text-center text-gray-400 py-6 text-xs font-medium">لا توجد مسحوبات مسجلة.</p>
                  ) : (
                    accountLoadsSummary.map((item, idx) => (
                      <div key={'with_' + item.id + '_' + idx} className="bg-[#F7FAFC] border border-slate-100 rounded-xl p-3.5 flex flex-col gap-1 text-xs">
                        <div className="flex justify-between items-center font-bold text-[#1A365D]">
                          <span>{item.productName} ({item.size})</span>
                          <span>{item.cartons} كرتونة</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-[#2B6CB0] mt-0.5 font-medium">
                          <span>سعر المصنع للكرتونة: {item.cartonPrice}ج.م</span>
                          <span className="font-mono text-[#1A365D]">القيمة: <strong className="font-bold text-[#1A365D]">{formatNum(item.subtotal)}ج.م</strong></span>
                        </div>
                        {item.advanceAmount && item.advanceAmount > 0 ? (
                          <div className="flex justify-between items-center text-[10px] text-[#DD6B20] bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 mt-1 font-bold">
                            <span>خصم مقدم البضاعة للمصنع:</span>
                            <span className="font-mono">-{item.advanceAmount}ج.م</span>
                          </div>
                        ) : null}
                        {item.warehouseKeeper && (
                          <span className="text-[10px] text-[#1A365D] font-bold mt-1">
                            الجهة المستلمة والمراجعة: {item.warehouseKeeper}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Box 2: Detailed Sales / Sold Items */}
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <h4 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <CirclePercent className="h-4.5 w-4.5 text-emerald-500" />
                  حركة البضاعة المباعة للعملاء بالسيارة
                </h4>

                <div className="max-h-80 overflow-y-auto custom-scroll flex flex-col gap-2.5">
                  {Object.keys(factoryBalanceDetails.soldCounts).length === 0 ? (
                    <p className="text-center text-gray-400 py-6 text-xs font-medium">لا توجد مبيعات مسجلة في الفواتير حتى الآن.</p>
                  ) : (
                    Object.entries(factoryBalanceDetails.soldCounts).map(([weightId, val]) => {
                      const info = val as { cartons: number; units: number; value: number };
                      let pName = 'منتج غير محدد';
                      let sizeStr = 'عبوة مجهولة';
                      let accountingUnitLabel = 'كرتونة';
                      let unitsPerC = 12;

                      products.forEach(p => {
                        const weights = getProductWeightsFallback(p);
                        const weight = weights.find(w => w.id === weightId);
                        if (weight) {
                          pName = p.name;
                          sizeStr = weight.size;
                          accountingUnitLabel = p.accountingUnit || 'كرتونة';
                          unitsPerC = weight.unitsPerCarton || 12;
                        }
                      });
                      
                      const fullC = Math.floor(info.units / unitsPerC);
                      const loose = info.units % unitsPerC;
                      const qtyText = `${fullC > 0 ? fullC + ' ' + accountingUnitLabel : ''} ${loose > 0 ? (fullC > 0 ? 'و ' : '') + loose + ' عبوة' : ''}`.trim() || '0 عبوة';

                      return (
                        <div key={'sold_' + weightId} className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 flex flex-col gap-1 text-xs">
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-emerald-950">{pName} ({sizeStr})</span>
                            <span className="text-emerald-800">{qtyText}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-[#2B6CB0] mt-0.5 font-medium">
                            <span>إجمالي المبيعات الفردية: {info.units} عبوة</span>
                            <span className="font-mono text-[#DD6B20] font-extrabold">قيمة البيع: {formatNum(info.value)}ج.م</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Edit Archived Cycle Modal */}
        {editingCycle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setEditingCycle(null); setEditData(null); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <span className="text-sm font-black text-indigo-900">تعديل الدورة المؤرشفة</span>
                <button type="button" onClick={() => { setEditingCycle(null); setEditData(null); }} className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer">✕</button>
              </div>
              {editData && (
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-xs font-extrabold text-slate-600 block mb-2">📦 الحمولات ({editData.loads?.length || 0})</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-[11px] font-bold">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr><th className="p-1.5 text-center w-8">م</th><th className="p-1.5 text-right">الصنف</th><th className="p-1.5 text-center">الكراتين</th><th className="p-1.5 text-center">السعر</th><th className="p-1.5 text-center">المقدم</th></tr>
                        </thead>
                        <tbody>
                          {editData.loads.map((load: any, i: number) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 text-center text-slate-400">{i + 1}</td>
                              <td className="p-1 text-right">{load.productName} ({load.weightSize})</td>
                              <td className="p-1 text-center"><input type="number" value={load.cartons} onChange={e => { const val = +e.target.value; setEditData((prev: any) => ({...prev, loads: prev.loads.map((l: any, j: number) => j === i ? {...l, cartons: val, subtotal: val * l.cartonPrice + l.loose * (l.cartonPrice / (load.unitsPerCarton || 12))} : l)})); }} className="w-16 text-center border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><input type="number" value={load.cartonPrice} onChange={e => { const val = +e.target.value; setEditData((prev: any) => ({...prev, loads: prev.loads.map((l: any, j: number) => j === i ? {...l, cartonPrice: val, subtotal: val * l.cartons + l.loose * (val / (load.unitsPerCarton || 12))} : l)})); }} className="w-16 text-center border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><input type="number" value={load.advanceAmount} onChange={e => setEditData((prev: any) => ({...prev, loads: prev.loads.map((l: any, j: number) => j === i ? {...l, advanceAmount: +e.target.value} : l)}))} className="w-16 text-center border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-600 block mb-2">💳 الدفعات ({editData.payments?.length || 0})</span>
                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-[11px] font-bold">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr><th className="p-1.5 text-center w-8">م</th><th className="p-1.5 text-right">الملاحظات</th><th className="p-1.5 text-center">المبلغ</th><th className="p-1.5 text-center">المستلم</th><th className="p-1.5 text-center w-10">حذف</th></tr>
                        </thead>
                        <tbody>
                          {editData.payments.map((pay: any, i: number) => (
                            <tr key={pay.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 text-center text-slate-400">{i + 1}</td>
                              <td className="p-1 text-right"><input type="text" value={pay.notes || ''} onChange={e => setEditData((prev: any) => ({...prev, payments: prev.payments.map((p: any, j: number) => j === i ? {...p, notes: e.target.value} : p)}))} className="w-full border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><input type="number" value={pay.amount} onChange={e => setEditData((prev: any) => ({...prev, payments: prev.payments.map((p: any, j: number) => j === i ? {...p, amount: +e.target.value} : p)}))} className="w-20 text-center border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><input type="text" value={pay.recipient || ''} onChange={e => setEditData((prev: any) => ({...prev, payments: prev.payments.map((p: any, j: number) => j === i ? {...p, recipient: e.target.value} : p)}))} className="w-full border border-slate-200 rounded p-0.5 text-[11px]" /></td>
                              <td className="p-1 text-center"><button type="button" onClick={() => setEditData((prev: any) => ({...prev, payments: prev.payments.filter((_: any, j: number) => j !== i)}))} className="text-red-500 hover:text-red-700 text-xs font-black cursor-pointer">✕</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        const rawSum = editData.loads.reduce((s: number, l: any) => s + l.subtotal, 0);
                        const paySum = editData.payments.reduce((s: number, p: any) => s + p.amount, 0);
                        const credit = Math.max(0, paySum - rawSum);
                        const updatedCycle = {
                          ...editData,
                          rawLoadedValue: rawSum,
                          totalWithdrawnValue: rawSum + (editData.carriedOverDebtAtTime || 0),
                          totalAdvancePayments: paySum,
                          creditBalance: credit
                        };
                        setArchiveCycles((prev: any) => prev.map((c: any) => c.id === editData.id ? updatedCycle : c));
                        setEditingCycle(null);
                        setEditData(null);
                        showToast("✓ تم حفظ التعديلات على الدورة المؤرشفة!");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-6 rounded-xl cursor-pointer transition-all"
                    >
                      💾 حفظ التعديلات
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (await confirmDialog(`هل أنت متأكد من حذف هذه الدورة المؤرشفة بالكامل؟ (${editData.loads?.length || 0} حمولة، ${editData.payments?.length || 0} دفعة)`)) {
                          setArchiveCycles((prev: any) => prev.filter((c: any) => c.id !== editData.id));
                          setEditingCycle(null);
                          setEditData(null);
                          showToast("✓ تم حذف الدورة المؤرشفة!");
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-6 rounded-xl cursor-pointer transition-all"
                    >
                      🗑️ حذف الدورة
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingCycle(null); setEditData(null); }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 px-6 rounded-xl cursor-pointer transition-all mr-auto"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

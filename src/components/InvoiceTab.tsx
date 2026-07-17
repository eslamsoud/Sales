// @ts-nocheck
import { COMPACT_PRO_CSS, printHTMLInNewWindow, ensureFontsLoaded } from '../utils/reportStyles';
import { confirmDialog, duaConfirmDialog } from '../utils/confirm';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import html2canvas from 'html2canvas';
import { Customer, Product, ProductWeight, Invoice, InvoiceItem, FactoryLoad, getProductWeightsFallback, formatNum, getItemFactoryCost, Return, ReturnItem, ReturnMovementType } from '../types';
import { Receipt, Plus, Trash2, ArrowRight, Save, User, MapPin, Percent, HelpCircle, Package, AlertTriangle, Scale, Eye, Search, Check, Loader2, Download, Share2, FileText, Printer, ScanLine, Copy, RefreshCw } from 'lucide-react';
import { showToast } from '../utils/toast';
import { nowEgyptISO, todayEgyptISO } from '../utils/storage';
import SecurePhoneDisplay from './SecurePhoneDisplay';
import { jsPDF } from 'jspdf';
import BarcodeScanner from './BarcodeScanner';
import InvoiceTemplate from './InvoiceTab/InvoiceTemplate';

interface InvoiceTabProps {
  customers: Customer[];
  products: Product[];
  factoryLoads: FactoryLoad[];
  invoices: Invoice[];
  onAddInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onGoBack: () => void;
  permittedSubTabs?: string[];
  currentUser?: any;
  usersList?: any[];
  initialSubTab?: 'create' | 'archive' | 'debtors';
  lastArchiveTimestamp?: number;
  returns?: Return[];
  onAddReturn?: (ret: Omit<Return, 'id'>) => void;
  customerCredits?: Record<string, number>;
  onUseCustomerCredit?: (customerId: string, amount: number) => void;
}

const formatCartonsAndPieces = (rawQty: number, unitsPerCarton: number): string => {
  const cartons = Math.floor(rawQty / unitsPerCarton);
  const pieces = rawQty % unitsPerCarton;
  
  const parts: string[] = [];
  if (cartons > 0) {
    parts.push(`${cartons} كرتونة`);
  }
  if (pieces > 0) {
    parts.push(`${pieces} قطعة`);
  }
  return parts.length > 0 ? parts.join(' و ') : '0 قطعة';
};

export default function InvoiceTab({
  customers,
  products: rawProducts,
  factoryLoads,
  invoices,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onGoBack,
  permittedSubTabs,
  currentUser,
  usersList,
  initialSubTab,
  lastArchiveTimestamp = 0,
  returns = [],
  onAddReturn,
  customerCredits = {},
  onUseCustomerCredit
}: InvoiceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'archive' | 'debtors'>(() => {
    if (initialSubTab) return initialSubTab;
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('invoice_create')) return 'create';
      if (permittedSubTabs.includes('invoice_balance')) return 'archive';
    }
    return 'create';
  });

  const getEgyptTodayDate = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  };

  const [invoiceFilterDate, setInvoiceFilterDate] = useState(() => getEgyptTodayDate());
  const [selectedInvoiceGov, setSelectedInvoiceGov] = useState('all');
  const [selectedInvoiceArea, setSelectedInvoiceArea] = useState('all');
  const [selectedInvoiceCustomer, setSelectedInvoiceCustomer] = useState('all');
  const [selectedInvoiceDelegate, setSelectedInvoiceDelegate] = useState('all');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Debtors separate filters
  const [debtorGov, setDebtorGov] = useState('all');
  const [debtorArea, setDebtorArea] = useState('all');
  const [debtorCustomer, setDebtorCustomer] = useState('all');
  const [debtorDelegate, setDebtorDelegate] = useState('all');
  
  const [returnModal, setReturnModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
  }>({ isOpen: false, invoice: null });
  
  const [returnForm, setReturnForm] = useState<{
    items: Array<{ productId: string; weightId: string; quantity: string; unitType: 'carton' | 'piece' }>;
    movementType: ReturnMovementType;
    exchangeProductId: string;
    exchangeWeightId: string;
    exchangeQty: string;
    exchangeUnitType: 'carton' | 'piece';
    exchangeSettlementMethod: 'cash' | 'credit';
    notes: string;
  }>({
    items: [],
    movementType: 'cash_refund',
    exchangeProductId: '',
    exchangeWeightId: '',
    exchangeQty: '0',
    exchangeUnitType: 'piece',
    exchangeSettlementMethod: 'cash',
    notes: ''
  });

  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
    type: 'partial' | 'full';
    amount: string;
    paymentMethod: string;
  }>({ isOpen: false, invoice: null, type: 'full', amount: '', paymentMethod: 'نقدي (كاش)' });

  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  
  const handleCancelEditActiveInvoice = () => {
    setEditingInvoiceId(null);
    setSelectedCustomerId('');
    setInvoiceNotes('');
    setBillItems([]);
    setCustomPaidAmount('');
    setManualInvoiceNumber('');
  };
  
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeSubTab]);
  
  // Archiving/Debtors subtab state
  const [searchInvoice, setSearchInvoice] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [weekDayFilter, setWeekDayFilter] = useState<string[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [filterGovernorateList, setFilterGovernorateList] = useState('');
  const [filterAreaList, setFilterAreaList] = useState('');
  // Filter products and their weights matching active non-zero price condition
  const products = useMemo(() => {
    return rawProducts.map(p => {
      // إزالة الفلترة الصارمة بالكامل لمنع اختفاء الأصناف المضافة حديثاً قبل تسعيرها
      const activeWeights = getProductWeightsFallback(p);
      return {
        ...p,
        weights: activeWeights
      };
    }).filter(p => p.weights && p.weights.length > 0);
  }, [rawProducts]);

  // Main form states
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => localStorage.getItem('invoice_draft_customerId') || '');
  const [invoiceNotes, setInvoiceNotes] = useState(() => localStorage.getItem('invoice_draft_notes') || '');
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState(() => localStorage.getItem('invoice_draft_manualInvoiceNumber') || '');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const cached = localStorage.getItem('invoice_draft_date');
    if (cached) {
      const d = new Date(cached);
      if (!isNaN(d.getTime())) return cached;
    }
    return `${getEgyptTodayDate()}T12:00`;
  });

  const [filterGovernorate, setFilterGovernorate] = useState(() => localStorage.getItem('invoice_draft_filterGovernorate') || '');
  const [filterArea, setFilterArea] = useState(() => localStorage.getItem('invoice_draft_filterArea') || '');
  const [justSavedInvoice, setJustSavedInvoice] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Current item being built states
  const [currentProductId, setCurrentProductId] = useState('');
  const [currentWeightId, setCurrentWeightId] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [currentDiscount, setCurrentDiscount] = useState(''); // defaulting to 0 or manual
  const [sellUnitType, setSellUnitType] = useState<'carton' | 'piece'>('carton');

  // Added items on current working bill
  const [billItems, setBillItems] = useState<InvoiceItem[]>(() => {
    try {
      const stored = localStorage.getItem('invoice_draft_billItems');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Hidden Extra Discount
  const [discountClicks, setDiscountClicks] = useState(0);
  const [showPwd, setShowPwd] = useState(false);
  const [discountPwd, setDiscountPwd] = useState('');
  const [extraDiscountApplied, setExtraDiscountApplied] = useState(() => localStorage.getItem('invoice_draft_extraDiscountApplied') === 'true');
  const [extraDiscountAmount, setExtraDiscountAmount] = useState(() => localStorage.getItem('invoice_draft_extraDiscountAmount') || '');
  const [extraDiscountReason, setExtraDiscountReason] = useState(() => localStorage.getItem('invoice_draft_extraDiscountReason') || '');
  const [customPaidAmount, setCustomPaidAmount] = useState(() => localStorage.getItem('invoice_draft_customPaidAmount') || '');
  const [appliedCreditAmount, setAppliedCreditAmount] = useState(0);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const isManager = currentUser?.role === 'owner' || currentUser?.phone === '01228466613';
  const invoiceDelegates = React.useMemo(() => {
    const map = new Map<string, { phone: string; name: string }>();
    const addDel = (phone: string, name: string) => {
      const cleanPhone = phone ? phone.trim() : '';
      const cleanName = name ? name.replace(/\s*\(.*?\)/g, '').trim() : 'مجهول';
      if (!cleanPhone && cleanName === 'مجهول') return;
      const key = cleanPhone || cleanName;
      if (!map.has(key)) map.set(key, { phone: cleanPhone || 'مجهول', name: cleanName });
    };
    (usersList || []).forEach(u => addDel(u.phone, u.name));
    return Array.from(map.values());
  }, [usersList]);
  const [invoiceDelegatePhone, setInvoiceDelegatePhone] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const isDuplicatingRef = useRef(false);
  const isPrintingRef = useRef(false);
  const isAddingItemRef = useRef(false);
  const isSavingRef = useRef(false);

  // Synchronize form draft changes to localStorage to prevent state reset on unmount
  useEffect(() => {
    localStorage.setItem('invoice_draft_customerId', selectedCustomerId);
  }, [selectedCustomerId]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_notes', invoiceNotes);
  }, [invoiceNotes]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_manualInvoiceNumber', manualInvoiceNumber);
  }, [manualInvoiceNumber]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_date', invoiceDate);
  }, [invoiceDate]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_filterArea', filterArea);
  }, [filterArea]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_filterGovernorate', filterGovernorate);
  }, [filterGovernorate]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_billItems', JSON.stringify(billItems));
  }, [billItems]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_extraDiscountApplied', String(extraDiscountApplied));
  }, [extraDiscountApplied]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_extraDiscountAmount', extraDiscountAmount);
  }, [extraDiscountAmount]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_extraDiscountReason', extraDiscountReason);
  }, [extraDiscountReason]);

  useEffect(() => {
    localStorage.setItem('invoice_draft_customPaidAmount', customPaidAmount);
  }, [customPaidAmount]);

  // Form states are persisted cleanly to client localStorage

  const parseCairoTime = (dateStr: string): number => new Date(dateStr.replace('Z', '')).getTime();

  // Calculate real-time car stock per product weight size combination
  const weightStocks = useMemo(() => {
    const stocks: Record<string, { loaded: number; sold: number; remaining: number }> = {};
    
    const activeLoads = factoryLoads.filter(l => parseCairoTime(l.date) > lastArchiveTimestamp);
    const activeInvoices = invoices.filter(inv => parseCairoTime(inv.date) > lastArchiveTimestamp);

    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        const key = `${p.id}_${w.id}`;

        // 1. Sum loaded from factory loads of this product and weight size
        const loaded = activeLoads
          .filter(l => String(l.productId).trim() === String(p.id).trim() && String(l.weightId || '').trim() === String(w.id).trim())
          .reduce((sum, l) => sum + l.quantity, 0);

        // 2. Sum sold in all previous saved invoices
        let sold = 0;
        activeInvoices.forEach(inv => {
          if (editingInvoiceId && inv.id === editingInvoiceId) return; // Skip the invoice being edited to prevent double-subtraction from stock
          inv.items.forEach(item => {
            if (String(item.productId).trim() === String(p.id).trim() && String(item.weightId || '').trim() === String(w.id).trim()) {
              sold += item.quantity;
            }
          });
        });
        // Subtract returned quantities (returns go back to inventory)
        let returned = 0;
        returns.forEach(ret => {
          (ret.items || []).forEach((ri: any) => {
            if (String(ri.productId || '').trim() === String(p.id).trim() && String(ri.weightId || '').trim() === String(w.id).trim()) {
              returned += Number(ri.quantity || 0);
            }
          });
        });
        const effectiveSold = sold - returned;

        // 3. Draft items currently on screen
        const drafted = billItems
          .filter(it => String(it.productId).trim() === String(p.id).trim() && String(it.weightId || '').trim() === String(w.id).trim())
          .reduce((sum, it) => sum + it.quantity, 0);

        stocks[key] = {
          loaded,
          sold: effectiveSold,
          remaining: loaded - effectiveSold - drafted
        };
      });
    });

    return stocks;
  }, [products, factoryLoads, invoices, returns, billItems, editingInvoiceId, lastArchiveTimestamp]);

  // Selected customer information
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [selectedCustomerId, customers]);

  // Customer returns (for deduction from new invoice)
  const customerReturns = useMemo(() => {
    if (!selectedCustomerId) return [];
    return returns.filter(ret => ret.customerId === selectedCustomerId);
  }, [returns, selectedCustomerId]);

  const [showCustomerInvoices, setShowCustomerInvoices] = useState(false);
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState<Invoice | null>(null);
  const [invoiceReturnItems, setInvoiceReturnItems] = useState<Array<{
    productId: string;
    weightId: string;
    productName: string;
    weightSize: string;
    finalPrice: number;
    quantity: string;
    unitType: 'carton' | 'piece';
    unitsPerCarton: number;
    effectiveCartonPrice: number;
  }>>([]);

  // Generate preview image when selectedInvoice changes
  useEffect(() => {
    if (!selectedInvoice) {
      setPreviewImageUrl(null);
      return;
    }
    let cancelled = false;
    exportInvoiceAsPNG(selectedInvoice, false, true).then(url => {
      if (!cancelled && url) setPreviewImageUrl(url as string);
    });
    return () => { cancelled = true; };
  }, [selectedInvoice]);

  // Utility: calculate effective unit prices after distributing extra discount
  const getEffectivePrices = (inv: Invoice) => {
    const items = inv.items || [];
    const extraDiscount = (inv as any).extraDiscountAmount || 0;
    const totalAfterBasic = items.reduce((sum, it) => sum + ((it.finalPrice || 0) * (it.quantity || 0)), 0);
    return items.map(it => {
      const prod = products.find(p => String(p.id).trim() === String(it.productId).trim());
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const w = weights.find(ww => String(ww.id).trim() === String(it.weightId).trim()) || weights[0];
      const upc = w?.unitsPerCarton || 12;
      const itemTotal = (it.finalPrice || 0) * (it.quantity || 0);
      let effectiveCartonPrice = it.finalPrice || 0;
      if (extraDiscount > 0 && totalAfterBasic > 0) {
        const share = (itemTotal / totalAfterBasic) * extraDiscount;
        effectiveCartonPrice = (itemTotal - share) / (it.quantity || 1);
      }
      return {
        ...it,
        productName: prod?.name || '',
        weightSize: w?.size || '',
        unitsPerCarton: upc,
        effectiveCartonPrice
      };
    });
  };

  // تطبيع الحروف العربية: ة → ه لتوحيد مقارنة أسماء المناطق
  const normalizeArabic = (s: string) => (s || '').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

  // Available governorates present in customers list (مطبّع)
  const availableGovernorates = useMemo(() => {
    const govs = customers.map(c => normalizeArabic(c.governorate)).filter(Boolean);
    return Array.from(new Set(govs)).sort();
  }, [customers]);

  // Available geographical areas based on chosen governorate (مطبّع)
  const availableAreas = useMemo(() => {
    const filteredCustomers = filterGovernorate
      ? customers.filter(c => normalizeArabic(c.governorate) === filterGovernorate)
      : customers;
    const areas = filteredCustomers.map(c => normalizeArabic(c.area)).filter(Boolean);
    return Array.from(new Set(areas)).sort();
  }, [customers, filterGovernorate]);

  // Filtered customer list by chosen governorate and area (مطبّع)
  const filteredCustomersByArea = useMemo(() => {
    let result = customers;
    if (filterGovernorate) {
      result = result.filter(c => normalizeArabic(c.governorate) === filterGovernorate);
    }
    if (filterArea) {
      result = result.filter(c => normalizeArabic(c.area) === filterArea);
    }
    return result;
  }, [customers, filterGovernorate, filterArea]);

  // List of product weight lines currently loaded in the car
  const loadedProductsList = useMemo(() => {
    const list: Array<{
      product: Product;
      weight: ProductWeight;
      stockKey: string;
      remaining: number;
    }> = [];

    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        const stockKey = `${p.id}_${w.id}`;
        const stock = weightStocks[stockKey];
        if (stock && stock.loaded > 0) {
          list.push({
            product: p,
            weight: w,
            stockKey,
            remaining: stock.remaining
          });
        }
      });
    });

    return list;
  }, [products, weightStocks]);

  // List of unique products loaded in the car for simplified shortcuts
  const loadedProductsUniqueList = useMemo(() => {
    const list: Product[] = [];
    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      const hasStock = weights.some(w => {
        const stockKey = `${p.id}_${w.id}`;
        const stock = weightStocks[stockKey];
        return stock && stock.loaded > 0;
      });
      if (hasStock) {
        list.push(p);
      }
    });
    return list;
  }, [products, weightStocks]);

  // Active product weights for current item creation form
  const activeProductWeights = useMemo(() => {
    const prod = products.find(p => p.id === currentProductId);
    if (!prod) return [];
    return getProductWeightsFallback(prod);
  }, [currentProductId, products]);

  // Retrieve details of the current selected weight/variant
  const activeSelectedWeight = useMemo(() => {
    return activeProductWeights.find(w => w.id === currentWeightId);
  }, [currentWeightId, activeProductWeights]);

  // Handle adding an item to the current invoice bill list
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingItemRef.current) return;
    isAddingItemRef.current = true;
    setIsAddingItem(true); // تفعيل القفل لمنع الإضافة المتكررة السريعة
    try {
      if (!currentProductId || !currentWeightId) {
        showToast('⚠️ يرجى اختيار الصنف والوزن المطلوب بيعه.');
        return;
      }

      const prod = products.find(p => p.id === currentProductId);
      const weight = activeSelectedWeight;
      if (!prod || !weight) return;

      const qtyInput = parseInt(currentQty) || 0;
      const multiplier = weight.unitsPerCarton || 12;
      const qty = sellUnitType === 'carton' ? (qtyInput * multiplier) : qtyInput;

      if (qty <= 0) {
        showToast('⚠️ الرجاء كتابة كمية بيع صحيحة أكبر من الصفر.');
        return;
      }

      const retailCartonPrice = weight.cartonPriceFromFactory + (weight.addedValue || 0);
      if (retailCartonPrice <= 0) {
         showToast('⚠️ تنبيه: هذا الصنف غير مسعر بالكامل (السعر صفر)! تأكد من مراجعة تسعيره مع الإدارة.');
      }

      const discountPerc = parseFloat(currentDiscount) || 0;
      
      // Check stock bounds in car balances
      const stockKey = `${currentProductId}_${currentWeightId}`;
      const available = weightStocks[stockKey]?.remaining ?? 0;
      if (qty > available) {
        let isConfirmed = false;
        if (sellUnitType === 'carton') {
          const availCartons = Math.floor(available / multiplier);
          const availPieces = available % multiplier;
          const availText = availPieces > 0 ? `${availCartons} كرتونة و ${availPieces} قطعة` : `${availCartons} كرتونة`;
          isConfirmed = await confirmDialog(`الطلب أكبر من الرصيد المسجل بالسيارة!\n(الرصيد المسجل: ${availText})\n\nهل ترغب في تجاوز الرصيد وإتمام البيع على أي حال؟`, false);
        } else {
          isConfirmed = await confirmDialog(`الطلب أكبر من الرصيد المسجل بالسيارة!\n(الرصيد المسجل: ${available} قطعة)\n\nهل ترغب في تجاوز الرصيد وإتمام البيع على أي حال؟`, false);
        }
        if (!isConfirmed) return;
      }

      setBillItems(prevList => {
        const retailCartonPrice = weight.cartonPriceFromFactory + (weight.addedValue || 0);
        const exactOrigPrice = retailCartonPrice / multiplier;
        const exactFinalPr = exactOrigPrice * (1 - discountPerc / 100);

        const newItem: InvoiceItem = {
          productId: currentProductId,
          weightId: currentWeightId,
          quantity: qty,
          originalPrice: exactOrigPrice,
          factoryPrice: weight.factoryPricePerUnit,
          discountPercent: discountPerc,
          finalPrice: exactFinalPr
        };
        
        return [...prevList, newItem];
      });

      // Reset items builder form only, keep client intact
      setCurrentProductId('');
      setCurrentWeightId('');
      setCurrentQty('');
      setCurrentDiscount('0');
    } finally {
      setTimeout(() => {
        isAddingItemRef.current = false;
        setIsAddingItem(false);
      }, 300); // فك القفل بعد ثلث ثانية
    }
  };

  const handleRemoveDraftItem = (index: number) => {
    const updated = [...billItems];
    updated.splice(index, 1);
    setBillItems(updated);
  };

  const handleDuplicateDraftItem = async (index: number) => {
    if (isDuplicatingRef.current) return;
    isDuplicatingRef.current = true;
    setIsDuplicating(true); // تفعيل القفل لمنع نسخ الصنف 6 مرات عند النقر السريع
    try {
      const item = billItems[index];
      const stockKey = `${item.productId}_${item.weightId}`;
      const available = weightStocks[stockKey]?.remaining ?? 0;
      
      if (item.quantity > available) {
        await confirmDialog(`الرصيد المتاح بالسيارة لا يكفي لتكرار هذا الصنف!\n\nالمتاح فقط: ${available} قطعة`, true);
        return;
      }
      
      setBillItems(prev => [...prev, { ...item }]);
      showToast('✓ تم تكرار الصنف بنجاح.');
    } finally {
      setTimeout(() => {
        isDuplicatingRef.current = false;
        setIsDuplicating(false);
      }, 400); // إزالة القفل بعد نصف ثانية
    }
  };

  // Handle successful barcode scan
  const handleScanSuccess = (decodedText: string) => {
    setIsScanningBarcode(false);
    
    // تشغيل صوت "Beep" سريع كالكاشير للتأكيد
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1500, audioCtx.currentTime); // تردد صوت الكاشير المألوف
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); // مستوى وقوة الصوت
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15); // التلاشي التدريجي
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15); // مدة الصوت 150 ملي ثانية
    } catch (e) {
      console.warn("Audio feedback not supported", e);
    }

    // Find the product and weight that matches this barcode
    for (const p of products) {
      const weights = getProductWeightsFallback(p);
      const matchedWeight = weights.find(w => w.barcode === decodedText);
      if (matchedWeight) {
        setCurrentProductId(p.id);
        setCurrentWeightId(matchedWeight.id);
        setCurrentQty(''); // ترك الكمية فارغة ليكتبها المندوب يدوياً
        
        showToast(`✓ تم التعرف على الصنف: ${p.name} (${matchedWeight.size})`);
        
        // وضع المؤشر تلقائياً في خانة الكمية لتسريع الكتابة
        setTimeout(() => {
          document.getElementById('qty-input')?.focus();
        }, 100);

        return;
      }
    }
    showToast('⚠️ لم يتم العثور على منتج يطابق هذا الباركود في قاعدة البيانات.');
  };

  // Calculate totals of bill items
  const totals = useMemo(() => {
    let before = 0;
    let after = 0;

    billItems.forEach(item => {
      before += item.originalPrice * item.quantity;
      after += item.finalPrice * item.quantity;
    });

    const extraDiscount = extraDiscountApplied ? (parseFloat(extraDiscountAmount) || 0) : 0;
    after = Math.max(0, after - extraDiscount);

    return {
      before,
      after,
      discount: before - after, // total discounts including the extra
      extraDiscount,
      extraDiscountReason: extraDiscountApplied ? extraDiscountReason : ''
    };
  }, [billItems, extraDiscountApplied, extraDiscountAmount, extraDiscountReason]);

  // Finalize and save Invoice database entries
  const handleSaveInvoice = async () => {
    if (isSavingRef.current) return; // Prevent double trigger completely
    isSavingRef.current = true;
    
    if (currentProductId && parseInt(currentQty) > 0) {
      showToast('⚠️ يرجى إضافة الصنف قيد الإدخال للفاتورة أولاً.');
      isSavingRef.current = false;
      return;
    }
    if (!selectedCustomerId) {
      showToast('⚠️ الرجاء اختيار العميل أولاً.');
      isSavingRef.current = false;
      return;
    }
    if (billItems.length === 0) {
                showToast('⚠️ يجب إضافة صنف واحد على الأقل للفاتورة!');
      isSavingRef.current = false;
      return;
    }

    setIsSaving(true); // 🚨 تفعيل القفل قبل نافذة التأكيد لمنع تراكم الطلبات (السبب الرئيسي لتكرار الفواتير)

    const customerObj = customers.find(c => c.id === selectedCustomerId);
    const msg = `تأكيد المعاملة: هل ترغب في إصدار فاتورة بيع لـ ${customerObj?.name} بقيمة ${totals.after.toFixed(2)} ج.م؟`;
    const duaMsg = "اللهم إني أعوذ بك أن أضل أو أضل في عملي هذا ، أو أزل أو أزل في عملي هذا ، أو أظلم أو أظلم أحدا في عملي هذا، أو أجهل أو يجهل علي.";

    const confirmed = await duaConfirmDialog(msg, duaMsg, "بسم الله الرحمن الرحيم");
    if (!confirmed) {
      setIsSaving(false);
      isSavingRef.current = false;
      return;
    }

    try {
      const generatedInvNum = `INV-${1000 + invoices.length + 1}`;
      const nextInvNum = manualInvoiceNumber.trim() ? manualInvoiceNumber.trim() : generatedInvNum;
      
      const extraNotes = totals.extraDiscount > 0 ? `خصم إضافي خاص: ${totals.extraDiscount}ج.م - السبب: ${totals.extraDiscountReason}` : '';
      const finalNotes = [invoiceNotes.trim(), extraNotes].filter(Boolean).join(" | ");

      const paidValue = customPaidAmount !== '' ? parseFloat(customPaidAmount) : 0;

      // Create a copy of billItems to save immediately
      const itemsToSave = [...billItems];

      const selectedInvoiceDelegate = isManager && invoiceDelegatePhone
        ? invoiceDelegates.find(d => d.phone === invoiceDelegatePhone)
        : null;

      const invoiceData = {
        invoiceNumber: nextInvNum,
        customerId: selectedCustomerId,
        customerName: selectedCustomer?.name || 'عميل مجهول',
        customerArea: selectedCustomer?.area || 'منطقة مجهولة',
        date: (invoiceDate ? new Date(invoiceDate) : new Date()).toISOString(),
        items: itemsToSave,
        totalBeforeDiscount: Number(totals.before.toFixed(2)),
        totalAfterDiscount: Number(totals.after.toFixed(2)),
        paidAmount: Number(paidValue.toFixed(2)),
        notes: finalNotes,
        isDelivered: false,
        delegateName: selectedInvoiceDelegate?.name || currentUser?.name || '',
        delegatePhone: selectedInvoiceDelegate?.phone || currentUser?.phone || ''
      };

      // Reset whole components fields PRE-EMPTIVELY to block duplicate clicks
      setSelectedCustomerId('');
      setInvoiceNotes('');
      setManualInvoiceNumber('');
      setBillItems([]); // Synchronous blocking of duplicate saves

      if (editingInvoiceId) {
        onUpdateInvoice({
          ...invoiceData,
          id: editingInvoiceId
        });
        setEditingInvoiceId(null);
      } else {
        onAddInvoice(invoiceData);
      }

      // Deduct used credit
      if (appliedCreditAmount > 0 && selectedCustomerId && onUseCustomerCredit) {
        onUseCustomerCredit(selectedCustomerId, appliedCreditAmount);
        setAppliedCreditAmount(0);
      }

      // Save of popup sharing
      setJustSavedInvoice({
        ...invoiceData,
        id: editingInvoiceId || 'temporary-id',
        customer: selectedCustomer
      });

      const resetNow = new Date();
      resetNow.setMinutes(resetNow.getMinutes() - resetNow.getTimezoneOffset());
      setInvoiceDate(resetNow.toISOString().substring(0, 16));
      setExtraDiscountApplied(false);
      setExtraDiscountAmount('');
      setExtraDiscountReason('');
      setDiscountClicks(0);
      setShowPwd(false);
      setDiscountPwd('');
      setCustomPaidAmount('');
      if (isManager) setInvoiceDelegatePhone('');

      // Clear draft localStorage keys explicitly
      localStorage.removeItem('invoice_draft_customerId');
      localStorage.removeItem('invoice_draft_notes');
      localStorage.removeItem('invoice_draft_manualInvoiceNumber');
      localStorage.removeItem('invoice_draft_date');
      localStorage.removeItem('invoice_draft_filterArea');
      localStorage.removeItem('invoice_draft_billItems');
      localStorage.removeItem('invoice_draft_extraDiscountApplied');
      localStorage.removeItem('invoice_draft_extraDiscountAmount');
      localStorage.removeItem('invoice_draft_extraDiscountReason');
      localStorage.removeItem('invoice_draft_customPaidAmount');
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        setIsSaving(false);
        isSavingRef.current = false;
      }, 1500);
    }
  };

  const exportInvoiceAsPNG = async (inv: any, shareDirectly = false, returnDataUrl = false) => {
    const customerObj = inv.customer || customers.find((c: any) => c.id === inv.customerId);
    if (!customerObj) return null;

    await ensureFontsLoaded();

    const storedSetStr = localStorage.getItem('app_settings_sys');
    let settings = { appName: 'فاتورة مبيعات معتمدة', representativeName: '', representativePhone: '' };
    if (storedSetStr) {
      try {
        const parsed = JSON.parse(storedSetStr);
        if (parsed.appName && parsed.appName !== 'الاخوه EAGS لخدمات التوزيع') settings.appName = parsed.appName;
        settings.representativeName = inv.delegateName?.replace(/ \(.*?\)/g, '').trim() || parsed.representativeName || currentUser?.name?.replace(/ \(.*?\)/g, '').trim() || '';
        settings.representativePhone = inv.delegatePhone || parsed.representativePhone || currentUser?.phone || '';
      } catch {}
    }

    // Create hidden container, render InvoiceTemplate, capture with html2canvas
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.background = '#ffffff';
    container.style.zIndex = '-1';
    document.body.appendChild(container);

    const htmlString = ReactDOMServer.renderToStaticMarkup(
      <InvoiceTemplate invoice={inv} customer={customerObj} products={products} settings={settings} />
    );
    container.innerHTML = htmlString;

    // Wait for fonts and images to load
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 300));

    try {
      const canvas = await html2canvas(container, {
        scale: 2.4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      document.body.removeChild(container);

      if (returnDataUrl) {
        return canvas.toDataURL('image/png');
      }

      if (shareDirectly && navigator.share) {
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `فاتورة_${customerObj.name}_${inv.invoiceNumber}.png`, { type: 'image/png' });
            navigator.share({
              title: `فاتورة ${inv.invoiceNumber}`,
              text: `الفاتورة الخاصة بالعميل ${customerObj.name}`,
              files: [file]
            }).catch(console.error);
          }
        }, 'image/png');
      } else {
        const downloadLink = document.createElement('a');
        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.download = `فاتورة_${customerObj.name}_${inv.invoiceNumber}.png`;
        downloadLink.click();
      }
    } catch (err) {
      document.body.removeChild(container);
      console.error('html2canvas error:', err);
    }
  };

  const exportInvoiceAsPDF = async (inv: any) => {
    const dataUrl = await exportInvoiceAsPNG(inv, false, true);
    if (!dataUrl) return;

    const customerObj = inv.customer || customers.find((c: any) => c.id === inv.customerId);
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => { img.onload = r; });

    const pxToMm = 0.264583;
    const pdfW = img.width * pxToMm;
    const pdfH = img.height * pxToMm;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfW, pdfH]
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH);
    pdf.save(`فاتورة_${customerObj?.name || ''}_${inv.invoiceNumber}.pdf`);
  };

  const getInvoiceHTML = (inv: any): string => {
    const customerObj = inv.customer || customers.find((c: any) => c.id === inv.customerId);
    const storedSetStr = localStorage.getItem('app_settings_sys');
    let settings = { appName: 'سمن وزيت سوفانا الفاخر', representativeName: '', representativePhone: '' };
    if (storedSetStr) {
      try {
        const parsed = JSON.parse(storedSetStr);
        if (parsed.appName) settings.appName = parsed.appName;
        settings.representativeName = inv.delegateName?.replace(/ \(.*?\)/g, '').trim() || parsed.representativeName || '';
        settings.representativePhone = inv.delegatePhone || parsed.representativePhone || '';
      } catch {}
    }
    const htmlString = ReactDOMServer.renderToStaticMarkup(
      <InvoiceTemplate invoice={inv} customer={customerObj} products={products} settings={settings} />
    );
    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>${COMPACT_PRO_CSS}</head><body style="margin:0;padding:0;background:#fff">${htmlString}</body></html>`;
  };

  const printInvoiceHTMLDirectly = async (inv: any) => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    setIsPrinting(true);
    const html = getInvoiceHTML(inv);
    printHTMLInNewWindow(html);
    setTimeout(() => {
      isPrintingRef.current = false;
      setIsPrinting(false);
    }, 500);
  };

  const shareInvoiceOnWhatsApp = (inv: any) => {
    const customerObj = inv.customer || customers.find((c: any) => c.id === inv.customerId);
    if (!customerObj) return;

    let msg = `*فاتورة مبيعات*\n`;
    msg += `--------------------------------\n`;
    msg += `*رقم الفاتورة:* ${inv.invoiceNumber}\n`;
    msg += `*العميل المحترم:* ${customerObj.name}\n`;
    msg += `*المحافظة والمنطقة:* ${customerObj.governorate ? `${customerObj.governorate} - ` : ''}${customerObj.area}\n`;
    msg += `*تاريخ الفاتورة:* ${new Date(inv.date).toLocaleDateString('ar-EG')}\n`;
    msg += `--------------------------------\n`;
    
    inv.items.forEach((item: InvoiceItem, index: number) => {
      const prod = products.find(p => String(p.id).trim() === String(item.productId).trim());
      const ws = prod ? getProductWeightsFallback(prod) : [];
      const weight = ws.find(w => String(w.id).trim() === String(item.weightId).trim()) || ws[0];
      const prodName = prod ? prod.name : 'صنف';
      const sizeStr = weight ? weight.size : '';
      const totalItem = item.finalPrice * item.quantity;
      
      const multiplier = weight ? (weight.unitsPerCarton || 12) : 12;
      const qtyText = formatCartonsAndPieces(item.quantity, multiplier);
      const cartonOriginalPrice = item.originalPrice * multiplier;

      msg += `▪️ ${prodName} (${sizeStr})\n`;
      msg += `   الكمية: ${qtyText}\n`;
      if (item.discountPercent > 0) {
        msg += `   السعر: ${cartonOriginalPrice}ج.م/كرتونة (خصم ${item.discountPercent}%)\n`;
      } else {
        msg += `   السعر: ${cartonOriginalPrice}ج.م/كرتونة\n`;
      }
      msg += `   الصافي: *${formatNum(totalItem)}ج.م*\n`;
    });

    msg += `--------------------------------\n`;
    msg += `*الإجمالي:* ${formatNum(inv.totalBeforeDiscount)}ج.م\n`;
    if (inv.totalBeforeDiscount - inv.totalAfterDiscount > 0) {
      msg += `*الخصم:* -${formatNum(inv.totalBeforeDiscount - inv.totalAfterDiscount)}ج.م\n`;
    }
    msg += `💸 *المسدد:* *${formatNum(inv.paidAmount)}ج.م*\n`;
    msg += `*المتبقي:* *${formatNum(inv.totalAfterDiscount - inv.paidAmount)}ج.م*\n\n`;
    msg += `شكراً لتعاملكم معنا! 🌹`;

    const encodedText = encodeURIComponent(msg);
    const cleanPhone = customerObj.phone.replace(/\+/g, '').replace(/\s+/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      finalPhone = '20' + cleanPhone;
    }
    
    window.location.href = `whatsapp://send?phone=${finalPhone}&text=${encodedText}`;
  };

  // Available governorates in the invoices list (مطبّع)
  const listGovernorates = useMemo(() => {
    const govs = invoices.map(inv => {
      const cust = customers.find(c => c.id === inv.customerId);
      return normalizeArabic(cust?.governorate || '');
    }).filter(Boolean);
    return Array.from(new Set(govs)).sort();
  }, [invoices, customers]);

  // Available areas filtered by selected governorate
  const listAreasFiltered = useMemo(() => {
    const govFilter = selectedInvoiceGov !== 'all' ? selectedInvoiceGov : '';
    const filteredInvs = govFilter
      ? invoices.filter(inv => {
          const cust = customers.find(c => c.id === inv.customerId);
          return normalizeArabic(cust?.governorate || '') === govFilter;
        })
      : invoices;
    const areas = filteredInvs.map(inv => {
      const cust = customers.find(c => c.id === inv.customerId);
      return normalizeArabic(cust?.area || inv.customerArea || '');
    }).filter(Boolean);
    return Array.from(new Set(areas)).sort();
  }, [invoices, customers, selectedInvoiceGov]);

  // Available customers filtered by selected governorate + area
  const listCustomersFiltered = useMemo(() => {
    let result = customers;
    if (selectedInvoiceGov !== 'all') {
      result = result.filter(c => normalizeArabic(c.governorate || '') === selectedInvoiceGov);
    }
    if (selectedInvoiceArea !== 'all') {
      result = result.filter(c => normalizeArabic(c.area || '') === selectedInvoiceArea);
    }
    return result;
  }, [customers, selectedInvoiceGov, selectedInvoiceArea]);

  // Debtors separate filtered lists
  const debtorListAreasFiltered = useMemo(() => {
    const govFilter = debtorGov !== 'all' ? debtorGov : '';
    const filteredInvs = govFilter
      ? invoices.filter(inv => {
          const cust = customers.find(c => c.id === inv.customerId);
          return normalizeArabic(cust?.governorate || '') === govFilter;
        })
      : invoices;
    const areas = filteredInvs.map(inv => {
      const cust = customers.find(c => c.id === inv.customerId);
      return normalizeArabic(cust?.area || inv.customerArea || '');
    }).filter(Boolean);
    return Array.from(new Set(areas)).sort();
  }, [invoices, customers, debtorGov]);

  const debtorListCustomersFiltered = useMemo(() => {
    let result = customers;
    if (debtorGov !== 'all') {
      result = result.filter(c => normalizeArabic(c.governorate || '') === debtorGov);
    }
    if (debtorArea !== 'all') {
      result = result.filter(c => normalizeArabic(c.area || '') === debtorArea);
    }
    return result;
  }, [customers, debtorGov, debtorArea]);

  // Available areas for the old filter (kept for compatibility)
  const listAreas = useMemo(() => {
    const filteredInvs = filterGovernorateList
      ? invoices.filter(inv => {
          const cust = customers.find(c => c.id === inv.customerId);
          return normalizeArabic(cust?.governorate || '') === filterGovernorateList;
        })
      : invoices;
    const areas = filteredInvs.map(inv => {
      const cust = customers.find(c => c.id === inv.customerId);
      return normalizeArabic(cust?.area || inv.customerArea || '');
    }).filter(Boolean);
    return Array.from(new Set(areas)).sort();
  }, [invoices, customers, filterGovernorateList]);

  const filteredInvoices = invoices.filter(inv => {
    // Only display delivered invoices OR invoices older than 48 hours (failsafe auto-archive)
    const dTime = new Date(inv.date).getTime();
    const isOld = !isNaN(dTime) && Date.now() - dTime > 48 * 60 * 60 * 1000;
    
    if (inv.isDelivered === false && !isOld) return false;

    const cust = customers.find(c => c.id === inv.customerId);
    
    // Filter by Governorate (from archive filter panel)
    if (selectedInvoiceGov !== 'all') {
      if (!cust || normalizeArabic(cust.governorate || '') !== selectedInvoiceGov) return false;
    }
    
    // Filter by Area (from archive filter panel)
    if (selectedInvoiceArea !== 'all') {
      if (!cust || normalizeArabic(cust.area || '') !== selectedInvoiceArea) return false;
    }

    // Filter by Customer (from archive filter panel)
    if (selectedInvoiceCustomer !== 'all') {
      if (inv.customerId !== selectedInvoiceCustomer) return false;
    }

    // Filter by Delegate (from archive filter panel)
    if (selectedInvoiceDelegate !== 'all') {
      if (inv.delegatePhone !== selectedInvoiceDelegate) return false;
    }

    // Legacy filter fallback
    if (filterGovernorateList) {
      if (!cust || normalizeArabic(cust.governorate || '') !== filterGovernorateList) return false;
    }
    if (filterAreaList) {
      if (!cust || normalizeArabic(cust.area || '') !== filterAreaList) return false;
    }

    const q = searchInvoice.toLowerCase();
    const textMatch = 
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (cust && cust.name.toLowerCase().includes(q)) ||
      (cust && cust.area.toLowerCase().includes(q));
      
    if (!textMatch) return false;
    
    if (dateFilter === 'all') return true;
    
    const invDate = new Date(inv.date);
    const now = new Date();
    
    if (dateFilter === 'today') {
      return invDate.toDateString() === now.toDateString();
    }
    if (dateFilter === 'week') {
      const jsDay = invDate.getDay();
      const weekIdx = jsDay === 6 ? 0 : jsDay + 1;
      const msInDay = 86400000;
      const daysSinceSaturday = (weekIdx + 7) % 7;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - daysSinceSaturday);
      weekStart.setHours(0, 0, 0, 0);
      if (invDate.getTime() < weekStart.getTime()) return false;
      if (weekDayFilter.length > 0) {
        const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(invDate);
        if (!weekDayFilter.includes(englishDay)) return false;
      }
      return true;
    }
    if (dateFilter === 'month') {
      return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
    }
    
    return true;
  });

  useEffect(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      const currentPerm = activeSubTab === 'create' ? 'invoice_create' : 'invoice_balance';
      if (!permittedSubTabs.includes(currentPerm)) {
        if (permittedSubTabs.includes('invoice_create')) setActiveSubTab('create');
        else if (permittedSubTabs.includes('invoice_balance')) setActiveSubTab('archive');
      }
    }
  }, [permittedSubTabs, activeSubTab]);

  const filteredArchiveList = [...filteredInvoices].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  const MONTH_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; headerBg: string; headerBorder: string }> = {
    '01': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-600', headerBg: 'bg-gradient-to-l from-blue-50 to-blue-100/60', headerBorder: 'border-blue-300' },
    '02': { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', badge: 'bg-violet-600', headerBg: 'bg-gradient-to-l from-violet-50 to-violet-100/60', headerBorder: 'border-violet-300' },
    '03': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-600', headerBg: 'bg-gradient-to-l from-emerald-50 to-emerald-100/60', headerBorder: 'border-emerald-300' },
    '04': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-600', headerBg: 'bg-gradient-to-l from-amber-50 to-amber-100/60', headerBorder: 'border-amber-300' },
    '05': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', badge: 'bg-rose-600', headerBg: 'bg-gradient-to-l from-rose-50 to-rose-100/60', headerBorder: 'border-rose-300' },
    '06': { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', badge: 'bg-cyan-600', headerBg: 'bg-gradient-to-l from-cyan-50 to-cyan-100/60', headerBorder: 'border-cyan-300' },
    '07': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-600', headerBg: 'bg-gradient-to-l from-orange-50 to-orange-100/60', headerBorder: 'border-orange-300' },
    '08': { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', badge: 'bg-teal-600', headerBg: 'bg-gradient-to-l from-teal-50 to-teal-100/60', headerBorder: 'border-teal-300' },
    '09': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800', badge: 'bg-pink-600', headerBg: 'bg-gradient-to-l from-pink-50 to-pink-100/60', headerBorder: 'border-pink-300' },
    '10': { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-800', badge: 'bg-lime-600', headerBg: 'bg-gradient-to-l from-lime-50 to-lime-100/60', headerBorder: 'border-lime-300' },
    '11': { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-800', badge: 'bg-fuchsia-600', headerBg: 'bg-gradient-to-l from-fuchsia-50 to-fuchsia-100/60', headerBorder: 'border-fuchsia-300' },
    '12': { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', badge: 'bg-sky-600', headerBg: 'bg-gradient-to-l from-sky-50 to-sky-100/60', headerBorder: 'border-sky-300' },
  };

  const availableMonths = useMemo(() => {
    const monthMap = new Map<string, { count: number; totalAmount: number; totalPaid: number; totalRemaining: number }>();
    filteredArchiveList.forEach(inv => {
      const d = new Date(inv.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { count: 0, totalAmount: 0, totalPaid: 0, totalRemaining: 0 };
      existing.count += 1;
      const invTotal = inv.totalAfterDiscount || 0;
      const invPaid = inv.paidAmount ?? invTotal;
      existing.totalAmount += invTotal;
      existing.totalPaid += invPaid;
      existing.totalRemaining += invTotal - invPaid;
      monthMap.set(key, existing);
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, info]) => ({ key, ...info }));
  }, [filteredArchiveList]);

  const filteredArchiveListByMonth = useMemo(() => {
    if (!expandedMonth) return filteredArchiveList;
    return filteredArchiveList.filter(inv => {
      const d = new Date(inv.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === expandedMonth;
    });
  }, [filteredArchiveList, expandedMonth]);

  // Separate debtors list with its own filters
  const filteredDebtorsList = useMemo(() => {
    let result = invoices.filter(inv => {
      const dTime = new Date(inv.date).getTime();
      const isOld = !isNaN(dTime) && Date.now() - dTime > 48 * 60 * 60 * 1000;
      if (inv.isDelivered === false && !isOld) return false;
      const remaining = (inv.totalAfterDiscount || 0) - (inv.paidAmount ?? (inv.totalAfterDiscount || 0));
      return remaining > 0.05;
    });

    result = result.filter(inv => {
      const cust = customers.find(c => c.id === inv.customerId);
      if (debtorGov !== 'all') {
        if (!cust || normalizeArabic(cust.governorate || '') !== debtorGov) return false;
      }
      if (debtorArea !== 'all') {
        if (!cust || normalizeArabic(cust.area || '') !== debtorArea) return false;
      }
      if (debtorCustomer !== 'all') {
        if (inv.customerId !== debtorCustomer) return false;
      }
      if (debtorDelegate !== 'all') {
        if (inv.delegatePhone !== debtorDelegate) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, customers, debtorGov, debtorArea, debtorCustomer, debtorDelegate]);


  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 text-right" dir="rtl" id="invoice-tab-container">
      {/* Header */}
      <div 
        className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky z-[40] shadow-md flex items-center justify-between"
        style={{ top: 'var(--header-offset, 56px)' }}
      >
        <div className="flex items-center gap-2">
          <Receipt className="h-6 w-6 text-indigo-200" />
          <h1 className="text-xl font-bold">الفواتير والأرشيف</h1>
        </div>
        <button
          onClick={onGoBack}
          className="bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 active:scale-95 text-white rounded-lg py-1.5 px-3.5 text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>الرئيسية</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-xl mx-auto p-4 flex flex-col gap-4">

        {(() => {
          const showCreate = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('invoice_create');
          const showBalance = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('invoice_balance');
          return (
            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 gap-2 shadow-xs text-center select-none">
              {showCreate && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('create')}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all duration-150 cursor-pointer ${
                    activeSubTab === 'create'
                      ? 'bg-white text-indigo-900 border border-slate-200/60 shadow-xs scale-[1.01]'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                  }`}
                >
                  <span className="ml-1 text-sm">📝</span> إصدار الفواتير
                </button>
              )}
              {showBalance && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('archive')}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all duration-150 cursor-pointer ${
                      activeSubTab === 'archive'
                        ? 'bg-indigo-700 text-white shadow-md scale-[1.01] border-transparent'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                    }`}
                  >
                    <span className="ml-1 text-sm">🗄️</span> أرشيف الفواتير
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('debtors')}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all duration-150 cursor-pointer ${
                      activeSubTab === 'debtors'
                        ? 'bg-rose-600 text-white shadow-md scale-[1.01] border-transparent'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                    }`}
                  >
                    <span className="ml-1 text-sm">⚠️</span> عميل مديون
                  </button>
                </>
              )}
            </div>
          );
        })()}
        
        {activeSubTab === 'create' && (
          <>
            {editingInvoiceId && (
              <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-3 shadow-xs animate-fade-in mb-1">
                <div className="text-right">
                  <h4 className="font-extrabold text-amber-950 text-xs">⚠️ أنت الآن في وضع تعديل الفاتورة رقم #{invoices.find(v => v.id === editingInvoiceId)?.invoiceNumber}</h4>
                  <p className="text-[11px] text-amber-800 mt-1 font-bold">يمكنك تعديل الأصناف، والكميات، والمسدد، ثم الضغط على "حفظ وإصدار" بالأسفل لتحديث الفاتورة.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEditActiveInvoice}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-1.5 px-3.5 rounded-lg text-[10px] transition-colors cursor-pointer shrink-0"
                >
                  إلغاء التعديل ❌
                </button>
              </div>
            )}

            {/* Step 1: Customer Selection */}
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col gap-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#2B6CB0] mb-1">المحافظة (لتسهيل البحث)</label>
              <select
                value={filterGovernorate}
                onChange={(e) => {
                  setFilterGovernorate(e.target.value);
                  setFilterArea('');
                  setSelectedCustomerId('');
                }}
                className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#1A365D]"
              >
                <option value="">كل المحافظات</option>
                {availableGovernorates.map(gov => (
                  <option key={gov} value={gov}>{gov}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2B6CB0] mb-1">المنطقة</label>
              <select
                value={filterArea}
                onChange={(e) => {
                  setFilterArea(e.target.value);
                  setSelectedCustomerId('');
                }}
                className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#1A365D]"
              >
                <option value="">كل المناطق</option>
                {availableAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2B6CB0] mb-1">العميل</label>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#1A365D]"
              >
                <option value="">-- اضغط للاختيار --</option>
                {filteredCustomersByArea.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.area})</option>
                ))}
              </select>
              {selectedCustomerId && (customerCredits[selectedCustomerId] || 0) > 0 && (
                <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-amber-800">💳 رصيد دائن متاح:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-amber-700">{formatNum(customerCredits[selectedCustomerId])} ج.م</span>
                    <button
                      type="button"
                      onClick={() => {
                        const credit = customerCredits[selectedCustomerId] || 0;
                        const newPaid = Math.max(0, Math.round(totals.after - credit));
                        setCustomPaidAmount(String(newPaid));
                        setAppliedCreditAmount(credit);
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded text-[9px] font-black cursor-pointer active:scale-95 transition-all"
                    >
                      تطبيق
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isManager && (
              <div>
                <label className="block text-xs font-bold text-[#2B6CB0] mb-1">المندوب</label>
                <select
                  value={invoiceDelegatePhone}
                  onChange={(e) => setInvoiceDelegatePhone(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#1A365D]"
                >
                  <option value="">-- اختر المندوب --</option>
                  {invoiceDelegates.filter(d => d.phone !== 'مجهول' && d.phone !== currentUser?.phone).map(d => (
                    <option key={d.phone} value={d.phone}>{d.name} ({d.phone})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-[#2B6CB0] mb-1">التاريخ</label>
              <input
                type="datetime-local"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs text-center font-semibold focus:ring-2 focus:ring-indigo-500 font-mono text-[#1A365D]"
              />
            </div>
          </div>

          {selectedCustomer && (
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex flex-col gap-1.5 text-xs font-medium text-[#1A365D] mt-2">
              <span className="flex items-center gap-1.5 text-indigo-950">
                <MapPin className="h-4 w-4 text-[#DD6B20] shrink-0" />
                منطقة عمل العميل: <strong className="text-[#1A365D] font-bold">{selectedCustomer.area}</strong>
              </span>
              <div className="flex justify-between items-center text-[11px] text-[#2B6CB0] border-t border-indigo-50 pt-1.5 mt-1">
                <div className="flex items-center gap-1">
                  <span>رقم الهاتف:</span>
                  <SecurePhoneDisplay phone={selectedCustomer.phone} enableWhatsApp={false} className="inline font-bold" />
                </div>
                {selectedCustomer.locationLink && (
                  <a
                    href={selectedCustomer.locationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1A365D] font-bold hover:underline flex items-center gap-1 bg-[#FFFFFF] p-1 px-2 rounded border border-indigo-200"
                  >
                    <span>فتح الموقع 🗺️</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Item Selection and Weights */}
        <form onSubmit={handleAddItem} className="bg-[#FFFFFF] p-5 rounded-2xl border border-sky-100 shadow-sm flex flex-col gap-4">
          {/* Loaded Products Shortcuts */}
          <div className="bg-[#F7FAFC] p-3.5 rounded-xl border border-slate-200">
            <span className="block text-xs font-bold text-[#1A365D] mb-2">📦 بضائع السيارة المحملة حالياً:</span>
            {loadedProductsUniqueList.length === 0 ? (
              <p className="text-[11px] text-gray-400 font-bold text-center py-1">السيارة فارغة تماماً، لم يتم تحميل حمولات بعد.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {loadedProductsUniqueList.map((prod, idx) => {
                  const isSelected = currentProductId === prod.id;
                  const weights = getProductWeightsFallback(prod);
                  const availableWeights = weights.filter(w => (weightStocks[`${prod.id}_${w.id}`]?.remaining ?? 0) > 0);
                  const sizesStr = availableWeights.map(w => w.size).join(' - ');
                  const totalRemaining = availableWeights.reduce((sum, w) => sum + (weightStocks[`${prod.id}_${w.id}`]?.remaining ?? 0), 0);
                  const firstW = availableWeights[0] || weights[0];
                  const unitsPerC = firstW?.unitsPerCarton || 12;
                  const remCartons = Math.floor(totalRemaining / unitsPerC);
                  const remUnits = totalRemaining % unitsPerC;
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCurrentProductId(prod.id);
                        if (firstW) {
                          setCurrentWeightId(firstW.id);
                        }
                        setTimeout(() => {
                           document.getElementById('qty-input')?.focus();
                        }, 50);
                      }}
                      className={`flex flex-col items-center justify-center text-center p-2 rounded-xl border text-xs transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50 text-[#1A365D] border-b-2 border-amber-500 shadow-xs'
                          : 'bg-[#FFFFFF] hover:bg-[#F7FAFC] text-[#1A365D] border-slate-200'
                      }`}
                    >
                      <span className="font-extrabold truncate text-center w-full">{prod.name}</span>
                      <span className="text-[9px] text-indigo-600 font-black mt-0.5 truncate w-full">المتبقي: {remCartons} ك {remUnits > 0 ? `و ${remUnits} ع` : ''}</span>
                      {sizesStr && <span className="text-[8px] text-[#DD6B20] font-bold mt-0.5 truncate w-full">{sizesStr}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-[#2B6CB0]">المنتج</label>
                <button
                  type="button"
                  onClick={() => setIsScanningBarcode(true)}
                  className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ScanLine className="h-3 w-3" /> مسح باركود
                </button>
              </div>
              <div className="relative">
                <select
                  required
                  value={currentProductId}
                  onChange={(e) => {
                    const newProductId = e.target.value;
                    setCurrentProductId(newProductId);
                    if (newProductId) {
                      const prod = products.find(p => p.id === newProductId);
                      if (prod) {
                        const weights = getProductWeightsFallback(prod);
                        const firstAvail = weights.find(w => (weightStocks[`${newProductId}_${w.id}`]?.remaining ?? 0) > 0) || weights[0];
                        if (firstAvail) {
                          setCurrentWeightId(firstAvail.id);
                        } else {
                          setCurrentWeightId('');
                        }
                      } else {
                        setCurrentWeightId('');
                      }
                    } else {
                      setCurrentWeightId('');
                    }
                  }}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#1A365D]"
                >
                  <option value="">-- اختر السلعة --</option>
                  {products.filter(p => {
                    const weights = getProductWeightsFallback(p);
                    return weights.some(w => (weightStocks[`${p.id}_${w.id}`]?.remaining ?? 0) > 0);
                  }).map(p => {
                    const weights = getProductWeightsFallback(p);
                    const totalRemaining = weights.reduce((sum, w) => sum + (weightStocks[`${p.id}_${w.id}`]?.remaining ?? 0), 0);
                    const unitsPerC = weights[0]?.unitsPerCarton || 12;
                    const remCartons = Math.floor(totalRemaining / unitsPerC);
                    const remUnits = totalRemaining % unitsPerC;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} — المتبقي: {remCartons} ك {remUnits > 0 ? `و ${remUnits} ع` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {currentProductId && activeProductWeights.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1 bg-[#F7FAFC] p-3 rounded-xl border border-slate-150">
                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1 flex items-center gap-1">
                    <Scale className="h-3.5 w-3.5 text-[#2B6CB0]" />
                    السعة اللترية أو الوزن المتوفر:
                  </label>
                  <select
                    required
                    value={currentWeightId}
                    onChange={(e) => setCurrentWeightId(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none text-[#1A365D]"
                  >
                    <option value="">-- اختر السعة / الوزن --</option>
                    {activeProductWeights.map(w => {
                      const stockVal = weightStocks[`${currentProductId}_${w.id}`]?.remaining ?? 0;
                      const stockText = formatCartonsAndPieces(stockVal, w.unitsPerCarton || 12);
                      return (
                        <option key={w.id} value={w.id}>
                          {w.size} (الرصيد: {stockText})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2 bg-[#EEF2F6] p-2 rounded-xl border border-slate-200 mt-1 flex flex-col gap-1.5" dir="rtl">
                  <span className="text-[10px] sm:text-xs font-black text-indigo-950 block">وحدة البيع وحساب الأسعار:</span>
                  <div className="flex bg-white p-0.5 rounded-lg border border-slate-200-xs">
                    <button
                      type="button"
                      onClick={() => setSellUnitType('carton')}
                      className={`flex-1 py-1 px-2.5 text-[10px] sm:text-xs font-black rounded-md cursor-pointer transition-all ${
                        sellUnitType === 'carton' ? 'bg-[#1A365D] text-white shadow-sm' : 'text-slate-400 hover:text-slate-650'
                      }`}
                    >
                      بالكرتونة 📦
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellUnitType('piece')}
                      className={`flex-1 py-1 px-2.5 text-[10px] sm:text-xs font-black rounded-md cursor-pointer transition-all ${
                        sellUnitType === 'piece' ? 'bg-[#1A365D] text-white shadow-sm' : 'text-slate-400 hover:text-slate-650'
                      }`}
                    >
                      بالقطعة 🥛
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">
                    الكمية المطلوبة ({sellUnitType === 'carton' ? (products.find(p => p.id === currentProductId)?.accountingUnit || 'كرتونة') : 'قطعة'}):
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    id="qty-input"
                    value={currentQty}
                    onChange={(e) => setCurrentQty(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold text-center text-[#1A365D]"
                  />
                </div>

                <div className="col-span-1 mt-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">الخصم</label>
                  <select
                    required
                    value={currentDiscount}
                    onChange={(e) => setCurrentDiscount(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none text-[#1A365D]"
                  >
                    <option value="0">بدون خصم (0%)</option>
                    <option value="1">خصم (1%)</option>
                    <option value="1.25">خصم (1.25%)</option>
                    <option value="1.5">خصم (1.5%)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!currentProductId || !currentWeightId || isAddingItem}
            className="w-full bg-indigo-100 disabled:bg-slate-150 disabled:text-gray-400 text-[#1A365D] rounded-xl py-2.5 text-xs font-extrabold hover:bg-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-200"
          >
            <Plus className="h-4 w-4" />
            <span>اضافة</span>
          </button>
        </form>

        {/* Draft Bill Items List & Calculations */}
        <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-[#1A365D] text-sm border-b border-slate-100 pb-2 flex items-center justify-between">
            <span>محتويات الفاتورة الحالية ({billItems.filter(i => i.quantity > 0).length})</span>
            <div className="flex items-center gap-2">
              {selectedCustomerId && (
                <button
                  type="button"
                  onClick={() => setShowCustomerInvoices(true)}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  مرتجعات / فواتير سابقة
                </button>
              )}
              {totals.after > 0 && <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold py-0.5 px-2 rounded-lg">قيد التحضير</span>}
            </div>
          </h3>

          <div className="flex flex-col gap-2.5">
            {(() => {
              const salesItems = billItems.filter(i => i.quantity > 0);
              const returnItems = billItems.filter(i => i.quantity < 0);
              const totalSales = salesItems.reduce((s, i) => s + ((i.finalPrice || 0) * i.quantity), 0);
              const totalReturns = returnItems.reduce((s, i) => s + ((i.finalPrice || 0) * Math.abs(i.quantity)), 0);
              return (
                <>
                  {/* Sales Items */}
                  {salesItems.length === 0 && returnItems.length === 0 ? (
                    <p className="text-center text-gray-400 py-10 text-xs">لا توجد أصناف مضافة في الفاتورة الحالية بعد.</p>
                  ) : (
                    <>
                      {salesItems.map((item, index) => {
                        const prod = products.find(p => String(p.id).trim() === String(item.productId).trim());
                        const weights = prod ? getProductWeightsFallback(prod) : [];
                        const weight = weights.find(w => String(w.id).trim() === String(item.weightId).trim()) || weights[0];
                        const itemTotal = item.finalPrice * item.quantity;
                        const fpPerUnit = getItemFactoryCost(item, weight, prod);
                        const itemProfit = ((item.finalPrice || 0) - fpPerUnit) * (item.quantity || 0);
                        const multiplier = weight ? (weight.unitsPerCarton || 12) : 12;
                        const qtyLabel = formatCartonsAndPieces(item.quantity, multiplier);
                        const cartonFinalPrice = item.finalPrice * multiplier;
                        return (
                          <div key={index} className="bg-[#F7FAFC] border border-slate-150 p-3 rounded-xl flex items-center justify-between gap-2.5">
                            <div className="flex flex-col gap-1 text-xs">
                              <span className="font-black text-[#1A365D]">{prod ? prod.name : 'منتج غير معروف'} ({weight ? weight.size : 'حجم عادي'})</span>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#2B6CB0] font-medium" dir="rtl">
                                <span>البيان: <strong className="text-[#1A365D] font-black">{qtyLabel} {formatNum(cartonFinalPrice)} ج.م</strong></span>
                                {item.discountPercent > 0 && <span className="text-rose-600 text-[10px] font-bold">(خصم {item.discountPercent}%)</span>}
                                <span>•</span>
                                <span>الصافي: <strong className="text-[#DD6B20] font-extrabold">{formatNum(itemTotal)} ج.م</strong></span>
                                <span>•</span>
                                <span className={`font-bold text-[10px] ${itemProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  هامش: {formatNum(itemProfit)} ج
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" disabled={isDuplicating} onClick={() => handleDuplicateDraftItem(index)} className="text-sky-500 hover:bg-sky-50 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50" title="تكرار الصنف"><Copy className="h-4 w-4" /></button>
                              <button type="button" onClick={() => handleRemoveDraftItem(index)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer" title="حذف الصنف من القائمة"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                        );
                      })}
                      {/* Returns Section */}
                      {returnItems.length > 0 && (
                        <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-3">
                          <h4 className="text-[11px] font-black text-rose-700 mb-2 flex items-center gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5" />
                            المرتجعات ({returnItems.length})
                          </h4>
                          <div className="flex flex-col gap-2">
                            {returnItems.map((item, index) => {
                              const prod = products.find(p => String(p.id).trim() === String(item.productId).trim());
                              const weights = prod ? getProductWeightsFallback(prod) : [];
                              const weight = weights.find(w => String(w.id).trim() === String(item.weightId).trim()) || weights[0];
                              const qty = Math.abs(item.quantity);
                              const val = (item.finalPrice || 0) * qty;
                              const multiplier = weight ? (weight.unitsPerCarton || 12) : 12;
                              const qtyLabel = formatCartonsAndPieces(qty, multiplier);
                              return (
                                <div key={index} className="flex items-center justify-between bg-white rounded-lg p-2 border border-rose-100 text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-700">{prod?.name || item.productName} - {weight?.size || item.weightSize}</span>
                                    <span className="text-slate-400">×</span>
                                    <span className="text-rose-600 font-black">{qtyLabel}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="font-black text-rose-700">{formatNum(Math.round(val))} ج.م</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const origIdx = billItems.indexOf(item);
                                        if (origIdx >= 0) handleRemoveDraftItem(origIdx);
                                      }}
                                      className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-lg transition-colors cursor-pointer"
                                      title="حذف المرتجع"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-xs font-black text-rose-800 mt-2 pt-2 border-t border-rose-200">
                            <span>إجمالي المرتجعات</span>
                            <span>- {formatNum(Math.round(totalReturns))} ج.م</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>

          {/* Calculations section */}
          {billItems.length > 0 && (() => {
            const salesItems = billItems.filter(i => i.quantity > 0);
            const returnItems = billItems.filter(i => i.quantity < 0);
            const totalSales = salesItems.reduce((s, i) => s + ((i.finalPrice || 0) * i.quantity), 0);
            const totalReturns = returnItems.reduce((s, i) => s + ((i.finalPrice || 0) * Math.abs(i.quantity)), 0);
            const netTotal = totalSales - totalReturns;
            return (
            <div className="border-t border-slate-150 pt-4 flex flex-col gap-2 text-xs text-[#2B6CB0]">
              {totalReturns > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span>إجمالي الفاتورة قبل المرتجع:</span>
                    <span className="font-semibold text-[#1A365D]">{formatNum(totalSales)} ج.م</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>المرتجعات:</span>
                    <span>- {formatNum(Math.round(totalReturns))} ج.م</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-[#1A365D] border-t border-slate-200 pt-1">
                    <span>إجمالي الفاتورة بعد المرتجع:</span>
                    <span>{formatNum(Math.round(netTotal))} ج.م</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>الإجمالي:</span>
                  <span className="font-semibold text-[#1A365D]">{formatNum(totals.before)} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-[#DD6B20] font-bold">
                <span>إجمالي الخصومات:</span>
                <span>-{formatNum(totals.discount)}ج.م</span>
              </div>
              {(() => {
                const totalFactoryCost = billItems.reduce((sum, it) => {
                  const p = products.find(pp => String(pp.id).trim() === String(it.productId).trim());
                  const ws = p ? getProductWeightsFallback(p) : [];
                  const w = ws.find(ww => String(ww.id).trim() === String(it.weightId).trim()) || ws[0];
                  return sum + (getItemFactoryCost(it, w, p) * (it.quantity || 0));
                }, 0);
                const totalProfit = totals.after - totalFactoryCost;
                return (
                  <div className={`flex justify-between font-bold ${totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    <span>صافي الربح:</span>
                    <span className="text-sm font-black">{formatNum(totalProfit)}ج.م</span>
                  </div>
                );
              })()}
              <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-slate-150">
                <div className="flex justify-between items-center text-sm font-black text-[#1A365D] border-b border-slate-100 pb-2">
                   <span>المسدد:</span>
                   <div className="flex items-center gap-1 bg-[#FFFFFF] border border-slate-200 rounded p-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-24 text-center font-bold text-[#DD6B20] focus:outline-none"
                      placeholder={formatNum(totals.after)}
                      value={customPaidAmount}
                      onChange={(e) => setCustomPaidAmount(e.target.value)}
                    />
                    <span className="text-xs text-[#2B6CB0] font-normal">ج.م</span>
                  </div>
                </div>
                <div className="flex justify-between text-amber-600 font-bold items-baseline pb-1">
                   <span>المتبقي:</span>
                   <span className="text-sm font-extrabold">
                    {formatNum(Math.max(0, totals.after - (customPaidAmount !== '' ? parseFloat(customPaidAmount) || 0 : totals.after)))}ج.م
                  </span>
                </div>
              </div>

              {!extraDiscountApplied && (
                <div className="mt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (discountClicks < 3) {
                        showToast("⚠️ غير مصرح لك بتطبيق الخصم الإضافي!");
                        setDiscountClicks(prev => prev + 1);
                      } else {
                        setShowPwd(true);
                      }
                    }}
                    className="text-[10px] text-gray-400 self-end hover:text-[#2B6CB0] cursor-pointer"
                  >
                    إضافة خصم إضافي خاص
                  </button>

                  {showPwd && (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="كلمة المرور"
                        value={discountPwd}
                        onChange={(e) => setDiscountPwd(e.target.value)}
                        className="flex-1 bg-[#FFFFFF] border border-slate-200 rounded p-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (discountPwd === '333') {
                            setExtraDiscountApplied(true);
                            setShowPwd(false);
                            setDiscountClicks(0);
                            setDiscountPwd('');
                          } else {
                            showToast("⚠️ الرمز السري غير صحيح!");
                          }
                        }}
                        className="bg-[#1A365D] text-white border-transparent text-white px-2 py-1 rounded text-xs"
                      >
                        تأكيد
                      </button>
                    </div>
                  )}
                </div>
              )}

              {extraDiscountApplied && (
                <div className="mt-2 bg-amber-50 p-2 rounded border border-amber-200 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-amber-800 mb-0.5">قيمة الخصم الإضافي (جنية)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={extraDiscountAmount}
                        onChange={(e) => setExtraDiscountAmount(e.target.value)}
                        className="w-full bg-[#FFFFFF] border border-amber-200 rounded p-1 text-xs"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-amber-800 mb-0.5">سبب الخصم الإضافي</label>
                      <input
                        type="text"
                        placeholder="السبب"
                        value={extraDiscountReason}
                        onChange={(e) => setExtraDiscountReason(e.target.value)}
                        className="w-full bg-[#FFFFFF] border border-amber-200 rounded p-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">رقم الفاتورة (اختياري)</label>
                  <input
                    type="text"
                    placeholder={`تلقائي: INV-${1000 + invoices.length + 1}`}
                    value={manualInvoiceNumber}
                    onChange={(e) => setManualInvoiceNumber(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 font-bold text-[#1A365D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">ملاحظات</label>
                  <input
                    type="text"
                    placeholder="مثال: تم التوصيل للمتجر"
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (currentProductId && parseInt(currentQty) > 0) {
                      showToast('⚠️ يرجى إضافة الصنف قيد الإدخال للفاتورة أولاً.');
                      return;
                    }
                    const previewInv = {
                      invoiceNumber: manualInvoiceNumber.trim() ? manualInvoiceNumber.trim() : `مبدئية`,
                      customerId: selectedCustomerId,
        date: invoiceDate ? new Date(invoiceDate).toISOString() : nowEgyptISO(),
                      items: billItems,
                      totalBeforeDiscount: Number(totals.before.toFixed(2)),
                      totalAfterDiscount: Number(totals.after.toFixed(2)),
                      paidAmount: customPaidAmount !== '' ? parseFloat(customPaidAmount) : totals.after,
                      customer: customers.find(c => c.id === selectedCustomerId),
                      _isPreview: true
                    };
                    setJustSavedInvoice(previewInv)
                  }}
                  disabled={billItems.length === 0 || !selectedCustomerId}
                  className="w-full bg-[#FFFFFF] border-2 border-[#1A365D] text-[#1A365D] rounded-xl py-3 text-sm font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye className="h-5 w-5" />
                  <span>معاينة للعميل</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveInvoice}
                  disabled={isSaving}
                  className="w-full bg-[#DD6B20] text-white rounded-xl py-3 text-sm font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-[#C05621] disabled:opacity-50"
                >
                  <Save className="h-5 w-5" />
                  <span>حفظ وإصدار</span>
                </button>
              </div>
            </div>
          );
        })()}

          {/* Active (Pending Delivery) Invoices List */}
          {activeSubTab === 'create' && (() => {
            const activeInvs = invoices.filter(inv => {
              if (inv.isDelivered) return false;
              // نظام حماية: إخفاء الفواتير المعلقة التي مر عليها أكثر من 48 ساعة تلقائياً ونقلها للأرشيف لمنع التراكم
              const dTime = new Date(inv.date).getTime();
              if (!isNaN(dTime) && Date.now() - dTime > 48 * 60 * 60 * 1000) {
                return false;
              }
              return true;
            });
            if (activeInvs.length === 0) return null;
            return (
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border-2 border-dashed border-sky-200 shadow-xs flex flex-col gap-4 mt-4 animate-fade-in text-right" dir="rtl">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5">
                    <span className="animate-ping h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                    الفواتير النشطة قيد التسليم ({activeInvs.length})
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold">يمكنك تعديل أو حذف الفاتورة حتى تأكيد استلامها فتنقل للارشيف</span>
                </div>
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
                  {activeInvs.map((inv, idx) => {
                    const cust = customers.find(c => c.id === inv.customerId);
                    return (
                      <div key={`${inv.id}_${idx}`} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2.5 text-right">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-[#1A365D]">{cust?.name || 'عميل مجهول'} ({cust?.area || 'بدون منطقة'})</span>
                          <span className="font-black text-[#DD6B20] bg-orange-50 px-2 py-0.5 rounded-md">#{inv.invoiceNumber}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-500">
                          <span>الإجمالي بعد الخصم: <strong className="text-emerald-700">{formatNum(inv.totalAfterDiscount)} ج.م</strong></span>
                          <span>المحصل الفعلي: <strong className="text-blue-700">{formatNum(inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount)} ج.م</strong></span>
                          <span>متبقي المديونية: <strong className="text-red-700">{formatNum(inv.totalAfterDiscount - (inv.paidAmount !== undefined ? inv.paidAmount : inv.totalAfterDiscount))} ج.م</strong></span>
                        </div>

                        <div className="text-[10px] bg-white p-2 rounded-lg border border-slate-150 flex flex-col gap-1 max-h-24 overflow-y-auto">
                          <span className="font-bold text-gray-400">البضاعة بالفاتورة:</span>
                          {inv.items.map((it, idx) => {
                        const p = products.find(prod => String(prod.id).trim() === String(it.productId).trim());
                        const ws = p ? getProductWeightsFallback(p) : [];
                        const w = ws.find(wt => String(wt.id).trim() === String(it.weightId).trim()) || ws[0];
                            const multiplier = w?.unitsPerCarton || 12;
                            const cartons = formatCartonsAndPieces(it.quantity, multiplier);
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="font-medium text-slate-700">- {p?.name} ({w?.size || 'أساسي'})</span>
                                <span className="font-black text-indigo-900">{cartons}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-1">
                          {isManager && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInvoiceId(inv.id);
                              setSelectedCustomerId(inv.customerId);
                              const cust = customers.find(c => c.id === inv.customerId);
                              if (cust) {
                                setFilterGovernorate(cust.governorate || '');
                                setFilterArea(cust.area || '');
                              }
                              let dStr = '';
                              const parsed = new Date(inv.date);
                              if (!isNaN(parsed.getTime())) {
                                dStr = parsed.toISOString().substring(0, 16);
                              }
                              setInvoiceDate(dStr);
                              setBillItems(inv.items);
                              setInvoiceNotes(inv.notes || '');
                              setCustomPaidAmount(inv.paidAmount !== undefined ? inv.paidAmount.toString() : inv.totalAfterDiscount.toString());
                              setManualInvoiceNumber(inv.invoiceNumber);
                              window.scrollTo({ top: 300, behavior: 'smooth' });
                            }}
                            className="bg-sky-50 shadow-xs hover:bg-sky-100 text-sky-700 font-extrabold rounded-lg py-2 text-[11px] border border-sky-200 cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center gap-1"
                          >
                            ✍️ تعديل
                          </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteInvoice(inv.id);
                            }}
                            className="bg-rose-50 shadow-xs hover:bg-rose-100 text-rose-700 font-extrabold rounded-lg py-2 text-[11px] border border-rose-200 cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center gap-1"
                          >
                            🗑️ حذف
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (await confirmDialog(`تأكيد استلام وتسليم الفاتورة #${inv.invoiceNumber} وأرشفتها رسمياً؟`)) {
                                onUpdateInvoice({
                                  ...inv,
                                  isDelivered: true
                                });
                              }
                            }}
                            className="bg-emerald-600 shadow-sm hover:bg-emerald-700 text-white font-extrabold rounded-lg py-2 text-[11px] cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center gap-1"
                          >
                            ✅ تم التسليم
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

      {/* Success Modal - Offers Download Receipt Image & WhatsApp Share */}
          </>
        )}

        {(activeSubTab === 'archive' || activeSubTab === 'debtors') && (
          <div className="flex flex-col gap-4">
            
            {/* Archive Filter Panel */}
            {activeSubTab === 'archive' && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
              
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600 border border-indigo-100">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                    </svg>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-black text-slate-800">البحث المتقدم وتصفية الحركات</span>
                  </div>
                </div>
                
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedInvoiceGov('all');
                    setSelectedInvoiceArea('all');
                    setSelectedInvoiceCustomer('all');
                    setSelectedInvoiceDelegate('all');
                    setInvoiceFilterDate(getEgyptTodayDate());
                    setSearchInvoice('');
                    setExpandedMonth(null);
                  }}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100/70 transition-all active:scale-95 cursor-pointer"
                >
                  إعادة تعيين
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 items-end">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-xs"></span>
                    المحافظة <span className="text-[9px] text-slate-400 font-bold">(لتسهيل البحث)</span>
                  </label>
                  <select 
                    value={selectedInvoiceGov}
                    onChange={(e) => {
                      setSelectedInvoiceGov(e.target.value);
                      setSelectedInvoiceArea('all');
                      setSelectedInvoiceCustomer('all');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">كل المحافظات</option>
                    {listGovernorates.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-sky-500 rounded-full shadow-xs"></span>
                    المنطقة
                  </label>
                  <select 
                    value={selectedInvoiceArea}
                    onChange={(e) => {
                      setSelectedInvoiceArea(e.target.value);
                      setSelectedInvoiceCustomer('all');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">كل المناطق</option>
                    {listAreasFiltered.map(area => <option key={area} value={area}>{area}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-xs"></span>
                    العميل
                  </label>
                  <select 
                    value={selectedInvoiceCustomer}
                    onChange={(e) => setSelectedInvoiceCustomer(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">كل العملاء</option>
                    {listCustomersFiltered.map(cust => <option key={cust.id} value={cust.id}>{cust.name}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full shadow-xs"></span>
                    المندوب
                  </label>
                  <select 
                    value={selectedInvoiceDelegate}
                    onChange={(e) => setSelectedInvoiceDelegate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">كل المناديب</option>
                    {usersList && usersList.filter(u => u.role !== 'owner').map(u => (
                      <option key={u.phone} value={u.phone}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shadow-xs"></span>
                    تاريخ الفواتير المستهدفة بالبحث
                  </label>
                  <input 
                    type="date" 
                    value={invoiceFilterDate}
                    onChange={(e) => setInvoiceFilterDate(e.target.value)}
                    className="w-full bg-amber-50/40 border border-amber-200 rounded-xl p-3 text-xs font-black text-center text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all font-mono cursor-pointer"
                  />
                </div>

              </div>
            </div>
            )}

            {/* Debtors Filter Panel */}
            {activeSubTab === 'debtors' && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-5">
              
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-rose-50 p-2 rounded-xl text-rose-600 border border-rose-100">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                    </svg>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-black text-slate-800">تصفية العملاء المديونين</span>
                  </div>
                </div>
                
                <button 
                  type="button" 
                  onClick={() => {
                    setDebtorGov('all');
                    setDebtorArea('all');
                    setDebtorCustomer('all');
                    setDebtorDelegate('all');
                  }}
                  className="text-[10px] font-black text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100/70 transition-all active:scale-95 cursor-pointer"
                >
                  إعادة تعيين
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 items-end">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-xs"></span>
                    المحافظة
                  </label>
                  <select 
                    value={debtorGov}
                    onChange={(e) => {
                      setDebtorGov(e.target.value);
                      setDebtorArea('all');
                      setDebtorCustomer('all');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">كل المحافظات</option>
                    {listGovernorates.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-sky-500 rounded-full shadow-xs"></span>
                    المنطقة
                  </label>
                  <select 
                    value={debtorArea}
                    onChange={(e) => {
                      setDebtorArea(e.target.value);
                      setDebtorCustomer('all');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">كل المناطق</option>
                    {debtorListAreasFiltered.map(area => <option key={area} value={area}>{area}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-xs"></span>
                    العميل
                  </label>
                  <select 
                    value={debtorCustomer}
                    onChange={(e) => setDebtorCustomer(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">كل العملاء</option>
                    {debtorListCustomersFiltered.map(cust => <option key={cust.id} value={cust.id}>{cust.name}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full shadow-xs"></span>
                    المندوب
                  </label>
                  <select 
                    value={debtorDelegate}
                    onChange={(e) => setDebtorDelegate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">كل المناديب</option>
                    {usersList && usersList.filter(u => u.role !== 'owner').map(u => (
                      <option key={u.phone} value={u.phone}>{u.name}</option>
                    ))}
                  </select>
                </div>

              </div>
            </div>
            )}

            {/* Monthly Accordion Filter — archive only */}
            {activeSubTab === 'archive' && availableMonths.length > 0 && (
              <div className="flex flex-col gap-2.5 mt-1">
                {availableMonths.map(m => {
                  const [yr, mo] = m.key.split('-');
                  const monthNames: Record<string, string> = {
                    '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
                    '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
                    '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
                  };
                  const isExpanded = expandedMonth === m.key;
                  const colors = MONTH_COLORS[mo] || MONTH_COLORS['01'];
                  const hasDebt = m.totalRemaining > 0.05;

                  const monthInvoices = isExpanded ? filteredArchiveList.filter(inv => {
                    const d = new Date(inv.date);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === m.key;
                  }) : [];

                  return (
                    <div key={m.key} className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isExpanded ? `${colors.border} shadow-lg` : 'border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                      {/* Accordion Header */}
                      <button
                        type="button"
                        onClick={() => setExpandedMonth(isExpanded ? null : m.key)}
                        className={`w-full flex items-center justify-between p-3.5 cursor-pointer transition-all duration-200 ${isExpanded ? colors.headerBg : 'bg-white hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Month Color Badge */}
                          <div className={`${colors.badge} text-white w-10 h-10 rounded-xl flex flex-col items-center justify-center shadow-md`}>
                            <span className="text-[10px] font-black leading-none">{monthNames[mo]}</span>
                            <span className="text-[8px] font-bold opacity-80 leading-none mt-0.5">{yr}</span>
                          </div>
                          {/* Stats */}
                          <div className="flex flex-col items-start gap-0.5">
                            <span className={`text-sm font-black ${colors.text}`}>
                              {monthNames[mo]} {yr}
                              {isExpanded && <span className="text-[10px] font-bold opacity-60 mr-1">▼</span>}
                              {!isExpanded && <span className="text-[10px] font-bold opacity-60 mr-1">◀</span>}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                              <span>{m.count} فاتورة</span>
                              <span className="text-slate-300">|</span>
                              <span>إجمالي: {formatNum(m.totalAmount)} ج.م</span>
                              {hasDebt && (
                                <>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-rose-500">متبقي: {formatNum(m.totalRemaining)} ج.م</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Paid badge */}
                        <div className={`${colors.badge}/10 ${colors.text} px-2.5 py-1 rounded-lg text-[10px] font-black`}>
                          مسدد: {formatNum(m.totalPaid)} ج.م
                        </div>
                      </button>

                      {/* Accordion Body */}
                      {isExpanded && monthInvoices.length > 0 && (
                        <div className={`${colors.bg} border-t ${colors.border} p-3 flex flex-col gap-2`}>
                          {monthInvoices.map((inv, idx) => {
                            const cust = customers.find(c => c.id === inv.customerId);
                            const remaining = (inv.totalAfterDiscount || 0) - (inv.paidAmount ?? (inv.totalAfterDiscount || 0));
                            return (
                              <div
                                key={`${inv.id}_month_${idx}`}
                                className={`bg-white/80 backdrop-blur-sm p-3 rounded-xl border ${colors.border}/50 flex flex-col gap-1.5 text-xs`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`${colors.badge}/15 ${colors.text} py-0.5 px-2 rounded-md font-black text-[11px]`}>
                                      {cust ? cust.name : 'عميل غير محدد'}
                                    </span>
                                    {cust?.governorate && (
                                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {cust.governorate} - {cust.area}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                                    #{inv.invoiceNumber}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                  <div className="flex items-center gap-3 text-[10px] font-bold">
                                    <span className="text-[#1A365D]">إجمالي: {formatNum(inv.totalAfterDiscount)} ج.م</span>
                                    <span className="text-emerald-600">مسدد: {formatNum(inv.paidAmount ?? inv.totalAfterDiscount)} ج.م</span>
                                    {remaining > 0.05 && <span className="text-rose-500">متبقي: {formatNum(remaining)} ج.م</span>}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setSelectedInvoice(inv)}
                                      className="bg-[#1A365D] hover:bg-[#2B6CB0] text-white px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer active:scale-95 flex items-center gap-1 shadow-sm"
                                    >
                                      <Eye className="h-3 w-3" />
                                      التفاصيل
                                    </button>
                                    <button
                                      onClick={() => {
                                        setReturnForm({
                                          items: [],
                                          movementType: 'cash_refund',
                                          exchangeProductId: '',
                                          exchangeWeightId: '',
                                          exchangeQty: '0',
                                          exchangeUnitType: 'piece',
                                          exchangeSettlementMethod: 'cash',
                                          notes: ''
                                        });
                                        setReturnModal({ isOpen: true, invoice: inv });
                                      }}
                                      className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer active:scale-95 flex items-center gap-1 border border-rose-200"
                                    >
                                      <RefreshCw className="h-3 w-3" />
                                      مرتجعات
                                    </button>
                                    {isManager && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteInvoice(inv.id)}
                                      className="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer active:scale-95 flex items-center gap-1 border border-red-200"
                                    >
                                      🗑️ حذف
                                    </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invoices List item — debtors only (archive uses accordion) */}
            {activeSubTab === 'debtors' && (
            <div className="max-h-96 overflow-y-auto custom-scroll flex flex-col gap-2.5 mt-1">
                {filteredDebtorsList.length === 0 ? (
                  <p className="text-center text-gray-400 py-10 text-xs">لا توجد فواتير مديونين مطابقة.</p>
                ) : (
                  [...filteredDebtorsList].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((inv, idx) => {
                    const cust = customers.find(c => c.id === inv.customerId);
                    const remaining = inv.totalAfterDiscount - (inv.paidAmount ?? inv.totalAfterDiscount);
                    return (
                      <div 
                        key={`${inv.id}_${idx}`} 
                        className="p-3.5 bg-[#F7FAFC]/40 border border-slate-200 rounded-xl hover:bg-[#F7FAFC] hover:border-indigo-100 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex items-center justify-between font-bold text-[#1A365D]">
                            <div className="flex items-center gap-1.5">
                              <span className="bg-amber-100 text-[#DD6B20] py-0.5 px-2 rounded-md font-black text-xs">
                                {cust ? cust.name : 'عميل غير محدد'}
                              </span>
                            </div>
                            <span className="bg-indigo-100 text-[#1A365D] py-0.5 px-2 rounded-md font-black text-[10px]">
                              {inv.invoiceNumber}
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-1 text-[#2B6CB0] font-medium mt-1">
                            <div className="flex flex-wrap gap-x-2.5">
                              <span>المحافظة والمنطقة: <strong>{cust ? `${cust.governorate ? `${cust.governorate} - ` : ''}${cust.area}` : 'مجهولة'}</strong></span>
                              <span>•</span>
                              <span>التاريخ: {inv.date && !isNaN(new Date(inv.date).getTime()) ? new Date(inv.date).toLocaleDateString('ar-EG') : 'بدون تاريخ'}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 mt-2 bg-slate-50 p-2 rounded-xl text-[10.5px]">
                              <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-semibold text-slate-500">إجمالي قيمة الفاتورة:</span>
                                <strong className="text-[#1A365D] font-extrabold">{formatNum(inv.totalAfterDiscount)} ج.م</strong>
                              </div>
                              <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-semibold text-slate-500">المبلغ المسدد:</span>
                                <strong className="text-emerald-600 font-extrabold">{formatNum(inv.paidAmount ?? inv.totalAfterDiscount)} ج.م</strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-semibold text-slate-500">صافي المتبقي لصالحه:</span>
                                <strong className={remaining > 0 ? "text-rose-600 font-extrabold animate-pulse" : "text-slate-600 font-bold"}>
                                  {formatNum(remaining)} ج.م
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeSubTab === 'debtors' && (
                            <>
                              <button
                                onClick={() => {
                                  const remaining = inv.totalAfterDiscount - (inv.paidAmount ?? 0);
                                  setPaymentModal({
                                    isOpen: true,
                                    invoice: inv,
                                    type: 'partial',
                                    amount: '',
                                    paymentMethod: 'نقدي (كاش)'
                                  });
                                }}
                                className="bg-amber-100 border border-amber-250 p-2 text-amber-700 rounded-xl hover:bg-amber-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center font-bold text-[11px]"
                                title="تسديد دفعة (جزئي)"
                              >
                                <span className="font-extrabold px-1">جزئي</span>
                              </button>
                              <button
                                onClick={() => {
                                  const remaining = inv.totalAfterDiscount - (inv.paidAmount ?? 0);
                                  setPaymentModal({
                                    isOpen: true,
                                    invoice: inv,
                                    type: 'full',
                                    amount: String(remaining),
                                    paymentMethod: 'نقدي (كاش)'
                                  });
                                }}
                                className="bg-emerald-100 border border-emerald-250 p-2 text-emerald-700 rounded-xl hover:bg-emerald-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center font-bold text-[11px]"
                                title="تسديد المتبقي وتحويل للأرشيف"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              {isManager && (
                              <button
                                onClick={() => {
                                  setActiveSubTab('create');
                                  setEditingInvoiceId(inv.id);
                                  setSelectedCustomerId(inv.customerId);
                                  const cust = customers.find(c => c.id === inv.customerId);
                                  if (cust) {
                                    setFilterGovernorate(cust.governorate || '');
                                    setFilterArea(cust.area || '');
                                  }
                                  let dStr = '';
                                  const parsed = new Date(inv.date);
                                  if (!isNaN(parsed.getTime())) {
                                    dStr = parsed.toISOString().substring(0, 16);
                                  }
                                  setInvoiceDate(dStr);
                                  setBillItems(inv.items);
                                  setInvoiceNotes(inv.notes || '');
                                  setCustomPaidAmount(inv.paidAmount !== undefined ? inv.paidAmount.toString() : inv.totalAfterDiscount.toString());
                                  setManualInvoiceNumber(inv.invoiceNumber);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="bg-sky-100 border border-sky-250 p-2 text-sky-700 rounded-xl hover:bg-sky-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center font-bold text-[11px]"
                                title="تعديل بيانات الفاتورة"
                              >
                                <span className="font-extrabold px-1">تعديل</span>
                              </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="bg-[#FFFFFF] border border-slate-250 p-2 text-[#1A365D] rounded-xl hover:bg-[#1A365D] hover:text-white active:scale-95 transition-all cursor-pointer flex items-center gap-1 font-bold text-[11px]"
                            title="عرض محتوى الفاتورة"
                          >
                            <Eye className="h-4 w-4" />
                            <span>التفاصيل</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#FFFFFF] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-[#F7FAFC]/50">
              <h3 className="font-bold text-[#1A365D] text-sm">عرض الفاتورة</h3>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="bg-slate-200 hover:bg-slate-300 text-[#1A365D] rounded-full h-7 w-7 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto custom-scroll flex flex-col items-center bg-[#F7FAFC] gap-4">
               {previewImageUrl ? (
                 <img 
                   src={previewImageUrl} 
                   alt="الفاتورة" 
                   className="max-w-full rounded-md shadow-sm border border-slate-200 mx-auto"
                 />
               ) : (
                 <div className="flex items-center justify-center py-10">
                   <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                   <span className="text-xs text-slate-400 mr-2">جاري تحميل المعاينة...</span>
                 </div>
               )}
               <p className="text-[10px] text-slate-400 text-center flex-1 w-full mt-2">نسخة مطابقة للفاتورة الأصلية</p>
            </div>

            <div className="p-4 border-t border-slate-100 bg-[#F7FAFC] flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => exportInvoiceAsPNG(selectedInvoice)}
                  className="bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  تنزيل لـ WhatsApp
                </button>
                
                <button
                  type="button"
                  onClick={() => shareInvoiceOnWhatsApp(selectedInvoice)}
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  إرسال لـ WhatsApp
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => printInvoiceHTMLDirectly(selectedInvoice)}
                disabled={isPrinting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 border-none disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة حرارية أو ورقية فورية (HTML) 🖨️</span>
              </button>

              <button
                type="button"
                onClick={() => exportInvoiceAsPDF(selectedInvoice)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold py-2 px-3 rounded-xl text-[11px] sm:text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs border border-indigo-200"
              >
                <FileText className="h-4 w-4" />
                تنزيل كملف صورة PDF
              </button>

              {isManager && (
              <button
                type="button"
                onClick={() => {
                  const inv = selectedInvoice;
                  setSelectedInvoice(null);
                  setActiveSubTab('create');
                  setEditingInvoiceId(inv.id);
                  setSelectedCustomerId(inv.customerId);
                  const cust = customers.find(c => c.id === inv.customerId);
                  if (cust) {
                    setFilterGovernorate(cust.governorate || '');
                    setFilterArea(cust.area || '');
                  }
                  let dStr = '';
                  const parsed = new Date(inv.date);
                  if (!isNaN(parsed.getTime())) {
                    dStr = parsed.toISOString().substring(0, 16);
                  }
                  setInvoiceDate(dStr);
                  setBillItems(inv.items);
                  setInvoiceNotes(inv.notes || '');
                  setCustomPaidAmount(inv.paidAmount !== undefined ? inv.paidAmount.toString() : inv.totalAfterDiscount.toString());
                  setManualInvoiceNumber(inv.invoiceNumber);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold py-2 px-3 rounded-xl text-[11px] sm:text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs border border-sky-200"
              >
                ✍️ تعديل الفاتورة
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Invoices Picker Modal */}
      {showCustomerInvoices && !selectedReturnInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-indigo-50">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-indigo-900 text-sm">اختر فاتورة سابقة للعميل</h3>
              </div>
              <button
                onClick={() => setShowCustomerInvoices(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full h-7 w-7 flex items-center justify-center transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto custom-scroll flex flex-col gap-2.5">
              {invoices.filter(inv => inv.customerId === selectedCustomerId).length === 0 ? (
                <p className="text-center text-slate-400 py-10 text-xs font-bold">لا توجد فواتير سابقة لهذا العميل</p>
              ) : (
                invoices
                  .filter(inv => inv.customerId === selectedCustomerId)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 50)
                  .map(inv => {
                    const remaining = (inv.totalAfterDiscount || 0) - (inv.paidAmount ?? (inv.totalAfterDiscount || 0));
                    return (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => {
                          setSelectedReturnInvoice(inv);
                          setInvoiceReturnItems(getEffectivePrices(inv).map(ei => ({
                            productId: ei.productId,
                            weightId: ei.weightId || '',
                            productName: ei.productName,
                            weightSize: ei.weightSize,
                            finalPrice: ei.finalPrice || 0,
                            quantity: '0',
                            unitType: 'piece' as const,
                            unitsPerCarton: ei.unitsPerCarton,
                            effectiveCartonPrice: ei.effectiveCartonPrice
                          })));
                        }}
                        className="w-full text-right bg-white border border-slate-200 hover:border-indigo-200 rounded-xl p-3 transition-all cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-sm text-[#1A365D]">فاتورة #{inv.invoiceNumber}</span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {inv.date && !isNaN(new Date(inv.date).getTime()) ? new Date(inv.date).toLocaleDateString('ar-EG') : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-slate-600">
                          <span>الإجمالي: {formatNum(inv.totalAfterDiscount)} ج.م</span>
                          <span className={remaining > 0 ? 'text-rose-500' : 'text-emerald-600'}>
                            {remaining > 0 ? `متبقي: ${formatNum(remaining)} ج.م` : 'مسدد بالكامل'}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-1">
                          {inv.items.length} صنف | {(inv as any).extraDiscountAmount > 0 ? `خصم إضافي: ${formatNum((inv as any).extraDiscountAmount)} ج.م` : 'بدون خصم إضافي'}
                        </div>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Return Items Modal */}
      {selectedReturnInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-emerald-50">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-emerald-900 text-sm">فاتورة #{selectedReturnInvoice.invoiceNumber} - المرتجعات</h3>
              </div>
              <button
                onClick={() => { setSelectedReturnInvoice(null); setShowCustomerInvoices(false); }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full h-7 w-7 flex items-center justify-center transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto custom-scroll flex flex-col gap-3">
              {/* Original Invoice Summary (read-only) */}
              <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-200">
                <h4 className="text-[11px] font-black text-indigo-800 mb-2">📋 الفاتورة الأصلية - الأصناف المباعة</h4>
                {selectedReturnInvoice.items.map((invItem, idx) => {
                  const prod = products.find(p => String(p.id).trim() === String(invItem.productId).trim());
                  const weights = prod ? getProductWeightsFallback(prod) : [];
                  const w = weights.find(ww => String(ww.id).trim() === String(invItem.weightId).trim()) || weights[0];
                  const upc = w?.unitsPerCarton || 12;
                  const cartons = Math.floor((invItem.quantity || 0) / upc);
                  const pieces = (invItem.quantity || 0) % upc;
                  return (
                    <div key={idx} className="flex items-center justify-between text-[10px] py-1.5 border-b border-indigo-100 last:border-b-0">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800">{prod?.name || ''} - {w?.size || ''}</span>
                        <span className="text-[9px] text-slate-500">
                          الكمية: {cartons > 0 ? `${cartons} كرتونة` : ''} {pieces > 0 ? `${pieces} قطعة` : ''}
                          {invItem.discountPercent > 0 ? ` | خصم ${invItem.discountPercent}%` : ''}
                        </span>
                      </div>
                      <span className="font-black text-indigo-700">{formatNum((invItem.finalPrice || 0) * (invItem.quantity || 0))} ج.م</span>
                    </div>
                  );
                })}
                {(selectedReturnInvoice as any).extraDiscountAmount > 0 && (
                  <div className="text-[9px] text-amber-700 font-bold mt-2 pt-2 border-t border-indigo-200">
                    ⚠️ الخصم الإضافي: {formatNum((selectedReturnInvoice as any).extraDiscountAmount)} ج.م (موزع على الأصناف)
                  </div>
                )}
                <div className="text-[10px] font-black text-indigo-800 mt-1 pt-1 border-t border-indigo-200">
                  إجمالي الفاتورة: {formatNum(selectedReturnInvoice.totalAfterDiscount)} ج.م
                </div>
              </div>

              {/* Return Items */}
              {getEffectivePrices(selectedReturnInvoice).map((ei, idx) => {
                const ri = invoiceReturnItems.find(i => i.productId === ei.productId && i.weightId === (ei.weightId || ''));
                const qty = ri ? ri.quantity : '0';
                const unitType = ri ? ri.unitType : 'piece';
                const piecePrice = ei.effectiveCartonPrice;
                const cartonPrice = piecePrice * ei.unitsPerCarton;
                const totalVal = unitType === 'carton'
                  ? Number(qty || 0) * cartonPrice
                  : Number(qty || 0) * piecePrice;
                const maxPieces = ei.quantity || 0;
                const maxCartons = Math.floor(maxPieces / ei.unitsPerCarton);
                return (
                  <div key={idx} className="bg-white border border-emerald-200 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black text-slate-800">{ei.productName} - {ei.weightSize}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1">
                        <label className="text-[9px] text-slate-500 font-bold">
                          {unitType === 'carton' ? `عدد الكراتين (أقصى: ${maxCartons})` : `عدد القطع (أقصى: ${maxPieces})`}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={unitType === 'carton' ? maxCartons : maxPieces}
                          value={qty}
                          onChange={(e) => {
                            const max = unitType === 'carton' ? maxCartons : maxPieces;
                            const val = Math.min(Math.max(0, Number(e.target.value)), max);
                            setInvoiceReturnItems(prev => prev.map(ri =>
                              ri.productId === ei.productId && ri.weightId === (ei.weightId || '')
                                ? { ...ri, quantity: String(val) }
                                : ri
                            ));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-300"
                        />
                      </div>
                      <div className="flex gap-1 items-end pb-1">
                        <button
                          onClick={() => setInvoiceReturnItems(prev => prev.map(ri => {
                            if (ri.productId !== ei.productId || ri.weightId !== (ei.weightId || '')) return ri;
                            if (ri.unitType === 'carton') return ri;
                            const conv = Math.floor(Number(ri.quantity || 0) / ei.unitsPerCarton);
                            return { ...ri, unitType: 'carton' as const, quantity: String(conv) };
                          }))}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-black border cursor-pointer transition-all ${unitType === 'carton' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                          📦 كرتونة
                        </button>
                        <button
                          onClick={() => setInvoiceReturnItems(prev => prev.map(ri => {
                            if (ri.productId !== ei.productId || ri.weightId !== (ei.weightId || '')) return ri;
                            if (ri.unitType === 'piece') return ri;
                            const conv = Number(ri.quantity || 0) * ei.unitsPerCarton;
                            return { ...ri, unitType: 'piece' as const, quantity: String(conv) };
                          }))}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-black border cursor-pointer transition-all ${unitType === 'piece' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                          🧪 قطعة
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold">
                      {unitType === 'carton'
                        ? `سعر الكرتونة: ${formatNum(cartonPrice)} ج.م`
                        : `سعر القطعة: ${formatNum(piecePrice)} ج.م`
                      }
                      {Number(qty || 0) > 0 && (
                        <span className="mr-2 text-emerald-700">= {formatNum(totalVal)} ج.م</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Summary */}
              {invoiceReturnItems.some(ri => Number(ri.quantity || 0) > 0) && (
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <div className="text-[11px] font-black text-emerald-800 mb-1">ملخص المرتجعات</div>
                  {invoiceReturnItems.filter(ri => Number(ri.quantity || 0) > 0).map((ri, idx) => {
                    const piecePrice = getEffectivePrices(selectedReturnInvoice).find(ei => ei.productId === ri.productId && (ei.weightId || '') === ri.weightId)?.effectiveCartonPrice || 0;
                    const cartonPrice = piecePrice * (ri.unitsPerCarton || 12);
                    const val = ri.unitType === 'carton' ? Number(ri.quantity) * cartonPrice : Number(ri.quantity) * piecePrice;
                    return (
                      <div key={idx} className="flex items-center justify-between text-[10px] font-bold text-emerald-700 py-0.5">
                        <span>{ri.productName} - {ri.weightSize} × {ri.quantity} {ri.unitType === 'carton' ? 'كرتونة' : 'قطعة'}</span>
                        <span>{formatNum(val)} ج.م</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-emerald-200 mt-1 pt-1 flex items-center justify-between text-xs font-black text-emerald-900">
                    <span>الإجمالي</span>
                    <span>{formatNum(invoiceReturnItems.filter(ri => Number(ri.quantity || 0) > 0).reduce((sum, ri) => {
                      const piecePrice = getEffectivePrices(selectedReturnInvoice).find(ei => ei.productId === ri.productId && (ei.weightId || '') === ri.weightId)?.effectiveCartonPrice || 0;
                      const cartonPrice = piecePrice * (ri.unitsPerCarton || 12);
                      return sum + (ri.unitType === 'carton' ? Number(ri.quantity) * cartonPrice : Number(ri.quantity) * piecePrice);
                    }, 0))} ج.م</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                onClick={() => setSelectedReturnInvoice(null)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold py-3 rounded-xl text-sm transition-colors cursor-pointer active:scale-95"
              >
                رجوع للفواتير
              </button>
              <button
                onClick={() => {
                  const items = invoiceReturnItems.filter(ri => Number(ri.quantity || 0) > 0);
                  if (items.length === 0) {
                    showToast('اختر كمية مرتجعة على الأقل', 'error');
                    return;
                  }
                  const returnBillItems: InvoiceItem[] = items.map(ri => {
                    const piecePrice = getEffectivePrices(selectedReturnInvoice).find(ei => ei.productId === ri.productId && (ei.weightId || '') === ri.weightId)?.effectiveCartonPrice || 0;
                    const cartonPrice = piecePrice * (ri.unitsPerCarton || 12);
                    return {
                      productId: ri.productId,
                      weightId: ri.weightId,
                      productName: ri.productName,
                      weightSize: ri.weightSize,
                      quantity: -(Number(ri.quantity)),
                      cartonPrice: 0,
                      unitPrice: 0,
                      finalPrice: ri.unitType === 'carton' ? cartonPrice : piecePrice,
                      discountPercent: 0,
                      totalBeforeDiscount: 0,
                    };
                  });
                  setBillItems(prev => [...prev, ...returnBillItems]);
                  setSelectedReturnInvoice(null);
                  setShowCustomerInvoices(false);
                  showToast(`✓ تم إضافة ${items.length} صنف مرتجع للفاتورة`, 'success');
                }}
                disabled={!invoiceReturnItems.some(ri => Number(ri.quantity || 0) > 0)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-extrabold py-3 rounded-xl text-sm transition-colors cursor-pointer active:scale-95 shadow-md disabled:cursor-not-allowed"
              >
                إضافة المرتجعات للفاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnModal.isOpen && returnModal.invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-rose-50">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-rose-600" />
                <h3 className="font-bold text-rose-900 text-sm">عمل مرتجع / استبدال</h3>
              </div>
              <button
                onClick={() => setReturnModal({ isOpen: false, invoice: null })}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full h-7 w-7 flex items-center justify-center transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scroll flex flex-col gap-3">
              {/* Invoice Info */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-2">
                  <span>فاتورة #{returnModal.invoice.invoiceNumber}</span>
                  <span>{returnModal.invoice.date && !isNaN(new Date(returnModal.invoice.date).getTime()) ? new Date(returnModal.invoice.date).toLocaleDateString('ar-EG') : ''}</span>
                </div>
                <div className="text-xs font-black text-[#1A365D]">
                  {customers.find(c => c.id === returnModal.invoice?.customerId)?.name || 'عميل غير محدد'}
                </div>
              </div>

              {/* Original Invoice Summary (read-only) */}
              <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-200">
                <h4 className="text-[11px] font-black text-indigo-800 mb-2">📋 الفاتورة الأصلية - الأصناف المباعة</h4>
                {returnModal.invoice.items.map((invItem, idx) => {
                  const prod = products.find(p => String(p.id).trim() === String(invItem.productId).trim());
                  const weights = prod ? getProductWeightsFallback(prod) : [];
                  const w = weights.find(ww => String(ww.id).trim() === String(invItem.weightId).trim()) || weights[0];
                  const upc = w?.unitsPerCarton || 12;
                  const cartons = Math.floor((invItem.quantity || 0) / upc);
                  const pieces = (invItem.quantity || 0) % upc;
                  const effectiveItems = getEffectivePrices(returnModal.invoice);
                  const effectiveItem = effectiveItems.find(ei => ei.productId === invItem.productId && (ei.weightId || '') === (invItem.weightId || ''));
                  const effPrice = effectiveItem?.effectiveCartonPrice || invItem.finalPrice || 0;
                  return (
                    <div key={idx} className="flex items-center justify-between text-[10px] py-1.5 border-b border-indigo-100 last:border-b-0">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800">{prod?.name || ''} - {w?.size || ''}</span>
                        <span className="text-[9px] text-slate-500">
                          الكمية: {cartons > 0 ? `${cartons} كرتونة` : ''} {pieces > 0 ? `${pieces} قطعة` : ''}
                          {invItem.discountPercent > 0 ? ` | خصم ${invItem.discountPercent}%` : ''}
                        </span>
                      </div>
                      <span className="font-black text-indigo-700">{formatNum((invItem.finalPrice || 0) * (invItem.quantity || 0))} ج.م</span>
                    </div>
                  );
                })}
                {(returnModal.invoice as any).extraDiscountAmount > 0 && (
                  <div className="text-[9px] text-amber-700 font-bold mt-2 pt-2 border-t border-indigo-200">
                    ⚠️ الخصم الإضافي: {formatNum((returnModal.invoice as any).extraDiscountAmount)} ج.م (موزع على الأصناف)
                  </div>
                )}
                <div className="text-[10px] font-black text-indigo-800 mt-1 pt-1 border-t border-indigo-200">
                  إجمالي الفاتورة: {formatNum(returnModal.invoice.totalAfterDiscount)} ج.م
                </div>
              </div>

              {/* Return Items */}
              <div>
                <label className="text-[11px] font-black text-slate-700 mb-1.5 block">🔄 الأصناف المراد إرجاعها</label>
                {returnForm.items.map((item, idx) => {
                  const invItem = returnModal.invoice?.items.find(i => i.productId === item.productId && (i.weightId || '') === (item.weightId || ''));
                  const maxPieces = invItem?.quantity || 0;
                  const prod = products.find(p => p.id === item.productId);
                  const weight = prod?.weights?.find(w => w.id === item.weightId);
                  const unitsPerCarton = weight?.unitsPerCarton || 12;
                  const maxCartons = Math.floor(maxPieces / unitsPerCarton);
                  const effectiveItems = returnModal.invoice ? getEffectivePrices(returnModal.invoice) : [];
                  const effectiveItem = effectiveItems.find(ei => ei.productId === item.productId && (ei.weightId || '') === (item.weightId || ''));
                  const piecePrice = effectiveItem?.effectiveCartonPrice || invItem?.finalPrice || 0;
                  const cartonPrice = piecePrice * unitsPerCarton;
                  const qtyNum = Number(item.quantity || 0);
                  const totalVal = item.unitType === 'carton' ? qtyNum * cartonPrice : qtyNum * piecePrice;
                  return (
                    <div key={idx} className="bg-white border border-rose-200 rounded-xl p-3 mb-2 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black text-slate-800">
                          {prod?.name || item.productId} {weight ? `- ${weight.size}` : ''}
                        </span>
                        <button
                          onClick={() => {
                            setReturnForm(prev => ({
                              ...prev,
                              items: prev.items.filter((_, i) => i !== idx)
                            }));
                          }}
                          className="text-rose-500 hover:text-rose-700 text-[10px] font-bold cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] text-slate-500 font-bold">
                            {item.unitType === 'carton' ? `عدد الكراتين (أقصى: ${maxCartons})` : `عدد القطع (أقصى: ${maxPieces})`}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={item.unitType === 'carton' ? maxCartons : maxPieces}
                            value={item.quantity}
                            onChange={(e) => {
                              const max = item.unitType === 'carton' ? maxCartons : maxPieces;
                              const val = Math.min(Math.max(0, Number(e.target.value)), max);
                              setReturnForm(prev => ({
                                ...prev,
                                items: prev.items.map((it, i) => i === idx ? { ...it, quantity: String(val) } : it)
                              }));
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-rose-300"
                          />
                        </div>
                        <div className="flex gap-1 items-end pb-1">
                          <button
                            onClick={() => {
                              setReturnForm(prev => ({
                                ...prev,
                                items: prev.items.map((it, i) => {
                                  if (i !== idx) return it;
                                  if (it.unitType === 'carton') return it;
                                  const conv = Math.floor(Number(it.quantity || 0) / unitsPerCarton);
                                  return { ...it, unitType: 'carton' as const, quantity: String(conv) };
                                })
                              }));
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-black border cursor-pointer transition-all ${item.unitType === 'carton' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                          >
                            📦 كرتونة
                          </button>
                          <button
                            onClick={() => {
                              setReturnForm(prev => ({
                                ...prev,
                                items: prev.items.map((it, i) => {
                                  if (i !== idx) return it;
                                  if (it.unitType === 'piece') return it;
                                  const conv = Number(it.quantity || 0) * unitsPerCarton;
                                  return { ...it, unitType: 'piece' as const, quantity: String(conv) };
                                })
                              }));
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-black border cursor-pointer transition-all ${item.unitType === 'piece' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                          >
                            🧪 قطعة
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold mt-1">
                        {item.unitType === 'carton'
                          ? `سعر الكرتونة: ${formatNum(cartonPrice)} ج.م`
                          : `سعر القطعة: ${formatNum(piecePrice)} ج.م`
                        }
                        {qtyNum > 0 && <span className="mr-2 text-rose-700">= {formatNum(totalVal)} ج.م</span>}
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    const addedProducts = new Set(returnForm.items.map(i => `${i.productId}_${i.weightId}`));
                    const availableItems = (returnModal.invoice?.items || []).filter(
                      invItem => !addedProducts.has(`${invItem.productId}_${invItem.weightId || ''}`)
                    );
                    if (availableItems.length === 0) {
                      showToast('لا توجد أصناف متاحة للإضافة', 'error');
                      return;
                    }
                    setReturnForm(prev => ({
                      ...prev,
                      items: [...prev.items, {
                        productId: availableItems[0].productId,
                        weightId: availableItems[0].weightId || '',
                        quantity: '0',
                        unitType: 'piece'
                      }]
                    }));
                  }}
                  className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 border-dashed rounded-xl py-2 text-[11px] font-black transition-all cursor-pointer active:scale-95"
                >
                  + إضافة صنف
                </button>
              </div>

              {/* Movement Type */}
              <div>
                <label className="text-[11px] font-black text-slate-700 mb-1.5 block">نوع الحركة المالية</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'cash_refund' as ReturnMovementType, label: 'مرتجع كاش', icon: '💵' },
                    { type: 'credit_note' as ReturnMovementType, label: 'مرتجع رصيد', icon: '📝' },
                    { type: 'exchange' as ReturnMovementType, label: 'استبدال', icon: '🔄' }
                  ].map(opt => (
                    <button
                      key={opt.type}
                      onClick={() => setReturnForm(prev => ({ ...prev, movementType: opt.type }))}
                      className={`p-2.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer active:scale-95 text-center ${
                        returnForm.movementType === opt.type
                          ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-base mb-0.5">{opt.icon}</div>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exchange details */}
              {returnForm.movementType === 'exchange' && (() => {
                const exProd = products.find(p => p.id === returnForm.exchangeProductId);
                const exWeight = exProd?.weights?.find(w => w.id === returnForm.exchangeWeightId);
                const exchUnitsPerCarton = exWeight?.unitsPerCarton || 12;
                const exchPiecePrice = exWeight?.retailPricePerUnit || 0;
                const exchCartonPrice = exchPiecePrice * exchUnitsPerCarton;
                const exchQtyNum = Number(returnForm.exchangeQty || 0);
                const exchTotal = returnForm.exchangeUnitType === 'carton' ? exchQtyNum * exchCartonPrice : exchQtyNum * exchPiecePrice;
                const returnTotal = returnForm.items.reduce((sum, item) => {
                  const invItem = returnModal.invoice?.items.find(i => i.productId === item.productId && (i.weightId || '') === (item.weightId || ''));
                  const effectiveItems = returnModal.invoice ? getEffectivePrices(returnModal.invoice) : [];
                  const effectiveItem = effectiveItems.find(ei => ei.productId === item.productId && (ei.weightId || '') === (item.weightId || ''));
                  const piecePrice = effectiveItem?.effectiveCartonPrice || invItem?.finalPrice || 0;
                  const cartonPrice = piecePrice * (effectiveItem?.unitsPerCarton || 12);
                  return sum + (item.unitType === 'carton' ? Number(item.quantity || 0) * cartonPrice : Number(item.quantity || 0) * piecePrice);
                }, 0);
                const difference = returnTotal - exchTotal;
                return (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Left: Returned items summary */}
                    <div className="bg-rose-50 rounded-lg p-2 border border-rose-200">
                      <div className="text-[10px] font-black text-rose-800 mb-1.5">🔄 الأصناف المرتجعة</div>
                      {returnForm.items.map((item, idx) => {
                        const invItem = returnModal.invoice?.items.find(i => i.productId === item.productId && (i.weightId || '') === (item.weightId || ''));
                        const prod = products.find(p => p.id === item.productId);
                        const weight = prod?.weights?.find(w => w.id === item.weightId);
                        const effectiveItems = returnModal.invoice ? getEffectivePrices(returnModal.invoice) : [];
                        const effectiveItem = effectiveItems.find(ei => ei.productId === item.productId && (ei.weightId || '') === (item.weightId || ''));
                        const piecePrice = effectiveItem?.effectiveCartonPrice || invItem?.finalPrice || 0;
                        const cartonPrice = piecePrice * (weight?.unitsPerCarton || 12);
                        const val = item.unitType === 'carton' ? Number(item.quantity || 0) * cartonPrice : Number(item.quantity || 0) * piecePrice;
                        return (
                          <div key={idx} className="flex items-center justify-between text-[9px] font-bold text-rose-700 py-0.5">
                            <span>{prod?.name || item.productId} × {item.quantity} {item.unitType === 'carton' ? 'كرتونة' : 'قطعة'}</span>
                            <span>{formatNum(val)} ج.م</span>
                          </div>
                        );
                      })}
                      <div className="border-t border-rose-200 mt-1 pt-1 text-[10px] font-black text-rose-900 flex justify-between">
                        <span>المجموع</span>
                        <span>{formatNum(returnTotal)} ج.م</span>
                      </div>
                    </div>
                    {/* Right: Exchange product */}
                    <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-200">
                      <div className="text-[10px] font-black text-emerald-800 mb-1.5">🆕 الصنف البديل</div>
                      <select
                        value={`${returnForm.exchangeProductId}_${returnForm.exchangeWeightId}`}
                        onChange={(e) => {
                          const [pid, wid] = e.target.value.split('_');
                          setReturnForm(prev => ({
                            ...prev,
                            exchangeProductId: pid || '',
                            exchangeWeightId: wid || '',
                            exchangeQty: '0'
                          }));
                        }}
                        className="w-full bg-white border border-emerald-200 rounded-lg p-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-emerald-300 mb-1.5"
                      >
                        <option value="_">اختر الصنف البديل</option>
                        {products.filter(p => p.weights && p.weights.length > 0).map(p =>
                          p.weights!.map(w => (
                            <option key={`${p.id}_${w.id}`} value={`${p.id}_${w.id}`}>
                              {p.name} - {w.size}
                            </option>
                          ))
                        )}
                      </select>
                      {exWeight && (
                        <>
                          <div className="flex items-center gap-1 mb-1">
                            <div className="flex gap-0.5">
                              <button
                                onClick={() => {
                                  if (returnForm.exchangeUnitType === 'carton') return;
                                  const conv = Math.floor(Number(returnForm.exchangeQty || 0) / exchUnitsPerCarton);
                                  setReturnForm(prev => ({ ...prev, exchangeUnitType: 'carton', exchangeQty: String(conv) }));
                                }}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black border cursor-pointer ${returnForm.exchangeUnitType === 'carton' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}
                              >📦 كرتونة</button>
                              <button
                                onClick={() => {
                                  if (returnForm.exchangeUnitType === 'piece') return;
                                  const conv = Number(returnForm.exchangeQty || 0) * exchUnitsPerCarton;
                                  setReturnForm(prev => ({ ...prev, exchangeUnitType: 'piece', exchangeQty: String(conv) }));
                                }}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black border cursor-pointer ${returnForm.exchangeUnitType === 'piece' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}
                              >🧪 قطعة</button>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={returnForm.exchangeQty}
                              onChange={(e) => setReturnForm(prev => ({ ...prev, exchangeQty: e.target.value }))}
                              className="flex-1 bg-white border border-emerald-200 rounded-lg p-1 text-[10px] font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-300 text-center"
                            />
                          </div>
                          <div className="text-[8px] text-emerald-700 font-bold mb-0.5">
                            سعر {returnForm.exchangeUnitType === 'carton' ? 'الكرتونة' : 'القطعة'}: {formatNum(returnForm.exchangeUnitType === 'carton' ? exchCartonPrice : exchPiecePrice)} ج.م
                          </div>
                          {exchQtyNum > 0 && (
                            <div className="text-[10px] font-black text-emerald-800 flex justify-between pt-1 border-t border-emerald-200">
                              <span>المجموع</span>
                              <span>{formatNum(exchTotal)} ج.م</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Difference */}
                  {exchQtyNum > 0 && returnTotal > 0 && (
                    <div className={`mt-2 p-2 rounded-lg border text-[11px] font-black flex justify-between ${difference >= 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-sky-50 border-sky-200 text-sky-800'}`}>
                      <span>{difference >= 0 ? 'الفارق لصالح العميل (رصيد)' : 'المطلوب من العميل'}</span>
                      <span>{formatNum(Math.abs(difference))} ج.م</span>
                    </div>
                  )}
                  {/* Settlement method */}
                  <div className="mt-2">
                    <label className="text-[9px] font-bold text-blue-700 mb-0.5 block">تسوية الفرق</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setReturnForm(prev => ({ ...prev, exchangeSettlementMethod: 'cash' }))}
                        className={`flex-1 py-1 rounded-lg text-[9px] font-black border cursor-pointer transition-all ${
                          returnForm.exchangeSettlementMethod === 'cash' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >نقداً</button>
                      <button
                        onClick={() => setReturnForm(prev => ({ ...prev, exchangeSettlementMethod: 'credit' }))}
                        className={`flex-1 py-1 rounded-lg text-[9px] font-black border cursor-pointer transition-all ${
                          returnForm.exchangeSettlementMethod === 'credit' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >رصيد دائن</button>
                    </div>
                  </div>
                </div>
              )})()}

              {/* Notes */}
              <div>
                <label className="text-[11px] font-black text-slate-700 mb-1 block">ملاحظات (اختياري)</label>
                <input
                  type="text"
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="سبب المرتجع..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-rose-300"
                />
              </div>

              {/* Summary */}
              {returnForm.items.length > 0 && (() => {
                const returnTotal = returnForm.items.reduce((sum, item) => {
                  const invItem = returnModal.invoice?.items.find(i => i.productId === item.productId && (i.weightId || '') === (item.weightId || ''));
                  const effectiveItems = returnModal.invoice ? getEffectivePrices(returnModal.invoice) : [];
                  const effectiveItem = effectiveItems.find(ei => ei.productId === item.productId && (ei.weightId || '') === (item.weightId || ''));
                  const piecePrice = effectiveItem?.effectiveCartonPrice || invItem?.finalPrice || 0;
                  const cartonPrice = piecePrice * (effectiveItem?.unitsPerCarton || 12);
                  return sum + (item.unitType === 'carton' ? Number(item.quantity || 0) * cartonPrice : Number(item.quantity || 0) * piecePrice);
                }, 0);
                const exProd = products.find(p => p.id === returnForm.exchangeProductId);
                const exWeight = exProd?.weights?.find(w => w.id === returnForm.exchangeWeightId);
                const exchPiecePrice = exWeight?.retailPricePerUnit || 0;
                const exchCartonPrice = exchPiecePrice * (exWeight?.unitsPerCarton || 12);
                const exchQtyNum = Number(returnForm.exchangeQty || 0);
                const exchTotal = returnForm.exchangeUnitType === 'carton' ? exchQtyNum * exchCartonPrice : exchQtyNum * exchPiecePrice;
                const diff = returnTotal - (returnForm.movementType === 'exchange' && exchQtyNum > 0 ? exchTotal : 0);
                return (
                <div className="bg-rose-50 rounded-xl p-3 border border-rose-200">
                  <div className="text-[11px] font-black text-rose-800 mb-1">ملخص المرتجع</div>
                  {returnForm.items.map((item, idx) => {
                    const invItem = returnModal.invoice?.items.find(i => i.productId === item.productId && (i.weightId || '') === (item.weightId || ''));
                    const prod = products.find(p => p.id === item.productId);
                    const weight = prod?.weights?.find(w => w.id === item.weightId);
                    const effectiveItems = returnModal.invoice ? getEffectivePrices(returnModal.invoice) : [];
                    const effectiveItem = effectiveItems.find(ei => ei.productId === item.productId && (ei.weightId || '') === (item.weightId || ''));
                    const piecePrice2 = effectiveItem?.effectiveCartonPrice || invItem?.finalPrice || 0;
                    const cartonPrice2 = piecePrice2 * (weight?.unitsPerCarton || 12);
                    const value = item.unitType === 'carton' ? Number(item.quantity || 0) * cartonPrice2 : Number(item.quantity || 0) * piecePrice2;
                    return (
                      <div key={idx} className="flex items-center justify-between text-[10px] font-bold text-rose-700 py-0.5">
                        <span>{prod?.name || item.productId} {weight ? `- ${weight.size}` : ''} × {item.quantity} {item.unitType === 'carton' ? 'كرتونة' : 'قطعة'}</span>
                        <span>{formatNum(value)} ج.م</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-rose-200 mt-1 pt-1 flex items-center justify-between text-xs font-black text-rose-900">
                    <span>إجمالي المرتجع</span>
                    <span>{formatNum(returnTotal)} ج.م</span>
                  </div>
                  {returnForm.movementType === 'exchange' && exchQtyNum > 0 && (
                    <>
                      <div className="flex items-center justify-between text-[10px] font-black text-emerald-700 mt-1 pt-1 border-t border-emerald-200">
                        <span>إجمالي البديل ({exProd?.name} - {exWeight?.size})</span>
                        <span>{formatNum(exchTotal)} ج.م</span>
                      </div>
                      <div className={`flex items-center justify-between text-xs font-black mt-1 pt-1 border-t ${diff >= 0 ? 'border-amber-200 text-amber-800' : 'border-sky-200 text-sky-800'}`}>
                        <span>{diff >= 0 ? 'الفارق (رصيد للعميل)' : 'المطلوب من العميل'}</span>
                        <span>{formatNum(Math.abs(diff))} ج.م</span>
                      </div>
                    </>
                  )}
                </div>
              )})()}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  if (!returnModal.invoice || !onAddReturn || returnForm.items.length === 0) {
                    showToast('أضف صنفاً واحداً على الأقل', 'error');
                    return;
                  }
                  const inv = returnModal.invoice;
                  const cust = customers.find(c => c.id === inv.customerId);
                  const effectiveItems = getEffectivePrices(inv);
                  const totalVal = returnForm.items.reduce((sum, item) => {
                    const effectiveItem = effectiveItems.find(ei => ei.productId === item.productId && (ei.weightId || '') === (item.weightId || ''));
                    const piecePrice = effectiveItem?.effectiveCartonPrice || 0;
                    const cartonPrice = piecePrice * (effectiveItem?.unitsPerCarton || 12);
                    return sum + (item.unitType === 'carton' ? Number(item.quantity || 0) * cartonPrice : Number(item.quantity || 0) * piecePrice);
                  }, 0);
                  const returnItems: ReturnItem[] = returnForm.items.map(item => {
                    const invItem = inv.items.find(i => i.productId === item.productId && (i.weightId || '') === (item.weightId || ''));
                    const prod = products.find(p => p.id === item.productId);
                    const weight = prod?.weights?.find(w => w.id === item.weightId);
                    const effectiveItem = effectiveItems.find(ei => ei.productId === item.productId && (ei.weightId || '') === (item.weightId || ''));
                    const piecePrice = effectiveItem?.effectiveCartonPrice || invItem?.finalPrice || 0;
                    const cartonPrice = piecePrice * (effectiveItem?.unitsPerCarton || weight?.unitsPerCarton || 12);
                    const unitPrice = item.unitType === 'carton' ? cartonPrice : piecePrice;
                    return {
                      productId: item.productId,
                      weightId: item.weightId,
                      productName: prod?.name || '',
                      weightSize: weight?.size || '',
                      quantity: Number(item.quantity || 0),
                      unitType: item.unitType,
                      unitPrice,
                      totalValue: unitPrice * Number(item.quantity || 0)
                    };
                  });
                  let exchangeProduct: any = undefined;
                  let exchangeDifference = 0;
                  if (returnForm.movementType === 'exchange' && returnForm.exchangeProductId) {
                    const exProd = products.find(p => p.id === returnForm.exchangeProductId);
                    const exWeight = exProd?.weights?.find(w => w.id === returnForm.exchangeWeightId);
                    const exchUnitsPerCarton = exWeight?.unitsPerCarton || 12;
                    const exchPiecePrice = exWeight?.retailPricePerUnit || 0;
                    const exchCartonPrice = exchPiecePrice * exchUnitsPerCarton;
                    const exchQtyNum = Number(returnForm.exchangeQty || 0);
                    const exchTotal = returnForm.exchangeUnitType === 'carton' ? exchQtyNum * exchCartonPrice : exchQtyNum * exchPiecePrice;
                    exchangeDifference = totalVal - exchTotal;
                    exchangeProduct = {
                      productId: returnForm.exchangeProductId,
                      weightId: returnForm.exchangeWeightId,
                      productName: exProd?.name || '',
                      weightSize: exWeight?.size || '',
                      cartonPrice: exchCartonPrice,
                      unitPrice: exchPiecePrice,
                      quantity: exchQtyNum,
                      unitType: returnForm.exchangeUnitType,
                      totalValue: exchTotal
                    };
                  }
                  onAddReturn({
                    date: nowEgyptISO(),
                    invoiceId: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    customerId: inv.customerId,
                    customerName: cust?.name || inv.customerName || '',
                    delegatePhone: inv.delegatePhone || '',
                    delegateName: inv.delegateName || '',
                    items: returnItems,
                    totalReturnValue: totalVal,
                    movementType: returnForm.movementType,
                    exchangeProduct,
                    exchangeDifference,
                    exchangeSettlementMethod: returnForm.movementType === 'exchange' ? returnForm.exchangeSettlementMethod : undefined,
                    notes: returnForm.notes
                  });
                  showToast('✓ تم تسجيل المرتجع بنجاح', 'success');
                  setReturnModal({ isOpen: false, invoice: null });
                }}
                disabled={returnForm.items.length === 0}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-extrabold py-3 rounded-xl text-sm transition-colors cursor-pointer active:scale-95 shadow-md disabled:cursor-not-allowed"
              >
                تأكيد المرتجع
              </button>
            </div>
          </div>
        </div>
      )}

      {justSavedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 animate-fade-in" id="receipt-modal">
          <div className="bg-[#FFFFFF] rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full p-4 text-center flex flex-col gap-3 animate-scale-up max-h-[95vh]">

            {/* Header */}
            <div className={`mx-auto h-10 w-10 rounded-full flex items-center justify-center ${justSavedInvoice._isPreview ? 'bg-indigo-100 text-[#1A365D]' : 'bg-emerald-100 text-[#DD6B20]'}`}>
              {justSavedInvoice._isPreview ? (
                <Eye className="h-5 w-5" />
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-[#1A365D] text-base">
                {justSavedInvoice._isPreview ? 'معاينة الفاتورة قبل الإصدار' : 'تم حفظ الفاتورة بنجاح!'}
              </h3>
              <p className="text-[10px] text-[#2B6CB0] mt-0.5 font-mono">رقم المستند: {justSavedInvoice.invoiceNumber}</p>
            </div>

            {/* Scrollable Invoice Viewport — HTML Direct */}
            <div className="bg-white border border-slate-200 rounded-2xl max-h-[50vh] overflow-y-auto w-full overflow-x-auto whitespace-nowrap scrollbar-thin">
              <div
                dangerouslySetInnerHTML={{ __html: getInvoiceHTML(justSavedInvoice) }}
                className="w-full"
                style={{ minHeight: '300px' }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-1.5">
              {justSavedInvoice._isPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setJustSavedInvoice(null);
                    handleSaveInvoice();
                  }}
                  disabled={isSaving}
                  className="w-full bg-[#DD6B20] text-white hover:bg-[#C05621] font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  حفظ وإصدار الفاتورة فعلياً
                </button>
              )}

              {!justSavedInvoice._isPreview && (
                <>
                  <button
                    type="button"
                    onClick={() => shareInvoiceOnWhatsApp(justSavedInvoice)}
                    className="w-full bg-[#DD6B20] text-white hover:bg-[#C05621] font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    💬 إرسال الفاتورة للواتساب
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.share) {
                        exportInvoiceAsPNG(justSavedInvoice, true);
                      } else {
                        showToast('⚠️ المشاركة المباشرة غير مدعومة، يرجى التنزيل.');
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    🖼️ مشاركة صورة الفاتورة
                  </button>
                </>
              )}

              {/* Download row: PDF + Image */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => exportInvoiceAsPNG(justSavedInvoice)}
                  className="flex-1 bg-[#1A365D] text-white hover:bg-slate-800 font-bold py-2 rounded-xl text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95"
                >
                  📥 تنزيل صورة
                </button>
                <button
                  type="button"
                  onClick={() => exportInvoiceAsPDF(justSavedInvoice)}
                  className="flex-1 bg-slate-800 text-white hover:bg-slate-700 font-bold py-2 rounded-xl text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95"
                >
                  <FileText className="h-3 w-3" />
                  تحميل PDF
                </button>
              </div>

              {/* Print + Back row */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => printInvoiceHTMLDirectly(justSavedInvoice)}
                  disabled={isPrinting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95 border-none disabled:opacity-50"
                >
                  <Printer className="h-3 w-3" />
                  طباعة فورية
                </button>
                <button
                  type="button"
                  onClick={() => setJustSavedInvoice(null)}
                  className="flex-1 bg-[#F7FAFC] hover:bg-slate-200 text-[#1A365D] font-semibold py-2 rounded-xl text-[10px] transition-colors cursor-pointer"
                >
                  {justSavedInvoice._isPreview ? 'العودة للتعديل' : 'إغلاق'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isScanningBarcode && (
        <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanningBarcode(false)} />
      )}

      {paymentModal.isOpen && paymentModal.invoice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 text-center border border-slate-100">
            <div className="mx-auto w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-2 shadow-inner">
              <Receipt className="h-7 w-7 text-emerald-500" />
            </div>
            <h3 className="text-[#1A365D] font-black text-base leading-relaxed">
              {paymentModal.type === 'full' ? 'تسديد الفاتورة بالكامل وتحويلها للأرشيف' : 'تسديد دفعة جزئية من الفاتورة'}
              <br/>
              <span className="text-xs text-slate-500">#{paymentModal.invoice.invoiceNumber}</span>
            </h3>
            
            <div className="flex flex-col gap-3 mt-2 text-right">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">المبلغ المسدد (ج.م):</label>
                <input 
                  type="number" 
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({...paymentModal, amount: e.target.value})}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-xl py-2 px-3 text-[#1A365D] font-bold text-center outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="أدخل المبلغ..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">نوع وطريقة السداد:</label>
                <select
                  value={paymentModal.paymentMethod}
                  onChange={(e) => setPaymentModal({...paymentModal, paymentMethod: e.target.value})}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-xl py-2 px-3 text-[#1A365D] font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="نقدي (كاش)">نقدي (كاش)</option>
                  <option value="تحويل محفظة (فودافون كاش الخ)">تحويل محفظة (فودافون كاش الخ)</option>
                  <option value="تحويل بنكي / انستا باي">تحويل بنكي / انستا باي</option>
                  <option value="شيك">شيك</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  const amountToPay = parseFloat(paymentModal.amount);
                  const remaining = (paymentModal.invoice!.totalAfterDiscount || 0) - (paymentModal.invoice!.paidAmount ?? 0);

                  if (isNaN(amountToPay) || amountToPay <= 0 || amountToPay > remaining) {
                    showToast('⚠️ مبلغ غير صالح! يجب أن يكون أكبر من صفر ولا يتجاوز المتبقي.');
                    return;
                  }

                  const now = new Date();
                  const dateStr = `${now.toLocaleDateString('ar-EG')} ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

                  let actionText = paymentModal.type === 'full' ? 'سداد كلي' : 'سداد جزئي';
                  if (amountToPay === remaining) actionText = 'سداد كلي';

                  const newNotes = paymentModal.invoice!.notes 
                    ? `${paymentModal.invoice!.notes} | ${actionText} ${amountToPay}ج.م (${paymentModal.paymentMethod}) بتاريخ ${dateStr}`
                    : `${actionText} ${amountToPay}ج.م (${paymentModal.paymentMethod}) بتاريخ ${dateStr}`;

                  const updatedInv = {
                    ...paymentModal.invoice!,
                    paidAmount: (paymentModal.invoice!.paidAmount ?? 0) + amountToPay,
                    notes: newNotes
                  };

                  // معالجة دقيقة لكسور الأرقام لضمان الإغلاق الكامل
                  if (Math.abs((updatedInv.totalAfterDiscount || 0) - updatedInv.paidAmount) < 0.05) {
                    updatedInv.paidAmount = updatedInv.totalAfterDiscount;
                  }

                  const isFullyPaid = updatedInv.paidAmount >= updatedInv.totalAfterDiscount;

                  // معالجة دقيقة لكسور الأرقام لضمان الإغلاق الكامل
                  if (Math.abs((updatedInv.totalAfterDiscount || 0) - updatedInv.paidAmount) < 0.05) {
                    updatedInv.paidAmount = updatedInv.totalAfterDiscount;
                  }

                  onUpdateInvoice(updatedInv);

                  const customer = customers.find(c => c.id === updatedInv.customerId);
                  setJustSavedInvoice({
                    ...updatedInv, 
                    customer, 
                    _debtPaid: isFullyPaid, 
                    _partialPayment: isFullyPaid ? undefined : amountToPay, 
                    _previousPaid: paymentModal.invoice!.paidAmount ?? 0
                  });

          showToast('✓ تم تأكيد السداد! جاري تحديث المديونية بالشيت ☁️');
                  setPaymentModal({...paymentModal, isOpen: false});
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold active:scale-95 transition-all shadow-md text-sm cursor-pointer"
              >
                تأكيد السداد ✅
              </button>
              <button
                onClick={() => setPaymentModal({...paymentModal, isOpen: false})}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold active:scale-95 transition-all shadow-sm text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// @ts-nocheck
import { confirmDialog } from '../utils/confirm';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Customer, Product, ProductWeight, Invoice, InvoiceItem, FactoryLoad, getProductWeightsFallback, formatNum } from '../types';
import { Receipt, Plus, Trash2, ArrowRight, Save, User, MapPin, Percent, HelpCircle, Package, AlertTriangle, Scale, Eye, Search, Check, Loader2, Download, Share2, FileText, Printer, ScanLine, Copy } from 'lucide-react';
import { showToast } from '../utils/toast';
import SecurePhoneDisplay from './SecurePhoneDisplay';
import { jsPDF } from 'jspdf';
import BarcodeScanner from './BarcodeScanner';

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
  permittedSubTabs
}: InvoiceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'archive' | 'debtors'>(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('invoice_create')) return 'create';
      if (permittedSubTabs.includes('invoice_balance')) return 'archive';
    }
    return 'create';
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
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
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
    const now = new Date();
    // Egyptian local datetime format alignment
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().substring(0, 16);
  });

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
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
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

  // Calculate real-time car stock per product weight size combination
  const weightStocks = useMemo(() => {
    const stocks: Record<string, { loaded: number; sold: number; remaining: number }> = {};
    
    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        const key = `${p.id}_${w.id}`;

        // 1. Sum loaded from factory loads of this product and weight size
        const loaded = factoryLoads
          .filter(l => String(l.productId).trim() === String(p.id).trim() && String(l.weightId).trim() === String(w.id).trim())
          .reduce((sum, l) => sum + l.quantity, 0);

        // 2. Sum sold in all previous saved invoices
        let sold = 0;
        invoices.forEach(inv => {
          inv.items.forEach(item => {
            if (String(item.productId).trim() === String(p.id).trim() && String(item.weightId).trim() === String(w.id).trim()) {
              sold += item.quantity;
            }
          });
        });

        // 3. Draft items currently on screen
        const drafted = billItems
          .filter(it => String(it.productId).trim() === String(p.id).trim() && String(it.weightId).trim() === String(w.id).trim())
          .reduce((sum, it) => sum + it.quantity, 0);

        stocks[key] = {
          loaded,
          sold,
          remaining: loaded - sold - drafted
        };
      });
    });

    return stocks;
  }, [products, factoryLoads, invoices, billItems]);

  // Selected customer information
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [selectedCustomerId, customers]);

  // Available geographical areas present in customers list
  const availableAreas = useMemo(() => {
    const areas = customers.map(c => c.area).filter(Boolean);
    return Array.from(new Set(areas));
  }, [customers]);

  // Filtered customer list by chosen area
  const filteredCustomersByArea = useMemo(() => {
    if (!filterArea) return customers;
    return customers.filter(c => c.area === filterArea);
  }, [customers, filterArea]);

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
        if (sellUnitType === 'carton') {
          const availCartons = Math.floor(available / multiplier);
          const availPieces = available % multiplier;
          const availText = availPieces > 0 ? `${availCartons} كرتونة و ${availPieces} قطعة` : `${availCartons} كرتونة`;
          await confirmDialog(`الطلب أكبر من الرصيد المتاح بالسيارة!\n\nالكمية المتاحة فقط: ${availText}`, true);
        } else {
          await confirmDialog(`الطلب أكبر من الرصيد المتاح بالسيارة!\n\nالكمية المتاحة فقط: ${available} قطعة`, true);
        }
        return;
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
    const msg = `إصدار فاتورة بيع لـ ${customerObj?.name} بقيمة ${totals.after.toFixed(2)} ج.م؟`;

    const confirmed = await confirmDialog(msg);
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

      const paidValue = customPaidAmount !== '' ? parseFloat(customPaidAmount) : totals.after;

      // Create a copy of billItems to save immediately
      const itemsToSave = [...billItems];

      const invoiceData = {
        invoiceNumber: nextInvNum,
        customerId: selectedCustomerId,
        date: (invoiceDate ? new Date(invoiceDate) : new Date()).toISOString(),
        items: itemsToSave,
        totalBeforeDiscount: Number(totals.before.toFixed(2)),
        totalAfterDiscount: Number(totals.after.toFixed(2)),
        paidAmount: Number(paidValue.toFixed(2)),
        notes: finalNotes,
        isDelivered: false // remains in-transit till specifically delivered
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

  const exportInvoiceAsPNG = (inv: any, shareDirectly = false, returnDataUrl = false) => {
    const customerObj = inv.customer || customers.find((c: any) => c.id === inv.customerId);
    if (!customerObj) return null;

    // Retrieve settings
    const storedSetStr = localStorage.getItem('app_settings_sys');
    let invoiceAppName = 'فاتورة مبيعات معتمدة';
    let invoiceRepName = inv.delegateName?.replace(/ \(.*?\)/g, '').trim() || '';
    let invoiceRepPhone = inv.delegatePhone || '';
    if (storedSetStr) {
      try {
        const parsed = JSON.parse(storedSetStr);
        if (parsed.appName && parsed.appName !== 'الاخوه EAGS لخدمات التوزيع') {
          invoiceAppName = parsed.appName;
        } else {
          invoiceAppName = 'فاتورة مبيعات معتمدة';
        }
        if (!invoiceRepName && parsed.representativeName) invoiceRepName = parsed.representativeName;
        if (!invoiceRepPhone && parsed.representativePhone) invoiceRepPhone = parsed.representativePhone;
      } catch (e) {
        console.error(e);
      }
    }

    const canvas = document.createElement('canvas');
    const rowHeight = 45;
    const baseHeight = 350;
    canvas.width = 650;
    canvas.height = baseHeight + inv.items.length * rowHeight + 300;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(15, 20, canvas.width - 30, 120);

    // Brand titles
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('فاتورة مبيعات معتمدة', canvas.width - 40, 65);

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('التوزيع والمبيعات الميدانية الذكية', canvas.width - 40, 95);

    ctx.textAlign = 'left';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`رقم الفاتورة: ${inv.invoiceNumber}`, 40, 65);

    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    const formattedDate = new Date(inv.date).toLocaleString('ar-EG');
    ctx.fillText(`التاريخ: ${formattedDate}`, 40, 95);

    // Customer Information Block
    let y = 175;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(35, y - 20, canvas.width - 70, 75);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(35, y - 20, canvas.width - 70, 75);

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`العميل: ${customerObj.name}`, canvas.width - 55, y + 10);
    
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(`المنطقة: ${customerObj.area}   |   رقم الهاتف: ${customerObj.phone}`, canvas.width - 55, y + 38);

    // Table Header
    y += 100;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(35, y - 25, canvas.width - 70, 35);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    
    ctx.textAlign = 'right';
    ctx.fillText('المنتج والصنف', canvas.width - 55, y - 3);

    ctx.textAlign = 'center';
    ctx.fillText('الكمية', canvas.width - 220, y - 3);
    ctx.fillText('السعر', canvas.width - 310, y - 3);
    ctx.fillText('الخصم', canvas.width - 400, y - 3);

    ctx.textAlign = 'left';
    ctx.fillText('الصافي', 60, y - 3);

    // Loop through bill items
    y += 15;
    inv.items.forEach((item: InvoiceItem, idx: number) => {
      const prod = products.find(p => String(p.id).trim() === String(item.productId).trim());
      const ws = prod ? getProductWeightsFallback(prod) : [];
      const weight = ws.find(w => String(w.id).trim() === String(item.weightId).trim()) || ws[0];
      const prodName = prod ? prod.name : 'منتج غير معروف';
      const sizeLabel = weight ? weight.size : '';

      const multiplier = weight ? (weight.unitsPerCarton || 12) : 12;
      const qtyLabel = formatCartonsAndPieces(item.quantity, multiplier);
      const cartonOriginalPrice = item.originalPrice * multiplier;
      const cartonFinalPrice = item.finalPrice * multiplier;

      if (idx % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(35, y - 10, canvas.width - 70, rowHeight);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(35, y - 10, canvas.width - 70, rowHeight);
      }

      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.strokeRect(35, y - 10, canvas.width - 70, rowHeight);

      ctx.fillStyle = '#b91c1c';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      // Truncate long names
      const maxNameLen = 18;
      const truncName = prodName.length > maxNameLen ? prodName.substring(0, maxNameLen) + '..' : prodName;
      ctx.fillText(`${truncName} (${sizeLabel})`, canvas.width - 55, y + 16);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(qtyLabel, canvas.width - 220, y + 16);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${cartonOriginalPrice.toFixed(0)} ج.م`, canvas.width - 310, y + 16);
      
      ctx.fillStyle = '#ea580c';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${item.discountPercent}%`, canvas.width - 400, y + 16);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'extrabold 12px system-ui, sans-serif';
      const singleItemTotal = item.finalPrice * item.quantity;
      ctx.fillText(`${singleItemTotal.toFixed(0)} ج.م`, 60, y + 16);

      y += rowHeight;
    });

    // Summary calculations card
    y += 15;
    const isPartialOrPaid = inv._debtPaid || inv._partialPayment !== undefined;
    const summaryLines = isPartialOrPaid ? 6 : 5;
    const cardHeight = summaryLines * 25 + 10;
    
    ctx.fillStyle = '#eff6ff';
    ctx.fillRect(35, y, canvas.width - 70, cardHeight);
    ctx.strokeStyle = '#bfdbfe';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(35, y, canvas.width - 70, cardHeight);

    ctx.textAlign = 'right';
    let summaryY = y + 22;

    const drawLine = (label: string, value: string, color: string, isBold: boolean = false) => {
      ctx.fillStyle = '#1e3a8a';
      ctx.textAlign = 'right';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(label, canvas.width - 55, summaryY);

      ctx.textAlign = 'left';
      ctx.fillStyle = color;
      ctx.font = isBold ? 'extrabold 15px system-ui, sans-serif' : 'bold 13px system-ui, sans-serif';
      ctx.fillText(value, 55, summaryY);
      summaryY += 25;
    };

    drawLine('الإجمالي قبل الخصم:', `${formatNum(inv.totalBeforeDiscount)}ج.م`, '#475569');
    drawLine('إجمالي الخصومات:', `-${formatNum(inv.totalBeforeDiscount - inv.totalAfterDiscount)}ج.م`, '#dc2626');
    drawLine('الصافي المطلوب:', `${formatNum(inv.totalAfterDiscount)}ج.م`, '#1e40af', true);

    if (isPartialOrPaid) {
      const prev = inv._previousPaid || 0;
      const currentPay = inv._debtPaid ? (inv.totalAfterDiscount - prev) : inv._partialPayment;
      const remainingNow = inv.totalAfterDiscount - (prev + currentPay);

      drawLine('المسدد من قبل:', `${formatNum(prev)} ج.m`, '#475569');
      drawLine('المسدد الآن:', `${formatNum(currentPay)}ج.م`, '#16a34a', true);
      drawLine(inv._debtPaid ? 'حالة الفاتورة:' : 'المتبقي الحالي:', inv._debtPaid ? 'خالصة ✔️' : `${formatNum(remainingNow)}ج.م`, inv._debtPaid ? '#10b981' : '#ea580c', true);
    } else {
      drawLine('المسدد:', `${formatNum(inv.paidAmount)}ج.م`, '#16a34a', true);
      drawLine('المتبقي:', `${formatNum(inv.totalAfterDiscount - inv.paidAmount)}ج.م`, '#ea580c', true);
    }

    // Footer
    y = summaryY + 15;

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, y);
    ctx.lineTo(canvas.width - 35, y);
    ctx.stroke();

    y += 24;
    ctx.fillStyle = '#1e3a8a';
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px system-ui, sans-serif';
    
    if (invoiceRepName) {
      ctx.fillText(`المندوب المفوض: ${invoiceRepName}   |   رقم هاتف التواصل: ${invoiceRepPhone}`, canvas.width - 40, y);
    } else {
      ctx.fillText('إدارة المبيعات والتوزيع المعتمدة   |   هاتف التواصل والطلب: 01228466613', canvas.width - 40, y);
    }

    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('تاريخ التوريد والطباعة', 40, y);

    y += 20;
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.font = '500 10px system-ui, sans-serif';
    ctx.fillText(`نظام المبيعات الذكي - بوابة تأمين المبيعات والمناديب الذكية`, canvas.width - 40, y);

    ctx.textAlign = 'left';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = '#ea580c';
    ctx.fillText('صحيح ومعتمد ✔️', 40, y);

    if (returnDataUrl) {
      return canvas.toDataURL('image/png');
    }

    if (shareDirectly && navigator.share) {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `فاتورة_مبيعات_${customerObj.name}_${inv.invoiceNumber}.png`, { type: 'image/png' });
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
      downloadLink.download = `فاتورة_مبيعات_${customerObj.name}_${inv.invoiceNumber}.png`;
      downloadLink.click();
    }
  };

  const exportInvoiceAsPDF = (inv: any) => {
    const dataUrl = exportInvoiceAsPNG(inv, false, true);
    if (!dataUrl) return;

    const customerObj = inv.customer || customers.find((c: any) => c.id === inv.customerId);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [650, 650 + (inv.items.length * 45)]
    });
    
    // We add the image to the PDF
    pdf.addImage(dataUrl as string, 'PNG', 0, 0, 650, 650 + (inv.items.length * 45));
    pdf.save(`فاتورة_مبيعات_${customerObj?.name || ''}_${inv.invoiceNumber}.pdf`);
  };

  const printInvoiceHTMLDirectly = (inv: any) => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    setIsPrinting(true); // تفعيل القفل لمنع إرسال 6 أوامر طباعة للطابعة بالخطأ
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-1000px';
    iframe.style.left = '-1000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const customerObj = inv.customer || customers.find((c: any) => c.id === inv.customerId);
    const formattedDate = new Date(inv.date).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

    // Retrieve settings
    const storedSetStr = localStorage.getItem('app_settings_sys');
    let invoiceAppName = 'سمن وزيت سوفانا الفاخر';
    let invoiceRepName = inv.delegateName?.replace(/ \(.*?\)/g, '').trim() || '';
    let invoiceRepPhone = '';
    if (storedSetStr) {
      try {
        const parsed = JSON.parse(storedSetStr);
        if (parsed.appName) invoiceAppName = parsed.appName;
        if (parsed.representativeName && !invoiceRepName) invoiceRepName = parsed.representativeName;
        if (parsed.representativePhone) invoiceRepPhone = parsed.representativePhone;
      } catch (e) {
        console.error(e);
      }
    }

    doc.open();
    doc.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>فاتورة رقم ${inv.invoiceNumber}</title>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; line-height: 1.5; padding: 20px; text-align: right; }
            .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 3px double #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; }
            .company-info h1 { color: #1e3a8a; margin: 0 0 5px 0; font-size: 24px; font-weight: 900; text-align: right; }
            .company-info p { margin: 0; color: #64748b; font-size: 13px; font-weight: bold; text-align: right; }
            
            .invoice-meta { text-align: left; font-size: 12px; font-weight: bold; color: #334155; }
            .invoice-meta h2 { margin: 0 0 5px 0; color: #dd6b20; font-size: 18px; font-weight: 900; text-align: left; }
            
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; text-align: right; }
            .details-col h3 { margin: 0 0 8px 0; font-size: 13px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-weight: 800; text-align: right; }
            .details-col p { margin: 4px 0; font-size: 11px; font-weight: bold; color: #475569; text-align: right; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11px; text-align: right; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; }
            th { background: #f1f5f9; color: #1e3a8a; font-weight: 900; }
            
            .totals-table { width: 45%; margin-right: auto; margin-left: 0; border: none; font-size: 11px; text-align: right; }
            .totals-table td { border: none; padding: 6px 12px; }
            .totals-table tr.grand-total td { background: #eff6ff; border-top: 1px solid #3b82f6; border-bottom: 1px solid #3b82f6; font-size: 13px; font-weight: 900; color: #1e3a8a; }
            
            .signature-box { margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #475569; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: right; }
            .watermark { position: fixed; bottom: 20px; left: 20px; font-size: 9px; color: #cbd5e1; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>${invoiceAppName}</h1>
              <p>حلول التوزيع ونظام مبيعات الغذاء الميداني المعتمد</p>
            </div>
            <div class="invoice-meta">
              <h2>فاتورة مبيعات معتمدة</h2>
              <div>رقم المستند: <b>${inv.invoiceNumber}</b></div>
              <div>تاريخ الإصدار: <b>${formattedDate}</b></div>
            </div>
          </div>
          
          <div class="details-grid">
            <div class="details-col">
              <h3>تفاصيل والجهة المستلمة (العميل)</h3>
              <p>اسم المحل/العميل: <b>${customerObj?.name || 'غير معروف'}</b></p>
              <p>منطقة التوزيع: <b>${customerObj?.area || 'المنطقة الافتراضية'}</b></p>
              <p>رقم تواصل الهاتف: <span style="font-family: monospace;">${customerObj?.phone || 'غير متوفر'}</span></p>
            </div>
            <div class="details-col" style="text-align: left;">
              <h3>بيانات المسؤول والمندوب</h3>
              <p>اسم المندوب المفوض: <b>${invoiceRepName || 'شريك مبيعات معتمد'}</b></p>
              <p>هاتف التواصل الداخلي: <span style="font-family: monospace;">${invoiceRepPhone || '01228466613'}</span></p>
              ${inv.notes ? `<p>ملاحظات إضافية: <span style="color:#d97706;">${inv.notes}</span></p>` : ''}
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th width="40">م</th>
                <th>بيان الأصناف والمنتجات المباعة</th>
                <th>الكمية المفرزة</th>
                <th>السعر الافتراضي للكرتونة</th>
                <th>نسبة خصم الصنف</th>
                <th>إجمالي القيمة الصافية</th>
              </tr>
            </thead>
            <tbody>
              ${inv.items.map((item: any, idx: number) => {
                const prod = products.find((p: any) => String(p.id).trim() === String(item.productId).trim());
                const ws = prod ? getProductWeightsFallback(prod) : [];
                const weight = ws.find((w: any) => String(w.id).trim() === String(item.weightId).trim()) || ws[0];
                const prodName = prod ? prod.name : 'صنف مبيعات';
                const sizeLabel = weight ? weight.size : '';
                
                const multiplier = weight ? (weight.unitsPerCarton || 12) : 12;
                const cartons = Math.floor(item.quantity / multiplier);
                const pieces = item.quantity % multiplier;
                
                const qtyTextParts = [];
                if (cartons > 0) qtyTextParts.push(`\${cartons} كرتونة`);
                if (pieces > 0) qtyTextParts.push(`\${pieces} قطعة`);
                const qtyLabel = qtyTextParts.join(' و ') || 'منتهي';

                const cartonOriginalPrice = item.originalPrice * multiplier;
                const singleItemTotal = item.finalPrice * item.quantity;
                
                return `
                  <tr>
                    <td>\${idx + 1}</td>
                    <td><b>\${prodName}</b> (\${sizeLabel})</td>
                    <td><b>\${qtyLabel}</b></td>
                    <td>\${cartonOriginalPrice.toLocaleString('ar-EG')} ج.م</td>
                    <td style="color: \${item.discountPercent > 0 ? '#dc2626' : 'inherit'}; font-weight: bold;">
                      \${item.discountPercent > 0 ? item.discountPercent + '%' : '---'}
                    </td>
                    <td><b>\${singleItemTotal.toLocaleString('ar-EG')} ج.م</b></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <table class="totals-table">
            <tbody>
              <tr>
                <td><b>الإجمالي قبل التخفيض:</b></td>
                <td style="text-align: left;">\${inv.totalBeforeDiscount.toLocaleString('ar-EG')} ج.م</td>
              </tr>
              <tr>
                <td style="color: #dc2626;"><b>خصومات وتخفيضات تجارية:</b></td>
                <td style="text-align: left; color: #dc2626; font-weight: bold;">-\${(inv.totalBeforeDiscount - inv.totalAfterDiscount).toLocaleString('ar-EG')} ج.م</td>
              </tr>
              <tr class="grand-total">
                <td><b>صافي قيمة الفاتورة النهائي:</b></td>
                <td style="text-align: left;">\${inv.totalAfterDiscount.toLocaleString('ar-EG')} ج.م</td>
              </tr>
              <tr>
                <td style="color: #16a34a;"><b>المبلغ المقبوض والمسدد:</b></td>
                <td style="text-align: left; color: #16a34a; font-weight: bold;">\${inv.paidAmount.toLocaleString('ar-EG')} ج.م</td>
              </tr>
              <tr>
                <td style="color: #ea580c;"><b>المتبقي مديونية على العميل:</b></td>
                <td style="text-align: left; color: #ea580c; font-weight: bold;">\${(inv.totalAfterDiscount - inv.paidAmount).toLocaleString('ar-EG')} ج.م</td>
              </tr>
            </tbody>
          </table>
          
          <div class="signature-box">
            <div>توقيع مستلم البضاعة (العميل): ............................</div>
            <div>اعتماد وسداد المندوب المفوض: ............................</div>
          </div>
          
          <div class="watermark">نظام الأغذية الميداني الموحد - رصيد المبيعات والمخزن</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        isPrintingRef.current = false;
        setIsPrinting(false);
      }, 500);
    }, 500);
  };

  const shareInvoiceOnWhatsApp = (inv: any) => {
    const customerObj = inv.customer || customers.find((c: any) => c.id === inv.customerId);
    if (!customerObj) return;

    let msg = `*فاتورة مبيعات*\n`;
    msg += `--------------------------------\n`;
    msg += `*رقم الفاتورة:* ${inv.invoiceNumber}\n`;
    msg += `*العميل المحترم:* ${customerObj.name}\n`;
    msg += `*المنطقة:* ${customerObj.area}\n`;
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

  const filteredInvoices = invoices.filter(inv => {
    // Only display delivered invoices OR invoices older than 48 hours (failsafe auto-archive)
    const dTime = new Date(inv.date).getTime();
    const isOld = !isNaN(dTime) && Date.now() - dTime > 48 * 60 * 60 * 1000;
    
    if (inv.isDelivered === false && !isOld) return false;

    const cust = customers.find(c => c.id === inv.customerId);
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
      const msInWeek = 7 * 24 * 60 * 60 * 1000;
      return (now.getTime() - invDate.getTime()) < msInWeek;
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

  const filteredArchiveList = filteredInvoices;
  const filteredDebtorsList = filteredInvoices.filter(inv => inv.totalAfterDiscount > (inv.paidAmount ?? inv.totalAfterDiscount));


  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 text-right" dir="rtl" id="invoice-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-[60] shadow-md flex items-center justify-between">
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
            <div className="flex flex-wrap bg-[#FFFFFF] p-2 rounded-2xl border border-slate-200 gap-1 sm:gap-2 shadow-sm text-center">
              {showCreate && (
                <button
                  onClick={() => setActiveSubTab('create')}
                  className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[11px] sm:text-[12px] transition-all cursor-pointer select-none relative z-10 ${
                    activeSubTab === 'create' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-[#1A365D] hover:text-white hover:text-[#1A365D] border border-transparent'
                  }`}
                >
                  إصدار الفواتير
                </button>
              )}
              {showBalance && (
                <>
                  <button
                    onClick={() => setActiveSubTab('archive')}
                    className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[11px] sm:text-[12px] transition-all cursor-pointer select-none relative z-10 ${
                      activeSubTab === 'archive' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-emerald-50 hover:text-[#DD6B20] border border-transparent'
                    }`}
                  >
                    أرشيف الفواتير
                  </button>
                  <button
                    onClick={() => setActiveSubTab('debtors')}
                    className={`flex-1 min-w-[70px] py-2.5 px-1 rounded-xl font-black text-[11px] sm:text-[12px] transition-all cursor-pointer select-none relative z-10 ${
                      activeSubTab === 'debtors' ? 'bg-rose-600 text-white shadow-md' : 'text-[#9CA3AF] hover:bg-rose-50 hover:text-rose-700 border border-transparent'
                    }`}
                  >
                    عميل مديون
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#2B6CB0] mb-1">المنطقة (لتسهيل البحث)</label>
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
            </div>

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
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCurrentProductId(prod.id);
                        const firstAvail = availableWeights[0] || weights[0];
                        if (firstAvail) {
                          setCurrentWeightId(firstAvail.id);
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
                      {sizesStr && <span className="text-[9px] text-[#DD6B20] font-black mt-0.5 truncate w-full">{sizesStr}</span>}
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
                  {products.map(p => {
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name}
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
                    {activeProductWeights.filter(w => (weightStocks[`${currentProductId}_${w.id}`]?.remaining ?? 0) > 0).map(w => {
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
            <span>محتويات الفاتورة الحالية ({billItems.length})</span>
            {totals.after > 0 && <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold py-0.5 px-2 rounded-lg">قيد التحضير</span>}
          </h3>

          <div className="flex flex-col gap-2.5">
            {billItems.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-xs">لا توجد أصناف مضافة في الفاتورة الحالية بعد.</p>
            ) : (
              billItems.map((item, index) => {
                const prod = products.find(p => String(p.id).trim() === String(item.productId).trim());
                const weights = prod ? getProductWeightsFallback(prod) : [];
                const weight = weights.find(w => String(w.id).trim() === String(item.weightId).trim()) || weights[0];
                const itemTotal = item.finalPrice * item.quantity;
                
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
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isDuplicating}
                        onClick={() => handleDuplicateDraftItem(index)}
                        className="text-sky-500 hover:bg-sky-50 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="تكرار الصنف"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftItem(index)}
                        className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="حذف الصنف من القائمة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Calculations section */}
          {billItems.length > 0 && (
            <div className="border-t border-slate-150 pt-4 flex flex-col gap-2 text-xs text-[#2B6CB0]">
              <div className="flex justify-between">
                <span>الإجمالي:</span>
                <span className="font-semibold text-[#1A365D]">{formatNum(totals.before)}ج.م</span>
              </div>
              <div className="flex justify-between text-[#DD6B20] font-bold">
                <span>إجمالي الخصومات:</span>
                <span>-{formatNum(totals.discount)}ج.م</span>
              </div>
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
                      date: (invoiceDate ? new Date(invoiceDate) : new Date()).toISOString(),
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
          )}

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
                        const w = p?.weights?.find(wt => String(wt.id).trim() === String(it.weightId).trim());
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
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInvoiceId(inv.id);
                              setSelectedCustomerId(inv.customerId);
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
                          <button
                            type="button"
                            onClick={async () => {
                              if (await confirmDialog("هل أنت متأكد تماماً من حذف هذه الفاتورة النشطة بالكامل؟")) {
                                onDeleteInvoice(inv.id);
                              }
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
            
            {/* Search Input */}
            <div className="bg-[#FFFFFF] p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative leading-none flex-1">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="بحث باسم العميل أو رقم الفاتورة..."
                    value={searchInvoice}
                    onChange={(e) => setSearchInvoice(e.target.value)}
                    className="w-full bg-[#F7FAFC] pr-10 pl-3 py-2.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="bg-[#F7FAFC] border border-slate-200 rounded-lg px-2 text-xs font-bold text-[#1A365D] outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">كل الفترات</option>
                  <option value="today">اليوم</option>
                  <option value="week">هذا الأسبوع</option>
                  <option value="month">هذا الشهر</option>
                </select>
              </div>

              {/* Invoices List item */}
              <div className="max-h-96 overflow-y-auto custom-scroll flex flex-col gap-2.5 mt-1">
                {(activeSubTab === 'archive' ? filteredArchiveList : filteredDebtorsList).length === 0 ? (
                  <p className="text-center text-gray-400 py-10 text-xs">لا توجد مبيعات مطابقة أو مسجلة بعد.</p>
                ) : (
                  [...(activeSubTab === 'archive' ? filteredArchiveList : filteredDebtorsList)].reverse().map((inv, idx) => {
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
                              <span>المنطقة: <strong>{cust ? cust.area : 'مجهولة'}</strong></span>
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
            </div>
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
               <img 
                 src={exportInvoiceAsPNG(selectedInvoice, false, true) || ''} 
                 alt="الفاتورة" 
                 className="max-w-full rounded-md shadow-sm border border-slate-200 mx-auto"
               />
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
            </div>
          </div>
        </div>
      )}

      {justSavedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="receipt-modal">
          <div className="bg-[#FFFFFF] rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full p-6 text-center flex flex-col gap-4 animate-scale-up">
            <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center ${justSavedInvoice._isPreview ? 'bg-indigo-100 text-[#1A365D]' : 'bg-emerald-100 text-[#DD6B20]'}`}>
              {justSavedInvoice._isPreview ? (
                <Eye className="h-6 w-6" />
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>

            <div>
              <h3 className="font-extrabold text-[#1A365D] text-lg">
                {justSavedInvoice._isPreview ? 'معاينة الفاتورة قبل الإصدار 🔍' : 'تم حفظ الفاتورة بنجاح! 🎉'}
              </h3>
              <p className="text-xs text-[#2B6CB0] mt-1 font-mono">رقم المستند: {justSavedInvoice.invoiceNumber}</p>
            </div>

            <div className="bg-[#F7FAFC] rounded-xl p-3 border border-slate-150 text-right text-xs font-semibold text-[#1A365D] flex flex-col items-center gap-2">
               <img 
                 src={exportInvoiceAsPNG(justSavedInvoice, false, true) || ''} 
                 alt="الفاتورة" 
                 className="max-w-full rounded-md shadow-sm border border-slate-200"
               />
               <p className="text-[10.5px] text-slate-400 text-center w-full mt-1">معاينة لصورة الفاتورة المعتمدة</p>
            </div>

            {justSavedInvoice._isPreview ? (
               <p className="text-[10.5px] text-[#2B6CB0] font-bold text-center leading-relaxed">
                 يمكنك تنزيل صورة الفاتورة للمراجعة أو حفظها نهائياً لإصدارها
               </p>
            ) : (
               <p className="text-[10.5px] text-[#2B6CB0] font-bold text-center leading-relaxed">
                 اختر إحدى قنوات المراسلة السريعة لإرسال الفاتورة لعميلك مباشرة:
               </p>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => printInvoiceHTMLDirectly(justSavedInvoice)}
                disabled={isPrinting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 border-none disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                <span>الطباعة الفورية للفاتورة المعتمدة (HTML/PDF) 🖨️</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => exportInvoiceAsPNG(justSavedInvoice)}
                  className="w-full bg-[#1A365D] text-white hover:bg-slate-800 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  📥 تنزيل صورة
                </button>

                <button
                  type="button"
                  onClick={() => exportInvoiceAsPDF(justSavedInvoice)}
                  className="w-full bg-slate-800 text-white hover:bg-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <FileText className="h-4 w-4" />
                  تحميل PDF
                </button>
              </div>
              
              {!justSavedInvoice._isPreview && (
                <>
                  <button
                    type="button"
                    onClick={() => shareInvoiceOnWhatsApp(justSavedInvoice)}
                    className="w-full bg-[#DD6B20] text-white hover:bg-[#C05621] text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    💬 إرسال الفاتورة كرسالة نصية للواتساب
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
                    🖼️ مشاركة صورة الفاتورة مباشرة للواتساب
                  </button>
                </>
              )}

              {justSavedInvoice._isPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setJustSavedInvoice(null);
                      handleSaveInvoice();
                    }}
                    disabled={isSaving}
                    className="w-full bg-[#DD6B20] text-white hover:bg-[#C05621] text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 mt-1 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    حفظ وإصدار الفاتورة فعلياً
                  </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setJustSavedInvoice(null)}
              className="w-full bg-[#F7FAFC] hover:bg-slate-200 text-[#1A365D] font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              {justSavedInvoice._isPreview ? 'العودة للتعديل' : 'إغلاق ومتابعة العمل'}
            </button>
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

                  const isFullyPaid = updatedInv.paidAmount >= updatedInv.totalAfterDiscount;

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

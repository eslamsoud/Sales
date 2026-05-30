import { confirmDialog } from '../utils/confirm';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Product, ProductWeight, Invoice, InvoiceItem, FactoryLoad, getProductWeightsFallback, formatNum } from '../types';
import { Receipt, Plus, Trash2, ArrowRight, Save, User, MapPin, Percent, HelpCircle, Package, AlertTriangle, Scale, Eye, Search, Check } from 'lucide-react';
import SecurePhoneDisplay from './SecurePhoneDisplay';

interface InvoiceTabProps {
  customers: Customer[];
  products: Product[];
  factoryLoads: FactoryLoad[];
  invoices: Invoice[];
  onAddInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onGoBack: () => void;
  permittedSubTabs?: string[];
}

export default function InvoiceTab({
  customers,
  products: rawProducts,
  factoryLoads,
  invoices,
  onAddInvoice,
  onUpdateInvoice,
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
      const activeWeights = getProductWeightsFallback(p).filter(w => w.cartonPriceFromFactory > 0 && w.retailPricePerUnit > 0);
      return {
        ...p,
        weights: activeWeights
      };
    }).filter(p => p.weights && p.weights.length > 0);
  }, [rawProducts]);

  // Main form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const now = new Date();
    // Egyptian local datetime format alignment
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().substring(0, 16);
  });

  const [filterArea, setFilterArea] = useState('');
  const [justSavedInvoice, setJustSavedInvoice] = useState<any | null>(null);

  // Current item being built states
  const [currentProductId, setCurrentProductId] = useState('');
  const [currentWeightId, setCurrentWeightId] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [currentDiscount, setCurrentDiscount] = useState(''); // defaulting to 0 or manual

  // Added items on current working bill
  const [billItems, setBillItems] = useState<InvoiceItem[]>([]);

  // Hidden Extra Discount
  const [discountClicks, setDiscountClicks] = useState(0);
  const [showPwd, setShowPwd] = useState(false);
  const [discountPwd, setDiscountPwd] = useState('');
  const [extraDiscountApplied, setExtraDiscountApplied] = useState(false);
  const [extraDiscountAmount, setExtraDiscountAmount] = useState('');
  const [extraDiscountReason, setExtraDiscountReason] = useState('');
  const [customPaidAmount, setCustomPaidAmount] = useState('');

  // Automatically select the first available weight/size when a product is chosen
  useEffect(() => {
    if (!currentProductId) {
      setCurrentWeightId('');
      return;
    }
    const prod = products.find(p => p.id === currentProductId);
    if (prod) {
      const weights = getProductWeightsFallback(prod);
      if (weights.length > 0) {
        setCurrentWeightId(weights[0].id);
      } else {
        setCurrentWeightId('');
      }
    } else {
      setCurrentWeightId('');
    }
  }, [currentProductId, products]);

  // Calculate real-time car stock per product weight size combination
  const weightStocks = useMemo(() => {
    const stocks: Record<string, { loaded: number; sold: number; remaining: number }> = {};
    
    const loadedMap: Record<string, number> = {};
    factoryLoads.forEach(l => {
      const key = `${l.productId}_${l.weightId}`;
      loadedMap[key] = (loadedMap[key] || 0) + l.quantity;
    });

    const soldMap: Record<string, number> = {};
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        const key = `${item.productId}_${item.weightId}`;
        soldMap[key] = (soldMap[key] || 0) + item.quantity;
      });
    });

    const draftedMap: Record<string, number> = {};
    billItems.forEach(it => {
      const key = `${it.productId}_${it.weightId}`;
      draftedMap[key] = (draftedMap[key] || 0) + it.quantity;
    });

    products.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        const key = `${p.id}_${w.id}`;

        const loaded = loadedMap[key] || 0;
        const sold = soldMap[key] || 0;
        const drafted = draftedMap[key] || 0;

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
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProductId || !currentWeightId) {
      alert('يرجى اختيار الصنف والوزن المطلوب بيعه.');
      return;
    }

    const prod = products.find(p => p.id === currentProductId);
    const weight = activeSelectedWeight;
    if (!prod || !weight) return;

    const qtyInput = parseInt(currentQty) || 0;
    const multiplier = weight.unitsPerCarton || 12;
    const qty = qtyInput * multiplier;

    if (qty <= 0) {
      alert('الرجاء كتابة كمية بيع صحيحة أكبر من الصفر.');
      return;
    }

    const discountPerc = parseFloat(currentDiscount) || 0;
    
    // Check stock bounds in car balances
    const stockKey = `${currentProductId}_${currentWeightId}`;
    const available = weightStocks[stockKey]?.remaining ?? 0;
    if (qty > available) {
      alert(`الطلب (${qtyInput}) أكبر من الرصيد داخل حمولة السيارة (${Math.floor(available / multiplier)})!`);
      return;
    }

    // Merge or add item
    const existingIndex = billItems.findIndex(item => item.productId === currentProductId && item.weightId === currentWeightId);
    if (existingIndex > -1) {
      const updated = [...billItems];
      const prevItem = updated[existingIndex];
      const newQty = prevItem.quantity + qty;
      
      const origPrice = weight.retailPricePerUnit;
      const finalPr = origPrice * (1 - discountPerc / 100);

      updated[existingIndex] = {
        productId: currentProductId,
        weightId: currentWeightId,
        quantity: newQty,
        originalPrice: origPrice,
        factoryPrice: weight.factoryPricePerUnit,
        discountPercent: discountPerc,
        finalPrice: Number(finalPr.toFixed(3))
      };
      setBillItems(updated);
    } else {
      const origPrice = weight.retailPricePerUnit;
      const finalPr = origPrice * (1 - discountPerc / 100);

      const newItem: InvoiceItem = {
        productId: currentProductId,
        weightId: currentWeightId,
        quantity: qty,
        originalPrice: origPrice,
        factoryPrice: weight.factoryPricePerUnit,
        discountPercent: discountPerc,
        finalPrice: Number(finalPr.toFixed(3))
      };
      setBillItems([...billItems, newItem]);
    }

    // Reset items builder form only, keep client intact
    setCurrentProductId('');
    setCurrentQty('');
    setCurrentDiscount('');
  };

  const handleRemoveDraftItem = (index: number) => {
    const updated = [...billItems];
    updated.splice(index, 1);
    setBillItems(updated);
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
  const handleSaveInvoice = () => {
    if (currentProductId && parseInt(currentQty) > 0) {
      alert('لديك صنف قيد الإدخال لم تقم بإضافته للفاتورة. يرجى الضغط على رز "+ إضافة للفاتورة" أولاً.');
      return;
    }
    if (!selectedCustomerId) {
      alert('الرجاء اختيار العميل أولاً لإصدار الفاتورة الفورية.');
      return;
    }
    if (billItems.length === 0) {
      alert('الرجاء إضافة صنف واحد على الأقل للمبيعات.');
      return;
    }

    const generatedInvNum = `INV-${1000 + invoices.length + 1}`;
    const nextInvNum = manualInvoiceNumber.trim() ? manualInvoiceNumber.trim() : generatedInvNum;
    
    const extraNotes = totals.extraDiscount > 0 ? `خصم إضافي خاص: ${totals.extraDiscount} ج.م - السبب: ${totals.extraDiscountReason}` : '';
    const finalNotes = [invoiceNotes.trim(), extraNotes].filter(Boolean).join(" | ");

    const paidValue = customPaidAmount !== '' ? parseFloat(customPaidAmount) : totals.after;

    const invoiceData = {
      invoiceNumber: nextInvNum,
      customerId: selectedCustomerId,
      date: (invoiceDate ? new Date(invoiceDate) : new Date()).toISOString(),
      items: billItems,
      totalBeforeDiscount: Number(totals.before.toFixed(2)),
      totalAfterDiscount: Number(totals.after.toFixed(2)),
      paidAmount: Number(paidValue.toFixed(2)),
      notes: finalNotes
    };

    onAddInvoice(invoiceData);

    // Save of popup sharing
    setJustSavedInvoice({
      ...invoiceData,
      customer: selectedCustomer
    });

    // Reset whole components fields
    setSelectedCustomerId('');
    setInvoiceNotes('');
    setManualInvoiceNumber('');
    setBillItems([]);
    setInvoiceDate(new Date().toISOString().substring(0, 16));
    setExtraDiscountApplied(false);
    setExtraDiscountAmount('');
    setExtraDiscountReason('');
    setDiscountClicks(0);
    setShowPwd(false);
    setDiscountPwd('');
    setCustomPaidAmount('');
  };

  const exportInvoiceAsPNG = (inv: any, shareDirectly = false, returnDataUrl = false) => {
    const customerObj = inv.customer || customers.find((c: any) => c.id === inv.customerId);
    if (!customerObj) return null;

    // Retrieve settings
    const storedSetStr = localStorage.getItem('app_settings_sys');
    let invoiceAppName = 'فاتورة مبيعات معتمدة';
    let invoiceRepName = '';
    let invoiceRepPhone = '';
    if (storedSetStr) {
      try {
        const parsed = JSON.parse(storedSetStr);
        if (parsed.appName && parsed.appName !== 'الأخوة المتحدون EAG') {
          invoiceAppName = parsed.appName;
        } else {
          invoiceAppName = 'فاتورة مبيعات معتمدة';
        }
        if (parsed.representativeName) invoiceRepName = parsed.representativeName;
        if (parsed.representativePhone) invoiceRepPhone = parsed.representativePhone;
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

    // ضمان تشبيك الحروف العربية بشكل صحيح
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
      const prod = products.find(p => p.id === item.productId);
      const ws = prod ? getProductWeightsFallback(prod) : [];
      const weight = ws.find(w => w.id === item.weightId) || ws[0];
      const prodName = prod ? prod.name : 'منتج غير معروف';
      const sizeLabel = weight ? weight.size : '';

      const multiplier = weight ? (weight.unitsPerCarton || 12) : 12;
      const cartonsCount = Number((item.quantity / multiplier).toFixed(3));
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
      ctx.fillText(`${cartonsCount} كرتونة`, canvas.width - 220, y + 16);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${cartonOriginalPrice.toFixed(1)}ج`, canvas.width - 310, y + 16);
      
      ctx.fillStyle = '#ea580c';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${item.discountPercent}%`, canvas.width - 400, y + 16);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'extrabold 12px system-ui, sans-serif';
      const singleItemTotal = item.finalPrice * item.quantity;
      ctx.fillText(`${singleItemTotal.toFixed(1)}ج`, 60, y + 16);

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

    drawLine('الإجمالي قبل الخصم:', `${formatNum(inv.totalBeforeDiscount)} ج.م`, '#475569');
    drawLine('إجمالي الخصومات:', `-${formatNum(inv.totalBeforeDiscount - inv.totalAfterDiscount)} ج.م`, '#dc2626');
    drawLine('الصافي المطلوب:', `${formatNum(inv.totalAfterDiscount)} ج.م`, '#1e40af', true);

    if (isPartialOrPaid) {
      const prev = inv._previousPaid || 0;
      const currentPay = inv._debtPaid ? (inv.totalAfterDiscount - prev) : inv._partialPayment;
      const remainingNow = inv.totalAfterDiscount - (prev + currentPay);

      drawLine('المسدد من قبل:', `${formatNum(prev)} ج.m`, '#475569');
      drawLine('المسدد الآن:', `${formatNum(currentPay)} ج.م`, '#16a34a', true);
      drawLine(inv._debtPaid ? 'حالة الفاتورة:' : 'المتبقي الحالي:', inv._debtPaid ? 'خالصة ✔️' : `${formatNum(remainingNow)} ج.م`, inv._debtPaid ? '#10b981' : '#ea580c', true);
    } else {
      drawLine('المسدد:', `${formatNum(inv.paidAmount)} ج.م`, '#16a34a', true);
      drawLine('المتبقي:', `${formatNum(inv.totalAfterDiscount - inv.paidAmount)} ج.م`, '#ea580c', true);
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
      const prod = products.find(p => p.id === item.productId);
      const ws = prod ? getProductWeightsFallback(prod) : [];
      const weight = ws.find(w => w.id === item.weightId) || ws[0];
      const prodName = prod ? prod.name : 'صنف';
      const sizeStr = weight ? weight.size : '';
      const totalItem = item.finalPrice * item.quantity;
      
      const multiplier = weight ? (weight.unitsPerCarton || 12) : 12;
      const cartonsCount = Number((item.quantity / multiplier).toFixed(3));
      const cartonOriginalPrice = item.originalPrice * multiplier;

      msg += `▪️ ${prodName} (${sizeStr})\n`;
      msg += `   الكمية: ${cartonsCount} كرتونة\n`;
      if (item.discountPercent > 0) {
        msg += `   السعر: ${cartonOriginalPrice} ج.م/كرتونة (خصم ${item.discountPercent}%)\n`;
      } else {
        msg += `   السعر: ${cartonOriginalPrice} ج.م/كرتونة\n`;
      }
      msg += `   الصافي: *${formatNum(totalItem)} ج.م*\n`;
    });

    msg += `--------------------------------\n`;
    msg += `*الإجمالي:* ${formatNum(inv.totalBeforeDiscount)} ج.م\n`;
    if (inv.totalBeforeDiscount - inv.totalAfterDiscount > 0) {
      msg += `*الخصم:* -${formatNum(inv.totalBeforeDiscount - inv.totalAfterDiscount)} ج.م\n`;
    }
    msg += `💸 *المسدد:* *${formatNum(inv.paidAmount)} ج.م*\n`;
    msg += `*المتبقي:* *${formatNum(inv.totalAfterDiscount - inv.paidAmount)} ج.م*\n\n`;
    msg += `شكراً لتعاملكم معنا! 🌹`;

    const encodedText = encodeURIComponent(msg);
    const cleanPhone = customerObj.phone.replace(/\+/g, '').replace(/\s+/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      finalPhone = '20' + cleanPhone;
    }
    
    window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`, '_blank');
  };

  const filteredInvoices = invoices.filter(inv => {
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

  const filteredArchiveList = filteredInvoices.filter(inv => inv.totalAfterDiscount <= (inv.paidAmount ?? inv.totalAfterDiscount));
  const filteredDebtorsList = filteredInvoices.filter(inv => inv.totalAfterDiscount > (inv.paidAmount ?? inv.totalAfterDiscount));


  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12" id="invoice-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
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
                      activeSubTab === 'debtors' ? 'bg-[#FFFFFF] text-rose-600 border-b-2 border-rose-600 shadow-sm' : 'text-[#9CA3AF] hover:bg-rose-50 hover:text-rose-700 border border-transparent'
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
            {loadedProductsList.length === 0 ? (
              <p className="text-[11px] text-gray-400 font-bold text-center py-1">السيارة فارغة تماماً، لم يتم تحميل حمولات بعد.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {loadedProductsList.map((item, idx) => {
                  const isSelected = currentProductId === item.product.id && currentWeightId === item.weight.id;
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCurrentProductId(item.product.id);
                        setCurrentWeightId(item.weight.id);
                        setTimeout(() => {
                           document.getElementById('qty-input')?.focus();
                        }, 50);
                      }}
                      className={`flex flex-col text-right p-2.5 rounded-xl border text-xs transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm'
                          : 'bg-[#FFFFFF] hover:bg-[#F7FAFC] text-[#1A365D] border-slate-200'
                      }`}
                    >
                      <span className="font-extrabold truncate text-center w-full">{item.product.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#2B6CB0] mb-1">المنتج</label>
              <select
                required
                value={currentProductId}
                onChange={(e) => setCurrentProductId(e.target.value)}
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
                    {activeProductWeights.map(w => {
                      const stockVal = weightStocks[`${currentProductId}_${w.id}`]?.remaining ?? 0;
                      const cartonsVal = Number((stockVal / (w.unitsPerCarton || 12)).toFixed(3));
                      return (
                        <option key={w.id} value={w.id}>
                          {w.size} (الكمية بالسيارة: {cartonsVal} كرتونة)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">
                    الكمية ({products.find(p => p.id === currentProductId)?.accountingUnit || 'كرتونة'})
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
            disabled={!currentProductId || !currentWeightId}
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
                const prod = products.find(p => p.id === item.productId);
                const weights = prod ? getProductWeightsFallback(prod) : [];
                const weight = weights.find(w => w.id === item.weightId) || weights[0];
                const itemTotal = item.finalPrice * item.quantity;
                
                const multiplier = weight ? (weight.unitsPerCarton || 12) : 12;
                const cartonsCount = Number((item.quantity / multiplier).toFixed(3));
                const cartonFinalPrice = item.finalPrice * multiplier;

                return (
                  <div key={index} className="bg-[#F7FAFC] border border-slate-150 p-3 rounded-xl flex items-center justify-between gap-2.5">
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="font-black text-[#1A365D]">{prod ? prod.name : 'منتج غير معروف'} ({weight ? weight.size : 'حجم عادي'})</span>
                      <div className="flex items-center gap-2 text-[#2B6CB0] font-medium">
                        <span>الكمية: <strong className="text-[#1A365D] font-bold">{cartonsCount} كرتونة</strong></span>
                        <span>•</span>
                        <span>السعر بعد الخصم ({item.discountPercent}%): <strong className="text-[#1A365D] font-bold">{formatNum(cartonFinalPrice)}</strong> <span className="text-[10px] text-gray-400">للِكرتونة</span></span>
                        <span>•</span>
                        <span>الصافي: <strong className="text-[#DD6B20] font-extrabold">{formatNum(itemTotal)} ج.م</strong></span>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleRemoveDraftItem(index)}
                      className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="حذف الصنف من القائمة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
                <span className="font-semibold text-[#1A365D]">{formatNum(totals.before)} ج.م</span>
              </div>
              <div className="flex justify-between text-[#DD6B20] font-bold">
                <span>إجمالي الخصومات:</span>
                <span>-{formatNum(totals.discount)} ج.م</span>
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
                    {formatNum(Math.max(0, totals.after - (customPaidAmount !== '' ? parseFloat(customPaidAmount) || 0 : totals.after)))} ج.م
                  </span>
                </div>
              </div>

              {!extraDiscountApplied && (
                <div className="mt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (discountClicks < 3) {
                        alert("لا يمكن تطبيق الخصم");
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
                            alert("لا يمكن تطبيق الخصم");
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
                      alert('لديك صنف قيد الإدخال لم تقم بإضافته للفاتورة. يرجى الضغط على زر "+ إضافة للفاتورة" أولاً.');
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
                  className="w-full bg-[#DD6B20] text-white rounded-xl py-3 text-sm font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-[#C05621]"
                >
                  <Save className="h-5 w-5" />
                  <span>حفظ وإصدار</span>
                </button>
              </div>
            </div>
          )}
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
                  [...(activeSubTab === 'archive' ? filteredArchiveList : filteredDebtorsList)].reverse().map(inv => {
                    const cust = customers.find(c => c.id === inv.customerId);
                    const remaining = inv.totalAfterDiscount - (inv.paidAmount ?? inv.totalAfterDiscount);
                    return (
                      <div 
                        key={inv.id} 
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
                              <span>التاريخ: {new Date(inv.date).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 mt-2 bg-slate-50 p-2 rounded-xl text-[10.5px]">
                              <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-semibold text-slate-500">المسحوبات الإجمالية:</span>
                                <strong className="text-[#1A365D] font-extrabold">{inv.totalAfterDiscount} ج.م</strong>
                              </div>
                              {activeSubTab === 'debtors' && (
                                <>
                                  <div className="flex justify-between border-b border-slate-100 pb-1">
                                    <span className="font-semibold text-slate-500">المسدد:</span>
                                    <strong className="text-emerald-600 font-extrabold">{inv.paidAmount ?? inv.totalAfterDiscount} ج.م</strong>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-slate-500">المتبقي:</span>
                                    <strong className="text-rose-600 font-extrabold">{formatNum(remaining)} ج.م</strong>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeSubTab === 'debtors' && (
                            <>
                              <button
                                onClick={async () => {
                                  const remaining = inv.totalAfterDiscount - (inv.paidAmount ?? 0);
                                  const partialInput = prompt(`ما هو المبلغ المسدد الآن؟ (المبلغ المتبقي: ${formatNum(remaining)} ج.م)`);
                                  if (partialInput) {
                                    const amount = parseFloat(partialInput);
                                    if (isNaN(amount) || amount <= 0 || amount > remaining) {
                                      alert('قيمة غير صالحة للسداد!');
                                    } else {
                                      if (await confirmDialog(`هل أنت متأكد من تسديد جزء مقداره ${amount} ج.م؟`)) {
                                        const dateStr = new Date().toLocaleDateString('ar-EG');
                                        const newNotes = inv.notes ? `${inv.notes} | تم سداد جزئي ${amount} ج.م بتاريخ ${dateStr}` : `تم سداد جزئي ${amount} ج.م بتاريخ ${dateStr}`;
                                        const updatedInv = {
                                          ...inv,
                                          paidAmount: (inv.paidAmount ?? 0) + amount,
                                          notes: newNotes
                                        };
                                        onUpdateInvoice(updatedInv);
                                        setJustSavedInvoice({...updatedInv, customer: cust, _partialPayment: amount, _previousPaid: inv.paidAmount ?? 0});
                                      }
                                    }
                                  }
                                }}
                                className="bg-amber-100 border border-amber-250 p-2 text-amber-700 rounded-xl hover:bg-amber-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center font-bold text-[11px]"
                                title="تسديد دفعة (جزئي)"
                              >
                                <span className="font-extrabold px-1">جزئي</span>
                              </button>
                              <button
                                onClick={async () => { if (await confirmDialog('هل أنت متأكد من تسديد المبلغ المتبقي بالكامل (يتم التحويل لأرشيف الفواتير)؟')) {
                                    const previousPaid = inv.paidAmount;
                                    const updatedInv = {
                                      ...inv,
                                      paidAmount: inv.totalAfterDiscount
                                    };
                                    onUpdateInvoice(updatedInv);
                                    setJustSavedInvoice({...updatedInv, customer: cust, _debtPaid: true, _previousPaid: previousPaid});
                                  }
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

            <div className="p-4 border-t border-slate-100 bg-[#F7FAFC] grid grid-cols-2 gap-2">
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
                onClick={() => exportInvoiceAsPNG(justSavedInvoice)}
                className="w-full bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                {justSavedInvoice._isPreview ? '📥 عرض وتحميل صورة المعاينة' : '📥 تنزيل الفاتورة كصورة للواتساب'}
              </button>
              
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
                      if (typeof navigator.share === 'function') {
                        exportInvoiceAsPNG(justSavedInvoice, true);
                      } else {
                        alert('المشاركة المباشرة غير مدعومة في هذا المتصفح، يرجى استخدام التنزيل.');
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
                    className="w-full bg-[#DD6B20] text-white hover:bg-[#C05621] text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 mt-1"
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

    </div>
  );
}

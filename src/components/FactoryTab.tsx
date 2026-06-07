// @ts-nocheck
import { confirmDialog } from '../utils/confirm';
import { jsPDF } from 'jspdf';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Product, FactoryLoad, CarBalance, ProductWeight, getProductWeightsFallback, Invoice, Trip, formatNum } from '../types';
import { Truck, Plus, PackagePlus, ArrowRight, History, Trash2, AlertCircle, Edit, Save, HelpCircle, FileText, Image, Scale, CirclePercent, DollarSign, Box, Clock, CheckCircle2, ShieldMinus, Wallet, Printer, Calendar, MapPin, Download, ScanLine } from 'lucide-react';
import { showToast } from '../utils/toast';

interface FactoryTabProps {
  products: Product[];
  factoryLoads: FactoryLoad[];
  invoices: Invoice[];
  trips: Trip[];
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
}

export default function FactoryTab({
  products,
  factoryLoads,
  invoices,
  trips,
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
  canEditPrices = true
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

  // States for Trips
  const [tripDescription, setTripDescription] = useState('');
  const [tripPrice, setTripPrice] = useState('');
  const [tripDate, setTripDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [tripFilter, setTripFilter] = useState<'all' | 'collected' | 'pending'>('all');

  // Persistent carried over debt for the factory
  const [carriedOverDebt, setCarriedOverDebt] = useState<number>(() => {
    return parseFloat(localStorage.getItem('factory_carried_debt_sys') || '0');
  });
  const [carriedOverDebtDate, setCarriedOverDebtDate] = useState<string>(() => {
    return localStorage.getItem('factory_carried_debt_date_sys') || '';
  });

  useEffect(() => {
    localStorage.setItem('factory_carried_debt_sys', carriedOverDebt.toString());
  }, [carriedOverDebt]);

  useEffect(() => {
    localStorage.setItem('factory_carried_debt_date_sys', carriedOverDebtDate);
  }, [carriedOverDebtDate]);

  // Extra manual payments logged directly for the factory
  const [extraPayments, setExtraPayments] = useState<{ id: string; amount: number; date: string; notes?: string; appliedToCarriedDebt?: number }[]>(() => {
    return JSON.parse(localStorage.getItem('factory_extra_payments_sys') || '[]');
  });

  useEffect(() => {
    localStorage.setItem('factory_extra_payments_sys', JSON.stringify(extraPayments));
  }, [extraPayments]);

  const filteredLoads = React.useMemo(() => {
    return factoryLoads.filter(load => {
      const loadDateObj = new Date(load.date);
      const now = new Date();
      
      if (archiveFilter === 'daily') {
        return loadDateObj.toDateString() === now.toDateString();
      }
      if (archiveFilter === 'weekly') {
        const diffTime = Math.abs(now.getTime() - loadDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      if (archiveFilter === 'monthly') {
        const diffTime = Math.abs(now.getTime() - loadDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      }
      if (archiveFilter === 'custom') {
        const dStr = load.date.split('T')[0]; // "YYYY-MM-DD" or similar
        if (archiveStartDate && dStr < archiveStartDate) return false;
        if (archiveEndDate && dStr > archiveEndDate) return false;
        return true;
      }
      return true;
    });
  }, [factoryLoads, archiveFilter, archiveStartDate, archiveEndDate]);

  const filteredArchiveTrips = React.useMemo(() => {
    if (!trips) return [];
    return trips.filter(trip => {
      if (!trip.collected) return false; // Only show collected (paid) trips in this archive
      
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
        return diffDays <= 7;
      }
      if (archiveFilter === 'monthly') {
        const diffTime = Math.abs(now.getTime() - tripDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      }
      if (archiveFilter === 'custom') {
        const dStr = trip.date; // assuming formatting is YYYY-MM-DD
        if (archiveStartDate && dStr < archiveStartDate) return false;
        if (archiveEndDate && dStr > archiveEndDate) return false;
        return true;
      }
      return true;
    });
  }, [trips, archiveFilter, archiveStartDate, archiveEndDate]);

  // Register extra factory payment form
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentNotes, setNewPaymentNotes] = useState('');
  
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
      setWeightRetailPrice(computedRetail.toFixed(3));
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
      setProdWeights(prodWeights.map(w => w.id === editingWeightId ? newWeight : w));
      setEditingWeightId(null);
    } else {
      setProdWeights([...prodWeights, newWeight]);
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
    setProdWeights(prodWeights.filter(w => w.id !== id));
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
  const handleAddLoadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (groupedDraftItems.length === 0) {
      showToast('⚠️ الرجاء إضافة كمية تحميل واحدة على الأقل.');
      return;
    }

    let hasAddedAny = false;

    groupedDraftItems.forEach(group => {
      group.items.forEach(item => {
        const totalUnits = item.cartons * item.weight.unitsPerCarton;
        if (totalUnits > 0) {
          onAddLoad({
            productId: group.product.id,
            weightId: item.weight.id,
            quantity: totalUnits,
            cartonsCount: item.cartons,
            looseUnitsCount: 0,
            notes: loadNotes.trim() || `شحنة محملة [${group.product.name} - وزن ${item.weight.size}]`,
            warehouseKeeper: warehouseKeeper.trim() || undefined,
            advanceAmount: showAdvanceInput ? (parseFloat(advanceAmount) || undefined) : undefined,
            date: new Date(loadDate).toISOString()
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
  };

  // Compute live cumulative totals of the current total factory load invoice (حساب المصنع والكميات المحملة)
  const factoryInvoiceSummary = useMemo(() => {
    let grandFactoryCost = 0;
    let totalCrates = 0;
    let totalIndividualItems = 0;

    const itemsList = factoryLoads.map(load => {
      const prod = products.find(p => p.id === load.productId);
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => w.id === load.weightId) || weights[0];

      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / (weight?.unitsPerCarton || 12));
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % (weight?.unitsPerCarton || 12));
      const cartonPrice = weight?.cartonPriceFromFactory || 0;
      const factoryPricePerUnit = weight?.factoryPricePerUnit || 0;

      const subtotal = (cartons * cartonPrice) + (loose * factoryPricePerUnit);

      grandFactoryCost += subtotal;
      totalCrates += cartons;
      totalIndividualItems += load.quantity;

      return {
        id: load.id,
        productName: prod ? prod.name : 'صنف مجهول',
        size: weight ? weight.size : 'حجم عادي',
        cartons,
        loose,
        cartonPrice,
        subtotal,
        date: load.date,
        warehouseKeeper: load.warehouseKeeper,
        advanceAmount: load.advanceAmount
      };
    });

    return {
      itemsList,
      grandFactoryCost,
      totalCrates,
      totalIndividualItems
    };
  }, [factoryLoads, products]);

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
      const prod = products.find(p => p.id === load.productId);
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => w.id === load.weightId) || weights[0];

      const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / (weight?.unitsPerCarton || 12));
      const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % (weight?.unitsPerCarton || 12));
      const cartonPrice = weight?.cartonPriceFromFactory || 0;
      const factoryPricePerUnit = weight?.factoryPricePerUnit || 0;
      const subtotal = (cartons * cartonPrice) + (loose * factoryPricePerUnit);

      const pId = load.productId;
      if (!groups[pId]) {
        groups[pId] = {
          productId: pId,
          productName: prod ? prod.name : 'صنف مجهول',
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

  // DRAW AND DOWNLOAD DYNAMIC STATEMENT OF SELLING LOADS AS HIGH-FIDELITY PDF (No Prices)
  const handlePrintCurrentLoads = () => {
    const list = factoryInvoiceSummary.itemsList;
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات تحميل سابقة لتنزيل البيان.');
      return;
    }

    // Capture Canvas drawing sequence dynamically
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 240 + list.length * 60 + 260; 
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    // Draw background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 15, canvas.width - 30, canvas.height - 30);

    // Top Stripe (Deep Slate)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(15, 15, canvas.width - 30, 8);

    // Header header background block in professional navy style
    const headerGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    headerGrad.addColorStop(0, '#0f172a');
    headerGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(15, 23, canvas.width - 30, 115);

    // Print Header information - "بيان حمولة السيارة"
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('بيان حمولة السيارة وطباعة المستند', canvas.width - 45, 70);
    
    // Sub-title
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('مستند جرد وتفريغ كميات أصناف السيارة المعتمد للتحميل والمطابقة', canvas.width - 45, 105);
    
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`تاريخ ووقت البيان: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`, 45, 70);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('مطابقة كميات الفروع والاستلام', 45, 100);

    // Table Headers
    let y = 190;
    ctx.fillStyle = '#0f172a'; // Deep Navy table header for professional billing feel
    ctx.fillRect(35, y - 25, canvas.width - 70, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    
    // Header Column Labels (No Prices, No Reviewers)
    ctx.fillText('الصنف وحجم الوزن المحمل', canvas.width - 55, y + 2);
    ctx.textAlign = 'left';
    ctx.fillText('الكمية (بالكرتونة)', 65, y + 2);

    y += 25;

    // Loop through rows
    list.forEach((item, idx) => {
      // Row alternate background colors to make it look like a high-quality physical printed receipt
      if (idx % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(35, y - 5, canvas.width - 70, 45);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(35, y - 5, canvas.width - 70, 45);
      }

      // Border guidelines for crisp receipt appearance
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(35, y - 5, canvas.width - 70, 45);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${item.productName} (${item.size})`, canvas.width - 55, y + 23);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`${item.cartons} كرتونة`, 65, y + 23);

      y += 45;
    });

    // Summary block (Quantity Only) - styled professionally
    y += 15;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(35, y - 20, canvas.width - 70, 70);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(35, y - 20, canvas.width - 70, 70);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي كميات بيان حمولة المصنع بالفروع:', canvas.width - 55, y + 25);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`إجمالي الكرتونات: ${factoryInvoiceSummary.totalCrates} كرتونة`, 65, y + 25);

    // Bottom Boxes Section: Warehouse Keeper (Reviewed from) on the bottom left, driver signature on the bottom right
    y += 85;

    // Left Box: تمت المراجعة (Bottom-Left)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(35, y, 340, 95);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(35, y, 340, 95);

    // Swap text positioning for Arabic reading right-to-left in drawing boxes
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('توقيع السائق المستلم للحمولة:', 360, y + 30);
    ctx.font = 'normal 11px system-ui, sans-serif';
    ctx.fillText('الاسم: ................................................', 360, y + 55);
    ctx.fillText('التوقيع: .............................................', 360, y + 75);

    // Right Box: توقيع السائق (Bottom-Right)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(395, y, 370, 95);
    ctx.strokeRect(395, y, 370, 95);

    ctx.fillStyle = '#1e293b';
    ctx.fillText('تمت المراجعة والتحميل بواسطة أمين المخزن:', 745, y + 30);
    ctx.font = 'normal 11px system-ui, sans-serif';
    ctx.fillText('اسم أمين المستودع: .......................................', 745, y + 55);
    ctx.fillText('التوقيع والخاتم: .........................................', 745, y + 75);

    // Save as PDF file directly - completely bypasses window.open/window.print sandboxed iframe limitations!
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
    const list = factoryInvoiceSummary.itemsList;
    if (list.length === 0) {
      showToast('⚠️ لا توجد شحنات تحميل سابقة لتنزيل البيان.');
      return;
    }

    // Prepare HTML Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 240 + list.length * 60 + 260; // Dynamic height with stable margins
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    // Draw background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 15, canvas.width - 30, canvas.height - 30);

    // Top Stripe (Deep Slate)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(15, 15, canvas.width - 30, 8);

    // Header header background block in professional navy style
    const headerGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    headerGrad.addColorStop(0, '#0f172a');
    headerGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(15, 23, canvas.width - 30, 115);

    // Print Header information - "بيان حمولة السيارة"
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('بيان حمولة السيارة', canvas.width - 45, 70);
    
    // Sub-title
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('مستند جرد وتفريغ كميات أصناف السيارة المعتمد للتحميل والمطابقة', canvas.width - 45, 105);
    
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`تاريخ ووقت البيان: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`, 45, 70);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('مطابقة كميات الفروع والاستلام', 45, 100);

    // Table Headers
    let y = 190;
    ctx.fillStyle = '#0f172a'; // Deep Navy table header for professional billing feel
    ctx.fillRect(35, y - 25, canvas.width - 70, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    
    // Header Column Labels (No Prices, No Reviewers)
    ctx.fillText('الصنف وحجم الوزن المحمل', canvas.width - 55, y + 2);
    ctx.textAlign = 'left';
    ctx.fillText('الكمية (بالكرتونة)', 65, y + 2);

    y += 25;

    // Loop through rows
    list.forEach((item, idx) => {
      // Row alternate background colors to make it look like a high-quality physical printed receipt
      if (idx % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(35, y - 5, canvas.width - 70, 45);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(35, y - 5, canvas.width - 70, 45);
      }

      // Border guidelines for crisp receipt appearance
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(35, y - 5, canvas.width - 70, 45);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${item.productName} (${item.size})`, canvas.width - 55, y + 23);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`${item.cartons} كرتونة`, 65, y + 23);

      y += 45;
    });

    // Summary block (Quantity Only) - styled professionally
    y += 15;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(35, y - 20, canvas.width - 70, 70);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(35, y - 20, canvas.width - 70, 70);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('إجمالي كميات بيان حمولة المصنع بالفروع:', canvas.width - 55, y + 25);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`إجمالي الكرتونات: ${factoryInvoiceSummary.totalCrates} كرتونة`, 65, y + 25);

    // Bottom Boxes Section: Warehouse Keeper (Reviewed from) on the bottom left, driver signature on the bottom right
    y += 85;

    // Left Box: تمت المراجعة (Bottom-Left)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(35, y, 340, 95);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(35, y, 340, 95);

    // Top subtle bar for reviewed block
    ctx.fillStyle = '#312e81';
    ctx.fillRect(35, y, 340, 24);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('مراجعة وتأكيد أمين المستودع', 35 + 170, y + 16);

    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('تمت المراجعة والتحقق بواسطة أمين المخزن:', 355, y + 45);

    // Fetch unique warehouse keepers inside list or fallback
    const uniqueKeepers = Array.from(new Set(list.map(i => i.warehouseKeeper).filter(Boolean)));
    const selectedKeeper = uniqueKeepers.length > 0 ? uniqueKeepers.join(' / ') : (warehouseKeeper.trim() || 'أمين المخزن المسؤول');
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(selectedKeeper, 35 + 170, y + 75);

    // Right Box: توقيع السائق والمستلم (Bottom-Right)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(canvas.width - 375, y, 340, 95);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(canvas.width - 375, y, 340, 95);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(canvas.width - 375, y, 340, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('تأكيد الاستلام والتوقيع', canvas.width - 375 + 170, y + 16);

    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'right';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('اسم وتوقيع السائق / المندوب المستلم:', canvas.width - 55, y + 45);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText('التوقيع: .......................................', canvas.width - 55, y + 75);

    // Footer copyright lines
    y += 125;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, y - 15);
    ctx.lineTo(canvas.width - 35, y - 15);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('تم التصدير تلقائياً من تطبيق تتبع حمولة ومبيعات السيارة • مراجعة المصنع والكميات', canvas.width / 2, y);

    // Trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.download = `بيان_حمولة_أصناف_المصنع_${new Date().toISOString().substring(0, 10)}.png`;
    downloadLink.href = dataUrl;
    downloadLink.click();
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
          </div>
          
          <div class="meta-box">
            <div>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
            <div>رقم الحساب أو العملية: FACT-${Date.now().toString().slice(-6)}</div>
          </div>
          
          <div class="summary-cards">
            <div class="card">
              <span>إجمالي الحساب (المدين)</span>
              <strong>${factoryBalanceDetails.totalWithdrawnValue.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="card success">
              <span>إجمالي المسدد والمقدمات</span>
              <strong style="color: #16a34a;">${factoryBalanceDetails.totalAdvancePayments.toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div class="card danger">
              <span>صافي المتبقي للمصنع</span>
              <strong style="color: #dc2626;">${factoryBalanceDetails.netRemainingDueToFactory.toLocaleString('ar-EG')} ج.م</strong>
            </div>
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
              ${factoryLoads.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">لا توجد حمولات بضاعة مسجلة.</td></tr>' : 
                factoryLoads.map((load, idx) => {
                  const prod = products.find(p => p.id === load.productId);
                  const weights = prod ? getProductWeightsFallback(prod) : [];
                  const weight = weights.find(w => w.id === load.weightId);
                  const unitsPerCarton = weight?.unitsPerCarton || 12;
                  const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
                  const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
                  const cartonPrice = weight?.cartonPriceFromFactory || 0;
                  const unitPrice = weight?.factoryPricePerUnit || 0;
                  const subtotal = (cartons * cartonPrice) + (loose * unitPrice);

                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><b>${prod ? prod.name : 'صنف غير معروف'}</b> (وزن: ${weight ? weight.size : 'افتراضي'})</td>
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
                <th width="40">م</th>
                <th>التاريخ والوقت</th>
                <th>المستند / الملاحظات</th>
                <th>مبلغ الدفعة</th>
              </tr>
            </thead>
            <tbody>
              ${extraPayments.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">لم يتم تسجيل دفعات مباشرة إضافية.</td></tr>' : 
                extraPayments.map((pay, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${pay.date}</td>
                    <td>${pay.notes || 'تسديد مباشر للمصنع'}</td>
                    <td><b>${pay.amount.toLocaleString('ar-EG')} ج.م</b></td>
                  </tr>
                `).join('')
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
    
    // Calculate total loaded costs from factoryLoads
    factoryLoads.forEach(load => {
      const prod = products.find(p => p.id === load.productId);
      const weights = prod ? getProductWeightsFallback(prod) : [];
      const weight = weights.find(w => w.id === load.weightId);
      if (weight) {
        const unitsPerCarton = weight.unitsPerCarton || 12;
        const cartons = load.cartonsCount !== undefined ? load.cartonsCount : Math.floor(load.quantity / unitsPerCarton);
        const loose = load.looseUnitsCount !== undefined ? load.looseUnitsCount : (load.quantity % unitsPerCarton);
        const cartonPrice = weight.cartonPriceFromFactory || 0;
        const unitPrice = weight.factoryPricePerUnit || 0;
        const subtotal = (cartons * cartonPrice) + (loose * unitPrice);
        rawLoadedValue += subtotal;
      }
      currentAdvances += load.advanceAmount ?? 0;
    });

    // المدين = إجمالي قيمة البضاعة المحملة + المديونية المرحلة السابقة
    const totalWithdrawnValue = rawLoadedValue + carriedOverDebt;

    // إجمالي الدفعات المسجلة - مع خصم ما تم تسديده من المديونية القديمة لتجنب ازدواج الخصم
    const manualPaymentsSum = extraPayments.reduce((sum, p) => sum + (p.amount - (p.appliedToCarriedDebt || 0)), 0);

    // المسدد = مقدمات الشحن بالسيارة + دفعات ميزان المصنع المباشرة
    const totalAdvancePayments = currentAdvances + manualPaymentsSum;

    // Calculate total sold items from invoices matching our products list
    let totalSoldValue = 0; // إجمالي قيمة المبيعات للعملاء
    const soldCounts: Record<string, { cartons: number, units: number, value: number }> = {}; // weightId -> counts

    invoices.forEach(inv => {
      inv.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (!prod) return;
        const weights = getProductWeightsFallback(prod);
        const weight = weights.find(w => w.id === item.weightId);
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

    const netRemainingDueToFactory = Math.max(0, totalWithdrawnValue - totalAdvancePayments);

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
  }, [factoryLoads, products, invoices, carriedOverDebt, extraPayments]);

  // Hook to handle active debt date tracking
  useEffect(() => {
    const activeDebt = factoryBalanceDetails.netRemainingDueToFactory;
    if (activeDebt <= 0) {
      if (carriedOverDebt > 0) {
        setCarriedOverDebt(0);
      }
      if (carriedOverDebtDate) {
        setCarriedOverDebtDate('');
      }
    } else {
      if (!carriedOverDebtDate) {
        // Egyptian localized current date string
        setCarriedOverDebtDate(new Date().toLocaleDateString('ar-EG'));
      }
    }
  }, [factoryBalanceDetails.netRemainingDueToFactory, carriedOverDebtDate, carriedOverDebt]);

  // Draw and download dynamic ledger statement for Factory Account as PNG
  const handleDownloadFactoryLedgerImage = () => {
    const list = factoryInvoiceSummary.itemsList;
    const { totalWithdrawnValue, totalAdvancePayments, netRemainingDueToFactory } = factoryBalanceDetails;

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 420; // Fixed compact height since no detailed list
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.direction = 'rtl';

    // Draw background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 15, canvas.width - 30, canvas.height - 30);

    // Top Stripe (Deep Indigo)
    ctx.fillStyle = '#312e81';
    ctx.fillRect(15, 15, canvas.width - 30, 8);

    // Header gradient background
    const headerGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    headerGrad.addColorStop(0, '#111827');
    headerGrad.addColorStop(1, '#1f2937');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(15, 23, canvas.width - 30, 125);

    // Header information - Simplification as requested
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText('كشف حساب المصنع', canvas.width - 45, 80);
    
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`تاريخ الكشف: ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}`, canvas.width - 45, 115);

    // Balance Sheet Top Boxes - Three Columns
    let y = 180;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(35, y, 730, 85);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(35, y, 730, 85);

    // Box 1: الحساب (On the right: x = 640)
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('الحساب', 640, y + 30);
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`${totalWithdrawnValue.toFixed(2)}ج.م`, 640, y + 60);

    // Divider 1
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath(); ctx.moveTo(280, y + 15); ctx.lineTo(280, y + 70); ctx.stroke();

    // Box 2: المسدد (In the center: x = 400)
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('المسدد', 400, y + 30);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`${totalAdvancePayments.toFixed(2)}ج.م`, 400, y + 60);

    // Divider 2
    ctx.beginPath(); ctx.moveTo(520, y + 15); ctx.lineTo(520, y + 70); ctx.stroke();

    // Box 3: المتبقي للمصنع (On the left: x = 160)
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('المتبقي للمصنع', 160, y + 30);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`${netRemainingDueToFactory.toFixed(2)}ج.م`, 160, y + 60);

    y += 115;

    // Final calculations highlight card
    ctx.fillStyle = '#fef2f2';
    ctx.fillRect(35, y, 730, 65);
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    ctx.strokeRect(35, y, 730, 65);

    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('المتبقي للمصنع (المبلغ المدين الباقي):', canvas.width - 65, y + 40);
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`${netRemainingDueToFactory.toFixed(2)}ج.م`, 65, y + 42);

    // Footer bottom boundary
    y += 45;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, y - 10);
    ctx.lineTo(canvas.width - 35, y - 10);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('كشف حساب ختامي للأغراض الرسمية والتدقيق', canvas.width / 2, y + 10);

    // Trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.download = `كشف_حساب_المصنع_${new Date().toISOString().substring(0, 10)}.png`;
    downloadLink.href = dataUrl;
    downloadLink.click();
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
    ctx.direction = 'rtl';
    ctx.direction = 'rtl';
    ctx.direction = 'rtl';
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
      const cartonPrice = weight?.cartonPriceFromFactory || 0;
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
      ctx.fillText(prod ? prod.name : 'صنف مجهول', canvas.width - 55, y + 17);
      ctx.fillStyle = '#64748b';
      ctx.font = '500 10px system-ui, sans-serif';
      ctx.fillText(`${weight?.size || ''} • (${dateStr})`, canvas.width - 55, y + 34);

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

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 text-right animate-fade-in" dir="rtl" id="factory-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
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
                              {activeWeights.map(w => (
                                <option key={w.id} value={w.id}>
                                  {w.size} (الكرتونة بها {w.unitsPerCarton} ع - سعر المصنع {w.cartonPriceFromFactory}ج.م)
                                </option>
                              ))}
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

              {factoryLoads.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-xs">لا توجد تحميلات مسجلة ببيان حمولة السيارة اليوم.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="max-h-64 overflow-y-auto custom-scroll border border-slate-100 rounded-xl p-2.5 bg-[#F7FAFC]/50 divide-y divide-slate-150 flex flex-col gap-2.5">
                    {factoryLoads.map((load) => {
                      const prod = products.find(p => p.id === load.productId);
                      const weights = prod ? getProductWeightsFallback(prod) : [];
                      const weight = weights.find(w => w.id === load.weightId) || weights[0];
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
                              {prod ? prod.name : 'الصنف مجهول'} ({weight?.size || 'وزن غير مسجل'})
                            </span>
                            <span className="text-xs text-[#DD6B20] font-extrabold shrink-0" dir="rtl">
                              {loadedCartons} {prod?.accountingUnit || 'كرتونة'}
                            </span>
                          </div>

                          {/* Extra info */}
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-gray-400 font-bold font-mono">
                              {formattedDateStr}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("هل أنت متأكد من حذف هذه الشحنة المحملة نهائياً من أرشيف اليوم؟")) {
                                  onDeleteLoad(load.id);
                                }
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
                      disabled={factoryLoads.length === 0}
                      className="w-full bg-indigo-50 text-[#1A365D] hover:bg-indigo-100 disabled:bg-[#F7FAFC] disabled:text-gray-400 py-3 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-indigo-200/50"
                    >
                      <Image className="h-4 w-4" />
                      <span>تنزيل بيان حمولة اليوم كصورة</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintCurrentLoads}
                      disabled={factoryLoads.length === 0}
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

              {factoryLoads.length === 0 ? (
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
                      {factoryLoads.map((load, index) => {
                        const prod = products.find(p => p.id === load.productId);
                        const weights = prod ? getProductWeightsFallback(prod) : [];
                        const weight = weights.find(w => w.id === load.weightId) || weights[0];
                        const cartonPrice = weight?.cartonPriceFromFactory || 0;
                        const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                        const totalLoadedValue = loadedCartons * cartonPrice;

                        const loadDateObj = new Date(load.date);
                        const formattedDateStr = loadDateObj.toLocaleDateString('ar-EG') + ` • ` + loadDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <tr key={'print_load_' + load.id} className="border-b border-slate-600">
                            <td className="border border-slate-800 p-1.5 text-center">{index + 1}</td>
                            <td className="border border-slate-800 p-1.5">{formattedDateStr}</td>
                            <td className="border border-slate-800 p-1.5 font-bold">
                              {prod ? prod.name : 'صنف غير معرف'} - ({weight?.size || 'وزن مجهول'})
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
                      <span>{factoryLoads.length} شحنة تحميل</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1">
                      <span>إجمالي قيم البضائع المسحوبة من المصنع الحالية:</span>
                      <span className="text-md">
                        {formatNum(factoryBalanceDetails.rawLoadedValue)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-emerald-800">
                      <span>إجمالي الدفعات المقدمة والمباشرة:</span>
                      <span>
                        {formatNum(factoryBalanceDetails.totalAdvancePayments)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-rose-800 text-sm">
                      <span>المتبقي للمصنع (المدين الباقي):</span>
                      <span>
                        {formatNum(factoryBalanceDetails.netRemainingDueToFactory)}ج.م
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

                <div className="grid grid-cols-5 bg-[#FFFFFF] border border-slate-205 p-1 rounded-xl text-center gap-1">
                  <button
                    type="button"
                    onClick={() => setArchiveFilter('all')}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'all' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchiveFilter('daily')}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'daily' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    يومي
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchiveFilter('weekly')}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'weekly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    أسبوعي
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchiveFilter('monthly')}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'monthly' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    شهري
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchiveFilter('custom')}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      archiveFilter === 'custom' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'text-[#9CA3AF] hover:bg-slate-55'
                    }`}
                  >
                    مخصص
                  </button>
                </div>

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

              {archiveSection === 'factory' && (
                <>
                {filteredLoads.length > 0 && (
                  <div className="flex gap-2 w-full mt-1 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (filteredLoads.length === 0) return;

                        const canvas = document.createElement('canvas');
                        canvas.width = 950;
                        const rowHeight = 48;
                        const headerHeight = 220;
                        const summaryCardHeight = 130;
                        const footerHeight = 110;
                        canvas.height = headerHeight + 50 + (filteredLoads.length * rowHeight) + summaryCardHeight + footerHeight + 40;

                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        ctx.direction = 'rtl';

                        let grandLoadsSum = 0;
                        let grandPaymentsSum = 0;
                        let grandRemainingSum = 0;

                        [...filteredLoads].forEach((load) => {
                          const prod = products.find(p => p.id === load.productId);
                          const weights = prod ? getProductWeightsFallback(prod) : [];
                          const weight = weights.find(w => w.id === load.weightId) || weights[0];
                          const cartonPrice = weight?.cartonPriceFromFactory || 0;
                          const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                          const loadVal = loadedCartons * cartonPrice;
                          const paidVal = load.advanceAmount || 0;
                          const remainingVal = loadVal - paidVal;

                          grandLoadsSum += loadVal;
                          grandPaymentsSum += paidVal;
                          grandRemainingSum += remainingVal;
                        });

                        grandLoadsSum = 0;
                        grandPaymentsSum = 0;
                        grandRemainingSum = 0;

                        [...filteredLoads].forEach((load) => {
                          const prod = products.find(p => p.id === load.productId);
                          const weights = prod ? getProductWeightsFallback(prod) : [];
                          const weight = weights.find(w => w.id === load.weightId) || weights[0];
                          const cartonPrice = weight?.cartonPriceFromFactory || 0;
                          const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                          const loadVal = loadedCartons * cartonPrice;
                          const paidVal = load.advanceAmount || 0;
                          const remainingVal = loadVal - paidVal;

                          grandLoadsSum += loadVal;
                          grandPaymentsSum += paidVal;
                          grandRemainingSum += remainingVal;
                        });

                        // Background fill
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(15, 15, canvas.width - 30, canvas.height - 30);

                        // Double borders
                        ctx.strokeStyle = '#cbd5e1';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
                        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

                        // Stripe
                        ctx.fillStyle = '#4f46e5';
                        ctx.fillRect(20, 20, canvas.width - 40, 10);

                        // Header
                        const headerGrad = ctx.createLinearGradient(20, 30, canvas.width - 20, 30);
                        headerGrad.addColorStop(0, '#0f172a');
                        headerGrad.addColorStop(1, '#1e293b');
                        ctx.fillStyle = headerGrad;
                        ctx.fillRect(20, 30, canvas.width - 40, 125);

                        // Title
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'right';
                        ctx.font = 'bold 24px system-ui, sans-serif';
                        ctx.fillText('كشف تصفية وفاتورة أرشيف حسابات المصنع والسيارة', canvas.width - 50, 75);

                        // Sub titles
                        ctx.font = '500 12px system-ui, sans-serif';
                        ctx.fillStyle = '#94a3b8';
                        ctx.fillText('الجهة المصدرة: شركة ومصانع سوفانا للزيوت المكررة والسمن الفاخر', canvas.width - 50, 105);
                        
                        const totalDirectPayments = extraPayments.reduce((sum, p) => sum + p.amount, 0);
                        const appliedDebtSum = extraPayments.reduce((sum, p) => sum + (p.appliedToCarriedDebt || 0), 0);
                        
                        ctx.fillText(`المديونية المرحلة المتراكمة: ${carriedOverDebt.toFixed(2)}ج.م  |  المسدد المباشر للمورد: ${totalDirectPayments.toFixed(2)}ج.م  |  مقدمات حبات الشحن: ${grandPaymentsSum.toFixed(2)}ج.م`, canvas.width - 50, 128);

                        // Left info
                        ctx.fillStyle = '#38bdf8';
                        ctx.textAlign = 'left';
                        ctx.font = 'bold 12px system-ui, sans-serif';
                        ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`, 50, 70);
                        
                        let dateRangeStr = 'أرشيف كامل الفترة المتاحة للسجلات';
                        if (archiveStartDate || archiveEndDate) {
                          dateRangeStr = `الفترة المحددة: من ${archiveStartDate || 'البداية'} إلى ${archiveEndDate || 'اليوم'}`;
                        }
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(dateRangeStr, 50, 100);
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.fillText(`إجمالي السجلات: ${filteredLoads.length} شحنة مؤرشفة`, 50, 125);

                        // Table Header
                        let yLoc = 190;
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(35, yLoc, canvas.width - 70, 42);

                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        
                        ctx.textAlign = 'center';
                        ctx.fillText('م', 900, yLoc + 26);
                        ctx.textAlign = 'right';
                        ctx.fillText('الصنف وحجم العبوة المحملة', 870, yLoc + 26);
                        ctx.fillText('تاريخ وقت الشحنة', 640, yLoc + 26);
                        ctx.textAlign = 'left';
                        ctx.fillText('سعر الكرتونة', 520, yLoc + 26);
                        ctx.fillText('الكمية (كرتونة)', 425, yLoc + 26);
                        ctx.fillText('إجمالي القيمة', 325, yLoc + 26);
                        ctx.fillText('المسدد (مقدم)', 215, yLoc + 26);
                        ctx.fillStyle = '#fecdd3';
                        ctx.font = 'bold 11.5px system-ui, sans-serif';
                        ctx.fillText('صافي المتبقي للمصنع', 105, yLoc + 26);

                        yLoc += 42;

                        [...filteredLoads].forEach((load, idx) => {
                          const prod = products.find(p => p.id === load.productId);
                           const weights = prod ? getProductWeightsFallback(prod) : [];
                           const weight = weights.find(w => w.id === load.weightId) || weights[0];
                           const cartonPrice = weight?.cartonPriceFromFactory || 0;
                           const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                           
                           const loadVal = loadedCartons * cartonPrice;
                           const paidVal = load.advanceAmount || 0;
                           const remainingVal = loadVal - paidVal;

                           if (idx % 2 === 0) {
                             ctx.fillStyle = '#f8fafc';
                           } else {
                             ctx.fillStyle = '#ffffff';
                           }
                           ctx.fillRect(35, yLoc, canvas.width - 70, rowHeight);

                           ctx.strokeStyle = '#e2e8f0';
                           ctx.lineWidth = 1;
                           ctx.strokeRect(35, yLoc, canvas.width - 70, rowHeight);

                           ctx.fillStyle = '#334155';
                           ctx.font = 'bold 11px system-ui, sans-serif';
                           ctx.textAlign = 'center';
                           ctx.fillText((idx + 1).toString(), 900, yLoc + 28);

                           ctx.textAlign = 'right';
                           ctx.fillStyle = '#0f172a';
                           ctx.fillText(`${prod?.name || 'مجهول'} (${weight?.size || '-'})`, 870, yLoc + 28);
                           
                           ctx.fillStyle = '#64748b';
                           ctx.font = '10px system-ui, sans-serif';
                           const dObj = new Date(load.date);
                           ctx.fillText(`${dObj.toLocaleDateString('ar-EG')} ${dObj.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}`, 640, yLoc + 28);

                           ctx.textAlign = 'left';
                           ctx.font = 'bold 11px system-ui, sans-serif';
                           ctx.fillStyle = '#475569';
                           ctx.fillText(`${cartonPrice.toFixed(2)}ج.م`, 520, yLoc + 28);
                           
                           ctx.fillStyle = '#0f172a';
                           ctx.fillText(`${loadedCartons} كرتونة`, 425, yLoc + 28);
                           
                           ctx.fillStyle = '#4f46e5';
                           ctx.fillText(`${loadVal.toFixed(2)}ج.م`, 325, yLoc + 28);
                           
                           ctx.fillStyle = '#10b981';
                           ctx.fillText(`${paidVal.toFixed(2)}ج.م`, 215, yLoc + 28);
                           
                           ctx.fillStyle = remainingVal > 0 ? '#ef4444' : '#1e293b';
                           ctx.font = 'bold 11.5px system-ui, sans-serif';
                           ctx.fillText(`${remainingVal.toFixed(2)}ج.م`, 105, yLoc + 28);

                           yLoc += rowHeight;
                        });

                        yLoc += 15;
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(35, yLoc, canvas.width - 70, summaryCardHeight);
                        ctx.strokeStyle = '#cbd5e1';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(35, yLoc, canvas.width - 70, summaryCardHeight);

                        ctx.fillStyle = '#0f172a';
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.textAlign = 'right';
                        ctx.fillText('التلخيص الإجمالي والأرصدة الختامية لبيان الأرشيف المالي:', canvas.width - 55, yLoc + 30);

                        ctx.strokeStyle = '#e2e8f0';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(35, yLoc + 45);
                        ctx.lineTo(canvas.width - 35, yLoc + 45);
                        ctx.stroke();

                        const finalWithdrawn = grandLoadsSum + carriedOverDebt + appliedDebtSum;
                        const finalPayments = grandPaymentsSum + totalDirectPayments;
                        const finalRemaining = Math.max(0, finalWithdrawn - finalPayments);

                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#475569';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText('إجمالي قيمة شحنات التحميل', 760, yLoc + 75);
                        ctx.fillStyle = '#4f46e5';
                        ctx.font = 'bold 18px system-ui, sans-serif';
                        ctx.fillText(`${finalWithdrawn.toFixed(2)}ج.م`, 760, yLoc + 105);

                        ctx.strokeStyle = '#cbd5e1';
                        ctx.beginPath(); ctx.moveTo(620, yLoc + 60); ctx.lineTo(620, yLoc + 115); ctx.stroke();

                        ctx.fillStyle = '#475569';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText('إجمالي المبالغ المسددة (المقدم)', 470, yLoc + 75);
                        ctx.fillStyle = '#10b981';
                        ctx.font = 'bold 18px system-ui, sans-serif';
                        ctx.fillText(`${finalPayments.toFixed(2)}ج.م`, 470, yLoc + 105);

                        ctx.beginPath(); ctx.moveTo(320, yLoc + 60); ctx.lineTo(320, yLoc + 115); ctx.stroke();

                        ctx.fillStyle = '#475569';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText('صافي المتبقي للمصنع (المستحق الختامي)', 170, yLoc + 75);
                        ctx.fillStyle = '#ef4444';
                        ctx.font = 'bold 20px system-ui, sans-serif';
                        ctx.fillText(`${finalRemaining.toFixed(2)}ج.م`, 170, yLoc + 105);

                        yLoc += summaryCardHeight + 25;

                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(35, yLoc, 380, 95);
                        ctx.strokeStyle = '#94a3b8';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(35, yLoc, 380, 95);

                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.textAlign = 'right';
                        ctx.fillText('اعتماد توقيع مندوب المبيعات الميداني:', 400, yLoc + 30);
                        ctx.font = 'normal 10px system-ui, sans-serif';
                        ctx.fillText('الاسم: ...........................................................', 400, yLoc + 55);
                        ctx.fillText('التوقيع: ..........................................................', 400, yLoc + 75);

                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(435, yLoc, 480, 95);
                        ctx.strokeRect(435, yLoc, 480, 95);

                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText('التسليم والمراجعة الإدارية من قبل إدارة الحسابات بالمصنع:', 895, yLoc + 30);
                        ctx.font = 'normal 10px system-ui, sans-serif';
                        ctx.fillText('المستلم الإداري: ..................................................', 895, yLoc + 55);
                        ctx.fillText('توقيع وختم المصنع: ................................................', 895, yLoc + 75);

                        const dataUrl = canvas.toDataURL('image/png');
                        const pdfWidth = 210;
                        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                        const doc = new jsPDF({
                          orientation: 'portrait',
                          unit: 'mm',
                          format: [pdfWidth, Math.max(297, pdfHeight + 10)]
                        });

                        doc.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                        doc.save(`كشف_حساب_وفاتورة_المصنع_${new Date().toISOString().substring(0, 10)}.pdf`);
                      }}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      <Printer className="h-4 w-4" />
                      <span>تنزيل بيان المبيعات والتحميل المعتمد (PDF) 📄</span>
                    </button>
                    <button type="button" onClick={() => {
                        if (filteredLoads.length === 0) return;

                        const canvas = document.createElement('canvas');
                        canvas.width = 950;
                        const rowHeight = 48;
                        const headerHeight = 220;
                        const summaryCardHeight = 130;
                        const footerHeight = 110;
                        canvas.height = headerHeight + 50 + (filteredLoads.length * rowHeight) + summaryCardHeight + footerHeight + 40;

                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        ctx.direction = 'rtl';

                        let grandLoadsSum = 0;
                        let grandPaymentsSum = 0;
                        let grandRemainingSum = 0;

                        [...filteredLoads].forEach((load) => {
                          const prod = products.find(p => p.id === load.productId);
                          const weights = prod ? getProductWeightsFallback(prod) : [];
                          const weight = weights.find(w => w.id === load.weightId) || weights[0];
                          const cartonPrice = weight?.cartonPriceFromFactory || 0;
                          const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                          const loadVal = loadedCartons * cartonPrice;
                          const paidVal = load.advanceAmount || 0;
                          const remainingVal = loadVal - paidVal;

                          grandLoadsSum += loadVal;
                          grandPaymentsSum += paidVal;
                          grandRemainingSum += remainingVal;
                        });

                        // Background fill
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(15, 15, canvas.width - 30, canvas.height - 30);

                        // Double borders
                        ctx.strokeStyle = '#cbd5e1';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
                        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

                        // Stripe
                        ctx.fillStyle = '#4f46e5';
                        ctx.fillRect(20, 20, canvas.width - 40, 10);

                        // Header
                        const headerGrad = ctx.createLinearGradient(20, 30, canvas.width - 20, 30);
                        headerGrad.addColorStop(0, '#0f172a');
                        headerGrad.addColorStop(1, '#1e293b');
                        ctx.fillStyle = headerGrad;
                        ctx.fillRect(20, 30, canvas.width - 40, 125);

                        // Title
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'right';
                        ctx.font = 'bold 24px system-ui, sans-serif';
                        ctx.fillText('كشف تصفية وفاتورة أرشيف حسابات المصنع والسيارة', canvas.width - 50, 75);

                        // Sub titles
                        ctx.font = '500 12px system-ui, sans-serif';
                        ctx.fillStyle = '#94a3b8';
                        ctx.fillText('الجهة المصدرة: شركة ومصانع سوفانا للزيوت المكررة والسمن الفاخر', canvas.width - 50, 105);
                        
                        const totalDirectPaymentsImg = extraPayments.reduce((sum, p) => sum + p.amount, 0);
                        const appliedDebtSumImg = extraPayments.reduce((sum, p) => sum + (p.appliedToCarriedDebt || 0), 0);
                        
                        ctx.fillText(`المديونية المرحلة المتراكمة: ${carriedOverDebt.toFixed(2)}ج.م  |  المسدد المباشر للمورد: ${totalDirectPaymentsImg.toFixed(2)}ج.م  |  مقدمات حبات الشحن: ${grandPaymentsSum.toFixed(2)}ج.م`, canvas.width - 50, 128);

                        // Left info
                        ctx.fillStyle = '#38bdf8';
                        ctx.textAlign = 'left';
                        ctx.font = 'bold 12px system-ui, sans-serif';
                        ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`, 50, 70);
                        
                        let dateRangeStr = 'أرشيف كامل الفترة المتاحة للسجلات';
                        if (archiveStartDate || archiveEndDate) {
                          dateRangeStr = `الفترة المحددة: من ${archiveStartDate || 'البداية'} إلى ${archiveEndDate || 'اليوم'}`;
                        }
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(dateRangeStr, 50, 100);
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.fillText(`إجمالي السجلات: ${filteredLoads.length} شحنة مؤرشفة`, 50, 125);

                        // Table Header
                        let yLoc = 190;
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(35, yLoc, canvas.width - 70, 42);

                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        
                        ctx.textAlign = 'center';
                        ctx.fillText('م', 900, yLoc + 26);
                        ctx.textAlign = 'right';
                        ctx.fillText('الصنف وحجم العبوة المحملة', 870, yLoc + 26);
                        ctx.fillText('تاريخ وقت الشحنة', 640, yLoc + 26);
                        ctx.textAlign = 'left';
                        ctx.fillText('سعر الكرتونة', 520, yLoc + 26);
                        ctx.fillText('الكمية (كرتونة)', 425, yLoc + 26);
                        ctx.fillText('إجمالي القيمة', 325, yLoc + 26);
                        ctx.fillText('المسدد (مقدم)', 215, yLoc + 26);
                        ctx.fillStyle = '#fecdd3';
                        ctx.font = 'bold 11.5px system-ui, sans-serif';
                        ctx.fillText('صافي المتبقي للمصنع', 105, yLoc + 26);

                        yLoc += 42;

                        grandLoadsSum = 0;
                        grandPaymentsSum = 0;
                        grandRemainingSum = 0;

                        [...filteredLoads].forEach((load, idx) => {
                          const prod = products.find(p => p.id === load.productId);
                           const weights = prod ? getProductWeightsFallback(prod) : [];
                           const weight = weights.find(w => w.id === load.weightId) || weights[0];
                           const cartonPrice = weight?.cartonPriceFromFactory || 0;
                           const loadedCartons = Number((load.cartonsCount !== undefined ? load.cartonsCount : (load.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                           
                           const loadVal = loadedCartons * cartonPrice;
                           const paidVal = load.advanceAmount || 0;
                           const remainingVal = loadVal - paidVal;

                           grandLoadsSum += loadVal;
                           grandPaymentsSum += paidVal;
                           grandRemainingSum += remainingVal;

                           if (idx % 2 === 0) {
                             ctx.fillStyle = '#f8fafc';
                           } else {
                             ctx.fillStyle = '#ffffff';
                           }
                           ctx.fillRect(35, yLoc, canvas.width - 70, rowHeight);

                           ctx.strokeStyle = '#e2e8f0';
                           ctx.lineWidth = 1;
                           ctx.strokeRect(35, yLoc, canvas.width - 70, rowHeight);

                           ctx.fillStyle = '#334155';
                           ctx.font = 'bold 11px system-ui, sans-serif';
                           ctx.textAlign = 'center';
                           ctx.fillText((idx + 1).toString(), 900, yLoc + 28);

                           ctx.textAlign = 'right';
                           ctx.fillStyle = '#0f172a';
                           ctx.fillText(`${prod?.name || 'مجهول'} (${weight?.size || '-'})`, 870, yLoc + 28);
                           
                           ctx.fillStyle = '#64748b';
                           ctx.font = '10px system-ui, sans-serif';
                           const dObj = new Date(load.date);
                           ctx.fillText(`${dObj.toLocaleDateString('ar-EG')} ${dObj.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}`, 640, yLoc + 28);

                           ctx.textAlign = 'left';
                           ctx.font = 'bold 11px system-ui, sans-serif';
                           ctx.fillStyle = '#475569';
                           ctx.fillText(`${cartonPrice.toFixed(2)}ج.م`, 520, yLoc + 28);
                           
                           ctx.fillStyle = '#0f172a';
                           ctx.fillText(`${loadedCartons} كرتونة`, 425, yLoc + 28);
                           
                           ctx.fillStyle = '#4f46e5';
                           ctx.fillText(`${loadVal.toFixed(2)}ج.م`, 325, yLoc + 28);
                           
                           ctx.fillStyle = '#10b981';
                           ctx.fillText(`${paidVal.toFixed(2)}ج.م`, 215, yLoc + 28);
                           
                           ctx.fillStyle = remainingVal > 0 ? '#ef4444' : '#1e293b';
                           ctx.font = 'bold 11.5px system-ui, sans-serif';
                           ctx.fillText(`${remainingVal.toFixed(2)}ج.م`, 105, yLoc + 28);

                           yLoc += rowHeight;
                        });

                        yLoc += 15;
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(35, yLoc, canvas.width - 70, summaryCardHeight);
                        ctx.strokeStyle = '#cbd5e1';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(35, yLoc, canvas.width - 70, summaryCardHeight);

                        ctx.fillStyle = '#0f172a';
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.textAlign = 'right';
                        ctx.fillText('التلخيص الإجمالي والأرصدة الختامية لبيان الأرشيف المالي:', canvas.width - 55, yLoc + 30);

                        ctx.strokeStyle = '#e2e8f0';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(35, yLoc + 45);
                        ctx.lineTo(canvas.width - 35, yLoc + 45);
                        ctx.stroke();

                        const finalWithdrawnImg = grandLoadsSum + carriedOverDebt + appliedDebtSumImg;
                        const finalPaymentsImg = grandPaymentsSum + totalDirectPaymentsImg;
                        const finalRemainingImg = Math.max(0, finalWithdrawnImg - finalPaymentsImg);

                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#475569';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText('إجمالي قيمة شحنات التحميل', 760, yLoc + 75);
                        ctx.fillStyle = '#4f46e5';
                        ctx.font = 'bold 18px system-ui, sans-serif';
                        ctx.fillText(`${finalWithdrawnImg.toFixed(2)}ج.م`, 760, yLoc + 105);

                        ctx.strokeStyle = '#cbd5e1';
                        ctx.beginPath(); ctx.moveTo(620, yLoc + 60); ctx.lineTo(620, yLoc + 115); ctx.stroke();

                        ctx.fillStyle = '#475569';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText('إجمالي المبالغ المسددة (المقدم)', 470, yLoc + 75);
                        ctx.fillStyle = '#10b981';
                        ctx.font = 'bold 18px system-ui, sans-serif';
                        ctx.fillText(`${finalPaymentsImg.toFixed(2)}ج.م`, 470, yLoc + 105);

                        ctx.beginPath(); ctx.moveTo(320, yLoc + 60); ctx.lineTo(320, yLoc + 115); ctx.stroke();

                        ctx.fillStyle = '#475569';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText('صافي المتبقي للمصنع (المستحق الختامي)', 170, yLoc + 75);
                        ctx.fillStyle = '#ef4444';
                        ctx.font = 'bold 20px system-ui, sans-serif';
                        ctx.fillText(`${finalRemainingImg.toFixed(2)}ج.م`, 170, yLoc + 105);

                        yLoc += summaryCardHeight + 25;

                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(35, yLoc, 380, 95);
                        ctx.strokeStyle = '#94a3b8';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(35, yLoc, 380, 95);

                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.textAlign = 'right';
                        ctx.fillText('اعتماد توقيع مندوب المبيعات الميداني:', 400, yLoc + 30);
                        ctx.font = 'normal 10px system-ui, sans-serif';
                        ctx.fillText('الاسم: ...........................................................', 400, yLoc + 55);
                        ctx.fillText('التوقيع: ..........................................................', 400, yLoc + 75);

                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(435, yLoc, 480, 95);
                        ctx.strokeRect(435, yLoc, 480, 95);

                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText('التسليم والمراجعة الإدارية من قبل إدارة الحسابات بالمصنع:', 895, yLoc + 30);
                        ctx.font = 'normal 10px system-ui, sans-serif';
                        ctx.fillText('المستلم الإداري: ..................................................', 895, yLoc + 55);
                        ctx.fillText('توقيع وختم المصنع: ................................................', 895, yLoc + 75);

                        const dataUrl = canvas.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.download = `فاتورة-وبيان-أرشيف-المصنع-${new Date().getTime()}.png`;
                        link.href = dataUrl;
                        link.click();
                      }} className="flex-1 text-xs bg-[#FFFFFF] hover:bg-slate-50 text-[#1A365D] py-2 rounded-xl border border-slate-200 cursor-pointer font-extrabold flex items-center justify-center gap-1.5 transition-colors">
                      <Download className="h-4 w-4 text-indigo-600" /> تنزيل صورة الفاتورة المعتمدة 🖼️
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
                    const prod = products.find(p => p.id === load.productId);
                    const weights = prod ? getProductWeightsFallback(prod) : [];
                    const weight = weights.find(w => w.id === load.weightId) || weights[0];
                    const accountingUnitLabel = prod?.accountingUnit || 'كرتونة';

                    const cartonPrice = weight?.cartonPriceFromFactory || 0;
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
                            onClick={async () => { if (await confirmDialog("هل أنت متأكد من حذف هذه الشحنة المحملة نهائياً من الأرشيف؟")) {
                                onDeleteLoad(load.id);
                              }
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
                            <span className="block font-black text-[#1A365D] text-sm">{prod ? prod.name : 'صنف مجهول'}</span>
                            <span className="block text-[11px] text-[#2B6CB0] font-bold mt-0.5">الوزن / الحجم: {weight ? weight.size : 'حجم مبدئي'}</span>
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
                  })
                )}
                
                {/* Invoice-like summary for Factory Archive */}
                {filteredLoads.length > 0 && (
                  <div className="mt-4 bg-[#1A365D] text-white border-transparent text-white p-5 rounded-2xl flex flex-col gap-3 shadow-md">
                    <h3 className="text-center font-bold text-sm border-b border-slate-700 pb-2 mb-1">ملخص حساب الأرشيف المفلتر</h3>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">إجمالي قيمة المحمل:</span>
                      <span className="font-bold font-mono">{filteredLoads.reduce((sum, l) => {
                          const prod = products.find(p => p.id === l.productId);
                          const weights = prod ? getProductWeightsFallback(prod) : [];
                          const weight = weights.find(w => w.id === l.weightId) || weights[0];
                          const cartonPrice = weight?.cartonPriceFromFactory || 0;
                          const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                          return sum + (loadedCartons * cartonPrice);
                        }, 0).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
                      <span className="text-slate-300">إجمالي المسدد:</span>
                      <span className="font-bold font-mono text-emerald-400">{filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-black text-slate-100">المتبقي للمصنع:</span>
                      <span className="text-lg font-black font-mono text-amber-400">{Math.max(0, filteredLoads.reduce((sum, l) => {
                        const prod = products.find(p => p.id === l.productId);
                        const weights = prod ? getProductWeightsFallback(prod) : [];
                        const weight = weights.find(w => w.id === l.weightId) || weights[0];
                        const cartonPrice = weight?.cartonPriceFromFactory || 0;
                        const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                        return sum + (loadedCartons * cartonPrice);
                      }, 0) - filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0)).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}ج.م</span>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}

            {archiveSection === 'trips' && (
              <div className="flex flex-col gap-3 mt-2">
                {filteredArchiveTrips.length > 0 && (
                  <button type="button" onClick={() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 800;
                    canvas.height = 150 + (filteredArchiveTrips.length * 80) + 100;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    ctx.direction = 'rtl';
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.fillStyle = '#0f172a';
                    ctx.font = 'bold 24px system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('كشف المشاوير المسددة', canvas.width / 2, 50);
                    
                    ctx.fillStyle = '#64748b';
                    ctx.font = '14px system-ui, sans-serif';
                    ctx.fillText(`تاريخ الكشف: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`, canvas.width / 2, 80);
                    
                    let y = 130;
                    const reversedTrips = [...filteredArchiveTrips].reverse();
                    
                    reversedTrips.forEach((trip) => {
                      ctx.fillStyle = '#f8fafc';
                      ctx.fillRect(35, y, 730, 70);
                      ctx.strokeStyle = '#e2e8f0';
                      ctx.lineWidth = 1;
                      ctx.strokeRect(35, y, 730, 70);
                      
                      ctx.fillStyle = '#1e293b';
                      ctx.font = 'bold 16px system-ui, sans-serif';
                      ctx.textAlign = 'right';
                      ctx.fillText(`${trip.description}`, canvas.width - 55, y + 25);
                      
                      ctx.fillStyle = '#64748b';
                      ctx.font = '12px system-ui, sans-serif';
                      ctx.fillText(`التاريخ: ${trip.date}`, canvas.width - 55, y + 50);
                      
                      ctx.fillStyle = '#10b981';
                      ctx.font = 'bold 16px system-ui, sans-serif';
                      ctx.textAlign = 'left';
                      ctx.fillText(`مسدد: ${trip.price}ج.م`, 55, y + 40);
                      
                      y += 80;
                    });
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = `كشف-مشاوير-مسددة-${new Date().getTime()}.png`;
                    link.href = dataUrl;
                    link.click();
                  }} className="text-xs bg-indigo-50 text-[#1A365D] py-2 rounded-xl border border-indigo-200 cursor-pointer font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-100 transition-colors w-full mb-1">
                    <Download className="h-4 w-4" /> تنزيل صورة المشاوير المحصلة
                  </button>
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
                        const prod = products.find(p => p.id === load.productId);
                        const weights = prod ? getProductWeightsFallback(prod) : [];
                        const weight = weights.find(w => w.id === load.weightId) || weights[0];
                        const cartonPrice = weight?.cartonPriceFromFactory || 0;
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
                              {prod?.name || 'مجهول'} <span className="text-[9px] text-[#2B6CB0]">({weight?.size || ''})</span>
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
                          const prod = products.find(p => p.id === l.productId);
                          const weights = prod ? getProductWeightsFallback(prod) : [];
                          const weight = weights.find(w => w.id === l.weightId) || weights[0];
                          const cartonPrice = weight?.cartonPriceFromFactory || 0;
                          const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                          return sum + (loadedCartons * cartonPrice);
                        }, 0).toFixed(2)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-emerald-800">
                      <span>إجمالي الدفعات المقدمة والمباشرة المفلترة:</span>
                      <span>
                        {filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0).toFixed(2)}ج.م
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 text-rose-800 text-sm">
                       <span>المتبقي للمصنع (المبلغ المدين الباقي):</span>
                       <span>
                          {Math.max(0, filteredLoads.reduce((sum, l) => {
                            const prod = products.find(p => p.id === l.productId);
                            const weights = prod ? getProductWeightsFallback(prod) : [];
                            const weight = weights.find(w => w.id === l.weightId) || weights[0];
                            const cartonPrice = weight?.cartonPriceFromFactory || 0;
                            const loadedCartons = Number((l.cartonsCount !== undefined ? l.cartonsCount : (l.quantity / (weight?.unitsPerCarton || 12))).toFixed(3));
                            return sum + (loadedCartons * cartonPrice);
                          }, 0) - filteredLoads.reduce((sum, l) => sum + (l.advanceAmount || 0), 0)).toFixed(2)}ج.م
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
                onAddTrip({ description: tripDescription.trim(), price: parsedPrice, date: tripDate, collected: false });
                setTripDescription('');
                setTripPrice('');
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
                  <button type="button" onClick={() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 800;
                    const pendingTrips = (trips || []).filter(t => !t.collected);
                    canvas.height = 150 + (pendingTrips.length * 80) + 100;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    ctx.direction = 'rtl';
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.fillStyle = '#0f172a';
                    ctx.font = 'bold 24px system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('كشف المشاوير المعلقة (غير المحصلة)', canvas.width / 2, 50);
                    
                    ctx.fillStyle = '#64748b';
                    ctx.font = '14px system-ui, sans-serif';
                    ctx.fillText(`تاريخ الكشف: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`, canvas.width / 2, 80);
                    
                    let y = 130;
                    const filteredTrips = [...pendingTrips].reverse();
                    
                    filteredTrips.forEach((trip, idx) => {
                      ctx.fillStyle = '#f8fafc';
                      ctx.fillRect(35, y, 730, 70);
                      ctx.strokeStyle = '#e2e8f0';
                      ctx.lineWidth = 1;
                      ctx.strokeRect(35, y, 730, 70);
                      
                      ctx.fillStyle = '#1e293b';
                      ctx.font = 'bold 16px system-ui, sans-serif';
                      ctx.textAlign = 'right';
                      ctx.fillText(`${trip.description}`, canvas.width - 55, y + 25);
                      
                      ctx.fillStyle = '#64748b';
                      ctx.font = '12px system-ui, sans-serif';
                      ctx.fillText(`التاريخ: ${trip.date}`, canvas.width - 55, y + 50);
                      
                      ctx.fillStyle = trip.price > 0 ? '#4f46e5' : '#ef4444';
                      ctx.font = 'bold 16px system-ui, sans-serif';
                      ctx.textAlign = 'left';
                      ctx.fillText(trip.price > 0 ? `${trip.price}ج.م` : 'غير مسعر', 55, y + 25);
                      
                      y += 80;
                    });
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = `كشف-مشاوير-معلقة-${new Date().getTime()}.png`;
                    link.href = dataUrl;
                    link.click();
                  }} className="text-[10px] bg-indigo-50 text-[#1A365D] px-2 py-1.5 rounded-lg border border-indigo-200 cursor-pointer font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                    <Download className="h-3 w-3" /> تنزيل صورة
                  </button>
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
                          <button type="button" onClick={async () => {   if (await confirmDialog('هل تريد حذف هذا المشوار؟')) { onDeleteTrip(trip.id);  } }} className="p-1.5 text-gray-400 hover:text-[#DD6B20] hover:bg-rose-50 rounded-lg cursor-pointer border border-transparent hover:border-rose-100">
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
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (await confirmDialog(`حذف الصنف [${p.name}] من النظام؟`)) {
                                    onDeleteProduct(p.id);
                                  }
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
                          {ws.map((w, index) => (
                            <div key={w.id || index} className="pt-1.5 first:pt-0 flex flex-wrap justify-between items-center text-[11px] text-[#2B6CB0] font-medium border-b-0 pb-1 mb-1 border-b border-b-slate-100/50">
                              <span>وزن: <strong className="text-slate-850 font-bold">{w.size}</strong></span>
                              <span>سعر {labelUnit}: <strong className="text-[#1A365D] font-bold">{w.cartonPriceFromFactory}ج.م</strong></span>
                            </div>
                          ))}
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

            {/* Top Grid of Balance sheet */}
            <div className="grid grid-cols-3 gap-2 font-sans">
              <div className="bg-[#1A365D] text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                <span className="text-[10px] text-indigo-205 font-bold">الحساب (المدين)</span>
                <span className="text-sm font-black mt-2 font-mono">
                  {formatNum(factoryBalanceDetails.totalWithdrawnValue)} <span className="text-[10px]">ج.م</span>
                </span>
              </div>
              <div className="bg-[#10B981] text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                <span className="text-[10px] text-emerald-100 font-bold">المسدد للمورد</span>
                <span className="text-sm font-black mt-2 font-mono">
                  {formatNum(factoryBalanceDetails.totalAdvancePayments)} <span className="text-[10px]">ج.م</span>
                </span>
              </div>
              <div className="bg-rose-600 text-white p-3 rounded-2xl shadow-sm flex flex-col justify-between">
                <span className="text-[10px] text-rose-100 font-bold">المتبقي للمصنع</span>
                <span className="text-sm font-black mt-2 font-mono">
                  {formatNum(factoryBalanceDetails.netRemainingDueToFactory)} <span className="text-[10px]">ج.م</span>
                </span>
              </div>
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

                      const paymentItem = {
                        id: Date.now().toString(),
                        amount,
                        appliedToCarriedDebt,
                        date: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
                        notes: newPaymentNotes.trim() || 'تسديد مباشر'
                      };
                      setExtraPayments(prev => [...prev, paymentItem]);
                      setNewPaymentAmount('');
                      setNewPaymentNotes('');
                      showToast(`✓ تم تسجيل دفعة مالية للمصنع بقيمة ${amount}ج.م بنجاح!`);
                    }}
                    className="bg-[#DD6B20] text-white hover:bg-[#C05621] text-white font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer transition-all active:scale-95 text-center mt-1"
                  >
                    اعتماد السداد
                  </button>
                </div>
              </div>

              {/* Panel B: خانة المتبقي للمصنع (Dynamic Field & Complete Payment Resolve) */}
              {factoryBalanceDetails.netRemainingDueToFactory > 0 ? (
                <div className="bg-[#FFF5F5] border border-rose-200 p-4.5 rounded-2xl shadow-sm flex flex-col gap-3 animate-fade-in" id="factory-remaining-box">
                  <span className="text-xs font-black text-rose-800 flex items-center gap-1 bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-100 w-max">
                    <AlertCircle className="h-4 w-4 text-rose-600 animate-pulse" />
                    المتبقي للمصنع حالياً
                  </span>

                  <div className="flex flex-col gap-2.5 mt-1">
                    <div className="bg-white border border-rose-150 p-3 rounded-xl text-center">
                      <span className="text-[10px] block font-bold text-slate-500 mb-1">المبلغ المتبقي الملتزم سداده للمورد:</span>
                      <span className="text-xl font-black font-mono text-rose-600">
                        {formatNum(factoryBalanceDetails.netRemainingDueToFactory)} <span className="text-xs">ج.م</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        const remainingAmount = factoryBalanceDetails.netRemainingDueToFactory;
                        const confirmed = await confirmDialog(`تأكيد السداد: هل تم بالفعل سداد كامل المبلغ الملاحظ للمصنع وهو بقيمة ${formatNum(remainingAmount)}ج.م، تمهيداً لترحيل وتصفير العملية كاملة للأرشيف المغلق؟`);
                        if (confirmed) {
                          const settlementPayment = {
                            id: Date.now().toString(),
                            amount: remainingAmount,
                            appliedToCarriedDebt: 0,
                            date: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
                            notes: 'سداد كامل المبلغ المتبقي وتصفية الحساب'
                          };
                          setExtraPayments(prev => [...prev, settlementPayment]);

                          // Save this settled cycle in archive
                          const cycleArchive = {
                            id: Date.now().toString(),
                            clearedAt: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
                            totalWithdrawnValue: factoryBalanceDetails.totalWithdrawnValue,
                            totalAdvancePayments: factoryBalanceDetails.totalAdvancePayments + remainingAmount,
                            paymentsCount: extraPayments.length + 1
                          };
                          const existingCycles = JSON.parse(localStorage.getItem('factory_settled_cycles_archive_sys') || '[]');
                          localStorage.setItem('factory_settled_cycles_archive_sys', JSON.stringify([...existingCycles, cycleArchive]));

                          showToast("✓ تم تصفية مديونية المصنع بنجاح ونقلها للأرشيف!");
                        }
                      }}
                      className="bg-[#10B981] hover:bg-[#10B981] text-white active:scale-95 text-xs font-black py-2 rounded-xl cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-100 shrink-0" />
                      <span>تم السداد بالكامل</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-4.5 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center gap-1 animate-fade-in">
                  <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center mb-1">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <span className="text-xs font-extrabold text-emerald-950">الحساب المالي صفر ومصفّر</span>
                  <p className="text-[10px] text-slate-500 font-bold leading-normal max-w-xs">ليست هناك أي مبالغ أو استحقاقات متبقية معلقة لصالح المصنع حاليا.</p>
                </div>
              )}

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
                        <span className="text-[10px] text-[#2B6CB0] font-medium">البيان: {pay.notes} • {pay.date}</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => { if (await confirmDialog("هل ترغب بإلغاء أو حذف دفعة السداد هذه من مراجعة الحساب؟")) {
                            setExtraPayments(prev => prev.filter(p => p.id !== pay.id));
                          }
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

                <div className="max-h-80 overflow-y-auto custom-scroll flex flex-col gap-2.5">
                  {factoryInvoiceSummary.itemsList.length === 0 ? (
                    <p className="text-center text-gray-400 py-6 text-xs font-medium">لا توجد مسحوبات مسجلة.</p>
                  ) : (
                    factoryInvoiceSummary.itemsList.map((item, idx) => (
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

                      products.forEach(p => {
                        const weights = getProductWeightsFallback(p);
                        const weight = weights.find(w => w.id === weightId);
                        if (weight) {
                          pName = p.name;
                          sizeStr = weight.size;
                          accountingUnitLabel = p.accountingUnit || 'كرتونة';
                        }
                      });

                      return (
                        <div key={'sold_' + weightId} className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 flex flex-col gap-1 text-xs">
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-emerald-950">{pName} ({sizeStr})</span>
                            <span className="text-emerald-800">{info.cartons} {accountingUnitLabel}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-[#2B6CB0] mt-0.5 font-medium">
                            <span>إجمالي المبيعات الفردية: {info.units} قطعة</span>
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
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, getProductWeightsFallback, formatNum } from '../types';
import { Tags, ArrowRight, HelpCircle, Calculator, Check, Scale, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface PricesTabProps {
  products: Product[];
  onGoBack: () => void;
}

export default function PricesTab({ products: rawProducts, onGoBack }: PricesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'prices' | 'calc'>('prices');
  const products = useMemo(() => {
    return rawProducts.map(p => {
      const activeWeights = getProductWeightsFallback(p).filter(w => w.cartonPriceFromFactory > 0 && w.retailPricePerUnit > 0);
      return {
        ...p,
        weights: activeWeights
      };
    }).filter(p => p.weights && p.weights.length > 0);
  }, [rawProducts]);

  const toArabicNumerals = (val: string | number): string => {
    return String(val);
  };

  const formatPriceWithCurrencyAndDecimal = (num: number, isFixedZero = false): string => {
    const val = Number(num) || 0;
    return formatNum(val) + ' ج.م';
  };

  const getSizeRowColors = (index: number) => {
    const list = [
      { bg: '#16a34a', text: '#FFFFFF', subBg: '#dcfce7', subText: '#006400' }, // Green / Emerald & dark green
      { bg: '#ea580c', text: '#FFFFFF', subBg: '#ffedd5', subText: '#8b0000' }, // Orange / Red-orange & dark red
      { bg: '#7c3aed', text: '#FFFFFF', subBg: '#f3e8ff', subText: '#4b0082' }, // Royal Purple
      { bg: '#0891b2', text: '#FFFFFF', subBg: '#ecfeff', subText: '#008b8b' }, // Cyan / Teal & dark cyan
      { bg: '#dc2626', text: '#FFFFFF', subBg: '#fee2e2', subText: '#8b0000' }, // Bold Red
      { bg: '#4f46e5', text: '#FFFFFF', subBg: '#e0e7ff', subText: '#000080' }, // Indigo
      { bg: '#ca8a04', text: '#FFFFFF', subBg: '#fef9c3', subText: '#8b8000' }, // Goldish Yellow & dark yellow
      { bg: '#0284c7', text: '#FFFFFF', subBg: '#e0f2fe', subText: '#0000ff' }, // Ocean blue
    ];
    return list[index % list.length];
  };

  const generateCanvas = (prod: any): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rowHeight = 45;
    const headerHeight = 160;
    const footerHeight = 160; 
    const weightsCount = prod.weights.length;
    
    canvas.width = 800;
    canvas.height = headerHeight + (weightsCount * rowHeight * 2) + footerHeight + 10;

    // دعم النصوص العربية للكانفاس
    ctx.direction = 'rtl';

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header Background (Deep Slate Blue)
    ctx.fillStyle = '#0F172A'; 
    ctx.fillRect(0, 0, canvas.width, 92);

    // Yellow accent dividing line
    ctx.fillStyle = '#FBBF24'; 
    ctx.fillRect(0, 90, canvas.width, 2);

    // Draw Title (Centered)
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 23px Cairo, system-ui, sans-serif';
    
    const cleanProdLabel = prod.name.startsWith('زيت') ? prod.name : `زيت ${prod.name}`;
    const formattedTitle = `اسعار ${cleanProdLabel} والخصم المباشر للعميل`;
    ctx.fillText(formattedTitle, canvas.width / 2, 38);

    // Distinct color date line
    const today = new Date();
    const weekdayName = today.toLocaleDateString('ar-EG', { weekday: 'long' });
    const formattedDatePart = `${today.getDate()} / ${today.getMonth() + 1} / ${today.getFullYear()}`;
    
    ctx.fillStyle = '#FBBF24'; // Beautiful standout gold yellow accent color
    ctx.font = 'bold 15px Cairo, system-ui, sans-serif';
    ctx.fillText(`يوم ${weekdayName} بتاريخ: ${toArabicNumerals(formattedDatePart)}`, canvas.width / 2, 72);

    // Table Header Structure (RTL)
    // Draw Column 1 & 2 headers spanning 2 rows: y=92 to 160
    ctx.fillStyle = '#111827'; 
    ctx.fillRect(480, 92, 320, 68); 

    ctx.fillStyle = '#FBBF24'; // Gold text
    ctx.font = 'bold 16px Cairo, system-ui, sans-serif';
    ctx.fillText('السعة اللترية', 720, 132);
    ctx.fillText('سعر التجزئة', 560, 132);

    // Draw Spanned Columns 3, 4, 5
    // Row 1: y=92 to 125 (Merged "نسبة خصم الجملة")
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 92, 480, 33);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px Cairo, system-ui, sans-serif';
    ctx.fillText('نسبة خصم الجملة', 240, 114);

    // Row 2: y=125 to 160 (Discount percentages)
    ctx.fillStyle = '#1E3A8A'; // Blue
    ctx.fillRect(0, 125, 480, 35);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Cairo, system-ui, sans-serif';
    ctx.fillText('%١,٠٠', 400, 147);
    ctx.fillText('%١,٢٥', 240, 147);
    ctx.fillText('%١,٥٠', 80, 147);

    // Draw Table Grid Header Borders
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 92, canvas.width, 68);
    
    // Draw vertical column separators for Header
    ctx.beginPath();
    ctx.moveTo(640, 92); ctx.lineTo(640, 160);
    ctx.moveTo(480, 92); ctx.lineTo(480, 160);
    ctx.moveTo(320, 125); ctx.lineTo(320, 160);
    ctx.moveTo(160, 125); ctx.lineTo(160, 160);
    ctx.moveTo(0, 125); ctx.lineTo(480, 125);
    ctx.stroke();

    let currentY = 160;

    // Draw Rows for each weight
    prod.weights.forEach((w: any, idx: number) => {
      const theme = getSizeRowColors(idx);

      // Access exact computed prices from the helper
      const retailCarton = w.cartonPriceFromFactory;
      const marketCarton = w.carton1;
      const halfWholesaleCarton = w.carton125;
      const wholesaleCarton = w.carton15;

      const retailPiece = w.retailPricePerUnit;
      const marketPiece = w.unit1;
      const halfWholesalePiece = w.unit125;
      const wholesalePiece = w.unit15;

      // 1. Carton Row Background (Full wrap colored theme)
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, currentY, 800, 45);

      // Add text for Carton row
      ctx.fillStyle = theme.text;
      ctx.font = 'bold 15px Cairo, system-ui, sans-serif';
      ctx.textAlign = 'center';
      
      ctx.fillText(toArabicNumerals(w.size), 720, currentY + 28);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(retailCarton), 560, currentY + 28);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(marketCarton), 400, currentY + 28);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(halfWholesaleCarton), 240, currentY + 28);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(wholesaleCarton), 80, currentY + 28);

      // 2. Piece Row Background (Lighter wrap colored theme)
      ctx.fillStyle = theme.subBg;
      ctx.fillRect(0, currentY + 45, 800, 45);

      // Add text for Piece row
      ctx.fillStyle = theme.subText;
      ctx.font = 'bold 13.5px Cairo, system-ui, sans-serif';
      
      ctx.fillText('سعر القطعه', 720, currentY + 73);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(retailPiece), 560, currentY + 73);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(marketPiece), 400, currentY + 73);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(halfWholesalePiece), 240, currentY + 73);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(wholesalePiece), 80, currentY + 73);

      // Draw horizontal lines & column separators for this weight block
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      ctx.moveTo(0, currentY + 45); ctx.lineTo(canvas.width, currentY + 45);
      ctx.moveTo(0, currentY + 90); ctx.lineTo(canvas.width, currentY + 90);
      
      // Vertical borders
      ctx.moveTo(800, currentY); ctx.lineTo(800, currentY + 90);
      ctx.moveTo(640, currentY); ctx.lineTo(640, currentY + 90);
      ctx.moveTo(480, currentY); ctx.lineTo(480, currentY + 90);
      ctx.moveTo(320, currentY); ctx.lineTo(320, currentY + 90);
      ctx.moveTo(160, currentY); ctx.lineTo(160, currentY + 90);
      ctx.moveTo(0, currentY); ctx.lineTo(0, currentY + 90);
      ctx.stroke();

      currentY += 90;
    });

    // Draw Footer Bar 1: Discount source info aligned perfectly underneath specific columns
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(480, currentY, 320, 45); // Below Capacity & Retail Columns
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, currentY, 480, 45); // Below Discount Columns

    ctx.fillStyle = '#FBBF24'; // gold
    ctx.font = 'bold 13.5px Cairo, system-ui, sans-serif';
    ctx.fillText('يتم احتساب الخصم من', 640, currentY + 27); // Centered across Col 1 & 2 (spacing under Capacity + Retail)

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Cairo, system-ui, sans-serif';
    ctx.fillText('فوق ٣٠ كرتونة', 400, currentY + 27); // Under Col 3 (%1,00)
    ctx.fillText('فوق ٥٠ كرتونة', 240, currentY + 27); // Under Col 4 (%1,25)
    ctx.fillText('فوق ١٠٠ كرتونة', 80, currentY + 27); // Under Col 5 (%1,50)

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, currentY, canvas.width, 45);
    ctx.beginPath();
    ctx.moveTo(480, currentY); ctx.lineTo(480, currentY + 45);
    ctx.moveTo(320, currentY); ctx.lineTo(320, currentY + 45);
    ctx.moveTo(160, currentY); ctx.lineTo(160, currentY + 45);
    ctx.stroke();

    // Draw Footer Bar 2: Variable price warning (currentY + 45 to currentY + 95)
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(0, currentY + 45, canvas.width, 50);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Cairo, system-ui, sans-serif';
    ctx.fillText('الاسعار متغيرة طبقا للسعر اليومي 📢', canvas.width / 2, currentY + 77);

    ctx.strokeRect(0, currentY + 45, canvas.width, 50);

    // Draw Greetings Card (currentY + 95 to currentY + 160)
    ctx.fillStyle = '#FFFDFC';
    ctx.fillRect(0, currentY + 95, canvas.width, 65);

    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, currentY + 105, canvas.width - 40, 45);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold italic 13.5px Cairo, system-ui, sans-serif';
    ctx.fillText('عميلنا العزيز، نسعد لخدمتكم دائماً ونفخر بكونكم شركاء نجاحنا وتقدمنا.', canvas.width / 2, currentY + 132);

    // Border surrounding whole canvas to make it super elegant
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    return canvas;
  };

  const downloadPriceListAsImage = (prod: any) => {
    const canvas = generateCanvas(prod);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `بيان_أسعار_${prod.name}_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadPriceListAsPDF = (prod: any) => {
    const canvas = generateCanvas(prod);
    if (!canvas) return;

    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, Math.max(297, pdfHeight + 10)]
    });

    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    doc.save(`بيان_أسعار_${prod.name}_${new Date().toISOString().substring(0, 10)}.pdf`);
  };

  const [calcProductId, setCalcProductId] = useState('');
  const [calcWeightId, setCalcWeightId] = useState('');
  const [calcQty, setCalcQty] = useState('1');
  const [calcDiscount, setCalcDiscount] = useState('1');
  const [calcUnitType, setCalcUnitType] = useState<'carton' | 'piece'>('carton');

  // Compute discounts for products and their corresponding weights
  const productPriceDetails = useMemo(() => {
    return products.map(p => {
      const weights = getProductWeightsFallback(p);
      const weightDetails = weights.map(w => {
        // Individual unit tier discounts
        const u1 = w.retailPricePerUnit * (1 - 0.01);
        const u125 = w.retailPricePerUnit * (1 - 0.0125);
        const u15 = w.retailPricePerUnit * (1 - 0.015);

        // Carton tier discounts
        const c1 = w.cartonPriceFromFactory * (1 - 0.01);
        const c125 = w.cartonPriceFromFactory * (1 - 0.0125);
        const c15 = w.cartonPriceFromFactory * (1 - 0.015);

        return {
          ...w,
          unit1: Number(u1.toFixed(3)),
          unit125: Number(u125.toFixed(3)),
          unit15: Number(u15.toFixed(3)),
          carton1: Number(c1.toFixed(2)),
          carton125: Number(c125.toFixed(2)),
          carton15: Number(c15.toFixed(2)),
        };
      });

      return {
        ...p,
        weights: weightDetails
      };
    });
  }, [products]);

  // Selected product and weights for calc
  const selectedCalcProduct = useMemo(() => {
    return products.find(p => p.id === calcProductId);
  }, [calcProductId, products]);

  const calcWeightsList = useMemo(() => {
    if (!selectedCalcProduct) return [];
    return getProductWeightsFallback(selectedCalcProduct);
  }, [selectedCalcProduct]);

  // Dynamic sandbox calculator values using selected weight
  const calcResult = useMemo(() => {
    if (!selectedCalcProduct) return null;
    const weightsList = getProductWeightsFallback(selectedCalcProduct);
    const selectedWeight = weightsList.find(w => w.id === calcWeightId) || weightsList[0];
    if (!selectedWeight) return null;

    const qty = parseInt(calcQty) || 1;
    const discount = parseFloat(calcDiscount) || 0;
    const isCarton = calcUnitType === 'carton';
    const unitsPerCarton = selectedWeight.unitsPerCarton || 12;

    const basePrice = isCarton ? selectedWeight.cartonPriceFromFactory : selectedWeight.retailPricePerUnit;
    const singleFinalPrice = basePrice * (1 - discount / 100);
    const totalPriceBeforeDiscount = basePrice * qty;
    const totalPriceAfterDiscount = singleFinalPrice * qty;
    const savings = totalPriceBeforeDiscount * (discount / 100);

    return {
      productName: selectedCalcProduct.name,
      weightSize: selectedWeight.size,
      qty,
      discountPercent: discount,
      isCarton,
      unitsPerCarton,
      baseUnitPrice: basePrice,
      finalUnitPrice: singleFinalPrice,
      totalPriceBeforeDiscount,
      totalPriceAfterDiscount,
      savings
    };
  }, [calcProductId, calcWeightId, calcQty, calcDiscount, calcUnitType, products]);

  // Handle selected product swap
  const handleProductChange = (id: string) => {
    setCalcProductId(id);
    const prod = products.find(p => p.id === id);
    if (prod) {
      const wList = getProductWeightsFallback(prod);
      if (wList.length > 0) {
        setCalcWeightId(wList[0].id);
      } else {
        setCalcWeightId('');
      }
    } else {
      setCalcWeightId('');
    }
  };

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12" id="prices-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="h-6 w-6 text-indigo-200" />
          <h1 className="text-xl font-bold">قائمة الأسعار والشرائح</h1>
        </div>
        <button
          onClick={onGoBack}
          className="bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 active:scale-95 text-white rounded-lg py-1.5 px-3.5 text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>الرئيسية</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-xl mx-auto p-4 flex flex-col gap-5">
        
        {/* Sub-tabs for navigation */}
        <div className="flex bg-[#F7FAFC] p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('prices')}
            className={`flex-1 py-1.5 px-1 rounded-xl font-black text-[13px] transition-all cursor-pointer select-none ${
              activeSubTab === 'prices' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-indigo-500 shadow-sm rounded-none' : 'text-[#9CA3AF] bg-transparent border-transparent'
            }`}
          >
            جدول قائمة الأسعار
          </button>
          <button
            onClick={() => setActiveSubTab('calc')}
            className={`flex-1 py-1.5 px-1 rounded-xl font-black text-[13px] transition-all cursor-pointer select-none ${
              activeSubTab === 'calc' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none' : 'text-[#9CA3AF] bg-transparent border-transparent'
            }`}
          >
            حساب صنف (آلة حاسبة)
          </button>
        </div>

        {/* Prices list card */}
        {activeSubTab === 'prices' && (
        <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fade-in text-right" dir="rtl">
          <div className="flex flex-col gap-5">
            {productPriceDetails.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">لا توجد منتجات مسجلة بعد، يرجى إضافتها أولاً من تبويب المصنع.</p>
            ) : (
              productPriceDetails.map(prod => (
                <div key={prod.id} className="border border-slate-200 rounded-2xl bg-[#F7FAFC]/50 overflow-hidden shadow-sm flex flex-col gap-3 p-4">
                  <div className="bg-indigo-50/80 -mx-4 -mt-4 px-4 py-3 border-b border-indigo-100 flex justify-between items-center font-bold text-sm text-[#1A365D]">
                    <span className="text-[#1A365D] font-black text-sm">{prod.name}</span>
                  </div>

                  {/* Weights container stack displaying the clean classic grid with 3 original columns */}
                  <div className="flex flex-col gap-3">
                    {prod.weights.map((w, index) => (
                      <div key={w.id || index} className="bg-[#FFFFFF] border border-slate-150 rounded-xl p-3 flex flex-col gap-2 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-2 flex-wrap">
                          <span className="text-xs font-black text-[#9B111E] flex items-center gap-1">
                            <Scale className="h-3.5 w-3.5 text-[#9B111E]" />
                            حجم العبوة: {toArabicNumerals(w.size)}
                          </span>
                        </div>

                        {/* Pricing grids with 4 framed discount tiers */}
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-semibold text-[#1A365D]">
                          
                          {/* 0% Discount tier */}
                          <div className="border border-slate-200 rounded-lg p-1.5 bg-slate-50/50 flex flex-col justify-between shadow-xs">
                            <span className="block font-black text-slate-500 mb-1 border-b border-slate-100 pb-1">خصم 0%</span>
                            <strong dir="ltr" className="text-[11px] font-black text-slate-900 block">{formatPriceWithCurrencyAndDecimal(w.cartonPriceFromFactory)}</strong>
                            <span dir="ltr" className="block text-[9px] text-[#DD6B20] font-black mt-1">{formatPriceWithCurrencyAndDecimal(w.retailPricePerUnit)}</span>
                          </div>

                          {/* 1% Discount tier */}
                          <div className="border border-slate-200 rounded-lg p-1.5 bg-white flex flex-col justify-between shadow-xs">
                            <span className="block font-black text-slate-500 mb-1 border-b border-slate-100 pb-1">خصم 1%</span>
                            <strong dir="ltr" className="text-[11px] font-black text-slate-900 block">{formatPriceWithCurrencyAndDecimal(w.carton1)}</strong>
                            <span dir="ltr" className="block text-[9px] text-[#DD6B20] font-black mt-1">{formatPriceWithCurrencyAndDecimal(w.unit1)}</span>
                          </div>

                          {/* 1.25% Discount tier */}
                          <div className="border border-slate-200 rounded-lg p-1.5 bg-white flex flex-col justify-between shadow-xs">
                            <span className="block font-black text-slate-500 mb-1 border-b border-slate-100 pb-1">خصم 1.25%</span>
                            <strong dir="ltr" className="text-[11px] font-black text-slate-900 block">{formatPriceWithCurrencyAndDecimal(w.carton125)}</strong>
                            <span dir="ltr" className="block text-[9px] text-[#DD6B20] font-black mt-1">{formatPriceWithCurrencyAndDecimal(w.unit125)}</span>
                          </div>

                          {/* 1.5% Discount tier */}
                          <div className="border border-slate-200 rounded-lg p-1.5 bg-white flex flex-col justify-between shadow-xs">
                            <span className="block font-black text-slate-500 mb-1 border-b border-slate-100 pb-1">خصم 1.5%</span>
                            <strong dir="ltr" className="text-[11px] font-black text-slate-900 block">{formatPriceWithCurrencyAndDecimal(w.carton15)}</strong>
                            <span dir="ltr" className="block text-[9px] text-[#DD6B20] font-black mt-1">{formatPriceWithCurrencyAndDecimal(w.unit15)}</span>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dual export actions to download as highly stylized Image or PDF */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => downloadPriceListAsImage(prod)}
                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white border border-black/10 rounded-xl py-2 px-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none"
                    >
                      <Download className="h-4 w-4" />
                      تنزيل قائمة الأسعار كصورة 🖼️
                    </button>
                    <button
                      onClick={() => downloadPriceListAsPDF(prod)}
                      className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white border border-black/10 rounded-xl py-2 px-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none"
                    >
                      <Download className="h-4 w-4" />
                      تنزيل قائمة الأسعار PDF 📄
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {/* Dynamic Sandbox Calculator */}
        {activeSubTab === 'calc' && products.length > 0 && (
          <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fade-in text-right" dir="rtl">
            <h3 className="font-bold text-[#1A365D] text-base border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Calculator className="h-5 w-5 text-[#2B6CB0]" />
              آلة حاسبة سريعة للتخفيضات والطلبيات
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#2B6CB0] mb-1">اختر الصنف</label>
                <select
                  value={calcProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[#1A365D]"
                >
                  <option value="">-- اضغط للاختيار --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {calcProductId && calcWeightsList.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">اختر الوزن/السعة المحددة</label>
                  <select
                    value={calcWeightId}
                    onChange={(e) => setCalcWeightId(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[#1A365D]"
                  >
                    {calcWeightsList.map(w => (
                      <option key={w.id} value={w.id}>{w.size} (الأساسي للعبوة: {w.retailPricePerUnit} ج.م)</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#2B6CB0] mb-1">وحدة الكمية المطلوبة</label>
                <div className="flex bg-[#F7FAFC] p-1 rounded-lg border border-slate-200 h-[38px] items-center">
                  <button
                    type="button"
                    onClick={() => setCalcUnitType('carton')}
                    className={`flex-1 py-1 px-2.5 rounded-md font-bold text-[11px] h-full transition-all select-none cursor-pointer ${
                      calcUnitType === 'carton' ? 'bg-[#1A365D] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                    }`}
                  >
                    كرتونة 📦
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcUnitType('piece')}
                    className={`flex-1 py-1 px-2.5 rounded-md font-bold text-[11px] h-full transition-all select-none cursor-pointer ${
                      calcUnitType === 'piece' ? 'bg-[#1A365D] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                    }`}
                  >
                    عبوة فردية 🧴
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2B6CB0] mb-1">
                  الكمية المطلوبة ({calcUnitType === 'carton' ? 'بالكرتونة' : 'بالعبوة الفردية'})
                </label>
                <input
                  type="number"
                  min="1"
                  value={calcQty}
                  onChange={(e) => setCalcQty(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center text-[#1A365D]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#2B6CB0] mb-1">نسبة الخصم المطلوبة (%)</label>
                <select
                  value={calcDiscount}
                  onChange={(e) => setCalcDiscount(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center text-[#1A365D]"
                >
                  <option value="0">بدون خصم (0%)</option>
                  <option value="1">خصم معتمد (1%)</option>
                  <option value="1.25">خصم معتمد (1.25%)</option>
                  <option value="1.5">خصم معتمد (1.5%)</option>
                  <option value="2">خصم مخصص (2%)</option>
                  <option value="3">خصم مخصص (3%)</option>
                </select>
              </div>
            </div>

            {calcResult && (
              <div className="mt-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-2.5 text-xs text-[#1A365D]">
                <div className="flex justify-between border-b border-indigo-100 pb-1.5 font-semibold text-[#1A365D]">
                  <span>الصنف المختار للحساب:</span>
                  <span>{calcResult.productName} ({calcResult.weightSize})</span>
                </div>
                <div className="flex justify-between">
                  <span>السعر الأساسي {calcResult.isCarton ? 'للكرتونة' : 'للعبوة الفردية'}:</span>
                  <span dir="ltr" className="font-semibold text-[#2B6CB0] inline-block">
                    {formatPriceWithCurrencyAndDecimal(calcResult.baseUnitPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>السعر بعد الخصم {calcResult.isCarton ? 'للكرتونة' : 'للعبوة الفردية'}:</span>
                  <span dir="ltr" className="font-bold text-[#1A365D] text-xs inline-block">
                    {formatPriceWithCurrencyAndDecimal(calcResult.finalUnitPrice)}
                  </span>
                </div>

                {calcResult.isCarton && (
                  <div className="flex justify-between text-gray-500 text-[10px] bg-[#FFFFFF]/60 p-1.5 rounded-md border border-slate-100">
                    <span>تحتوي الكرتونة على:</span>
                    <span className="font-bold text-[#1D4ED8]">
                      {calcResult.unitsPerCarton} عبوة
                    </span>
                  </div>
                )}

                <div className="flex justify-between border-t border-dashed border-indigo-100 pt-1.5">
                  <span>إجمالي الحساب (قبل الخصم):</span>
                  <span dir="ltr" className="font-medium text-[#2B6CB0] inline-block">
                    {formatPriceWithCurrencyAndDecimal(calcResult.totalPriceBeforeDiscount)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-[#DD6B20]">
                  <span>قيمة خصم العميل الكلية:</span>
                  <span dir="ltr" className="inline-block">-{formatPriceWithCurrencyAndDecimal(calcResult.savings)}</span>
                </div>
                <div className="flex justify-between border-t border-indigo-150 pt-1.5 font-bold text-sm text-[#1A365D]">
                  <span>الصافي المطلوب من العميل:</span>
                  <span dir="ltr" className="text-base text-[#1A365D] font-extrabold inline-block">
                    {formatPriceWithCurrencyAndDecimal(calcResult.totalPriceAfterDiscount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

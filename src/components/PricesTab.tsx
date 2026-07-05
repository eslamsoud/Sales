// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Product, getProductWeightsFallback, formatNum } from '../types';
import { Tags, ArrowRight, HelpCircle, Calculator, Check, Scale, Download, AlertCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { showToast } from '../utils/toast';

interface PricesTabProps {
  products: Product[];
  onGoBack: () => void;
  permittedSubTabs?: string[];
}

export default function PricesTab({ products: rawProducts, onGoBack, permittedSubTabs }: PricesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'prices' | 'calc' | 'whatsapp_bot'>(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('prices_list')) return 'prices';
      if (permittedSubTabs.includes('prices_calc')) return 'calc';
      if (permittedSubTabs.includes('prices_bot')) return 'whatsapp_bot';
    }
    return 'prices';
  });
  const products = useMemo(() => {
    return rawProducts.map(p => {
      // إزالة الفلترة الصارمة لإظهار جميع الأصناف للعميل حتى لو كانت مسعرة بصفر مؤقتاً
      const activeWeights = getProductWeightsFallback(p);
      return {
        ...p,
        weights: activeWeights
      };
    }).filter(p => p.weights && p.weights.length > 0);
  }, [rawProducts]);

  // حساب عدد الأصناف أو الأوزان التي تم إخفاؤها بسبب عدم اكتمال تسعيرها
  const hiddenWeightsCount = useMemo(() => {
    let count = 0;
    rawProducts.forEach(p => {
      const weights = getProductWeightsFallback(p);
      weights.forEach(w => {
        if (!(w.cartonPriceFromFactory > 0 && (w.addedValue || 0) > 0)) {
          count++;
        }
      });
    });
    return count;
  }, [rawProducts]);

  const toArabicNumerals = (val: string | number): string => {
    return String(val);
  };

  const formatPriceWithCurrencyAndDecimal = (num: number, isFixedZero = false): string => {
    const val = Number(num) || 0;
    return formatNum(val) + 'ج.م';
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
    ctx.direction = 'rtl';

    const rowHeight = 45;
    const headerHeight = 160;
    const footerHeight = 160; 
    const weightsCount = prod.weights.length;
    
    canvas.width = 600;
    canvas.height = headerHeight + (weightsCount * rowHeight * 2) + footerHeight + 10;

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
    // Draw Column 1, 2 headers: y=92 to 160
    ctx.fillStyle = '#111827'; 
    ctx.fillRect(360, 92, 240, 68); 

    ctx.fillStyle = '#FBBF24'; // Gold text
    ctx.font = 'bold 14px Cairo, system-ui, sans-serif';
    ctx.fillText('السعة اللترية', 540, 132);
    ctx.fillText('سعر التجزئة', 420, 132);

    // Draw Spanned Columns 3, 4, 5
    // Row 1: y=92 to 125 (Merged "نسبة خصم الجملة")
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 92, 360, 33);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Cairo, system-ui, sans-serif';
    ctx.fillText('نسبة خصم الجملة', 180, 114);

    // Row 2: y=125 to 160 (Discount percentages)
    ctx.fillStyle = '#1E3A8A'; // Blue
    ctx.fillRect(0, 125, 360, 35);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Cairo, system-ui, sans-serif';
    ctx.fillText('%١,٠٠', 300, 147);
    ctx.fillText('%١,٢٥', 180, 147);
    ctx.fillText('%١,٥٠', 60, 147);

    // Draw Table Grid Header Borders
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 92, canvas.width, 68);
    
    // Draw vertical column separators for Header
    ctx.beginPath();
    ctx.moveTo(480, 92); ctx.lineTo(480, 160);
    ctx.moveTo(360, 92); ctx.lineTo(360, 160);
    ctx.moveTo(240, 125); ctx.lineTo(240, 160);
    ctx.moveTo(120, 125); ctx.lineTo(120, 160);
    ctx.moveTo(0, 125); ctx.lineTo(360, 125);
    ctx.stroke();

    let currentY = 160;

    // Draw Rows for each weight
    prod.weights.forEach((w: any, idx: number) => {
      const theme = getSizeRowColors(idx);

      // Access exact computed prices
      const retailCarton = w.cartonPriceFromFactory + (w.addedValue || 0);
      const marketCarton = w.carton1;
      const halfWholesaleCarton = w.carton125;
      const wholesaleCarton = w.carton15;

      const retailPiece = w.retailPricePerUnit;
      const marketPiece = w.unit1;
      const halfWholesalePiece = w.unit125;
      const wholesalePiece = w.unit15;

      // 1. Carton Row Background
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, currentY, 600, 45);

      // Add text for Carton row
      ctx.fillStyle = theme.text;
      ctx.font = 'bold 14px Cairo, system-ui, sans-serif';
      ctx.textAlign = 'center';
      
      ctx.fillText(toArabicNumerals(w.size), 540, currentY + 28);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(retailCarton), 420, currentY + 28);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(marketCarton), 300, currentY + 28);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(halfWholesaleCarton), 180, currentY + 28);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(wholesaleCarton), 60, currentY + 28);

      // 2. Piece Row Background
      ctx.fillStyle = theme.subBg;
      ctx.fillRect(0, currentY + 45, 600, 45);

      // Add text for Piece row
      ctx.fillStyle = theme.subText;
      ctx.font = 'bold 12.5px Cairo, system-ui, sans-serif';
      
      ctx.fillText('سعر القطعه', 540, currentY + 73);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(retailPiece), 420, currentY + 73);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(marketPiece), 300, currentY + 73);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(halfWholesalePiece), 180, currentY + 73);
      ctx.fillText(formatPriceWithCurrencyAndDecimal(wholesalePiece), 60, currentY + 73);

      // Draw horizontal lines & column separators for this weight block
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      ctx.moveTo(0, currentY + 45); ctx.lineTo(canvas.width, currentY + 45);
      ctx.moveTo(0, currentY + 90); ctx.lineTo(canvas.width, currentY + 90);
      
      // Vertical borders
      ctx.moveTo(600, currentY); ctx.lineTo(600, currentY + 90);
      ctx.moveTo(480, currentY); ctx.lineTo(480, currentY + 90);
      ctx.moveTo(360, currentY); ctx.lineTo(360, currentY + 90);
      ctx.moveTo(240, currentY); ctx.lineTo(240, currentY + 90);
      ctx.moveTo(120, currentY); ctx.lineTo(120, currentY + 90);
      ctx.moveTo(0, currentY); ctx.lineTo(0, currentY + 90);
      ctx.stroke();

      currentY += 90;
    });

    // Draw Footer Bar 1: Discount source info
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(360, currentY, 240, 45);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, currentY, 360, 45);

    ctx.fillStyle = '#FBBF24'; // gold
    ctx.font = 'bold 12.5px Cairo, system-ui, sans-serif';
    ctx.fillText('يتم احتساب الخصم من', 480, currentY + 27);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Cairo, system-ui, sans-serif';
    ctx.fillText('فوق ٣٠ كرتونة', 300, currentY + 27);
    ctx.fillText('فوق ٥٠ كرتونة', 180, currentY + 27);
    ctx.fillText('فوق ١٠٠ كرتونة', 60, currentY + 27);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, currentY, canvas.width, 45);
    ctx.beginPath();
    ctx.moveTo(360, currentY); ctx.lineTo(360, currentY + 45);
    ctx.moveTo(240, currentY); ctx.lineTo(240, currentY + 45);
    ctx.moveTo(120, currentY); ctx.lineTo(120, currentY + 45);
    ctx.stroke();

    // Draw Footer Bar 2: Variable price warning
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(0, currentY + 45, canvas.width, 50);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Cairo, system-ui, sans-serif';
    ctx.fillText('الاسعار متغيرة طبقا للسعر اليومي 📢', canvas.width / 2, currentY + 77);

    ctx.strokeRect(0, currentY + 45, canvas.width, 50);

    // Draw Greetings Card
    ctx.fillStyle = '#FFFDFC';
    ctx.fillRect(0, currentY + 95, canvas.width, 65);

    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, currentY + 105, canvas.width - 40, 45);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold italic 13.5px Cairo, system-ui, sans-serif';
    ctx.fillText('عميلنا العزيز، نسعد لخدمتكم دائماً ونفخر بكونكم شركاء نجاحنا وتقدمنا.', canvas.width / 2, currentY + 132);

    // Border surrounding whole canvas
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    return canvas;
  };

  const generateAllPricesCanvas = (): HTMLCanvasElement | null => {
    if (productPriceDetails.length === 0) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.direction = 'rtl';

    const headerHeight = 92;
    const spacing = 30;
    
    let totalHeight = headerHeight;
    productPriceDetails.forEach(prod => {
      const weightsCount = prod.weights.length;
      totalHeight += 45; // Product Title
      totalHeight += 68; // Table Header
      totalHeight += weightsCount * 90; // Rows
      totalHeight += 45; // Discount info footer
      totalHeight += spacing; // Spacing
    });
    totalHeight += 50; // Warning warning
    totalHeight += 65; // Greeting card
    totalHeight += 20; // margin

    canvas.width = 600;
    canvas.height = totalHeight;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Main Header (Deep Slate Blue)
    ctx.fillStyle = '#0F172A'; 
    ctx.fillRect(0, 0, canvas.width, 92);

    // Yellow accent dividing line
    ctx.fillStyle = '#FBBF24'; 
    ctx.fillRect(0, 90, canvas.width, 2);

    // Draw Title (Centered)
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 23px Cairo, system-ui, sans-serif';
    ctx.fillText('قائمة الأسعار المعتمدة ومستويات الخصم', canvas.width / 2, 38);

    const today = new Date();
    const weekdayName = today.toLocaleDateString('ar-EG', { weekday: 'long' });
    const formattedDatePart = `${today.getDate()} / ${today.getMonth() + 1} / ${today.getFullYear()}`;
    
    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 15px Cairo, system-ui, sans-serif';
    ctx.fillText(`يوم ${weekdayName} بتاريخ: ${toArabicNumerals(formattedDatePart)}`, canvas.width / 2, 72);

    let currentY = 105;

    productPriceDetails.forEach((prod, pIdx) => {
      // 1. Product Title
      ctx.fillStyle = '#f7f3bd'; 
      ctx.fillRect(0, currentY, canvas.width, 45);
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, currentY, canvas.width, 45);

      ctx.fillStyle = '#1A365D';
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px Cairo, system-ui, sans-serif';
      const cleanProdLabel = prod.name.startsWith('زيت') ? prod.name : `زيت ${prod.name}`;
      ctx.fillText(cleanProdLabel, canvas.width / 2, currentY + 28);
      
      currentY += 45;

      // 2. Table Header
      ctx.fillStyle = '#111827'; 
      ctx.fillRect(360, currentY, 240, 68); 

      ctx.fillStyle = '#FBBF24'; 
      ctx.font = 'bold 14px Cairo, system-ui, sans-serif';
      ctx.fillText('السعة اللترية', 540, currentY + 40);
      ctx.fillText('سعر التجزئة', 420, currentY + 40);

      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, currentY, 360, 33);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('نسبة خصم الجملة', 180, currentY + 22);

      ctx.fillStyle = '#1E3A8A';
      ctx.fillRect(0, currentY + 33, 360, 35);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('%١,٠٠', 300, currentY + 55);
      ctx.fillText('%١,٢٥', 180, currentY + 55);
      ctx.fillText('%١,٥٠', 60, currentY + 55);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, currentY, canvas.width, 68);
      
      ctx.beginPath();
      ctx.moveTo(480, currentY); ctx.lineTo(480, currentY + 68);
      ctx.moveTo(360, currentY); ctx.lineTo(360, currentY + 68);
      ctx.moveTo(240, currentY + 33); ctx.lineTo(240, currentY + 68);
      ctx.moveTo(120, currentY + 33); ctx.lineTo(120, currentY + 68);
      ctx.moveTo(0, currentY + 33); ctx.lineTo(360, currentY + 33);
      ctx.stroke();

      currentY += 68;

      // 3. Rows
      prod.weights.forEach((w: any, idx: number) => {
        const theme = getSizeRowColors(idx);
        const retailCarton = w.cartonPriceFromFactory + (w.addedValue || 0);
        const retailPiece = w.retailPricePerUnit;

        // Carton
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, currentY, 600, 45);
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 14px Cairo, system-ui, sans-serif';
        ctx.fillText(toArabicNumerals(w.size), 540, currentY + 28);
        ctx.fillText(formatPriceWithCurrencyAndDecimal(retailCarton), 420, currentY + 28);
        ctx.fillText(formatPriceWithCurrencyAndDecimal(w.carton1), 300, currentY + 28);
        ctx.fillText(formatPriceWithCurrencyAndDecimal(w.carton125), 180, currentY + 28);
        ctx.fillText(formatPriceWithCurrencyAndDecimal(w.carton15), 60, currentY + 28);

        // Piece
        ctx.fillStyle = theme.subBg;
        ctx.fillRect(0, currentY + 45, 600, 45);
        ctx.fillStyle = theme.subText;
        ctx.font = 'bold 12.5px Cairo, system-ui, sans-serif';
        ctx.fillText('سعر القطعه', 540, currentY + 73);
        ctx.fillText(formatPriceWithCurrencyAndDecimal(retailPiece), 420, currentY + 73);
        ctx.fillText(formatPriceWithCurrencyAndDecimal(w.unit1), 300, currentY + 73);
        ctx.fillText(formatPriceWithCurrencyAndDecimal(w.unit125), 180, currentY + 73);
        ctx.fillText(formatPriceWithCurrencyAndDecimal(w.unit15), 60, currentY + 73);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, currentY + 45); ctx.lineTo(600, currentY + 45);
        ctx.moveTo(0, currentY + 90); ctx.lineTo(600, currentY + 90);
        ctx.moveTo(480, currentY); ctx.lineTo(480, currentY + 90);
        ctx.moveTo(360, currentY); ctx.lineTo(360, currentY + 90);
        ctx.moveTo(240, currentY); ctx.lineTo(240, currentY + 90);
        ctx.moveTo(120, currentY); ctx.lineTo(120, currentY + 90);
        ctx.stroke();

        currentY += 90;
      });

      // 4. Discount Info
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(360, currentY, 240, 45);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, currentY, 360, 45);

      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 12.5px Cairo, system-ui, sans-serif';
      ctx.fillText('يتم احتساب الخصم من', 480, currentY + 27);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px Cairo, system-ui, sans-serif';
      ctx.fillText('فوق ٣٠ كرتونة', 300, currentY + 27);
      ctx.fillText('فوق ٥٠ كرتونة', 180, currentY + 27);
      ctx.fillText('فوق ١٠٠ كرتونة', 60, currentY + 27);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, currentY, canvas.width, 45);
      ctx.beginPath();
      ctx.moveTo(360, currentY); ctx.lineTo(360, currentY + 45);
      ctx.moveTo(240, currentY); ctx.lineTo(240, currentY + 45);
      ctx.moveTo(120, currentY); ctx.lineTo(120, currentY + 45);
      ctx.stroke();

      currentY += 45 + spacing;
    });

    // Warning
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(0, currentY, canvas.width, 50);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Cairo, system-ui, sans-serif';
    ctx.fillText('الاسعار متغيرة طبقا للسعر اليومي 📢', canvas.width / 2, currentY + 32);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, currentY, canvas.width, 50);

    currentY += 50;

    // Greeting card
    ctx.fillStyle = '#FFFDFC';
    ctx.fillRect(0, currentY, canvas.width, 65);
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, currentY + 10, canvas.width - 40, 45);
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold italic 13.5px Cairo, system-ui, sans-serif';
    ctx.fillText('عميلنا العزيز، نسعد لخدمتكم دائماً ونفخر بكونكم شركاء نجاحنا وتقدمنا.', canvas.width / 2, currentY + 37);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    return canvas;
  };

  const downloadAllPricesAsImage = () => {
    const canvas = generateAllPricesCanvas();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `بيان_أسعار_شامل_${new Date().toISOString().substring(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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

  const [copied, setCopied] = useState(false);
  const [copiedProdId, setCopiedProdId] = useState<string | null>(null);

  // WhatsApp Autoresponder simulator states
  const [simText, setSimText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'customer' | 'bot' | 'system'; text: string; time: string }>>([
    { sender: 'system', text: 'هنا يمكنك تجربة كيف يعمل الرد الآلي للعملاء عبر حسابك على الواتساب عند الاستفسار عن الأسعار.', time: 'البداية' },
    { sender: 'customer', text: 'يا غالي، ابعتلي أسعار زجاجات الزيت والسمن اليوم لو سمحت', time: 'منذ دقيقة' },
    { sender: 'bot', text: `أهلاً وسهلاً بك يا شريك النجاح المحترم! 🌹 حياك الله.\n\nإليك بيان الأسعار الفوري المحدث لمنتجات وسمن وزيت سوفانا الفاخر اليوم:\n\n*📋 قائمة الأسعار الحالية*:\n• تجزئة زيت ممتاز: قطعه: 85.00ج.م\n• تجزئة سمن ممتاز: قطعه: 110.00ج.م\n\n📢 الأسعار متغيرة طبقاً للبورصة اليومية.\n✨ نسعد دائماً بخدمة محلكم لتسجيل طلبيتك الجديدة!`, time: 'منذ دقيقة' }
  ]);

  const handleSimulateBotReply = (userText: string) => {
    if (!userText.trim()) return;
    
    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const customerMsg = { sender: 'customer' as const, text: userText, time: timeStr };
    setChatMessages(prev => [...prev, customerMsg]);
    setSimText('');
    
    setTimeout(() => {
      let botText = '';
      const query = userText.trim().toLowerCase();
      
      const priceListText = buildAllPricesText();
      
      if (query.includes('سعر') || query.includes('أسعار') || query.includes('اسعار') || query.includes('بكام') || query.includes('بكم') || query.includes('كم') || query.includes('زيت') || query.includes('سمن') || query.includes('قائمه') || query.includes('قائمة')) {
        botText = `حياك الله يا غالي! 🌹 إليك بيان الأسعار والخصومات الرسمية المعتمدة لليوم:\n\n${priceListText}\n\n🛒 *لتسجيل طلبيتك للسيارة أو حجز شحنتك، تواصل مع المندوب فوراً!*`;
      } else if (query.includes('سلام') || query.includes('مرحب') || query.includes('اهل') || query.includes('أهل') || query.includes('مساء') || query.includes('صباح')) {
        botText = `وعليكم السلام ورحمة الله وبركاته يا بطل! 👋\n\nأهلاً بك في نظام الرد الفوري الميداني لزيوت وسمن سوفانا الممتازة.\n\nطلب أسعار المنتجات؟ اكتب كلمة **(سعر)** أو **(أسعار)** وسأقوم بإرسال بيان الأسعار المعتمده والخصومات لك تلقائياً! 📲`;
      } else {
        botText = `يسعدنا دائماً تواصلكم معنا يا غالي! 🌟 نحن هنا لخدمتكم وتسهيل طلبياتكم.\n\nمن أجل الحصول التلقائي على قائمة الأسعار الحالية كاملة والتسهيلات، اكتب فقط كلمة **"أسعار"** أو **"سعر"** وسأرسلها لك في ثوانٍ معدودة! 🚚`;
      }
      
      setChatMessages(prev => [...prev, {
        sender: 'bot' as const,
        text: botText,
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 850);
  };

  const buildAllPricesText = () => {
    const today = new Date();
    const weekdayName = today.toLocaleDateString('ar-EG', { weekday: 'long' });
    const formattedDatePart = `${today.getDate()} / ${today.getMonth() + 1} / ${today.getFullYear()}`;
    
    let text = `*📋 قائمة الأسعار المعتمدة ومستويات الخصم* 🏭\n*مصنع سمن وزيت سوفانا الفاخر*\n📅 اليوم: ${weekdayName} (${formattedDatePart})\n\n`;
    
    productPriceDetails.forEach(prod => {
      const cleanProdLabel = prod.name.startsWith('زيت') ? prod.name : `زيت ${prod.name}`;
      text += `*📦 صنف / ${cleanProdLabel}*:\n`;
      prod.weights.forEach(w => {
        text += `🔹 _سعة ${w.size}_:\n`;
        const retailCarton = w.cartonPriceFromFactory + (w.addedValue || 0);
        text += `  • تجزئة: قطعه: ${formatPriceWithCurrencyAndDecimal(w.retailPricePerUnit)} | كرتونة: ${formatPriceWithCurrencyAndDecimal(retailCarton)}\n`;
        text += `  • جملة (1%): قطعه: ${formatPriceWithCurrencyAndDecimal(w.unit1)} | كرتونة: ${formatPriceWithCurrencyAndDecimal(w.carton1)}\n`;
        text += `  • نصف جملة (1.25%): قطعه: ${formatPriceWithCurrencyAndDecimal(w.unit125)} | كرتونة: ${formatPriceWithCurrencyAndDecimal(w.carton125)}\n`;
        text += `  • كبار العملاء (1.5%): قطعه: ${formatPriceWithCurrencyAndDecimal(w.unit15)} | كرتونة: ${formatPriceWithCurrencyAndDecimal(w.carton15)}\n`;
      });
      text += `\n`;
    });
    
    text += `📢 *ملاحظة:* الأسعار متغيرة طبقاً للسعر اليومي والبورصة.\n✨ *نسعد دائماً بخدمة محلاتكم كشركاء نجاح متكاملين.*`;
    return text;
  };

  const handleShareAllWhatsApp = () => {
    const text = buildAllPricesText();
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    window.location.href = url;
  };

  const handleCopyAllPricesText = () => {
    const text = buildAllPricesText();
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy text:', err);
        showToast('⚠️ حدث خطأ أثناء محاولة نسخ النص، يرجى النسخ يدوياً.');
      });
  };

  const buildProductPricesText = (prod: any) => {
    const today = new Date();
    const weekdayName = today.toLocaleDateString('ar-EG', { weekday: 'long' });
    const formattedDatePart = `${today.getDate()} / ${today.getMonth() + 1} / ${today.getFullYear()}`;
    const cleanProdLabel = prod.name.startsWith('زيت') ? prod.name : `زيت ${prod.name}`;
    
    let text = `*📋 بيان أسعار صنف: ${cleanProdLabel}* 🏭\n*مصنع سمن وزيت سوفانا الفاخر*\n📅 اليوم: ${weekdayName} (${formattedDatePart})\n\n`;
    
    prod.weights.forEach((w: any) => {
      text += `🔹 *سعة ${w.size}*:\n`;
      const retailCarton = w.cartonPriceFromFactory + (w.addedValue || 0);
      text += `  • تجزئة: قطعه: ${formatPriceWithCurrencyAndDecimal(w.retailPricePerUnit)} | كرتونة: ${formatPriceWithCurrencyAndDecimal(retailCarton)}\n`;
      text += `  • جملة (1%): قطعه: ${formatPriceWithCurrencyAndDecimal(w.unit1)} | كرتونة: ${formatPriceWithCurrencyAndDecimal(w.carton1)}\n`;
      text += `  • نصف جملة (1.25%): قطعه: ${formatPriceWithCurrencyAndDecimal(w.unit125)} | كرتونة: ${formatPriceWithCurrencyAndDecimal(w.carton125)}\n`;
      text += `  • كبار العملاء (1.5%): قطعه: ${formatPriceWithCurrencyAndDecimal(w.unit15)} | كرتونة: ${formatPriceWithCurrencyAndDecimal(w.carton15)}\n`;
      text += `\n`;
    });
    
    text += `📢 *ملاحظة:* الأسعار متغيرة طبقاً للسعر اليومي.\n✨ *نسعد دائماً بخدمتكم وشراكتكم.*`;
    return text;
  };

  const handleShareProductWhatsApp = (prod: any) => {
    const text = buildProductPricesText(prod);
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    window.location.href = url;
  };

  const handleCopyProductPricesText = (prod: any) => {
    const text = buildProductPricesText(prod);
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedProdId(prod.id);
        setTimeout(() => setCopiedProdId(null), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy text:', err);
        showToast('⚠️ حدث خطأ أثناء محاولة نسخ النص، يرجى النسخ يدوياً.');
      });
  };

  const [calcProductId, setCalcProductId] = useState('');
  const [calcWeightId, setCalcWeightId] = useState('');
  const [calcQty, setCalcQty] = useState('1');
  const [calcDiscount, setCalcDiscount] = useState('1');
  const [calcUnitType, setCalcUnitType] = useState<'carton' | 'piece'>('carton');

  // Pre-populate calculator product and weight if not set
  useEffect(() => {
    if (products.length > 0 && !calcProductId) {
      const firstProd = products[0];
      setCalcProductId(firstProd.id);
      const wList = getProductWeightsFallback(firstProd);
      if (wList.length > 0) {
        setCalcWeightId(wList[0].id);
      }
    }
  }, [products, calcProductId]);

  // Compute discounts for products and their corresponding weights
  const productPriceDetails = useMemo(() => {
    return products.map(p => {
      const weights = getProductWeightsFallback(p);
      const weightDetails = weights
        .filter(w => w.cartonPriceFromFactory > 0 && (w.addedValue || 0) > 0)
        .map(w => {
        // Carton price includes added value
        const retailCarton = w.cartonPriceFromFactory + (w.addedValue || 0);
        const units = w.unitsPerCarton || 12;
        const computedRetailPrice = retailCarton / units;

        // Individual unit tier discounts based on discounted carton price / units count
        // 1% discount
        const c1 = retailCarton * (1 - 0.01);
        const u1 = c1 / units;

        // 1.25% discount
        const c125 = retailCarton * (1 - 0.0125);
        const u125 = c125 / units;

        // 1.5% discount
        const c15 = retailCarton * (1 - 0.015);
        const u15 = c15 / units;

        return {
          ...w,
          retailPricePerUnit: Number(computedRetailPrice.toFixed(3)),
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
    }).filter(p => p.weights && p.weights.length > 0);
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

    const rc = selectedWeight.cartonPriceFromFactory + (selectedWeight.addedValue || 0);
    const computedRetail = rc / unitsPerCarton;
    const basePrice = isCarton ? rc : computedRetail;
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
    <div className="bg-[#F7FAFC] min-h-screen pb-12 text-right animate-fade-in" dir="rtl" id="prices-tab-container">
      {/* Header */}
      <div 
        className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky z-[40] shadow-md flex items-center justify-between"
        style={{ top: 'var(--header-offset, 56px)' }}
      >
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

      <div className="max-w-3xl mx-auto p-4 flex flex-col gap-5">
        
        {/* Sub-tabs for navigation */}
        <div className="flex bg-[#F7FAFC] p-1 rounded-xl border border-slate-200 gap-1">
          {(!permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('prices_list')) && (
            <button
              onClick={() => setActiveSubTab('prices')}
              className={`flex-1 py-1.5 px-1 rounded-lg font-black text-[11px] sm:text-[12px] transition-all cursor-pointer select-none ${
                activeSubTab === 'prices' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-indigo-500 shadow-xs' : 'text-[#9CA3AF] bg-transparent border-transparent'
              }`}
            >
              جدول الأسعار 📋
            </button>
          )}
          {(!permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('prices_calc')) && (
            <button
              onClick={() => setActiveSubTab('calc')}
              className={`flex-1 py-1.5 px-1 rounded-lg font-black text-[11px] sm:text-[12px] transition-all cursor-pointer select-none ${
                activeSubTab === 'calc' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-xs' : 'text-[#9CA3AF] bg-transparent border-transparent'
              }`}
            >
              حساب صنف 🧮
            </button>
          )}
          {(!permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('prices_bot')) && (
            <button
              onClick={() => setActiveSubTab('whatsapp_bot')}
              className={`flex-1 py-1.5 px-1 rounded-lg font-black text-[11px] sm:text-[12px] transition-all cursor-pointer select-none ${
                activeSubTab === 'whatsapp_bot' ? 'bg-[#FFFFFF] text-[#28a745] border-b-2 border-b-emerald-500 shadow-xs' : 'text-[#9CA3AF] bg-transparent border-transparent'
              }`}
            >
              بوت واتساب 🤖
            </button>
          )}
        </div>

        {/* Prices list card */}
        {activeSubTab === 'prices' && (
        <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fade-in text-right" dir="rtl">
          <div className="flex flex-col gap-5">
            {productPriceDetails.length > 0 && (
              <div className="bg-indigo-50/55 border border-indigo-100 rounded-2xl p-4 flex flex-col gap-3 text-right">
                <span className="text-xs font-black text-[#1A365D] flex items-center gap-1.5">
                  📱 خيارات مشاركة قائمة الأسعار السريعة مع العملاء عبر الواتساب:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleShareAllWhatsApp}
                    className="bg-[#25D366] hover:bg-[#20ba5a] active:scale-95 text-white border border-black/5 rounded-xl py-2 px-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none shadow-xs"
                  >
                    <span>مشاركة جميع الأسعار واتساب 📱</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadAllPricesAsImage}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white border border-black/5 rounded-xl py-2 px-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none shadow-xs"
                  >
                    <Download className="h-4.5 w-4.5 shrink-0 text-white" />
                    <span>تنزيل صورة للكل 🖼️</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAllPricesText}
                    className="bg-[#1A365D] hover:bg-opacity-90 active:scale-95 text-white border border-black/5 rounded-xl py-2 px-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none shadow-xs"
                  >
                    <span>{copied ? '✓ تم النسخ بنجاح كامل' : 'نسخ النص لعقد طلبية 📋'}</span>
                  </button>
                </div>
              </div>
            )}

            {productPriceDetails.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">لا توجد منتجات مسجلة بعد، يرجى إضافتها أولاً من تبويب المصنع.</p>
            ) : (
              productPriceDetails.map(prod => (
                <div key={prod.id} className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm flex flex-col gap-3 p-4">
                  <div className="bg-[#f7f3bd]/80 -mx-4 -mt-4 px-4 py-3 border-b border-slate-200 flex justify-between items-center font-bold text-sm text-[#1A365D]" style={{ backgroundColor: '#f7f3bd' }}>
                    <span className="text-[#1A365D] font-black text-sm">{prod.name}</span>
                  </div>

                  {/* Weights container displaying HTML Table */}
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full text-xs text-right border-collapse border border-slate-200 min-w-[650px]">
                      <thead className="bg-[#1A365D] text-white text-[11px]">
                        <tr>
                          <th className="p-2 border border-slate-200 text-center">الصنف / الحجم</th>
                          <th className="p-2 border border-slate-200 text-center">الوحدة</th>
                          <th className="p-2 border border-slate-200 text-center">التجزئة (0%)</th>
                          <th className="p-2 border border-slate-200 text-center">جملة (1%)</th>
                          <th className="p-2 border border-slate-200 text-center">نصف جملة (1.25%)</th>
                          <th className="p-2 border border-slate-200 text-center">كبار العملاء (1.5%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prod.weights.map((w, index) => {
                          const retailCarton = w.cartonPriceFromFactory + (w.addedValue || 0);
                          
                          return (
                            <React.Fragment key={w.id || index}>
                              {/* كرتونة Row */}
                              <tr className="bg-slate-50/70 border-t border-slate-200 font-bold text-center">
                                <td className="p-2 border border-slate-200 font-black text-[#1A365D]" rowSpan={2}>
                                  <div className="flex items-center justify-center gap-1">
                                    <Scale className="h-3.5 w-3.5 text-[#9B111E] shrink-0" />
                                    <span>{toArabicNumerals(w.size)}</span>
                                  </div>
                                </td>
                                <td className="p-2 border border-slate-200 text-[#1A365D] font-bold">كرتونة</td>
                                <td className="p-2 border border-slate-200 font-mono text-emerald-700">{formatPriceWithCurrencyAndDecimal(retailCarton)}</td>
                                <td className="p-2 border border-slate-200 font-mono text-slate-700">{formatPriceWithCurrencyAndDecimal(w.carton1)}</td>
                                <td className="p-2 border border-slate-200 font-mono text-slate-700">{formatPriceWithCurrencyAndDecimal(w.carton125)}</td>
                                <td className="p-2 border border-slate-200 font-mono text-slate-700">{formatPriceWithCurrencyAndDecimal(w.carton15)}</td>
                              </tr>
                              {/* قطعة Row */}
                              <tr className="bg-white hover:bg-slate-50 transition-colors text-center">
                                <td className="p-2 border border-slate-200 text-slate-500 font-bold">قطعة</td>
                                <td className="p-2 border border-slate-200 font-mono text-emerald-650 font-bold">{formatPriceWithCurrencyAndDecimal(w.retailPricePerUnit)}</td>
                                <td className="p-2 border border-slate-200 font-mono text-slate-650">{formatPriceWithCurrencyAndDecimal(w.unit1)}</td>
                                <td className="p-2 border border-slate-200 font-mono text-slate-650">{formatPriceWithCurrencyAndDecimal(w.unit125)}</td>
                                <td className="p-2 border border-slate-200 font-mono text-slate-650">{formatPriceWithCurrencyAndDecimal(w.unit15)}</td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
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

                  {/* Share individual product details to WhatsApp */}
                  <div className="grid grid-cols-2 gap-2 mt-1 border-t border-dashed border-slate-200 pt-2 pb-1">
                    <button
                      type="button"
                      onClick={() => handleShareProductWhatsApp(prod)}
                      className="bg-emerald-50 hover:bg-emerald-100 text-[#096434] border border-emerald-200 rounded-xl py-1.5 px-3 text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer select-none"
                    >
                      <span>مشاركة الأسعار بالواتساب 🟢</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyProductPricesText(prod)}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl py-1.5 px-3 text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer select-none"
                    >
                      <span>{copiedProdId === prod.id ? '✓ تم نسخ النص' : 'نسخ النص 📋'}</span>
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
                    {calcWeightsList.map(w => {
                      const computedRetail = (w.cartonPriceFromFactory + (w.addedValue || 0)) / (w.unitsPerCarton || 12);
                      return (
                        <option key={w.id} value={w.id}>{w.size} (الأساسي للعبوة: {formatNum(computedRetail.toFixed(3))}ج.م)</option>
                      );
                    })}
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

        {/* Whatsapp Autoresponder Bot configured tab */}
        {activeSubTab === 'whatsapp_bot' && (
          <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-5 animate-fade-in text-right" dir="rtl">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <Tags className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">مساعد إعداد بوت الرد التلقائي وإرسال الأسعار 📱🤖</h3>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">شرح تفعيل الرد الآلي ومحاكاته الذكية للعملاء عبر رقم المندوب</p>
              </div>
            </div>

            {/* Quick Interactive Simulator mockup */}
            <div className="bg-[#F4F6F8] rounded-2xl p-3.5 border border-slate-200 flex flex-col gap-2">
              <span className="text-[11px] font-black text-[#1A365D] block mb-1">💬 محاكاة تفاعلية: جرب كيف سيرد البوت على العميل الآن:</span>
              
              <div className="bg-[#E5DDD5] rounded-xl p-3 flex flex-col gap-2.5 h-64 overflow-y-auto border border-stone-300">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col max-w-[85%] ${msg.sender === 'customer' ? 'self-start align-left' : msg.sender === 'system' ? 'self-center text-center' : 'self-end'}`}>
                    {msg.sender === 'system' ? (
                      <div className="bg-[#CFE9FC]/95 text-[#1D4ED8] text-[9.5px] font-bold p-2 rounded-lg leading-relaxed shadow-xs text-center">
                        {msg.text}
                      </div>
                    ) : (
                      <div className={`p-2.5 rounded-xl text-xs font-semibold shadow-xs leading-relaxed ${
                        msg.sender === 'customer' 
                          ? 'bg-white text-slate-800 rounded-tr-none' 
                          : 'bg-[#DCF8C6] text-slate-900 rounded-tl-none font-bold'
                      }`}>
                        <div className="whitespace-pre-line text-right">{msg.text}</div>
                        <span className="text-[8px] text-slate-400 block mt-1 text-left select-none">{msg.time}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Input text simulation buttons */}
              <div className="flex flex-col gap-1.5 mt-1.5">
                <span className="text-[10px] text-slate-500 font-bold block">اضغط على أحد الأسئلة الجاهزة لإرسالها وتلقي رد البوت:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSimulateBotReply('السلام عليكم، ابعت أسعار الزيت اليوم')}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg py-1 px-2.5 text-[10.5px] font-semibold cursor-pointer select-none"
                  >
                    👋 السلام عليكم، ابعت أسعار الزيت اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateBotReply('بكام كرتونة السمن والزيت وعاوز قائمة الخصم')}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg py-1 px-2.5 text-[10.5px] font-semibold cursor-pointer select-none"
                  >
                    📦 بكم الكرتونة وقائمة الخصم؟
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateBotReply('مرحبا، كيف اسجل طلبية مع السيارة؟')}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg py-1 px-2.5 text-[10.5px] font-semibold cursor-pointer select-none"
                  >
                    🚛 تفاصيل تسجيل طلبية؟
                  </button>
                </div>

                <div className="flex gap-1.5 mt-1 bg-white p-1 rounded-xl border border-slate-200 shadow-inner">
                  <input
                    type="text"
                    value={simText}
                    onChange={(e) => setSimText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSimulateBotReply(simText);
                    }}
                    placeholder="اكتب رسالة تجريبية أخرى هنا واضغط إرسال..."
                    className="flex-1 bg-transparent border-none text-xs p-1.5 text-right font-semibold text-[#1A365D] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSimulateBotReply(simText)}
                    className="bg-[#28a745] hover:bg-[#218838] text-white px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer shadow-xs active:scale-95"
                  >
                    إرسال 🚀
                  </button>
                </div>
              </div>
            </div>

            {/* Explanation & Tutorial Guide */}
            <div className="bg-emerald-50/50 border border-emerald-150 rounded-2xl p-4 flex flex-col gap-3">
              <h4 className="text-xs font-black text-emerald-900 flex items-center gap-1">
                ⚙️ طريقة تشغيل البوت المجاني على هاتفك اليوم (خطوات عملية):
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-700 font-semibold">
                نظراً لخصوصية نظام أندرويد وواتساب، لا يمكن لأي موقع ويب مباشرة مراقبة رسائلك وقراءتها في الخلفية حفاظاً على أمانك. ولكن، يمكنك تثبيت تطبيق مساعد مجاني للقيام بذلك والربط ببيانات التطبيق.
              </p>

              <div className="flex flex-col gap-2.5 text-[10.5px] text-[#1A365D] leading-relaxed">
                <div className="flex gap-2">
                  <span className="w-5 h-5 shrink-0 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-black">1</span>
                  <p>حمل تطبيق <strong>AutoResponder for WA</strong> المجاني من متجر Google Play على هاتف المندوب.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 shrink-0 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-black">2</span>
                  <p>افتح التطبيق واضغط على علامة الزائد <strong>(+)</strong> لإضافة قاعدة رد تلقائي جديدة.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 shrink-0 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-black">3</span>
                  <p>في حقل <i>الرسالة الواردة (Received Message)</i>، اختر <strong>"مطابقة تشابه"</strong> واكتب الكلمات: <code>*أسعار*</code> أو <code>*سعر*</code> أو <code>*زيت*</code>.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 shrink-0 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-black">4</span>
                  <p>في حقل <i>رسالة الرد (Reply Message)</i>، قم بنسخ القائمة التلقائية المجهزة وتغيير السعر اليومي في ثوانٍ معدودة، أو ربطها بالويب هوك.</p>
                </div>
              </div>
            </div>

            {/* Ready to be copied bot message text area */}
            <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 flex flex-col gap-2.5">
              <span className="text-[11px] font-black text-indigo-950 block">📋 نص الأسعار المجهز الفوري لردود البوت التلقائية (محدث بأسعارك):</span>
              <textarea
                readOnly
                value={buildAllPricesText()}
                rows={7}
                className="w-full bg-white border border-indigo-100 rounded-xl p-2.5 text-[10.5px] font-mono text-indigo-950 text-right leading-relaxed focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(buildAllPricesText())
                    .then(() => {
                      showToast('✓ تم نسخ نص الأسعار بنجاح!');
                    });
                }}
                className="bg-[#1A365D] hover:bg-opacity-90 active:scale-95 text-white rounded-xl py-2 px-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>نسخ نص الرد الجاهز للبوت 📋</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

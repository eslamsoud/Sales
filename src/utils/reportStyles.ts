// ═══════════════════════════════════════════════════════════════
// الأنماط المشتركة لجميع التقارير والفواتير PDF
// ═══════════════════════════════════════════════════════════════

export const GOOGLE_FONTS_LINK = `<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">`;

export const PROFESSIONAL_CSS = `
  @page { size: A4; margin: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo', 'Tajawal', system-ui, sans-serif;
    color: #1e293b;
    background: #ffffff;
    width: 210mm;
    min-height: 297mm;
    padding: 12mm 14mm;
    direction: rtl;
    line-height: 1.5;
  }

  /* ── الهيدر ── */
  .report-header {
    text-align: center;
    padding: 20px 0 16px;
    margin-bottom: 18px;
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%);
    border-radius: 16px;
    color: white;
    position: relative;
    overflow: hidden;
  }
  .report-header::before {
    content: '';
    position: absolute;
    top: -50%; left: -50%;
    width: 200%; height: 200%;
    background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%);
  }
  .report-header h1 {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  .report-header .subtitle {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
  }
  .report-header .ref-line {
    margin-top: 10px;
    display: flex;
    justify-content: center;
    gap: 20px;
    font-size: 10px;
    color: #cbd5e1;
  }
  .report-header .ref-line span {
    background: rgba(255,255,255,0.1);
    padding: 3px 12px;
    border-radius: 12px;
  }
  .report-header .badge {
    display: inline-block;
    background: rgba(255,255,255,0.15);
    padding: 4px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    margin-top: 8px;
  }

  /* ── بطاقات الملخص ── */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 18px;
  }
  .summary-box {
    border-radius: 14px;
    padding: 14px 10px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .summary-box::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
  }
  .summary-box.blue { background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; }
  .summary-box.blue::after { background: #2563eb; }
  .summary-box.green { background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0; }
  .summary-box.green::after { background: #16a34a; }
  .summary-box.red { background: linear-gradient(180deg, #fff5f5 0%, #fee2e2 100%); border: 1px solid #fecaca; }
  .summary-box.red::after { background: #dc2626; }
  .summary-box.purple { background: linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%); border: 1px solid #ddd6fe; }
  .summary-box.purple::after { background: #7c3aed; }
  .summary-box.amber { background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fde68a; }
  .summary-box.amber::after { background: #f59e0b; }
  .summary-box .label {
    font-size: 9.5px;
    font-weight: 700;
    color: #64748b;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .summary-box .value {
    font-size: 16px;
    font-weight: 900;
    font-family: 'Tajawal', monospace;
  }
  .summary-box.blue .value { color: #1e40af; }
  .summary-box.green .value { color: #15803d; }
  .summary-box.red .value { color: #dc2626; }
  .summary-box.purple .value { color: #7c3aed; }
  .summary-box.amber .value { color: #b45309; }

  /* ── عناوين الأقسام ── */
  .section-title {
    font-size: 12px;
    font-weight: 800;
    color: #1e3a5f;
    margin: 16px 0 8px;
    padding: 6px 14px;
    background: linear-gradient(90deg, #f1f5f9 0%, #ffffff 100%);
    border-right: 4px solid #f97316;
    border-radius: 0 8px 8px 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .section-title .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px; height: 20px;
    background: #f97316;
    color: white;
    border-radius: 5px;
    font-size: 10px;
  }

  /* ── الجداول ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    font-size: 10px;
  }
  th {
    background: linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%);
    color: white;
    font-weight: 700;
    padding: 8px 6px;
    font-size: 9.5px;
    letter-spacing: 0.2px;
  }
  th:first-child { border-radius: 0 8px 0 0; }
  th:last-child { border-radius: 8px 0 0 0; }
  td {
    padding: 7px 6px;
    border-bottom: 1px solid #e2e8f0;
    font-weight: 500;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:hover { background: #f1f5f9; }
  tbody tr:last-child td:first-child { border-radius: 0 0 0 8px; }
  tbody tr:last-child td:last-child { border-radius: 0 0 8px 0; }
  tfoot td {
    font-weight: 800;
    padding: 9px 6px;
  }

  /* ── صفوف التذييل ── */
  .tfoot-total {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%) !important;
    color: white !important;
  }
  .tfoot-success {
    background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
    color: white !important;
  }
  .tfoot-danger {
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%) !important;
    color: white !important;
  }

  /* ── الملخص النهائي ── */
  .final-summary {
    margin-top: 14px;
    border: 2px solid #1e3a5f;
    border-radius: 14px;
    overflow: hidden;
  }
  .final-summary th {
    background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
  }
  .final-summary .result-row {
    background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%) !important;
    color: white !important;
    font-size: 12px;
  }

  /* ── التوقيعات ── */
  .footer-sigs {
    margin-top: 30px;
    display: flex;
    justify-content: space-between;
    padding-top: 14px;
    border-top: 2px solid #e2e8f0;
  }
  .footer-sigs .sig-block {
    text-align: center;
    width: 40%;
  }
  .footer-sigs .sig-block .line {
    border-top: 1px solid #94a3b8;
    margin: 30px 10px 0;
    padding-top: 6px;
    font-size: 10px;
    font-weight: 700;
    color: #475569;
  }
  .footer-sigs .sig-block .title {
    font-size: 10px;
    font-weight: 800;
    color: #1e3a5f;
  }

  /* ── الفوتر ── */
  .report-footer {
    margin-top: 20px;
    text-align: center;
    color: #94a3b8;
    font-size: 9px;
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
  }
`;

// ═══════════════════════════════════════════════════════════════
// هيدر احترافي
// ═══════════════════════════════════════════════════════════════
export function buildReportHeader(title: string, subtitle: string, refLine?: string, badge?: string): string {
  return `
    <div class="report-header">
      <h1>${title}</h1>
      <div class="subtitle">${subtitle}</div>
      ${badge ? `<div class="badge">${badge}</div>` : ''}
      <div class="ref-line">
        <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</span>
        ${refLine ? `<span>${refLine}</span>` : ''}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// بطاقة ملخص
// ═══════════════════════════════════════════════════════════════
export function buildSummaryBox(color: 'blue' | 'green' | 'red' | 'purple' | 'amber', label: string, value: string, unit = 'ج.م'): string {
  return `
    <div class="summary-box ${color}">
      <div class="label">${label}</div>
      <div class="value">${value} <span style="font-size:10px">${unit}</span></div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// توقيعات
// ═══════════════════════════════════════════════════════════════
export function buildSignatures(leftTitle: string, rightTitle: string): string {
  return `
    <div class="footer-sigs">
      <div class="sig-block">
        <div class="title">${rightTitle}</div>
        <div class="line">التوقيع</div>
      </div>
      <div class="sig-block">
        <div class="title">${leftTitle}</div>
        <div class="line">التوقيع</div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// ملف HTML كامل جاهز للطباعة
// ═══════════════════════════════════════════════════════════════
export function wrapInHTML(bodyContent: string): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      ${GOOGLE_FONTS_LINK}
      <style>${PROFESSIONAL_CSS}</style>
    </head>
    <body>
      ${bodyContent}
    </body>
    </html>
  `;
}

// ═══════════════════════════════════════════════════════════════
// طباعة عبر iframe مخفي
// ═══════════════════════════════════════════════════════════════
export function printHTMLInHiddenIframe(htmlContent: string): void {
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
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 500);
  }, 800);
}

// ═══════════════════════════════════════════════════════════════
// طباعة عبر نافذة جديدة
// ═══════════════════════════════════════════════════════════════
export const printHTMLInNewWindow = (htmlString: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة للطباعة!');
    return;
  }
  
  printWindow.document.write(htmlString);
  printWindow.document.close();
  
  printWindow.onload = () => {
    printWindow.print();
  };
};

// ═══════════════════════════════════════════════════════════════
// CSS مدمج للنافذة الجديدة (window.open)
// ═══════════════════════════════════════════════════════════════
export const COMPACT_PRO_CSS = `
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
  @page {
    size: A4 portrait !important;
    margin: 15mm 12mm 15mm 12mm !important;
  }

  * {
    box-sizing: border-box !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    overflow: visible !important;
    direction: rtl !important;
    text-align: right !important;
    font-family: 'Tajawal', 'Segoe UI', system-ui, sans-serif !important;
    background-color: #ffffff !important;
  }

  body > div, .report-wrapper, main {
    display: block !important;
    float: none !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    padding: 0 !important;
  }

  table {
    width: 100% !important;
    max-width: 100% !important;
    margin: 10px auto !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
    word-wrap: break-word !important;
  }

  th, td {
    padding: 6px 8px !important;
    font-size: 11px !important;
    border: 1px solid #cbd5e1 !important;
    text-align: center !important;
  }

  th {
    background-color: #1e3a8a !important;
    color: #ffffff !important;
    font-weight: bold !important;
  }

  .rh, .header-card, [class*="bg-indigo-"] {
    width: 100% !important;
    max-width: 100% !important;
    border-radius: 12px !important;
    padding: 16px !important;
    margin-bottom: 20px !important;
    background: #1e3a8a !important;
    color: #ffffff !important;
  }

  .st {
    font-size: 13px !important;
    font-weight: 800 !important;
    color: #1e3a8a !important;
    margin-top: 15px !important;
    margin-bottom: 8px !important;
    border-right: 4px solid #ea580c !important;
    padding-right: 8px !important;
  }
</style>`;

// ═══════════════════════════════════════════════════════════════
// انتظار تحميل الخطوط قبل رسم Canvas
// ═══════════════════════════════════════════════════════════════
let fontsLoaded = false;
export async function ensureFontsLoaded(): Promise<void> {
  if (fontsLoaded) return;
  try {
    await document.fonts.ready;
    fontsLoaded = true;
  } catch {
    fontsLoaded = true;
  }
}

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
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet">
<style>
  @page {
    size: A4 portrait !important;
    margin: 10mm 10mm 10mm 10mm !important;
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
    font-family: 'Cairo', 'Tajawal', sans-serif !important;
    background-color: #ffffff !important;
    color: #0f172a !important;
    line-height: 1.2 !important;
  }

  body > div, .report-wrapper, main {
    display: block !important;
    float: none !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    padding: 0 !important;
  }

  /* Luxurious Report Header */
  .rh {
    width: 100% !important;
    max-width: 100% !important;
    border-radius: 12px !important;
    padding: 12px 18px !important;
    margin-bottom: 12px !important;
    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%) !important;
    color: #ffffff !important;
    position: relative !important;
    overflow: hidden !important;
    box-shadow: 0 4px 15px rgba(30, 58, 138, 0.15) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
  }

  .rh::before {
    content: '' !important;
    position: absolute !important;
    top: -50% !important; left: -50% !important;
    width: 200% !important; height: 200% !important;
    background: radial-gradient(circle, rgba(217, 119, 6, 0.08) 0%, transparent 60%) !important;
    pointer-events: none !important;
  }

  .rh h1 {
    font-size: 14pt !important;
    font-weight: 900 !important;
    letter-spacing: 0.5px !important;
    margin: 0 0 3px 0 !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
    color: #ffffff !important;
  }

  .rh .sub {
    font-size: 9.5px !important;
    color: #cbd5e1 !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
  }

  .rh .ref {
    margin-top: 8px !important;
    display: flex !important;
    justify-content: flex-start !important;
    gap: 16px !important;
    font-size: 9px !important;
    color: #cbd5e1 !important;
    border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
    padding-top: 6px !important;
  }

  .rh .ref span {
    background: rgba(255, 255, 255, 0.06) !important;
    padding: 2px 8px !important;
    border-radius: 8px !important;
    border: 1px solid rgba(255, 255, 255, 0.04) !important;
    color: #f1f5f9 !important;
  }

  /* Grid layout for cards (3 cards per line) */
  .sg {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 6px !important;
    margin-bottom: 12px !important;
    width: 100% !important;
  }

  /* Luxurious Executive Card styling */
  .sb {
    border-radius: 10px !important;
    border: 1px solid #e2e8f0 !important;
    padding: 8px 10px !important;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03) !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 1px !important;
    text-align: right !important;
    position: relative !important;
    overflow: hidden !important;
    page-break-inside: avoid !important;
  }

  .sb::before {
    content: '' !important;
    position: absolute !important;
    top: 0; right: 0; bottom: 0;
    width: 4px !important;
    border-radius: 0 10px 10px 0 !important;
  }

  .sb .l {
    font-size: 9px !important;
    font-weight: 800 !important;
    color: #64748b !important;
    text-transform: uppercase !important;
    letter-spacing: 0.3px !important;
  }

  .sb .v {
    font-size: 12pt !important;
    font-weight: 900 !important;
    font-family: 'monospace', 'Courier New', monospace !important;
    line-height: 1.2 !important;
    letter-spacing: -0.5px !important;
  }

  /* Color custom mappings (Tiers) */
  /* Tier 1: المقبوضات والأرباح والصافي (Emerald Luxury) */
  .sb.gr, .sb.green {
    background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%) !important;
    border-color: #bbf7d0 !important;
  }
  .sb.gr::before, .sb.green::before {
    background-color: #16a34a !important;
  }
  .sb.gr .v, .sb.green .v {
    color: #14532d !important;
  }

  /* Tier 2: المديونيات والمعلقات المالية (Rose Luxury) */
  .sb.rd, .sb.red {
    background: linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%) !important;
    border-color: #fecaca !important;
  }
  .sb.rd::before, .sb.red::before {
    background-color: #dc2626 !important;
  }
  .sb.rd .v, .sb.red .v {
    color: #7f1d1d !important;
  }

  /* Tier 3: المصروفات والسيارة والمشاوير (Blue Luxury) */
  .sb.bl, .sb.blue, .sb.am, .sb.amber {
    background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%) !important;
    border-color: #bfdbfe !important;
  }
  .sb.bl::before, .sb.blue::before, .sb.am::before, .sb.amber::before {
    background-color: #2563eb !important;
  }
  .sb.bl .v, .sb.blue .v, .sb.am .v, .sb.amber .v {
    color: #1e3a8a !important;
  }

  /* Section Title */
  .st {
    font-size: 11px !important;
    font-weight: 900 !important;
    color: #0f172a !important;
    margin-top: 10px !important;
    margin-bottom: 6px !important;
    border-right: 4px solid #d97706 !important;
    padding-right: 6px !important;
    letter-spacing: 0.2px !important;
  }

  .st .i {
    background-color: #d97706 !important;
    color: white !important;
    width: 16px !important;
    height: 16px !important;
    border-radius: 50% !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 8px !important;
    font-weight: 900 !important;
  }

  /* Luxurious Data Tables - Super Compact spacing */
  table {
    width: 100% !important;
    max-width: 100% !important;
    margin: 6px auto !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    table-layout: fixed !important;
    word-wrap: break-word !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    border: 1px solid #e2e8f0 !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03) !important;
  }

  th, td {
    padding: 4px 6px !important;
    font-size: 10px !important;
    line-height: 1.2 !important;
    border-bottom: 1px solid #e2e8f0 !important;
    border-left: 1px solid #e2e8f0 !important;
    text-align: center !important;
    font-weight: 500 !important;
  }

  th:last-child, td:last-child {
    border-left: none !important;
  }

  th {
    background: linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%) !important;
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 10px !important;
    letter-spacing: 0.5px !important;
    border-bottom: 2px solid #1d4ed8 !important;
  }

  tbody tr:last-child td {
    border-bottom: none !important;
  }

  tbody tr:nth-child(even) {
    background-color: #f8fafc !important;
  }

  tbody tr:hover {
    background-color: #f1f5f9 !important;
  }

  /* Status Badges - Compact size */
  .bd-g {
    background: #dcfce7 !important;
    color: #15803d !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-weight: 800 !important;
    font-size: 8.5px !important;
    border: 1px solid #bbf7d0 !important;
    display: inline-block !important;
    white-space: nowrap !important;
  }
  .bd-r {
    background: #fee2e2 !important;
    color: #b91c1c !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-weight: 800 !important;
    font-size: 8.5px !important;
    border: 1px solid #fecaca !important;
    display: inline-block !important;
    white-space: nowrap !important;
  }
  .bd-b {
    background: #f1f5f9 !important;
    color: #475569 !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-weight: 800 !important;
    font-size: 8.5px !important;
    border: 1px solid #e2e8f0 !important;
    display: inline-block !important;
    white-space: nowrap !important;
  }

  /* Signature Block */
  .fs {
    margin-top: 20px !important;
    display: flex !important;
    justify-content: space-between !important;
    padding-top: 10px !important;
    border-top: 1px dashed #cbd5e1 !important;
    page-break-inside: avoid !important;
  }

  .sb2 {
    text-align: center !important;
    width: 45% !important;
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    padding: 8px !important;
    border-radius: 10px !important;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02) !important;
  }

  .sb2 .ti {
    font-size: 9px !important;
    font-weight: 900 !important;
    color: #0f172a !important;
    margin-bottom: 12px !important;
  }

  .sb2 .ln {
    border-top: 1px solid #94a3b8 !important;
    margin: 0 10px !important;
    padding-top: 4px !important;
    font-size: 8px !important;
    font-weight: 700 !important;
    color: #64748b !important;
  }
</style>
`;

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

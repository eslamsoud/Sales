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
export function printHTMLInNewWindow(htmlContent: string): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(htmlContent);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 600);
}

// ═══════════════════════════════════════════════════════════════
// CSS مدمج للنافذة الجديدة (window.open)
// ═══════════════════════════════════════════════════════════════
export const COMPACT_PRO_CSS = `
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
  @page{size:A4;margin:0}
  @media print{body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Cairo','Tajawal',system-ui,sans-serif;color:#1e293b;background:#fff;width:210mm;min-height:297mm;padding:12mm 14mm;direction:rtl;line-height:1.5}
  .rh{text-align:center;padding:24px 16px 20px;margin-bottom:18px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;color:#fff;position:relative;overflow:visible}
  .rh::before{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle,rgba(255,255,255,.05) 0%,transparent 60%)}
  .rh h1{font-size:24px;font-weight:900;letter-spacing:.5px;margin-bottom:6px;text-shadow:0 2px 4px rgba(0,0,0,.3)}
  .rh .sub{font-size:13px;color:#94a3b8;font-weight:600}
  .rh .ref{margin-top:12px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;font-size:11px;color:#cbd5e1}
  .rh .ref span{background:rgba(255,255,255,.12);padding:5px 16px;border-radius:14px;white-space:nowrap}
  .sg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
  .sb{border-radius:14px;padding:14px 10px;text-align:center;position:relative;overflow:hidden}
  .sb::after{content:'';position:absolute;top:0;left:0;right:0;height:3px}
  .sb.bl{background:linear-gradient(180deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe}.sb.bl::after{background:#2563eb}
  .sb.gr{background:linear-gradient(180deg,#f0fdf4,#dcfce7);border:1px solid #bbf7d0}.sb.gr::after{background:#16a34a}
  .sb.rd{background:linear-gradient(180deg,#fff5f5,#fee2e2);border:1px solid #fecaca}.sb.rd::after{background:#dc2626}
  .sb.pu{background:linear-gradient(180deg,#f5f3ff,#ede9fe);border:1px solid #ddd6fe}.sb.pu::after{background:#7c3aed}
  .sb.am{background:linear-gradient(180deg,#fffbeb,#fef3c7);border:1px solid #fde68a}.sb.am::after{background:#f59e0b}
  .sb .l{font-size:9.5px;font-weight:700;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.3px}
  .sb .v{font-size:16px;font-weight:900;font-family:'Tajawal',monospace}
  .sb.bl .v{color:#1e40af}.sb.gr .v{color:#15803d}.sb.rd .v{color:#dc2626}.sb.pu .v{color:#7c3aed}.sb.am .v{color:#b45309}
  .st{font-size:12px;font-weight:800;color:#1e3a5f;margin:16px 0 8px;padding:6px 14px;background:linear-gradient(90deg,#f1f5f9,#fff);border-right:4px solid #f97316;border-radius:0 8px 8px 0;display:flex;align-items:center;gap:6px}
  .st .i{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:#f97316;color:#fff;border-radius:5px;font-size:10px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px;table-layout:fixed}
  th{background:linear-gradient(180deg,#1e3a5f,#0f172a);color:#fff;font-weight:700;padding:10px 8px;font-size:11px}
  th:first-child{border-radius:0 8px 0 0}th:last-child{border-radius:8px 0 0 0}
  td{padding:9px 8px;border-bottom:1px solid #e2e8f0;font-weight:500;word-wrap:break-word;overflow-wrap:break-word}
  tbody tr:nth-child(even){background:#f8fafc}
  tbody tr:last-child td:first-child{border-radius:0 0 0 8px}tbody tr:last-child td:last-child{border-radius:0 0 8px 0}
  tfoot td{font-weight:800;padding:11px 8px}
  .tt{background:linear-gradient(135deg,#0f172a,#1e3a5f)!important;color:#fff!important}
  .ts{background:linear-gradient(135deg,#059669,#10b981)!important;color:#fff!important}
  .td{background:linear-gradient(135deg,#dc2626,#ef4444)!important;color:#fff!important}
  .bd{display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700}
  .bd-g{background:#dcfce7;color:#15803d}.bd-r{background:#fee2e2;color:#dc2626}.bd-b{background:#eff6ff;color:#1e40af}.bd-w{background:#fef3c7;color:#b45309}
  .fs{margin-top:30px;display:flex;justify-content:space-between;padding-top:14px;border-top:2px solid #e2e8f0}
  .fs .sb2{text-align:center;width:40%}.fs .sb2 .ln{border-top:1px solid #94a3b8;margin:30px 10px 0;padding-top:6px;font-size:10px;font-weight:700;color:#475569}.fs .sb2 .ti{font-size:10px;font-weight:800;color:#1e3a5f}
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

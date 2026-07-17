import React from 'react';
import { Product, InvoiceItem } from '../../types';
import { getProductWeightsFallback } from '../../types';

interface InvoiceTemplateProps {
  invoice: any;
  customer: any;
  products: Product[];
  settings?: {
    appName?: string;
    representativeName?: string;
    representativePhone?: string;
  };
}

const formatCartonsAndPieces = (rawQty: number, unitsPerCarton: number): string => {
  const cartons = Math.floor(rawQty / unitsPerCarton);
  const pieces = rawQty % unitsPerCarton;
  const parts: string[] = [];
  if (cartons > 0) parts.push(`${cartons} كرتونة`);
  if (pieces > 0) parts.push(`${pieces} قطعة`);
  return parts.join(' و ') || 'منتهي';
};

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ invoice: inv, customer: customerObj, products, settings }) => {
  const formattedDate = new Date(inv.date).toLocaleDateString('ar-EG', { dateStyle: 'medium' });

  const appName = settings?.appName || 'فاتورة مبيعات معتمدة';
  const repName = settings?.representativeName || inv.delegateName?.replace(/ \(.*?\)/g, '').trim() || '';
  const repPhone = settings?.representativePhone || inv.delegatePhone || '';

  const isPartialOrPaid = inv._debtPaid || inv._partialPayment !== undefined;

  // Summary calculations
  const totalBeforeDiscount = inv.totalBeforeDiscount || 0;
  const totalAfterDiscount = inv.totalAfterDiscount || 0;
  const discountAmount = totalBeforeDiscount - totalAfterDiscount;
  const paidAmount = inv.paidAmount || 0;
  const remaining = totalAfterDiscount - paidAmount;

  // Partial/Debt paid calculations
  let prevPaid = 0;
  let currentPay = 0;
  let remainingNow = 0;
  if (isPartialOrPaid) {
    prevPaid = inv._previousPaid || 0;
    currentPay = inv._debtPaid ? (totalAfterDiscount - prevPaid) : (inv._partialPayment || 0);
    remainingNow = totalAfterDiscount - (prevPaid + currentPay);
  }

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Cairo', 'Tajawal', sans-serif", background: '#ffffff', padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '14px',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #d4a843, #f59e0b, #d4a843)' }} />
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, textAlign: 'center' }}>فاتورة مبيعات معتمدة</h1>
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>{appName}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px' }}>
          <span style={{ background: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontWeight: 700 }}>رقم: {inv.invoiceNumber}</span>
          <span style={{ color: '#cbd5e1' }}>فاتورة مبيعات</span>
          <span style={{ background: '#059669', padding: '4px 12px', borderRadius: '20px', fontWeight: 700 }}>{formattedDate}</span>
        </div>
      </div>

      {/* Customer & Rep Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        {/* Customer Card */}
        <div style={{
          background: '#f0f9ff',
          border: '2px solid #bae6fd',
          borderRadius: '12px',
          padding: '14px',
          borderRight: '4px solid #0284c7'
        }}>
          <div style={{ fontSize: '10px', color: '#0284c7', fontWeight: 700, marginBottom: '8px' }}>العميل المستلم</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>{customerObj?.name || 'غير معروف'}</div>
          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
            المحافظة: <b>{customerObj?.governorate || '—'}</b> - <b>{customerObj?.area || '—'}</b>
          </div>
          <div style={{ fontSize: '11px', color: '#475569' }}>
            الهاتف: <span style={{ fontFamily: 'monospace' }}>{customerObj?.phone || 'غير متوفر'}</span>
          </div>
        </div>

        {/* Rep Card */}
        <div style={{
          background: '#f0fdf4',
          border: '2px solid #bbf7d0',
          borderRadius: '12px',
          padding: '14px',
          borderRight: '4px solid #16a34a'
        }}>
          <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700, marginBottom: '8px' }}>المندوب المسؤول</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>{repName || 'شريك مبيعات معتمد'}</div>
          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
            هاتف التواصل: <span style={{ fontFamily: 'monospace' }}>{repPhone || '—'}</span>
          </div>
          {inv.notes && (
            <div style={{ fontSize: '11px', color: '#d97706', marginTop: '6px', background: '#fef3c7', padding: '4px 8px', borderRadius: '6px' }}>
              ملاحظات: {inv.notes}
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, borderRadius: '10px', overflow: 'hidden', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <thead>
          <tr style={{ background: 'linear-gradient(180deg, #1e3a5f, #0f172a)', color: '#ffffff' }}>
            <th style={{ padding: '10px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center', width: '30px' }}>م</th>
            <th style={{ padding: '10px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'right' }}>الصنف والحجم</th>
            <th style={{ padding: '10px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center' }}>الكمية</th>
            <th style={{ padding: '10px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center' }}>سعر الكرتونة</th>
            <th style={{ padding: '10px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center' }}>نسبة الخصم</th>
            <th style={{ padding: '10px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center' }}>القيمة الصافية</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item: InvoiceItem, idx: number) => {
            const prod = products.find((p: any) => String(p.id).trim() === String(item.productId).trim());
            const ws = prod ? getProductWeightsFallback(prod) : [];
            const weight = ws.find((w: any) => String(w.id).trim() === String(item.weightId).trim()) || ws[0];
            const prodName = prod ? prod.name : 'صنف مبيعات';
            const sizeLabel = weight ? weight.size : '';
            const multiplier = weight ? (weight.unitsPerCarton || 12) : 12;
            const qtyLabel = formatCartonsAndPieces(item.quantity, multiplier);
            const cartonOriginalPrice = item.originalPrice * multiplier;
            const singleItemTotal = item.finalPrice * item.quantity;

            return (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '12px' }}>{idx + 1}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  <b style={{ color: '#1e3a5f', fontSize: '12px' }}>{prodName}</b>{' '}
                  <span style={{ color: '#64748b', fontSize: '11px' }}>{sizeLabel}</span>
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '12px' }}>{qtyLabel}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px' }}>{cartonOriginalPrice.toLocaleString('ar-EG')}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: item.discountPercent > 0 ? '#dc2626' : '#94a3b8', fontWeight: 700, fontSize: '12px' }}>
                  {item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: '#1e3a5f', fontSize: '13px' }}>
                  {singleItemTotal.toLocaleString('ar-EG')} ج.م
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary Card */}
      <div style={{ width: '55%', marginLeft: 0, marginRight: 'auto', background: '#eff6ff', border: '2px solid #bfdbfe', borderRadius: '12px', overflow: 'hidden', marginBottom: '14px' }}>
        <div style={{ background: '#1e40af', color: '#ffffff', padding: '8px 12px', fontWeight: 900, fontSize: '12px', textAlign: 'center' }}>
          ملخص الفاتورة
        </div>
        <div style={{ padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
            <span style={{ color: '#1e3a8a', fontWeight: 700 }}>الإجمالي قبل التخفيض:</span>
            <span style={{ fontWeight: 700 }}>{totalBeforeDiscount.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>خصومات وتخفيضات:</span>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>-{discountAmount.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', background: '#dbeafe', padding: '6px 10px', borderRadius: '6px' }}>
            <span style={{ fontWeight: 900, color: '#1e3a8a' }}>صافي الفاتورة:</span>
            <span style={{ fontWeight: 900, color: '#1e3a8a' }}>{totalAfterDiscount.toLocaleString('ar-EG')} ج.م</span>
          </div>

          {isPartialOrPaid ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: '#475569', fontWeight: 700 }}>المسدد من قبل:</span>
                <span style={{ fontWeight: 700 }}>{prevPaid.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', background: '#dcfce7', padding: '4px 8px', borderRadius: '4px' }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>المسدد الآن:</span>
                <span style={{ color: '#16a34a', fontWeight: 900 }}>{currentPay.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: inv._debtPaid ? '#10b981' : '#ea580c', fontWeight: 700 }}>
                  {inv._debtPaid ? 'حالة الفاتورة:' : 'المتبقي:'}
                </span>
                <span style={{ color: inv._debtPaid ? '#10b981' : '#ea580c', fontWeight: 900 }}>
                  {inv._debtPaid ? 'خالصة' : `${remainingNow.toLocaleString('ar-EG')} ج.م`}
                </span>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', background: '#dcfce7', padding: '4px 8px', borderRadius: '4px' }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>المبلغ المسدد:</span>
                <span style={{ color: '#16a34a', fontWeight: 900 }}>{paidAmount.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', background: '#fff7ed', padding: '4px 8px', borderRadius: '4px' }}>
                <span style={{ color: '#ea580c', fontWeight: 700 }}>المتبقي (مديونية):</span>
                <span style={{ color: '#ea580c', fontWeight: 900 }}>{remaining.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '14px', marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '14px' }}>
          <div style={{ flex: 1, border: '2px solid #cbd5e1', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '8px' }}>مستلم البضاعة (العميل)</div>
            <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '30px', paddingTop: '6px', color: '#94a3b8', fontSize: '11px' }}>التوقيع</div>
          </div>
          <div style={{ flex: 1, border: '2px solid #cbd5e1', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '8px' }}>المندوب المفوض</div>
            <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '30px', paddingTop: '6px', color: '#94a3b8', fontSize: '11px' }}>التوقيع</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
          <span style={{ color: '#10b981', fontWeight: 700 }}>صحيح ومعتمد</span>
          <span style={{ color: '#1e3a8a', fontWeight: 600 }}>
            {repName ? `المندوب المفوض: ${repName} | هاتف التواصل: ${repPhone}` : 'إدارة المبيعات والتوزيع المعتمدة'}
          </span>
        </div>
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '10px', marginTop: '8px' }}>
          نظام المبيعات الذكي — {formattedDate}
        </div>
      </div>
    </div>
  );
};

export default InvoiceTemplate;

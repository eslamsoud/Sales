/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductWeight {
  id: string;
  size: string; // السعة اللترية أو الوزن (e.g. "1 لتر", "750 مل", "كمية أخرى")
  cartonPriceFromFactory: number; // سعر الكرتونة من المصنع
  unitsPerCarton: number; // عدد العبوات في الكرتونة
  factoryPricePerUnit: number; // سعر العبوة من المصنع (cartonPrice / unitsPerCarton)
  profitMarginPercent: number; // نسبة البيع أو الربح للإدارة (مثال 10)
  addedValue?: number; // القيمة المضافة التي تسجل مباشرة فوق سعر المصنع
  addedValuePerCarton?: number; // القيمة المضافة لكل كرتونة عند وجودها في السجلات القديمة
  retailPricePerUnit: number; // سعر بيع العبوة الصافي للجمهور بعد القيمة المضافة
}

export interface Product {
  id: string;
  name: string;
  price: number; // السعر الرئيسي بالليرة أو الجنيه أو العملة الافتراضية
  minStockAlert: number; // تنبيه عند اقتراب نفاذ المخزون
  accountingUnit?: string; // التعبئة أو المحاسبة (مثل: كرتونة، علبة، رابطة، شوال)
  weights?: ProductWeight[]; // قائمة الأوزان والأحجام المسجلة تحت الصنف
}

export interface FactoryLoad {
  id: string;
  productId: string;
  weightId?: string; // معرف الوزن المحدد للمنتج
  quantity: number; // إجمالي عدد العبوات الفردية المحملة
  cartonsCount?: number; // عدد الكراتين المحملة
  looseUnitsCount?: number; // العبوات الاضافية المنفردة
  date: string;
  notes?: string;
  warehouseKeeper?: string; // أمين المخزن المسؤول عن المراجعة (تمت المراجعة من)
  advanceAmount?: number; // مقدم البضاعة المدفوع للمصنع
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  area: string;
  locationLink: string;
}

export interface InvoiceItem {
  productId: string;
  weightId?: string; // معرف الوزن المحدد للمنتج المباع
  quantity: number; // بالعبوات الفردية
  originalPrice: number; // السعر لوزن العبوة من الإدارة
  factoryPrice?: number; // سعر العبوة من المصنع (لحساب صافي الربح تاريخياً)
  discountPercent: number; // 1% , 1.25%, 1.5% أو مخصص
  finalPrice: number; // السعر بعد الخصم
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  date: string;
  items: InvoiceItem[];
  totalBeforeDiscount: number;
  totalAfterDiscount: number;
  paidAmount: number;
  notes?: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  type?: 'expense' | 'revenue'; // added type for revenues
}

export interface Trip {
  id: string;
  description: string; // وصف المشوار للمصنع
  price: number; // المبلغ/السعر (يمكن أن يكون 0 ويعدل لاحقا)
  date: string; // تاريخ التسجيل
  collected: boolean; // تم التحصيل
  odometerStart?: number; // قراءة العداد عند البداية
  odometerEnd?: number; // قراءة العداد عند النهاية
}

export interface AppSettings {
  defaultDiscounts: number[]; // e.g. [1, 1.25, 1.5]
  googleSheetsUrl: string;
  currency: string;
  aiPitchGuidelines?: string; // الخطوط العريضة لرسائل الذكاء الاصطناعي
  aiRetentionGuidelines?: string; // رسائل استرجاع وتحفيز العملاء
  representativeName?: string; // اسم المندوب
  representativePhone?: string; // رقم هاتف المندوب
  appName?: string; // الاسم ليظهر في الفواتير (اسم النشاط)
}

export interface UserAuth {
  phone: string;
  name: string;
  role: 'owner' | 'employee';
  status: 'active' | 'pending';
  permittedTabs: string[]; // e.g., ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'administrative', 'reports']
  permittedSubTabs?: string[]; // e.g., ['loads', 'products', 'previous_loads', 'factory_account', 'trips', ...]
  password?: string; // كلمة المرور الخاصة بالمندوب للدوريات والإداريات
  customRoleName?: string; // المسمى الوظيفي المخصص (مثل مشرف، ليدر تيم، مندوب، زائر)
  createdAt: string;
}

export interface CarBalance {
  productId: string;
  productName: string;
  weightId?: string; // معرف الوزن المحدد للمنتج
  weightSize?: string; // اسم الوزن مثل "1 لتر"
  loaded: number;      // إجمالي الكميات المحملة من المصنع بالعبوات
  sold: number;        // إجمالي الكميات المباعة بالفواتير بالعبوات
  remaining: number;   // المتبقي (محمل - مباع) بالعبوات
  minAlert: number;    // حد التنبيه
}

export function getProductWeightsFallback(product: Product): ProductWeight[] {
  if (product.weights && product.weights.length > 0) {
    return product.weights;
  }
  // استخراج الحجم التقريبي من الاسم إن وجد (للتوافق الرجعي)
  let detectedSize = "عبوة افتراضية";
  if (product.name.includes("1 لتر")) detectedSize = "1 لتر";
  else if (product.name.includes("750 مل")) detectedSize = "750 مل";
  else if (product.name.includes("700 مل")) detectedSize = "700 مل";
  else if (product.name.includes("5 لتر")) detectedSize = "5 لتر";

  return [
    {
      id: "weight-default",
      size: detectedSize,
      cartonPriceFromFactory: product.price * 12,
      unitsPerCarton: 12,
      factoryPricePerUnit: product.price,
      profitMarginPercent: 0,
      retailPricePerUnit: product.price
    }
  ];
}

export function formatNum(num: number | string): string {
  const val = Number(num);
  if (isNaN(val)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  }).format(val);
}


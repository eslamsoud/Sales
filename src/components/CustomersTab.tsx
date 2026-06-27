// @ts-nocheck
import { confirmDialog } from '../utils/confirm';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Customer, AppSettings } from '../types';
import { showToast } from '../utils/toast';
import { Users, Plus, MapPin, Search, Phone, PhoneOff, ExternalLink, Trash2, ArrowRight, Compass, Check, Loader2, Star, MessageSquare, Send, Copy, Sparkles, Printer, FileText, Download, ArrowUpDown, Edit } from 'lucide-react';
import SecurePhoneDisplay from './SecurePhoneDisplay';

const EGYPT_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الشرقية', 'الدقهلية', 'البحيرة', 'القليوبية', 
  'الغربية', 'المنوفية', 'دمياط', 'بورسعيد', 'السويس', 'الإسماعيلية', 'الفيوم', 
  'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'مطروح', 
  'الوادي الجديد', 'البحر الأحمر', 'شمال سيناء', 'جنوب سيناء', 'كفر الشيخ', 'أخرى'
];

const EGYPT_CITIES: Record<string, string[]> = {
  'القاهرة': ['مصر الجديدة', 'مدينة نصر', 'المعادي', 'التجمع الخامس', 'شبرا', 'المرج', 'حلوان', 'المطرية', 'الزيتون', 'السلام', 'البساتين', 'دار السلام', 'الخليفة', 'المقطم', 'القاهرة الجديدة', 'بدر', 'الشروق', '15 مايو', 'وسط البلد', 'عين شمس', 'الزمالك'],
  'الجيزة': ['الجيزة', 'الدقي', 'المهندسين', 'الهرم', 'العجوزة', 'إمبابة', 'الشيخ زايد', '6 أكتوبر', 'العمرانية', 'البدرشين', 'الصف', 'أطفيح', 'العياط', 'منشأة القناطر', 'أوسيم', 'كرداسة', 'أبو النمرس', 'الحوامدية'],
  'الإسكندرية': ['الإسكندرية', 'برج العرب', 'العامرية', 'المنتزه', 'الرمل', 'سيدي بشر', 'سموحة', 'ميامي', 'كليوباترا', 'البيطاش', 'الدخيلة', 'العجمي', 'المندرة', 'محرم بك', 'الجمرك', 'المنشية'],
  'الشرقية': ['الزقازيق', 'أبو حماد', 'بلبيس', 'العاشر من رمضان', 'منيا القمح', 'فاقوس', 'الحسينية', 'أبو كبير', 'ديرب نجم', 'مشتول السوق', 'الإبراهيمية', 'كفر صقر', 'أولاد صقر', 'الصالحية الجديدة', 'القرين', 'القنايات'],
  'الدقهلية': ['المنصورة', 'ميت غمر', 'السنبلاوين', 'دكرنس', 'أجا', 'بلقاس', 'شربين', 'طلخا', 'نبروه', 'جمصة', 'بني عبيد', 'المطرية', 'تمي الأمديد', 'محلة دمنة', 'الكردي'],
  'البحيرة': ['دمنهور', 'كفر الدوار', 'رشيد', 'إدكو', 'أبو المطامير', 'أبو حمص', 'الدلنجات', 'المحمودية', 'الرحمانية', 'إيتاي البارود', 'شبراخيت', 'كوم حمادة', 'وادي النطرون', 'بدر'],
  'القليوبية': ['بنها', 'شبرا الخيمة', 'قليوب', 'الخانكة', 'العبور', 'القناطر الخيرية', 'طوخ', 'قها', 'كفر شكر', 'شبين القناطر', 'الخصوص'],
  'الغربية': ['طنطا', 'المحلة الكبرى', 'زفتى', 'كفر الزيات', 'سمنود', 'السنطة', 'بسيون', 'قطور'],
  'المنوفية': ['شبين الكوم', 'منوف', 'مدينة السادات', 'سرس الليان', 'أشمون', 'الباجور', 'قويسنا', 'بركة السبع', 'تلا', 'الشهداء'],
  'دمياط': ['دمياط', 'دمياط الجديدة', 'رأس البر', 'فارسكور', 'الزرقا', 'كفر سعد', 'كفر البطيخ', 'عزبة البرج', 'ميت أبو غالب', 'السرو'],
  'بورسعيد': ['بورسعيد', 'بورفؤاد', 'الشرق', 'الزهور', 'الضواحي', 'المناخ', 'الجنوب'],
  'الإسماعيلية': ['الإسماعيلية', 'فايد', 'القنطرة شرق', 'القنطرة غرب', 'التل الكبير', 'أبو صوير', 'القصاصين'],
  'السويس': ['السويس', 'الأربعين', 'عتاقة', 'الجناين', 'فيصل'],
  'كفر الشيخ': ['كفر الشيخ', 'دسوق', 'فوه', 'مطوبس', 'بلطيم', 'الحامول', 'بيلا', 'الرياض', 'سيدي سالم', 'قلين', 'برج البرلس', 'مسير', 'سيدي غازي'],
  'الفيوم': ['الفيوم', 'سنورس', 'إطسا', 'طامية', 'إبشواي', 'يوسف الصديق'],
  'بني سويف': ['بني سويف', 'الواسطى', 'ناصر', 'إهناسيا', 'ببا', 'سمسطا', 'الفشن'],
  'المنيا': ['المنيا', 'مغاغة', 'بني مزار', 'مطاي', 'سمالوط', 'أبو قرقاص', 'ملوي', 'دير مواس', 'العدوة'],
  'أسيوط': ['أسيوط', 'ديروط', 'القوصية', 'أبنوب', 'منفلوط', 'أبو تيج', 'الغنايم', 'ساحل سليم', 'البداري', 'الفتح', 'أسيوط الجديدة'],
  'سوهاج': ['سوهاج', 'أخميم', 'البلينا', 'المراغة', 'المنشأة', 'دار السلام', 'جرجا', 'جهينة', 'ساقلتة', 'طما', 'طهطا', 'سوهاج الجديدة'],
  'قنا': ['قنا', 'أبو تشت', 'فرشوط', 'نجع حمادي', 'الوقف', 'دشنا', 'قفط', 'قوص', 'نقادة'],
  'الأقصر': ['الأقصر', 'إسنا', 'أرمنت', 'الطود', 'البياضية', 'القرنة', 'الزينية'],
  'أسوان': ['أسوان', 'كوم أمبو', 'دراو', 'إدفو', 'نصر النوبة', 'أبو سمبل', 'كلابشة', 'الرديسية', 'البصيلية'],
  'مطروح': ['مرسى مطروح', 'العلمين', 'الضبعة', 'براني', 'السلوم', 'سيدي بئراني', 'سيدي عبد الرحمن', 'النجيلة', 'سيوة'],
  'البحر الأحمر': ['الغردقة', 'رأس غارب', 'سفاجا', 'القصير', 'مرسى علم', 'شلاتين', 'حلايب'],
  'الوادي الجديد': ['الخارجة', 'الداخلة', 'الفرافرة', 'باريس', 'بلاط'],
  'شمال سيناء': ['العريش', 'بئر العبد', 'الشيخ زويد', 'رفح', 'الحسنة', 'نخل'],
  'جنوب سيناء': ['الطور', 'شرم الشيخ', 'دهب', 'نويبع', 'طابا', 'سانت كاترين', 'أبو رديس', 'أبو زنيمة', 'رأس سدر']
};

const getGovernorateForArea = (area: string): string => {
  const norm = (area || '').trim();
  if (norm.includes('الزقازيق') || norm.includes('عاشر') || norm.includes('بلبيس') || norm.includes('الشرقية')) return 'الشرقية';
  if (norm.includes('ميت غمر') || norm.includes('المنصورة') || norm.includes('الدقهلية')) return 'الدقهلية';
  if (norm.includes('بدر') || norm.includes('دمنهور') || norm.includes('البحيرة')) return 'البحيرة';
  if (norm.includes('القاهرة') || norm.includes('مصر الجديدة') || norm.includes('المعادي')) return 'القاهرة';
  if (norm.includes('الجيزة') || norm.includes('الدقي') || norm.includes('الصف')) return 'الجيزة';
  if (norm.includes('الإسكندرية') || norm.includes('الرمل') || norm.includes('سموحة')) return 'الإسكندرية';
  if (norm.includes('طنطا') || norm.includes('المحلة') || norm.includes('الغربية')) return 'الغربية';
  if (norm.includes('شبين') || norm.includes('المنوفية')) return 'المنوفية';
  if (norm.includes('بنها') || norm.includes('القليوبية') || norm.includes('شبرا')) return 'القليوبية';
  if (norm.includes('دمياط')) return 'دمياط';
  if (norm.includes('بورسعيد')) return 'بورسعيد';
  if (norm.includes('السويس')) return 'السويس';
  if (norm.includes('الإسماعيلية')) return 'الإسماعيلية';
  if (norm.includes('الفيوم')) return 'الفيوم';
  if (norm.includes('بني سويف')) return 'بني سويف';
  if (norm.includes('المنيا')) return 'المنيا';
  if (norm.includes('أسيوط')) return 'أسيوط';
  if (norm.includes('سوهاج')) return 'سوهاج';
  if (norm.includes('قنا')) return 'قنا';
  if (norm.includes('الأقصر')) return 'الأقصر';
  if (norm.includes('أسوان')) return 'أسوان';
  return 'أخرى';
};

const getResolvedGov = (lead: any): string => {
  if (!lead) return 'أخرى';
  const areaVal = (lead.area || '').trim();
  if (!areaVal) return lead.governorate || 'أخرى';
  
  // First, check if the area matches any city in EGYPT_CITIES
  for (const [gov, cities] of Object.entries(EGYPT_CITIES)) {
    if (cities.some(city => areaVal.includes(city) || city.includes(areaVal))) {
      return gov;
    }
  }

  const resolved = getGovernorateForArea(areaVal);
  if (resolved && resolved !== 'أخرى') {
    return resolved;
  }
  return lead.governorate || 'أخرى';
};

const formatWhatsAppLink = (phone: string, encodedText: string = '') => {
  let cleaned = (phone || '').replace(/[^0-9]/g, '');
  if (!cleaned) return `https://wa.me/?text=${encodedText}`;
  if (cleaned.startsWith('0')) {
    cleaned = '20' + cleaned.substring(1);
  } else if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '20' + cleaned;
  }
  return `https://wa.me/${cleaned}${encodedText ? '?text=' + encodedText : ''}`;
};

const hasNoPhone = (phone?: string) => !phone || phone === 'غير مسجل' || phone.trim() === '' || phone.includes('انتظار');

const normalizeAr = (s: string) => (s || '').trim().replace(/\s+/g, ' ');

const isLeadInWorkArea = (leadGov: string, leadArea: string, workArea?: string) => {
  if (!workArea || workArea === 'الكل') return true;
  
  const zones = workArea.split(',').map(s => s.trim()).filter(Boolean);
  if (zones.length === 0) return true;

  const normLeadGov = normalizeAr(leadGov);
  const normLeadArea = normalizeAr(leadArea);

  return zones.some(zone => {
    if (zone === 'الكل') return true;
    if (zone.includes(' - ')) {
      const parts = zone.split(' - ');
      const targetGov = normalizeAr(parts[0]);
      const targetArea = normalizeAr(parts.slice(1).join(' - '));
      // Match governorate exactly, and area with partial matching
      const govMatch = normLeadGov === targetGov;
      const areaMatch = normLeadArea === targetArea ||
        normLeadArea.includes(targetArea) ||
        targetArea.includes(normLeadArea);
      return govMatch && areaMatch;
    } else {
      // Governorate level only — match gov or area belongs to this gov
      const targetGov = normalizeAr(zone);
      if (normLeadGov === targetGov) return true;
      // Also check if the lead area is within this governorate
      const govCities = EGYPT_CITIES[targetGov] || [];
      return govCities.some(city => normalizeAr(city) === normLeadArea || normLeadArea.includes(normalizeAr(city)));
    }
  });
};

const getLeadCardTheme = (type: string) => {
  const t = type || '';
  if (t.includes('هايبر')) return 'bg-indigo-50/60 border-indigo-200 hover:border-indigo-300 shadow-sm';
  if (t.includes('سوبر ماركت')) return 'bg-blue-50/60 border-blue-200 hover:border-blue-300 shadow-sm';
  if (t.includes('ميني ماركت') || t.includes('كشك')) return 'bg-cyan-50/60 border-cyan-200 hover:border-cyan-300 shadow-sm';
  if (t.includes('جملة') && !t.includes('نصف')) return 'bg-purple-50/60 border-purple-200 hover:border-purple-300 shadow-sm';
  if (t.includes('نصف جملة')) return 'bg-fuchsia-50/60 border-fuchsia-200 hover:border-fuchsia-300 shadow-sm';
  if (t.includes('توزيع')) return 'bg-violet-50/60 border-violet-200 hover:border-violet-300 shadow-sm';
  if (t.includes('حلواني') || t.includes('مخبز')) return 'bg-pink-50/60 border-pink-200 hover:border-pink-300 shadow-sm';
  if (t.includes('عطارة') || t.includes('علافة')) return 'bg-amber-50/60 border-amber-200 hover:border-amber-300 shadow-sm';
  if (t.includes('تموين')) return 'bg-teal-50/60 border-teal-200 hover:border-teal-300 shadow-sm';
  if (t.includes('مطعم') || t.includes('مطاعم')) return 'bg-orange-50/60 border-orange-200 hover:border-orange-300 shadow-sm';
  if (t.includes('مطابخ') || t.includes('تجهيزات')) return 'bg-stone-50/60 border-stone-200 hover:border-stone-300 shadow-sm';
  return 'bg-[#FFFFFF] border-slate-200 hover:border-slate-350 shadow-sm';
};

const getLeadBadgeTheme = (type: string) => {
  const t = type || '';
  if (t.includes('هايبر')) return 'bg-indigo-100 text-indigo-900 border-indigo-200';
  if (t.includes('سوبر ماركت')) return 'bg-blue-100 text-blue-900 border-blue-200';
  if (t.includes('ميني ماركت') || t.includes('كشك')) return 'bg-cyan-100 text-cyan-900 border-cyan-200';
  if (t.includes('جملة') && !t.includes('نصف')) return 'bg-purple-100 text-purple-900 border-purple-200';
  if (t.includes('نصف جملة')) return 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200';
  if (t.includes('توزيع')) return 'bg-violet-100 text-violet-900 border-violet-200';
  if (t.includes('حلواني') || t.includes('مخبز')) return 'bg-pink-100 text-pink-900 border-pink-200';
  if (t.includes('عطارة') || t.includes('علافة')) return 'bg-amber-100 text-amber-900 border-amber-200';
  if (t.includes('تموين')) return 'bg-teal-100 text-teal-900 border-teal-200';
  if (t.includes('مطعم') || t.includes('مطاعم')) return 'bg-orange-100 text-orange-900 border-orange-200';
  if (t.includes('مطابخ') || t.includes('تجهيزات')) return 'bg-stone-100 text-stone-900 border-stone-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

interface CustomersTabProps {
  customers: Customer[];
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onGoBack: () => void;
  settings: AppSettings;
  permittedSubTabs?: string[];
  currentUser?: UserAuth | null;
  googleMapsApiKey?: string; // يُمرّر من App.tsx
  googleLeads: any[];
  setGoogleLeads: React.Dispatch<React.SetStateAction<any[]>>;
  potentialLeads: any[];
  setPotentialLeads: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function CustomersTab({
  customers,
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onGoBack,
  settings,
  permittedSubTabs,
  currentUser,
  googleMapsApiKey,
  googleLeads,
  setGoogleLeads,
  potentialLeads,
  setPotentialLeads
}: CustomersTabProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'google_leads' | 'potential_leads'>(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('customers_list')) return 'list';
      if (permittedSubTabs.includes('customers_maps_finder')) return 'google_leads';
    }
    return 'list';
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [salesManager, setSalesManager] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [type, setType] = useState('');
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [locationLink, setLocationLink] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [govSearchQuery, setGovSearchQuery] = useState('');
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [geoStatusMsg, setGeoStatusMsg] = useState('');
  const [waLoadingId, setWaLoadingId] = useState<string | null>(null);
  const [discoveredGovFilter, setDiscoveredGovFilter] = useState('');
  const [discoveredAreaFilter, setDiscoveredAreaFilter] = useState('');
  const [discoveredTypesFilter, setDiscoveredTypesFilter] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  // New multi-select states
  const [discoveredGovsFilter, setDiscoveredGovsFilter] = useState<string[]>([]);
  const [discoveredAreasFilter, setDiscoveredAreasFilter] = useState<string[]>([]);
  const [discoveredSearchQuery, setDiscoveredSearchQuery] = useState('');
  const [hideVisitedLeads, setHideVisitedLeads] = useState(false);

  const [sortBy, setSortBy] = useState<'none' | 'alpha' | 'purchases'>('none');
  const [pendingLeadToCustomer, setPendingLeadToCustomer] = useState<any>(null);

  const isUserAdmin = currentUser?.role === 'owner' || currentUser?.phone === '01228466613' || (currentUser?.customRoleName?.includes('نائب المدير') || currentUser?.customRoleName?.includes('مشرف عام'));

  const [expandedStagedLeads, setExpandedStagedLeads] = useState<Record<string, boolean>>({});

  const [expandedPotentialLeads, setExpandedPotentialLeads] = useState<Record<string, boolean>>({});
  const [pendingPotentialLead, setPendingPotentialLead] = useState<any>(null);

  const [potentialGovsFilter, setPotentialGovsFilter] = useState<string[]>([]);
  const [potentialAreasFilter, setPotentialAreasFilter] = useState<string[]>([]);
  const [potentialTypesFilter, setPotentialTypesFilter] = useState<string[]>([]);
  const [potentialSearchQuery, setPotentialSearchQuery] = useState('');

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab]);

  React.useEffect(() => {
    if (currentUser && currentUser.role !== 'owner' && currentUser.workArea && currentUser.workArea !== 'الكل') {
      const zones = currentUser.workArea.split(',').map(s => s.trim()).filter(Boolean);
      const govs: string[] = [];
      const areas: string[] = [];
      
      zones.forEach(zone => {
        if (zone.includes(' - ')) {
          const parts = zone.split(' - ');
          govs.push(parts[0].trim());
          areas.push(parts[1].trim());
        } else {
          govs.push(zone);
        }
      });
      
      if (govs.length > 0) {
        setDiscoveredGovsFilter(Array.from(new Set(govs)));
      }
      if (areas.length > 0) {
        setDiscoveredAreasFilter(Array.from(new Set(areas)));
      }
    }
  }, [currentUser]);

  const handleGenerateAndSendWA = async (customer: Customer) => {
    setWaLoadingId(customer.id);
    try {
      const userMessage = `قم بصياغة رسالة واتساب لعميل اسمه: ${customer.name} (حالة العميل: مسجل بقاعدة العملاء ومحله في منطقة: ${customer.area}).
التعليمات والخطوط العريضة الخاصة بمدير المبيعات (استخدمها للتفاوض والمتابعة):
"${settings.aiRetentionGuidelines || 'قدم رسالة ترحيبية تشجعه على استمرار التعامل معنا، مع توضيح أننا نهتم بوجوده معنا كشريك نجاح.'}"
أريد فقط نص الرسالة بدون أي مقدمات أخرى لتكون جاهزة للإرسال مباشرة للعميل وبصيغة جذابة.`;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: 'أنت مساعد مبيعات احترافي.',
          history: [],
          message: userMessage
        })
      });

      if (!response.ok) {
        throw new Error('مفتاح الـ API غير صالح أو غير نشط.');
      }

      const data = await response.json();
      const messageText = encodeURIComponent(data.text);
      window.location.href = formatWhatsAppLink(customer.phone, messageText);
    } catch (err: any) {
      console.warn("Using premium local pitch message generator due to inactive Gemini API Key:", err.message);
      
      const guidelines = settings.aiRetentionGuidelines || 'تقديم عرض ترويجي خاص لزيوت وسمن سوفانا الفاخرة';
      const fallbackPitchMsg = `السلام عليكم ورحمة الله وبركاته يا فندم 🌸\nمعكم مندوب مبيعات زيوت وسمن "سوفانا" الممتازة لجودة الفنادق والمطاعم والبيوت.\n\nنتشرف بالتعاون معكم في [ ${customer.name} ] بمنطقة [ ${customer.area} ] ونود تقديم عروضنا الخاصة والحصرية لكم لتوفير أفضل سمن بلدي وزيوت مصفاة فائقة النقاوة، بهامش ربح ممتاز وتسهيلات سداد مريحة.\n\n(✨ هدفنا الاستراتيجي: ${guidelines})\n\nهل نتشرف بتحديد موعد قريب للزيارة وتجريب عيناتنا المجانية للتأكد من الجودة؟`;
      
      const messageText = encodeURIComponent(fallbackPitchMsg);
      window.location.href = formatWhatsAppLink(customer.phone, messageText);
    } finally {
      setWaLoadingId(null);
    }
  };

  // دالة تصدير البيانات إلى ملف CSV إكسيل
  const exportToCSV = (data: any[], filename: string) => {
    const BOM = '\uFEFF';
    const csvRows = [];
    const headers = Object.keys(data[0] || {});
    csvRows.push(headers.join(','));
    for (const row of data) {
      const values = headers.map(header => `"${('' + (row[header] || '')).replace(/"/g, '""')}"`);
      csvRows.push(values.join(','));
    }
    const blob = new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };



  // فلتر ذكي لعزل العملاء الذين تم تحويلهم لعملاء فعليين أو محتملين ومنع ظهورهم نهائياً وتصفية التكرار
  const activeGoogleLeads = React.useMemo(() => {
    const seenNames = new Set<string>();
    const seenPhones = new Set<string>();

    const workArea = currentUser?.workArea;

    return googleLeads.filter(lead => {
      const leadName = (lead.name || '').trim().toLowerCase();
      const leadPhone = (lead.phone || '').trim();

      if (!leadName) return false;

      // Check workArea restriction
      const leadGov = getResolvedGov(lead);
      const leadArea = (lead.area || '').trim();
      if (currentUser?.role !== 'owner' && !isLeadInWorkArea(leadGov, leadArea, workArea)) {
        return false;
      }
      
      const alreadyRealCustomer = customers.some(c => 
        (c.phone || '').trim() === leadPhone || 
        (c.name || '').trim().toLowerCase() === leadName
      );
      
      const alreadyPotential = potentialLeads.some(p => 
        (p.phone || '').trim() === leadPhone || 
        (p.name || '').trim().toLowerCase() === leadName
      );

      const isDuplicate = (leadPhone && seenPhones.has(leadPhone)) || seenNames.has(leadName);

      if (alreadyRealCustomer || alreadyPotential || isDuplicate || lead.confirmed) {
        return false;
      }

      if (leadPhone) seenPhones.add(leadPhone);
      seenNames.add(leadName);
      return true;
    });
  }, [googleLeads, potentialLeads, customers]);

  // حصر المحافظات المكتشفة للتصفية السريعة
  const discoveredGovCounts = React.useMemo(() => {
    return activeGoogleLeads.reduce((acc, lead) => {
        const gov = getResolvedGov(lead);
        acc[gov] = (acc[gov] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
  }, [activeGoogleLeads]);

  // 1. Filter by selected Governorates
  const leadsFilteredByGov = React.useMemo(() => {
    if (discoveredGovsFilter.length === 0) return activeGoogleLeads;
    return activeGoogleLeads.filter(lead => {
        const gov = getResolvedGov(lead);
        return discoveredGovsFilter.includes(gov);
    });
  }, [activeGoogleLeads, discoveredGovsFilter]);

  // 2. Get available areas from the governorate-filtered leads
  const discoveredAreaCounts = React.useMemo(() => {
    return leadsFilteredByGov.reduce((acc, lead) => {
        const area = (lead.area || '').trim() || 'غير محدد';
        if (area !== 'غير محدد') {
            acc[area] = (acc[area] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
  }, [leadsFilteredByGov]);

  // 3. Filter by selected Areas
  const leadsFilteredByArea = React.useMemo(() => {
    if (discoveredAreasFilter.length === 0) return leadsFilteredByGov;
    return leadsFilteredByGov.filter(lead => {
        const area = (lead.area || '').trim() || 'غير محدد';
        return discoveredAreasFilter.includes(area);
    });
  }, [leadsFilteredByGov, discoveredAreasFilter]);

  const discoveredLeadTypeCounts = React.useMemo(() => {
    return leadsFilteredByArea.reduce((acc, lead) => {
        const type = lead.type || 'غير محدد';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
  }, [leadsFilteredByArea]);

  // فلتر ذكي لعزل العملاء المحتملين الذين تم تحويلهم لعملاء فعليين ومنع ظهورهم نهائياً وتصفية التكرار
  const activePotentialLeads = React.useMemo(() => {
    const seenNames = new Set<string>();
    const seenPhones = new Set<string>();

    const workArea = currentUser?.workArea;

    return potentialLeads.filter(lead => {
      const leadName = (lead.name || '').trim().toLowerCase();
      const leadPhone = (lead.phone || '').trim();

      if (!leadName) return false;

      // Check workArea restriction
      const leadGov = getResolvedGov(lead);
      const leadArea = (lead.area || '').trim();
      if (currentUser?.role !== 'owner' && !isLeadInWorkArea(leadGov, leadArea, workArea)) {
        return false;
      }

      const alreadyRealCustomer = customers.some(c => 
        (c.phone || '').trim() === leadPhone || 
        (c.name || '').trim().toLowerCase() === leadName
      );

      const isDuplicate = (leadPhone && seenPhones.has(leadPhone)) || seenNames.has(leadName);

      if (alreadyRealCustomer || isDuplicate) {
        return false;
      }

      if (leadPhone) seenPhones.add(leadPhone);
      seenNames.add(leadName);
      return true;
    });
  }, [potentialLeads, customers]);

  // حصر المحافظات المحتملة للتصفية السريعة
  const potentialGovCounts = React.useMemo(() => {
    return activePotentialLeads.reduce((acc, lead) => {
        const gov = getResolvedGov(lead);
        acc[gov] = (acc[gov] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
  }, [activePotentialLeads]);

  // 1. التصفية حسب المحافظات المحددة للعملاء المحتملين
  const potentialLeadsFilteredByGov = React.useMemo(() => {
    if (potentialGovsFilter.length === 0) return activePotentialLeads;
    return activePotentialLeads.filter(lead => {
        const gov = getResolvedGov(lead);
        return potentialGovsFilter.includes(gov);
    });
  }, [activePotentialLeads, potentialGovsFilter]);

  // 2. حصر المناطق المحتملة من العملاء المحتملين المفلترين بالمحافظة
  const potentialAreaCounts = React.useMemo(() => {
    return potentialLeadsFilteredByGov.reduce((acc, lead) => {
        const area = (lead.area || '').trim() || 'غير محدد';
        if (area !== 'غير محدد') {
            acc[area] = (acc[area] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
  }, [potentialLeadsFilteredByGov]);

  // 3. التصفية حسب المناطق المحددة للعملاء المحتملين
  const potentialLeadsFilteredByArea = React.useMemo(() => {
    if (potentialAreasFilter.length === 0) return potentialLeadsFilteredByGov;
    return potentialLeadsFilteredByGov.filter(lead => {
        const area = (lead.area || '').trim() || 'غير محدد';
        return potentialAreasFilter.includes(area);
    });
  }, [potentialLeadsFilteredByGov, potentialAreasFilter]);

  // 4. حصر أنشطة العملاء المحتملين للتصفية
  const potentialLeadTypeCounts = React.useMemo(() => {
    return potentialLeadsFilteredByArea.reduce((acc, lead) => {
        const type = lead.type || 'غير محدد';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
  }, [potentialLeadsFilteredByArea]);

  const sheetAreas = (settings.workAreas || []).map(w => w.area).filter(Boolean);
  const sheetGovs = (settings.workAreas || []).map(w => w.governorate).filter(Boolean);
  const registeredCustomerAreas = Array.from(new Set(customers.map(c => c.area).filter(Boolean)));
  const DEFAULT_AREAS = ['الزقازيق', 'ميت غمر', 'بدر', 'العاشر من رمضان', 'بلبيس', 'القاهرة'];
  // If sheet has data, use ONLY sheet areas + existing customer areas; otherwise fallback to defaults
  const allAreas = sheetAreas.length > 0
    ? Array.from(new Set([...sheetAreas, ...registeredCustomerAreas]))
    : Array.from(new Set([...DEFAULT_AREAS, ...registeredCustomerAreas]));
  const finalGovernorates = sheetGovs.length > 0
    ? Array.from(new Set([...sheetGovs, ...EGYPT_GOVERNORATES]))
    : EGYPT_GOVERNORATES;

  // Google Maps Lead Finder State
  const [selectedSearchArea, setSelectedSearchArea] = useState('');
  const [storeTypes, setStoreTypes] = useState<string[]>(['سوبر ماركت']);
  const [isSearchingMaps, setIsSearchingMaps] = useState(false);
  const [mapsResults, setMapsResults] = useState<any[]>([]);
  const [addedLeadIds, setAddedLeadIds] = useState<string[]>([]);
  const [selectedMapResults, setSelectedMapResults] = useState<string[]>([]);

  // Slicing/segmenting capabilities for large maps list
  const [batchSize, setBatchSize] = useState<number>(10);
  const [activePitchLeadId, setActivePitchLeadId] = useState<string | null>(null);
  const [aiPitchText, setAiPitchText] = useState<string>('');

  // Toggling expanded/collapsed states for different lists
  const [expandedRealCustomers, setExpandedRealCustomers] = useState<Record<string, boolean>>({});
  const [expandedGoogleLeads, setExpandedGoogleLeads] = useState<Record<string, boolean>>({});

  const handleBulkAddMapLeads = () => {
    const newLeads = [...googleLeads];
    const newAddedIds = [...addedLeadIds];
    let addedCount = 0;

    mapsResults.forEach(lead => {
      if (newAddedIds.includes(lead.id)) return;
      
      const existsInReal = customers.some(c => c.phone === lead.phone || c.name.toLowerCase() === lead.name.toLowerCase());
      if (existsInReal) {
        newAddedIds.push(lead.id);
        return;
      }
      
      const exists = newLeads.some(g => g.phone === lead.phone || g.name.toLowerCase() === lead.name.toLowerCase());
      if (exists) {
        newAddedIds.push(lead.id);
        return;
      }

      const finalArea = (lead.detailedAddress || lead.area || 'أخرى').trim();
      const gov = getGovernorateForArea(finalArea);
      newLeads.push({ ...lead, governorate: gov, dateAdded: new Date().toLocaleDateString('ar-EG'), confirmed: false });
      newAddedIds.push(lead.id);
      addedCount++;
    });

    if (addedCount > 0) {
      setGoogleLeads(newLeads);
      setAddedLeadIds(newAddedIds);
      showToast(`✓ تم إضافة ${addedCount} عميل جديد للمسودة دفعة واحدة بنجاح!`);
      setActiveTab('google_leads');
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } else {
      showToast(`⚠️ جميع النتائج الحالية مضافة مسبقاً بقواعد البيانات!`);
    }
  };

  const handleAddSelectedMapLeads = () => {
    if (selectedMapResults.length === 0) return;
    
    const newLeads = [...googleLeads];
    const newAddedIds = [...addedLeadIds];
    let addedCount = 0;

    mapsResults.filter(l => selectedMapResults.includes(l.id)).forEach(lead => {
      if (newAddedIds.includes(lead.id)) return;
      
      const existsInReal = customers.some(c => c.phone === lead.phone || c.name.toLowerCase() === lead.name.toLowerCase());
      const existsInDraft = newLeads.some(g => g.phone === lead.phone || g.name.toLowerCase() === lead.name.toLowerCase());
      
      if (!existsInReal && !existsInDraft) {
        const finalArea = (lead.detailedAddress || lead.area || 'أخرى').trim();
        const gov = getGovernorateForArea(finalArea);
        newLeads.push({ ...lead, governorate: gov, dateAdded: new Date().toLocaleDateString('ar-EG'), confirmed: false });
        addedCount++;
      }
      newAddedIds.push(lead.id);
    });

    setGoogleLeads(newLeads);
    setAddedLeadIds(newAddedIds);
    setSelectedMapResults([]);
    showToast(`✓ تم إضافة ${addedCount} عميل محدد للمسودة بنجاح!`);
    setActiveTab('google_leads');
  };

  const handleBulkDeleteAllGoogleLeads = async () => {
    if (googleLeads.length === 0) return;
    if (!isUserAdmin) { showToast('⚠️ الحذف متاح فقط للمدير ونائب المدير.'); return; }
    const proceed = await confirmDialog('هل أنت متأكد من مسح جميع العملاء المكتشفين من الذاكرة المؤقتة نهائياً؟');
    if (proceed) {
      const deleted = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
      googleLeads.forEach(l => {
        if (!deleted.includes(l.id)) deleted.push(l.id);
      });
      localStorage.setItem('deleted_records_sys', JSON.stringify(deleted));
      setGoogleLeads([]);
      setSelectedLeads([]);
      showToast('✓ تم مسح جميع العملاء المكتشفين بنجاح!');
    }
  };

  // Advanced AI Advisor Database & Copywriters
  const getAdviceForStoreType = (type: string) => {
    const t = type || '';
    if (t === 'هايبر ماركت') {
      return {
        ratingLabel: 'هايبر ماركت',
        bestPractice: 'الهايبر ماركت يتميز بحجم مسحوبات ضخم جداً ونقاط ترويج قوية. ركز على تقديم عروض أسعار الكرتونة والجملة الحصرية مع تسهيلات سداد وعرض ترويجي بارز وستاند عرض خاص بمنتجات سوفانا مجاناً لزيادة التفاعل اليومي ورؤية المنتج.',
        steps: [
          'الاتفاق مع الإدارة على وضع ستاند عرض خشبي مخصص لمنتجات سوفانا مجاناً.',
          'توفير كوبونات خصم أو ميزات هدايا نقدية فورية لإدارة السوبر ماركت عند تحقيق تارجت شهري.',
          'تأمين خط إمداد دوري ثابت مع المندوب وضمان عدم انقطاع أي وزن من الزيوت والسمن.'
        ]
      };
    } else if (t === 'حلواني ومخبز') {
      return {
        ratingLabel: 'حلواني ومخبز',
        bestPractice: 'الأفران والمخابز تستهلك كميات وفيرة من السمن الصناعي والزبدة وزيوت العجن لدعم جودة العجين. اعرض عليهم صفائح زيت وسمن سوفانا بأوزانها وسعر الجملة للمخابز مع التركيز على نعومة الملمس والتوراق وجودة رائحة المخبوزات والكرواسون.',
        steps: [
          'تقديم عينة للخباز لتجربتها بنفسه في عجن الفينو أو معجنات السكر لرؤية التوراق والمعان بنفسه.',
          'عرض ميزة الدفع بعد تسليم الوجبة الأولى وتسهيل الدفع كدعم لفرن المعجنات.',
          'تسجيل موعد زيارة أسبوعي منتظم من المندوب لتوريد الصفائح والكراتين في أوقات الصباح الباكر.'
        ]
      };
    } else if (t === 'سوبر ماركت') {
      return {
        ratingLabel: 'سوبر ماركت نشط',
        bestPractice: 'الاعتماد على عينات مجانية صغيرة الحجم لعرض جودة المنتج لربات البيوت. قدم له ميزة الدفع الآجل الجزئي بعد سحب الدفعة الأولى. ركز على أن زيت وسمن سوفانا يحقق هامش ربح أعلى 15% مقارنة بالمنتجات المنافسة مع جودة تضاهي الشركات الكبرى.',
        steps: [
          'تزويده بستائر دعائية لرفوف السوبر ماركت مجاناً لزيادة جاذبية الصنف.',
          'ترتيب البضاعة في مستوى نظر المستهلك الفعلي بالاتفاق معه لزيادة المبيعات.',
          'تقديم خصم تصاعدي فوري مع زيادة عدد الكراتين المسحوبة شهرياً لضمان الولاء.'
        ]
      };
    } else if (t === 'ميني ماركت') {
      return {
        ratingLabel: 'ميني ماركت نشط',
        bestPractice: 'البقال والميني ماركت يركز بشدة على استمرارية التوريد والأسعار المنافسة بسبب حساسية فئته السعرية. وفر له خدمة التوصيل السريع للمكان وسهّل عملية الارتجاع للعبوات التالفة لإزالة أي مخاوف لديه.',
        steps: [
          'تقديم تسهيل بسيط في كمية الحد الأدنى للطلب (بدءاً من كرتونة واحدة فقط).',
          'وفّر له بوسترات صغيرة ملونة لتعليقها على واجهة المحل لتعريف المترددين.',
          'قم بزيارته دورياً في نفس اليوم من كل أسبوع لكسب ثقته وتثبيت موعد سحب مرتجع الكرتون.'
        ]
      };
    } else if (t === 'مطاعم') {
      return {
        ratingLabel: 'مورد مطاعم ومآكل',
        bestPractice: 'المطاعم تستهلك كميات ضخمة من الزيوت والسمن ويبحثون بالدرجة الأولى عن نقطة الدخان المرتفعة ومقاومة الزرنخة وقدرة التحمل بالتسخين المديد. ركز أثناء حديثك على نقاء زيوت سوفانا وسعة توفيرها في القلي المتكرر دون تغير الطعم.',
        steps: [
          'تقديم عينة مجانية عبوة 1 لتر أو 5 لتر للتجربة العملية داخل المطبخ مباشرة.',
          'توفير عقود إمداد تكرارية ثابتة بأسعار كسر الجملة لدعم ربحيته وتشجيعه على الطلب.',
          'الحفاظ على سرعة ودقة الاستجابة لأي نقص طارئ كحل منقذ لمطبخه لمواصلة القلي والطهي.'
        ]
      };
    } else if (t === 'بقالة تموينية' || t === 'مواد تموينية') {
      return {
        ratingLabel: 'مورد تموينية',
        bestPractice: 'تجار التموين يبحثون عن الأسعار المخفضة بشدة لتلبية احتياجات الفئات الاقتصادية. قدم عروض أسعار تنافسية بعبوات صغيرة وكبيرة لتناسب جميع الاحتياجات.',
        steps: [
          'تصميم باقات وعروض للكميات الكبيرة لتوزيعها ضمن حصص التموين.',
          'تسهيل شروط الدفع والتعاون مع التجار في تصريف الكميات الكبيرة.',
          'توفير عبوات اقتصادية جذابة ومناسبة للسعر التمويني.'
        ]
      };
    } else if (t === 'مطابخ وتجهيزات') {
      return {
        ratingLabel: 'مورد تجهيزات ولائم',
        bestPractice: 'المطابخ المركزية ومتعهدو الحفلات يستهلكون السمن والزيت بأحجام ضخمة (جراكن وصفائح). التركيز هنا يكون على "التوفير في الحجم الكبير" وجودة الطعم والرائحة في التسوية.',
        steps: [
          'توفير أسعار خاصة لطلبات "القطاع العريض" والجراكن لتخفيض تكلفة الإنتاج للوجبة.',
          'ضمان التوصيل السريع للمطابخ لأنهم مرتبطون بمواعيد تسليم دقيقة للعملاء.',
          'التأكيد على جودة السمن في إعطاء رائحة "البلدي" الأصيل للولائم والمناسبات الكبرى.'
        ]
      };
    } else { // 'عطارة' or 'الكل'
      return {
        ratingLabel: 'عطار / عطارة وبقالة جملة',
        bestPractice: 'يحب العطار المعاملة العائلية وبناء الثقة الشخصية، ويركز على جودة الرائحة والنكهة في السمن والزيوت السائبة والمعبأة. اعرض عليه شهادات جودة طعم وجدار المنتج ونقاوة مصفاه الطبيعي.',
        steps: [
          'تقديم خصم جملة الجملة التشجيعي عند طلب كميات تتجاوز 10 كرتونة فما فوق.',
          'تقديم عينة عرض مفتوحة برائحة السمن الطبيعي المذهلة لجذب المتسوقين وتنمية رغبتهم.',
          'إدراج عطارته المرموقة في قائمة الموزعين عبر إعلانات الصفحة لمنطقتك مجاناً لتسريع مبيعاته.'
        ]
      };
    }
  };

  const generateAIPitchMessage = (type: string, clientName: string) => {
    const t = type || '';
    const guidelines = settings.aiPitchGuidelines ? `\n\n(🎯 تذكير بالنقاط الرئيسية المتفق عليها بالعرض: ${settings.aiPitchGuidelines})` : '';
    
    if (t === 'هايبر ماركت') {
      return `السلام عليكم يا فندم، معكم مندوب زيوت وسمن سوفانا الفاخرة 🌸. يسعدنا التعاون معكم وتقديم عروض سمن وزيوت حصرية لـ [ ${clientName} ] بمميزات مخصصة للهايبر ماركت وسحب كميات ومستويات توريد مستمرة. نضمن لكم هامش ربح ممتاز وتجربة عينات مجانية لعملائكم.${guidelines}\n\nهل نتشرف بتحديد موعد للزيارة؟`;
    } else if (t === 'حلواني ومخبز') {
      return `السلام عليكم ورحمة الله، معكم مندوب زيوت وسمن سوفانا الخاصة بالمخابز والأفران 🥖. يشرفنا تزويد [ ${clientName} ] بأجود أنواع سمن العجن والزيوت النباتية المصفاة المخصصة للحلويات والفينو والمعجنات، بأسعار جملة تشجيعية وتسهيل دفع ممتاز لضمان جودة طعم ورائحة لا تقاوم لمخبوزاتكم.${guidelines}\n\nيسعدنا إرسال عينة تجريبية للمصانع والأفران اليوم للتجربة الفوقية؟`;
    } else if (t === 'سوبر ماركت') {
      return `السلام عليكم يا فندم، معكم مندوب زيوت وسمن سوفانا الفاخرة 🌸. يسعدنا التعاون معكم وتقديم عرض توريد خاص جداً يناسب السوبر ماركت المميز لديكم [ ${clientName} ] بمستويات طلب مرنة وهوامش ربح ممتازة لعملائكم، مع توفير عينات تذوق مجاناً لزيادة حركة سحب الصنف بالرفوف.${guidelines}\n\nهل يمكننا تحديد موعد لزيارتكم وتقديم قائمة الأسعار والخصومات الحصرية؟`;
    } else if (t === 'ميني ماركت') {
      return `أهلاً بحضرتك يا فندم، معكم زيوت وسمن سوفانا 🌟. يسعدنا نوفر لكم خدمة توصيل سريعة ومجانية لبقالتكم الكريمة [ ${clientName} ] مع هامش ربح تنافسي يزيد مبيعاتكم، وضمان الاسترجاع الكامل والاستبدال الفوري للأصناف. أسعارنا تبدأ من كرتونة واحدة وتسهيلات دفع تشجيعية.${guidelines}\n\nيشرفنا نرسل لحضرتك كتالوج الأصناف المتاحة للطلب الفوري؟`;
    } else if (t === 'مطاعم') {
      return `السلام عليكم يا فندم، معكم شريككم في الجودة؛ زيوت وسمن سوفانا الممتازة للمطاعم الفاخرة [ ${clientName} ] 🍳. ندرك أهمية نقاوة الزيت ومقاومته للحرارة العالية لتقديم طعام صحي وشهي؛ لذلك صممنا عروض الجملة الخاصة بمطاعم الفول والفلافل والمأكولات الشعبية بنسب توفير مذهلة وبند سحب دوري سهل.${guidelines}\n\nيسعدنا إرسال عينة تذوق وتجريب مجانية للمطبخ اليوم للتأكد من جدارتنا بالاعتماد؟`;
    } else if (t === 'بقالة تموينية' || t === 'مواد تموينية') {
      return `السلام عليكم يا فندم، معكم مندوب زيوت وسمن سوفانا 🌸. يشرفنا أن نتعاون معكم ونوفر لـ [ ${clientName} ] منتجاتنا بأسعار تنافسية تلائم طبيعة عملكم كمنفذ تمويني مع توفير هوامش ربح جيدة وعبوات تناسب جميع الفئات المستهدفة.${guidelines}\n\nهل يمكننا تحديد موعد لزيارتكم وتقديم قائمة الأسعار والخصومات الحصرية؟`;
    } else if (t === 'مطابخ وتجهيزات') {
      return `أهلاً بحضرتك يا فندم، معكم مندوب زيوت وسمن سوفانا الممتازة للولائم والتجهيزات 🌟. نعلم أن [ ${clientName} ] يهتم بجودة الطعم والرائحة الأصيلة في كل وجبة. صممنا لكم عروضاً على عبوات الجراكن والصفائح الكبيرة لتوفير أعلى جودة بأقل تكلفة إنتاجية.${guidelines}\n\nيسعدنا تقديم الأسعار التنافسية الخاصة بالتجهيزات المركزية وعينة تجريبية لشيف المطبخ؟`;
    } else {
      return `مرحباً بحضرتك يا فندم، معكم زيوت وسمن سوفانا 🌿. نتشرف بالتعاون مع تجار العطارة الكرام في [ ${clientName} ]، ونوفر لكم سمن بلدي وزيوت طبيعية بنكهات أصلية وروائح جذابة تضمن ولاء المتسوقين وبخصومات مخصصة للكميات تبدأ من 5 كراتين مع ترويج مجاني لعطارتكم في منصاتنا لضمان بيع ممتاز.${guidelines}\n\nهل تود التعرف على أسعار التوريد والكميات المتاحة حالياً؟`;
    }
  };

  const handleAddMapLeadToGoogleLeads = (lead: any) => {
    // Check if it exists in actual customers
    const existsInReal = customers.some(c => c.phone === lead.phone || c.name.toLowerCase() === lead.name.toLowerCase());
    if (existsInReal) {
      showToast(`⚠️ العميل "${lead.name}" موجود بالفعل في العملاء الفعليين!`);
      setAddedLeadIds(prev => [...prev, lead.id]);
      return;
    }

    // Add to googleLeads watchlist if not exists
    const exists = googleLeads.some(g => g.phone === lead.phone || g.name.toLowerCase() === lead.name.toLowerCase());
    if (exists) {
      showToast(`⚠️ العميل "${lead.name}" موجود بالفعل في العملاء المكتشفين!`);
      setAddedLeadIds(prev => [...prev, lead.id]);
      return;
    }

    const finalArea = (lead.detailedAddress || lead.area || 'أخرى').trim();
    const gov = getResolvedGov({ ...lead, area: finalArea });
    const updated = [...googleLeads, { ...lead, governorate: gov, dateAdded: new Date().toLocaleDateString('ar-EG'), confirmed: false }];
    setGoogleLeads(updated);
    setAddedLeadIds(prev => [...prev, lead.id]);
  };

  const handleConfirmGoogleLead = async (lead: any) => {
    const finalArea = (lead.detailedAddress || lead.area || 'أخرى').trim();
    const gov = getResolvedGov({ ...lead, area: finalArea });
    
    const existsInReal = customers.find(c => c.phone === lead.phone || c.name.toLowerCase() === lead.name.toLowerCase());
    if (existsInReal) {
      const proceed = await confirmDialog(`العميل [${lead.name}] أو رقم هاتفه مسجل مسبقاً بقاعدة العملاء. هل تريد تأكيد إضافته وتجاهل التطابق؟`);
      if (!proceed) return;
    }

    // بدلاً من الحفظ المباشر، نقوم بملء نموذج الإضافة ليتمكن المستخدم من المراجعة
    setName((lead.name || '').trim());
    setPhone((lead.phone || '').trim());
    setSalesManager(''); // نترك مدير البيع فارغاً ليكتبه المندوب
    
    const areaExists = allAreas.includes(finalArea);
    if (areaExists) {
      setArea(finalArea);
      setCustomArea('');
    } else {
      setArea('أخرى');
      setCustomArea(finalArea);
    }
    
    setGovernorate(gov);
    setLocationLink(lead.locationLink || `https://maps.google.com/?q=${encodeURIComponent((lead.name || '').trim() + ' ' + finalArea)}`);
    setDetailedAddress(lead.detailedAddress || '');
    setType(lead.type || '');
    
    setPendingLeadToCustomer(lead);
    setActiveTab('list');
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    showToast(`يرجى مراجعة وتعديل بيانات العميل وإضافة (مدير البيع) قبل الحفظ النهائي.`);
  };

  const handleMoveToPotential = async (lead: any) => {
    const proceed = await confirmDialog(`هل وافق العميل [${lead.name}] على عمل طلب/أوردر ونقله إلى العملاء المحتملين؟`);
    if (!proceed) return;

    const cleanName = (lead.name || '').trim();
    const newPotLead = {
      ...lead,
      id: 'pot-' + String(lead.id).replace(/^lead-|^gmap-|^pot-/, '') + '-' + Math.floor(Math.random() * 1000),
      dateAdded: new Date().toLocaleDateString('ar-EG'),
      visited: false
    };

    setPotentialLeads(prev => [...prev, newPotLead]);

    // مسحه من قائمة المكتشفين
    setGoogleLeads(prev => prev.filter(g => g.id !== lead.id));
    const deleted = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
    if (!deleted.includes(lead.id)) {
      deleted.push(lead.id);
      localStorage.setItem('deleted_records_sys', JSON.stringify(deleted));
    }

    showToast(`✓ تم نقل العميل [${cleanName}] بنجاح إلى العملاء المحتملين!`);
  };

  const handleConfirmPotentialLead = async (lead: any) => {
    const finalArea = (lead.detailedAddress || lead.area || 'أخرى').trim();
    const gov = getResolvedGov({ ...lead, area: finalArea });
    
    const existsInReal = customers.find(c => c.phone === lead.phone || c.name.toLowerCase() === lead.name.toLowerCase());
    if (existsInReal) {
      const proceed = await confirmDialog(`العميل [${lead.name}] أو رقم هاتفه مسجل مسبقاً بقاعدة العملاء. هل تريد تأكيد إضافته وتجاهل التطابق؟`);
      if (!proceed) return;
    }

    setName((lead.name || '').trim());
    setPhone((lead.phone || '').trim());
    setSalesManager('');
    
    const areaExists = allAreas.includes(finalArea);
    if (areaExists) {
      setArea(finalArea);
      setCustomArea('');
    } else {
      setArea('أخرى');
      setCustomArea(finalArea);
    }
    
    setGovernorate(gov);
    setLocationLink(lead.locationLink || `https://maps.google.com/?q=${encodeURIComponent((lead.name || '').trim() + ' ' + finalArea)}`);
    setDetailedAddress(lead.detailedAddress || '');
    setType(lead.type || '');
    
    setPendingPotentialLead(lead);
    setActiveTab('list');
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    showToast(`يرجى مراجعة وتعديل بيانات العميل وإضافة (مدير البيع) قبل الحفظ النهائي.`);
  };

  const handleDeletePotentialLead = (leadId: string) => {
    if (!isUserAdmin) { showToast('⚠️ الحذف متاح فقط للمدير ونائب المدير.'); return; }
    setPotentialLeads(prev => prev.filter(g => g.id !== leadId));
    const deleted = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
    if (!deleted.includes(leadId)) {
      deleted.push(leadId);
      localStorage.setItem('deleted_records_sys', JSON.stringify(deleted));
    }
  };

  const handleDeleteGoogleLead = (leadId: string) => {
    if (!isUserAdmin) { showToast('⚠️ الحذف متاح فقط للمدير ونائب المدير.'); return; }
    setGoogleLeads(prev => prev.filter(g => g.id !== leadId));
    const deleted = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
    if (!deleted.includes(leadId)) {
      deleted.push(leadId);
      localStorage.setItem('deleted_records_sys', JSON.stringify(deleted));
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalArea = area === 'أخرى' ? customArea.trim() : area.trim();
    if (!finalArea) {
      showToast('⚠️ يرجى تحديد أو كتابة المنطقة السكنية.');
      return;
    }

    const finalGov = governorate.trim() || getResolvedGov({ area: finalArea });

    const cleanPhone = phone.trim();
    const cleanName = name.trim().toLowerCase();
    const cleanLocation = locationLink.trim().toLowerCase();

    if (!editingCustomer && cleanPhone) {
      const duplicates = customers.filter(c => 
        (c.phone === cleanPhone) || 
        (c.name.toLowerCase() === cleanName) || 
        (cleanLocation && c.locationLink && c.locationLink.toLowerCase() === cleanLocation)
      );
      if (duplicates.length > 0) {
        const dupReasons = [];
        if (duplicates.some(c => c.phone === cleanPhone)) dupReasons.push('رقم الهاتف');
        if (duplicates.some(c => c.name.toLowerCase() === cleanName)) dupReasons.push('الاسم');
        if (cleanLocation && duplicates.some(c => c.locationLink && c.locationLink.toLowerCase() === cleanLocation)) dupReasons.push('رابط الموقع (الخريطة)');
        
        const proceed = await confirmDialog(`⚠️ تنبيه: وجدنا تطابق مع عميل مسجل مسبقاً في (${dupReasons.join(' و ')}).\n\nهل أنت متأكد من الإضافة وتجاهل التطابق لمنع التكرار الوهمي وبناء قاعدة صحيحة؟`, true);
        if (!proceed) return;
      }
    }

    if (editingCustomer) {
      onEditCustomer({
        ...editingCustomer,
        name: name.trim(),
        phone: phone.trim(),
        area: finalArea,
        governorate: finalGov,
        salesManager: salesManager.trim(),
        locationLink: locationLink.trim() || `https://maps.google.com/?q=${encodeURIComponent(name.trim() + ' ' + finalArea)}`,
        detailedAddress: detailedAddress.trim(),
        type: type.trim()
      });
      showToast('✓ تم تعديل بيانات العميل بنجاح.');
    } else {
      onAddCustomer({
        name: name.trim(),
        phone: phone.trim(),
        area: finalArea,
        governorate: finalGov,
        salesManager: salesManager.trim(),
        locationLink: locationLink.trim() || `https://maps.google.com/?q=${encodeURIComponent(name.trim() + ' ' + finalArea)}`,
        detailedAddress: detailedAddress.trim(),
        type: type.trim()
      });
      
      // مسح العميل من قائمة "المكتشفين" إذا كان منقولاً منها
      if (pendingLeadToCustomer) {
        handleDeleteGoogleLead(pendingLeadToCustomer.id);
      }
      // مسح العميل من قائمة "المحتملين" إذا كان منقولاً منها
      if (pendingPotentialLead) {
        handleDeletePotentialLead(pendingPotentialLead.id);
      }
      showToast('✓ تم إضافة العميل الجديد بنجاح.');
    }

    setName('');
    setPhone('');
    setArea('');
    setCustomArea('');
    setGovernorate('');
    setSalesManager('');
    setLocationLink('');
    setDetailedAddress('');
    setType('');
    setGeoStatusMsg('');
    setShowAddForm(false);
    setEditingCustomer(null);
    setPendingLeadToCustomer(null);
    setPendingPotentialLead(null);
  };

  // Capture Geolocation coords and turn them into a google maps link automatically!
  const handleLoadCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatusMsg('متصفحك لا يدعم تحديد الموقع المستقل.');
      return;
    }

    setLoadingGeo(true);
    setGeoStatusMsg('جاري الحصول على إحداثيات GPS...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setLocationLink(link);
        setGeoStatusMsg('تم جلب موقعك بنجاح ونقله لرابط الخرائط!');
        setLoadingGeo(false);
      },
      (error) => {
        setLoadingGeo(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoStatusMsg('تم رفض طلب تحديد الموقع من فضلك اسمح بالوصول في متصفحك.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoStatusMsg('موقع الـ GPS غير متاح حالياً.');
            break;
          case error.TIMEOUT:
            setGeoStatusMsg('انتهت مهلة جلب الموقع من القمر الصناعي.');
            break;
          default:
            setGeoStatusMsg('حدث خطأ غير متوقع أثناء تحديد الموقع.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const exportCustomersDirectoryAsPDF = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-1000px';
    iframe.style.left = '-1000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    let filterSummary = 'عرض دليل ومستند العملاء بالكامل';
    if (searchQuery.trim()) filterSummary += ` - تصفية البحث بالعبارة: "${searchQuery}"`;
    if (govSearchQuery.trim()) filterSummary += ` - المحافظة: "${govSearchQuery}"`;

    doc.open();
    doc.write(`
      <html dir="rtl" lang="ar">
        <head>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
              body { margin: 0; }
            }
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; line-height: 1.5; padding: 20px; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 3px double #1e3a8a; padding-bottom: 12px; }
            .header h1 { color: #1e3a8a; margin: 0 0 5px 0; font-size: 24px; font-weight: 900; }
            .header p { margin: 0; color: #64748b; font-size: 13px; font-weight: bold; }
            
            .meta-box { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 11px; color: #334155; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
            
            h2 { font-size: 13px; color: #1e3a8a; margin: 25px 0 10px 0; border-right: 4px solid #dd6b20; padding-right: 8px; font-weight: bold; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; }
            th { background: #f1f5f9; color: #334155; font-weight: 900; }
            
            .footer-notes { margin-top: 50px; border-top: 1px solid #cbd5e1; padding-top: 15px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>دليل عملاء التوزيع والمبيعات الميدانية</h1>
            <p>سمن وزيت سوفانا الفاخر - الاخوه EAGS لخدمات التوزيع</p>
          </div>
          
          <div class="meta-box">
            <div>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}</div>
            <div>تصفية القائمة: <span style="color:#dd6b20;">${filterSummary}</span></div>
          </div>
          
          <h2>قائمة العملاء المعتمدة للفترة (${filteredCustomers.length} عميل)</h2>
          <table>
            <thead>
              <tr>
                <th width="40">م</th>
                <th>اسم العميل</th>
                <th>رقم الهاتف للتواصل</th>
                <th>منطقة التوزيع</th>
                <th>المحافظة المسجلة</th>
                <th>موقع العميل / خرائط جوجل</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCustomers.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">لا توجد نتائج عملاء مطابقة للتصفية الحالية.</td></tr>' : 
                filteredCustomers.map((customer, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><b>${customer.name}</b></td>
                    <td><b style="font-family: monospace;">${customer.phone}</b></td>
                    <td>${customer.area}</td>
                    <td>${getResolvedGov(customer)}</td>
                    <td><span style="font-size: 10px; color: #475569;">${customer.locationLink ? 'متوفر (الرابط مسجل)' : 'غير متوفر'}</span></td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
          
          <div class="footer-notes">
            <div>إعداد مندوب مبيعات المنطقة: ............................</div>
            <div>تاريخ الطباعة والاعتماد: ............................</div>
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

  // Filtering
  const filteredCustomers = React.useMemo(() => {
    let result = customers.filter(c => {
      // Check workArea restriction
      const customerGov = getResolvedGov(c);
      const customerArea = (c.area || '').trim();
      if (currentUser?.role !== 'owner' && !isLeadInWorkArea(customerGov, customerArea, currentUser?.workArea)) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      const gq = govSearchQuery.trim().toLowerCase();
      
      // Check general query
      const matchesGeneral = !q || (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.area.toLowerCase().includes(q) ||
        (c.salesManager || '').toLowerCase().includes(q) ||
        (c.governorate || getResolvedGov(c)).toLowerCase().includes(q) ||
        (c.type || '').toLowerCase().includes(q)
      );

      // Check governorate query starting with letter or matching entirely
      const matchesGov = !gq || customerGov.toLowerCase().includes(gq);

      return matchesGeneral && matchesGov;
    });
    
    if (sortBy === 'alpha') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'ar-EG'));
    } else if (sortBy === 'purchases') {
      result.sort((a, b) => {
        const aPurchases = (a as any).totalSpent || a.purchasesCount || 0;
        const bPurchases = (b as any).totalSpent || b.purchasesCount || 0;
        return bPurchases - aPurchases;
      });
    }
    return result;
  }, [customers, searchQuery, govSearchQuery, sortBy]);

  React.useEffect(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      const currentPerm = activeTab === 'list' ? 'customers_list' : 'customers_maps_finder';
      if (!permittedSubTabs.includes(currentPerm)) {
        if (permittedSubTabs.includes('customers_list')) setActiveTab('list');
        else if (permittedSubTabs.includes('customers_maps_finder')) setActiveTab('google_leads');
      }
    }
  }, [permittedSubTabs, activeTab]);

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 text-right animate-fade-in" dir="rtl" id="customers-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-[60] shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-200" />
          <h1 className="text-xl font-bold">قاعدة بيانات العملاء</h1>
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
        
        {/* Sub-tab switcher */}
        {(() => {
          const showList = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('customers_list');
          const showMaps = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('customers_maps_finder');
          return (
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner gap-1" id="customers-subtabs">
              {showList && (
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className={`flex-1 text-center py-2.5 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xl ${
                    activeTab === 'list' ? 'bg-[#FFFFFF] text-[#DD6B20] shadow-xs border border-slate-200' : 'text-[#6B7280] bg-transparent hover:text-[#1A365D]'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 font-bold" />
                  <span>العملاء ({customers.length})</span>
                </button>
              )}
              
              {showMaps && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('google_leads')}
                    className={`flex-1 text-center py-2.5 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xl ${
                      activeTab === 'google_leads' ? 'bg-[#FFFFFF] text-[#DD6B20] shadow-xs border border-slate-200' : 'text-[#6B7280] bg-transparent hover:text-[#1A365D]'
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 ${activeGoogleLeads.length === 0 ? 'hidden' : ''}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 bg-red-500 ${activeGoogleLeads.length === 0 ? 'hidden' : ''}`}></span>
                    </span>
                    <span>عملاء مكتشفون ({activeGoogleLeads.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('potential_leads')}
                    className={`flex-1 text-center py-2.5 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xl ${
                      activeTab === 'potential_leads' ? 'bg-[#FFFFFF] text-[#DD6B20] shadow-xs border border-slate-200' : 'text-[#6B7280] bg-transparent hover:text-[#1A365D]'
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 ${activePotentialLeads.length === 0 ? 'hidden' : ''}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 bg-orange-500 ${activePotentialLeads.length === 0 ? 'hidden' : ''}`}></span>
                    </span>
                    <span>عملاء محتملون ({activePotentialLeads.length})</span>
                  </button>
                </>
              )}
            </div>
          );
        })()}

        {/* 1. Current Customer List Tab */}
        {activeTab === 'list' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Registration Form */}
            {!showAddForm ? (
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(true);
                  setArea('');
                  setCustomArea('');
                  setDetailedAddress('');
                }}
                className="w-full bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent active:scale-95 text-white font-bold py-3.5 px-5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Plus className="h-5 w-5 text-emerald-300" />
                <span>إضافة عميل جديد لقسم التوزيع</span>
              </button>
            ) : (
              <form onSubmit={handleAddSubmit} className="bg-sky-50 p-5 rounded-2xl border border-sky-100 shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-[#1A365D] text-base flex items-center gap-1.5">
                    <Plus className="h-5 w-5 text-[#2B6CB0]" />
                    إضافة عميل جديد لقسم التوزيع
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setPendingLeadToCustomer(null);
                      setEditingCustomer(null);
                    }}
                    className="text-gray-400 hover:text-[#2B6CB0] text-xs font-bold bg-[#F7FAFC] p-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="inline-block bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">اسم العميل</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: سوبرماركت الهدى"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="inline-block bg-sky-100 text-sky-950 border border-sky-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">الهاتف</label>
                      <input
                        type="tel"
                        required
                        placeholder="مثال: 01011223344"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-center text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="inline-block bg-purple-100 text-purple-950 border border-purple-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">مدير البيع (مخفي)</label>
                      <input
                        type="text"
                        placeholder="مثال: مسؤول المنطقة"
                        value={salesManager}
                        onChange={(e) => setSalesManager(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="inline-block bg-amber-100 text-amber-950 border border-amber-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">النشاط التجاري</label>
                      <input
                        type="text"
                        list="client-types-list"
                        placeholder="اختر أو اكتب النشاط التجاري"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 font-bold text-[#1A365D]"
                      />
                      <datalist id="client-types-list">
                        <option value="سوبر ماركت" />
                        <option value="بقالة" />
                        <option value="هايبر ماركت" />
                        <option value="كشك" />
                        <option value="جملة" />
                        <option value="نصف جملة" />
                        <option value="مطعم" />
                        <option value="كافيه" />
                        <option value="عطارة" />
                        <option value="حلواني" />
                        <option value="أخرى" />
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="inline-block bg-teal-100 text-teal-950 border border-teal-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">المحافظة</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          list="egypt-governorates-list"
                          placeholder="اختر أو اكتب اسم المحافظة (مثال: الشرقية)"
                          value={governorate}
                          onChange={(e) => setGovernorate(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-center text-[#1A365D] focus:ring-2 focus:ring-indigo-500"
                        />
                        <datalist id="egypt-governorates-list">
                          {finalGovernorates.map(gov => (
                            <option key={gov} value={gov}>{gov}</option>
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="relative">
                      <label className="inline-block bg-amber-100 text-amber-950 border border-amber-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">المنطقة</label>
                      <input
                        type="text"
                        required
                        placeholder="ابحث بالحروف أو اكتب اسم المنطقة..."
                        value={area}
                        onChange={(e) => {
                          const val = e.target.value;
                          setArea(val);
                          setShowAreaDropdown(true);
                          const matchedGov = settings.workAreas?.find(w => w.area.toLowerCase() === val.toLowerCase())?.governorate;
                          if (matchedGov && !governorate.trim()) {
                            setGovernorate(matchedGov);
                          }
                        }}
                        onFocus={() => setShowAreaDropdown(true)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-right text-[#1A365D] focus:ring-2 focus:ring-indigo-500 font-sans"
                      />
                      {showAreaDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowAreaDropdown(false)} />
                          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg text-right text-xs" style={{ right: 0 }}>
                            {(() => {
                              const query = (area || '').trim().toLowerCase();
                              const currentGov = (governorate || '').trim().toLowerCase();

                              // البناء الذكي: مناطق الشيت أولاً، ثم مناطق العملاء
                              let matchedAreas: string[];

                              if (sheetAreas.length > 0) {
                                // الشيت يحتوي على بيانات — نعتمد عليه فقط
                                matchedAreas = sheetAreas.filter(a => {
                                  if (!currentGov) return true;
                                  const w = (settings.workAreas || []).find(w => w.area === a);
                                  return w ? w.governorate.trim().toLowerCase() === currentGov : false;
                                });
                                // نضيف مناطق العملاء الحاليين التي ليست في الشيت
                                registeredCustomerAreas.forEach(a => {
                                  if (!matchedAreas.includes(a)) {
                                    const gov = (customers.find(c => c.area === a)?.governorate || getGovernorateForArea(a)).toLowerCase();
                                    if (!currentGov || gov === currentGov) matchedAreas.push(a);
                                  }
                                });
                              } else {
                                // لا يوجد شيت — نعود للسلوك القديم مع EGYPT_CITIES
                                matchedAreas = allAreas.filter(a => {
                                  if (!currentGov) return true;
                                  const workAreaMatch = (settings.workAreas || []).some(w => w.area === a && w.governorate.trim().toLowerCase() === currentGov);
                                  if (workAreaMatch) return true;
                                  const customerMatch = customers.some(c => c.area === a && (c.governorate || getGovernorateForArea(c.area)).trim().toLowerCase() === currentGov);
                                  if (customerMatch) return true;
                                  if (getGovernorateForArea(a).trim().toLowerCase() === currentGov) return true;
                                  return false;
                                });
                                if (currentGov) {
                                  const govKey = Object.keys(EGYPT_CITIES).find(k => k.toLowerCase() === currentGov);
                                  if (govKey && EGYPT_CITIES[govKey]) {
                                    EGYPT_CITIES[govKey].forEach(city => { if (!matchedAreas.includes(city)) matchedAreas.push(city); });
                                  }
                                }
                              }

                              const filtered = matchedAreas.filter(a =>
                                !query || a.toLowerCase().includes(query) ||
                                (settings.workAreas?.find(w => w.area === a)?.governorate || '').toLowerCase().includes(query)
                              );

                              if (filtered.length === 0) {
                                return (
                                  <div
                                    onClick={() => setShowAreaDropdown(false)}
                                    className="p-2 hover:bg-slate-50 cursor-pointer text-gray-500 font-bold"
                                  >
                                    استخدم القيمة الجديدة: "{area}"
                                  </div>
                                );
                              }

                              return filtered.map(a => {
                                const gov = settings.workAreas?.find(w => w.area === a)?.governorate || getGovernorateForArea(a);
                                const isFromSheet = sheetAreas.includes(a);
                                return (
                                  <div
                                    key={a}
                                    onClick={() => {
                                      setArea(a);
                                      if (gov && !governorate.trim()) setGovernorate(gov);
                                      setShowAreaDropdown(false);
                                    }}
                                    className="p-2 hover:bg-indigo-50 border-b border-slate-100 last:border-none cursor-pointer flex justify-between font-bold text-slate-800"
                                  >
                                    <span className={`font-medium text-[10px] ${isFromSheet ? 'text-emerald-600' : 'text-gray-400'}`}>
                                      {isFromSheet ? '📋 ' : ''}{gov || 'غير محدد'}
                                    </span>
                                    <span>{a}</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="inline-block bg-slate-100 text-slate-800 border border-slate-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">العنوان التفصيلي</label>
                      <input
                        type="text"
                        placeholder="مثال: بجوار صيدلية كذا، شارع كذا..."
                        value={detailedAddress}
                        onChange={(e) => setDetailedAddress(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs text-right font-semibold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                    <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
                      <label className="inline-block bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-black px-2.5 py-1 rounded-md shadow-sm">رابط الخرائط</label>
                      <button
                        type="button"
                        onClick={handleLoadCurrentLocation}
                        disabled={loadingGeo}
                        className="text-xs font-bold text-[#1A365D] bg-indigo-50 hover:bg-indigo-100 py-1 px-2.5 rounded-lg border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{loadingGeo ? 'تحديد إحداثيات...' : 'تحديد بموقعي الحالي'}</span>
                      </button>
                    </div>
                    <input
                      type="url"
                      placeholder="مثال: https://maps.google.com/?q=..."
                      value={locationLink}
                      onChange={(e) => setLocationLink(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs text-left font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                    {geoStatusMsg && (
                      <p className="text-[10.5px] font-bold text-[#1A365D] bg-indigo-50/50 p-2 rounded-lg mt-1 border border-indigo-100">
                        {geoStatusMsg}
                      </p>
                    )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#1A365D] text-white border-transparent text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-[#1A365D] text-white border-transparent mt-1"
                >
                  <span>{editingCustomer ? 'حفظ تعديلات العميل' : 'حفظ العميل الجديد'}</span>
                </button>
              </form>
            )}

            {/* Search & List */}
            <div className="bg-sky-50 p-5 rounded-2xl border border-sky-100 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col gap-3 border-b border-sky-200 pb-3">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="font-bold text-[#1A365D] text-base">دليل العملاء ({filteredCustomers.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === 'none') setSortBy('alpha');
                        else if (sortBy === 'alpha') setSortBy('purchases');
                        else setSortBy('none');
                      }}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] py-2 px-3 rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer border-none"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      <span>{sortBy === 'none' ? 'ترتيب' : sortBy === 'alpha' ? 'أبجدياً' : 'الأكثر شراءً'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const exportData = filteredCustomers.map(c => ({ 
                          'المعرف': c.id, 
                          'المحافظة': getResolvedGov(c), 
                          'المنطقة': c.area, 
                          'اسم العميل': c.name, 
                          'رقم الهاتف': c.phone, 
                          'مدير البيع': c.salesManager || '', 
                          'النشاط': c.type || '',
                          'العنوان': c.detailedAddress || '', 
                          'رابط جوجل ماب': c.locationLink 
                        }));
                        exportToCSV(exportData, `العملاء_الفعليين_${new Date().toLocaleDateString('ar-EG')}.csv`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-[#ffffff] font-extrabold text-[11px] py-2 px-3 rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer border-none"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>إكسيل (CSV)</span>
                    </button>
                    <button
                      type="button"
                      onClick={exportCustomersDirectoryAsPDF}
                      className="bg-[#1A365D] hover:bg-[#2B6CB0] text-[#ffffff] font-extrabold text-[11px] py-2 px-3 rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer border-none"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>طباعة الدليل (PDF)</span>
                    </button>
                  </div>
                </div>
                
                {/* Two modern side-by-side search inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                  <div className="relative leading-none">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400" />
                    <input
                      type="text"
                      list="search-egypt-governorates-list"
                      placeholder="تصفية بالمحافظة (الشرقية، القاهرة...)"
                      value={govSearchQuery}
                      onChange={(e) => setGovSearchQuery(e.target.value)}
                      className="w-full bg-[#F7FAFC] pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 text-right font-bold text-[#1A365D]"
                    />
                    <datalist id="search-egypt-governorates-list">
                      {finalGovernorates.map(gov => (
                        <option key={gov} value={gov}>{gov}</option>
                      ))}
                    </datalist>
                  </div>

                  <div className="relative leading-none">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400" />
                    <input
                      type="text"
                      placeholder="بحث بالاسم، الهاتف أو المنطقة..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#F7FAFC] pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 text-right font-bold text-[#1A365D]"
                    />
                  </div>
                </div>
              </div>

               <div className="flex flex-col gap-3.5">
                {filteredCustomers.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">لا توجد نتائج بحث مطابقة.</p>
                ) : (
                  filteredCustomers.map(customer => {
                    const isExpanded = !!expandedRealCustomers[customer.id];
                    const purchasesCount = customer.purchasesCount || 0;
                    const isNewCustomer = purchasesCount === 0;
                    
                    return (
                      <div key={customer.id} className={`border rounded-xl overflow-hidden bg-[#FFFFFF] shadow-xs transition-all flex flex-col ${isNewCustomer ? 'border-amber-300 hover:border-amber-400' : 'border-slate-150 hover:border-indigo-200'}`}>
                        {/* Header (Clickable to expand/collapse) */}
                        <div
                          onClick={() => setExpandedRealCustomers(prev => prev[customer.id] ? {} : { [customer.id]: true })}
                          className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${isNewCustomer ? 'bg-amber-50/40 hover:bg-amber-50/80' : 'bg-[#F7FAFC]/60 hover:bg-[#F7FAFC]'}`}
                        >
                          <div className="flex items-center gap-2 text-sm select-none flex-wrap">
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-colors ${isExpanded ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-slate-350'}`}></span>
                            <span className="font-extrabold text-[#1A365D] text-sm sm:text-base">{customer.name}</span>
                            <span className="text-[10.5px] bg-slate-200/85 text-[#1A365D] font-extrabold px-2 py-0.5 rounded-md">
                              {customer.area}
                            </span>
                            <span className="text-[10.5px] bg-sky-100 text-sky-850 font-extrabold px-2 py-0.5 rounded-md border border-sky-200">
                              {getResolvedGov(customer)}
                            </span>
                            {customer.type && (
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${getLeadBadgeTheme(customer.type)}`}>
                                النشاط: {customer.type}
                              </span>
                            )}
                            {isNewCustomer ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                ✨ جديد (مكتشف)
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                🤝 عميل فعلي
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 text-xs font-bold text-[#2B6CB0]">
                            <span>{isExpanded ? 'إخفاء التفاصيل ▲' : 'عرض التفاصيل ▼'}</span>
                          </div>
                        </div>

                        {/* Collapsible Details Body */}
                        {isExpanded && (
                          <div className="p-4 border-t border-slate-100 bg-[#FFFFFF] flex flex-col gap-4 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-[#1A365D]">
                              <div className="flex items-center gap-2 font-semibold">
                                <Phone className="h-4 w-4 text-[#1A365D] shrink-0" />
                                <span>رقم الهاتف:</span>
                                <SecurePhoneDisplay phone={customer.phone} enableWhatsApp={true} />
                              </div>
                              <div className="flex items-center gap-1.5 font-semibold flex-wrap">
                                <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />
                                <span>المنطقة والمحافظة:</span>
                                <span className="font-extrabold text-[#DD6B20]">
                                  {customer.area}
                                </span>
                                <span className="text-slate-500 font-bold">
                                  (تتبع محافظة {customer.governorate || getGovernorateForArea(customer.area)})
                                </span>
                                {customer.detailedAddress && (
                                  <div className="w-full mt-1 bg-slate-50 border border-slate-150 p-2 rounded-lg text-xs font-bold text-slate-700">
                                    📍 العنوان: {customer.detailedAddress}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions bar: call, whatsapp, location, delete */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 mt-1">
                              {/* Direct Calling & Messaging */}
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <a
                                  href={`tel:${customer.phone}`}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-[#F7FAFC] hover:bg-blue-100/85 text-blue-700 border border-blue-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
                                  title="اتصال مباشر بالهاتف"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>اتصال هاتفي</span>
                                </a>

                                <a
                              href={formatWhatsAppLink(customer.phone)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/85 text-[#DD6B20] border border-emerald-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
                                  title="مراسلة سريعة على الواتساب"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  <span>واتساب مباشر</span>
                                </a>
                                
                                <button
                                  onClick={() => handleGenerateAndSendWA(customer)}
                                  disabled={waLoadingId === customer.id}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100/85 text-[#1A365D] border border-indigo-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center disabled:bg-[#F7FAFC] disabled:text-gray-400"
                                  title="صياغة وإرسال رسالة ذكية"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>{waLoadingId === customer.id ? 'جاري..' : 'رسالة ذكية'}</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.area + ' ' + customer.name)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                  title="المسار من موقعي الحالي"
                                >
                                  <MapPin className="h-3.5 w-3.5" />
                                  <span>موقعي الحالي</span>
                                </a>
                                {customer.locationLink && (
                                  <a
                                    href={customer.locationLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-[#DD6B20] border border-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                    title="الموقع على خرائط جوجل"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>عرض بالخريطة</span>
                                  </a>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingCustomer(customer);
                                    setName(customer.name);
                                    setPhone(customer.phone);
                                    setSalesManager(customer.salesManager || '');
                                    setDetailedAddress(customer.detailedAddress || '');
                                    setType(customer.type || '');
                                    const areaExists = allAreas.includes(customer.area);
                                    if (areaExists) {
                                      setArea(customer.area);
                                      setCustomArea('');
                                    } else {
                                      setArea('أخرى');
                                      setCustomArea(customer.area);
                                    }
                                    const matchedGovForCustomer = settings.workAreas?.find(w => w.area === customer.area)?.governorate;
                                    setGovernorate(customer.governorate || matchedGovForCustomer || getResolvedGov(customer));
                                    setLocationLink(customer.locationLink || '');
                                    setShowAddForm(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="p-1.5 px-3 text-[#2B6CB0] hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="تعديل العميل"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                  <span>تعديل</span>
                                </button>
                                <button
                                  onClick={() => {
                                    onDeleteCustomer(customer.id);
                                  }}
                                  className="p-1.5 px-3 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="حذف العميل"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>حذف</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. OSM Customer Lead Finder */}
        {false && activeTab === 'maps_finder' && (
          <div className="flex flex-col gap-4 animate-fade-in" id="google-maps-finder">
            
            {/* Search inputs */}
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="border-b border-slate-100 pb-2 flex items-center gap-2">
                <Compass className="h-5 w-5 text-[#1A365D] animate-spin-slow" />
                <h3 className="font-bold text-slate-850 text-base">منقّب الخرائط (جوجل إيرث الفضائي)</h3>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {/* Lead classification details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="inline-block bg-sky-100 text-sky-950 border border-sky-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">الأنشطة التجارية المستهدفة (يمكنك اختيار أكثر من نشاط)</label>
                    <div className="flex flex-wrap gap-2">
                      {['سوبر ماركت', 'ميني ماركت', 'هايبر ماركت', 'بقالة تموينية', 'تجارة جملة', 'نصف جملة', 'توزيع أغذية', 'حلواني ومخبز', 'عطارة', 'مطاعم'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            let newTypes = [...storeTypes];
                            if (newTypes.includes(t)) {
                              newTypes = newTypes.filter(x => x !== t);
                              if (newTypes.length === 0) newTypes = ['سوبر ماركت'];
                            } else {
                              newTypes.push(t);
                            }
                            setStoreTypes(newTypes);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${storeTypes.includes(t) ? 'bg-[#DD6B20] text-white shadow-sm' : 'bg-[#F7FAFC] text-[#1A365D] border border-slate-200 hover:bg-slate-100'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="inline-block bg-emerald-100 text-emerald-950 border border-emerald-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">نطاق البحث</label>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-[#1A365D] text-right"
                    >
                      <option value={10}>بحث سريع (10 محلات لكل نشاط)</option>
                      <option value={15}>بحث متوسط (15 محل لكل نشاط)</option>
                      <option value={20}>بحث شامل (20 محل لكل نشاط - الحد الأقصى)</option>
                      <option value={50}>بحث عميق جداً (سحب أقصى عدد ممكن من النتائج)</option>
                    </select>
                  </div>
                </div>

                <GmpMapEngine 
                  storeType={storeTypes} 
                  batchSize={batchSize} 
                  onResults={setMapsResults} 
                  isSearching={isSearchingMaps} 
                  setIsSearching={setIsSearchingMaps}
                  apiKey={googleMapsApiKey || settings.googleMapsApiKey?.trim() || localStorage.getItem('GMP_API_KEY_FALLBACK')?.trim() || ''}
                  results={mapsResults}
                />
              </div>
            </div>

            {!isSearchingMaps && mapsResults.length > 0 && (
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col gap-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div className="flex flex-col">
                    <h4 className="font-bold text-[#1A365D] text-sm">المحلات والعملاء المكتشفين ({mapsResults.length})</h4>
                    <p className="text-[10.5px] text-slate-450 font-bold mt-0.5">سجل المحل بمسودة "العملاء المقترحين" لمتابعته والاتصال به.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[10px] font-bold text-[#1A365D] cursor-pointer ml-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                      <input
                        type="checkbox"
                        checked={mapsResults.length > 0 && selectedMapResults.length === mapsResults.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMapResults(mapsResults.map(r => r.id));
                          else setSelectedMapResults([]);
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      تحديد الكل
                    </label>
                    {selectedMapResults.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAddSelectedMapLeads}
                        className="text-[10px] bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <Plus className="h-3 w-3" />
                        حفظ المحدد ({selectedMapResults.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleBulkAddMapLeads}
                      className="text-[10px] bg-[#1A365D] text-white hover:bg-indigo-900 font-extrabold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <Plus className="h-3 w-3" /> حفظ الكل دفعة واحدة
                    </button>
                    <span className="hidden sm:inline-block text-[10px] bg-emerald-50 text-[#DD6B20] font-extrabold px-2 py-0.5 rounded border border-emerald-150">
                      نشط بخريطة جوجل
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  {mapsResults.map((lead) => {
                    const addedLead = googleLeads.find(g => g.name.toLowerCase() === lead.name.toLowerCase() || g.phone === lead.phone || addedLeadIds.includes(lead.id));
                    const isAdded = !!addedLead;
                    const isLeadExpanded = !!expandedGoogleLeads[lead.id];
                    const isNoPhone = hasNoPhone(lead.phone);
                    const isVisited = addedLead?.visited;
                    const themeClass = isVisited 
                      ? 'bg-teal-50/80 border-teal-400 shadow-sm ring-1 ring-teal-300' 
                      : getLeadCardTheme(lead.type);
                    const badgeClass = getLeadBadgeTheme(lead.type);

                    return (
                      <div key={lead.id} className={`border rounded-xl overflow-hidden transition-all flex flex-col ${isVisited ? 'bg-teal-50/80 border-teal-400 shadow-sm' : isNoPhone ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300 shadow-sm' : themeClass}`}>
                        
                        {/* Interactive Header for Toggle */}
                        <div 
                          onClick={() => setExpandedGoogleLeads(prev => prev[lead.id] ? {} : { [lead.id]: true })}
                          className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${isVisited ? 'bg-teal-50/30 hover:bg-teal-50/60' : isNoPhone ? 'bg-rose-50/30 hover:bg-rose-50/60' : 'bg-[#F7FAFC]/60 hover:bg-[#F7FAFC]'}`}
                        >
                          <div className="flex flex-col gap-1.5 text-sm select-none">
                            <span className={`font-extrabold text-base flex items-center gap-1.5 leading-snug ${isNoPhone && !isVisited ? 'text-rose-700' : 'text-slate-850'}`}>
                              <input
                                type="checkbox"
                                checked={selectedMapResults.includes(lead.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (e.target.checked) setSelectedMapResults(prev => [...prev, lead.id]);
                                  else setSelectedMapResults(prev => prev.filter(id => id !== lead.id));
                                }}
                                onClick={e => e.stopPropagation()}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mr-1"
                              />
                              <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-all ${isLeadExpanded ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-slate-350'}`}></span>
                              {isVisited && <span className="text-teal-600 text-[10px]" title="تمت الزيارة">✅</span>}
                              {isNoPhone && !isVisited && <PhoneOff className="h-4 w-4 text-rose-500 shrink-0" />}
                              {lead.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-extrabold py-0.5 px-2 rounded border self-start ${badgeClass}`}>
                                تصنيف: {lead.type}
                              </span>
                              {lead.rating && (
                                <div className="flex items-center gap-1 text-[10.5px] text-amber-600 font-black bg-amber-50 py-0.5 px-2 rounded-lg border border-amber-200/60 leading-none">
                                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                  <span>{lead.rating}</span>
                                  <span className="text-gray-400 font-normal">({lead.reviewsCount} تقييم)</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-black text-xs text-[#2B6CB0]">
                            <span>{isLeadExpanded ? 'إخفاء ▲' : 'عرض التفاصيل ▼'}</span>
                          </div>
                        </div>

                        {/* Collapsible details body */}
                        {isLeadExpanded && (
                          <div className="p-4 border-t border-slate-100 bg-[#FFFFFF] flex flex-col gap-3.5 animate-fade-in text-xs transition-all">
                            {/* Location link and header row inside expanded details */}
                            <div className="flex justify-between items-center bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150">
                              <span className="text-xs font-bold text-slate-650">موقع العميل على الخرائط:</span>
                              <div className="flex gap-2">
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.detailedAddress || lead.name)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 px-3 text-[11px] text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg font-black shrink-0 flex items-center gap-1 transition-all"
                                  title="رسم مسار من موقعي الحالي"
                                >
                                  <MapPin className="h-3.5 w-3.5" />
                                  <span>موقعي الحالي</span>
                                </a>
                                <a
                                  href={lead.locationLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 px-3 text-[11px] text-[#1A365D] hover:text-indigo-850 bg-[#FFFFFF] hover:bg-[#F7FAFC] border border-slate-200 rounded-lg font-black shrink-0 flex items-center gap-1 transition-all"
                                  title="افتح موقع العميل الفعلي على خرائط جوجل"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  <span>فتح خريطة جوجل</span>
                                </a>
                              </div>
                            </div>

                            {/* Contacts & Direct Action Buttons */}
                            <div className="bg-[#F7FAFC]/50 border border-slate-150 p-3 rounded-xl flex flex-col gap-3">
                              <div className="flex flex-col gap-1 text-xs">
                                <span className={`font-bold flex items-center gap-1 ${isNoPhone ? 'text-rose-600' : 'text-slate-650'}`}>
                                  {isNoPhone ? <PhoneOff className="h-3.5 w-3.5 text-rose-500" /> : <Phone className="h-3.5 w-3.5 text-[#1A365D]" />}
                                  رقم التواصل الهاتف: {isNoPhone ? <span className="font-bold">{lead.phone?.includes('انتظار') ? 'في انتظار الاستخراج ⏳' : 'غير متوفر'}</span> : <a href={`tel:${lead.phone}`} className="hover:underline font-mono font-bold text-[#1A365D]">{lead.phone}</a>}
                                </span>
                                <span className="font-bold text-slate-650 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                  العنوان بالتفصيل: <strong className="text-[#1A365D] font-extrabold">{lead.detailedAddress || lead.area}</strong>
                                </span>
                              </div>

                              {/* Quick Action triggers: Direct Call, WhatsApp message, AI Generator */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-150/60 pt-3">
                                {/* Call Button */}
                                {isNoPhone ? (
                                  <button disabled className="px-3.5 py-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 text-center cursor-not-allowed">
                                    <PhoneOff className="h-3.5 w-3.5" />
                                    <span>لا يوجد رقم</span>
                                  </button>
                                ) : (
                                  <a
                                    href={`tel:${lead.phone}`}
                                    className="px-3.5 py-2 bg-[#F7FAFC] hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                    title="اتصال هاتفي سريع ومباشر"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>اتصل بالعميل</span>
                                  </a>
                                )}

                                {/* Visited Action */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isAdded && addedLead) {
                                      setGoogleLeads(prev => prev.map(l => l.id === addedLead.id ? { ...l, visited: !l.visited } : l));
                                      showToast(addedLead.visited ? 'تم إلغاء علامة الزيارة' : '✓ تم تسجيل المحل كمُزار');
                                    } else {
                                      const finalArea = (lead.detailedAddress || lead.area || 'أخرى').trim();
                                      const gov = getGovernorateForArea(finalArea);
                                      const updated = [...googleLeads, { ...lead, governorate: gov, dateAdded: new Date().toLocaleDateString('ar-EG'), confirmed: false, visited: true }];
                                      setGoogleLeads(updated);
                                      setAddedLeadIds(prev => [...prev, lead.id]);
                                      showToast(`تم الحفظ وتحديد "${lead.name}" كـ مُزار ✅`);
                                    }
                                  }}
                                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center border ${isVisited ? 'bg-teal-100 text-teal-800 border-teal-300' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-teal-50 hover:text-teal-700'}`}
                                >
                                  {isVisited ? '✅ تمت الزيارة' : '🚶‍♂️ تسجيل كزيارة'}
                                </button>

                                {/* WhatsApp Button */}
                                {isNoPhone ? (
                                  <button disabled className="px-3.5 py-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 text-center cursor-not-allowed">
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>لا يوجد واتساب</span>
                                  </button>
                                ) : (
                                  <a
                                    href={formatWhatsAppLink(lead.phone)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100/85 text-[#DD6B20] border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                    title="مراسلة سريعة عبر واتساب"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>دردشة واتساب</span>
                                  </a>
                                )}

                                {/* AI Message Pitch trigger */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (activePitchLeadId === lead.id) {
                                      setActivePitchLeadId(null);
                                    } else {
                                      setActivePitchLeadId(lead.id);
                                      setAiPitchText(generateAIPitchMessage(lead.type, lead.name));
                                    }
                                  }}
                                  className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 border cursor-pointer ${
                                    activePitchLeadId === lead.id
                                      ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm'
                                      : 'bg-indigo-50 hover:bg-indigo-100 text-[#1A365D] border-indigo-200'
                                  }`}
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-[#2B6CB0]" />
                                  <span>العرض الترويجي للـ AI</span>
                                </button>
                              </div>

                              {/* Interactive Pitch draft Box */}
                              {activePitchLeadId === lead.id && (
                                <div className="bg-indigo-50/60 border border-indigo-200 p-3.5 rounded-xl flex flex-col gap-2.5 animate-fade-in text-xs mt-1">
                                  <span className="font-black text-indigo-950 flex items-center gap-1 bg-[#FFFFFF]/80 py-1 px-2.5 rounded-md border border-indigo-100 w-max mb-1">
                                    <Sparkles className="h-4 w-4 text-[#1A365D] animate-spin-slow" />
                                    مسودة عرض سوفانا الذكية المعدة من الذكاء الاصطناعي:
                                  </span>
                                  <textarea
                                    value={aiPitchText}
                                    onChange={(e) => setAiPitchText(e.target.value)}
                                    dir="rtl"
                                    className="w-full bg-[#FFFFFF] border border-indigo-100 rounded-lg p-2.5 text-xs text-[#1A365D] font-bold leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-indigo-400 h-24"
                                  />
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(aiPitchText);
                                        showToast('✓ تم نسخ العرض الترويجي لحافظتك!');
                                      }}
                                      className="px-3 py-1.5 bg-[#FFFFFF] border border-slate-200 text-[#1A365D] rounded-lg font-bold flex items-center gap-1 hover:bg-[#F7FAFC] transition-colors"
                                    >
                                      <Copy className="h-3.5 w-3.5 text-[#2B6CB0]" />
                                      <span>نسخ النص</span>
                                    </button>
                                    {isNoPhone ? (
                                      <button disabled className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg font-bold flex items-center gap-1 cursor-not-allowed">
                                        <Send className="h-3.5 w-3.5" />
                                        <span>لا يوجد رقم</span>
                                      </button>
                                    ) : (
                                      <a
                                        href={formatWhatsAppLink(lead.phone, encodeURIComponent(aiPitchText))}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-[#DD6B20] text-white text-white rounded-lg font-bold flex items-center gap-1 hover:bg-[#C05621] transition-colors"
                                      >
                                        <Send className="h-3.5 w-3.5" />
                                        <span>بدء إرسال على واتس العميل</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Intelligent AI Advisor Console */}
                              {(() => {
                                const advice = getAdviceForStoreType(lead.type);
                                return (
                                  <div className="bg-amber-50/60 border border-amber-200 p-3.5 rounded-xl flex flex-col gap-2 text-xs leading-relaxed text-[#1A365D] mt-1">
                                    <span className="font-black text-amber-950 flex items-center gap-1.5 border-b border-amber-150 pb-1.5">
                                      <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                                      مستشار البيع والولاء من خبراء التوزيع (استراتيجية {advice.ratingLabel}):
                                    </span>
                                    <p className="text-[11px] text-slate-705 leading-relaxed font-bold">
                                      {advice.bestPractice}
                                    </p>
                                    <div className="flex flex-col gap-1.5 mt-1 bg-[#FFFFFF]/70 p-2.5 rounded-lg border border-amber-100/50">
                                      <span className="font-extrabold text-[10px] text-[#1A365D] block mb-1">أفضل الطرق للتعامل وإغلاق البيع بنجاح:</span>
                                      {advice.steps.map((st, sidx) => (
                                        <div key={sidx} className="flex gap-2 items-start text-[10px]">
                                          <span className="h-4 w-4 rounded-full bg-indigo-50 text-[#1A365D] border border-indigo-200 shrink-0 flex items-center justify-center font-black text-[9px] mt-0.5">{sidx + 1}</span>
                                          <span className="text-slate-750 font-bold">{st}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Staging Save Action inside expanded details */}
                            <div className="flex justify-end pt-1.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleAddMapLeadToGoogleLeads(lead)}
                                disabled={isAdded}
                                className={`w-full sm:w-auto px-4.5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95 duration-75 cursor-pointer ${
                                  isAdded
                                    ? 'bg-emerald-50 text-[#DD6B20] border border-emerald-100 cursor-not-allowed'
                                    : 'bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent text-white shadow-sm hover:shadow'
                                }`}
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="h-4 w-4 text-[#DD6B20]" />
                                    <span>تم الحفظ بالعملاء المقترحة✓</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4" />
                                    <span>حفظ بالعملاء المقترحين للمتابعة</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Discovered Leads Staging Tab */}
        {activeTab === 'google_leads' && (
          <div className="flex flex-col gap-4 animate-fade-in" id="google-leads-tab">
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="border-b border-slate-100 pb-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <h3 className="font-bold text-[#1A365D] text-base">العملاء المكتشفون (من الشيت)</h3>
                    <p className="text-[10.5px] text-[#2B6CB0] font-bold mt-0.5">عملاء تم إضافتهم من شيت جوجل لمتابعتهم والاتصال بهم</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {isUserAdmin && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (selectedLeads.length > 0) {
                            const proceed = await confirmDialog(`هل أنت متأكد من مسح ${selectedLeads.length} عميل محدد؟`);
                            if (proceed) {
                              setGoogleLeads(prev => prev.filter(g => !selectedLeads.includes(g.id)));
                              const deleted = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
                              selectedLeads.forEach(id => { if (!deleted.includes(id)) deleted.push(id); });
                              localStorage.setItem('deleted_records_sys', JSON.stringify(deleted));
                              setSelectedLeads([]);
                              showToast('✓ تم مسح العملاء المحددين بنجاح!');
                            }
                          } else {
                            handleBulkDeleteAllGoogleLeads();
                          }
                        }}
                        className={`text-[10px] font-black px-2 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-xs transition-colors border ${
                          selectedLeads.length > 0 
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300' 
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                        title={selectedLeads.length > 0 ? "مسح العملاء المحددين" : "مسح جميع العملاء المكتشفين"}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="hidden sm:inline-block">
                          {selectedLeads.length > 0 ? `مسح المحدد (${selectedLeads.length})` : 'مسح الكل'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const exportData = activeGoogleLeads.map(l => ({ 'المعرف': l.id, 'المحافظة': getResolvedGov(l), 'المنطقة': l.area || '', 'اسم العميل': l.name, 'رقم الهاتف': l.phone, 'العنوان': l.detailedAddress || '', 'النشاط': l.type || '', 'رابط جوجل ماب': l.locationLink }));
                        exportToCSV(exportData, `العملاء_المكتشفين_${new Date().toLocaleDateString('ar-EG')}.csv`);
                      }}
                      className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-black px-2 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      <span>تصدير CSV</span>
                    </button>
                    <span className="text-xs bg-indigo-50 text-indigo-750 font-black px-2.5 py-1.5 rounded-lg border border-indigo-150">
                      {activeGoogleLeads.length} مكتشف
                    </span>
                  </div>
                </div>

                {/* حقل البحث النصي السريع */}
                <div className="relative leading-none w-full mt-2">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-500" />
                  <input
                    type="text"
                    placeholder="ابحث سريعاً بالاسم، رقم الهاتف، أو المنطقة..."
                    value={discoveredSearchQuery}
                    onChange={(e) => setDiscoveredSearchQuery(e.target.value)}
                    className="w-full bg-[#F7FAFC] pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-indigo-500 text-right text-[#1A365D]"
                  />
                </div>

                {/* أزرار التصفية السريعة للمحافظات المكتشفة */}
                {Object.keys(discoveredGovCounts).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150">
                    <span className="text-[10px] font-bold text-[#2B6CB0] w-full mb-0.5">تصفية حسب المحافظة (يمكنك اختيار أكثر من محافظة):</span>
                    <button
                      type="button"
                      onClick={() => { setDiscoveredGovsFilter([]); setDiscoveredAreasFilter([]); }}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${discoveredGovsFilter.length === 0 ? 'bg-[#1A365D] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                    >
                      الكل ({activeGoogleLeads.length})
                    </button>
                    {Object.entries(discoveredGovCounts).sort(([, a], [, b]) => b - a).map(([gov, count]) => (
                      <button
                        key={gov}
                        type="button"
                        onClick={() => {
                          setDiscoveredGovsFilter(prev => prev.includes(gov) ? prev.filter(x => x !== gov) : [...prev, gov]);
                          setDiscoveredAreasFilter([]);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${discoveredGovsFilter.includes(gov) ? 'bg-[#DD6B20] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                      >
                        {gov} ({count})
                      </button>
                    ))}
                  </div>
                )}

                {/* أزرار التصفية للمناطق (تظهر فقط عند اختيار محافظة) */}
                {discoveredGovsFilter.length > 0 && Object.keys(discoveredAreaCounts).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150">
                    <span className="text-[10px] font-bold text-[#2B6CB0] w-full mb-0.5">تصفية حسب المنطقة (داخل المحافظات المحددة):</span>
                    <button
                      type="button"
                      onClick={() => setDiscoveredAreasFilter([])}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${discoveredAreasFilter.length === 0 ? 'bg-[#1A365D] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                    >
                      الكل ({leadsFilteredByGov.length})
                    </button>
                    {Object.entries(discoveredAreaCounts).sort(([, a], [, b]) => b - a).map(([area, count]) => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => {
                          setDiscoveredAreasFilter(prev => prev.includes(area) ? prev.filter(x => x !== area) : [...prev, area]);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${discoveredAreasFilter.includes(area) ? 'bg-[#DD6B20] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                      >
                        {area} ({count})
                      </button>
                    ))}
                  </div>
                )}

                {/* أزرار التصفية حسب النشاط التجاري (تحديد متعدد) */}
                {activeGoogleLeads.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150">
                    <span className="text-[10px] font-bold text-[#2B6CB0] w-full mb-0.5">تصفية حسب النشاط التجاري (يمكنك اختيار أكثر من نشاط):</span>
                    <button
                      type="button"
                      onClick={() => setDiscoveredTypesFilter([])}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${discoveredTypesFilter.length === 0 ? 'bg-[#1A365D] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                    >
                      الكل ({leadsFilteredByArea.length})
                    </button>
                    {Object.entries(discoveredLeadTypeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setDiscoveredTypesFilter(prev => prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type]);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${discoveredTypesFilter.includes(type) ? 'bg-[#DD6B20] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                      >
                        {type} ({count})
                      </button>
                    ))}
                  </div>
                )}

                {/* فلتر إخفاء العملاء المزارين */}
                {activeGoogleLeads.length > 0 && (
                  <div className="flex items-center justify-start mt-2 bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150">
                    <label className="flex items-center gap-2 text-xs font-bold text-teal-800 cursor-pointer">
                      <input type="checkbox" checked={hideVisitedLeads} onChange={(e) => setHideVisitedLeads(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                      <span>إخفاء العملاء الذين تمت زيارتهم للتركيز على الجدد</span>
                    </label>
                  </div>
                )}
              </div>

              {(() => {
                const filteredGoogleLeads = leadsFilteredByArea.filter(lead => {
                  const leadType = lead.type || 'غير محدد';
                  const matchesType = discoveredTypesFilter.length === 0 || discoveredTypesFilter.includes(leadType);

                  const q = discoveredSearchQuery.trim().toLowerCase();
                  const matchesSearch = !q || 
                    (lead.name && lead.name.toLowerCase().includes(q)) ||
                    (lead.phone && lead.phone.includes(q)) ||
                    (lead.area && lead.area.toLowerCase().includes(q)) ||
                    (lead.detailedAddress && lead.detailedAddress.toLowerCase().includes(q));

                  // فلتر إخفاء العملاء الذين تمت زيارتهم
                  const matchesVisited = !hideVisitedLeads || !lead.visited;

                  return matchesType && matchesSearch && matchesVisited;
                }).reverse(); // ترتيب الأحدث أولاً (التاريخ التنازلي بناءً على وقت الإضافة)

                 // removed empty governorate/area warning banner to allow showing all leads when "الكل" is selected

                if (filteredGoogleLeads.length === 0) {
                  return (
                    <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                      <Compass className="h-8 w-8 text-indigo-300 animate-pulse" />
                      <p className="text-gray-400 text-sm font-bold">لا يوجد عملاء مكتشفين مطابقين حالياً.</p>
                      <p className="text-[11px] text-slate-450 leading-relaxed max-w-xs mt-1">
                        استخدم شيت جوجل "عملاء_مكتشفين" لتسجيل وإظهار العملاء الجدد هنا.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-3.5">
                    {isUserAdmin && (
                      <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-100">
                        <label className="flex items-center gap-2 text-xs font-bold text-[#1A365D] cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={filteredGoogleLeads.length > 0 && selectedLeads.length === filteredGoogleLeads.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeads(filteredGoogleLeads.map(l => l.id));
                              } else {
                                setSelectedLeads([]);
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          تحديد الكل ({filteredGoogleLeads.length})
                        </label>
                      </div>
                    )}
                  {filteredGoogleLeads.map((lead) => {
                    const alreadyRealCustomer = customers.some(c => c.phone === lead.phone || c.name.toLowerCase() === lead.name.toLowerCase());
                    const showConfirmed = lead.confirmed || alreadyRealCustomer;
                    const isStagedExpanded = !!expandedStagedLeads[lead.id];
                    const isNoPhone = hasNoPhone(lead.phone);
                    const isVisited = lead.visited;
                    const isWillVisit = lead.willVisit;
                    const themeClass = isVisited 
                        ? 'bg-teal-50/80 border-teal-400 shadow-sm ring-1 ring-teal-300' 
                        : isWillVisit
                            ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-1 ring-amber-300'
                            : getLeadCardTheme(lead.type);
                    const badgeClass = getLeadBadgeTheme(lead.type);

                    return (
                      <div key={lead.id} className={`border rounded-xl overflow-hidden transition-all flex flex-col ${ showConfirmed 
                          ? 'bg-emerald-50/40 border-emerald-150/60' 
                          : isVisited
                              ? 'bg-teal-50/80 border-teal-400 shadow-sm'
                              : isWillVisit
                                  ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-1 ring-amber-300'
                                  : isNoPhone 
                                  ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300 shadow-sm'
                                  : themeClass
                      }`}>
                        
                        {/* Watchlist Header - Toggle Collapsible Card */}
                        <div 
                          onClick={() => setExpandedStagedLeads(prev => prev[lead.id] ? {} : { [lead.id]: true })}
                          className="p-4 bg-[#F7FAFC]/50 hover:bg-[#F7FAFC] flex items-center justify-between gap-4 cursor-pointer select-none"
                        >
                          <div className="flex flex-col gap-1 text-sm select-none">
                            <span className="font-extrabold text-slate-850 text-base flex items-center gap-2 leading-snug">
                              <input
                                type="checkbox"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLeads(prev => [...prev, lead.id]);
                                  } else {
                                    setSelectedLeads(prev => prev.filter(id => id !== lead.id));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                              />
                              {showConfirmed ? (
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                              ) : (
                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-all ${isStagedExpanded ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-amber-400'}`}></span>
                              )}
                                {isVisited && !showConfirmed && <span className="text-teal-600 text-[10px]" title="تمت الزيارة">✅</span>}
                                {isWillVisit && !showConfirmed && !isVisited && <span className="text-amber-600 text-[10.5px] font-extrabold bg-amber-100/80 py-0.5 px-2 rounded border border-amber-200" title="سيتم الزيارة">⏳ سيتم الزيارة</span>}
                                {isNoPhone && !showConfirmed && !isVisited && !isWillVisit && <PhoneOff className="h-4 w-4 text-rose-600 shrink-0" />}
                              {lead.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] font-extrabold py-0.5 px-2 rounded border self-start ${badgeClass}`}>
                                  تصنيف: {lead.type || 'غير محدد'}
                                </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newType = window.prompt(`أدخل التصنيف الجديد للعميل "${lead.name}":`, lead.type || 'سوبر ماركت');
                                  if (newType && newType.trim()) {
                                    setGoogleLeads(prevLeads => prevLeads.map(l => 
                                      l.id === lead.id ? { ...l, type: newType.trim() } : l
                                    ));
                                    showToast('✓ تم تحديث التصنيف بنجاح.');
                                  }
                                }}
                                className="p-1 text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
                                title="تعديل التصنيف"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              {!showConfirmed && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGoogleLeads(prevLeads => prevLeads.map(l => 
                                      l.id === lead.id ? { ...l, willVisit: !l.willVisit } : l
                                    ));
                                    showToast(lead.willVisit ? '✓ تم إلغاء حالة "سيتم الزيارة".' : '✓ تم تمييز العميل بحالة "سيتم الزيارة".');
                                  }}
                                  className={`text-[10px] font-bold px-3 py-1 rounded border transition-colors flex items-center gap-1 active:scale-95 ${
                                    isWillVisit 
                                      ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-sm' 
                                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                  }`}
                                  title="تحديد سيتم الزيارة"
                                >
                                  {isWillVisit ? (
                                    <>
                                      <Check className="h-3 w-3 inline-block" />
                                      <span>سيتم الزيارة ✓</span>
                                    </>
                                  ) : (
                                    <>
                                      <Compass className="h-3 w-3 inline-block" />
                                      <span>سيتم الزيارة</span>
                                    </>
                                  )}
                                </button>
                              )}
                              </div>
                              {lead.dateAdded && (
                                <span className="text-[9.5px] text-[#2B6CB0] bg-[#FFFFFF] py-0.5 px-1.5 rounded border border-slate-150 font-mono font-bold">
                                  تاريخ السحب: {lead.dateAdded}
                                </span>
                              )}
                              {showConfirmed && (
                                <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100/80 py-0.5 px-1.5 rounded border border-emerald-200">
                                  مسجل مسبقاً بقاعدة العملاء ✓
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-black text-xs text-[#2B6CB0]">
                            <span>{isStagedExpanded ? 'إخفاء التفاصيل ▲' : 'عرض التفاصيل ▼'}</span>
                          </div>
                        </div>

                        {/* Watchlist Card Content */}
                        {isStagedExpanded && (
                          <div className="p-4 border-t border-slate-100 bg-[#FFFFFF] flex flex-col gap-3.5 animate-fade-in transition-all">
                            
                            {/* Actions Top bar: Map link & Delete draft */}
                            <div className="flex justify-between items-center bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150 flex-wrap sm:flex-nowrap gap-2">
                              <span className="text-xs font-bold text-slate-650">خرائط ومسودات جوجل:</span>
                              <div className="flex items-center gap-1.5">
                                {lead.locationLink && (
                                  <a
                                    href={lead.locationLink}
                                    target="_blank"
                                    rel="referrer"
                                    className="p-1 px-3 bg-[#FFFFFF] text-[#1A365D] border border-slate-200 hover:bg-[#F7FAFC] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                    title="عرض الموقع المكتشف بخرائط جوجل"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>فتح الموقع بالخرائط</span>
                                  </a>
                                )}
                            {isUserAdmin && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (await confirmDialog('هل تود إزالة هذا العميل المقترح من المسودة/القائمة؟')) {
                                      handleDeleteGoogleLead(lead.id);
                                    }
                                  }}
                                  className="p-1 px-2.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="حذف المقترح"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>مسح</span>
                                </button>
                            )}
                              </div>
                            </div>

                            {/* Contacts & Direct Action Buttons */}
                            <div className="bg-[#F7FAFC]/50 border border-slate-150 p-3 rounded-xl flex flex-col gap-3">
                              <div className="flex flex-col gap-1 text-xs">
                                  <span className={`font-bold flex items-center gap-1 ${isNoPhone ? 'text-rose-600' : 'text-slate-650'}`}>
                                    {isNoPhone ? <PhoneOff className="h-3.5 w-3.5 text-rose-500" /> : <Phone className="h-3.5 w-3.5 text-[#1A365D]" />}
                                    رقم الهاتف: {isNoPhone ? <span className="font-bold">{lead.phone?.includes('انتظار') ? 'في انتظار الاستخراج ⏳' : 'غير متوفر'}</span> : <a href={`tel:${lead.phone}`} className="hover:underline font-mono font-bold text-[#1A365D]">{lead.phone}</a>}
                                </span>
                                <span className="font-bold text-slate-650 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                  العنوان بالتفصيل: <strong className="text-[#1A365D] font-extrabold">{lead.detailedAddress || lead.area}</strong>
                                </span>
                              </div>

                              {/* WhatsApp & Dialing buttons for staging checklist */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-150/60 pt-3">
                                  {isNoPhone ? (
                                    <button disabled className="px-3.5 py-1.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 text-center cursor-not-allowed">
                                      <PhoneOff className="h-3.5 w-3.5" />
                                      <span>لا يوجد رقم</span>
                                    </button>
                                  ) : (
                                    <a
                                      href={`tel:${lead.phone}`}
                                      className="px-3.5 py-1.5 bg-[#F7FAFC] hover:bg-blue-100/85 text-blue-700 border border-blue-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                      title="اتصال هاتفي مباشر"
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                      <span>اتصال هاتفي</span>
                                    </a>
                                  )}

                                  {isNoPhone ? (
                                    <button disabled className="px-3.5 py-1.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 text-center cursor-not-allowed">
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      <span>لا يوجد واتساب</span>
                                    </button>
                                  ) : (
                                    <a
                                      href={formatWhatsAppLink(lead.phone)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100/85 text-[#DD6B20] border border-emerald-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                      title="مراسلة سريعة عبر واتساب"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      <span>واتساب مباشر</span>
                                    </a>
                                  )}
                              </div>
                            </div>

                            {/* Staging Move to Potential Action Button */}
                            <div className="flex justify-end pt-1.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!showConfirmed) {
                                    handleMoveToPotential(lead);
                                  } else {
                                    setSearchQuery((lead.name || '').trim());
                                    setActiveTab('list');
                                    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                                  }
                                }}
                                className={`w-full sm:w-auto px-4.5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 hover:shadow active:scale-95 cursor-pointer ${
                                  showConfirmed
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow shadow-emerald-250'
                                }`}
                              >
                                {showConfirmed ? (
                                  <>
                                    <Check className="h-4 w-4" />
                                    <span>العميل متواجد بالفعل بالقاعدة (الذهاب للعميل)</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    <span>موافقة ونقل للعملاء المحتملين 🤝</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 4. Potential Leads Tab */}
        {activeTab === 'potential_leads' && (
          <div className="flex flex-col gap-4 animate-fade-in" id="potential-leads-tab">
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="border-b border-slate-100 pb-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <h3 className="font-bold text-[#1A365D] text-base">العملاء المحتملون (بانتظار الزيارة)</h3>
                    <p className="text-[10.5px] text-[#2B6CB0] font-bold mt-0.5">عملاء وافقوا على طلب/أوردر وبانتظار زيارة المندوب لتفعيلهم</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {isUserAdmin && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (selectedLeads.length > 0) {
                            const proceed = await confirmDialog(`هل أنت متأكد من مسح ${selectedLeads.length} عميل محدد؟`);
                            if (proceed) {
                              setPotentialLeads(prev => prev.filter(g => !selectedLeads.includes(g.id)));
                              const deleted = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
                              selectedLeads.forEach(id => { if (!deleted.includes(id)) deleted.push(id); });
                              localStorage.setItem('deleted_records_sys', JSON.stringify(deleted));
                              setSelectedLeads([]);
                              showToast('✓ تم مسح العملاء المحددين بنجاح!');
                            }
                          } else {
                            const proceed = await confirmDialog('هل أنت متأكد من مسح جميع العملاء المحتملين من الذاكرة المؤقتة نهائياً؟');
                            if (proceed) {
                              potentialLeads.forEach(l => {
                                const deleted = JSON.parse(localStorage.getItem('deleted_records_sys') || '[]');
                                if (!deleted.includes(l.id)) {
                                  deleted.push(l.id);
                                  localStorage.setItem('deleted_records_sys', JSON.stringify(deleted));
                                }
                              });
                              setPotentialLeads([]);
                              showToast('✓ تم مسح جميع العملاء المحتملين بنجاح!');
                            }
                          }
                        }}
                        className={`text-[10px] font-black px-2 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-xs transition-colors border ${
                          selectedLeads.length > 0 
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300' 
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                        title={selectedLeads.length > 0 ? "مسح العملاء المحددين" : "مسح جميع العملاء المحتملين"}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="hidden sm:inline-block">
                          {selectedLeads.length > 0 ? `مسح المحدد (${selectedLeads.length})` : 'مسح الكل'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const exportData = activePotentialLeads.map(l => ({ 'المعرف': l.id, 'المحافظة': getResolvedGov(l), 'المنطقة': l.area || '', 'اسم العميل': l.name, 'رقم الهاتف': l.phone, 'العنوان': l.detailedAddress || '', 'النشاط': l.type || '', 'رابط جوجل ماب': l.locationLink }));
                        exportToCSV(exportData, `العملاء_المحتملين_${new Date().toLocaleDateString('ar-EG')}.csv`);
                      }}
                      className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-black px-2 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      <span>تصدير CSV</span>
                    </button>
                    <span className="text-xs bg-orange-50 text-orange-750 font-black px-2.5 py-1.5 rounded-lg border border-orange-150">
                      {activePotentialLeads.length} محتمل
                    </span>
                  </div>
                </div>

                {/* حقل البحث النصي السريع */}
                <div className="relative leading-none w-full mt-2">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
                  <input
                    type="text"
                    placeholder="ابحث سريعاً بالاسم، رقم الهاتف، أو المنطقة..."
                    value={potentialSearchQuery}
                    onChange={(e) => setPotentialSearchQuery(e.target.value)}
                    className="w-full bg-[#F7FAFC] pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-orange-500 text-right text-[#1A365D]"
                  />
                </div>

                {/* أزرار التصفية السريعة للمحافظات المحتملة */}
                {Object.keys(potentialGovCounts).length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150">
                    <span className="text-[10px] font-bold text-[#2B6CB0] w-full mb-0.5">تصفية حسب المحافظة (يمكنك اختيار أكثر من محافظة):</span>
                    <button
                      type="button"
                      onClick={() => { setPotentialGovsFilter([]); setPotentialAreasFilter([]); }}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${potentialGovsFilter.length === 0 ? 'bg-[#1A365D] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                    >
                      الكل ({activePotentialLeads.length})
                    </button>
                    {Object.entries(potentialGovCounts).sort(([, a], [, b]) => b - a).map(([gov, count]) => (
                      <button
                        key={gov}
                        type="button"
                        onClick={() => {
                          setPotentialGovsFilter(prev => prev.includes(gov) ? prev.filter(x => x !== gov) : [...prev, gov]);
                          setPotentialAreasFilter([]);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${potentialGovsFilter.includes(gov) ? 'bg-[#DD6B20] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                      >
                        {gov} ({count})
                      </button>
                    ))}
                  </div>
                )}

                {/* أزرار التصفية للمناطق المحتملة */}
                {potentialGovsFilter.length > 0 && Object.keys(potentialAreaCounts).length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150">
                    <span className="text-[10px] font-bold text-[#2B6CB0] w-full mb-0.5">تصفية حسب المنطقة:</span>
                    <button
                      type="button"
                      onClick={() => setPotentialAreasFilter([])}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${potentialAreasFilter.length === 0 ? 'bg-[#1A365D] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                    >
                      الكل ({potentialLeadsFilteredByGov.length})
                    </button>
                    {Object.entries(potentialAreaCounts).sort(([, a], [, b]) => b - a).map(([area, count]) => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => {
                          setPotentialAreasFilter(prev => prev.includes(area) ? prev.filter(x => x !== area) : [...prev, area]);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${potentialAreasFilter.includes(area) ? 'bg-[#DD6B20] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                      >
                        {area} ({count})
                      </button>
                    ))}
                  </div>
                )}

                {/* أزرار التصفية حسب النشاط التجاري للعملاء المحتملين */}
                {activePotentialLeads.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150">
                    <span className="text-[10px] font-bold text-[#2B6CB0] w-full mb-0.5">تصفية حسب النشاط التجاري (يمكنك اختيار أكثر من نشاط):</span>
                    <button
                      type="button"
                      onClick={() => setPotentialTypesFilter([])}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${potentialTypesFilter.length === 0 ? 'bg-[#1A365D] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                    >
                      الكل ({potentialLeadsFilteredByArea.length})
                    </button>
                    {Object.entries(potentialLeadTypeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setPotentialTypesFilter(prev => prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type]);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${potentialTypesFilter.includes(type) ? 'bg-[#DD6B20] text-white shadow-sm' : 'bg-white text-[#1A365D] border border-slate-200 hover:bg-slate-50'}`}
                      >
                        {type} ({count})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {(() => {
                const filteredPotentialLeads = potentialLeadsFilteredByArea.filter(lead => {
                  const leadType = lead.type || 'غير محدد';
                  const matchesType = potentialTypesFilter.length === 0 || potentialTypesFilter.includes(leadType);

                  const q = potentialSearchQuery.trim().toLowerCase();
                  const matchesSearch = !q || 
                    (lead.name && lead.name.toLowerCase().includes(q)) ||
                    (lead.phone && lead.phone.includes(q)) ||
                    (lead.area && lead.area.toLowerCase().includes(q)) ||
                    (getResolvedGov(lead) && getResolvedGov(lead).toLowerCase().includes(q)) ||
                    (lead.type && lead.type.toLowerCase().includes(q)) ||
                    (lead.detailedAddress && lead.detailedAddress.toLowerCase().includes(q));

                  return matchesType && matchesSearch;
                }).reverse();

                if (filteredPotentialLeads.length === 0) {
                  return (
                    <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-orange-300 animate-pulse" />
                      <p className="text-gray-400 text-sm font-bold">لا يوجد عملاء محتملين مطابقين حالياً.</p>
                      <p className="text-[11px] text-slate-450 leading-relaxed max-w-xs mt-1">
                        وافق على الطلب/الأوردر للعملاء في تبويب "عملاء مكتشفون" لنقلهم إلى هنا.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-3.5">
                    {isUserAdmin && (
                      <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-100">
                        <label className="flex items-center gap-2 text-xs font-bold text-[#1A365D] cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={filteredPotentialLeads.length > 0 && selectedLeads.length === filteredPotentialLeads.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeads(filteredPotentialLeads.map(l => l.id));
                              } else {
                                setSelectedLeads([]);
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          تحديد الكل ({filteredPotentialLeads.length})
                        </label>
                      </div>
                    )}
                    {filteredPotentialLeads.map((lead) => {
                      const alreadyRealCustomer = customers.some(c => c.phone === lead.phone || c.name.toLowerCase() === lead.name.toLowerCase());
                      const isStagedExpanded = !!expandedPotentialLeads[lead.id];
                      const isNoPhone = hasNoPhone(lead.phone);
                      const themeClass = getLeadCardTheme(lead.type);
                      const badgeClass = getLeadBadgeTheme(lead.type);

                      return (
                        <div key={lead.id} className={`border rounded-xl overflow-hidden transition-all flex flex-col ${
                          alreadyRealCustomer 
                            ? 'bg-emerald-50/40 border-emerald-150/60' 
                            : isNoPhone 
                            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                            : themeClass
                        }`}>
                          
                          <div 
                            onClick={() => setExpandedPotentialLeads(prev => prev[lead.id] ? {} : { [lead.id]: true })}
                            className="p-4 bg-[#F7FAFC]/50 hover:bg-[#F7FAFC] flex items-center justify-between gap-4 cursor-pointer select-none"
                          >
                            <div className="flex flex-col gap-1 text-sm select-none">
                              <span className="font-extrabold text-slate-850 text-base flex items-center gap-2 leading-snug">
                                <input
                                  type="checkbox"
                                  checked={selectedLeads.includes(lead.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedLeads(prev => [...prev, lead.id]);
                                    } else {
                                      setSelectedLeads(prev => prev.filter(id => id !== lead.id));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                                {alreadyRealCustomer ? (
                                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                                ) : (
                                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-all bg-orange-400`}></span>
                                )}
                                {lead.name}
                              </span>
                              <div className="flex flex-wrap gap-1.5 mt-0.5">
                                <span className={`text-[10px] font-extrabold py-0.5 px-2 rounded border self-start ${badgeClass}`}>
                                  تصنيف: {lead.type || 'غير محدد'}
                                </span>
                                <span className="text-[10px] text-purple-800 bg-purple-50 border border-purple-200 font-extrabold py-0.5 px-2 rounded self-start">
                                  المنطقة: {lead.area || 'غير محدد'}
                                </span>
                                <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 font-extrabold py-0.5 px-2 rounded self-start">
                                  المحافظة: {getResolvedGov(lead)}
                                </span>
                                {lead.dateAdded && (
                                  <span className="text-[9.5px] text-[#2B6CB0] bg-[#FFFFFF] py-0.5 px-1.5 rounded border border-slate-150 font-mono font-bold">
                                    تاريخ الإضافة: {lead.dateAdded}
                                  </span>
                                )}
                                {alreadyRealCustomer && (
                                  <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100/80 py-0.5 px-1.5 rounded border border-emerald-200">
                                    مسجل مسبقاً بقاعدة العملاء ✓
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 font-black text-xs text-[#2B6CB0]">
                              <span>{isStagedExpanded ? 'إخفاء التفاصيل ▲' : 'عرض التفاصيل ▼'}</span>
                            </div>
                          </div>

                          {isStagedExpanded && (
                            <div className="p-4 border-t border-slate-100 bg-[#FFFFFF] flex flex-col gap-3.5 animate-fade-in transition-all">
                              
                              <div className="flex justify-between items-center bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150 flex-wrap sm:flex-nowrap gap-2">
                                <span className="text-xs font-bold text-slate-650">خرائط ومسودات جوجل:</span>
                                <div className="flex items-center gap-1.5">
                                  {lead.locationLink && (
                                    <a
                                      href={lead.locationLink}
                                      target="_blank"
                                      rel="referrer"
                                      className="p-1 px-3 bg-[#FFFFFF] text-[#1A365D] border border-slate-200 hover:bg-[#F7FAFC] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                      title="عرض الموقع المكتشف بخرائط جوجل"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      <span>فتح الموقع بالخرائط</span>
                                    </a>
                                  )}
                                  {isUserAdmin && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (await confirmDialog('هل تود إزالة هذا العميل المحتمل من القائمة؟')) {
                                          handleDeletePotentialLead(lead.id);
                                        }
                                      }}
                                      className="p-1 px-2.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                      title="حذف المحتمل"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>مسح</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="bg-[#F7FAFC]/50 border border-slate-150 p-3 rounded-xl flex flex-col gap-3">
                                <div className="flex flex-col gap-1 text-xs">
                                  <span className={`font-bold flex items-center gap-1 ${isNoPhone ? 'text-rose-600' : 'text-slate-650'}`}>
                                    {isNoPhone ? <PhoneOff className="h-3.5 w-3.5 text-rose-500" /> : <Phone className="h-3.5 w-3.5 text-[#1A365D]" />}
                                    رقم الهاتف: {isNoPhone ? <span className="font-bold">غير متوفر</span> : <a href={`tel:${lead.phone}`} className="hover:underline font-mono font-bold text-[#1A365D]">{lead.phone}</a>}
                                  </span>
                                  <span className="font-bold text-slate-650 flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                    العنوان بالتفصيل: <strong className="text-[#1A365D] font-extrabold">{lead.detailedAddress || lead.area}</strong>
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-150/60 pt-3">
                                  {isNoPhone ? (
                                    <button disabled className="px-3.5 py-1.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 text-center cursor-not-allowed">
                                      <PhoneOff className="h-3.5 w-3.5" />
                                      <span>لا يوجد رقم</span>
                                    </button>
                                  ) : (
                                    <a
                                      href={`tel:${lead.phone}`}
                                      className="px-3.5 py-1.5 bg-[#F7FAFC] hover:bg-blue-100/85 text-blue-700 border border-blue-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                      title="اتصال هاتفي مباشر"
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                      <span>اتصال هاتفي</span>
                                    </a>
                                  )}

                                  {isNoPhone ? (
                                    <button disabled className="px-3.5 py-1.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 text-center cursor-not-allowed">
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      <span>لا يوجد واتساب</span>
                                    </button>
                                  ) : (
                                    <a
                                      href={formatWhatsAppLink(lead.phone)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100/85 text-[#DD6B20] border border-emerald-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                      title="مراسلة سريعة عبر واتساب"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      <span>واتساب مباشر</span>
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div className="flex justify-end pt-1.5 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!alreadyRealCustomer) {
                                      handleConfirmPotentialLead(lead);
                                    } else {
                                      setSearchQuery((lead.name || '').trim());
                                      setActiveTab('list');
                                      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                                    }
                                  }}
                                  className={`w-full sm:w-auto px-4.5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 hover:shadow active:scale-95 cursor-pointer ${
                                    alreadyRealCustomer
                                      ? 'bg-emerald-600 text-white hover:bg-emerald-705 shadow-md'
                                      : 'bg-orange-500 text-white hover:bg-orange-600 text-white shadow shadow-orange-200'
                                  }`}
                                >
                                  {alreadyRealCustomer ? (
                                    <>
                                      <Check className="h-4 w-4" />
                                      <span>العميل متواجد بالفعل بالقاعدة (الذهاب للعميل)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-4 w-4" />
                                      <span>تأكيد الزيارة ونقل للعملاء الفعليين 👥</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

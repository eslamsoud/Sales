// @ts-nocheck
import { confirmDialog } from '../utils/confirm';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Customer, AppSettings } from '../types';
import { showToast } from '../utils/toast';
import { Users, Plus, MapPin, Search, Phone, ExternalLink, Trash2, ArrowRight, Compass, Check, Loader2, Star, MessageSquare, Send, Copy, Sparkles, Printer, FileText } from 'lucide-react';
import SecurePhoneDisplay from './SecurePhoneDisplay';
import GmpMapEngine from './GmpMapEngine';

const EGYPT_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الشرقية', 'الدقهلية', 'البحيرة', 'القليوبية', 
  'الغربية', 'المنوفية', 'دمياط', 'بورسعيد', 'السويس', 'الإسماعيلية', 'الفيوم', 
  'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'مطروح', 
  'الوادي الجديد', 'البحر الأحمر', 'شمال سيناء', 'جنوب سيناء', 'كفر الشيخ', 'أخرى'
];

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

interface CustomersTabProps {
  customers: Customer[];
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onGoBack: () => void;
  settings: AppSettings;
  permittedSubTabs?: string[];
}

export default function CustomersTab({ customers, onAddCustomer, onEditCustomer, onDeleteCustomer, onGoBack, settings, permittedSubTabs }: CustomersTabProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'maps_finder' | 'google_leads'>(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('customers_list')) return 'list';
      if (permittedSubTabs.includes('customers_maps_finder')) return 'maps_finder';
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
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [locationLink, setLocationLink] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [govSearchQuery, setGovSearchQuery] = useState('');
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [geoStatusMsg, setGeoStatusMsg] = useState('');
  const [waLoadingId, setWaLoadingId] = useState<string | null>(null);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab]);

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
      let phone = customer.phone;
      if (phone.startsWith('0')) {
        phone = '20' + phone.substring(1);
      }
      window.open(`https://wa.me/${phone}?text=${messageText}`, '_blank');
    } catch (err: any) {
      console.warn("Using premium local pitch message generator due to inactive Gemini API Key:", err.message);
      
      const guidelines = settings.aiRetentionGuidelines || 'تقديم عرض ترويجي خاص لزيوت وسمن سوفانا الفاخرة';
      const fallbackPitchMsg = `السلام عليكم ورحمة الله وبركاته يا فندم 🌸\nمعكم مندوب مبيعات زيوت وسمن "سوفانا" الممتازة لجودة الفنادق والمطاعم والبيوت.\n\nنتشرف بالتعاون معكم في [ ${customer.name} ] بمنطقة [ ${customer.area} ] ونود تقديم عروضنا الخاصة والحصرية لكم لتوفير أفضل سمن بلدي وزيوت مصفاة فائقة النقاوة، بهامش ربح ممتاز وتسهيلات سداد مريحة.\n\n(✨ هدفنا الاستراتيجي: ${guidelines})\n\nهل نتشرف بتحديد موعد قريب للزيارة وتجريب عيناتنا المجانية للتأكد من الجودة؟`;
      
      const messageText = encodeURIComponent(fallbackPitchMsg);
      let phone = customer.phone;
      if (phone.startsWith('0')) {
        phone = '20' + phone.substring(1);
      }
      window.open(`https://wa.me/${phone}?text=${messageText}`, '_blank');
    } finally {
      setWaLoadingId(null);
    }
  };

  // Watchlist/Staging for prospects generated from Google Maps finder
  const [googleLeads, setGoogleLeads] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('google_leads_staging_sys');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Automatically save googleLeads inside localStorage on change
  React.useEffect(() => {
    localStorage.setItem('google_leads_staging_sys', JSON.stringify(googleLeads));
  }, [googleLeads]);

  const DEFAULT_AREAS = ['الزقازيق', 'ميت غمر', 'بدر', 'العاشر من رمضان', 'بلبيس', 'القاهرة'];
  const configuredAreas = (settings.workAreas || []).map(w => w.area);
  const registeredAreas = Array.from(new Set(customers.map(c => c.area).filter(Boolean)));
  const allAreas = Array.from(new Set([...DEFAULT_AREAS, ...configuredAreas, ...registeredAreas]));
  const customGovs = (settings.workAreas || []).map(w => w.governorate);
  const finalGovernorates = Array.from(new Set([...customGovs, ...EGYPT_GOVERNORATES]));

  // Google Maps Lead Finder State
  const [selectedSearchArea, setSelectedSearchArea] = useState('');
  const [storeType, setStoreType] = useState('سوبر ماركت');
  const [isSearchingMaps, setIsSearchingMaps] = useState(false);
  const [mapsResults, setMapsResults] = useState<any[]>([]);
  const [addedLeadIds, setAddedLeadIds] = useState<string[]>([]);

  // Slicing/segmenting capabilities for large maps list
  const [batchSize, setBatchSize] = useState<number>(10);
  const [activePitchLeadId, setActivePitchLeadId] = useState<string | null>(null);
  const [aiPitchText, setAiPitchText] = useState<string>('');

  // Toggling expanded/collapsed states for different lists
  const [expandedRealCustomers, setExpandedRealCustomers] = useState<Record<string, boolean>>({});
  const [expandedGoogleLeads, setExpandedGoogleLeads] = useState<Record<string, boolean>>({});
  const [expandedStagedLeads, setExpandedStagedLeads] = useState<Record<string, boolean>>({});

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
    } else {
      return `مرحباً بحضرتك يا فندم، معكم زيوت وسمن سوفانا 🌿. نتشرف بالتعاون مع تجار العطارة الكرام في [ ${clientName} ]، ونوفر لكم سمن بلدي وزيوت طبيعية بنكهات أصلية وروائح جذابة تضمن ولاء المتسوقين وبخصومات مخصصة للكميات تبدأ من 5 كراتين مع ترويج مجاني لعطارتكم في منصاتنا لضمان بيع ممتاز.${guidelines}\n\nهل تود التعرف على أسعار التوريد والكميات المتاحة حالياً؟`;
    }
  };

  const handleAddMapLeadToGoogleLeads = (lead: any) => {
    // Add to googleLeads watchlist if not exists
    const exists = googleLeads.some(g => g.phone === lead.phone || g.name.toLowerCase() === lead.name.toLowerCase());
    if (exists) {
      alert('تم إضافة هذا المحل بالفعل في مسودة العملاء المقترحين.');
      setAddedLeadIds(prev => [...prev, lead.id]);
      return;
    }

    const updated = [...googleLeads, { ...lead, dateAdded: new Date().toLocaleDateString('ar-EG'), confirmed: false }];
    setGoogleLeads(updated);
    setAddedLeadIds(prev => [...prev, lead.id]);
  };

  const handleConfirmGoogleLead = (lead: any) => {
    const finalArea = (lead.detailedAddress || lead.area || 'أخرى').trim();
    
    // Auto add immediately using onAddCustomer callback prop
    onAddCustomer({
      name: (lead.name || '').trim(),
      phone: (lead.phone || '').trim(),
      area: finalArea,
      governorate: getGovernorateForArea(finalArea),
      locationLink: lead.locationLink || `https://maps.google.com/?q=${encodeURIComponent((lead.name || '').trim() + ' ' + finalArea)}`
    });

    // Mark as confirmed in staging
    setGoogleLeads(prev => prev.map(g => g.id === lead.id ? { ...g, confirmed: true } : g));
    
    // Switch view to actual customers list, filter for this newly active customer and scroll to top
    setSearchQuery((lead.name || '').trim());
    setActiveTab('list');
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

    alert(`تم تأكيد العميل "${lead.name}" وإضافته بنجاح لقائمة عملائك الفعليين في منطقة [ ${finalArea} ]! 🎉`);
  };

  const handleDeleteGoogleLead = (leadId: string) => {
    setGoogleLeads(prev => prev.filter(g => g.id !== leadId));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalArea = area === 'أخرى' ? customArea.trim() : area.trim();
    if (!finalArea) {
      alert('يرجى تحديد أو كتابة المنطقة السكنية.');
      return;
    }

    const finalGov = governorate.trim() || getGovernorateForArea(finalArea);

    if (editingCustomer) {
      onEditCustomer({
        ...editingCustomer,
        name: name.trim(),
        phone: phone.trim(),
        area: finalArea,
        governorate: finalGov,
        locationLink: locationLink.trim() || `https://maps.google.com/?q=${encodeURIComponent(name.trim() + ' ' + finalArea)}`
      });
      alert('تم تعديل بيانات العميل بنجاح.');
    } else {
      onAddCustomer({
        name: name.trim(),
        phone: phone.trim(),
        area: finalArea,
        governorate: finalGov,
        locationLink: locationLink.trim() || `https://maps.google.com/?q=${encodeURIComponent(name.trim() + ' ' + finalArea)}`
      });
    }

    setName('');
    setPhone('');
    setArea('');
    setCustomArea('');
    setGovernorate('');
    setLocationLink('');
    setGeoStatusMsg('');
    setShowAddForm(false);
    setEditingCustomer(null);
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
            <p>سمن وزيت سوفانا الفاخر - شركة الأغذية المتحدون</p>
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
                    <td>${customer.governorate || getGovernorateForArea(customer.area)}</td>
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
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    const gq = govSearchQuery.trim().toLowerCase();
    
    // Check general query
    const matchesGeneral = !q || (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.area.toLowerCase().includes(q) ||
      (c.governorate || getGovernorateForArea(c.area)).toLowerCase().includes(q)
    );

    // Check governorate query starting with letter or matching entirely
    const customerGov = c.governorate || getGovernorateForArea(c.area);
    const matchesGov = !gq || customerGov.toLowerCase().includes(gq);

    return matchesGeneral && matchesGov;
  });

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12 text-right animate-fade-in" dir="rtl" id="customers-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
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
                    onClick={() => setActiveTab('maps_finder')}
                    className={`flex-1 text-center py-2.5 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xl ${
                      activeTab === 'maps_finder' ? 'bg-[#FFFFFF] text-[#DD6B20] shadow-xs border border-slate-200' : 'text-[#6B7280] bg-transparent hover:text-[#1A365D]'
                    }`}
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>استكشاف عملاء</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('google_leads')}
                    className={`flex-1 text-center py-2.5 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xl ${
                      activeTab === 'google_leads' ? 'bg-[#FFFFFF] text-[#DD6B20] shadow-xs border border-slate-200' : 'text-[#6B7280] bg-transparent hover:text-[#1A365D]'
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 ${googleLeads.filter(g => !g.confirmed).length === 0 ? 'hidden' : ''}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 bg-red-500 ${googleLeads.filter(g => !g.confirmed).length === 0 ? 'hidden' : ''}`}></span>
                    </span>
                    <span>عملاء محتملين ({googleLeads.length})</span>
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
                    onClick={() => setShowAddForm(false)}
                    className="text-gray-400 hover:text-[#2B6CB0] text-xs font-bold bg-[#F7FAFC] p-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                              
                              // Filter the allAreas to match currentGov if one is specified
                              const matchedAreas = allAreas.filter(a => {
                                if (!currentGov) return true; // If no governorate is selected, include all
                                
                                // Check settings.workAreas first for a match
                                const workAreaMatch = (settings.workAreas || []).some(w => 
                                  w.area === a && w.governorate.trim().toLowerCase() === currentGov
                                );
                                if (workAreaMatch) return true;

                                // Check other customers for a match
                                const customerMatch = customers.some(c => 
                                  c.area === a && (c.governorate || getGovernorateForArea(c.area)).trim().toLowerCase() === currentGov
                                );
                                if (customerMatch) return true;

                                // Check fallback function getGovernorateForArea
                                if (getGovernorateForArea(a).trim().toLowerCase() === currentGov) return true;

                                return false;
                              });

                              const filtered = matchedAreas.filter(a => 
                                !query || 
                                a.toLowerCase().includes(query) ||
                                (settings.workAreas?.find(w => w.area === a)?.governorate || '').toLowerCase().includes(query)
                              );

                              if (filtered.length === 0) {
                                return (
                                  <div 
                                    onClick={() => {
                                      setShowAreaDropdown(false);
                                    }}
                                    className="p-2 hover:bg-slate-50 cursor-pointer text-gray-500 font-bold"
                                  >
                                    استخدم القيمة الجديدة: "{area}"
                                  </div>
                                );
                              }

                              return filtered.map(a => {
                                const gov = settings.workAreas?.find(w => w.area === a)?.governorate || getGovernorateForArea(a);
                                return (
                                  <div
                                    key={a}
                                    onClick={() => {
                                      setArea(a);
                                      if (gov && !governorate.trim()) {
                                        setGovernorate(gov);
                                      }
                                      setShowAreaDropdown(false);
                                    }}
                                    className="p-2 hover:bg-indigo-50 border-b border-slate-100 last:border-none cursor-pointer flex justify-between font-bold text-slate-800"
                                  >
                                    <span className="text-gray-400 font-medium">({gov || 'محافظة غير حددة'})</span>
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
                  <button
                    type="button"
                    onClick={exportCustomersDirectoryAsPDF}
                    className="bg-[#1A365D] hover:bg-[#2B6CB0] text-[#ffffff] font-extrabold text-[#ffffff] text-[11px] py-2 px-3 rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer border-none"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>طباعة الدليل المفلتر (PDF)</span>
                  </button>
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
                    return (
                      <div key={customer.id} className="border border-slate-150 rounded-xl overflow-hidden bg-[#FFFFFF] shadow-xs hover:border-indigo-200 transition-all flex flex-col">
                        {/* Header (Clickable to expand/collapse) */}
                        <div
                          onClick={() => setExpandedRealCustomers(prev => prev[customer.id] ? {} : { [customer.id]: true })}
                          className="p-4 bg-[#F7FAFC]/60 hover:bg-[#F7FAFC] flex items-center justify-between gap-4 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm select-none flex-wrap">
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-colors ${isExpanded ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-slate-350'}`}></span>
                            <span className="font-extrabold text-[#1A365D] text-sm sm:text-base">{customer.name}</span>
                            <span className="text-[10.5px] bg-slate-200/85 text-[#1A365D] font-extrabold px-2 py-0.5 rounded-md">
                              {customer.area}
                            </span>
                            <span className="text-[10.5px] bg-sky-100 text-sky-850 font-extrabold px-2 py-0.5 rounded-md border border-sky-200">
                              {customer.governorate || getGovernorateForArea(customer.area)}
                            </span>
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
                                  href={`https://wa.me/20${customer.phone.replace(/^0/, '')}`}
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
                                    const areaExists = allAreas.includes(customer.area);
                                    if (areaExists) {
                                      setArea(customer.area);
                                      setCustomArea('');
                                    } else {
                                      setArea('أخرى');
                                      setCustomArea(customer.area);
                                    }
                                    const matchedGovForCustomer = settings.workAreas?.find(w => w.area === customer.area)?.governorate;
                                    setGovernorate(customer.governorate || matchedGovForCustomer || getGovernorateForArea(customer.area));
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
                                  onClick={async () => {
                                    if (await confirmDialog(`هل أنت متأكد من حذف العميل [${customer.name}]؟`)) {
                                      onDeleteCustomer(customer.id);
                                    }
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
        {activeTab === 'maps_finder' && (
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
                  <div>
                    <label className="inline-block bg-sky-100 text-sky-950 border border-sky-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">النشاط التجاري</label>
                     <select
                      value={storeType}
                      onChange={(e) => setStoreType(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-[#1A365D] text-right"
                    >
                      <option value="الكل">الكل</option>
                      <option value="هايبر ماركت">هايبر ماركت</option>
                      <option value="سوبر ماركت">سوبر ماركت</option>
                      <option value="ميني ماركت">ميني ماركت</option>
                      <option value="حلواني ومخبز">حلواني ومخبز</option>
                      <option value="عطارة">عطارة</option>
                      <option value="بقالة تموينية">بقالة تموينية</option>
                      <option value="مواد تموينية">مواد تموينية</option>
                      <option value="مطاعم">مطاعم</option>
                    </select>
                  </div>

                  <div>
                    <label className="inline-block bg-emerald-100 text-emerald-950 border border-emerald-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">نطاق البحث</label>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-[#1A365D] text-right"
                    >
                      <option value={10}>تجزئة سريعة (سحب 10 محلات بالموقع)</option>
                      <option value={20}>تجزئة متوسطة (سحب 20 محل لتغطية أوسع)</option>
                      <option value={30}>تغطية شاملة للمنطقة كاملة (سحب 30 عميل دفعة واحدة)</option>
                    </select>
                  </div>
                </div>

                <GmpMapEngine 
                  storeType={storeType} 
                  batchSize={batchSize} 
                  onResults={setMapsResults} 
                  isSearching={isSearchingMaps} 
                  setIsSearching={setIsSearchingMaps} 
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
                  <span className="text-[10px] bg-emerald-50 text-[#DD6B20] font-extrabold px-2 py-0.5 rounded border border-emerald-150">
                    نشط بخرائط جوجل
                  </span>
                </div>

                <div className="flex flex-col gap-5">
                  {mapsResults.map((lead) => {
                    const isAdded = googleLeads.some(g => g.name.toLowerCase() === lead.name.toLowerCase() || g.phone === lead.phone || addedLeadIds.includes(lead.id));
                    const isLeadExpanded = !!expandedGoogleLeads[lead.id];

                    return (
                      <div key={lead.id} className="border border-slate-150 rounded-xl overflow-hidden bg-[#FFFFFF] hover:border-indigo-200 transition-all flex flex-col shadow-sm">
                        
                        {/* Interactive Header for Toggle */}
                        <div 
                          onClick={() => setExpandedGoogleLeads(prev => ({ ...prev, [lead.id]: !prev[lead.id] }))}
                          className="p-4 bg-[#F7FAFC]/60 hover:bg-[#F7FAFC] flex items-center justify-between gap-4 cursor-pointer transition-colors"
                        >
                          <div className="flex flex-col gap-1.5 text-sm select-none">
                            <span className="font-extrabold text-slate-850 text-base flex items-center gap-1.5 leading-snug">
                              <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-all ${isLeadExpanded ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-slate-350'}`}></span>
                              {lead.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              <span className="text-[10px] text-[#1A365D] font-extrabold bg-indigo-50/70 py-0.5 px-2 rounded border border-indigo-100 self-start">
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

                            {/* Contacts & Direct Action Buttons */}
                            <div className="bg-[#F7FAFC]/50 border border-slate-150 p-3 rounded-xl flex flex-col gap-3">
                              <div className="flex flex-col gap-1 text-xs">
                                <span className="font-bold text-slate-650 flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5 text-[#1A365D]" />
                                  رقم التواصل الهاتف: <a href={`tel:${lead.phone}`} className="hover:underline font-mono font-bold text-[#1A365D]">{lead.phone}</a>
                                </span>
                                <span className="font-bold text-slate-650 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                  العنوان بالتفصيل: <strong className="text-[#1A365D] font-extrabold">{lead.detailedAddress || lead.area}</strong>
                                </span>
                              </div>

                              {/* Quick Action triggers: Direct Call, WhatsApp message, AI Generator */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-150/60 pt-3">
                                {/* Call Button */}
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="px-3.5 py-2 bg-[#F7FAFC] hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                  title="اتصال هاتفي سريع ومباشر"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>اتصل بالعميل</span>
                                </a>

                                {/* WhatsApp Button */}
                                <a
                                  href={`https://wa.me/20${lead.phone.replace(/^0/, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#DD6B20] border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                  title="مراسلة سريعة عبر واتساب"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  <span>دردشة واتساب</span>
                                </a>

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
                                        alert('تم نسخ عرض الـ AI الترويجي المكتمل لحافظتك بنجاح!');
                                      }}
                                      className="px-3 py-1.5 bg-[#FFFFFF] border border-slate-200 text-[#1A365D] rounded-lg font-bold flex items-center gap-1 hover:bg-[#F7FAFC] transition-colors"
                                    >
                                      <Copy className="h-3.5 w-3.5 text-[#2B6CB0]" />
                                      <span>نسخ النص</span>
                                    </button>
                                    <a
                                      href={`https://wa.me/20${lead.phone.replace(/^0/, '')}?text=${encodeURIComponent(aiPitchText)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-[#DD6B20] text-white text-white rounded-lg font-bold flex items-center gap-1 hover:bg-[#C05621] transition-colors"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                      <span>بدء إرسال على واتس العميل</span>
                                    </a>
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

        {/* 3. Google Leads Staging Tab - NEW */}
        {activeTab === 'google_leads' && (
          <div className="flex flex-col gap-4 animate-fade-in" id="google-leads-tab">
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div className="flex flex-col">
                  <h3 className="font-bold text-[#1A365D] text-base">عملاء جوجل المستجلبين للمتابعة</h3>
                  <p className="text-[10.5px] text-[#2B6CB0] font-bold mt-0.5">عملاء مقترحين تم سحبهم للاتصال والتحويل لعملاء دائمين</p>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-750 font-black px-2.5 py-1 rounded-lg border border-indigo-150 animate-pulse">
                  {googleLeads.length} عميل مقترح
                </span>
              </div>

              {googleLeads.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                  <Compass className="h-8 w-8 text-indigo-300 animate-pulse" />
                  <p className="text-gray-400 text-sm font-bold">لا يوجد عملاء مستجلبين من جوجل للمتابعة حالياً.</p>
                  <p className="text-[11px] text-slate-450 leading-relaxed max-w-xs mt-1">
                    يرجى الذهاب أولا لتبويب <span className="text-[#1A365D] font-bold">"استكشاف عملاء"</span> للبحث بالمدن وسحب المحلات، ثم الضغط على "حفظ بـ عملاء جوجل للمتابعة" لتظهر في مسودتك هنا!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {googleLeads.map((lead) => {
                    const alreadyRealCustomer = customers.some(c => c.phone === lead.phone || c.name.toLowerCase() === lead.name.toLowerCase());
                    const showConfirmed = lead.confirmed || alreadyRealCustomer;
                    const isStagedExpanded = !!expandedStagedLeads[lead.id];

                    return (
                      <div key={lead.id} className={`border rounded-xl overflow-hidden transition-all flex flex-col ${
                        showConfirmed ? 'bg-emerald-50/40 border-emerald-150/60' : 'bg-[#FFFFFF] border-slate-200 hover:border-slate-350 shadow-sm'
                      }`}>
                        
                        {/* Watchlist Header - Toggle Collapsible Card */}
                        <div 
                          onClick={() => setExpandedStagedLeads(prev => prev[lead.id] ? {} : { [lead.id]: true })}
                          className="p-4 bg-[#F7FAFC]/50 hover:bg-[#F7FAFC] flex items-center justify-between gap-4 cursor-pointer select-none"
                        >
                          <div className="flex flex-col gap-1 text-sm select-none">
                            <span className="font-extrabold text-slate-850 text-base flex items-center gap-1.5 leading-snug">
                              {showConfirmed ? (
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                              ) : (
                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-all ${isStagedExpanded ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-amber-400'}`}></span>
                              )}
                              {lead.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              <span className="text-[10px] text-[#1A365D] font-extrabold bg-indigo-50 py-0.5 px-2 rounded border border-indigo-100">
                                {lead.type || 'نشاط تجاري'}
                              </span>
                              {lead.dateAdded && (
                                <span className="text-[9.5px] text-[#2B6CB0] bg-[#FFFFFF] py-0.5 px-1.5 rounded border border-slate-150 font-mono font-bold">
                                  تاريخ السحب: {lead.dateAdded}
                                </span>
                              )}
                              {showConfirmed && (
                                <span className="text-[10px] text-[#DD6B20] font-extrabold bg-emerald-100/80 py-0.5 px-1.5 rounded border border-emerald-205">
                                  شريك معتمد في قائمة المنطقة ✓
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-black text-xs text-[#2B6CB0]">
                            <span>{isStagedExpanded ? 'إخفاء ▲' : 'عرض التفاصيل والخيارات ▼'}</span>
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
                              </div>
                            </div>

                            {/* Contacts & Direct Action Buttons */}
                            <div className="bg-[#F7FAFC]/50 border border-slate-150 p-3 rounded-xl flex flex-col gap-3">
                              <div className="flex flex-col gap-1 text-xs">
                                <span className="font-bold text-slate-650 flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5 text-[#1A365D]" />
                                  رقم الهاتف: <a href={`tel:${lead.phone}`} className="hover:underline font-mono font-bold text-[#1A365D]">{lead.phone}</a>
                                </span>
                                <span className="font-bold text-slate-650 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                  العنوان بالتفصيل: <strong className="text-[#1A365D] font-extrabold">{lead.detailedAddress || lead.area}</strong>
                                </span>
                              </div>

                              {/* WhatsApp & Dialing buttons for staging checklist */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-150/60 pt-3">
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="px-3.5 py-1.5 bg-[#F7FAFC] hover:bg-blue-100/85 text-blue-700 border border-blue-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                  title="اتصال هاتفي مباشر"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>اتصال هاتفي</span>
                                </a>

                                <a
                                  href={`https://wa.me/20${lead.phone.replace(/^0/, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100/85 text-[#DD6B20] border border-emerald-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                  title="مراسلة سريعة عبر واتساب"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  <span>واتساب مباشر</span>
                                </a>
                              </div>
                            </div>

                            {/* Staging Confirmation Action Button */}
                            <div className="flex justify-end pt-1.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!showConfirmed) {
                                    handleConfirmGoogleLead(lead);
                                  } else {
                                    setSearchQuery((lead.name || '').trim());
                                    setActiveTab('list');
                                    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                                  }
                                }}
                                className={`w-full sm:w-auto px-4.5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 hover:shadow active:scale-95 cursor-pointer ${
                                  showConfirmed
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-705 shadow-md'
                                    : 'bg-[#DD6B20] text-white hover:bg-[#C05621] text-white shadow'
                                }`}
                              >
                                {showConfirmed ? (
                                  <>
                                    <Check className="h-4 w-4" />
                                    <span>تم التأكيد والإضافة المعتمدة ✓ (الانتقال للعميل)</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    <span>تأكيد وإضافته للعملاء الفعليين بالمنطقة</span>
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
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

import { confirmDialog } from '../utils/confirm';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, AppSettings, Customer, Invoice, Expense, Trip, getProductWeightsFallback, UserAuth, formatNum } from '../types';
import { 
  Settings as SettingsIcon, 
  Save, 
  HelpCircle, 
  RefreshCw, 
  Database, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  Send, 
  ArrowRight, 
  Sparkles,
  Users,
  Scale,
  Phone,
  MessageSquare,
  Search,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Globe,
  TrendingDown,
  Tags,
  CheckCircle2
} from 'lucide-react';

interface ManageTabProps {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  expenses: Expense[];
  trips: Trip[];
  settings: AppSettings;
  usersList: UserAuth[];
  onUpdateUsersList: (list: UserAuth[]) => void;
  currentUser: UserAuth | null;
  onEditProduct: (product: Product) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onResetDatabase: (demoMode: boolean) => void;
  onGoBack: () => void;
}

export default function ManageTab({
  products,
  customers,
  invoices,
  expenses,
  trips,
  settings,
  usersList,
  onUpdateUsersList,
  currentUser,
  onEditProduct,
  onUpdateSettings,
  onResetDatabase,
  onGoBack
}: ManageTabProps) {
  // Helper for subtabs permissions
  const getSubTabsForTab = (tabId: string): Array<{ id: string; name: string }> => {
    switch (tabId) {
      case 'factory':
        return [
          { id: 'loads', name: 'شحن وتوريد حمولة السيارة 🚚' },
          { id: 'products', name: 'السلع وأسعار مكاسب المصنع 📦' },
          { id: 'previous_loads', name: 'سجل وأرشيف الشحنات 📑' },
          { id: 'factory_account', name: 'الحساب المالي للمصنع والعهدة 💰' },
          { id: 'trips', name: 'تنزيل المشاوير والنقليات 🗺️' }
        ];
      case 'customers':
        return [
          { id: 'customers_list', name: 'دليل العملاء وبرامج الترويج 🏢' },
          { id: 'customers_maps_finder', name: 'منقّب عملاء Google Maps 🧭' }
        ];
      case 'invoice':
        return [
          { id: 'invoice_create', name: 'كتابة فاتورة بيع جديدة ✍️' },
          { id: 'invoice_balance', name: 'جرد وباقي حمولة السيارة 🔍' }
        ];
      case 'expenses':
        return [
          { id: 'expenses_list', name: 'المصاريف وتنزيل الإيراد الإضافي 💵' }
        ];
      case 'reports':
        return [
          { id: 'reports_finance', name: 'الديون المتبقية والتحصيل ⚠️' },
          { id: 'reports_stats', name: 'صافي الربح والخسائر 📈' },
          { id: 'reports_areas', name: 'تحليل فئات ومجهود المناطق 🗺️' },
          { id: 'reports_invoices', name: 'سجل وأرشيف الفواتير المباعة 📜' }
        ];
      default:
        return [];
    }
  };

  // Active sub-tab state inside Administration
  const [subTab, setSubTab] = useState<'products' | 'ai_settings' | 'db_ops' | 'manager_main' | 'google_sync'>(
    currentUser?.phone === '01228466613' ? 'manager_main' : 'products'
  );
  const [managerSubTab, setManagerSubTab] = useState<'live_tracking' | 'user_permissions' | 'google_integration' | 'add_user_or_visitor'>('user_permissions');

  // Lock and password states
  const [isManagerUnlocked, setIsManagerUnlocked] = useState(false);
  const [managerTypedPassword, setManagerTypedPassword] = useState('');
  const [isDelegateUnlocked, setIsDelegateUnlocked] = useState(false);
  const [delegateTypedPassword, setDelegateTypedPassword] = useState('');
  const [delegateLoginError, setDelegateLoginError] = useState('');
  const [managerLoginError, setManagerLoginError] = useState('');
  const [expandedUserPhone, setExpandedUserPhone] = useState<string | null>(null);

  // Fields for adding representative or visitor
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserType, setNewUserType] = useState<string>('delegate');
  const [newUserPassword, setNewUserPassword] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [subTab, managerSubTab]);

  // Core settings form state
  const [googleUrl, setGoogleUrl] = useState(settings.googleSheetsUrl || '');
  const [currency, setCurrency] = useState(settings.currency || 'ج.م');
  const [pitchGuidelines, setPitchGuidelines] = useState(settings.aiPitchGuidelines || '');
  const [retentionGuidelines, setRetentionGuidelines] = useState(settings.aiRetentionGuidelines || '');
  const [repName, setRepName] = useState(settings.representativeName || '');
  const [repPhone, setRepPhone] = useState(settings.representativePhone || '01228466613');
  const [invoiceAppName, setInvoiceAppName] = useState(settings.appName || 'الأخوة المتحدون EAG');
  const [googlePassword, setGooglePassword] = useState('');

  // Delegate live tracking state
  const [trackedUserPhone, setTrackedUserPhone] = useState<string>('');
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(true);
  const [simulatedPathStep, setSimulatedPathStep] = useState<number>(0);
  const [isGooglePasswordValid, setIsGooglePasswordValid] = useState(true);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  
  // Local state for modified role names before hitting confirmation button
  const [localRoleNames, setLocalRoleNames] = useState<Record<string, string>>({});
  
  // Sync state
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'fail'>('idle');
  const [syncMsg, setSyncMsg] = useState('');

  // AI Chat States
  const [aiChatCategory, setAiChatCategory] = useState('سوبر ماركت');
  const [aiChatCustomerSearch, setAiChatCustomerSearch] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAskingAI, setIsAskingAI] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // States for Market & Oil Industry Grounded Search
  const [aiSubTab, setAiSubTab] = useState<'sales_assistant' | 'market_explorer'>('sales_assistant');
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [marketSearchResult, setMarketSearchResult] = useState('');
  const [marketSearchSources, setMarketSearchSources] = useState<{ title: string, uri: string }[]>([]);
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);
  const [marketSearchError, setMarketSearchError] = useState('');

  // رابط Railway السحابي الخاص بك (يتم تفعيله فقط على الاستضافة وليس المحلي)
  // هام: قم بتغيير الرابط أدناه بالرابط الحقيقي الذي سيعطيه لك Railway لاحقاً
  const API_BASE_URL = window.location.hostname === 'localhost' ? '' : 'https://seals-production.up.railway.app';

  const handleMarketSearch = async (queryText: string) => {
    const finalQuery = queryText.trim();
    if (!finalQuery) return;
    setMarketSearchQuery(finalQuery);
    setIsSearchingMarket(true);
    setMarketSearchResult('');
    setMarketSearchSources([]);
    setMarketSearchError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/gemini/market-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: finalQuery })
      });

      if (!response.ok) {
        throw new Error('فشل نظام البحث بالذكاء الاصطناعي في جلب البيانات الحالية من البورصة ومحرك البحث.');
      }

      const data = await response.json();
      setMarketSearchResult(data.text || '');
      setMarketSearchSources(data.sources || []);
    } catch (err: any) {
      setMarketSearchError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsSearchingMarket(false);
    }
  };

  // Auto scroll chat
  useEffect(() => {
    if (subTab === 'ai_settings' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChatHistory, subTab]);

  // Simulated sequence of geographic points for delegate tracking
  const trackingSimulationData = useMemo(() => [
    { x: 30, y: 70, street: 'طريق المحلة الكبرى - مدخل كفر الشيخ', status: 'متحرك الآن بسرعة 60 كم/س ⚡', client: 'متجه إلى سوبر ماركت الأمل 🏪', battery: '92% 🔋', lastUpdate: 'الآن' },
    { x: 45, y: 55, street: 'شارع الجلاء - أمام مسجد المتولي 🕌', status: 'متحرك الآن بسرعة 35 كم/س ⚡', client: 'متجه إلى سوبر ماركت الأمل 🏪', battery: '91% 🔋', lastUpdate: 'منذ دقيقة' },
    { x: 60, y: 40, street: 'ميدان الشون - وسط المدينة 🏙️', status: 'متوقف مؤقتاً بالزحام 5 كم/س ⚠️', client: 'متجه إلى سوبر ماركت الأمل 🏪', battery: '91% 🔋', lastUpdate: 'منذ دقيقتين' },
    { x: 75, y: 35, street: 'شارع السبع بنات - أمام سوبر ماركت الأمل 🏢', status: 'متوقف للتوريد وتنزيل الحمولة 0 كم/س 🛑', client: 'يورّد حالياً لبائع: سوبر ماركت الأمل 🏪', battery: '90% 🔋', lastUpdate: 'منذ 3 دقائق' },
    { x: 85, y: 48, street: 'حي الجمهورية - بجوار محطة الوقود ⛽', status: 'متحرك الآن بسرعة 40 كم/س ⚡', client: 'متجه إلى بقالة التوحيد والنور 🏪', battery: '89% 🔋', lastUpdate: 'الآن' },
    { x: 70, y: 75, street: 'شارع شكري القواتلي الرئيسي 🛣️', status: 'متحرك بسرعة 55 كم/س ⚡', client: 'متجه إلى عميل خارجي 🏭', battery: '88% 🔋', lastUpdate: 'الآن' },
  ], []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (subTab === 'manager_main' && managerSubTab === 'live_tracking' && isLiveTracking) {
      timer = setInterval(() => {
        setSimulatedPathStep((prev) => (prev + 1) % trackingSimulationData.length);
      }, 7000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [subTab, managerSubTab, isLiveTracking, trackingSimulationData]);

  const handleAskAI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiChatInput.trim() || isAskingAI) return;

    const userMessage = aiChatInput.trim();
    setAiChatInput('');
    setAiChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsAskingAI(true);

    try {
      // Find customer if search provided
      const matchedCustomer = aiChatCustomerSearch ? customers.find(c => c.name.includes(aiChatCustomerSearch) || c.phone.includes(aiChatCustomerSearch)) : null;
      let customerContext = '';
      if (matchedCustomer) {
        const custInvoices = invoices.filter(i => i.customerId === matchedCustomer.id);
        const totalSpent = custInvoices.reduce((sum, inv) => sum + inv.totalAfterDiscount, 0);
        customerContext = `\nإليك تفاصيل العميل كمرجع:\nاسم العميل: ${matchedCustomer.name}\nالمنطقة: ${matchedCustomer.area}\nإجمالي المسحوبات السابقة: ${totalSpent} ${currency}\n`;
      }

      const systemInstruction = `أنت خبير مبيعات وتسويق متخصص في السوق المحلي.
الأفكار والخطوط العريضة لسياسة البيع الخاصة بنا:
"${pitchGuidelines}"

العميل المستهدف ينتمي لفئة: ${aiChatCategory}.${customerContext}
المطلوب: قم بتقديم نصائح للتعامل، اقترح رسائل ترويجية، وأجب عن استفسارات المندوب بناءً على المعطيات أعلاه وفئة العميل. اجعل إجابتك واضحة، مهنية، وموجهة لتحقيق ديل جيد. استخدم تنسيق Markdown للخط العريض والقوائم.`;

      const response = await fetch(`${API_BASE_URL}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          history: aiChatHistory,
          message: userMessage
        })
      });

      if (!response.ok) {
        throw new Error('فشل في الاتصال بمساعد الذكاء الاصطناعي');
      }

      const data = await response.json();
      setAiChatHistory(prev => [...prev, { role: 'model', text: data.text }]);
    } catch (err: any) {
      alert("حدث خطأ أثناء التواصل مع الذكاء الاصطناعي: " + err.message);
      setAiChatHistory(prev => prev.slice(0, -1));
      setAiChatInput(userMessage);
    } finally {
      setIsAskingAI(false);
    }
  };

  // Local state for product pricing and weights margins table of all products
  const [editedProducts, setEditedProducts] = useState<Product[]>(products);

  // Sync state if products changes externally
  useEffect(() => {
    setEditedProducts(products);
  }, [products]);

  // Handle local changes to a productweight variable
  const handleWeightFieldChange = (
    productId: string,
    weightId: string,
    field: 'cartonPriceFromFactory' | 'unitsPerCarton' | 'addedValue',
    val: string
  ) => {
    setEditedProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      
      const currentWeights = p.weights && p.weights.length > 0 ? p.weights : getProductWeightsFallback(p);
      const updatedWeights = currentWeights.map(w => {
        if (w.id !== weightId) return w;
        
        const updatedWeight = { ...w, profitMarginPercent: 0 };
        const numValue: any = val === '' ? '' : (parseFloat(val) || 0);

        if (field === 'cartonPriceFromFactory') updatedWeight.cartonPriceFromFactory = numValue === '' ? 0 : numValue;
        if (field === 'unitsPerCarton') updatedWeight.unitsPerCarton = Math.max(1, parseInt(val) || 1);
        if (field === 'addedValue') updatedWeight.addedValue = val === '' ? 0 : (parseFloat(val) || 0);
        
        // Calculate dynamically per user's directive:
        // السعر الاساسي للكرتونة = سعر الكرتونة بالمصنع + القيمة المضافة
        // السعر النهائي للعبوة = السعر الاساسي للكرتونة / عدد العبوات
        const activeAddedValue = Number(updatedWeight.addedValue) || 0;
        const activeCartonPrice = Number(updatedWeight.cartonPriceFromFactory) || 0;
        const retailCarton = activeCartonPrice + activeAddedValue;
        const computedRetail = retailCarton / updatedWeight.unitsPerCarton;
        
        updatedWeight.retailPricePerUnit = Number(computedRetail.toFixed(3));
        return updatedWeight;
      });
      
      // Update baseline price of major product structure with first weight price
      const baselinePrice = updatedWeights[0]?.retailPricePerUnit || p.price;
      
      return {
        ...p,
        price: baselinePrice,
        weights: updatedWeights
      };
    }));
  };

  const handleSavePricesAndMargins = (e: React.FormEvent) => {
    e.preventDefault();
    editedProducts.forEach(p => {
      onEditProduct(p);
    });
    setSaveSuccessMsg('تم حفظ وتحديث قائمة الأسعار بنجاح!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      googleSheetsUrl: googleUrl.trim(),
      currency: currency.trim(),
      aiPitchGuidelines: pitchGuidelines.trim(),
      aiRetentionGuidelines: retentionGuidelines.trim(),
      representativeName: repName.trim(),
      representativePhone: repPhone.trim(),
      appName: invoiceAppName.trim()
    });
    setSaveSuccessMsg('تم حفظ الإعدادات بنجاح!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const salesStats = React.useMemo(() => {
    const totalSales = invoices.reduce((sum, inv) => sum + inv.totalAfterDiscount, 0);
    const totalSpent = (expenses || []).filter(e => e.type !== 'revenue').reduce((sum, exp) => sum + exp.amount, 0);
    const extraRevenues = (expenses || []).filter(e => e.type === 'revenue').reduce((sum, exp) => sum + exp.amount, 0);
    
    // totalSales = product sales. extraRevenues = external commission, etc.
    const netProfit = totalSales + extraRevenues - totalSpent;

    return {
      totalSales,
      totalSpent,
      netProfit,
    };
  }, [invoices, expenses]);

  const handleBulkSyncToGoogleSheets = async () => {
    if (!googleUrl) {
      setSyncStatus('fail');
      setSyncMsg('خطأ: لم يتم وضع رابط مزامنة جوجل.');
      return;
    }

    const isConfirmed = await confirmDialog("هل أنت متأكد من رغبتك في رفع ومزامنة كل البيانات الحالية مع جوجل شيت (Google Sheets) السحابي؟ هذه العملية قد تستغرق بعض الوقت.", false);
    if (!isConfirmed) return;

    setSyncStatus('syncing');
    setSyncMsg('جاري تحضير وتصدير حزم السجلات للقاعدة السحابية...');

    try {
      const payload = {
        type: 'تقرير_كامل',
        metadata: {
          syncedAt: new Date().toISOString(),
          app: 'نظام المبيعات والمخزون للسيارة',
          totalSales: salesStats.totalSales,
          totalExpenses: salesStats.totalSpent,
          netProfit: salesStats.netProfit
        },
        invoices: invoices.map(inv => {
          const cust = customers.find(c => c.id === inv.customerId);
          return {
            invNum: inv.invoiceNumber,
            customerName: cust ? cust.name : 'عميل مجهول',
            area: cust ? cust.area : 'منطقة مجهولة',
            date: inv.date,
            total: inv.totalAfterDiscount,
            notes: inv.notes
          };
        }),
        expenses: (expenses || []).map(e => ({
          date: e.date,
          amount: e.amount,
          category: e.category,
          description: e.description
        })),
        trips: (trips || []).map(t => ({
          description: t.description,
          price: t.price,
          status: t.collected ? 'محصلة' : 'غير محصلة',
          date: t.date || new Date().toISOString()
        })),
        products: products.map(p => ({
          name: p.name,
          price: p.price,
          count: p.weights ? p.weights.length : 0
        })),
        customers: customers.map(c => ({
          name: c.name,
          phone: c.phone,
          area: c.area
        }))
      };

      const resp = await fetch(googleUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });

      const result = await resp.json();
      if (result && result.status === 'success') {
        setSyncStatus('done');
        setSyncMsg('تم ترحيل البيانات السحابية بنجاح تام! تم إرسال كافة الفواتير المصدرة والماليات.');
      } else {
        throw new Error(result?.error || 'استجابة غير متوقعة من الخادم.');
      }
    } catch (err: any) {
      setSyncStatus('fail');
      setSyncMsg(`فشل الاتصال بسبب مشكلة بالشبكة. تفاصيل: ${err.message || err}`);
    }
  };



  // Customers Activity Classifier
  const customerAnalytics = useMemo(() => {
    return customers.map(cust => {
      const custInvoices = invoices.filter(inv => inv.customerId === cust.id);
      const invoicesCount = custInvoices.length;
      const totalSpent = custInvoices.reduce((sum, inv) => sum + inv.totalAfterDiscount, 0);
      
      const sortedInvoices = [...custInvoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastInvoiceDate = sortedInvoices[0] ? sortedInvoices[0].date : '';
      
      const isActive = invoicesCount > 0;
      
      return {
        ...cust,
        invoicesCount,
        totalSpent,
        lastInvoiceDate,
        isActive
      };
    });
  }, [customers, invoices]);

  // Local Search state for Products Pricing
  const [prodSearch, setProdSearch] = useState('');

  // Local Search and region control for Customers List
  const [custSearch, setCustSearch] = useState('');
  const [custAreaFilter, setCustAreaFilter] = useState('');
  const [custStatusTab, setCustStatusTab] = useState<'all' | 'active' | 'inactive'>('active');

  const areas = useMemo(() => {
    return Array.from(new Set(customers.map(c => c.area).filter(Boolean)));
  }, [customers]);

  const filteredCustomerAnalytics = useMemo(() => {
    return customerAnalytics.filter(c => {
      const matchesSearch = c.name.includes(custSearch) || c.phone.includes(custSearch);
      const matchesArea = !custAreaFilter || c.area === custAreaFilter;
      const matchesStatus = 
        custStatusTab === 'all' || 
        (custStatusTab === 'active' && c.isActive) || 
        (custStatusTab === 'inactive' && !c.isActive);
      return matchesSearch && matchesArea && matchesStatus;
    });
  }, [customerAnalytics, custSearch, custAreaFilter, custStatusTab]);

  const activeCount = customerAnalytics.filter(c => c.isActive).length;
  const inactiveCount = customerAnalytics.filter(c => !c.isActive).length;

  const handleAddNewUser = () => {
    if (!newUserName.trim() || !newUserPhone.trim()) {
      alert('يرجى كتابة الاسم ورقم الهاتف بالكامل لترخيص الحساب!');
      return;
    }
    const exists = usersList.some(u => u.phone === newUserPhone.trim());
    if (exists) {
      alert('رقم الهاتف هذا مسجل بالفعل لمستخدم آخر!');
      return;
    }

    let suffix = ' (مندوب)';
    let customRoleName = 'مندوب توزيع ومبيعات 🚚';
    let permittedTabs = ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses'];

    if (newUserType === 'visitor') {
      suffix = ' (زائر)';
      customRoleName = 'زائر للعرض الجاف فقط 👀';
      permittedTabs = ['dashboard', 'prices'];
    } else if (newUserType === 'supervisor') {
      suffix = ' (مشرف)';
      customRoleName = 'مشرف عام ومتابعة 🛡️';
      permittedTabs = ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'administrative', 'reports'];
    } else if (newUserType === 'leader') {
      suffix = ' (ليدر تيم)';
      customRoleName = 'ليدر تيم مبيعات 💼';
      permittedTabs = ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'reports'];
    }

    const nameLabel = `${newUserName.trim()}${suffix}`;

    const newUser: UserAuth = {
      name: nameLabel,
      phone: newUserPhone.trim(),
      role: 'employee',
      status: 'active',
      permittedTabs,
      customRoleName,
      permittedSubTabs: [
        'loads', 'products', 'previous_loads', 'factory_account', 'trips',
        'customers_list', 'invoice_create', 'invoice_balance',
        'expenses_list'
      ],
      password: newUserPassword.trim() || '1234',
      createdAt: new Date().toISOString()
    };

    const updated = [...usersList, newUser];
    onUpdateUsersList(updated);
    localStorage.setItem('users_permissions_sys', JSON.stringify(updated));

    setNewUserName('');
    setNewUserPhone('');
    setNewUserPassword('');
    alert(`تم بنجاح تسجيل الحساب بصفة "${customRoleName}" وتفعيل صلاحياته لـ "${newUserName}"!`);
  };

  const isOwner = currentUser?.phone === '01228466613';
  const isDelegateLockRequired = !isOwner && !isDelegateUnlocked;

  if (isDelegateLockRequired) {
    return (
      <div className="bg-[#F7FAFC] min-h-screen flex items-center justify-center p-4 text-right" dir="rtl">
        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-xl p-6 relative overflow-hidden flex flex-col gap-4">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-[#1A365D]"></div>
          
          <div className="text-center py-1">
            <div className="mx-auto w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-3 border border-indigo-100 shadow-xs">
              <SettingsIcon className="h-6 w-6 text-[#1A365D]" />
            </div>
            <h2 className="text-[#1A365D] text-sm font-black tracking-tight mb-2">دخول المندوب للوحة التحكم</h2>
            <p className="text-[10.5px] text-slate-500 font-bold leading-relaxed">
              للوصول للصلاحيات والأصناف المسموحة لك، يرجى كتابة رمز المرور المخصص لك:
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {delegateLoginError && (
              <div className="bg-red-50 border border-red-150 text-red-700 p-2 text-center font-bold text-[10.5px] rounded-xl">
                ⚠️ {delegateLoginError}
              </div>
            )}

            <input
              type="password"
              placeholder="اكتب كلمة مرور الإدارة الخاصة بك"
              value={delegateTypedPassword}
              onChange={(e) => {
                setDelegateTypedPassword(e.target.value);
                setDelegateLoginError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const targetUser = usersList.find(u => u.phone === currentUser?.phone);
                  const p = targetUser?.password || '1234';
                  if (delegateTypedPassword === p) {
                    setIsDelegateUnlocked(true);
                  } else {
                    setDelegateLoginError('كلمة المرور غير صحيحة! يرجى مراجعة المدير المالك.');
                  }
                }
              }}
              className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2 px-3 text-center font-black tracking-widest text-[#1A365D] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
            />

            <button
              onClick={() => {
                const targetUser = usersList.find(u => u.phone === currentUser?.phone);
                const p = targetUser?.password || '1234';
                if (delegateTypedPassword === p) {
                  setIsDelegateUnlocked(true);
                } else {
                  setDelegateLoginError('كلمة المرور غير صحيحة! يرجى مراجعة المدير المالك.');
                }
              }}
              className="w-full bg-[#1A365D] hover:bg-[#2B6CB0] text-white py-2.5 rounded-xl text-xs font-black transition-all shadow-sm active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>دخول آمن 🔐</span>
            </button>

            <button
              onClick={onGoBack}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
            >
              الرجوع للرئيسية ↩️
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12" id="manage-tab-container" dir="rtl">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-amber-300" />
          <h1 className="text-xl font-bold">لوحة تحكم الإدارة (عقل النظام)</h1>
        </div>
        <button
          onClick={onGoBack}
          className="bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 active:scale-95 text-white rounded-lg py-1.5 px-3.5 text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
        >
          <span className="text-indigo-100">الرئيسية</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
        
        {/* Navigation Tabs Bar */}
        <div className="flex bg-[#FFFFFF] border border-slate-200 p-1.5 rounded-2xl gap-1.5 shadow-xs font-bold text-center">
          <button
            type="button"
            onClick={() => setSubTab('products')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-xs transition-all cursor-pointer select-none ${
              subTab === 'products' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none font-black' : 'text-[#9CA3AF] bg-transparent border-transparent' }`}
          >
            <Tags className="h-4 w-4 shrink-0" />
            <span>الأصناف والتسعير</span>
          </button>
          
          <button
            type="button"
            onClick={() => setSubTab('ai_settings')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-xs transition-all cursor-pointer select-none ${
              subTab === 'ai_settings' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none font-black' : 'text-[#9CA3AF] bg-transparent border-transparent' }`}
          >
            <Sparkles className="h-4 w-4 shrink-0" style={{ borderColor: '#e8f80a' }} />
            <span>الذكاء الاصطناعي</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('db_ops')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-xs transition-all cursor-pointer select-none ${
              subTab === 'db_ops' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none font-black' : 'text-[#9CA3AF] bg-transparent border-transparent' }`}
          >
            <Database className="h-4 w-4 shrink-0" />
            <span>صيانة النظام</span>
          </button>

          {currentUser?.phone === '01228466613' && (
            <button
              type="button"
              onClick={() => {
                setSubTab('manager_main');
                setManagerSubTab('add_user_or_visitor');
              }}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-xs transition-all cursor-pointer select-none ${
                subTab === 'manager_main' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-b-[#DD6B20] shadow-sm rounded-none font-black' : 'text-[#9CA3AF] bg-transparent border-transparent' }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>المدير</span>
            </button>
          )}
        </div>

        {/* Dynamic Display of Sub Tabs */}
        
        {/* TAB 0: Admin / Manager Tab (لوحة تحكم المدير ومحاذاة المندوب والزائر) */}
        {subTab === 'manager_main' && !isManagerUnlocked && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4 text-right animate-fade-in max-w-sm mx-auto w-full">
            <div className="text-center py-2">
              <div className="mx-auto w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-700 mb-3 border border-amber-200 shadow-xs">
                <span className="text-xl">👑</span>
              </div>
              <h3 className="text-[#1A365D] text-sm font-black tracking-tight mb-1">الوصول لتبويب المدير العام مغلق 🔐</h3>
              <p className="text-[10px] text-slate-500 font-bold leading-normal">
                تبويب المدير خاص وحصري بالمدير المالك فقط ومحمي بكلمة مرور مشددة لمنع العبث بالصلاحيات
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {managerLoginError && (
                <div className="bg-red-50 border border-red-150 text-red-700 p-2 text-center font-bold text-xs rounded-xl">
                  {managerLoginError}
                </div>
              )}

              <input
                type="password"
                placeholder="امسح واكتب كلمة المرور العامة"
                value={managerTypedPassword}
                onChange={(e) => {
                  setManagerTypedPassword(e.target.value);
                  setManagerLoginError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const correct = localStorage.getItem('owner_passcode_sys') || '1987';
                    if (managerTypedPassword === correct) {
                      setIsManagerUnlocked(true);
                    } else {
                      setManagerLoginError('عذراً، الرقم السري للمالك غير صحيح!');
                    }
                  }
                }}
                className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2 px-4 text-center font-black tracking-widest focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm"
              />

              <button
                type="button"
                onClick={() => {
                  const correct = localStorage.getItem('owner_passcode_sys') || '1987';
                  if (managerTypedPassword === correct) {
                    setIsManagerUnlocked(true);
                  } else {
                    setManagerLoginError('عذراً، الرقم السري للمالك غير صحيح!');
                  }
                }}
                className="w-full bg-[#DD6B20] hover:bg-[#C05621] text-white py-2.5 rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
              >
                تأكيد الدخول الآمن للمالك
              </button>
            </div>
          </div>
        )}

        {subTab === 'manager_main' && isManagerUnlocked && (
          <div className="flex flex-col gap-4 animate-fade-in text-right">
            {/* Secondary Navigation inside Manager */}
            <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setManagerSubTab('live_tracking')}
                className={`flex-1 min-w-[120px] py-1.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer select-none text-center ${
                  managerSubTab === 'live_tracking' ? 'bg-[#FFFFFF] text-[#1A365D] shadow-sm font-extrabold' : 'text-slate-500 bg-transparent'
                }`}
              >
                📡 تتبع خط السير (GPS)
              </button>
              <button
                type="button"
                onClick={() => setManagerSubTab('user_permissions')}
                className={`flex-1 min-w-[120px] py-1.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer select-none text-center ${
                  managerSubTab === 'user_permissions' ? 'bg-[#FFFFFF] text-[#1A365D] shadow-sm font-extrabold' : 'text-slate-500 bg-transparent'
                }`}
              >
                🔐 بوابة الصلاحيات والتحقق
              </button>
              <button
                type="button"
                onClick={() => {
                  setManagerSubTab('google_integration');
                }}
                className={`flex-1 min-w-[120px] py-1.5 px-0.5 rounded-xl text-xs font-black transition-all cursor-pointer select-none text-center ${
                  managerSubTab === 'google_integration' ? 'bg-[#FFFFFF] text-[#1A365D] shadow-sm font-extrabold' : 'text-slate-500 bg-transparent'
                }`}
              >
                ☁️ مزامنة جوجل شيت
              </button>
            </div>

            {/* Sub-tab 1.5: Live Tracking and Activity Monitoring (مفصول عن الصلاحيات) */}
            {managerSubTab === 'live_tracking' && (
              <div className="flex flex-col gap-5 text-right animate-fade-in" dir="rtl">
                {/* A. GPS live tracking panel */}
                <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <h3 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">🛰️</span>
                    منظومة تتبع خط السير الجغرافي (GPS)
                  </h3>
                  
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-black text-[#2B6CB0]">تتبع هاتف المندوب:</label>
                        <select
                          value={trackedUserPhone}
                          onChange={(e) => setTrackedUserPhone(e.target.value)}
                          className="bg-white border border-slate-200 p-1 rounded-lg text-[11px] font-bold text-[#1A365D] focus:outline-none"
                        >
                          <option value="">-- اختر رقم هاتف مندوب نشط للتتبع --</option>
                          {usersList.filter(u => u.phone !== '01228466613').map(u => (
                            <option key={u.phone} value={u.phone}>{u.name} ({u.phone})</option>
                          ))}
                        </select>
                      </div>

                      {/* Toggle switch for continuous tracking */}
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isLiveTracking}
                          onChange={(e) => setIsLiveTracking(e.target.checked)}
                          className="rounded text-indigo-600 h-3.5 w-3.5"
                        />
                        <span>بث الـ GPS المستمر (المحاكي)</span>
                      </label>
                    </div>

                    {/* Tracking stats readout */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center mt-1 pt-2 border-t border-dashed border-slate-200">
                      <div className="bg-white rounded-lg p-2 border border-slate-100 text-center">
                        <span className="block text-[9px] text-gray-400 font-extrabold mb-0.5">مسح تتبع الهاتف:</span>
                        <span className="block text-[10px] text-emerald-700 font-black flex items-center gap-1 justify-center">
                          <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                          بث حي نشط
                        </span>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-slate-100 text-center">
                        <span className="block text-[9px] text-gray-400 font-extrabold mb-0.5">البطارية والشبكة:</span>
                        <span className="block text-[10px] text-slate-700 font-mono font-black border-none bg-transparent">
                          {trackingSimulationData[simulatedPathStep]?.battery || '90%'} | 5G
                        </span>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-slate-100 text-center">
                        <span className="block text-[9px] text-gray-400 font-extrabold mb-0.5 font-bold">السرعة والحالة:</span>
                        <span className="block text-[10px] text-amber-700 font-black">
                          {trackingSimulationData[simulatedPathStep]?.status?.split(' ')?.[2] || 'مستقر'} {trackingSimulationData[simulatedPathStep]?.status?.split(' ')?.[3] || 'متوقف'}
                        </span>
                      </div>
                      <div className="bg-[#1A365D]/5 rounded-lg p-2 border border-slate-200 text-center">
                        <span className="block text-[9px] text-indigo-900 font-extrabold mb-0.5">آخر رصد للقمر:</span>
                        <span className="block text-[10px] text-indigo-950 font-black">
                          {trackingSimulationData[simulatedPathStep]?.lastUpdate || 'الآن'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-sky-50 text-sky-950 border border-sky-100 p-2.5 rounded-lg text-xs leading-relaxed font-bold">
                      📍 <span className="text-[#2B6CB0]">المسار الحالي المرصود:</span> {trackingSimulationData[simulatedPathStep]?.street || 'طريق المحلة الكبرى الرئيسي'}
                      <br />
                      🎯 <span className="text-amber-800">حمل الزيوت الحالي:</span> {trackingSimulationData[simulatedPathStep]?.client || 'متوقف بالتوريد'}
                    </div>

                    {/* SVG Tactical Map Screen */}
                    <div className="relative w-full h-44 bg-slate-900 rounded-xl overflow-hidden border border-slate-850 shadow-inner flex items-center justify-center">
                      <div 
                        className="absolute inset-0 opacity-15"
                        style={{
                          backgroundImage: 'radial-gradient(circle, #38bdf8 1.5px, transparent 1.5px), linear-gradient(to right, #ffffff08 1px, transparent 1px), linear-gradient(to bottom, #ffffff08 1px, transparent 1px)',
                          backgroundSize: '24px 24px'
                        }}
                      />

                      <svg className="absolute inset-0 w-full h-full opacity-35" preserveAspectRatio="none">
                        <path d="M -10 50 L 500 130" stroke="#475569" strokeWidth="3" fill="none" />
                        <path d="M 120 -10 L 250 250" stroke="#475569" strokeWidth="2.5" fill="none" />
                        <path d="M 300 -10 L 150 250" stroke="#475569" strokeWidth="2" fill="none" strokeDasharray="3 3" />
                        <path d="M 0 100 Q 150 15 350 160" stroke="#475569" strokeWidth="4" fill="none" />
                        <path d="M 200 40 L 400 40" stroke="#334155" strokeWidth="2" fill="none" />
                        <path d="M 50 160 L 350 160" stroke="#334155" strokeWidth="1.5" fill="none" />
                        <circle cx="100" cy="80" r="15" stroke="#0ea5e9" strokeWidth="1" fill="none" strokeDasharray="2 2" />
                        <circle cx="280" cy="120" r="22" stroke="#0eb5e9" strokeWidth="1" fill="none" strokeDasharray="2 2" />
                        <circle cx="450" cy="110" r="18" stroke="#0eb5e9" strokeWidth="1" fill="none" strokeDasharray="2 2" />
                      </svg>

                      <div className="absolute top-[35px] left-[65px] bg-[#1e293b]/90 border border-sky-500/20 px-1 text-[8px] text-sky-400 font-mono rounded">حي الجمهورية</div>
                      <div className="absolute bottom-[25px] right-[45px] bg-[#1e293b]/90 border border-emerald-500/20 px-1 text-[8px] text-emerald-400 font-mono rounded">كفر الشيخ</div>
                      <div className="absolute top-[10px] right-[105px] bg-[#1e293b]/90 border border-amber-500/20 px-1 text-[8px] text-amber-400 font-mono rounded">شارع الجلاء</div>

                      <div 
                        className="absolute transition-all duration-[2000ms] ease-in-out"
                        style={{
                          left: `${trackingSimulationData[simulatedPathStep]?.x || 50}%`,
                          top: `${trackingSimulationData[simulatedPathStep]?.y || 50}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <div className="absolute -inset-4 bg-[#f43f5e] rounded-full opacity-35 animate-ping" />
                        <div className="absolute -inset-2 bg-[#f43f5e] rounded-full opacity-60 animate-pulse" />
                        <div className="relative h-6 w-6 bg-rose-600 rounded-full border border-white flex items-center justify-center shadow-lg text-white font-extrabold text-[10px]">
                          🚚
                        </div>
                      </div>

                      <div className="absolute top-2 left-2 text-[9px] text-sky-400 font-mono opacity-80 select-none">GPS LOCK // 5G LINK</div>
                      <div className="absolute bottom-2 left-2 text-[9px] text-[#f43f5e] font-mono opacity-80 select-none">EAG UNIT // ACTIVE</div>
                      <div className="absolute top-2 right-2 text-[9px] text-emerald-400 font-mono opacity-80 select-none flex items-center gap-1">
                        <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                        ONLINE
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSimulatedPathStep((prev) => (prev + 1) % trackingSimulationData.length);
                        }}
                        className="absolute bottom-2 right-2 bg-slate-800/90 hover:bg-slate-700 hover:text-white border border-slate-700 text-slate-300 rounded p-1 px-1.5 text-[8px] font-bold cursor-pointer transition-colors"
                      >
                         تحديث المحاكاة 🔄
                      </button>
                    </div>
                  </div>
                </div>

                {/* B. Operational tracking and guarantee of hard work (النشاط والإنتاجية المباشرة لضمان العمل) */}
                <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <h3 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">📈</span>
                    التتبع العملي والإنتاجي للمناديب (نبض النشاط بالفواتير)
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                    إلى جانب تتبع الموقع الجغرافي، يمكنك هنا قياس مدى التزام وفاعلية المندوب في الشارع عبر مراقبة نبض المبيعات المباشرة وتوقيت الفواتير وحجم التحصيل النقدي خطوة بخطوة:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-150 text-center">
                      <span className="block text-[10px] text-slate-500 font-black mb-1">إجمالي الفواتير الصادرة اليوم</span>
                      <span className="text-xl font-extrabold text-emerald-700">
                        {invoices.length} فواتير
                      </span>
                    </div>
                    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-150 text-center">
                      <span className="block text-[10px] text-slate-500 font-black mb-1">إجمالي الإيراد الميداني اليوم</span>
                      <span className="text-xl font-extrabold text-blue-700">
                        {formatNum(invoices.reduce((sum, inv) => sum + inv.totalAfterDiscount, 0))} ج.م
                      </span>
                    </div>
                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-150 text-center">
                      <span className="block text-[10px] text-slate-500 font-black mb-1">إجمالي التحصيل النقدي</span>
                      <span className="text-xl font-extrabold text-amber-700">
                        {formatNum(invoices.reduce((sum, inv) => sum + inv.paidAmount, 0))} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Real-time event log of recent invoices */}
                  <div className="border border-slate-150 rounded-xl overflow-hidden mt-2">
                    <div className="bg-slate-50 p-2 px-3 border-b border-slate-150 text-xs font-black text-[#1A365D] flex justify-between">
                      <span>سجل الحركة البيعية النشطة اليوم (تتبع الإنتاجية)</span>
                      <span className="text-[10px] text-slate-400">محدث الآن 📡</span>
                    </div>
                    {invoices.length === 0 ? (
                      <div className="p-6 text-center text-xs font-bold text-slate-400 bg-white">
                        لم يتم تسجيل أي فواتير بيع ميداني اليوم حتى الآن.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                        {[...invoices].reverse().map((inv) => {
                          const customer = customers.find(c => c.id === inv.customerId);
                          const totalItemsCount = inv.items.reduce((sum, it) => sum + it.quantity, 0);
                          return (
                            <div key={inv.id} className="p-2.5 px-3 flex justify-between items-center text-xs hover:bg-indigo-50/20 transition-all">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-black text-[#1A365D]">
                                  فاتورة #{inv.invoiceNumber} • {customer?.name || 'عميل مجهول'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  باع {totalItemsCount} عبوة • {customer?.area || 'بدون منطقة'} • بقيمة {formatNum(inv.totalAfterDiscount)} ج.م
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] font-mono font-black text-slate-500">
                                  {inv.date ? inv.date.substring(11, 16) || 'الآّن' : 'الآن'}
                                </span>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                  inv.paidAmount >= inv.totalAfterDiscount
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inv.paidAmount > 0 
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {inv.paidAmount >= inv.totalAfterDiscount 
                                    ? 'خالص نقداً' 
                                    : inv.paidAmount > 0 
                                    ? 'متبقي جزء' 
                                    : 'آجل بالكامل'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 1.7: Custom Permissions and Expandable Folded List (بوابة التحقق ونظام المطويات) */}
            {managerSubTab === 'user_permissions' && (
                <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <h3 className="font-bold text-[#1A365D] text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">🛡️</span>
                    بوابة التحقق وتأمين صلاحيات أرقام الهواتف (هوية وصلاحيات المناديب والزوّار)
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                    تظهر هنا طلبات تسجيل الدخول برقم الهاتف من المناديب. يمكنك تفعيل المندوب من حاله الترقب (قيد الانتظار) إلى حساب نشط، لتفويضه برؤية تبويبات أو جرد فرعي محدد. التبويبات الملغاة تختفي عنه تماماً.
                  </p>

                  {/* Create New User Section */}
                  <div className="border border-indigo-100 rounded-2xl p-4 bg-indigo-50/20 flex flex-col gap-3">
                    <span className="text-xs font-black text-[#1A365D] flex items-center gap-1.5">
                      👤 تسجيل وإضافة مندوب مبيعات أو زائر جديد مباشرة:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">الاسم بالكامل:</label>
                        <input
                          type="text"
                          placeholder="مثال: أحمد عبد الله"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">رقم الهاتف النشط:</label>
                        <input
                          type="text"
                          placeholder="مثال: 01012345678"
                          value={newUserPhone}
                          onChange={(e) => setNewUserPhone(e.target.value)}
                          className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">نوع المندوب والصلاحية:</label>
                        <select
                          value={newUserType}
                          onChange={(e) => setNewUserType(e.target.value)}
                          className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D] outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="delegate">مندوب مبيعات وتوزيع 🚚</option>
                          <option value="visitor">زائر للعرض الجاف فقط 👀</option>
                          <option value="supervisor">مشرف عام ومتابعة حركات 🛡️</option>
                          <option value="leader">ليدر تيم جرد وتحكم 💼</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">رمز المرور للوحة المندوب:</label>
                        <input
                          type="password"
                          placeholder="الافتراضي 1234"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNewUser}
                      className="w-full bg-[#1A365D] hover:bg-indigo-900 text-white rounded-xl py-2 text-xs font-black transition-all active:scale-95 cursor-pointer mt-1 flex items-center justify-center gap-1.5"
                    >
                      <span>➕ إنشاء وترخيص الحساب الحالي للمندوب</span>
                    </button>
                  </div>

                  {usersList.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-150 text-xs font-bold text-slate-400">
                      لا يوجد مستخدمون مسجلون بعد. سيتم ظهورهم بمجرد تسجيل الدخول برقم الهاتف لأول مرة.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3.5" dir="rtl">
                      {usersList.map((user) => {
                        const isSelf = Boolean(currentUser && currentUser.phone === user.phone);
                        return (
                          <div
                            key={user.phone}
                            className={`p-4 rounded-2xl border transition-all text-right ${
                              isSelf 
                                ? 'bg-indigo-50/70 border-indigo-200 shadow-sm' 
                                : 'bg-slate-50/50 border-slate-150 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-3">
                              <div 
                                className="flex flex-col cursor-pointer select-none flex-1 group"
                                onClick={() => setExpandedUserPhone(expandedUserPhone === user.phone ? null : user.phone)}
                              >
                                <span className="font-black text-xs text-[#1A365D] flex items-center gap-1.5 flex-wrap group-hover:text-indigo-600 transition-colors">
                                  <span>{expandedUserPhone === user.phone ? '▼' : '▶'}</span>
                                  <span>{user.name}</span>
                                  {isSelf && (
                                    <span className="text-[9px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.5 rounded">
                                      حسابك الحالي
                                    </span>
                                  )}
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${
                                    user.role === 'owner' 
                                      ? 'bg-amber-100 text-amber-800 border-amber-200' 
                                      : user.customRoleName 
                                        ? 'bg-purple-100 text-purple-800 border-purple-200' 
                                        : user.phone === '01281391552' 
                                          ? 'bg-indigo-100 text-indigo-800 border-indigo-200' 
                                          : 'bg-blue-100 text-blue-800 border-blue-200'
                                  }`}>
                                    {user.customRoleName || (user.role === 'owner' ? 'المدير العام 👑' : user.phone === '01281391552' ? 'نائب المدير والاشراف 💼' : user.name.includes('(زائر)') ? 'زائر 👀' : 'مندوب مبيعات 💼')}
                                  </span>
                                </span>
                                <span className="text-xs text-slate-500 font-mono font-black mt-0.5">
                                  رقم الهاتف: {user.phone}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isSelf) {
                                      alert('لا يمكنك تعطيل صلاحية حسابك النشط حالياً!');
                                      return;
                                    }
                                    const updated = usersList.map(u => 
                                      u.phone === user.phone 
                                        ? { ...u, status: (u.status === 'active' ? 'pending' : 'active') as 'pending' | 'active' } 
                                        : u
                                    );
                                    onUpdateUsersList(updated);
                                    localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                  }}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-colors cursor-pointer ${
                                    user.status === 'active'
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-amber-100 text-amber-800 hover:bg-amber-150'
                                  }`}
                                >
                                  {user.status === 'active' ? '✓ حساب مفعّل' : '⏳ قيد الانتظار'}
                                </button>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (isSelf) {
                                      alert('حسابك الحالي قيد الاستخدام ولا يمكن حذفه.');
                                      return;
                                    }
                                    if (window.confirm(`هل أنت متأكد من حذف حساب المندوب "${user.name}" وسحب كامل صلاحياته؟`)) {
                                      const updated = usersList.filter(u => u.phone !== user.phone);
                                      onUpdateUsersList(updated);
                                      localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                    }
                                  }}
                                  className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-xs"
                                  title="حذف المستخدم نهائياً"
                                >
                                  ❌
                                </button>
                              </div>
                            </div>

                            {/* Tab Permissions Toggles (نظام المطويات) */}
                            {expandedUserPhone === user.phone && (
                              <div className="bg-white/80 p-4 rounded-xl border border-slate-200/50 mt-3 animate-fade-in">
                                {/* Password Viewer & Editor */}
                                <div className="mb-4 p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl flex flex-col gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                                    <span className="text-sm">🔑</span>
                                    <span>رمز المرور (الباسورد) الحالي للمندوب:</span>
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                    <input
                                      type="text"
                                      value={user.password || '1234'}
                                      onChange={(e) => {
                                        const newPass = e.target.value;
                                        const updated = usersList.map(u => 
                                          u.phone === user.phone ? { ...u, password: newPass } : u
                                        );
                                        onUpdateUsersList(updated);
                                        localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                        
                                        // Bug Fix: مزامنة كلمة مرور المدير العام بشكل فعلي في التخزين
                                        if (user.phone === '01228466613' || user.role === 'owner') {
                                          localStorage.setItem('owner_passcode_sys', newPass);
                                        }
                                      }}
                                      className="bg-white border border-slate-300 focus:outline-none focus:border-[#DD6B20] focus:ring-1 focus:ring-[#DD6B20] rounded-lg px-2.5 py-1.5 text-xs text-[#1A365D] font-extrabold w-full sm:w-48 text-center"
                                      placeholder="مثال: 1234"
                                    />
                                    <span className="text-[10px] text-amber-900 font-extrabold leading-normal">
                                      💡 هذا الرمز يظهر لك الآن بوضوح لمنع النسيان. يمكنك تعديله مباشرة هنا وسيقوم المندوب باستخدامه لتسجيل الدخول الفوري برقم هاتفه.
                                    </span>
                                  </div>
                                </div>

                                {/* Custom Job Role Title (تعديل المسميات) */}
                                <div className="mb-4 p-3 bg-purple-50/60 border border-purple-200/60 rounded-xl flex flex-col gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-purple-950">
                                    <span className="text-sm">🏷️</span>
                                    <span>المسمى الوظيفي والدور (تعديل اللقب مثل مشرف، ليدر تيم، زائر):</span>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                      <input
                                        type="text"
                                        value={localRoleNames[user.phone] !== undefined ? localRoleNames[user.phone] : (user.customRoleName || '')}
                                        onChange={(e) => {
                                          const newRole = e.target.value;
                                          setLocalRoleNames(prev => ({ ...prev, [user.phone]: newRole }));
                                        }}
                                        className="bg-white border border-slate-300 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 rounded-lg px-2.5 py-1.5 text-xs text-[#1A365D] font-extrabold w-full sm:w-64 text-right"
                                        placeholder="مثال: ليدر تيم، مشرف مبيعات، زائر..."
                                      />
                                      
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const targetVal = localRoleNames[user.phone] !== undefined ? localRoleNames[user.phone] : (user.customRoleName || '');
                                          if (window.confirm(`هل أنت متأكد من تعديل المسمى الوظيفي لـ "${user.name}" إلى "${targetVal || 'مندوب مبيعات 💼'}"؟`)) {
                                            const updated = usersList.map(u => 
                                              u.phone === user.phone ? { ...u, customRoleName: targetVal } : u
                                            );
                                            onUpdateUsersList(updated);
                                            localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                            alert('تم تعديل وحفظ المسمى الوظيفي بنجاح! ✓');
                                          }
                                        }}
                                        className="bg-purple-800 hover:bg-purple-900 text-white rounded-lg px-3 py-1.5 text-xs font-black tracking-wide transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 flex items-center justify-center gap-1"
                                      >
                                        <span>💾</span>
                                        <span>تأكيد وحفظ المسمى</span>
                                      </button>
                                      
                                      <span className="text-[10px] text-purple-900 font-extrabold leading-normal">
                                        💡 اكتب أي مسمى مخصص هنا واضغط على زر التأكيد ليظهر بالهوية.
                                      </span>
                                    </div>

                                    {localRoleNames[user.phone] !== undefined && localRoleNames[user.phone] !== (user.customRoleName || '') && (
                                      <div className="text-[10px] text-amber-600 font-extrabold flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg p-1.5 animate-pulse">
                                        <span>⚠️</span>
                                        <span>تنبيه: التغييرات التي أجريتها بالمسودّة لم تُحفظ بعد. اضغط على زر "تأكيد وحفظ المسمى" لحقن اللقب الفيكسي بالصلاحية.</span>
                                      </div>
                                    )}

                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      <span className="text-[10px] text-slate-500 font-bold self-center">تسمية سريعة:</span>
                                      {[
                                        { label: 'مشرف عام ومتابعة 🛡️', role: 'مشرف عام ومتابعة 🛡️' },
                                        { label: 'ليدر تيم 💼', role: 'ليدر تيم 💼' },
                                        { label: 'مندوب توزيع 🚚', role: 'مندوب توزيع 🚚' },
                                        { label: 'زائر للعرض فقط 👀', role: 'زائر للعرض فقط 👀' }
                                      ].map((presetRole) => (
                                        <button
                                          key={presetRole.label}
                                          type="button"
                                          onClick={() => {
                                            setLocalRoleNames(prev => ({ ...prev, [user.phone]: presetRole.role }));
                                          }}
                                          className="text-[10px] font-black bg-white hover:bg-purple-100 text-purple-900 border border-purple-200 px-2 py-1 rounded-md transition-all cursor-pointer shadow-sm active:scale-95"
                                        >
                                          {presetRole.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Presets for full permissions (قالب الصلاحيات العام) */}
                                <div className="mb-4 p-3 bg-indigo-50/60 border border-indigo-200/60 rounded-xl flex flex-col gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                                    <span className="text-sm font-bold">🔘</span>
                                    <span>نماذج الصلاحيات السريعة (تطبيق جاهز بضغطة واحدة):</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-bold mb-1 leading-normal">
                                    عند اختيار أي نموذج بالأسفل، سيتم تهيئة التفعيلات وصنايق التبويبات بالكامل فوراً لتطابق هذا الدور لتسهيل العمل:
                                  </p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = usersList.map(u => 
                                          u.phone === user.phone 
                                            ? { 
                                                ...u, 
                                                customRoleName: 'زائر للعرض فقط 👀', 
                                                permittedTabs: ['dashboard', 'prices'] 
                                              } 
                                            : u
                                        );
                                        onUpdateUsersList(updated);
                                        localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                        alert('تم تطبيق قالب (الزائر): تفعيل عرض المنتجات والأسعار فقط.');
                                      }}
                                      className="p-2 text-right rounded-xl bg-white border border-slate-200 hover:bg-amber-50 hover:border-amber-300 transition-all cursor-pointer shadow-sm active:scale-95 flex flex-col justify-between"
                                    >
                                      <span className="text-xs font-black text-amber-950 flex items-center gap-1">
                                        <span>👀</span>
                                        <span>قالب زائر לעرض الأسعار</span>
                                      </span>
                                      <span className="text-[9px] text-slate-500 font-bold mt-1 text-right">يعرض المنتجات والأسعار الصافية فقط</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = usersList.map(u => 
                                          u.phone === user.phone 
                                            ? { 
                                                ...u, 
                                                customRoleName: 'مندوب توزيع ومبيعات 🚚', 
                                                permittedTabs: ['dashboard', 'invoice', 'customers'] 
                                              } 
                                            : u
                                        );
                                        onUpdateUsersList(updated);
                                        localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                        alert('تم تطبيق قالب (مندوب): تفعيل الفواتير، العملاء، والرئيسية للمبيعات الميدانية.');
                                      }}
                                      className="p-2 text-right rounded-xl bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer shadow-sm active:scale-95 flex flex-col justify-between"
                                    >
                                      <span className="text-xs font-black text-blue-950 flex items-center gap-1">
                                        <span>🚚</span>
                                        <span>قالب مندوب مبيعات وتوزيع</span>
                                      </span>
                                      <span className="text-[9px] text-slate-500 font-bold mt-1 text-right">فواتير بيع + تتبع عملاء + جرد سيارة</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = usersList.map(u => 
                                          u.phone === user.phone 
                                            ? { 
                                                ...u, 
                                                customRoleName: 'ليدر تيم مبيعات 💼', 
                                                permittedTabs: ['dashboard', 'invoice', 'customers', 'prices', 'reports'] 
                                              } 
                                            : u
                                        );
                                        onUpdateUsersList(updated);
                                        localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                        alert('تم تطبيق قالب (ليدر تيم): تفعيل المبيعات مع التقارير بلمسات مرنة.');
                                      }}
                                      className="p-2 text-right rounded-xl bg-white border border-slate-200 hover:bg-[#DEEAF6] hover:border-indigo-300 transition-all cursor-pointer shadow-sm active:scale-95 flex flex-col justify-between"
                                    >
                                      <span className="text-xs font-black text-indigo-950 flex items-center gap-1">
                                        <span>💼</span>
                                        <span>قالب ليدر جرد ومتابعة</span>
                                      </span>
                                      <span className="text-[9px] text-slate-500 font-bold mt-1 text-right">جرد + توزيع + أسعار وعرض تقارير</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = usersList.map(u => 
                                          u.phone === user.phone 
                                            ? { 
                                                ...u, 
                                                customRoleName: 'مشرف عام ومتابعة 🛡️', 
                                                permittedTabs: ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'reports'] 
                                              } 
                                            : u
                                        );
                                        onUpdateUsersList(updated);
                                        localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                        alert('تم تطبيق قالب (مشرف عام): تفعيل كافة التبويبات للمتابعة وللاشراف دون المالك.');
                                      }}
                                      className="p-2 text-right rounded-xl bg-white border border-slate-200 hover:bg-[#E2F0D9] hover:border-emerald-300 transition-all cursor-pointer shadow-sm active:scale-95 flex flex-col justify-between"
                                    >
                                      <span className="text-xs font-black text-emerald-950 flex items-center gap-1">
                                        <span>🛡️</span>
                                        <span>قالب مشرف عام ومتابع حركة</span>
                                      </span>
                                      <span className="text-[9px] text-slate-500 font-bold mt-1 text-right">صلاحيات رؤية حوامل مصنع ونقص وسيرفر تحكم</span>
                                    </button>
                                  </div>
                                </div>

                              <span className="block text-xs font-black text-[#1A365D] mb-3">الصلاحيات والتبويبات المسموح فتحها وتفويضها:</span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {([ 
                                  { id: 'dashboard', name: 'الرئيسية 📊', disabled: true },
                                  { id: 'factory', name: 'المصنع 🏭' },
                                  { id: 'customers', name: 'العملاء 👥' },
                                  { id: 'invoice', name: 'الفواتير 🧾' },
                                  { id: 'prices', name: 'الأسعار 🏷️' },
                                  { id: 'expenses', name: 'المصروفات 💸' },
                                  { id: 'administrative', name: 'المدير (التحكم الكامل) ⚙️' },
                                  { id: 'reports', name: 'التقارير 📊' },
                                ] as Array<{ id: string; name: string; disabled?: boolean }> ).map((tab) => {
                                  const isAllowed = tab.id === 'dashboard' || user.permittedTabs.includes(tab.id);
                                  const subTabs = getSubTabsForTab(tab.id);
                                  return (
                                    <div key={tab.id} className={`p-2.5 rounded-xl border transition-all ${isAllowed ? 'bg-indigo-50/40 border-indigo-150' : 'bg-slate-50/75 border-transparent'}`}>
                                      <label
                                        className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer select-none ${
                                          isAllowed 
                                            ? 'text-indigo-950 font-black' 
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          disabled={!!tab.disabled || Boolean(isSelf && tab.id === 'administrative')}
                                          checked={isAllowed}
                                          onChange={() => {
                                            if (tab.id === 'dashboard') return;
                                            if (isSelf && tab.id === 'administrative') {
                                              alert('لا تلغِ وصولك لصفحة الإداريات لتفادي غلق لوحة التحكم عن نفسك!');
                                              return;
                                            }

                                            let newTabs = [...user.permittedTabs];
                                            if (newTabs.includes(tab.id)) {
                                              newTabs = newTabs.filter(x => x !== tab.id);
                                            } else {
                                              newTabs.push(tab.id);
                                            }

                                            const updated = usersList.map(u => 
                                              u.phone === user.phone 
                                                ? { ...u, permittedTabs: newTabs } 
                                                : u
                                            );
                                            onUpdateUsersList(updated);
                                            localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                          }}
                                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer accent-[#1A365D]"
                                        />
                                        <span>{tab.name}</span>
                                      </label>

                                      {/* Optional Nested Sub-tabs */}
                                      {isAllowed && subTabs.length > 0 && (
                                        <div className="bg-white mt-1.5 p-2 rounded-lg border border-slate-100 flex flex-col gap-1.5 mr-4 animate-fade-in text-right">
                                          <span className="text-[10px] text-amber-600 font-extrabold block mb-0.5" dir="rtl">حدود رؤية وتفويض {tab.name}:</span>
                                          {subTabs.map((sub) => {
                                            const subAllowed = !user.permittedSubTabs || user.permittedSubTabs.length === 0 || user.permittedSubTabs.includes(sub.id);
                                            return (
                                              <label key={sub.id} className={`flex items-center gap-1.5 text-[11px] font-black cursor-pointer hover:text-indigo-900 select-none ${subAllowed ? 'text-slate-800' : 'text-slate-400 font-normal line-through'}`}>
                                                <input
                                                  type="checkbox"
                                                  checked={subAllowed}
                                                  onChange={() => {
                                                    let currentSubTabs = user.permittedSubTabs ? [...user.permittedSubTabs] : [
                                                      'loads', 'products', 'previous_loads', 'factory_account', 'trips',
                                                      'customers_list', 'customers_maps_finder', 'invoice_create', 'invoice_balance',
                                                      'expenses_list', 'reports_finance', 'reports_stats', 'reports_areas', 'reports_invoices'
                                                    ];
                                                    if (currentSubTabs.includes(sub.id)) {
                                                      currentSubTabs = currentSubTabs.filter(x => x !== sub.id);
                                                    } else {
                                                      currentSubTabs.push(sub.id);
                                                    }

                                                    const updated = usersList.map(u => 
                                                      u.phone === user.phone 
                                                        ? { ...u, permittedSubTabs: currentSubTabs } 
                                                        : u
                                                    );
                                                    onUpdateUsersList(updated);
                                                    localStorage.setItem('users_permissions_sys', JSON.stringify(updated));
                                                  }}
                                                  className="rounded border-slate-300 text-amber-500 h-3.5 w-3.5 cursor-pointer accent-[#DD6B20]"
                                                />
                                                <span>{sub.name}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
            )}

            {/* Sub-tab 3: Google spreadsheet integration (نقل إعدادات جوجل داخل التبويب) */}
            {managerSubTab === 'google_integration' && (
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fade-in text-right">
                <h3 className="font-bold text-[#1A365D] text-base flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <FileSpreadsheet className="h-5 w-5 text-[#DD6B20]" />
                  ربط جوجل شيت والترحيل السحابي (محمي بكلمة مرور)
                </h3>

                {!isGooglePasswordValid ? (
                  <div className="flex flex-col gap-3">
                    <label className="block text-sm font-bold text-[#2B6CB0] mb-1 font-black text-right">يرجى إدخال كلمة المرور للوصول إلى الربط والأهمية:</label>
                    <input
                      type="password"
                      placeholder="امسح واكتب كلمة المرور"
                      value={googlePassword}
                      onChange={(e) => setGooglePassword(e.target.value)}
                      onKeyDown={(e) => {
                        const correctPass = localStorage.getItem('owner_passcode_sys') || '1987';
                        if (e.key === 'Enter' && googlePassword === correctPass) {
                          setIsGooglePasswordValid(true);
                        }
                      }}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-center focus:ring-1 focus:ring-amber-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const correctPass = localStorage.getItem('owner_passcode_sys') || '1987';
                        if (googlePassword === correctPass) {
                          setIsGooglePasswordValid(true);
                        } else {
                          alert('كلمة المرور غير صحيحة!');
                        }
                      }}
                      className="w-full bg-[#DD6B20] text-white rounded-lg py-2.5 text-xs font-bold hover:bg-[#C05621] active:scale-95 transition-all cursor-pointer"
                    >
                      تأكيد الدخول الآمن
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5 text-right animate-fade-in">
                    <div>
                      <label className="block text-xs font-bold text-[#2B6CB0] mb-1">رابط تطبيق الويب لجوجل (Google Web App URL):</label>
                      <input
                        type="url"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={googleUrl}
                        onChange={(e) => setGoogleUrl(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs text-left font-mono focus:ring-1 focus:ring-indigo-500"
                        style={{ direction: 'ltr' }}
                      />
                      <p className="text-[10px] text-gray-500 mt-1 leading-normal font-semibold">
                        عند إضافة هذا الرابط، يقوم التطبيق بمزامنة المبيعات والمصروفات فوراً وتحديث ملف الأكسل السحابي لجوجل شيت تلقائياً.
                      </p>
                    </div>
                    
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-right">
                      <details className="text-xs">
                        <summary className="font-bold text-emerald-800 cursor-pointer select-none text-right">طريقة تجهيز سكربت جوجل شيت لتقسيم الفواتير والماليات 🛠️</summary>
                        <div className="mt-2 text-[#1A365D] space-y-2">
                          <p>1. قم بإنشاء ملف Google Sheets جديد.</p>
                          <p>2. اذهب إلى Extensions (الإضافات) &gt; Apps Script.</p>
                          <p>3. امسح الكود الموجود وضع كود الـ doPost لتقسيم التبويبات والمزامنة.</p>
                          <div className="relative mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                const scriptCode = `function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    if (data.type === 'تقرير_كامل') {
      var invoicesSheet = ss.getSheetByName('الفواتير');
      if (!invoicesSheet) {
        invoicesSheet = ss.insertSheet('الفواتير');
        invoicesSheet.appendRow(['التاريخ', 'رقم الفاتورة', 'العميل', 'المنطقة', 'إجمالي الفاتورة', 'الملاحظات']);
      }
      if (data.invoices && data.invoices.length > 0) {
        if (invoicesSheet.getLastRow() > 1) {
          invoicesSheet.getRange(2, 1, invoicesSheet.getLastRow() - 1, invoicesSheet.getLastColumn()).clearContent();
        }
        var invoiceRows = data.invoices.map(function(inv) {
          return [inv.date, inv.invNum, inv.customerName, inv.area, inv.total, inv.notes || ''];
        });
        invoicesSheet.getRange(2, 1, invoiceRows.length, invoiceRows[0].length).setValues(invoiceRows);
      }
      var expensesSheet = ss.getSheetByName('الماليات');
      if (!expensesSheet) {
        expensesSheet = ss.insertSheet('الماليات');
        expensesSheet.appendRow(['التاريخ', 'الفئة', 'المبلغ', 'البيان']);
      }
      if (data.expenses && data.expenses.length > 0) {
        if (expensesSheet.getLastRow() > 1) {
          expensesSheet.getRange(2, 1, expensesSheet.getLastRow() - 1, expensesSheet.getLastColumn()).clearContent();
        }
        var expenseRows = data.expenses.map(function(exp) {
          return [exp.date, exp.category, exp.amount, exp.description || ''];
        });
        expensesSheet.getRange(2, 1, expenseRows.length, expenseRows[0].length).setValues(expenseRows);
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({"status": "ignored"})).setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`;
                                navigator.clipboard.writeText(scriptCode);
                                setScriptCopied(true);
                                setTimeout(() => setScriptCopied(false), 2000);
                              }}
                              className="absolute right-2 top-2 bg-slate-700 hover:bg-slate-600 text-slate-200 p-1.5 rounded-md transition-colors cursor-pointer z-10 flex items-center justify-center animate-in fade-in"
                              title="نسخ الكود"
                            >
                              {scriptCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                            <pre className="bg-[#1A365D] text-white border-transparent text-emerald-100 p-3 pt-9 rounded-lg text-left text-[10px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap user-select-all" dir="ltr">
{`function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    if (data.type === 'تقرير_كامل') {
      var invoicesSheet = ss.getSheetByName('الفواتير');
      if (!invoicesSheet) {
        invoicesSheet = ss.insertSheet('الفواتير');
        invoicesSheet.appendRow(['التاريخ', 'رقم الفاتورة', 'العميل', 'المنطقة', 'إجمالي الفاتورة', 'الملاحظات']);
        invoicesSheet.getRange(1, 1, 1, invoicesSheet.getLastColumn()).setFontWeight("bold").setBackground("#cfe2f3");
      }
      if (data.invoices && data.invoices.length > 0) {
        if (invoicesSheet.getLastRow() > 1) {
          invoicesSheet.getRange(2, 1, invoicesSheet.getLastRow() - 1, invoicesSheet.getLastColumn()).clearContent();
        }
        var invoiceRows = data.invoices.map(function(inv) {
          return [inv.date, inv.invNum, inv.customerName, inv.area, inv.total, inv.notes || ''];
        });
        invoicesSheet.getRange(2, 1, invoiceRows.length, invoiceRows[0].length).setValues(invoiceRows);
      }
      
      var expensesSheet = ss.getSheetByName('الماليات');
      if (!expensesSheet) {
        expensesSheet = ss.insertSheet('الماليات');
        expensesSheet.appendRow(['التاريخ', 'الفئة', 'المبلغ', 'البيان']);
        expensesSheet.getRange(1, 1, 1, expensesSheet.getLastColumn()).setFontWeight("bold").setBackground("#e0e0e0");
      }
      if (data.expenses && data.expenses.length > 0) {
        if (expensesSheet.getLastRow() > 1) {
          expensesSheet.getRange(2, 1, expensesSheet.getLastRow() - 1, expensesSheet.getLastColumn()).clearContent();
        }
        var expenseRows = data.expenses.map(function(exp) {
          return [exp.date, exp.category, exp.amount, exp.description || ''];
        });
        expensesSheet.getRange(2, 1, expenseRows.length, expenseRows[0].length).setValues(expenseRows);
      }

      var tripsSheet = ss.getSheetByName('المشاوير');
      if (!tripsSheet) {
        tripsSheet = ss.insertSheet('المشاوير');
        tripsSheet.appendRow(['التاريخ', 'المنطقة', 'الأجرة', 'الحالة']);
        tripsSheet.getRange(1, 1, 1, tripsSheet.getLastColumn()).setFontWeight("bold").setBackground("#ffe599");
      }
      if (data.trips && data.trips.length > 0) {
        if (tripsSheet.getLastRow() > 1) {
          tripsSheet.getRange(2, 1, tripsSheet.getLastRow() - 1, tripsSheet.getLastColumn()).clearContent();
        }
        var tripRows = data.trips.map(function(t) {
          return [t.date, t.area, t.price, t.status];
        });
        tripsSheet.getRange(2, 1, tripRows.length, tripRows[0].length).setValues(tripRows);
      }

      var customersSheet = ss.getSheetByName('العملاء');
      if (!customersSheet) {
        customersSheet = ss.insertSheet('العملاء');
        customersSheet.appendRow(['اسم العميل', 'رقم الهاتف', 'المنطقة']);
        customersSheet.getRange(1, 1, 1, customersSheet.getLastColumn()).setFontWeight("bold").setBackground("#d9ead3");
      }
      if (data.customers && data.customers.length > 0) {
        if (customersSheet.getLastRow() > 1) {
          customersSheet.getRange(2, 1, customersSheet.getLastRow() - 1, customersSheet.getLastColumn()).clearContent();
        }
        var currRows = data.customers.map(function(c) {
          return [c.name, c.phone, c.area];
        });
        customersSheet.getRange(2, 1, currRows.length, currRows[0].length).setValues(currRows);
      }

      var productsSheet = ss.getSheetByName('المنتجات');
      if (!productsSheet) {
        productsSheet = ss.insertSheet('المنتجات');
        productsSheet.appendRow(['الصنف', 'السعر', 'الأوزان المتاحة']);
        productsSheet.getRange(1, 1, 1, productsSheet.getLastColumn()).setFontWeight("bold").setBackground("#cfe2f3");
      }
      if (data.products && data.products.length > 0) {
        if (productsSheet.getLastRow() > 1) {
          productsSheet.getRange(2, 1, productsSheet.getLastRow() - 1, productsSheet.getLastColumn()).clearContent();
        }
        var pRows = data.products.map(function(p) {
          return [p.name, p.purchasingPrice, p.count];
        });
        productsSheet.getRange(2, 1, pRows.length, pRows[0].length).setValues(pRows);
      }
      
      var summarySheet = ss.getSheetByName('الملخص');
      if (!summarySheet) {
        summarySheet = ss.insertSheet('الملخص');
        summarySheet.appendRow(['تاريخ المزامنة', 'إجمالي المبيعات', 'المنصرف والمصروفات', 'صافي الأرباح']);
        summarySheet.getRange(1, 1, 1, summarySheet.getLastColumn()).setFontWeight("bold").setBackground("#d9ead3");
      }
      if (data.metadata) {
        if (summarySheet.getLastRow() > 1) {
           summarySheet.getRange(2, 1, summarySheet.getLastRow() - 1, summarySheet.getLastColumn()).clearContent();
        }
        summarySheet.appendRow([data.metadata.syncedAt, data.metadata.totalSales, data.metadata.totalExpenses, data.metadata.netProfit]);
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({"status": "ignored"})).setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      {saveSuccessMsg && (
                        <div className="bg-emerald-50 text-emerald-800 text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                          <Check className="h-4 w-4" />
                          {saveSuccessMsg}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveSettings}
                        className="w-full bg-[#1A365D] hover:bg-[#2B6CB0] text-white active:scale-95 transition-all rounded-xl py-2.5 text-xs font-bold cursor-pointer"
                      >
                        حفظ التعديلات ورابط جوجل
                      </button>

                      <div className="border-t border-slate-200 mt-4 pt-4 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={handleBulkSyncToGoogleSheets}
                          disabled={syncStatus === 'syncing' || !googleUrl}
                          className="w-full bg-[#1A365D] text-white border-transparent border border-indigo-700 rounded-lg py-2.5 text-xs font-bold hover:bg-[#1A365D] active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Send className="h-4 w-4" />
                          {syncStatus === 'syncing' ? 'جاري الترحيل...' : 'ترحيل وصب الفواتير والماليات للسحابة ☁️'}
                        </button>
                        {syncMsg && (
                          <div className={`text-[11px] font-bold py-1.5 px-3 rounded-lg text-center ${
                            syncStatus === 'fail' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'
                          }`}>
                            {syncMsg}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: Products and Prices (الأصناف والأسعار) */}
        {subTab === 'products' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Price search inside ManageTab */}
            <div className="bg-[#FFFFFF] p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="ابحث بالصنف..."
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                className="w-full bg-[#F7FAFC] border border-slate-150 rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <form onSubmit={handleSavePricesAndMargins} className="flex flex-col gap-4">
              {editedProducts.filter(p => p.name.includes(prodSearch)).length === 0 ? (
                <div className="bg-[#FFFFFF] p-8 rounded-2xl border border-slate-200 text-center text-gray-400 text-xs">لا يوجد نتائج تطابق البحث.</div>
              ) : (
                editedProducts
                  .filter(p => p.name.includes(prodSearch))
                  .map(p => {
                    const activeWeights = p.weights && p.weights.length > 0 ? p.weights : getProductWeightsFallback(p);
                    return (
                      <div key={p.id} className="bg-[#FFFFFF] border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col gap-3.5 hover:border-slate-300 transition-all">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2 bg-[#F7FAFC]/50 -mx-4 -mt-4 px-4 py-2.5 rounded-t-2xl font-bold text-red-700 text-sm">
                          <span>{p.name}</span>
                          <span className="text-gray-400 font-mono text-[10.5px]">معرف: {p.id}</span>
                        </div>

                        {/* Weights list of this product with inline edits */}
                        <div className="flex flex-col gap-3">
                          {activeWeights.map((weight) => {
                            const singleFactoryCost = weight.cartonPriceFromFactory / (weight.unitsPerCarton || 1);
                            const finalWithAddedValue = singleFactoryCost + (weight.addedValue || 0);

                            return (
                              <div key={weight.id} className="border border-slate-150 p-3 rounded-xl bg-[#F7FAFC]/30 flex flex-col gap-2">
                                <span className="text-xs font-black text-[#1A365D] flex items-center gap-1.5 border-b border-slate-100/60 pb-1">
                                  <Scale className="h-3.5 w-3.5 text-[#2B6CB0]" />
                                  الوزن/الحجم: {weight.size}
                                </span>

                                <div className="grid grid-cols-3 gap-2 text-right">
                                  <div>
                                    <label className="block text-[10px] text-[#2B6CB0] font-black mb-0.5">سعر الكرتونة</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={weight.cartonPriceFromFactory}
                                      onChange={(e) => handleWeightFieldChange(p.id, weight.id, 'cartonPriceFromFactory', e.target.value)}
                                      className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-1.5 text-xs text-center font-bold text-[#1A365D] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] text-[#2B6CB0] font-black mb-0.5">العدد</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={weight.unitsPerCarton}
                                      onChange={(e) => handleWeightFieldChange(p.id, weight.id, 'unitsPerCarton', e.target.value)}
                                      className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-1.5 text-xs text-center font-bold text-[#1A365D] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] text-[#2B6CB0] font-black mb-0.5">القيمة المضافة</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={weight.addedValue === undefined || weight.addedValue === 0 ? '' : weight.addedValue}
                                      onChange={(e) => handleWeightFieldChange(p.id, weight.id, 'addedValue', e.target.value)}
                                      className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg py-1 px-1.5 text-xs text-center font-bold text-[#1A365D] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                    />
                                  </div>
                                </div>

                                {(weight.cartonPriceFromFactory > 0 && weight.unitsPerCarton > 0) && (() => {
                                  const cartonP = weight.cartonPriceFromFactory;
                                  const unitsP = weight.unitsPerCarton;
                                  const addV = weight.addedValue || 0;
                                  const retailCarton = cartonP + addV;
                                  
                                  return (
                                    <div className="bg-red-50 p-2 rounded-lg border border-red-100 flex flex-col gap-2 mt-1">
                                      <span className="text-red-700 font-bold text-[10px] border-b border-red-200 pb-1">تحليل أسعار البيع (بعد القيمة المضافة)</span>
                                      <div className="grid grid-cols-4 gap-1 text-center">
                                        {[0, 1, 1.25, 1.5].map(discount => {
                                          const finalCarton = retailCarton * (1 - (discount / 100));
                                          const finalUnit = finalCarton / unitsP;
                                          const cartonProfit = finalCarton - cartonP;
                                          const unitProfit = cartonProfit / unitsP;
                                          return (
                                            <div key={discount} className="flex flex-col bg-[#FFFFFF] p-1 rounded border border-red-150 shadow-xs text-center justify-between">
                                              <div>
                                                <span className="text-[9px] font-black text-slate-500 mb-0.5 block">{discount}%</span>
                                                <span dir="ltr" className="text-[10px] font-bold text-red-700 block" title="سعر الكرتونة">{formatNum(finalCarton)} ج.م</span>
                                                <span dir="ltr" className="text-[9px] font-semibold text-slate-400 mt-0.5 block" title="سعر العبوة">{formatNum(finalUnit)} ج.م</span>
                                              </div>
                                              
                                              {/* Red Divider Separator */}
                                              <div className="border-t border-red-300 my-1"></div>
                                              
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[7.5px] font-[#4a5568] leading-none mb-0.5 font-bold text-slate-405">صافي الربح:</span>
                                                <span dir="ltr" className="text-[9.5px] font-black text-emerald-600 block leading-tight" title="ربح كرتونة">{formatNum(cartonProfit)} ج.م</span>
                                                {unitProfit > 0 && (
                                                  <span dir="ltr" className="text-[8.5px] font-semibold text-emerald-700 block leading-tight mt-0.5" title="ربح عبوة">{formatNum(unitProfit)} ج.م/عبوة</span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              )}

              {editedProducts.length > 0 && (
                <div className="flex flex-col gap-2 bg-[#FFFFFF] p-3 rounded-2xl border border-slate-200 mt-2">
                  {saveSuccessMsg && (
                    <div className="bg-emerald-50 text-emerald-800 text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                      <Check className="h-4 w-4" />
                      {saveSuccessMsg}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full bg-[#1A365D] hover:bg-[#2B6CB0] text-white rounded-xl py-2.5 text-xs font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    حفظ أسعار الأصناف والعمولات للأجهزة
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* TAB 2: AI options (الذكاء الاصطناعي) */}
        {subTab === 'ai_settings' && (
          <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fade-in">
            <h3 className="font-bold text-[#1A365D] text-base flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Sparkles className="h-5 w-5 text-[#1A365D]" />
              إعدادات الذكاء الاصطناعي والعامة
            </h3>

            <div className="flex flex-col gap-3.5">
              {/* AI Pitch Guidelines Field */}
              <div className="border border-indigo-100 rounded-xl p-3 bg-indigo-50/20 mt-1">
                <label className="block text-xs font-black text-indigo-950 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#1A365D]" />
                  الأفكار والخطوط العريضة لرسالة الذكاء الاصطناعي الترويجية (للعملاء الجدد):
                </label>
                <textarea
                  placeholder="مثال: ركز على أن نسبة الخصم تصل لـ 15%، وأن الجودة تضاهي الشركات الكبرى مع توصيل سريع في نفس اليوم..."
                  value={pitchGuidelines}
                  onChange={(e) => setPitchGuidelines(e.target.value)}
                  dir="rtl"
                  className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2.5 text-xs text-[#1A365D] font-bold leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-indigo-400 h-20"
                />
                <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                  الخطوط والأفكار المُدخلة هنا سيستخدمها العقل الذكي لتنشيط وتخصيص صياغة الرسائل الترويجية المناسبة عند عرض ترويج العميل.
                </p>
              </div>

              <div className="border border-emerald-100 rounded-xl p-3 bg-emerald-50/20 mt-1">
                <label className="block text-xs font-black text-emerald-950 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#DD6B20]" />
                  الأفكار لرسالة الذكاء الاصطناعي (للعملاء الخاملين والنشطين للتحفيز):
                </label>
                <textarea
                  placeholder="مثال: رسائل تهنئة، عروض خاصة للمسحوبات الكبيرة، أو رسائل عتاب محفزة للعملاء الذين توقفوا عن الشراء..."
                  value={retentionGuidelines}
                  onChange={(e) => setRetentionGuidelines(e.target.value)}
                  dir="rtl"
                  className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2.5 text-xs text-[#1A365D] font-bold leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-emerald-400 h-20"
                />
                <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                  هذه التعليمات ستستخدم عند كتابة رسائل الواتساب للعملاء من خلال قسم التقارير والعملاء (النشطين لزيادة البيع والخاملين لتحفيزهم).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-1">
                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">رمز العملة داخل الفواتير</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  {saveSuccessMsg && (
                    <div className="bg-emerald-50 text-[#DD6B20] text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="h-4 w-4" />
                      {saveSuccessMsg}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="w-full bg-indigo-100 border border-indigo-200 text-[#1A365D] rounded-lg py-2 text-xs font-bold hover:bg-indigo-200 active:scale-95 transition-all cursor-pointer"
                  >
                    حفظ المتغيرات
                  </button>
                </div>
              </div>
            </div>

            {/* AI Control Center with Dual Active tabs */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
              <div className="flex border-b border-indigo-100">
                <button
                  type="button"
                  onClick={() => setAiSubTab('sales_assistant')}
                  className={`flex-1 py-1.5 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                    aiSubTab === 'sales_assistant'
                      ? 'border-[#1A365D] text-[#1A365D] bg-indigo-50/10'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>المساعد الذكي لسياسات البيع</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiSubTab('market_explorer')}
                  className={`flex-1 py-1.5 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                    aiSubTab === 'market_explorer'
                      ? 'border-[#1A365D] text-[#1A365D] bg-indigo-50/10'
                      : 'border-transparent text-slate-400 hover:text-slate-650'
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  <span>استكشاف حركة وبورصة أسواق الزيوت</span>
                </button>
              </div>

              {aiSubTab === 'sales_assistant' && (
                <div className="flex flex-col gap-3">
                  <h4 className="font-bold text-[#1A365D] text-xs flex items-center gap-1.5 pt-1">
                    <Sparkles className="h-4 w-4 text-[#2B6CB0]" />
                    المساعد الذكي لسياسات البيع والتعامل المعرفي
                  </h4>
                  
                  {/* Category & Search fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#2B6CB0] mb-1">فئة العميل المستهدف (لتوجيه الردود):</label>
                      <select 
                        value={aiChatCategory}
                        onChange={(e) => setAiChatCategory(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold text-[#1A365D] outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="هايبر">هايبر ماركت</option>
                        <option value="سوبر ماركت">سوبر ماركت</option>
                        <option value="ميني ماركت/كشك">ميني ماركت / كشك</option>
                        <option value="عطارة">محلات عطارة</option>
                        <option value="جملة">تجار جملة</option>
                        <option value="نصف جملة">تجار نصف جملة</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#2B6CB0] mb-1">بحث بالاسم واستيراد تاريخ عميل معين (اختياري):</label>
                      <input 
                        type="text" 
                        placeholder="اسم العميل لربطه بالمحادثة..."
                        value={aiChatCustomerSearch}
                        onChange={(e) => setAiChatCustomerSearch(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold text-[#1A365D] outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Chat View */}
                  <div className="bg-[#F7FAFC] border border-slate-200 rounded-xl h-64 overflow-y-auto p-3 flex flex-col gap-3">
                    {aiChatHistory.length === 0 ? (
                      <div className="text-center text-gray-400 text-xs mt-10 p-4 font-medium flex flex-col items-center gap-2">
                        <Sparkles className="h-6 w-6 text-slate-300" />
                        <span>مرحباً! أنا هنا لصياغة رسائل ترويجية أو إعطاء أفكار حول طرق إقناع الفئة المختارة وعقد صفقات ناجحة معهم بناءً على الأفكار والسياسات الخاصة بكم التي أدخلتها.</span>
                      </div>
                    ) : (
                      aiChatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] text-xs p-3 rounded-2xl ${msg.role === 'user' ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-[#FFFFFF] border border-slate-200 text-[#1A365D] rounded-tl-sm'}`}>
                            <div className="whitespace-pre-wrap leading-relaxed font-medium">{msg.text}</div>
                          </div>
                        </div>
                      ))
                    )}
                    {isAskingAI && (
                      <div className="flex w-full justify-start">
                        <div className="bg-[#FFFFFF] border border-slate-200 p-3 rounded-2xl rounded-tl-sm text-gray-400 text-xs flex gap-1">
                          <span className="animate-bounce">●</span>
                          <span className="animate-bounce delay-75">●</span>
                          <span className="animate-bounce delay-150">●</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Chat Input form */}
                  <form onSubmit={handleAskAI} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="كيف نقنع هذه الفئة بزيادة المبيعات؟ اكتب رسالة ترويجية..."
                      value={aiChatInput}
                      onChange={(e) => setAiChatInput(e.target.value)}
                      className="flex-1 bg-[#FFFFFF] border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400"
                      disabled={isAskingAI}
                    />
                    <button 
                      type="submit" 
                      disabled={isAskingAI}
                      className="bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent disabled:bg-slate-300 text-white p-2 rounded-lg transition-colors cursor-pointer"
                      title="إرسال"
                    >
                      <Send className="h-4.5 w-4.5" />
                    </button>
                  </form>
                </div>
              )}

              {aiSubTab === 'market_explorer' && (
                <div className="flex flex-col gap-4 animate-fade-in text-right" dir="rtl">
                  <div className="bg-gradient-to-r from-amber-50 to-indigo-50/30 p-4 rounded-xl border border-amber-100 flex flex-col gap-1.5">
                    <h4 className="font-extrabold text-[#1A365D] text-xs flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-[#DD6B20]" />
                      مستكشف ومحلل حركة أسواق الزيوت والسلع بالذكاء الاصطناعي 🛢️
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      نظام ذكاء اصطناعي متطور يربط بين الذكاء التوليدي والويب المباشر لتتبع أسعار الزيوت عالمياً ومحلياً (مثل زيت الخليط، زيت الأولين، الصويا، دوار الشمس) ومتابعة تفاصيل عمليات التصنيع والتعبئة بدقة متناهية.
                    </p>
                  </div>

                  {/* Suggestion Templates */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">محاور بحث حيوية مجهزة لسرعة الاستكشاف:</span>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { label: '📊 حركة أسعار زيت الأولين والزيت الخليط اليوم محلياً وعالمياً', q: 'ما هي آخر تحديثات بورصة أسعار زيت الأولين والزيت الخليط اليوم محلياً وعالمياً وكيف تؤثر على حركة السوق؟' },
                        { label: '⚙️ تفاصيل ومراحل عمليات تصنيع وتكرير وفصل الزيوت النباتية', q: 'اشرح لي بالتفصيل خطوات وطرق ومعدات عمليات تصنيع وتكرير وفصل الزيوت النباتية خاصة خلط الزيوت وتعبئتها للبيع.' },
                        { label: '🛒 سوق الزيوت المحلي وأسعار بورصة السلع الحالية والبدائل', q: 'أعطني تقريراً شاملاً مستنداً لمحركات البحث الحالية عن حركة وأسعار زيت طعام الخليط والأولين في مصر والشرق الأوسط وبدائلها المتوفرة.' }
                      ].map((item, id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleMarketSearch(item.q)}
                          disabled={isSearchingMarket}
                          className="bg-white border border-slate-200 hover:border-indigo-400 text-[10px] font-bold text-slate-700 py-1.5 px-3 rounded-lg active:scale-95 transition-all text-right cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Input Block */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const queryInp = (e.currentTarget.elements.namedItem('market_query') as HTMLInputElement).value;
                      handleMarketSearch(queryInp);
                    }}
                    className="flex gap-2 border-t border-slate-100 pt-3"
                  >
                    <input
                      name="market_query"
                      type="text"
                      required
                      placeholder="اكتب فكرة البحث كزيت الأولين، أسعار البورصة، عمليات التكرير والخلط..."
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-[#1A365D] focus:outline-none focus:border-indigo-500"
                      disabled={isSearchingMarket}
                    />
                    <button
                      type="submit"
                      disabled={isSearchingMarket}
                      className="bg-[#1A365D] text-white hover:bg-opacity-90 px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer disabled:bg-slate-300"
                    >
                      <Search className="h-4 w-4" />
                      <span>{isSearchingMarket ? 'جاري الاستعلام...' : 'بحث بالذكاء الاصطناعي'}</span>
                    </button>
                  </form>

                  {/* Loading pulsing effect */}
                  {isSearchingMarket && (
                    <div className="bg-[#FFFFFF] p-6 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center gap-2.5 text-center animate-pulse">
                      <Globe className="h-8 w-8 text-indigo-600 animate-spin" />
                      <p className="text-xs font-bold text-indigo-950">جاري مسح قواعد البورصة ومحرك البحث واستنتاج البيانات الذكية...</p>
                      <span className="text-[10px] text-gray-400">سنقوم بربط المخرجات بمصادر ويب حية لمطابقة الشفافية والحركة الآنية.</span>
                    </div>
                  )}

                  {/* Error notification */}
                  {marketSearchError && (
                    <div className="bg-red-50 text-red-800 p-3 rounded-lg border border-red-200 text-xs font-bold leading-relaxed">
                      ❌ {marketSearchError}
                    </div>
                  )}

                  {/* Search Results Display Area */}
                  {marketSearchResult && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 animate-fade-in text-right">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-black text-[#1A365D] flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-md">
                          📄 نتائج تقرير واستكشاف الذكاء الاصطناعي للأسواق والزيوت
                        </span>
                        <span className="text-[9px] font-black text-[#DD6B20] font-mono">
                          مُحدث حياً عبر Google Grounding
                        </span>
                      </div>

                      <div className="text-xs text-[#1A365D] leading-relaxed font-bold whitespace-pre-wrap font-sans bg-white p-3.5 rounded-lg border border-slate-100 shadow-xs">
                        {marketSearchResult}
                      </div>

                      {/* Reference sources links */}
                      {marketSearchSources.length > 0 && (
                        <div className="mt-2 border-t border-slate-200 pt-2.5 flex flex-col gap-1.5">
                          <span className="text-[10px] font-black text-slate-500 flex items-center gap-1">
                            🌐 المصادر والروابط والمراجعات المعتمدة لبحثك:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {marketSearchSources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 p-2 bg-white hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-lg text-indigo-900 text-[10px] transition-all"
                              >
                                <span className="bg-[#DD6B20] text-white rounded-full w-4 h-4 flex items-center justify-center font-mono text-[9px] font-bold text-center">
                                  {idx + 1}
                                </span>
                                <span className="truncate flex-1 font-bold">{source.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 4: Google Sync Options */}
        {subTab === 'google_sync' && (
          <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fade-in">
            <h3 className="font-bold text-[#1A365D] text-base flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <FileSpreadsheet className="h-5 w-5 text-[#DD6B20]" />
              إعدادات ربط جوجل شيت (محمي)
            </h3>

            {!isGooglePasswordValid ? (
              <div className="flex flex-col gap-3">
                <label className="block text-sm font-bold text-[#2B6CB0] mb-1">يرجى إدخال كلمة المرور للوصول إلى الرابط:</label>
                <input
                  type="password"
                  placeholder="كلمة المرور"
                  value={googlePassword}
                  onChange={(e) => setGooglePassword(e.target.value)}
                  onKeyDown={(e) => {
                    const correctPass = localStorage.getItem('owner_passcode_sys') || '1987';
                    if (e.key === 'Enter' && googlePassword === correctPass) {
                      setIsGooglePasswordValid(true);
                    }
                  }}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-center focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const correctPass = localStorage.getItem('owner_passcode_sys') || '1987';
                    if (googlePassword === correctPass) {
                      setIsGooglePasswordValid(true);
                    } else {
                      alert('كلمة المرور غير صحيحة!');
                    }
                  }}
                  className="w-full bg-[#DD6B20] text-white text-white rounded-lg py-2.5 text-sm font-bold hover:bg-[#C05621] transition"
                >
                  تأكيد
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#2B6CB0] mb-1">رابط تطبيق الويب لجوجل (Google Web App URL)</label>
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={googleUrl}
                    onChange={(e) => setGoogleUrl(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs text-left font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                    عند إضافة هذا الرابط، يقوم التطبيق بمزامنة المبيعات والمصروفات فوراً.
                  </p>
                </div>
                
                <div className="mt-2 bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <details className="text-xs">
                    <summary className="font-bold text-emerald-800 cursor-pointer select-none">طريقة تجهيز سكربت جوجل شيت لتقسيم الفواتير والماليات 🛠️</summary>
                    <div className="mt-2 text-[#1A365D] space-y-2">
                      <p>1. قم بإنشاء ملف Google Sheets جديد.</p>
                      <p>2. اذهب إلى Extensions (الإضافات) &gt; Apps Script.</p>
                      <p>3. امسح الكود الموجود وضع الكود التالي والذي سيقوم بتقسيم الفواتير في شيت والماليات في شيت منفصل تلقائياً:</p>
                      <div className="relative mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const scriptCode = `function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    
    if (data.type === 'تقرير_كامل') {
      
      // 1. الفواتير
      var invoicesSheet = ss.getSheetByName('الفواتير');
      if (!invoicesSheet) {
        invoicesSheet = ss.insertSheet('الفواتير');
        invoicesSheet.appendRow(['التاريخ', 'رقم الفاتورة', 'العميل', 'المنطقة', 'إجمالي الفاتورة', 'الملاحظات']);
        invoicesSheet.getRange(1, 1, 1, invoicesSheet.getLastColumn()).setFontWeight("bold").setBackground("#e0e0e0");
      }
      if (data.invoices && data.invoices.length > 0) {
        if (invoicesSheet.getLastRow() > 1) {
          invoicesSheet.getRange(2, 1, invoicesSheet.getLastRow() - 1, invoicesSheet.getLastColumn()).clearContent();
        }
        var invoiceRows = data.invoices.map(function(inv) {
          return [inv.date, inv.invNum, inv.customerName, inv.area, inv.total, inv.notes || ''];
        });
        invoicesSheet.getRange(2, 1, invoiceRows.length, invoiceRows[0].length).setValues(invoiceRows);
      }
      
      // 2. الماليات
      var expensesSheet = ss.getSheetByName('الماليات');
      if (!expensesSheet) {
        expensesSheet = ss.insertSheet('الماليات');
        expensesSheet.appendRow(['التاريخ', 'الفئة', 'المبلغ', 'البيان']);
        expensesSheet.getRange(1, 1, 1, expensesSheet.getLastColumn()).setFontWeight("bold").setBackground("#e0e0e0");
      }
      if (data.expenses && data.expenses.length > 0) {
        if (expensesSheet.getLastRow() > 1) {
          expensesSheet.getRange(2, 1, expensesSheet.getLastRow() - 1, expensesSheet.getLastColumn()).clearContent();
        }
        var expenseRows = data.expenses.map(function(exp) {
          return [exp.date, exp.category, exp.amount, exp.description || ''];
        });
        expensesSheet.getRange(2, 1, expenseRows.length, expenseRows[0].length).setValues(expenseRows);
      }

      // 3. المشاوير
      var tripsSheet = ss.getSheetByName('المشاوير');
      if (!tripsSheet) {
        tripsSheet = ss.insertSheet('المشاوير');
        tripsSheet.appendRow(['التاريخ', 'المنطقة', 'الأجرة', 'الحالة']);
        tripsSheet.getRange(1, 1, 1, tripsSheet.getLastColumn()).setFontWeight("bold").setBackground("#ffe599");
      }
      if (data.trips && data.trips.length > 0) {
        if (tripsSheet.getLastRow() > 1) {
          tripsSheet.getRange(2, 1, tripsSheet.getLastRow() - 1, tripsSheet.getLastColumn()).clearContent();
        }
        var tripRows = data.trips.map(function(t) {
          return [t.date, t.area, t.price, t.status];
        });
        tripsSheet.getRange(2, 1, tripRows.length, tripRows[0].length).setValues(tripRows);
      }

      // 4. العملاء
      var customersSheet = ss.getSheetByName('العملاء');
      if (!customersSheet) {
        customersSheet = ss.insertSheet('العملاء');
        customersSheet.appendRow(['اسم العميل', 'رقم الهاتف', 'المنطقة']);
        customersSheet.getRange(1, 1, 1, customersSheet.getLastColumn()).setFontWeight("bold").setBackground("#d9ead3");
      }
      if (data.customers && data.customers.length > 0) {
        if (customersSheet.getLastRow() > 1) {
          customersSheet.getRange(2, 1, customersSheet.getLastRow() - 1, customersSheet.getLastColumn()).clearContent();
        }
        var currRows = data.customers.map(function(c) {
          return [c.name, c.phone, c.area];
        });
        customersSheet.getRange(2, 1, currRows.length, currRows[0].length).setValues(currRows);
      }

      // 5. المنتجات
      var productsSheet = ss.getSheetByName('المنتجات');
      if (!productsSheet) {
        productsSheet = ss.insertSheet('المنتجات');
        productsSheet.appendRow(['الصنف', 'السعر', 'الأوزان المتاحة']);
        productsSheet.getRange(1, 1, 1, productsSheet.getLastColumn()).setFontWeight("bold").setBackground("#cfe2f3");
      }
      if (data.products && data.products.length > 0) {
        if (productsSheet.getLastRow() > 1) {
          productsSheet.getRange(2, 1, productsSheet.getLastRow() - 1, productsSheet.getLastColumn()).clearContent();
        }
        var pRows = data.products.map(function(p) {
          return [p.name, p.purchasingPrice, p.count];
        });
        productsSheet.getRange(2, 1, pRows.length, pRows[0].length).setValues(pRows);
      }
      
      // 6. الملخص
      var summarySheet = ss.getSheetByName('الملخص');
      if (!summarySheet) {
        summarySheet = ss.insertSheet('الملخص');
        summarySheet.appendRow(['تاريخ المزامنة', 'إجمالي المبيعات', 'المنصرف والمصروفات', 'صافي الأرباح']);
        summarySheet.getRange(1, 1, 1, summarySheet.getLastColumn()).setFontWeight("bold").setBackground("#d9ead3");
      }
      
      if (data.metadata) {
        if (summarySheet.getLastRow() > 1) {
           summarySheet.getRange(2, 1, summarySheet.getLastRow() - 1, summarySheet.getLastColumn()).clearContent();
        }
        summarySheet.appendRow([data.metadata.syncedAt, data.metadata.totalSales, data.metadata.totalExpenses, data.metadata.netProfit]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "ignored"})).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`;
                            navigator.clipboard.writeText(scriptCode);
                            setScriptCopied(true);
                            setTimeout(() => setScriptCopied(false), 2000);
                          }}
                          className="absolute right-2 top-2 bg-slate-700 hover:bg-slate-600 text-slate-200 p-1.5 rounded-md transition-colors cursor-pointer z-10 flex items-center justify-center"
                          title="نسخ الكود"
                        >
                          {scriptCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <pre className="bg-[#1A365D] text-white border-transparent text-emerald-100 p-3 pt-9 rounded-lg text-left text-[10px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap user-select-all" dir="ltr">
{`function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    
    if (data.type === 'تقرير_كامل') {
      
      // 1. الفواتير
      var invoicesSheet = ss.getSheetByName('الفواتير');
      if (!invoicesSheet) {
        invoicesSheet = ss.insertSheet('الفواتير');
        invoicesSheet.appendRow(['التاريخ', 'رقم الفاتورة', 'العميل', 'المنطقة', 'إجمالي الفاتورة', 'الملاحظات']);
        invoicesSheet.getRange(1, 1, 1, invoicesSheet.getLastColumn()).setFontWeight("bold").setBackground("#e0e0e0");
      }
      if (data.invoices && data.invoices.length > 0) {
        if (invoicesSheet.getLastRow() > 1) {
          invoicesSheet.getRange(2, 1, invoicesSheet.getLastRow() - 1, invoicesSheet.getLastColumn()).clearContent();
        }
        var invoiceRows = data.invoices.map(function(inv) {
          return [inv.date, inv.invNum, inv.customerName, inv.area, inv.total, inv.notes || ''];
        });
        invoicesSheet.getRange(2, 1, invoiceRows.length, invoiceRows[0].length).setValues(invoiceRows);
      }
      
      // 2. الماليات
      var expensesSheet = ss.getSheetByName('الماليات');
      if (!expensesSheet) {
        expensesSheet = ss.insertSheet('الماليات');
        expensesSheet.appendRow(['التاريخ', 'الفئة', 'المبلغ', 'البيان']);
        expensesSheet.getRange(1, 1, 1, expensesSheet.getLastColumn()).setFontWeight("bold").setBackground("#e0e0e0");
      }
      if (data.expenses && data.expenses.length > 0) {
        if (expensesSheet.getLastRow() > 1) {
          expensesSheet.getRange(2, 1, expensesSheet.getLastRow() - 1, expensesSheet.getLastColumn()).clearContent();
        }
        var expenseRows = data.expenses.map(function(exp) {
          return [exp.date, exp.category, exp.amount, exp.description || ''];
        });
        expensesSheet.getRange(2, 1, expenseRows.length, expenseRows[0].length).setValues(expenseRows);
      }

      // 3. المشاوير
      var tripsSheet = ss.getSheetByName('المشاوير');
      if (!tripsSheet) {
        tripsSheet = ss.insertSheet('المشاوير');
        tripsSheet.appendRow(['التاريخ', 'المنطقة', 'الأجرة', 'الحالة']);
        tripsSheet.getRange(1, 1, 1, tripsSheet.getLastColumn()).setFontWeight("bold").setBackground("#ffe599");
      }
      if (data.trips && data.trips.length > 0) {
        if (tripsSheet.getLastRow() > 1) {
          tripsSheet.getRange(2, 1, tripsSheet.getLastRow() - 1, tripsSheet.getLastColumn()).clearContent();
        }
        var tripRows = data.trips.map(function(t) {
          return [t.date, t.area, t.price, t.status];
        });
        tripsSheet.getRange(2, 1, tripRows.length, tripRows[0].length).setValues(tripRows);
      }

      // 4. العملاء
      var customersSheet = ss.getSheetByName('العملاء');
      if (!customersSheet) {
        customersSheet = ss.insertSheet('العملاء');
        customersSheet.appendRow(['اسم العميل', 'رقم الهاتف', 'المنطقة']);
        customersSheet.getRange(1, 1, 1, customersSheet.getLastColumn()).setFontWeight("bold").setBackground("#d9ead3");
      }
      if (data.customers && data.customers.length > 0) {
        if (customersSheet.getLastRow() > 1) {
          customersSheet.getRange(2, 1, customersSheet.getLastRow() - 1, customersSheet.getLastColumn()).clearContent();
        }
        var currRows = data.customers.map(function(c) {
          return [c.name, c.phone, c.area];
        });
        customersSheet.getRange(2, 1, currRows.length, currRows[0].length).setValues(currRows);
      }

      // 5. المنتجات
      var productsSheet = ss.getSheetByName('المنتجات');
      if (!productsSheet) {
        productsSheet = ss.insertSheet('المنتجات');
        productsSheet.appendRow(['الصنف', 'السعر', 'الأوزان المتاحة']);
        productsSheet.getRange(1, 1, 1, productsSheet.getLastColumn()).setFontWeight("bold").setBackground("#cfe2f3");
      }
      if (data.products && data.products.length > 0) {
        if (productsSheet.getLastRow() > 1) {
          productsSheet.getRange(2, 1, productsSheet.getLastRow() - 1, productsSheet.getLastColumn()).clearContent();
        }
        var pRows = data.products.map(function(p) {
          return [p.name, p.purchasingPrice, p.count];
        });
        productsSheet.getRange(2, 1, pRows.length, pRows[0].length).setValues(pRows);
      }
      
      // 6. الملخص
      var summarySheet = ss.getSheetByName('الملخص');
      if (!summarySheet) {
        summarySheet = ss.insertSheet('الملخص');
        summarySheet.appendRow(['تاريخ المزامنة', 'إجمالي المبيعات', 'المنصرف والمصروفات', 'صافي الأرباح']);
        summarySheet.getRange(1, 1, 1, summarySheet.getLastColumn()).setFontWeight("bold").setBackground("#d9ead3");
      }
      
      if (data.metadata) {
        if (summarySheet.getLastRow() > 1) {
           summarySheet.getRange(2, 1, summarySheet.getLastRow() - 1, summarySheet.getLastColumn()).clearContent();
        }
        summarySheet.appendRow([data.metadata.syncedAt, data.metadata.totalSales, data.metadata.totalExpenses, data.metadata.netProfit]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "ignored"})).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`}
                        </pre>
                      </div>
                      <p className="mt-2 text-[#DD6B20] font-bold">ملاحظة هامة: بعد وضع الكود اضغط Deploy ثم New Deployment كـ Web App واجعل الخيار Anyone (أي شخص) وضع الرابط بالأعلى.</p>
                    </div>
                  </details>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  {saveSuccessMsg && (
                    <div className="bg-emerald-50 text-[#DD6B20] text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                      <Check className="h-4 w-4" />
                      {saveSuccessMsg}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="w-full bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg py-2 text-xs font-bold hover:bg-emerald-200 active:scale-95 transition-all cursor-pointer"
                  >
                    حفظ التعديلات
                  </button>

                  <div className="border-t border-slate-200 mt-4 pt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleBulkSyncToGoogleSheets}
                      disabled={syncStatus === 'syncing' || !googleUrl}
                      className="w-full bg-[#1A365D] text-white border-transparent border border-indigo-700 text-white rounded-lg py-2.5 text-xs font-bold hover:bg-[#1A365D] text-white border-transparent active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {syncStatus === 'syncing' ? 'جاري الترحيل...' : 'ترحيل وصب الفواتير والماليات للسحابة'}
                    </button>
                    {syncMsg && (
                      <div className={`text-[11px] font-bold py-1.5 px-3 rounded-lg text-center ${
                        syncStatus === 'fail' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'
                      }`}>
                        {syncMsg}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Database operations (صيانة واستعادة قاعدة البيانات) */}
        {subTab === 'db_ops' && (
          <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 animate-fade-in">
            <h3 className="font-bold text-[#DD6B20] text-base flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Database className="h-5 w-5" />
              صيانة واسترجاع قاعدة البيانات المحليّة
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={async () => { if (await confirmDialog('تنبيه: هل أنت متأكد من حذف كافة البيانات والمبيعات وتهيئة النظام مجدداً بالبيانات التجريبية؟')) {
                    onResetDatabase(true);
                    alert('تم إعادة ضبط النظام ببيانات المصنع الافتراضية بنجاح!');
                  }
                }}
                className="bg-[#F7FAFC] hover:bg-slate-200 active:scale-95 border border-slate-300 text-[#1A365D] p-3.5 rounded-xl text-center text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-5 w-5 text-[#2B6CB0]" />
                <span>تحميل البيانات التجريبية</span>
              </button>

              <button
                onClick={async () => { if (await confirmDialog('تمويه خطير: سيقوم هذا الخيار بمسح كامل العملاء، الفواتير، المصرفات والأصناف كلياً. هل تريد المتابعة؟')) {
                    onResetDatabase(false);
                    alert('تم مسح وإفراغ قاعدة البيانات بالكامل بنجاح!');
                  }
                }}
                className="bg-rose-50 hover:bg-rose-100 active:scale-95 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-center text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5"
              >
                <Database className="h-5 w-5 text-rose-500" />
                <span>تهيئة ومسح شامل للبيانات</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

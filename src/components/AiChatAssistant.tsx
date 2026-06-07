// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Maximize2, Minimize2, Mic, Volume2, Square, Sparkles, Database, RotateCcw } from 'lucide-react';
import Markdown from 'react-markdown';
import { Product, Customer, Invoice, Expense, FactoryLoad, Trip, UserAuth } from '../types';
import { showToast } from '../utils/toast';

interface AiChatAssistantProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  products: Product[];
  factoryLoads: FactoryLoad[];
  customers: Customer[];
  invoices: Invoice[];
  expenses: Expense[];
  trips: Trip[];
  currentUser?: UserAuth | null;
}

export default function AiChatAssistant({
  isOpen,
  setIsOpen,
  products = [],
  factoryLoads = [],
  customers = [],
  invoices = [],
  expenses = [],
  trips = [],
  currentUser = null
}: AiChatAssistantProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'model', text: string }>>([
    {
      role: 'model',
      text: 'مرحباً بك يا بطل المبيعات الميدانية مع مستشارك الذكي! 👋\n\nأنا مطلع على حركية السيارة والعملاء لديك حالياً. يمكنك سئلي في أي وقت عن نصيحة تكتيكية لبيع صنف راكد، كيفية تسوية مديونية تاجر معترض، أو صياغة خطة بيع لتصفية مخزون السيارة الراهن. بماذا نبدأ؟'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState<number | null>(null);

  // Generate dynamic contextual report of current car balance & debts for backend injection
  const getContextString = (): string => {
    try {
      // 1. Car Balance Summary
      const carBalancesList: string[] = [];
      products.forEach(product => {
        const weights = product.weights || [];
        weights.forEach(w => {
          const loaded = factoryLoads
            .filter(load => load.productId === product.id && load.weightId === w.id)
            .reduce((sum, load) => sum + load.quantity, 0);

          let sold = 0;
          invoices.forEach(invoice => {
            invoice.items.forEach(item => {
              if (item.productId === product.id && item.weightId === w.id) {
                sold += item.quantity;
              }
            });
          });

          const remaining = loaded - sold;
          const unitsPerCt = w.unitsPerCarton || 12;
          const remainingCartons = Math.floor(remaining / unitsPerCt);
          const looseUnits = remaining % unitsPerCt;

          if (loaded > 0) {
            carBalancesList.push(`- صنف "${product.name}" (حجم ${w.size}): إجمالي الحمولة المسحوبة ${Math.floor(loaded / unitsPerCt)} كرتونة، المباع منها ${Math.floor(sold / unitsPerCt)} كرتونة، والجاهز الفعلي المتبقي بالسيارة الآن: ${remainingCartons} كرتونة و ${looseUnits} عبوة.`);
          }
        });
      });

      // 2. Debts and customers
      const debtorList: string[] = [];
      customers.forEach(c => {
        const custInvoices = invoices.filter(inv => inv.customerId === c.id);
        const totalPurchased = custInvoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount || 0), 0);
        const totalPaid = custInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
        const debt = totalPurchased - totalPaid;
        if (debt > 0) {
          debtorList.push(`- العميل: "${c.name}" (منطقة ${c.area}، هاتف ${c.phone}): عليه مديونية معلقة بقيمة ${debt} جنيهاً مصرياً.`);
        }
      });

      // 3. Consolidated balance sheet
      const totalSales = invoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount || 0), 0);
      const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
      const outstandingDebt = totalSales - totalPaid;
      const totalSpent = expenses.filter(e => e.type !== 'revenue').reduce((sum, e) => sum + e.amount, 0);

      return `=== جرد حمولة البضاعة بالسيارة الآن ===
${carBalancesList.length > 0 ? carBalancesList.join('\n') : '- لا توجد بضاعة مسحوبة بالسيارة حالياً.'}

=== مديونيات وحسابات العملاء (التسهيلات) ===
${debtorList.length > 0 ? debtorList.slice(0, 8).join('\n') : '- لا توجد مديونيات مسجلة على أي عميل.'}

=== ملخص مالية الرحلة الميدانية اليوم ===
- إجمالي مبيعات المندوب اليوم: ${totalSales} ج.
- كاش محصل تحت اليد: ${totalPaid} ج.
- مديونيات آجلة معلقة عند التابعين: ${outstandingDebt} ج.
- مصاريف السيارة ونثرية السفر اليومية: ${totalSpent} ج.
`;
    } catch (e) {
      return "تعذر إرفاق سياق جرد الحسابات المباشر للرحلة.";
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('⚠️ متصفحك لا يدعم خاصية التحدث الصوتي.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev ? prev + ' ' + transcript : transcript);
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const playAudio = (text: string, index: number) => {
    if (!('speechSynthesis' in window)) {
      showToast('⚠️ متصفحك لا يدعم خاصية تحويل النص إلى صوت.');
      return;
    }
    window.speechSynthesis.cancel();
    
    // Remove markdown symbols for clear natural reading
    const cleanText = text.replace(/[*#_`\[\]]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    
    utterance.onstart = () => setIsPlaying(index);
    utterance.onend = () => setIsPlaying(null);
    utterance.onerror = () => setIsPlaying(null);

    window.speechSynthesis.speak(utterance);
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(null);
    }
  };

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const userMessage = queryText.trim();
    setInputText('');

    // Settle new chat trigger on 'جديد' input
    const cleanMsg = userMessage.trim().toLowerCase();
    if (cleanMsg === 'جديد' || cleanMsg === 'جديد ' || cleanMsg === 'new' || cleanMsg === 'reset' || cleanMsg === 'أريد خطة جديدة' || cleanMsg === 'اعادة تهيئة') {
      setShowQuickActions(true);
      setMessages([
        {
          role: 'model',
          text: 'تمت إعادة تهيئة مستشارك الميداني مجدداً بنجاح! 🔄\n\nالبطاقات التفاعلية الحيوية، وأدوات جرد السيارة وسياق مديونيات العملاء معروضة الآن بالكامل لمساعدتك. كيف يمكنني إرشادك اليوم؟'
        }
      ]);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const activeUserName = currentUser?.name || 'مندوب مبيعات EAGS';
      const activeUserRole = currentUser?.role === 'owner' ? 'مدير عام مبيعات' : 'مندوب مبيعات ميداني';
      const liveContextSummary = getContextString();
      const systemPrompt = `أنت "المستشار النفسي والخبير البيعي" والمساعد السلوكي والتفاوضي الأول لمندوبي ومسؤولي المبيعات لشركة EAGS للأغذية المتحدون وكل ما يتعلق بصفقات البيع والشراء.
المهنة والصفة الأساسية لك: مستشار نفسي وخبير بيع محترف ومحنك.
تتحدث برزانة ووعي سيكولوجي عميق باللغة العربية كخبير مبيعات ومستشاري للأعمال.
مهمتك الكبرى هي تحليل شخصية العميل نفسياً (سواء كان غاضباً، بخيلاً، متردداً، عنيداً، متشككاً، أو ودوداً) وتقديم تكتيكات اقناع علمية وعملية تفيده في الرد وإبرام الصفقة كاش أو تسوية الديون والمديونيات.

أجب بدقة متناهية وبناءً على تفاصيل السؤال أو الطلب المحدد الذي يقدمه لك المستخدم مباشرة. لا تقدم ردوداً مكررة أو مسردة مسبقاً، بل قم بتحليل عميق للطلب والوضعية الحالية:
- قم بتفكيك نفسية العميل وطريقة تفكيره (التحليل السيكولوجي السلوكي للعميل).
- اعطِ تكتيكات بيعية واضحة (خبير مبيعات).
- صغ له سيناريو حواري مقنع وجذاب بالعامية المصرية ومقنع للأطراف.
- ارفع الروح المعنوية للمندوب وقدم له دعماً نفسياً وإيجابياً متكاملاً.

المندوب الحالي الميداني الذي يتحدث معك هو:
- الاسم: "${activeUserName}"
- الصفة/اللقب الوظيفي في نظام الإدارة: "${activeUserRole}"
تحدث معه من منطلق صديق وخبير بيع وموجه سيكولوجي رائع.`;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemPrompt,
          history: messages.slice(1).map(m => ({
            role: m.role,
            text: m.text
          })),
          message: userMessage,
          appStateContext: liveContextSummary
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'model', text: data.text }]);
      } else {
        throw new Error('فشل جلب الرد');
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'عفواً يا صديقي، واجهت مشكلة في خادم الذكاء الاصطناعي السحابي. سأحاول المساعدة محلياً بناءً على قراءتي للوضع.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendQuery(inputText);
  };

  const triggerQuickAction = (actionTitle: string, queryText: string) => {
    setShowQuickActions(false);
    handleSendQuery(queryText);
  };

  return (
    <>
      <div 
        className={`fixed bottom-4 right-4 sm:w-96 w-[calc(100vw-32px)] bg-slate-50 border border-indigo-200/80 rounded-2xl shadow-2xl z-50 flex flex-col transition-all transform origin-bottom-right overflow-hidden ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        } ${isMinimized ? 'h-16 shadow-lg border-indigo-300' : 'h-[500px] max-h-[85vh]'}`}
        dir="rtl"
      >
        {/* Header toolbar */}
        <div 
          className="bg-[#1A365D] p-3 text-white flex justify-between items-center shrink-0 cursor-pointer select-none" 
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <div>
              <h4 className="font-bold text-xs leading-tight flex items-center gap-1">
                <span>المستشار الميداني</span>
                <span className="text-[9px] bg-indigo-500 text-indigo-100 px-1 py-0.5 rounded-md font-sans">EAG AI v1.1</span>
              </h4>
              <p className="text-[9px] text-indigo-200 leading-tight">موجهك التفاوضي ومحلل المبيعات ومخزون السيارة</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-200">
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                setShowQuickActions(true);
                setMessages([
                  {
                    role: 'model',
                    text: 'تمت إعادة تهيئة مستشارك الميداني مجدداً بنجاح! 🔄\n\nالبطاقات التفاعلية الحيوية، وأدوات جرد السيارة وسياق مديونيات العملاء معروضة الآن بالكامل لمساعدتك. كيف يمكنني إرشادك اليوم؟'
                  }
                ]);
              }}
              className="px-2 py-0.5 ml-2 hover:bg-white/20 bg-indigo-500/60 hover:bg-indigo-600 text-[10px] font-black rounded-full flex items-center gap-0.5 transition-colors border border-indigo-300/40 cursor-pointer"
              title="بدء محادثة جديدة وعرض الخيارات مجدداً"
            >
              <RotateCcw className="h-3 w-3" />
              <span>جديد</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
              title={isMinimized ? "تكبير" : "تصغير"}
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="p-1 hover:bg-rose-600 rounded-md transition-colors"
              title="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Live connected database badge */}
        {!isMinimized && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-3 py-1.5 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between text-[10px] text-emerald-800 font-black">
              <span className="flex items-center gap-1">
                <Database className="h-3 w-3 text-emerald-500 animate-pulse" />
                مساعدك الحي يرى جرد السيارة والمديونيات الآن
              </span>
              <span className="bg-emerald-100/80 text-emerald-950 px-1.5 py-0.5 rounded-full text-[9px]">
                {products.length} أصناف • {customers.length} تجار
              </span>
            </div>
            
            <div className="flex items-center justify-between border-t border-emerald-100/60 pt-1">
              <button
                type="button"
                onClick={() => setShowQuickActions(prev => !prev)}
                className="text-[9px] font-black text-indigo-700 hover:text-indigo-900 bg-white hover:bg-slate-50 px-2 py-0.5 rounded border border-indigo-200/60 shadow-xs cursor-pointer transition-colors flex items-center gap-1 shrink-0"
              >
                <span>{showQuickActions ? '⬇️ إخفاء أزرار الاستشارة السريعة' : '📋 عرض أزرار الاستشارة السريعة'}</span>
              </button>
              <span className="text-[8px] text-slate-400 font-sans">تحديث فوري وتفاعلي</span>
            </div>
          </div>
        )}

        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scroll bg-slate-50/50">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] p-3 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-xs shadow-md' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-sm font-medium'
                  }`}>
                    {m.role === 'model' ? (
                      <div className="flex flex-col gap-2">
                        <div className="markdown-body prose prose-sm prose-slate text-justify">
                          <Markdown>{m.text}</Markdown>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                          <span className="text-[8px] text-slate-400 font-sans tracking-tight">EAG Cognitive AI Engine</span>
                          {isPlaying === idx ? (
                            <button
                              type="button"
                              onClick={stopAudio}
                              className="text-rose-500 hover:text-rose-600 p-1 bg-rose-50 rounded-lg transition-colors border border-rose-100 flex items-center gap-1 text-[9px] font-bold"
                              title="إيقاف"
                            >
                              <Square className="h-3 w-3" />
                              <span>إيقاف القراءة</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => playAudio(m.text, idx)}
                              className="text-indigo-600 hover:text-indigo-700 p-1 bg-indigo-50/80 rounded-lg transition-colors border border-indigo-100/50 flex items-center gap-1 text-[9px] font-bold"
                              title="استمع"
                            >
                              <Volume2 className="h-3 w-3 text-indigo-500" />
                              <span>استماع صوتي</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="whitespace-pre-line font-semibold text-right block">{m.text}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Dynamic Quick Actions at the beginning of conversation */}
              {showQuickActions && (
                <div className="flex flex-col gap-2 mt-1 px-1 bg-white border border-slate-200/60 p-3 rounded-xl shadow-xs">
                  <span className="text-[10px] font-black text-indigo-900 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    استشارات ميكرو للتاجر والسيارة بضغطة واحدة:
                  </span>
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => triggerQuickAction(
                        "خطة تصفية جرد السيارة",
                        "اقترح عليّ خطة مبيعات ذكية لتسويق البضاعة المتبقية في السيارة اليوم وتصفيتها بالكامل نقداً بالاعتماد على الحمولات والأرصدة المتاحة."
                      )}
                      className="p-2 bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl text-right transition-all cursor-pointer flex flex-col gap-0.5 justify-center hover:bg-indigo-50/20"
                    >
                      <span className="text-xs font-black text-indigo-950">📦 خطة تسويق وتصفية السيارة</span>
                      <span className="text-[9px] text-slate-500 font-sans">دراسة جرد السيارة الفعلي ودفع بيعه بالكامل</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => triggerQuickAction(
                        "خطة موازنة تحصيل الديون",
                        "حلل مديونيات وتسهيلات الديون المعلقة على التجار الراهنة واقترح علي طريقة تفاوض وجدولة ذكية لتحصيل المبالغ دون غضب المحلات."
                      )}
                      className="p-2 bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl text-right transition-all cursor-pointer flex flex-col gap-0.5 justify-center hover:bg-indigo-50/20"
                    >
                      <span className="text-xs font-black text-purple-950">💸 موازنة وضبط مديونيات التسهيل المعلقة</span>
                      <span className="text-[9px] text-slate-500 font-sans">تحليل ديون المحلات وكيفية الدفع الآمن</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerQuickAction(
                        "حل مشاكل رفض العملاء",
                        "كيفية التعامل مع عميل معترض يرفض إدخال بضاعة جديدة بحجة قلة الإقبال أو عارض السعر أو مواعيد توريد وفواتير قديمة؟"
                      )}
                      className="p-2 bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl text-right transition-all cursor-pointer flex flex-col gap-0.5 justify-center hover:bg-indigo-50/20"
                    >
                      <span className="text-xs font-black text-rose-950">🎯 سيناريو تجاوز الرفض والمفاوضة</span>
                      <span className="text-[9px] text-slate-500 font-sans">مهارات الذكاء الوجداني وإقناع التاجر الفوري</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerQuickAction(
                        "ملخص كفاءة الرحلة الميدانية اليوم",
                        "احسب لي كفاءة التوريد اليوم (المبيعات والمحصلة كاش، المصاريف والمديونيات الجديدة)، وأعطني نصائح سريعة لتقليص نفقات السفر وزيادة الأرباح اليومية."
                      )}
                      className="p-2 bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl text-right transition-all cursor-pointer flex flex-col gap-0.5 justify-center hover:bg-indigo-50/20"
                    >
                      <span className="text-xs font-black text-amber-950">📊 تحليل الكفاءة المالية والأرباح الميدانية</span>
                      <span className="text-[9px] text-slate-500 font-sans">تقييم كامل للأداء الكلي وحماية الكابيتال كاش</span>
                    </button>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border text-center border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                    <span className="text-[10px] font-bold text-slate-500">جاري وضع خطتك الميدانية الذكية...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              <form onSubmit={handleSend} className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="ابحث عن نصيحة بيعية أو اسأل عن صنف..."
                    disabled={isLoading}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 pl-10 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                  <button
                    type="button"
                    onClick={startListening}
                    disabled={isLoading || isListening}
                    className={`absolute left-1.5 top-1.5 p-1 rounded-lg transition-colors ${
                      isListening ? 'text-rose-500 bg-rose-50 animate-pulse' : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-100'
                    }`}
                    title="تحدث بصوتك"
                  >
                    <Mic className="h-4.5 w-4.5" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || (!inputText.trim() && !isListening)}
                  className="bg-[#1A365D] hover:bg-slate-800 text-white w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-50 transition-colors shadow-sm shrink-0 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </>
  );
}

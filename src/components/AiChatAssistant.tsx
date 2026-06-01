import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Maximize2, Minimize2, Mic, Volume2, Square } from 'lucide-react';
import Markdown from 'react-markdown';

interface AiChatAssistantProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

export default function AiChatAssistant({ isOpen, setIsOpen }: AiChatAssistantProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'model', text: string }>>([
    {
      role: 'model',
      text: 'مرحباً بك يا بطل المبيعات الميدانية! 👋\nكيف يمكنني مساعدتك؟ يمكنك سؤالي عن نصائح بيعية، كيفية التعامل مع عميل غاضب، التفاوض، أو أي موقف سوقي.'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isMinimized]);

  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState<number | null>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('متصفحك لا يدعم خاصية التحدث الصوتي.');
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
      alert('متصفحك لا يدعم خاصية تحويل النص إلى صوت.');
      return;
    }
    window.speechSynthesis.cancel();
    
    // Remove markdown formatting before reading
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: 'أنت مستشار مبيعات ميداني محترف وموجه نفسي وسلوكي، تتحدث معي كصديق ومستشار حقيقي في السوق. مهمتك هي مناقشتي بصورة تفاعلية، وتحليل مواقفي، وتوجيهي لاكتشاف قصوري ومعالجة أخطائي للوصول إلى أفضل النتائج الممكنة. يجب أن تتحدث بأسلوب حواري وتفاعلي لمعالجة المشاكل الميدانية، وتقدم إرشاداً لتجاوز الرفض أو التفاوض بذكاء، معتمدًا على أحدث المصادر وتمنح حلولاً عملية فورية.',
          history: messages.slice(1).map(m => ({
            role: m.role,
            text: m.text
          })),
          message: userMessage
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'model', text: data.text }]);
      } else {
        throw new Error('فشل جلب الرد');
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'عفواً، لا يمكنني الاتصال بالشبكة حالياً. حاول مجدداً لاحقاً.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div 
        className={`fixed bottom-4 right-4 sm:w-96 w-[calc(100vw-32px)] bg-slate-50 border border-slate-200 rounded-2xl shadow-2xl z-50 flex flex-col transition-all transform origin-bottom-right overflow-hidden ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'} ${isMinimized ? 'h-16' : 'h-[500px] max-h-[85vh]'}`}
      >
        <div className="bg-[#1A365D] p-3 text-white flex justify-between items-center shrink-0 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-indigo-300" />
            <div>
              <h4 className="font-bold text-sm leading-tight">المستشار الميداني</h4>
              <p className="text-[9px] text-indigo-200 leading-tight">مدعوم بالذكاء الاصطناعي السلوكي</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="p-1 hover:bg-rose-500/80 rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scroll">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-sm' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                  }`}>
                    {m.role === 'model' ? (
                      <div className="flex flex-col gap-2">
                        <div className="markdown-body text-xs prose prose-sm prose-indigo rtl">
                          <Markdown>{m.text}</Markdown>
                        </div>
                        <div className="flex justify-end pt-1 border-t border-slate-100">
                          {isPlaying === idx ? (
                            <button
                              type="button"
                              onClick={stopAudio}
                              className="text-rose-500 hover:text-rose-600 p-1 bg-rose-50 rounded-md transition-colors"
                              title="إيقاف الصوت"
                            >
                              <Square className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => playAudio(m.text, idx)}
                              className="text-indigo-500 hover:text-indigo-600 p-1 bg-indigo-50 rounded-md transition-colors"
                              title="الاستماع للإجابة"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      m.text.split('\n').map((line, i) => (
                        <span key={i} className="block whitespace-pre-wrap">
                          {line}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border text-center border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm p-3 w-16 shadow-sm flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              <form onSubmit={handleSend} className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="ابحث عن نصيحة بيعية..."
                    disabled={isLoading}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pl-10 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={startListening}
                    disabled={isLoading || isListening}
                    className={`absolute left-1 top-1 p-1.5 rounded-lg transition-colors ${
                      isListening ? 'text-rose-500 bg-rose-50 animate-pulse' : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-100'
                    }`}
                    title="تحدث بصوتك"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || (!inputText.trim() && !isListening)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-50 transition-colors shadow-sm shrink-0"
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

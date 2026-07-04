import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

// 📿 قائمة الأدعية والأذكار التي تظهر بالتناوب
export const DUAS_LIST = [
  "ألا بذكر الله تطمئن القلوب 🤍",
  "لا إله إلا أنت سبحانك إني كنت من الظالمين 🤲",
  "اللهم صلِّ وسلم على نبينا محمد وعلى آله وصحبه أجمعين ﷺ",
  "لا حول ولا قوة إلا بالله (كنز من كنوز الجنة) 💎",
  "سبحان الله وبحمده، سبحان الله العظيم ✨",
  "أستغفر الله العظيم وأتوب إليه 📿",
  "بسم الله، توكلت على الله، ولا حول ولا قوة إلا بالله 🌿",
  "اللهم إني أسألك علماً نافعاً، ورزقاً طيباً، وعملاً متقبلاً 🌾",
  "اللهم اكفني بحلالك عن حرامك، وأغنني بفضلك عمن سواك 💰",
  "اللهم اهْدِني وسدّدْني، واجعل عملي خالصاً لوجهك الكريم 🕊️",
  "لا تنسَ ذكر الله يا أخي الكريم 📿",
  "صلوا على من بكى شوقاً لرؤيتكم ﷺ",
  "اللهم صلِّ على محمد وعلى آل محمد 🤍",
  "اللهم بارك لي في رزقي ووقتي 🤲",
  "اللهم يسِّر لي أمري وسدِّد خطاي 🌿",
  "الحمد لله حمداً كثيراً طيباً مباركاً فيه ✨",
  "لا إله إلا الله وحده لا شريك له 📿",
  "الله أكبر كبيراً، والحمد لله كثيراً 🌿",
  "حسبي الله ونعم الوكيل 🕊️",
  "يا حي يا قيوم برحمتك أستغيث 🤲",
  "اللهم أسألك نفساً بك مطمئنة 🤍",
  "ربِّ اغفر لي وتُب عليَّ 📿",
  "اللهم إنك عفوٌّ تحب العفو فاعفُ عني 🌿"
];

// التحقق من أن الوقت الحالي بين الساعة 9 صباحاً و 11 مساءً
const isWithinActiveHours = (): boolean => {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 9 && hours < 23;
};

export default function Adduaa() {
  const [currentDua, setCurrentDua] = useState<string | null>(null);
  const [visible, setVisible] = useState<boolean>(false);

  const triggerRandomDua = () => {
    if (!isWithinActiveHours()) return;
    
    // اختيار ذكر عشوائي
    const randomIndex = Math.floor(Math.random() * DUAS_LIST.length);
    setCurrentDua(DUAS_LIST[randomIndex]);
    setVisible(true);

    // إخفاء التذكير تلقائياً بعد 8 ثوانٍ
    const timer = setTimeout(() => {
      setVisible(false);
    }, 8000);

    return timer;
  };

  useEffect(() => {
    // إطلاق أول ذكر بعد 5 ثوانٍ من فتح التطبيق
    const initialTimer = setTimeout(() => {
      triggerRandomDua();
    }, 5000);

    // إعداد التنبيه ليعمل كل 10 دقائق (10 * 60 * 1000 مللي ثانية)
    const INTERVAL_MS = 10 * 60 * 1000;
    const intervalId = setInterval(() => {
      triggerRandomDua();
    }, INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, []);

  if (!visible || !currentDua) return null;

  return (
    <div 
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md bg-[#1A365D]/95 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-2xl border border-amber-500/30 flex flex-col gap-2 transition-all duration-500 animate-in fade-in slide-in-from-bottom-8 text-right"
      dir="rtl"
    >
      <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
        <div className="flex items-center gap-1.5 text-amber-300 font-black text-[11.5px]">
          <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
          <span>تذكير إيماني 📿</span>
        </div>
        <button 
          onClick={() => setVisible(false)} 
          className="text-white/40 hover:text-white/80 p-0.5 rounded-full transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="text-sm font-bold leading-relaxed text-amber-50 py-1 font-sans">
        {currentDua}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Eye, EyeOff, Clipboard, PhoneCall, MessageSquare } from 'lucide-react';

interface SecurePhoneProps {
  phone: string;
  className?: string;
  enableWhatsApp?: boolean;
}

export default function SecurePhoneDisplay({ phone, className = '', enableWhatsApp = true }: SecurePhoneProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!phone) {
    return <span className="text-gray-400 text-[11px]">بدون رقم</span>;
  }

  // Obfuscate / Mask phone number: e.g. "0102345678" -> "010****5678"
  const getMaskedPhone = (num: string) => {
    const clean = num.trim();
    if (clean.length <= 6) return '***' + clean.slice(-2);
    const prefix = clean.slice(0, 3);
    const suffix = clean.slice(-4);
    return `${prefix}****${suffix}`;
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRevealed(!revealed);
  };

  const getCleanWhatsAppLink = () => {
    let clean = phone.trim();
    if (clean.startsWith('0')) {
      clean = '20' + clean.substring(1);
    }
    return `https://wa.me/${clean}`;
  };

  return (
    <div 
      className={`inline-flex items-center gap-1.5 bg-slate-50/80 px-2 py-1 rounded-lg border border-slate-150 text-right select-none ${className}`}
      dir="ltr"
      id="secure-phone-wrapper"
    >
      {/* Interactive Helper Utilities */}
      <div className="flex items-center gap-1">
        {enableWhatsApp && (
          <a
            href={getCleanWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            title="مراسلة واتساب"
            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageSquare className="h-3 w-3" />
          </a>
        )}
        <a
          href={`tel:${phone}`}
          title="اتصال هاتف بيئي"
          className="p-1 text-[#1A365D] hover:bg-zinc-100 rounded transition-colors cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <PhoneCall className="h-3 w-3" />
        </a>
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? "تم النسخ!" : "نسخ الرقم السري"}
          className={`p-1 rounded transition-colors cursor-pointer ${copied ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:bg-zinc-100'}`}
        >
          <Clipboard className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={toggleReveal}
          title={revealed ? "إخفاء الرقم لمنع السرقة" : "عرض الرقم بالكامل"}
          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
        >
          {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3 text-red-500 animate-pulse" />}
        </button>
      </div>

      {/* The masked or revealed value with visual security hint */}
      <span className={`font-mono text-xs font-black tracking-wider transition-all ${revealed ? 'text-[#1A365D] select-all bg-indigo-50/50 px-1 rounded' : 'text-slate-600 font-semibold'}`}>
        {revealed ? phone : getMaskedPhone(phone)}
      </span>
    </div>
  );
}

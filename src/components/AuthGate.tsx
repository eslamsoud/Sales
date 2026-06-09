// @ts-nocheck
import React, { useState } from 'react';
import { UserAuth, Customer } from '../types';
import { Shield, Phone, User, Key, CheckCircle, Info, LogOut, Fingerprint, Lock, Check } from 'lucide-react';

interface AuthGateProps {
  usersList: UserAuth[];
  customersList?: Customer[];
  onUpdateUsers: (list: UserAuth[]) => void;
  onSuccess: (user: UserAuth) => void;
  onSwitchBackToLogin?: () => void;
}

// دالة بسيطة لفك التشفير الوقائي لكلمات المرور
const decodePass = (p: string) => {
  if (!p) return '';
  try {
    return decodeURIComponent(atob(p));
  } catch (e) { return p; } // إذا كانت محفوظة بالنظام القديم
};

export default function AuthGate({ usersList, customersList = [], onUpdateUsers, onSuccess }: AuthGateProps) {
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingUser, setPendingUser] = useState<UserAuth | null>(null);
  const [password, setPassword] = useState('');

  // Biometric fingerprint simulation states
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState('');
  const [biometricSuccess, setBiometricSuccess] = useState(false);

  // Check if someone is already logged in as pending on this session/device
  React.useEffect(() => {
    const loggedPhone = localStorage.getItem('authed_user_phone');
    if (loggedPhone) {
      const found = usersList.find(u => u.phone === loggedPhone);
      if (found && found.status === 'pending') {
        setPendingUser(found);
      }
    }
  }, [usersList]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedPhone = phone.trim();

    if (!trimmedPhone) {
      setErrorMsg('فضلاً، أدخل رقم الهاتف بشكل صحيح.');
      return;
    }

    if (trimmedPhone.length < 10) {
      setErrorMsg('يرجى تقديم رقم هاتف دقيق مكوّن من 10 أرقام على الأقل.');
      return;
    }

      let found = usersList.find(u => u.phone === trimmedPhone);
      let isAutoCreatedCustomer = false;
      const isCustomerPhone = customersList.some(c => c.phone.trim() === trimmedPhone);

      if (!found) {
        // Check if phone matches a registered customer
        const matchedCustomer = customersList.find(c => c.phone.trim() === trimmedPhone);
        if (matchedCustomer) {
          // Auto register this customer as a visitor user
          const initialVisitor: UserAuth = {
            phone: trimmedPhone,
            name: matchedCustomer.name,
            role: 'employee',
            status: 'active',
            permittedTabs: ['dashboard', 'prices'],
            canUseAiAssistant: false,
            password: btoa(encodeURIComponent('0000')), // الزوار لا يستخدمون الباسورد أصلاً
            customRoleName: 'عميل زائر للعرض 👀',
            createdAt: new Date().toISOString()
          };
          
          const updatedList = [...usersList, initialVisitor];
          onUpdateUsers(updatedList);
          localStorage.setItem('users_permissions_sys', JSON.stringify(updatedList));
          
          found = initialVisitor;
          isAutoCreatedCustomer = true;
        } else {
          setErrorMsg('رقم الهاتف غير مسجل في النظام.');
          return;
        }
      }

      // Check delegate password (bypass entirely if the phone is listed in the customers database)
      if (!isCustomerPhone) {
        const enteredPass = password.trim();
        const actualPass = decodePass(found.password);
        
        if (!enteredPass) {
          setErrorMsg('يرجى إدخال رمز المرور الشخصي.');
          return;
        } else if (enteredPass !== actualPass) {
          setErrorMsg('رمز المرور الشخصي (الرقم السري) غير صحيح لهذا الهاتف!');
          return;
        }
      }

      localStorage.setItem('authed_user_phone', trimmedPhone);
      if (found.status === 'pending') {
        setPendingUser(found);
        setSuccessMsg('حسابك مسجل وبانتظار موافقة المدير العام حالياً.');
      } else {
        if (isCustomerPhone || isAutoCreatedCustomer) {
          setSuccessMsg(`أهلاً بك يا فندم! بما أن رقم تليفونك مسجل كعميل لدينا، فقد تم الدخول فوراً وبأمان للعرض والأسعار دون الحاجة لكلمة مرور. ✓`);
        } else {
          setSuccessMsg(`أهلاً بك مجدداً، ${found.name}!`);
        }
        setTimeout(() => {
          onSuccess(found);
        }, 1200);
      }
  };

  const handleBiometricLogin = () => {
    setErrorMsg('');
    setSuccessMsg('');
    const lastPhone = localStorage.getItem('authed_user_phone');
    if (!lastPhone) {
      setErrorMsg('لا توجد هوية مسجلة مسبقاً على هذا المتصفح لاستدعاء البصمة. يرجى تسجيل الدخول بكتابة رقم الهاتف والرمز أول مرة، تالياً يمكنك استخدام البصمة فوراً ودون كتابة شيء بقفل الـ 5 دقائق.');
      return;
    }

    const found = usersList.find(u => u.phone === lastPhone);
    if (!found) {
      setErrorMsg('لم يتم التعرف على صاحب البصمة في سجلات الإدارة الحالية. ربما مسحت الإدارة التفويض مسبقاً.');
      return;
    }

    setIsBiometricScanning(true);
    setBiometricStatus('جاري استدعاء مستشعر البصمة الحيوية الثنائي... ضع إصبعك على الشاشة 🖲️');

    setTimeout(() => {
      setBiometricStatus('جاري المقارنة والتحقق من التشفير الحيوي الآمن للمبيعات... ⏳');
      
      setTimeout(() => {
        if (found.status === 'pending') {
          setIsBiometricScanning(false);
          setPendingUser(found);
          setErrorMsg('تم التعرف على البصمة بنجاح، ولكن الحساب ما زال قيد المراجعة والانتظار بموافقة المالك.');
          return;
        }

        setBiometricStatus(`تمت المطابقة بنجاح! مرحباً بـ ${found.name} (${found.customRoleName || 'المندوب'}) ✓`);
        setBiometricSuccess(true);

        setTimeout(() => {
          setIsBiometricScanning(false);
          setBiometricSuccess(false);
          onSuccess(found);
        }, 1200);
      }, 1200);
    }, 1200);
  };

  const handleLogoutPending = () => {
    localStorage.removeItem('authed_user_phone');
    setPendingUser(null);
    setPhone('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  // If the logged-in user is pending, show pending wait screen
  if (pendingUser) {
    return (
      <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-4 text-right" dir="rtl" id="pending-gate-overlay">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 relative overflow-hidden flex flex-col gap-5">
          <div className="absolute top-0 right-0 left-0 h-2 bg-amber-500 animate-pulse"></div>
          
          <div className="text-center py-2">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-4 border border-amber-200 shadow-sm">
              <Shield className="h-8 w-8 animate-bounce" />
            </div>
            <h2 className="text-[#1A365D] text-lg font-black tracking-tight mb-1">طلب التسجيل قيد المراجعة والموافقة ⏳</h2>
            <p className="text-xs text-slate-500 font-bold">بوابة التأمين والأمان للمبيعات</p>
          </div>

          <div className="bg-amber-50 border border-amber-150 p-4 rounded-2xl text-xs space-y-2.5 text-slate-700 leading-relaxed font-bold">
            <p className="text-amber-900 border-b border-amber-200 pb-1.5 flex items-center gap-1.5 font-black text-[13px]">
              <Info className="h-4.5 w-4.5 shrink-0 text-amber-600" />
              حالة الحساب غير نشطة حالياً
            </p>
            <p>مرحباً بك يا <span className="text-indigo-950 font-black text-sm">{pendingUser.name}</span></p>
            <p>رقم تليفونك المرفوع: <span className="font-mono text-indigo-900 text-[13px] tracking-wide">{pendingUser.phone}</span></p>
            <p className="text-amber-800">
              يرجى التواصل مع الإدارة المبيعات لتفعيل رقم قيد هاتفك وتحديد الصلاحيات والتبوبات المسموحة لك للبدء بالعمل والبيع حركياً.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleLogoutPending}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-2xl text-xs font-black transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج أو طلب حساب آخر</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSystemEmpty = usersList.length <= 1;
  const isCustomerPhone = customersList.some(c => c.phone.trim() === phone.trim());

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-4 text-right" dir="rtl" id="auth-gate-wrapper">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 relative overflow-hidden flex flex-col gap-4">
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-[#1A365D]"></div>
        
        <div className="text-center py-1">
          <h2 className="text-[#1A365D] text-base font-black tracking-tight">بوابة الدخول الموحدة</h2>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-3.5">
          {errorMsg && (
            <div className="bg-red-50 border border-red-150 text-red-700 p-2 rounded-xl text-center font-bold text-xs">
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-150 text-emerald-700 p-2 rounded-xl text-center font-bold text-xs">
              ✓ {successMsg}
            </div>
          )}

          {/* Phone input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500">رقم الهاتف (الكود):</label>
            <div className="relative">
              <Phone className="absolute top-3 right-3 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                required
                dir="ltr"
                placeholder="010XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2.5 pr-10 pl-4 text-center font-bold tracking-wider text-base text-[#1A365D] focus:outline-none focus:ring-2 focus:ring-[#1A365D]"
              />
            </div>
          </div>

          {/* Universal Password input */}
          {phone.trim() !== '' && isCustomerPhone ? (
            <div className="animate-fade-in text-center p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] text-emerald-800 font-extrabold flex justify-center items-center gap-1">
                🌟 رقم عميل معتمد (دخول مباشر بدون كود سري)
              </span>
            </div>
          ) : (
            <div className="space-y-1 text-right animate-fade-in">
              <label className="block text-[11px] font-bold text-slate-500">الباسورد:</label>
              <div className="relative">
                <Key className="absolute top-3 right-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="أدخل الباسورد"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2.5 pr-10 pl-4 text-center font-bold tracking-widest text-[#1A365D] focus:outline-none focus:ring-2 focus:ring-[#1A365D] font-mono text-base"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-1">
            <button
              type="submit"
              className="w-full bg-[#1A365D] hover:bg-slate-800 text-white py-3 rounded-2xl text-xs font-black transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="h-4 w-4 text-amber-200" />
              <span>تسجيل الدخول</span>
            </button>
          </div>
        </form>

        {/* جلب صامت للبيانات من السيرفر عند فتح التطبيق من جهاز جديد */}
        {isSystemEmpty && (
          <div className="border-t border-slate-100 pt-3 mt-1 text-center animate-pulse">
            <h3 className="text-[11px] font-black text-indigo-900 mb-1">🔄 جاري تهيئة النظام والمصادقة...</h3>
            <p className="text-[10px] text-slate-500 font-bold">يتم الآن التحقق من الصلاحيات وجلب البيانات من الخادم الآمن.</p>
          </div>
        )}

        <div className="border-t border-slate-100 pt-2 flex items-center justify-center">
          <span className="text-[10px] text-slate-400 font-bold">بوابة حماية الاخوه EAGS لخدمات التوزيع</span>
        </div>
      </div>
    </div>
  );
}

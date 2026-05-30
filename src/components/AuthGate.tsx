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

export default function AuthGate({ usersList, customersList = [], onUpdateUsers, onSuccess }: AuthGateProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState(() => localStorage.getItem('authed_user_phone') || '');
  const [name, setName] = useState('');
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();

    if (!trimmedPhone) {
      setErrorMsg('فضلاً، أدخل رقم الهاتف بشكل صحيح.');
      return;
    }

    if (trimmedPhone.length < 10) {
      setErrorMsg('يرجى تقديم رقم هاتف دقيق مكوّن من 10 أرقام على الأقل.');
      return;
    }

    if (isRegister) {
      if (!trimmedName) {
        setErrorMsg('فضلاً، يرجى كتابة الاسم الكامل لتسجيل حسابك الجديد.');
        return;
      }

      // Check if phone already registered
      const exists = usersList.some(u => u.phone === trimmedPhone);
      if (exists) {
        setErrorMsg('رقم الهاتف هذا مسجّل بالفعل مسبقاً! جرب تسجيل الدخول بدلاً من ذلك.');
        return;
      }

      // First user is Owner, others are employee/pending
      const isFirstUser = usersList.length === 0;
      const newUser: UserAuth = {
        phone: trimmedPhone,
        name: trimmedName,
        role: isFirstUser ? 'owner' : 'employee',
        status: isFirstUser ? 'active' : 'pending',
        permittedTabs: isFirstUser 
          ? ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'administrative', 'reports']
          : ['dashboard'], // Only dashboard or wait screen
        password: password.trim() || '1234', // custom password choice
        createdAt: new Date().toISOString()
      };

      const updatedList = [...usersList, newUser];
      onUpdateUsers(updatedList);
      localStorage.setItem('users_permissions_sys', JSON.stringify(updatedList));

      if (isFirstUser) {
        localStorage.setItem('authed_user_phone', trimmedPhone);
        setSuccessMsg('تم تسجيلك كمالك ومدير أول للنظام بنجاح!');
        setTimeout(() => {
          onSuccess(newUser);
        }, 1500);
      } else {
        localStorage.setItem('authed_user_phone', trimmedPhone);
        setPendingUser(newUser);
        setSuccessMsg('تم تقديم طلب تسجيل حسابك الجديد! بانتظار موافقة الإدارة وتفعيله فوراً.');
      }
    } else {
      // Login flow
      if (trimmedPhone === '01228466613') {
        const correctPassword = localStorage.getItem('owner_passcode_sys') || '1987';
        if (password.trim() !== correctPassword) {
          setErrorMsg('كلمة المرور غير صحيحة للمدير العام!');
          return;
        }

        // Automatic registration or update of Owner 01228466613
        const existingIndex = usersList.findIndex(u => u.phone === '01228466613');
        let updatedList = [...usersList];
        const ownerUser: UserAuth = {
          phone: '01228466613',
          name: 'الأخوة المتحدون (المدير)',
          role: 'owner',
          status: 'active',
          permittedTabs: ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'administrative', 'reports'],
          password: correctPassword,
          createdAt: new Date().toISOString()
        };

        if (existingIndex > -1) {
          updatedList[existingIndex] = { 
            ...updatedList[existingIndex], 
            role: 'owner', 
            status: 'active', 
            password: correctPassword,
            permittedTabs: ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'administrative', 'reports'] 
          };
        } else {
          updatedList.push(ownerUser);
        }

        onUpdateUsers(updatedList);
        localStorage.setItem('users_permissions_sys', JSON.stringify(updatedList));
        localStorage.setItem('authed_user_phone', '01228466613');

        setSuccessMsg('تم التحقق بنجاح! مرحباً بالمدير العام.');
        setTimeout(() => {
          onSuccess(ownerUser);
        }, 1000);
        return;
      }

      if (trimmedPhone === '01281391552') {
         // Automatic registration or update of Deputy Manager 01281391552
         const existingIndex = usersList.findIndex(u => u.phone === '01281391552');
         let updatedList = [...usersList];
         
         // Allowed tabs for Deputy: everything INCLUDING 'administrative' for supervision/management
         const deputyTabs = ['dashboard', 'factory', 'customers', 'invoice', 'prices', 'expenses', 'administrative', 'reports'];
         const correctPassword = existingIndex > -1 ? (usersList[existingIndex].password || '1234') : '1234';
 
         if (password.trim() !== correctPassword) {
           setErrorMsg('رمز المرور الشخصي (الرمز السري) غير صحيح لنائب المدير العام!');
           return;
         }
 
         const deputyUser: UserAuth = {
           phone: '01281391552',
           name: existingIndex > -1 ? usersList[existingIndex].name : 'الأستاذ/ نائب المدير العام والمشرف الجغرافي',
           role: 'employee',
           status: 'active',
           permittedTabs: existingIndex > -1 ? usersList[existingIndex].permittedTabs : deputyTabs,
           customRoleName: existingIndex > -1 ? (usersList[existingIndex].customRoleName || 'نائب المدير والاشراف 💼') : 'نائب المدير والاشراف 💼',
           password: correctPassword,
           createdAt: new Date().toISOString()
         };
 
         if (existingIndex > -1) {
           updatedList[existingIndex] = {
             ...updatedList[existingIndex],
             status: 'active',
             permittedTabs: updatedList[existingIndex].permittedTabs
           };
         } else {
           updatedList.push(deputyUser);
         }
 
         onUpdateUsers(updatedList);
         localStorage.setItem('users_permissions_sys', JSON.stringify(updatedList));
         localStorage.setItem('authed_user_phone', '01281391552');
 
         setSuccessMsg('تم التحقق بنجاح! مرحباً بنائب المدير العام والمشرف.');
         setTimeout(() => {
           onSuccess(deputyUser);
         }, 1000);
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
            password: '1234',
            customRoleName: 'عميل زائر للعرض 👀',
            createdAt: new Date().toISOString()
          };
          
          const updatedList = [...usersList, initialVisitor];
          onUpdateUsers(updatedList);
          localStorage.setItem('users_permissions_sys', JSON.stringify(updatedList));
          
          found = initialVisitor;
          isAutoCreatedCustomer = true;
        } else {
          // Redirection for unregistered numbers to register & get approval
          setIsRegister(true);
          setName('');
          setPhone(trimmedPhone);
          setErrorMsg('رقم الهاتف هذا غير مسجل مسبقاً! تم نقلكم تلقائياً لصفحة التسجيل. يرجى كتابة اسمكم بالكامل واختيار كود سري لإرسال طلب فوري لموافقة وتفعيل الإدارة.');
          return;
        }
      }

      // Check delegate password (bypass entirely if the phone is listed in the customers database)
      if (!isCustomerPhone) {
        const enteredPass = password.trim();
        const actualPass = found.password || '1234';
        if (enteredPass !== actualPass) {
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
        
        // اقتراح تسجيل بصمة الجهاز (Passkey / WebAuthn) لتسهيل الدخول مستقبلاً
        if (window.PublicKeyCredential && !isCustomerPhone && !isAutoCreatedCustomer && !localStorage.getItem(`passkey_id_${trimmedPhone}`)) {
          try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            const userId = new Uint8Array(16);
            window.crypto.getRandomValues(userId);
            
            const cred = await navigator.credentials.create({
              publicKey: {
                challenge,
                rp: { name: "تطبيق المبيعات" },
                user: { id: userId, name: trimmedPhone, displayName: found.name },
                pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
                authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
                timeout: 60000
              }
            }) as PublicKeyCredential;
            
            if (cred) {
              localStorage.setItem(`passkey_id_${trimmedPhone}`, btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
            }
          } catch (e) {
            console.error("Biometric registration skipped:", e);
          }
        }

        setTimeout(() => {
          onSuccess(found);
        }, 500);
      }
    }
  };

  const handleBiometricLogin = async () => {
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

    if (window.PublicKeyCredential) {
      const savedIdBase64 = localStorage.getItem(`passkey_id_${lastPhone}`);
      if (savedIdBase64) {
        setIsBiometricScanning(true);
        setBiometricStatus('جاري استدعاء مستشعر البصمة الحيوية... ضع إصبعك على حساس البصمة في جهازك 🖲️');
        try {
          const rawId = Uint8Array.from(atob(savedIdBase64), c => c.charCodeAt(0));
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              allowCredentials: [{ id: rawId, type: 'public-key' }],
              userVerification: "required",
              timeout: 60000
            }
          });
          
          if (assertion) {
            setBiometricSuccess(true);
            setBiometricStatus(`تمت المطابقة بنجاح! مرحباً بـ ${found.name} ✓`);
            setSuccessMsg(`تمت المطابقة بنجاح! مرحباً بـ ${found.name} ✓`);
            setTimeout(() => {
              setIsBiometricScanning(false);
              setBiometricSuccess(false);
              onSuccess(found);
            }, 1000);
          }
        } catch (e) {
          console.error("Biometric verification failed:", e);
          setIsBiometricScanning(false);
          setErrorMsg('تم إلغاء التحقق أو فشل قراءة البصمة.');
        }
      } else {
        setErrorMsg('لم يتم تسجيل البصمة لهذا الحساب. يرجى الدخول بكلمة المرور لتفعيلها.');
      }
    } else {
      setErrorMsg('جهازك أو متصفحك لا يدعم التحقق بالبصمة (WebAuthn).');
    }
  };

  const handleLogoutPending = () => {
    localStorage.removeItem('authed_user_phone');
    setPendingUser(null);
    setPhone('');
    setName('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsRegister(false);
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
              يرجى التواصل مع المدير العام (صاحب النظام الأخوة المتحدون EAG) لتفعيل رقم قيد هاتفك وتحديد الصلاحيات والتبوبات المسموحة لك للبدء بالعمل والبيع حركياً.
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
            <div className="text-center mt-2">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">الأخوة المتحدون EAG لحماية البيانات والتوزيع © 2026</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSystemEmpty = usersList.length === 0;

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-4 text-right" dir="rtl" id="auth-gate-wrapper">
      
      {/* Immersive Biometric Scanning Overlay Screen */}
      {isBiometricScanning && (
        <div className="fixed inset-0 bg-[#0f172a]/95 z-50 flex flex-col items-center justify-center p-6 text-center text-white" id="biometric-modal animate-fade-in">
          <div className="relative mb-8">
            {/* Ripple effect rings */}
            <div className={`absolute -inset-8 bg-indigo-500/10 rounded-full ${biometricSuccess ? 'scale-150 opacity-0' : 'animate-ping'}`} />
            <div className={`absolute -inset-4 bg-indigo-500/20 rounded-full ${biometricSuccess ? 'scale-150 opacity-0' : 'animate-pulse'}`} />
            
            <div className={`h-24 w-24 rounded-full border-2 ${
              biometricSuccess ? 'border-emerald-500 bg-emerald-950/50 text-emerald-400' : 'border-indigo-500 bg-slate-900 text-indigo-400'
            } flex items-center justify-center transition-colors duration-500 shadow-2xl`}>
              {biometricSuccess ? (
                <Check className="h-12 w-12 animate-bounce" />
              ) : (
                <Fingerprint className="h-12 w-12 animate-pulse text-indigo-400" />
              )}
            </div>
          </div>

          <h3 className={`text-lg font-black mb-3 ${biometricSuccess ? 'text-emerald-400' : 'text-slate-100'}`}>
            {biometricSuccess ? 'بصمة مطابقة ✓' : 'التحقق الحيوي الذكي'}
          </h3>
          <p className="text-xs text-slate-400 font-bold max-w-xs leading-relaxed">
            {biometricStatus}
          </p>

          {!biometricSuccess && (
            <button
              onClick={() => setIsBiometricScanning(false)}
              className="mt-8 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 font-bold rounded-xl px-5 py-2 text-xs border border-slate-700 cursor-pointer transition-all"
            >
              إلغاء وفصل التحقق
            </button>
          )}
        </div>
      )}

      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative overflow-hidden flex flex-col gap-5">
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-indigo-600 via-[#DD6B20] to-emerald-500"></div>
        
        <div className="text-center py-2">
          <div className="mx-auto w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-3 border border-indigo-100 shadow-sm">
            <Shield className="h-7 w-7 text-indigo-700" />
          </div>
          {isRegister && <h2 className="text-[#1A365D] text-xl font-black tracking-tight mb-2">إنشاء حساب جديد</h2>}
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-red-50 border border-red-150 text-red-700 p-2.5 rounded-xl text-center font-extrabold text-xs">
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-150 text-emerald-700 p-2.5 rounded-xl text-center font-extrabold text-xs">
              ✓ {successMsg}
            </div>
          )}

          {/* Phone input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-black text-slate-600">رقم الدخول</label>
            <div className="relative">
              <Phone className="absolute top-3 right-3 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                name="username"
                autoComplete="username"
                required
                dir="ltr"
                placeholder=""
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2.5 pr-10 pl-4 text-center font-black tracking-wider text-base text-[#1A365D] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Universal Password input */}
          {!isRegister && !isSystemEmpty && phone.trim() !== '' && (
            customersList.some(c => c.phone.trim() === phone.trim()) ? (
              <div className="space-y-1 animate-fade-in text-right p-3 bg-emerald-50/85 border border-emerald-200 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                  <span className="text-sm">🌟</span>
                  <span>حساب عميل معتمد (دخول فوري تلقائي)</span>
                </div>
                <p className="text-[10.5px] text-emerald-900 font-extrabold leading-relaxed mt-1">
                  مرحباً بك يا فندم! رقم تليفونك مسجل ضمن <span className="text-indigo-800 underline font-black">قائمة الموزعين والعملاء المعتمدين</span> لدينا.
                  <br />
                  💡 لا تحتاج لكتابة أي رقم سري! يمكنك النقر مباشرة على زر 
                  <span className="bg-emerald-600 text-white rounded px-1.5 py-0.5 mx-1 font-black text-[9px] inline-block shadow-xs">دخول فوري كزائر للعرض 🔓</span> 
                  للدخول وتصفح الأصناف ومتابعة فروقات الأسعار فورا.
                </p>
              </div>
            ) : (
              <div className="space-y-1 animate-fade-in text-right">
                <label className="block text-[11px] font-black text-[#1A365D] font-extrabold flex justify-between items-center">
                  <span>رقم المرور</span>
                  {phone.trim() === '01228466613' && <span className="text-[9px] text-amber-600 font-mono">حساب المدير العام</span>}
                  {phone.trim() === '01281391552' && <span className="text-[9px] text-indigo-600 font-mono font-black">حساب نائب المدير العام & المندوب</span>}
                </label>

                <div className="relative">
                  <Key className="absolute top-3 right-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    placeholder=""
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2.5 pr-10 pl-4 text-center font-black tracking-widest text-[#1A365D] focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base"
                  />
                </div>
              </div>
            )
          )}

          {/* Name input (only for register) */}
          {(isRegister || isSystemEmpty) && (
            <div className="space-y-3 animate-fade-in">
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-600">الاسم</label>
                <div className="relative">
                  <User className="absolute top-3 right-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    placeholder=""
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2.5 pr-10 pl-4 text-center font-black text-xs text-[#1A365D] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-600">رقم المرور</label>
                <div className="relative">
                  <Key className="absolute top-3 right-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    name="new-password"
                    autoComplete="new-password"
                    required
                    placeholder=""
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-2xl py-2.5 pr-10 pl-4 text-center font-black tracking-widest text-[#1A365D] focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-1">
            <button
              type="submit"
              className="w-full bg-[#1A365D] hover:bg-[#2B6CB0] text-white py-3 rounded-2xl text-xs font-black transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Key className="h-4 w-4 text-indigo-200" />
              <span>
                {isSystemEmpty 
                  ? 'تأكيد تسجيل المالك الأول' 
                  : (isRegister ? 'إرسال طلب موافقة وتفعيل للإدارة' : 'تسجيل الدخول والتحقق الآمن')}
              </span>
            </button>

            {/* Biometric button for quick login */}
            {!isRegister && !isSystemEmpty && (
              <div className="flex flex-col gap-2 mt-2 border-t border-slate-100 pt-4">
                <span className="text-center text-[11px] font-bold text-slate-500 mb-1">أو الدخول السريع دون كتابة:</span>
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  className="w-full bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200 text-indigo-800 py-4 rounded-2xl text-sm font-black transition-all active:scale-98 flex items-center justify-center gap-3 cursor-pointer shadow-md"
                >
                  <Fingerprint className="h-7 w-7 text-indigo-600" />
                  <span>الدخول ببصمة الإصبع 🖲️</span>
                </button>
              </div>
            )}
          </div>
        </form>

      </div>
    </div>
  );
}

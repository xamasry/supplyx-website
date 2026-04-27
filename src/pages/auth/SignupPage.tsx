import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import toast from 'react-hot-toast';
import Logo from '../../components/ui/Logo';

export default function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [role, setRole] = useState<'buyer' | 'supplier'>('buyer');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const sendVerificationCode = async () => {
    if (!phone) {
       toast.error('يرجى إدخال رقم الواتساب أولاً');
       return;
    }
    
    let formattedPhone = phone;
    // ensure starts with 20 if length is 10/11
    if (formattedPhone.startsWith('01')) {
       formattedPhone = '2' + formattedPhone;
    } else if (formattedPhone.startsWith('1')) {
       formattedPhone = '20' + formattedPhone;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: formattedPhone })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('تم إرسال كود التحقق بنجاح');
        setPhone(formattedPhone);
        setStep(2);
      } else {
        toast.error('فشل إرسال კود التحقق. تأكد من الرقم.');
      }
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('يرجى إدخال كود صحيح مكون من 6 أرقام');
      return;
    }

    setLoading(true);
    try {
      // Check code matching in firestore
      const docRef = doc(db, 'phone_verifications', phone);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().code !== verificationCode) {
         toast.error('الكود غير صحيح، حاول مرة أخرى');
         setLoading(false);
         return;
      }

      // Check expiry
      if (new Date(docSnap.data().expiresAt) < new Date()) {
         toast.error('الكود منتهي الصلاحية، اطلب كود جديد');
         setLoading(false);
         return;
      }

      // Code is valid! Create account
      const loginEmail = email.includes('@') ? email : `${email}@supplyx.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
      
      const userId = userCredential.user.uid;
      
      await setDoc(doc(db, 'users', userId), {
         name,
         businessName,
         email: loginEmail,
         role,
         whatsappPhone: phone,
         whatsappOptIn: true,
         status: 'pending', // Requires admin approval
         disabled: true,
         createdAt: new Date().toISOString()
      }).catch(err => {
         handleFirestoreError(err, OperationType.CREATE, 'users');
      });

      // Sign out immediately because they are pending
      await auth.signOut();
      
      toast.success('تم تسجيل الحساب بنجاح! حسابك الآن قيد المراجعة من الإدارة.');
      navigate('/auth/login');

    } catch (error: any) {
      console.error(error);
      toast.error(`حدث خطأ أثناء إنشاء الحساب: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        
        <div className="flex justify-center mb-8">
          <Logo className="h-10" />
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2 font-display">إنشاء حساب جديد</h1>
        <p className="text-center text-slate-500 mb-8 font-medium">سجل بياناتك للبدء مع SupplyX 🚀</p>

        {step === 1 ? (
          <div className="space-y-4">
             <div>
                <label className="text-sm font-bold text-slate-700 mb-1.5 block text-right">نوع الحساب</label>
                <div className="flex gap-2">
                   <button 
                     type="button"
                     onClick={() => setRole('buyer')}
                     className={`flex-1 py-3 px-4 rounded-xl font-bold transition-colors ${role === 'buyer' ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                   >
                     مشتري (مطعم)
                   </button>
                   <button 
                     type="button"
                     onClick={() => setRole('supplier')}
                     className={`flex-1 py-3 px-4 rounded-xl font-bold transition-colors ${role === 'supplier' ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                   >
                     مورد
                   </button>
                </div>
             </div>

            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block text-right">الاسم بالكامل</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold placeholder:font-normal text-right transition-shadow"
                placeholder="اسمك الثلاثي"
              />
            </div>
            
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block text-right">اسم النشاط (المطعم أو الشركة)</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold placeholder:font-normal text-right transition-shadow"
                placeholder={role === 'buyer' ? 'اسم المطعم' : 'اسم شركة التوريد'}
              />
            </div>
            
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block text-right">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold placeholder:font-normal text-right transition-shadow"
                dir="ltr"
                placeholder="example@email.com"
              />
            </div>
            
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block text-right">كلمة المرور</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold placeholder:font-normal text-right transition-shadow"
                dir="ltr"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block text-right">رقم الواتساب (للتفعيل والإشعارات)</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold placeholder:font-normal text-right transition-shadow"
                dir="ltr"
                placeholder="01xxxxxxxxx"
              />
              <p className="text-xs text-slate-500 mt-2 text-right">سيتم إرسال كود تحقق لهذا الرقم عبر واتساب.</p>
            </div>

            <button
              type="button"
              onClick={sendVerificationCode}
              disabled={loading || !name || !email || !password || !phone || !businessName}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'المتابعة للخطوة التالية'}
            </button>
             
          </div>
        ) : (
          <form onSubmit={handleVerifyAndSignup} className="space-y-4">
             <div className="bg-primary-50 p-4 rounded-xl border border-primary-100 mb-6 text-right">
                <p className="text-sm text-primary-800 font-bold leading-relaxed">
                   تم إرسال كود تحقق لرقم الواتساب: <span dir="ltr" className="inline-block bg-white px-2 py-0.5 rounded text-primary-600 ml-1">{phone}</span>
                </p>
                <button type="button" onClick={() => setStep(1)} className="text-xs text-primary-600 font-bold mt-2 hover:underline">تعديل الرقم</button>
             </div>
             
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block text-right">كود التحقق</label>
              <input
                type="text"
                required
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold text-center tracking-widest text-2xl transition-shadow"
                dir="ltr"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد وإنشاء الحساب'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link to="/auth/login" className="text-slate-500 font-bold hover:text-primary-600 transition-colors inline-flex items-center gap-1 group">
            <span>لديك حساب بالفعل؟ تسجيل الدخول</span>
            <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </Link>
        </div>

      </div>
    </div>
  );
}

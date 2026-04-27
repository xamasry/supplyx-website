import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import toast from 'react-hot-toast';
import Logo from '../../components/ui/Logo';

export default function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Form State
  const [role, setRole] = useState<'buyer' | 'supplier'>('buyer');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !phone || !businessName) {
      toast.error('يرجى إكمال جميع البيانات المطلوبة');
      return;
    }

    setLoading(true);
    try {
      let formattedPhone = phone;
      if (formattedPhone.startsWith('01')) {
         formattedPhone = '2' + formattedPhone;
      } else if (formattedPhone.startsWith('1')) {
         formattedPhone = '20' + formattedPhone;
      }

      // Check if phone number already exists in Firestore 'users' collection
      const usersRef = collection(db, 'users');
      const qPhone = query(usersRef, where('phone', '==', formattedPhone));
      const qWhatsappPhone = query(usersRef, where('whatsappPhone', '==', formattedPhone));
      
      const [phoneSnap, whatsappPhoneSnap] = await Promise.all([
        getDocs(qPhone),
        getDocs(qWhatsappPhone)
      ]);
      
      if (!phoneSnap.empty || !whatsappPhoneSnap.empty) {
        toast.error('رقم الهاتف مسجل بالفعل في نظامنا. يرجى استخدام رقم آخر أو تسجيل الدخول.');
        setLoading(false);
        return;
      }

      // Normalize email for check
      const normalizedEmail = email.includes('@') ? email.toLowerCase() : `${email.toLowerCase()}@supplyx.com`;

      const qEmail = query(usersRef, where('email', '==', normalizedEmail));
      const emailSnap = await getDocs(qEmail);
      if (!emailSnap.empty) {
        toast.error('البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو استخدام بريد آخر.');
        setLoading(false);
        return;
      }

      // Create account
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      
      // Update profile display name
      await updateProfile(userCredential.user, {
        displayName: businessName || name
      });
      
      const userId = userCredential.user.uid;
      
      await setDoc(doc(db, 'users', userId), {
         name,
         businessName,
         email: normalizedEmail,
         role,
         phone: formattedPhone,
         whatsappPhone: formattedPhone,
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
      if (error.code === 'auth/email-already-in-use') {
        toast.error('هذا البريد الإلكتروني مسجل بالفعل. يرجى استخدام بريد آخر أو تسجيل الدخول.');
      } else {
        toast.error(`حدث خطأ أثناء إنشاء الحساب: ${error.message}`);
      }
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

        <form onSubmit={handleSignup} className="space-y-4">
           <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block text-right">نوع الحساب</label>
              <div className="flex gap-2">
                 <button 
                   type="button"
                   onClick={() => setRole('buyer')}
                   className={`flex-1 py-3 px-4 rounded-xl font-bold transition-colors ${role === 'buyer' ? 'bg-[#22C55E] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                 >
                   مشتري (مطعم)
                 </button>
                 <button 
                   type="button"
                   onClick={() => setRole('supplier')}
                   className={`flex-1 py-3 px-4 rounded-xl font-bold transition-colors ${role === 'supplier' ? 'bg-[#22C55E] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#22C55E] font-bold placeholder:font-normal text-right transition-shadow"
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#22C55E] font-bold placeholder:font-normal text-right transition-shadow"
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#22C55E] font-bold placeholder:font-normal text-right transition-shadow"
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#22C55E] font-bold placeholder:font-normal text-right transition-shadow"
              dir="ltr"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 mb-1.5 block text-right">رقم الواتساب</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#22C55E] font-bold placeholder:font-normal text-right transition-shadow"
              dir="ltr"
              placeholder="01xxxxxxxxx"
            />
            <p className="text-xs text-slate-500 mt-2 text-right">سيتم مراجعة بياناتك وتفعيل حسابك من قبل الإدارة.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-[#22C55E]/25 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إنشاء حساب جديد'}
          </button>
        </form>

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

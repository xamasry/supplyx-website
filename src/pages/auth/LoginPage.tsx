import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, User, Lock, ArrowRight, Truck, Chrome, Loader2 } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

import Logo from '../../components/ui/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loginEmail = email.includes('@') ? email : `${email}@supplyx.com`;
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.disabled) {
           alert('حسابك محظور. يرجى مراجعة الإدارة.');
           auth.signOut();
           return;
        }
        if (userData.role === 'supplier') {
          navigate('/supplier/home');
        } else {
          navigate('/buyer/home');
        }
      } else {
        // Fallback or handle admins trying to login here?
        // Admins should login via admin login but let's just default to buyer or handle gracefully
        navigate('/buyer/home');
      }
      
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/operation-not-allowed') {
        alert('حدث خطأ في إعدادات الخادم: تسجيل الدخول بالبريد/كلمة المرور غير مفعل.');
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        alert('بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور.');
      } else {
        alert(`فشل تسجيل الدخول: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="p-6">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0B1D2A] transition-colors font-bold">
          <ArrowRight className="w-5 h-5" />
          <span>العودة للرئيسية</span>
        </Link>
      </header>

      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="text-center mb-10">
          <Logo size="lg" className="justify-center mb-6" />
          <h1 className="text-3xl font-black text-[#0B1D2A]">مرحباً بعودتك</h1>
          <p className="text-slate-500 mt-2 font-medium">سجل دخولك لمتابعة أعمالك</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 bg-white">
          <div className="space-y-2 text-right">
            <label className="text-sm font-black text-[#0B1D2A]">البريد الإلكتروني أو الهاتف</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-[#22C55E] transition-colors">
                <User className="h-5 w-5" />
              </div>
              <input 
                type="text"
                placeholder="example@mail.com"
                dir="ltr"
                className="w-full pl-4 pr-12 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] outline-none transition-all font-bold"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-[#0B1D2A]">كلمة المرور</label>
              <button type="button" className="text-xs text-[#22C55E] hover:underline font-bold">نسيت كلمة المرور؟</button>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-[#22C55E] transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <input 
                type="password"
                dir="ltr"
                placeholder="••••••••"
                className="w-full pl-4 pr-12 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] outline-none transition-all font-bold"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-5 bg-[#22C55E] text-white rounded-2xl font-black text-lg hover:shadow-xl hover:shadow-[#22C55E]/20 transition-all mt-4 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            تسجيل الدخول
          </button>
        </form>
      </div>
    </div>
  );
}

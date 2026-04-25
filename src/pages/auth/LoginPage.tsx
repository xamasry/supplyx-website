import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, User, Lock, ArrowRight, Truck, Chrome, Loader2 } from 'lucide-react';
import { auth, googleProvider } from '../../lib/firebase';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';

import Logo from '../../components/ui/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async (role: 'buyer' | 'supplier') => {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      if (role === 'supplier') navigate('/supplier/home');
      else navigate('/buyer/home');
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log("Popup was closed by user or cancelled");
      } else {
        console.error("Login failed", error);
        alert(`فشل تسجيل الدخول: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // If user enters a phone-like number, we map it to our internal email format for Firebase Auth
      const loginEmail = email.includes('@') ? email : `${email}@supplyx.com`;
      await signInWithEmailAndPassword(auth, loginEmail, password);
      // Determine destination based on email or user metadata (for now just use simple check)
      if (loginEmail.includes('supplier')) navigate('/supplier/home');
      else navigate('/buyer/home');
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/operation-not-allowed') {
        alert('حدث خطأ في إعدادات الخادم: تسجيل الدخول بالبريد/كلمة المرور غير مفعل. يرجى تفعيله من لوحة تحكم Firebase (Authentication -> Sign-in method -> Email/Password).');
      } else {
        alert('فشل تسجيل الدخول: يرجى التأكد من البيانات أو استخدام تسجيل دخول جوجل');
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

        {/* Quick Demo Login */}
        <div className="bg-[#E6ECEF]/30 border border-slate-100 rounded-[2rem] p-6 mb-8 shadow-sm">
          <h2 className="text-sm font-black text-[#0B1D2A] mb-4 flex items-center gap-2 uppercase tracking-tighter">
            🚀 دخول سريع للتجربة
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button 
              type="button"
              onClick={() => handleGoogleLogin('buyer')}
              className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:border-[#22C55E] hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-[#22C55E]/10 text-[#22C55E] rounded-xl flex items-center justify-center group-hover:bg-[#22C55E] group-hover:text-white transition-colors">
                <Store className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-[#0B1D2A]">تجربة كمطعم</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">buyer</p>
              </div>
            </button>

            <button 
              type="button"
              onClick={() => handleGoogleLogin('supplier')}
              className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:border-[#22C55E] hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-[#22C55E]/10 text-[#22C55E] rounded-xl flex items-center justify-center group-hover:bg-[#22C55E] group-hover:text-white transition-colors">
                <Truck className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-[#0B1D2A]">تجربة كمورد</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">supplier</p>
              </div>
            </button>
          </div>
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

        <div className="mt-12 text-center">
          <p className="text-slate-400 font-bold mb-6 text-sm italic">ليس لديك حساب؟</p>
          <div className="grid grid-cols-2 gap-4">
             <Link to="/auth/register/buyer" className="py-4 bg-white border border-slate-100 text-[#0B1D2A] rounded-2xl font-black text-xs hover:bg-[#F8FAFC] transition-all flex flex-col items-center gap-2">
               <span>حساب مطعم</span>
            </Link>
            <Link to="/auth/register/supplier" className="py-4 bg-white border border-slate-100 text-[#0B1D2A] rounded-2xl font-black text-xs hover:bg-[#F8FAFC] transition-all flex flex-col items-center gap-2">
               <span>حساب مورد</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

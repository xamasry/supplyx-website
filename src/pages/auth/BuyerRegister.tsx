import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, ArrowRight, Loader2 } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Logo from '../../components/ui/Logo';

export default function BuyerRegister() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = `${phone}@supplyx.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(userCredential.user, {
        displayName: restaurantName
      });

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        role: 'buyer',
        restaurantName,
        contactName: name,
        phone,
        updatedAt: serverTimestamp()
      });

      navigate('/buyer/home');
    } catch (error: any) {
      console.error("Registration failed", error);
      alert(`فشل التسجيل: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="px-6 py-6 border-b border-slate-50 flex items-center justify-between">
        <Link to="/auth/login" className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0B1D2A] transition-colors font-bold">
          <ArrowRight className="w-5 h-5" />
          <span>تراجع</span>
        </Link>
        <Logo size="sm" />
      </header>
      <div className="flex-1 p-6 max-w-md mx-auto w-full">
        <div className="text-center mb-10 mt-8">
          <div className="w-20 h-20 bg-[#22C55E]/10 text-[#22C55E] rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Store className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-[#0B1D2A]">حساب مطعم جديد</h1>
          <p className="text-slate-500 mt-2 font-medium">أنشئ حسابك لطلب الخامات فوراً</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-5">
           <div className="space-y-2 text-right">
             <label className="text-sm font-black text-[#0B1D2A]">الاسم بالكامل</label>
             <input value={name} onChange={(e) => setName(e.target.value)} type="text" className="w-full px-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 outline-none font-bold" required />
           </div>
           <div className="space-y-2 text-right">
             <label className="text-sm font-black text-[#0B1D2A]">اسم المنشأة</label>
             <input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} type="text" placeholder="مثال: مطعم الأمل" className="w-full px-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 outline-none font-bold" required />
           </div>
           <div className="space-y-2 text-right">
             <label className="text-sm font-black text-[#0B1D2A]">رقم الهاتف</label>
             <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" dir="ltr" placeholder="01XXXXXXXXX" className="w-full px-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 outline-none font-bold" required />
           </div>
           <div className="space-y-2 text-right">
             <label className="text-sm font-black text-[#0B1D2A]">كلمة المرور</label>
             <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" dir="ltr" className="w-full px-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 outline-none font-bold" required />
           </div>
           <button disabled={loading} className="w-full py-5 bg-[#22C55E] text-white rounded-2xl font-black text-lg hover:shadow-xl hover:shadow-[#22C55E]/20 transition-all mt-6 shadow-lg shadow-[#22C55E]/10 disabled:opacity-50 flex items-center justify-center gap-2">
             {loading && <Loader2 className="w-5 h-5 animate-spin" />}
             متابعة وتسجيل
           </button>
        </form>
      </div>
    </div>
  );
}

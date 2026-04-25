import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, ArrowRight } from 'lucide-react';
import Logo from '../../components/ui/Logo';

export default function SupplierRegister() {
  const navigate = useNavigate();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/supplier/home');
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
            <Truck className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-[#0B1D2A]">حساب مورد جديد</h1>
          <p className="text-slate-500 mt-2 font-medium">انضم كشريك ووسع مبيعاتك</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-5">
           <div className="space-y-2 text-right">
             <label className="text-sm font-black text-[#0B1D2A]">اسم المورد</label>
             <input type="text" className="w-full px-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 outline-none font-bold" required />
           </div>
           <div className="space-y-2 text-right">
             <label className="text-sm font-black text-[#0B1D2A]">اسم المؤسسة التجاري</label>
             <input type="text" className="w-full px-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 outline-none font-bold" required />
           </div>
           <div className="space-y-2 text-right">
             <label className="text-sm font-black text-[#0B1D2A]">رقم الهاتف</label>
             <input type="tel" dir="ltr" placeholder="01XXXXXXXXX" className="w-full px-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 outline-none font-bold" required />
           </div>
           <div className="space-y-2 text-right">
             <label className="text-sm font-black text-[#0B1D2A]">كلمة المرور</label>
             <input type="password" dir="ltr" className="w-full px-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#22C55E]/20 outline-none font-bold" required />
           </div>
           <button className="w-full py-5 bg-[#22C55E] text-white rounded-2xl font-black text-lg hover:shadow-xl hover:shadow-[#22C55E]/20 transition-all mt-6">
             متابعة وتسجيل
           </button>
        </form>
      </div>
    </div>
  );
}

import { BarChart, TrendingUp, DollarSign, Package } from 'lucide-react';

export default function SupplierAnalytics() {
  return (
    <div className="space-y-6 md:pb-0 px-2 sm:px-0 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold font-display text-slate-900">التقارير المتقدمة</h1>
        <p className="text-slate-500 text-sm mt-1">نظرة عامة على أداء مبيعاتك وأرباحك</p>
      </header>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm col-span-2 flex justify-between items-center bg-gradient-to-l from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white">
          <div>
            <p className="text-white/80 text-xs font-bold mb-1">إجمالي الإيرادات (هذا الشهر)</p>
            <p className="text-3xl font-display font-bold">45,200 <span className="text-sm font-normal">ج.م</span></p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-slate-500 font-bold">نسبة القبول</p>
          <p className="text-xl font-bold text-slate-900">85%</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-slate-500 font-bold">طلبات مكتملة</p>
          <p className="text-xl font-bold text-slate-900">124</p>
        </div>
      </div>

      {/* Placeholder Chart */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
           <BarChart className="w-5 h-5 text-[var(--color-primary)]" /> المبيعات الأسبوعية
        </h3>
        <div className="h-48 flex items-end justify-between gap-2 px-2 pb-6 border-b border-slate-100 relative pt-4">
           {/* Simple css bars */}
           <div className="w-full flex justify-between items-end h-full">
             <div className="w-[10%] bg-blue-100 rounded-t-md h-[40%] relative"><span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400">السبت</span></div>
             <div className="w-[10%] bg-[var(--color-primary)] rounded-t-md h-[80%] relative"><span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 font-bold text-slate-800">الأحد</span></div>
             <div className="w-[10%] bg-blue-100 rounded-t-md h-[60%] relative"><span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400">الاثنين</span></div>
             <div className="w-[10%] bg-[var(--color-accent)] rounded-t-md h-[100%] relative shadow-[0_0_10px_rgba(243,156,18,0.5)]"><span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[var(--color-accent)] font-bold">الثلاثاء</span></div>
             <div className="w-[10%] bg-blue-100 rounded-t-md h-[50%] relative"><span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400">الاربعاء</span></div>
             <div className="w-[10%] bg-blue-100 rounded-t-md h-[30%] relative"><span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400">الخميس</span></div>
             <div className="w-[10%] bg-blue-100 rounded-t-md h-[10%] relative"><span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400">الجمعة</span></div>
           </div>
        </div>
      </div>
    </div>
  );
}

import { BarChart, TrendingUp, DollarSign, Package, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function SupplierAnalytics() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    completionRate: 0,
    completedOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'requests'),
      where('supplierId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data());
      const completed = orders.filter(o => o.status === 'delivered');
      const totalRevenue = completed.reduce((acc, curr) => acc + (curr.price || 0), 0);
      const completionRate = orders.length > 0 ? (completed.length / orders.length) * 100 : 0;

      setStats({
        totalRevenue,
        completedOrders: completed.length,
        completionRate: Math.round(completionRate)
      });
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin mb-2" />
        <p className="font-bold text-sm">جاري تحليل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:pb-0 px-2 sm:px-0 font-sans text-right">
      <header className="mb-6">
        <h1 className="text-2xl font-bold font-display text-slate-900">التقارير المتقدمة</h1>
        <p className="text-slate-500 text-sm mt-1">نظرة عامة على أداء مبيعاتك وأرباحك</p>
      </header>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm col-span-2 flex justify-between items-center bg-gradient-to-l from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white">
          <div className="text-right">
            <p className="text-white/80 text-xs font-bold mb-1">إجمالي الإيرادات (المحققة)</p>
            <p className="text-3xl font-display font-bold">{stats.totalRevenue.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col gap-2 items-end">
          <div className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-slate-500 font-bold">نسبة الإكمال</p>
          <p className="text-xl font-bold text-slate-900">{stats.completionRate}%</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col gap-2 items-end">
          <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-slate-500 font-bold">طلبات مكتملة</p>
          <p className="text-xl font-bold text-slate-900">{stats.completedOrders}</p>
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

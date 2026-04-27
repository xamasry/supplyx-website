import { BarChart as LucideBarChart, TrendingUp, DollarSign, Package, Loader2, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function SupplierAnalytics() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    completionRate: 0,
    completedOrders: 0
  });
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'day' | 'week' | 'month'>('week');
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'requests'),
      where('supplierId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const completed = orders.filter(o => o.status === 'delivered');
      const totalRevenue = completed.reduce((acc, curr) => acc + (curr.price || 0), 0);
      const completionRate = orders.length > 0 ? (completed.length / orders.length) * 100 : 0;

      setStats({
        totalRevenue,
        completedOrders: completed.length,
        completionRate: Math.round(completionRate)
      });

      // Generate Chart Data based on reportType
      const data: any[] = [];
      const now = new Date();
      
      if (reportType === 'day') {
        // Last 24 hours
        for (let i = 23; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 60 * 60 * 1000);
          const hour = d.getHours();
          const revenue = orders
            .filter(o => {
              const oDate = o.updatedAt?.toDate?.() || new Date(o.updatedAt);
              return o.status === 'delivered' && oDate.getHours() === hour && oDate.getDate() === d.getDate();
            })
            .reduce((acc, curr) => acc + (curr.price || 0), 0);
          data.push({ name: `${hour}:00`, revenue });
        }
      } else if (reportType === 'week') {
        // Last 7 days
        const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayName = days[d.getDay()];
          const revenue = orders
            .filter(o => {
              const oDate = o.updatedAt?.toDate?.() || new Date(o.updatedAt);
              return o.status === 'delivered' && oDate.toDateString() === d.toDateString();
            })
            .reduce((acc, curr) => acc + (curr.price || 0), 0);
          data.push({ name: dayName, revenue });
        }
      } else {
        // Last 4 weeks
        for (let i = 3; i >= 0; i--) {
          const start = new Date();
          start.setDate(start.getDate() - (i + 1) * 7);
          const end = new Date();
          end.setDate(end.getDate() - i * 7);
          const revenue = orders
            .filter(o => {
              const oDate = o.updatedAt?.toDate?.() || new Date(o.updatedAt);
              return o.status === 'delivered' && oDate >= start && oDate < end;
            })
            .reduce((acc, curr) => acc + (curr.price || 0), 0);
          data.push({ name: `أسبوع ${4-i}`, revenue });
        }
      }

      setChartData(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [reportType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin mb-2" />
        <p className="font-bold text-sm">جاري تحليل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:pb-0 px-2 sm:px-0 font-sans text-right" dir="rtl">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900">التقارير المتقدمة</h1>
          <p className="text-slate-500 text-sm mt-1">نظرة عامة على أداء مبيعاتك وأرباحك</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setReportType('day')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reportType === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >يومي</button>
          <button 
            onClick={() => setReportType('week')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reportType === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >أسبوعي</button>
          <button 
            onClick={() => setReportType('month')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reportType === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >شهري</button>
        </div>
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
          <p className="text-xl font-bold text-slate-900 font-sans tracking-tight">{stats.completionRate}%</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col gap-2 items-end">
          <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-slate-500 font-bold">طلبات مكتملة</p>
          <p className="text-xl font-bold text-slate-900 font-sans tracking-tight">{stats.completedOrders}</p>
        </div>
      </div>

      {/* Real Chart */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
           <LucideBarChart className="w-5 h-5 text-[var(--color-primary)]" />
           {reportType === 'day' ? 'المبيعات الساعية' : reportType === 'week' ? 'المبيعات اليومية' : 'المبيعات الأسبوعية'}
        </h3>
        <div className="h-64 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                stroke="#94a3b8" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                reversed
              />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                orientation="right"
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', direction: 'rtl' }}
                itemStyle={{ color: 'var(--color-primary)', fontWeight: 'bold' }}
              />
              <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? 'var(--color-accent)' : 'var(--color-primary)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs, Timestamp, where } from 'firebase/firestore';
import { 
  Activity, 
  AlertCircle, 
  BarChart3, 
  Clock, 
  MousePointer2, 
  PieChart, 
  TrendingUp, 
  Users, 
  Zap,
  Globe,
  Bug,
  Smartphone,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export default function AnalyticsSystem() {
  const [logs, setLogs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    activeSessions: 0,
    totalEvents: 0,
    errorRate: 0,
    avgLoadTime: 0,
    conversionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('24h');
  const [pageStats, setPageStats] = useState<any[]>([]);
  const [offerStats, setOfferStats] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch real-time alerts
    const qAlerts = query(
      collection(db, 'system_alerts'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubAlerts = onSnapshot(qAlerts, (snap) => {
      setAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Fetch system logs
    const qLogs = query(
      collection(db, 'system_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const logsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logsData);
      calculateStats(logsData);
      setLoading(false);
    });

    // 3. Fetch Persistent Page Stats
    const qPages = query(collection(db, 'page_stats'), orderBy('visits', 'desc'), limit(10));
    const unsubPages = onSnapshot(qPages, (snap) => {
      setPageStats(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 4. Fetch Persistent Offer Stats
    const qOffers = query(collection(db, 'offer_stats'), orderBy('views', 'desc'), limit(10));
    const unsubOffers = onSnapshot(qOffers, (snap) => {
      setOfferStats(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubAlerts();
      unsubLogs();
      unsubPages();
      unsubOffers();
    };
  }, [timeFilter]);

  const calculateStats = (data: any[]) => {
    const errorCount = data.filter(l => l.type === 'error').length;
    const conversionCount = data.filter(l => l.type === 'conversion').length;
    const pageViews = data.filter(l => l.type === 'page_view' || l.type === 'click').length;
    
    // Performance aggregation
    const perfLogs = data.filter(l => l.type === 'performance' && l.data?.loadTimeMs);
    const avgLoadTime = perfLogs.length > 0 
      ? perfLogs.reduce((acc, curr) => acc + curr.data.loadTimeMs, 0) / perfLogs.length 
      : 0;

    setStats({
      totalEvents: data.length,
      errorRate: data.length > 0 ? (errorCount / data.length) * 100 : 0,
      activeSessions: new Set(data.map(l => l.sessionId)).size,
      avgLoadTime,
      conversionRate: pageViews > 0 ? (conversionCount / pageViews) * 100 : 0
    });
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Prepare chart data
  const chartData = logs.reduce((acc: any[], log) => {
    const date = log.timestamp instanceof Timestamp 
      ? log.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const existing = acc.find(item => item.name === date);
    if (existing) {
      if (log.type === 'error') existing.errors += 1;
      else if (log.type === 'conversion') existing.conversions += 1;
      else existing.events += 1;
    } else {
      acc.unshift({ 
        name: date, 
        events: log.type !== 'error' && log.type !== 'conversion' ? 1 : 0,
        errors: log.type === 'error' ? 1 : 0,
        conversions: log.type === 'conversion' ? 1 : 0
      });
    }
    return acc;
  }, []).slice(0, 10);

  // Behavioral Analytics Data
  const topClicks = logs
    .filter(l => l.type === 'click' && l.data?.tag)
    .reduce((acc: any, curr) => {
      const key = `${curr.data.tag}${curr.data.id ? `#${curr.data.id}` : ''}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const sortedClicks = Object.entries(topClicks)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5);

  const avgScroll: number = logs
    .filter(l => l.name === 'Scroll Depth' && l.data?.depthPercent)
    .reduce((acc, curr, i, arr) => acc + (curr.data.depthPercent / arr.length), 0);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          label="نشاط النظام"
          value={stats.totalEvents.toLocaleString()}
          subtitle="إجمالي الأحداث (24س)"
          trend="+12%"
        />
        <StatCard 
          icon={<Users className="w-5 h-5 text-blue-500" />}
          label="الجلسات النشطة"
          value={stats.activeSessions.toLocaleString()}
          subtitle="معرفات فريدة"
          trend="+5%"
        />
        <StatCard 
          icon={<Bug className="w-5 h-5 text-red-500" />}
          label="معدل الأخطاء"
          value={`${stats.errorRate.toFixed(1)}%`}
          subtitle="نسبة الحدوث"
          trend="-2%"
          trendType="good"
        />
        <StatCard 
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="سرعة التحميل"
          value={`${(stats.avgLoadTime / 1000).toFixed(2)}s`}
          subtitle="متوسط الاستجابة"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-500" />
              أداء النظام المباشر
            </h3>
            <div className="flex gap-2">
              {['1h', '24h', '7d'].map((t) => (
                <button 
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                    timeFilter === t ? "bg-primary-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="events" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEvents)" strokeWidth={3} />
                <Area type="monotone" dataKey="errors" stroke="#ef4444" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col h-[400px]">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            التنبيهات العاجلة
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
            {alerts.length > 0 ? (
                alerts.map(alert => (
                    <div key={alert.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">CRITICAL</span>
                            <span className="text-[10px] font-bold text-slate-500">
                                {alert.timestamp instanceof Timestamp ? alert.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </span>
                        </div>
                        <p className="text-xs font-bold text-slate-200 leading-relaxed">{alert.message}</p>
                        <p className="text-[10px] font-mono text-red-300 truncate">{alert.path}</p>
                    </div>
                ))
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <span className="text-sm font-bold">النظام يعمل بكفاءة قصوى</span>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Behavioral Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Page Analytics */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            تحليل الصفحات (منذ البداية)
          </h3>
          <div className="space-y-4">
            {pageStats.length > 0 ? (
              pageStats.map((stat) => (
                <div key={stat.id} className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-indigo-400 block mb-1">/{stat.path}</span>
                    <div className="flex items-center gap-3">
                       <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                         <Activity size={12} className="text-emerald-500" />
                         {stat.visits || 0} زيارة
                       </span>
                       <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                         <MousePointer2 size={12} className="text-blue-500" />
                         {stat.clicks || 0} نقرة
                       </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 font-bold">
                    نشط مؤخراً
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-600 font-bold">لا توجد بيانات صفحات</div>
            )}
          </div>
        </div>

        {/* Offer Analytics */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            تفاعل العروض (منذ البداية)
          </h3>
          <div className="space-y-4">
            {offerStats.length > 0 ? (
              offerStats.map((stat) => (
                <div key={stat.id} className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <span className="text-xs font-bold text-white block mb-1 truncate">{stat.offerTitle || 'عرض غير مسمى'}</span>
                    <span className="text-[10px] font-bold text-slate-500 block mb-2">{stat.supplierName || 'مورد غير معروف'}</span>
                    <div className="flex items-center gap-4">
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                         <Activity size={10} />
                         {stat.views || 0} مشاهدة
                       </span>
                       <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                         <MousePointer2 size={10} />
                         {stat.clicks || 0} نقرة
                       </span>
                    </div>
                  </div>
                  <div className="h-10 w-1 bg-amber-500 rounded-full" />
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-600 font-bold">لا توجد تفاعلات للعروض</div>
            )}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary-500" />
                سجل العمليات الأخير
            </h3>
            <button className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-800 px-4 py-2 rounded-xl hover:text-white transition-colors">
                <Filter size={14} />
                تصفية النتائج
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
                <thead>
                    <tr className="bg-slate-950/50">
                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">الوقت</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">النوع</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">الحدث</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">المسار</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">المستخدم</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">الجهاز</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors border-b border-slate-800/50">
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white">
                                        {log.timestamp instanceof Timestamp ? log.timestamp.toDate().toLocaleTimeString() : '...'}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {log.timestamp instanceof Timestamp ? log.timestamp.toDate().toLocaleDateString() : '...'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={cn(
                                    "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight",
                                    log.type === 'error' ? "bg-red-500/10 text-red-500" :
                                    log.type === 'conversion' ? "bg-emerald-500/10 text-emerald-500" :
                                    log.type === 'performance' ? "bg-amber-500/10 text-amber-500" :
                                    "bg-blue-500/10 text-blue-500"
                                )}>
                                    {log.type}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-xs font-bold text-slate-300 truncate max-w-[150px] inline-block">{log.name}</span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-[10px] font-mono text-slate-500">{log.path}</span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">
                                        {log.userId ? log.userId.substring(0, 2) : 'A'}
                                    </div>
                                    <span className="text-xs font-bold text-slate-400">{log.userId ? 'مستخدم' : 'زائر'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2 text-slate-500">
                                    {log.userAgent?.includes('Mobile') ? <Smartphone size={14} /> : <Globe size={14} />}
                                    <span className="text-[10px] opacity-50 truncate max-w-[100px]">{log.userAgent}</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtitle, trend, trendType = 'bad' }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="p-3 bg-slate-800 rounded-2xl">{icon}</div>
        {trend && (
            <span className={cn(
                "text-[10px] font-black px-2 py-1 rounded-lg",
                trendType === 'good' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
            )}>
                {trend}
            </span>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-bold mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-black text-white font-display tracking-tight">{value}</h4>
        </div>
        <p className="text-[10px] text-slate-600 font-bold mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

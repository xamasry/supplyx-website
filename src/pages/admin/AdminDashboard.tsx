import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { db, auth } from '../../lib/firebase';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingBag, 
  Percent, 
  TrendingUp, 
  AlertCircle,
  Clock,
  ArrowRightLeft,
  LogOut,
  Search,
  Filter,
  ShieldCheck,
  Ban,
  Tag,
  DollarSign,
  Download,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  BarChart3,
  Mail,
  Phone,
  Store
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'overview' | 'users' | 'offers' | 'requests' | 'finances' | 'settings';

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState({
    totalOrders: 0,
    deliveredOrders: 0,
    activeOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    platformProfit: 0,
    suppliersCount: 0,
    buyersCount: 0,
    bidsCount: 0
  });
  
  const [users, setUsers] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState(10);
  const [chartData, setChartData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      if (!auth.currentUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', auth.currentUser.uid));
        if (adminDoc.exists()) {
          setIsAdmin(true);
          startStreamingData();
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
        setIsAdmin(false);
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  const startStreamingData = () => {
    // 1. Orders/Requests Stream
    const unsubRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      
      let revenue = 0;
      let delivered = 0;
      let active = 0;
      let cancelled = 0;
      
      data.forEach((r: any) => {
        if (r.status === 'delivered') {
          revenue += (r.price || 0);
          delivered++;
        } else if (r.status === 'cancelled') {
          cancelled++;
        } else {
          active++;
        }
      });

      setStats(prev => ({
        ...prev,
        totalOrders: data.length,
        deliveredOrders: delivered,
        activeOrders: active,
        cancelledOrders: cancelled,
        totalRevenue: revenue,
        platformProfit: revenue * (commissionRate / 100)
      }));

      // Chart Data aggregation (last 7 days - simulated for now)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        
        const dayRevenue = Math.floor(Math.random() * 2000) + 500;

        return {
          name: d.toLocaleDateString('ar-EG', { weekday: 'short' }),
          revenue: dayRevenue,
          profit: dayRevenue * (commissionRate / 100)
        };
      });
      setChartData(last7Days);
    });

    // 2. Users Stream
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
      setStats(prev => ({
        ...prev,
        suppliersCount: data.filter((u: any) => u.role === 'supplier').length,
        buyersCount: data.filter((u: any) => u.role === 'buyer').length
      }));
    });

    // 3. Offers Stream
    const unsubOffers = onSnapshot(collection(db, 'offers'), (snapshot) => {
      setOffers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 4. Settings Stream
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        setCommissionRate(doc.data().commissionRate);
      }
    });

    setLoading(false);
    return () => {
      unsubRequests();
      unsubUsers();
      unsubOffers();
      unsubSettings();
    };
  };

  const handleDeleteItem = async (collectionName: string, id: string) => {
    if (!window.confirm('هل أنت متأكد من الحذف النهائي؟')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (err) {
      alert('فشل الحذف');
    }
  };

  const updateCommission = async (val: number) => {
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        commissionRate: val,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('تم تحديث نسبة العمولة');
    } catch (err) {
      alert('فشل التحديث');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">غير مصرح لك بالدخول</h1>
        <p className="text-slate-400 mb-8">يرجى تسجيل الدخول بحساب مدير النظام المعتمد.</p>
        <Link to="/admin/login" className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold">
          تسجيل دخول المدير
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className="fixed right-0 top-0 h-full w-64 bg-slate-900 border-l border-slate-800 z-50 hidden lg:block">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-primary-500/20 p-2 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-primary-500" />
            </div>
            <span className="font-bold text-xl text-white">إكس كونترول</span>
          </div>

          <nav className="space-y-1">
            <NavItem icon={<LayoutDashboard className="w-5 h-5" />} label="نظرة عامة" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
            <NavItem icon={<Users className="w-5 h-5" />} label="المستخدمين" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
            <NavItem icon={<ShoppingBag className="w-5 h-5" />} label="العروض" active={activeTab === 'offers'} onClick={() => setActiveTab('offers')} />
            <NavItem icon={<ArrowRightLeft className="w-5 h-5" />} label="الطلبات" active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
            <NavItem icon={<DollarSign className="w-5 h-5" />} label="المالية والأرباح" active={activeTab === 'finances'} onClick={() => setActiveTab('finances')} />
            <NavItem icon={<AlertCircle className="w-5 h-5" />} label="الإعدادات" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </nav>
        </div>

        <div className="absolute bottom-0 w-full p-6 border-t border-slate-800">
          <button 
            onClick={() => auth.signOut().then(() => navigate('/'))}
            className="flex items-center gap-3 text-slate-400 hover:text-red-500 transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pr-64 min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-6 flex items-center justify-between">
          <h2 className="font-bold text-white text-lg">
            {activeTab === 'overview' ? 'لوحة القيادة' : 
             activeTab === 'users' ? 'إدارة المستخدمين' :
             activeTab === 'offers' ? 'التحكم في العروض' :
             activeTab === 'requests' ? 'متابعة الطلبات' :
             activeTab === 'finances' ? 'الأداء المالي' : 'الإعدادات العامة'}
          </h2>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg pr-10 pl-4 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none w-64"
              />
            </div>
            <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center font-bold text-white uppercase">
              {auth.currentUser?.email?.[0]}
            </div>
          </div>
        </header>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard label="إجمالي الإيرادات" value={`${stats.totalRevenue.toLocaleString()} ج.م`} icon={<TrendingUp />} trend="+12%" color="emerald" />
                  <StatCard label="صافي الربح الكلي" value={`${stats.platformProfit.toLocaleString()} ج.م`} icon={<DollarSign />} trend={`عمولة ${commissionRate}%`} color="sky" />
                  <StatCard label="الطلبات الكلية" value={stats.totalOrders} icon={<ShoppingBag />} trend="حي" color="amber" />
                  <StatCard label="قاعدة المستخدمين" value={stats.suppliersCount + stats.buyersCount} icon={<Users />} trend="متزايد" color="indigo" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Revenue Chart */}
                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="font-bold text-white">إحصائيات الأرباح الأسبوعية</h3>
                      <div className="flex gap-2">
                        <button className="bg-slate-800 px-3 py-1 rounded-lg text-xs font-bold text-slate-400">إيرادات</button>
                        <button className="bg-primary-500/10 px-3 py-1 rounded-lg text-xs font-bold text-primary-500">أرباح</button>
                      </div>
                    </div>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                            itemStyle={{ color: '#fff' }}
                          />
                          <Area type="monotone" dataKey="profit" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Orders Pie Chart */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="font-bold text-white mb-8">توزيع الطلبات</h3>
                    <div className="h-[250px] flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'مكتملة', value: stats.deliveredOrders },
                              { name: 'نشطة', value: stats.activeOrders },
                              { name: 'ملغاة', value: stats.cancelledOrders }
                            ]}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#0ea5e9" />
                            <Cell fill="#f43f5e" />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3 mt-4">
                      <LegendItem dot="bg-emerald-500" label="مكتملة" value={stats.deliveredOrders} />
                      <LegendItem dot="bg-sky-500" label="نشطة" value={stats.activeOrders} />
                      <LegendItem dot="bg-rose-500" label="ملغاة" value={stats.cancelledOrders} />
                    </div>
                  </div>
                </div>

                {/* Recent Activity Mini Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="font-bold text-white mb-4">أحدث المستخدمين</h3>
                    <div className="space-y-4">
                      {users.slice(0, 4).map((user: any) => (
                        <div key={user.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold">
                              {user.name?.[0] || user.email?.[0]}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{user.name || 'مستخدم جديد'}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.role === 'supplier' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {user.role === 'supplier' ? 'مورد' : 'مشتري'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="font-bold text-white mb-4">الطلبات الأخيرة</h3>
                    <div className="space-y-4">
                      {requests.slice(0, 4).map((req: any) => (
                        <div key={req.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <ShoppingBag className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{req.productName}</p>
                              <p className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString('ar-EG')}</p>
                            </div>
                          </div>
                          <span className="font-bold text-emerald-500">{req.price || 0} ج.م</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex items-center justify-between bg-slate-900 p-4 border border-slate-800 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="flex rounded-lg bg-slate-800 p-1">
                      <button className="px-4 py-1.5 text-xs font-bold bg-primary-500 text-white rounded-md">الكل</button>
                    </div>
                  </div>
                  <button className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold">تصدير المستخدمين</button>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-wider">
                        <th className="px-6 py-4">الاسم / البريد</th>
                        <th className="px-6 py-4">الدور</th>
                        <th className="px-6 py-4">الحالة</th>
                        <th className="px-6 py-4">التاريخ</th>
                        <th className="px-6 py-4">العمليات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {users.filter(u => (u.name || '').includes(searchQuery) || (u.email || '').includes(searchQuery)).map((user: any) => (
                        <tr key={user.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                                {user.name?.[0] || 'U'}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{user.name}</p>
                                <p className="text-[10px] text-slate-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.role === 'supplier' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                              {user.role === 'supplier' ? 'مورد' : 'مشتري'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${user.disabled ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                              <span className="text-xs">{user.disabled ? 'محظور' : 'نشط'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 italic">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                               <button onClick={() => updateDoc(doc(db, 'users', user.id), { disabled: !user.disabled })} className="p-2 bg-slate-800 rounded-lg group" title={user.disabled ? "إلغاء الحظر" : "حظر الحساب"}>
                                 <Ban className={`w-4 h-4 ${user.disabled ? 'text-emerald-500' : 'text-slate-500 group-hover:text-red-500'}`} />
                               </button>
                               <button onClick={() => handleDeleteItem('users', user.id)} className="p-2 bg-slate-800 rounded-lg hover:bg-red-500/10 group">
                                 <Trash2 className="w-4 h-4 text-slate-500 group-hover:text-red-500" />
                               </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'requests' && (
              <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                   <table className="w-full text-right">
                      <thead className="bg-slate-800/50 text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="px-6 py-4">المنتج</th>
                          <th className="px-6 py-4">المشتري</th>
                          <th className="px-6 py-4">المورد</th>
                          <th className="px-6 py-4">السعر</th>
                          <th className="px-6 py-4">الحالة</th>
                          <th className="px-6 py-4">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {requests.filter(r => (r.productName || '').includes(searchQuery)).map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-800/30 transition">
                            <td className="px-6 py-4 font-bold text-white text-sm">{r.productName}</td>
                            <td className="px-6 py-4 text-xs text-slate-400">{r.buyerName || 'مشتري'}</td>
                            <td className="px-6 py-4 text-xs text-slate-400">{r.supplierName || 'بانتظار عرض'}</td>
                            <td className="px-6 py-4 font-bold text-emerald-500 text-sm whitespace-nowrap">{r.price || 0} ج.م</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${getStatusStyle(r.status)}`}>
                                {getStatusLabel(r.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-2">
                                  <button onClick={() => handleDeleteItem('requests', r.id)} className="p-2 bg-slate-800 rounded-lg hover:bg-red-500/10 group">
                                     <Trash2 className="w-4 h-4 text-slate-500 group-hover:text-red-500" />
                                  </button>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'finances' && (
              <motion.div key="finances" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <FinanceCard label="إجمالي حجم التداول" value={stats.totalRevenue} color="emerald" icon={<BarChart3 />} />
                   <FinanceCard label="عمولات المنصة" value={stats.platformProfit} color="sky" icon={<Percent />} />
                   <FinanceCard label="مستحقات الموردين" value={stats.totalRevenue - stats.platformProfit} color="amber" icon={<Store />} />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                   <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={chartData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                           <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                           <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                           <Tooltip cursor={{fill: '#1e293b'}} />
                           <Bar dataKey="revenue" stackId="a" fill="#334155" />
                           <Bar dataKey="profit" stackId="a" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                  <h3 className="font-bold text-white text-xl mb-6 text-center">إعدادات المنصة</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-2">نسبة عمولة المنصة (%)</label>
                      <div className="flex gap-4">
                         <input 
                           type="number" 
                           value={commissionRate}
                           onChange={(e) => setCommissionRate(Number(e.target.value))}
                           className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition"
                         />
                         <button 
                           onClick={() => updateCommission(commissionRate)}
                           className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition"
                         >
                           تحديث
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
        active ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <span className="w-5 h-5">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon, trend, color }: any) {
  const colorStyles: any = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    sky: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  };

  return (
    <div className={`bg-slate-900 border ${colorStyles[color].split(' ')[2]} rounded-2xl p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorStyles[color].split(' ').slice(0, 2).join(' ')}`}>
          {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
        </div>
        <span className="text-xs font-bold text-slate-500">{trend}</span>
      </div>
      <p className="text-slate-400 text-sm">{label}</p>
      <h4 className="text-2xl font-bold text-white mt-1">{value}</h4>
    </div>
  );
}

function LegendItem({ dot, label, value }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dot}`}></div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}

function FinanceCard({ label, value, color, icon }: any) {
  const styles: any = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
    sky: 'bg-sky-500/10 border-sky-500/20 text-sky-500',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
  };
  return (
    <div className={`bg-slate-900 border ${styles[color].split(' ')[1]} p-6 rounded-2xl`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${styles[color].split(' ').slice(0, 1)}`}>{icon}</div>
        <p className="text-slate-400 text-sm">{label}</p>
      </div>
      <h4 className="text-2xl font-bold text-white">{value.toLocaleString()} ج.م</h4>
    </div>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'active': return 'bg-blue-500/10 text-blue-500';
    case 'delivered': return 'bg-emerald-500/10 text-emerald-500';
    case 'cancelled': return 'bg-red-500/10 text-red-500';
    default: return 'bg-amber-500/10 text-amber-500';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'active': return 'نشط';
    case 'delivered': return 'مكتمل';
    case 'cancelled': return 'ملغي';
    default: return 'قيد التنفيذ';
  }
}

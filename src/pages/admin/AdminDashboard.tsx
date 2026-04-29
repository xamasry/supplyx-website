import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  collection, 
  query, 
  where,
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  deleteDoc,
  updateDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword, updateProfile as updateSecondaryProfile } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';
import { Link, useNavigate } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
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
  Store,
  Package
} from 'lucide-react';
import { CATEGORIES } from '../../constants';
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
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'overview' | 'users' | 'offers' | 'requests' | 'finances' | 'settings' | 'broadcast' | 'categories';

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [reportType, setReportType] = useState<'day' | 'week' | 'month'>('week');
  const [stats, setStats] = useState({
    totalOrders: 0,
    deliveredOrders: 0,
    activeOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    platformProfit: 0,
    suppliersCount: 0,
    buyersCount: 0,
    bidsCount: 0,
    pendingUsers: 0,
    newRequestsCount: 0
  });
  
  const [users, setUsers] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [reports, setReports] = useState({
    fast: { count: 0, revenue: 0, profit: 0 },
    bulk: { count: 0, revenue: 0, profit: 0 },
    offer: { count: 0, revenue: 0, profit: 0 }
  });
  const [rates, setRates] = useState({ fast: 10, bulk: 5, offer: 8 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'supplier'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [requestFilter, setRequestFilter] = useState<'fast' | 'bulk' | 'offer'>('fast');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'buyer', phone: '', businessName: '', address: '' });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: '', message: '', target: 'all' as 'all' | 'buyer' | 'supplier' });
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [requestsStatusFilter, setRequestsStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'delivered' | 'cancelled'>('all');
  const navigate = useNavigate();
  const unsubscribes = useRef<(() => void)[]>([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Special check for super admin by email
      const superAdminEmail = 'masriboro@gmail.com';
      if (user.email === superAdminEmail) {
        setIsAdmin(true);
        // Ensure this user exists in the admins collection as well
        setDoc(doc(db, 'admins', user.uid), {
          email: user.email,
          role: 'super_admin',
          createdAt: serverTimestamp()
        }, { merge: true }).catch(err => console.error("Error syncing super admin:", err));
        
        startStreamingData();
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
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
    });

    return () => {
      unsubscribe();
      unsubscribes.current.forEach(u => u());
    };
  }, []);

  useEffect(() => {
    let totalRevenue = 0;
    let delivered = 0;
    let active = 0;
    let cancelled = 0;
    let newRequests = 0;
    let platformProfit = 0;
    let bidsCount = 0;
    
    let fastReport = { count: 0, revenue: 0, profit: 0 };
    let bulkReport = { count: 0, revenue: 0, profit: 0 };
    let offerReport = { count: 0, revenue: 0, profit: 0 };

    requests.forEach((r: any) => {
      bidsCount += r.bidsCount || 0;
      
      if (r.status === 'active' && !r.supplierId) {
        newRequests++;
      }
      
      let reqProfit = 0;
      let reqRate = rates.fast;
      if (r.requestType === 'bulk') reqRate = rates.bulk;
      else if (r.offerId) reqRate = rates.offer;

      if (r.status === 'delivered') {
        const price = r.price || 0;
        totalRevenue += price;
        delivered++;
        reqProfit = price * (reqRate / 100);
        platformProfit += reqProfit;

        if (r.requestType === 'bulk') {
          bulkReport.count++;
          bulkReport.revenue += price;
          bulkReport.profit += reqProfit;
        } else if (r.offerId) {
          offerReport.count++;
          offerReport.revenue += price;
          offerReport.profit += reqProfit;
        } else {
          fastReport.count++;
          fastReport.revenue += price;
          fastReport.profit += reqProfit;
        }

      } else if (r.status === 'cancelled') {
        cancelled++;
      } else {
        active++;
      }
    });

    setStats(prev => ({
      ...prev,
      totalOrders: requests.length,
      deliveredOrders: delivered,
      activeOrders: active,
      cancelledOrders: cancelled,
      totalRevenue: totalRevenue,
      platformProfit: platformProfit,
      bidsCount: bidsCount,
      newRequestsCount: newRequests
    }));

    setReports({
      fast: fastReport,
      bulk: bulkReport,
      offer: offerReport
    });

    if (requests.length === 0) {
      setChartData([]);
      return;
    }
    
    const now = new Date();
    let aggregatedData: any[] = [];

    const getReqProfit = (r: any) => {
      let reqRate = rates.fast;
      if (r.requestType === 'bulk') reqRate = rates.bulk;
      else if (r.offerId) reqRate = rates.offer;
      return (r.price || 0) * (reqRate / 100);
    };

    if (reportType === 'day') {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hour = d.getHours();
        
        let dayRevenue = 0;
        let dayProfit = 0;
        
        requests.forEach((r: any) => {
          if (r.status !== 'delivered') return;
          const rTimestamp = r.updatedAt?.toMillis?.() || r.createdAt?.toMillis?.() || new Date(r.updatedAt || r.createdAt).getTime();
          const rDate = new Date(rTimestamp);
          if (rDate.getHours() === hour && rDate.getDate() === d.getDate() && rDate.getMonth() === d.getMonth()) {
            dayRevenue += (r.price || 0);
            dayProfit += getReqProfit(r);
          }
        });
        
        aggregatedData.push({
          name: `${hour}:00`,
          revenue: dayRevenue,
          profit: dayProfit
        });
      }
    } else if (reportType === 'week') {
      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayName = days[d.getDay()];
        const startOfDay = new Date(d.setHours(0,0,0,0)).getTime();
        const endOfDay = new Date(d.setHours(23,59,59,999)).getTime();
        
        let dayRevenue = 0;
        let dayProfit = 0;

        requests.forEach((r: any) => {
           if (r.status === 'delivered' && (r.updatedAt || r.createdAt)) {
              const rTimestamp = r.updatedAt?.toMillis?.() || r.createdAt?.toMillis?.() || new Date(r.updatedAt || r.createdAt).getTime();
              if (rTimestamp >= startOfDay && rTimestamp <= endOfDay) {
                 dayRevenue += (r.price || 0);
                 dayProfit += getReqProfit(r);
              }
           }
        });

        aggregatedData.push({
          name: dayName,
          revenue: dayRevenue,
          profit: dayProfit
        });
      }
    } else {
      for (let i = 3; i >= 0; i--) {
        const start = new Date();
        start.setDate(start.getDate() - (i + 1) * 7);
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        
        let rev = 0;
        let prof = 0;

        requests.forEach((r: any) => {
          if (r.status !== 'delivered') return;
          const rTimestamp = r.updatedAt?.toMillis?.() || r.createdAt?.toMillis?.() || new Date(r.updatedAt || r.createdAt).getTime();
          const rDate = new Date(rTimestamp);
          if (rDate >= start && rDate < end) {
            rev += (r.price || 0);
            prof += getReqProfit(r);
          }
        });
        
        aggregatedData.push({
          name: `أسبوع ${4-i}`,
          revenue: rev,
          profit: prof
        });
      }
    }
    
    setChartData(aggregatedData);
  }, [requests, reportType, rates]);

  const startStreamingData = () => {
    // Clear any existing unsubscribes
    unsubscribes.current.forEach(u => u());
    unsubscribes.current = [];

    // 1. Orders/Requests Stream
    const unsubRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });
    unsubscribes.current.push(unsubRequests);

    // 2. Users Stream
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
      setStats(prev => ({
        ...prev,
        suppliersCount: data.filter((u: any) => u.role === 'supplier').length,
        buyersCount: data.filter((u: any) => u.role === 'buyer').length,
        pendingUsers: data.filter((u: any) => u.status === 'pending').length
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    unsubscribes.current.push(unsubUsers);

    // 3. Offers Stream
    const unsubOffers = onSnapshot(collection(db, 'offers'), (snapshot) => {
      setOffers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'offers');
    });
    unsubscribes.current.push(unsubOffers);

    // 4. Settings Stream
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setRates({
          fast: data.fastCommissionRate !== undefined ? data.fastCommissionRate : 10,
          bulk: data.bulkCommissionRate !== undefined ? data.bulkCommissionRate : 5,
          offer: data.offerCommissionRate !== undefined ? data.offerCommissionRate : 8
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
    });
    unsubscribes.current.push(unsubSettings);

    setLoading(false);
  };

  const handleDeleteItem = async (collectionName: string, id: string) => {
    if (!window.confirm('هل أنت متأكد من الحذف النهائي؟')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (err) {
      toast.error('فشل الحذف');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.name) return;
    setIsAddingUser(true);
    
    try {
      const normalizedEmail = newUser.email.includes('@') ? newUser.email.toLowerCase() : `${newUser.email.toLowerCase()}@supplyx.com`;
      
      // Check if phone or email exists
      const usersRef = collection(db, 'users');
      const qPhone = query(usersRef, where('phone', '==', newUser.phone));
      const qEmail = query(usersRef, where('email', '==', normalizedEmail));
      
      const [pSnap, eSnap] = await Promise.all([getDocs(qPhone), getDocs(qEmail)]);
      
      if (!pSnap.empty) {
        toast.error('رقم الهاتف مسجل بالفعل لمستخدم آخر');
        setIsAddingUser(false);
        return;
      }
      
      if (!eSnap.empty) {
        toast.error('البريد الإلكتروني مسجل بالفعل لمستخدم آخر');
        setIsAddingUser(false);
        return;
      }

      const secondaryApp = getApps().find(app => app.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getSecondaryAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        normalizedEmail, 
        newUser.password
      );
      
      const newUid = userCredential.user.uid;

      // Update profile display name for the new user
      await updateSecondaryProfile(userCredential.user, {
        displayName: newUser.businessName || newUser.name
      });
      
      await setDoc(doc(db, 'users', newUid), {
        name: newUser.name,
        email: normalizedEmail,
        phone: newUser.phone,
        whatsappPhone: newUser.phone,
        whatsappOptIn: true,
        businessName: newUser.businessName,
        address: newUser.address,
        role: newUser.role,
        status: 'approved',
        disabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      await secondaryAuth.signOut();
      
      setShowAddUserModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'buyer', phone: '', businessName: '', address: '' });
      toast.success('تم إنشاء المستخدم بنجاح');
    } catch (err: any) {
      console.error("Error creating user:", err);
      toast.error(`فشل إنشاء المستخدم: ${err.message}`);
    } finally {
      setIsAddingUser(false);
    }
  };

  const updateCommission = async (type: 'fast' | 'bulk' | 'offer', val: number) => {
    try {
      const field = type === 'fast' ? 'fastCommissionRate' : type === 'bulk' ? 'bulkCommissionRate' : 'offerCommissionRate';
      await setDoc(doc(db, 'settings', 'general'), {
        [field]: val,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success('تم تحديث نسبة العمولة');
    } catch (err) {
      toast.error('فشل التحديث');
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.title || !broadcast.message) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }

    setIsSendingBroadcast(true);
    try {
      const targetUsers = broadcast.target === 'all' 
        ? users 
        : users.filter(u => u.role === broadcast.target);
      
      const batch = writeBatch(db);
      targetUsers.forEach(user => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: user.id,
          title: broadcast.title,
          message: broadcast.message,
          type: 'broadcast',
          read: false,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast.success(`تم إرسال الإشعار لـ ${targetUsers.length} مستخدم`);
      setBroadcast({ title: '', message: '', target: 'all' });
    } catch (err) {
      console.error("Error sending broadcast:", err);
      toast.error('فشل إرسال الإشعار');
    } finally {
      setIsSendingBroadcast(false);
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
            <NavItem icon={<Tag className="w-5 h-5" />} label="الخدمات والأصناف" active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} />
            <NavItem icon={<Mail className="w-5 h-5" />} label="بث إشعارات" active={activeTab === 'broadcast'} onClick={() => setActiveTab('broadcast')} />
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
             activeTab === 'categories' ? 'إدارة الأصناف والخدمات' :
             activeTab === 'broadcast' ? 'بث رسائل للنظام' :
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
            
            <button 
              onClick={() => auth.signOut().then(() => navigate('/'))}
              className="lg:hidden flex items-center justify-center p-2 text-slate-400 hover:text-red-500 bg-slate-800 rounded-lg transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>

            <button
               onClick={() => auth.signOut().then(() => navigate('/'))}
               className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج</span>
            </button>

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <StatCard label="إجمالي الإيرادات" value={`${stats.totalRevenue.toLocaleString()} ج.م`} icon={<TrendingUp />} trend="+12%" color="emerald" />
                  <StatCard label="صافي الربح الكلي" value={`${stats.platformProfit.toLocaleString()} ج.م`} icon={<DollarSign />} trend="أرباح العمليات" color="sky" />
                  <StatCard label="طلبات جديدة" value={stats.newRequestsCount} icon={<Package />} trend="بانتظار مورد" color="blue" />
                  <StatCard label="تفعيل مستخدمين" value={stats.pendingUsers} icon={<Users />} trend="مراجعة حسابات" color="amber" />
                  <StatCard label="قاعدة المستخدمين" value={stats.suppliersCount + stats.buyersCount} icon={<Users />} trend="متزايد" color="indigo" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Revenue Chart */}
                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="font-bold text-white">إحصائيات الأرباح {reportType === 'day' ? 'اليومية' : reportType === 'week' ? 'الأسبوعية' : 'الشهرية'}</h3>
                      <div className="flex bg-slate-800 p-1 rounded-xl">
                        <button onClick={() => setReportType('day')} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${reportType === 'day' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>يومي</button>
                        <button onClick={() => setReportType('week')} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${reportType === 'week' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>أسبوعي</button>
                        <button onClick={() => setReportType('month')} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${reportType === 'month' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>شهري</button>
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
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">أحدث المستخدمين</h3>
                      <button onClick={() => setActiveTab('users')} className="text-xs font-bold text-primary-500 hover:text-primary-400 bg-primary-500/10 px-3 py-1.5 rounded-lg transition-colors">جميع العملاء</button>
                    </div>
                    <div className="space-y-4">
                      {[...users].sort((a: any, b: any) => {
                        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                        return dateB.getTime() - dateA.getTime();
                      }).slice(0, 4).map((user: any) => (
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
                      {[...requests].sort((a: any, b: any) => {
                        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                        return dateB.getTime() - dateA.getTime();
                      }).slice(0, 4).map((req: any) => (
                        <div key={req.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <ShoppingBag className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{req.productName}</p>
                              <p className="text-xs text-slate-500">{req.createdAt ? (req.createdAt.toDate ? req.createdAt.toDate() : new Date(req.createdAt)).toLocaleDateString('ar-EG') : '-'}</p>
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
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex rounded-lg bg-slate-800 p-1">
                      <button onClick={() => setRoleFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${roleFilter === 'all' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>الكل</button>
                      <button onClick={() => setRoleFilter('buyer')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${roleFilter === 'buyer' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>المشترين</button>
                      <button onClick={() => setRoleFilter('supplier')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${roleFilter === 'supplier' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>الموردين</button>
                    </div>

                    <div className="flex rounded-lg bg-slate-800 p-1">
                      <button onClick={() => setStatusFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'all' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>حالة مجهولة</button>
                      <button onClick={() => setStatusFilter('pending')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'pending' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>انتظار</button>
                      <button onClick={() => setStatusFilter('approved')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'approved' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>مقبول</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowAddUserModal(true)} className="bg-emerald-600 hover:bg-emerald-500 transition text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                       <Users className="w-4 h-4" />
                       إضافة مستخدم جديد
                    </button>
                  </div>
                </div>

                {users.filter(u => u.status === 'pending').length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        <span className="font-bold text-amber-500">يوجد طلبات تسجيل بانتظار المراجعة</span>
                     </div>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-wider">
                        <th className="px-6 py-4">المسؤول / البريد</th>
                        <th className="px-6 py-4">النشاط التجاري / الهاتف</th>
                        <th className="px-6 py-4">الدور</th>
                        <th className="px-6 py-4 whitespace-nowrap">التاريخ</th>
                        <th className="px-6 py-4">الحالة</th>
                        <th className="px-6 py-4">العمليات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {users.filter(u => {
                        const searchLower = searchQuery.toLowerCase();
                        const matchSearch = (u.name || '').toLowerCase().includes(searchLower) || 
                                           (u.email || '').toLowerCase().includes(searchLower) || 
                                           (u.businessName || '').toLowerCase().includes(searchLower) ||
                                           (u.phone || '').includes(searchQuery) ||
                                           (u.whatsappPhone || '').includes(searchQuery);
                        const matchRole = roleFilter === 'all' || u.role === roleFilter;
                        const matchStatus = statusFilter === 'all' || u.status === statusFilter;
                        return matchSearch && matchRole && matchStatus;
                      }).map((user: any) => (
                        <tr key={user.id} className={`transition ${user.status === 'pending' ? 'bg-amber-500/5' : 'hover:bg-slate-800/30'}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                                {user.name?.[0] || 'U'}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white whitespace-nowrap">{user.name}</p>
                                <p className="text-[10px] text-slate-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-white whitespace-nowrap">{user.businessName || '-'}</p>
                            <p className="text-[10px] text-slate-500">{user.phone || user.whatsappPhone || '-'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.role === 'supplier' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                              {user.role === 'supplier' ? 'مورد' : 'مشتري'}
                            </span>
                            {user.address && <p className="text-[10px] text-slate-400 mt-1 max-w-[150px] truncate" title={user.address}>{user.address}</p>}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 italic whitespace-nowrap">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${user.status === 'pending' ? 'bg-amber-500' : user.status === 'rejected' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                <span className="text-xs">
                                   {user.status === 'pending' ? 'معلق (بانتظار الموافقة)' : 
                                    user.status === 'rejected' ? 'مرفوض' : 
                                    user.status === 'on_hold' ? 'معلق مؤقتاً' : 'موافق عليه'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-60">
                                <span className={`w-2 h-2 rounded-full ${user.disabled ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                <span className="text-[10px]">{user.disabled ? 'الوصول محظور' : 'الوصول مسموح'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                               {user.status === 'pending' && (
                                  <>
                                     <button onClick={() => updateDoc(doc(db, 'users', user.id), { status: 'approved', disabled: false, updatedAt: serverTimestamp() })} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition">قبول</button>
                                     <button onClick={() => updateDoc(doc(db, 'users', user.id), { status: 'rejected', disabled: true, updatedAt: serverTimestamp() })} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition">رفض</button>
                                  </>
                               )}
                               {user.status !== 'pending' && (
                                  <button onClick={() => updateDoc(doc(db, 'users', user.id), { disabled: !user.disabled, updatedAt: serverTimestamp() })} className="p-2 bg-slate-800 rounded-lg group" title={user.disabled ? "إلغاء الحظر" : "حظر الحساب"}>
                                    <Ban className={`w-4 h-4 ${user.disabled ? 'text-emerald-500' : 'text-slate-500 group-hover:text-red-500'}`} />
                                  </button>
                               )}
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

            {activeTab === 'offers' && (
              <motion.div key="offers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-right">
                    <thead className="bg-slate-800/50 text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="px-6 py-4">العرض</th>
                        <th className="px-6 py-4">المورد</th>
                        <th className="px-6 py-4">السعر</th>
                        <th className="px-6 py-4">الخصم</th>
                        <th className="px-6 py-4">إحصائيات</th>
                        <th className="px-6 py-4">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {offers.filter(o => (o.title || '').includes(searchQuery)).map((o: any) => (
                        <tr key={o.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={o.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-800" />
                              <span className="font-bold text-white text-sm">{o.title}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">{o.supplierName}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-emerald-500 font-bold">{o.offerPrice} ج</span>
                            <span className="text-[10px] text-slate-500 line-through mr-2">{o.originalPrice} ج</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[10px] font-bold">{o.discount}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <span className="block text-white font-bold text-xs">{o.views || 0}</span>
                                <span className="text-[10px] text-slate-500 uppercase">مشاهدة</span>
                              </div>
                              <div className="text-center">
                                <span className="block text-white font-bold text-xs">{o.orders || 0}</span>
                                <span className="text-[10px] text-slate-500 uppercase">طلب</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button onClick={() => handleDeleteItem('offers', o.id)} className="p-2 bg-slate-800 rounded-lg hover:bg-red-500/10 group">
                              <Trash2 className="w-4 h-4 text-slate-500 group-hover:text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {offers.length === 0 && (
                    <div className="p-12 text-center text-slate-500 italic">لا توجد عروض ترويجية نشطة</div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'requests' && (
              <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-2 gap-2 flex-1 overflow-x-auto hide-scrollbar">
                    <button 
                      onClick={() => setRequestFilter('fast')} 
                      className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl transition whitespace-nowrap ${requestFilter === 'fast' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      الطلبات السريعة
                    </button>
                    <button 
                      onClick={() => setRequestFilter('bulk')} 
                      className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl transition whitespace-nowrap ${requestFilter === 'bulk' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      مناقصات الجملة
                    </button>
                    <button 
                      onClick={() => setRequestFilter('offer')} 
                      className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl transition whitespace-nowrap ${requestFilter === 'offer' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      عروض التجار
                    </button>
                  </div>

                  <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 gap-1 overflow-x-auto hide-scrollbar">
                    <button onClick={() => setRequestsStatusFilter('all')} className={`px-4 py-2 text-[10px] font-bold rounded-xl transition whitespace-nowrap ${requestsStatusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}>الكل</button>
                    <button onClick={() => setRequestsStatusFilter('new')} className={`px-4 py-2 text-[10px] font-bold rounded-xl transition whitespace-nowrap flex items-center gap-2 ${requestsStatusFilter === 'new' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-white'}`}>
                      جديد
                      {requests.filter(r => r.status === 'active' && !r.supplierId).length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-white text-blue-600 flex items-center justify-center text-[8px]">{requests.filter(r => r.status === 'active' && !r.supplierId).length}</span>
                      )}
                    </button>
                    <button onClick={() => setRequestsStatusFilter('in_progress')} className={`px-4 py-2 text-[10px] font-bold rounded-xl transition whitespace-nowrap ${requestsStatusFilter === 'in_progress' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:text-white'}`}>قيد التنفيذ</button>
                    <button onClick={() => setRequestsStatusFilter('delivered')} className={`px-4 py-2 text-[10px] font-bold rounded-xl transition whitespace-nowrap ${requestsStatusFilter === 'delivered' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-white'}`}>مكتمل</button>
                    <button onClick={() => setRequestsStatusFilter('cancelled')} className={`px-4 py-2 text-[10px] font-bold rounded-xl transition whitespace-nowrap ${requestsStatusFilter === 'cancelled' ? 'bg-red-500 text-white' : 'text-slate-500 hover:text-white'}`}>ملغي</button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                   <table className="w-full text-right">
                      <thead className="bg-slate-800/50 text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="px-6 py-4">{requestFilter === 'bulk' ? 'المنتجات' : 'المنتج'}</th>
                          <th className="px-6 py-4">المشتري</th>
                          <th className="px-6 py-4">المورد</th>
                          <th className="px-6 py-4">السعر</th>
                          <th className="px-6 py-4 whitespace-nowrap">التاريخ</th>
                          <th className="px-6 py-4">الحالة</th>
                          <th className="px-6 py-4">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {requests
                          .filter(r => (r.productName || '').toLowerCase().includes(searchQuery.toLowerCase()))
                          .filter(r => {
                            if (requestFilter === 'bulk') return r.requestType === 'bulk';
                            if (requestFilter === 'offer') return !!r.offerId;
                            return r.requestType !== 'bulk' && !r.offerId;
                          })
                          .filter(r => {
                            if (requestsStatusFilter === 'all') return true;
                            if (requestsStatusFilter === 'new') return r.status === 'active' && !r.supplierId;
                            if (requestsStatusFilter === 'in_progress') return r.status === 'active' && !!r.supplierId;
                            return r.status === requestsStatusFilter;
                          })
                          .sort((a: any, b: any) => {
                            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                            return dateB.getTime() - dateA.getTime();
                          })
                          .map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-800/30 transition">
                            <td className="px-6 py-4">
                              <div className="font-bold text-white text-sm">{r.productName}</div>
                              {r.requestType === 'bulk' && r.items && (
                                <div className="text-[10px] text-slate-500 mt-1">تتضمن {r.items.length} منتجات</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                               <p className="font-bold text-slate-300">{r.buyerName || 'مشتري'}</p>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                               <p className="italic">{r.supplierName || 'بانتظار عرض'}</p>
                            </td>
                            <td className="px-6 py-4 font-bold text-emerald-500 text-sm whitespace-nowrap">{r.price || 0} ج.م</td>
                            <td className="px-6 py-4 text-[10px] text-slate-500 italic whitespace-nowrap">
                               {r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)).toLocaleDateString('ar-EG') : '-'}
                            </td>
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
                   {requests.filter(r => {
                      if (requestFilter === 'bulk') return r.requestType === 'bulk';
                      if (requestFilter === 'offer') return !!r.offerId;
                      return r.requestType !== 'bulk' && !r.offerId;
                    }).length === 0 && (
                     <div className="p-12 text-center text-slate-500 italic">لا توجد طلبات هنا</div>
                   )}
                </div>
              </motion.div>
            )}

            {activeTab === 'categories' && (
              <motion.div key="categories" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-amber-500 text-sm font-bold flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" />
                  <span>تنبيه: يتم تحميل الأصناف حالياً من ملف الإعدادات الأساسي. التعديل البرمجي مطلوب لإضافة أصناف جديدة في النسخة الحالية.</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {CATEGORIES.map((cat: any) => (
                    <div key={cat.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-primary-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{cat.icon}</span>
                          <h3 className="font-bold text-white">{cat.name}</h3>
                        </div>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded">ID: {cat.id}</span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">المنتجات المقترحة ({cat.products.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {cat.products.map((p: string, i: number) => (
                            <span key={i} className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded-md">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'broadcast' && (
              <motion.div key="broadcast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-primary-500/10 rounded-2xl">
                      <Mail className="w-8 h-8 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">بث إشعار عام للنظام</h3>
                      <p className="text-slate-400 text-sm">أرسل رسالة فورية إلى جميع المستخدمين أو فئة معينة</p>
                    </div>
                  </div>

                  <form onSubmit={handleBroadcast} className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">الفئة المستهدفة</label>
                      <div className="grid grid-cols-3 gap-3">
                        {['all', 'buyer', 'supplier'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setBroadcast({...broadcast, target: t as any})}
                            className={`py-3 rounded-xl border font-bold text-xs transition ${
                              broadcast.target === t 
                                ? 'bg-primary-500 border-primary-500 text-white shadow-lg' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            {t === 'all' ? 'الكل' : t === 'buyer' ? 'المشترين' : 'الموردين'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">عنوان الرسالة</label>
                      <input 
                        type="text" 
                        required
                        value={broadcast.title}
                        onChange={(e) => setBroadcast({...broadcast, title: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="مثال: تحديث جديد في النظام، عرض خاص للموردين..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">محتوى الرسالة</label>
                      <textarea 
                        required
                        rows={4}
                        value={broadcast.message}
                        onChange={(e) => setBroadcast({...broadcast, message: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                        placeholder="اكتب تفاصيل الرسالة هنا..."
                      ></textarea>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSendingBroadcast}
                      className="w-full py-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-bold rounded-xl transition shadow-lg shadow-primary-500/20"
                    >
                      {isSendingBroadcast ? 'جاري البث...' : 'إرسال الإشعار الآن'}
                    </button>
                  </form>
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-1">
                     <h3 className="font-bold text-white mb-6">تفصيل الأرباح والعمليات</h3>
                     <div className="space-y-4">
                       <div className="bg-slate-800 rounded-xl p-4">
                          <p className="text-sm font-bold text-slate-300 mb-2 border-b border-slate-700 pb-2">الطلبات السريعة</p>
                          <div className="flex justify-between text-xs text-white mb-1"><span>عدد العمليات:</span> <span>{reports.fast.count}</span></div>
                          <div className="flex justify-between text-xs text-white mb-1"><span>حجم التداول:</span> <span>{reports.fast.revenue.toLocaleString()} ج.م</span></div>
                          <div className="flex justify-between text-sm font-bold text-sky-400 mt-2 pt-2 border-t border-slate-700"><span>الربح:</span> <span>{reports.fast.profit.toLocaleString()} ج.م</span></div>
                       </div>
                       <div className="bg-slate-800 rounded-xl p-4">
                          <p className="text-sm font-bold text-slate-300 mb-2 border-b border-slate-700 pb-2">مناقصات الجملة</p>
                          <div className="flex justify-between text-xs text-white mb-1"><span>عدد العمليات:</span> <span>{reports.bulk.count}</span></div>
                          <div className="flex justify-between text-xs text-white mb-1"><span>حجم التداول:</span> <span>{reports.bulk.revenue.toLocaleString()} ج.م</span></div>
                          <div className="flex justify-between text-sm font-bold text-sky-400 mt-2 pt-2 border-t border-slate-700"><span>الربح:</span> <span>{reports.bulk.profit.toLocaleString()} ج.م</span></div>
                       </div>
                       <div className="bg-slate-800 rounded-xl p-4">
                          <p className="text-sm font-bold text-slate-300 mb-2 border-b border-slate-700 pb-2">عروض التجار</p>
                          <div className="flex justify-between text-xs text-white mb-1"><span>عدد العمليات:</span> <span>{reports.offer.count}</span></div>
                          <div className="flex justify-between text-xs text-white mb-1"><span>حجم التداول:</span> <span>{reports.offer.revenue.toLocaleString()} ج.م</span></div>
                          <div className="flex justify-between text-sm font-bold text-sky-400 mt-2 pt-2 border-t border-slate-700"><span>الربح:</span> <span>{reports.offer.profit.toLocaleString()} ج.م</span></div>
                       </div>
                     </div>
                  </div>

                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-8">
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
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                  <h3 className="font-bold text-white text-xl mb-6 text-center">إعدادات المنصة وعمولات الخدمات</h3>
                  
                  <div className="space-y-8">
                    <div>
                      <label className="block text-sm font-bold text-emerald-400 mb-2">نسبة عمولة الطلبات السريعة (%)</label>
                      <div className="flex gap-4">
                         <input 
                           type="number" 
                           value={rates.fast}
                           onChange={(e) => setRates(prev => ({ ...prev, fast: Number(e.target.value) }))}
                           className="flex-1 bg-slate-800 border border-emerald-500/30 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition font-bold"
                         />
                         <button 
                           onClick={() => updateCommission('fast', rates.fast)}
                           className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-500 transition"
                         >
                           تحديث
                         </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">تطبق على الطلبات العادية للكميات الصغيرة والمتوسطة بين المطاعم والموردين المتاحين حالياً</p>
                    </div>

                    <div className="pt-6 border-t border-slate-800">
                      <label className="block text-sm font-bold text-amber-400 mb-2">نسبة عمولة مناقصات الجملة (%)</label>
                      <div className="flex gap-4">
                         <input 
                           type="number" 
                           value={rates.bulk}
                           onChange={(e) => setRates(prev => ({ ...prev, bulk: Number(e.target.value) }))}
                           className="flex-1 bg-slate-800 border border-amber-500/30 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 transition font-bold"
                         />
                         <button 
                           onClick={() => updateCommission('bulk', rates.bulk)}
                           className="bg-amber-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-amber-500 transition"
                         >
                           تحديث
                         </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">تطبق على طلبات المنتجات المتعددة والكميات الضخمة التي يستغرق تجهيزها وقتاً</p>
                    </div>

                    <div className="pt-6 border-t border-slate-800">
                      <label className="block text-sm font-bold text-purple-400 mb-2">نسبة عمولة عروض التجار (%)</label>
                      <div className="flex gap-4">
                         <input 
                           type="number" 
                           value={rates.offer}
                           onChange={(e) => setRates(prev => ({ ...prev, offer: Number(e.target.value) }))}
                           className="flex-1 bg-slate-800 border border-purple-500/30 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition font-bold"
                         />
                         <button 
                           onClick={() => updateCommission('offer', rates.offer)}
                           className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-500 transition"
                         >
                           تحديث
                         </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">تطبق عندما يشتري العميل عرضاً خاصاً مسبق الإعداد من المورد</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add User Modal */}
          <AnimatePresence>
            {showAddUserModal && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">إضافة مستخدم للشركة</h3>
                    <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white">
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-1">اسم المسؤول</label>
                        <input 
                          type="text" 
                          required
                          value={newUser.name}
                          onChange={e => setNewUser({...newUser, name: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-primary-500" 
                          placeholder="الاسم"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-1">اسم النشاط التجاري</label>
                        <input 
                          type="text" 
                          required
                          value={newUser.businessName}
                          onChange={e => setNewUser({...newUser, businessName: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-primary-500" 
                          placeholder="اسم المطعم أو الشركة"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-1">البريد الإلكتروني للإدارة</label>
                      <input 
                        type="text" 
                        required
                        value={newUser.email}
                        onChange={e => setNewUser({...newUser, email: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-primary-500" 
                        placeholder="example@supplyx.com"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-1">رقم الهاتف</label>
                      <input 
                        type="tel" 
                        required
                        value={newUser.phone}
                        onChange={e => setNewUser({...newUser, phone: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-primary-500" 
                        placeholder="01xxxxxxxxx"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-1">العنوان بالتفصيل</label>
                      <input 
                        type="text" 
                        required
                        value={newUser.address}
                        onChange={e => setNewUser({...newUser, address: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-primary-500" 
                        placeholder="مثال: القاهرة، مدينة نصر، شارع مكرم عبيد"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-1">كلمة المرور المؤقتة</label>
                      <input 
                        type="password" 
                        required
                        minLength={6}
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-primary-500" 
                        placeholder="••••••••"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">نوع الحساب</label>
                      <div className="grid grid-cols-2 gap-4">
                         <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition ${newUser.role === 'buyer' ? 'bg-primary-500/10 border-primary-500 text-primary-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                           <input type="radio" name="role" value="buyer" className="hidden" checked={newUser.role === 'buyer'} onChange={() => setNewUser({...newUser, role: 'buyer'})} />
                           <span className="font-bold">مشتري (مطعم)</span>
                         </label>
                         <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition ${newUser.role === 'supplier' ? 'bg-primary-500/10 border-primary-500 text-primary-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                           <input type="radio" name="role" value="supplier" className="hidden" checked={newUser.role === 'supplier'} onChange={() => setNewUser({...newUser, role: 'supplier'})} />
                           <span className="font-bold">مورد</span>
                         </label>
                      </div>
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={isAddingUser}
                      className="w-full py-4 mt-4 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl disabled:opacity-50 transition"
                    >
                      {isAddingUser ? 'جاري الإنشاء...' : 'إنشاء وحفظ الحساب'}
                    </button>
                  </form>
                </motion.div>
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
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  };

  const style = colorStyles[color] || colorStyles.emerald;
  const parts = style.split(' ');

  return (
    <div className={`bg-slate-900 border ${parts[2]} rounded-2xl p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${parts.slice(0, 2).join(' ')}`}>
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
  
  const style = styles[color] || styles.emerald;
  const parts = style.split(' ');

  return (
    <div className={`bg-slate-900 border ${parts[1]} p-6 rounded-2xl`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${parts.slice(0, 1).join(' ')}`}>{icon}</div>
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

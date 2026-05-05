import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { 
  collection, 
  query, 
  where,
  orderBy,
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  deleteDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  limit,
  addDoc
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
  Check,
  CheckCircle2,
  XCircle,
  BarChart3,
  Mail,
  Phone,
  Store,
  Package,
  Edit,
  Zap,
  Activity,
  Plus,
  Calendar,
  X,
  Archive,
  CreditCard,
  Layers,
  Settings
} from 'lucide-react';
import { CATEGORIES } from '../../constants';
import AnalyticsSystem from './AnalyticsSystem';
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
  Cell,
  LineChart
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'overview' | 'control_room' | 'analytics' | 'monitoring' | 'users' | 'offers' | 'requests' | 'finances' | 'subscriptions' | 'settings' | 'broadcast' | 'categories' | 'ordering';

import UserDetailsModal from './UserDetailsModal';
import RequestDetailsAdminModal from './RequestDetailsAdminModal';

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [alerts, setAlerts] = useState<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    actionLabel: string;
    actionTab: Tab;
    count: number;
    priority: number;
  }[]>([]);
  const [reportType, setReportType] = useState<'day' | 'week' | 'month'>('week');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    deliveredOrders: 0,
    activeOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    platformProfit: 0,
    subscriptionRevenue: 0,
    activeSubscriptions: 0,
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
  const [rates, setRates] = useState({ 
    fast: 10, 
    bulk: 5, 
    offer: 8, 
    buyerSub: 3000, 
    buyerPremiumSub: 5000, 
    supplierSub: 5000, 
    supplierPremiumSub: 7000, 
    trialDays: 7 
  });
  const [subPayments, setSubPayments] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'supplier'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'suspended' | 'approved' | 'rejected'>('all');
  const [requestFilter, setRequestFilter] = useState<'fast' | 'bulk' | 'offer'>('fast');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'buyer', 
    phone: '', 
    businessName: '', 
    address: '',
    subscriptionTier: 'standard',
    isTrial: false
  });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: '', message: '', target: 'all' as 'all' | 'buyer' | 'supplier' });
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [editingBroadcastId, setEditingBroadcastId] = useState<string | null>(null);
  const [requestsStatusFilter, setRequestsStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'delivered' | 'cancelled'>('all');
  const [financeTimeFilter, setFinanceTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [userGrowthData, setUserGrowthData] = useState<any[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<any[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const navigate = useNavigate();
  const unsubscribes = useRef<(() => void)[]>([]);
  const nowTime = new Date().getTime();

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
    // ... stats calculation logic ...
    // (keeping original logic for requests stats)
    
    // User Growth Logic
    const userGrowth = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.setHours(0,0,0,0)).getTime();
      const endOfDay = new Date(d.setHours(23,59,59,999)).getTime();
      
      const count = users.filter(u => {
        const timestamp = u.createdAt?.toMillis?.() || new Date(u.createdAt || 0).getTime();
        return timestamp <= endOfDay;
      }).length;
      
      userGrowth.push({
        name: d.toLocaleDateString('ar-EG', { weekday: 'short' }),
        users: count
      });
    }
    setUserGrowthData(userGrowth);

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

    const nowTime = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    requests.forEach((r: any) => {
      const rTime = r.createdAt?.toMillis?.() || new Date(r.createdAt || 0).getTime();
      const diff = nowTime - rTime;

      let isInFilter = true;
      if (financeTimeFilter === 'today') isInFilter = diff <= oneDay;
      else if (financeTimeFilter === 'week') isInFilter = diff <= oneWeek;
      else if (financeTimeFilter === 'month') isInFilter = diff <= oneMonth;

      bidsCount += r.bidsCount || 0;
      
      if (r.status === 'active' && !r.supplierId) {
        newRequests++;
      }
      
      let reqProfit = 0;
      let reqRate = rates.fast;
      if (r.requestType === 'bulk') reqRate = rates.bulk;
      else if (r.offerId) reqRate = rates.offer;

      if (r.status === 'delivered') {
        const amount = r.totalAmount || r.price || 0;
        
        // Only add to financial reports if in time filter
        if (isInFilter) {
          totalRevenue += amount;
          reqProfit = amount * (reqRate / 100);
          platformProfit += reqProfit;

          if (r.requestType === 'bulk') {
            bulkReport.count++;
            bulkReport.revenue += amount;
            bulkReport.profit += reqProfit;
          } else if (r.offerId) {
            offerReport.count++;
            offerReport.revenue += amount;
            offerReport.profit += reqProfit;
          } else {
            fastReport.count++;
            fastReport.revenue += amount;
            fastReport.profit += reqProfit;
          }
        }

        delivered++;
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
    
    let aggregatedData: any[] = [];

    const getReqProfit = (r: any) => {
      let reqRate = rates.fast;
      if (r.requestType === 'bulk') reqRate = rates.bulk;
      else if (r.offerId) reqRate = rates.offer;
      const amount = r.totalAmount || r.price || 0;
      return amount * (reqRate / 100);
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
            dayRevenue += (r.totalAmount || r.price || 0);
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
                 dayRevenue += (r.totalAmount || r.price || 0);
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
            rev += (r.totalAmount || r.price || 0);
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

    // Calculate Dynamic Alerts for Decision Making
    const newAlerts: typeof alerts = [];
    
    // 1. Pending Subscription Requests
    const pendingSubs = subscriptionRequests.filter(r => r.status === 'pending');
    if (pendingSubs.length > 0) {
      newAlerts.push({
        id: 'pending_subs',
        type: 'warning',
        message: `يوجد ${pendingSubs.length} طلبات اشتراك بانتظار المراجعة المالية`,
        actionLabel: 'مراجعة الاشتراكات',
        actionTab: 'subscriptions',
        count: pendingSubs.length,
        priority: 1
      });
    }

    // 2. Pending User Approvals
    const pendingReview = users.filter(u => u.status === 'pending');
    if (pendingReview.length > 0) {
      newAlerts.push({
        id: 'pending_users',
        type: 'info',
        message: `يوجد ${pendingReview.length} مستخدمين جدد بانتظار تفعيل الحساب`,
        actionLabel: 'إدارة المستخدمين',
        actionTab: 'users',
        count: pendingReview.length,
        priority: 2
      });
    }

    // 3. Stale Orders (Accepted but not updated for > 24h)
    const staleOrders = requests.filter(r => 
      ['accepted', 'preparing'].includes(r.status) && 
      (nowTime - (r.updatedAt?.toMillis?.() || new Date(r.updatedAt).getTime())) > (24 * 60 * 60 * 1000)
    );
    if (staleOrders.length > 0) {
      newAlerts.push({
        id: 'stale_orders',
        type: 'error',
        message: `يوجد ${staleOrders.length} طلبات متأخرة في التنفيذ (> 24 ساعة)`,
        actionLabel: 'متابعة الطلبات',
        actionTab: 'requests',
        count: staleOrders.length,
        priority: 0
      });
    }

    // 4. High Value Bulk Requests with no bids
    const highValueBulk = requests.filter(r => 
      r.requestType === 'bulk' && 
      r.status === 'active' && 
      !r.supplierId && 
      (r.bidsCount || 0) === 0
    );
    if (highValueBulk.length > 0) {
      newAlerts.push({
        id: 'high_value_bulk',
        type: 'warning',
        message: `يوجد ${highValueBulk.length} طلبات جملة ضخمة لم تتلق عروضاً بعد`,
        actionLabel: 'غرفة العمليات',
        actionTab: 'control_room',
        count: highValueBulk.length,
        priority: 1
      });
    }

    setAlerts(newAlerts.sort((a, b) => a.priority - b.priority));
  }, [requests, users, reportType, rates, financeTimeFilter, subscriptionRequests]);

  const startStreamingData = () => {
    // Clear any existing unsubscribes
    unsubscribes.current.forEach(u => u());
    unsubscribes.current = [];

    // 1. Orders/Requests Stream
      const qReq = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(500));
      const unsubRequests = onSnapshot(qReq, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRequests(data);
        setLoading(false);
      }, (err) => {
        console.error('Requests stream error:', err);
        handleFirestoreError(err, OperationType.LIST, 'requests', true);
      });
      unsubscribes.current.push(unsubRequests);

      const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(1000));
      const unsubUsers = onSnapshot(qUsers, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(data);
        setStats(prev => ({
          ...prev,
          suppliersCount: data.filter((u: any) => u.role === 'supplier').length,
          buyersCount: data.filter((u: any) => u.role === 'buyer').length,
          pendingUsers: data.filter((u: any) => u.status === 'pending').length
        }));
      }, (err) => {
        console.error('Users stream error:', err);
        handleFirestoreError(err, OperationType.LIST, 'users', true);
      });
      unsubscribes.current.push(unsubUsers);

      const qOffers = query(collection(db, 'offers'), orderBy('createdAt', 'desc'), limit(500));
      const unsubOffers = onSnapshot(qOffers, (snapshot) => {
        setOffers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.error('Offers stream error:', err);
        handleFirestoreError(err, OperationType.LIST, 'offers', true);
      });
      unsubscribes.current.push(unsubOffers);

    // 4. Settings Stream
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setRates({
          fast: data.fastCommissionRate !== undefined ? data.fastCommissionRate : 10,
          bulk: data.bulkCommissionRate !== undefined ? data.bulkCommissionRate : 5,
          offer: data.offerCommissionRate !== undefined ? data.offerCommissionRate : 8,
          buyerSub: data.buyerSubPrice !== undefined ? data.buyerSubPrice : 3000,
          buyerPremiumSub: data.buyerPremiumSubPrice !== undefined ? data.buyerPremiumSubPrice : 5000,
          supplierSub: data.supplierSubPrice !== undefined ? data.supplierSubPrice : 5000,
          supplierPremiumSub: data.supplierPremiumSubPrice !== undefined ? data.supplierPremiumSubPrice : 7000,
          trialDays: data.trialDays !== undefined ? data.trialDays : 7
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
    });
    unsubscribes.current.push(unsubSettings);

    // 5. Broadcasts Stream
    const unsubBroadcasts = onSnapshot(query(collection(db, 'system_broadcasts'), orderBy('createdAt', 'desc')), (snapshot) => {
      setBroadcasts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'system_broadcasts', true);
    });
    unsubscribes.current.push(unsubBroadcasts);

    // 6. Subscription Payments Stream
    const unsubSubPayments = onSnapshot(query(collection(db, 'subscription_payments'), orderBy('paymentDate', 'desc')), (snapshot) => {
      const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubPayments(payments);
      
      const totalSubRev = payments.reduce((acc, curr: any) => acc + (curr.amount || 0), 0);
      setStats(prev => ({ ...prev, subscriptionRevenue: totalSubRev }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subscription_payments', true);
    });
    unsubscribes.current.push(unsubSubPayments);

    // 7. Subscription Requests Stream
    const unsubSubRequests = onSnapshot(query(collection(db, 'subscription_requests'), orderBy('createdAt', 'desc')), (snapshot) => {
      setSubscriptionRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subscription_requests', true);
    });
    unsubscribes.current.push(unsubSubRequests);

    setLoading(false);
  };

  const handleDeleteItem = async (collectionName: string, id: string) => {
    if (!window.confirm('هل أنت متأكد من الحذف النهائي؟')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast.success('تم الحذف بنجاح');
    } catch (err: any) {
      console.error(`Delete Error [${collectionName}]:`, err);
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
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
        subscriptionTier: newUser.subscriptionTier,
        isTrial: newUser.isTrial,
        subscriptionStatus: newUser.isTrial ? 'active' : 'inactive',
        subscriptionExpiry: newUser.isTrial ? new Date(Date.now() + (rates.trialDays || 7) * 24 * 60 * 60 * 1000).toISOString() : null,
        disabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      await secondaryAuth.signOut();
      
      setShowAddUserModal(false);
      setNewUser({ 
        name: '', 
        email: '', 
        password: '', 
        role: 'buyer', 
        phone: '', 
        businessName: '', 
        address: '',
        subscriptionTier: 'standard',
        isTrial: false
      });
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
      
      if (editingBroadcastId) {
        // UPDATE existing broadcast
        await updateDoc(doc(db, 'system_broadcasts', editingBroadcastId), {
          title: broadcast.title,
          message: broadcast.message,
          target: broadcast.target,
          updatedAt: serverTimestamp()
        });

        // Update all associated user notifications
        const notifQuery = query(collection(db, 'notifications'), where('broadcastId', '==', editingBroadcastId));
        const notifSnap = await getDocs(notifQuery);
        
        // Split into chunks of 500 for batch operations
        const chunks = [];
        for (let i = 0; i < notifSnap.docs.length; i += 500) {
          chunks.push(notifSnap.docs.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(d => {
            batch.update(d.ref, {
              title: broadcast.title,
              message: broadcast.message,
              updatedAt: serverTimestamp()
            });
          });
          await batch.commit();
        }
        
        toast.success('تم تحديث الإشعار بنجاح');
        setEditingBroadcastId(null);
      } else {
        // CREATE new broadcast
        const broadcastRef = doc(collection(db, 'system_broadcasts'));
        const broadcastId = broadcastRef.id;

        await setDoc(broadcastRef, {
          title: broadcast.title,
          message: broadcast.message,
          target: broadcast.target,
          createdAt: serverTimestamp()
        });

        // Split target users into chunks of 500 for batch operations
        const userChunks = [];
        for (let i = 0; i < targetUsers.length; i += 500) {
          userChunks.push(targetUsers.slice(i, i + 500));
        }

        for (const chunk of userChunks) {
          const batch = writeBatch(db);
          chunk.forEach(user => {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
              broadcastId,
              userId: user.id,
              title: broadcast.title,
              message: broadcast.message,
              type: 'broadcast',
              read: false,
              createdAt: serverTimestamp()
            });
          });
          await batch.commit();
        }

        toast.success(`تم إرسال الإشعار لـ ${targetUsers.length} مستخدم`);
      }
      
      setBroadcast({ title: '', message: '', target: 'all' });
    } catch (err) {
      console.error("Error sending broadcast:", err);
      toast.error('فشل إرسال الإشعار');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإشعار من سجلات النظام ومن عند جميع المستخدمين؟')) return;
    
    try {
      // Delete the broadcast history record
      await deleteDoc(doc(db, 'system_broadcasts', id));
      
      // Delete all user notifications associated with this broadcast
      const notifQuery = query(collection(db, 'notifications'), where('broadcastId', '==', id));
      const notifSnap = await getDocs(notifQuery);
      
      const chunks = [];
      for (let i = 0; i < notifSnap.docs.length; i += 500) {
        chunks.push(notifSnap.docs.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
      
      toast.success('تم حذف الإشعار بنجاح');
    } catch (err) {
      console.error("Error deleting broadcast:", err);
      toast.error('فشل الحذف');
    }
  };

  const updateSubPrice = async (field: 'buyerSubPrice' | 'buyerPremiumSubPrice' | 'supplierSubPrice' | 'supplierPremiumSubPrice' | 'trialDays', val: number) => {
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        [field]: val,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('تم التحديث بنجاح');
    } catch (err) {
      toast.error('فشل التحديث');
    }
  };

  const handleManualSubscription = async (user: any, tier: 'standard' | 'premium' = 'standard') => {
    console.log('handleManualSubscription called for user:', user.id, 'tier:', tier);
    if (!user.id) {
      toast.error('بيانات المستخدم غير مكتملة');
      return;
    }
    
    let amount = 0;
    if (user.role === 'buyer') {
      amount = tier === 'premium' ? (rates.buyerPremiumSub || 5000) : (rates.buyerSub || 3000);
    } else {
      amount = tier === 'premium' ? (rates.supplierPremiumSub || 7000) : (rates.supplierSub || 5000);
    }

    const tierLabel = tier === 'standard' ? 'Standard' : 'Premium';
    const confirmMsg = `هل تريد تفعيل اشتراك 6 أشهر يدوياً لـ ${user.name} بنظام ${user.role === 'supplier' ? 'المورد' : 'المطعم'} (${tierLabel})؟ سيتم تسجيل مبلغ ${amount} ج.م في السجلات.`;
    if (!window.confirm(confirmMsg)) return;
    
    const loadingToast = toast.loading('جاري تفعيل الاشتراك...');
    try {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      
      console.log('Step 1: Logging payment...');
      const paymentRef = doc(collection(db, 'subscription_payments'));
      await setDoc(paymentRef, {
        userId: user.id,
        userRole: user.role || 'unknown',
        userName: user.name || 'Anonymous',
        businessName: user.businessName || '',
        amount: amount,
        tier: tier,
        durationMonths: 6,
        paymentDate: serverTimestamp(),
        expiryDate: expiryDate.toISOString()
      });
      
      console.log('Step 2: Updating user record...');
      await updateDoc(doc(db, 'users', user.id), {
        subscriptionStatus: 'active',
        subscriptionTier: tier,
        subscriptionStart: serverTimestamp(),
        subscriptionExpiry: expiryDate.toISOString(),
        isTrial: false,
        updatedAt: serverTimestamp()
      });
      
      console.log('Subscription activation successful');
      toast.dismiss(loadingToast);
      toast.success(`تم تفعيل اشتراك ${user.name} بنجاح حتى ${expiryDate.toLocaleDateString('ar-EG')}`);
    } catch (err) {
      console.error('Subscription Activation Error:', err);
      toast.dismiss(loadingToast);
      handleFirestoreError(err, OperationType.WRITE, `subscription_payments / users/${user.id}`, false);
    }
  };

  const handleApproveSubscriptionRequest = async (request: any) => {
    const loadingToast = toast.loading('جاري مراجعة وتفعيل الطلب...');
    try {
      const batch = writeBatch(db);
      
      // Calculate expiry (standardize to 1 year for approved requests if needed, or stick to current)
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      // 1. Update user tier
      const userRef = doc(db, 'users', request.userId);
      batch.update(userRef, {
        subscriptionTier: request.requestedTier,
        subscriptionStatus: 'active',
        subscriptionExpiry: expiryDate.toISOString(),
        updatedAt: serverTimestamp()
      });

      // 2. Update request status
      const requestRef = doc(db, 'subscription_requests', request.id);
      batch.update(requestRef, {
        status: 'approved',
        updatedAt: serverTimestamp()
      });

      // 3. Log payment record
      let amount = 0;
      if (request.userRole === 'buyer') {
        amount = request.requestedTier === 'premium' ? (rates.buyerPremiumSub || 5000) : (rates.buyerSub || 3000);
      } else {
        amount = request.requestedTier === 'premium' ? (rates.supplierPremiumSub || 7000) : (rates.supplierSub || 5000);
      }

      const paymentRef = doc(collection(db, 'subscription_payments'));
      batch.set(paymentRef, {
        userId: request.userId,
        userRole: request.userRole,
        userName: request.userName,
        amount: amount,
        tier: request.requestedTier,
        durationMonths: 12,
        paymentDate: serverTimestamp(),
        expiryDate: expiryDate.toISOString(),
        requestId: request.id
      });

      // 4. Send notification
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: request.userId,
        title: 'تم تفعيل اشتراكك بنجاح',
        message: `تم الموافقة على طلب ترقية حسابك إلى باقة ${request.requestedTier === 'premium' ? 'Premium' : 'Standard'} بنجاح.`,
        type: 'subscription',
        read: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      toast.dismiss(loadingToast);
      toast.success('تمت الموافقة وتفعيل الاشتراك بنجاح');
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error('Error approving subscription:', err);
      handleFirestoreError(err, OperationType.WRITE, 'subscription_requests', false);
    }
  };

  const handleRejectSubscriptionRequest = async (request: any) => {
    const reason = window.prompt('يرجى ذكر سبب الرفض (اختياري):');
    if (reason === null) return;

    const loadingToast = toast.loading('جاري رفض الطلب...');
    try {
      await updateDoc(doc(db, 'subscription_requests', request.id), {
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: serverTimestamp()
      });

      // Send notification
      await addDoc(collection(db, 'notifications'), {
        userId: request.userId,
        title: 'تم رفض طلب الاشتراك',
        message: `نعتذر، تم رفض طلب الترقية الخاص بك. ${reason ? `السبب: ${reason}` : ''}`,
        type: 'subscription',
        read: false,
        createdAt: serverTimestamp()
      });

      toast.dismiss(loadingToast);
      toast.success('تم رفض الطلب بنجاح');
    } catch (err) {
      toast.dismiss(loadingToast);
      handleFirestoreError(err, OperationType.WRITE, 'subscription_requests', false);
    }
  };
  const handleActivateTrial = async (user: any) => {
    console.log('handleActivateTrial called for user:', user.id);
    if (!user.id) {
      toast.error('بيانات المستخدم غير مكتملة');
      return;
    }

    const daysStr = window.prompt(`أدخل عدد أيام الفترة التجريبية لـ ${user.name}:`, String(rates.trialDays || 7));
    if (daysStr === null) return;
    
    const days = parseInt(daysStr);
    if (isNaN(days) || days <= 0) {
      toast.error('يرجى إدخال عدد أيام صحيح');
      return;
    }

    const loadingToast = toast.loading('جاري تفعيل الفترة التجريبية...');
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      
      console.log(`Step 1: Setting trial for ${days} days...`);
      await updateDoc(doc(db, 'users', user.id), {
        subscriptionStatus: 'active',
        subscriptionTier: 'premium', // Trial is now premium by default
        subscriptionStart: serverTimestamp(),
        subscriptionExpiry: expiryDate.toISOString(),
        isTrial: true,
        updatedAt: serverTimestamp()
      });
      
      console.log('Trial activation successful');
      toast.dismiss(loadingToast);
      toast.success(`تم تفعيل الفترة التجريبية المميزة (Premium) لـ ${user.name} بنجاح`);
    } catch (err) {
      console.error('Trial Activation Error:', err);
      toast.dismiss(loadingToast);
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`, false);
    }
  };

  const handleTierChange = async (user: any, newTier: 'standard' | 'premium') => {
    const loadingToast = toast.loading('جاري تغيير الباقة...');
    try {
      await updateDoc(doc(db, 'users', user.id), {
        subscriptionTier: newTier,
        updatedAt: serverTimestamp()
      });
      toast.dismiss(loadingToast);
      toast.success(`تم تحويل ${user.name} إلى باقة ${newTier === 'premium' ? 'Premium' : 'Standard'}`);
    } catch (err) {
      toast.dismiss(loadingToast);
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`, false);
    }
  };

  const handleDeactivateSubscription = async (user: any) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في إلغاء تفعيل اشتراك ${user.name}؟`)) return;
    
    const loadingToast = toast.loading('جاري إلغاء التفعيل...');
    try {
      await updateDoc(doc(db, 'users', user.id), {
        subscriptionStatus: 'not_subscribed',
        subscriptionTier: null,
        subscriptionExpiry: null,
        isTrial: false,
        updatedAt: serverTimestamp()
      });
      
      toast.dismiss(loadingToast);
      toast.success(`تم إلغاء تفعيل اشتراك ${user.name} بنجاح`);
    } catch (err) {
      console.error('Deactivate Error:', err);
      toast.dismiss(loadingToast);
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`, false);
    }
  };

  const handleExportCSV = (type: 'users' | 'requests') => {
    let dataToExport: any[] = [];
    let headers: string[] = [];
    
    if (type === 'users') {
      headers = ['الاسم', 'البريد', 'الهاتف', 'النشاط_التجاري', 'الدور', 'الحالة', 'تاريخ_الاشتراك'];
      dataToExport = users.map(u => [
        `"${u.name || ''}"`,
        `"${u.email || ''}"`,
        `"${u.phone || u.whatsappPhone || ''}"`,
        `"${u.businessName || ''}"`,
        `"${u.role === 'supplier' ? 'مورد' : 'مشتري'}"`,
        `"${u.status || ''}"`,
        `"${u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : ''}"`
      ]);
    } else if (type === 'requests') {
      headers = ['رقم_الطلب', 'المنتج', 'الكمية', 'المشتري', 'المورد', 'السعر', 'الحالة', 'التاريخ'];
      dataToExport = requests.map(r => [
        `"${r.id}"`,
        `"${r.productName || ''}"`,
        `"${r.quantity || ''} ${r.unit || ''}"`,
        `"${r.buyerName || ''}"`,
        `"${r.supplierName || ''}"`,
        `"${r.totalAmount || r.price || 0}"`,
        `"${r.status || ''}"`,
        `"${r.createdAt ? new Date(r.createdAt?.toDate?.() || r.createdAt).toLocaleDateString('ar-EG') : ''}"`
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...dataToExport.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SupplyX_${type}_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
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
    <div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden" dir="rtl">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Shared logic for Mobile/Desktop */}
      <aside className={cn(
        "fixed right-0 top-0 h-full w-72 bg-slate-900 border-l border-slate-800/50 z-[70] transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform shadow-2xl lg:shadow-none",
        "lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex flex-col h-full bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.05),transparent)]">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-32">
            <div className="flex items-center justify-between gap-3 mb-10">
              <Link to="/admin/dashboard" className="flex items-center gap-3 group">
                <div className="bg-primary-500/20 p-2.5 rounded-xl group-hover:bg-primary-500/30 transition-all duration-300">
                  <ShieldCheck className="w-6 h-6 text-primary-500" />
                </div>
                <div>
                   <span className="font-black text-xl text-white block leading-tight">إكس كونترول</span>
                   <span className="text-[10px] text-primary-500 font-bold uppercase tracking-wider">لوحة الإدارة</span>
                </div>
              </Link>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="lg:hidden p-2 text-slate-500 hover:text-white transition-colors bg-slate-800/50 rounded-lg"
              >
                 <XCircle className="w-5 h-5" />
              </button>
            </div>

            <nav className="space-y-1">
              <NavItem icon={<LayoutDashboard className="w-5 h-5" />} label="نظرة عامة" active={activeTab === 'overview'} onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }} 
                badge={alerts.length > 0 ? alerts.length : undefined} badgeColor="bg-amber-500" />
              <NavItem icon={<Zap className="w-5 h-5" />} label="غرفة العمليات" active={activeTab === 'control_room'} onClick={() => { setActiveTab('control_room'); setIsSidebarOpen(false); }} 
                badge={requests.filter(r => r.status === 'active' && !r.supplierId).length > 0 ? requests.filter(r => r.status === 'active' && !r.supplierId).length : undefined} 
                badgeColor="bg-emerald-500" />
              <NavItem icon={<Activity className="w-5 h-5" />} label="مراقبة النظام" active={activeTab === 'monitoring'} onClick={() => { setActiveTab('monitoring'); setIsSidebarOpen(false); }} />
              <NavItem icon={<Layers className="w-5 h-5" />} label="ترتيب العرض" active={activeTab === 'ordering'} onClick={() => { setActiveTab('ordering'); setIsSidebarOpen(false); }} />
              <NavItem icon={<BarChart3 className="w-5 h-5" />} label="التحليلات التفصيلية" active={activeTab === 'analytics'} onClick={() => { setActiveTab('analytics'); setIsSidebarOpen(false); }} />
              <NavItem icon={<Users className="w-5 h-5" />} label="المستخدمين" active={activeTab === 'users'} onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }} 
                badge={users.filter(u => u.status === 'pending').length > 0 ? users.filter(u => u.status === 'pending').length : undefined} 
                badgeColor="bg-primary-500" />
              <NavItem icon={<ShoppingBag className="w-5 h-5" />} label="العروض" active={activeTab === 'offers'} onClick={() => { setActiveTab('offers'); setIsSidebarOpen(false); }} />
              <NavItem icon={<ArrowRightLeft className="w-5 h-5" />} label="الطلبات" active={activeTab === 'requests'} onClick={() => { setActiveTab('requests'); setIsSidebarOpen(false); }} />
              <NavItem icon={<Tag className="w-5 h-5" />} label="الخدمات والأصناف" active={activeTab === 'categories'} onClick={() => { setActiveTab('categories'); setIsSidebarOpen(false); }} />
              <NavItem icon={<ShieldCheck className="w-5 h-5" />} label="الاشتراكات" active={activeTab === 'subscriptions'} onClick={() => { setActiveTab('subscriptions'); setIsSidebarOpen(false); }} 
                badge={subscriptionRequests.filter(r => r.status === 'pending').length > 0 ? subscriptionRequests.filter(r => r.status === 'pending').length : undefined} 
                badgeColor="bg-amber-500" />
              <NavItem icon={<Mail className="w-5 h-5" />} label="بث إشعارات" active={activeTab === 'broadcast'} onClick={() => { setActiveTab('broadcast'); setIsSidebarOpen(false); }} />
              <NavItem icon={<DollarSign className="w-5 h-5" />} label="المالية والأرباح" active={activeTab === 'finances'} onClick={() => { setActiveTab('finances'); setIsSidebarOpen(false); }} />
              <NavItem icon={<AlertCircle className="w-5 h-5" />} label="الإعدادات" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} />
            </nav>
          </div>

          <div className="absolute bottom-0 w-full p-6 border-t border-slate-800 bg-slate-900">
            <button 
              onClick={() => auth.signOut().then(() => navigate('/'))}
              className="flex items-center gap-3 text-slate-400 hover:text-red-500 transition-colors w-full"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pr-64 min-h-screen">
        {/* Top Header */}
        <header className="h-20 bg-slate-950/60 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-[50] px-6 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2.5 text-slate-400 bg-slate-900 border border-slate-800 rounded-xl hover:text-white transition-all shadow-sm"
            >
              <LayoutDashboard size={20} />
            </button>
            <div className="flex flex-col">
               <h2 className="font-black text-white text-lg md:text-xl tracking-tight">
                 {activeTab === 'overview' ? 'لوحة القيادة' : 
                  activeTab === 'ordering' ? 'ترتيب الموردين والعروض' :
                  activeTab === 'users' ? 'إدارة المستخدمين' :
                  activeTab === 'offers' ? 'التحكم في العروض' :
                  activeTab === 'requests' ? 'متابعة الطلبات' :
                  activeTab === 'categories' ? 'إدارة الأصناف والخدمات' :
                  activeTab === 'subscriptions' ? 'إدارة الاشتراكات' :
                  activeTab === 'broadcast' ? 'بث رسائل للنظام' :
                  activeTab === 'finances' ? 'الأداء المالي' : 
                  activeTab === 'control_room' ? 'غرفة العمليات' : 'الإعدادات العامة'}
               </h2>
               <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <Clock size={12} className="text-primary-500" />
                  <span>{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="بحث عام..."
                className="bg-slate-900 border border-slate-800 text-sm text-white rounded-xl pr-10 pl-4 py-2 outline-none focus:border-primary-500 transition-colors w-64"
              />
            </div>
          </div>
        </header>

        {/* Dashboard Pages */}
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-[calc(100vh-80px)]">
            <AnimatePresence mode="wait">
            {activeTab === 'ordering' && (
              <motion.div 
                key="ordering" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Suppliers Ordering */}
                  <div className="bg-slate-900/50 rounded-[2rem] p-8 shadow-sm border border-slate-800">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-black text-white border-r-4 border-primary-500 pr-3">الموردين المميزين</h3>
                      <p className="text-xs text-slate-400 font-bold">تحديد ترتيب ظهور الموردين في الصفحة الرئيسية</p>
                    </div>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      {users.filter(u => u.role === 'supplier' && u.isTrusted).sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99)).map(s => (
                        <div key={s.id} className="flex items-center justify-between bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 group">
                          <div className="flex items-center gap-4">
                            <img src={s.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.businessName || 'S')}&background=22C55E&color=fff`} className="w-10 h-10 rounded-xl object-cover" />
                            <div>
                              <p className="font-bold text-white">{s.businessName}</p>
                              <p className="text-[10px] text-slate-500">{s.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">الترتيب</label>
                              <input 
                                type="number" 
                                defaultValue={s.sortOrder || 0}
                                onBlur={async (e) => {
                                  const val = parseInt(e.target.value);
                                  await updateDoc(doc(db, 'users', s.id), { sortOrder: val, updatedAt: serverTimestamp() });
                                  toast.success('تم التحديث');
                                }}
                                className="w-16 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-center font-black focus:ring-2 focus:ring-primary-500 outline-none"
                              />
                            </div>
                            <button 
                              onClick={async () => {
                                await updateDoc(doc(db, 'users', s.id), { isTrusted: false, updatedAt: serverTimestamp() });
                                toast.success('تمت الإزالة من المميزين');
                              }}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {users.filter(u => u.role === 'supplier' && u.isTrusted).length === 0 && (
                        <p className="text-center py-10 text-slate-500 font-bold italic">لا يوجد موردين مُميزين حالياً</p>
                      )}
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-800">
                       <h4 className="text-sm font-bold text-slate-400 mb-4">إضافة مورد لقائمة المُميزين</h4>
                       <div className="grid grid-cols-2 gap-3">
                         {users.filter(u => u.role === 'supplier' && !u.isTrusted).slice(0, 8).map(s => (
                           <button 
                            key={s.id}
                            onClick={async () => {
                              await updateDoc(doc(db, 'users', s.id), { isTrusted: true, sortOrder: 99, updatedAt: serverTimestamp() });
                              toast.success('تمت الإضافة');
                            }}
                            className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between hover:border-primary-500 transition-all text-right"
                           >
                              <span className="font-bold text-xs text-white truncate max-w-[100px]">{s.businessName}</span>
                              <Plus size={14} className="text-primary-500" />
                           </button>
                         ))}
                       </div>
                    </div>
                  </div>

                  {/* Offers Ordering */}
                  <div className="bg-slate-900/50 rounded-[2rem] p-8 shadow-sm border border-slate-800">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-black text-white border-r-4 border-amber-500 pr-3">العروض المٌميزة</h3>
                      <p className="text-xs text-slate-400 font-bold">تحديد ترتيب ظهور العروض في قسم الـ Premium</p>
                    </div>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      {offers.sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99)).map(offer => (
                        <div key={offer.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden">
                              <img src={offer.image} className="w-full h-full object-cover" />
                            </div>
                            <div className="max-w-[150px]">
                              <p className="font-bold text-white text-sm truncate">{offer.title}</p>
                              <p className="text-[10px] text-slate-500 font-bold">{offer.supplierName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">الترتيب</label>
                              <input 
                                type="number" 
                                defaultValue={offer.sortOrder || 0}
                                onBlur={async (e) => {
                                  const val = parseInt(e.target.value);
                                  await updateDoc(doc(db, 'offers', offer.id), { sortOrder: val, updatedAt: serverTimestamp() });
                                  toast.success('تم تحديث الترتيب');
                                }}
                                className="w-16 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-center font-black focus:ring-2 focus:ring-primary-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      {offers.length === 0 && (
                        <p className="text-center py-10 text-slate-500 font-bold italic">لا توجد عروض نشطة حالياً</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'control_room' && (
              <motion.div 
                key="control_room" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="space-y-8"
              >
                 <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
                    <div className="flex items-center gap-4">
                       <div className="bg-emerald-500/10 p-3 rounded-2xl">
                          <Zap className="w-8 h-8 text-emerald-500 animate-pulse" />
                       </div>
                       <div>
                          <h2 className="text-2xl font-black text-white">غرفة العمليات الجارية</h2>
                          <p className="text-sm text-slate-400">متابعة فورية لنشاط المنصة والطلبات المباشرة</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          مباشر الآن
                       </span>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Active new requests waiting for bids */}
                    <div className="group bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[650px] shadow-sm hover:shadow-md transition-all">
                       <div className="flex items-center justify-between mb-6">
                          <h3 className="font-black text-white text-lg">طلبات جديدة</h3>
                          <span className="bg-primary-500 text-white px-3 py-1 rounded-lg text-xs font-black shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                             {requests.filter(r => r.status === 'active' && !r.supplierId).length}
                          </span>
                       </div>
                       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                          {requests.filter(r => r.status === 'active' && !r.supplierId).map(req => (
                            <motion.div 
                              whileHover={{ scale: 1.02 }}
                              key={req.id} 
                              onClick={() => setSelectedRequestId(req.id)} 
                              className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 hover:border-primary-500/50 cursor-pointer transition-all group/item"
                            >
                               <div className="flex justify-between items-start mb-3">
                                 <span className="font-bold text-white group-hover/item:text-primary-400 transition-colors">{req.productName}</span>
                                 <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] font-black text-slate-400 bg-slate-900/50 px-2.5 py-1 rounded-lg border border-slate-700">{req.requestType === 'bulk' ? 'جملة' : 'عادي'}</span>
                                    {req.bidsCount > 0 && <span className="text-[9px] font-bold text-emerald-500">+{req.bidsCount} عروض</span>}
                                 </div>
                               </div>
                               <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                                  <Store size={14} className="text-slate-600" />
                                  <span>{req.buyerName || 'مشتري غير محدد'}</span>
                               </div>
                               <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                                 <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                    <Clock size={12} />
                                    {req.createdAt ? (
                                      <span className={cn(
                                        "font-black",
                                        (nowTime - new Date(req.createdAt?.toDate?.() || req.createdAt).getTime()) > (6 * 60 * 60 * 1000) ? "text-rose-500" :
                                        (nowTime - new Date(req.createdAt?.toDate?.() || req.createdAt).getTime()) > (1 * 60 * 60 * 1000) ? "text-amber-500" :
                                        "text-emerald-500"
                                      )}>
                                        منذ {Math.floor((nowTime - new Date(req.createdAt?.toDate?.() || req.createdAt).getTime()) / (60 * 60 * 1000))} ساعة
                                      </span>
                                    ) : ''}
                                 </span>
                                 <span className="text-xs font-black text-primary-500 group-hover/item:translate-x-[-4px] transition-transform">التفاصيل ←</span>
                               </div>
                            </motion.div>
                          ))}
                          {requests.filter(r => r.status === 'active' && !r.supplierId).length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3 opacity-50">
                               <Package size={48} strokeWidth={1} />
                               <p className="italic text-sm font-medium">لا توجد طلبات جديدة حالياً</p>
                            </div>
                          )}
                       </div>
                    </div>

                    {/* In Progress */}
                    <div className="group bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[650px] shadow-sm hover:shadow-md transition-all">
                       <div className="flex items-center justify-between mb-6">
                          <h3 className="font-black text-white text-lg">قيد التحضير والتوصيل</h3>
                          <span className="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-black shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                             {requests.filter(r => ['accepted', 'preparing', 'shipped'].includes(r.status)).length}
                          </span>
                       </div>
                       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                          {requests.filter(r => ['accepted', 'preparing', 'shipped'].includes(r.status)).map(req => (
                            <motion.div 
                              whileHover={{ scale: 1.02 }}
                              key={req.id} 
                              onClick={() => setSelectedRequestId(req.id)} 
                              className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 hover:border-blue-500/50 cursor-pointer transition-all relative overflow-hidden group/item"
                            >
                               <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500"></div>
                               <div className="flex justify-between items-start mb-3">
                                 <span className="font-bold text-white group-hover/item:text-blue-400 transition-colors">{req.productName}</span>
                                 <span className="font-black text-emerald-500 text-sm whitespace-nowrap">{(req.price || req.totalAmount || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></span>
                               </div>
                               <div className="grid grid-cols-1 gap-2 mb-3">
                                 <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                    <Users size={12} />
                                    <span>المشتري: <span className="text-slate-200 font-medium">{req.buyerName}</span></span>
                                 </div>
                                 <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                    <Store size={12} />
                                    <span>المورد: <span className="text-purple-400 font-medium">{req.supplierName}</span></span>
                                 </div>
                               </div>
                               <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between">
                                  <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                    req.status === 'shipped' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 
                                    req.status === 'preparing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  }`}>
                                    {req.status === 'accepted' ? 'تم القبول' : req.status === 'preparing' ? 'جاري التحضير' : 'جاري التوصيل'}
                                  </div>
                                  <span className="text-[10px] text-slate-500">{req.updatedAt ? new Date(req.updatedAt?.toDate?.() || req.updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                               </div>
                            </motion.div>
                          ))}
                          {requests.filter(r => ['accepted', 'preparing', 'shipped'].includes(r.status)).length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3 opacity-50">
                               <ArrowRightLeft size={48} strokeWidth={1} />
                               <p className="italic text-sm font-medium">لا يوجد دفق عمليات حالياً</p>
                            </div>
                          )}
                       </div>
                    </div>

                    {/* Recently completed/cancelled */}
                    <div className="group bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[650px] shadow-sm hover:shadow-md transition-all">
                       <div className="flex items-center justify-between mb-6">
                          <h3 className="font-black text-white text-lg">سجل النشاطات الحديثة</h3>
                       </div>
                       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                          {[...requests].sort((a: any, b: any) => {
                            const dateA = a.updatedAt?.toMillis?.() || a.updatedAt || a.createdAt?.toMillis?.() || a.createdAt || 0;
                            const dateB = b.updatedAt?.toMillis?.() || b.updatedAt || b.createdAt?.toMillis?.() || b.createdAt || 0;
                            return new Date(dateB).getTime() - new Date(dateA).getTime();
                          }).slice(0,30).map(req => (
                            <div key={req.id} onClick={() => setSelectedRequestId(req.id)} className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30 hover:border-slate-500/50 cursor-pointer transition-all hover:bg-slate-800/50">
                               <div className="flex justify-between items-start mb-2">
                                 <span className="font-bold text-sm text-slate-200">{req.productName}</span>
                                 {req.status === 'delivered' ? (
                                   <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-black uppercase">مكتمل</span>
                                 ) : req.status === 'cancelled' || req.status === 'refunded' ? (
                                   <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-black uppercase">ملغي</span>
                                 ) : ['accepted', 'preparing', 'shipped'].includes(req.status) ? (
                                   <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-[10px] font-black uppercase">تنفيذ</span>
                                 ) : (
                                   <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-black uppercase">طلب</span>
                                 )}
                               </div>
                               <div className="flex items-center justify-between">
                                  <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                    {req.supplierName || req.buyerName}
                                  </div>
                                  <div className="text-[10px] font-medium text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                    {req.updatedAt ? new Date(req.updatedAt?.toDate?.() || req.updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 
                                     req.createdAt ? new Date(req.createdAt?.toDate?.() || req.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div 
                key="analytics" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="space-y-8"
              >
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                       <h3 className="font-bold text-slate-500 mb-3 text-sm flex items-center gap-2">
                          <TrendingUp size={16} /> مم إجمالي حجم التداولات (GMV)
                       </h3>
                       <p className="text-4xl font-black text-emerald-400 font-display">{(stats.totalRevenue).toLocaleString('en-US')} <span className="text-xs text-slate-500 font-bold">ج.م</span></p>
                    </div>
                    <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                       <h3 className="font-bold text-slate-500 mb-3 text-sm flex items-center gap-2">
                          <DollarSign size={16} /> إيرادات المنصة (العمولات)
                       </h3>
                       <p className="text-4xl font-black text-primary-400 font-display">{stats.platformProfit.toLocaleString('en-US')} <span className="text-xs text-slate-500 font-bold">ج.م</span></p>
                    </div>
                    <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                       <h3 className="font-bold text-slate-500 mb-3 text-sm flex items-center gap-2">
                          <ShieldCheck size={16} /> إيرادات الاشتراكات
                       </h3>
                       <p className="text-4xl font-black text-amber-400 font-display">{stats.subscriptionRevenue.toLocaleString('en-US')} <span className="text-xs text-slate-500 font-bold">ج.م</span></p>
                    </div>
                 </div>

                 <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
                    <div className="flex items-center justify-between mb-10">
                       <div>
                          <h3 className="font-black text-2xl text-white tracking-tight">المخطط المالي التحليلي</h3>
                          <p className="text-xs text-slate-500 mt-1">مقارنة بين إيرادات العمولات والاشتراكات</p>
                       </div>
                       <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full bg-primary-500" />
                             <span className="text-[10px] font-bold text-slate-400 uppercase">العمولات</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full bg-amber-500" />
                             <span className="text-[10px] font-bold text-slate-400 uppercase">الاشتراكات</span>
                          </div>
                       </div>
                    </div>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                             <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                             </linearGradient>
                             <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                            labelStyle={{ color: '#fff', marginBottom: '8px', fontWeight: '900' }}
                          />
                          <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorProfit)" name="عمولات الطلبات" />
                          <Area type="monotone" dataKey="subRevenue" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorSub)" name="الاشتراكات" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'monitoring' && (
              <motion.div key="monitoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnalyticsSystem />
              </motion.div>
            )}

            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-10"
              >
                {/* Priority Alerts Bar */}
                {alerts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {alerts.map(alert => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={alert.id}
                        className={cn(
                          "p-4 rounded-2xl border flex items-start gap-3 shadow-lg transition-all hover:scale-[1.02] cursor-pointer",
                          alert.type === 'error' ? "bg-red-500/10 border-red-500/30" : 
                          alert.type === 'warning' ? "bg-amber-500/10 border-amber-500/30" : 
                          "bg-blue-500/10 border-blue-500/30"
                        )}
                        onClick={() => setActiveTab(alert.actionTab)}
                      >
                        <div className={cn(
                          "p-2 rounded-xl mt-0.5",
                          alert.type === 'error' ? "bg-red-500/20 text-red-500" : 
                          alert.type === 'warning' ? "bg-amber-500/20 text-amber-500" : 
                          "bg-blue-500/20 text-blue-500"
                        )}>
                          <AlertCircle size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-xs text-white leading-relaxed line-clamp-2">{alert.message}</p>
                          <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-widest text-primary-400 group-hover:text-primary-300">
                            {alert.actionLabel} ←
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Stats Grid - Enhanced */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    label="إجمالي تداولات المنصة" 
                    value={`${(stats.totalRevenue + stats.subscriptionRevenue).toLocaleString()} ج.م`} 
                    icon={<TrendingUp className="w-6 h-6" />} 
                    trend="+12.5%" 
                    color="emerald" 
                  />
                  <StatCard 
                    label="صافي أرباح العمليات" 
                    value={`${stats.platformProfit.toLocaleString()} ج.م`} 
                    icon={<DollarSign className="w-6 h-6" />} 
                    trend="عمولات مباشرة" 
                    color="sky" 
                  />
                  <StatCard 
                    label="إيرادات الاشتراكات" 
                    value={`${stats.subscriptionRevenue.toLocaleString()} ج.م`} 
                    icon={<ShieldCheck className="w-6 h-6" />} 
                    trend="عضويات نشطة" 
                    color="purple" 
                  />
                  <StatCard 
                    label="طلبات قيد الانتظار" 
                    value={stats.newRequestsCount} 
                    icon={<Package className="w-6 h-6" />} 
                    trend="بانتظار مورد" 
                    color="amber" 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Revenue Chart - Main */}
                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600/[0.03] rounded-full -mr-48 -mt-48" />
                    
                    <div className="flex flex-col md:flex-row items-center justify-between mb-10 relative z-10 gap-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary-500/10 p-3 rounded-2xl">
                          <BarChart3 className="w-8 h-8 text-primary-500" />
                        </div>
                        <div>
                          <h3 className="font-black text-2xl text-white tracking-tight">تحليل التدفق النقدي</h3>
                          <p className="text-xs text-slate-500 mt-1">مؤشر نمو الأرباح والعوائد التشغيلية</p>
                        </div>
                      </div>
                      
                      <div className="flex bg-slate-800/40 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-inner">
                        {[
                          { id: 'day', label: 'يومي' },
                          { id: 'week', label: 'أسبوعي' },
                          { id: 'month', label: 'شهري' }
                        ].map((t) => (
                          <button 
                            key={t.id}
                            onClick={() => setReportType(t.id as any)} 
                            className={`px-6 py-2.5 text-[11px] font-black rounded-xl transition-all ${
                              reportType === t.id 
                              ? 'bg-primary-600 text-white shadow-lg' 
                              : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-[380px] relative z-10">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorProfitOverview" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                              <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.05}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#1e293b" />
                          <XAxis 
                            dataKey="name" 
                            stroke="#475569" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false} 
                            dy={15} 
                          />
                          <YAxis 
                            stroke="#475569" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(val) => `${val.toLocaleString()} ج`} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#0f172a', 
                              border: '1px solid #1e293b', 
                              borderRadius: '20px', 
                              padding: '16px',
                              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' 
                            }}
                            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                            labelStyle={{ color: '#64748b', marginBottom: '8px', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="profit" 
                            stroke="#3b82f6" 
                            strokeWidth={4} 
                            fillOpacity={1} 
                            fill="url(#colorProfitOverview)" 
                            animationDuration={2000}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Sidebar Stats */}
                  <div className="space-y-8">
                    {/* Activity Feed */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col h-[525px]">
                       <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <Activity className="w-5 h-5 text-primary-500" />
                            <h3 className="font-black text-xl text-white tracking-tight">النشاط المباشر</h3>
                          </div>
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                       </div>
                       
                       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                          {[...requests].sort((a: any, b: any) => {
                            const dateA = a.updatedAt?.toMillis?.() || a.updatedAt || a.createdAt?.toMillis?.() || a.createdAt || 0;
                            const dateB = b.updatedAt?.toMillis?.() || b.updatedAt || b.createdAt?.toMillis?.() || b.createdAt || 0;
                            return new Date(dateB).getTime() - new Date(dateA).getTime();
                          }).slice(0,30).map(req => (
                            <motion.div 
                              key={req.id} 
                              whileHover={{ scale: 1.02 }}
                              onClick={() => setSelectedRequestId(req.id)} 
                              className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800/50 hover:border-slate-600/50 cursor-pointer transition-all hover:bg-slate-800/60 group"
                            >
                               <div className="flex justify-between items-start mb-3">
                                 <span className="font-black text-sm text-white group-hover:text-primary-400 transition-colors truncate">{req.productName}</span>
                                 <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                   req.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                                   req.status === 'cancelled' ? 'bg-rose-500/10 text-rose-500' :
                                   'bg-blue-500/10 text-blue-500'
                                 }`}>
                                   {getStatusLabel(req.status)}
                                 </span>
                               </div>
                               <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                     <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                                        <Users className="w-3 h-3 text-slate-400" />
                                     </div>
                                     <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">
                                       {req.supplierName || req.buyerName || 'مستخدم مجهول'}
                                     </span>
                                  </div>
                                  <div className="text-[10px] font-black text-slate-600 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                                    {req.updatedAt ? new Date(req.updatedAt?.toDate?.() || req.updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 
                                     req.createdAt ? new Date(req.createdAt?.toDate?.() || req.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </div>
                               </div>
                            </motion.div>
                          ))}
                       </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity Mini Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="font-black text-lg text-white">أحدث المستخدمين</h3>
                        <p className="text-[10px] text-slate-500">آخر 4 أعضاء انضموا للمنصة</p>
                      </div>
                      <button onClick={() => setActiveTab('users')} className="text-[10px] font-black text-primary-400 hover:text-primary-300 uppercase tracking-widest bg-primary-500/10 px-4 py-2 rounded-xl border border-primary-500/10 transition-all">الكل ←</button>
                    </div>
                    <div className="space-y-4">
                      {[...users].sort((a: any, b: any) => {
                        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                        return dateB.getTime() - dateA.getTime();
                      }).slice(0, 4).map((user: any) => (
                        <div key={user.id} className="flex items-center justify-between p-4 bg-slate-800/20 rounded-2xl border border-slate-800/50 hover:border-slate-700 transition-all group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-slate-300 group-hover:bg-primary-500/10 group-hover:text-primary-500 transition-all">
                              {user.displayName?.[0] || user.email?.[0] || 'U'}
                            </div>
                            <div>
                              <p className="text-sm font-black text-white group-hover:text-primary-400 transition-all">{user.displayName || user.fullName || 'مستخدم جديد'}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                            user.role === 'supplier' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' : 
                            'bg-blue-500/10 text-blue-400 border-blue-500/10'
                          }`}>
                            {user.role === 'supplier' ? 'مورد' : 'مشتري'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                       <div>
                        <h3 className="font-black text-lg text-white">الطلبات الأخيرة</h3>
                        <p className="text-[10px] text-slate-500">آخر عمليات الشراء والتعاقدات</p>
                      </div>
                      <button onClick={() => setActiveTab('requests')} className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/10 transition-all">السجل ←</button>
                    </div>
                    <div className="space-y-4">
                      {[...requests].sort((a: any, b: any) => {
                        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                        return dateB.getTime() - dateA.getTime();
                      }).slice(0, 4).map((req: any) => (
                        <div key={req.id} className="flex items-center justify-between p-4 bg-slate-800/20 rounded-2xl border border-slate-800/50 hover:border-emerald-500/50 transition-all group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <ShoppingBag className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-white group-hover:text-emerald-400 transition-all">{req.productName}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{req.createdAt ? (req.createdAt.toDate ? req.createdAt.toDate() : new Date(req.createdAt)).toLocaleDateString('ar-EG') : '-'}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="font-black text-emerald-500 text-sm">{(req.price || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></span>
                             <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">مدفوع</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div 
                key="users" 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                className="space-y-8"
              >
                {/* Users Action Bar */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-indigo-500/10 p-3 rounded-2xl">
                         <Users className="w-8 h-8 text-indigo-500" />
                      </div>
                      <div>
                         <h2 className="text-2xl font-black text-white">إدارة قاعدة المستخدمين</h2>
                         <p className="text-sm text-slate-400">إدارة الصلاحيات، متابعة النشاط، والتحقق من الحسابات</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleExportCSV('users')}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-200 rounded-2xl font-bold hover:bg-slate-700 transition-all border border-slate-700"
                      >
                         <Download size={18} />
                         تصدير البيانات
                      </button>
                      <button 
                        onClick={() => setShowAddUserModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-2xl font-black hover:bg-primary-500 transition-all shadow-lg shadow-primary-500/20"
                      >
                         <Plus size={20} />
                         إضافة مستخدم جديد
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-6 border-t border-slate-800/50">
                    <div className="relative group">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-primary-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="ابحث بالاسم، البريد، أو الهاتف..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pr-11 pl-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                      />
                    </div>
                    <div className="flex gap-2 p-1 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                      <button onClick={() => setRoleFilter('all')} className={`flex-1 px-4 py-2 text-[10px] font-black rounded-xl transition-all ${roleFilter === 'all' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-slate-400 hover:text-slate-200'}`}>الكل</button>
                      <button onClick={() => setRoleFilter('supplier')} className={`flex-1 px-4 py-2 text-[10px] font-black rounded-xl transition-all ${roleFilter === 'supplier' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-slate-400 hover:text-slate-200'}`}>موردين</button>
                      <button onClick={() => setRoleFilter('buyer')} className={`flex-1 px-4 py-2 text-[10px] font-black rounded-xl transition-all ${roleFilter === 'buyer' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-slate-400 hover:text-slate-200'}`}>مشترين</button>
                    </div>
                    <select 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none text-slate-300 transition-all appearance-none cursor-pointer"
                    >
                      <option value="all">جميع الحالات</option>
                      <option value="active">نشط</option>
                      <option value="pending">بانتظار التوثيق</option>
                      <option value="suspended">موقوف</option>
                    </select>
                  </div>
                </div>

                {users.filter(u => u.status === 'pending').length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3"
                  >
                     <AlertCircle className="w-5 h-5 text-amber-500" />
                     <p className="text-sm font-bold text-amber-500">منبه: يوجد عدد ({users.filter(u => u.status === 'pending').length}) مستخدمين بانتظار مراجعة بياناتهم والموافقة عليها.</p>
                  </motion.div>
                )}

                {/* Users Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden relative">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-800/30 border-b border-slate-800">
                          <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">المستخدم والنشاط</th>
                          <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">الرتبة والدور</th>
                          <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">تاريخ الانضمام</th>
                          <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">حالة الحساب</th>
                          <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">إدارة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
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
                          <motion.tr 
                            key={user.id} 
                            onClick={() => setSelectedUserId(user.id)} 
                            className={`group border-l-4 border-transparent hover:bg-slate-800/40 transition-all cursor-pointer ${user.status === 'pending' ? 'bg-amber-500/5 hover:border-amber-500' : 'hover:border-primary-500'}`}
                          >
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-black text-lg text-slate-400 group-hover:text-primary-500 group-hover:scale-105 transition-all outline outline-0 group-hover:outline-4 outline-primary-500/10">
                                  {user.name?.[0] || 'U'}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                     <p className="text-sm font-black text-white">{user.name}</p>
                                     {user.isVerified && <ShieldCheck size={14} className="text-emerald-500" />}
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-medium mb-1">{user.email}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">{user.businessName || '---'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1.5">
                                 <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit border ${
                                   user.role === 'supplier' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                                   user.role === 'admin' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                                   'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                 }`}>
                                   {user.role === 'supplier' ? 'مورد معتمد' : user.role === 'admin' ? 'مدير نظام' : 'مشتري تاجـر'}
                                 </span>
                                 <span className="text-[10px] text-slate-500 font-bold pr-1">{user.tier || 'Free Tier'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-xs text-slate-500 font-medium">
                              <div className="flex items-center gap-1.5">
                                 <Calendar size={12} className="text-slate-600" />
                                 {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : '-'}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex flex-col gap-1.5">
                                 <div className="flex items-center gap-2">
                                   <div className={`w-2 h-2 rounded-full ${user.status === 'pending' ? 'bg-amber-500 animate-pulse' : user.status === 'rejected' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                                   <span className={`text-[10px] font-black ${user.status === 'pending' ? 'text-amber-500' : user.status === 'rejected' ? 'text-red-500' : 'text-emerald-500'}`}>
                                      {user.status === 'pending' ? 'معلق للمراجعة' : 
                                       user.status === 'rejected' ? 'مرفوض' : 
                                       user.status === 'suspended' ? 'موقوف' : 'نشط ومعتمد'}
                                   </span>
                                 </div>
                                 {!user.disabled && user.status === 'approved' && <span className="text-[9px] text-emerald-500/60 font-bold mr-4 italic">دخول متاح</span>}
                                 {user.disabled && <span className="text-[9px] text-red-500/60 font-bold mr-4 italic">دخول محظور</span>}
                               </div>
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex items-center gap-2">
                                  {user.status === 'pending' ? (
                                     <div className="flex gap-1.5">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'users', user.id), { status: 'approved', disabled: false, updatedAt: serverTimestamp() }) }} 
                                          className="p-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                                          title="موافقة"
                                        >
                                          <CheckCircle2 size={16} />
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'users', user.id), { status: 'rejected', disabled: true, updatedAt: serverTimestamp() }) }} 
                                          className="p-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                          title="رفض"
                                        >
                                          <X size={16} />
                                        </button>
                                     </div>
                                  ) : (
                                     <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'users', user.id), { disabled: !user.disabled, updatedAt: serverTimestamp() }) }} 
                                          className={`p-2 rounded-xl border transition-all ${user.disabled ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'}`}
                                          title={user.disabled ? "تفعيل" : "تعطيل"}
                                        >
                                          <Ban size={16} />
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleDeleteItem('users', user.id) }} 
                                          className="p-2 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl hover:bg-red-500 hover:border-red-500 hover:text-white transition-all"
                                          title="حذف"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                     </div>
                                  )}
                               </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'offers' && (
              <motion.div 
                key="offers" 
                initial={{ opacity: 0, scale: 0.98 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="space-y-8"
              >
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600/[0.03] rounded-full -mr-48 -mt-48" />
                   
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary-500/10 p-3 rounded-2xl">
                           <ShoppingBag className="w-8 h-8 text-primary-500" />
                        </div>
                        <div>
                           <h2 className="text-2xl font-black text-white tracking-tight">إدارة العروض الترويجية</h2>
                           <p className="text-slate-400 text-xs mt-1">متابعة وحذف العروض الحصرية المقدمة من الموردين</p>
                        </div>
                      </div>
                      
                      <div className="relative w-full max-w-md">
                         <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                         <input 
                           type="text" 
                           placeholder="بحث عن عرض ترويجي (اسم المنتج)..."
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pr-12 pl-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all placeholder:text-slate-600 shadow-inner"
                         />
                      </div>
                   </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
                   <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-right border-collapse">
                         <thead>
                           <tr className="bg-slate-800/40 border-b border-slate-800">
                             <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">العرض والمنتج</th>
                             <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">المورد</th>
                             <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">السعر والخصم</th>
                             <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">الفعالية</th>
                             <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">الإحصائيات</th>
                             <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">إجراءات</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-800/50">
                           {offers.filter(o => {
                             const s = searchQuery.toLowerCase();
                             return (o.title || '').toLowerCase().includes(s) || 
                                    (o.productName || '').toLowerCase().includes(s);
                           }).map((o: any) => (
                             <motion.tr 
                               layout
                               key={o.id} 
                               className="group hover:bg-slate-800/30 transition-all border-l-4 border-transparent hover:border-primary-500"
                             >
                                <td className="px-8 py-6">
                                  <div className="flex items-center gap-4">
                                     <div className="relative flex-shrink-0">
                                        <img 
                                          src={o.image} 
                                          alt="" 
                                          className="w-14 h-14 rounded-2xl object-cover bg-slate-800 border-2 border-slate-800 group-hover:border-primary-500/20 transition-all shadow-md" 
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute -top-1 -right-1 bg-primary-600 text-[8px] font-black text-white px-1.5 py-0.5 rounded-lg border border-slate-900 shadow-sm">HOT</div>
                                     </div>
                                     <div>
                                        <p className="font-black text-white text-sm group-hover:text-primary-400 transition-colors uppercase tracking-tight">{o.title}</p>
                                        <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase">ID: {o.id.slice(-6)}</p>
                                     </div>
                                  </div>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-black text-[10px] text-slate-400 border border-slate-700 group-hover:bg-primary-500/10 group-hover:text-primary-500 transition-all">
                                         {o.supplierName?.[0] || 'S'}
                                      </div>
                                      <span className="text-xs font-bold text-slate-300">{o.supplierName}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex flex-col">
                                      <div className="flex items-baseline gap-2">
                                         <span className="font-black text-emerald-500 text-lg leading-tight">{o.offerPrice} <span className="text-[10px]">ج</span></span>
                                         <span className="text-[11px] text-slate-600 font-bold line-through">{o.originalPrice} ج</span>
                                      </div>
                                      <span className="text-[9px] text-rose-500 font-black tracking-widest mt-0.5 uppercase">SAVE {o.discount}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                      نشط
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-6">
                                      <div className="text-right">
                                         <span className="block text-white font-black text-sm leading-none">{o.views || 0}</span>
                                         <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest mt-1 block">VIEW</span>
                                      </div>
                                      <div className="h-6 w-[1px] bg-slate-800" />
                                      <div className="text-right">
                                         <span className="block text-primary-500 font-black text-sm leading-none">{o.orders || 0}</span>
                                         <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest mt-1 block">ORDER</span>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex items-center justify-end">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteItem('offers', o.id); }} 
                                        className="p-3 bg-slate-800/50 text-slate-500 border border-slate-700/50 rounded-xl hover:bg-rose-500 hover:text-white hover:border-rose-400 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                        title="حذف العرض"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                   </div>
                                </td>
                             </motion.tr>
                           ))}
                         </tbody>
                      </table>
                      {offers.length === 0 && (
                         <div className="p-20 text-center flex flex-col items-center justify-center opacity-40">
                            <ShoppingBag size={64} strokeWidth={1} className="text-slate-600 mb-4" />
                            <p className="font-bold text-slate-500">لا توجد عروض ترويجية نشطة</p>
                         </div>
                      )}
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'requests' && (
              <motion.div 
                key="requests" 
                initial={{ opacity: 0, scale: 0.98 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="space-y-8"
              >
                {/* Requests Action Bar */}
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-8 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600/[0.03] rounded-full -mr-48 -mt-48" />
                   
                   <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative z-10">
                      <div className="flex items-center gap-5">
                        <div className="bg-primary-500/10 p-4 rounded-3xl">
                           <ShoppingBag className="w-10 h-10 text-primary-500" />
                        </div>
                        <div>
                           <h2 className="text-3xl font-black text-white tracking-tight">سجل العمليات والطلبات</h2>
                           <p className="text-slate-400 text-sm mt-1">إحصائيات حية لجميع طلبات السوق والمناقصات والعروض</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4">
                         <div className="relative flex-1 min-w-[280px]">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                              type="text" 
                              placeholder="بحث برقم الطلب، المنتج، أو اسم المستخدم..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pr-12 pl-5 py-4 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all placeholder:text-slate-600 shadow-inner"
                            />
                         </div>
                         <button 
                           onClick={() => handleExportCSV('requests')}
                           className="flex items-center gap-2 px-8 py-4 bg-slate-800 text-white rounded-2xl font-black hover:bg-slate-700 transition-all border border-slate-700 shadow-lg"
                         >
                            <Download size={18} />
                            تصدير السجل
                         </button>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-slate-800/50">
                      <div className="flex bg-slate-800/30 p-1.5 rounded-2xl border border-slate-800/50 backdrop-blur-sm">
                        {[
                          { id: 'fast', label: 'الطلبات المباشرة', color: 'emerald' },
                          { id: 'bulk', label: 'مناقصات الجملة', color: 'amber' },
                          { id: 'offer', label: 'عروض الموردين', color: 'purple' }
                        ].map((filter) => (
                          <button 
                            key={filter.id}
                            onClick={() => setRequestFilter(filter.id as any)} 
                            className={`flex-1 py-3 px-4 text-xs font-black rounded-xl transition-all ${
                              requestFilter === filter.id 
                              ? `bg-slate-700 text-white shadow-lg` 
                              : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'all', label: 'الكل' },
                          { id: 'new', label: 'جديد', count: requests.filter(r => r.status === 'active' && !r.supplierId).length },
                          { id: 'in_progress', label: 'قيد التنفيذ' },
                          { id: 'delivered', label: 'مكتمل' },
                          { id: 'cancelled', label: 'ملغي' }
                        ].map((status) => (
                          <button 
                            key={status.id}
                            onClick={() => setRequestsStatusFilter(status.id as any)} 
                            className={`px-5 py-3 text-[11px] font-black rounded-2xl transition-all border ${
                              requestsStatusFilter === status.id 
                              ? 'bg-primary-600 text-white border-primary-500 shadow-lg shadow-primary-500/20' 
                              : 'bg-slate-800/50 text-slate-500 border-slate-700 hover:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                               {status.label}
                               {status.count ? <span className="px-1.5 bg-white/20 rounded-lg text-[9px]">{status.count}</span> : null}
                            </div>
                          </button>
                        ))}
                      </div>
                   </div>
                </div>

                {/* Requests Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
                   <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-right border-collapse">
                         <thead>
                           <tr className="bg-slate-800/40 border-b border-slate-800">
                             <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">تفاصيل المحتوى</th>
                             <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">الأطراف المعنية</th>
                             <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">القيمة الإجمالية</th>
                             <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">توقيت العملية</th>
                             <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">مؤشر الحالة</th>
                             <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">خيارات</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-800/50">
                           {requests
                             .filter(r => {
                               const s = searchQuery.toLowerCase();
                               return (r.productName || '').toLowerCase().includes(s) ||
                                      (r.buyerName || '').toLowerCase().includes(s) ||
                                      (r.supplierName || '').toLowerCase().includes(s) ||
                                      (r.id || '').toLowerCase().includes(s);
                             })
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
                             <motion.tr 
                               key={r.id} 
                               layout
                               onClick={() => setSelectedRequestId(r.id)}
                               className="group hover:bg-slate-800/30 transition-all cursor-pointer border-l-4 border-transparent hover:border-primary-500"
                             >
                               <td className="px-8 py-6">
                                 <div>
                                   <div className="flex items-center gap-2 mb-1">
                                      {r.requestType === 'bulk' && <Package className="w-3.5 h-3.5 text-amber-500" />}
                                      <p className="font-black text-white text-sm group-hover:text-primary-400 transition-colors">{r.productName}</p>
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-black text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-tighter">ID: {r.id.slice(-6)}</span>
                                      {r.requestType === 'bulk' && r.items && (
                                        <span className="text-[9px] font-bold text-amber-500/80 italic">سلة تحتوي ({r.items.length}) منتجات</span>
                                      )}
                                   </div>
                                 </div>
                               </td>
                               <td className="px-8 py-6">
                                  <div className="space-y-1.5">
                                     <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <span className="text-xs font-bold text-slate-200">{r.buyerName || 'مشتري مجهول'}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${r.supplierId ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                        <span className={`text-[11px] font-medium ${r.supplierId ? 'text-slate-400' : 'text-slate-600 italic'}`}>{r.supplierName || 'بانتظار مورد'}</span>
                                     </div>
                                  </div>
                               </td>
                               <td className="px-8 py-6">
                                  <div className="flex flex-col">
                                     <span className="font-black text-primary-500 text-lg leading-tight">{(r.totalAmount || r.price || 0).toLocaleString()}</span>
                                     <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-none">جنية مصري</span>
                                  </div>
                               </td>
                               <td className="px-8 py-6">
                                  <div className="flex flex-col gap-1">
                                     <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                        <Calendar size={12} className="text-slate-600" />
                                        {r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)).toLocaleDateString('ar-EG') : '-'}
                                     </div>
                                     <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                                        <Clock size={10} />
                                        {r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                                     </div>
                                  </div>
                               </td>
                               <td className="px-8 py-6">
                                 <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm ${getStatusStyle(r.status)}`}>
                                   {getStatusLabel(r.status)}
                                 </span>
                               </td>
                               <td className="px-8 py-6">
                                 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setSelectedRequestId(r.id); }} 
                                      className="p-2.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl hover:bg-blue-500 hover:border-blue-500 hover:text-white transition-all"
                                      title="عرض التفاصيل"
                                    >
                                       <Eye size={16} />
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteItem('requests', r.id); }} 
                                      className="p-2.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl hover:bg-red-500 hover:border-red-500 hover:text-white transition-all shadow-lg"
                                      title="حذف السجل"
                                    >
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                               </td>
                             </motion.tr>
                           ))}
                         </tbody>
                      </table>
                      {requests.filter(r => {
                         if (requestFilter === 'bulk') return r.requestType === 'bulk';
                         if (requestFilter === 'offer') return !!r.offerId;
                         return r.requestType !== 'bulk' && !r.offerId;
                       }).length === 0 && (
                        <div className="p-24 text-center">
                           <div className="bg-slate-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                              <Archive className="w-10 h-10 text-slate-600" />
                           </div>
                           <h4 className="text-white font-black text-lg mb-1">لا توجد سجلات</h4>
                           <p className="text-slate-500 text-sm">لم يتم العثور على أي عمليات تتوافق مع معايير البحث الحالية</p>
                        </div>
                      )}
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'categories' && (
              <motion.div 
                key="categories" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="space-y-10"
              >
                <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 blur-[80px] -ml-32 -mt-32 rounded-full" />
                   <div className="relative flex items-center gap-6">
                      <div className="bg-amber-500/10 p-5 rounded-3xl border border-amber-500/20">
                         <Tag className="w-10 h-10 text-amber-500" />
                      </div>
                      <div>
                         <h2 className="text-3xl font-black text-white tracking-tight">هيكل التصنيفات والخدمات</h2>
                         <p className="text-slate-400 text-sm mt-1">توزيع المنتجات حسب التخصصات السوقية المعتمدة</p>
                         <div className="mt-4 flex items-center gap-3 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl w-fit">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">إدارة هيكلية (للقراءة فقط حالياً)</span>
                         </div>
                      </div>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {CATEGORIES.map((cat: any) => (
                    <motion.div 
                      key={cat.id} 
                      whileHover={{ y: -5 }}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-8 hover:border-primary-500/30 transition-all shadow-lg group relative overflow-hidden"
                    >
                      <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary-500/5 blur-3xl rounded-full -mb-16 -mr-16 group-hover:bg-primary-500/10 transition-colors" />
                      
                      <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                            {cat.icon}
                          </div>
                          <div>
                            <h3 className="font-black text-xl text-white group-hover:text-primary-400 transition-colors">{cat.name}</h3>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">REF: {cat.id}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 relative z-10">
                        <div className="flex items-center justify-between">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">قائمة المنتجات ({cat.products.length})</p>
                           <div className="w-10 h-[1px] bg-slate-800" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cat.products.map((p: string, i: number) => (
                            <span 
                              key={i} 
                              className="text-[10px] font-bold bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-500 px-3 py-1.5 rounded-xl transition-all cursor-default"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button className="mt-8 w-full py-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all hover:bg-primary-600 hover:text-white hover:border-primary-500">
                         طلب تعديل الأصناف
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'broadcast' && (
              <motion.div 
                key="broadcast" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="max-w-4xl mx-auto space-y-10"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/5 blur-[100px] -mr-40 -mt-40 rounded-full" />
                  
                  <div className="relative">
                    <div className="flex items-center justify-between mb-10 border-b border-slate-800 pb-8">
                      <div className="flex items-center gap-6">
                        <div className="p-5 bg-primary-500/10 rounded-3xl border border-primary-500/20">
                          <Mail className="w-10 h-10 text-primary-500" />
                        </div>
                        <div>
                          <h3 className="text-3xl font-black text-white tracking-tight">
                            {editingBroadcastId ? 'تعديل الإشعار الذكي' : 'مركز البث الإخباري'}
                          </h3>
                          <p className="text-slate-500 font-medium">أرسل رسالة فورية إلى جميع المستخدمين أو فئات مختارة</p>
                        </div>
                      </div>
                      {editingBroadcastId && (
                        <button 
                          onClick={() => {
                            setEditingBroadcastId(null);
                            setBroadcast({ title: '', message: '', target: 'all' });
                          }}
                          className="px-6 py-2.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-xl transition-all font-black text-xs uppercase tracking-widest"
                        >
                          إلغاء التعديل
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleBroadcast} className="space-y-10">
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-4 uppercase tracking-[0.2em]">الجمهور المستهدف</label>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { id: 'all', label: 'كافة المستخدمين', icon: <Users size={14}/> },
                            { id: 'buyer', label: 'المطاعم فقط', icon: <Store size={14}/> },
                            { id: 'supplier', label: 'الموردين فقط', icon: <ShoppingBag size={14}/> }
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setBroadcast({...broadcast, target: t.id as any})}
                              className={`flex items-center justify-center gap-3 py-4 rounded-2xl border font-black text-xs transition-all duration-300 ${
                                broadcast.target === t.id 
                                  ? 'bg-primary-600 border-primary-500 text-white shadow-xl shadow-primary-500/20 translate-y-[-2px]' 
                                  : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                              }`}
                            >
                              {t.icon}
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-8">
                        <div className="group/field">
                          <label className="block text-xs font-black text-slate-500 mb-3 uppercase tracking-[0.2em]">عنوان الإشعار</label>
                          <input 
                            type="text" 
                            required
                            value={broadcast.title}
                            onChange={(e) => setBroadcast({...broadcast, title: e.target.value})}
                            className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-2xl px-6 py-5 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500/50 outline-none transition-all placeholder:text-slate-700 font-bold text-lg"
                            placeholder="مثال: تحديثات هامة في عمولات الجمعة..."
                          />
                        </div>

                        <div className="group/field">
                          <label className="block text-xs font-black text-slate-500 mb-3 uppercase tracking-[0.2em]">المحتوى التفصيلي</label>
                          <textarea 
                            required
                            rows={5}
                            value={broadcast.message}
                            onChange={(e) => setBroadcast({...broadcast, message: e.target.value})}
                            className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-2xl px-6 py-5 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500/50 outline-none transition-all placeholder:text-slate-700 font-medium resize-none leading-relaxed"
                            placeholder="اكتب رسالتك بوضوح هنا، سيستلمها المستخدمون كإشعار فوري..."
                          ></textarea>
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isSendingBroadcast}
                        className="w-full py-6 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black rounded-3xl transition-all shadow-2xl shadow-primary-500/30 flex items-center justify-center gap-3 text-lg group active:scale-[0.98]"
                      >
                        {isSendingBroadcast 
                          ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 
                          : <>
                              <Zap className="group-hover:animate-pulse" />
                              {editingBroadcastId ? 'تحديث ونشر الإشعار' : 'إرسال البث الآن'}
                            </>
                        }
                      </button>
                    </form>
                  </div>
                </div>

                {/* Broadcast History */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                  <div className="p-8 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                    <div>
                       <h3 className="font-black text-xl text-white tracking-tight">سجل البث التاريخي</h3>
                       <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">تتبع كافة الرسائل الجماعية المرسلة مسبقاً</p>
                    </div>
                    <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                       <Activity size={18} className="text-primary-500" />
                    </div>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                     {broadcasts.length === 0 ? (
                        <div className="p-20 text-center text-slate-600 italic font-medium">لم يتم إرسال أي بث حتى الآن</div>
                     ) : (
                        broadcasts.map(b => (
                           <div key={b.id} className="p-8 hover:bg-slate-800/20 transition-all group">
                              <div className="flex justify-between items-start mb-4">
                                 <div className="flex items-center gap-3">
                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                       b.target === 'all' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                       b.target === 'supplier' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                       'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                       FOR: {b.target === 'all' ? 'EVERYONE' : b.target === 'supplier' ? 'SUPPLIERS' : 'RESTAURANTS'}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-bold flex items-center gap-1.5">
                                       <Clock size={12} />
                                       {b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)).toLocaleString('ar-EG') : ''}
                                    </span>
                                 </div>
                                 <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button 
                                      onClick={() => {
                                         setEditingBroadcastId(b.id);
                                         setBroadcast({ title: b.title, message: b.message, target: b.target });
                                         window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                      className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-colors"
                                    >
                                       <Edit size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteBroadcast(b.id)}
                                      className="p-2 bg-slate-800 text-slate-400 hover:text-rose-500 rounded-lg border border-slate-700 transition-colors"
                                    >
                                       <Trash2 size={14} />
                                    </button>
                                 </div>
                              </div>
                              <h4 className="font-black text-white text-lg group-hover:text-primary-400 transition-colors">{b.title}</h4>
                              <p className="text-slate-400 text-sm mt-2 leading-relaxed line-clamp-2 mt-3">{b.message}</p>
                           </div>
                        ))
                     )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'subscriptions' && (
              <motion.div 
                key="subscriptions" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="space-y-10"
              >
                {/* Header Stats for Subscriptions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                      <div className="flex items-center gap-4 relative z-10">
                         <div className="bg-primary-500/10 p-3 rounded-2xl">
                            <Zap className="w-6 h-6 text-primary-500" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">طلبات الترقية</p>
                            <h4 className="text-2xl font-black text-white">{subscriptionRequests.filter(r => r.status === 'pending').length}</h4>
                         </div>
                      </div>
                   </div>
                   <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                      <div className="flex items-center gap-4 relative z-10">
                         <div className="bg-emerald-500/10 p-3 rounded-2xl">
                            <ShieldCheck className="w-6 h-6 text-emerald-500" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">اشتراكات نشطة</p>
                            <h4 className="text-2xl font-black text-white">{users.filter(u => u.subscriptionStatus === 'active').length}</h4>
                         </div>
                      </div>
                   </div>
                   <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                      <div className="flex items-center gap-4 relative z-10">
                         <div className="bg-amber-500/10 p-3 rounded-2xl">
                            <Clock className="w-6 h-6 text-amber-500" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">الفترات التجريبية</p>
                            <h4 className="text-2xl font-black text-white">{users.filter(u => u.isTrial).length}</h4>
                         </div>
                      </div>
                   </div>
                </div>
                
                {/* Pending Subscription Requests */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                   <div className="p-8 border-b border-slate-800/60 bg-slate-800/40 backdrop-blur-md flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="bg-amber-500/10 p-3 rounded-2xl">
                          <Zap className="w-6 h-6 text-amber-500 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-black text-xl text-white tracking-tight">طلبات تعديل باقة الاشتراك</h3>
                          <p className="text-xs text-slate-500 mt-1">طلبات معلقة تتطلب مراجعة فورية</p>
                        </div>
                      </div>
                      <span className="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-amber-500/20 uppercase tracking-tighter">
                        {subscriptionRequests.filter(r => r.status === 'pending').length} معلقة
                      </span>
                   </div>
                   
                   <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                           <tr className="bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                              <th className="px-8 py-5 border-b border-slate-800/50">المستخدم</th>
                              <th className="px-8 py-5 border-b border-slate-800/50">الباقة الحالية</th>
                              <th className="px-8 py-5 border-b border-slate-800/50 text-amber-500">المستوى المطلوب</th>
                              <th className="px-8 py-5 border-b border-slate-800/50 text-center">التحكم</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                           {subscriptionRequests.filter(r => r.status === 'pending').length === 0 ? (
                             <tr>
                               <td colSpan={4} className="px-8 py-16 text-center">
                                  <div className="flex flex-col items-center justify-center text-slate-600">
                                    <ShieldCheck className="w-12 h-12 mb-4 opacity-10" />
                                    <p className="italic font-bold text-sm">لا يوجد طلبات معلقة حالياً</p>
                                  </div>
                               </td>
                             </tr>
                           ) : (
                             subscriptionRequests.filter(r => r.status === 'pending').map((req) => (
                               <tr key={req.id} className="hover:bg-slate-800/40 transition-colors group">
                                 <td className="px-8 py-5">
                                   <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-xs font-black text-white">
                                        {req.userName?.[0]}
                                      </div>
                                      <div>
                                         <p className="text-sm font-black text-white group-hover:text-primary-400 transition-colors">{req.userName}</p>
                                         <p className="text-[10px] text-slate-500 font-medium">{req.userEmail}</p>
                                      </div>
                                   </div>
                                 </td>
                                 <td className="px-8 py-5">
                                   <span className="px-3 py-1 rounded-lg bg-slate-800/50 text-slate-400 text-[10px] border border-slate-700/50 font-black uppercase">
                                      {req.currentTier === 'premium' ? 'Premium ✨' : 'Standard'}
                                   </span>
                                 </td>
                                 <td className="px-8 py-5">
                                   <span className={cn(
                                     "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                     req.requestedTier === 'premium' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-slate-700/50 text-slate-300 border border-slate-600/50"
                                   )}>
                                      {req.requestedTier === 'premium' ? 'Premium ✨' : 'Standard'}
                                   </span>
                                 </td>
                                 <td className="px-8 py-5">
                                   <div className="flex items-center justify-center gap-3">
                                     <button 
                                       onClick={() => handleApproveSubscriptionRequest(req)}
                                       className="p-2.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl border border-emerald-500/20 transition-all shadow-lg shadow-emerald-500/5 active:scale-95"
                                       title="موافقة"
                                     >
                                       <Check size={18} />
                                     </button>
                                     <button 
                                       onClick={() => handleRejectSubscriptionRequest(req)}
                                       className="p-2.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl border border-rose-500/20 transition-all shadow-lg shadow-rose-500/5 active:scale-95"
                                       title="رفض"
                                     >
                                       <X size={18} />
                                     </button>
                                   </div>
                                 </td>
                               </tr>
                             ))
                           )}
                        </tbody>
                      </table>
                   </div>
                </div>
                   
                {/* Subscriptions Settings/Rates */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Restaurants Pricing */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/[0.02] rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="bg-blue-500/10 p-3 rounded-2xl">
                           <ShieldCheck className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="font-black text-xl text-white tracking-tight">باقات المطاعم</h3>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">اشتراك نصف سنوي</p>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Standard (ج.م)</label>
                           <div className="flex gap-3">
                              <input 
                                type="number"
                                value={rates.buyerSub}
                                onChange={(e) => setRates({...rates, buyerSub: Number(e.target.value)})}
                                className="flex-1 bg-slate-800/50 border border-slate-700 rounded-2xl px-5 py-3 text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-black"
                              />
                              <button onClick={() => updateSubPrice('buyerSubPrice', rates.buyerSub)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 active:scale-95">حفظ</button>
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest pl-2 flex items-center gap-1">Premium ✨ (ج.م)</label>
                           <div className="flex gap-3">
                              <input 
                                type="number"
                                value={rates.buyerPremiumSub}
                                onChange={(e) => setRates({...rates, buyerPremiumSub: Number(e.target.value)})}
                                className="flex-1 bg-slate-800/50 border border-blue-500/20 rounded-2xl px-5 py-3 text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-black"
                              />
                              <button onClick={() => updateSubPrice('buyerPremiumSubPrice', rates.buyerPremiumSub)} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-blue-600/20 active:scale-95 text-center">حفظ</button>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Suppliers Pricing */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/[0.02] rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="bg-purple-500/10 p-3 rounded-2xl">
                           <ShieldCheck className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                          <h3 className="font-black text-xl text-white tracking-tight">باقات الموردين</h3>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">اشتراك نصف سنوي</p>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Standard (ج.م)</label>
                           <div className="flex gap-3">
                              <input 
                                type="number"
                                value={rates.supplierSub}
                                onChange={(e) => setRates({...rates, supplierSub: Number(e.target.value)})}
                                className="flex-1 bg-slate-800/50 border border-slate-700 rounded-2xl px-5 py-3 text-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 transition-all text-sm font-black"
                              />
                              <button onClick={() => updateSubPrice('supplierSubPrice', rates.supplierSub)} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-purple-600/20 active:scale-95">حفظ</button>
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest pl-2 flex items-center gap-1">Premium ✨ (ج.م)</label>
                           <div className="flex gap-3">
                              <input 
                                type="number"
                                value={rates.supplierPremiumSub}
                                onChange={(e) => setRates({...rates, supplierPremiumSub: Number(e.target.value)})}
                                className="flex-1 bg-slate-800/50 border border-purple-500/20 rounded-2xl px-5 py-3 text-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 transition-all text-sm font-black"
                              />
                              <button onClick={() => updateSubPrice('supplierPremiumSubPrice', rates.supplierPremiumSub)} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-purple-600/20 active:scale-95 text-center">حفظ</button>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trial Period */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.02] rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                           <Clock className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                          <h3 className="font-black text-xl text-white tracking-tight">الفترة التجريبية</h3>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">إعدادات الهدايا</p>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest pl-2">مدة الأيام التجريبية المسموحة</label>
                           <div className="flex gap-3">
                              <input 
                                type="number"
                                value={rates.trialDays}
                                onChange={(e) => setRates({...rates, trialDays: Number(e.target.value)})}
                                className="flex-1 bg-slate-800/50 border border-amber-500/30 rounded-2xl px-5 py-3 text-amber-400 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-black"
                              />
                              <button onClick={() => updateSubPrice('trialDays', rates.trialDays)} className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center">حفظ</button>
                           </div>
                           <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-2">يتم تقديم هذه المدة مجاناً كمحاولة لتجربة المنصة للمستخدمين الجدد.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                          {/* Manage User Subscriptions */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                   <div className="p-8 border-b border-slate-800/60 bg-slate-800/40 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="bg-primary-500/10 p-3 rounded-2xl">
                          <Users className="w-6 h-6 text-primary-500" />
                        </div>
                        <div>
                          <h3 className="font-black text-xl text-white tracking-tight">إدارة اشتراكات المستخدمين</h3>
                          <p className="text-xs text-slate-500 mt-1">التحكم اليدوي وتفعيل الباقات المباشرة</p>
                        </div>
                      </div>
                      
                      <div className="relative w-full md:w-96 group">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-primary-500 transition-colors" />
                        <input 
                           type="text" 
                           placeholder="بحث بالاسم أو البريد..." 
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           className="w-full bg-slate-800/40 border border-slate-700/50 rounded-2xl py-3 pr-12 pl-6 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/5 transition-all group-hover:border-slate-600/50"
                        />
                      </div>
                   </div>
                   
                   <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                           <tr className="bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                              <th className="px-8 py-5 border-b border-slate-800/50">المستخدم</th>
                              <th className="px-8 py-5 border-b border-slate-800/50">الدور</th>
                              <th className="px-8 py-5 border-b border-slate-800/50">باقة الاشتراك</th>
                              <th className="px-8 py-5 border-b border-slate-800/50">تاريخ الانتهاء</th>
                              <th className="px-8 py-5 border-b border-slate-800/50 text-center">التحكم المتقدم</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                           {users
                             .filter(u => 
                               ((u.name || '').toLowerCase().includes(searchQuery.toLowerCase())) || 
                               ((u.email || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
                               ((u.businessName || '').toLowerCase().includes(searchQuery.toLowerCase()))
                             )
                             .map((user: any) => (
                             <tr key={user.id} className="hover:bg-slate-800/40 transition-colors group">
                                <td className="px-8 py-5">
                                   <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-xs font-black text-white">
                                         {user.name?.[0]}
                                      </div>
                                      <div>
                                         <p className="text-sm font-black text-white group-hover:text-primary-400 transition-colors">{user.name}</p>
                                         <p className="text-[10px] text-slate-500 font-medium">{user.businessName}</p>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-8 py-5">
                                   <span className={`px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${
                                     user.role === 'supplier' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                   }`}>
                                      {user.role === 'supplier' ? 'مورد' : 'مشتري'}
                                   </span>
                                </td>
                                <td className="px-8 py-5">
                                   <div className="flex flex-col gap-2">
                                     <span className={`px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider inline-flex items-center w-fit gap-1.5 ${
                                       user.subscriptionStatus === 'active' ? (user.isTrial ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20') : 
                                       user.subscriptionStatus === 'expired' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-slate-800/50 text-slate-500 border-slate-700/50'
                                     }`}>
                                       {user.subscriptionStatus === 'active' && <div className={`w-1.5 h-1.5 rounded-full ${user.isTrial ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 opacity-80'}`} />}
                                       {user.subscriptionStatus === 'active' ? (user.isTrial ? 'فترة تجريبية' : 'نشط') : user.subscriptionStatus === 'expired' ? 'منتهي الصلاحية' : 'غير مشترك'}
                                     </span>
                                     {user.subscriptionStatus === 'active' && (
                                       <div className="flex gap-2">
                                         <button 
                                           onClick={() => handleTierChange(user, 'standard')}
                                           className={cn(
                                             "text-[9px] px-2.5 py-1 rounded-lg font-black uppercase transition-all border",
                                             user.subscriptionTier === 'standard' ? "bg-slate-700 text-white border-slate-600 shadow-lg shadow-slate-900/50" : "bg-transparent text-slate-500 border-slate-800/50 hover:text-slate-300 hover:border-slate-700"
                                           )}
                                         >
                                           Standard
                                         </button>
                                         <button 
                                           onClick={() => handleTierChange(user, 'premium')}
                                           className={cn(
                                             "text-[9px] px-2.5 py-1 rounded-lg font-black uppercase transition-all border",
                                             user.subscriptionTier === 'premium' ? "bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/20" : "bg-transparent text-slate-500 border-slate-800/50 hover:text-amber-500 hover:border-amber-500/30"
                                           )}
                                         >
                                           Premium ✨
                                         </button>
                                       </div>
                                     )}
                                   </div>
                                </td>
                                <td className="px-8 py-5">
                                   <div className="flex items-center gap-2 text-slate-400 font-bold text-xs bg-slate-800/20 w-fit px-3 py-1.5 rounded-xl border border-slate-800/50">
                                      <Calendar className="w-3.5 h-3.5 opacity-40" />
                                      {user.subscriptionExpiry ? new Date(user.subscriptionExpiry).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                   </div>
                                </td>
                                <td className="px-8 py-5">
                                   <div className="flex items-center justify-center gap-3">
                                     {user.subscriptionStatus !== 'active' ? (
                                       <div className="flex items-center gap-3">
                                          <div className="flex flex-col gap-1.5">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleManualSubscription(user, 'standard'); }}
                                              className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all active:scale-95 whitespace-nowrap"
                                            >
                                              تفعيل Standard
                                            </button>
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleManualSubscription(user, 'premium'); }}
                                              className="px-4 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all active:scale-95 whitespace-nowrap"
                                            >
                                              تفعيل Premium ✨
                                            </button>
                                          </div>
                                          <div className="w-px h-10 bg-slate-800 mx-1" />
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleActivateTrial(user); }}
                                            className="px-5 py-3 bg-slate-800 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black transition-all active:scale-95 shadow-xl"
                                          >
                                            بدء تجربة ✨
                                          </button>
                                       </div>
                                     ) : (
                                       <button 
                                         onClick={(e) => { e.stopPropagation(); handleDeactivateSubscription(user); }}
                                         className="px-6 py-3 bg-slate-800 border border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500/50 text-rose-500 rounded-2xl text-[10px] font-black transition-all active:scale-95 flex items-center gap-2 group/btn"
                                       >
                                         <Trash2 size={14} className="group-hover/btn:scale-110 transition-transform" />
                                         إلغاء التفعيل
                                       </button>
                                     )}
                                   </div>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                   </div>
                </div>

                {/* Payment History */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                   <div className="p-8 border-b border-slate-800/60 bg-slate-800/40 backdrop-blur-md flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/10 p-3 rounded-2xl">
                          <CreditCard className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                          <h3 className="font-black text-xl text-white tracking-tight">سجل مدفوعات الاشتراكات</h3>
                          <p className="text-xs text-slate-500 mt-1">تاريخ العمليات المالية للاشتراكات</p>
                        </div>
                      </div>
                   </div>
                   
                   <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                           <tr className="bg-slate-800/30 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                              <th className="px-8 py-5 border-b border-slate-800/50">المستفيد</th>
                              <th className="px-8 py-5 border-b border-slate-800/50 text-emerald-500">المبلغ</th>
                              <th className="px-8 py-5 border-b border-slate-800/50">المدة</th>
                              <th className="px-8 py-5 border-b border-slate-800/50">التاريخ</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                           {subPayments.length === 0 ? (
                             <tr>
                               <td colSpan={4} className="px-8 py-16 text-center text-slate-600 italic font-bold">لا توجد مدفوعات مسجلة</td>
                             </tr>
                           ) : (
                             subPayments.map((p: any) => (
                               <tr key={p.id} className="hover:bg-slate-800/40 transition-colors group">
                                 <td className="px-8 py-5">
                                   <div className="flex flex-col">
                                      <p className="text-sm font-black text-white group-hover:text-primary-400 transition-colors">{p.businessName || p.userName}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[10px] text-slate-500 font-medium">{p.userRole === 'supplier' ? 'مورد' : 'مشتري'}</p>
                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${
                                          p.tier === 'premium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-slate-800 text-slate-400 border-slate-700/50'
                                        }`}>
                                          {p.tier || 'standard'}
                                        </span>
                                      </div>
                                   </div>
                                 </td>
                                 <td className="px-8 py-5 group-hover:scale-105 transition-transform origin-right">
                                   <span className="text-emerald-400 font-black text-sm">{p.amount} ج.م</span>
                                 </td>
                                 <td className="px-8 py-5">
                                   <span className="text-[10px] font-black text-slate-400 bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-700/50">{p.durationMonths} أشهر</span>
                                 </td>
                                 <td className="px-8 py-5">
                                   <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold bg-slate-800/20 px-3 py-1.5 rounded-xl border border-slate-800/50 w-fit">
                                      <Clock size={12} className="opacity-40" />
                                      {p.paymentDate ? (p.paymentDate.toDate ? p.paymentDate.toDate() : new Date(p.paymentDate)).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                   </div>
                                 </td>
                               </tr>
                             ))
                           )}
                        </tbody>
                      </table>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'finances' && (
              <motion.div 
                key="finances" 
                initial={{ opacity: 0, scale: 0.98 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="space-y-10"
              >
                <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 p-8 border border-slate-800 rounded-3xl shadow-xl gap-6">
                   <div className="flex items-center gap-4">
                      <div className="bg-emerald-500/10 p-3 rounded-2xl">
                        <LineChart className="w-8 h-8 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="font-black text-2xl text-white tracking-tight">التقارير والاستقرار المالي</h3>
                        <p className="text-xs text-slate-500 mt-1">تتبع التدفقات النقدية وعمولات المنصة بدقة</p>
                      </div>
                   </div>
                   <div className="flex rounded-2xl bg-slate-800/50 p-1.5 border border-slate-700/50">
                      <button onClick={() => setFinanceTimeFilter('all')} className={`px-6 py-2 text-[10px] font-black rounded-xl transition-all ${financeTimeFilter === 'all' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-slate-500 hover:text-slate-300'}`}>الكل</button>
                      <button onClick={() => setFinanceTimeFilter('today')} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${financeTimeFilter === 'today' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-slate-500 hover:text-slate-300'}`}>اليوم</button>
                      <button onClick={() => setFinanceTimeFilter('week')} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${financeTimeFilter === 'week' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-slate-500 hover:text-slate-300'}`}>الأسبوع</button>
                      <button onClick={() => setFinanceTimeFilter('month')} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${financeTimeFilter === 'month' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-slate-500 hover:text-slate-300'}`}>الشهر</button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <FinanceCard label="إجمالي حجم التداول" value={stats.totalRevenue} color="emerald" icon={<BarChart3 />} />
                   <FinanceCard label="عمولات المنصة" value={stats.platformProfit} color="sky" icon={<Percent />} />
                   <FinanceCard label="مستحقات الموردين" value={stats.totalRevenue - stats.platformProfit} color="amber" icon={<Store />} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 lg:col-span-1 shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                     <h3 className="font-black text-white text-xl mb-8 flex items-center gap-2">
                        <TrendingUp size={20} className="text-primary-500" />
                        تفصيل الأرباح
                     </h3>
                     <div className="space-y-6">
                        <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800/50 hover:border-sky-500/30 transition-all">
                           <div className="flex items-center gap-3 mb-4">
                              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                                 <Zap size={14} className="text-sky-500" />
                              </div>
                              <p className="text-xs font-black text-white uppercase tracking-widest">الطلبات السريعة</p>
                           </div>
                           <div className="flex justify-between text-xs text-slate-400 mb-2"><span>العمليات:</span> <span className="font-black text-white">{reports.fast.count}</span></div>
                           <div className="flex justify-between text-xs text-slate-400 mb-2"><span>التداول:</span> <span className="font-black text-white">{reports.fast.revenue.toLocaleString()} ج.م</span></div>
                           <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">صافي الربح</span>
                              <span className="text-lg font-black text-sky-500">{(reports.fast.profit || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></span>
                           </div>
                        </div>

                        <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800/50 hover:border-amber-500/30 transition-all">
                           <div className="flex items-center gap-3 mb-4">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                 <Layers size={14} className="text-amber-500" />
                              </div>
                              <p className="text-xs font-black text-white uppercase tracking-widest">مناقصات الجملة</p>
                           </div>
                           <div className="flex justify-between text-xs text-slate-400 mb-2"><span>العمليات:</span> <span className="font-black text-white">{reports.bulk.count}</span></div>
                           <div className="flex justify-between text-xs text-slate-400 mb-2"><span>التداول:</span> <span className="font-black text-white">{reports.bulk.revenue.toLocaleString()} ج.م</span></div>
                           <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">صافي الربح</span>
                              <span className="text-lg font-black text-amber-500">{(reports.bulk.profit || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></span>
                           </div>
                        </div>

                        <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800/50 hover:border-indigo-500/30 transition-all">
                           <div className="flex items-center gap-3 mb-4">
                              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                 <Tag size={14} className="text-indigo-500" />
                              </div>
                              <p className="text-xs font-black text-white uppercase tracking-widest">عروض التجار</p>
                           </div>
                           <div className="flex justify-between text-xs text-slate-400 mb-2"><span>العمليات:</span> <span className="font-black text-white">{reports.offer.count}</span></div>
                           <div className="flex justify-between text-xs text-slate-400 mb-2"><span>التداول:</span> <span className="font-black text-white">{reports.offer.revenue.toLocaleString()} ج.م</span></div>
                           <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">صافي الربح</span>
                              <span className="text-lg font-black text-indigo-500">{(reports.offer.profit || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative flex flex-col">
                     <div className="flex items-center justify-between mb-8">
                        <div>
                           <h3 className="font-black text-xl text-white tracking-tight">النمو المالي والربحي</h3>
                           <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">تحليل بياني مجمع</p>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded bg-slate-700" />
                              <span className="text-[10px] font-black text-slate-500">حجم التداول</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded bg-primary-500 shadow-[0_0_10px_rgba(14,165,233,0.3)]" />
                              <span className="text-[10px] font-black text-slate-500">الأرباح</span>
                           </div>
                        </div>
                     </div>
                     <div className="flex-1 min-h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
                             <XAxis 
                                dataKey="name" 
                                stroke="#475569" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                                dy={10}
                             />
                             <YAxis 
                                stroke="#475569" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                                dx={-10}
                             />
                             <Tooltip 
                                cursor={{fill: '#1e293b', opacity: 0.4}}
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '12px' }}
                             />
                             <Bar dataKey="revenue" stackId="a" fill="#1e293b" radius={[0, 0, 0, 0]} />
                             <Bar dataKey="profit" stackId="a" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={40} />
                           </BarChart>
                        </ResponsiveContainer>
                     </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="max-w-4xl mx-auto space-y-10"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
                  
                  <div className="relative">
                    <div className="flex items-center gap-4 mb-10 border-b border-slate-800 pb-8">
                       <div className="bg-primary-500/10 p-4 rounded-2xl">
                          <Settings className="w-10 h-10 text-primary-500" />
                       </div>
                       <div>
                          <h3 className="font-black text-3xl text-white tracking-tight">غرفة التحكم والسياسات</h3>
                          <p className="text-slate-500 font-medium">تعديل نسب العمولات وقواعد احتساب أرباح الموردين</p>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-10">
                        <div className="group/field">
                          <div className="flex items-center gap-3 mb-3">
                             <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <Zap size={14} className="text-emerald-500" />
                             </div>
                             <label className="block text-sm font-black text-white uppercase tracking-wider">عمولة الطلبات السريعة</label>
                          </div>
                          <div className="relative">
                             <input 
                               type="number" 
                               value={rates.fast}
                               onChange={(e) => setRates(prev => ({ ...prev, fast: Number(e.target.value) }))}
                               className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-4 text-xl font-black text-emerald-400 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
                               placeholder="0"
                             />
                             <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-600">%</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">الطلبات الفورية (On-Demand) تقتطع من إجمالي الفاتورة المدفوعة من المطعم.</p>
                          <button 
                            onClick={() => updateCommission('fast', rates.fast)}
                            className="mt-4 w-full bg-slate-800 border border-slate-700 hover:bg-emerald-500 hover:border-emerald-400 text-white py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-lg group-hover/field:border-emerald-500/30"
                          >
                            تثبيت النسبة الجديدة
                          </button>
                        </div>

                        <div className="group/field pt-10 border-t border-slate-800/50">
                          <div className="flex items-center gap-3 mb-3">
                             <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Layers size={14} className="text-amber-500" />
                             </div>
                             <label className="block text-sm font-black text-white uppercase tracking-wider">عمولة مناقصات الجملة</label>
                          </div>
                          <div className="relative">
                             <input 
                               type="number" 
                               value={rates.bulk}
                               onChange={(e) => setRates(prev => ({ ...prev, bulk: Number(e.target.value) }))}
                               className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-4 text-xl font-black text-amber-500 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/50 transition-all placeholder:text-slate-700"
                               placeholder="0"
                             />
                             <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-600">%</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">الطلبات الضخمة (Bulk) تتميز بعمولات أقل لتشجيع التداول السعري العالي.</p>
                          <button 
                            onClick={() => updateCommission('bulk', rates.bulk)}
                            className="mt-4 w-full bg-slate-800 border border-slate-700 hover:bg-amber-500 hover:border-amber-400 text-white py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-lg group-hover/field:border-amber-500/30"
                          >
                            حفظ الإعدادات
                          </button>
                        </div>
                      </div>

                      <div className="space-y-10">
                        <div className="group/field">
                          <div className="flex items-center gap-3 mb-3">
                             <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Tag size={14} className="text-purple-500" />
                             </div>
                             <label className="block text-sm font-black text-white uppercase tracking-wider">عمولة عروض الموردين</label>
                          </div>
                          <div className="relative">
                             <input 
                               type="number" 
                               value={rates.offer}
                               onChange={(e) => setRates(prev => ({ ...prev, offer: Number(e.target.value) }))}
                               className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-4 text-xl font-black text-purple-400 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500/50 transition-all placeholder:text-slate-700"
                               placeholder="0"
                             />
                             <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-600">%</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">العروض الحصرية (Sales Offers) المرفوعة يدوياً من لوحة تحكم المورد.</p>
                          <button 
                            onClick={() => updateCommission('offer', rates.offer)}
                            className="mt-4 w-full bg-slate-800 border border-slate-700 hover:bg-purple-600 hover:border-purple-500 text-white py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-lg group-hover/field:border-purple-500/30"
                          >
                            تطبيق التحديث
                          </button>
                        </div>

                        <div className="bg-slate-800/30 border border-slate-800 rounded-3xl p-8 mt-6">
                           <div className="flex items-center gap-3 mb-4">
                              <ShieldCheck className="text-primary-500" size={20} />
                              <h4 className="text-sm font-black text-white">ملاحظات الأمان</h4>
                           </div>
                           <ul className="space-y-3 text-[10px] text-slate-400 font-medium">
                              <li className="flex items-start gap-2">
                                 <div className="w-1 h-1 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                                 تغيير العمولات يؤثر فوراً على جميع العمليات المالية "قيد الانتظار" والجديدة.
                              </li>
                              <li className="flex items-start gap-2">
                                 <div className="w-1 h-1 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                                 يتم تسجيل كل عملية تغيير في سجلات النظام (Log) باسم المدير الحالي.
                              </li>
                           </ul>
                        </div>
                      </div>
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
                      <label className="block text-sm font-bold text-slate-400 mb-1">كلمة المرور</label>
                      <input 
                        type="password" 
                        required
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-primary-500" 
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-1">نوع الحساب</label>
                      <select 
                        value={newUser.role}
                        onChange={e => setNewUser({...newUser, role: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-primary-500"
                      >
                        <option value="buyer">مشتري</option>
                        <option value="supplier">مورد</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-1">باقة الاشتراك</label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-center justify-center p-2 rounded-xl border cursor-pointer transition text-[10px] ${newUser.subscriptionTier === 'standard' ? 'bg-primary-500/10 border-primary-500 text-primary-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                          <input type="radio" name="tier" value="standard" className="hidden" checked={newUser.subscriptionTier === 'standard'} onChange={() => setNewUser({...newUser, subscriptionTier: 'standard'})} />
                          <span className="font-bold">Standard</span>
                        </label>
                        <label className={`flex items-center justify-center p-2 rounded-xl border cursor-pointer transition text-[10px] ${newUser.subscriptionTier === 'premium' ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                          <input type="radio" name="tier" value="premium" className="hidden" checked={newUser.subscriptionTier === 'premium'} onChange={() => setNewUser({...newUser, subscriptionTier: 'premium'})} />
                          <span className="font-bold">Premium</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl border border-slate-800">
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-white">تفعيل فترة تجريبية (Trial)</h4>
                        <p className="text-[10px] text-slate-500">سيتم تفعيل الحساب تلقائياً لفترة محدودة</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setNewUser({...newUser, isTrial: !newUser.isTrial})}
                        className={`w-12 h-6 rounded-full relative transition-colors ${newUser.isTrial ? 'bg-emerald-500' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${newUser.isTrial ? 'left-7' : 'left-1'}`} />
                      </button>
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
          {selectedUserId && (
            <UserDetailsModal
              user={users.find(u => u.id === selectedUserId)}
              requests={requests}
              onClose={() => setSelectedUserId(null)}
            />
          )}

          {selectedRequestId && (
            <RequestDetailsAdminModal
              request={requests.find(r => r.id === selectedRequestId)}
              onClose={() => setSelectedRequestId(null)}
            />
          )}

        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge, badgeColor }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
        active 
          ? 'bg-primary-600/10 text-primary-400 border border-primary-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
      }`}
    >
      {active && (
        <motion.div 
          layoutId="activeTab"
          className="absolute right-0 w-1 h-6 bg-primary-500 rounded-l-full"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <div className={`transition-colors duration-200 ${active ? 'text-primary-400' : 'group-hover:text-primary-400'}`}>
        {icon}
      </div>
      <span className="font-semibold text-sm">{label}</span>
      {badge !== undefined && (
        <span className={`mr-auto px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-white/10 ${badgeColor || 'bg-red-500'} text-white`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ label, value, icon, trend, color }: any) {
  const colorStyles: any = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/10',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/10',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/10',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/10',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/10',
  };

  const style = colorStyles[color] || colorStyles.emerald;
  const parts = style.split(' ');

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={`bg-slate-900/50 backdrop-blur-sm border ${parts[2]} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${parts.slice(0, 2).join(' ')}`}>
          {React.cloneElement(icon as React.ReactElement, { size: 20 } as any)}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${style}`}>
            {trend}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-slate-500 text-xs font-medium">{label}</p>
        <h4 className="text-xl font-bold text-white tracking-tight">{value}</h4>
      </div>
    </motion.div>
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

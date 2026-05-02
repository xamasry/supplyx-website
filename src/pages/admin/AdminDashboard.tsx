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
  Zap
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

type Tab = 'overview' | 'control_room' | 'analytics' | 'users' | 'offers' | 'requests' | 'finances' | 'subscriptions' | 'settings' | 'broadcast' | 'categories';

import UserDetailsModal from './UserDetailsModal';
import RequestDetailsAdminModal from './RequestDetailsAdminModal';

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
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
  }, [requests, users, reportType, rates, financeTimeFilter]);

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
            <NavItem icon={<Zap className="w-5 h-5" />} label="غرفة العمليات" active={activeTab === 'control_room'} onClick={() => setActiveTab('control_room')} badge={stats.newRequestsCount > 0 ? stats.newRequestsCount : undefined} badgeColor="bg-emerald-500" />
            <NavItem icon={<BarChart3 className="w-5 h-5" />} label="التحليلات التفصيلية" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
            <NavItem icon={<Users className="w-5 h-5" />} label="المستخدمين" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
            <NavItem icon={<ShoppingBag className="w-5 h-5" />} label="العروض" active={activeTab === 'offers'} onClick={() => setActiveTab('offers')} />
            <NavItem icon={<ArrowRightLeft className="w-5 h-5" />} label="الطلبات" active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
            <NavItem icon={<Tag className="w-5 h-5" />} label="الخدمات والأصناف" active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} />
            <NavItem icon={<ShieldCheck className="w-5 h-5" />} label="الاشتراكات" active={activeTab === 'subscriptions'} onClick={() => setActiveTab('subscriptions')} />
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
             activeTab === 'subscriptions' ? 'إدارة الاشتراكات' :
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
            {activeTab === 'control_room' && (
              <motion.div key="control_room" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                 <div className="flex items-center justify-between bg-slate-900 p-4 border border-slate-800 rounded-2xl">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                       <Zap className="w-6 h-6 text-emerald-500" />
                       غرفة العمليات الجارية (Real-time)
                    </h2>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Active new requests waiting for bids */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[600px]">
                       <h3 className="font-bold text-white mb-4 flex items-center justify-between">
                          <span>طلبات جديدة (انتظار عروض)</span>
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">{requests.filter(r => r.status === 'active' && !r.supplierId).length}</span>
                       </h3>
                       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                          {requests.filter(r => r.status === 'active' && !r.supplierId).map(req => (
                            <div key={req.id} onClick={() => setSelectedRequestId(req.id)} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:border-emerald-500/50 cursor-pointer transition-all">
                               <div className="flex justify-between items-start mb-2">
                                 <span className="font-bold text-sm text-white">{req.productName}</span>
                                 <span className="text-[10px] text-slate-400 bg-slate-800 px-2 rounded-full">{req.requestType === 'bulk' ? 'جملة' : 'عادي'}</span>
                               </div>
                               <p className="text-xs text-slate-400">{req.buyerName || 'مشتري غير محدد'}</p>
                               <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
                                 <span className="text-xs font-bold text-emerald-400 cursor-pointer hover:underline">عرض التفاصيل ←</span>
                               </div>
                            </div>
                          ))}
                          {requests.filter(r => r.status === 'active' && !r.supplierId).length === 0 && (
                            <div className="text-center py-10 text-slate-500 italic text-sm">لا توجد طلبات جديدة حالياً</div>
                          )}
                       </div>
                    </div>

                    {/* In Progress */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[600px]">
                       <h3 className="font-bold text-white mb-4 flex items-center justify-between">
                          <span>طلبات قيد التنفيذ</span>
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">{requests.filter(r => ['accepted', 'preparing', 'shipped'].includes(r.status)).length}</span>
                       </h3>
                       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                          {requests.filter(r => ['accepted', 'preparing', 'shipped'].includes(r.status)).map(req => (
                            <div key={req.id} onClick={() => setSelectedRequestId(req.id)} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:border-blue-500/50 cursor-pointer transition-all relative">
                               <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 rounded-r-xl"></div>
                               <div className="flex justify-between items-start mb-2 pl-2">
                                 <span className="font-bold text-sm text-white">{req.productName}</span>
                                 <span className="font-bold text-emerald-500 text-xs">{req.price || req.totalAmount} ج.م</span>
                               </div>
                               <div className="text-[10px] text-slate-400 space-y-1 mb-2">
                                 <p>المشتري: <span className="text-slate-300">{req.buyerName}</span></p>
                                 <p>المورد: <span className="text-purple-300">{req.supplierName}</span></p>
                                 <p>الحالة: <span className="text-blue-400">
                                   {req.status === 'accepted' ? 'تم القبول' : req.status === 'preparing' ? 'جاري التحضير' : 'جاري التوصيل'}
                                 </span></p>
                               </div>
                            </div>
                          ))}
                          {requests.filter(r => ['accepted', 'preparing', 'shipped'].includes(r.status)).length === 0 && (
                            <div className="text-center py-10 text-slate-500 italic text-sm">لا يوجد عمليات جارية حالياً</div>
                          )}
                       </div>
                    </div>

                    {/* Recently completed/cancelled */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[600px]">
                       <h3 className="font-bold text-white mb-4 flex items-center justify-between">
                          <span>أحدث النشاطات</span>
                       </h3>
                       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                          {[...requests].sort((a: any, b: any) => {
                            const dateA = a.updatedAt?.toDate?.() || a.updatedAt || a.createdAt?.toDate?.() || a.createdAt || 0;
                            const dateB = b.updatedAt?.toDate?.() || b.updatedAt || b.createdAt?.toDate?.() || b.createdAt || 0;
                            return new Date(dateB).getTime() - new Date(dateA).getTime();
                          }).slice(0,30).map(req => (
                            <div key={req.id} onClick={() => setSelectedRequestId(req.id)} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:border-slate-500/50 cursor-pointer transition-all">
                               <div className="flex justify-between items-start mb-2">
                                 <span className="font-bold text-sm text-white">{req.productName}</span>
                                 {req.status === 'delivered' ? (
                                   <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold">مكتمل</span>
                                 ) : req.status === 'cancelled' || req.status === 'refunded' ? (
                                   <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold">ملغي / مسترجع</span>
                                 ) : ['accepted', 'preparing', 'shipped'].includes(req.status) ? (
                                   <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-[10px] font-bold">قيد التنفيذ</span>
                                 ) : (
                                   <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold">طلب جديد</span>
                                 )}
                               </div>
                               <div className="text-[10px] text-slate-500">
                                 {req.updatedAt ? new Date(req.updatedAt?.toDate?.() || req.updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 
                                  req.createdAt ? new Date(req.createdAt?.toDate?.() || req.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''} - {req.supplierName || req.buyerName}
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                 <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex-1">
                       <h3 className="font-bold text-slate-400 mb-2">إجمالي حجم التداولات (GMV)</h3>
                       <p className="text-3xl font-black text-emerald-500">{stats.totalRevenue.toLocaleString('en-US')} <span className="text-sm">ج.م</span></p>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex-1">
                       <h3 className="font-bold text-slate-400 mb-2">إيرادات المنصة (العمولات)</h3>
                       <p className="text-3xl font-black text-primary-500">{stats.platformProfit.toLocaleString('en-US')} <span className="text-sm">ج.م</span></p>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex-1">
                       <h3 className="font-bold text-slate-400 mb-2">إيرادات الاشتراكات</h3>
                       <p className="text-3xl font-black text-amber-500">{stats.subscriptionRevenue.toLocaleString('en-US')} <span className="text-sm">ج.م</span></p>
                    </div>
                 </div>

                 <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                    <h3 className="font-bold text-white mb-6">المخطط المالي</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                             <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="profit" stroke="#2563eb" fillOpacity={1} fill="url(#colorProfit)" name="عمولات الطلبات" />
                          <Area type="monotone" dataKey="subRevenue" stroke="#f59e0b" fillOpacity={0.5} fill="#f59e0b" name="الاشتراكات" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
                  <StatCard label="إجمالي الإيرادات" value={`${(stats.totalRevenue + stats.subscriptionRevenue).toLocaleString()} ج.م`} icon={<TrendingUp />} trend="+12%" color="emerald" />
                  <StatCard label="أرباح العمليات" value={`${stats.platformProfit.toLocaleString()} ج.م`} icon={<DollarSign />} trend="عمولات البضائع" color="sky" />
                  <StatCard label="أرباح الاشتراكات" value={`${stats.subscriptionRevenue.toLocaleString()} ج.م`} icon={<ShieldCheck />} trend="عضوية 6 أشهر" color="purple" />
                  <StatCard label="طلبات جديدة" value={stats.newRequestsCount} icon={<Package />} trend="بانتظار مورد" color="blue" />
                  <StatCard label="الطلبات المكتملة" value={stats.deliveredOrders} icon={<CheckCircle2 />} trend="تم التنفيذ" color="emerald" />
                  <StatCard label="الطلبات الملغية" value={stats.cancelledOrders} icon={<XCircle />} trend="ألغيت" color="amber" />
                  <StatCard label="تفعيل مستخدمين" value={stats.pendingUsers} icon={<Users />} trend="مراجعة حسابات" color="amber" />
                  <StatCard label="المستخدمين" value={stats.suppliersCount + stats.buyersCount} icon={<Users />} trend="قاعدة البيانات" color="indigo" />
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
                    <div className="h-[180px] flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'مكتملة', value: stats.deliveredOrders },
                              { name: 'نشطة', value: stats.activeOrders },
                              { name: 'ملغاة', value: stats.cancelledOrders }
                            ]}
                            innerRadius={50}
                            outerRadius={70}
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
                    <div className="space-y-2 mt-4">
                      <LegendItem dot="bg-emerald-500" label="مكتملة" value={stats.deliveredOrders} />
                      <LegendItem dot="bg-sky-500" label="نشطة" value={stats.activeOrders} />
                      <LegendItem dot="bg-rose-500" label="ملغاة" value={stats.cancelledOrders} />
                    </div>
                  </div>

                  {/* User Growth Chart */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="font-bold text-white mb-8">نمو قاعدة المستخدمين</h3>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={userGrowthData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                            itemStyle={{ color: '#fff' }}
                          />
                          <Bar dataKey="users" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-500">إجمالي المستخدمين</span>
                      <span className="text-white font-bold">{users.length} مستخدم</span>
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
                <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 border border-slate-800 rounded-2xl">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text"
                      placeholder="بحث باسم المستخدم، البريد، أو الجوال..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-sm outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex rounded-lg bg-slate-800 p-1">
                      <button onClick={() => setRoleFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${roleFilter === 'all' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>الكل</button>
                      <button onClick={() => setRoleFilter('buyer')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${roleFilter === 'buyer' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>المشترين</button>
                      <button onClick={() => setRoleFilter('supplier')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${roleFilter === 'supplier' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>الموردين</button>
                    </div>

                    <div className="flex rounded-lg bg-slate-800 p-1">
                      <button onClick={() => setStatusFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'all' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>الكل</button>
                      <button onClick={() => setStatusFilter('pending')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'pending' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>انتظار</button>
                      <button onClick={() => setStatusFilter('approved')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'approved' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>مقبول</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleExportCSV('users')} className="bg-slate-800 hover:bg-slate-700 transition text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap">
                       <Download className="w-4 h-4" />
                       تصدير CSV
                    </button>
                    <button onClick={() => setShowAddUserModal(true)} className="bg-emerald-600 hover:bg-emerald-500 transition text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap">
                       <Users className="w-4 h-4" />
                       إضافة مستخدم
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
                        <tr key={user.id} onClick={() => setSelectedUserId(user.id)} className={`transition cursor-pointer ${user.status === 'pending' ? 'bg-amber-500/5' : 'hover:bg-slate-800/30'}`}>
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
                                    user.status === 'frozen' ? 'مجمد (مؤقتاً)' : 
                                    user.status === 'on_hold' ? 'معلق مؤقتاً' : 'موافق عليه'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-60">
                                <span className={`w-2 h-2 rounded-full ${user.disabled ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                <span className="text-[10px]">{user.disabled ? 'محظور / مجمد' : 'نشط'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                               {user.role === 'supplier' && (
                                 <button 
                                   onClick={(e) => { 
                                     e.stopPropagation(); 
                                     updateDoc(doc(db, 'users', user.id), { isVerified: !user.isVerified, updatedAt: serverTimestamp() });
                                     toast.success(user.isVerified ? 'تم إزالة التوثيق' : 'تم توثيق المورد بنجاح');
                                   }} 
                                   className={`p-2 rounded-lg transition-colors ${user.isVerified ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500 hover:text-emerald-500'}`}
                                   title={user.isVerified ? "إزالة من الموثوقين" : "إضافة للموثوقين"}
                                 >
                                   <ShieldCheck className="w-4 h-4" />
                                 </button>
                               )}
                               {user.status === 'pending' && (
                                  <>
                                     <button onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'users', user.id), { status: 'approved', disabled: false, updatedAt: serverTimestamp() }) }} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition">قبول</button>
                                     <button onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'users', user.id), { status: 'rejected', disabled: true, updatedAt: serverTimestamp() }) }} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition">رفض</button>
                                  </>
                               )}
                               {user.status !== 'pending' && (
                                  <button onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'users', user.id), { disabled: !user.disabled, updatedAt: serverTimestamp() }) }} className="p-2 bg-slate-800 rounded-lg group" title={user.disabled ? "إلغاء الحظر" : "حظر الحساب"}>
                                    <Ban className={`w-4 h-4 ${user.disabled ? 'text-emerald-500' : 'text-slate-500 group-hover:text-red-500'}`} />
                                  </button>
                               )}
                               <button onClick={(e) => { e.stopPropagation(); handleDeleteItem('users', user.id) }} className="p-2 bg-slate-800 rounded-lg hover:bg-red-500/10 group">
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
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="relative max-w-md">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text"
                      placeholder="بحث عن عرض ترويجي (اسم المنتج)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-10 pl-4 py-2 text-sm outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                </div>
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
                      {offers.filter(o => {
                        const s = searchQuery.toLowerCase();
                        return (o.title || '').toLowerCase().includes(s) || 
                               (o.supplierName || '').toLowerCase().includes(s) ||
                               (o.productName || '').toLowerCase().includes(s);
                      }).map((o: any) => (
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
                
                <div className="flex flex-col xl:flex-row gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleExportCSV('requests')} className="bg-slate-800 hover:bg-slate-700 transition text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap border border-slate-700">
                       <Download className="w-4 h-4" />
                       تصدير
                    </button>
                  </div>
                  <div className="relative w-full xl:w-80">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text"
                      placeholder="بحث عن المنتج أو المشتري..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-4 py-2 text-sm outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
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
                          .filter(r => {
                            const s = searchQuery.toLowerCase();
                            return (r.productName || '').toLowerCase().includes(s) ||
                                   (r.buyerName || '').toLowerCase().includes(s) ||
                                   (r.supplierName || '').toLowerCase().includes(s);
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
                            <td className="px-6 py-4 font-bold text-emerald-500 text-sm whitespace-nowrap">{(r.totalAmount || r.price || 0).toLocaleString()} ج.م</td>
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
                                  <button onClick={(e) => { e.stopPropagation(); setSelectedRequestId(r.id); }} className="p-2 bg-slate-800 rounded-lg hover:bg-blue-500/10 hover:text-blue-500 transition group" title="تفاصيل العملية">
                                     <Eye className="w-4 h-4 text-slate-500 group-hover:text-blue-500" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteItem('requests', r.id); }} className="p-2 bg-slate-800 rounded-lg hover:bg-red-500/10 group">
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
              <motion.div key="broadcast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary-500/10 rounded-2xl">
                        <Mail className="w-8 h-8 text-primary-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          {editingBroadcastId ? 'تعديل الإشعار' : 'بث إشعار عام للنظام'}
                        </h3>
                        <p className="text-slate-400 text-sm">أرسل رسالة فورية إلى جميع المستخدمين أو فئة معينة</p>
                      </div>
                    </div>
                    {editingBroadcastId && (
                      <button 
                        onClick={() => {
                          setEditingBroadcastId(null);
                          setBroadcast({ title: '', message: '', target: 'all' });
                        }}
                        className="text-slate-400 hover:text-white flex items-center gap-2"
                      >
                        <XCircle className="w-5 h-5" />
                        <span>إلغاء التعديل</span>
                      </button>
                    )}
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
                      {isSendingBroadcast ? 'جاري التنفيذ...' : editingBroadcastId ? 'تحديث الإشعار الآن' : 'إرسال الإشعار الآن'}
                    </button>
                  </form>
                </div>

                {/* Broadcast History */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-slate-800">
                    <h3 className="font-bold text-white">سجل الإشعارات المرسلة</h3>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {broadcasts.length > 0 ? (
                      broadcasts.map((b) => (
                        <div key={b.id} className="p-6 hover:bg-slate-800/30 transition group">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <h4 className="font-bold text-white">{b.title}</h4>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  b.target === 'all' ? 'bg-slate-700 text-slate-300' : 
                                  b.target === 'supplier' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
                                }`}>
                                  {b.target === 'all' ? 'الكل' : b.target === 'supplier' ? 'موردين' : 'مشترين'}
                                </span>
                              </div>
                              <p className="text-sm text-slate-400 line-clamp-2">{b.message}</p>
                              <p className="text-[10px] text-slate-500">
                                {b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)).toLocaleString('ar-EG') : '-'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                              <button 
                                onClick={() => {
                                  setBroadcast({ title: b.title, message: b.message, target: b.target });
                                  setEditingBroadcastId(b.id);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="p-2 bg-slate-800 rounded-lg hover:bg-primary-500/10 text-slate-400 hover:text-primary-500 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteBroadcast(b.id)}
                                className="p-2 bg-slate-800 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-slate-500 italic">لا يوجد سجل إشعارات بعد</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'subscriptions' && (
              <motion.div key="subscriptions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                {/* New: Pending Subscription Requests */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                   <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-amber-500/10">
                      <h3 className="font-bold text-amber-500 flex items-center gap-2 text-sm">
                        <Zap className="w-5 h-5 animate-pulse" />
                        طلبات تعديل الاشتراك المعلقة ({subscriptionRequests.filter(r => r.status === 'pending').length})
                      </h3>
                   </div>
                   
                   <div className="overflow-x-auto">
                     <table className="w-full text-right">
                       <thead className="bg-slate-800/50 text-slate-400 text-[10px] uppercase">
                          <tr>
                             <th className="px-6 py-4">المستخدم</th>
                             <th className="px-6 py-4">الباقة الحالية</th>
                             <th className="px-6 py-4 text-amber-500">مطلوب</th>
                             <th className="px-6 py-4 text-center">الإجراء</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-800 font-bold">
                          {subscriptionRequests.filter(r => r.status === 'pending').length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-6 py-10 text-center text-slate-600 italic text-sm">لا يوجد طلبات معلقة حالياً</td>
                            </tr>
                          ) : (
                            subscriptionRequests.filter(r => r.status === 'pending').map((req) => (
                              <tr key={req.id} className="hover:bg-slate-800/20 transition">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">{req.userName?.[0]}</div>
                                     <div>
                                        <p className="text-sm text-white">{req.userName}</p>
                                        <p className="text-[10px] text-slate-500">{req.userEmail}</p>
                                     </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs">
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                     {req.currentTier === 'premium' ? 'Premium' : 'Standard'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-1 rounded-lg text-[10px] font-black",
                                    req.requestedTier === 'premium' ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20" : "bg-slate-700 text-white"
                                  )}>
                                     {req.requestedTier === 'premium' ? 'Premium ✨' : 'Standard'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => handleApproveSubscriptionRequest(req)}
                                      className="p-1.5 bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-lg transition-all"
                                      title="موافقة"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleRejectSubscriptionRequest(req)}
                                      className="p-1.5 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                      title="رفض"
                                    >
                                      <XCircle size={16} />
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

                {/* Subscription Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                       <ShieldCheck className="w-5 h-5 text-blue-500" />
                       اشتراكات المطاعم (نص سنوي)
                    </h3>
                    <div className="space-y-4">
                      <div>
                         <label className="block text-xs text-slate-500 mb-1">Standard (ج.م)</label>
                         <div className="flex gap-2">
                            <input 
                              type="number"
                              value={rates.buyerSub}
                              onChange={(e) => setRates({...rates, buyerSub: Number(e.target.value)})}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500 transition"
                            />
                            <button onClick={() => updateSubPrice('buyerSubPrice', rates.buyerSub)} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm">حفظ</button>
                         </div>
                      </div>
                      <div>
                         <label className="block text-xs text-slate-500 mb-1 font-bold text-blue-400">Premium (ج.م)</label>
                         <div className="flex gap-2">
                            <input 
                              type="number"
                              value={rates.buyerPremiumSub}
                              onChange={(e) => setRates({...rates, buyerPremiumSub: Number(e.target.value)})}
                              className="flex-1 bg-slate-800 border border-blue-500/30 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500 transition"
                            />
                            <button onClick={() => updateSubPrice('buyerPremiumSubPrice', rates.buyerPremiumSub)} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20">حفظ</button>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                       <ShieldCheck className="w-5 h-5 text-purple-500" />
                       اشتراكات الموردين (نص سنوي)
                    </h3>
                    <div className="space-y-4">
                      <div>
                         <label className="block text-xs text-slate-500 mb-1">Standard (ج.م)</label>
                         <div className="flex gap-2">
                            <input 
                              type="number"
                              value={rates.supplierSub}
                              onChange={(e) => setRates({...rates, supplierSub: Number(e.target.value)})}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-purple-500 transition"
                            />
                            <button onClick={() => updateSubPrice('supplierSubPrice', rates.supplierSub)} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm">حفظ</button>
                         </div>
                      </div>
                      <div>
                         <label className="block text-xs text-slate-500 mb-1 font-bold text-purple-400">Premium (ج.م)</label>
                         <div className="flex gap-2">
                            <input 
                              type="number"
                              value={rates.supplierPremiumSub}
                              onChange={(e) => setRates({...rates, supplierPremiumSub: Number(e.target.value)})}
                              className="flex-1 bg-slate-800 border border-purple-500/30 rounded-xl px-4 py-2 text-white outline-none focus:border-purple-500 transition"
                            />
                            <button onClick={() => updateSubPrice('supplierPremiumSubPrice', rates.supplierPremiumSub)} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20">حفظ</button>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                       <Clock className="w-5 h-5 text-amber-500" />
                       الفترة التجريبية (Trial)
                    </h3>
                    <div className="space-y-4">
                      <div>
                         <label className="block text-xs text-slate-500 mb-1">عدد أيام التجربة</label>
                         <div className="flex gap-2">
                            <input 
                              type="number"
                              value={rates.trialDays}
                              onChange={(e) => setRates({...rates, trialDays: Number(e.target.value)})}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-amber-500 transition"
                            />
                            <button onClick={() => updateSubPrice('trialDays', rates.trialDays)} className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm">حفظ</button>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <p className="text-slate-500 text-xs mb-1">إجمالي إيرادات الاشتراكات</p>
                      <p className="text-2xl font-black text-white">{stats.subscriptionRevenue.toLocaleString()} ج.م</p>
                   </div>
                   <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <p className="text-slate-500 text-xs mb-1">عدد المشتركين الفعليين</p>
                      <p className="text-2xl font-black text-white">{users.filter(u => u.subscriptionStatus === 'active').length}</p>
                   </div>
                   <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-amber-500">
                      <p className="text-amber-500/60 text-xs mb-1">اشتراكات منتهية</p>
                      <p className="text-2xl font-black">{users.filter(u => u.subscriptionStatus === 'expired').length}</p>
                   </div>
                </div>

                {/* Subscribers List */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                     <h3 className="font-bold text-white">إدارة اشتراكات المستخدمين</h3>
                     <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="بحث باسم المستخدم..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none"
                        />
                     </div>
                  </div>
                  <table className="w-full text-right">
                    <thead className="bg-slate-800/50 text-slate-400 text-[10px] uppercase">
                       <tr>
                          <th className="px-6 py-4">المستخدم</th>
                          <th className="px-6 py-4">الدور</th>
                          <th className="px-6 py-4">حالة الاشتراك</th>
                          <th className="px-6 py-4">تاريخ الانتهاء</th>
                          <th className="px-6 py-4">التحكم</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                       {users
                         .filter(u => u.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                         .map((user: any) => (
                         <tr key={user.id} className="hover:bg-slate-800/30 transition">
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">{user.name?.[0]}</div>
                                  <div>
                                     <p className="text-sm font-bold text-white">{user.name}</p>
                                     <p className="text-[10px] text-slate-500">{user.businessName}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-xs">
                               <span className={`px-2 py-0.5 rounded ${user.role === 'supplier' ? 'text-purple-400 bg-purple-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
                                  {user.role === 'supplier' ? 'مورد' : 'مشتري'}
                               </span>
                            </td>
                            <td className="px-6 py-4">
                               <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                 user.subscriptionStatus === 'active' ? (user.isTrial ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500') : 
                                 user.subscriptionStatus === 'expired' ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-500'
                               }`}>
                                 {user.subscriptionStatus === 'active' ? (user.isTrial ? 'فترة تجريبية' : 'نشط') : user.subscriptionStatus === 'expired' ? 'منتهي' : 'غير مشترك'}
                               </span>
                               {user.subscriptionStatus === 'active' && (
                                 <div className="flex gap-1 mt-1">
                                   <button 
                                     onClick={() => handleTierChange(user, 'standard')}
                                     className={cn(
                                       "text-[8px] px-2 py-1 rounded font-bold uppercase transition border flex items-center gap-1",
                                       user.subscriptionTier === 'standard' ? "bg-slate-700 text-white border-slate-600 shadow-sm" : "bg-transparent text-slate-500 border-slate-800 hover:text-slate-300"
                                     )}
                                   >
                                     {user.subscriptionTier === 'standard' && <Check size={8} />} Std
                                   </button>
                                   <button 
                                     onClick={() => handleTierChange(user, 'premium')}
                                     className={cn(
                                       "text-[8px] px-2 py-1 rounded font-bold uppercase transition border flex items-center gap-1",
                                       user.subscriptionTier === 'premium' ? "bg-amber-500 text-white border-amber-400 shadow-sm shadow-amber-500/20" : "bg-transparent text-slate-500 border-slate-800 hover:text-amber-500"
                                     )}
                                   >
                                     {user.subscriptionTier === 'premium' && <Check size={8} />} Prem
                                   </button>
                                 </div>
                               )}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                               {user.subscriptionExpiry ? new Date(user.subscriptionExpiry).toLocaleDateString('ar-EG') : '-'}
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-2 relative">
                                 {user.subscriptionStatus !== 'active' ? (
                                   <>
                                     <div className="flex flex-col gap-1">
                                       <button 
                                         type="button"
                                         onClick={(e) => { e.stopPropagation(); handleManualSubscription(user, 'standard'); }}
                                         className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8px] font-bold transition whitespace-nowrap active:scale-95"
                                       >
                                         تفعيل Standard
                                       </button>
                                       <button 
                                         type="button"
                                         onClick={(e) => { e.stopPropagation(); handleManualSubscription(user, 'premium'); }}
                                         className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded text-[8px] font-bold transition whitespace-nowrap active:scale-95 shadow-sm shadow-amber-500/20"
                                       >
                                         تفعيل Premium
                                       </button>
                                     </div>
                                     <button 
                                       type="button"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleActivateTrial(user);
                                       }}
                                       className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] font-bold transition whitespace-nowrap active:scale-95"
                                     >
                                       تفعيل تجربة ✨
                                     </button>
                                   </>
                                 ) : (
                                   <button 
                                     type="button"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleDeactivateSubscription(user);
                                     }}
                                     className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-bold transition whitespace-nowrap active:scale-95 shadow-lg shadow-red-600/20 flex items-center gap-2"
                                   >
                                     <Trash2 size={12} /> إيقاف الاشتراك
                                   </button>
                                 )}
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
                </div>

                {/* Payment History */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mt-6">
                   <div className="p-4 border-b border-slate-800 bg-slate-800/20">
                      <h3 className="font-bold text-white">سجل مدفوعات الاشتراكات</h3>
                   </div>
                   <table className="w-full text-right">
                      <thead className="bg-slate-800/50 text-slate-400 text-[10px] uppercase">
                         <tr>
                            <th className="px-6 py-4">المستخدم</th>
                            <th className="px-6 py-4">المبلغ</th>
                            <th className="px-6 py-4">المدة</th>
                            <th className="px-6 py-4">التاريخ</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                         {subPayments.map((p: any) => (
                           <tr key={p.id} className="hover:bg-slate-800/30 transition">
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-white">{p.businessName || p.userName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[10px] text-slate-500">{p.userRole === 'supplier' ? 'مورد' : 'مشتري'}</p>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${p.tier === 'premium' ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-400'}`}>
                                    {p.tier || 'standard'}
                                  </span>
                                </div>
                             </td>
                              <td className="px-6 py-4 text-emerald-500 font-bold">{p.amount} ج.م</td>
                              <td className="px-6 py-4 text-xs text-slate-400">{p.durationMonths} أشهر</td>
                              <td className="px-6 py-4 text-[10px] text-slate-500 italic">
                                 {p.paymentDate ? (p.paymentDate.toDate ? p.paymentDate.toDate() : new Date(p.paymentDate)).toLocaleDateString('ar-EG') : '-'}
                              </td>
                           </tr>
                         ))}
                         {subPayments.length === 0 && (
                           <tr><td colSpan={4} className="p-12 text-center text-slate-500 italic">لا توجد مدفوعات مسجلة</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'finances' && (
              <motion.div key="finances" initial={{ opacity: 0 }} animate={{ opacity: 0.95 }} className="space-y-6">
                <div className="flex justify-between items-center bg-slate-900 p-4 border border-slate-800 rounded-2xl">
                   <h3 className="font-bold text-white">التقارير المالية</h3>
                   <div className="flex rounded-lg bg-slate-800 p-1">
                      <button onClick={() => setFinanceTimeFilter('all')} className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition ${financeTimeFilter === 'all' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>الكل</button>
                      <button onClick={() => setFinanceTimeFilter('today')} className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition ${financeTimeFilter === 'today' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>اليوم</button>
                      <button onClick={() => setFinanceTimeFilter('week')} className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition ${financeTimeFilter === 'week' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>الأسبوع</button>
                      <button onClick={() => setFinanceTimeFilter('month')} className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition ${financeTimeFilter === 'month' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>الشهر</button>
                   </div>
                </div>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">نوع الحساب</label>
                        <div className="grid grid-cols-2 gap-2">
                           <label className={`flex items-center justify-center p-2 rounded-xl border cursor-pointer transition text-[10px] ${newUser.role === 'buyer' ? 'bg-primary-500/10 border-primary-500 text-primary-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                             <input type="radio" name="role" value="buyer" className="hidden" checked={newUser.role === 'buyer'} onChange={() => setNewUser({...newUser, role: 'buyer'})} />
                             <span className="font-bold">مشتري</span>
                           </label>
                           <label className={`flex items-center justify-center p-2 rounded-xl border cursor-pointer transition text-[10px] ${newUser.role === 'supplier' ? 'bg-primary-500/10 border-primary-500 text-primary-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                             <input type="radio" name="role" value="supplier" className="hidden" checked={newUser.role === 'supplier'} onChange={() => setNewUser({...newUser, role: 'supplier'})} />
                             <span className="font-bold">مورد</span>
                           </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">الباقة</label>
                        <div className="grid grid-cols-2 gap-2">
                           <label className={`flex items-center justify-center p-2 rounded-xl border cursor-pointer transition text-[10px] ${newUser.subscriptionTier === 'standard' ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                             <input type="radio" name="tier" value="standard" className="hidden" checked={newUser.subscriptionTier === 'standard'} onChange={() => setNewUser({...newUser, subscriptionTier: 'standard'})} />
                             <span className="font-bold">Standard</span>
                           </label>
                           <label className={`flex items-center justify-center p-2 rounded-xl border cursor-pointer transition text-[10px] ${newUser.subscriptionTier === 'premium' ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                             <input type="radio" name="tier" value="premium" className="hidden" checked={newUser.subscriptionTier === 'premium'} onChange={() => setNewUser({...newUser, subscriptionTier: 'premium'})} />
                             <span className="font-bold">Premium</span>
                           </label>
                        </div>
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
        active ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <span className="w-5 h-5">{icon}</span>
      <span>{label}</span>
      {badge !== undefined && (
        <span className={`mr-auto px-2 py-0.5 rounded-full text-[10px] text-white ${badgeColor || 'bg-red-500'}`}>
          {badge}
        </span>
      )}
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
          {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' } as any)}
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

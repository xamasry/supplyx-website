import { Link } from 'react-router-dom';
import { Flame, Clock, MapPin, Search, Package, Navigation, Loader2, ChevronLeft, Star, CheckCircle2 } from 'lucide-react';
import { cn, calculateDistance, isRequestExpired } from '../../lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useGeolocation } from '../../hooks/useGeolocation';

import { motion, AnimatePresence } from 'motion/react';

export default function SupplierHome() {
  const [activeTab, setActiveTab] = useState<'new'|'bids'>('new');
  const [requests, setRequests] = useState<any[]>([]);
  const [myBids, setMyBids] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { location: supplierLocation, loading: geoLoading, error: geoError, getLocation } = useGeolocation();

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  useEffect(() => {
    let unsubRequests: (() => void) | null = null;
    let unsubOrders: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubRequests) unsubRequests();
      if (unsubOrders) unsubOrders();
      if (unsubProfile) unsubProfile();

      if (!user) {
        setRequests([]);
        setOrders([]);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // Fetch Profile
      unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) setUserProfile(snap.data());
      });

      // Query 1: Fetch active requests (to bid on)
      const qReq = query(collection(db, 'requests'), where('status', '==', 'active'), limit(50));
      unsubRequests = onSnapshot(qReq, async (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        // Enhance with hasBid info
        const dataWithBids = await Promise.all(data.map(async (req) => {
          const bidsRef = collection(db, `requests/${req.id}/bids`);
          const qB = query(bidsRef, where('supplierId', '==', user.uid));
          const bidSnap = await getDocs(qB);
          return { ...req, hasBid: !bidSnap.empty };
        }));

        dataWithBids.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        
        const enhancedData = dataWithBids.map(req => {
          if (supplierLocation && req.coordinates) {
            const distance = calculateDistance(supplierLocation.lat, supplierLocation.lng, req.coordinates.lat, req.coordinates.lng);
            return { ...req, distance };
          }
          return req;
        });

        const filteredData = supplierLocation 
          ? enhancedData.filter(req => !isRequestExpired(req) && (!req.coordinates || (req.distance && req.distance <= 10)))
          : enhancedData.filter(req => !isRequestExpired(req));

        setRequests(filteredData);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'requests');
      });

      // Query 2: Fetch supplier's own orders (accepted, preparing, etc.)
      const qOrders = query(collection(db, 'requests'), where('supplierId', '==', user.uid));
      unsubOrders = onSnapshot(qOrders, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        data.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        setOrders(data.filter(req => !isRequestExpired(req)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'requests_supplier_orders');
      });
    });

    return () => {
      unsubAuth();
      if (unsubRequests) unsubRequests();
      if (unsubOrders) unsubOrders();
      if (unsubProfile) unsubProfile();
    };
  }, [supplierLocation]);

  // Active orders for the supplier
  const activeOrders = orders.filter(r => ['accepted', 'preparing', 'shipped'].includes(r.status));

  // Stats aggregation
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayOrders = orders.filter(o => {
    const oDate = o.createdAt?.toDate?.() || new Date(o.createdAt);
    return oDate >= today && o.status !== 'cancelled';
  }).length;

  const startOfWeek = new Date();
  startOfWeek.setDate(today.getDate() - today.getDay());
  const weeklyProfit = orders.filter(o => {
    const oDate = o.createdAt?.toDate?.() || new Date(o.createdAt);
    return oDate >= startOfWeek && o.status === 'delivered';
  }).reduce((acc, curr) => acc + (curr.price || 0), 0);

  return (
    <div className="space-y-6 pb-24 font-sans max-w-lg mx-auto px-1">
      
      {/* Tier Badge */}
      {userProfile && (
        <div className="flex items-center justify-between px-2">
           <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${userProfile.subscriptionTier === 'premium' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-200 text-slate-500'}`}>
                {userProfile.subscriptionTier === 'premium' ? 'الباقة المميزة ✨' : 'الباقة العادية'}
              </div>
              {userProfile.isVerified && <div className="bg-blue-500 text-white p-1 rounded-lg"><CheckCircle2 className="w-3 h-3" /></div>}
           </div>
           {userProfile.subscriptionTier !== 'premium' && (
             <Link to="/supplier/settings?tab=subscription" className="text-xs font-bold text-amber-600 animate-pulse">ترقية الآن ↗️</Link>
           )}
        </div>
      )}

      {/* Premium Benefits Banner for Standard Users */}
      {userProfile?.subscriptionTier !== 'premium' && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 text-white shadow-lg shadow-amber-500/20">
           <div className="flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                 <Star className="w-5 h-5 text-white" fill="white" />
              </div>
              <div className="flex-1">
                 <h3 className="text-sm font-bold">ضاعف مبيعاتك مع الباقة المميزة!</h3>
                 <p className="text-[10px] opacity-90 mt-0.5 leading-relaxed">احصل على ظهور في النتائج الأولى، شارة التوثيق المميزة، والقدرة على إضافة عروض ترويجية.</p>
                 <Link to="/supplier/settings?tab=subscription" className="inline-block mt-3 bg-white text-amber-600 px-4 py-1.5 rounded-xl text-[10px] font-black shadow-sm">تعرف على المزايا</Link>
              </div>
           </div>
        </div>
      )}
      
      {/* Stats Board - Classic Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-600 text-white p-4 rounded-2xl text-center shadow-sm">
          <span className="block text-2xl font-black">{todayOrders}</span>
          <span className="block text-[10px] uppercase font-bold opacity-80 mt-1">طلبات اليوم</span>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center shadow-sm">
          <span className="block text-lg font-black text-slate-900">{weeklyProfit.toLocaleString()} <span className="text-[10px]">جم</span></span>
          <span className="block text-[9px] text-slate-400 font-bold mt-2 uppercase">أرباح الأسبوع</span>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 text-amber-500">
            <span className="text-lg font-black text-slate-900">4.8</span>
            <Star size={12} className="fill-current" />
          </div>
          <span className="block text-[9px] text-slate-400 font-bold mt-2 uppercase">تقييمي</span>
        </div>
      </div>

      {/* Location Status */}
      {!supplierLocation && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-orange-100 p-2 rounded-xl text-orange-600">
               <Navigation className="w-5 h-5" />
             </div>
             <div>
               <p className="text-sm font-bold text-slate-900">فعل الموقع لرؤية الطلبات القريبة</p>
               <p className="text-[10px] text-slate-500 font-bold">انت الان ترى جميع الطلبات في انحاء القليوبية</p>
             </div>
          </div>
          <button 
            onClick={getLocation} 
            disabled={geoLoading}
            className="text-xs bg-white px-4 py-2 rounded-xl border border-orange-200 font-black text-orange-600 shadow-sm disabled:opacity-50"
          >
            {geoLoading ? 'جاري...' : 'تفعيل'}
          </button>
        </div>
      )}

      {supplierLocation && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <p className="text-[10px] font-bold text-green-700">انت الان تشاهد الطلبات في نطاق 10 كم من موقعك الحالي</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button 
          onClick={() => setActiveTab('new')}
          className={cn(
            "flex-1 py-3 text-sm font-bold rounded-xl transition-all", 
            activeTab === 'new' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          )}
        >
          طلبات جديدة (محيطك)
        </button>
        <button 
          onClick={() => setActiveTab('bids')}
          className={cn(
            "flex-1 py-3 text-sm font-bold rounded-xl transition-all", 
            activeTab === 'bids' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          )}
        >
          عروضي الحالية
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'new' && (
          <div className="space-y-3">
            {requests.map((req) => (
              <div 
                key={req.id}
                className={cn("bg-white rounded-2xl shadow-sm border p-5 relative overflow-hidden", req.isUrgent ? "border-rose-200" : "border-slate-200")}
              >
                {req.isUrgent && (
                  <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">طارئ 🔥</div>
                )}
                
                <div className="mb-4">
                  <h3 className="font-bold text-xl text-slate-900">{req.productName}</h3>
                  <p className="text-sm font-bold text-slate-500 mt-1">الكمية: {req.quantity}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-500 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {req.buyerName}</div>
                  {req.distance !== undefined && (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <Navigation size={14} /> 
                      {req.distance < 1 ? 'أقل من 1 كم' : `${req.distance.toFixed(1)} كم`}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> {req.createdAt?.toDate?.() ? req.createdAt.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                  <span className="text-[10px] font-bold text-slate-400">{req.bidsCount || 0} عروض مقدمة</span>
                  <Link to={`/supplier/request/${req.id}`} className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-green-700 transition-all active:scale-95">
                    {req.hasBid ? 'تعديل عرضك' : 'قدّم عرضك'}
                  </Link>
                </div>
              </div>
            ))}
            {requests.length === 0 && !loading && (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <Package size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-500 font-bold">لا يوجد طلبات في محيطك حالياً</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bids' && (
          <div className="space-y-3">
            {activeOrders.map((req) => (
              <Link key={req.id} to={`/supplier/orders/${req.id}`} className="block bg-white rounded-2xl shadow-sm border border-slate-200 p-5 group">
                <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-slate-900 group-hover:text-green-600 transition-colors">{req.productName}</h3>
                    <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100">بانتظار العرض</span>
                </div>
                <p className="text-xs text-slate-500 font-bold mb-4">الكمية: {req.quantity} | السعر: {req.price} ج.م</p>
                <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                  <span className="text-[10px] text-slate-400 font-mono">#{req.id.slice(0,8)}</span>
                  <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">متابعة الآن <ChevronLeft size={12} /></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

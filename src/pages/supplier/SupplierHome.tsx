import { Link } from 'react-router-dom';
import { Flame, Clock, MapPin, Search, Package, Navigation, Loader2, ChevronLeft } from 'lucide-react';
import { cn, calculateDistance, isRequestExpired } from '../../lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useGeolocation } from '../../hooks/useGeolocation';

export default function SupplierHome() {
  const [activeTab, setActiveTab] = useState<'new'|'bids'>('new');
  const [requests, setRequests] = useState<any[]>([]);
  const [myBids, setMyBids] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { location: supplierLocation, loading: geoLoading, error: geoError, getLocation } = useGeolocation();

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  useEffect(() => {
    let unsubRequests: (() => void) | null = null;
    let unsubOrders: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubRequests) unsubRequests();
      if (unsubOrders) unsubOrders();

      if (!user) {
        setRequests([]);
        setOrders([]);
        setLoading(false);
        return;
      }

      // Query 1: Fetch active requests (to bid on)
      const qReq = query(collection(db, 'requests'), where('status', '==', 'active'));
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
    <div className="space-y-6 pb-6 font-sans">
      
      {/* Stats Board */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--color-primary)] text-white p-3 rounded-2xl text-center shadow-lg shadow-[var(--color-primary)]/20">
          <span className="block text-2xl font-bold">{todayOrders}</span>
          <span className="block text-[10px] opacity-80 mt-1">طلبات اليوم</span>
        </div>
        <div className="bg-white border border-slate-200 p-3 rounded-2xl text-center shadow-sm">
          <span className="block text-xl font-bold text-slate-900">{weeklyProfit.toLocaleString()}ج</span>
          <span className="block text-[10px] text-slate-500 font-semibold mt-1">أرباح الأسبوع</span>
        </div>
        <div className="bg-white border border-slate-200 p-3 rounded-2xl text-center shadow-sm">
          <span className="block text-xl font-bold text-slate-900">4.8⭐</span>
          <span className="block text-[10px] text-slate-500 font-semibold mt-1">تقييمي</span>
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
      <div className="flex bg-slate-200/60 p-1 rounded-xl">
        <button 
          onClick={() => setActiveTab('new')}
          className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'new' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
        >
          طلبات جديدة (محيطك)
        </button>
        <button 
          onClick={() => setActiveTab('bids')}
          className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'bids' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
        >
          عروضي الحالية
        </button>
      </div>

      {activeTab === 'new' && (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className={cn("bg-white rounded-2xl shadow-sm border p-4 relative overflow-hidden", req.isUrgent ? "border-[var(--color-danger)]/50" : "border-slate-200")}>
              {req.requestType === 'bulk' && !req.isUrgent && (
                <div className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1 border border-slate-700">
                  <Package className="w-3 h-3 text-slate-300" /> مناقصة جملة
                </div>
              )}
              {req.isUrgent && (
                <div className="absolute top-0 right-0 bg-[var(--color-danger)] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
                  <Flame className="w-3 h-3 animate-pulse" /> طارئ
                </div>
              )}
              
              <div className="mt-2 mb-3">
                <h3 className="font-display font-bold text-lg text-slate-900">{req.productName}</h3>
                <p className="text-sm font-semibold text-slate-600 font-sans">الكمية: {req.quantity}</p>
              </div>
              
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 mb-4 bg-slate-50 p-2 rounded-lg">
                <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {req.buyerName}</div>
                {req.distance !== undefined && (
                  <div className="flex items-center gap-1 text-[var(--color-primary)]">
                    <Navigation className="w-3.5 h-3.5" /> 
                    {req.distance < 1 ? 'أقل من 1 كم' : `${req.distance.toFixed(1)} كم`}
                  </div>
                )}
                <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {req.createdAt?.toDate?.() ? req.createdAt.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'قيد الإرسال...'}</div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="text-xs font-bold text-slate-600 font-sans flex items-center gap-2">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{req.bidsCount || 0} عروض مقدمة</span>
                  <span>بانتظار عرضك</span>
                </div>
                <Link to={`/supplier/request/${req.id}`} className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold text-sm shadow-sm hover:bg-[var(--color-primary-hover)] transition-colors">
                  {req.hasBid ? 'تعديل عرضك' : 'قدّم عرضك'}
                </Link>
              </div>
            </div>
          ))}
          {requests.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center">
              <Package size={48} className="text-slate-200 mb-2" />
              <p>لا توجد طلبات نشطة حالياً</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'bids' && (
        <div className="space-y-3">
          {activeOrders.map(req => (
            <Link key={req.id} to={`/supplier/orders/${req.id}`} className="block bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-1.5 bg-[var(--color-success)] h-full"></div>
               <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900 group-hover:text-[var(--color-primary)] transition-colors">{req.productName}</h3>
                  <span className={cn(
                    "font-bold text-xs",
                    req.status === 'accepted' ? "text-[var(--color-accent)] animate-pulse" : "text-[var(--color-success)]"
                  )}>
                    {req.status === 'accepted' ? 'بانتظار التحضير' : req.status === 'preparing' ? 'جاري التحضير' : 'في الطريق'}
                  </span>
               </div>
               <p className="text-xs text-slate-500 font-semibold mb-3">الكمية: {req.quantity} | السعر: {req.price} ج.م</p>
               <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">#{req.id.slice(0,8)}</span>
                 <span className="text-[10px] font-bold text-[var(--color-primary)] flex items-center">متابعة التوصيل <ChevronLeft className="w-3 h-3" /></span>
               </div>
            </Link>
          ))}
          {activeOrders.length === 0 && (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center">
              <Search className="w-12 h-12 text-slate-300 mb-3" />
              <p className="font-semibold text-sm">ليس لديك عروض مقبولة حالياً.</p>
              <p className="text-xs text-slate-400 mt-1 italic leading-relaxed px-4">ملاحظة: تظهر هنا العروض التي تم اختيارها من قبل المشترين فقط. لمتابعة العروض قيد الانتظار، يرجى مراجعة سجل الإشعارات.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

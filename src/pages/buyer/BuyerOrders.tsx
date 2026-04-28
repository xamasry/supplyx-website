import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, CheckCircle2, ChevronLeft, MapPin, Loader2, XCircle } from 'lucide-react';
import { cn, isRequestExpired } from '../../lib/utils';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function BuyerOrders() {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;
    
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (!user) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'requests'),
        where('buyerId', '==', user.uid)
      );

      unsubSnapshot = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        // Sort in memory
        data.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });

        setRequests(data);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'requests');
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const enhancedRequests = requests.map(r => ({
    ...r,
    _isExpired: isRequestExpired(r)
  }));

  const activeStatuses = ['accepted', 'preparing', 'shipped'];
  const activeOrders = enhancedRequests.filter(r => activeStatuses.includes(r.status) && !r._isExpired);
  const pendingRequests = enhancedRequests.filter(r => r.status === 'active' && !r._isExpired);
  const historyOrders = enhancedRequests.filter(r => r.status === 'delivered' || r.status === 'cancelled' || r._isExpired);

  const filteredOrders = activeTab === 'active' ? [...activeOrders, ...pendingRequests] : historyOrders;

  const getStatusText = (order: any) => {
    if (order._isExpired) return 'لم يكتمل';
    switch (order.status) {
      case 'active': return order.requestType === 'bulk' ? 'مناقصة مفتوحة' : 'بانتظار العروض';
      case 'accepted': return 'تم قبول العرض';
      case 'preparing': return 'جاري التجهيز';
      case 'shipped': return 'في الطريق';
      case 'delivered': return 'تم التوصيل';
      case 'cancelled': return 'ملغي';
      default: return order.status;
    }
  };

  return (
    <div className="space-y-6 md:pb-0 px-2 sm:px-0 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold font-display text-slate-900">سجل الطلبات</h1>
        <p className="text-slate-500 text-sm mt-1">تابع طلباتك الحالية وتصفح سجل مشترياتك</p>
      </header>

      {/* Tabs */}
      <div className="flex bg-slate-200/60 p-1 rounded-xl mb-6">
        <button 
          onClick={() => setActiveTab('active')}
          className={cn("flex-1 py-2.5 text-sm font-bold rounded-lg transition-all", activeTab === 'active' ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-500")}
        >
          الطلبات النشطة
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn("flex-1 py-2.5 text-sm font-bold rounded-lg transition-all", activeTab === 'history' ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-500")}
        >
          مكتملة وملغية
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="font-bold">جاري تحميل سجل الطلبات...</p>
          </div>
        ) : filteredOrders.map(order => (
          <Link key={order.id} to={order.status === 'active' ? `/buyer/request/${order.id}` : `/buyer/orders/${order.id}`} className="block bg-white rounded-3xl p-5 shadow-sm border border-slate-200 hover:border-[var(--color-primary)] transition-colors relative overflow-hidden group">
            {order.status === 'accepted' && <div className="absolute top-0 right-0 w-1 bg-[var(--color-accent)] h-full"></div>}
            {order.status === 'active' && <div className="absolute top-0 right-0 w-1 bg-[var(--color-primary)] h-full"></div>}
            {order.requestType === 'bulk' && (
              <div className="absolute top-0 left-0 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-br-xl flex items-center gap-1 border-r border-b border-slate-700">
                <Package className="w-3 h-3 text-slate-300" /> مناقصة جملة
              </div>
            )}
            
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold uppercase">#{order.id.slice(0, 8)}</span>
                <h3 className="font-bold text-lg text-slate-900 mt-2 leading-tight group-hover:text-[var(--color-primary)] transition-colors">{order.productName}</h3>
              </div>
              <div className="text-left">
                <span className="block font-bold text-[var(--color-primary)]">{order.price ? `${order.price} ج.م` : 'قيد التسعير'}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" /> 
                {order.supplierName ? `المورد: ${order.supplierName}` : 'بانتظار اختيار مورد'}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" /> 
                {order.createdAt?.toDate?.() ? order.createdAt.toDate().toLocaleDateString('ar-EG') : 'الآن'}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
               <div className={cn("flex items-center gap-1.5 text-sm font-bold", 
                  order._isExpired ? "text-slate-500" :
                  order.status === 'accepted' ? "text-[var(--color-accent)] animate-pulse" : 
                  order.status === 'active' ? "text-[var(--color-primary)]" : "text-[var(--color-success)]"
               )}>
                 {order.status === 'delivered' ? <CheckCircle2 className="w-4 h-4" /> : order._isExpired ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                 {getStatusText(order)}
               </div>
               <span className="text-[10px] font-bold text-slate-400 flex items-center">التفاصيل <ChevronLeft className="w-3 h-3" /></span>
            </div>
          </Link>
        ))}

        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-12 text-slate-500 flex flex-col items-center">
            <Package className="w-12 h-12 text-slate-300 mb-3 opacity-20" />
            <p className="font-semibold text-sm">لا توجد طلبات هنا حالياً.</p>
            <Link to="/buyer/request/new" className="text-xs text-[var(--color-primary)] font-bold mt-2 underline">ابدأ طلب جديد</Link>
          </div>
        )}
      </div>
    </div>
  );
}

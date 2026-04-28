import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle2, ChevronLeft, MapPin, Loader2 } from 'lucide-react';
import { cn, isRequestExpired } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function SupplierOrders() {
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

      // Query requests where this supplier is the one accepted
      const q = query(
        collection(db, 'requests'),
        where('supplierId', '==', user.uid)
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

        // Remove expired requests from supplier feed
        setRequests(data.filter(req => !isRequestExpired(req)));
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

  const activeOrders = requests.filter(r => r.status === 'accepted');
  const historyOrders = requests.filter(r => r.status === 'delivered' || r.status === 'cancelled');

  const filteredOrders = activeTab === 'active' ? activeOrders : historyOrders;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted': return 'جاري التجهيز/التوصيل';
      case 'delivered': return 'تم التسليم';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  return (
    <div className="space-y-6 md:pb-0 px-2 sm:px-0 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold font-display text-slate-900">سجل الطلبات الواردة</h1>
        <p className="text-slate-500 text-sm mt-1">إليك الطلبات التي قمت بالفوز بها وجاري العمل عليها</p>
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
          طلبات مكتملة
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="font-bold">جاري تحميل سجل الطلبات...</p>
          </div>
        ) : filteredOrders.map(order => (
          <Link key={order.id} to={`/supplier/orders/${order.id}`} className="block bg-white rounded-3xl p-5 shadow-sm border border-slate-200 hover:border-[var(--color-primary)] transition-colors relative overflow-hidden group">
            {order.status === 'accepted' && <div className="absolute top-0 right-0 w-1 bg-[var(--color-accent)] h-full"></div>}
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
                <span className="block font-bold text-[var(--color-primary)]">{order.price} ج.م</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1"><MapPin className="w-4 h-4" /> المشتري: {order.buyerName}</div>
              <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> {order.createdAt?.toDate?.() ? order.createdAt.toDate().toLocaleDateString('ar-EG') : 'قيد المعالجة'}</div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
               <div className={cn("flex items-center gap-1.5 text-sm font-bold", 
                  order.status === 'accepted' ? "text-[var(--color-accent)] animate-pulse" : "text-[var(--color-success)]"
               )}>
                 {order.status === 'accepted' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                 {getStatusText(order.status)}
               </div>
               <span className="text-[10px] font-bold text-slate-400 flex items-center">التفاصيل <ChevronLeft className="w-3 h-3" /></span>
            </div>
          </Link>
        ))}

        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-12 text-slate-500 flex flex-col items-center">
            <Package className="w-12 h-12 text-slate-300 mb-3 opacity-20" />
            <p className="font-semibold text-sm">لا توجد طلبات هنا حالياً.</p>
            <Link to="/supplier/home" className="text-xs text-[var(--color-primary)] font-bold mt-2 underline">تصفح الطلبات المتاحة</Link>
          </div>
        )}
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Search, Flame, Clock, ChevronLeft, Package, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const CATEGORIES = [
  { id: '1', name: 'مشروبات', icon: '🥤' },
  { id: '2', name: 'لحوم ودواجن', icon: '🥩' },
  { id: '3', name: 'ألبان وأجبان', icon: '🥛' },
  { id: '4', name: 'زيوت وتوابل', icon: '🛢️' },
  { id: '5', name: 'ورقيات', icon: '📄' },
  { id: '6', name: 'خضار وفاكهة', icon: '🥬' },
  { id: '7', name: 'مجمدات', icon: '🧊' },
  { id: '8', name: 'طلب مخصوص', icon: '✨' },
];

export default function BuyerHome() {
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

  const activeRequests = requests.filter(r => r.status === 'active');

  return (
    <div className="flex flex-col md:grid md:grid-cols-12 md:auto-rows-min gap-4 pb-6 md:pb-0 relative">
      {/* Search & Urgent Request */}
      <div className="md:col-start-1 md:col-span-3 md:row-start-1 md:row-span-2 flex flex-col justify-between gap-4">
        <div className="relative">
          <input 
            type="text" 
            placeholder="ابحث عن خامة..." 
            className="w-full bg-white border border-slate-300 rounded-3xl py-3.5 px-5 pr-12 shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold"
          />
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        </div>
        
        <Link 
          to="/buyer/request/new"
          className="flex-1 bg-[var(--color-danger)] text-white p-6 rounded-3xl flex flex-col items-center justify-center gap-3 shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform"
        >
          <div className="relative z-10 flex flex-col items-center">
             <span className="text-xs font-bold bg-white/20 px-3 py-1.5 rounded mb-3">🆘 طارئ جداً</span>
             <h2 className="text-2xl font-bold font-display text-center leading-tight mt-1">طلب خامة<br/>ناقصة</h2>
          </div>
          <Flame className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
        </Link>
      </div>

      {/* Stats Cards (Desktop Only) to fill grid */}
      <div className="hidden md:flex flex-col gap-4 md:col-start-1 md:col-span-3 md:row-start-3 md:row-span-2">
        <div className="flex-1 bg-white border border-slate-300 rounded-3xl p-5 shadow-sm flex items-center justify-center gap-3 xl:gap-4 hover:border-[var(--color-primary)] transition-colors">
          <div className="w-12 h-12 bg-[#27AE60]/10 text-[#27AE60] rounded-2xl flex items-center justify-center text-xl shrink-0">💰</div>
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">رصيد المشتريات</p>
            <p className="text-lg xl:text-xl font-bold text-slate-900 leading-tight">
               12,450.50 <span className="text-[10px] xl:text-xs font-normal">ج.م</span>
            </p>
          </div>
        </div>
        <div className="flex-1 bg-white border border-slate-300 rounded-3xl p-5 shadow-sm flex items-center justify-center gap-3 xl:gap-4 hover:border-[#22C55E] transition-colors">
          <div className="w-12 h-12 bg-[#22C55E]/10 text-[#22C55E] rounded-2xl flex items-center justify-center text-xl shrink-0">⭐</div>
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">تقييم المنشأة</p>
            <p className="text-xl font-bold text-[#0B1D2A] leading-tight">
              4.9 <span className="text-xs font-normal opacity-60">/ 5</span>
            </p>
          </div>
        </div>
      </div>

      {/* Active Requests */}
      <section className="md:col-start-4 md:col-span-6 md:row-start-1 md:row-span-4 bg-white border-2 border-[var(--color-primary)]/10 rounded-3xl p-6 shadow-sm flex flex-col min-h-[400px]">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-primary)] font-display">طلبات نشطة الآن</h2>
          </div>
          <Link to="/buyer/orders" className="text-xs font-bold text-[var(--color-primary)] bg-[var(--color-brand-bg)] px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-100 transition-colors">الكل</Link>
        </div>
        
        <div className="space-y-3 flex-1 overflow-auto hide-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-bold">جاري تحميل طلباتك...</p>
            </div>
          ) : activeRequests.length > 0 ? (
            activeRequests.map(req => (
              <Link key={req.id} to={`/buyer/request/${req.id}`} className="block bg-[var(--color-brand-bg)] border border-[var(--color-primary)]/10 p-4 rounded-2xl flex items-start justify-between hover:bg-slate-100 transition-colors relative overflow-hidden shrink-0">
                <div className={cn("absolute top-0 right-0 w-1 h-full bg-[var(--color-danger)]")}></div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-tight">{req.productName}</h3>
                  <p className="text-xs text-slate-600 mt-1 mb-2">الكمية: {req.quantity}</p>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-danger)] animate-pulse">
                    <Clock className="w-3.5 h-3.5" />
                    <span>نشط الآن</span>
                    {req.createdAt && (
                      <span className="mr-1 opacity-60">
                        • {req.createdAt.toDate?.().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-center bg-[var(--color-accent)]/10 px-4 py-2 rounded-xl text-[var(--color-accent)]">
                  <span className="block text-xl font-bold leading-none">
                    {/* In a real app we might store bidCount on the request doc for efficiency */}
                    0
                  </span>
                  <span className="block text-[10px] font-bold mt-1">عروض</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 border-2 border-dashed border-slate-100 rounded-2xl">
              <Package className="w-12 h-12 mb-3 opacity-10" />
              <p className="text-sm font-bold">لا توجد طلبات نشطة حالياً</p>
              <Link to="/buyer/request/new" className="text-xs text-[var(--color-primary)] font-bold mt-2 underline">ابدأ طلب جديد</Link>
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="md:col-start-10 md:col-span-3 md:row-start-1 md:row-span-4 bg-[var(--color-primary)] text-white rounded-3xl p-6 shadow-inner flex flex-col items-center">
        <h3 className="w-full text-lg font-bold mb-4 flex justify-between items-center font-display">
          التصنيفات
          <Link to="/buyer/home" className="text-[10px] opacity-60 font-normal hover:opacity-100 transition-opacity">عرض الكل</Link>
        </h3>
        <div className="grid grid-cols-2 gap-3 w-full pb-2">
          {CATEGORIES.map((c, i) => (
            <div key={c.id} className={cn("bg-white/10 p-3 lg:p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/20 transition-colors", i === CATEGORIES.length - 1 && "text-[var(--color-accent)]")}>
              <span className="text-2xl lg:text-3xl mb-1">{c.icon}</span>
              <span className="text-[11px] font-bold leading-tight">{c.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Supplier Offers Feed */}
      <section className="md:col-start-1 md:col-span-12 md:row-start-5 md:row-span-2 bg-white border border-slate-300 rounded-3xl p-5 md:p-6 shadow-sm overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold font-display text-lg text-slate-900">أحدث عروض الموردين الموفرة</h3>
          <Link to="/buyer/offers" className="text-xs text-[var(--color-primary)] font-bold flex items-center hover:underline">
            تصفح المزيد <ChevronLeft className="w-4 h-4 ml-1" />
          </Link>
        </div>
        
        <div className="flex overflow-x-auto gap-4 pb-2 snap-x hide-scrollbar">
          {[1,2,3].map(i => (
            <div key={i} className="min-w-[280px] md:min-w-[320px] bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl p-3 flex gap-3 snap-start hover:border-[var(--color-primary)] transition-colors">
              <div className="w-20 h-20 bg-slate-200 rounded-xl relative overflow-hidden shrink-0">
                <img src={`https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&q=80`} alt="Offer image" className="w-full h-full object-cover" />
                <div className="absolute top-0 right-0 bg-[var(--color-danger)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg rounded-tr-xl">خصم 20%</div>
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <p className="text-sm font-bold text-slate-900 line-clamp-1 leading-tight">زيت قلي 20 لتر ممتاز</p>
                <p className="text-xs text-slate-500 font-medium">المورد: شركة التوريدات</p>
                <div className="flex justify-between items-end mt-1">
                  <div className="flex gap-2 items-center">
                     <span className="text-[var(--color-danger)] font-bold">850 ج.م</span>
                     <span className="text-[10px] text-slate-400 line-through">1050 ج</span>
                  </div>
                  <span className="text-[10px] bg-[var(--color-success)] text-white px-2 py-0.5 rounded-full font-bold">لأول طلب</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

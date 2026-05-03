import { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { CATEGORIES } from '../../constants';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function SupplierOffers() {
  const [offers, setOffers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch user data for tier check
    const unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (doc) => {
      if (doc.exists()) {
        setUser(doc.data());
      }
    });

    const q = query(
      collection(db, 'offers'),
      where('supplierId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOffers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'offers');
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubUser();
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    try {
      await deleteDoc(doc(db, 'offers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `offers/${id}`);
    }
  };

  return (
    <div className="space-y-6 md:pb-0 px-2 sm:px-0 font-sans">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900">إدارة العروض</h1>
          <p className="text-slate-500 text-sm mt-1">وفر خصومات لجذب المزيد من الطلبات</p>
        </div>
        <Link to="/supplier/offers/new" className="bg-[var(--color-accent)] text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:scale-105 transition-transform">
           <Plus className="w-4 h-4" /> عرض جديد
        </Link>
      </header>

      {user?.subscriptionTier !== 'premium' && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-6 flex items-center justify-between">
           <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900">أنت حالياً على الباقة العادية (Standard)</p>
              <p className="text-xs text-amber-700 font-medium">يمكنك إضافة عروضك الآن! قم بالترقية للباقة المميزة لاحقاً للحصول على أولوية الظهور وشارة التوثيق المميزة.</p>
           </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm font-bold">جاري تحميل العروض...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {offers.map(offer => (
          <div key={offer.id} className="bg-white border border-slate-300 rounded-3xl p-3 flex flex-col shadow-sm relative overflow-hidden group">
             <div className="aspect-square w-full bg-white rounded-2xl relative overflow-hidden shrink-0 flex items-center justify-center border border-slate-100 mb-3">
                {offer.image ? (
                  <img 
                    src={offer.image} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    alt={offer.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.parentElement?.querySelector('.image-fallback');
                      if (fallback) fallback.classList.remove('hidden');
                    }}
                  />
                ) : null}
                
                <div className={cn(
                  "image-fallback flex flex-col items-center justify-center",
                  offer.image ? "hidden" : ""
                )}>
                  <span className="text-4xl filter drop-shadow-sm group-hover:scale-125 transition-transform">
                    {offer.categoryIcon || CATEGORIES.find(c => c.id === offer.categoryId || c.name === offer.category || c.name === offer.categoryName)?.icon || '✨'}
                  </span>
                </div>

                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/supplier/offers/edit/${offer.id}`} className="bg-white p-1.5 rounded-lg shadow-md text-slate-600 hover:text-[var(--color-primary)] flex items-center justify-center transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Link>
                  <button 
                    onClick={() => handleDelete(offer.id)} 
                    className="bg-white p-1.5 rounded-lg shadow-md text-slate-600 hover:text-[var(--color-danger)] flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
             </div>

             <div className="flex-1 flex flex-col">
                <h3 className="font-bold text-slate-900 leading-tight text-sm line-clamp-1 mb-1">{offer.title}</h3>
                
                <div className="flex flex-col gap-0.5 mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-[var(--color-danger)] text-sm">{offer.offerPrice} ج</span>
                    {offer.unit && (
                      <span className="text-[9px] font-bold text-slate-500">/ {offer.quantity || 1} {offer.unit}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 line-through">({offer.originalPrice} ج)</span>
                </div>

                <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                  <span>👁️ {offer.views || 0}</span>
                  <span>📦 {offer.orders || 0}</span>
                </div>
             </div>
          </div>
        ))}

        {offers.length === 0 && (
          <div className="text-center py-12 text-slate-500 flex flex-col items-center">
            <Tag className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-semibold text-sm">ليس لديك أي عروض نشطة حالياً.</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

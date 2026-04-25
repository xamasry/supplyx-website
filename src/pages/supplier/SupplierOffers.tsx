import { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';

export default function SupplierOffers() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

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

    return () => unsubscribe();
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm font-bold">جاري تحميل العروض...</p>
        </div>
      ) : (
        <div className="space-y-4">
        {offers.map(offer => (
          <div key={offer.id} className="bg-white border border-slate-300 rounded-3xl p-4 flex gap-4 shadow-sm relative overflow-hidden">
             <div className="w-24 h-24 bg-slate-100 rounded-2xl relative overflow-hidden shrink-0">
                <img src={offer.image} className="w-full h-full object-cover" alt={offer.title}/>
             </div>
             <div className="flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-900 leading-tight">{offer.title}</h3>
                  <div className="flex items-center gap-2">
                    <button className="text-slate-400 hover:text-[var(--color-primary)] transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(offer.id)} className="text-slate-400 hover:text-[var(--color-danger)] transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-[var(--color-danger)]">{offer.offerPrice} ج</span>
                  <span className="text-xs text-slate-400 line-through">({offer.originalPrice} ج)</span>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-500">
                  <span>👁️ {offer.views || 0} مشاهدة</span>
                  <span>📦 {offer.orders || 0} طلب</span>
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

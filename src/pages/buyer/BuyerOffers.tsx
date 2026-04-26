import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Flame, Tag, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';

export default function BuyerOffers() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'offers'),
      where('status', '==', 'active'),
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

  const filteredOffers = offers.filter(offer => 
    offer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    offer.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [isOrdering, setIsOrdering] = useState<string | null>(null);

  const handleOrder = async (offer: any) => {
    console.log('handleOrder (BuyerOffers) triggered for offer:', offer.id);
    if (!auth.currentUser) {
      toast.error('يرجى تسجيل الدخول أولاً');
      return;
    }

    setIsOrdering(offer.id);
    try {
      console.log('Starting order process in BuyerOffers for user:', auth.currentUser.uid);
      const orderRef = collection(db, 'requests');
      const newOrder = {
        buyerId: auth.currentUser.uid,
        buyerName: auth.currentUser.displayName || 'مشتري بنها',
        productName: offer.title,
        quantity: '1', // Default quantity for direct offers
        unit: 'وحدة',
        category: 'عروض خاصة',
        status: 'accepted', // Immediately accepted
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        supplierId: offer.supplierId,
        supplierName: offer.supplierName,
        price: offer.offerPrice,
        deliveryTime: 45, // Default estimate
        notes: `طلب مباشر من العرض: ${offer.title}`,
        offerId: offer.id
      };

      const docRef = await addDoc(orderRef, newOrder);
      console.log('Order created successfully in BuyerOffers:', docRef.id);
      
      // Update offer stats
      if (offer.id) {
        await updateDoc(doc(db, 'offers', offer.id), {
          orders: increment(1),
          updatedAt: serverTimestamp()
        }).catch(err => console.error('Error updating offer stats in BuyerOffers:', err));
      }
      
      // Create notification for supplier
      await addDoc(collection(db, 'notifications'), {
        userId: offer.supplierId,
        title: 'طلب جديد من عرضك!',
        message: `قام ${auth.currentUser.displayName || 'أحد العملاء'} بشراء عرضك "${offer.title}".`,
        type: 'bid_accepted',
        read: false,
        createdAt: serverTimestamp(),
        link: `/supplier/orders`
      }).catch(err => console.error('Error creating notification in BuyerOffers:', err));

      toast.success('تم إرسال الطلب بنجاح! يمكنك متابعة التوصيل من صفحة طلباتي.');
    } catch (error) {
      console.error('Error creating order from offer in BuyerOffers:', error);
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setIsOrdering(null);
    }
  };

  return (
    <div className="space-y-6 md:pb-0 px-2 sm:px-0 font-sans text-right">
      <header className="mb-4">
        <h1 className="text-2xl font-bold font-display text-slate-900">عروض الموردين</h1>
        <p className="text-slate-500 text-sm mt-1">تصفح أحدث الخصومات وفر في مشترياتك</p>
      </header>

      <div className="relative mb-6">
        <input 
          type="text" 
          placeholder="ابحث في العروض..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-3xl py-3.5 px-5 pr-12 shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none text-right"
        />
        <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm font-bold">جاري تحميل العروض...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffers.map(offer => (
            <div key={offer.id} className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-sm hover:border-[var(--color-primary)] transition-colors flex flex-col">
              <div className="h-40 bg-slate-200 relative overflow-hidden group">
                <img src={offer.image} alt={offer.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-3 right-3 bg-[var(--color-danger)] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">خصم {offer.discount}</div>
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded">⏳ متاح حتى نفاذ الكمية</div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg text-slate-900 leading-tight mb-1">{offer.title}</h3>
                <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mb-4">
                  <Tag className="w-3.5 h-3.5" />
                  المورد: {offer.supplierName}
                </p>
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] text-slate-400 line-through font-bold">{offer.originalPrice} ج.م</span>
                    <span className="block font-bold text-xl text-[var(--color-primary)] leading-none">{offer.offerPrice} <span className="text-xs">ج.م</span></span>
                  </div>
                  <button 
                    disabled={!!isOrdering}
                    onClick={() => handleOrder(offer)}
                    className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {isOrdering === offer.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Flame className="w-4 h-4" />
                    )}
                    {isOrdering === offer.id ? 'جاري الطلب...' : 'طلب الآن'}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredOffers.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500 flex flex-col items-center">
              <Tag className="w-12 h-12 text-slate-300 mb-3 opacity-20" />
              <p className="font-bold">لا توجد عروض متاحة حالياً</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

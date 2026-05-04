import { Link } from 'react-router-dom';
import { Search, Flame, Clock, ChevronLeft, Package, Loader2, X, MapPin, Phone, ShoppingBag, CheckCircle2, Heart, Star, Zap, Tag, Store, ClipboardList } from 'lucide-react';
import { cn, isRequestExpired, convertArabicNumerals, getCategoryImageUrl, formatArabicDate } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, increment, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { trackEvent } from '../../lib/analytics';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CATEGORIES } from '../../constants';
import SubscriptionModal from '../../components/SubscriptionModal';

import { motion, AnimatePresence } from 'motion/react';

export default function BuyerHome() {
  const [requests, setRequests] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;
    let unsubOffers: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;
    let unsubSuppliers: (() => void) | null = null;
    
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubSnapshot) unsubSnapshot();
      if (unsubOffers) unsubOffers();
      if (unsubProfile) unsubProfile();
      if (unsubSuppliers) unsubSuppliers();

      if (!user) {
        setRequests([]);
        setOffers([]);
        setSuppliers([]);
        setUserProfile(null);
        setWishlist([]);
        setLoading(false);
        setLoadingSuppliers(false);
        return;
      }
      
      // Fetch Trusted Suppliers
      const qSuppliers = query(
        collection(db, 'users'), 
        where('role', '==', 'supplier'), 
        where('isTrusted', '==', true),
        limit(12)
      );
      unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        data.sort((a, b) => {
          if (a.subscriptionTier === 'premium' && b.subscriptionTier !== 'premium') return -1;
          if (a.subscriptionTier !== 'premium' && b.subscriptionTier === 'premium') return 1;
          return 0;
        });
        setSuppliers(data);
        setLoadingSuppliers(false);
      }, (err) => {
        console.error('Suppliers Fetch Error:', err);
        setLoadingSuppliers(false);
      });

      // Fetch Profile
      unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile(data);
          setWishlist(data.wishlist || []);
        }
      });

      // Fetch Requests
      const q = query(
        collection(db, 'requests'),
        where('buyerId', '==', user.uid),
        limit(50)
      );

      unsubSnapshot = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRequests(data);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'requests', true);
        setLoading(false);
      });

      // Fetch Offers
      const qOffers = query(collection(db, 'offers'), where('status', '==', 'active'), limit(20));
      unsubOffers = onSnapshot(qOffers, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setOffers(data);
      }, (error) => {
        console.error('Error fetching offers:', error);
      });
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
      if (unsubOffers) unsubOffers();
      if (unsubProfile) unsubProfile();
      if (unsubSuppliers) unsubSuppliers();
    };
  }, []);

  const [isOrdering, setIsOrdering] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Location error:', error);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleOrder = async () => {
    if (!selectedOffer || !auth.currentUser) return;
    setIsOrdering(selectedOffer.id);
    try {
      const orderRef = collection(db, 'requests');
      const newOrder = {
        buyerId: auth.currentUser.uid,
        buyerName: userProfile?.businessName || auth.currentUser.displayName || 'مشتري',
        productName: selectedOffer.title,
        quantity: orderQuantity,
        unit: selectedOffer.unit || 'وحدة',
        category: 'عروض خاصة',
        status: 'accepted',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        supplierId: selectedOffer.supplierId,
        supplierName: selectedOffer.supplierName,
        price: selectedOffer.offerPrice,
        deliveryTime: 45,
        notes: `طلب مباشر من العرض: ${selectedOffer.title}`,
        offerId: selectedOffer.id,
        address: orderAddress,
        phone: orderPhone,
        totalAmount: (Number(selectedOffer.offerPrice) * Number(orderQuantity)),
        coordinates: location
      };
      await addDoc(orderRef, newOrder);
      
      if (selectedOffer.id) {
        await updateDoc(doc(db, 'offers', selectedOffer.id), {
          orders: increment(1),
          updatedAt: serverTimestamp()
        });
      }
      
      await addDoc(collection(db, 'notifications'), {
        userId: selectedOffer.supplierId,
        title: 'طلب جديد من عرضك!',
        message: `قام ${auth.currentUser.displayName || 'أحد العملاء'} بشراء ${orderQuantity} ${selectedOffer.unit} من عرضك "${selectedOffer.title}".`,
        type: 'bid_accepted',
        read: false,
        createdAt: serverTimestamp(),
        link: `/supplier/orders`
      });
      
      trackEvent('order_created', { type: 'offer_direct', amount: newOrder.totalAmount });
      toast.success('تم إرسال الطلب بنجاح!');
      setShowOrderModal(false);
      navigate('/buyer/orders');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setIsOrdering(null);
    }
  };

  const activeRequests = requests.filter(r => ['active', 'accepted', 'preparing', 'shipped'].includes(r.status));

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 pb-32 overflow-x-hidden space-y-8">
      {/* Search Bar */}
      <div className="relative group w-full pt-4">
        <input 
          type="text" 
          placeholder="ابحث عن خامة أو مورد..." 
          className="w-full bg-white border border-slate-200 rounded-[2rem] py-4 px-6 pr-14 shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold transition-all text-lg"
        />
        <Search className="absolute right-6 top-1/2 -translate-y-1/2 mt-2 text-slate-400 w-6 h-6 transition-colors" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <Link to="/buyer/request/new" className="flex-1 bg-[var(--color-danger)] text-white p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 shadow-lg hover:translate-y-[-4px] active:scale-95 transition-all overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-10 -mt-10" />
              <Flame className="w-8 h-8 animate-pulse text-white" />
              <h2 className="text-2xl font-black font-display">طلب طارئ</h2>
              <p className="text-xs font-bold opacity-80">عروض خلال دقائق</p>
            </Link>
            <Link to="/buyer/request/new?type=bulk" className="flex-1 bg-slate-900 text-white p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 shadow-lg hover:translate-y-[-4px] active:scale-95 transition-all overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-10 -mt-10" />
              <Package className="w-8 h-8 text-white/80" />
              <h2 className="text-2xl font-black font-display">صفقة كبيرة</h2>
              <p className="text-xs font-bold opacity-70">أفضل سعر للكميات</p>
            </Link>
          </div>

          <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 min-h-[300px]">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-[var(--color-primary)] rounded-full" />
                <h3 className="text-xl font-black text-slate-900">طلباتي النشطة</h3>
              </div>
              <Link to="/buyer/orders" className="text-sm font-bold text-[var(--color-primary)] hover:underline">المزيد</Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="animate-spin mb-4 w-10 h-10" />
                  <p className="text-sm font-bold">جاري تحميل طلباتك...</p>
                </div>
              ) : activeRequests.length > 0 ? (
                activeRequests.map((req) => (
                  <Link key={req.id} to={`/buyer/request/${req.id}`} className="group bg-slate-50 border border-slate-100 p-5 rounded-3xl hover:bg-white hover:border-[var(--color-primary)]/30 hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900 text-lg group-hover:text-[var(--color-primary)] transition-colors">{req.productName}</h4>
                        <div className="flex items-center gap-2 mt-2">
                           <span className="text-xs text-slate-500 font-bold bg-white px-2 py-1 rounded-lg border border-slate-100">{req.quantity} {req.unit}</span>
                        </div>
                      </div>
                      <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 text-center shadow-sm">
                        <span className="text-2xl font-black text-[var(--color-primary)]">{req.bidsCount || 0}</span>
                        <span className="block text-[10px] font-bold text-slate-400">عروض</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-full text-center py-16">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <ClipboardList size={32} />
                  </div>
                  <p className="text-slate-400 font-bold text-sm italic">لا يوجد طلبات نشطة حالياً</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center gap-4 shadow-sm">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-2xl shadow-sm">💰</div>
                <div>
                  <p className="text-xs text-slate-400 font-bold">المشتريات</p>
                  <p className="text-2xl font-black text-slate-900">١٢,٤٥٠ <span className="text-[10px]">جم</span></p>
                </div>
              </div>
              <Link to="/buyer/wishlist" className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center gap-4 shadow-sm hover:border-rose-200 transition-all group">
                <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">❤️</div>
                <div>
                  <p className="text-xs text-slate-400 font-bold">المفضلة</p>
                  <p className="text-2xl font-black text-slate-900">{wishlist.length} <span className="text-[10px]">عروض</span></p>
                </div>
              </Link>
           </div>

          <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-900 pr-3 border-r-4 border-emerald-500">موردين موثوقين</h3>
             </div>
             <div className="grid grid-cols-3 gap-6">
               {suppliers.map(s => (
                 <Link key={s.id} to={`/buyer/supplier/${s.id}`} className="flex flex-col items-center group">
                   <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center p-2 group-hover:border-emerald-500 transition-all relative">
                     <img src={s.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.businessName || 'S')}&background=22C55E&color=fff`} className="w-full h-full object-cover rounded-xl" />
                   </div>
                   <p className="text-[9px] font-black text-slate-600 mt-2 text-center line-clamp-1">{s.businessName}</p>
                 </Link>
               ))}
             </div>
          </section>
        </div>
      </div>

      <section className="w-full">
         <div className="flex items-center gap-3 mb-6">
           <div className="w-2 h-6 bg-amber-500 rounded-full" />
           <h3 className="text-xl font-black text-slate-900">استكشف حسب التصنيف</h3>
         </div>
         <div className="flex overflow-x-auto gap-4 pb-6 hide-scrollbar">
           {CATEGORIES.map(c => (
             <Link key={c.id} to={`/buyer/products?cat=${c.id}`} className="min-w-[110px] bg-white border border-slate-100 rounded-[2.5rem] p-6 flex flex-col items-center justify-center text-center shadow-sm hover:border-[var(--color-primary)] transition-all group">
               <span className="text-4xl mb-3 group-hover:scale-125 transition-transform">{c.icon}</span>
               <span className="text-xs font-black text-slate-700 whitespace-nowrap">{c.name}</span>
             </Link>
           ))}
         </div>
      </section>

      <section className="w-full pb-20">
        <div className="flex justify-between items-center mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-6 bg-rose-500 rounded-full" />
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>أقوى العروض الحالية لعملاء</span>
              <span className="bg-slate-900 text-[var(--color-primary)] px-3 py-1 rounded-xl text-sm font-black tracking-tighter shadow-lg shadow-green-500/10">SupplyX</span>
            </h3>
          </div>
        </div>

        {userProfile?.subscriptionTier === 'premium' ? (
          <div className="flex overflow-x-auto gap-6 pb-8 hide-scrollbar">
            {offers.map(offer => (
              <div key={offer.id} className="min-w-[300px] bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col group">
                <div className="h-40 bg-slate-50 relative overflow-hidden">
                  <img src={offer.image || getCategoryImageUrl(offer.categoryName || offer.category, CATEGORIES)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={offer.title} />
                  <div className="absolute top-4 right-4 bg-rose-500 text-white text-xs font-black px-3 py-1 rounded-xl shadow-lg">-{offer.discount}</div>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-black text-lg text-slate-900 line-clamp-1">{offer.title}</h4>
                    <p className="text-sm text-slate-400 font-bold mt-1 line-clamp-1 flex items-center gap-1"><Store size={14} />{offer.supplierName}</p>
                  </div>
                  <div className="flex justify-between items-end mt-6">
                    <div>
                      <span className="text-rose-500 font-black text-2xl">{offer.offerPrice} <span className="text-xs">جم</span></span>
                    </div>
                    <button 
                      onClick={() => { setSelectedOffer(offer); setShowOrderModal(true); requestLocation(); }}
                      className="bg-slate-900 text-white text-sm font-black px-6 py-3 rounded-2xl hover:bg-[var(--color-primary)] transition-all flex items-center gap-2"
                    >
                      <ShoppingBag size={18} />
                      اطلب الآن
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-950 rounded-[3rem] p-12 text-center relative overflow-hidden">
             <div className="relative z-10">
               <h3 className="text-3xl font-black text-white mb-4">أقوى العروض مخصصة للـ Premium</h3>
               <p className="text-slate-400 max-w-xl mx-auto mb-10 text-lg leading-relaxed">احصل على خصومات تصل لـ ٥٠٪ من كبار الموردين.</p>
               <button onClick={() => setIsSubscriptionModalOpen(true)} className="inline-flex items-center gap-3 bg-amber-500 text-white text-lg font-black px-12 py-5 rounded-[2rem] hover:bg-amber-600 transition-all">
                 <span>اشترك لتشاهد العروض</span>
                 <Zap className="w-5 h-5 fill-current" />
               </button>
             </div>
          </div>
        )}
      </section>

      {showOrderModal && selectedOffer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900">تأكيد طلب العرض</h2>
              <button onClick={() => setShowOrderModal(false)} className="bg-slate-200 p-2 rounded-full text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-5 text-right">
               <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-4">
                 <div className="flex-1">
                   <h3 className="font-bold text-slate-800">{selectedOffer.title}</h3>
                   <p className="text-xs text-green-700 font-bold mt-1">السعر: {selectedOffer.offerPrice} ج.م</p>
                 </div>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 mb-1.5 block">الكمية المطلوبة</label>
                   <input type="number" value={orderQuantity} onChange={(e) => setOrderQuantity(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3.5 text-right font-black focus:ring-2 focus:ring-green-500 outline-none" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 mb-1.5 block">عنوان التوصيل</label>
                   <input type="text" value={orderAddress} onChange={(e) => setOrderAddress(e.target.value)} placeholder="ادخل عنوانك..." className="w-full border border-slate-200 rounded-xl p-3.5 text-right font-bold focus:ring-2 focus:ring-green-500 outline-none" />
                 </div>
                 <button onClick={requestLocation} className={cn("w-full py-3.5 rounded-xl border flex items-center justify-center gap-3 text-xs font-bold", location ? "bg-green-50 text-green-700" : "bg-slate-50")}>
                   <MapPin size={16}/> {location ? 'تم تحديد الموقع' : 'تحديد بموقعي الجغرافي'}
                 </button>
               </div>

               <button onClick={handleOrder} disabled={!!isOrdering || !orderQuantity || !orderAddress} className="w-full bg-[var(--color-primary)] text-white py-4.5 rounded-2xl font-black text-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-3 mt-4">
                 {isOrdering ? <Loader2 className="animate-spin" size={24}/> : <CheckCircle2 size={24}/>}
                 {isOrdering ? 'جاري الإرسال...' : 'إتمام الشراء الآن'}
               </button>
            </div>
          </div>
        </div>
      )}

      <SubscriptionModal isOpen={isSubscriptionModalOpen} onClose={() => setIsSubscriptionModalOpen(false)} userRole="buyer" currentTier={userProfile?.subscriptionTier || 'standard'} />
    </div>
  );
}

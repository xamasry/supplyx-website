import { Link } from 'react-router-dom';
import { Search, Flame, Clock, ChevronLeft, Package, Loader2, X, MapPin, Phone, ShoppingBag, CheckCircle2, Heart, Star, Zap, Tag } from 'lucide-react';
import { cn, isRequestExpired, convertArabicNumerals, getCategoryImageUrl } from '../../lib/utils';
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
        // Sort by tier (Premium first)
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

      // Fetch Profile Real-time for wishlist
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
        
        // Fetch real bid counts for each active request
        setRequests(data);

        // Fetch actual counts from server for active items to be extra sure
        data.forEach(async (req) => {
          if (['active', 'accepted', 'preparing', 'shipped'].includes(req.status)) {
            try {
              const bidsRef = collection(db, `requests/${req.id}/bids`);
              const { getCountFromServer } = await import('firebase/firestore');
              const bidSnap = await getCountFromServer(bidsRef);
              const realCount = bidSnap.data().count;
              
              if (realCount !== req.bidsCount) {
                setRequests(current => current.map(r => 
                  r.id === req.id ? { ...r, bidsCount: realCount } : r
                ));
              }
            } catch (err) {
              console.error(`Error counting bids for ${req.id}:`, err);
            }
          }
        });

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

  const toggleWishlist = async (offerId: string) => {
    if (!auth.currentUser) return;
    const isFav = wishlist.includes(offerId);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        wishlist: isFav ? arrayRemove(offerId) : arrayUnion(offerId)
      });
      toast.success(isFav ? 'تم الإزالة من المفضلة' : 'تم الإضافة للمفضلة');
    } catch (err) {
      console.error('Wishlist error:', err);
    }
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
        totalAmount: (Number(selectedOffer.offerPrice) * Number(orderQuantity)) / (Number(selectedOffer.quantity) || 1),
        coordinates: location
      };
      await addDoc(orderRef, newOrder);
      
      if (selectedOffer.id) {
        try {
          await updateDoc(doc(db, 'offers', selectedOffer.id), {
            orders: increment(1),
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          console.error("Failed to update offer orders:", err);
        }
      }
      
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: selectedOffer.supplierId,
          title: 'طلب جديد من عرضك!',
          message: `قام ${auth.currentUser.displayName || 'أحد العملاء'} بشراء ${orderQuantity} ${selectedOffer.unit} من عرضك "${selectedOffer.title}".`,
          type: 'bid_accepted',
          read: false,
          createdAt: serverTimestamp(),
          link: `/supplier/orders`
        });
      } catch (err) {
        console.error("Failed to add notification:", err);
      }
      
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

  const activeRequests = requests.filter(r => ['active', 'accepted', 'preparing', 'shipped'].includes(r.status) && !isRequestExpired(r));

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-4 lg:px-6 pb-24 overflow-x-hidden">
      <div className="flex flex-col gap-6">
        
        {/* Search Bar - Traditional Top position */}
        <div className="relative group max-w-2xl mx-auto w-full">
          <input 
            type="text" 
            placeholder="ابحث عن خامة أو مورد..." 
            className="w-full bg-white border border-slate-300 rounded-3xl py-3.5 px-5 pr-12 shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold transition-all"
          />
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 transition-colors" />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 max-w-2xl mx-auto w-full">
          <Link to="/buyer/request/new" className="flex-1 bg-[var(--color-danger)] text-white p-6 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 transition-all overflow-hidden relative group">
            <Flame className="w-6 h-6 animate-pulse" />
            <h2 className="text-xl font-bold font-display">طلب طارئ</h2>
            <p className="text-[10px] font-bold opacity-80">عروض خلال دقائق</p>
          </Link>
          <Link to="/buyer/request/new?type=bulk" className="flex-1 bg-slate-900 text-white p-6 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 transition-all overflow-hidden relative group">
            <Package className="w-6 h-6" />
            <h2 className="text-xl font-bold font-display">صفقة كبيرة</h2>
            <p className="text-[10px] font-bold opacity-70">أفضل سعر للكميات</p>
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 bg-green-50 text-[var(--color-primary)] rounded-xl flex items-center justify-center">💰</div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold">المشتريات</p>
              <p className="text-lg font-black text-slate-900">12,450 <span className="text-[10px]">جم</span></p>
            </div>
          </div>
          <Link to="/buyer/wishlist" className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">❤️</div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold">المفضلة</p>
              <p className="text-lg font-black text-slate-900">{wishlist.length} <span className="text-[10px]">عروض</span></p>
            </div>
          </Link>
        </div>

        {/* Active Requests section */}
        <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 max-w-2xl mx-auto w-full min-h-[300px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900 pr-3 border-r-4 border-[var(--color-primary)]">طلباتي النشطة</h3>
            <Link to="/buyer/orders" className="text-xs font-bold text-[var(--color-primary)]">المزيد</Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="animate-spin mb-2" />
                <p className="text-xs font-bold">جاري التحميل...</p>
              </div>
            ) : activeRequests.length > 0 ? (
              activeRequests.map((req) => (
                <Link 
                  key={req.id} 
                  to={`/buyer/request/${req.id}`} 
                  className="block bg-slate-50 border border-slate-100 p-4 rounded-2xl hover:bg-slate-100 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900">{req.productName}</h4>
                      <p className="text-xs text-slate-500 font-bold mt-1">{req.quantity} {req.unit}</p>
                    </div>
                    <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-center min-w-[50px]">
                      <span className="text-lg font-black text-[var(--color-primary)] leading-none">{req.bidsCount || 0}</span>
                      <span className="block text-[8px] font-bold text-slate-400">عروض</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 font-bold text-xs italic">لا يوجد طلبات نشطة حالياً</div>
            )}
          </div>
        </section>

        {/* Categories Horizontal Scroll */}
        <section className="max-w-2xl mx-auto w-full">
           <h3 className="text-sm font-bold text-slate-900 mb-4 px-2">استكشف حسب التصنيف</h3>
           <div className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar px-2">
             {CATEGORIES.map(c => (
               <Link 
                key={c.id} 
                to={`/buyer/products?cat=${c.id}`} 
                className="min-w-[90px] bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm hover:border-[var(--color-primary)] transition-all"
               >
                 <span className="text-2xl mb-1">{c.icon}</span>
                 <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">{c.name}</span>
               </Link>
             ))}
           </div>
        </section>

        {/* Trusted Suppliers Section */}
        <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 max-w-2xl mx-auto w-full">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 pr-3 border-r-4 border-emerald-500">موردين موثوقين</h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">الشركات الأكثر مصداقية</span>
           </div>
           <div className="flex overflow-x-auto gap-4 py-2 hide-scrollbar">
             {loadingSuppliers ? (
               <div className="flex items-center justify-center w-full py-4"><Loader2 className="animate-spin text-slate-400" /></div>
             ) : suppliers.length > 0 ? (
               suppliers.map(s => (
                 <Link key={s.id} to={`/buyer/supplier/${s.id}`} className="flex flex-col items-center min-w-[100px] group">
                   <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2 group-hover:border-emerald-500 transition-all relative">
                     <img 
                      src={s.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.businessName || 'S')}&background=22C55E&color=fff`} 
                      alt={s.businessName} 
                      className="w-full h-full object-cover rounded-xl"
                     />
                     {s.subscriptionTier === 'premium' && (
                       <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-1 rounded-lg border-2 border-white shadow-sm">
                         <Star size={8} fill="currentColor" />
                       </div>
                     )}
                     {s.isTrusted && (
                       <div className="absolute -bottom-1 -left-1 bg-blue-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                         <CheckCircle2 size={8} />
                       </div>
                     )}
                   </div>
                   <p className="text-[10px] font-bold text-slate-800 mt-2 text-center line-clamp-1">{s.businessName}</p>
                 </Link>
               ))
             ) : (
               <div className="text-center w-full py-4 text-xs text-slate-400 italic">لا يوجد موردين موثوقين حالياً</div>
             )}
           </div>
        </section>

        {/* Daily Offers */}
        <section className="max-w-2xl mx-auto w-full pb-10">
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-base font-black text-slate-900">أقوى العروض الحالية</h3>
            <Link to="/buyer/offers" className="text-xs text-[var(--color-primary)] font-bold">شاهد الكل</Link>
          </div>

          {userProfile?.subscriptionTier === 'premium' ? (
            <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar px-2">
              {offers.map(offer => (
                <div 
                  key={offer.id} 
                  className="min-w-[260px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all shrink-0"
                >
                  <div className="h-32 bg-slate-100 relative">
                    <img 
                      src={offer.image || getCategoryImageUrl(offer.categoryName || offer.category, CATEGORIES)} 
                      className="w-full h-full object-cover" 
                      alt={offer.title}
                    />
                    <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">-{offer.discount}</div>
                    {offer.isExclusive && (
                      <div className="absolute top-2 left-2 bg-amber-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-lg shadow-sm">حصري Premium</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{offer.title}</h4>
                    <div className="flex justify-between items-end mt-3">
                      <div>
                        <span className="text-rose-500 font-black text-lg">{offer.offerPrice} <span className="text-[10px]">جم</span></span>
                      </div>
                      <button 
                        onClick={() => { setSelectedOffer(offer); setShowOrderModal(true); requestLocation(); }}
                        className="bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800"
                      >
                        اطلب الآن
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-900 rounded-[2rem] p-8 mx-2 text-center relative overflow-hidden group">
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500 blur-[60px] opacity-20" />
               <Tag className="w-10 h-10 text-amber-500 mx-auto mb-3" />
               <h3 className="text-white font-bold mb-2">أقوى العروض الحالية مخصصة للـ Premium</h3>
               <p className="text-slate-400 text-[10px] mb-6">احصل على خصومات تصل لـ 50% من كبار الموردين عند اشتراكك في باقة الـ Premium.</p>
               <button 
                 onClick={() => setIsSubscriptionModalOpen(true)}
                 className="inline-block bg-white text-slate-900 text-xs font-black px-6 py-2.5 rounded-xl hover:bg-amber-500 hover:text-white transition-colors"
               >
                 اشترك لتشاهد العروض
               </button>
            </div>
          )}
        </section>
      </div>


      {/* Confirmation Modal */}
      {showOrderModal && selectedOffer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900">تأكيد طلب العرض</h2>
              <button 
                onClick={() => setShowOrderModal(false)} 
                className="bg-slate-200 hover:bg-slate-300 p-2 rounded-full text-slate-600 transition-colors"
                id="close-modal-btn"
              >
                <X size={20}/>
              </button>
            </div>
            <div className="p-6 space-y-5 text-right">
               <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-4">
                 <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-3xl shrink-0 shadow-sm border border-green-50">✨</div>
                 <div className="flex-1">
                   <h3 className="font-bold text-slate-800">{selectedOffer.title}</h3>
                   <p className="text-xs text-green-700 font-bold mt-1">السعر الموفر: {selectedOffer.offerPrice} ج.م</p>
                 </div>
               </div>
               
               <div className="space-y-4">
                 <div id="order-qty-group">
                   <label className="text-xs font-bold text-slate-500 mb-1.5 block pr-1">الكمية المطلوبة ({selectedOffer.unit})</label>
                   <input 
                     id="order-quantity"
                     type="number" 
                     value={orderQuantity} 
                     onChange={(e) => setOrderQuantity(e.target.value)} 
                     className="w-full border border-slate-200 rounded-xl p-3.5 text-right font-black focus:ring-2 focus:ring-green-500 outline-none text-lg"
                   />
                 </div>
                 <div id="order-address-group">
                   <label className="text-xs font-bold text-slate-500 mb-1.5 block pr-1">عنوان التوصيل</label>
                   <input 
                     id="order-address"
                     type="text" 
                     value={orderAddress} 
                     onChange={(e) => setOrderAddress(e.target.value)} 
                     placeholder="ادخل عنوانك بالتفصيل..."
                     className="w-full border border-slate-200 rounded-xl p-3.5 text-right font-bold focus:ring-2 focus:ring-green-500 outline-none"
                   />
                 </div>
                 <div id="order-location-group">
                   <button 
                    onClick={requestLocation} 
                    className={cn(
                      "w-full py-3.5 rounded-xl border flex items-center justify-center gap-3 text-xs font-bold transition-all shadow-sm", 
                      location ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                   >
                     {isGettingLocation ? <Loader2 size={16} className="animate-spin"/> : <MapPin size={16}/>}
                     {location ? 'تم تحديد موقعك بدقة' : 'تحديد بموقعي الجغرافي الحالي'}
                   </button>
                 </div>
               </div>

               <div className="pt-4 border-t border-slate-100 mt-2">
                 <button 
                  id="submit-order-btn"
                  onClick={handleOrder}
                  disabled={!!isOrdering || !orderQuantity || !orderAddress}
                  className="w-full bg-[var(--color-primary)] text-white py-4.5 rounded-2xl font-black text-xl shadow-lg hover:shadow-green-200 disabled:opacity-50 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                 >
                   {isOrdering ? <Loader2 className="animate-spin" size={24}/> : <CheckCircle2 size={24}/>}
                   {isOrdering ? 'جاري إرسال الطلب...' : 'إتمام الشراء الآن'}
                 </button>
                 <p className="text-[10px] text-slate-400 text-center mt-3 font-bold">بمتابعة الطلب أنت توافق على شروط الاستخدام وسياسة الخصوصية</p>
               </div>
            </div>
          </div>
        </div>
      )}
      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        userRole="buyer"
        currentTier={userProfile?.subscriptionTier || 'standard'}
      />
    </div>
  );
}

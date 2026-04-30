import { Link } from 'react-router-dom';
import { Search, Flame, Clock, ChevronLeft, Package, Loader2, X, MapPin, Phone, ShoppingBag, CheckCircle2, Heart, Star } from 'lucide-react';
import { cn, isRequestExpired, convertArabicNumerals } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, increment, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { trackEvent } from '../../lib/analytics';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CATEGORIES } from '../../constants';

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
      // Cleanup previous listeners
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
      
      // Fetch Trusted Suppliers - Within Auth changed to ensure request.auth is available for rules
      const qSuppliers = query(
        collection(db, 'users'), 
        where('role', '==', 'supplier'), 
        where('isVerified', '==', true),
        limit(12)
      );
      unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

  const activeRequests = requests.filter(r => ['active', 'accepted', 'preparing', 'shipped'].includes(r.status) && !isRequestExpired(r));

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-4 lg:px-6 pb-20">
      <div className="flex flex-col md:grid md:grid-cols-12 md:auto-rows-min gap-6 relative">
        
        {/* Top Section: Search & Actions */}
        <div className="md:col-span-3 space-y-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="ابحث عن خامة..." 
              className="w-full bg-white border border-slate-300 rounded-3xl py-3.5 px-5 pr-12 shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold"
            />
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          </div>
          
          <div className="flex gap-4 h-[110px] md:h-auto">
            <Link to="/buyer/request/new" className="flex-1 bg-[var(--color-danger)] text-white p-4 rounded-3xl flex flex-col items-center justify-center gap-1 shadow-lg group hover:scale-[1.02] transition-transform overflow-hidden relative">
              <span className="text-[9px] font-bold bg-white/20 px-2 py-0.5 rounded relative z-10">سريع جداً</span>
              <h2 className="text-lg font-bold font-display relative z-10">طلب طارئ</h2>
              <Flame className="absolute -right-4 -bottom-4 w-20 h-20 opacity-10 rotate-12" />
            </Link>
            <Link to="/buyer/request/new?type=bulk" className="flex-1 bg-slate-900 text-white p-4 rounded-3xl flex flex-col items-center justify-center gap-1 shadow-lg group hover:scale-[1.02] transition-transform overflow-hidden relative border border-slate-700">
              <span className="text-[9px] font-bold bg-white/10 px-2 py-0.5 rounded border border-white/10 relative z-10">مناقصة جملة</span>
              <h2 className="text-lg font-bold font-display relative z-10">صفقة كبيرة</h2>
              <Package className="absolute -left-4 -bottom-4 w-20 h-20 opacity-5 -rotate-12" />
            </Link>
          </div>
        </div>

        {/* Categories Section (Mobile Side-scroll, Desktop Grid) */}
        <div className="md:col-start-10 md:col-span-3 md:row-start-1 md:row-span-4 order-last md:order-none">
          <section className="bg-[var(--color-primary)] text-white rounded-3xl p-5 shadow-lg flex flex-col h-full">
            <h3 className="text-lg font-bold mb-4 flex justify-between items-center font-display">
              التصنيفات
              <span className="text-[10px] opacity-60">تصفح</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 w-full overflow-y-auto hide-scrollbar max-h-[350px]">
              {CATEGORIES.map((c, i) => (
                <div key={c.id} onClick={() => navigate(`/buyer/request/new`)} className={cn("bg-white/10 p-3 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/20 transition-all", i === CATEGORIES.length - 1 && "text-[var(--color-accent)]")}>
                  <span className="text-2xl mb-1">{c.icon}</span>
                  <span className="text-[10px] font-bold leading-tight">{c.name}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Trusted Suppliers Section - MOVED UP for Mobile visibility */}
        <div className="md:col-span-12 order-1 md:order-none">
          <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold font-display text-lg text-slate-900 border-r-4 border-[var(--color-primary)] pr-2">موردينا الموثوقين</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">الشركات المعتمدة</p>
            </div>
            
            <div className="flex overflow-x-auto gap-4 pb-2 snap-x hide-scrollbar min-h-[120px]">
              {loadingSuppliers ? (
                 <div className="w-full flex items-center justify-center py-8 gap-2 text-slate-400 font-bold text-xs">
                   <Loader2 className="w-4 h-4 animate-spin" />
                   <span>جاري جلب الموردين المعتمدين...</span>
                 </div>
              ) : suppliers.length > 0 ? (
                suppliers.map(s => (
                  <Link key={s.id} to={`/buyer/supplier/${s.id}`} className="min-w-[110px] md:min-w-[130px] flex flex-col items-center group snap-start">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-2xl border-2 border-slate-100 group-hover:border-[var(--color-primary)] transition-all p-1.5 overflow-hidden shadow-sm relative">
                      <img 
                        src={s.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.businessName || 'S')}&background=22C55E&color=fff`} 
                        alt={s.businessName} 
                        className="w-full h-full object-cover rounded-xl"
                      />
                      {s.isVerified && <CheckCircle2 className="absolute -top-1 -right-1 w-5 h-5 text-white bg-green-500 rounded-full border-2 border-white p-0.5" />}
                    </div>
                    <p className="mt-2 text-[10px] font-black text-slate-800 text-center line-clamp-1 group-hover:text-[var(--color-primary)]">{s.businessName}</p>
                    <div className="flex items-center gap-0.5 text-[9px] text-amber-500 font-bold">
                      <Star size={10} className="fill-current" />
                      {s.rating || 4.8}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="w-full py-8 text-center text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  لا توجد شركات معتمدة نشطة حالياً
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Stats Section */}
        <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-x-visible pb-2 hide-scrollbar md:col-span-3 order-2 md:order-none">
          <div className="flex-1 min-w-[160px] bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3 shrink-0">
             <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-xl shrink-0">💰</div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold">رصيدك</p>
               <p className="text-sm font-black text-slate-900 leading-none">12,450 <span className="text-[9px]">جم</span></p>
             </div>
          </div>
          <div className="flex-1 min-w-[160px] bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3 shrink-0">
             <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl shrink-0">⭐</div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold">تقييمك</p>
               <p className="text-sm font-black text-slate-900 leading-none">4.9 <span className="text-[9px]">/ 5</span></p>
             </div>
          </div>
          <Link to="/buyer/wishlist" className="flex-1 min-w-[160px] bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3 shrink-0 hover:bg-rose-50 transition-colors">
             <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center text-xl shrink-0">❤️</div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold">المحفوظات</p>
               <p className="text-sm font-black text-slate-900 leading-none">{wishlist.length} <span className="text-[9px]">عروض</span></p>
             </div>
          </Link>
        </div>

        {/* Active Requests Main Feed */}
        <div className="md:col-start-4 md:col-span-6 md:row-start-1 md:row-span-4 order-3 md:order-none">
          <section className="bg-white border-2 border-[var(--color-primary)]/10 rounded-3xl p-5 shadow-sm h-full flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-[var(--color-primary)] font-display">طلبات نشطة</h2>
              <Link to="/buyer/orders" className="text-[10px] font-bold text-slate-500 underline">عرض السجل</Link>
            </div>
            
            <div className="space-y-3 flex-1 overflow-auto hide-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-sm font-bold">جاري المزامنة...</p>
                </div>
              ) : activeRequests.length > 0 ? (
                activeRequests.map(req => (
                  <Link key={req.id} to={`/buyer/request/${req.id}`} className="block bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-start justify-between hover:bg-slate-100 transition-colors relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-1 h-full bg-[var(--color-danger)]"></div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 leading-tight">{req.productName}</h3>
                      <p className="text-[10px] text-slate-600 mt-1">الكمية: {req.quantity} {req.unit}</p>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-[var(--color-danger)] mt-2">
                        <Clock className="w-3 h-3" />
                        <span>نشط حالياً</span>
                      </div>
                    </div>
                    <div className="text-center bg-white px-3 py-2 rounded-xl border border-slate-200 min-w-[65px]">
                      {req.status === 'active' ? (
                        <>
                          <span className="block text-lg font-black text-[var(--color-primary)] leading-none">{req.bidsCount || 0}</span>
                          <span className="block text-[8px] font-bold text-slate-400 mt-1">عروض</span>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1 py-1">
                           <span className="text-[8px] font-bold text-green-600">طلب مؤكد</span>
                           <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                  <Package className="w-10 h-10 mb-3 opacity-10" />
                  <p className="text-sm font-bold">ابدأ بطلب خاماتك الآن</p>
                  <Link to="/buyer/request/new" className="text-xs text-[var(--color-primary)] font-bold mt-3 px-6 py-2 bg-white border border-[var(--color-primary)]/20 rounded-full shadow-sm">طلب صناعي جديد</Link>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Offers Feed Header & Grid */}
        <div className="md:col-span-12 order-4 md:order-none mt-4 md:mt-0">
          <section className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-black font-display text-lg text-slate-900">أقوى عروض اليوم</h3>
                  <p className="text-[10px] text-slate-400 font-bold">خامات بأقل الأسعار لفترة محدودة</p>
                </div>
                <Link to="/buyer/offers" className="text-xs text-[var(--color-primary)] font-bold flex items-center bg-white px-3 py-1.5 rounded-full border border-slate-200">
                  الكل <ChevronLeft className="w-4 h-4 mr-1" />
                </Link>
             </div>

             <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
                {offers.map(offer => (
                  <div key={offer.id} className="min-w-[280px] md:min-w-[320px] bg-white border border-slate-200 rounded-2xl p-3 flex gap-3 snap-start hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden shrink-0 relative flex items-center justify-center">
                      <img 
                        src={offer.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(offer.title)}&background=f1f5f9&color=64748b`} 
                        alt={offer.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-0 right-0 bg-[var(--color-danger)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg z-10 animate-pulse">-{offer.discount}</div>
                      <button onClick={(e) => { e.preventDefault(); toggleWishlist(offer.id); }} className="absolute bottom-1 right-1 p-1.5 bg-white/90 rounded-lg text-rose-500 shadow-sm transition-transform active:scale-90">
                        <Heart className={cn("w-3.5 h-3.5", wishlist.includes(offer.id) ? "fill-current" : "")} />
                      </button>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 line-clamp-1">{offer.title}</h4>
                        <Link to={`/buyer/supplier/${offer.supplierId}`} className="text-[10px] text-[var(--color-primary)] font-bold mt-1 inline-block hover:underline">{offer.supplierName}</Link>
                      </div>
                      <div className="flex items-end justify-between">
                         <div className="flex flex-col">
                            <span className="text-[var(--color-danger)] font-black text-base leading-none">{offer.offerPrice} <span className="text-[9px]">جم</span></span>
                            <span className="text-[9px] text-slate-400 line-through mt-0.5">{offer.originalPrice} جم</span>
                         </div>
                         <button 
                           onClick={() => { setSelectedOffer(offer); setShowOrderModal(true); requestLocation(); }} 
                           className="bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-xl hover:bg-slate-800"
                         >
                           اطلب الآن
                         </button>
                      </div>
                    </div>
                  </div>
                ))}
                {offers.length === 0 && (
                  <div className="w-full text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 italic font-bold">
                    لا توجد عروض ترويجية نشطة حالياً
                  </div>
                )}
             </div>
          </section>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showOrderModal && selectedOffer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900">تأكيد طلب العرض</h2>
              <button onClick={() => setShowOrderModal(false)} className="bg-slate-200 p-2 rounded-full text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-5 text-right">
               <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-4">
                 <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-3xl shrink-0">✨</div>
                 <div className="flex-1">
                   <h3 className="font-bold text-slate-800">{selectedOffer.title}</h3>
                   <p className="text-xs text-green-700 font-bold mt-1">السعر الموفر: {selectedOffer.offerPrice} ج.م</p>
                 </div>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 block">الكمية المطلوبة ({selectedOffer.unit})</label>
                   <input 
                     type="number" 
                     value={orderQuantity} 
                     onChange={(e) => setOrderQuantity(e.target.value)} 
                     className="w-full border border-slate-200 rounded-xl p-3 text-right font-black focus:ring-2 focus:ring-green-500 outline-none"
                   />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 block">عنوان التوصيل</label>
                   <input 
                     type="text" 
                     value={orderAddress} 
                     onChange={(e) => setOrderAddress(e.target.value)} 
                     placeholder="ادخل عنوانك بالتفصيل..."
                     className="w-full border border-slate-200 rounded-xl p-3 text-right font-bold focus:ring-2 focus:ring-green-500 outline-none"
                   />
                 </div>
                 <div>
                   <button onClick={requestLocation} className={cn("w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all", location ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-600")}>
                     {isGettingLocation ? <Loader2 size={14} className="animate-spin"/> : <MapPin size={14}/>}
                     {location ? 'تم تحديد الموقع بنجاح' : 'تحديد بموقعي الجغرافي الحالي'}
                   </button>
                 </div>
               </div>

               <div className="pt-4 border-t border-slate-100 mt-2">
                 <button 
                  onClick={handleOrder}
                  disabled={!!isOrdering || !orderQuantity || !orderAddress}
                  className="w-full bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:shadow-green-200 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
                 >
                   {isOrdering ? <Loader2 className="animate-spin"/> : <CheckCircle2 size={22}/>}
                   {isOrdering ? 'جاري إرسال الطلب...' : 'تأكيد وإتمام الشراء'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

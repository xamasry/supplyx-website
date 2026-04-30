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
      <div className="flex flex-col md:grid md:grid-cols-12 md:auto-rows-min gap-4 md:gap-6 relative">
        
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

        {/* Stats Cards - ORIGINAL BENTO POSITIONING */}
        <div className="flex md:flex-col gap-4 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 hide-scrollbar md:col-start-1 md:col-span-3 md:row-start-3 md:row-span-2 order-2 md:order-none">
          <div className="flex-1 min-w-[180px] md:min-w-0 bg-white border border-slate-300 rounded-3xl p-5 shadow-sm flex items-center justify-center gap-3 xl:gap-4 hover:border-[var(--color-primary)] transition-all hover:shadow-md shrink-0 group/card">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-[#27AE60]/10 text-[#27AE60] rounded-2xl flex items-center justify-center text-xl md:text-2xl shrink-0 group-hover/card:scale-110 transition-transform">💰</div>
            <div>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-0.5">رصيد المشتريات</p>
              <p className="text-lg xl:text-2xl font-black text-slate-900 leading-tight">
                 12,450 <span className="text-[10px] md:text-sm font-bold text-slate-400">جم</span>
              </p>
            </div>
          </div>
          
          <Link 
            to="/buyer/wishlist"
            className="flex-1 min-w-[180px] md:min-w-0 bg-white border border-slate-300 rounded-3xl p-5 shadow-sm flex items-center justify-center gap-3 xl:gap-4 hover:border-[var(--color-primary)] transition-all hover:shadow-md shrink-0 group/card"
          >
            <div className="w-10 h-10 md:w-14 md:h-14 bg-[#EB5757]/10 text-[#EB5757] rounded-2xl flex items-center justify-center text-xl md:text-2xl shrink-0 group-hover/card:scale-110 transition-transform">❤️</div>
            <div>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-0.5">العروض المحفوظة</p>
              <p className="text-lg xl:text-2xl font-black text-slate-900 leading-tight">
                 {wishlist.length} <span className="text-[10px] md:text-sm font-bold text-slate-400">عروض</span>
              </p>
            </div>
          </Link>
        </div>

        {/* Active Requests Feed - ORIGINAL BENTO POSITIONING (Center) */}
        <div className="md:col-start-4 md:col-span-6 md:row-start-1 md:row-span-4 order-3 md:order-none">
          <section className="bg-white border-2 border-[var(--color-primary)]/10 rounded-3xl p-6 shadow-sm h-full flex flex-col min-h-[400px]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-primary)] font-display">طلباتي النشطة</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <p className="text-xs text-slate-500 font-bold">تحديث فوري للعروض</p>
                </div>
              </div>
              <Link to="/buyer/orders" className="text-xs font-bold text-slate-400 hover:text-[var(--color-primary)] transition-colors underline decoration-slate-200">سجل الطلبات</Link>
            </div>
            
            <div className="space-y-3 flex-1 overflow-auto hide-scrollbar pb-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-[var(--color-primary)] opacity-40" />
                  <p className="text-sm font-bold animate-pulse">جاري جلب بياناتك...</p>
                </div>
              ) : activeRequests.length > 0 ? (
                activeRequests.map(req => (
                  <Link 
                    key={req.id} 
                    to={`/buyer/request/${req.id}`} 
                    className="block bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-start justify-between hover:bg-slate-100 transition-colors relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-[var(--color-danger)]"></div>
                    <div>
                      <h3 className="font-bold text-sm md:text-base text-slate-900 group-hover:text-[var(--color-primary)] transition-colors">{req.productName}</h3>
                      <p className="text-xs text-slate-500 font-bold mt-1">الكمية المطلوبة: {req.quantity} {req.unit}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[10px] bg-white border border-slate-200 px-2.5 py-1 rounded-full font-bold text-slate-500 flex items-center gap-1.5">
                           <Clock className="w-3 h-3" />
                           منذ {convertArabicNumerals(Math.floor((Date.now() - (req.createdAt?.toMillis?.() || Date.now())) / 60000).toString())} دقيقة
                        </span>
                      </div>
                    </div>
                    <div className="text-center bg-white px-4 py-2.5 rounded-xl border-2 border-slate-100 group-hover:border-[var(--color-primary)]/20 transition-all flex flex-col items-center justify-center min-w-[70px]">
                      {req.status === 'active' ? (
                        <>
                          <span className="block text-xl font-black text-[var(--color-primary)] leading-none">{req.bidsCount || 0}</span>
                          <span className="block text-[10px] font-bold text-slate-400 mt-1 uppercase">عروض</span>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                           <CheckCircle2 className="w-5 h-5 text-green-500" />
                           <span className="text-[10px] font-bold text-green-600">طلب جاهز</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 pb-10">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-4">
                     <Package className="w-10 h-10 opacity-10" />
                  </div>
                  <p className="text-sm font-bold text-slate-500">لا يوجد طلبات نشطة حالياً</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[180px] text-center font-medium">ابدأ بطلب خاماتك الآن ليصلك عروض الموردين</p>
                  <Link to="/buyer/request/new" className="mt-6 px-8 py-3 bg-[var(--color-primary)] text-white rounded-2xl font-bold text-sm shadow-lg hover:shadow-green-100 transition-all">اطلب الآن</Link>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Categories Section - ORIGINAL BENTO POSITIONING (Right) */}
        <div className="md:col-start-10 md:col-span-3 md:row-start-1 md:row-span-4 order-4 md:order-none">
          <section className="bg-[var(--color-primary)] text-white rounded-3xl p-6 shadow-sm flex flex-col h-full bg-gradient-to-br from-[var(--color-primary)] to-[#1E824C]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold font-display">التصنيفات</h3>
              <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/20">
                <Search size={16} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 flex-1">
              {CATEGORIES.slice(0, 8).map((c) => (
                <Link 
                  key={c.id} 
                  to={`/buyer/products?cat=${c.id}`} 
                  className="bg-white/10 hover:bg-white/20 transition-all rounded-2xl p-4 flex flex-col items-center justify-center text-center group border border-white/5"
                >
                  <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">{c.icon}</span>
                  <span className="text-[11px] font-bold leading-tight opacity-90">{c.name}</span>
                </Link>
              ))}
              <Link
                to="/buyer/request/new"
                className="col-span-2 bg-white text-[var(--color-primary)] p-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-sm hover:bg-slate-50 transition-all mt-2"
              >
                <span>تصفح الكل</span>
                <ChevronLeft size={16} />
              </Link>
            </div>
          </section>
        </div>

        {/* Trusted Suppliers Storefronts - ENSURE VISIBILITY ON MOBILE */}
        <div className="md:col-span-12 order-5">
           <section className="bg-white border border-slate-300 rounded-3xl p-5 md:p-6 shadow-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold font-display text-lg text-slate-900 border-r-4 border-[var(--color-primary)] pr-2">موردينا الموثوقين</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">تصفح المتاجر المعتمدة</p>
            </div>
            
            <div className="flex overflow-x-auto gap-4 pb-2 snap-x hide-scrollbar min-h-[120px]">
              {loadingSuppliers ? (
                <div className="w-full flex items-center justify-center py-8 text-slate-400 font-bold text-xs gap-2">
                   <Loader2 size={16} className="animate-spin" />
                   جاري تحميل القائمة...
                </div>
              ) : suppliers.length > 0 ? (
                suppliers.map(s => (
                  <Link 
                    key={s.id} 
                    to={`/buyer/supplier/${s.id}`} 
                    className="min-w-[120px] md:min-w-[140px] flex flex-col items-center group snap-start"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-2xl border-2 border-slate-100 group-hover:border-[var(--color-primary)] transition-all p-1.5 overflow-hidden shadow-sm relative">
                      <img 
                        src={s.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.businessName || 'S')}&background=22C55E&color=fff`} 
                        alt={s.businessName} 
                        className="w-full h-full object-cover rounded-xl"
                      />
                      {s.isVerified && <CheckCircle2 className="absolute -top-1 -right-1 w-5 h-5 text-white bg-green-500 rounded-full border-2 border-white p-0.5" />}
                    </div>
                    <p className="mt-2 text-[11px] font-black text-slate-800 text-center line-clamp-1 group-hover:text-[var(--color-primary)]">{s.businessName}</p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-500 font-bold">
                      <Star size={10} className="fill-current" />
                      {s.rating || 4.8}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="w-full py-8 text-center text-slate-400 font-bold text-sm italic">
                   لا يوجد موردين موثوقين حالياً
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Supplier Offers Feed - FULL WIDTH BOTTOM */}
         <div className="md:col-span-12 order-6">
           <section className="bg-slate-50 border border-slate-300 rounded-3xl p-5 md:p-6 shadow-sm overflow-hidden flex flex-col mb-4">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-black font-display text-lg text-slate-900 border-r-4 border-[var(--color-danger)] pr-2">أقوى عروض اليوم</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">خامات بأسعار مخفضة لفترة محدودة</p>
                </div>
                <Link to="/buyer/offers" className="text-xs text-[var(--color-primary)] font-bold flex items-center bg-white px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
                  عرض الكل <ChevronLeft className="w-4 h-4 mr-1" />
                </Link>
              </div>

              <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
                {offers.map(offer => (
                  <div 
                    key={offer.id} 
                    className="min-w-[280px] md:min-w-[320px] bg-white border border-slate-200 rounded-2xl p-3 flex gap-3 snap-start hover:shadow-md transition-all relative overflow-hidden group border-b-4 border-b-[var(--color-danger)]/20"
                  >
                    <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden shrink-0 relative flex items-center justify-center">
                      <img 
                        src={offer.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(offer.title)}&background=f1f5f9&color=64748b`} 
                        alt={offer.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-0 right-0 bg-[var(--color-danger)] text-white text-[10px] font-black px-2 py-1 rounded-bl-lg z-10 shadow-sm">-{offer.discount}</div>
                      <button 
                        onClick={(e) => { e.preventDefault(); toggleWishlist(offer.id); }} 
                        className="absolute bottom-1 right-1 p-1.5 bg-white/90 rounded-lg text-rose-500 shadow-sm transition-transform active:scale-90 hover:bg-white"
                      >
                        <Heart className={cn("w-4 h-4", wishlist.includes(offer.id) ? "fill-current" : "")} />
                      </button>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h4 className="text-sm md:text-base font-black text-slate-900 line-clamp-1 leading-tight">{offer.title}</h4>
                        <Link to={`/buyer/supplier/${offer.supplierId}`} className="text-[10px] text-[var(--color-primary)] font-bold mt-1.5 flex items-center gap-1 hover:underline">
                           <ShoppingBag size={10} />
                           {offer.supplierName}
                        </Link>
                      </div>
                      <div className="flex items-end justify-between mt-2">
                         <div className="flex flex-col">
                            <span className="text-[var(--color-danger)] font-black text-lg leading-none">{offer.offerPrice} <span className="text-[10px]">جم</span></span>
                            <span className="text-[10px] text-slate-400 line-through mt-1 font-bold">{offer.originalPrice} جم</span>
                         </div>
                         <button 
                           onClick={() => { setSelectedOffer(offer); setShowOrderModal(true); requestLocation(); }} 
                           className="bg-slate-900 text-white text-[10px] font-black px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
                         >
                           اطلب الآن
                         </button>
                      </div>
                    </div>
                  </div>
                ))}
                {offers.length === 0 && (
                  <div className="w-full text-center py-12 text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-100 italic font-bold">
                    لا يوجد عروض ترويجية نشطة حالياً
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
    </div>
  );
}

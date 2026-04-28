import { Link } from 'react-router-dom';
import { Search, Flame, Clock, ChevronLeft, Package, Loader2, X, MapPin, Phone, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc, increment, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CATEGORIES } from '../../constants';

export default function BuyerHome() {
  const [requests, setRequests] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;
    let unsubOffers: (() => void) | null = null;
    
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubSnapshot) unsubSnapshot();
      if (unsubOffers) unsubOffers();

      if (!user) {
        setRequests([]);
        setOffers([]);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // Fetch Profile
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        setUserProfile(userSnap.data());
      }

      // Fetch Requests
      const q = query(
        collection(db, 'requests'),
        where('buyerId', '==', user.uid)
      );

      unsubSnapshot = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRequests(data);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'requests');
      });

      // Fetch Offers
      const qOffers = query(collection(db, 'offers'), where('status', '==', 'active'), orderBy('createdAt', 'desc'));
      unsubOffers = onSnapshot(qOffers, (snapshot) => {
        setOffers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error('Error fetching offers:', error);
      });

      // Pass bName to context or state if needed
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
      if (unsubOffers) unsubOffers();
    };
  }, []);

  const navigate = useNavigate();
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
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
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
          console.error('Error updating offer orders count:', err);
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
        console.error('Error sending notification:', err);
      }

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
                <div className="text-center bg-[var(--color-accent)]/10 px-4 py-2 rounded-xl text-[var(--color-accent)] min-w-[70px]">
                  {req.status === 'active' ? (
                    <>
                      <span className="block text-xl font-bold leading-none">
                        {req.bidsCount || 0}
                      </span>
                      <span className="block text-[10px] font-bold mt-1">عروض</span>
                    </>
                  ) : (
                    <>
                      <span className="block text-[10px] font-black leading-tight">
                        {req.status === 'accepted' ? 'تم القبول' : req.status === 'preparing' ? 'جاري التحضير' : 'في الطريق'}
                      </span>
                      <Clock className="w-4 h-4 mx-auto mt-1" />
                    </>
                  )}
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
      <section className="md:col-start-10 md:col-span-3 md:row-start-1 md:row-span-4 bg-[var(--color-primary)] text-white rounded-3xl p-6 shadow-inner flex flex-col items-center overflow-hidden">
        <h3 className="w-full text-lg font-bold mb-4 flex justify-between items-center font-display">
          التصنيفات
          <span className="text-[10px] opacity-60 font-normal">عرض الكل</span>
        </h3>
        <div className="grid grid-cols-2 gap-3 w-full pb-2 overflow-y-auto hide-scrollbar max-h-[500px]">
          {CATEGORIES.map((c, i) => (
            <div 
              key={c.id} 
              onClick={() => navigate(`/buyer/request/new`)}
              className={cn(
                "bg-white/10 p-3 lg:p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/20 transition-colors transform hover:scale-95 active:scale-90",
                i === CATEGORIES.length - 1 && "text-[var(--color-accent)]"
              )}
            >
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
          {offers.map(offer => (
            <div key={offer.id} className="min-w-[280px] md:min-w-[320px] bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl p-3 flex gap-3 snap-start hover:border-[var(--color-primary)] transition-colors">
              <div className="w-20 h-20 bg-white rounded-xl relative overflow-hidden shrink-0 flex items-center justify-center border border-slate-100">
                {offer.image ? (
                  <img 
                    src={offer.image} 
                    alt={offer.title} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                
                <div className={cn(
                  "flex flex-col items-center justify-center",
                  offer.image ? "hidden" : ""
                )}>
                  <span className="text-3xl filter drop-shadow-sm">
                    {offer.categoryIcon || CATEGORIES.find(c => c.id === offer.categoryId || c.name === offer.category)?.icon || '✨'}
                  </span>
                </div>

                <div className="absolute top-0 right-0 bg-[var(--color-danger)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg rounded-tr-xl z-10">خصم {offer.discount}</div>
              </div>
              <div className="flex-1 flex flex-col justify-between text-right">
                <div>
                  <p className="text-sm font-bold text-slate-900 line-clamp-1 leading-tight">{offer.title}</p>
                  <p className="text-xs text-slate-500 font-medium">المورد: {offer.supplierName}</p>
                </div>
                <div className="flex justify-between items-end mt-1">
                  <div className="flex flex-col">
                     <div className="flex items-center gap-1">
                       <span className="text-[var(--color-danger)] font-bold">{offer.offerPrice} ج.م</span>
                       {offer.unit && (
                         <span className="text-[9px] text-slate-500 font-medium">/ {offer.quantity || 1} {offer.unit}</span>
                       )}
                     </div>
                     <span className="text-[10px] text-slate-400 line-through">{offer.originalPrice} ج</span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedOffer(offer);
                      setOrderQuantity(String(offer.quantity || 1));
                      setOrderAddress(userProfile?.address || '');
                      setOrderPhone(userProfile?.phone || '');
                      setShowOrderModal(true);
                      requestLocation();
                    }}
                    disabled={!!isOrdering}
                    className="text-[10px] bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-xl font-bold hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
                  >
                    اطلب الآن
                  </button>
                </div>
              </div>
            </div>
          ))}
          {offers.length === 0 && (
            <div className="w-full text-center py-6 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 italic">
               لا توجد عروض ترويجية نشطة حالياً من الموردين
            </div>
          )}
        </div>
      </section>

      {/* Order Confirmation Modal */}
      {showOrderModal && selectedOffer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="relative h-32 bg-[var(--color-primary)] flex items-center justify-center overflow-hidden">
               <div className="absolute inset-0 opacity-10">
                 <div className="absolute top-0 left-0 w-24 h-24 bg-white rounded-full -mt-12 -ml-12" />
                 <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full -mb-16 -mr-16" />
               </div>
               <h2 className="text-white text-2xl font-black relative z-10">تأكيد طلب العرض</h2>
               <button 
                 onClick={() => setShowOrderModal(false)}
                 className="absolute top-6 left-6 bg-white/20 hover:bg-white/30 p-2 rounded-full text-white transition-colors"
                >
                 <X className="w-5 h-5" />
               </button>
            </div>

            <div className="p-8 space-y-6 text-right">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-3xl shrink-0">
                  {selectedOffer.categoryIcon || CATEGORIES.find(c => c.id === selectedOffer.categoryId || c.name === selectedOffer.category || c.name === selectedOffer.categoryName)?.icon || '✨'}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 leading-tight">{selectedOffer.title}</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">السعر: {selectedOffer.offerPrice} ج.م / {selectedOffer.quantity} {selectedOffer.unit}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center justify-end gap-2">
                    الكمية المطلوبة ({selectedOffer.unit})
                    <ShoppingBag className="w-4 h-4 text-[var(--color-primary)]" />
                  </label>
                  <input 
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-right font-black focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center justify-end gap-2">
                    عنوان التوصيل
                    <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
                  </label>
                  <input 
                    type="text"
                    value={orderAddress}
                    onChange={(e) => setOrderAddress(e.target.value)}
                    placeholder="ادخل عنوان التوصيل بالتفصيل..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-right font-bold focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 flex items-center justify-end gap-2">
                    رقم الهاتف للتواصل
                    <Phone className="w-4 h-4 text-[var(--color-primary)]" />
                  </label>
                  <input 
                    type="tel"
                    value={orderPhone}
                    onChange={(e) => setOrderPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-right font-black focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all font-mono"
                  />
                </div>

                <div className="pt-2">
                  {!location ? (
                    <button 
                      onClick={requestLocation}
                      disabled={isGettingLocation}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all border border-slate-200"
                    >
                      {isGettingLocation ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" />
                      )}
                      {isGettingLocation ? 'جاري تحديد موقعك...' : 'تحديد موقعي الحالي للتوصيل بدقة'}
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-green-50 text-green-700 rounded-2xl text-xs font-bold border border-green-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      تم تحديد موقعك بنجاح
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-6 px-2">
                  <span className="text-2xl font-black text-[var(--color-primary)]">
                    {((Number(selectedOffer.offerPrice) * Number(orderQuantity)) / (Number(selectedOffer.quantity) || 1)).toFixed(2)} ج.م
                  </span>
                  <span className="text-slate-500 font-black">إجمالي المبلغ التقريبي</span>
                </div>

                <button 
                  onClick={handleOrder}
                  disabled={!orderQuantity || !orderAddress || !orderPhone || !!isOrdering}
                  className="w-full bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-[var(--color-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
                >
                  {isOrdering ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
                  )}
                  {isOrdering ? 'جاري الطلب...' : 'تأكيد وإرسال الطلب'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

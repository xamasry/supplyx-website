import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Flame, Tag, Loader2, CheckCircle2, X, MapPin, Phone, ShoppingBag } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc, increment, getDoc } from 'firebase/firestore';

import { CATEGORIES } from '../../constants';

export default function BuyerOffers() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) setUserProfile(snap.data());
      }
    });

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

    return () => {
      unsubscribe();
      unsubAuth();
    };
  }, []);

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         offer.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           offer.categoryId === selectedCategory || 
                           offer.category === selectedCategory ||
                           offer.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group offers by category for the "all" view, sorted by newest offer in each category
  const categoriesWithOffers = CATEGORIES.filter(cat => 
    offers.some(o => o.categoryId === cat.id || o.categoryName === cat.name || o.category === cat.name)
  ).sort((a, b) => {
    const firstA = offers.find(o => o.categoryId === a.id || o.category === a.name || o.categoryName === a.name);
    const firstB = offers.find(o => o.categoryId === b.id || o.category === b.name || o.categoryName === b.name);
    if (!firstA) return 1;
    if (!firstB) return -1;
    return offers.indexOf(firstA) - offers.indexOf(firstB);
  });

  // Newest offers (top 6 across all categories)
  const newestOffers = offers.slice(0, 6);

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
        // We don't toast error here to avoid being annoying, 
        // but we can show a UI state if needed.
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
          // Don't fail the whole request if just the counter fails
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
        // Don't fail the whole request if just notification fails
      }

      toast.success('تم إرسال الطلب بنجاح!');
      setShowOrderModal(false);
    } catch (error) {
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

      <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar -mx-2 px-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={cn(
            "px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border shadow-sm",
            selectedCategory === 'all' 
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] scale-105" 
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          )}
        >
          الكل ✨
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border shadow-sm flex items-center gap-2",
              selectedCategory === cat.id 
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] scale-105" 
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            )}
          >
            <span>{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm font-bold">جاري تحميل العروض...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {selectedCategory === 'all' && !searchTerm ? (
            <>
              {/* Newest Arrivals Section */}
              {newestOffers.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black flex items-center gap-2 text-slate-800">
                      <span className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-xl">🆕</span>
                      أحدث العروض الحصرية
                    </h2>
                    <span className="text-xs font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-full animate-pulse">وصل حديثاً</span>
                  </div>
                  <div className="flex overflow-x-auto gap-4 pb-4 -mx-2 px-2 hide-scrollbar snap-x">
                    {newestOffers.map((offer, idx) => (
                      <div key={`newest-${offer.id || idx}`} className="min-w-[280px] md:min-w-[320px] snap-start">
                        <OfferCard offer={offer} isOrdering={isOrdering} handleOrder={() => {
                          setSelectedOffer(offer);
                          setOrderQuantity(String(offer.quantity || 1));
                          setOrderAddress(userProfile?.address || '');
                          setOrderPhone(userProfile?.phone || '');
                          setShowOrderModal(true);
                          requestLocation();
                        }} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Show sections for each category */}
              {categoriesWithOffers.map(cat => {
                const categoryOffers = offers.filter(o => o.categoryId === cat.id || o.categoryName === cat.name || o.category === cat.name);
                if (categoryOffers.length === 0) return null;
                
                return (
                  <section key={cat.id} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black flex items-center gap-2 text-slate-800">
                        <span className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-xl">{cat.icon}</span>
                        {cat.name}
                      </h2>
                      <span className="text-xs font-bold text-slate-400 border border-slate-200 px-3 py-1 rounded-full">{categoryOffers.length} عرض</span>
                    </div>
                    <div className="flex overflow-x-auto gap-4 pb-4 -mx-2 px-2 hide-scrollbar snap-x">
                      {categoryOffers.map(offer => (
                        <div key={offer.id} className="min-w-[280px] md:min-w-[320px] snap-start">
                          <OfferCard offer={offer} isOrdering={isOrdering} handleOrder={() => {
                            setSelectedOffer(offer);
                            setOrderQuantity(String(offer.quantity || 1));
                            setOrderAddress(userProfile?.address || '');
                            setOrderPhone(userProfile?.phone || '');
                            setShowOrderModal(true);
                            requestLocation();
                          }} />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </>
          ) : (
            // Show flat filtered list
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOffers.map(offer => (
                <OfferCard key={offer.id} offer={offer} isOrdering={isOrdering} handleOrder={() => {
                  setSelectedOffer(offer);
                  setOrderQuantity(String(offer.quantity || 1));
                  setOrderAddress(userProfile?.address || '');
                  setOrderPhone(userProfile?.phone || '');
                  setShowOrderModal(true);
                  requestLocation();
                }} />
              ))}
              {filteredOffers.length === 0 && (
                <div className="col-span-full text-center py-20 text-slate-500 flex flex-col items-center">
                  <Tag className="w-12 h-12 text-slate-300 mb-3 opacity-20" />
                  <p className="font-bold">لا توجد عروض تناسب اختياراتك حالياً</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

// Sub-component for Offer Card to keep code clean
function OfferCard({ offer, isOrdering, handleOrder }: { offer: any, isOrdering: string | null, handleOrder: () => void, key?: any }) {
  return (
    <div className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-sm hover:border-[var(--color-primary)] transition-colors flex flex-col">
      <div className="h-44 bg-slate-100 relative overflow-hidden group flex items-center justify-center">
        {offer.image ? (
          <img 
            src={offer.image} 
            alt={offer.title} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.classList.add('bg-[var(--color-brand-bg)]');
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        
        <div className={cn(
          "flex flex-col items-center justify-center gap-2 transition-all duration-300",
          offer.image ? "hidden absolute inset-0 bg-slate-50/80 backdrop-blur-[2px]" : ""
        )}>
          <span className="text-6xl filter drop-shadow-lg transform group-hover:scale-125 transition-transform duration-300">
            {offer.categoryIcon || CATEGORIES.find(c => c.id === offer.categoryId || c.name === offer.category || c.name === offer.categoryName)?.icon || '✨'}
          </span>
          {!offer.image && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{offer.categoryName || offer.category || 'منتج عام'}</span>
          )}
        </div>

        <div className="absolute top-3 right-3 bg-[var(--color-danger)] text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg z-10">خصم {offer.discount}</div>
        <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-slate-900 text-[10px] font-bold px-2 py-1 rounded shadow-sm z-10 border border-slate-200">⏳ عرض محدود</div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-bold text-lg text-slate-900 leading-tight mb-1">{offer.title}</h3>
        <p className="text-xs text-slate-500 font-semibold flex items-center gap-1 mb-4">
          <Tag className="w-3.5 h-3.5" />
          المورد: {offer.supplierName}
        </p>
        
        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="block text-[10px] text-slate-400 line-through font-bold">{offer.originalPrice} ج.م</span>
            <div className="flex items-baseline gap-1">
              <span className="block font-bold text-xl text-[var(--color-primary)] leading-none">{offer.offerPrice} <span className="text-xs">ج.م</span></span>
              {offer.unit && (
                <span className="text-[11px] font-bold text-slate-500">/ {offer.quantity || 1} {offer.unit}</span>
              )}
            </div>
          </div>
          <button 
            disabled={!!isOrdering}
            onClick={() => handleOrder()}
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
  );
}

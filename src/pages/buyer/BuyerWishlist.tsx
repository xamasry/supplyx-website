import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ChevronLeft, ShoppingBag, Loader2, Star, Trash2 } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { doc, onSnapshot, getDocs, collection, query, where, updateDoc, arrayRemove } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { CATEGORIES } from '../../constants';

export default function BuyerWishlist() {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Watch user profile for wishlist changes
      const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          const ids = snap.data().wishlist || [];
          setWishlistIds(ids);
          
          // 2. Fetch the actual offers
          if (ids.length > 0) {
            fetchWishlistOffers(ids);
          } else {
            setOffers([]);
            setLoading(false);
          }
        }
      });

      return () => unsubProfile();
    });

    return () => unsubAuth();
  }, []);

  const fetchWishlistOffers = async (ids: string[]) => {
    try {
      // Note: Firestore 'in' query supports up to 10 items.
      // For more, we might need multiple queries or alternate storage.
      // But for a simple wishlist, this is usually okay for MVP.
      const chunks = [];
      for (let i = 0; i < ids.length; i += 10) {
        chunks.push(ids.slice(i, i + 10));
      }

      const allOffers: any[] = [];
      for (const chunk of chunks) {
        const q = query(collection(db, 'offers'), where('__name__', 'in', chunk));
        const snap = await getDocs(q);
        snap.forEach(doc => allOffers.push({ id: doc.id, ...doc.data() }));
      }
      
      setOffers(allOffers);
    } catch (err) {
      console.error('Error fetching wishlist offers:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (offerId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        wishlist: arrayRemove(offerId)
      });
      toast.success('تم الإزالة من المفضلة');
    } catch (err) {
      console.error('Error removing from wishlist:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
        <p className="mt-4 text-slate-500 font-bold">جاري تحميل المفضلة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">المفضلة</h1>
        <Link to="/buyer/home" className="p-2 bg-white border border-slate-100 rounded-full text-slate-500">
          <ChevronLeft className="w-5 h-5" />
        </Link>
      </div>

      {offers.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8" />
          </div>
          <h2 className="font-bold text-slate-900 mb-2">قائمة المفضلة فارغة</h2>
          <p className="text-slate-500 text-sm mb-6">لم تقم بإضافة أي عروض إلى المفضلة بعد.</p>
          <Link to="/buyer/home" className="inline-flex py-3 px-8 bg-[var(--color-primary)] text-white font-bold rounded-2xl">
            استكشف العروض الآن
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {offers.map(offer => (
            <div key={offer.id} className="bg-white rounded-[2.5rem] p-4 border border-slate-100 shadow-sm flex gap-5 relative group overflow-hidden">
              {/* Image Section */}
              <div className="w-28 h-28 bg-slate-100 rounded-3xl overflow-hidden flex-shrink-0 border border-slate-200 flex items-center justify-center relative">
                {(offer.image || offer.imageUrl) ? (
                  <img 
                    src={offer.image || offer.imageUrl} 
                    alt={offer.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent) {
                        parent.classList.add('bg-slate-50');
                        parent.querySelector('.category-fallback')?.classList.remove('hidden');
                      }
                    }}
                  />
                ) : null}
                
                <div className={cn(
                  "category-fallback flex flex-col items-center justify-center",
                  (offer.image || offer.imageUrl) ? "hidden" : ""
                )}>
                  <span className="text-4xl filter drop-shadow-sm transform group-hover:scale-125 transition-transform">
                    {offer.categoryIcon || CATEGORIES.find((c: any) => c.id === offer.categoryId || c.name === offer.category)?.icon || '✨'}
                  </span>
                </div>
              </div>
              
              {/* Content Section */}
              <div className="flex-1 flex flex-col justify-between py-1 text-right">
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="font-black text-slate-900 text-lg leading-tight line-clamp-1">{offer.title}</h3>
                    <button 
                      onClick={() => removeFromWishlist(offer.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors shrink-0 mr-2"
                      title="إزالة من المفضلة"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500 font-bold">{offer.supplierName}</p>
                    {offer.supplierRating && (
                      <div className="flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-lg text-[10px] font-black text-amber-600 border border-amber-100">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {Number(offer.supplierRating).toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-between mt-auto">
                  <div className="flex flex-col">
                    <span className="text-lg font-black text-[var(--color-primary)] leading-none">{offer.offerPrice} <span className="text-[10px]">ج.م</span></span>
                    <span className="text-[10px] text-slate-400 font-bold mt-1 tracking-tight">لكل {offer.quantity || 1} {offer.unit}</span>
                  </div>
                  <Link 
                    to={`/buyer/home?offerId=${offer.id}`} 
                    className="px-5 h-12 bg-slate-900 shadow-[0_8px_16px_rgba(0,0,0,0.1)] text-white rounded-2xl flex items-center justify-center gap-2 hover:bg-[var(--color-primary)] transition-all font-bold group/btn"
                  >
                    <span className="text-sm">اطلب الآن</span>
                    <ShoppingBag className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Discount Badge */}
              {offer.discount && (
                <div className="absolute top-4 left-4 bg-[var(--color-danger)] text-white text-[10px] font-black px-3 py-1 rounded-xl shadow-md rotate-[-5deg]">
                  خصم {offer.discount}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

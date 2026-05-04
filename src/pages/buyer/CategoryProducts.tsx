import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, MapPin, Loader2, Star, CheckCircle2, ShieldCheck, Tag, Store, Package } from 'lucide-react';
import { cn, getCategoryImageUrl } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { CATEGORIES } from '../../constants';

export default function CategoryProducts() {
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('cat');
  const category = CATEGORIES.find(c => c.id === categoryId);
  const categoryName = category?.name;

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    if (!categoryName) {
      setLoadingSuppliers(false);
      setLoadingOffers(false);
      setLoadingProducts(false);
      return;
    }

    let unsubSuppliers: (() => void) | null = null;
    let unsubOffers: (() => void) | null = null;
    let unsubProducts: (() => void) | null = null;

    // Fetch trusted suppliers filtered by category
    const qSuppliers = query(
      collection(db, 'users'), 
      where('role', '==', 'supplier'), 
      where('isTrusted', '==', true),
      where('specialties', 'array-contains', categoryName),
      limit(10)
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
      // Fallback: fetch all trusted if category filter yields nothing or fails
      const qAllTrusted = query(
        collection(db, 'users'),
        where('role', '==', 'supplier'),
        where('isTrusted', '==', true),
        limit(5)
      );
      onSnapshot(qAllTrusted, (snap) => {
        setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingSuppliers(false);
      });
    });

    // Fetch Offers in this category
    const qOffers = query(
      collection(db, 'offers'),
      where('status', '==', 'active'),
      limit(20)
    );
    
    unsubOffers = onSnapshot(qOffers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Filter by category name
      const categoryOffers = data.filter(o => o.category === categoryName || o.categoryName === categoryName);
      categoryOffers.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setOffers(categoryOffers);
      setLoadingOffers(false);
    }, (err) => {
      setLoadingOffers(false);
    });

    const qProducts = query(
      collection(db, 'products'),
      where('category', '==', categoryName)
    );
    unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const availableProducts = data.filter(p => p.available === true);
      setProducts(availableProducts);
      setLoadingProducts(false);
    }, (err) => {
      setLoadingProducts(false);
    });

    return () => {
      if (unsubSuppliers) unsubSuppliers();
      if (unsubOffers) unsubOffers();
      if (unsubProducts) unsubProducts();
    };
  }, [categoryName]);

  if (!category) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 font-bold mb-4">عذراً، التصنيف غير موجود</p>
        <Link to="/buyer/home" className="text-[var(--color-primary)] font-black underline">العودة للرئيسية</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 space-y-10">
      {/* Header with improved navigation */}
      <div className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-4">
          <Link to="/buyer/home" className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 hover:text-[var(--color-primary)] transition-all shadow-sm">
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <span className="text-4xl">{category.icon}</span> 
              <span>{category.name}</span>
            </h1>
            <p className="text-xs text-slate-400 font-bold mt-1 pr-14">كل ما تحتاجه في قسم {category.name}</p>
          </div>
        </div>
      </div>

      {/* 1. Trusted Clients Section (Prominent) */}
      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 overflow-hidden relative group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full -mr-20 -mt-20 group-hover:bg-emerald-500/10 transition-colors" />
         <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3">
               <div className="w-2 h-8 bg-emerald-500 rounded-full" />
               <h3 className="text-xl font-black text-slate-900">عملاء {category.name} الموثوقين</h3>
            </div>
            <div className="hidden sm:flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-emerald-500" />
               <span className="text-xs font-bold text-slate-400">موردين معتمدين من المنصة</span>
            </div>
         </div>
         
         <div className="flex overflow-x-auto gap-8 py-4 hide-scrollbar relative z-10">
           {loadingSuppliers ? (
             <div className="flex flex-col items-center justify-center w-full py-10 text-slate-300">
               <Loader2 className="animate-spin mb-2 w-8 h-8" />
               <p className="text-xs font-bold">جاري البحث عن كبار الموردين...</p>
             </div>
           ) : suppliers.length > 0 ? (
             suppliers.map(s => (
               <Link key={s.id} to={`/buyer/supplier/${s.id}`} className="flex flex-col items-center min-w-[120px] group/item">
                 <div className="w-20 h-20 rounded-3xl bg-white border border-slate-100 flex items-center justify-center p-3 group-hover/item:border-emerald-500 group-hover/item:shadow-xl group-hover/item:shadow-emerald-500/10 group-hover/item:-translate-y-1 transition-all relative">
                   <img 
                    src={s.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.businessName || 'S')}&background=22C55E&color=fff`} 
                    alt={s.businessName} 
                    className="w-full h-full object-contain rounded-2xl"
                   />
                   {s.subscriptionTier === 'premium' && (
                     <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-1 rounded-xl border-2 border-white shadow-md">
                       <Star size={10} fill="currentColor" />
                     </div>
                   )}
                   {s.isTrusted && (
                     <div className="absolute -bottom-2 -left-2 bg-blue-500 text-white p-1 rounded-full border-2 border-white shadow-md">
                       <CheckCircle2 size={10} />
                     </div>
                   )}
                 </div>
                 <p className="text-xs font-bold text-slate-700 mt-3 text-center line-clamp-1 group-hover/item:text-emerald-600 transition-colors uppercase tracking-tight">{s.businessName}</p>
               </Link>
             ))
           ) : (
             <div className="text-center w-full py-10">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                 <Store size={24} />
               </div>
               <p className="text-xs text-slate-400 font-bold italic">لا يوجد موردين موثوقين متاحين حالياً لهذا القسم</p>
             </div>
           )}
         </div>
      </section>

      {/* 2. Offers Section */}
      <section className="w-full space-y-6">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-3">
             <div className="w-2 h-6 bg-rose-500 rounded-full" />
             <h3 className="text-xl font-black text-slate-900">أقوى عروض {category.name}</h3>
          </div>
          <p className="text-[10px] font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">توفير يصل لـ ٤٠٪</p>
        </div>

        {loadingOffers ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-[2rem] animate-pulse" />)}
           </div>
        ) : offers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.map(offer => (
              <Link 
                to={`/buyer/supplier/${offer.supplierId}`}
                key={offer.id} 
                className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all flex flex-col group"
              >
                <div className="h-44 bg-slate-50 relative overflow-hidden">
                  <img 
                    src={offer.image || getCategoryImageUrl(offer.categoryName || offer.category, CATEGORIES)} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    alt={offer.title}
                  />
                  <div className="absolute top-4 right-4 bg-rose-500 text-white text-xs font-black px-3 py-1 rounded-xl shadow-lg ring-4 ring-white/20">-{offer.discount}</div>
                  {offer.isExclusive && (
                    <div className="absolute top-4 left-4 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-xl shadow-lg flex items-center gap-1">
                      <Star size={10} fill="currentColor" />
                      <span>حصري</span>
                    </div>
                  )}
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-black text-lg text-slate-900 line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">{offer.title}</h4>
                    <p className="text-sm text-slate-500 font-bold mt-1 line-clamp-1 flex items-center gap-1">
                      <Store size={14} className="text-slate-300" />
                      {offer.supplierName}
                    </p>
                  </div>
                  <div className="flex justify-between items-end mt-6">
                    <div>
                      <p className="text-[10px] text-slate-300 font-bold line-through ml-1">{Number(offer.offerPrice) + 100} جم</p>
                      <span className="text-rose-500 font-black text-2xl">{offer.offerPrice} <span className="text-xs">جم</span></span>
                    </div>
                    <div className="bg-slate-900 text-white p-3 rounded-2xl group-hover:bg-[var(--color-primary)] transition-colors shadow-lg shadow-slate-900/10 group-hover:shadow-[var(--color-primary)]/20">
                      <ChevronLeft size={20} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-12 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 text-slate-200">
              <Tag size={40} />
            </div>
            <h4 className="font-black text-slate-700 text-lg mb-2">لا توجد عروض نشطة حالياً</h4>
            <p className="text-sm text-slate-400 max-w-md font-medium">لم يقم موردو {category.name} بإضافة حصص مخفضة اليوم. تابعنا للحصول على التحديثات.</p>
          </div>
        )}
      </section>

      {/* 3. Products Grid Section */}
      <section className="w-full space-y-6">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-3">
             <div className="w-2 h-6 bg-[var(--color-primary)] rounded-full" />
             <h3 className="text-xl font-black text-slate-900">منتجات {category.name} المتوفرة</h3>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{products.length} منتج</span>
        </div>

        {loadingProducts ? (
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
             {[1,2,3,4,5].map(i => <div key={i} className="aspect-[3/4] bg-slate-100 rounded-[2rem] animate-pulse" />)}
           </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {products.map(product => (
              <Link 
                to={`/buyer/supplier/${product.supplierId}`}
                key={product.id} 
                className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all group flex flex-col"
              >
                <div className="aspect-square bg-slate-50 flex items-center justify-center text-slate-200 overflow-hidden relative">
                  <img 
                    src={product.image || getCategoryImageUrl(product.category, CATEGORIES)} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">{product.name}</h3>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{product.unit}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1">
                      <Store size={10} className="text-slate-300" />
                      {product.supplierName}
                    </p>
                  </div>
                  
                  <div className="mt-5 flex items-center justify-between">
                     <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                       <span className="text-[var(--color-primary)] font-display font-black text-base">
                         {product.price}<span className="text-[10px] mr-0.5">ج.م</span>
                       </span>
                     </div>
                     
                     <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center group-hover:bg-[var(--color-primary)] transition-all shadow-lg shadow-slate-900/10 group-hover:shadow-[var(--color-primary)]/20 active:scale-90">
                       <ChevronLeft className="w-5 h-5" />
                     </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-16 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 text-slate-200 shadow-sm">
              <Package size={40} />
            </div>
            <h4 className="font-black text-slate-700 text-lg mb-2">القسم شاغر حالياً</h4>
            <p className="text-sm text-slate-400 max-w-sm font-medium">لم نجد منتجات متاحة للشراء المباشر في قسم {category.name}. يمكنك طلب "خامة مخصصة" لتصلك عروض خاصة.</p>
            <Link to="/buyer/request/new" className="mt-8 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:shadow-xl transition-all active:scale-95">طلب خامة مخصصة</Link>
          </div>
        )}
      </section>
    </div>
  );
}

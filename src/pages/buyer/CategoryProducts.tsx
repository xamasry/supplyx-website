import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, MapPin, Loader2, Star, CheckCircle2, ShieldCheck, Tag } from 'lucide-react';
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

    // Fetch trusted suppliers (we'll show top premium/trusted suppliers globally, but Ideally filter by categories if they exist)
    const qSuppliers = query(
      collection(db, 'users'), 
      where('role', '==', 'supplier'), 
      where('isTrusted', '==', true),
      limit(10)
    );
    unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      data.sort((a, b) => {
        if (a.subscriptionTier === 'premium' && b.subscriptionTier !== 'premium') return -1;
        if (a.subscriptionTier !== 'premium' && b.subscriptionTier === 'premium') return 1;
        return 0;
      });
      // Try to filter by category if they have specialties or just show them
      setSuppliers(data);
      setLoadingSuppliers(false);
    }, (err) => {
      setLoadingSuppliers(false);
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
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-24 overflow-x-hidden space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/buyer/home" className="p-2 -mr-2 bg-white rounded-xl text-slate-600 hover:bg-slate-50">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <span>{category.icon}</span> {category.name}
        </h1>
      </div>

      {/* Trusted Suppliers Section */}
      <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 w-full">
         <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 pr-3 border-r-4 border-emerald-500">عملاء {category.name} الموثوقين</h3>
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

      {/* Offers Section */}
      <section className="w-full">
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="text-base font-black text-slate-900">أقوى عروض {category.name} المتاحة</h3>
        </div>

        {loadingOffers ? (
           <div className="flex flex-col items-center justify-center py-10"><Loader2 className="animate-spin text-slate-400 mb-2" /><span className="text-xs text-slate-500">جاري تحميل العروض...</span></div>
        ) : offers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {offers.map(offer => (
              <Link 
                to={`/buyer/supplier/${offer.supplierId}`}
                key={offer.id} 
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
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
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{offer.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{offer.supplierName}</p>
                  </div>
                  <div className="flex justify-between items-end mt-3">
                    <div>
                      <span className="text-rose-500 font-black text-lg">{offer.offerPrice} <span className="text-[10px]">جم</span></span>
                    </div>
                    <button 
                      className="bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800"
                    >
                      تصفح عروض التاجر
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center">
            <Tag size={32} className="text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-700 text-sm mb-1">لا توجد عروض متاحة حالياً</h4>
            <p className="text-xs text-slate-500 max-w-sm">لم يقم الموردون بإضافة عروض جديدة في قسم {category.name} بعد. تابعنا باستمرار للحصول على أقوى الصفقات.</p>
          </div>
        )}
      </section>

      {/* Products Section */}
      <section className="w-full">
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="text-base font-black text-slate-900">منتجات {category.name}</h3>
        </div>

        {loadingProducts ? (
           <div className="flex flex-col items-center justify-center py-10"><Loader2 className="animate-spin text-slate-400 mb-2" /><span className="text-xs text-slate-500">جاري تحميل المنتجات...</span></div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
            {products.map(product => (
              <Link 
                to={`/buyer/supplier/${product.supplierId}`}
                key={product.id} 
                className="bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
              >
                <div className="aspect-square bg-slate-50 flex items-center justify-center text-slate-200 overflow-hidden">
                  <img 
                    src={product.image || getCategoryImageUrl(product.category, CATEGORIES)} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                  />
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{product.name}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">/ {product.unit}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{product.supplierName}</p>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between">
                     <span className="text-[var(--color-primary)] font-display font-black text-sm">
                       {product.price}ج
                     </span>
                     
                     <div className="flex items-center">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 hover:bg-[var(--color-primary)] hover:text-white transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </div>
                     </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center mb-10">
            <Tag size={32} className="text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-700 text-sm mb-1">لا توجد منتجات متاحة</h4>
            <p className="text-xs text-slate-500 max-w-sm">لا توجد منتجات مضافة في قسم {category.name} حالياً. جرب البحث في تصنيف آخر.</p>
          </div>
        )}
      </section>
    </div>
  );
}

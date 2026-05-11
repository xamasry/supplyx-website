import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, Package, MapPin, Star, Phone, ChevronLeft, ShoppingBag, Plus, Minus, X, Loader2, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc, limit, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { SupplierStoreProduct, User, Unit } from '../../types';
import { cn, getCategoryImageUrl } from '../../lib/utils';
import toast from 'react-hot-toast';
import { useCart } from '../../context/CartContext';

import { CATEGORIES as APP_CATEGORIES } from '../../constants';

const CATEGORIES = APP_CATEGORIES.map(c => c.name);

export default function SupplierStore() {
  const { id: supplierId } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<User | null>(null);
  const [products, setProducts] = useState<SupplierStoreProduct[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { cart, addItem, removeItem, updateQuantity } = useCart();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) return;

    // Fetch Supplier Details
    const fetchSupplier = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', supplierId));
        if (docSnap.exists()) {
          setSupplier({ id: docSnap.id, ...docSnap.data() } as User);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${supplierId}`);
      }
    };

    fetchSupplier();

    // Fetch Products
    const qProducts = query(
      collection(db, 'products'),
      where('supplierId', '==', supplierId),
      where('available', '==', true)
    );

    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      // Only set products if supplier is premium
      if (supplier && supplier.subscriptionTier !== 'premium') {
        setProducts([]);
        return;
      }
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SupplierStoreProduct[];
      setProducts(data);
      setLoading(false);
    });

    // Fetch Offers
    const qOffers = query(
      collection(db, 'offers'),
      where('supplierId', '==', supplierId),
      limit(5)
    );

    const unsubOffers = onSnapshot(qOffers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOffers(data);
    });

    // Fetch Units
    const unsubUnits = onSnapshot(collection(db, 'units'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Unit[];
      setUnits(data);
    });

    return () => {
      unsubProducts();
      unsubOffers();
      unsubUnits();
    };
  }, [supplierId, supplier?.subscriptionTier]);

  const handleAddToCart = async (product: SupplierStoreProduct, levelIndex: number = -1) => {
    if (!auth.currentUser) {
      toast.error('يرجى تسجيل الدخول أولاً');
      return;
    }

    const level = levelIndex === -1 
      ? null 
      : product.packagingLevels?.[levelIndex];

    const itemDocId = `${product.id}-${level ? level.id : 'base'}`;
    setIsAdding(itemDocId);

    try {
      await addItem({
        productId: product.id,
        supplierId: product.supplierId,
        productName: product.name,
        image: product.image,
        packagingLevelId: level ? level.id : 'base',
        packagingLevelName: level ? level.name : 'الوحدة الأساسية',
        unitId: level ? level.unitId : product.baseUnitId,
        price: level ? level.price : product.basePrice,
        quantity: 1
      });
      toast.success(`تم إضافة ${product.name} للسلة`);
    } catch (err) {
      toast.error('فشل إضافة المنتج للسلة');
    } finally {
      setIsAdding(null);
    }
  };

  const getItemInCart = (productId: string, levelId: string = 'base') => {
    return cart?.items.find(i => i.productId === productId && i.packagingLevelId === levelId);
  };

  const handleOfferOrder = async (offer: any) => {
    if (!auth.currentUser || !supplier) return;
    
    if (!window.confirm(`هل أنت متأكد من طلب "${offer.title}" بسعر ${offer.offerPrice} ج.م؟`)) return;

    setLoading(true);
    try {
      const buyerDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const buyerData = buyerDoc.data();

      const orderData = {
        buyerId: auth.currentUser.uid,
        buyerName: buyerData?.businessName || auth.currentUser.displayName,
        buyerPhone: buyerData?.phoneNumber || '',
        supplierId: supplierId,
        supplierName: supplier.businessName,
        items: [{
          productId: offer.id,
          name: offer.title,
          quantity: offer.quantity || 1,
          unit: offer.unit || 'قطعة',
          price: offer.offerPrice
        }],
        totalAmount: offer.offerPrice,
        status: 'pending',
        type: 'exclusive_offer_order',
        offerId: offer.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Update offer orders count
      await updateDoc(doc(db, 'offers', offer.id), {
        orders: (offer.orders || 0) + 1
      });

      // Notify Supplier
      await addDoc(collection(db, 'notifications'), {
        userId: supplierId,
        title: 'طلب عرض حصري جديد',
        message: `وصلك طلب على العرض الحصري "${offer.title}" من ${orderData.buyerName}`,
        type: 'offer_order',
        read: false,
        createdAt: serverTimestamp(),
        link: `/supplier/orders/${orderRef.id}`
      });

      toast.success('تم إرسال طلبك للعرض بنجاح!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedProducts = CATEGORIES.reduce((acc, cat) => {
    const catProducts = filteredProducts.filter(p => p.category === cat);
    if (catProducts.length > 0) {
      acc[cat] = catProducts;
    }
    return acc;
  }, {} as Record<string, SupplierStoreProduct[]>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <span className="font-bold">جاري تحميل المتجر...</span>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 font-bold">عذراً، المورد غير موجود</p>
        <Link to="/buyer/home" className="text-[var(--color-primary)] font-black mt-4 block underline">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      {/* Supplier Profile Card */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-2xl overflow-hidden border-2 border-white shadow-md mb-4">
          <img 
            src={supplier.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(supplier.businessName)}&background=22C55E&color=fff`} 
            alt={supplier.businessName} 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-display font-black text-slate-900 leading-none">{supplier.businessName}</h1>
          {supplier.isVerified && (
            <ShieldCheck size={20} className="text-emerald-500 fill-emerald-500/10" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1 text-[var(--color-accent)] font-bold text-sm bg-[var(--color-accent)]/5 px-3 py-1 rounded-full">
            <Star size={14} className="fill-current" />
            {supplier.rating || 4.5}
          </div>
          <div className="flex items-center gap-1 text-slate-500 font-bold text-sm bg-slate-50 px-3 py-1 rounded-full">
            <Package size={14} />
            {supplier.totalOrders || 0} طلب
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 text-[11px] font-bold text-slate-400">
          <MapPin size={12} />
          {supplier.businessAddress}
        </div>
        {supplier.description && (
          <p className="text-slate-500 text-xs mt-4 leading-relaxed max-w-sm">
            {supplier.description}
          </p>
        )}
      </div>

      {/* Offers Section */}
      {offers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-display font-bold text-slate-900">عروض حصرية</h2>
            <div className="flex-1 h-px bg-[var(--color-accent)]/20"></div>
            <span className="text-[10px] font-black bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-lg text-[var(--color-accent)] uppercase tracking-wider">خصومات محدودة</span>
          </div>
          
          <div className="flex flex-nowrap overflow-x-auto gap-4 pb-4 snap-x pr-1 scrollbar-none">
            {offers.map((offer) => (
                  <div key={offer.id} className="min-w-[280px] bg-slate-900 rounded-[2rem] p-5 relative overflow-hidden group snap-start border border-white/10">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--color-accent)] blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity" />
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <span className="text-[10px] font-black text-[var(--color-accent)] uppercase tracking-[0.2em] mb-1 block">عرض خاص</span>
                        <h4 className="text-white font-bold text-lg leading-tight mb-2">{offer.title}</h4>
                        <p className="text-slate-400 text-xs line-clamp-2">{offer.description || 'عرض حصري لهذا اليوم'}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-2">المخزون المتاح: {offer.stock || 0} {offer.unit}</p>
                      </div>
                      <div className="mt-4 flex flex-col gap-4">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-slate-500 text-[10px] font-bold line-through">{offer.originalPrice} ج.م</p>
                            <p className="text-white text-xl font-display font-black leading-none">{offer.offerPrice} <span className="text-xs">ج.م</span></p>
                          </div>
                          <div className="bg-[var(--color-accent)] text-slate-900 px-3 py-1.5 rounded-xl font-black text-xs shadow-lg shadow-[var(--color-accent)]/20">
                            وفر {Math.round((1 - offer.offerPrice / offer.originalPrice) * 100)}%
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleOfferOrder(offer)}
                          disabled={loading || offer.stock <= 0}
                          className="w-full bg-white text-slate-900 hover:bg-[var(--color-accent)] transition-colors py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                          <ShoppingBag size={18} />
                          {offer.stock > 0 ? 'طلب العرض الآن' : 'نفذت الكمية'}
                        </button>
                      </div>
                    </div>
                  </div>
            ))}
          </div>
        </section>
      )}

      {/* Sticky Filters */}
      <div className="sticky top-20 z-30 bg-[#F8FAFC]/80 backdrop-blur-md py-2 space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="ابحث في منتجات المورد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl pr-10 pl-4 py-3 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button 
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
              !selectedCategory ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-100"
            )}
          >
            الكل
          </button>
          {CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                selectedCategory === cat ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-100"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Groups */}
      <div className="space-y-10">
        {supplier && supplier.subscriptionTier !== 'premium' ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">كتالوج المنتج متاح للمشتركين المميزين فقط</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">هذا المورد لم يقم بترقية حسابه للباقة المميزة بعد، لذا لا يمكن عرض قائمة منتجاته للجمهور حالياً.</p>
          </div>
        ) : Object.entries(groupedProducts).length > 0 ? (
          Object.entries(groupedProducts).map(([category, catProducts]) => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-display font-bold text-slate-900">{category}</h2>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {catProducts.map(product => (
                  <div key={product.id} className="bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-slate-50 flex items-center justify-center text-slate-200 overflow-hidden">
                      <img 
                        src={product.image || getCategoryImageUrl(product.category, APP_CATEGORIES)} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      />
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{product.name}</h3>
                      <div className="flex justify-between items-center mt-0.5">
                        <p className="text-[10px] text-slate-400 font-semibold">/ {units.find(u => u.id === product.baseUnitId)?.abbreviation || 'وحدة'}</p>
                        <p className="text-[9px] text-slate-400 font-bold">المخزون: {product.stock || 0}</p>
                      </div>
                      
                      <div className="mt-3 space-y-2">
                        {/* Base Unit Pricing */}
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl">
                          <div className="flex flex-col">
                            <span className="text-[var(--color-primary)] font-display font-black text-xs">
                              {product.basePrice}ج <span className="text-[8px] text-slate-400">/ {units.find(u => u.id === product.baseUnitId)?.abbreviation || 'وحدة'}</span>
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {getItemInCart(product.id, 'base') ? (
                              <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
                                <button 
                                  onClick={() => updateQuantity(getItemInCart(product.id, 'base')!.id, Math.max(1, getItemInCart(product.id, 'base')!.quantity - 1))}
                                  className="w-5 h-5 flex items-center justify-center text-slate-400"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-5 text-center text-[10px] font-bold">{getItemInCart(product.id, 'base')!.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(getItemInCart(product.id, 'base')!.id, getItemInCart(product.id, 'base')!.quantity + 1)}
                                  className="w-5 h-5 flex items-center justify-center text-primary-500"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleAddToCart(product)}
                                disabled={isAdding === `${product.id}-base`}
                                className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:border-primary-500 hover:text-primary-500 transition-all"
                              >
                                {isAdding === `${product.id}-base` ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Packaging Levels Pricing */}
                        {product.packagingLevels?.map((level, idx) => (
                          <div key={level.id} className="flex items-center justify-between bg-slate-100/50 p-2 rounded-xl border border-slate-100">
                            <div className="flex flex-col">
                              <span className="text-slate-700 font-bold text-[10px]">{level.name}</span>
                              <span className="text-[var(--color-primary)] font-black text-[10px]">
                                {level.price}ج
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {getItemInCart(product.id, level.id) ? (
                                <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
                                  <button 
                                    onClick={() => updateQuantity(getItemInCart(product.id, level.id)!.id, Math.max(1, getItemInCart(product.id, level.id)!.quantity - 1))}
                                    className="w-5 h-5 flex items-center justify-center text-slate-400"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="w-5 text-center text-[10px] font-bold">{getItemInCart(product.id, level.id)!.quantity}</span>
                                  <button 
                                    onClick={() => updateQuantity(getItemInCart(product.id, level.id)!.id, getItemInCart(product.id, level.id)!.quantity + 1)}
                                    className="w-5 h-5 flex items-center justify-center text-primary-500"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => handleAddToCart(product, idx)}
                                  disabled={isAdding === `${product.id}-${level.id}`}
                                  className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:border-primary-500 hover:text-primary-500 transition-all font-bold"
                                >
                                  {isAdding === `${product.id}-${level.id}` ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 text-slate-400 italic">لا توجد منتجات متاحة حالياً</div>
        )}
      </div>
    </div>
  );
}

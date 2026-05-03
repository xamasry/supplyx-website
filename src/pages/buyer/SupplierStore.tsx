import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, Package, MapPin, Star, Phone, ChevronLeft, ShoppingBag, Plus, Minus, X, Loader2, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc, limit, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { SupplierStoreProduct, User } from '../../types';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

import { CATEGORIES as APP_CATEGORIES } from '../../constants';

const CATEGORIES = APP_CATEGORIES.map(c => c.name);

const CATEGORY_IMAGES: Record<string, string> = {
  'لحوم ودواجن': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&q=80&w=200',
  'خضار وفاكهة': 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&q=80&w=200',
  'ألبان وأجبان': 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&q=80&w=200',
  'حبوب وبقوليات': 'https://images.unsplash.com/photo-1551462147-37885acc3c41?auto=format&fit=crop&q=80&w=200',
  'زيوت وتوابل': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=200',
  'معلبات': 'https://images.unsplash.com/photo-1595231712325-9fdec2147879?auto=format&fit=crop&q=80&w=200',
  'توابل وبهارات': 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&q=80&w=200',
  'مجمدات': 'https://images.unsplash.com/photo-1584263343327-cc599f161724?auto=format&fit=crop&q=80&w=200',
  'أخرى': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200'
};

export default function SupplierStore() {
  const { id: supplierId } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<User | null>(null);
  const [products, setProducts] = useState<SupplierStoreProduct[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, { product: SupplierStoreProduct, quantity: number }>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

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
      setLoading(false);
    });

    return () => {
      unsubProducts();
      unsubOffers();
    };
  }, [supplierId]);

  const updateCart = (product: SupplierStoreProduct, delta: number) => {
    setCart(prev => {
      const current = prev[product.id] || { product, quantity: 0 };
      const newQty = Math.max(0, current.quantity + delta);
      
      if (newQty === 0) {
        const { [product.id]: _, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [product.id]: { ...current, quantity: newQty }
      };
    });
  };

  const cartTotal = Object.values(cart).reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const cartItemsCount = Object.values(cart).reduce((acc, item) => acc + item.quantity, 0);

  const handleCheckout = async () => {
    if (!auth.currentUser || cartItemsCount === 0) return;
    
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
        items: Object.values(cart).map(item => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          unit: item.product.unit,
          price: item.product.price
        })),
        totalAmount: cartTotal,
        status: 'pending',
        type: 'direct_catalog_order',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Notify Supplier
      await addDoc(collection(db, 'notifications'), {
        userId: supplierId,
        title: 'طلب شراء جديد',
        message: `وصلك طلب شراء مباشر من ${orderData.buyerName} بقيمة ${cartTotal} ج.م`,
        type: 'product_order',
        read: false,
        createdAt: serverTimestamp(),
        link: `/supplier/orders/${orderRef.id}`
      });

      toast.success('تم إرسال طلبك للمورد بنجاح!');
      setCart({});
      setIsCartOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    } finally {
      setLoading(false);
    }
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
              <motion.div 
                key={offer.id}
                whileHover={{ y: -5 }}
                className="min-w-[280px] bg-slate-900 rounded-[2rem] p-5 relative overflow-hidden group snap-start border border-white/10"
              >
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--color-accent)] blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <span className="text-[10px] font-black text-[var(--color-accent)] uppercase tracking-[0.2em] mb-1 block">عرض خاص</span>
                    <h4 className="text-white font-bold text-lg leading-tight mb-2">{offer.title}</h4>
                    <p className="text-slate-400 text-xs line-clamp-2">{offer.description || 'عرض حصري لهذا اليوم'}</p>
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
                      disabled={loading}
                      className="w-full bg-white text-slate-900 hover:bg-[var(--color-accent)] transition-colors py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      <ShoppingBag size={18} />
                      طلب العرض الآن
                    </button>
                  </div>
                </div>
              </motion.div>
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
                        src={product.image || CATEGORY_IMAGES[product.category] || CATEGORY_IMAGES['أخرى']} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      />
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{product.name}</h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">/ {product.unit}</p>
                      
                      <div className="mt-3 flex items-center justify-between">
                         <span className="text-[var(--color-primary)] font-display font-black text-sm">
                           {product.price}ج
                         </span>
                         
                         <div className="flex items-center bg-slate-50 rounded-xl p-0.5">
                            {cart[product.id] ? (
                              <>
                                <button 
                                  onClick={() => updateCart(product, -1)}
                                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-6 text-center text-xs font-bold text-slate-900">{cart[product.id].quantity}</span>
                                <button 
                                  onClick={() => updateCart(product, 1)}
                                  className="w-6 h-6 flex items-center justify-center text-[var(--color-primary)]"
                                >
                                  <Plus size={14} />
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => updateCart(product, 1)}
                                className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                              >
                                <Plus size={18} />
                              </button>
                            )}
                         </div>
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

      {/* Cart Summary Header/Button */}
      {cartItemsCount > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-40 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--color-primary)] rounded-xl flex items-center justify-center relative">
              <ShoppingBag size={20} />
              <span className="absolute -top-1.5 -right-1.5 bg-white text-slate-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {cartItemsCount}
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 leading-none">إجمالي السلة</p>
              <p className="text-lg font-display font-black leading-tight mt-1">{cartTotal.toLocaleString()} ج.م</p>
            </div>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={loading}
            className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-lg shadow-[var(--color-primary)]/20 active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال طلبك'}
          </button>
        </div>
      )}
    </div>
  );
}

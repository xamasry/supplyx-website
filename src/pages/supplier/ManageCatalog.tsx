import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, LayoutGrid, List, ChevronRight, X, Loader2, Image as ImageIcon, Send, Clock, Tag, Eye, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc, orderBy } from 'firebase/firestore';
import { SupplierStoreProduct } from '../../types';
import toast from 'react-hot-toast';
import { cn, getCategoryImageUrl } from '../../lib/utils';
import SubscriptionModal from '../../components/SubscriptionModal';
import ImageUpload from '../../components/ui/ImageUpload';
import { useNavigate, Link } from 'react-router-dom';

import { monitor } from '../../lib/monitor';

import { CATEGORIES as APP_CATEGORIES } from '../../constants';

const CATEGORIES = APP_CATEGORIES.map(c => c.name);

export default function ManageCatalog() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<SupplierStoreProduct[]>([]);
  const [exclusiveOffers, setExclusiveOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'exclusive_offers'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierStoreProduct | null>(null);
  const [editingOffer, setEditingOffer] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'كجم',
    category: CATEGORIES[0],
    available: true,
    image: ''
  });

  const [offerFormData, setOfferFormData] = useState({
    title: '',
    description: '',
    discountedPrice: '',
    originalPrice: '',
    validUntil: '',
    productId: '',
    image: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', auth.currentUser!.uid));
        if (snap.exists()) setUserData(snap.data());
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };
    fetchProfile();

    const q = query(
      collection(db, 'products'),
      where('supplierId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SupplierStoreProduct[];
      setProducts(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const qOffers = query(
      collection(db, 'offers'),
      where('supplierId', '==', auth.currentUser.uid)
    );

    const unsubOffers = onSnapshot(qOffers, (snapshot) => {
      const o = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      // Sort in memory to avoid index requirements and show all data
      setExclusiveOffers(o.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return timeB - timeA;
      }));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'offers');
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubOffers();
    };
  }, []);

  const handleDeleteOffer = async (offer: any) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    try {
      await deleteDoc(doc(db, 'offers', offer.id));
      toast.success('تم حذف العرض بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `offers/${offer.id}`);
    }
  };

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    // RESTRICTION: Only Premium suppliers can publish offers
    if (userData?.subscriptionTier !== 'premium') {
      toast.error('عذراً، لا يمكن نشر العروض الترويجية إلا لمشتركي الباقة المميزة (Premium)');
      setIsSubscriptionModalOpen(true);
      return;
    }

    const offerData = {
      title: offerFormData.title.trim(),
      description: offerFormData.description.trim(),
      offerPrice: parseFloat(offerFormData.discountedPrice),
      originalPrice: parseFloat(offerFormData.originalPrice),
      supplierId: auth.currentUser.uid,
      supplierName: userData?.businessName || 'مورد',
      image: offerFormData.image.trim() || null,
      unit: 'قطعة', // Default for this modal
      quantity: 1,
      status: 'active',
      views: 0,
      orders: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingOffer) {
        await updateDoc(doc(db, 'offers', editingOffer.id), {
          ...offerData,
          updatedAt: serverTimestamp(),
        });
        toast.success('تم تحديث العرض بنجاح');
      } else {
        await addDoc(collection(db, 'offers'), offerData);
        monitor.logConversion('Offer Created', 1);
        toast.success('تم نشر العرض بنجاح');
      }
      closeOfferModal();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'offers');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    // Check for Premium status
    if (userData?.subscriptionTier !== 'premium') {
      toast.error('إضافة المنتجات للكتالوج متاحة فقط لمشتركي الباقة المميزة (Premium)');
      setIsSubscriptionModalOpen(true);
      return;
    }

    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    const supplierName = userDoc.exists() ? userDoc.data().businessName : auth.currentUser.displayName;

    const productData = {
      ...formData,
      price: parseFloat(formData.price),
      supplierId: auth.currentUser.uid,
      supplierName: supplierName || 'مورد',
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString(),
        });
        monitor.logConversion('Product Added', 1);
        toast.success('تم إضافة المنتج بنجاح');
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('تم حذف المنتج');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const openModal = (product?: SupplierStoreProduct) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        unit: product.unit,
        category: product.category,
        available: product.available,
        image: product.image || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        unit: 'كجم',
        category: CATEGORIES[0],
        available: true,
        image: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const openOfferModal = (offer?: any) => {
    if (offer) {
      setEditingOffer(offer);
      setOfferFormData({
        title: offer.title,
        description: offer.description,
        discountedPrice: (offer.offerPrice || 0).toString(),
        originalPrice: (offer.originalPrice || 0).toString(),
        validUntil: offer.validUntil || '',
        productId: offer.productId || '',
        image: offer.image || ''
      });
    } else {
      setEditingOffer(null);
      setOfferFormData({
        title: '',
        description: '',
        discountedPrice: '',
        originalPrice: '',
        validUntil: '',
        productId: '',
        image: ''
      });
    }
    setIsOfferModalOpen(true);
  };

  const closeOfferModal = () => {
    setIsOfferModalOpen(false);
    setEditingOffer(null);
  };

  const groupedProducts = products.reduce((acc, p) => {
    const cat = CATEGORIES.includes(p.category) ? p.category : 'أخرى';
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, SupplierStoreProduct[]>);

  // Filter based on search and selected category
  const finalGroupedProducts = Object.entries(groupedProducts).reduce((acc, [cat, catProducts]) => {
    if (selectedCategory && cat !== selectedCategory) return acc;
    
    const filtered = catProducts.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filtered.length > 0) {
      acc[cat] = filtered;
    }
    return acc;
  }, {} as Record<string, SupplierStoreProduct[]>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <span className="font-bold text-sm">جاري تحميل كتالوج المنتجات...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-2 sm:px-0">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 leading-none">
            {activeTab === 'exclusive_offers' ? 'إدارة العروض' : 'كتالوج المنتجات'}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-2 font-semibold">
            {activeTab === 'exclusive_offers' 
              ? 'وفر خصومات لجذب المزيد من الطلبات والمبيعات' 
              : 'إدارة قائمة منتجاتك وتصنيفات المتجر الخاص بك'}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'exclusive_offers' && (
            <button 
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                "px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shrink-0",
                isEditMode 
                  ? "bg-[var(--color-primary)] text-white scale-105" 
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              )}
            >
              <Settings2 size={18} />
              {isEditMode ? 'إلغاء التعديل' : 'تعديل العروض'}
            </button>
          )}
          <button 
            onClick={activeTab === 'products' ? () => openModal() : () => openOfferModal()}
            className="bg-[var(--color-success)] text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm sm:text-base shrink-0 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            {activeTab === 'products' ? 'منتج جديد' : 'عرض جديد'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl">
        <button 
          onClick={() => setActiveTab('products')}
          className={cn(
            "flex-1 py-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all",
            activeTab === 'products' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          )}
        >
          <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          الكتالوج ({products.length})
        </button>
        <button 
          onClick={() => setActiveTab('exclusive_offers')}
          className={cn(
            "flex-1 py-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all",
            activeTab === 'exclusive_offers' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          )}
        >
          <Tag className="w-4 h-4 sm:w-5 sm:h-5" />
          العروض ({exclusiveOffers.length})
        </button>
      </div>

      {activeTab === 'products' && (
        <>
          {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="ابحث في منتجاتك..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl pr-10 pl-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button 
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border",
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
                "px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border",
                selectedCategory === cat ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-100"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products List By Category */}
      <div className="space-y-8">
        {Object.entries(finalGroupedProducts).map(([category, catProducts]) => (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-display font-bold text-slate-900">{category}</h2>
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-lg text-slate-500 uppercase tracking-wider">{catProducts.length} منتج</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catProducts.map(product => (
                <div key={product.id} className="bg-white border border-slate-100 rounded-2xl p-3 flex gap-4 group">
                  <div className="w-20 h-20 rounded-xl bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-50 flex items-center justify-center text-slate-300">
                    <img 
                      src={product.image || getCategoryImageUrl(product.category, APP_CATEGORIES)} 
                      alt={product.name} 
                      className="w-full h-full object-cover" 
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-slate-900 truncate pr-2 text-sm sm:text-base">{product.name}</h3>
                        <div className="flex gap-1">
                          <button onClick={() => openModal(product)} className="p-1.5 text-slate-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-all">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(product.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{product.description || 'لا يوجد وصف للمنتج'}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                       <span className="text-[var(--color-primary)] font-display font-black text-sm">
                         {product.price} ج.م <span className="text-[10px] text-slate-400">/ {product.unit}</span>
                       </span>
                       <span className={cn(
                         "text-[10px] font-bold px-2 py-0.5 rounded-full",
                         product.available ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                       )}>
                         {product.available ? 'متوفر' : 'غير متوفر'}
                       </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {Object.keys(finalGroupedProducts).length === 0 && (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
            <Package size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500 font-bold text-sm">لا يوجد منتجات تطابق بحثك</p>
            <button onClick={() => openModal()} className="mt-4 text-[var(--color-primary)] font-black text-sm hover:underline">
              أضف أول منتج الآن
            </button>
          </div>
        )}
      </div>
    </>
  )}

      {activeTab === 'exclusive_offers' && (
        /* Exclusive Offers Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {exclusiveOffers.length > 0 ? (
            exclusiveOffers.map(offer => (
              <motion.div 
                layout
                key={offer.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all group relative flex flex-col"
              >
                {/* Actions Overlay */}
                <div className={cn(
                  "absolute top-4 left-4 z-10 flex gap-2 transition-opacity",
                  isEditMode ? "opacity-100" : "md:opacity-0 group-hover:opacity-100"
                )}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openOfferModal(offer);
                      }}
                      className="p-2 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-[var(--color-primary)] rounded-xl shadow-lg transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOffer(offer);
                      }}
                      className="p-2 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-red-500 rounded-xl shadow-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                </div>

                <div 
                  className="cursor-pointer flex flex-col h-full"
                  onClick={() => openOfferModal(offer)}
                >
                  <div className="aspect-square bg-slate-50 relative overflow-hidden">
                     <img 
                       src={offer.image || getCategoryImageUrl(offer.categoryName || offer.category, APP_CATEGORIES)} 
                       className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" 
                       alt={offer.title} 
                     />
                     {/* Banner / Badge */}
                     <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg">
                        عرض حصري
                     </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base mb-1 group-hover:text-[var(--color-primary)] transition-colors">{offer.title}</h3>
                      <p className="text-[11px] font-semibold text-slate-400 line-clamp-2 leading-relaxed mb-4">{offer.description}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 line-through mb-0.5">{offer.originalPrice} ج.م</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-emerald-600 font-display">{offer.offerPrice}</span>
                            <span className="text-[11px] font-black text-emerald-600">ج.م</span>
                            <span className="text-[10px] font-bold text-slate-400 mr-1">/ قطعة</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                         <div className="flex gap-4">
                            <div className="flex items-center gap-1.5 text-slate-400">
                               <Package size={14} />
                               <span className="text-xs font-black">{offer.orders || 0}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                               <Eye size={14} />
                               <span className="text-[10px] font-bold">{offer.views || 0}</span>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Tag size={40} className="text-slate-200" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">ليس لديك أي عروض حصرية حالياً</h3>
              <p className="text-slate-500 font-semibold text-sm max-w-[280px] mx-auto mb-8">
                ابدأ بإضافة عروضك لزيادة مبيعاتك والوصول لمزيد من العملاء
              </p>
              <button 
                onClick={() => openOfferModal()} 
                className="bg-[var(--color-primary)] text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-[var(--color-primary)]/20 hover:scale-105 transition-all text-sm"
              >
                أنشئ أول عرض الآن
              </button>
            </div>
          )}
        </div>
      )}

      {/* Exclusive Offer Modal */}
      <AnimatePresence>
        {isOfferModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOfferModal}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl p-6 sm:p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-display font-bold text-slate-900">
                  {editingOffer ? 'تعديل العرض الحصري' : 'إنشاء عرض حصري'}
                </h2>
                <button onClick={closeOfferModal} className="p-2 bg-slate-100 text-slate-500 rounded-2xl">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleOfferSubmit} className="space-y-5">
                <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 pr-2 scrollbar-thin">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">عنوان العرض</label>
                    <input 
                      required
                      placeholder="مثال: خصم 20% على اللحوم الطازجة"
                      value={offerFormData.title}
                      onChange={(e) => setOfferFormData({...offerFormData, title: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">وصف العرض</label>
                    <textarea 
                      required
                      value={offerFormData.description}
                      onChange={(e) => setOfferFormData({...offerFormData, description: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">السعر في العرض</label>
                      <input 
                        required
                        type="number"
                        value={offerFormData.discountedPrice}
                        onChange={(e) => setOfferFormData({...offerFormData, discountedPrice: e.target.value})}
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">السعر الأصلي</label>
                      <input 
                        required
                        type="number"
                        value={offerFormData.originalPrice}
                        onChange={(e) => setOfferFormData({...offerFormData, originalPrice: e.target.value})}
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">رابط صورة العرض (اختياري)</label>
                    <input 
                      type="url"
                      value={offerFormData.image}
                      onChange={(e) => setOfferFormData({...offerFormData, image: e.target.value})}
                      placeholder="https://..."
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">صلاحية العرض حتى (اختياري)</label>
                    <input 
                      type="date"
                      value={offerFormData.validUntil}
                      onChange={(e) => setOfferFormData({...offerFormData, validUntil: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  {editingOffer ? (
                    <button 
                      type="button"
                      onClick={() => {
                        handleDeleteOffer(editingOffer);
                        closeOfferModal();
                      }}
                      className="p-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={24} />
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={closeOfferModal}
                      className="flex-1 py-4 text-slate-500 font-bold border-2 border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors"
                    >
                      إلغاء
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-[var(--color-primary)] text-white font-bold rounded-2xl shadow-xl shadow-[var(--color-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {editingOffer ? 'حفظ العرض' : 'نشر العرض'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Tooltip Replacement (Simple React Modal logic) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl p-6 sm:p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-display font-bold text-slate-900">
                  {editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
                </h2>
                <button onClick={closeModal} className="p-2 bg-slate-100 text-slate-500 rounded-2xl">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 pr-2 scrollbar-thin">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">اسم المنتج</label>
                    <input 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">وصف المنتج (اختياري)</label>
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">السعر</label>
                      <input 
                        required
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">الوحدة</label>
                      <select 
                        value={formData.unit}
                        onChange={(e) => setFormData({...formData, unit: e.target.value})}
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                      >
                        <option value="كجم">كيلو جرام</option>
                        <option value="جرام">جرام</option>
                        <option value="قطعة">قطعة</option>
                        <option value="كرتونة">كرتونة</option>
                        <option value="شوال">شوال</option>
                        <option value="لتر">لتر</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 mr-1">التصنيف</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                       {APP_CATEGORIES.map((cat) => (
                         <button
                           key={cat.name}
                           type="button"
                           onClick={() => setFormData({ ...formData, category: cat.name })}
                           className={cn(
                             "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5",
                             formData.category === cat.name
                               ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20"
                               : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                           )}
                         >
                           <span className="text-xl">{cat.icon}</span>
                           <span className="text-[10px] font-bold truncate w-full text-center">{cat.name}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">صورة المنتج</label>
                    <ImageUpload 
                      value={formData.image}
                      onChange={(val) => setFormData({...formData, image: val})}
                      onRemove={() => setFormData({...formData, image: ''})}
                    />
                    <input 
                      type="url"
                      placeholder="أو رابط صورة خارجي (https://...)"
                      value={formData.image}
                      onChange={(e) => setFormData({...formData, image: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3 text-[10px] font-bold text-slate-400 focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer">
                    <div className={cn(
                      "w-10 h-5 rounded-full relative transition-colors",
                      formData.available ? "bg-[var(--color-success)]" : "bg-slate-300"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                        formData.available ? "translate-x-5" : ""
                      )} />
                    </div>
                    <input 
                      type="checkbox"
                      className="hidden"
                      checked={formData.available}
                      onChange={(e) => setFormData({...formData, available: e.target.checked})}
                    />
                    <span className="text-sm font-bold text-slate-700">المنتج متوفر للطلب الآتي</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-4 text-slate-500 font-bold border-2 border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-[var(--color-primary)] text-white font-bold rounded-2xl shadow-xl shadow-[var(--color-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        userRole="supplier"
        currentTier={userData?.subscriptionTier || 'standard'}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, LayoutGrid, List, ChevronRight, X, Loader2, Image as ImageIcon, Send, Clock, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc, orderBy, collectionGroup } from 'firebase/firestore';
import { SupplierStoreProduct } from '../../types';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import SubscriptionModal from '../../components/SubscriptionModal';
import ImageUpload from '../../components/ui/ImageUpload';

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

export default function ManageCatalog() {
  const [products, setProducts] = useState<SupplierStoreProduct[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'offers'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierStoreProduct | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);

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

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchProfile = async () => {
      const snap = await getDoc(doc(db, 'users', auth.currentUser!.uid));
      if (snap.exists()) setUserData(snap.data());
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

    const qBids = query(
      collectionGroup(db, 'bids'),
      where('supplierId', '==', auth.currentUser.uid)
    );

    const unsubBids = onSnapshot(qBids, (snapshot) => {
      const b = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        path: doc.ref.path,
        ...doc.data() 
      }));
      // Sort in memory to include docs without createdAt
      setBids(b.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return timeB - timeA;
      }));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bids');
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubBids();
    };
  }, []);

  const handleDeleteBid = async (bid: any) => {
    if (!window.confirm('هل أنت متأكد من سحب هذا العرض؟')) return;
    try {
      await deleteDoc(doc(db, bid.path));
      toast.success('تم سحب العرض بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, bid.path);
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
        <span className="font-bold">جاري تحميل كتالوج المنتجات...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 leading-none">كتالوج المنتجات</h1>
          <p className="text-slate-500 text-sm mt-1 font-semibold">إدارة قائمة منتجاتك المصنفة</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-[var(--color-primary)] text-white px-4 py-2.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={20} />
          إضافة منتج
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl">
        <button 
          onClick={() => setActiveTab('products')}
          className={cn(
            "flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
            activeTab === 'products' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          )}
        >
          <Package size={18} />
          المنتجات ({products.length})
        </button>
        <button 
          onClick={() => setActiveTab('offers')}
          className={cn(
            "flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
            activeTab === 'offers' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          )}
        >
          <Tag size={18} />
          العروض المقدمة ({bids.length})
        </button>
      </div>

      {activeTab === 'products' ? (
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
                      src={product.image || CATEGORY_IMAGES[product.category] || CATEGORY_IMAGES['أخرى']} 
                      alt={product.name} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-slate-900 truncate pr-2">{product.name}</h3>
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
                       <span className="text-[var(--color-primary)] font-display font-black">
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
            <p className="text-slate-500 font-bold">لا يوجد منتجات تطابق بحثك</p>
            <button onClick={() => openModal()} className="mt-4 text-[var(--color-primary)] font-black text-sm hover:underline">
              أضف أول منتج الآن
            </button>
          </div>
        )}
      </div>
    </>
  ) : (
        /* Offers List */
        <div className="space-y-4">
          {bids.length > 0 ? (
            bids.map(bid => (
              <div key={bid.id} className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[var(--color-primary)]">
                       <Package size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{bid.productName}</h3>
                      <p className="text-[10px] font-bold text-slate-400">طلب من: {bid.buyerName || 'مشتري'}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black text-[var(--color-primary)] font-display">{bid.price} ج.م</p>
                    <p className="text-[10px] font-bold text-slate-400">سعر الوحدة</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2">
                     <Clock className="w-4 h-4 text-slate-400" />
                     <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-400">مدة التوصيل</p>
                       <p className="text-xs font-bold text-slate-700">{bid.deliveryDays} أيام</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Tag className="w-4 h-4 text-slate-400" />
                     <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-400">الكمية</p>
                       <p className="text-xs font-bold text-slate-700">{bid.quantity || 1} {bid.unit || 'وحدة'}</p>
                     </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                   <div className={cn(
                     "px-3 py-1 rounded-lg text-[10px] font-bold",
                     bid.status === 'accepted' ? "bg-green-50 text-green-600" : 
                     bid.status === 'rejected' ? "bg-red-50 text-red-600" : 
                     "bg-amber-50 text-amber-600"
                   )}>
                     {bid.status === 'accepted' ? 'تم القبول' : bid.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}
                   </div>
                   
                   <div className="flex gap-2">
                      <button 
                        onClick={() => handleDeleteBid(bid)}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
                      >
                        سحب العرض
                      </button>
                      <button 
                        onClick={() => window.location.href = `/supplier/request/${bid.requestId}`}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                      >
                        تعديل / تفاصيل
                      </button>
                   </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
              <Send size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-500 font-bold">لم تقم بتقديم أي عروض بعد</p>
              <button onClick={() => window.location.href = '/supplier'} className="mt-4 text-[var(--color-primary)] font-black text-sm hover:underline">
                تصفح طلبات المشترين الآن
              </button>
            </div>
          )}
        </div>
      )}

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
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 mr-1">التصنيف</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
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

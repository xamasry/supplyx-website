import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, ArrowRightLeft, DollarSign, XCircle, Package, CheckCircle2, Image as ImageIcon, Plus, Trash2, Edit2, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc, deleteDoc, serverTimestamp, collectionGroup } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import ImageUpload from '../../components/ui/ImageUpload';
import { CATEGORIES } from '../../constants';

interface UserDetailsModalProps {
  user: any;
  requests: any[];
  onClose: () => void;
}

export default function UserDetailsModal({ user, requests, onClose }: UserDetailsModalProps) {
  const [isEditingLogo, setIsEditingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState(user.profileImageUrl || '');
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [view, setView] = useState<'stats' | 'catalog' | 'offers'>('stats');
  
  const [isUpdatingTrusted, setIsUpdatingTrusted] = useState(false);
  
  // Catalog & Bids Management State
  const [products, setProducts] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingBids, setLoadingBids] = useState(false);
  const [isAddProductMode, setIsAddProductMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    unit: 'كجم',
    category: 'أخرى',
    description: '',
    image: '',
    available: true
  });

  useEffect(() => {
    if (view === 'catalog' && user.role === 'supplier') {
      setLoadingCatalog(true);
      const q = query(collection(db, 'products'), where('supplierId', '==', user.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoadingCatalog(false);
      });
      return () => unsubscribe();
    }
  }, [view, user.id, user.role]);

  useEffect(() => {
    if (view === 'offers' && user.role === 'supplier') {
      setLoadingBids(true);
      const q = query(collectionGroup(db, 'bids'), where('supplierId', '==', user.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
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
        setLoadingBids(false);
      });
      return () => unsubscribe();
    }
  }, [view, user.id, user.role]);

  const toggleTrustedStatus = async () => {
    setIsUpdatingTrusted(true);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        isTrusted: !user.isTrusted,
        updatedAt: serverTimestamp()
      });
      toast.success(user.isTrusted ? 'تم إزالة التوثيق من المورد' : 'تم توثيق المورد بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
    } finally {
      setIsUpdatingTrusted(false);
    }
  };

  const handleUpdateLogo = async () => {
    setIsSavingLogo(true);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        profileImageUrl: logoUrl,
        updatedAt: serverTimestamp()
      });
      toast.success('تم تحديث الشعار بنجاح');
      setIsEditingLogo(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...productForm,
      price: parseFloat(productForm.price),
      supplierId: user.id,
      supplierName: user.businessName || user.name,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), data);
        toast.success('تم تحديث المنتج');
      } else {
        await addDoc(collection(db, 'products'), {
          ...data,
          createdAt: serverTimestamp()
        });
        toast.success('تم إضافة المنتج');
      }
      setIsAddProductMode(false);
      setEditingProduct(null);
      setProductForm({ name: '', price: '', unit: 'كجم', category: 'أخرى', description: '', image: '', available: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('تم حذف المنتج');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const handleDeleteBid = async (bid: any) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    try {
      await deleteDoc(doc(db, bid.path));
      toast.success('تم حذف العرض');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, bid.path);
    }
  };

  const stats = useMemo(() => {
    let salesAmount = 0;
    let purchasesAmount = 0;
    let cancelledAsSupplier = 0;
    let cancelledAsBuyer = 0;
    let completedAsSupplier = 0;
    let completedAsBuyer = 0;
    
    // items bought/sold: name -> count
    const consumedMaterials: Record<string, number> = {};
    const soldMaterials: Record<string, number> = {};

    requests.forEach(r => {
      // User as Buyer
      if (r.buyerId === user.id) {
        if (r.status === 'cancelled') {
          cancelledAsBuyer++;
        }
        if (r.status === 'delivered') {
          completedAsBuyer++;
          purchasesAmount += (r.totalAmount || r.price || 0);

          let items = r.items || [];
          if (items.length === 0 && r.productName) {
            items = [{ productName: r.productName, quantity: r.quantity || 1 }];
          }
          items.forEach((item: any) => {
            const name = item.productName || item.name || 'عنصر غير محدد';
            consumedMaterials[name] = (consumedMaterials[name] || 0) + Number(item.quantity || 1);
          });
        }
      }

      // User as Supplier
      if (r.supplierId === user.id) {
        if (r.status === 'cancelled') {
          cancelledAsSupplier++;
        }
        if (r.status === 'delivered') {
          completedAsSupplier++;
          salesAmount += (r.totalAmount || r.price || 0);

          let items = r.items || [];
          if (items.length === 0 && r.productName) {
            items = [{ productName: r.productName, quantity: r.quantity || 1 }];
          }
          items.forEach((item: any) => {
            const name = item.productName || item.name || 'عنصر غير محدد';
            soldMaterials[name] = (soldMaterials[name] || 0) + Number(item.quantity || 1);
          });
        }
      }
    });

    // top 5 consumed
    const topConsumed = Object.entries(consumedMaterials)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    // top 5 sold
    const topSold = Object.entries(soldMaterials)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    return {
      salesAmount,
      purchasesAmount,
      cancelledAsSupplier,
      cancelledAsBuyer,
      completedAsSupplier,
      completedAsBuyer,
      topConsumed,
      topSold
    };
  }, [user, requests]);

  if (!user) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
            <div className="flex items-center gap-4 flex-1">
               <div className="relative group">
                 <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold border border-slate-700 overflow-hidden">
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.[0] || 'U'
                    )}
                 </div>
                 <button 
                  onClick={() => setIsEditingLogo(!isEditingLogo)}
                  className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-500 shadow-lg"
                 >
                   <Edit2 size={10} />
                 </button>
               </div>
               <div className="flex-1">
                 {isEditingLogo ? (
                   <div className="flex-1 space-y-3">
                     <ImageUpload 
                       value={logoUrl} 
                       onChange={setLogoUrl}
                       onRemove={() => setLogoUrl('')}
                       label="رفع شعار جديد"
                     />
                     <div className="flex items-center gap-2">
                       <input 
                        type="text" 
                        value={logoUrl} 
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="أو ضع رابط الشعار مباشرة هنا"
                        className="flex-1 bg-slate-800 border-none rounded-lg px-3 py-1.5 text-[10px] text-white focus:ring-1 focus:ring-blue-500"
                       />
                       <button 
                        onClick={handleUpdateLogo}
                        disabled={isSavingLogo}
                        className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 text-[10px] font-bold flex items-center gap-1"
                       >
                         {isSavingLogo ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                         حفظ
                       </button>
                       <button 
                        onClick={() => setIsEditingLogo(false)}
                        className="px-2 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-[10px]"
                       >
                         إلغاء
                       </button>
                     </div>
                   </div>
                 ) : (
                   <>
                     <h2 className="text-xl font-bold text-white">{user.businessName || user.name}</h2>
                     <p className="text-sm text-slate-400">{user.email}</p>
                   </>
                 )}
                 <div className="flex gap-2 mt-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.role === 'supplier' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {user.role === 'supplier' ? 'مورد' : 'مشتري'}
                    </span>
                    {user.isTrusted && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 flex items-center gap-1">
                         <CheckCircle2 size={10} />
                         موثوق
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                       {user.phone || user.whatsappPhone || 'لا يوجد هاتف'}
                    </span>
                    {user.subscriptionTier === 'premium' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500 flex items-center gap-1">
                        Premium
                      </span>
                    )}
                 </div>
               </div>
            </div>
            
            <div className="flex items-center gap-2">
              {user.role === 'supplier' && (
                <>
                  <button 
                    onClick={toggleTrustedStatus}
                    disabled={isUpdatingTrusted}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
                      user.isTrusted 
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20" 
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    )}
                  >
                    {isUpdatingTrusted ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {user.isTrusted ? 'إلغاء التوثيق' : 'تعيين كموثوق'}
                  </button>
                  <button 
                    onClick={() => setView('catalog')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                      view === 'catalog' ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                    )}
                  >
                    <ShoppingBag size={14} />
                    الكتالوج
                  </button>
                  <button 
                    onClick={() => setView('offers')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                      view === 'offers' ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                    )}
                  >
                    <ArrowRightLeft size={14} />
                    العروض
                  </button>
                  {view !== 'stats' && (
                    <button 
                      onClick={() => setView('stats')}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-white transition-all flex items-center gap-2"
                    >
                      إحصائيات
                    </button>
                  )}
                </>
              )}
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
             {view === 'stats' && (
               <div className="space-y-6">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                       <div className="flex items-center gap-2 text-slate-400 mb-2">
                          <DollarSign className="w-4 h-4" />
                          <span className="text-xs font-bold">إجمالي المشتريات</span>
                       </div>
                       <p className="text-lg font-black text-white">{stats.purchasesAmount.toLocaleString('en-US')} ج.م</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                       <div className="flex items-center gap-2 text-slate-400 mb-2">
                          <DollarSign className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-bold">إجمالي المبيعات</span>
                       </div>
                       <p className="text-lg font-black text-emerald-500">{stats.salesAmount.toLocaleString('en-US')} ج.م</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-emerald-500/20">
                       <div className="flex items-center gap-2 text-emerald-500 mb-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-bold">مكتمل</span>
                       </div>
                       <p className="text-lg font-black text-emerald-500">
                         شراء: {stats.completedAsBuyer} <br/>
                         بيع: {stats.completedAsSupplier}
                       </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-red-500/20">
                       <div className="flex items-center gap-2 text-red-500 mb-2">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs font-bold">ملغي</span>
                       </div>
                       <p className="text-lg font-black text-red-500">
                         كمشتري: {stats.cancelledAsBuyer} <br/>
                         كمورد: {stats.cancelledAsSupplier}
                       </p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                       <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          أكثر الخامات استهلاكاً (شراء)
                       </h3>
                       {stats.topConsumed.length > 0 ? (
                          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/50">
                             {stats.topConsumed.map((item, idx) => (
                               <div key={idx} className="flex justify-between p-3 text-sm">
                                 <span className="text-white font-medium">{item.name}</span>
                                 <span className="text-slate-400">{item.qty} كمية</span>
                               </div>
                             ))}
                          </div>
                       ) : (
                          <p className="text-xs text-slate-500 italic">لا توجد بيانات مشتريات</p>
                       )}
                    </div>

                    <div className="space-y-3">
                       <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4" />
                          أكثر الخامات مبيعاً (كمورد)
                       </h3>
                       {stats.topSold.length > 0 ? (
                          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/50">
                             {stats.topSold.map((item, idx) => (
                               <div key={idx} className="flex justify-between p-3 text-sm">
                                 <span className="text-white font-medium">{item.name}</span>
                                 <span className="text-slate-400">{item.qty} كمية</span>
                               </div>
                             ))}
                          </div>
                       ) : (
                          <p className="text-xs text-slate-500 italic">لا توجد بيانات مبيعات</p>
                       )}
                    </div>
                 </div>

                 <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 space-y-2">
                    <h3 className="text-sm font-bold text-slate-400 mb-4">معلومات إضافية</h3>
                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                       <div>
                          <span className="text-slate-500 block text-xs">تاريخ التسجيل</span>
                          <span className="text-white">
                             {user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt)).toLocaleString('ar-EG') : '-'}
                          </span>
                       </div>
                       <div>
                          <span className="text-slate-500 block text-xs">العنوان</span>
                          <span className="text-white">{user.address || '-'}</span>
                       </div>
                       <div>
                          <span className="text-slate-500 block text-xs">حالة الحساب</span>
                          <span className="text-white">{user.disabled ? 'محظور / مجمد' : 'نشط'}</span>
                       </div>
                       <div>
                          <span className="text-slate-500 block text-xs">حالة الموافقة</span>
                          <span className="text-white">{user.status}</span>
                       </div>
                    </div>
                 </div>
               </div>
             )}

             {view === 'catalog' && (
               <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                       <Package className="w-4 h-4" />
                       كتالوج المنتجات
                    </h3>
                    <button 
                      onClick={() => {
                        setIsAddProductMode(true);
                        setEditingProduct(null);
                        setProductForm({ name: '', price: '', unit: 'كجم', category: 'أخرى', description: '', image: '', available: true });
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      إضافة منتج
                    </button>
                 </div>

                 {isAddProductMode || editingProduct ? (
                   <form onSubmit={handleProductSubmit} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                       <div className="col-span-2">
                         <label className="text-[10px] text-slate-500 font-bold block mb-1">اسم المنتج</label>
                         <input 
                           required
                           value={productForm.name}
                           onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                           className="w-full bg-slate-900 border-none rounded-lg px-4 py-2 text-sm text-white"
                         />
                       </div>
                       <div>
                         <label className="text-[10px] text-slate-500 font-bold block mb-1">السعر</label>
                         <input 
                           required
                           type="number"
                           value={productForm.price}
                           onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                           className="w-full bg-slate-900 border-none rounded-lg px-4 py-2 text-sm text-white"
                         />
                       </div>
                       <div>
                         <label className="text-[10px] text-slate-500 font-bold block mb-1">الوحدة</label>
                         <select 
                           value={productForm.unit}
                           onChange={(e) => setProductForm({...productForm, unit: e.target.value})}
                           className="w-full bg-slate-900 border-none rounded-lg px-4 py-2 text-sm text-white focus:ring-0"
                         >
                           <option value="كجم">كجم</option>
                           <option value="جرام">جرام</option>
                           <option value="قطعة">قطعة</option>
                           <option value="لتر">لتر</option>
                         </select>
                       </div>
                       <div className="col-span-2">
                         <label className="text-[10px] text-slate-500 font-bold block mb-2">التصنيف</label>
                         <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                            {CATEGORIES.map(cat => (
                              <button
                                key={cat.name}
                                type="button"
                                onClick={() => setProductForm({ ...productForm, category: cat.name })}
                                className={cn(
                                  "flex flex-col items-center justify-center p-2 rounded-xl border transition-all gap-1",
                                  productForm.category === cat.name
                                    ? "bg-blue-600 border-blue-500 text-white"
                                    : "bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800"
                                )}
                              >
                                <span className="text-base">{cat.icon}</span>
                                <span className="text-[8px] font-bold truncate w-full text-center">{cat.name}</span>
                              </button>
                            ))}
                         </div>
                       </div>
                       <div className="col-span-2">
                         <label className="text-[10px] text-slate-500 font-bold block mb-2">صورة المنتج</label>
                         <ImageUpload 
                           value={productForm.image}
                           onChange={(val) => setProductForm({...productForm, image: val})}
                           onRemove={() => setProductForm({...productForm, image: ''})}
                         />
                         <input 
                           type="url"
                           value={productForm.image}
                           onChange={(e) => setProductForm({...productForm, image: e.target.value})}
                           className="w-full bg-slate-900 border-none rounded-lg px-4 py-2 mt-2 text-[10px] text-slate-400"
                           placeholder="أو رابط الصورة المباشر هنا"
                         />
                       </div>
                     </div>
                     <div className="flex gap-2 justify-end pt-2">
                       <button 
                        type="button" 
                        onClick={() => { setIsAddProductMode(false); setEditingProduct(null); }}
                        className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                       >
                         إلغاء
                       </button>
                       <button 
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-xs font-bold"
                       >
                         {editingProduct ? 'حفظ التعديلات' : 'إضافة الآن'}
                       </button>
                     </div>
                   </form>
                 ) : null}

                 <div className="grid grid-cols-1 gap-3">
                   {loadingCatalog ? (
                     <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-slate-600" /></div>
                   ) : products.length > 0 ? (
                     products.map(p => (
                       <div key={p.id} className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-700 border border-slate-800">
                               {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Package size={20} />}
                            </div>
                            <div>
                               <h4 className="text-sm font-bold text-white">{p.name}</h4>
                               <p className="text-[10px] text-slate-500">{p.price} ج.م / {p.unit}</p>
                            </div>
                         </div>
                         <div className="flex gap-1">
                           <button 
                            onClick={() => {
                              setEditingProduct(p);
                              setProductForm({
                                name: p.name,
                                price: p.price.toString(),
                                unit: p.unit,
                                category: p.category || 'أخرى',
                                description: p.description || '',
                                image: p.image || '',
                                available: p.available ?? true
                              });
                              setIsAddProductMode(false);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                           >
                             <Edit2 size={14} />
                           </button>
                           <button 
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                           >
                             <Trash2 size={14} />
                           </button>
                         </div>
                       </div>
                     ))
                   ) : (
                     <p className="text-center py-10 text-xs text-slate-600 italic">لا يوجد منتجات في الكتالوج حالياً</p>
                   )}
                 </div>
               </div>
             )}

             {view === 'offers' && (
               <div className="space-y-6">
                 <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <ArrowRightLeft size={16} className="text-amber-500" />
                    العروض المقدمة من المورد
                 </h3>
                 
                 <div className="grid grid-cols-1 gap-3">
                   {loadingBids ? (
                     <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-slate-600" /></div>
                   ) : bids.length > 0 ? (
                     bids.map(bid => (
                       <div key={bid.id} className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 space-y-3">
                         <div className="flex justify-between items-start">
                           <div>
                             <h4 className="font-bold text-white text-sm">{bid.productName}</h4>
                             <p className="text-[10px] text-slate-400">للمشتري: {bid.buyerName || 'غير معروف'}</p>
                           </div>
                           <div className="text-left">
                             <p className="text-emerald-500 font-bold text-sm">{bid.price} ج.م</p>
                             <div className={cn(
                               "text-[8px] px-1.5 py-0.5 rounded uppercase font-black",
                               bid.status === 'accepted' ? "bg-emerald-500/10 text-emerald-500" :
                               bid.status === 'rejected' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                             )}>
                               {bid.status === 'accepted' ? 'مقبول' : bid.status === 'rejected' ? 'مرفوض' : 'معلق'}
                             </div>
                           </div>
                         </div>
                         <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
                            <span className="text-[10px] text-slate-500">التوصيل: {bid.deliveryDays} أيام</span>
                            <button 
                              onClick={() => handleDeleteBid(bid)}
                              className="text-red-500 hover:text-red-400 p-1 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                         </div>
                       </div>
                     ))
                   ) : (
                     <div className="text-center py-10 text-xs text-slate-500 italic">لا يوجد عروض مقدمة حالياً</div>
                   )}
                 </div>
               </div>
             )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Upload, Percent, Loader2 } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { CATEGORIES } from '../../constants';

export default function NewSupplierOffer() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const calcDiscount = () => {
    if(!originalPrice || !offerPrice) return 0;
    const diff = Number(originalPrice) - Number(offerPrice);
    if (diff <= 0) return 0;
    return Math.round((diff / Number(originalPrice)) * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const origPrice = Number(originalPrice);
    const offPrice = Number(offerPrice);

    if (!auth.currentUser) {
      toast.error('يرجى تسجيل الدخول أولاً');
      return;
    }

    if (isNaN(origPrice) || isNaN(offPrice) || origPrice <= 0 || offPrice <= 0) {
      toast.error('يرجى إدخال أسعار صحيحة');
      return;
    }

    if (offPrice >= origPrice) {
      toast.error('سعر العرض يجب أن يكون أقل من السعر الأصلي');
      return;
    }

    if (!title.trim()) {
      toast.error('يرجى إدخال عنوان للعرض');
      return;
    }

    if (!categoryId) {
      toast.error('يرجى اختيار تصنيف للعرض');
      return;
    }

    setLoading(true);
    try {
      const discountVal = Math.round(((origPrice - offPrice) / origPrice) * 100);
      const category = CATEGORIES.find(c => c.id === categoryId);
      
      const offerData = {
        supplierId: auth.currentUser.uid,
        supplierName: auth.currentUser.displayName || 'مورد بنها',
        title: title.trim(),
        categoryId: categoryId,
        categoryName: category?.name || '',
        originalPrice: origPrice,
        offerPrice: offPrice,
        discount: `${discountVal}%`,
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&q=80',
        status: 'active',
        views: 0,
        orders: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('Submitting offer:', offerData);
      
      await addDoc(collection(db, 'offers'), offerData);

      toast.success('تم نشر العرض بنجاح');
      navigate('/supplier/offers');
    } catch (error) {
      console.error('Error adding offer:', error);
      handleFirestoreError(error, OperationType.CREATE, 'offers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-6 font-sans">
      <header className="flex items-center">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 text-slate-700">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
        <h1 className="font-bold text-lg text-slate-900 font-display mr-2">إضافة عرض ترويجي جديد</h1>
      </header>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-5">
         
         <div className="space-y-2 text-right">
           <label className="text-sm font-bold text-slate-700">العنوان أو اسم المنتج</label>
           <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: خصم 20% على زيت القلي" 
            className="w-full bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all" 
            required
           />
         </div>

         <div className="space-y-2 text-right">
            <label className="text-sm font-bold text-slate-700">تصنيف العرض</label>
            <select 
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all appearance-none font-bold text-slate-700"
              required
            >
              <option value="">اختر التصنيف...</option>
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
         </div>

         <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2 text-right relative">
             <label className="text-sm font-bold text-slate-700">السعر الأصلي</label>
             <input type="number" value={originalPrice} onChange={(e)=>setOriginalPrice(e.target.value)} className="w-full bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all" required/>
             <span className="absolute left-4 bottom-3 text-xs text-slate-400 font-bold">ج.م</span>
           </div>
           <div className="space-y-2 text-right relative">
             <label className="text-sm font-bold text-[var(--color-danger)]">سعر العرض</label>
             <input type="number" value={offerPrice} onChange={(e)=>setOfferPrice(e.target.value)} className="w-full bg-red-50 border border-red-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-danger)] transition-all font-bold text-[var(--color-danger)]" required/>
           </div>
         </div>

         {calcDiscount() > 0 && (
           <div className="bg-[var(--color-success)]/10 text-[var(--color-success)] p-3 rounded-xl flex items-center justify-between font-bold border border-[var(--color-success)]/20">
             <span>نسبة الخصم المحسوبة:</span>
             <span className="text-lg flex items-center gap-1"><Percent className="w-4 h-4"/> {calcDiscount()}%</span>
           </div>
         )}

         <button type="button" className="w-full py-6 border-2 border-dashed border-slate-300 rounded-2xl mt-2 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors text-slate-500">
            <Upload className="w-6 h-6" />
            <span className="text-sm font-bold">صورة المنتج أو العرض</span>
         </button>

         <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 mt-4 bg-[var(--color-primary)] text-white font-bold text-lg rounded-2xl shadow-md hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
         >
           {loading && <Loader2 className="w-5 h-5 animate-spin" />}
           {loading ? 'جاري النشر...' : 'نشر العرض فوراً'}
         </button>
      </form>
    </div>
  );
}

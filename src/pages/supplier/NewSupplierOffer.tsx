import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Upload, Percent, Loader2, ImagePlus } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { CATEGORIES } from '../../constants';
import { convertArabicNumerals, resizeImage } from '../../lib/utils';
import SubscriptionModal from '../../components/SubscriptionModal';

export default function NewSupplierOffer() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const [userData, setUserData] = useState<any>(null);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('كيلو');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditMode);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      
      // Fetch profile
      const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userSnap.exists()) setUserData(userSnap.data());

      // Fetch offer if in edit mode
      if (isEditMode) {
        try {
          const offerSnap = await getDoc(doc(db, 'offers', id!));
          if (offerSnap.exists()) {
            const data = offerSnap.data();
            if (data.supplierId !== auth.currentUser.uid) {
              toast.error('ليس لديك صلاحية لتعديل هذا العرض');
              navigate('/supplier/offers');
              return;
            }
            setTitle(data.title || '');
            setCategoryId(data.categoryId || '');
            setImageUrl(data.image || '');
            setOriginalPrice(String(data.originalPrice || ''));
            setOfferPrice(String(data.offerPrice || ''));
            setQuantity(String(data.quantity || '1'));
            setUnit(data.unit || 'كيلو');
          } else {
            toast.error('العرض غير موجود');
            navigate('/supplier/offers');
          }
        } catch (error) {
          console.error('Error fetching offer:', error);
          handleFirestoreError(error, OperationType.GET, `offers/${id}`);
          navigate('/supplier/offers');
        } finally {
          setFetching(false);
        }
      }
    };
    fetchData();
  }, [id, navigate, isEditMode]);

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
      // RESTRICTION: Only Premium suppliers can publish offers
      if (userData?.subscriptionTier !== 'premium') {
        toast.error('عذراً، لا يمكن نشر العروض الترويجية إلا لمشتركي الباقة المميزة (Premium)');
        setIsSubscriptionModalOpen(true);
        setLoading(false);
        return;
      }

      const supplierSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const sData = supplierSnap.exists() ? supplierSnap.data() : {};

      const discountVal = Math.round(((origPrice - offPrice) / origPrice) * 100);
      const category = CATEGORIES.find(c => c.id === categoryId);
      
      const offerData = {
        title: title.trim(),
        categoryId: categoryId,
        categoryName: category?.name || '',
        categoryIcon: category?.icon || '✨',
        originalPrice: origPrice,
        offerPrice: offPrice,
        discount: `${discountVal}%`,
        image: imageUrl.trim() || null,
        quantity: Number(quantity) || 1,
        unit: unit || 'كيلو',
        updatedAt: serverTimestamp(),
        // Fields only for new offers
        ...(isEditMode ? {} : {
          supplierId: auth.currentUser.uid,
          supplierName: sData.businessName || auth.currentUser.displayName || 'مورد موثق',
          supplierRating: sData.rating || 0,
          supplierTotalRatings: sData.totalRatings || 0,
          status: 'active',
          views: 0,
          orders: 0,
          createdAt: serverTimestamp(),
        })
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'offers', id!), offerData);
        toast.success('تم تحديث العرض بنجاح');
      } else {
        await addDoc(collection(db, 'offers'), offerData);
        toast.success('تم نشر العرض بنجاح');
      }

      navigate('/supplier/offers');
    } catch (error) {
      console.error('Error saving offer:', error);
      handleFirestoreError(error, isEditMode ? OperationType.UPDATE : OperationType.CREATE, isEditMode ? `offers/${id}` : 'offers');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p className="text-sm font-bold">جاري تحميل بيانات العرض...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 font-sans">
      <header className="flex items-center">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 text-slate-700">
          <ChevronRight className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-lg text-slate-900 font-display mr-2">
          {isEditMode ? 'تعديل العرض الترويجي' : 'إضافة عرض ترويجي جديد'}
        </h1>
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
             <input type="text" inputMode="numeric" value={originalPrice} onChange={(e)=>setOriginalPrice(convertArabicNumerals(e.target.value))} className="w-full bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all" required/>
             <span className="absolute left-4 bottom-3 text-xs text-slate-400 font-bold">ج.م</span>
           </div>
           <div className="space-y-2 text-right relative">
             <label className="text-sm font-bold text-[var(--color-danger)]">سعر العرض</label>
             <input type="text" inputMode="numeric" value={offerPrice} onChange={(e)=>setOfferPrice(convertArabicNumerals(e.target.value))} className="w-full bg-red-50 border border-red-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-danger)] transition-all font-bold text-[var(--color-danger)]" required/>
           </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 text-right">
               <label className="text-sm font-bold text-slate-700">الكمية (لكل سعر)</label>
               <input 
                 type="text" 
                 inputMode="numeric"
                 value={quantity}
                 onChange={(e) => setQuantity(convertArabicNumerals(e.target.value))}
                 className="w-full bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all font-bold text-right" 
                 required
               />
            </div>
            <div className="space-y-2 text-right">
               <label className="text-sm font-bold text-slate-700">الوحدة</label>
               <select 
                 value={unit}
                 onChange={(e) => setUnit(e.target.value)}
                 className="w-full bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all font-bold text-right appearance-none"
               >
                 <option value="كيلو">كيلو</option>
                 <option value="جرام">جرام</option>
                 <option value="كرتونة">كرتونة</option>
                 <option value="علبة">علبة</option>
                 <option value="قطعة">قطعة</option>
                 <option value="شوال">شوال</option>
                 <option value="لتر">لتر</option>
                 <option value="متر">متر</option>
                 <option value="بالتة">بالتة</option>
                 <option value="دستة">دستة</option>
               </select>
            </div>
         </div>

         {calcDiscount() > 0 && (
           <div className="bg-[var(--color-success)]/10 text-[var(--color-success)] p-3 rounded-xl flex items-center justify-between font-bold border border-[var(--color-success)]/20">
             <span>نسبة الخصم المحسوبة:</span>
             <span className="text-lg flex items-center gap-1"><Percent className="w-4 h-4"/> {calcDiscount()}%</span>
           </div>
         )}

         <div className="space-y-2 text-right">
            <label className="text-sm font-bold text-slate-700">صورة العرض (اختياري)</label>
            <div className="relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                     try {
                        const base64 = await resizeImage(file, 800, 800);
                        setImageUrl(base64);
                     } catch (err) {
                        console.error('Error resizing image', err);
                        toast.error('حدث خطأ أثناء معالجة الصورة');
                     }
                  }
                }}
                className="hidden" 
                id="offer-image"
              />
              <label 
                htmlFor="offer-image" 
                className="w-full bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all flex items-center justify-center gap-2 cursor-pointer text-slate-500 font-bold hover:bg-slate-50"
              >
                <ImagePlus className="w-5 h-5" />
                {imageUrl && imageUrl.startsWith('data:image') ? 'تم اختيار الصورة - اضغط للتغيير' : 'اضغط لاختيار صورة من جهازك'}
              </label>
            </div>
            {imageUrl && imageUrl.startsWith('data:image') && (
               <div className="mt-2 w-full flex justify-center">
                  <img src={imageUrl} alt="Preview" className="h-32 object-contain rounded-xl border border-slate-200" />
               </div>
            )}
            <p className="text-[10px] text-slate-400 font-medium mt-1">يمكنك رفع صورة من الجوال أو استخدام أيقونة التصنيف التلقائية.</p>
         </div>

         <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 mt-4 bg-[var(--color-primary)] text-white font-bold text-lg rounded-2xl shadow-md hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
         >
           {loading && <Loader2 className="w-5 h-5 animate-spin" />}
           {loading ? 'جاري النشر...' : 'نشر العرض فوراً'}
         </button>
      </form>

      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        userRole="supplier"
        currentTier={userData?.subscriptionTier || 'standard'}
      />
    </div>
  );
}

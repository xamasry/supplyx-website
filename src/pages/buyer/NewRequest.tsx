import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Search, MapPin, Loader2, DollarSign } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useGeolocation } from '../../hooks/useGeolocation';
import toast from 'react-hot-toast';
import { CATEGORIES } from '../../constants';

export default function NewRequest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [productName, setProductName] = useState('');
  const [showCustomProductInput, setShowCustomProductInput] = useState(false);
  const [customProductValue, setCustomProductValue] = useState('');
  
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('كرتونه');
  const [maxPrice, setMaxPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { location, loading: geoLoading, error: geoError, getLocation } = useGeolocation();

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return CATEGORIES;
    return CATEGORIES.filter(c => 
      c.name.includes(searchQuery) || 
      c.products.some(p => p.includes(searchQuery))
    );
  }, [searchQuery]);

  const finalProductName = showCustomProductInput ? customProductValue : productName;

  const handleSubmit = async () => {
    if (!auth.currentUser) {
      toast.error('يرجى تسجيل الدخول أولاً');
      navigate('/auth/login');
      return;
    }

    if (!selectedCategory || !finalProductName) {
      toast.error('يرجى اختيار المنتج والفئة أولاً');
      return;
    }

    setLoading(true);
    const path = 'requests';
    try {
      let bName = auth.currentUser.displayName || 'مشتري';
      const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userSnap.exists()) {
         bName = userSnap.data().businessName || bName;
      }

      const docRef = await addDoc(collection(db, path), {
        buyerId: auth.currentUser.uid,
        buyerName: bName,
        
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        productName: finalProductName,
        
        quantity: quantity,
        unit: unit,
        maxPrice: maxPrice ? Number(maxPrice) : null,
        
        notes: notes,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Expires in 2 hours will be handled by our Cloud Function, but let's record it if we want
        // expiresAt: admin.firestore.Timestamp.now().toMillis() + 2 * 60 * 60 * 1000
        
        location: 'بنها، القليوبية',
        coordinates: location ? { lat: location.lat, lng: location.lng } : null
      });

      // Notify suppliers via webhook
      fetch('/api/requests/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: docRef.id })
      }).catch(console.error);

      toast.success('تم إرسال الطلب بنجاح!');
      navigate(`/buyer/request/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      toast.error('حدث خطأ أثناء الإرسال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[80vh] flex flex-col font-sans mb-12">
      <header className="flex items-center gap-3 p-4 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-slate-50 text-slate-500">
          <ChevronRight className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-lg text-slate-900 font-display">طلب طارئ جديد</h1>
      </header>

      {/* Improved Progress */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 w-full h-[3px] bg-slate-100 -translate-y-1/2 rounded-full -z-10"></div>
          <div className="absolute top-1/2 right-0 h-[3px] bg-primary-500 -translate-y-1/2 rounded-full -z-10 transition-all duration-500 ease-out" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
          
          {['المنتج', 'التفاصيل', 'التأكيد'].map((label, index) => {
            const i = index + 1;
            const isActive = step === i;
            const isCompleted = step > i;
            
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-300 ring-4 ring-white",
                  isActive ? "bg-primary-500 text-white" : 
                  isCompleted ? "bg-primary-100 text-primary-600" : 
                  "bg-slate-100 text-slate-400"
                )}>
                  {isCompleted ? '✓' : i}
                </div>
                <span className={cn(
                  "text-[10px] font-bold absolute -bottom-5",
                  isActive || isCompleted ? "text-slate-800" : "text-slate-400"
                )}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-5 mt-6">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-bold text-slate-900">عن ماذا تبحث؟</h2>
            <div className="relative mb-6">
              <input 
                type="text" 
                placeholder="ابحث عن خامة أو قسم..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 pr-11 outline-none focus:ring-2 focus:ring-primary-500 transition-shadow" 
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            </div>

            {!selectedCategory ? (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-500">اختر القسم أولاً:</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {filteredCategories.map(cat => (
                    <button 
                      key={cat.id} 
                      onClick={() => {
                        setSelectedCategory(cat);
                        setProductName('');
                        setShowCustomProductInput(false);
                      }}
                      className="p-3 rounded-xl border border-slate-100 bg-white flex flex-col items-center gap-2 hover:border-primary-300 hover:bg-primary-50 transition-colors shadow-sm"
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">{cat.name}</span>
                    </button>
                  ))}
                  {filteredCategories.length === 0 && (
                    <div className="col-span-full py-8 text-center text-slate-400 text-sm">
                      لم يتم العثور على نتائج
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedCategory.icon}</span>
                    <h3 className="font-bold text-slate-800">{selectedCategory.name}</h3>
                  </div>
                  <button onClick={() => setSelectedCategory(null)} className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">تغيير القسم</button>
                </div>
                
                <p className="text-sm font-bold text-slate-500">اختر المنتج أو اكتبه:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCategory.products.map((p: string) => (
                    <button 
                      key={p} 
                      onClick={() => {
                        setProductName(p);
                        setShowCustomProductInput(false);
                      }} 
                      className={cn(
                        "px-3 py-2 rounded-xl border text-sm font-bold transition-colors",
                        productName === p && !showCustomProductInput
                          ? "border-primary-500 bg-primary-50 text-primary-700" 
                          : "border-slate-200 bg-white text-slate-700 hover:border-primary-300"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                  <button 
                      onClick={() => {
                        setProductName('');
                        setShowCustomProductInput(true);
                      }} 
                      className={cn(
                        "px-3 py-2 rounded-xl border text-sm font-bold transition-colors border-dashed",
                        showCustomProductInput
                          ? "border-primary-500 bg-primary-50 text-primary-700" 
                          : "border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400"
                      )}
                    >
                      + مش لاقي المنتج؟
                    </button>
                </div>

                {showCustomProductInput && (
                  <div className="mt-4 animate-in slide-in-from-top-2">
                    <input 
                      type="text" 
                      placeholder="اكتب اسم المنتج..."
                      value={customProductValue}
                      onChange={(e) => setCustomProductValue(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-bold text-slate-900">تفاصيل الطلب</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 text-right">
                <label className="text-sm font-bold text-slate-600">الكمية</label>
                <input 
                  type="number" 
                  min="1"
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)} 
                  className="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold" 
                />
              </div>
              <div className="space-y-1.5 text-right">
                <label className="text-sm font-bold text-slate-600">الوحدة</label>
                <select 
                  value={unit} 
                  onChange={(e) => setUnit(e.target.value)} 
                  className="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 appearance-none font-bold text-slate-700"
                >
                  <option value="كرتونه">كرتونه</option>
                  <option value="كيلو">كيلو</option>
                  <option value="لتر">لتر</option>
                  <option value="قطعة">قطعة</option>
                  <option value="عبوة">عبوة</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-1.5 text-right">
              <label className="text-sm font-bold text-slate-600">أقصى سعر مقبول (اختياري)</label>
              <div className="relative">
                <input 
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="مثال: 150"
                  className="w-full px-4 py-3 pb-3 pr-10 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                />
                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">ج.م</span>
              </div>
            </div>

            <div className="space-y-1.5 text-right">
              <label className="text-sm font-bold text-slate-600">ملاحظات إضافية (اختياري)</label>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="تاريخ إنتاج حديث، مواصفات خاصة..." 
                className="w-full h-24 px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 resize-none font-medium"
              ></textarea>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-bold text-slate-900">ملخص وموقع التوصيل</h2>
            
            <div className="bg-primary-50/50 border border-primary-100 rounded-2xl p-5 space-y-4">
              <div>
                 <span className="text-[10px] font-bold text-primary-600 bg-primary-100 px-2 py-1 rounded-md">{selectedCategory?.name}</span>
                 <h3 className="font-display font-bold text-xl text-slate-900 mt-2">{finalProductName}</h3>
              </div>
              
              <div className="flex gap-4">
                 <div className="flex-1 bg-white p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 mb-1">الكمية</p>
                    <p className="font-bold text-slate-800">{quantity} <span className="text-xs">{unit}</span></p>
                 </div>
                 {maxPrice && (
                 <div className="flex-1 bg-white p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 mb-1">السعر المستهدف</p>
                    <p className="font-bold text-slate-800">{maxPrice} <span className="text-xs">ج.م للمنتج</span></p>
                 </div>
                 )}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="text-danger w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{auth.currentUser?.displayName || 'مستخدم جديد'}</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">حدد موقعك الدقيق ليصل تنبيه للموردين في محيط منطقتك.</p>
                </div>
              </div>

              {location ? (
                <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-green-700">✓ تم تحديد الإحداثيات بنجاح</span>
                  <button onClick={getLocation} className="text-[10px] bg-white px-3 py-1.5 rounded-lg border border-green-200 font-bold hover:bg-green-100">تحديث</button>
                </div>
              ) : (
                <button 
                  onClick={getLocation}
                  disabled={geoLoading}
                  className="w-full py-3.5 bg-white border-2 border-danger text-danger rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-danger hover:text-white transition-all disabled:opacity-50"
                >
                  {geoLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>جاري تحديد موقعك...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-5 h-5" />
                      <span>اضغط لتحديد موقعك الحالي</span>
                    </>
                  )}
                </button>
              )}
              {geoError && <p className="text-[10px] text-red-500 font-bold mt-1">خطأ: غير قادر على تحديد الموقع</p>}
            </div>
          </div>
        )}
      </div>

      <div className="p-5 border-t border-slate-100 flex gap-3">
        {step > 1 && (
           <button 
             onClick={() => setStep(step - 1)}
             className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
           >
             رجوع
           </button>
        )}
        
        {step < 3 ? (
          <button 
            onClick={() => setStep(step + 1)}
            disabled={(step === 1 && !finalProductName)}
            className="flex-1 py-4 bg-primary-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            التالي
          </button>
        ) : (
          <button 
            onClick={handleSubmit}
            disabled={loading || !location}
            className="flex-1 py-4 bg-danger text-white rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-danger/20 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'انشر الطلب للموردين 🚀'}
          </button>
        )}
      </div>
    </div>
  );
}

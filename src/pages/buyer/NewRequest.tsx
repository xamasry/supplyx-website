import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Search, MapPin, Loader2, DollarSign, Package } from 'lucide-react';
import { cn, fetchWithRetry } from '../../lib/utils';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { trackEvent } from '../../lib/analytics';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useGeolocation } from '../../hooks/useGeolocation';
import toast from 'react-hot-toast';
import { CATEGORIES } from '../../constants';

export default function NewRequest() {
  const navigate = useNavigate();
  const locationSearch = useLocation().search;
  const isBulk = new URLSearchParams(locationSearch).get('type') === 'bulk';
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
  
  // Bulk specific state
  const [bulkItems, setBulkItems] = useState<{productName: string, quantity: number, unit: string}[]>([]);

  const { location, loading: geoLoading, error: geoError, getLocation } = useGeolocation();

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return CATEGORIES;
    return CATEGORIES.filter(c => 
      c.name.includes(searchQuery) || 
      c.products.some(p => p.includes(searchQuery))
    );
  }, [searchQuery]);

  useEffect(() => {
    if (step === 3 && !location && !geoError) {
      getLocation();
    }
  }, [step, location, geoError, getLocation]);

  const finalProductName = showCustomProductInput ? customProductValue : productName;

  const handleAddBulkItem = () => {
    if (!finalProductName || isNaN(Number(quantity)) || Number(quantity) <= 0 || !unit) {
      toast.error('يرجى تحديد المنتج والكمية الصحيحة');
      return;
    }
    setBulkItems([...bulkItems, { 
      productName: finalProductName, 
      quantity: Number(quantity), 
      unit 
    }]);
    // Reset product selection for next item
    setProductName('');
    setCustomProductValue('');
    setShowCustomProductInput(false);
    setQuantity('1');
  };

  const handleRemoveBulkItem = (index: number) => {
    setBulkItems(bulkItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) {
      toast.error('يرجى تسجيل الدخول أولاً');
      navigate('/auth/login');
      return;
    }

    if (isBulk) {
      if (bulkItems.length === 0) {
        toast.error('يرجى إضافة منتجات للمناقصة');
        return;
      }
    } else {
      if (!selectedCategory || !finalProductName) {
        toast.error('يرجى اختيار المنتج والفئة أولاً');
        return;
      }
    }

    setLoading(true);
    const path = 'requests';
    try {
      let bName = auth.currentUser.displayName || 'مشتري';
      const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userSnap.exists()) {
         bName = userSnap.data().businessName || bName;
      }

      const cleanMaxPrice = maxPrice && !isNaN(Number(maxPrice)) ? Number(maxPrice) : null;

      const requestData: any = {
        buyerId: auth.currentUser.uid,
        buyerName: bName,
        notes: notes,
        status: 'active',
        requestType: isBulk ? 'bulk' : 'standard',
        bidsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        location: 'بنها، القليوبية',
        coordinates: location ? { lat: location.lat, lng: location.lng } : null
      };

      if (isBulk) {
        requestData.productName = `مناقصة جملة: ${bulkItems.length} منتجات`;
        requestData.items = bulkItems;
        requestData.maxPrice = cleanMaxPrice;
      } else {
        requestData.categoryId = selectedCategory.id;
        requestData.categoryName = selectedCategory.name;
        requestData.productName = finalProductName;
        requestData.quantity = isNaN(Number(quantity)) ? 1 : Number(quantity);
        requestData.unit = unit;
        requestData.maxPrice = cleanMaxPrice;
      }

      const docRef = await addDoc(collection(db, path), requestData);

      // Notify suppliers via webhook
      fetchWithRetry('/api/requests/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: docRef.id })
      }).catch(console.error);

      toast.success('تم إرسال الطلب بنجاح!');
      
      trackEvent('request_created', {
        type: isBulk ? 'bulk' : 'fast',
        category: selectedCategory?.id,
        itemsCount: isBulk ? bulkItems.length : 1
      });

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
        <h1 className="font-bold text-lg text-slate-900 font-display">
          {isBulk ? 'طلب مناقصة جملة (48h)' : 'طلب طارئ جديد'}
        </h1>
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
            {isBulk && bulkItems.length > 0 && (
              <div className="mb-6 space-y-3 bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
                <h3 className="font-bold text-blue-900 border-b border-blue-200/50 pb-2">عناصر المناقصة المضافة ({bulkItems.length}):</h3>
                <ul className="space-y-2">
                  {bulkItems.map((item, index) => (
                    <li key={index} className="flex justify-between items-center text-sm font-bold bg-white p-2 rounded-lg border border-blue-50">
                      <span>{item.productName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">{item.quantity} {item.unit}</span>
                        <button onClick={() => handleRemoveBulkItem(index)} className="text-red-500 hover:text-red-700 text-xs">إزالة</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
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
                
                {isBulk && (selectedCategory || showCustomProductInput) && (
                  <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-4 animate-in slide-in-from-bottom-2">
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
                    
                    <button 
                      id="add-to-bulk-btn"
                      onClick={handleAddBulkItem}
                      disabled={!finalProductName}
                      className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors disabled:opacity-50 shadow-lg"
                    >
                      {finalProductName ? `إضافة (${finalProductName}) للمناقصة +` : 'اختر المنتج لإضافته'}
                    </button>
                    {finalProductName && (
                      <p className="text-[10px] text-center text-slate-400 font-bold">يمكنك الضغط على "التالي" للإضافة والمتابعة مباشرة</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-bold text-slate-900">تفاصيل الطلب الإضافية</h2>
            
            {!isBulk && (
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
            )}
            
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
                 {!isBulk ? (
                   <>
                     <span className="text-[10px] font-bold text-primary-600 bg-primary-100 px-2 py-1 rounded-md">{selectedCategory?.name}</span>
                     <h3 className="font-display font-bold text-xl text-slate-900 mt-2">{finalProductName}</h3>
                   </>
                 ) : (
                   <>
                     <span className="text-[10px] font-bold text-primary-600 bg-primary-100 px-2 py-1 rounded-md">صفقة جملة</span>
                     <h3 className="font-display font-bold text-xl text-slate-900 mt-2">مناقصة جملة: {bulkItems.length} منتجات</h3>
                   </>
                 )}
              </div>
              
              {!isBulk ? (
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
              ) : (
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 mb-2">المنتجات المطلوبة</p>
                  <ul className="space-y-1 text-sm font-bold text-slate-800">
                    {bulkItems.map((item, i) => (
                      <li key={i} className="flex justify-between border-b border-slate-50 pb-1 last:border-0 last:pb-0">
                        <span>{item.productName}</span>
                        <span className="text-slate-500">{item.quantity} {item.unit}</span>
                      </li>
                    ))}
                  </ul>
                  {maxPrice && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-sm">
                      <span className="text-slate-500">إجمالي الميزانية:</span>
                      <span className="font-bold text-primary-600">{maxPrice} ج.م</span>
                    </div>
                  )}
                </div>
              )}
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

            {isBulk && (
               <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-start gap-3">
                 <Package className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                 <div>
                   <h4 className="font-bold text-blue-900 text-sm">تبدأ المناقصة الآن</h4>
                   <p className="text-xs text-blue-700 font-medium leading-relaxed mt-1">
                     سيتم فتح باب تلقي العروض لهذه الصفقة الكبيرة لمدة <span className="font-bold">٤٨ ساعة</span>، أو حتى تقوم باختيار وقبول عرض معين.
                   </p>
                 </div>
               </div>
            )}
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
            id="next-step-button"
            onClick={() => {
              // If in Step 1 and Bulk mode, and there's a pending item selection, add it automatically
              if (step === 1 && isBulk && finalProductName && quantity) {
                const alreadyAdded = bulkItems.some(item => item.productName === finalProductName);
                if (!alreadyAdded) {
                  setBulkItems([...bulkItems, { 
                    productName: finalProductName, 
                    quantity: Number(quantity), 
                    unit 
                  }]);
                }
              }
              setStep(step + 1);
            }}
            disabled={
              step === 1 && (
                (!isBulk && !finalProductName) || 
                (isBulk && bulkItems.length === 0 && !finalProductName)
              )
            }
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
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isBulk ? 'طرح المناقصة للموردين 🚀' : 'انشر الطلب للموردين 🚀'}
          </button>
        )}
      </div>
    </div>
  );
}

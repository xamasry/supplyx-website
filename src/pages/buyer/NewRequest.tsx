import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Upload, Search, MapPin, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useGeolocation } from '../../hooks/useGeolocation';

export default function NewRequest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [customProduct, setCustomProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('كرتونه');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { location, loading: geoLoading, error: geoError, getLocation } = useGeolocation();

  const handleSubmit = async () => {
    if (!auth.currentUser) {
      alert("يرجى تسجيل الدخول أولاً");
      navigate('/auth/login');
      return;
    }

    setLoading(true);
    const path = 'requests';
    try {
      const docRef = await addDoc(collection(db, path), {
        buyerId: auth.currentUser.uid,
        buyerName: auth.currentUser.displayName || 'مطعم الأمل',
        productName: customProduct,
        quantity: `${quantity} ${unit}`,
        notes: notes,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        location: 'بنها، القليوبية',
        coordinates: location ? { lat: location.lat, lng: location.lng } : null
      });
      navigate(`/buyer/request/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[80vh] flex flex-col font-sans">
      <header className="flex items-center gap-3 p-4 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-slate-50 text-slate-500">
          <ChevronRight className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-lg text-slate-900 font-display">طلب طارئ جديد</h1>
      </header>

      {/* Progress */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 -mt-px w-full h-[2px] bg-slate-100 -z-10"></div>
          <div className="absolute top-1/2 -mt-px w-1/2 h-[2px] bg-[var(--color-primary)] -z-10 transition-all" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
          {[1, 2, 3].map(i => (
            <div key={i} className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-sans", step >= i ? "bg-[var(--color-primary)] text-white" : "bg-slate-200 text-slate-500")}>
              {i}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-bold text-slate-900 mb-2">عن ماذا تبحث؟</h2>
            <div className="relative">
              <input type="text" placeholder="مثال: بيبسي كانز..." value={customProduct} onChange={(e)=>setCustomProduct(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 pr-11 outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-500 mb-3">أو اختر من الفئات الأكثر طلباً:</p>
              <div className="flex flex-wrap gap-2">
                {['مشروبات غازية', 'لحوم مفرومة', 'مياه معدنية', 'خضروات طازجة', 'أكواب ورقية'].map(item => (
                  <button key={item} onClick={() => setCustomProduct(item)} className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-bold text-slate-900">تفاصيل الطلب</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 text-right">
                <label className="text-xs font-semibold text-slate-500">الكمية</label>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)} 
                  className="w-full px-3 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-primary)]" 
                />
              </div>
              <div className="space-y-1 text-right">
                <label className="text-xs font-semibold text-slate-500">الوحدة</label>
                <select 
                  value={unit} 
                  onChange={(e) => setUnit(e.target.value)} 
                  className="w-full px-3 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-primary)] appearance-none font-sans font-semibold"
                >
                  <option>كرتونه</option>
                  <option>كيلو</option>
                  <option>لتر</option>
                  <option>قطعة</option>
                  <option>عبوة</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 text-right">
              <label className="text-xs font-semibold text-slate-500">تفاصيل إضافية (اختياري)</label>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="مثال: يرجى إحضار منتجات بتاريخ إنتاج حديث" 
                className="w-full h-24 px-3 py-3 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              ></textarea>
            </div>

            <button className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 hover:text-[var(--color-primary)] transition-colors">
              <Upload className="w-6 h-6" />
              <span className="text-sm font-semibold">أضف صورة للمنتج (اختياري)</span>
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-bold text-slate-900">مكان التوصيل</h2>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
              <div className="flex gap-3">
                <MapPin className="text-[var(--color-primary)] w-6 h-6 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{auth.currentUser?.displayName || 'مطعم الأمل'}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">يرجى تحديد موقعك بدقة ليتمكن الموردون القريبون منك من رؤية طلبك.</p>
                </div>
              </div>

              {location ? (
                <div className="bg-green-50 border border-green-100 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-green-700 font-sans">✓ تم تحديد الإحداثيات بنجاح</span>
                  <button onClick={getLocation} className="text-[10px] bg-white px-2 py-1 rounded border border-green-200 font-bold">تحديث</button>
                </div>
              ) : (
                <button 
                  onClick={getLocation}
                  disabled={geoLoading}
                  className="w-full py-4 bg-white border-2 border-[var(--color-primary)] text-[var(--color-primary)] rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[var(--color-primary)] hover:text-white transition-all disabled:opacity-50"
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
              {geoError && <p className="text-[10px] text-red-500 font-bold mt-1">خطأ: {geoError === 'User denied Geolocation' ? 'يرجى السماح بالوصول للموقع من إعدادات المتصفح' : geoError}</p>}
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mt-6">
              <h3 className="font-bold text-sm text-orange-800 mb-1">ملخص الطلب</h3>
              <p className="font-bold text-lg text-slate-900">{customProduct || 'بيبسي'} <span className="text-sm font-normal text-slate-600">({quantity} {unit})</span></p>
              <p className="text-xs text-orange-700 mt-2 font-medium">سيتم إرسال إشعار فوري للموردين في نطاق 10 كم.</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100">
        {step < 3 ? (
          <button 
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && !customProduct.trim()}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50"
          >
            التالي
          </button>
        ) : (
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-[var(--color-accent)] text-white rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-[0_4px_14px_0_rgba(243,156,18,0.39)] disabled:opacity-50"
          >
            {loading ? 'جاري إرسال الطلب...' : 'ارسل الطلب للموردين 🚀'}
          </button>
        )}
      </div>
    </div>
  );
}

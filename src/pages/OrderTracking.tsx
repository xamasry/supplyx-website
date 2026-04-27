import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Package, Clock, CheckCircle2, ChevronRight, MessageCircle, MapPin, Upload, Loader2, Phone } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import Chat from '../components/Chat';

export default function OrderTracking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isSupplier = location.pathname.includes('/supplier/');
  
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, 'requests', id);
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setRequest({ id: snapshot.id, ...snapshot.data() });
      } else {
        // Maybe it's not a request but something else?
        // For now assume it's a request
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `requests/${id}`);
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'requests', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `requests/${id}`);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
      <Loader2 className="w-10 h-10 animate-spin mb-2" />
      <p className="font-bold">جاري تحميل تفاصيل الطلب...</p>
    </div>
  );

  if (!request) return (
    <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 mt-10">
      <p className="text-slate-500 font-bold">الطلب غير موجود</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-[var(--color-primary)] font-bold">العودة</button>
    </div>
  );

  const getNumericStatus = (status: string) => {
    switch (status) {
      case 'accepted': return 1;
      case 'preparing': return 2;
      case 'shipped': return 3;
      case 'delivered': return 4;
      default: return 1;
    }
  };

  const statusLevel = getNumericStatus(request.status);
  const mapUrl = request.buyerConfirmLocation 
    ? `https://www.google.com/maps?q=${request.buyerConfirmLocation.lat},${request.buyerConfirmLocation.lng}`
    : null;

  return (
    <div className="space-y-6 pb-6 font-sans">
      {/* Chat Component Overlay */}
      {showChat && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold font-display text-slate-900">المحادثة الفورية</h3>
                <button 
                  onClick={() => setShowChat(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
              </div>
              <Chat 
                requestId={id!} 
                receiverId={isSupplier ? request.buyerId : request.supplierId} 
                receiverName={isSupplier ? request.buyerName : request.supplierName} 
              />
           </div>
        </div>
      )}

      {/* Sticky Chat Button */}
      {request.status !== 'delivered' && (
        <button 
          onClick={() => setShowChat(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center shadow-2xl z-40 hover:scale-110 active:scale-95 transition-all animate-bounce-subtle"
        >
          <MessageCircle className="w-7 h-7" />
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
      )}

      <header className="flex items-center">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 text-slate-700">
          <ChevronRight className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-lg text-slate-900 font-display">تفاصيل الطلب #{request.id.slice(0, 8)}</h1>
      </header>

      {/* Map Placeholder */}
      <div className="h-48 bg-slate-200 rounded-3xl border border-slate-300 overflow-hidden relative shadow-sm">
        {mapUrl ? (
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full group">
            <img src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&q=80" alt="Map" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-xl border border-slate-200 flex flex-col items-center gap-1 group-hover:scale-105 transition-transform">
                <MapPin className="w-6 h-6 text-blue-600" />
                <span className="font-bold text-xs text-slate-800">اضغط لفتح الموقع في خرائط Google</span>
              </div>
            </div>
          </a>
        ) : (
          <>
            <img src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&q=80" alt="Map" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg border border-slate-200 flex items-center gap-2">
                 <div className="w-3 h-3 bg-[var(--color-success)] rounded-full animate-pulse"></div>
                 <span className="font-bold text-sm text-slate-800">جاري التتبع الحي...</span>
               </div>
            </div>
          </>
        )}
      </div>

      {/* Tracking Timeline */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <h3 className="font-bold text-lg text-slate-900 mb-6 font-display">حالة الطلب</h3>
        
        <div className="relative border-r-2 border-slate-100 pr-6 space-y-8 mr-2">
          {/* Timeline Line Active */}
          <div className="absolute top-0 right-[-2px] w-[2px] bg-[var(--color-primary)] transition-all duration-500" style={{ height: `${Math.max(0, ((statusLevel - 1) / 3) * 100)}%` }}></div>
          
          <div className="relative">
            <div className={cn("absolute -right-[35px] w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white", statusLevel >= 1 ? "border-[var(--color-primary)] text-[var(--color-primary)] shadow-[0_0_8px_rgba(30,78,121,0.3)]" : "border-slate-300 text-slate-300")}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h4 className={cn("font-bold text-sm transition-colors", statusLevel >= 1 ? "text-slate-900" : "text-slate-500")}>تم تأكيد الطلب</h4>
            <p className="text-[10px] text-slate-500 mt-1 font-bold">تم اختيار المورد</p>
          </div>
          
          <div className="relative">
             <div className={cn("absolute -right-[35px] w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white", statusLevel >= 2 ? "border-[var(--color-primary)] text-[var(--color-primary)] shadow-[0_0_8px_rgba(30,78,121,0.3)]" : "border-slate-300 text-slate-300")}>
              {statusLevel >= 2 ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-slate-300"></div>}
            </div>
            <h4 className={cn("font-bold text-sm transition-colors", statusLevel >= 2 ? "text-slate-900" : "text-slate-500")}>جاري التجهيز</h4>
            <p className="text-[10px] text-slate-500 mt-1">المورد يقوم بتحضير منتجاتك الآن</p>
          </div>

          <div className="relative">
             <div className={cn("absolute -right-[35px] w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white", statusLevel >= 3 ? "border-[var(--color-primary)] text-[var(--color-primary)] shadow-[0_0_8px_rgba(30,78,121,0.3)]" : "border-slate-300 text-slate-300")}>
              {statusLevel >= 3 ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-slate-300"></div>}
            </div>
            <h4 className={cn("font-bold text-sm transition-colors", statusLevel >= 3 ? "text-slate-900" : "text-slate-500")}>في الطريق إليك</h4>
            <p className="text-[10px] text-slate-500 mt-1">{statusLevel >= 3 ? 'المندوب تحرك من مقر المورد' : 'بانتظار خروج المندوب'}</p>
          </div>

          <div className="relative">
             <div className={cn("absolute -right-[35px] w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white", statusLevel >= 4 ? "border-[var(--color-success)] text-[var(--color-success)] shadow-[0_0_8px_rgba(39,174,96,0.3)]" : "border-slate-300 text-slate-300")}>
              {statusLevel >= 4 ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-slate-300"></div>}
            </div>
            <h4 className={cn("font-bold text-sm transition-colors", statusLevel >= 4 ? "text-slate-900" : "text-slate-500")}>تم التسليم</h4>
            <p className="text-[10px] text-slate-500 mt-1">{statusLevel >= 4 ? 'وصل الطلب بنجاح' : 'جاري الوصول'}</p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <h4 className="font-bold text-slate-900 mb-4 font-display">تفاصيل الأطراف</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] text-slate-500 font-bold mb-1">المشتري</p>
            <p className="font-bold text-slate-900">{request.buyerName}</p>
            <a href={`tel:${request.buyerConfirmPhone}`} className="text-xs text-[var(--color-primary)] font-black mt-2 flex items-center gap-1">
              <Phone className="w-3 h-3" /> {request.buyerConfirmPhone || 'غير متوفر'}
            </a>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] text-slate-500 font-bold mb-1">المورد</p>
            <p className="font-bold text-slate-900">{request.supplierName}</p>
            <a href={`tel:${request.supplierPhone}`} className="text-xs text-[var(--color-primary)] font-black mt-2 flex items-center gap-1">
              <Phone className="w-3 h-3" /> {request.supplierPhone || 'غير متوفر'}
            </a>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <h4 className="font-bold text-slate-900 mb-4 font-display">تفاصيل الطلبية</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 font-bold">المنتج</span>
            <span className="text-slate-900 font-bold">{request.productName}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 font-bold">الكمية</span>
            <span className="text-slate-900 font-bold">{request.quantity}</span>
          </div>
          <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
            <span className="text-slate-500 font-bold">السعر الإجمالي</span>
            <span className="text-[var(--color-primary)] font-black text-lg">{(request.price || 0).toLocaleString('ar-EG')} ج.م</span>
          </div>
        </div>
      </div>

      {/* Chat / Action Box */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
               <Package className="w-5 h-5" />
             </div>
             <div>
               <h4 className="font-bold text-sm text-slate-900">{isSupplier ? request.buyerName : request.supplierName}</h4>
               <p className="text-[10px] text-slate-500 flex items-center gap-1 font-bold">
                 <MapPin className="w-3 h-3" /> {(isSupplier && request.buyerConfirmPhone) ? `الهاتف: ${request.buyerConfirmPhone}` : (request.location || 'بنها، القليوبية')}
               </p>
               {isSupplier && request.buyerConfirmPhone && (
                 <a href={`tel:${request.buyerConfirmPhone}`} className="text-[10px] text-[var(--color-primary)] font-black mt-1 inline-block bg-[var(--color-primary)]/10 px-2 py-0.5 rounded">
                   اتصال بالعميل
                 </a>
               )}
             </div>
          </div>
        </div>
        
        <div className="p-4 bg-[var(--color-brand-bg)] space-y-3">
          {/* Supplier Specific UI */}
          {isSupplier && statusLevel < 4 && (
             <div className="flex flex-col gap-3">
               <div className="flex gap-2">
                 <button 
                  onClick={() => updateStatus('preparing')} 
                  disabled={statusLevel >= 2} 
                  className="flex-1 py-4 text-sm font-bold bg-white border border-slate-100 rounded-2xl disabled:opacity-50 text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                 >
                   بدء التجهيز
                 </button>
                 <button 
                  onClick={() => updateStatus('shipped')} 
                  disabled={statusLevel >= 3 || statusLevel < 2} 
                  className="flex-1 py-4 text-sm font-bold bg-[var(--color-primary)] text-white rounded-2xl shadow-md disabled:opacity-50 hover:bg-[var(--color-primary-hover)] transition-all"
                 >
                   خرج للتوصيل
                 </button>
               </div>
               {statusLevel === 3 && (
                 <button 
                  onClick={() => updateStatus('delivered')} 
                  className="w-full py-4 mt-2 border-2 border-dashed border-[var(--color-success)] bg-[var(--color-success)]/5 text-[var(--color-success)] rounded-2xl flex items-center justify-center gap-2 font-black hover:bg-[var(--color-success)]/10 transition-colors"
                 >
                   <Upload className="w-5 h-5" /> تأكيد التسليم للعميل
                 </button>
               )}
             </div>
          )}

          {/* Buyer Specific UI */}
          {!isSupplier && statusLevel < 4 && (
             <div className="text-center p-5 bg-orange-50 border border-orange-100 rounded-2xl">
               <p className="text-sm font-black text-orange-800">الأموال محفوظة بأمان (Escrow)</p>
               <p className="text-xs text-orange-700 mt-2 font-bold leading-relaxed">سيتم تحويل المبلغ للمورد فور تأكيد استلامك للطلب أو خلال 48 ساعة من التوصيل التلقائي.</p>
             </div>
          )}
          {!isSupplier && statusLevel === 4 && (
            <button 
              onClick={() => updateStatus('delivered')} // Re-affirming delivery is same status but buyer confirmed
              className="w-full py-5 bg-[var(--color-success)] text-white rounded-2xl font-black text-lg shadow-lg shadow-[var(--color-success)]/20 hover:scale-[1.01] transition-transform"
            >
              تقييم التجربة وتأكيد الاستلام
            </button>
          )}
          {statusLevel === 4 && (
            <div className="text-center p-4">
               <p className="text-sm font-bold text-[var(--color-success)] bg-[var(--color-success)]/10 py-3 rounded-xl">مكتمل ✓</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

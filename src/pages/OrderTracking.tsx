import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Package, Clock, CheckCircle2, ChevronRight, MessageCircle, MapPin, Upload, Loader2, Phone, Star, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import Chat from '../components/Chat';
import toast from 'react-hot-toast';

import { motion, AnimatePresence } from 'motion/react';

export default function OrderTracking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isSupplier = location.pathname.includes('/supplier/');
  
  const [request, setRequest] = useState<any>(null);
  const [collectionName, setCollectionName] = useState<string>('requests');
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!id) return;

    let unsubRequest: (() => void) | null = null;
    let unsubOrder: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        // If not logged in, we can't fetch. Wait for auth.
        return;
      }

      // Cleanup previous listeners if any (though usually handled by return unsub)
      if (unsubRequest) unsubRequest();
      if (unsubOrder) unsubOrder();

      const requestRef = doc(db, 'requests', id);
      
      const setupOrderListener = () => {
        if (unsubOrder) return;
        const orderRef = doc(db, 'orders', id);
        unsubOrder = onSnapshot(orderRef, (orderSnap) => {
          if (orderSnap.exists()) {
            setRequest({ id: orderSnap.id, ...orderSnap.data() });
            setCollectionName('orders');
          } else if (!request) {
            // Only set null if we definitely haven't found a request either
            setRequest(null);
            toast.error('لم نتمكن من العثور على بيانات الطلب');
            navigate(-1);
          }
          setLoading(false);
        }, (err) => {
          console.error('Order fetch error:', err);
          if (err.code !== 'permission-denied' || !request) {
            handleFirestoreError(err, OperationType.GET, `orders/${id}`);
          }
          setLoading(false);
        });
      };

      unsubRequest = onSnapshot(requestRef, (snapshot) => {
        if (snapshot.exists()) {
          setRequest({ id: snapshot.id, ...snapshot.data() });
          setCollectionName('requests');
          setLoading(false);
          // If found in requests, ensure we stop order listener if it was running
          if (unsubOrder) {
            unsubOrder();
            unsubOrder = null;
          }
        } else {
          // If not in requests, ensure order listener is running
          setupOrderListener();
        }
      }, (error) => {
        console.error('Request fetch error:', error);
        // If request fetch fails (e.g. permission or not found), try order
        setupOrderListener();
      });
    });

    return () => {
      unsubAuth();
      if (unsubRequest) unsubRequest();
      if (unsubOrder) unsubOrder();
    };
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!id || !request) {
      toast.error('لم نتمكن من العثور على بيانات الطلب');
      return;
    }
    
    const loadingToast = toast.loading('جاري تحديث حالة الطلب...');
    try {
      const updateData = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(newStatus === 'delivered' && !isSupplier ? { buyerConfirmed: true } : {})
      };

      // 1. Update the main identified collection
      await updateDoc(doc(db, collectionName, id), updateData);

      // 3. Send Notification
      const receiverId = isSupplier ? request.buyerId : (request.supplierId || null);
      if (receiverId) {
        let title = '';
        let message = '';
        
        if (newStatus === 'cancelled') {
          title = 'تم إلغاء الطلب';
          message = `تم إلغاء الطلب #${id.slice(0, 8)} من قبل ${isSupplier ? 'المورد' : 'المشتري'}`;
        } else if (newStatus === 'rejected') {
          title = 'تم الاعتذار عن الطلب';
          message = `نأسف، لقد اعتذر المورد عن تنفيذ طلبك #${id.slice(0, 8)}`;
        } else if (newStatus === 'accepted') {
          title = 'تم قبول طلبك';
          message = `وافق المورد على تنفيذ طلبك #${id.slice(0, 8)} وهو الآن قيد المراجعة`;
        } else if (newStatus === 'preparing') {
          title = 'الطلب قيد التجهيز';
          message = `بدأ المورد في تجهيز طلبك #${id.slice(0, 8)}`;
        } else if (newStatus === 'shipped') {
          title = 'الطلب في الطريق';
          message = `خرج طلبك #${id.slice(0, 8)} للتوصيل الآن`;
        } else if (newStatus === 'delivered') {
          title = 'تم تسليم الطلب';
          message = isSupplier ? `أكد المورد تسليم طلبك #${id.slice(0, 8)}` : `أكد المشتري استلام الطلب #${id.slice(0, 8)} بنجاح`;
        }

        if (title) {
          try {
            await addDoc(collection(db, 'notifications'), {
              userId: receiverId,
              title,
              message,
              type: 'order_status_update',
              read: false,
              createdAt: serverTimestamp(),
              link: isSupplier ? `/buyer/orders/${id}` : `/supplier/orders/${id}`
            });
          } catch (notifErr) {
            console.error("Failed to send notification:", notifErr);
          }
        }
      }
      
      toast.dismiss(loadingToast);
      toast.success('تم تحديث حالة الطلب بنجاح');
      
    } catch (error: any) {
      toast.dismiss(loadingToast);
      handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
      const isPermissionError = error.message?.includes('permission-denied') || error.code === 'permission-denied';
      toast.error(isPermissionError ? 'ليس لديك صلاحية لتنفيذ هذا الإجراء' : 'تعذر تحديث حالة الطلب. حاول مرة أخرى.');
      throw error;
    }
  };

  const submitRating = async () => {
    if (!id || rating === 0) return;
    try {
      await updateDoc(doc(db, collectionName, id), {
        rating,
        ratingAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setRatingSubmitted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
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
      case 'pending': return 1;
      case 'active': return 1;
      case 'accepted': return 1.5;
      case 'preparing': return 2;
      case 'shipped': return 3;
      case 'delivered': return 4;
      case 'cancelled': return -1;
      case 'rejected': return -1;
      default: return 1;
    }
  };

  const statusLevel = getNumericStatus(request.status);
  const mapUrl = request.buyerConfirmLocation 
    ? `https://www.google.com/maps?q=${request.buyerConfirmLocation.lat},${request.buyerConfirmLocation.lng}`
    : null;

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      await updateStatus(newStatus);
      navigate(isSupplier ? '/supplier/orders' : '/buyer/orders');
    } catch (err) {
      // Error handled in updateStatus
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-24 font-sans max-w-lg mx-auto"
    >
      {/* Cancellation Confirmation Modal */}
      <AnimatePresence>
        {confirmCancel && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="font-black text-lg text-slate-900 mb-2 font-display">تأكيد الإجراء</h3>
              <p className="text-sm text-slate-600 font-bold mb-6">
                {isSupplier && (request.status === 'pending' || request.status === 'accepted')
                  ? 'هل أنت متأكد من رغبتك في الاعتذار عن تنفيذ هذا الطلب؟' 
                  : 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ قد يتم تطبيق رسوم إلغاء.'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setConfirmCancel(false)}
                  className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  تراجع
                </button>
                <button 
                  onClick={() => {
                    const isDecline = isSupplier && (request.status === 'pending' || request.status === 'accepted');
                    handleStatusUpdate(isDecline ? 'rejected' : 'cancelled');
                  }}
                  className="py-3 bg-red-500 text-white rounded-xl font-black hover:bg-red-600 shadow-lg shadow-red-200 transition-all active:scale-95"
                >
                  تأكيد الإλغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Component Overlay */}
      <AnimatePresence>
        {showChat && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                  <h3 className="font-bold font-display text-slate-900">المحادثة الفورية</h3>
                  <button 
                    onClick={() => setShowChat(false)}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 rotate-90" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Chat 
                    requestId={id!} 
                    receiverId={(isSupplier ? request.buyerId : request.supplierId) || ''} 
                    receiverName={(isSupplier ? request.buyerName : request.supplierName) || 'المستخدم'} 
                    collectionName={collectionName}
                  />
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Chat Button */}
      {request.status !== 'delivered' && (
        <motion.button 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowChat(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center shadow-2xl z-[60] animate-bounce-subtle"
        >
          <MessageCircle className="w-7 h-7" />
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
        </motion.button>
      )}

      <header className="flex items-center">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 text-slate-700 transition-colors">
          <ChevronRight className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-lg text-slate-900 font-display">تفاصيل الطلب #{request.id.slice(0, 8)}</h1>
      </header>

      {/* Cancellation Block */}
      {(request.status === 'cancelled' || request.status === 'rejected') && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-100 rounded-3xl p-6 text-center space-y-3"
        >
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-red-900 font-display">
            {request.status === 'cancelled' ? 'تم إلغاء الطلب' : 'تم الاعتذار عن الطلب'}
          </h2>
          <p className="text-sm text-red-700 font-bold max-w-xs mx-auto">
            {request.status === 'cancelled' 
              ? 'لقد تم إلغاء هذا الطلب بنجاح. إذا تم دفع أي مبالغ فستظهر في محفظتك.' 
              : 'نعتذر، المورد لا يمكنه تنفيذ هذا الطلب حالياً.'}
          </p>
          <button 
            onClick={() => navigate(isSupplier ? '/supplier/orders' : '/buyer/orders')}
            className="text-xs font-black text-red-900 bg-red-200/50 px-4 py-2 rounded-xl active:scale-95 transition-all"
          >
            العودة لسجل الطلبات
          </button>
        </motion.div>
      )}

      {/* Map Placeholder */}
      {request.status !== 'cancelled' && request.status !== 'rejected' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="h-48 bg-slate-200 rounded-3xl border border-slate-300 overflow-hidden relative shadow-sm"
        >
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
        </motion.div>
      )}


      {/* Order Items List */}
      {request.items && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
              <Package size={18} />
            </div>
            <h3 className="font-bold text-slate-900 font-display">تفاصيل المنتجات المطلوبة</h3>
          </div>
          <div className="space-y-2">
            {request.items.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                  <span className="text-[10px] text-slate-400 font-black">{item.quantity} {item.unit} × {item.price} ج.م</span>
                </div>
                <span className="font-display font-black text-slate-900">{(item.price * item.quantity).toLocaleString()} ج.م</span>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-100 flex justify-between items-center px-2">
              <span className="font-bold text-slate-500 text-sm">الإجمالي</span>
              <span className="text-xl font-display font-black text-[var(--color-primary)]">{(request.totalAmount || 0).toLocaleString()} ج.م</span>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Timeline */}
      {statusLevel !== -1 && (
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
      )}

      {/* Info Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <h4 className="font-bold text-slate-900 mb-4 font-display">تفاصيل الأطراف</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] text-slate-500 font-bold mb-1">المشتري</p>
            <p className="font-bold text-slate-900">{request.buyerName}</p>
            <a href={`tel:${request.buyerConfirmPhone || request.buyerPhone}`} className="text-xs text-[var(--color-primary)] font-black mt-2 flex items-center gap-1">
              <Phone className="w-3 h-3" /> {request.buyerConfirmPhone || request.buyerPhone || 'غير متوفر'}
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
            <span className="text-slate-500 font-bold">المنتج الرئيسي</span>
            <span className="text-slate-900 font-bold">{request.productName || (request.items ? 'منتجات من الكتالوج' : 'غير محدد')}</span>
          </div>
          {request.quantity && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">الكمية</span>
              <span className="text-slate-900 font-bold">{request.quantity}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
            <span className="text-slate-500 font-bold">السعر الإجمالي</span>
            <span className="text-[var(--color-primary)] font-black text-lg">{(request.totalAmount || request.price || 0).toLocaleString('ar-EG')} ج.م</span>
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
                 <MapPin className="w-3 h-3" /> {(isSupplier && (request.buyerConfirmPhone || request.buyerPhone)) ? `الهاتف: ${request.buyerConfirmPhone || request.buyerPhone}` : (request.location || 'بنها، القليوبية')}
               </p>
               {isSupplier && (request.buyerConfirmPhone || request.buyerPhone) && (
                 <a href={`tel:${request.buyerConfirmPhone || request.buyerPhone}`} className="text-[10px] text-[var(--color-primary)] font-black mt-1 inline-block bg-[var(--color-primary)]/10 px-2 py-0.5 rounded">
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
                 {request.status === 'pending' && (
                   <button 
                    onClick={() => updateStatus('accepted')} 
                    className="flex-1 py-4 text-sm font-black bg-[var(--color-primary)] text-white rounded-2xl shadow-lg hover:brightness-110 transition-all scale-105 z-10"
                   >
                     قبول الطلب وتأكيده
                   </button>
                 )}
                 {request.status !== 'pending' && (
                   <>
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
                   </>
                 )}
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
               {statusLevel === 3 && (
                 <button 
                   onClick={() => updateStatus('delivered')}
                   className="w-full py-4 mt-4 bg-[var(--color-success)] text-white rounded-2xl font-black shadow-lg shadow-[var(--color-success)]/20 active:scale-95 transition-all"
                 >
                   تأكيد استلام الطلب الآن
                 </button>
               )}
             </div>
          )}
          {!isSupplier && statusLevel === 4 && !request.rating && (
            <div className="p-5 bg-white rounded-2xl border border-slate-100 space-y-4">
              <div className="text-center">
                <h4 className="font-bold text-slate-900">كيف كانت تجربتك؟</h4>
                <p className="text-xs text-slate-500 mt-1">تقييمك يساعدنا في تحسين جودة الموردين</p>
              </div>
              
              <div className="flex justify-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform active:scale-90"
                  >
                    <Star 
                      className={cn(
                        "w-8 h-8 transition-colors",
                        star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                      )} 
                    />
                  </button>
                ))}
              </div>

              <button 
                onClick={submitRating}
                disabled={rating === 0 || ratingSubmitted}
                className="w-full py-4 bg-[var(--color-primary)] text-white rounded-2xl font-black text-lg shadow-lg disabled:opacity-50 transition-all active:scale-95"
              >
                {ratingSubmitted ? 'تم التقييم بنجاح' : 'إرسال التقييم'}
              </button>
            </div>
          )}
          {!isSupplier && statusLevel === 4 && request.rating && (
            <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="flex justify-center gap-1 mb-2">
                 {[1, 2, 3, 4, 5].map(s => (
                   <Star key={s} className={cn("w-4 h-4", s <= request.rating ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
                 ))}
               </div>
               <p className="text-sm font-bold text-slate-600">شكراً لتقييمك! تم إغلاق الطلب بنجاح.</p>
            </div>
          )}
          {statusLevel === 4 && (
            <div className="text-center p-4">
               {isSupplier && request.rating && (
                 <div className="mb-4 p-3 bg-amber-50 rounded-2xl border border-amber-100 animate-in zoom-in duration-300">
                    <p className="text-[10px] text-amber-600 font-black mb-1 uppercase tracking-wider">تقييم العميل</p>
                    <div className="flex justify-center gap-1.5 mb-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={cn("w-4 h-4", s <= request.rating ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
                      ))}
                    </div>
                 </div>
               )}
               <p className="text-sm font-bold text-[var(--color-success)] bg-[var(--color-success)]/10 py-3 rounded-xl">مكتمل ✓</p>
            </div>
          )}

          {/* Cancellation Button */}
          {statusLevel < 4 && statusLevel >= 1 && (
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2 relative z-10">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmCancel(true);
                }}
                className="w-full py-4 text-xs font-black text-red-600 hover:text-red-700 transition-all flex items-center justify-center gap-2 bg-red-50/50 border border-red-100 rounded-2xl cursor-pointer active:scale-[0.98] pointer-events-auto"
              >
                {isSupplier 
                  ? (request.status === 'pending' || request.status === 'accepted' ? 'الاعتذار عن تنفيذ الطلب' : 'إلغاء الطلب وتحميله للمورد') 
                  : (statusLevel < 2 ? 'إلغاء الطلب وسحب المستحقات' : 'طلب إلغاء الطلب (قد يطلب منك المورد تعويض)')}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

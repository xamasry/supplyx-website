import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Clock, Star, MapPin, CheckCircle2, AlertTriangle, Loader2, Navigation } from 'lucide-react';
import { cn, calculateDistance } from '../../lib/utils';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { doc, getDoc, collection, query, onSnapshot, orderBy, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useGeolocation } from '../../hooks/useGeolocation';

export default function RequestDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [request, setRequest] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { location: buyerLocation, getLocation } = useGeolocation();

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  useEffect(() => {
    if (!id) return;

    // Fetch request details
    const reqRef = doc(db, 'requests', id);
    const unsubReq = onSnapshot(reqRef, (snapshot) => {
      if (snapshot.exists()) {
        setRequest({ id: snapshot.id, ...snapshot.data() });
      } else {
        alert("الطلب غير موجود");
        navigate('/buyer/home');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `requests/${id}`);
      setLoading(false);
    });

    // Fetch bids
    const bidsRef = collection(db, `requests/${id}/bids`);
    const q = query(bidsRef, orderBy('price', 'asc'));
    const unsubBids = onSnapshot(q, (snapshot) => {
      const bidsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBids(bidsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `requests/${id}/bids`);
    });

    return () => {
      unsubReq();
      unsubBids();
    };
  }, [id, navigate]);

  const [isAccepting, setIsAccepting] = useState<string | null>(null);

  const handleAccept = async (bidId: string) => {
    if(!id || !request) return;
    
    const bidToAccept = bids.find(b => b.id === bidId);
    if (!bidToAccept) return;
    
    setIsAccepting(bidId);
    try {
      const batch = writeBatch(db);
      
      // Update request status and store supplier info
      batch.update(doc(db, 'requests', id), {
        status: 'accepted',
        acceptedBidId: bidId,
        supplierId: bidToAccept.supplierId,
        supplierName: bidToAccept.supplierName,
        price: bidToAccept.price,
        deliveryTime: bidToAccept.deliveryTime,
        updatedAt: serverTimestamp()
      });
      
      // Update bid status
      batch.update(doc(db, 'requests', id, 'bids', bidId), {
        status: 'accepted',
        updatedAt: serverTimestamp()
      });

      // Create notification for supplier
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: bidToAccept.supplierId,
        title: 'تم قبول عرضك!',
        message: `تم قبول عرضك للطلب "${request.productName}". يمكنك الآن البدء بالتجهيز.`,
        type: 'bid_accepted',
        read: false,
        createdAt: serverTimestamp(),
        link: `/supplier/orders`
      });
      
      await batch.commit();
      navigate('/buyer/home');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `requests/${id}/bids/${bidId}`);
    } finally {
      setIsAccepting(null);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
      <Loader2 className="w-10 h-10 animate-spin mb-2" />
      <p className="font-bold">جاري تحميل تفاصيل الطلب والمنافسات...</p>
    </div>
  );

  if (!request) return null;

  return (
    <div className="space-y-4 pb-6 font-sans">
      <header className="flex items-center justify-between pb-2">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 text-slate-700">
          <ChevronRight className="w-6 h-6" />
        </button>
        <span className={cn("font-bold text-sm flex items-center gap-1", request.status === 'active' ? "text-[var(--color-danger)]" : "text-slate-500")}>
           {request.status === 'active' ? (
             <><AlertTriangle className="w-4 h-4"/> الطلب نشط الآن</>
           ) : (
             <><CheckCircle2 className="w-4 h-4"/> الطلب مكتمل</>
           )}
        </span>
      </header>

      {/* Request Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1.5 bg-[var(--color-primary)] h-full"></div>
        <div className="flex justify-between items-start">
          <div>
            <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-1">طلب #{request.id.slice(0,5)}</span>
            <h1 className="font-display font-bold text-xl text-slate-900">{request.productName}</h1>
            <p className="font-semibold text-slate-700 mt-1">الكمية: {request.quantity}</p>
          </div>
          <div className="bg-[var(--color-brand-bg)] p-2 rounded-xl text-center border border-slate-100">
            <span className="block text-2xl font-bold text-[var(--color-accent)] leading-none">{bids.length}</span>
            <span className="block text-[10px] font-bold text-slate-500 mt-1">عروض</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 mt-6">
          <h2 className="font-bold text-slate-900 text-right w-full">العروض المباشرة (Live Bids)</h2>
          {request.status === 'active' && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          )}
        </div>

        <div className="space-y-3">
          {bids.map((bid, index) => (
            <div key={bid.id} className={cn(
              "bg-white rounded-2xl p-4 shadow-sm border transition-all duration-500 animate-in slide-in-from-bottom-4 fade-in",
              index === 0 ? "border-[var(--color-success)] ring-1 ring-[var(--color-success)]/20" : "border-slate-200"
            )}>
              {index === 0 && bid.status !== 'accepted' && (
                <div className="bg-[var(--color-success)] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl absolute top-0 right-0 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  أفضل سعر
                </div>
              )}
              
              <div className="flex justify-between items-start mb-3 pt-2">
                <div className="flex flex-col gap-0.5">
                   <h3 className="font-bold text-slate-900 leading-tight pr-2">{bid.supplierName}</h3>
                   {buyerLocation && bid.coordinates && (
                     <span className="text-[10px] text-[var(--color-primary)] font-bold pr-2 flex items-center gap-1">
                       <Navigation className="w-3 h-3" /> يبعد عنك {calculateDistance(buyerLocation.lat, buyerLocation.lng, bid.coordinates.lat, bid.coordinates.lng).toFixed(1)} كم
                     </span>
                   )}
                </div>
                <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded text-xs font-bold">
                  4.8 <Star className="w-3 h-3 fill-current" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-right">
                  <span className="block text-[10px] text-slate-500 font-semibold mb-0.5">السعر الإجمالي</span>
                  <span className="block font-bold text-lg text-[var(--color-primary)]">{bid.price} ج.م</span>
                </div>
                <div className="border-r border-slate-200 pr-2 text-right">
                  <span className="block text-[10px] text-slate-500 font-semibold mb-0.5">التوصيل خلال</span>
                  <div className="flex items-center gap-1 text-slate-900 font-bold justify-end">
                    <Clock className="w-4 h-4 text-orange-500" /> {bid.deliveryTime} دقيقة
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
                  <MapPin className="w-3.5 h-3.5" />
                  {bid.notes || 'سعر منافس جداً'}
                </div>
                {request.status === 'active' && (
                  <button 
                    onClick={() => handleAccept(bid.id)}
                    disabled={!!isAccepting}
                    className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold text-sm hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isAccepting === bid.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري القبول...
                      </>
                    ) : 'اختيار العرض'}
                  </button>
                )}
                {bid.status === 'accepted' && (
                  <div className="px-4 py-2 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-lg font-bold text-sm border border-[var(--color-success)]/20">
                    تم القبول
                  </div>
                )}
              </div>
            </div>
          ))}
          {bids.length === 0 && (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
               <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
               <p className="text-slate-500 font-bold">بانتظار عروض الموردين...</p>
               <p className="text-xs text-slate-400 mt-1">ستظهر العروض هنا فور إرسالها</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

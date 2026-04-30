import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Clock, MapPin, Send, Loader2, Navigation, Package } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useGeolocation } from '../../hooks/useGeolocation';
import { calculateDistance } from '../../lib/utils';
import { trackEvent } from '../../lib/analytics';

export default function SupplierRequestDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [price, setPrice] = useState('0');
  const [deliveryTime, setDeliveryTime] = useState('30');

  useEffect(() => {
    if (request?.requestType === 'bulk') {
      setDeliveryTime('1');
    } else {
      setDeliveryTime('30');
    }
  }, [request?.requestType]);
  const [notes, setNotes] = useState('');
  const [itemsPrices, setItemsPrices] = useState<{[key: number]: string}>({});
  const [existingBid, setExistingBid] = useState<any>(null);
  const { location: supplierLocation, getLocation } = useGeolocation();

  useEffect(() => {
    getLocation();
  }, [getLocation]);
  
  useEffect(() => {
    async function fetchRequest() {
      if (!id) return;
      try {
        const docRef = doc(db, 'requests', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRequest({ id: docSnap.id, ...docSnap.data() });
        } else {
          toast.error("الطلب غير موجود");
          navigate('/supplier/home');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `requests/${id}`);
      } finally {
        setLoading(false);
      }
    }
    fetchRequest();
  }, [id, navigate]);

  useEffect(() => {
    if (!id || !auth.currentUser || !request) return;

    const bidsRef = collection(db, `requests/${id}/bids`);
    const q = query(bidsRef, where('supplierId', '==', auth.currentUser.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const b = snapshot.docs[0];
        setExistingBid({ id: b.id, ...b.data() });
        setPrice(b.data().price.toString());
        setDeliveryTime(b.data().deliveryTime.toString());
        setNotes(b.data().notes || '');
        if (b.data().itemsPrices) {
          setItemsPrices(b.data().itemsPrices);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `requests/${id}/bids`);
    });

    return () => unsubscribe();
  }, [id, request, auth.currentUser]);

  useEffect(() => {
    if (request?.requestType === 'bulk') {
      const total = Object.values(itemsPrices).reduce((sum: number, val) => sum + (Number(val) || 0), 0);
      setPrice(total.toString());
    }
  }, [itemsPrices, request]);

  const handleItemPriceChange = (index: number, val: string) => {
    setItemsPrices(prev => ({...prev, [index]: val}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error("يرجى تسجيل الدخول أولاً");
      navigate('/auth/login');
      return;
    }

    setSubmitting(true);
    const bidsCollectionPath = `requests/${id}/bids`;
    try {
      if (request.requestType === 'bulk') {
        if (request.items && Object.keys(itemsPrices).length !== request.items.length) {
          toast.error('يرجى تسعير جميع المنتجات المطلوبة');
          setSubmitting(false);
          return;
        }
      }

      if (existingBid) {
        // Update existing bid
        await updateDoc(doc(db, `requests/${id}/bids`, existingBid.id), {
          price: Number(price),
          deliveryTime: Number(deliveryTime),
          notes,
          itemsPrices: request.requestType === 'bulk' ? itemsPrices : null,
          updatedAt: serverTimestamp(),
          coordinates: supplierLocation ? { lat: supplierLocation.lat, lng: supplierLocation.lng } : null
        });
        toast.success('تم تحديث عرضك بنجاح');
      } else {
        // Create new bid
        await addDoc(collection(db, bidsCollectionPath), {
          requestId: id,
          supplierId: auth.currentUser.uid,
          supplierName: auth.currentUser.displayName || 'مورد بنها',
          price: Number(price),
          deliveryTime: Number(deliveryTime),
          notes,
          itemsPrices: request.requestType === 'bulk' ? itemsPrices : null,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          coordinates: supplierLocation ? { lat: supplierLocation.lat, lng: supplierLocation.lng } : null
        });

        // Update bidsCount on request
        await updateDoc(doc(db, 'requests', id as string), {
          bidsCount: increment(1),
          updatedAt: serverTimestamp()
        });

        // Create notification for buyer
        await addDoc(collection(db, 'notifications'), {
          userId: request.buyerId,
          title: 'عرض جديد!',
          message: `تلقيت عرضاً جديداً لطلبك "${request.productName}" بقيمة ${price} ج.م.`,
          type: 'new_bid',
          read: false,
          createdAt: serverTimestamp(),
          link: `/buyer/request/${id}`
        });

        toast.success('تم إرسال العرض بنجاح! سيتم إشعارك فور رد المشتري.');
      }
      
      trackEvent('bid_submitted', {
        requestId: id,
        requestType: request.requestType,
        price: Number(price),
        isUpdate: !!existingBid
      });

      navigate('/supplier/home');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, bidsCollectionPath);
    } finally {
      setSubmitting(false);
    }
  };

  const distance = (supplierLocation && request?.coordinates) 
    ? calculateDistance(supplierLocation.lat, supplierLocation.lng, request.coordinates.lat, request.coordinates.lng)
    : null;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
      <Loader2 className="w-10 h-10 animate-spin mb-2" />
      <p className="font-bold">جاري تحميل تفاصيل الطلب...</p>
    </div>
  );

  if (!request) return null;

  return (
    <div className="space-y-6 pb-6 font-sans">
      <header className="flex items-center">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 text-slate-700">
          <ChevronRight className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-lg text-slate-900 font-display">تقديم عرض أسعار</h1>
      </header>

      {/* Request Details */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-300 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1.5 bg-[var(--color-danger)] h-full"></div>
        <div className="flex justify-between items-start mb-4">
          <div>
            {request.requestType === 'bulk' && !request.isUrgent && (
              <span className="text-xs font-bold text-slate-700 bg-slate-100 flex items-center gap-1 mb-2 px-2 py-1 rounded w-fit border border-slate-200">
                <Package className="w-4 h-4" /> مناقصة جملة
              </span>
            )}
            {request.isUrgent && (
              <span className="text-xs font-bold text-[var(--color-danger)] flex items-center gap-1 mb-2">
                <Clock className="w-4 h-4" /> طلب عاجل
              </span>
            )}
            <h2 className="font-display font-bold text-2xl text-slate-900">{request.productName}</h2>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          {request.requestType !== 'bulk' ? (
            <div>
              <p className="text-[10px] text-slate-500 font-bold mb-1">الكمية المطلوبة</p>
              <p className="font-bold text-lg text-[var(--color-primary)] drop-shadow-sm">{request.quantity} <span className="text-sm">{request.unit}</span></p>
            </div>
          ) : (
            <div className="col-span-2">
              <p className="text-[10px] text-slate-500 font-bold mb-2">المنتجات المطلوبة ({request.items?.length})</p>
              <ul className="space-y-1">
                {request.items?.map((item: any, i: number) => (
                  <li key={i} className="flex justify-between items-center text-sm bg-white p-2 border border-slate-100 rounded-lg">
                    <span className="font-bold text-slate-800">{item.productName}</span>
                    <span className="text-slate-500 font-bold">{item.quantity} {item.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={request.requestType === 'bulk' ? 'col-span-2 pt-2 border-t border-slate-200' : ''}>
            <p className="text-[10px] text-slate-500 font-bold mb-1">موقع التوصيل</p>
            <p className="font-bold text-sm text-slate-800 flex items-center gap-1">
              <MapPin className="w-4 h-4 text-slate-400" /> {request.buyerName}
            </p>
            {distance !== null && (
              <p className="text-[10px] text-[var(--color-primary)] font-bold mt-1 flex items-center gap-1">
                <Navigation className="w-3 h-3" /> يبعد عنك {distance < 1 ? 'أقل من 1 كم' : `${distance.toFixed(1)} كم`}
              </p>
            )}
          </div>
        </div>
        
        {request.notes && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-[10px] text-blue-600 font-bold mb-1">ملاحظات المشتري:</p>
            <p className="text-xs text-slate-700">{request.notes}</p>
          </div>
        )}
      </div>

      {/* Bid Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm border border-[var(--color-primary)]/20">
        <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
           <Send className="w-5 h-5 text-[var(--color-primary)]" /> {existingBid ? 'تحديث عرضك' : 'تفاصيل عرضك'}
        </h3>
        
        <div className="space-y-5">
          {request.requestType === 'bulk' && request.items && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-700">تسعير المنتجات (لإجمالي الكمية المطلوبة)</p>
              {request.items.map((item: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="block font-bold text-slate-800 text-sm">{item.productName}</span>
                    <span className="text-xs text-slate-500">{item.quantity} {item.unit}</span>
                  </div>
                  <div className="w-1/3 relative">
                    <input
                      type="number"
                      placeholder="السعر"
                      value={itemsPrices[idx] || ''}
                      onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                      className="w-full bg-[var(--color-brand-bg)] border border-slate-300 rounded-xl py-3 px-3 outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-bold text-sm"
                      required
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">ج.م</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="space-y-2 text-right">
            <label className="text-sm font-bold text-slate-700">السعر الإجمالي (بالجنيه)</label>
            <input 
              type="number" 
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={request.requestType === 'bulk'}
              className="w-full bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-bold text-xl text-[var(--color-primary)] transition-all disabled:opacity-80 disabled:bg-slate-100" 
              required 
            />
          </div>
          
          <div className="space-y-2 text-right relative">
            <label className="text-sm font-bold text-slate-700 flex justify-between">
              <span>وقت التوصيل</span>
              <span className="text-[var(--color-accent)]">
                {request.requestType === 'bulk' ? `${deliveryTime} أيام` : `${deliveryTime} دقيقة`}
              </span>
            </label>
            <input 
              type="range" 
              min={request.requestType === 'bulk' ? "1" : "5"} 
              max={request.requestType === 'bulk' ? "14" : "120"} 
              step={request.requestType === 'bulk' ? "1" : "5"}
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className="w-full mt-2 accent-[var(--color-primary)]" 
              required 
            />
          </div>
          
          <div className="space-y-2 text-right">
            <label className="text-sm font-bold text-slate-700">ملاحظات إضافية (اختياري)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: التوصيل مجاني، المنتج متوفر بتاريخ اليوم..." 
              className="w-full h-24 bg-[var(--color-brand-bg)] border border-slate-300 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm transition-all"
            ></textarea>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={submitting}
          className="w-full mt-8 py-4 bg-[var(--color-primary)] text-white rounded-2xl font-bold text-lg hover:bg-[var(--color-primary-hover)] transition-all shadow-[0_4px_14px_0_rgba(31,78,121,0.39)] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {submitting ? 'جاري الإرسال...' : (existingBid ? 'تحديث العرض الآن' : 'إرسال العرض الآن')}
        </button>
      </form>
    </div>
  );
}

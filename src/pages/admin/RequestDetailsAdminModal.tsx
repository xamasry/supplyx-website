import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Phone, User, Package, Clock, ShieldAlert, CheckCircle2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function RequestDetailsAdminModal({ request, onClose }: { request: any, onClose: () => void }) {
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBids = async () => {
      if (!request?.id) return;
      try {
        const bidsSnap = await getDocs(collection(db, 'requests', request.id, 'bids'));
        const bidsData = bidsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBids(bidsData.sort((a: any, b: any) => a.price - b.price));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBids();
  }, [request]);

  if (!request) return null;

  const handleAdminAction = async (action: 'cancel' | 'refund' | 'complete') => {
    if (!window.confirm(`هل أنت متأكد من تنفيذ هذا الإجراء (${action})؟`)) return;
    try {
      const statusMap = {
        'cancel': 'cancelled',
        'refund': 'refunded',
        'complete': 'delivered'
      };
      await updateDoc(doc(db, 'requests', request.id), {
        status: statusMap[action],
        adminAction: action,
        updatedAt: serverTimestamp()
      });
      toast.success('تم تحديث حالة الطلب بنجاح');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء التحديث');
    }
  };

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
          className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-500" />
                تفاصيل الطلب: {request.productName}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                معرف الطلب: {request.id}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 text-right" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-300 border-b border-slate-800 pb-2">معلومات المشتري (المطعم)</h3>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-sm text-white">{request.buyerName || 'غير متوفر'}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">{request.buyerConfirmPhone || request.phone || 'لم يحدد بعد'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-1 border-none" />
                    <span className="text-sm text-slate-300">{request.address || 'לא يوجد عنوان'}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-bold text-slate-300 border-b border-slate-800 pb-2">معلومات المورد</h3>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                   {request.supplierId ? (
                     <>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-purple-400" />
                          <span className="font-bold text-sm text-white">{request.supplierName || 'غير متوفر'}</span>
                        </div>
                        {request.supplierPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-300">{request.supplierPhone}</span>
                          </div>
                        )}
                        <span className="inline-block mt-3 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-bold border border-emerald-500/20">
                          المبلغ: {request.totalAmount || request.price} ج.م
                        </span>
                     </>
                   ) : (
                     <div className="text-center py-6 text-slate-500 italic text-sm">
                       لم يتم ترسية الطلب على مورد بعد
                     </div>
                   )}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
               <h3 className="font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">تفاصيل الطلبية</h3>
               {request.requestType === 'bulk' && request.items ? (
                 <div className="space-y-2">
                    {request.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg text-sm">
                         <span className="font-bold text-white">{item.productName || item.name}</span>
                         <span className="text-slate-400">{item.quantity} {item.unit || 'وحدة'}</span>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="flex justify-between items-center bg-slate-800 p-3 rounded-lg text-sm">
                    <span className="font-bold text-white">{request.productName}</span>
                    <span className="text-slate-400">{request.quantity} وحدة</span>
                 </div>
               )}
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-slate-300 border-b border-slate-800 pb-2">العروض المقدمة ({bids.length})</h3>
              {loading ? (
                <div className="text-center text-slate-500 py-4">جاري تحميل العروض...</div>
              ) : bids.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {bids.map((bid) => (
                     <div key={bid.id} className={`p-4 rounded-xl border ${bid.status === 'accepted' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-sm text-white">{bid.supplierName}</span>
                          <span className="font-black text-emerald-400">{bid.price} ج.م</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="w-3 h-3" /> التوصيل: {bid.deliveryTime}
                        </div>
                        {bid.status === 'accepted' && (
                          <div className="mt-2 text-xs font-bold text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> العرض المقبول
                          </div>
                        )}
                     </div>
                   ))}
                </div>
              ) : (
                <div className="text-center text-slate-500 py-4 italic text-sm">لا توجد عروض مقدمة بعد.</div>
              )}
            </div>
          </div>

          {/* Admin Controls */}
          <div className="p-4 border-t border-slate-800 bg-slate-800/50 flex flex-wrap gap-3 justify-end">
            <button 
              onClick={() => handleAdminAction('cancel')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              إلغاء الطلب
            </button>
            <button 
              onClick={() => handleAdminAction('refund')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              إلغاء واسترجاع (Refund)
            </button>
            <button 
              onClick={() => handleAdminAction('complete')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              تحديد كمكتمل إدارياً
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

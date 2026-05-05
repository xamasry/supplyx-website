import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, LogIn, Lock, Package, ArrowLeft, Tag, Info, ShieldAlert, Store } from 'lucide-react';
import { CATEGORIES } from '../../constants';

export default function MarketplacePreview() {
  const [activeTab, setActiveTab] = useState<'offers' | 'tenders'>('offers');
  const [offers, setOffers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Offers
        const offersSnap = await getDocs(
          query(
            collection(db, 'offers'), 
            where('showInGuestMarketplace', '==', true),
            orderBy('createdAt', 'desc'), 
            limit(8)
          )
        );
        const offersData = offersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOffers(offersData);

        // Fetch Requests (Tenders/Urgent)
        const requestsSnap = await getDocs(
          query(collection(db, 'requests'), where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(8))
        );
        const requestsData = requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRequests(requestsData);

      } catch (err) {
        console.error('Error fetching marketplace preview:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleActionClick = () => {
    navigate('/auth/signup');
  };

  return (
    <section className="py-20 px-6 bg-slate-50 overflow-hidden relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-[#0B1D2A] tracking-tight mb-4">عروض حصرية لعملاء SupplyX</h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">
            اكتشف أحدث العروض والطلبات الحالية في السوق. للقيام بعمليات الشراء أو المشاركة في المناقصات، يرجى إنشاء حساب.
          </p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex">
            <button
              onClick={() => setActiveTab('offers')}
              className={`px-6 py-3 text-sm font-bold rounded-xl transition-all ${
                activeTab === 'offers' 
                  ? 'bg-[#22C55E] text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              العروض المتاحة
            </button>
            <button
              onClick={handleActionClick}
              className={`px-6 py-3 text-sm font-bold rounded-xl transition-all ${
                activeTab === 'tenders' 
                  ? 'bg-[#0B1D2A] text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              المناقصات والطلبات الطارئة
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-[#22C55E]"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'offers' && (
              <motion.div
                key="offers"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex overflow-x-auto pb-6 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:overflow-x-visible -mx-6 px-6 sm:mx-0 sm:px-0 snap-x hide-scrollbar"
              >
                {offers.length > 0 ? (
                  offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col min-w-[260px] md:min-w-0 snap-center"
                    >
                    <div className="relative aspect-square bg-slate-100 overflow-hidden">
                      {offer.image ? (
                        <img src={offer.image} alt={offer.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                           <span className="text-5xl">{CATEGORIES.find(c => c.id === offer.categoryId || c.name === offer.category || c.name === offer.categoryName)?.icon || '✨'}</span>
                        </div>
                      )}
                      {offer.discount && (
                        <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg z-10">
                          خصم {offer.discount}
                        </div>
                      )}
                    </div>
                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                      <div className="mb-3 sm:mb-4">
                        <h3 className="font-bold text-base sm:text-lg text-slate-900 mb-1 line-clamp-2">{offer.title}</h3>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium flex items-center gap-1">
                           <Store size={10} className="sm:w-3 sm:h-3" />
                           {offer.supplierName}
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          {offer.originalPrice && (
                            <span className="block text-[9px] sm:text-[10px] text-slate-400 line-through font-bold">{offer.originalPrice} ج.م</span>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="font-black text-lg sm:text-xl text-[#22C55E]">{offer.offerPrice}</span>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-500">ج.م {offer.unit ? `/ ${offer.quantity || 1} ${offer.unit}` : ''}</span>
                          </div>
                        </div>
                        <button 
                          onClick={handleActionClick}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-[#22C55E] hover:text-white transition-colors"
                          title="يتطلب تسجيل الدخول للشراء"
                        >
                          <ShoppingCart size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
                ) : (
                  <div className="col-span-full py-12 text-center text-slate-500">
                    لا توجد عروض متاحة حالياً.
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'tenders' && (
              <motion.div
                key="tenders"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {requests.length > 0 ? requests.map((request) => (
                  <div key={request.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                        {/* Blurred Overlay for non-authenticated users */}
                        <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] flex flex-col items-center justify-center sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <Lock className="w-10 h-10 text-slate-700 mb-4 bg-white/80 p-2 rounded-full shadow-lg" />
                            <p className="text-sm font-bold text-slate-800 mb-5 text-center px-6 leading-relaxed bg-white/80 py-2 rounded-xl shadow-sm mx-4">يجب تسجيل الدخول كمورد لرؤية تفاصيل الطلب والمشاركة في المناقصة.</p>
                            <button onClick={handleActionClick} className="px-8 py-3 bg-[#0B1D2A] text-white rounded-2xl text-sm font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-xl shadow-[#0B1D2A]/20">
                              <LogIn size={18} />
                              <span>سجل الآن</span>
                            </button>
                        </div>

                        <div className="absolute top-4 left-4 z-20 pointer-events-none group-hover:opacity-0 transition-opacity sm:opacity-100 opacity-0">
                           <div className="bg-slate-900/5 backdrop-blur-md text-slate-700 p-2 rounded-full">
                             <Lock size={16} />
                           </div>
                        </div>

                     <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-inner ${request.isUrgent ? 'bg-red-500' : 'bg-blue-500'}`}>
                              {request.isUrgent ? <ShieldAlert size={24} /> : <Package size={24} />}
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                 <h3 className="font-bold text-lg text-slate-900 blur-[2px] select-none">طلب {request.category || 'غير محدد'}</h3>
                                 {request.isUrgent && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-black">طارئ</span>
                                 )}
                              </div>
                              <p className="text-xs text-slate-400 font-medium blur-[2px] select-none">مطلوب بواسطة مطعم مجهول</p>
                           </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                           {new Date(request.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                     </div>

                     <div className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100">
                        <div className="flex justify-between items-center blur-[3px] select-none">
                           <span className="text-sm font-bold text-slate-600">المنتج المطلوب:</span>
                           <span className="text-sm font-black text-slate-900">{request.productName || 'غير محدد'}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2 blur-[3px] select-none">
                           <span className="text-sm font-bold text-slate-600">الكمية:</span>
                           <span className="text-sm font-black text-slate-900">{request.quantity || 'غير محدد'}</span>
                        </div>
                     </div>

                     <div className="flex justify-between items-center">
                        <div className="text-xs font-bold text-[#0B1D2A] flex items-center gap-1.5">
                           <Info size={14} className="text-slate-400" />
                           تفاصيل مخفية للزوار
                        </div>
                        <button onClick={handleActionClick} className="text-xs font-black text-[#22C55E] flex items-center gap-1 hover:text-[#16a34a] transition-colors">
                           تسجيل لتقديم عرض
                           <ArrowLeft size={14} />
                        </button>
                     </div>
                  </div>
                )) : (
                  <div className="col-span-full py-12 text-center text-slate-500">
                    لا توجد طلبات جارية حالياً.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <div className="mt-12 text-center">
          <Link to="/marketplace" className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:border-[#22C55E] hover:text-[#22C55E] transition-all">
            استكشاف جميع العروض والطلبات
            <ArrowLeft size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}

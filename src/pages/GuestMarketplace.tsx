import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, LogIn, Lock, Package, ArrowLeft, Tag, Info, ShieldAlert, ArrowRight, Search, Store } from 'lucide-react';
import { CATEGORIES } from '../constants';
import Logo from '../components/ui/Logo';
import { trackOfferInteraction } from '../lib/analytics';

export default function GuestMarketplace() {
  const [activeTab, setActiveTab] = useState<'offers' | 'tenders'>('offers');
  const [offers, setOffers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const offersSnap = await getDocs(
          query(
            collection(db, 'offers'), 
            where('showInGuestMarketplace', '==', true),
            orderBy('createdAt', 'desc')
          )
        );
        const offersData = offersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOffers(offersData);

        // Track views
        offersData.forEach((offer: any) => {
          trackOfferInteraction(offer.id, 'view', { title: offer.title, supplierName: offer.supplierName });
        });

        const requestsSnap = await getDocs(
          query(collection(db, 'requests'), where('status', '==', 'active'), orderBy('createdAt', 'desc'))
        );
        const requestsData = requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRequests(requestsData);

      } catch (err) {
        console.error('Error fetching marketplace:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleActionClick = () => {
    navigate('/auth/signup');
  };

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         offer.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory ? (
      offer.categoryId === selectedCategory || 
      offer.category === selectedCategory ||
      offer.categoryName === selectedCategory
    ) : true;
    return matchesSearch && matchesCategory;
  });

  const filteredRequests = requests.filter(req => {
    return req.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           req.category?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-[#0B1D2A] selection:bg-[#22C55E]/20">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowRight size={24} />
          </Link>
          <Logo size="sm" />
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth/login" className="hidden sm:inline-block px-5 py-2 text-sm font-bold text-slate-600 hover:text-[#0B1D2A] transition-colors">
            تسجيل الدخول
          </Link>
          <button onClick={handleActionClick} className="px-5 py-2 bg-[#22C55E] text-white text-sm font-bold rounded-full shadow-lg shadow-[#22C55E]/20 hover:scale-105 transition-all">
            سجل مجاناً
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 md:p-12 max-w-[1600px] mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">السوق المفتوح</h1>
            <p className="text-slate-500 font-medium">تصفح أحدث العروض والطلبات. يجب تسجيل الدخول للتفاعل.</p>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm self-start md:self-auto">
            <button
              onClick={() => setActiveTab('offers')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                activeTab === 'offers' ? 'bg-[#22C55E] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              العروض ({offers.length})
            </button>
            <button
              onClick={() => setActiveTab('tenders')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                activeTab === 'tenders' ? 'bg-[#0B1D2A] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              الطلبات ({requests.length})
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="relative max-w-xl">
            <input 
              type="text" 
              placeholder="ابحث عن منتج، مورد، أو تصنيف..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-4 pr-12 py-3.5 outline-none focus:border-[#22C55E] focus:ring-4 focus:ring-[#22C55E]/10 transition-all font-medium placeholder-slate-400 shadow-sm"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          </div>

          {activeTab === 'offers' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${!selectedCategory ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}
              >
                الكل
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategory === cat.id ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-[#22C55E]"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'offers' && (
              <motion.div
                key="offers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
              >
                {filteredOffers.length > 0 ? filteredOffers.map((offer) => (
                  <div 
                    key={offer.id} 
                    onClick={() => trackOfferInteraction(offer.id, 'click', { title: offer.title, supplierName: offer.supplierName })}
                    className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col pt-1 cursor-pointer"
                  >
                    <div className="relative aspect-square bg-slate-100 overflow-hidden m-3 rounded-2xl">
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
                    <div className="p-5 flex-1 flex flex-col pt-2">
                       <p className="text-[10px] font-bold text-[#22C55E] mb-2 uppercase tracking-tight">عرض متاح</p>
                      <div className="mb-4">
                        <h3 className="font-bold text-lg text-slate-900 mb-1 line-clamp-2 leading-tight">{offer.title}</h3>
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                           <Store size={12} />
                           {offer.supplierName}
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          {offer.originalPrice && (
                            <span className="block text-[10px] text-slate-400 line-through font-bold">{offer.originalPrice} ج.م</span>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="font-black text-2xl text-[#0B1D2A]">{offer.offerPrice}</span>
                            <span className="text-xs font-bold text-slate-500">ج.م {offer.unit ? `/ ${offer.quantity || 1} ${offer.unit}` : ''}</span>
                          </div>
                        </div>
                        <button 
                          onClick={handleActionClick}
                          className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-[#22C55E] hover:text-white transition-colors group/btn relative"
                        >
                          <ShoppingCart size={20} />
                          <div className="absolute -top-10 opacity-0 group-hover/btn:opacity-100 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded w-max transition-opacity pointer-events-none">
                             سجل للشراء
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-20 text-center text-slate-400 bg-white border border-slate-200 border-dashed rounded-3xl">
                    <Package size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-lg">لا توجد عروض تطابق بحثك حالياً.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'tenders' && (
              <motion.div
                key="tenders"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {filteredRequests.length > 0 ? filteredRequests.map((request) => (
                  <div key={request.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group flex flex-col hover:border-[#0B1D2A]/30 transition-colors">
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

                     <div className="flex justify-between items-start mb-5">
                        <div className="flex items-center gap-3">
                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-inner ${request.isUrgent ? 'bg-red-500' : 'bg-blue-500'}`}>
                              {request.isUrgent ? <ShieldAlert size={28} /> : <Package size={28} />}
                           </div>
                           <div>
                              <div className="flex items-center gap-2 mb-1">
                                 <h3 className="font-black text-lg text-slate-900 blur-[3px] select-none">طلب {request.category || 'غير محدد'}</h3>
                              </div>
                              {request.isUrgent ? (
                                <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-md text-[10px] font-black">طارئ جداً</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-md text-[10px] font-black">مناقصة</span>
                              )}
                           </div>
                        </div>
                     </div>

                     <div className="bg-slate-50 p-5 rounded-2xl mb-5 border border-slate-100 flex-1">
                        <div className="flex justify-between items-center blur-[4px] select-none mb-3">
                           <span className="text-sm font-bold text-slate-500">المنتج المطلوب:</span>
                           <span className="text-sm font-black text-slate-900 max-w-[120px] truncate">{request.productName || 'منتج غير محدد'}</span>
                        </div>
                        <div className="flex justify-between items-center blur-[4px] select-none mb-3">
                           <span className="text-sm font-bold text-slate-500">الكمية:</span>
                           <span className="text-sm font-black text-slate-900">{request.quantity || '0000'}</span>
                        </div>
                        <div className="flex justify-between items-center blur-[4px] select-none">
                           <span className="text-sm font-bold text-slate-500">المطعم:</span>
                           <span className="text-sm font-black text-slate-900">***********</span>
                        </div>
                     </div>

                     <div className="flex justify-between items-center pt-2">
                        <div className="text-[11px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                           {new Date(request.createdAt).toLocaleDateString('ar-EG')}
                        </div>
                        <button onClick={handleActionClick} className="text-xs font-black text-[#22C55E] flex items-center gap-1 hover:text-[#16a34a] transition-colors">
                           تسجيل واستعراض
                           <ArrowLeft size={14} />
                        </button>
                     </div>
                  </div>
                )) : (
                  <div className="col-span-full py-20 text-center text-slate-400 bg-white border border-slate-200 border-dashed rounded-3xl">
                    <Package size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-lg">لا توجد طلبات تطابق بحثك حالياً.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

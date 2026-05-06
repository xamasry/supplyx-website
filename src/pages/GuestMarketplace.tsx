import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, LogIn, Lock, Package, ArrowLeft, Tag, Info, ShieldAlert, ArrowRight, Search, Store, X, UserCheck } from 'lucide-react';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [loadingSupplier, setLoadingSupplier] = useState(false);

  useEffect(() => {
    const supplierId = searchParams.get('supplier');
    if (supplierId) {
      const fetchSupplierDetails = async () => {
        setLoadingSupplier(true);
        try {
          const sDoc = await getDoc(doc(db, 'users', supplierId));
          if (sDoc.exists()) {
            setSelectedSupplier({ id: sDoc.id, ...sDoc.data() });
            
            // Fetch some products to show blurred
            const pSnap = await getDocs(
              query(collection(db, 'products'), where('supplierId', '==', supplierId), orderBy('updatedAt', 'desc'))
            );
            setSupplierProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        } catch (err) {
          console.error('Error fetching supplier details:', err);
        } finally {
          setLoadingSupplier(false);
        }
      };
      fetchSupplierDetails();
    } else {
      setSelectedSupplier(null);
      setSupplierProducts([]);
    }
  }, [searchParams]);

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
          <div className="relative">
            {/* Absolute Login Wall for Guest Marketplace */}
            <div className="absolute inset-0 z-40 bg-slate-50/80 backdrop-blur-md flex flex-col items-center justify-center py-20 md:py-32 text-center px-4">
              <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl border border-white max-w-xl mx-auto ring-1 ring-slate-200/50">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-[#22C55E]/10 text-[#22C55E] rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-inner ring-8 ring-[#22C55E]/5">
                  <Lock className="w-8 h-8 md:w-12 md:h-12" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-[#0B1D2A] mb-4">انضم إلى مجتمع SupplyX</h2>
                <p className="text-slate-500 text-sm md:text-base font-bold mb-8 md:mb-10 leading-relaxed">
                  السوق المفتوح متاح فقط للأعضاء المسجلين. سجل الآن لرؤية آلاف العروض، المناقصات، والوصول المباشر لكبار الموردين في مصر.
                </p>
                <div className="flex flex-col gap-3 md:gap-4">
                  <button 
                    onClick={() => navigate('/auth/signup')}
                    className="w-full py-4 md:py-5 bg-[#22C55E] text-white rounded-2xl md:rounded-[1.5rem] font-black text-lg md:text-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#22C55E]/20"
                  >
                    سجل حسابك الآن مجاناً
                  </button>
                  <button 
                    onClick={() => navigate('/auth/login')}
                    className="w-full py-4 md:py-5 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl md:rounded-[1.5rem] font-black text-lg md:text-xl hover:bg-slate-50 transition-all"
                  >
                    تسجيل الدخول
                  </button>
                </div>
              </div>
            </div>

            {/* Blurred Background Content (Decorative/Placeholder) */}
            <div className="blur-xl opacity-20 pointer-events-none select-none">
              <AnimatePresence mode="wait">
                {activeTab === 'offers' && (
                  <motion.div
                    key="offers"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <div key={i} className="bg-white h-80 rounded-3xl border border-slate-200" />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Supplier Catalog Modal (Blurred) - This remains functional as requested initially */}
        <AnimatePresence>
          {selectedSupplier && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setSearchParams({})}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white rounded-[2.5rem] md:rounded-[3rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white"
              >
                {/* Modal Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {selectedSupplier.profileImageUrl ? (
                        <img src={selectedSupplier.profileImageUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-8 h-8 md:w-10 md:h-10 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl md:text-3xl font-black text-[#0B1D2A] mb-1 truncate">{selectedSupplier.businessName || selectedSupplier.name}</h2>
                      <div className="flex flex-wrap gap-2">
                         {selectedSupplier.isTrusted && (
                           <span className="bg-amber-500/10 text-amber-600 px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black flex items-center gap-1 md:gap-1.5">
                             <UserCheck size={10} className="md:w-3 md:h-3" />
                             موثوق
                           </span>
                         )}
                         <span className="bg-slate-100 text-slate-500 px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase">
                            مورد شريك
                         </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSearchParams({})}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-900 shadow-sm border border-slate-100 transition-all flex-shrink-0"
                  >
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>

                {/* Modal Content - Blurred */}
                <div className="relative flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                  {/* Overlay Message */}
                  <div className="absolute inset-x-0 top-0 bottom-0 z-20 flex flex-col items-center justify-center pointer-events-none p-4 md:p-6">
                     <div className="bg-white/90 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-white shadow-2xl flex flex-col items-center text-center max-w-md pointer-events-auto">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-[#22C55E]/10 text-[#22C55E] rounded-full flex items-center justify-center mb-6 shadow-inner ring-8 ring-[#22C55E]/5">
                           <Lock className="w-8 h-8 md:w-10 md:h-10" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-black text-[#0B1D2A] mb-4 leading-tight">سجل دخولك أو اشترك الآن</h3>
                        <p className="text-slate-500 text-sm md:text-base font-bold mb-6 md:mb-8 leading-relaxed">
                          يمكنك الآن رؤية كامل عروض وكتالوج هذا المورد والحصول على أفضل الأسعار الحصرية عند انضمامك لعائلة SupplyX.
                        </p>
                        <div className="flex flex-col w-full gap-3">
                           <button 
                             onClick={() => navigate('/auth/signup')}
                             className="w-full py-4 bg-[#22C55E] text-white rounded-2xl font-black text-base md:text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#22C55E]/20"
                           >
                              سجل الآن مجاناً
                           </button>
                           <button 
                             onClick={() => navigate('/auth/login')}
                             className="w-full py-4 bg-[#0B1D2A] text-white rounded-2xl font-black text-base md:text-lg hover:bg-slate-800 transition-all"
                           >
                              تسجيل الدخول
                           </button>
                        </div>
                     </div>
                  </div>

                  {/* Blurred Backdrop Content */}
                  <div className="blur-[10px] opacity-30 select-none grid grid-cols-2 lg:grid-cols-3 gap-6 pointer-events-none">
                     {loadingSupplier ? (
                        Array.from({ length: 6 }).map((_, i) => (
                           <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
                        ))
                     ) : supplierProducts.length > 0 ? (
                        supplierProducts.map(p => (
                           <div key={p.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                              <div className="aspect-square bg-slate-100 rounded-2xl mb-4" />
                              <div className="h-4 bg-slate-200 w-3/4 rounded-full mb-2" />
                              <div className="h-4 bg-slate-200 w-1/2 rounded-full" />
                           </div>
                        ))
                     ) : (
                        Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                             <div className="aspect-square bg-slate-100 rounded-2xl mb-4" />
                             <div className="h-4 bg-slate-200 w-3/4 rounded-full mb-2" />
                             <div className="h-4 bg-slate-200 w-1/2 rounded-full" />
                          </div>
                       ))
                     )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

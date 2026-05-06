import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, Store, ArrowLeft, Tag } from 'lucide-react';
import { CATEGORIES } from '../../constants';
import { trackOfferInteraction } from '../../lib/analytics';

export default function FeaturedOffers() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const q = query(
          collection(db, 'offers'),
          where('isFeatured', '==', true),
          limit(8)
        );
        const snap = await getDocs(q);
        const fetchedOffers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOffers(fetchedOffers.sort((a: any, b: any) => (a.sortOrder || 99) - (b.sortOrder || 99)).slice(0, 8));
        
        // Track views
        fetchedOffers.forEach((offer: any) => {
          trackOfferInteraction(offer.id, 'view', { 
            title: offer.title, 
            supplierName: offer.supplierName 
          });
        });
      } catch (err) {
        console.error('Error fetching featured offers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  const handleActionClick = () => {
    navigate('/auth/signup');
  };

  if (!loading && offers.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-4 md:px-6 bg-slate-50 overflow-hidden relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#22C55E]/10 text-[#22C55E] rounded-full text-sm font-bold mb-4">
            <Tag className="w-4 h-4" />
            <span>عروض حصرية لفترة محدودة</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-[#0B1D2A] tracking-tight mb-4">أقوى عروض الموردين</h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            استمتع بخصومات حصرية وأسعار تنافسية من أفضل الموردين في السوق. سجل الآن للاستفادة من هذه العروض.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-96 bg-white rounded-[2.5rem] animate-pulse shadow-sm border border-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {offers.map((offer, idx) => (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => {
                  trackOfferInteraction(offer.id, 'click', { title: offer.title, supplierName: offer.supplierName });
                  handleActionClick();
                }}
                className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-slate-200 transition-all group flex flex-col cursor-pointer"
              >
                <div className="relative aspect-[4/5] bg-slate-50 overflow-hidden m-2 rounded-[2rem]">
                  {offer.image ? (
                    <img src={offer.image} alt={offer.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-200">
                       <span className="text-7xl">{CATEGORIES.find(c => c.id === offer.categoryId || c.name === offer.category || c.name === offer.categoryName)?.icon || '✨'}</span>
                    </div>
                  )}
                  {offer.discount && (
                    <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded-2xl shadow-xl z-10 animate-bounce">
                      خصم {offer.discount}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                     <span className="text-white font-black text-sm flex items-center gap-2">
                        سجل لرؤية التفاصيل
                        <ArrowLeft className="w-4 h-4" />
                     </span>
                  </div>
                </div>
                
                <div className="p-6 pt-2 flex-1 flex flex-col">
                  <div className="mb-4">
                    <h3 className="font-black text-lg md:text-xl text-[#0B1D2A] mb-2 line-clamp-2 leading-tight group-hover:text-[#22C55E] transition-colors">{offer.title}</h3>
                    <p className="text-[10px] md:text-xs text-slate-500 font-bold flex items-center gap-2">
                       <Store size={14} className="text-[#22C55E]" />
                       {offer.supplierName}
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {offer.originalPrice && (
                        <span className="block text-[10px] text-slate-400 line-through font-bold mb-1">{offer.originalPrice} ج.م</span>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-2xl md:text-3xl text-[#0B1D2A]">{offer.offerPrice}</span>
                        <span className="text-[10px] font-bold text-slate-500">ج.م {offer.unit ? `/ ${offer.unit}` : ''}</span>
                      </div>
                    </div>
                    <button 
                      className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-[#22C55E] group-hover:text-white transition-all shadow-inner"
                    >
                      <ShoppingCart size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-16 md:mt-20 text-center">
          <Link to="/marketplace" className="inline-flex items-center gap-3 px-6 md:px-10 py-4 md:py-5 bg-[#0B1D2A] text-white rounded-2xl font-black text-base md:text-lg hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#0B1D2A]/20 group">
            استكشاف جميع العروض في السوق
            <ArrowLeft size={24} className="group-hover:-translate-x-2 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}

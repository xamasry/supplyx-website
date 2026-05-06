import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, ArrowLeft, Store } from 'lucide-react';

export default function FeaturedSuppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'supplier'),
          where('isFeatured', '==', true),
          limit(10)
        );
        const snap = await getDocs(q);
        const fetchedSuppliers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSuppliers(fetchedSuppliers.sort((a: any, b: any) => (a.sortOrder || 99) - (b.sortOrder || 99)).slice(0, 6));
      } catch (err) {
        console.error('Error fetching featured suppliers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  if (!loading && suppliers.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-4 md:px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-12 gap-6 text-center md:text-right">
          <div className="flex flex-col items-center md:items-end">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 text-amber-600 rounded-full text-sm font-bold mb-4">
              <Star className="w-4 h-4 fill-current" />
              <span>شركاء النجاح المميزين</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-[#0B1D2A] tracking-tight">الموردين المميزين لدينا</h2>
            <p className="text-slate-500 mt-4 max-w-2xl text-base md:text-lg">
              نخبة من أفضل الموردين الموثوقين في السوق المصري، يقدمون أفضل جودة وأسرع توصيل.
            </p>
          </div>
          <Link to="/marketplace" className="text-[#22C55E] font-black flex items-center gap-2 hover:gap-3 transition-all">
            استعرض جميع الموردين
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 snap-x hide-scrollbar">
            {[1, 2, 3].map(i => (
              <div key={i} className="min-w-[85vw] md:min-w-0 h-64 bg-slate-100 rounded-[2.5rem] animate-pulse snap-center" />
            ))}
          </div>
        ) : (
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 overflow-x-auto md:overflow-x-visible pb-8 md:pb-0 snap-x hide-scrollbar scroll-smooth px-2 md:px-0">
            {suppliers.map((supplier, idx) => (
              <motion.div
                key={supplier.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
                className="min-w-[85vw] md:min-w-0 snap-center"
              >
                <Link 
                  to={`/marketplace?supplier=${supplier.id}`}
                  className="block h-full bg-slate-50 border border-slate-100 rounded-[2.5rem] p-6 md:p-8 hover:bg-white hover:shadow-2xl hover:shadow-slate-200 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden">
                      {supplier.profileImageUrl ? (
                        <img src={supplier.profileImageUrl} alt={supplier.businessName} className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-10 h-10 text-slate-300" />
                      )}
                    </div>
                    {supplier.isTrusted && (
                      <div className="bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1">
                        <ShieldCheck size={12} />
                        موثوق
                      </div>
                    )}
                  </div>

                  <h3 className="text-2xl font-black text-[#0B1D2A] mb-2 group-hover:text-[#22C55E] transition-colors">
                    {supplier.businessName || supplier.name}
                  </h3>
                  <p className="text-slate-500 text-sm mb-6 line-clamp-2 leading-relaxed">
                    {supplier.description || "مورد متميز لجميع مستلزمات المطاعم والمقاهي بأفضل الأسعار وأسرع خدمة توصيل."}
                  </p>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2 rtl:space-x-reverse">
                         {[1,2,3].map(i => (
                           <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-50 bg-slate-200" />
                         ))}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 font-sans">+50 عميل</span>
                    </div>
                    <span className="bg-white px-4 py-2 rounded-xl text-xs font-black text-slate-800 shadow-sm group-hover:bg-[#22C55E] group-hover:text-white transition-all">
                      عرض الكتالوج
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

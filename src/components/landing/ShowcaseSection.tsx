import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Truck, Play, CheckCircle2, ShoppingBag, BarChart3, Clock, Zap } from 'lucide-react';

const FEATURES = {
  buyer: {
    title: 'للمطاعم والكافيهات',
    subtitle: 'كل احتياجات مطعمك في مكان واحد، بضغطة زر.',
    video: 'https://cdn.pixabay.com/video/2023/10/22/186105-877292215_tiny.mp4', // Placeholder
    points: [
      'تصفح آلاف المنتجات من كبار الموردين',
      'مقارنة الأسعار والحصول على أفضل العروض',
      'تتبع الطلبات لحظة بلحظة',
      'إدارة المشتريات والفواتير بسهولة'
    ],
    accent: '#22C55E'
  },
  supplier: {
    title: 'للموردين وتجار الجملة',
    subtitle: 'نمّي تجارتك ووصل لآلاف العملاء الجدد بسهولة.',
    video: 'https://cdn.pixabay.com/video/2020/12/28/60163-494396269_tiny.mp4', // Placeholder
    points: [
      'عرض منتجاتك لآلاف المطاعم والمقاهي',
      'إدارة المخزون والطلبات بذكاء',
      'تحليلات دقيقة للمبيعات ونمو العمل',
      'تحصيل مالي سريع وآمن'
    ],
    accent: '#3B82F6'
  }
};

export default function ShowcaseSection() {
  const [activeTab, setActiveTab] = useState<'buyer' | 'supplier'>('buyer');
  const current = FEATURES[activeTab];

  return (
    <section id="showcase" className="py-24 px-6 bg-slate-50 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className={`absolute -top-24 -right-24 w-96 h-96 rounded-full blur-[120px] opacity-10 transition-colors duration-1000`} style={{ backgroundColor: current.accent }} />
        <div className={`absolute -bottom-24 -left-24 w-96 h-96 rounded-full blur-[120px] opacity-10 transition-colors duration-1000`} style={{ backgroundColor: current.accent }} />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            key={`${activeTab}-title`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black text-[#0B1D2A] mb-6 tracking-tight"
          >
            شوف <span style={{ color: current.accent }} className="transition-colors duration-500">supplyX</span> بيعمل إيه؟
          </motion.h2>
          
          {/* Toggle Buttons */}
          <div className="inline-flex p-1.5 bg-white border border-slate-200 rounded-[2rem] shadow-sm mb-12">
            <button
              onClick={() => setActiveTab('buyer')}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-full font-black text-sm transition-all ${
                activeTab === 'buyer' 
                ? 'bg-[#22C55E] text-white shadow-lg shadow-[#22C55E]/20' 
                : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Store size={18} />
              <span>أنا مطعم / كافيه</span>
            </button>
            <button
              onClick={() => setActiveTab('supplier')}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-full font-black text-sm transition-all ${
                activeTab === 'supplier' 
                ? 'bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/20' 
                : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Truck size={18} />
              <span>أنا مورد / تاجر جملة</span>
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text Content */}
          <div className="order-2 lg:order-1 text-right">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5 }}
              >
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6`} style={{ backgroundColor: `${current.accent}15`, color: current.accent }}>
                  {activeTab === 'buyer' ? <ShoppingBag size={14} /> : <BarChart3 size={14} />}
                  <span>{current.title}</span>
                </div>
                
                <h3 className="text-3xl md:text-5xl font-black text-[#0B1D2A] mb-8 leading-tight">
                  {current.subtitle}
                </h3>

                <div className="space-y-6 mb-12">
                  {current.points.map((point, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-4 justify-end"
                    >
                      <span className="text-lg font-bold text-slate-700">{point}</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${current.accent}15`, color: current.accent }}>
                        <CheckCircle2 size={18} />
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex gap-4 justify-end">
                   <div className="flex flex-col items-center gap-2">
                     <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                        <Clock size={24} />
                     </div>
                     <span className="text-[10px] font-bold text-slate-400">سهولة وراحة</span>
                   </div>
                   <div className="flex flex-col items-center gap-2">
                     <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                        <Zap size={24} />
                     </div>
                     <span className="text-[10px] font-bold text-slate-400">نمو سريع</span>
                   </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Video Showcase Area */}
          <div className="order-1 lg:order-2 flex justify-center">
            <div className="relative group">
              {/* Outer Phone Frame */}
              <div className="relative w-[300px] md:w-[350px] aspect-[9/19] bg-[#0B1D2A] rounded-[3.5rem] p-3 shadow-2xl border-[10px] border-[#0B1D2A] overflow-hidden group-hover:scale-[1.02] transition-transform duration-700">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#0B1D2A] rounded-b-3xl z-20" />
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.6 }}
                    className="w-full h-full rounded-[2.5rem] overflow-hidden relative"
                  >
                    <video
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                      src={current.video}
                    />
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                        <Play className="text-white fill-current" size={32} />
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Floating Accents */}
              <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-8 -left-8 bg-white p-4 rounded-2xl shadow-xl z-20 hidden md:block"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-colors duration-500" style={{ backgroundColor: `${current.accent}15`, color: current.accent }}>
                   {activeTab === 'buyer' ? <Store size={24} /> : <Truck size={24} />}
                </div>
                <div className="h-2 w-12 rounded-full transition-colors duration-500" style={{ backgroundColor: `${current.accent}20` }} />
              </motion.div>
              
              <div className={`absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-30 transition-colors duration-1000`} style={{ backgroundColor: current.accent }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

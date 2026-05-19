import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Truck, Play, CheckCircle2, ShoppingBag, BarChart3, Clock, Zap, Volume2, VolumeX } from 'lucide-react';

const FEATURES = {
  buyer: {
    title: 'للمطاعم والكافيهات',
    subtitle: 'كل احتياجات مطعمك في مكان واحد، بضغطة زر.',
    video: '/SupplyX_V3-2.mp4', // Local video file from public directory
    points: [
      'تصفح آلاف المنتجات من كبار الموردين',
      'مقارنة الأسعار والحصول على أفضل العروض',
      'تتبع الطلبات لحظة بلحظة',
      'إدارة المشتريات والفواتير بسهولة'
    ],
    accent: '#22C55E',
    isComingSoon: false
  },
  supplier: {
    title: 'للموردين وتجار الجملة',
    subtitle: 'نمّي تجارتك ووصل لآلاف العملاء الجدد بسهولة.',
    video: null, // No video yet
    points: [
      'عرض منتجاتك لآلاف المطاعم والمقاهي',
      'إدارة المخزون والطلبات بذكاء',
      'تحليلات دقيقة للمبيعات ونمو العمل',
      'تحصيل مالي سريع وآمن'
    ],
    accent: '#3B82F6',
    isComingSoon: true
  }
};

export default function ShowcaseSection() {
  const [activeTab, setActiveTab] = useState<'buyer' | 'supplier'>('buyer');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const current = FEATURES[activeTab];

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      // Play if it was paused by browser block
      if (!isPlaying) {
        videoRef.current.play().then(() => setIsPlaying(true));
      }
    }
  };

  // Reset play state when tab changes
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      // Start muted for guaranteed mobile autoplay
      videoRef.current.muted = true;
      setIsMuted(true);
      
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((error) => {
        console.log("Autoplay blocked even if muted", error);
        setIsPlaying(false);
      });
    }
  }, [activeTab]);

  return (
    <section id="showcase" className="py-24 px-6 bg-white relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className={`absolute top-0 -right-24 w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.07] transition-colors duration-1000`} style={{ backgroundColor: current.accent }} />
        <div className={`absolute bottom-0 -left-24 w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.07] transition-colors duration-1000`} style={{ backgroundColor: current.accent }} />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4"
          >
            <span className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-black tracking-widest uppercase"> المميزات الذكية </span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-7xl font-black text-[#0B1D2A] mb-8 tracking-tighter"
          >
            إزاي <span style={{ color: current.accent }} className="transition-colors duration-500">supplyX</span> بيغير اللعبة؟
          </motion.h2>
          
          {/* Toggle Buttons */}
          <div className="inline-flex p-1.5 bg-slate-50 border border-slate-200 rounded-[2.5rem] shadow-inner mb-12">
            <button
              onClick={() => setActiveTab('buyer')}
              className={`flex items-center gap-3 px-6 md:px-10 py-4 rounded-full font-black text-sm md:text-base transition-all ${
                activeTab === 'buyer' 
                ? 'bg-[#22C55E] text-white shadow-xl shadow-[#22C55E]/20 scale-105' 
                : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Store size={20} />
              <span>أنا مطعم</span>
            </button>
            <button
              onClick={() => setActiveTab('supplier')}
              className={`flex items-center gap-3 px-6 md:px-10 py-4 rounded-full font-black text-sm md:text-base transition-all ${
                activeTab === 'supplier' 
                ? 'bg-[#3B82F6] text-white shadow-xl shadow-[#3B82F6]/20 scale-105' 
                : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Truck size={20} />
              <span>أنا مورد</span>
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          {/* Text Content */}
          <div className="order-2 lg:order-1 text-right">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: "circOut" }}
              >
                <div className="mb-10">
                  <h3 className="text-3xl md:text-5xl font-black text-[#0B1D2A] mb-6 leading-[1.1] tracking-tight">
                    {current.subtitle}
                  </h3>
                  <div className="w-20 h-2 rounded-full mb-8" style={{ backgroundColor: current.accent }} />
                </div>

                <div className="space-y-8 mb-12">
                  {current.points.map((point, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="flex items-start gap-5 justify-end"
                    >
                      <div className="text-right">
                        <span className="text-lg md:text-xl font-bold text-slate-700 leading-tight">{point}</span>
                      </div>
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-slate-100" style={{ backgroundColor: `${current.accent}10`, color: current.accent }}>
                        <CheckCircle2 size={24} />
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex gap-6 justify-end pt-4 border-t border-slate-100">
                   <div className="flex flex-col items-end gap-1">
                     <span className="text-xl font-black text-[#0B1D2A]">100%</span>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">أمان وتحكم</span>
                   </div>
                   <div className="w-px h-10 bg-slate-100" />
                   <div className="flex flex-col items-end gap-1">
                     <span className="text-xl font-black text-[#0B1D2A]">24/7</span>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">دعم فني</span>
                   </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Video Showcase Area */}
          <div className="order-1 lg:order-2 flex justify-center perspective-[1000px]">
            <div className="relative">
              {/* Outer Phone Frame */}
              <motion.div 
                key={activeTab}
                initial={{ rotateY: activeTab === 'buyer' ? 5 : -5, scale: 0.9 }}
                animate={{ rotateY: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="relative w-[280px] md:w-[320px] aspect-[9/19.5] bg-[#0B1D2A] rounded-[3.5rem] p-2.5 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border-[12px] border-[#0B1D2A] overflow-hidden"
              >
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#0B1D2A] rounded-b-3xl z-30" />
                
                {/* Screen Content */}
                <div 
                  className="w-full h-full rounded-[2.5rem] overflow-hidden relative bg-slate-900 cursor-pointer"
                  onClick={togglePlay}
                >
                  {current.isComingSoon || !current.video ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#0B1D2A] to-slate-900">
                      <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl">
                        <Play className="text-white/20" size={40} />
                      </div>
                      <h4 className="text-white font-black text-xl mb-3">قريباً</h4>
                      <p className="text-slate-400 text-sm font-medium leading-relaxed">
                        جاري تجهيز فيديو عرض <br /> مميزات الموردين
                      </p>
                      
                      <div className="mt-12 w-full space-y-3">
                         <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              animate={{ x: ['-100%', '100%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#3B82F6] to-transparent"
                            />
                         </div>
                         <div className="h-2 w-2/3 bg-white/5 rounded-full mx-auto" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        key={current.video}
                        autoPlay
                        muted
                        loop
                        playsInline
                        webkit-playsinline="true"
                        className="w-full h-full object-cover"
                        src={current.video}
                        onError={(e) => {
                          console.error("Video failed to load", e);
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>

                      {/* Volume Control Overlay */}
                      <div className="absolute bottom-6 left-6 z-50">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={toggleMute}
                          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"
                        >
                          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </motion.button>
                      </div>

                      {/* Manual Play/Pause Overlay */}
                      <AnimatePresence>
                        {!isPlaying && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-40 transition-opacity"
                          >
                            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-2xl">
                              <Play className="text-white fill-current translate-x-1" size={40} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                  
                  {/* Status Bar UI */}
                  <div className="absolute top-4 left-6 right-6 flex justify-between items-center z-20">
                    <span className="text-[10px] font-bold text-white/50">9:41</span>
                    <div className="flex gap-1.5">
                       <div className="w-3 h-3 rounded-full bg-white/20" />
                       <div className="w-3 h-3 rounded-full bg-white/20" />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Accents */}
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-10 -left-10 bg-white p-5 rounded-3xl shadow-2xl z-40 hidden md:block border border-slate-50"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors duration-500" style={{ backgroundColor: `${current.accent}15`, color: current.accent }}>
                   {activeTab === 'buyer' ? <Store size={28} /> : <Truck size={28} />}
                </div>
                <div className="space-y-2">
                   <div className="h-2.5 w-16 rounded-full transition-colors duration-500" style={{ backgroundColor: `${current.accent}20` }} />
                   <div className="h-2 w-10 bg-slate-100 rounded-full" />
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 15, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-6 -right-10 bg-white p-5 rounded-3xl shadow-2xl z-40 hidden md:block border border-slate-50"
              >
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                      <Zap size={20} fill="currentColor" />
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">معدل النمو</p>
                      <p className="text-xl font-black text-emerald-500 transition-colors">+240%</p>
                   </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Store, Truck, Shield, Zap, CheckCircle2, Star, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../components/ui/Logo';
import { CATEGORIES } from '../constants';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-[#22C55E]/20 text-[#0B1D2A] overflow-x-hidden">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <Logo size="md" />
        <nav className="hidden md:flex items-center gap-8 text-sm font-bold">
          <Link to="/" className="text-[#22C55E]">الرئيسية</Link>
          <Link to="/auth/login" className="hover:text-[#22C55E] transition-colors">دخول الموردين</Link>
          <Link to="/auth/login" className="hover:text-[#22C55E] transition-colors">دخول المطاعم</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link 
            to="/auth/login" 
            className="hidden sm:inline-block px-6 py-2.5 text-[#0B1D2A] hover:bg-slate-50 rounded-full font-bold text-sm transition-all border border-transparent hover:border-slate-200"
          >
            تسجيل الدخول
          </Link>
          <Link 
            to="/auth/signup" 
            className="px-6 py-2.5 bg-[#22C55E] text-white rounded-full font-bold text-sm shadow-lg shadow-[#22C55E]/30 hover:scale-105 active:scale-95 transition-all"
          >
            حساب جديد
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative px-6 pt-12 pb-24 md:pt-20 md:pb-40 bg-gradient-to-b from-[#E6ECEF]/50 to-white overflow-hidden">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-right z-10"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#22C55E]/10 text-[#22C55E] rounded-full text-sm font-bold mb-6">
                <Star className="w-4 h-4 fill-current" />
                <span>المنصة الأولى لإمدادات المطاعم في مصر</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-[#0B1D2A] mb-6 leading-[1.1] tracking-tight">
                منصة ذكية <br/>
                <span className="text-[#22C55E]">لإمداد مطعمك</span> <br/>
                بكل ما تحتاجه
              </h1>
              <p className="text-slate-500 mb-10 max-w-lg ml-auto text-xl leading-relaxed">
                نوفر لك أفضل الموردين بأسرع وقت وأسهل طريقة. اطلب خاماتك الآن واستلمها خلال دقائق.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link to="/auth/signup" className="w-full sm:w-auto px-10 py-5 bg-[#22C55E] text-white rounded-2xl font-bold text-lg shadow-xl shadow-[#22C55E]/20 hover:scale-105 active:scale-95 transition-all text-center">
                  سجل الآن مجاناً
                </Link>
                <Link to="/auth/login" className="w-full sm:w-auto px-10 py-5 bg-white text-[#0B1D2A] border border-slate-200 rounded-2xl font-bold text-lg hover:border-[#22C55E] hover:text-[#22C55E] transition-all text-center">
                  تسجيل الدخول
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="mt-12 flex items-center gap-8">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#22C55E]">
                    <Shield className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-400">أمان</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#22C55E]">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-400">سرعة</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#22C55E]">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-400">ثقة</span>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: 2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              {/* Image Placeholder with floating stats */}
              <div className="relative z-10 w-[550px] h-[650px] bg-slate-200 rounded-[4rem] overflow-hidden shadow-2xl border-8 border-white group">
                <img 
                  src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=800" 
                  alt="Restaurant supply management"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1D2A]/60 to-transparent"></div>
              </div>

              {/* Floating Stat Cards Card 1 */}
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-10 -right-10 bg-white p-6 rounded-3xl shadow-2xl z-20 border border-slate-50"
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold">موردين موثوقين</p>
                    <p className="text-2xl font-black text-[#0B1D2A]">+30</p>
                  </div>
                </div>
              </motion.div>

              {/* Card 2 */}
              <motion.div 
                animate={{ y: [0, 15, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-1/2 -left-16 bg-white p-6 rounded-3xl shadow-2xl z-20 border border-slate-50"
              >
                <div className="flex items-center gap-4 mb-2 text-right">
                  <div>
                    <p className="text-xs text-slate-400 font-bold">متوسط التوصيل</p>
                    <p className="text-2xl font-black text-[#22C55E]">28 دقيقة</p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>
              </motion.div>

              {/* Card 3 */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-10 right-20 bg-white p-6 rounded-3xl shadow-2xl z-20 border border-slate-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold">طلبات مكتملة</p>
                    <p className="text-2xl font-black text-[#0B1D2A]">+500</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Branding Banner */}
        <section className="bg-[#0B1D2A] py-20 px-6 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
             {/* Pattern placeholder */}
             <div className="w-full h-full grid grid-cols-12 gap-10">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className="text-white text-6xl font-black opacity-20">X</div>
                ))}
             </div>
          </div>
          
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
             <div className="text-right text-white">
                <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight leading-tight">
                   طلباتك تصل أسرع <br/>
                   <span className="text-[#22C55E]">من أقرب مورد، بأفضل سعر.</span>
                </h2>
             </div>
             
             <div className="flex bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 gap-16 text-center">
                <div>
                   <p className="text-4xl font-black text-[#22C55E] mb-1">50</p>
                   <p className="text-sm font-bold text-white/60 lowercase">مطعم ومقهى</p>
                </div>
                <div className="w-px h-16 bg-white/10"></div>
                <div>
                   <p className="text-4xl font-black text-white mb-1">30</p>
                   <p className="text-sm font-bold text-white/60">مورد موثوق</p>
                </div>
             </div>
          </div>
        </section>

        {/* Categories Preview */}
        <section className="py-24 px-0 bg-slate-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 text-center mb-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <h2 className="text-4xl md:text-5xl font-black text-[#0B1D2A] tracking-tight">غطينا لك كل احتياجاتك</h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-lg font-medium">
                اكثر من 18 تصنيف متخصص لجميع مستلزمات المطاعم، المقاهي، وخدمات التغذية.
              </p>
            </motion.div>
          </div>

          <div className="flex flex-col gap-8 relative">
            {/* Gradient Mask for Edges */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none" />

            {/* First Row - Moving Left */}
            <div className="flex w-full overflow-hidden">
              <motion.div 
                className="flex gap-6 px-2 py-4"
                animate={{ x: ["0%", "-33.333%"] }}
                transition={{ 
                  duration: 30, 
                  repeat: Infinity, 
                  ease: "linear",
                }}
                style={{ width: 'max-content' }}
              >
                {[...CATEGORIES, ...CATEGORIES, ...CATEGORIES].map((cat, idx) => (
                  <div 
                    key={`${cat.id}-${idx}`}
                    className="bg-white px-10 py-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-4 group transition-all hover:border-[#22C55E]/50 hover:shadow-lg hover:-translate-y-1 min-w-[220px]"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                    <span className="font-black text-slate-800 text-base whitespace-nowrap">{cat.name}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Second Row - Moving Right */}
            <div className="flex w-full overflow-hidden mt-4">
              <motion.div 
                className="flex gap-6 px-2 py-4"
                animate={{ x: ["-33.333%", "0%"] }}
                transition={{ 
                  duration: 35, 
                  repeat: Infinity, 
                  ease: "linear",
                }}
                style={{ width: 'max-content' }}
              >
                {[...CATEGORIES.slice().reverse(), ...CATEGORIES.slice().reverse(), ...CATEGORIES.slice().reverse()].map((cat, idx) => (
                  <div 
                    key={`${cat.id}-${idx}-rev`}
                    className="bg-white px-10 py-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-4 group transition-all hover:border-[#22C55E]/50 hover:shadow-lg hover:-translate-y-1 min-w-[220px]"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                    <span className="font-black text-slate-800 text-base whitespace-nowrap">{cat.name}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto text-center pt-16 px-6">
             <Link to="/auth/signup" className="inline-flex items-center gap-3 px-8 py-4 bg-[#22C55E]/5 text-[#22C55E] rounded-2xl font-bold hover:bg-[#22C55E]/10 transition-all group">
               <span>ابدأ استكشاف جميع المنتجات</span>
               <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
             </Link>
          </div>
        </section>
      </main>

      <footer className="bg-white py-12 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
           <Logo size="md" />
           <p className="text-slate-400 font-bold text-sm">supplyX &copy; {new Date().getFullYear()} - الربط الذكي لكل ما يحتاجه مطعمك.</p>
           <div className="flex items-center gap-6">
              <Link to="/admin/login" className="text-slate-300 hover:text-[#22C55E] transition-colors font-bold text-xs ml-4">الإدارة</Link>
              <Link to="#" className="text-slate-400 hover:text-[#22C55E] transition-colors font-bold text-sm">سياسة الخصوصية</Link>
              <Link to="#" className="text-slate-400 hover:text-[#22C55E] transition-colors font-bold text-sm">الشروط والأحكام</Link>
           </div>
        </div>
      </footer>
    </div>
  );
}

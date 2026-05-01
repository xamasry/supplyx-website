import React, { useState } from 'react';
import { X, Check, ShieldCheck, Zap, Star, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'buyer' | 'supplier';
  currentTier: 'standard' | 'premium';
}

export default function SubscriptionModal({ isOpen, onClose, userRole, currentTier }: SubscriptionModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const tiers = userRole === 'supplier' ? [
    {
      id: 'standard',
      name: 'Standard',
      price: '5000',
      features: [
        'ظهور أساسي في قنوات البحث',
        'كتالوج منتجات غير محدود',
        'لوحة تحكم للمبيعات',
        'دعم فني عبر البريد'
      ],
      notIncluded: [
        'أولوية في نتائج البحث',
        'إنشاء عروض ترويجية',
        'شارة التوثيق المميزة'
      ],
      icon: <Zap className="w-6 h-6" />
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '7000',
      featured: true,
      features: [
        'أولوية كاملة في نتائج البحث',
        'إنشاء عروض ترويجية حصرية',
        'شارة التوثيق المميزة (Premium)',
        'Featured Listing في الرئيسية',
        'دعم فني مخصص (مدير حساب)'
      ],
      icon: <Star className="w-6 h-6" />
    }
  ] : [
    {
      id: 'standard',
      name: 'Standard',
      price: '3000',
      features: [
        'الوصول لجميع الموردين الموثوقين',
        'طلبات شراء غير محدودة',
        'نظام تتبع الشحنات',
        'تقارير وفواتير شهرية'
      ],
      notIncluded: [
        'عروض موردين حصرية (Flash Deals)',
        'توصيات ذكية للمشتريات',
        'الأولوية في تنفيذ الطلبات'
      ],
      icon: <Zap className="w-6 h-6" />
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '5000',
      featured: true,
      features: [
        'وصول حصري لعروض Flash Deals',
        'توصيات ذكية مبنية على استهلاكك',
        'توصيل فائق السرعة من موردين مميزين',
        'تحليلات متقدمة لأسعار السوق',
        'دعم فني بأولوية قصوى'
      ],
      icon: <Star className="w-6 h-6" />
    }
  ];

  const handleUpgrade = async (tierId: string) => {
    if (tierId === currentTier) return;
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      // Check if there is already a pending request
      const q = query(
        collection(db, 'subscription_requests'),
        where('userId', '==', auth.currentUser.uid),
        where('status', '==', 'pending'),
        limit(1)
      );
      const existingRequests = await getDocs(q);
      
      if (!existingRequests.empty) {
        toast.error('لديك طلب اشتراك قيد المراجعة بالفعل');
        onClose();
        return;
      }

      // Get user context for the request
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;

      // Create a request instead of direct update
      await addDoc(collection(db, 'subscription_requests'), {
        userId: auth.currentUser.uid,
        userName: userData?.name || 'مستخدم',
        userEmail: auth.currentUser.email,
        userRole: userRole,
        currentTier: currentTier,
        requestedTier: tierId,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success(`تم إرسال طلب ${tierId === 'premium' ? 'الترقية للمميزة' : 'الباقة العادية'} للإدارة للمراجعة`);
      onClose();
    } catch (error) {
      console.error('Error requesting subscription change:', error);
      handleFirestoreError(error, OperationType.WRITE, 'subscription_requests', false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-50 rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col md:flex-row max-h-[95vh]">
        
        {/* Left decoration (Hero) */}
        <div className="hidden md:flex md:w-1/3 bg-slate-900 p-10 flex-col justify-between relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)] opacity-10 rounded-full blur-3xl -mr-32 -mt-32" />
           <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500 opacity-10 rounded-full blur-3xl -ml-24 -mb-24" />
           
           <div className="relative z-10">
             <ShieldCheck className="w-12 h-12 text-[var(--color-primary)] mb-6" />
             <h2 className="text-3xl font-black text-white leading-tight">اختر الباقة المناسبة لنمو تجارتك</h2>
             <p className="text-slate-400 text-sm mt-4 leading-relaxed">انضم لأكثر من 500 {userRole === 'supplier' ? 'مورد' : 'مطعم'} يعتمدون على المنصة يومياً.</p>
           </div>

           <div className="relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">مميزات العضوية</p>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 text-xs text-white fon-bold text-right justify-end md:justify-start">
                   <Check className="w-4 h-4 text-green-500" /> توفير في التكاليف التشغيلية
                </li>
                <li className="flex items-center gap-2 text-xs text-white font-bold text-right justify-end md:justify-start">
                   <Check className="w-4 h-4 text-green-500" /> تقارير تحليلية دقيقة
                </li>
              </ul>
           </div>
        </div>

        {/* Right Content (Options) */}
        <div className="flex-1 p-6 md:p-10 overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-slate-900">خطط الاشتراك</h3>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {tiers.map((tier) => (
              <div 
                key={tier.id}
                className={cn(
                  "relative bg-white rounded-3xl p-6 border-2 transition-all flex flex-col",
                  tier.featured ? "border-amber-500 shadow-xl shadow-amber-500/10 scale-[1.02]" : "border-slate-200 hover:border-slate-300",
                  currentTier === tier.id && "bg-slate-50 border-slate-900/10"
                )}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase">الأكثر طلباً ✨</div>
                )}
                
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-3 rounded-2xl", tier.featured ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600")}>
                    {tier.icon}
                  </div>
                  {currentTier === tier.id && (
                     <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">باقنك الحالية</span>
                  )}
                </div>

                <h4 className="text-xl font-black text-slate-900">{tier.name}</h4>
                <div className="flex items-baseline gap-1 mt-2 mb-6">
                  <span className="text-3xl font-black text-slate-900">{tier.price}</span>
                  <span className="text-slate-500 text-sm font-bold">جم / سنوياً</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                    </li>
                  ))}
                  {tier.notIncluded?.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <X className="w-4 h-4 text-slate-200 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={loading || currentTier === tier.id}
                  onClick={() => handleUpgrade(tier.id)}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2",
                    currentTier === tier.id 
                      ? "bg-slate-100 text-slate-400 cursor-default" 
                      : tier.featured 
                        ? "bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20" 
                        : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : currentTier === tier.id ? (
                    'مفعلة حالياً'
                  ) : (
                    `اختيار باقة ${tier.name}`
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center bg-slate-100 p-4 rounded-2xl border border-slate-200 border-dashed">
            <p className="text-[10px] text-slate-500 font-bold">
              * جميع الاشتراكات سنوية وتشمل التحديثات التقنية مجاناً.
              <br />
              في حال وجود أي استفسار يرجى التواصل مع الدعم الفني.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

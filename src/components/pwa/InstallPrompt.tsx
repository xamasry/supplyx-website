import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, X, Share, PlusSquare, ArrowUp, MoreVertical, Download, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export default function InstallPrompt() {
  const { isInstallable, isStandalone, install, deferredPrompt } = usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroidDevice = /Android/i.test(ua);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Show prompt after a delay if installable and not already standalone
    if ((isInstallable || isIOSDevice || isAndroidDevice) && !isStandalone) {
      const dismissed = localStorage.getItem('pwa-prompt-dismissed');
      if (dismissed !== 'true') {
        const timer = setTimeout(() => setShowPrompt(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isInstallable, isStandalone]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await install();
      setShowPrompt(false);
    } else if (isAndroid) {
      // Manual instructions for Android if native prompt fails
      alert('خطوات التثبيت للأندرويد:\n1. اضغط على القائمة (ثلاث نقاط) في زاوية المتصفح\n2. اختر "تثبيت التطبيق" أو "إضافة للشاشة الرئيسية"');
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    // Remember dismissal for 24 hours
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 200, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:bottom-6 md:right-6 md:left-auto md:max-w-md"
      >
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden relative">
          {/* Accent Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-500/10 rounded-full blur-[60px]" />
          
          <div className="p-6 md:p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex gap-4 items-center">
                <div className="w-14 h-14 bg-gradient-to-tr from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
                  <Download className="text-white" size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">تثبيت supplyX</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">تجربة تسوق أسرع وأسهل</p>
                </div>
              </div>
              <button 
                onClick={dismissPrompt}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* List of Benefits */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                'إشعارات فورية',
                'وصول سريع',
                'أداء أفضل',
                'بدون استهلاك باقة'
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <CheckCircle2 size={14} className="text-primary-500" />
                  {benefit}
                </div>
              ))}
            </div>

            {/* Platform Specific Instructions */}
            {isIOS ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                      <Share size={20} className="text-primary-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      اضغط على أيقونة <span className="text-primary-500 font-black">"مشاركة"</span> بالأسفل
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                      <PlusSquare size={20} className="text-primary-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      اختر <span className="text-primary-500 font-black">"إضافة للشاشة الرئيسية"</span>
                    </p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <ArrowUp className="text-primary-500 animate-bounce" size={32} />
                </div>
              </div>
            ) : isAndroid && !deferredPrompt ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                      <MoreVertical size={20} className="text-primary-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      اضغط على <span className="text-primary-500 font-black">القائمة</span> (ثلاث نقاط)
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                      <PlusSquare size={20} className="text-primary-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      اختر <span className="text-primary-500 font-black">"تثبيت التطبيق"</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleInstallClick}
                  className="w-full bg-primary-500 hover:bg-primary-600 active:scale-[0.98] text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-primary-500/20 transition-all text-lg flex items-center justify-center gap-3"
                >
                  <Smartphone size={20} />
                  تثبيت التطبيق الآن
                </button>
                <button
                  onClick={dismissPrompt}
                  className="w-full py-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold transition-colors text-sm"
                >
                  سأقوم بذلك لاحقاً
                </button>
              </div>
            )}
          </div>
          
          {/* Bottom highlight bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary-400 via-primary-600 to-primary-400 animate-gradient-x" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

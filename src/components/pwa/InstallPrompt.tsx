import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, X, Share, PlusSquare, ArrowUp } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export default function InstallPrompt() {
  const { isInstallable, isStandalone, install, deferredPrompt } = usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isInstallable && !isStandalone) {
      const hasDismissed = localStorage.getItem('pwa_prompt_dismissed_v2');
      if (!hasDismissed) {
        const timer = setTimeout(() => setShowPrompt(true), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isInstallable, isStandalone]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await install();
      setShowPrompt(false);
    } else if (isIOS) {
      // For iOS, button just serves as a toggle or nudge, 
      // but maybe we just keep the prompt open or scroll to instructions.
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed_v2', Date.now().toString());
  };

  if (isStandalone || !showPrompt || !isInstallable) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-[60] md:bottom-8 md:right-8 md:left-auto md:w-[400px]"
      >
        <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <button 
            onClick={dismissPrompt}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white bg-white/5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex gap-5 items-start">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/30">
              <Smartphone className="text-white" size={28} />
            </div>
            
            <div className="flex-1 pr-1 text-right">
              <h3 className="font-black text-xl mb-1 leading-tight tracking-tight">حمّل تطبيق supplyX</h3>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">استمتع بتجربة أسرع للبيع والشراء مع إشعارات فورية على هاتفك</p>

              {isIOS ? (
                <div className="mt-5 space-y-3">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all hover:bg-white/10">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-primary-500/20 rounded-xl">
                        <Share size={18} className="text-primary-400" />
                      </div>
                      <div className="text-xs font-bold text-slate-300">
                        اضغط على زر <span className="text-white">"مشاركة"</span> في أسفل المتصفح
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all hover:bg-white/10">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-primary-500/20 rounded-xl">
                        <PlusSquare size={18} className="text-primary-400" />
                      </div>
                      <div className="text-xs font-bold text-slate-300">
                        اختر <span className="text-white">"إضافة للشاشة الرئيسية"</span> من القائمة
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center pt-2">
                    <ArrowUp className="text-primary-500 animate-bounce" size={24} />
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={handleInstallClick}
                    className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-primary-500/20 text-md"
                  >
                    تثبيت الآن مجاناً
                  </button>
                  <button
                    onClick={dismissPrompt}
                    className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 font-bold hover:text-white transition-colors text-sm"
                  >
                    سأقوم بذلك لاحقاً
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

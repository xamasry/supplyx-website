import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, PlusSquare, ArrowUp } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for Android install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a short delay or based on logic
      if (!isStandaloneMode) {
        const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
        if (!hasDismissed) {
          setShowPrompt(true);
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, we check periodically if we should show instructions
    if (isIOSDevice && !isStandaloneMode) {
      const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!hasDismissed) {
        const timer = setTimeout(() => setShowPrompt(true), 3000);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setShowPrompt(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    // Remember dismissal for 7 days
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-[60] md:bottom-8 md:left-auto md:right-8 md:w-96"
      >
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-2xl border border-slate-700/50 relative overflow-hidden group">
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          
          <button 
            onClick={dismissPrompt}
            className="absolute top-3 left-3 p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/20">
              <Download className="text-white" size={24} />
            </div>
            
            <div className="flex-1 pr-4">
              <h3 className="font-black text-lg mb-1 leading-tight">تثبيت تطبيق supplyX</h3>
              <p className="text-sm text-slate-400 font-medium">
                {isIOS 
                  ? 'أضف التطبيق للشاشة الرئيسية للوصول السريع وتجربة أفضل'
                  : 'تمتع بتجربة تصفح أسرع وإشعارات فورية على هاتفك'}
              </p>

              {isIOS ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 text-xs text-slate-300 bg-slate-800/50 p-2.5 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-center w-6 h-6 bg-white/10 rounded">
                      <Share size={14} />
                    </div>
                    <span>1. اضغط على أيقونة المشاركة في المتصفح</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300 bg-slate-800/50 p-2.5 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-center w-6 h-6 bg-white/10 rounded">
                      <PlusSquare size={14} />
                    </div>
                    <span>2. اختر "Add to Home Screen" من القائمة</span>
                  </div>
                  <div className="flex justify-center pt-2">
                    <ArrowUp className="text-primary-500 animate-bounce" size={20} />
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleInstallClick}
                    className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-black py-2.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-primary-500/20 text-sm"
                  >
                    تثبيت التطبيق الآن
                  </button>
                  <button
                    onClick={dismissPrompt}
                    className="px-4 border border-slate-700 text-slate-300 font-bold hover:bg-white/5 rounded-xl transition-colors text-sm"
                  >
                    لاحقاً
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

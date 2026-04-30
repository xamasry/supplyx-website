import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const ReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[9999] p-4 bg-white rounded-2xl shadow-2xl border border-slate-100 font-sans animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
          <RefreshCw className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-slate-900 text-sm">
            {offlineReady ? 'التطبيق جاهز للعمل بدون إنترنت' : 'تحديث جديد متوفر'}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {offlineReady 
              ? 'يمكنك الآن تصفح supplyX حتى في حال انقطاع الشبكة.' 
              : 'هناك تحديث جديد متاح لتحسين تجربتك.'
            }
          </p>
          <div className="mt-3 flex items-center gap-2">
            {needRefresh && (
              <button
                onClick={() => updateServiceWorker(true)}
                className="px-4 py-1.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                تحديث الآن
              </button>
            )}
            <button
              onClick={() => close()}
              className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors"
            >
              بعدين
            </button>
          </div>
        </div>
        <button onClick={() => close()} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ReloadPrompt;

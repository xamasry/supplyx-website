import React, { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2 } from 'lucide-react';
import { auth, requestNotificationPermission, onMessageListener } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';

const PushNotificationManager: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [loading, setLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user && permission === 'default') {
        let hasPrompted = false;
        try {
          hasPrompted = !!localStorage.getItem('push_prompted');
        } catch (e) {
          console.warn('localStorage access denied');
        }
        if (!hasPrompted) {
          // Stagger the prompt
          setTimeout(() => setShowPrompt(true), 3000);
        }
      }
    });

    const unsubscribeMessages = onMessageListener((payload: any) => {
      console.log('Foreground notification received:', payload);
      toast.success(
        <div>
          <p className="font-bold">{payload.notification?.title}</p>
          <p className="text-sm">{payload.notification?.body}</p>
        </div>,
        { duration: 5000, position: 'top-center' }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMessages && typeof unsubscribeMessages === 'function') {
        unsubscribeMessages();
      }
    };
  }, [permission]);

  const handleRequestPermission = async () => {
    setLoading(true);
    const token = await requestNotificationPermission();
    const permission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
    setPermission(permission);
    setLoading(false);
    setShowPrompt(false);
    try {
      localStorage.setItem('push_prompted', 'true');
    } catch (e) {}

    if (token) {
      toast.success('تم تفعيل الإشعارات بنجاح!', {
        icon: <CheckCircle2 className="text-emerald-500" />,
      });
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
      toast.error('تم رفض الإشعارات. يمكنك تفعيلها من إعدادات المتصفح.');
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 font-sans overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/5 rounded-full -mr-16 -mt-16" />
        
        <div className="flex gap-4 relative">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-6 h-6 text-[var(--color-primary)] animate-bounce" />
          </div>
          
          <div className="flex-1">
            <h4 className="font-bold text-slate-900 text-base mb-1">تفعيل الإشعارات اللحظية</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              ابقَ على اطلاع بأحدث العروض والطلبات بمجرد وصولها. لا تفوت أي فرصة عمل!
            </p>
            
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={handleRequestPermission}
                disabled={loading}
                className="flex-1 bg-[var(--color-primary)] text-white font-bold py-2.5 rounded-xl text-sm shadow-lg shadow-blue-200 active:scale-95 transition-transform disabled:opacity-50"
              >
                {loading ? 'جاري التفعيل...' : 'نعم، فعل الإشعارات'}
              </button>
              <button
                onClick={() => {
                  setShowPrompt(false);
                  try {
                    localStorage.setItem('push_prompted', 'true');
                  } catch (e) {}
                }}
                className="px-4 py-2.5 text-slate-400 font-semibold text-sm hover:text-slate-600 transition-colors"
              >
                ليس الآن
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationManager;

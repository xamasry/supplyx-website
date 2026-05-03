import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, ChevronLeft, Clock, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import Logo from '../components/ui/Logo';
import { cn } from '../lib/utils';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  updateDoc, 
  doc, 
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeNotifs: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeNotifs) {
        unsubscribeNotifs();
        unsubscribeNotifs = null;
      }

      if (!user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid)
      );

      unsubscribeNotifs = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        data.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setNotifications(data);
        setLoading(false);
      }, (error) => {
        console.error("Notifications list error:", error);
        handleFirestoreError(error, OperationType.LIST, 'notifications', true);
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      if (unsubscribeNotifs) unsubscribeNotifs();
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), {
        read: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4">
      <header className="flex items-center justify-between mb-6 sticky top-0 bg-slate-50 py-2 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-200">
            <ChevronRight className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-slate-900">التنبيهات</h1>
        </div>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead}
            className="text-xs font-bold text-[var(--color-primary)] hover:underline"
          >
            تحديد الكل كمقروء
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Bell className="w-12 h-12 animate-pulse mb-4 opacity-20" />
          <p className="font-bold">جاري تحميل التنبيهات...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <Bell className="w-10 h-10 opacity-20" />
          </div>
          <p className="font-bold text-slate-500 text-lg">لا توجد تنبيهات حالياً</p>
          <p className="text-sm mt-1">سنقوم بإشعارك عند وجود أي تحديثات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div 
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={cn(
                "relative bg-white rounded-2xl p-4 shadow-sm border transition-all cursor-pointer hover:shadow-md",
                notif.read ? "border-slate-100 opacity-80" : "border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/10"
              )}
            >
              {!notif.read && (
                <div className="absolute top-4 left-4 w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
              )}
              
              <div className="flex gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  notif.type === 'bid_accepted' ? "bg-green-100 text-green-600" : 
                  notif.type === 'new_bid' ? "bg-blue-100 text-blue-600" : 
                  notif.type === 'broadcast' ? "bg-white border border-slate-100 scale-90" : "bg-slate-100 text-slate-600"
                )}>
                  {notif.type === 'bid_accepted' ? <CheckCircle2 className="w-6 h-6" /> : 
                   notif.type === 'new_bid' ? <Bell className="w-6 h-6" /> : 
                   notif.type === 'broadcast' ? <Logo size="sm" /> : <Info className="w-6 h-6" />}
                </div>
                
                <div className="flex-1 min-w-0 pr-4 text-right">
                  <h3 className="font-bold text-slate-900 mb-1">{notif.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">{notif.message}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      {notif.createdAt?.toDate?.() ? notif.createdAt.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن'}
                    </span>
                    <button 
                      onClick={(e) => deleteNotification(notif.id, e)}
                      className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

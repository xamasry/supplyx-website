import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Package, Tag, BarChart2, User, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import Logo from '../ui/Logo';

export default function SupplierLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [unreadCount, setUnreadCount] = useState(0);
  const path = location.pathname;
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let unsubNotifs: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      
      if (unsubNotifs) {
        unsubNotifs();
        unsubNotifs = null;
      }

      if (u) {
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', u.uid),
          where('read', '==', false)
        );
        unsubNotifs = onSnapshot(q, (snapshot) => {
          setUnreadCount(snapshot.size);
        }, (err) => console.error("SupplierLayout Notif error:", err));
      } else {
        setUnreadCount(0);
      }
    });

    return () => {
      unsubAuth();
      if (unsubNotifs) unsubNotifs();
    };
  }, []);

  const isActive = (p: string) => path.includes(p);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans pb-20">
      <header className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size="sm" className="hidden md:flex" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 border-2 border-white overflow-hidden shadow-sm">
              <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'مورد'}&background=22C55E&color=fff`} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="font-bold text-[#0B1D2A] leading-tight">
                {user?.displayName || 'الشركة المتحدة'}
              </h1>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="relative flex h-2 w-2">
                  {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                  <span className={cn("relative inline-flex rounded-full h-2 w-2", isOnline ? "bg-green-500" : "bg-slate-300")}></span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{isOnline ? 'متاح للطلب' : 'مغلق حالياً'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/supplier/notifications" className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[var(--color-danger)] text-white text-[8px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {unreadCount > 9 ? '+9' : unreadCount}
              </span>
            )}
          </Link>
          <button 
            onClick={() => setIsOnline(!isOnline)}
            className={cn("w-12 h-6 rounded-full relative transition-colors", isOnline ? "bg-[var(--color-success)]" : "bg-slate-300")}
          >
            <span className={cn("absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform", isOnline ? "translate-x-6" : "")}></span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 w-full max-w-lg mx-auto">
        {children || <Outlet />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-50">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
          <Link to="/supplier/home" className={cn("flex flex-col items-center justify-center gap-1 w-[4.5rem]", isActive('/supplier/home') ? "text-[var(--color-primary)]" : "text-slate-500")}>
            <Home className={cn("w-6 h-6", isActive('/supplier/home') && "fill-current")} />
            <span className="text-[10px] font-bold">الرئيسية</span>
          </Link>
          <Link to="/supplier/orders" className={cn("flex flex-col items-center justify-center gap-1 w-[4.5rem]", isActive('/supplier/orders') ? "text-[var(--color-primary)]" : "text-slate-500")}>
            <Package className="w-6 h-6" />
            <span className="text-[10px] font-bold">الطلبات</span>
          </Link>
          <Link to="/supplier/offers" className={cn("flex flex-col items-center justify-center gap-1 w-[4.5rem]", isActive('/supplier/offers') ? "text-[var(--color-primary)]" : "text-slate-500")}>
            <Tag className="w-6 h-6" />
            <span className="text-[10px] font-bold">عروضي</span>
          </Link>
          <Link to="/supplier/analytics" className={cn("flex flex-col items-center justify-center gap-1 w-[4.5rem]", isActive('/supplier/analytics') ? "text-[var(--color-primary)]" : "text-slate-500")}>
            <BarChart2 className="w-6 h-6" />
            <span className="text-[10px] font-bold">التقارير</span>
          </Link>
          <Link to="/supplier/profile" className={cn("flex flex-col items-center justify-center gap-1 w-[4.5rem]", isActive('/supplier/profile') ? "text-[var(--color-primary)]" : "text-slate-500")}>
            <User className="w-6 h-6" />
            <span className="text-[10px] font-bold">حسابي</span>
          </Link>
        </div>
      </nav>
      
      {/* Floating Action Button */}
      <Link to="/supplier/offers/new" className="fixed bottom-20 right-4 w-14 h-14 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-40">
        <span className="text-2xl leading-none mb-1">+</span>
      </Link>
    </div>
  );
}
